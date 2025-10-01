import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseServer";

interface ModuleRow {
  id: string;
  course_id: string;
  title: string;
  module_kind: string;
  order_index: number | null;
}
interface CourseRow {
  id: string;
  title: string;
}
interface LiveSessionRow {
  id: string;
  module_id: string;
  title: string | null;
  agenda: string | null;
  start_at: string | null;
  duration_min: number | null;
  join_url: string | null;
  status: string | null;
  time_zone: string | null;
  modules: ModuleRow | ModuleRow[] | null;
  courses: CourseRow | CourseRow[] | null;
}

// Public-like listing (assumes user is enrolled or open); extend with auth if needed
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId"); // optional filter
  try {
    let query = supabaseAdmin
      .from("module_live_sessions")
      .select(
        "id, module_id, title, agenda, start_at, duration_min, join_url, status, time_zone, modules!inner(id, course_id, title, module_kind, order_index), courses:modules_course_id_fkey(id, title)"
      )
      .order("start_at", { ascending: true });
    if (courseId) query = query.eq("modules.course_id", courseId);
    const { data, error } = await query;
    if (error) throw error;
    const items = (
      (data as unknown as LiveSessionRow[] | null | undefined) || []
    ).map((r) => {
      const modRel = Array.isArray(r.modules) ? r.modules[0] : r.modules;
      const courseRel = Array.isArray(r.courses) ? r.courses[0] : r.courses;
      return {
        id: r.id,
        moduleId: r.module_id,
        moduleTitle: modRel?.title,
        courseId: modRel?.course_id,
        courseTitle: courseRel?.title,
        agenda: r.agenda,
        title: r.title,
        start_at: r.start_at,
        duration_min: r.duration_min,
        join_url: r.join_url,
        status: r.status,
        time_zone: r.time_zone,
      };
    });
    return NextResponse.json({ success: true, items });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
