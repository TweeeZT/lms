import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, serviceRole);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const { quizId } = await params;

  // Get userId from query parameter (passed from frontend)
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId required" },
      { status: 400 }
    );
  }

  try {
    // Fetch all quiz attempts for this user and quiz
    const { data: attempts, error } = await supabase
      .from("quiz_attempts")
      .select(
        `
        id,
        score,
        correct_count,
        total_questions,
        passed,
        answers,
        created_at
      `
      )
      .eq("user_id", userId)
      .eq("quiz_id", quizId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching quiz attempts:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Fetch quiz questions to match with answers
    const { data: quiz, error: quizError } = await supabase
      .from("module_quizzes")
      .select(
        `
        id,
        title,
        passing_score,
        module_quiz_questions (
          id,
          question,
          q_type,
          options_json,
          correct,
          explanation
        )
      `
      )
      .eq("id", quizId)
      .single();

    if (quizError) {
      console.error("Error fetching quiz:", quizError);
      return NextResponse.json(
        { success: false, error: quizError.message },
        { status: 500 }
      );
    }

    // Map questions by ID for easy lookup
    const questionsMap = new Map(
      quiz.module_quiz_questions.map((q: any) => [q.id, q])
    );

    // Enrich attempts with full question data
    const enrichedAttempts = attempts.map((attempt: any) => {
      const enrichedAnswers = (attempt.answers || []).map((ans: any) => {
        const question = questionsMap.get(ans.questionId) as any;

        // Parse options_json if it's a string
        let parsedOptions: string[] = [];
        if (question?.options_json) {
          try {
            parsedOptions =
              typeof question.options_json === "string"
                ? JSON.parse(question.options_json)
                : question.options_json;
          } catch (e) {
            console.error("Failed to parse options_json:", e);
            parsedOptions = [];
          }
        }

        return {
          questionId: ans.questionId,
          questionText: question?.question || "Unknown question",
          options: parsedOptions,
          userAnswer: ans.answer,
          correctAnswer: question?.correct || "",
          isCorrect: ans.answer === question?.correct,
          explanation: question?.explanation || "",
        };
      });

      return {
        ...attempt,
        enrichedAnswers,
      };
    });

    return NextResponse.json({
      success: true,
      attempts: enrichedAttempts,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        passingScore: quiz.passing_score,
      },
    });
  } catch (err: any) {
    console.error("Quiz history error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
