import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/user/leaderboard?limit=5&page=1
// Returns leaderboard ranked by: courses completed (desc), xp (desc), points (desc)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get("limit") || 5))
  );
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    // Fetch base student rows
    const {
      data: rowsRaw,
      error,
      count,
    } = await supabase
      .from("students")
      // Select all columns to be resilient to schema differences (e.g., xp may not exist)
      .select("*", { count: "exact" });
    if (error) throw error;
    const rows = rowsRaw || [];

    const ids = (rows || []).map((r) => r.user_id).filter(Boolean);
    type UserRow = {
      id: string;
      username: string | null;
      full_name: string | null;
      avatar: string | null;
    };
    let usersMap = new Map<string, UserRow>();
    if (ids.length) {
      const { data: users, error: uErr } = await supabase
        .from("users")
        .select("id, username, full_name, avatar")
        .in("id", ids);
      if (uErr) throw uErr;
      usersMap = new Map(((users || []) as UserRow[]).map((u) => [u.id, u]));
    }

    // Compute modules and completed courses for ranking
    let progressByUser = new Map<
      string,
      { modulesCompleted: number; coursesCompleted: number }
    >();
    if (ids.length) {
      const { data: progresses } = await supabase
        .from("user_progress")
        .select("user_id, course_id, completed_modules")
        .in("user_id", ids);
      const byUser = new Map<string, { [courseId: string]: number }>();
      const courseIds = new Set<string>();
      (progresses || []).forEach((p) => {
        let mods: unknown = p.completed_modules as unknown;
        if (typeof mods === "string") {
          try {
            mods = JSON.parse(mods);
          } catch {
            mods = [];
          }
        }
        const arr = Array.isArray(mods) ? (mods as unknown[]) : [];
        courseIds.add(p.course_id);
        const map = byUser.get(p.user_id) || {};
        map[p.course_id] = arr.length;
        byUser.set(p.user_id, map);
      });
      // Fetch course totals
      const totals = new Map<string, number>();
      if (courseIds.size) {
        const { data: courses } = await supabase
          .from("courses")
          .select("id, total_modules")
          .in("id", Array.from(courseIds));
        (courses || []).forEach((c) => totals.set(c.id, c.total_modules || 0));
      }
      // Build per-user stats
      progressByUser = new Map(
        Array.from(byUser.entries()).map(([uid, byCourse]) => {
          let modules = 0;
          let completed = 0;
          Object.entries(byCourse).forEach(([cid, done]) => {
            const total = totals.get(cid) || 0;
            modules += done;
            if (total && done >= total) completed += 1;
          });
          return [
            uid,
            { modulesCompleted: modules, coursesCompleted: completed },
          ];
        })
      );
    }

    // Materialize items with stored XP only (no heuristics) and build fields
    const materialized = (rows || []).map((s) => {
      const u =
        (usersMap.get(s.user_id) as UserRow | undefined) || ({} as UserRow);
      const level = Number(s.level || 1);
      const points = Number(s.points || 0);
      const coursesCompleted =
        progressByUser.get(s.user_id)?.coursesCompleted || 0;
      const sAny: unknown = s as unknown;
      const storedXP =
        sAny && typeof sAny === "object" && "xp" in sAny
          ? Number((sAny as { xp?: number | null }).xp || 0)
          : 0;
      const xp = storedXP; // strictly use DB value
      // Score is the arithmetic mean of the three categories
      // rata-rata = (coursesCompleted + points + xp) / 3
      const score = (coursesCompleted + points + xp) / 3;

      // Derive a tier label from thresholds (same as UI tiers)
      // Order: master > hero > futuristic > creative > scientist > explorer > newbie
      const tier = (() => {
        const t = [
          { key: "master", xp: 60000, points: 120000, courses: 50 },
          { key: "hero", xp: 50000, points: 100000, courses: 40 },
          { key: "futuristic", xp: 40000, points: 80000, courses: 32 },
          { key: "creative", xp: 30000, points: 60000, courses: 20 },
          { key: "scientist", xp: 20000, points: 40000, courses: 12 },
          { key: "explorer", xp: 10000, points: 20000, courses: 8 },
          { key: "newbie", xp: 0, points: 0, courses: 0 },
        ];
        for (const th of t) {
          if (
            xp >= th.xp &&
            points >= th.points &&
            coursesCompleted >= th.courses
          )
            return th.key;
        }
        return "newbie";
      })();
      return {
        userId: s.user_id,
        username: u.username || "",
        fullName: u.full_name || "",
        avatar: u.avatar || null,
        level, // retained for backward compatibility (UI will show tier)
        points,
        xp,
        coursesCompleted,
        balance: Number(s.balance || 0),
        score,
        tier,
      };
    });

    // Sort by score desc
    materialized.sort((a, b) => b.score - a.score);
    const paged = materialized.slice(from, to + 1).map((m, idx) => ({
      rank: from + idx + 1,
      userId: m.userId,
      username: m.username,
      fullName: m.fullName,
      avatar: m.avatar,
      // keep legacy fields internally but consumers should only show tier + score
      level: m.level,
      points: m.points,
      xp: m.xp,
      coursesCompleted: m.coursesCompleted,
      balance: m.balance,
      score: m.score,
      tier: m.tier,
    }));

    return NextResponse.json({
      success: true,
      items: paged,
      total: count || materialized.length,
      page,
      limit,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memuat leaderboard";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
