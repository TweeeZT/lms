import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/user/stats?userId=...
// Returns ONLY raw points & coins straight from students table (no balance column in schema).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = (searchParams.get("userId") || "").trim();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId wajib" },
      { status: 400 }
    );
  }

  // Tier mapping based on XP, points, and courses completed (must meet ALL criteria)
  function getTier(xp: number, pts: number, courses: number): string {
    const tiers = [
      { key: "Master", xp: 60000, points: 120000, courses: 50 },
      { key: "Hero", xp: 50000, points: 100000, courses: 40 },
      { key: "Futuristic", xp: 40000, points: 80000, courses: 32 },
      { key: "Creative", xp: 30000, points: 60000, courses: 20 },
      { key: "Scientist", xp: 20000, points: 40000, courses: 12 },
      { key: "Explorer", xp: 10000, points: 20000, courses: 8 },
      { key: "Newbie", xp: 0, points: 0, courses: 0 },
    ];

    for (const t of tiers) {
      if (xp >= t.xp && pts >= t.points && courses >= t.courses) {
        return t.key;
      }
    }
    return "Newbie";
  }

  try {
    const start = Date.now();
    const attempt: Record<string, unknown> = {};

    // Get student data (points, coins)
    const { data: student, error } = await supabase
      .from("students")
      .select("user_id, points, coins")
      .eq("user_id", userId)
      .maybeSingle();

    attempt.firstError = error ? String(error.message || error) : null;
    attempt.firstDurationMs = Date.now() - start;

    // Count completed courses (100% progress)
    const { count: completedCourses } = await supabase
      .from("user_progress")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("progress_percentage", 100);

    if (!student && !error) {
      // retry with limit(1) as alternate probe
      const retryStart = Date.now();
      const { data: retryRows, error: retryErr } = await supabase
        .from("students")
        .select("user_id, points, coins")
        .eq("user_id", userId)
        .limit(1);
      attempt.retryError = retryErr
        ? String(retryErr.message || retryErr)
        : null;
      attempt.retryDurationMs = Date.now() - retryStart;
      const row = retryRows && retryRows.length ? retryRows[0] : null;
      if (!row) {
        return NextResponse.json({
          success: true,
          found: false,
          points: 0,
          coins: 0,
          tier: "Newbie",
          xp: 0,
          coursesCompleted: completedCourses || 0,
          _debug: attempt,
        });
      }
      const pts = Number(row.points ?? 0);
      const xp = pts; // For now, XP = points (can be separated later)
      return NextResponse.json({
        success: true,
        found: true,
        points: pts,
        coins: Number(row.coins ?? 0),
        tier: getTier(xp, pts, completedCourses || 0),
        xp: xp,
        coursesCompleted: completedCourses || 0,
        _debug: attempt,
      });
    }

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: String(error.message || error),
          _debug: attempt,
        },
        { status: 500 }
      );
    }

    const pts = Number(student?.points ?? 0);
    const xp = pts; // For now, XP = points (can be separated later)

    return NextResponse.json({
      success: true,
      found: true,
      points: pts,
      coins: Number(student?.coins ?? 0),
      tier: getTier(xp, pts, completedCourses || 0),
      xp: xp,
      coursesCompleted: completedCourses || 0,
      _debug: attempt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memuat stats";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
