import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseServer";

// Define row shapes for typed mapping (narrow subset of columns we select)
interface ModuleRow {
  id: string;
  course_id: string;
  order_index: number | null;
  title: string;
  module_kind: string;
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
  passcode: string | null; // added to match selected columns
  status: string | null;
  time_zone: string | null;
  created_at: string;
  updated_at: string;
  // Relation aliases per select clause
  modules: ModuleRow | ModuleRow[] | null;
  courses: CourseRow | CourseRow[] | null;
}

async function requireInstructor(userId: string) {
  if (!userId) return { ok: false, error: "userId required" } as const;
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data || data.role !== "instructor")
    return { ok: false, error: "Forbidden" } as const;
  return { ok: true, user: data } as const;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const actorId = (searchParams.get("instructorId") || "").trim();
  const auth = await requireInstructor(actorId);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.error === "Forbidden" ? 403 : 400 }
    );
  }
  try {
    // Get instructor courses ids
    const { data: courses, error: cErr } = await supabaseAdmin
      .from("courses")
      .select("id")
      .eq("instructor_id", actorId);
    if (cErr) throw cErr;
    const courseIds = (courses || []).map((c) => c.id);
    if (!courseIds.length)
      return NextResponse.json({ success: true, items: [] });

    // Fetch live sessions (upcoming first) joined with module + course
    const { data: rows, error: lErr } = await supabaseAdmin
      .from("module_live_sessions")
      .select(
        "id, module_id, title, agenda, start_at, duration_min, join_url, passcode, status, time_zone, created_at, updated_at, modules!inner(id, course_id, order_index, title, module_kind), courses:modules_course_id_fkey(id, title)"
      )
      .in("modules.course_id", courseIds)
      .order("start_at", { ascending: true });
    if (lErr) throw lErr;
    const items = (
      (rows as unknown as LiveSessionRow[] | null | undefined) || []
    ).map((r) => {
      // Supabase relation sometimes typed as array if ambiguous; normalize
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
        passcode: r.passcode,
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
