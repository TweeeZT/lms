import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/user/certificates?userId=...&page=1&limit=10&search=&startDate=&endDate=&sortBy=date|title&sortDir=asc|desc
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = (searchParams.get("userId") || "").trim();
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get("limit") || 10))
  );
  const search = (searchParams.get("search") || "").trim();
  const startDate = (searchParams.get("startDate") || "").trim();
  const endDate = (searchParams.get("endDate") || "").trim();
  const sortBy = (searchParams.get("sortBy") || "date") as "date" | "title";
  const sortDir = (searchParams.get("sortDir") || "desc") as "asc" | "desc";
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId wajib" },
      { status: 400 }
    );
  }
  try {
    const { data: actor } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();
    if (!actor || actor.role !== "user")
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    try {
      let q = supabase
        .from("certificates")
        .select(
          "id, user_id, course_id, course_title, issued_at, certificate_url, score, grade",
          { count: "exact" }
        )
        .eq("user_id", userId);
      if (search) {
        const term = search.replace(/%/g, "");
        q = q.ilike("course_title", `%${term}%`);
      }
      if (startDate) q = q.gte("issued_at", startDate + "T00:00:00");
      if (endDate) q = q.lte("issued_at", endDate + "T23:59:59");
      const sortMap: Record<string, string> = {
        date: "issued_at",
        title: "course_title",
      };
      q = q.order(sortMap[sortBy] || "issued_at", {
        ascending: sortDir === "asc",
      });

      const { data, error, count } = await q.range(from, to);
      if (error) throw error;
      return NextResponse.json({
        success: true,
        items: data || [],
        total: count || 0,
        page,
        limit,
      });
    } catch {
      // Fallback: derive certificates from completed courses
      const { data: progData, error: pErr } = await supabase
        .from("user_progress")
        .select("course_id, completed_modules")
        .eq("user_id", userId);
      if (pErr) throw pErr;
      type ProgressRow = {
        course_id: string;
        completed_modules: string[] | null;
      };
      const progress: ProgressRow[] = (progData as ProgressRow[]) || [];
      const courseIds = Array.from(
        new Set(progress.map((p) => p.course_id).filter(Boolean))
      );
      if (!courseIds.length) {
        return NextResponse.json({
          success: true,
          items: [],
          total: 0,
          page,
          limit,
        });
      }
      const { data: courseRows, error: cErr } = await supabase
        .from("courses")
        .select("id, title, total_modules")
        .in("id", courseIds);
      if (cErr) throw cErr;
      type CourseRow = {
        id: string;
        title: string;
        total_modules: number | null;
      };
      const courseMap = new Map<string, { title: string; total: number }>(
        ((courseRows || []) as CourseRow[]).map((c) => [
          c.id,
          { title: c.title, total: Number(c.total_modules || 0) },
        ])
      );
      let items: Array<{
        id: string;
        user_id: string;
        course_id: string;
        course_title: string;
        issued_at: string;
        certificate_url: string | null;
        score: number | null;
        grade: string | null;
      }> = (progress || [])
        .map((p) => {
          const meta = courseMap.get(p.course_id);
          const done = Array.isArray(p.completed_modules)
            ? p.completed_modules.length
            : 0;
          const total = meta?.total || 0;
          const completed = total > 0 && done >= total;
          if (!completed) return null;
          return {
            id: `virtual_${p.course_id}`,
            user_id: userId,
            course_id: p.course_id,
            course_title: meta?.title || "Kursus",
            issued_at: new Date().toISOString(),
            certificate_url: null,
            score: null,
            grade: null,
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x));

      if (search) {
        const term = search.toLowerCase();
        items = items.filter((i) =>
          (i.course_title || "").toLowerCase().includes(term)
        );
      }
      if (startDate) {
        const sd = new Date(startDate + "T00:00:00").getTime();
        items = items.filter((i) => new Date(i.issued_at).getTime() >= sd);
      }
      if (endDate) {
        const ed = new Date(endDate + "T23:59:59").getTime();
        items = items.filter((i) => new Date(i.issued_at).getTime() <= ed);
      }
      items.sort((a, b) => {
        if (sortBy === "title") {
          const r = (a.course_title || "").localeCompare(b.course_title || "");
          return sortDir === "asc" ? r : -r;
        }
        const r =
          new Date(a.issued_at).getTime() - new Date(b.issued_at).getTime();
        return sortDir === "asc" ? r : -r;
      });
      const total = items.length;
      const paged = items.slice(from, from + limit);
      return NextResponse.json({
        success: true,
        items: paged,
        total,
        page,
        limit,
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memuat sertifikat";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
