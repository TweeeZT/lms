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

    if (!schoolUserId) {
      return NextResponse.json(
        { success: false, error: "schoolUserId required" },
        { status: 400 }
      );
    }

    // Get all students of this school
    const { data: students } = await supabase
      .from("school_students")
      .select("user_id")
      .eq("school_user_id", schoolUserId)
      .eq("status", "accepted");

    const studentIds = students?.map((s) => s.user_id) || [];

    if (studentIds.length === 0) {
      return NextResponse.json({
        success: true,
        courses: [],
      });
    }

    // Get courses from user_progress for these students
    const { data: progress } = await supabase
      .from("user_progress")
      .select("course_id")
      .in("user_id", studentIds);

    const purchasedCourseIds = [
      ...new Set(progress?.map((p) => p.course_id) || []),
    ];

    if (purchasedCourseIds.length === 0) {
      return NextResponse.json({
        success: true,
        courses: [],
      });
    }

    // Get course details
    let query = supabase
      .from("courses")
      .select("*")
      .in("id", purchasedCourseIds);

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: courses, error: coursesErr } = await query.order(
      "created_at",
      {
        ascending: false,
      }
    );

    if (coursesErr) throw coursesErr;

    return NextResponse.json({
      success: true,
      courses: courses || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat kursus";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
