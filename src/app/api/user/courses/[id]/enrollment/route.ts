import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

// DELETE /api/user/courses/[id]/enrollment  Body: { userId }
// Unenroll a user from a course (used when user declines to extend after expiry)
export async function DELETE(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  try {
    const courseId = ctx.params.id;
    const { userId } = (await req.json()) as { userId?: string };
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Missing userId" },
        { status: 400 }
      );
    }

    // Determine user role to delete correct progress row
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("id", userId)
      .single();
    const isSchool = user?.role === "school";

    // Delete enrollment (best-effort)
    await supabaseAdmin
      .from("enrollments")
      .delete()
      .eq("user_id", userId)
      .eq("course_id", courseId);

    // Delete progress depending on role (best-effort)
    const progressTable = isSchool ? "school_progress" : "user_progress";
    await supabaseAdmin
      .from(progressTable)
      .delete()
      .eq("user_id", userId)
      .eq("course_id", courseId);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
