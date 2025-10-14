import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { submissionId, score, feedback } = body;

    if (!submissionId) {
      return NextResponse.json(
        { success: false, error: "Submission ID diperlukan" },
        { status: 400 }
      );
    }

    if (score === undefined || score === null) {
      return NextResponse.json(
        { success: false, error: "Nilai diperlukan" },
        { status: 400 }
      );
    }

    // Get submission details to find user, assignment, and module
    const { data: submission, error: subError } = await supabaseAdmin
      .from("module_submissions")
      .select("user_id, assignment_id")
      .eq("id", submissionId)
      .single();

    if (subError || !submission) {
      return NextResponse.json(
        { success: false, error: "Submission tidak ditemukan" },
        { status: 404 }
      );
    }

    // Get assignment details to find module and passing grade
    const { data: assignment, error: assignError } = await supabaseAdmin
      .from("module_assignments")
      .select("module_id, max_score")
      .eq("id", submission.assignment_id)
      .single();

    if (assignError || !assignment) {
      return NextResponse.json(
        { success: false, error: "Assignment tidak ditemukan" },
        { status: 404 }
      );
    }

    // Get module details
    const { data: module, error: moduleError } = await supabaseAdmin
      .from("modules")
      .select("course_id")
      .eq("id", assignment.module_id)
      .single();

    if (moduleError || !module) {
      return NextResponse.json(
        { success: false, error: "Module tidak ditemukan" },
        { status: 404 }
      );
    }

    // Determine passing grade
    let passingGrade = 70;
    const { data: quiz } = await supabaseAdmin
      .from("module_quizzes")
      .select("passing_score")
      .eq("module_id", assignment.module_id)
      .maybeSingle();

    if (quiz?.passing_score) {
      passingGrade = quiz.passing_score;
    } else if (assignment.max_score) {
      passingGrade = Math.ceil((assignment.max_score * 70) / 100);
    }

    // Update the submission with score and feedback
    const { error: updateError } = await supabaseAdmin
      .from("module_submissions")
      .update({
        score: Number(score),
        note: feedback || null,
      })
      .eq("id", submissionId);

    if (updateError) throw updateError;

    // If score is passing, auto-complete the module
    if (Number(score) >= passingGrade) {
      // Get user progress
      const { data: progress } = await supabaseAdmin
        .from("user_progress")
        .select("id, completed_modules")
        .eq("user_id", submission.user_id)
        .eq("course_id", module.course_id)
        .maybeSingle();

      let completedModules: string[] = [];
      if (progress?.completed_modules) {
        completedModules = Array.isArray(progress.completed_modules)
          ? progress.completed_modules
          : JSON.parse(String(progress.completed_modules));
      }

      // Add module to completed if not already there
      if (!completedModules.includes(assignment.module_id)) {
        completedModules.push(assignment.module_id);

        // Calculate progress percentage
        const { data: allModules } = await supabaseAdmin
          .from("modules")
          .select("id")
          .eq("course_id", module.course_id);

        const totalModules = (allModules || []).length;
        const progressPct = Math.round(
          (completedModules.length / totalModules) * 100
        );

        if (progress?.id) {
          // Update existing progress
          await supabaseAdmin
            .from("user_progress")
            .update({
              completed_modules: completedModules,
              progress_percentage: progressPct,
            })
            .eq("id", progress.id);
        } else {
          // Create new progress record
          await supabaseAdmin.from("user_progress").insert({
            user_id: submission.user_id,
            course_id: module.course_id,
            completed_modules: completedModules,
            progress_percentage: progressPct,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Nilai berhasil diberikan",
      moduleCompleted: Number(score) >= passingGrade,
    });
  } catch (error) {
    console.error("Error grading assignment:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
