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

    // Update the submission with score and feedback
    const { error: updateError } = await supabaseAdmin
      .from("module_submissions")
      .update({
        score: Number(score),
        note: feedback || null,
      })
      .eq("id", submissionId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: "Nilai berhasil diberikan",
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
