import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

// GET /api/user/achievements?userId=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }

    const { data: achievements, error } = await supabaseAdmin
      .from("user_achievements")
      .select("*")
      .eq("user_id", userId)
      .order("earned_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: "Error fetching achievements" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      achievements: achievements || [],
    });
  } catch (error) {
    console.error("Error in /api/user/achievements:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
