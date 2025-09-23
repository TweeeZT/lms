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
      "id, enrolled_at, course:courses ( id, title, description, thumbnail, category, price, duration_min, level, total_modules, enrolled_count, rating, is_published, created_at, updated_at, instructor_id, users:instructor_id ( id, full_name, avatar ) ), progress:user_progress!left ( id, completed_modules, current_module_id )",
      { count: "exact" }
    )
    .eq("user_id", userId)
    .range(from, to);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (data || []).map((row: any) => {
    const c = row.course;
    const p = Array.isArray(row.progress) ? row.progress[0] : row.progress; // handle 1:many left join
    const completedCount = Array.isArray(p?.completed_modules)
      ? p.completed_modules.length
      : 0;
    const totalModules = c?.total_modules || 0;
    const progressPct = totalModules
      ? Math.min(100, Math.round((completedCount / totalModules) * 100))
      : 0;
    return {
      enrollmentId: row.id,
      enrolledAt: row.enrolled_at,
      course: c
        ? {
            id: c.id,
            title: c.title,
            description: c.description,
            thumbnail: c.thumbnail,
            category: c.category,
            price: c.price,
            durationMin: c.duration_min,
            level: c.level,
            totalModules,
            enrolledCount: c.enrolled_count,
            rating: Number(c.rating || 0),
            isPublished: c.is_published,
            instructor: c.users
              ? {
                  id: c.users.id,
                  fullName: c.users.full_name,
                  avatar: c.users.avatar || null,
                }
              : null,
          }
        : null,
      progress: {
        percentage: progressPct,
        completedCount,
        currentModuleId: p?.current_module_id || null,
      },
    };
  });

  return NextResponse.json({
    success: true,
    items,
    total: count || 0,
    page,
    limit,
  });
}
