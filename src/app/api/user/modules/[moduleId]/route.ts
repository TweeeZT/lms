import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseServer";
import { randomUUID } from "crypto";

// GET /api/user/modules/[moduleId]?userId=... to fetch module detail
export async function GET(
  req: NextRequest,
  { params }: { params: { moduleId: string } }
) {
  const { moduleId } = params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId)
    return NextResponse.json(
      { success: false, error: "Missing userId" },
      { status: 400 }
    );

  // Base module (with coins and points)
  const { data: mod, error: modErr } = await supabaseAdmin
    .from("modules")
    .select("id, course_id, title, description, module_kind, coins, points")
    .eq("id", moduleId)
    .maybeSingle();
  if (modErr || !mod)
    return NextResponse.json(
      { success: false, error: modErr?.message || "Not found" },
      { status: 404 }
    );

  // Check if course is expired using expire_at from user_progress
  const { data: courseData } = await supabaseAdmin
    .from("courses")
    .select("id, instructor_id")
    .eq("id", mod.course_id)
    .maybeSingle();
  
  if (courseData) {
    const isInstructor = String(courseData.instructor_id) === String(userId);
    
    if (!isInstructor) {
      // Get expire_at from user_progress
      const { data: progress } = await supabaseAdmin
        .from("user_progress")
        .select("expire_at")
        .eq("user_id", userId)
        .eq("course_id", mod.course_id)
        .maybeSingle();
      
      if (progress?.expire_at) {
        const expiryTime = Date.parse(progress.expire_at);
        const isExpired = !isNaN(expiryTime) && Date.now() > expiryTime;
        
        if (isExpired) {
          return NextResponse.json(
            { success: false, error: "Kursus ini telah kedaluwarsa. Silakan beli lagi untuk melanjutkan." },
            { status: 403 }
          );
        }
      }
    }
  }

  // Content (optional)
  const { data: content } = await supabaseAdmin
    .from("module_contents")
    .select("id, content_type, url, file_path, text_content")
    .eq("module_id", moduleId)
    .maybeSingle();

  // For overview modules, also fetch from module_summary
  let summaryText: string | null = null;
  if (mod.module_kind === "overview") {
    const { data: summary } = await supabaseAdmin
      .from("module_summary")
      .select("text_content")
      .eq("module_id", moduleId)
      .maybeSingle();
    summaryText = summary?.text_content || null;
  }

  // Quiz (optional) with questions
  const { data: quiz } = await supabaseAdmin
    .from("module_quizzes")
    .select("id, title, passing_score, time_limit")
    .eq("module_id", moduleId)
    .maybeSingle();
  type QuestionRow = {
    id: string;
    question: string;
    q_type: string;
    options_json?: unknown;
    explanation?: string | null;
  };
  let questions: Array<{
    id: string;
    question: string;
    q_type: string;
    options: string[];
    explanation?: string | null;
  }> = [];
  if (quiz?.id) {
    const { data: qs } = await supabaseAdmin
      .from("module_quiz_questions")
      .select("id, question, q_type, options_json, explanation")
      .eq("quiz_id", quiz.id);
    questions = (qs || []).map((q: QuestionRow) => {
      let opts: string[] = [];
      if (q.options_json != null) {
        try {
          if (typeof q.options_json === "string") {
            const parsed = JSON.parse(q.options_json as string);
            if (Array.isArray(parsed)) opts = parsed.map(String);
          } else if (Array.isArray(q.options_json)) {
            opts = (q.options_json as unknown[]).map(String);
          }
        } catch {}
      }
      // Fallback for true/false
      if (!opts.length && q.q_type === "true-false") {
        opts = ["True", "False"];
      }
      return {
        id: q.id,
        question: q.question,
        q_type: q.q_type,
        options: opts,
        explanation: (q as QuestionRow).explanation || null,
      };
    });
  }

  // Last quiz attempt (to persist result after reload)
  type AttemptRow = {
    id: string;
    score: number;
    correct_count: number;
    total_questions: number;
    passed: boolean;
    submitted_at: string;
    answers?: Array<{ questionId: string; answer: string }>;
  };
  let lastAttempt: AttemptRow | null = null;
  if (quiz?.id) {
    const { data: attemptData } = await supabaseAdmin
      .from("quiz_attempts")
      .select(
        "id, score, correct_count, total_questions, passed, submitted_at, answers"
      )
      .eq("user_id", userId)
      .eq("course_id", mod.course_id)
      .eq("module_id", moduleId)
      .eq("quiz_id", quiz.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (attemptData) lastAttempt = attemptData as AttemptRow;
  }

  interface AttemptAnswerDetail {
    questionId: string;
    question: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    explanation?: string | null;
  }
  type FullQuestionRow = {
    id: string;
    question: string;
    q_type: string;
    options_json?: unknown;
    correct?: unknown;
    explanation?: string | null;
  };
  let attemptAnswers: AttemptAnswerDetail[] | null = null;
  if (quiz?.id && lastAttempt && lastAttempt.answers) {
    try {
      const { data: qsFull } = await supabaseAdmin
        .from("module_quiz_questions")
        .select("id, question, q_type, options_json, correct, explanation")
        .eq("quiz_id", quiz.id);
      const fullList: FullQuestionRow[] = (qsFull || []) as FullQuestionRow[];
      const answerMap: Record<string, string> = {};
      fullList.forEach((q) => {
        let corr = String(q.correct ?? "").trim();
        if (/^\d+$/.test(corr) && q.options_json) {
          try {
            const optsRaw = Array.isArray(q.options_json)
              ? (q.options_json as unknown[])
              : typeof q.options_json === "string"
              ? (JSON.parse(q.options_json) as unknown[])
              : [];
            const opts: string[] = optsRaw.map((o) => String(o));
            const idx = parseInt(corr, 10);
            if (idx >= 0 && idx < opts.length) corr = opts[idx];
          } catch {}
        }
        if (q.q_type === "true-false") {
          if (/^true$/i.test(corr)) corr = "True";
          else if (/^false$/i.test(corr)) corr = "False";
        }
        answerMap[q.id] = corr;
      });
      const userAns = lastAttempt.answers || [];
      attemptAnswers = userAns.map((a) => {
        const qFull = fullList.find((q) => q.id === a.questionId);
        const correctAnswer = answerMap[a.questionId] || "";
        return {
          questionId: a.questionId,
          question: qFull?.question || "",
          userAnswer: a.answer,
          correctAnswer,
          isCorrect:
            a.answer.toString().trim().toLowerCase() ===
            correctAnswer.toString().trim().toLowerCase(),
          explanation: qFull?.explanation || null,
        };
      });
    } catch {
      // ignore attempt answer enrichment errors
    }
  }

  // Assignment (optional)
  const { data: assignment } = await supabaseAdmin
    .from("module_assignments")
    .select("id, instructions, due_date, max_score")
    .eq("module_id", moduleId)
    .maybeSingle();

  // Get passing grade for assignment
  let assignmentPassingGrade = 70;
  if (assignment?.id) {
    const { data: quiz } = await supabaseAdmin
      .from("module_quizzes")
      .select("passing_score")
      .eq("module_id", moduleId)
      .maybeSingle();

    if (quiz?.passing_score) {
      assignmentPassingGrade = quiz.passing_score;
    } else if (assignment.max_score) {
      assignmentPassingGrade = Math.ceil((assignment.max_score * 70) / 100);
    }
  }

  // Existing submission (if any) WITH STATUS
  let submission: {
    id: string;
    file_url: string | null;
    link_url: string | null;
    submitted_at: string;
    score: number | null;
    note: string | null;
    status: string | null;
  } | null = null;
  interface SubmissionRow {
    id: string;
    file_url: string | null;
    link_url: string | null;
    submitted_at: string;
    score: number | null;
    note: string | null;
    status: string | null;
  }
  if (assignment?.id) {
    console.log(
      "Looking for submission with assignment_id:",
      assignment.id,
      "user_id:",
      userId
    );
    // First try to find submission by assignment_id
    const { data: subData, error: subError } = await supabaseAdmin
      .from("module_submissions")
      .select("id, file_url, link_url, submitted_at, score, note, status")
      .eq("assignment_id", assignment.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (subError) {
      console.error("Error fetching submission:", subError);
    }

    console.log("Submission query result:", subData);
    if (subData) submission = subData as SubmissionRow;
  }

  // Live Session (optional)
  const { data: liveSession } = await supabaseAdmin
    .from("module_live_sessions")
    .select(
      "id, agenda, start_at, duration_min, join_url, passcode, status, recording_url, time_zone"
    )
    .eq("module_id", moduleId)
    .maybeSingle();

  // Check user role to determine which progress table to query
  const { data: userRoleData } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const isSchoolUser = userRoleData?.role === "school";
  const progressTable = isSchoolUser ? "school_progress" : "user_progress";

  // Progress for gating - use correct table based on user role
  const { data: prog } = await supabaseAdmin
    .from(progressTable)
    .select("id, completed_modules, current_module_id, course_id")
    .eq("user_id", userId)
    .eq("course_id", mod.course_id)
    .maybeSingle();
  const completed = Array.isArray(prog?.completed_modules)
    ? (prog!.completed_modules as string[])
    : (() => {
        try {
          return prog?.completed_modules
            ? JSON.parse(String(prog?.completed_modules))
            : [];
        } catch {
          return [] as string[];
        }
      })();

  return NextResponse.json({
    success: true,
    module: {
      id: mod.id,
      courseId: mod.course_id,
      title: mod.title,
      description: mod.description,
      kind: mod.module_kind,
      coins: mod.coins || 0,
      points: mod.points || 0,
      content: content
        ? {
            type: content.content_type,
            url: content.url,
            filePath: content.file_path,
            text: content.text_content,
          }
        : mod.module_kind === "overview" && summaryText
        ? {
            type: "text",
            text: summaryText,
          }
        : null,
      quiz: quiz
        ? {
            id: quiz.id,
            title: quiz.title,
            passingScore: quiz.passing_score,
            timeLimit: quiz.time_limit,
            questions,
          }
        : null,
      assignment: assignment
        ? {
            id: assignment.id,
            instructions: assignment.instructions,
            dueDate: assignment.due_date,
            maxScore: assignment.max_score,
            passingGrade: assignmentPassingGrade,
          }
        : null,
      liveSession: liveSession
        ? {
            id: liveSession.id,
            agenda: liveSession.agenda,
            start_at: liveSession.start_at,
            duration_min: liveSession.duration_min,
            join_url: liveSession.join_url,
            passcode: liveSession.passcode,
            status: liveSession.status,
            recording_url: liveSession.recording_url,
            time_zone: liveSession.time_zone,
          }
        : null,
    },
    progress: {
      currentModuleId: prog?.current_module_id || null,
      completedModules: completed,
    },
    attempt: lastAttempt
      ? {
          id: lastAttempt.id,
          score: lastAttempt.score,
          correct: lastAttempt.correct_count,
          total: lastAttempt.total_questions,
          passed: lastAttempt.passed,
          createdAt: lastAttempt.submitted_at,
        }
      : null,
    attemptAnswers,
    assignmentSubmission: submission,
  });
}

// POST /api/user/modules/[moduleId] { action: "complete" } to mark module complete and advance
export async function POST(
  req: NextRequest,
  { params }: { params: { moduleId: string } }
) {
  const { moduleId } = params;
  const body = await req.json().catch(() => ({}));
  const { userId, courseId, action } = body || {};
  if (!userId || !courseId || !action) {
    return NextResponse.json(
      { success: false, error: "Invalid payload" },
      { status: 400 }
    );
  }

  // Check if course is expired before allowing any action using expire_at
  const { data: courseData } = await supabaseAdmin
    .from("courses")
    .select("id, instructor_id")
    .eq("id", courseId)
    .maybeSingle();
  
  if (courseData) {
    const isInstructor = String(courseData.instructor_id) === String(userId);
    
    if (!isInstructor) {
      // Get expire_at from user_progress
      const { data: progress } = await supabaseAdmin
        .from("user_progress")
        .select("expire_at")
        .eq("user_id", userId)
        .eq("course_id", courseId)
        .maybeSingle();
      
      if (progress?.expire_at) {
        const expiryTime = Date.parse(progress.expire_at);
        const isExpired = !isNaN(expiryTime) && Date.now() > expiryTime;
        
        if (isExpired) {
          return NextResponse.json(
            { success: false, error: "Kursus ini telah kedaluwarsa. Silakan beli lagi untuk melanjutkan." },
            { status: 403 }
          );
        }
      }
    }
  }

  // Helper to compute progress percentage
  const getProgressPercentage = async (completedSet: Set<string>) => {
    const { data: allMods } = await supabaseAdmin
      .from("modules")
      .select("id")
      .eq("course_id", courseId);
    const total = (allMods || []).length || 1;
    const progressPct = Math.round((completedSet.size / total) * 100);
    return progressPct;
  };

  // Helper to award coins & points to student
  const awardRewards = async (coins: number, points: number) => {
    if (coins === 0 && points === 0) return;

    try {
      const { data: student } = await supabaseAdmin
        .from("students")
        .select("coins, points")
        .eq("user_id", userId)
        .maybeSingle();

      const currentCoins = student?.coins || 0;
      const currentPoints = student?.points || 0;

      if (student) {
        await supabaseAdmin
          .from("students")
          .update({
            coins: currentCoins + coins,
            points: currentPoints + points,
          })
          .eq("user_id", userId);
      } else {
        await supabaseAdmin.from("students").insert({
          user_id: userId,
          coins,
          points,
        });
      }
    } catch (err) {
      console.error("Error awarding rewards:", err);
    }
  };

  // Helper to load / init progress row
  const loadProgress = async () => {
    // First, check user role to determine which table to use
    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    const isSchool = userRow?.role === "school";
    const tableName = isSchool ? "school_progress" : "user_progress";

    const { data: prog, error: progErr } = await supabaseAdmin
      .from(tableName)
      .select("id, completed_modules, current_module_id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (progErr) return { error: progErr, isSchool } as const;
    const completed = Array.isArray(prog?.completed_modules)
      ? (prog!.completed_modules as string[])
      : (() => {
          try {
            return prog?.completed_modules
              ? JSON.parse(String(prog?.completed_modules))
              : [];
          } catch {
            return [] as string[];
          }
        })();
    return { prog, completed, isSchool } as const;
  };

  // Action: complete (generic / auto) - only for non-quiz, non-assignment content (plain materi text/link/file/video/pdf)
  if (action === "complete" || action === "auto-complete") {
    // Determine module kind to guard improper completion
    const { data: baseMod } = await supabaseAdmin
      .from("modules")
      .select("id, module_kind, coins, points")
      .eq("id", moduleId)
      .maybeSingle();
    if (baseMod?.module_kind === "quiz") {
      return NextResponse.json(
        { success: false, error: "Quiz harus diselesaikan lewat submit-quiz" },
        { status: 400 }
      );
    }
    if (baseMod?.module_kind === "tugas") {
      return NextResponse.json(
        {
          success: false,
          error: "Tugas akan selesai setelah dinilai instruktur",
        },
        { status: 400 }
      );
    }
    const { prog, completed, error, isSchool } = await loadProgress();
    if (error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );

    const completedSet = new Set<string>(completed);
    const isAlreadyCompleted = completedSet.has(moduleId);

    // Add current module to completed set (no prerequisite gating)
    completedSet.add(moduleId);
    const updated = Array.from(completedSet);

    // Calculate progress percentage
    const progressPct = await getProgressPercentage(completedSet);

    // Award coins and points ONLY if not already completed and not school user
    const moduleCoins = baseMod?.coins || 0;
    const modulePoints = baseMod?.points || 0;
    if (!isAlreadyCompleted && !isSchool) {
      await awardRewards(moduleCoins, modulePoints);
    }

    // Check for course completion and award points
    let courseCompleted = false;
    let pointsAwarded = 0;
    let certificateGenerated = false;

    // Get total modules to check if course is completed
    const { data: allModules } = await supabaseAdmin
      .from("modules")
      .select("id")
      .eq("course_id", courseId);
    const totalModules = (allModules || []).length;

    if (updated.length === totalModules && totalModules > 0) {
      // Course is complete, award points
      courseCompleted = true;

      // Get course points
      const { data: course } = await supabaseAdmin
        .from("courses")
        .select("points")
        .eq("id", courseId)
        .maybeSingle();

      const coursePoints = course?.points || 100; // Default to 100 points

      // Award points to student (only for non-school users)
      if (!isSchool) {
        try {
          const { data: student, error: studentErr } = await supabaseAdmin
            .from("students")
            .select("points")
            .eq("user_id", userId)
            .maybeSingle();

          if (studentErr && studentErr.code !== "PGRST116") {
            // Log error but don't fail the completion
            console.error("Error fetching student:", studentErr);
          } else {
            const currentPoints = student?.points || 0;
            const newPoints = currentPoints + coursePoints;

            if (student) {
              // Update existing student record
              await supabaseAdmin
                .from("students")
                .update({ points: newPoints })
                .eq("user_id", userId);
            } else {
              // Create new student record
              await supabaseAdmin.from("students").insert({
                user_id: userId,
                points: coursePoints,
                xp: 0,
              });
            }

            pointsAwarded = coursePoints;
          }
        } catch (pointsErr) {
          console.error("Error awarding points:", pointsErr);
          // Don't fail the completion if points fail
        }

        // Check and generate certificate if not exists
        try {
          const { data: existingCert, error: certCheckErr } =
            await supabaseAdmin
              .from("certificates")
              .select("id")
              .eq("user_id", userId)
              .eq("course_id", courseId)
              .maybeSingle();

          if (certCheckErr && certCheckErr.code !== "PGRST116") {
            console.error("Error checking certificate:", certCheckErr);
          } else if (!existingCert) {
            // No certificate exists, mark that it should be generated
            certificateGenerated = true; // Flag for frontend to show certificate is available
          }
        } catch (certErr) {
          console.error("Error in certificate generation process:", certErr);
          // Don't fail course completion if certificate process fails
        }
      }
    }

    // Insert or update - use correct table based on user role
    const tableName = isSchool ? "school_progress" : "user_progress";
    if (prog?.id) {
      const { error: updErr } = await supabaseAdmin
        .from(tableName)
        .update({
          completed_modules: updated,
          progress_percentage: progressPct,
          last_accessed_at: new Date().toISOString(),
        })
        .eq("id", prog.id)
        .eq("user_id", userId)
        .eq("course_id", courseId);
      if (updErr)
        return NextResponse.json(
          { success: false, error: updErr.message },
          { status: 500 }
        );
    } else {
      const newId = `${isSchool ? "sp" : "up"}-${randomUUID()}`;
      // Compute expire_at based on course.access_duration_days if available
      let computedExpire: string | null = null;
      try {
        const { data: courseMeta } = await supabaseAdmin
          .from("courses")
          .select("access_duration_days")
          .eq("id", courseId)
          .maybeSingle();
        const accessDays = (courseMeta as any)?.access_duration_days as
          | number
          | null
          | undefined;
        if (accessDays && accessDays > 0) {
          const base = new Date();
          base.setDate(base.getDate() + accessDays);
          computedExpire = base.toISOString();
        }
      } catch (e) {}

      const { error: insErr } = await supabaseAdmin.from(tableName).insert({
        id: newId,
        user_id: userId,
        course_id: courseId,
        completed_modules: updated,
        current_module_id: moduleId, // Set current module to the one just completed
        progress_percentage: progressPct,
        expire_at: computedExpire,
      });
      if (insErr)
        return NextResponse.json(
          { success: false, error: insErr.message },
          { status: 500 }
        );
    }
    return NextResponse.json({
      success: true,
      completedModules: updated,
      progressPercentage: progressPct,
      courseCompleted,
      pointsAwarded: !isSchool && pointsAwarded > 0 ? pointsAwarded : undefined,
      certificateAvailable: certificateGenerated,
      auto: action === "auto-complete",
      rewards:
        !isAlreadyCompleted && !isSchool
          ? { coins: moduleCoins, points: modulePoints }
          : undefined,
    });
  }

  // Action: reset-quiz - delete previous attempts to allow retry
  if (action === "reset-quiz") {
    try {
      // Get quiz id first
      const { data: quiz } = await supabaseAdmin
        .from("module_quizzes")
        .select("id")
        .eq("module_id", moduleId)
        .maybeSingle();

      if (!quiz) {
        return NextResponse.json(
          { success: false, error: "Quiz not found" },
          { status: 404 }
        );
      }

      // Delete all previous attempts for this quiz
      const { error: delErr } = await supabaseAdmin
        .from("quiz_attempts")
        .delete()
        .eq("user_id", userId)
        .eq("course_id", courseId)
        .eq("module_id", moduleId)
        .eq("quiz_id", quiz.id);

      if (delErr) {
        console.error("Error deleting quiz attempts for retry:", delErr);
        return NextResponse.json(
          { success: false, error: "Failed to reset quiz: " + delErr.message },
          { status: 500 }
        );
      }

      console.log("Quiz attempts deleted for retry:", {
        userId,
        courseId,
        moduleId,
        quizId: quiz.id,
      });

      return NextResponse.json({
        success: true,
        message: "Quiz reset successfully",
      });
    } catch (e) {
      console.error("Exception resetting quiz:", e);
      return NextResponse.json(
        { success: false, error: "Failed to reset quiz" },
        { status: 500 }
      );
    }
  }

  // Action: submit-quiz { answers: [{questionId, answer}] }
  if (action === "submit-quiz") {
    const { answers } = body as {
      answers?: Array<{ questionId: string; answer: string }>;
    };
    if (!Array.isArray(answers)) {
      return NextResponse.json(
        { success: false, error: "Answers required" },
        { status: 400 }
      );
    }
    // Load quiz + questions (with correct)
    const { data: quiz } = await supabaseAdmin
      .from("module_quizzes")
      .select("id, passing_score")
      .eq("module_id", moduleId)
      .maybeSingle();
    if (!quiz)
      return NextResponse.json(
        { success: false, error: "Quiz not found" },
        { status: 404 }
      );
    const { data: qs } = await supabaseAdmin
      .from("module_quiz_questions")
      .select("id, q_type, options_json, correct")
      .eq("quiz_id", quiz.id);

    // Build answer key mapping questionId -> normalized correct answer string
    const key = new Map<string, string>();
    (qs || []).forEach((q) => {
      const correctRaw = String(q.correct ?? "");
      let normalized = correctRaw.trim();
      // If stored as numeric index (e.g. "0") and options_json has array, map to option value
      if (/^\d+$/.test(correctRaw) && q.options_json) {
        try {
          const opts = Array.isArray(q.options_json)
            ? (q.options_json as unknown[]).map(String)
            : typeof q.options_json === "string"
            ? JSON.parse(q.options_json as string)
            : [];
          if (Array.isArray(opts)) {
            const idx = parseInt(correctRaw, 10);
            if (idx >= 0 && idx < opts.length) {
              normalized = String(opts[idx]).trim();
            }
          }
        } catch {}
      }
      // Normalize boolean answers
      if (q.q_type === "true-false") {
        if (/^true$/i.test(normalized)) normalized = "true";
        else if (/^false$/i.test(normalized)) normalized = "false";
      }
      key.set(q.id, normalized.toLowerCase());
    });

    let correctCount = 0;
    answers.forEach((a) => {
      const submitted = a.answer.toString().trim().toLowerCase();
      if (key.get(a.questionId) === submitted) correctCount++;
    });
    const total = (qs || []).length || 0;
    const scorePct = total ? Math.round((correctCount / total) * 100) : 0;
    const required = Math.max(80, quiz.passing_score || 0); // enforce minimum 80
    const passed = scorePct >= required;

    // Don't delete previous attempts - keep all as history
    // Each new attempt will be inserted as a new record

    // Attempt storage (latest) in quiz_attempts table
    let attemptId: string | null = null;
    try {
      const newAttemptId = `qa-${randomUUID()}`;
      const insertData = {
        id: newAttemptId,
        user_id: userId,
        course_id: courseId,
        module_id: moduleId,
        quiz_id: quiz.id,
        score: scorePct,
        correct_count: correctCount,
        total_questions: total,
        passed,
        answers,
      };

      console.log("Inserting quiz attempt:", insertData);

      const { data: attempt, error: attemptErr } = await supabaseAdmin
        .from("quiz_attempts")
        .insert(insertData)
        .select("id")
        .single();

      if (attemptErr) {
        console.error("Error inserting quiz attempt:", attemptErr);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to save quiz attempt: " + attemptErr.message,
          },
          { status: 500 }
        );
      }

      console.log("Quiz attempt inserted successfully:", attempt);
      attemptId = attempt?.id || null;
    } catch (e) {
      console.error("Exception inserting quiz attempt:", e);
      return NextResponse.json(
        { success: false, error: "Failed to save quiz attempt" },
        { status: 500 }
      );
    }

    // Build answer details with explanations
    let attemptAnswers: Array<{
      questionId: string;
      question: string;
      userAnswer: string;
      correctAnswer: string;
      isCorrect: boolean;
      explanation?: string | null;
    }> = [];

    try {
      const { data: qsFull } = await supabaseAdmin
        .from("module_quiz_questions")
        .select("id, question, q_type, options_json, correct, explanation")
        .eq("quiz_id", quiz.id);

      attemptAnswers = answers.map((a) => {
        const qFull = (qsFull || []).find(
          (q: {
            id: string;
            question: string;
            q_type: string;
            options_json?: unknown;
            correct?: unknown;
            explanation?: string | null;
          }) => q.id === a.questionId
        );
        let correctAnswer = key.get(a.questionId) || "";

        // Get the display version of correct answer (not lowercase)
        if (
          qFull?.correct &&
          /^\d+$/.test(String(qFull.correct)) &&
          qFull?.options_json
        ) {
          try {
            const opts = Array.isArray(qFull.options_json)
              ? (qFull.options_json as unknown[]).map(String)
              : JSON.parse(String(qFull.options_json));
            if (Array.isArray(opts)) {
              const idx = parseInt(String(qFull.correct), 10);
              if (idx >= 0 && idx < opts.length) {
                correctAnswer = String(opts[idx]);
              }
            }
          } catch {}
        } else if (qFull?.correct) {
          correctAnswer = String(qFull.correct);
        }

        return {
          questionId: a.questionId,
          question: qFull?.question || "",
          userAnswer: a.answer,
          correctAnswer,
          isCorrect:
            key.get(a.questionId) === a.answer.toString().trim().toLowerCase(),
          explanation: qFull?.explanation || null,
        };
      });
    } catch (e) {
      console.error("Error building attempt answers:", e);
      // Fallback to basic answer details
      attemptAnswers = answers.map((a) => ({
        questionId: a.questionId,
        question: "",
        userAnswer: a.answer,
        correctAnswer: key.get(a.questionId) || "",
        isCorrect:
          key.get(a.questionId) === a.answer.toString().trim().toLowerCase(),
      }));
    }

    let updated: string[] | undefined;
    let progressPct: number | null = null;
    let courseCompleted = false;
    let pointsAwarded = 0;
    let certificateGenerated = false;
    let moduleCoins = 0;
    let modulePoints = 0;
    let isSchool = false; // Declare at function scope

    if (passed) {
      // Get module coins and points
      const { data: moduleMod } = await supabaseAdmin
        .from("modules")
        .select("coins, points")
        .eq("id", moduleId)
        .maybeSingle();

      moduleCoins = moduleMod?.coins || 0;
      modulePoints = moduleMod?.points || 0;

      const {
        prog,
        completed,
        error,
        isSchool: schoolFlag,
      } = await loadProgress();
      isSchool = schoolFlag; // Assign to outer scope variable
      if (error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      const set = new Set<string>(completed);
      const isAlreadyCompleted = set.has(moduleId);

      set.add(moduleId);
      updated = Array.from(set);
      progressPct = await getProgressPercentage(set);

      // Award module rewards ONLY if not already completed and not school user
      if (!isAlreadyCompleted && !isSchool) {
        await awardRewards(moduleCoins, modulePoints);
      }

      // Check for course completion
      const { data: allMods } = await supabaseAdmin
        .from("modules")
        .select("id")
        .eq("course_id", courseId);
      const totalModules = (allMods || []).length;

      if (updated.length === totalModules) {
        courseCompleted = true;

        // Get course points and award them
        const { data: course } = await supabaseAdmin
          .from("courses")
          .select("points")
          .eq("id", courseId)
          .maybeSingle();

        const coursePoints = course?.points || 100;

        // Award course completion points ONLY for non-school users
        if (!isSchool) {
          try {
            const { data: student } = await supabaseAdmin
              .from("students")
              .select("points")
              .eq("user_id", userId)
              .maybeSingle();

            const currentPoints = student?.points || 0;
            const newPoints = currentPoints + coursePoints;

            if (student) {
              await supabaseAdmin
                .from("students")
                .update({ points: newPoints })
                .eq("user_id", userId);
            } else {
              await supabaseAdmin.from("students").insert({
                user_id: userId,
                points: coursePoints,
                xp: 0,
              });
            }

            pointsAwarded = coursePoints;
          } catch (pointsErr) {
            console.error("Error awarding points:", pointsErr);
          }
        }

        // Check and generate certificate if not exists
        try {
          const { data: existingCert, error: certCheckErr } =
            await supabaseAdmin
              .from("certificates")
              .select("id")
              .eq("user_id", userId)
              .eq("course_id", courseId)
              .maybeSingle();

          if (certCheckErr && certCheckErr.code !== "PGRST116") {
            console.error("Error checking certificate:", certCheckErr);
          } else if (!existingCert) {
            // No certificate exists, mark that it should be generated
            certificateGenerated = true; // Flag for frontend to show certificate is available
          }
        } catch (certErr) {
          console.error("Error in certificate generation process:", certErr);
          // Don't fail course completion if certificate process fails
        }
      }

      if (prog?.id) {
        const { error: updErr } = await supabaseAdmin
          .from(isSchool ? "school_progress" : "user_progress")
          .update({
            completed_modules: updated,
            current_module_id: moduleId,
            progress_percentage: progressPct,
          })
          .eq("id", prog.id);
        if (updErr)
          return NextResponse.json(
            { success: false, error: updErr.message },
            { status: 500 }
          );
      } else {
        const newId = `${isSchool ? "sp" : "up"}-${randomUUID()}`;
        const { error: insErr } = await supabaseAdmin
          .from(isSchool ? "school_progress" : "user_progress")
          .insert({
            id: newId,
            user_id: userId,
            course_id: courseId,
            completed_modules: updated,
            current_module_id: moduleId,
            progress_percentage: progressPct,
          });
        if (insErr)
          return NextResponse.json(
            { success: false, error: insErr.message },
            { status: 500 }
          );
      }
    }
    return NextResponse.json({
      success: true,
      passed,
      requiredPassing: required,
      score: scorePct,
      correct: correctCount,
      total,
      attemptId,
      completedModules: updated,
      attemptAnswers,
      progressPercentage: progressPct,
      courseCompleted,
      pointsAwarded: !isSchool && pointsAwarded > 0 ? pointsAwarded : undefined,
      certificateAvailable: certificateGenerated,
      rewards:
        !isSchool && passed && (moduleCoins > 0 || modulePoints > 0)
          ? { coins: moduleCoins, points: modulePoints }
          : undefined,
    });
  }

  // Action: submit-assignment { fileUrl?, linkUrl? } (does NOT auto-complete; waits for instructor grading)
  if (action === "submit-assignment") {
    const { fileUrl, linkUrl } = body as {
      fileUrl?: string;
      linkUrl?: string;
    };
    if (!fileUrl && !linkUrl) {
      return NextResponse.json(
        { success: false, error: "fileUrl atau linkUrl wajib" },
        { status: 400 }
      );
    }
    // Validate assignment exists for module
    const { data: assign } = await supabaseAdmin
      .from("module_assignments")
      .select("id, max_score")
      .eq("module_id", moduleId)
      .maybeSingle();
    if (!assign) {
      return NextResponse.json(
        { success: false, error: "Assignment tidak ditemukan" },
        { status: 404 }
      );
    }

    // Get passing grade from quiz if exists, otherwise use 70% of max_score or default 70
    let passingGrade = 70;
    const { data: quiz } = await supabaseAdmin
      .from("module_quizzes")
      .select("passing_score")
      .eq("module_id", moduleId)
      .maybeSingle();

    if (quiz?.passing_score) {
      passingGrade = quiz.passing_score;
    } else if (assign.max_score) {
      passingGrade = Math.ceil((assign.max_score * 70) / 100); // 70% of max score
    }

    // Check for existing submission
    let existing: { id: string; score: number | null } | null = null;
    try {
      const { data: ex } = await supabaseAdmin
        .from("module_submissions")
        .select("id, score")
        .eq("assignment_id", assign.id)
        .eq("user_id", userId)
        .maybeSingle();
      if (ex)
        existing = {
          id: (ex as { id: string; score: number | null }).id,
          score: (ex as { id: string; score: number | null }).score,
        };
    } catch {}

    // Check for existing submission WITH status
    let existingWithStatus: {
      id: string;
      score: number | null;
      status: string | null;
    } | null = null;
    if (existing) {
      const { data: exStatus } = await supabaseAdmin
        .from("module_submissions")
        .select("id, score, status")
        .eq("assignment_id", assign.id)
        .eq("user_id", userId)
        .maybeSingle();
      if (exStatus)
        existingWithStatus = exStatus as {
          id: string;
          score: number | null;
          status: string | null;
        };
    }

    if (existingWithStatus) {
      const currentStatus = existingWithStatus.status;
      const currentScore = existingWithStatus.score ?? 0;

      // Guard: if status='waiting', block resubmission
      if (currentStatus === "waiting") {
        return NextResponse.json(
          {
            success: false,
            error:
              "Tugas sudah dikumpulkan dan menunggu penilaian. Tidak dapat submit ulang saat ini.",
          },
          { status: 409 }
        );
      }

      // Guard: if status='graded' AND score >= passing grade, block resubmission
      if (currentStatus === "graded" && currentScore >= passingGrade) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Tugas sudah diterima dengan nilai memuaskan dan tidak dapat diubah",
          },
          { status: 409 }
        );
      }

      // Allowed when: status='rejected' OR (status='graded' AND score < passingGrade)
      // Get old submission data to delete old files
      const { data: oldSubmission } = await supabaseAdmin
        .from("module_submissions")
        .select("file_url")
        .eq("id", existingWithStatus.id)
        .single();

      // Delete old file from storage if exists
      // - When uploading new file (file → file)
      // - When switching from file to link (file → link)
      if (oldSubmission?.file_url) {
        try {
          const { deleteStorageFile, extractStoragePath } = await import(
            "@/lib/storageHelper"
          );
          const oldPath = extractStoragePath(oldSubmission.file_url);
          if (oldPath) {
            await deleteStorageFile("assignments-submissions", oldPath);
            console.log(`Deleted old assignment file: ${oldPath}`);
          }
        } catch (err) {
          console.error("Error deleting old file:", err);
          // Continue even if delete fails
        }
      }

      // Update existing submission, clearing old data
      const { error: updateErr } = await supabaseAdmin
        .from("module_submissions")
        .update({
          file_url: fileUrl || null,
          link_url: linkUrl || null,
          submitted_at: new Date().toISOString(),
          status: "waiting",
          score: null,
          note: null, // Clear previous instructor notes
        })
        .eq("id", existingWithStatus.id);
      if (updateErr)
        return NextResponse.json(
          { success: false, error: updateErr.message },
          { status: 500 }
        );
    } else {
      // Create new submission with status='waiting'
      const submissionId = randomUUID();
      const { error: insErr } = await supabaseAdmin
        .from("module_submissions")
        .insert({
          id: submissionId,
          assignment_id: assign.id,
          user_id: userId,
          file_url: fileUrl || null,
          link_url: linkUrl || null,
          status: "waiting", // Set status awal
        });
      if (insErr)
        return NextResponse.json(
          { success: false, error: insErr.message },
          { status: 500 }
        );
    }

    return NextResponse.json({
      success: true,
      submitted: true,
      resubmission: !!existing,
      message: existing
        ? "Tugas berhasil disubmit ulang"
        : "Tugas berhasil dikumpulkan",
      // progress not updated until graded & passed
    });
  }

  return NextResponse.json(
    { success: false, error: "Unknown action" },
    { status: 400 }
  );
}
