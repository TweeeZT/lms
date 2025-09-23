import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseServer";

// POST /api/user/enrollments
// Body: { userId: string, courseId: string }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = body.userId as string;
    const courseId = body.courseId as string;
    if (!userId || !courseId) {
      return NextResponse.json(
        { success: false, error: "Missing userId or courseId" },
        { status: 400 }
      );
    }

    // Check existing
    const { data: exists, error: checkErr } = await supabaseAdmin
      .from("enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .limit(1)
      .maybeSingle();
    if (checkErr) {
      return NextResponse.json(
        { success: false, error: checkErr.message },
        { status: 500 }
      );
    }
    if (exists) {
      return NextResponse.json({
        success: true,
        enrolled: true,
        enrollmentId: exists.id,
      });
    }

    // Insert
    const { data, error } = await supabaseAdmin
      .from("enrollments")
      .insert({ user_id: userId, course_id: courseId })
      .select("id")
      .single();
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      enrolled: true,
      enrollmentId: data.id,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
