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
    const {
      schoolUserId,
      courseId,
      includeSchool,
      affiliateCode,
      voucherCode,
    } = body;

    if (!schoolUserId || !courseId) {
      return NextResponse.json(
        { success: false, error: "schoolUserId and courseId required" },
        { status: 400 }
      );
    }

    // Only one discount allowed: affiliate OR voucher
    if (affiliateCode && voucherCode) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Hanya bisa menggunakan salah satu: kode affiliate atau voucher",
        },
        { status: 400 }
      );
    }

    // 1. Validate affiliate code if provided
    let affiliateCodeId: string | null = null;
    let affiliateDiscount = 0;
    if (affiliateCode && affiliateCode.trim()) {
      const { data: codeData, error: codeErr } = await supabase
        .from("affiliate_codes")
        .select("id, user_id, is_active")
        .eq("code", affiliateCode.trim())
        .single();

      if (codeErr || !codeData || !codeData.is_active) {
        return NextResponse.json(
          {
            success: false,
            error: "Kode afiliasi tidak valid atau sudah tidak aktif",
          },
          { status: 400 }
        );
      }

      // Prevent self-referral
      if (codeData.user_id === schoolUserId) {
        return NextResponse.json(
          {
            success: false,
            error: "Tidak dapat menggunakan kode afiliasi sendiri",
          },
          { status: 400 }
        );
      }

      affiliateCodeId = codeData.id;
      affiliateDiscount = 0.1; // 10% discount
    }

    // 2. Validate voucher code if provided
    let voucherId: string | null = null;
    let voucherDiscount = 0;
    let voucherDiscountType: string | null = null;
    if (voucherCode && voucherCode.trim() && !affiliateCode) {
      const { data: voucherData, error: voucherErr } = await supabase
        .from("vouchers")
        .select(
          "id, discount_type, discount_value, max_uses, used_count, start_date, end_date, is_active"
        )
        .eq("code", voucherCode.trim())
        .single();

      if (voucherErr || !voucherData || !voucherData.is_active) {
        return NextResponse.json(
          {
            success: false,
            error: "Kode voucher tidak valid atau sudah tidak aktif",
          },
          { status: 400 }
        );
      }

      // Check max uses
      if (
        voucherData.max_uses &&
        voucherData.used_count >= voucherData.max_uses
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Voucher sudah habis digunakan (dipakai ${voucherData.used_count}× dari maksimal ${voucherData.max_uses}×)`,
          },
          { status: 400 }
        );
      }

      // Check date validity
      const now = new Date();
      if (voucherData.start_date && new Date(voucherData.start_date) > now) {
        return NextResponse.json(
          { success: false, error: "Voucher belum dapat digunakan" },
          { status: 400 }
        );
      }
      if (voucherData.end_date && new Date(voucherData.end_date) < now) {
        return NextResponse.json(
          { success: false, error: "Voucher sudah kadaluarsa" },
          { status: 400 }
        );
      }

      voucherId = voucherData.id;
      voucherDiscountType = voucherData.discount_type;
      voucherDiscount = Number(voucherData.discount_value || 0);
    }

    // 3. Get school info from users table
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

    // 4. Get course info
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

    // 5. Count total accepted students
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

    // Calculate discount per participant
    let discountPerParticipant = 0;
    if (affiliateDiscount > 0) {
      discountPerParticipant = coursePrice * affiliateDiscount;
    } else if (voucherDiscount > 0 && voucherDiscountType) {
      if (voucherDiscountType === "percentage") {
        discountPerParticipant = coursePrice * (voucherDiscount / 100);
      } else if (voucherDiscountType === "fixed") {
        discountPerParticipant = voucherDiscount;
      }
    }

    const pricePerParticipant = Math.max(
      0,
      coursePrice - discountPerParticipant
    );
    const baseAmount = coursePrice * finalParticipants;
    const totalAmount = pricePerParticipant * finalParticipants;
    const totalDiscount = baseAmount - totalAmount;

    if (totalAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid amount" },
        { status: 400 }
      );
    }

    // 6. Create Xendit invoice (include metadata so webhook can process discounts & voucher usage)
    // CRITICAL: Xendit drops NULL values and may not preserve numeric metadata
    // Solution: stringify all values and only include defined keys
    const metadata: Record<string, string> = {
      base_amount: String(baseAmount),
      final_amount: String(totalAmount),
      course_id: courseId,
      user_id: schoolUserId,
      participants: String(finalParticipants),
    };
    if (affiliateCodeId) metadata.affiliate_code_id = String(affiliateCodeId);
    if (voucherId) metadata.voucher_id = String(voucherId);

    const invoicePayload = {
      // Use same pattern as user invoices so webhook can parse on fallback
      external_id: `inv:${courseId}:${schoolUserId}:${Date.now()}`,
      payer_email: schoolData.email,
      description: `Pembelian kursus "${
        courseData.title
      }" untuk ${finalParticipants} peserta - ${schoolData.full_name}${
        totalDiscount > 0
          ? ` (Diskon Rp ${totalDiscount.toLocaleString("id-ID")})`
          : ""
      }`,
      amount: totalAmount,
      currency: "IDR",
      invoice_duration: 86400, // 24 hours
      // Provide context for webhook idempotency and accurate inserts/updates
      metadata,
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

    // 8. Save pending transaction to DB (align with transactions schema)
    const { error: txError } = await supabase.from("transactions").insert({
      id: xenditData.id,
      date: new Date().toISOString(),
      user_id: schoolUserId,
      user_name: schoolData.full_name,
      course_id: courseId,
      course_title: courseData.title,
      amount: baseAmount,
      final_amount: totalAmount,
      // Use PENDING as placeholder (DB column is NOT NULL)
      method: "PENDING",
      status: "pending",
      instructors_id: courseData.instructor_id || null,
      voucher_id: voucherId,
      affiliate_code_id: affiliateCodeId,
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
      baseAmount,
      discount: totalDiscount,
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
