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

    // Fetch course meta early to compute expiry
    const { data: courseMetaForExpiry } = await supabase
      .from("courses")
      .select("id,title,price,instructor_id,enrolled_count,access_duration_days")
      .eq("id", courseId)
      .maybeSingle();

    let expireAtForSchool: string | null = null;
    let expireAtForStudents: string | null = null;
    const accessDays = (courseMetaForExpiry as any)?.access_duration_days as
      | number
      | null
      | undefined;
    if (accessDays && accessDays > 0) {
      const base = new Date();
      base.setDate(base.getDate() + accessDays);
      const iso = base.toISOString();
      expireAtForSchool = iso;
      expireAtForStudents = iso;
    }

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
          expire_at: expireAtForSchool,
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
          expire_at: expireAtForStudents,
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
        .select("id,title,price,instructor_id,enrolled_count")
        .eq("id", courseId)
        .maybeSingle(),
      supabase
        .from("users")
        .select("full_name")
        .eq("id", schoolUserId)
        .eq("role", "school")
        .maybeSingle(),
    ]);

    const courseTitle = courseMeta?.title || null;
    const instructorId = (courseMeta as any)?.instructor_id || null;
    const schoolName = schoolMeta?.full_name || null;
    const currentEnrolledCount = courseMeta?.enrolled_count || 0;

    // 5. Update enrolled_count in courses table
    const enrolledIncrement =
      insertedStudents + (includeSchool && !hasSchoolProgress ? 1 : 0);
    if (enrolledIncrement > 0) {
      const { error: enrolledCountError } = await supabase
        .from("courses")
        .update({ enrolled_count: currentEnrolledCount + enrolledIncrement })
        .eq("id", courseId);

      if (enrolledCountError) {
        console.error(
          "[school/checkout/confirm] enrolled_count update error:",
          enrolledCountError
        );
      }
    }

    // 6. If it's free course, create transaction record
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
      // 7. Paid flow: update transaction to completed and set method from Xendit if possible
      let methodFromXendit: string | null = null;
      if (invoiceId && process.env.XENDIT_SECRET_KEY) {
        try {
          const invRes = await fetch(
            `https://api.xendit.co/v2/invoices/${invoiceId}`,
            {
              headers: {
                Authorization:
                  "Basic " +
                  Buffer.from(process.env.XENDIT_SECRET_KEY + ":").toString(
                    "base64"
                  ),
              },
              cache: "no-store",
            }
          );
          if (invRes.ok) {
            const data = (await invRes.json()) as {
              payment_channel?: string;
              bank_code?: string;
              payment_method?: string;
            };
            methodFromXendit =
              data.payment_channel ||
              data.bank_code ||
              data.payment_method ||
              null;
          }
        } catch {}
      }

      const patch: Record<string, any> = { status: "completed" };
      if (methodFromXendit) patch.method = methodFromXendit;

      let txUpdateError: any = null;
      if (invoiceId) {
        const { error } = await supabase
          .from("transactions")
          .update(patch)
          .eq("id", invoiceId);
        txUpdateError = error;
      } else {
        const { error } = await supabase
          .from("transactions")
          .update(patch)
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

      // Best-effort: record voucher usage & increment used_count if webhook hasn't yet
      try {
        if (invoiceId) {
          const { data: tx } = await supabase
            .from("transactions")
            .select("voucher_id, amount, final_amount, user_id")
            .eq("id", invoiceId)
            .maybeSingle();
          const voucherId = tx?.voucher_id as string | null;
          const uid = tx?.user_id as string | null;
          if (voucherId && uid) {
            const { data: existingUsage } = await supabase
              .from("voucher_usages")
              .select("id")
              .eq("voucher_id", voucherId)
              .eq("user_id", uid)
              .eq("transaction_id", invoiceId)
              .maybeSingle();
            if (!existingUsage) {
              // Parse amounts to numbers for accurate discount calculation
              const totalAmount = Number(tx?.amount ?? 0);
              const finalAmt = Number(tx?.final_amount ?? totalAmount);
              const discountApplied = Math.max(0, totalAmount - finalAmt);
              await supabase.from("voucher_usages").insert({
                voucher_id: voucherId,
                user_id: uid,
                transaction_id: invoiceId,
                discount_applied: discountApplied,
              });
              // Increment used_count
              try {
                const { data: v } = await supabase
                  .from("vouchers")
                  .select("used_count")
                  .eq("id", voucherId)
                  .maybeSingle();
                const next = ((v?.used_count as number | null) ?? 0) + 1;
                await supabase
                  .from("vouchers")
                  .update({ used_count: next })
                  .eq("id", voucherId);
              } catch (incErr) {
                console.error(
                  "[school/confirm] voucher used_count increment failed",
                  incErr
                );
              }
            }
          }
        }
      } catch (e) {
        console.error("[school/confirm] voucher usage block failed", e);
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
