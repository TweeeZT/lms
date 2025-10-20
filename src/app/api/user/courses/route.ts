import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseServer";

// GET /api/user/courses?userId=...
// Returns enrolled courses with minimal progress summary if available
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") || "12", 10))
  );
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Missing userId" },
      { status: 400 }
    );
  }

  // enrollments join courses and users (instructor)
  const { data, error, count } = await supabaseAdmin
    .from("enrollments")
    .select(
      "id, enrolled_at, course:courses ( id, title, description, thumbnail, category, price, duration_min, level, total_modules, enrolled_count, rating, points, is_published, created_at, updated_at, instructor_id, users:instructor_id ( id, full_name, avatar ) ), progress:user_progress!left ( id, completed_modules, current_module_id )",
      { count: "exact" }
    )
    .eq("user_id", userId)
    .range(from, to);

  // If enrollments query failed hard, return 500 unless we can fallback
  const enrollmentsError = error?.message;

  type JoinedInstructor = {
    id: string;
    full_name: string;
    avatar?: string | null;
  };
  type JoinedCourse = {
    id: string;
    title: string;
    description: string | null;
    thumbnail: string | null;
    category: string;
    price: number | null;
    duration_min: number | null;
    level: string | null;
    total_modules: number | null;
    enrolled_count: number | null;
    rating: number | null;
    is_published: boolean | null;
    users?: JoinedInstructor | null;
    points?: number | null;
  };
  type ProgressJoined = {
    id?: string;
    completed_modules?: unknown;
    current_module_id?: string | null;
  } | null;
  type EnrollmentJoinedRow = {
    id?: string;
    enrolled_at?: string;
    enrolled_at_fallback?: string;
    course?: JoinedCourse | JoinedCourse[] | null;
    progress?: ProgressJoined | ProgressJoined[];
  };

  // For consistency with detail pages, compute totalModules as the number of published modules
  // Build a cache by courseId to avoid repeated lookups
  let publishedModulesCountByCourse: Record<string, number> = {};

  // Helper to map enrollment rows
  const mapEnrollmentRows = (rows: unknown[]) =>
    rows.map((r) => {
      const row = r as EnrollmentJoinedRow;
      const cRaw = row.course as
        | JoinedCourse
        | JoinedCourse[]
        | null
        | undefined;
      const c = Array.isArray(cRaw) ? cRaw[0] : cRaw;
      const pRaw = row.progress as
        | ProgressJoined
        | ProgressJoined[]
        | undefined;
      const p = Array.isArray(pRaw) ? pRaw[0] : pRaw;
      const completedCount = Array.isArray(p?.completed_modules)
        ? p.completed_modules.length
        : 0;
      const totalModules = c?.id
        ? Number(
            publishedModulesCountByCourse[c.id] ?? (c?.total_modules || 0)
          )
        : 0;
      const progressPct = totalModules
        ? Math.min(100, Math.round((completedCount / totalModules) * 100))
        : 0;
      return {
        enrollmentId:
          row.id || `up-${(c as JoinedCourse | null)?.id || "unknown"}`,
        enrolledAt:
          row.enrolled_at ||
          row.enrolled_at_fallback ||
          new Date().toISOString(),
        course: c
          ? {
              id: c.id,
              title: c.title,
              description: c.description ?? "",
              thumbnail: c.thumbnail ?? null,
              category: c.category,
              price: c.price,
              durationMin: c.duration_min,
              level: c.level ?? "beginner",
              totalModules: totalModules,
              enrolledCount: c.enrolled_count,
              rating: Number(c.rating || 0),
              isPublished: c.is_published,
              points: c.points ?? null,
              instructor: c.users
                ? {
                    id: c.users.id,
                    fullName: c.users.full_name,
                    avatar: c.users.avatar ?? null,
                  }
                : null,
            }
          : null,
        progress: {
          percentage: progressPct,
          completedCount,
          currentModuleId: p?.current_module_id ?? null,
        },
      };
    });

  if (!enrollmentsError && (data?.length || 0) > 0) {
    // Prefetch published modules count for all course ids in this page
    const courseIds = (data as unknown[])
      .map((r) => {
        const row = r as EnrollmentJoinedRow;
        const cRaw = row.course as JoinedCourse | JoinedCourse[] | null | undefined;
        const c = Array.isArray(cRaw) ? cRaw[0] : cRaw;
        return c?.id;
      })
      .filter((id): id is string => Boolean(id));
    if (courseIds.length > 0) {
      const { data: mods } = await supabaseAdmin
        .from("modules")
        .select("course_id")
        .in("course_id", courseIds)
        .or("is_published.eq.true,is_published.is.null");
      if (Array.isArray(mods)) {
        publishedModulesCountByCourse = (mods as any[]).reduce(
          (acc: Record<string, number>, row: any) => {
            const cid = row.course_id as string;
            acc[cid] = (acc[cid] || 0) + 1;
            return acc;
          },
          {}
        );
      }
    }
    // Happy path: have enrollments
    const items = mapEnrollmentRows(data as unknown[]);
    return NextResponse.json({
      success: true,
      items,
      total: count || items.length,
      page,
      limit,
    });
  }

  // Fallback: build list from user_progress joined to courses if no enrollments
  const { data: upRows, error: upErr } = await supabaseAdmin
    .from("user_progress")
    .select(
      "id, user_id, course_id, completed_modules, current_module_id, enrolled_at, course:courses ( id, title, description, thumbnail, category, price, duration_min, level, total_modules, enrolled_count, rating, points, is_published, instructor_id, users:instructor_id ( id, full_name, avatar ) )"
    )
    .eq("user_id", userId)
    .range(from, to);

  if (upErr) {
    // If both fail, return original error
    return NextResponse.json(
      { success: false, error: enrollmentsError || upErr.message },
      { status: 500 }
    );
  }

  type UserProgressJoinedRow = {
    id?: string;
    user_id?: string;
    course_id?: string;
    completed_modules?: unknown;
    current_module_id?: string | null;
    enrolled_at?: string | null;
    created_at?: string | null;
    course?: JoinedCourse | JoinedCourse[] | null;
  };
  // Prefetch published modules count for fallback as well
  const fallbackCourseIds = (upRows || [])
    .map((rowUnknown: unknown) => {
      const row = rowUnknown as UserProgressJoinedRow;
      const cRaw = row.course as JoinedCourse | JoinedCourse[] | null | undefined;
      const c = Array.isArray(cRaw) ? cRaw[0] : cRaw;
      return c?.id;
    })
    .filter((id): id is string => Boolean(id));
  if (fallbackCourseIds.length > 0) {
    const { data: mods } = await supabaseAdmin
      .from("modules")
      .select("course_id")
      .in("course_id", fallbackCourseIds)
      .or("is_published.eq.true,is_published.is.null");
    if (Array.isArray(mods)) {
      publishedModulesCountByCourse = (mods as any[]).reduce(
        (acc: Record<string, number>, row: any) => {
          const cid = row.course_id as string;
          acc[cid] = (acc[cid] || 0) + 1;
          return acc;
        },
        {}
      );
    }
  }

  const items = (upRows || []).map((rowUnknown: unknown) => {
    const row = rowUnknown as UserProgressJoinedRow;
    // Normalize shape to enrollment-like
    const cRaw = row.course as JoinedCourse | JoinedCourse[] | null | undefined;
    const c = Array.isArray(cRaw) ? cRaw[0] : cRaw;
    const p = {
      completed_modules: Array.isArray(row.completed_modules)
        ? (row.completed_modules as unknown[])
        : (() => {
            try {
              return JSON.parse((row.completed_modules as string) || "[]");
            } catch {
              return [] as unknown[];
            }
          })(),
      current_module_id: row.current_module_id ?? null,
    };
    const completedCount = (p.completed_modules as unknown[]).length;
    const totalModules = c?.id
      ? Number(
          publishedModulesCountByCourse[c.id] ?? (c?.total_modules || 0)
        )
      : 0;
    const progressPct = totalModules
      ? Math.min(100, Math.round((completedCount / totalModules) * 100))
      : 0;
    return {
      enrollmentId: row.id,
      enrolledAt: row.enrolled_at || row.created_at || new Date().toISOString(),
      course: c
        ? {
            id: c.id,
            title: c.title,
            description: c.description ?? "",
            thumbnail: c.thumbnail ?? null,
            category: c.category,
            price: c.price,
            durationMin: c.duration_min,
            level: c.level ?? "beginner",
            totalModules: totalModules,
            enrolledCount: c.enrolled_count,
            rating: Number(c.rating || 0),
            isPublished: c.is_published,
            points: c.points ?? null,
            instructor: c.users
              ? {
                  id: c.users.id,
                  fullName: c.users.full_name,
                  avatar: c.users.avatar ?? null,
                }
              : null,
          }
        : null,
      progress: {
        percentage: progressPct,
        completedCount,
        currentModuleId: p.current_module_id ?? null,
      },
    };
  });

  return NextResponse.json({
    success: true,
    items,
    total: items.length,
    page,
    limit,
  });
}
