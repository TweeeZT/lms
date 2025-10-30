import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/school/students/stats?schoolUserId=...&page=1&limit=20
// Returns per-student stats within a school: points, coins, xp, modulesCompleted, coursesCompleted
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const schoolUserId = searchParams.get("schoolUserId");
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  if (!schoolUserId) {
    return NextResponse.json(
      { success: false, error: "schoolUserId is required" },
      { status: 400 }
    );
  }

  try {
    // All students for the school
    const { data: ssRows, error: ssErr } = await supabase
      .from("school_students")
      .select("user_id")
      .eq("school_user_id", schoolUserId)
      .eq("status", "accepted");
    if (ssErr) throw ssErr;

    const studentIds: string[] = (ssRows || [])
      .map((r: any) => r.user_id)
      .filter(Boolean);

    if (studentIds.length === 0) {
      return NextResponse.json({ success: true, items: [], total: 0, page, limit });
    }

    // Users metadata
    const { data: users, error: uErr } = await supabase
      .from("users")
      .select("id, username, full_name, avatar")
      .in("id", studentIds);
    if (uErr) throw uErr;
    const usersMap = new Map((users || []).map((u: any) => [u.id, u]));

    // Students stats (points, coins, xp)
    const { data: students, error: stErr } = await supabase
      .from("students")
      .select("user_id, points, coins, xp")
      .in("user_id", studentIds);
    if (stErr) throw stErr;

    // Progress for modules and courses completed
    const { data: progresses } = await supabase
      .from("user_progress")
      .select("user_id, course_id, completed_modules")
      .in("user_id", studentIds);

    const byUser: Record<string, Record<string, number>> = {};
    const courseIds = new Set<string>();
    (progresses || []).forEach((p: any) => {
      let mods: unknown = p.completed_modules;
      if (typeof mods === "string") {
        try { mods = JSON.parse(mods as string); } catch { mods = []; }
      }
      const arr = Array.isArray(mods) ? (mods as unknown[]) : [];
      courseIds.add(p.course_id);
      if (!byUser[p.user_id]) byUser[p.user_id] = {};
      byUser[p.user_id][p.course_id] = arr.length;
    });

    // Totals per course to detect complete
    const totals = new Map<string, number>();
    if (courseIds.size) {
      const { data: courses } = await supabase
        .from("courses")
        .select("id, total_modules")
        .in("id", Array.from(courseIds));
      (courses || []).forEach((c: any) => totals.set(c.id, c.total_modules || 0));
    }

    // Build and paginate
    const all = (students || []).map((s: any) => {
      const u = usersMap.get(s.user_id) || {};
      const perCourse = byUser[s.user_id] || {};
      let modulesCompleted = 0;
      let coursesCompleted = 0;
      Object.entries(perCourse).forEach(([cid, done]) => {
        modulesCompleted += Number(done || 0);
        const total = totals.get(cid) || 0;
        if (total && Number(done) >= total) coursesCompleted += 1;
      });
      const xp = Number(s.xp ?? 0);
      const points = Number(s.points ?? 0);
      const coins = Number(s.coins ?? 0);
      return {
        userId: s.user_id,
        username: u.username || "",
        fullName: u.full_name || "",
        avatar: u.avatar || null,
        points,
        coins,
        xp,
        modulesCompleted,
        coursesCompleted,
      };
    });

    const total = all.length;
    const items = all.slice(from, to + 1);

    return NextResponse.json({ success: true, items, total, page, limit });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memuat stats siswa sekolah";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
