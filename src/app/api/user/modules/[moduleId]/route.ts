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

  // Base module
  const { data: mod, error: modErr } = await supabaseAdmin
    .from("modules")
    .select("id, course_id, title, description, module_kind, order_index")
    .eq("id", moduleId)
    .maybeSingle();
  if (modErr || !mod)
    return NextResponse.json(
      { success: false, error: modErr?.message || "Not found" },
      { status: 404 }
    );

  // Content (optional)
  const { data: content } = await supabaseAdmin
    .from("module_contents")
    .select("id, content_type, url, file_path, text_content")
    .eq("module_id", moduleId)
    .maybeSingle();

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
    created_at: string;
  };
  let lastAttempt: AttemptRow | null = null;
  if (quiz?.id) {
    const { data: attemptData } = await supabaseAdmin
      .from("quiz_attempts")
      .select(
        "id, score, correct_count, total_questions, passed, created_at, answers"
      )
      .eq("user_id", userId)
      .eq("course_id", mod.course_id)
      .eq("module_id", moduleId)
      .eq("quiz_id", quiz.id)
      .order("created_at", { ascending: false })
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
  if (
    quiz?.id &&
    lastAttempt &&
    (
      lastAttempt as unknown as {
        answers?: Array<{ questionId: string; answer: string }>;
      }
    ).answers
  ) {
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
      const userAns =
        (
          lastAttempt as unknown as {
            answers?: Array<{ questionId: string; answer: string }>;
          }
        ).answers || [];
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
  // Existing submission (if any)
  let submission: {
    id: string;
    file_url: string | null;
    link_url: string | null;
    created_at: string;
    score: number | null;
    note: string | null;
  } | null = null;
  interface SubmissionRow {
    id: string;
    file_url: string | null;
    link_url: string | null;
    created_at: string;
    score: number | null;
    note: string | null;
  }
  if (assignment?.id) {
    const { data: subData } = await supabaseAdmin
      .from("module_submissions")
      .select("id, file_url, link_url, created_at, score, note")
      .eq("assignment_id", assignment.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (subData) submission = subData as SubmissionRow;
  }

  // Progress for gating
  const { data: prog } = await supabaseAdmin
    .from("user_progress")
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
      order: mod.order_index,
      content: content
        ? {
            type: content.content_type,
            url: content.url,
            filePath: content.file_path,
            text: content.text_content,
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
          createdAt: lastAttempt.created_at,
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

  // Helper to fetch ordered modules and compute next & progress
  const getNextModuleAndProgress = async (completedSet: Set<string>) => {
    const { data: modRow } = await supabaseAdmin
      .from("modules")
      .select("id, order_index")
      .eq("id", moduleId)
      .maybeSingle();
    if (!modRow)
      return { nextId: moduleId, progressPct: null as number | null };
    const { data: allMods } = await supabaseAdmin
      .from("modules")
      .select("id, order_index")
      .eq("course_id", courseId)
      .order("order_index", { ascending: true });
    const ordered = (allMods || [])
      .filter((m) => m.order_index != null)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    const index = ordered.findIndex((m) => m.id === moduleId);
    const next =
      index >= 0 && index < ordered.length - 1
        ? ordered[index + 1].id
        : moduleId;
    // progress percentage = completed / total * 100 (rounded)
    const total = ordered.length || 1;
    const progressPct = Math.round((completedSet.size / total) * 100);
    return { nextId: next, progressPct };
  };

  // Helper to load / init progress row
  const loadProgress = async () => {
    const { data: prog, error: progErr } = await supabaseAdmin
      .from("user_progress")
      .select("id, completed_modules, current_module_id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (progErr) return { error: progErr } as const;
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
    return { prog, completed } as const;
  };

  // Action: complete (generic / auto) - only for non-quiz, non-assignment content (plain materi text/link/file/video/pdf)
  if (action === "complete" || action === "auto-complete") {
    // Determine module kind to guard improper completion
    const { data: baseMod } = await supabaseAdmin
      .from("modules")
      .select("id, module_kind")
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
    const { nextModuleId } = body as { nextModuleId?: string };
    const { prog, completed, error } = await loadProgress();
    if (error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );

    // Fetch ordered modules to enforce gating (cannot skip)
    const { data: allMods, error: modsErr } = await supabaseAdmin
      .from("modules")
      .select("id, order_index")
      .eq("course_id", courseId)
      .order("order_index", { ascending: true });
    if (modsErr)
      return NextResponse.json(
        { success: false, error: modsErr.message },
        { status: 500 }
      );
    const ordered = (allMods || [])
      .filter((m) => m.order_index != null)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    const completedSet = new Set<string>(completed);
    // Determine the first incomplete module (the only one allowed to be manually completed)
    const firstIncomplete = ordered.find((m) => !completedSet.has(m.id))?.id;
    if (firstIncomplete && firstIncomplete !== moduleId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Belum bisa menyelesaikan modul ini. Selesaikan modul sebelumnya dulu.",
        },
        { status: 400 }
      );
    }
    // Add moduleId to completed set
    completedSet.add(moduleId);
    const updated = Array.from(completedSet);
    // Determine next module id AFTER current one
    const currentIndex = ordered.findIndex((m) => m.id === moduleId);
    const nextOrdered =
      currentIndex >= 0 && currentIndex < ordered.length - 1
        ? ordered[currentIndex + 1].id
        : moduleId; // stay if last
    const advanceId =
      nextModuleId && updated.includes(moduleId)
        ? nextModuleId // frontend hint (still validated by gating above)
        : nextOrdered;
    const progressPct = Math.round(
      (updated.length / (ordered.length || 1)) * 100
    );

    // Check for course completion and award points
    let courseCompleted = false;
    let pointsAwarded = 0;
    let certificateGenerated = false;
    if (updated.length === ordered.length) {
      // Course is complete, award points
      courseCompleted = true;

      // Get course points
      const { data: course } = await supabaseAdmin
        .from("courses")
        .select("points")
        .eq("id", courseId)
        .maybeSingle();

      const coursePoints = course?.points || 100; // Default to 100 points

      // Award points to student
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
        const { data: existingCert, error: certCheckErr } = await supabaseAdmin
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

    // Insert or update (avoid relying on upsert + onConflict uniqueness)
    if (prog?.id) {
      const { error: updErr } = await supabaseAdmin
        .from("user_progress")
        .update({
          completed_modules: updated,
          current_module_id: advanceId,
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
      const newId = `up-${randomUUID()}`;
      const { error: insErr } = await supabaseAdmin
        .from("user_progress")
        .insert({
          id: newId,
          user_id: userId,
          course_id: courseId,
          completed_modules: updated,
          current_module_id: advanceId,
          progress_percentage: progressPct,
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
      currentModuleId: advanceId,
      nextModuleId: advanceId === moduleId ? null : advanceId,
      progressPercentage: progressPct,
      courseCompleted,
      pointsAwarded: pointsAwarded > 0 ? pointsAwarded : undefined,
      certificateAvailable: certificateGenerated,
      auto: action === "auto-complete",
    });
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

    // Remove previous attempts so only the latest is kept (simplifies UI)
    try {
      await supabaseAdmin
        .from("quiz_attempts")
        .delete()
        .eq("user_id", userId)
        .eq("course_id", courseId)
        .eq("module_id", moduleId)
        .eq("quiz_id", quiz.id);
    } catch {}

    // Attempt storage (latest) in quiz_attempts table
    let attemptId: string | null = null;
    try {
      const { data: attempt } = await supabaseAdmin
        .from("quiz_attempts")
        .insert({
          user_id: userId,
          course_id: courseId,
          module_id: moduleId,
          quiz_id: quiz.id,
          score: scorePct,
          correct_count: correctCount,
          total_questions: total,
          passed,
          answers,
        })
        .select("id")
        .single();
      attemptId = attempt?.id || null;
    } catch {
      // Silently ignore if table not present
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
    let nextModuleId: string | null = null;
    let progressPct: number | null = null;
    let courseCompleted = false;
    let pointsAwarded = 0;
    let certificateGenerated = false;

    if (passed) {
      const { prog, completed, error } = await loadProgress();
      if (error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      const set = new Set<string>(completed);
      set.add(moduleId);
      updated = Array.from(set);
      const helper = await getNextModuleAndProgress(set);
      nextModuleId = helper.nextId === moduleId ? null : helper.nextId;
      progressPct = helper.progressPct;

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
          .from("user_progress")
          .update({
            completed_modules: updated,
            current_module_id: helper.nextId,
            progress_percentage: helper.progressPct,
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
        const { error: insErr } = await supabaseAdmin
          .from("user_progress")
          .insert({
            user_id: userId,
            course_id: courseId,
            completed_modules: updated,
            current_module_id: helper.nextId,
            progress_percentage: helper.progressPct,
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
      nextModuleId,
      progressPercentage: progressPct,
      courseCompleted,
      pointsAwarded: pointsAwarded > 0 ? pointsAwarded : undefined,
      certificateAvailable: certificateGenerated,
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
      .select("id")
      .eq("module_id", moduleId)
      .maybeSingle();
    if (!assign) {
      return NextResponse.json(
        { success: false, error: "Assignment tidak ditemukan" },
        { status: 404 }
      );
    }
    // Manual `upsert` because table lacks composite unique constraint
    let existing: { id: string } | null = null;
    try {
      const { data: ex } = await supabaseAdmin
        .from("module_submissions")
        .select("id")
        .eq("assignment_id", assign.id)
        .eq("user_id", userId)
        .maybeSingle();
      if (ex) existing = { id: (ex as { id: string }).id };
    } catch {}
    if (existing) {
      const { error: updErr } = await supabaseAdmin
        .from("module_submissions")
        .update({ file_url: fileUrl || null, link_url: linkUrl || null })
        .eq("id", existing.id);
      if (updErr)
        return NextResponse.json(
          { success: false, error: updErr.message },
          { status: 500 }
        );
    } else {
      const submissionId = randomUUID();
      const { error: insErr } = await supabaseAdmin
        .from("module_submissions")
        .insert({
          id: submissionId,
          assignment_id: assign.id,
          user_id: userId,
          file_url: fileUrl || null,
          link_url: linkUrl || null,
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
      // progress not updated until graded & passed
    });
  }

  return NextResponse.json(
    { success: false, error: "Unknown action" },
    { status: 400 }
  );
}
