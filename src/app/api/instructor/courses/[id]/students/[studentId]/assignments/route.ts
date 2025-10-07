import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; studentId: string }> }
) {
  try {
    const { id: courseId, studentId } = await context.params;

    // Get course and student info
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("title")
      .eq("id", courseId)
      .single();

    const { data: student } = await supabaseAdmin
      .from("users")
      .select("full_name")
      .eq("id", studentId)
      .single();

    // Get all assignment submissions for this student in this course
    const { data: submissions, error: subError } = await supabaseAdmin
      .from("module_submissions")
      .select(
        `
        id,
        assignment_id,
        user_id,
        file_url,
        link_url,
        note,
        submitted_at,
        score,
        module_assignments!inner (
          id,
          module_id,
          max_score,
          modules!inner (
            id,
            title,
            course_id
          )
        )
      `
      )
      .eq("user_id", studentId)
      .order("submitted_at", { ascending: false });

    if (subError) throw subError;

    // Filter by course and format data
    const formattedSubmissions = (submissions || [])
      .filter(
        (sub: any) => sub.module_assignments.modules.course_id === courseId
      )
      .map((sub: any) => ({
        submission_id: sub.id,
        module_id: sub.module_assignments.modules.id,
        module_title: sub.module_assignments.modules.title,
        assignment_id: sub.assignment_id,
        file_url: sub.file_url,
        link_url: sub.link_url,
        note: sub.note,
        submitted_at: sub.submitted_at,
        score: sub.score,
        max_score: sub.module_assignments.max_score,
        graded: sub.score !== null,
      }));

    return NextResponse.json({
      success: true,
      studentName: student?.full_name || "",
      courseName: course?.title || "",
      submissions: formattedSubmissions,
    });
  } catch (error) {
    console.error("Error fetching student assignments:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
