import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

/**
 * GET /api/school/courses/:id/tools
 * Fetch all course tools for a specific course
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await context.params;

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: "Course ID is required" },
        { status: 400 }
      );
    }

    // Fetch all tools for this course
    const { data, error } = await supabaseAdmin
      .from("course_tools")
      .select("*")
      .eq("courses_id", courseId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching course tools:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch course tools" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      items: data || [],
      total: data?.length || 0,
    });
  } catch (err) {
    console.error(
      "Unexpected error in GET /api/school/courses/:id/tools:",
      err
    );
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
