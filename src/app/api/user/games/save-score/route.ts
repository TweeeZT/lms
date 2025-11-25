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

    // Update user points
    const { data: userData, error: userFetchError } = await supabase
      .from("users")
      .select("points")
      .eq("id", userId)
      .single();

    if (userFetchError) {
      console.error("Error fetching user:", userFetchError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch user data" },
        { status: 500 }
      );
    }

    const currentPoints = userData?.points || 0;
    const newPoints = currentPoints + points;

    const { error: updateError } = await supabase
      .from("users")
      .update({ points: newPoints })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating user points:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update user points" },
        { status: 500 }
      );
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
