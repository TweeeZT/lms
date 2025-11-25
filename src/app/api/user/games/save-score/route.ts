import { NextRequest, NextResponse } from "next/server";
import supabaseAdmin from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const { userId, game, score, points } = await req.json();

    if (!userId || !game || score === undefined || points === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;

    // Save game score to database
    const { error: insertError } = await supabase.from("game_scores").insert({
      user_id: userId,
      game_name: game,
      score: score,
      points_earned: points,
      played_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error("Error saving game score:", insertError);
      return NextResponse.json(
        { success: false, error: "Failed to save game score" },
        { status: 500 }
      );
    }

    // Update student points (students.user_id column holds the user's id)
    const { data: studentData, error: studentFetchError } = await supabase
      .from("students")
      .select("points")
      .eq("user_id", userId)
      .single();

    let newPoints: number;

    if (studentFetchError) {
      console.error("Error fetching student:", studentFetchError);
      const errCode = (studentFetchError as any)?.code;
      if (errCode === "42703") {
        // 42703 = undefined column in PostgreSQL
        return NextResponse.json(
          {
            success: false,
            error:
              "Database column 'students.points' not found. Run migration to add 'points' column to students table.",
            details: (studentFetchError as any)?.message,
          },
          { status: 500 }
        );
      }

      // If student row doesn't exist, create it with the earned points
      const createMsg = (studentFetchError as any)?.message || "";
      if (createMsg.includes("Results contain 0 rows") || createMsg.includes("No rows")) {
        const { error: createError } = await supabase.from("students").insert({
          user_id: userId,
          points: points,
        });
        if (createError) {
          console.error("Error creating student row:", createError);
          return NextResponse.json(
            { success: false, error: "Failed to create student record" },
            { status: 500 }
          );
        }
        newPoints = points;
      } else {
        return NextResponse.json(
          { success: false, error: "Failed to fetch student data", details: (studentFetchError as any)?.message },
          { status: 500 }
        );
      }
    } else {
      const currentPoints = (studentData as any)?.points || 0;
      newPoints = currentPoints + points;

      const { error: updateError } = await supabase
        .from("students")
        .update({ points: newPoints })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Error updating student points:", updateError);
        return NextResponse.json(
          { success: false, error: "Failed to update student points" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Score saved successfully",
      points: newPoints,
    });
  } catch (error: any) {
    console.error("Error in save-score API:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
