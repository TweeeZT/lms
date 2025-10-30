import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/school/leaderboard?limit=10&page=1
// Returns leaderboard of ALL schools (role='school'), ranked by total points+coins of their students
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get("limit") || 10))
  );
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    // 1) Get all users with role='school'
    const { data: schools, error: schoolErr } = await supabase
      .from("users")
      .select("id, full_name, avatar")
      .eq("role", "school")
      .order("created_at", { ascending: true });

    if (schoolErr) throw schoolErr;
    if (!schools || schools.length === 0) {
      return NextResponse.json({
        success: true,
        items: [],
        total: 0,
        page,
        limit,
      });
    }

    // 2) For each school, get their students and calculate total score
    const schoolScores: {
      schoolId: string;
      name: string;
      avatar: string | null;
      totalPoints: number;
      totalCoins: number;
      score: number;
    }[] = [];

    for (const school of schools) {
      // Get students for this school
      const { data: students, error: studErr } = await supabase
        .from("school_students")
        .select("user_id")
        .eq("school_user_id", school.id)
        .eq("status", "accepted")
        .not("user_id", "is", null);

      if (studErr) continue; // Skip if error

      const studentIds = (students || [])
        .map((s: any) => s.user_id)
        .filter(Boolean);

      if (studentIds.length === 0) {
        schoolScores.push({
          schoolId: school.id,
          name: school.full_name || "Sekolah",
          avatar: school.avatar || null,
          totalPoints: 0,
          totalCoins: 0,
          score: 0,
        });
        continue;
      }

      // Get total points & coins from students table
      const { data: stats, error: statsErr } = await supabase
        .from("students")
        .select("points, coins")
        .in("user_id", studentIds);

      if (statsErr) continue;

      const totalPoints = (stats || []).reduce(
        (sum: number, s: any) => sum + Number(s.points || 0),
        0
      );
      const totalCoins = (stats || []).reduce(
        (sum: number, s: any) => sum + Number(s.coins || 0),
        0
      );

      // Score = (total points + total coins) / 2
      const score = (totalPoints + totalCoins) / 2;

      schoolScores.push({
        schoolId: school.id,
        name: school.full_name || "Sekolah",
        avatar: school.avatar || null,
        totalPoints,
        totalCoins,
        score,
      });
    }

    // 3) Sort by score descending
    schoolScores.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name);
    });

    // 4) Rank + paginate
    const itemsAll = schoolScores.map((s, idx) => ({
      rank: idx + 1,
      userId: s.schoolId,
      name: s.name,
      avatar: s.avatar,
      score: s.score,
    }));

    const totalAll = itemsAll.length;
    const paged = itemsAll.slice(from, to + 1);

    return NextResponse.json({
      success: true,
      items: paged,
      total: totalAll,
      page,
      limit,
    });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Gagal memuat leaderboard sekolah";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
