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

    // Fetch modules of kind tugas AND their assignment + submissions
    const { data: tugasMods, error: tmErr } = await supabase
      .from("modules")
      .select("id, title")
      .eq("course_id", courseId)
      .eq("module_kind", "tugas")
      .order("created_at", { ascending: true });
    if (tmErr) {
      console.error("Error fetching tugas modules:", tmErr);
      throw tmErr;
    }
    const tugasIds = (tugasMods || []).map((m) => m.id);

    // If no assignment modules exist, return empty
    if (tugasIds.length === 0) {
      return NextResponse.json({
        success: true,
        course: { id: course.id, title: course.title },
        items: [],
      });
    }

    const { data: assignments, error: asErr } = await supabase
      .from("module_assignments")
      .select("id, module_id, max_score")
      .in("module_id", tugasIds);
    if (asErr) {
      console.error("Error fetching assignments:", asErr);
      throw asErr;
    }
    const assignmentIds = (assignments || []).map((a) => a.id);

    // If no assignments found, return empty
    if (assignmentIds.length === 0) {
      return NextResponse.json({
        success: true,
        course: { id: course.id, title: course.title },
        items: [],
      });
    }

    const { data: subs, error: subErr } = await supabase
      .from("module_submissions")
      .select(
        "id, assignment_id, user_id, file_url, link_url, score, note, submitted_at, status"
      )
      .in("assignment_id", assignmentIds)
      .order("submitted_at", { ascending: false });
    if (subErr) {
      console.error("Error fetching submissions:", subErr);
      throw subErr;
    }

    const assignmentById = new Map<
      string,
      { module_id: string; max_score: number | null }
    >(
      (assignments || []).map((a) => [
        a.id,
        { module_id: a.module_id, max_score: a.max_score },
      ])
    );
    const moduleTitleById = new Map<string, string>(
      (tugasMods || []).map((m) => [m.id, m.title])
    );

    type Item = {
      submission_id: string;
      student_id: string;
      assignment_id: string;
      module_id: string;
      module_title: string;
      file_url: string | null;
      link_url: string | null;
      score: number | null;
      note: string | null;
      submitted_at: string;
      max_score: number | null;
      status: string | null;
    };
    const rows: Item[] = (subs || []).map((s) => {
      const a = assignmentById.get(s.assignment_id)!;
      const moduleId = a?.module_id || "";
      return {
        submission_id: s.id,
        student_id: s.user_id,
        assignment_id: s.assignment_id,
        module_id: moduleId,
        module_title: moduleTitleById.get(moduleId) || "",
        file_url: s.file_url,
        link_url: s.link_url,
        score: s.score,
        note: s.note,
        submitted_at: s.submitted_at,
        max_score: a?.max_score ?? null,
        status: s.status,
      };
    });

    const grouped: Record<string, Item[]> = {};
    for (const r of rows) {
      if (!grouped[r.student_id]) grouped[r.student_id] = [];
      grouped[r.student_id].push(r);
    }
    const studentIds = Object.keys(grouped);
    let profiles: {
      id: string;
      username: string | null;
      full_name: string | null;
    }[] = [];
    if (studentIds.length) {
      const { data: profData } = await supabase
        .from("users")
        .select("id, username, full_name")
        .in("id", studentIds);
      profiles = profData || [];
    }
    const nameById = new Map(
      profiles.map((p) => [p.id, p.full_name || p.username || p.id])
    );
    const items = Object.entries(grouped).map(([student_id, submissions]) => ({
      student_id,
      student_name: nameById.get(student_id) || student_id,
      submissions,
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

// PATCH grading: body { instructorId, submissionId, score?, note?, action? }
// action='reject' -> set status='rejected', no progress update
// action='grade' or missing -> set status='graded', update progress if passed
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const courseId = params.id;
  const body = await req.json();
  const { instructorId, submissionId, score, note, override, action } =
    body as {
      instructorId?: string;
      submissionId?: string;
      score?: number | null;
      note?: string | null;
      override?: boolean;
      action?: "reject" | "grade";
    };
  if (!instructorId || !submissionId) {
    return NextResponse.json(
      { success: false, error: "instructorId & submissionId wajib" },
      { status: 400 }
    );
  }

  // Reject action: hanya butuh note, tidak perlu score
  if (action === "reject") {
    if (!note || !note.trim()) {
      return NextResponse.json(
        { success: false, error: "Catatan wajib diisi saat menolak tugas" },
        { status: 400 }
      );
    }
  }

  try {
    const { data: course, error: cErr } = await supabase
      .from("courses")
      .select("id, instructor_id")
      .eq("id", courseId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!course || course.instructor_id !== instructorId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Load submission + assignment to get module + max_score
    const { data: subRow, error: subErr } = await supabase
      .from("module_submissions")
      .select("id, assignment_id, user_id, score, status")
      .eq("id", submissionId)
      .maybeSingle();
    if (subErr) throw subErr;
    if (!subRow) {
      return NextResponse.json(
        { success: false, error: "Submission tidak ditemukan" },
        { status: 404 }
      );
    }

    const { data: assignment, error: aErr } = await supabase
      .from("module_assignments")
      .select("id, module_id, max_score")
      .eq("id", subRow.assignment_id)
      .maybeSingle();
    if (aErr) throw aErr;
    if (!assignment) {
      return NextResponse.json(
        { success: false, error: "Assignment tidak ditemukan" },
        { status: 404 }
      );
    }

    // Handle REJECT action
    if (action === "reject") {
      const { error: uErr } = await supabase
        .from("module_submissions")
        .update({
          status: "rejected",
          note: note,
          score: null, // Clear score saat ditolak
        })
        .eq("id", submissionId);
      if (uErr) throw uErr;

      return NextResponse.json({
        success: true,
        rejected: true,
        message: "Tugas ditolak, siswa dapat submit ulang",
      });
    }

    // Default: GRADE action
    // Prevent re-grading if already graded and no override
    if (subRow.status === "graded" && !override) {
      return NextResponse.json(
        {
          success: false,
          error: "Sudah dinilai. Set override=true untuk ubah.",
        },
        { status: 409 }
      );
    }

    const maxScore = assignment.max_score ?? 100;
    let finalScore = score ?? null;
    if (finalScore != null && finalScore > maxScore) finalScore = maxScore;
    if (finalScore != null && finalScore < 0) finalScore = 0;

    const passThreshold = Math.round(maxScore * 0.6); // 60% default threshold
    const passed = finalScore != null && finalScore >= passThreshold;

    const { error: uErr } = await supabase
      .from("module_submissions")
      .update({
        score: finalScore,
        note: note ?? null,
        status: "graded", // Set status ke graded
      })
      .eq("id", submissionId);
    if (uErr) throw uErr;

    // Update progress only if passed
    let progressUpdated = false;
    if (passed) {
      const userId = subRow.user_id;
      // Load progress row
      const { data: prog } = await supabase
        .from("user_progress")
        .select("id, completed_modules, current_module_id")
        .eq("user_id", userId)
        .eq("course_id", courseId)
        .maybeSingle();
      let completed: string[] = [];
      if (prog?.completed_modules) {
        completed = Array.isArray(prog.completed_modules)
          ? (prog.completed_modules as string[])
          : (() => {
              try {
                return JSON.parse(String(prog.completed_modules));
              } catch {
                return [] as string[];
              }
            })();
      }
      if (!completed.includes(assignment.module_id)) {
        const newSet = new Set(completed);
        newSet.add(assignment.module_id);
        const updatedArr = Array.from(newSet);
        // Determine next module for gating
        const { data: modsAll } = await supabase
          .from("modules")
          .select("id, order_index")
          .eq("course_id", courseId)
          .order("order_index", { ascending: true });
        const ordered = (modsAll || [])
          .filter((m) => m.order_index != null)
          .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
        const currentIdx = ordered.findIndex(
          (m) => m.id === assignment.module_id
        );
        const nextId =
          currentIdx >= 0 && currentIdx < ordered.length - 1
            ? ordered[currentIdx + 1].id
            : assignment.module_id;
        const progressPct = Math.round(
          (updatedArr.length / (ordered.length || 1)) * 100
        );
        if (prog?.id) {
          const { error: pErr } = await supabase
            .from("user_progress")
            .update({
              completed_modules: updatedArr,
              current_module_id: nextId,
              progress_percentage: progressPct,
            })
            .eq("id", prog.id);
          if (!pErr) progressUpdated = true;
        } else {
          const { error: pInsErr } = await supabase
            .from("user_progress")
            .insert({
              user_id: userId,
              course_id: courseId,
              completed_modules: updatedArr,
              current_module_id: nextId,
              progress_percentage: progressPct,
            });
          if (!pInsErr) progressUpdated = true;
        }
      }
    }

    return NextResponse.json({
      success: true,
      passed,
      progressUpdated,
      passThreshold,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menyimpan";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
