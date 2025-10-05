import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseServer";

// GET /api/user/courses/[id]/public
// Returns basic course info + module list (title & description) for explore/detail pages
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const courseId = params.id;
  const url = new URL(_req.url);
  const userId = url.searchParams.get("userId") || null;
  if (!courseId) {
    return NextResponse.json(
      { success: false, error: "Missing course id" },
      { status: 400 }
    );
  }
  // Fetch course
  const { data: course, error: cErr } = await supabaseAdmin
    .from("courses")
    .select(
      "id,title,description,thumbnail,category,price,duration_min,level,total_modules,enrolled_count,rating,is_published,created_at,updated_at,instructor_id, users:instructor_id ( id, full_name, avatar )"
    )
    .eq("id", courseId)
    .maybeSingle();
  if (cErr) {
    return NextResponse.json(
      { success: false, error: cErr.message },
      { status: 500 }
    );
  }
  if (!course || !course.is_published) {
    return NextResponse.json(
      { success: false, error: "Course not found" },
      { status: 404 }
    );
  }

  const { data: modules, error: mErr } = await supabaseAdmin
    .from("modules")
    .select(
      "id,title,description,module_kind,order_index, module_live_sessions(start_at,duration_min)"
    )
    .eq("course_id", courseId)
    .eq("is_published", true)
    .order("order_index", { ascending: true });
  if (mErr) {
    return NextResponse.json(
      { success: false, error: mErr.message },
      { status: 500 }
    );
  }

  // Normalize joined instructor user which could be array or object
  const instrCandidate: unknown = (course as unknown as { users?: unknown })
    .users;
  const instr = Array.isArray(instrCandidate)
    ? (instrCandidate[0] as {
        id?: string;
        full_name?: string;
        avatar?: string | null;
      })
    : (instrCandidate as
        | { id?: string; full_name?: string; avatar?: string | null }
        | undefined);

  // Optional: fetch user rating if userId provided
  let userRating: number | null = null;
  if (userId) {
    const { data: ur } = await supabaseAdmin
      .from("course_ratings")
      .select("rating")
      .eq("course_id", courseId)
      .eq("user_id", userId)
      .maybeSingle();
    if (ur) userRating = (ur as { rating: number }).rating;
  }

  return NextResponse.json({
    success: true,
    course: {
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnail: course.thumbnail,
      category: course.category,
      price: course.price,
      durationMin: course.duration_min,
      level: course.level,
      totalModules: course.total_modules,
      enrolledCount: course.enrolled_count,
      rating: Number(course.rating || 0),
      userRating,
      instructor: instr
        ? {
            id: instr.id,
            fullName: instr.full_name,
            avatar: instr.avatar || null,
          }
        : null,
    },
    modules: (modules || []).map((m: Record<string, unknown>) => {
      // Extract live session data if exists
      const liveSession = Array.isArray(m.module_live_sessions)
        ? m.module_live_sessions[0]
        : m.module_live_sessions;

      return {
        id: m.id,
        title: m.title,
        description: m.description,
        kind: m.module_kind,
        order: m.order_index,
        start_at: liveSession?.start_at || null,
        duration_min: liveSession?.duration_min || null,
      };
    }),
  });
}
