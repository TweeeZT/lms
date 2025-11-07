import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { schoolUserId, courseId, affiliateCode, voucherCode } = body;

    if (!schoolUserId || !courseId) {
      return NextResponse.json(
        { success: false, error: "schoolUserId dan courseId wajib" },
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

    // Validate affiliate code if provided
    let affiliateCodeId: string | null = null;
    let referrerId: string | null = null;
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

      affiliateCodeId = codeData.id;
      referrerId = codeData.user_id;
      affiliateDiscount = 0.1; // 10% discount
    }

    // Validate voucher code if provided
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
          { success: false, error: "Voucher sudah mencapai batas penggunaan" },
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

    // Calculate final amount (apply per student, then multiply)
    const basePrice = course.price || 0;
    let discountPerStudent = 0;

    if (affiliateDiscount > 0) {
      discountPerStudent = basePrice * affiliateDiscount;
    } else if (voucherDiscount > 0 && voucherDiscountType) {
      if (voucherDiscountType === "percentage") {
        discountPerStudent = basePrice * (voucherDiscount / 100);
      } else if (voucherDiscountType === "fixed") {
        discountPerStudent = voucherDiscount;
      }
    }

    const pricePerStudent = basePrice - discountPerStudent;
    const totalAmount = basePrice * students.length;
    const finalAmount = pricePerStudent * students.length;
    const totalDiscount = totalAmount - finalAmount;

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
    const txId = await supabase
      .from("transactions")
      .insert({
        user_id: schoolUserId,
        user_name: schoolName,
        course_id: courseId,
        course_title: course.title,
        amount: totalAmount,
        final_amount: finalAmount,
        method: "school_bulk",
        status: "completed",
        instructors_id: course.instructor_id,
        voucher_id: voucherId,
        affiliate_code_id: affiliateCodeId,
        date: new Date().toISOString(),
      })
      .select("id")
      .single();

    // Process affiliate referral if code was used
    if (affiliateCodeId && referrerId && txId.data) {
      // Insert referral record with PURCHASED status
      await supabase.from("affiliate_referrals").insert({
        affiliate_code_id: affiliateCodeId,
        referrer_id: referrerId,
        referred_user_id: schoolUserId,
        course_id: courseId,
        reward_coins: 100,
        bonus_coins: 0,
        status: "purchased",
      });

      // Award referrer 1000 points and 100 coins
      const { data: referrerStudent } = await supabase
        .from("students")
        .select("points, coins, total_referral_points")
        .eq("user_id", referrerId)
        .single();

      if (referrerStudent) {
        await supabase
          .from("students")
          .update({
            points: (referrerStudent.points || 0) + 1000,
            coins: (referrerStudent.coins || 0) + 100,
            total_referral_points:
              (referrerStudent.total_referral_points || 0) + 1000,
          })
          .eq("user_id", referrerId);
      }
    }

    // Process voucher usage if voucher was used
    if (voucherId && txId.data) {
      // Record voucher usage
      await supabase.from("voucher_usages").insert({
        voucher_id: voucherId,
        user_id: schoolUserId,
        transaction_id: txId.data.id,
        discount_applied: totalDiscount,
      });

      // Increment used_count
      const { data: currentVoucher } = await supabase
        .from("vouchers")
        .select("used_count")
        .eq("id", voucherId)
        .single();

      if (currentVoucher) {
        await supabase
          .from("vouchers")
          .update({ used_count: (currentVoucher.used_count || 0) + 1 })
          .eq("id", voucherId);
      }
    }

    return NextResponse.json({
      success: true,
      enrolled,
      total: students.length,
      originalAmount: totalAmount,
      finalAmount,
      discount: totalDiscount,
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
