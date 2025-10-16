import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { schoolUserId, courseId } = body;

    if (!schoolUserId || !courseId) {
      return NextResponse.json(
        { success: false, error: "schoolUserId dan courseId wajib" },
        { status: 400 }
      );
    }

    // Get all accepted students for this school
    const { data: students, error: studentsErr } = await supabase
      .from("school_students")
      .select("user_id")
      .eq("school_user_id", schoolUserId)
      .eq("status", "accepted");

    if (studentsErr) throw studentsErr;

    if (!students || students.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada siswa yang diterima" },
        { status: 400 }
      );
    }

    // Get course details and instructor
    const { data: course } = await supabase
      .from("courses")
      .select("id, title, total_modules, price, instructor_id")
      .eq("id", courseId)
      .single();

    if (!course) {
      return NextResponse.json(
        { success: false, error: "Kursus tidak ditemukan" },
        { status: 404 }
      );
    }

    // Get school user name
    const { data: schoolUser } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", schoolUserId)
      .single();

    const schoolName = schoolUser?.full_name || "Sekolah";

    // Enroll each student (create user_progress if not exists)
    let enrolled = 0;
    for (const student of students) {
      const userId = student.user_id;

      // Check if already enrolled
      const { data: existing } = await supabase
        .from("user_progress")
        .select("id")
        .eq("user_id", userId)
        .eq("course_id", courseId)
        .maybeSingle();

      if (!existing) {
        // Create enrollment in user_progress
        await supabase.from("user_progress").insert({
          user_id: userId,
          course_id: courseId,
          completed_modules: [],
          current_module_id: null,
          progress_percentage: 0,
          enrolled_at: new Date().toISOString(),
          last_accessed_at: new Date().toISOString(),
        });
        enrolled++;
      }
    }

    // Create transaction record (bulk purchase by school)
    const totalAmount = (course.price || 0) * students.length;

    await supabase.from("transactions").insert({
      user_id: schoolUserId,
      user_name: schoolName,
      course_id: courseId,
      course_title: course.title,
      amount: totalAmount,
      method: "school_bulk",
      status: "completed",
      instructors_id: course.instructor_id,
      date: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      enrolled,
      total: students.length,
      message: `Berhasil mendaftarkan ${enrolled} siswa ke kursus "${course.title}"`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal membeli kursus";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
