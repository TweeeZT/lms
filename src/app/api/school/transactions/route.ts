import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/school/transactions?schoolId=...&page=1&limit=10&search=&status=paid|pending|failed&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&sortBy=date|amount|course_title&sortDir=asc|desc
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const schoolId = (searchParams.get("schoolId") || "").trim();
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 10)));
  const search = (searchParams.get("search") || "").trim();
  const status = (searchParams.get("status") || "").trim();
  const startDate = (searchParams.get("startDate") || "").trim();
  const endDate = (searchParams.get("endDate") || "").trim();
  const sortBy = (searchParams.get("sortBy") || "date") as "date" | "amount" | "course_title";
  const sortDir = (searchParams.get("sortDir") || "desc") as "asc" | "desc";
  if (!schoolId) {
    return NextResponse.json(
      { success: false, error: "schoolId wajib" },
      { status: 400 }
    );
  }
  try {
    // Validate role school
    const { data: actor, error: uErr } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", schoolId)
      .maybeSingle();
    if (uErr) throw uErr;
    if (!actor || actor.role !== "school")
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    let q = supabase
      .from("transactions")
      .select(
        "id, date, user_id, user_name, course_id, course_title, amount, method, status",
        { count: "exact" }
      )
      .eq("user_id", schoolId);

    if (search) {
      const term = search.replace(/%/g, "");
      q = q.or(`course_title.ilike.%${term}%,user_name.ilike.%${term}%`);
    }
    if (status) q = q.eq("status", status);
    if (startDate) q = q.gte("date", startDate + "T00:00:00");
    if (endDate) q = q.lte("date", endDate + "T23:59:59");

    const sortMap: Record<string, string> = {
      date: "date",
      amount: "amount",
      course_title: "course_title",
    };
    q = q.order(sortMap[sortBy] || "date", { ascending: sortDir === "asc" });

    const { data, error, count } = await q.range(from, to);
    if (error) throw error;

    return NextResponse.json({
      success: true,
      items: data || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memuat transaksi";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}