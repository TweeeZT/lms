import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// Minimal shapes returned by the join used in this endpoint
type CourseJoin = {
  id: string;
  title: string;
  // category removed from UI usage, keep optional to avoid query changes if later needed
  category?: string | null;
  total_modules: number | null;
  duration_min?: number | null;
  level?: string | null;
  enrolled_count?: number | null;
  rating?: number | null;
  thumbnail?: string | null;
};

// GET /api/user/dashboard?userId=...
// Returns: stats, courses (top 3 by recent/enrolled), discussions (latest 3), transactions (latest 3 paid/completed)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = (searchParams.get("userId") || "").trim();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId wajib" },
      { status: 400 }
    );
  }

  try {
    // Validate user role
    const { data: actor, error: uErr } = await supabase
      .from("users")
      .select("id, role, full_name")
      .eq("id", userId)
      .maybeSingle();
    if (uErr) throw uErr;
    if (!actor || actor.role !== "user")
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );

    // Student stats
    type StudentRow = {
      level?: number | null;
      points?: number | null;
      coins?: number | null;
      xp?: number | null;
    } | null;
    interface StudentProbeDiag {
      firstDurationMs?: number;
      firstError?: string | null;
      retryDurationMs?: number;
      retryError?: string | null;
      retryFound?: boolean;
    }
    const studentProbe: StudentProbeDiag = {};
    const studentStart = Date.now();
    const { data: student, error: studentErr } = await supabase
      .from("students")
      .select("user_id, level, points, coins, xp")
      .eq("user_id", userId)
      .maybeSingle<StudentRow>();
    studentProbe.firstDurationMs = Date.now() - studentStart;
    studentProbe.firstError = studentErr
      ? String(studentErr.message || studentErr)
      : null;
    if (!student && !studentErr) {
      // retry probe with limit(1)
      const retryStart = Date.now();
      const { data: retryRows, error: retryErr } = await supabase
        .from("students")
        .select("user_id, level, points, coins, xp")
        .eq("user_id", userId)
        .limit(1);
      studentProbe.retryDurationMs = Date.now() - retryStart;
      studentProbe.retryError = retryErr
        ? String(retryErr.message || retryErr)
        : null;
      if (retryRows && retryRows.length) {
        studentProbe.retryFound = true;
      }
    }

    // User progress with course join
    const { data: userProgress } = await supabase
      .from("user_progress")
      .select(
        "id, enrolled_at, course_id, completed_modules, progress_percentage, course:courses ( id, title, category, total_modules, duration_min, level, enrolled_count, rating, thumbnail )"
      )
      .eq("user_id", userId)
      .order("enrolled_at", { ascending: false })
      .limit(10);

    // Helper to unwrap 1:1 or 1:n join shapes from Supabase
    const unwrapCourse = (
      joined: CourseJoin | CourseJoin[] | null | undefined
    ): CourseJoin | null => {
      if (!joined) return null;
      return Array.isArray(joined) ? joined[0] ?? null : joined;
    };

    const progressList = userProgress || [];
    const courseIds = Array.from(
      new Set(
        progressList
          .map((p) => unwrapCourse(p.course)?.id)
          .filter((v): v is string => Boolean(v))
      )
    );

    const progressByCourse = new Map<
      string,
      { completed: number; total: number; percentage: number }
    >();
    if (courseIds.length) {
      // Use the progress data we already have from user_progress
      progressList.forEach((p) => {
        let mods: unknown = p.completed_modules as unknown;
        if (typeof mods === "string") {
          try {
            mods = JSON.parse(mods);
          } catch {
            mods = [];
          }
        }
        const arr = Array.isArray(mods) ? (mods as unknown[]) : [];
        const course = unwrapCourse(p.course);
        const totalModules = course?.total_modules || 0;
        progressByCourse.set(p.course_id, {
          completed: arr.length,
          total: totalModules,
          percentage: Number(p.progress_percentage) || 0,
        });
      });
    }

    // Stats: user wants ALL enrolled (completed + in-progress) counted as "activeCourses" displayed.
    let coursesCompleted = 0;
    let inProgress = 0;
    progressByCourse.forEach(({ percentage }) => {
      if (percentage >= 100) coursesCompleted += 1;
      else inProgress += 1;
    });
    const allEnrolledCount = coursesCompleted + inProgress;
    // Note: numeric level not used in stats anymore
    const studentFound = !!student;
    const rawPoints = student?.points ?? null;
    const rawCoins = student?.coins ?? null;
    const points = Number(rawPoints ?? 0); // Poin
    const coins = Number(rawCoins ?? 0); // Total Koin
    const currentXP = Number(
      (student as unknown as { xp?: number | null })?.xp ?? 0
    );
    // Score removed – UI will display raw points & coins instead
    // Tier derived from thresholds (same as profile/leaderboard)
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
          currentXP >= th.xp &&
          points >= th.points &&
          coursesCompleted >= th.courses
        )
          return th.key;
      }
      return "newbie";
    })();

    // Recent discussions (latest 3)
    const { data: discussions } = await supabase
      .from("discussion_posts")
      .select("id, title, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(3);

    // Latest transactions (latest 3 by date) - fallback to dummy if no data
    const { data: transactions } = await supabase
      .from("transactions")
      .select("id, date, course_title, amount, status")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(3);

    // If no transactions found, provide empty array instead of dummy data
    const transactionsList = transactions || [];

    // Top courses (take first 3 from user progress)
    const courses = progressList
      .slice(0, 3)
      .map((p) => {
        const c = unwrapCourse(p.course);
        if (!c?.id) return null;
        const pr = progressByCourse.get(c.id);
        return {
          id: c.id,
          title: c.title,
          thumbnail: c.thumbnail || null,
          totalModules: c.total_modules || 0,
          progress: Math.round(pr?.percentage || 0),
        };
      })
      .filter(
        (
          c
        ): c is {
          id: string;
          title: string;
          thumbnail: string | null;
          totalModules: number;
          progress: number;
        } => Boolean(c)
      );

    return NextResponse.json({
      success: true,
      user: { id: actor.id, fullName: actor.full_name },
      stats: {
        activeCourses: allEnrolledCount, // now all enrolled courses (completed + in-progress)
        completed: coursesCompleted,
        xp: currentXP,
        points,
        coins,
        tier,
        _diagnostic: {
          studentFound,
          rawPoints,
          rawCoins,
          rawBalance: null,
          inProgress,
          studentProbe,
        },
        // raw student payload for hard debugging (can be removed later)
        // WARNING: exposes internal fields; keep only in development/troubleshooting
        _rawStudent: student ?? null,
      },
      courses,
      discussions: discussions || [],
      transactions: transactionsList,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memuat dashboard";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
