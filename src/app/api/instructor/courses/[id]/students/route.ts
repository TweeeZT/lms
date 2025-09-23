import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/instructor/courses/[id]/students?instructorId=...
// Returns grouped assignment submissions by student for the course
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const courseId = params.id;
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  if (!instructorId) {
    return NextResponse.json(
      { success: false, error: "instructorId wajib" },
      { status: 400 }
    );
  }

  try {
    // Ensure ownership
    const { data: course, error: cErr } = await supabase
      .from("courses")
      .select("id, instructor_id, title")
      .eq("id", courseId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!course || course.instructor_id !== instructorId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Get modules of type tugas for this course
    const { data: tugasModules, error: mErr } = await supabase
      .from("modules")
      .select("id, title")
      .eq("course_id", courseId)
      .eq("module_kind", "tugas");
    if (mErr) throw mErr;
    const moduleIds = (tugasModules || []).map((m) => m.id);
    if (!moduleIds.length) {
      return NextResponse.json({
        success: true,
        course: { id: course.id, title: course.title },
        items: [],
      });
    }

    // Get assignments for those modules
    const { data: assignments, error: aErr } = await supabase
      .from("module_assignments")
      .select("id, module_id, instructions, due_date, max_score")
      .in("module_id", moduleIds);
    if (aErr) throw aErr;
    const assignmentIds = (assignments || []).map((a) => a.id);
    if (!assignmentIds.length) {
      return NextResponse.json({
        success: true,
        course: { id: course.id, title: course.title },
        items: [],
      });
    }

    // Build map for module title lookup
    const moduleTitleById = new Map<string, string>(
      (tugasModules || []).map((m) => [m.id, m.title])
    );
    const assignmentById = new Map<
      string,
      { module_id: string; max_score: number | null }
    >(
      (assignments || []).map((a) => [
        a.id,
        { module_id: a.module_id, max_score: a.max_score ?? null },
      ])
    );

    // Get submissions for those assignments
    const { data: submissions, error: sErr } = await supabase
      .from("module_assignment_submissions")
      .select(
        "id, assignment_id, student_id, file_path, answer_link, text_answer, grade, feedback, submitted_at"
      )
      .in("assignment_id", assignmentIds)
      .order("submitted_at", { ascending: false });
    if (sErr) throw sErr;

    // Compute public URLs for files if present
    type Item = {
      submission_id: string;
      student_id: string | null;
      assignment_id: string;
      module_id?: string;
      module_title: string;
      file_url: string | null;
      answer_link: string | null;
      text_answer: string | null;
      grade: number | null;
      feedback: string | null;
      submitted_at: string;
      max_score: number | null;
    };
    const itemsRaw: Item[] = (submissions || []).map((s) => {
      const a = assignmentById.get(s.assignment_id!);
      const moduleId = a?.module_id;
      const moduleTitle = moduleId ? moduleTitleById.get(moduleId) || "" : "";
      const publicUrl = s.file_path
        ? supabase.storage
            .from("assignments-submissions")
            .getPublicUrl(s.file_path).data.publicUrl
        : null;
      return {
        submission_id: s.id,
        student_id: s.student_id,
        assignment_id: s.assignment_id,
        module_id: moduleId,
        module_title: moduleTitle,
        file_url: publicUrl,
        answer_link: s.answer_link,
        text_answer: s.text_answer,
        grade: s.grade,
        feedback: s.feedback,
        submitted_at: s.submitted_at,
        max_score: a?.max_score ?? null,
      };
    });

    // Group by student_id
    const grouped: Record<string, Item[]> = {};
    for (const item of itemsRaw) {
      const key = item.student_id || "unknown";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }

    const items = Object.entries(grouped).map(([student_id, subs]) => ({
      student_id,
      submissions: subs,
    }));

    return NextResponse.json({
      success: true,
      course: { id: course.id, title: course.title },
      items,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal memuat data siswa";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
