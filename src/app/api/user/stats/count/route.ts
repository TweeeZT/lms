import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseServer";

export const runtime = "nodejs";

// GET /api/user/stats/count
// Returns total count of students table
export async function GET() {
  try {
    const { count, error } = await supabaseAdmin
      .from("students")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("Failed to count students:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      total: count || 0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to count students";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
