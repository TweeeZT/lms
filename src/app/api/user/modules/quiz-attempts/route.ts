import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

// GET /api/user/modules/quiz-attempts?userId=xxx&quizId=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const quizId = searchParams.get("quizId");

    if (!userId || !quizId) {
      return NextResponse.json(
        { success: false, error: "userId dan quizId wajib" },
        { status: 400 }
      );
    }

    // Fetch all attempts for this user and quiz, ordered by date descending
    const { data, error } = await supabaseAdmin
      .from("quiz_attempts")
      .select("id, created_at, score, passed, correct_count, total_questions")
      .eq("user_id", userId)
      .eq("quiz_id", quizId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      attempts: data || [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memuat riwayat";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
