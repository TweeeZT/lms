import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID as nodeRandomUUID } from "crypto";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { schoolUserId, courseId, isFree, includeSchool, invoiceId } = body;

    if (!schoolUserId || !courseId) {
      return NextResponse.json(
        { success: false, error: "schoolUserId and courseId required" },
        { status: 400 }
      );
    }

    // 1. Check if school already enrolled in this course (only if includeSchool)
    let hasSchoolProgress = false;
    if (includeSchool) {
      const { data: existingSchoolProgress } = await supabase
        .from("school_progress")
        .select("id")
        .eq("user_id", schoolUserId)
        .eq("course_id", courseId)
        .maybeSingle();

      hasSchoolProgress = !!existingSchoolProgress;
    }

    // 2. Get all accepted students
    const { data: students, error: studentsError } = await supabase
      .from("school_students")
      .select("user_id")
      .eq("school_user_id", schoolUserId)
      .eq("status", "accepted")
      .not("user_id", "is", null);

    if (studentsError) {
      console.error("[school/checkout/confirm] Students error:", studentsError);
      return NextResponse.json(
        { success: false, error: "Failed to get students" },
        { status: 500 }
      );
    }

    const studentUserIds = (students || [])
      .map((s: any) => s.user_id)
      .filter(Boolean);

    // 3. Insert into school_progress if includeSchool and not already exists
    if (includeSchool && !hasSchoolProgress) {
      const newId =
        (globalThis as any).crypto?.randomUUID?.() ?? nodeRandomUUID();
      const { error: schoolProgressError } = await supabase
        .from("school_progress")
        .insert({
          id: newId,
          user_id: schoolUserId,
          course_id: courseId,
          completed_modules: [],
          progress_percentage: 0,
          current_module_id: null,
        });

      if (schoolProgressError) {
        console.error(
          "[school/checkout/confirm] School progress error:",
          schoolProgressError
        );
        return NextResponse.json(
          { success: false, error: "Failed to enroll school" },
          { status: 500 }
        );
      }
    }

    // 4. Insert into user_progress for all students
    let insertedStudents = 0;
    if (studentUserIds.length > 0) {
      // Check which students are already enrolled
      const { data: existingProgress } = await supabase
        .from("user_progress")
        .select("user_id")
        .eq("course_id", courseId)
        .in("user_id", studentUserIds);

      const existingUserIds = new Set(
        (existingProgress || []).map((p: any) => p.user_id)
      );

      // Filter out already enrolled students
      const newStudentIds = studentUserIds.filter(
        (id) => !existingUserIds.has(id)
      );

      if (newStudentIds.length > 0) {
        const studentProgressRows = newStudentIds.map((userId) => ({
          id: (globalThis as any).crypto?.randomUUID?.() ?? nodeRandomUUID(),
          user_id: userId,
          course_id: courseId,
          completed_modules: [],
        }));

        const { error: studentProgressError } = await supabase
          .from("user_progress")
          .insert(studentProgressRows);

        if (studentProgressError) {
          console.error(
            "[school/checkout/confirm] Bulk student insert failed, trying individually:",
            studentProgressError
          );
          for (const row of studentProgressRows) {
            const { error: oneErr } = await supabase
              .from("user_progress")
              .insert(row);
            if (!oneErr) insertedStudents += 1;
            else
              console.error(
                "[school/checkout/confirm] Single student insert error",
                row.user_id,
                oneErr
              );
          }
        } else {
          insertedStudents = studentProgressRows.length;
        }
      }
    }

    // Fetch course & school meta for transactions
    const [{ data: courseMeta }, { data: schoolMeta }] = await Promise.all([
      supabase
        .from("courses")
        .select("id,title,price,instructor_id")
        .eq("id", courseId)
        .maybeSingle(),
      supabase
        .from("schools")
        .select("school_name")
        .eq("user_id", schoolUserId)
        .maybeSingle(),
    ]);

    const courseTitle = courseMeta?.title || null;
    const instructorId = (courseMeta as any)?.instructor_id || null;
    const schoolName = schoolMeta?.school_name || null;

    // 5. If it's free course, create transaction record
    if (isFree) {
      // Ensure students FK row exists for school user
      try {
        const { error: studErr } = await supabase
          .from("students")
          .upsert(
            { user_id: schoolUserId, points: 0, coins: 0 },
            { onConflict: "user_id" }
          );
        if (studErr)
          console.error(
            "[school/checkout/confirm] students upsert error:",
            studErr
          );
      } catch (e) {
        console.error(
          "[school/checkout/confirm] students upsert exception:",
          e
        );
      }
      const { error: txError } = await supabase.from("transactions").insert({
        id:
          invoiceId ||
          ((globalThis as any).crypto?.randomUUID?.() ?? nodeRandomUUID()),
        date: new Date().toISOString(),
        user_id: schoolUserId,
        user_name: schoolName,
        course_id: courseId,
        course_title: courseTitle,
        amount: 0,
        method: "free",
        status: "completed",
        instructors_id: instructorId,
      });

      if (txError) {
        console.error("[school/checkout/confirm] Transaction error:", txError);
      }
    } else {
      // Update existing transaction to completed. Prefer invoiceId when available.
      const query = supabase
        .from("transactions")
        .update({ status: "completed" });
      let txUpdateError: any = null;
      if (invoiceId) {
        const { error } = await query.eq("id", invoiceId);
        txUpdateError = error;
      } else {
        const { error } = await query
          .eq("user_id", schoolUserId)
          .eq("course_id", courseId)
          .eq("status", "pending");
        txUpdateError = error;
      }

      if (txUpdateError) {
        console.error(
          "[school/checkout/confirm] Transaction update error:",
          txUpdateError
        );
      }
    }

    return NextResponse.json({
      success: true,
      message:
        "Successfully processed purchase for students" +
        (includeSchool ? " & school" : ""),
      studentsEnrolled: insertedStudents,
      status: "completed",
    });
  } catch (err: any) {
    console.error("[school/checkout/confirm] error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
