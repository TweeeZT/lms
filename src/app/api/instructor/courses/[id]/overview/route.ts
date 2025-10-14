import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/instructor/courses/[id]/overview?instructorId=...
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  const courseId = params.id;

  if (!instructorId) {
    return NextResponse.json(
      { success: false, error: "instructorId wajib" },
      { status: 400 }
    );
  }

  try {
    // Verify ownership
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("id, instructor_id")
      .eq("id", courseId)
      .maybeSingle();

    if (courseErr) throw courseErr;
    if (!course || course.instructor_id !== instructorId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Fetch overview module
    const { data: module, error: moduleErr } = await supabase
      .from("modules")
      .select("id, title")
      .eq("course_id", courseId)
      .eq("module_kind", "overview")
      .maybeSingle();

    if (moduleErr) throw moduleErr;

    if (!module) {
      return NextResponse.json({
        success: true,
        overview: null,
      });
    }

    // Fetch module_summary
    const { data: summary, error: summaryErr } = await supabase
      .from("module_summary")
      .select("text_content")
      .eq("module_id", module.id)
      .maybeSingle();

    if (summaryErr) throw summaryErr;

    return NextResponse.json({
      success: true,
      overview: {
        moduleId: module.id,
        title: module.title,
        content: summary?.text_content || "",
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal memuat overview";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
