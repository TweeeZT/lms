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
  category: string;
  total_modules: number | null;
  duration_min?: number | null;
  level?: string | null;
  enrolled_count?: number | null;
  rating?: number | null;
  thumbnail?: string | null;
};

type EnrollmentJoin = {
  id: string;
  enrolled_at: string;
  course?: CourseJoin | CourseJoin[] | null;
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
    const { data: student } = await supabase
      .from("students")
      .select("level, points, balance")
      .eq("user_id", userId)
      .maybeSingle();

    // Enrollments with course join
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select(
        "id, enrolled_at, course:courses ( id, title, category, total_modules, duration_min, level, enrolled_count, rating, thumbnail )"
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

    const enrollmentsList: EnrollmentJoin[] = (enrollments ||
      []) as EnrollmentJoin[];
    const courseIds = Array.from(
      new Set(
        enrollmentsList
          .map((e) => unwrapCourse(e.course)?.id)
          .filter((v): v is string => Boolean(v))
      )
    );

    const progressByCourse = new Map<
      string,
      { completed: number; total: number }
    >();
    if (courseIds.length) {
      const { data: progress } = await supabase
        .from("user_progress")
        .select("course_id, completed_modules")
        .eq("user_id", userId)
        .in("course_id", courseIds);
      const totals = new Map<string, number>();
      const { data: coursesMeta } = await supabase
        .from("courses")
        .select("id, total_modules")
        .in("id", courseIds);
      (coursesMeta || []).forEach((c) =>
        totals.set(c.id, c.total_modules || 0)
      );
      (progress || []).forEach((p) => {
        const done = Array.isArray(p.completed_modules)
          ? p.completed_modules.length
          : 0;
        progressByCourse.set(p.course_id, {
          completed: done,
          total: totals.get(p.course_id) || 0,
        });
      });
    }

    // Stats
    const coursesEnrolled = (enrollments || []).length;
    let coursesCompleted = 0;
    let modulesCompleted = 0;
    progressByCourse.forEach(({ completed, total }) => {
      modulesCompleted += completed;
      if (total && completed >= total) coursesCompleted += 1;
    });
    const level = Number(student?.level ?? 1);
    const points = Number(student?.points ?? 0);
    const currentXP = points * 10 + modulesCompleted * 5;
    const nextLevelXP = Math.max(100, level * 200);

    // Recent discussions (latest 3)
    const { data: discussions } = await supabase
      .from("discussion_posts")
      .select("id, title, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(3);

    // Latest transactions (latest 3 by date)
    const { data: transactions } = await supabase
      .from("transactions")
      .select("id, date, course_title, amount, status")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(3);

    // Top courses (take first 3 enrolled)
    const courses = enrollmentsList
      .slice(0, 3)
      .map((e) => {
        const c = unwrapCourse(e.course);
        const pr = c?.id ? progressByCourse.get(c.id) : undefined;
        const pct =
          pr && pr.total ? Math.round((pr.completed / pr.total) * 100) : 0;
        return {
          id: c?.id,
          title: c?.title,
          category: c?.category,
          totalModules: c?.total_modules || 0,
          progress: pct,
        };
      })
      .filter((c) => c.id);

    return NextResponse.json({
      success: true,
      user: { id: actor.id, fullName: actor.full_name },
      stats: {
        inProgress: Math.max(0, coursesEnrolled - coursesCompleted),
        completed: coursesCompleted,
        xp: currentXP,
        level,
        nextLevelXP,
      },
      courses,
      discussions: discussions || [],
      transactions: transactions || [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memuat dashboard";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
