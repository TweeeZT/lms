import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const courseId = params.id;
    const userId = req.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId required" },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;

    // Get course info
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select(
        `
        id,
        title,
        description,
        thumbnail,
        category,
        level,
        price,
        duration_min,
        total_modules,
        enrolled_count,
        rating,
        instructor_id,
        is_published,
        created_at,
        updated_at
      `
      )
      .eq("id", courseId)
      .single();

    if (courseError || !course) {
      console.error("Course query error:", courseError);
      return NextResponse.json(
        {
          success: false,
          error: "Course not found",
          debug: courseError?.message,
        },
        { status: 404 }
      );
    }

    // Get instructor info
    const { data: instructor } = await supabase
      .from("users")
      .select("id, full_name, email, avatar")
      .eq("id", course.instructor_id)
      .single();

    // Check if user is enrolled
    const { data: enrollment } = await supabase
      .from("user_progress")
      .select("id, completed_modules, current_module_id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .single();

    // Format response
    const courseData = {
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnail: course.thumbnail,
      category: course.category,
      level: course.level,
      price: course.price,
      durationMin: course.duration_min,
      totalModules: course.total_modules || 0,
      enrolledCount: course.enrolled_count || 0,
      rating: course.rating ? parseFloat(course.rating) : 0,
      instructorId: course.instructor_id,
      instructorName: instructor?.full_name || "Unknown",
      isPublished: course.is_published,
      isEnrolled: !!enrollment,
      createdAt: course.created_at,
      updatedAt: course.updated_at,
    };

    return NextResponse.json({
      success: true,
      course: courseData,
    });
  } catch (error) {
    console.error("Error fetching course:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
