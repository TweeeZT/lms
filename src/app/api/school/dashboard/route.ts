import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolUserId = searchParams.get("schoolUserId");

    if (!schoolUserId) {
      return NextResponse.json(
        { success: false, error: "schoolUserId required" },
        { status: 400 }
      );
    }

    // Total students
    const { count: totalStudents } = await supabase
      .from("school_students")
      .select("*", { count: "exact", head: true })
      .eq("school_user_id", schoolUserId)
      .eq("status", "accepted");

    // Active courses (courses yang di-enroll oleh siswa sekolah ini)
    // first fetch student user IDs, then query user_progress for those users
    const { data: studentUsersData } = await supabase
      .from("school_students")
      .select("user_id")
      .eq("school_user_id", schoolUserId)
      .eq("status", "accepted");

    const studentUserIds = (studentUsersData || []).map((s) => s.user_id);

    const { data: enrollments } = await supabase
      .from("user_progress")
      .select("course_id")
      .in("user_id", studentUserIds);

    const uniqueCourses = new Set(enrollments?.map((e) => e.course_id) || []);
    const activeCourses = uniqueCourses.size;

    // Total enrollments
    const { data: progressData } = await supabase
      .from("user_progress")
      .select("progress_percentage")
      .in("user_id", studentUserIds);

    const totalEnrollments = progressData?.length || 0;
    const completionRate =
      progressData && progressData.length > 0
        ? progressData.reduce(
            (sum, p) => sum + (p.progress_percentage || 0),
            0
          ) / progressData.length
        : 0;

    // Recent transactions for this school (optional for UI)
    const { data: recentTx } = await supabase
      .from("transactions")
      .select("id, date, course_title, amount, status")
      .eq("user_id", schoolUserId)
      .order("date", { ascending: false })
      .limit(5);

    return NextResponse.json({
      success: true,
      stats: {
        totalStudents: totalStudents || 0,
        activeCourses,
        totalEnrollments,
        completionRate,
      },
      transactions: recentTx || [],
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal memuat dashboard";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
