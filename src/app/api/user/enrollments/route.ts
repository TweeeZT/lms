import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseServer";

// POST /api/user/enrollments { userId, courseId }
// Inserts enrollment (or user_progress fallback) if not already enrolled.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userId = (body.userId || "").trim();
  const courseId = (body.courseId || "").trim();
  if (!userId || !courseId) {
    return NextResponse.json(
      { success: false, error: "userId & courseId required" },
      { status: 400 }
    );
  }
  // Check existing enrollment
  const { data: existingEnr, error: enrErr } = await supabaseAdmin
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (enrErr) {
    return NextResponse.json(
      { success: false, error: enrErr.message },
      { status: 500 }
    );
  }
  if (existingEnr) {
    return NextResponse.json({ success: true, already: true });
  }
  // Insert into enrollments if table structure supports (assuming id auto uuid)
  const { error: insErr } = await supabaseAdmin
    .from("enrollments")
    .insert({ user_id: userId, course_id: courseId });
  if (insErr) {
    // fallback to user_progress if enrollments table not present or RLS blocked
    const { data: upCheck } = await supabaseAdmin
      .from("user_progress")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (!upCheck) {
      const { error: upInsErr } = await supabaseAdmin
        .from("user_progress")
        .insert({
          id: `up-${courseId}`,
          user_id: userId,
          course_id: courseId,
          completed_modules: [],
          progress_percentage: 0,
        });
      if (upInsErr) {
        return NextResponse.json(
          { success: false, error: upInsErr.message },
          { status: 500 }
        );
      }
    }
  }
  return NextResponse.json({ success: true });
}
