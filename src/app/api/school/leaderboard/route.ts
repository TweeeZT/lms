import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/school/leaderboard?schoolUserId=...&limit=5&page=1
// Returns leaderboard limited to a school's students, ranked by the same score metric as global (avg of coursesCompleted, points, xp)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const schoolUserId = searchParams.get("schoolUserId");
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 5)));
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  if (!schoolUserId) {
    return NextResponse.json(
      { success: false, error: "schoolUserId is required" },
      { status: 400 }
    );
  }

  try {
    // Find student user_ids under this school
    const { data: ssRows, error: ssErr } = await supabase
      .from("school_students")
      .select("user_id")
      .eq("school_user_id", schoolUserId)
      .eq("status", "accepted");
    if (ssErr) throw ssErr;
    const studentIds = (ssRows || []).map((r: any) => r.user_id).filter(Boolean);

    if (!studentIds.length) {
      return NextResponse.json({ success: true, items: [], total: 0, page, limit });
    }

    // Pull student stats
    const { data: students, error: stErr } = await supabase
      .from("students")
      .select("user_id, level, points, balance, xp")
      .in("user_id", studentIds);
    if (stErr) throw stErr;

    // Map user metadata
    const { data: users, error: uErr } = await supabase
      .from("users")
      .select("id, username, full_name, avatar")
      .in("id", studentIds);
    if (uErr) throw uErr;
    const usersMap = new Map((users || []).map((u: any) => [u.id, u]));

    // Progress for coursesCompleted
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

    // Course totals to detect completion
    const totals = new Map<string, number>();
    if (courseIds.size) {
      const { data: courses } = await supabase
        .from("courses")
        .select("id, total_modules")
        .in("id", Array.from(courseIds));
      (courses || []).forEach((c: any) => totals.set(c.id, c.total_modules || 0));
    }

    // Build items
    const itemsRaw = (students || []).map((s: any) => {
      const u = usersMap.get(s.user_id) || {};
      const perCourse = byUser[s.user_id] || {};
      let coursesCompleted = 0;
      Object.entries(perCourse).forEach(([cid, done]) => {
        const total = totals.get(cid) || 0;
        if (total && done >= total) coursesCompleted += 1;
      });
      const xp = Number(s.xp || 0);
      const points = Number(s.points || 0);
      const score = (coursesCompleted + points + xp) / 3; // same metric as global
      return {
        userId: s.user_id,
        username: u.username || "",
        fullName: u.full_name || "",
        avatar: u.avatar || null,
        level: Number(s.level || 1),
        points,
        xp,
        coursesCompleted,
        score,
      };
    });

    itemsRaw.sort((a, b) => b.score - a.score);
    const paged = itemsRaw.slice(from, to + 1).map((it, idx) => ({
      rank: from + idx + 1,
      ...it,
    }));

    return NextResponse.json({ success: true, items: paged, total: itemsRaw.length, page, limit });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memuat leaderboard sekolah";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
