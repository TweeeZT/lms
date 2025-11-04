import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { schoolUserId, courseId, includeSchool } = body;

    if (!schoolUserId || !courseId) {
      return NextResponse.json(
        { success: false, error: "schoolUserId and courseId required" },
        { status: 400 }
      );
    }

    // 1. Get school info from users table
    const { data: schoolData, error: schoolError } = await supabase
      .from("users")
      .select("id, full_name, email, role")
      .eq("id", schoolUserId)
      .eq("role", "school")
      .single();

    if (schoolError || !schoolData) {
      return NextResponse.json(
        { success: false, error: "School not found" },
        { status: 404 }
      );
    }

    // 2. Get course info
    const { data: courseData, error: courseError } = await supabase
      .from("courses")
      .select("id, title, price, instructor_id")
      .eq("id", courseId)
      .single();

    if (courseError || !courseData) {
      return NextResponse.json(
        { success: false, error: "Course not found" },
        { status: 404 }
      );
    }

    const coursePrice = courseData.price || 0;

    // 3. Count total accepted students
    const { count: studentCount, error: countError } = await supabase
      .from("school_students")
      .select("*", { count: "exact", head: true })
      .eq("school_user_id", schoolUserId)
      .eq("status", "accepted");

    if (countError) {
      return NextResponse.json(
        { success: false, error: "Failed to count students" },
        { status: 500 }
      );
    }

    const totalStudents = studentCount || 0;
    const finalParticipants = totalStudents + (includeSchool ? 1 : 0);
    const totalAmount = coursePrice * finalParticipants;

    if (totalAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid amount" },
        { status: 400 }
      );
    }

    // 4. Create Xendit invoice
    const invoicePayload = {
      // Use same pattern as user invoices so webhook can parse on fallback
      external_id: `inv:${courseId}:${schoolUserId}:${Date.now()}`,
      payer_email: schoolData.email,
      description: `Pembelian kursus "${courseData.title}" untuk ${finalParticipants} peserta - ${schoolData.full_name}`,
      amount: totalAmount,
      currency: "IDR",
      invoice_duration: 86400, // 24 hours
      success_redirect_url: `${
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      }/success`,
      failure_redirect_url: `${
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      }/failed`,
    };

    const xenditRes = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(XENDIT_SECRET_KEY + ":").toString(
          "base64"
        )}`,
      },
      body: JSON.stringify(invoicePayload),
    });

    const xenditData = await xenditRes.json();

    if (!xenditRes.ok) {
      console.error("[school/checkout/invoice] Xendit error:", xenditData);
      return NextResponse.json(
        {
          success: false,
          error: xenditData.message || "Failed to create invoice",
        },
        { status: 500 }
      );
    }

    // 6. Ensure students FK exists for school user (transactions.user_id -> students.user_id)
    try {
      const { error: studErr } = await supabase
        .from("students")
        .upsert(
          { user_id: schoolUserId, points: 0, coins: 0 },
          { onConflict: "user_id" }
        );
      if (studErr) {
        console.error(
          "[school/checkout/invoice] students upsert error:",
          studErr
        );
      }
    } catch (e) {
      console.error("[school/checkout/invoice] students upsert exception:", e);
    }

    // 7. Save pending transaction to DB (align with transactions schema)
    const { error: txError } = await supabase.from("transactions").insert({
      id: xenditData.id,
      date: new Date().toISOString(),
      user_id: schoolUserId,
      user_name: schoolData.full_name,
      course_id: courseId,
      course_title: courseData.title,
      amount: totalAmount,
      // method unknown until payment; leave null and let webhook update from Xendit
      method: null,
      status: "pending",
      instructors_id: courseData.instructor_id || null,
    });

    if (txError) {
      console.error(
        "[school/checkout/invoice] Transaction insert error:",
        txError
      );
    }

    return NextResponse.json({
      success: true,
      invoiceUrl: xenditData.invoice_url,
      invoiceId: xenditData.id,
      totalAmount,
      totalStudents: finalParticipants,
    });
  } catch (err: any) {
    console.error("[school/checkout/invoice] error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
