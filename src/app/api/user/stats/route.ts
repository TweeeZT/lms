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

  // Tier mapping based on points
  function getTier(points: number): string {
    if (points >= 120000) return "Master";
    if (points >= 100000) return "Hero";
    if (points >= 80000) return "Futuristic";
    if (points >= 60000) return "Creative";
    if (points >= 40000) return "Scientist";
    if (points >= 20000) return "Explorer";
    return "Newbie";
  }

  try {
    const start = Date.now();
    const attempt: Record<string, unknown> = {};
    const { data: student, error } = await supabase
      .from("students")
      .select("user_id, points, coins")
      .eq("user_id", userId)
      .maybeSingle();
    attempt.firstError = error ? String(error.message || error) : null;
    attempt.firstDurationMs = Date.now() - start;
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
          _debug: attempt,
        });
      }
      const pts = Number(row.points ?? 0);
      return NextResponse.json({
        success: true,
        found: true,
        points: pts,
        coins: Number(row.coins ?? 0),
        tier: getTier(pts),
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
    return NextResponse.json({
      success: true,
      found: true,
      points: pts,
      coins: Number(student?.coins ?? 0),
      tier: getTier(pts),
      _debug: attempt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memuat stats";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
