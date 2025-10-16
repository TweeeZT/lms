import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolUserId = searchParams.get("schoolUserId");
    const search = searchParams.get("q") || "";
    const status = searchParams.get("status") || "";

    if (!schoolUserId) {
      return NextResponse.json(
        { success: false, error: "schoolUserId required" },
        { status: 400 }
      );
    }

    // Get all published courses
    let query = supabase
      .from("courses")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: courses, error: coursesErr } = await query;
    if (coursesErr) throw coursesErr;

    // Get courses already purchased by this school (check user_progress for all school students)
    const { data: students } = await supabase
      .from("school_students")
      .select("user_id")
      .eq("school_user_id", schoolUserId)
      .eq("status", "accepted");

    const studentIds = students?.map((s) => s.user_id) || [];

    let purchasedCourseIds: string[] = [];
    if (studentIds.length > 0) {
      const { data: progress } = await supabase
        .from("user_progress")
        .select("course_id")
        .in("user_id", studentIds);

      purchasedCourseIds = [
        ...new Set(progress?.map((p) => p.course_id) || []),
      ];
    }

    // Filter out already purchased courses
    const availableCourses = courses?.filter(
      (course) => !purchasedCourseIds.includes(course.id)
    );

    return NextResponse.json({
      success: true,
      courses: availableCourses || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat kursus";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
