import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseServer";

// Force Node runtime (needed for future email / crypto, avoid edge limitations)
export const runtime = "nodejs";
// body: { userId, courseId, affiliateCode?, voucherCode?, toolIds?: string[] }
// Creates a Xendit invoice (mock/simple call placeholder) and inserts pending transaction.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = (body.userId || "").trim();
    const courseId = (body.courseId || "").trim();
    const affiliateCode = (body.affiliateCode || "").trim();
    const voucherCode = (body.voucherCode || "").trim();
    const rawToolIds: unknown = body.toolIds;
    const toolIds = Array.isArray(rawToolIds)
      ? rawToolIds
          .filter((v) => typeof v === "string" && v.trim().length)
          .map((v) => v.trim())
      : [];

    if (!userId || !courseId) {
      return NextResponse.json(
        { success: false, error: "userId & courseId required" },
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
    if (affiliateCode) {
      const { data: codeData, error: codeErr } = await supabaseAdmin
        .from("affiliate_codes")
        .select("id, user_id, is_active")
        .eq("code", affiliateCode)
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
    if (voucherCode && !affiliateCode) {
      const { data: voucherData, error: voucherErr } = await supabaseAdmin
        .from("vouchers")
        .select(
          "id, discount_type, discount_value, max_uses, used_count, start_date, end_date, is_active"
        )
        .eq("code", voucherCode)
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

    // Fetch course for price & title (public table courses)
    const { data: course, error: courseErr } = await supabaseAdmin
      .from("courses")
      .select("id,title,price,instructor_id")
      .eq("id", courseId)
      .maybeSingle();
    if (courseErr || !course) {
      return NextResponse.json(
        { success: false, error: courseErr?.message || "Course not found" },
        { status: 404 }
      );
    }

    // Fetch user (for name)
    const { data: user, error: userErr } = await supabaseAdmin
      .from("users")
      .select("id, full_name")
      .eq("id", userId)
      .maybeSingle();
    if (userErr || !user) {
      return NextResponse.json(
        { success: false, error: userErr?.message || "User not found" },
        { status: 404 }
      );
    }

    // Fetch selected add-on tools (course_tools) if any. Each contributes its price (no discount applied to tools).
    let toolsTotal = 0;
    if (toolIds.length) {
      const { data: toolsData, error: toolsErr } = await supabaseAdmin
        .from("course_tools")
        .select("id, price, courses_id")
        .in("id", toolIds)
        .eq("courses_id", courseId);
      if (toolsErr) {
        return NextResponse.json(
          { success: false, error: "Gagal mengambil data alat tambahan" },
          { status: 500 }
        );
      }
      // Sum only positive numeric prices
      toolsTotal = (toolsData || []).reduce((sum, t) => {
        const p = typeof t.price === "number" && t.price > 0 ? t.price : 0;
        return sum + p;
      }, 0);
    }

    const courseBasePrice = course.price || 0;

    // Calculate discount
    let discountAmount = 0;
    if (affiliateDiscount > 0) {
      discountAmount = courseBasePrice * affiliateDiscount;
    } else if (voucherDiscount > 0 && voucherDiscountType) {
      if (voucherDiscountType === "percentage") {
        discountAmount = courseBasePrice * (voucherDiscount / 100);
      } else if (voucherDiscountType === "fixed") {
        discountAmount = voucherDiscount;
      }
    }

    // Apply discount only to course price, never to tools
    const discountedCoursePrice = Math.max(0, courseBasePrice - discountAmount);
    const finalAmount = discountedCoursePrice + toolsTotal;
    const baseAmount = courseBasePrice + toolsTotal; // original total before discount (tools unaffected)

    // Create invoice via Xendit
    const apiKey = process.env.XENDIT_SECRET_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Missing Xendit API key" },
        { status: 500 }
      );
    }

    // Build base URL for redirect (fallback to request origin if env missing)
    const baseUrlEnv = process.env.NEXT_PUBLIC_BASE_URL;
    const originFallback = req.headers.get("origin") || "";
    const baseUrl = (
      baseUrlEnv && baseUrlEnv.trim().length ? baseUrlEnv : originFallback
    ).replace(/\/$/, "");

    // external_id MUST encode course + user so webhook can recover context if pending insert fails
    // Pattern: inv:<courseId>:<userId>:<timestamp>
    const externalId = `inv:${courseId}:${userId}:${Date.now()}`;
    // CRITICAL: Xendit drops NULL and may convert/drop numeric metadata values
    // Solution: stringify all values and only include defined keys
    const metadata: Record<string, string> = {
      base_amount: String(baseAmount),
      final_amount: String(finalAmount),
      course_id: courseId,
      user_id: userId,
      course_price: String(courseBasePrice),
      tools_total: String(toolsTotal),
    };
    if (affiliateCodeId) metadata.affiliate_code_id = String(affiliateCodeId);
    if (voucherId) metadata.voucher_id = String(voucherId);
    if (toolIds.length) metadata.tool_ids = JSON.stringify(toolIds);

    console.log("[user/invoice] Sending metadata to Xendit:", metadata);

    const invRes = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(apiKey + ":").toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_id: externalId,
        amount: finalAmount,
        payer_email: undefined,
  description: `Pembelian kursus ${course.title}$${toolIds.length ? ` + ${toolIds.length} add-on alat` : ""}`,
        // Store discount context so webhook can be idempotent and complete even if the pending insert failed
        metadata,
        // Pass context so success page can poll without relying solely on localStorage
        // Simpler redirect: we don't rely on query params; success page will read localStorage pending ids
        success_redirect_url: `${baseUrl}/success`,
        // BUGFIX: missing slash previously caused wrong redirect
        failure_redirect_url: `${baseUrl}/failed`,
      }),
    });

    interface XenditInvoiceResp {
      id?: string;
      invoice_url?: string;
      error?: string;
      external_id?: string;
      status?: string;
      amount?: number;
    }
    const invJson: XenditInvoiceResp = await invRes
      .json()
      .catch(() => ({} as XenditInvoiceResp));
    if (!invRes.ok) {
      return NextResponse.json(
        {
          success: false,
          error: invJson.error || "Xendit invoice create failed",
        },
        { status: invRes.status }
      );
    }

    // Ensure student row exists (FK on transactions.user_id points to students.user_id)
    try {
      if (userId) {
        const upsertRes = await supabaseAdmin
          .from("students")
          .upsert(
            { user_id: userId, points: 0, coins: 0 },
            { onConflict: "user_id" }
          );
        if (upsertRes.error) {
          console.error("students upsert (invoice) failed", upsertRes.error);
        }
      }
    } catch (e) {
      console.error("students upsert (invoice) exception", e);
    }

    // Insert pending transaction (id = invoice id)
    // NOTE: Some DB enums expect payment channel (e.g., BCA/BNC). At creation time channel not yet chosen.
    // We still attempt a pending insert; if it fails (enum mismatch) confirm/webhook will upsert later.
    try {
      if (invJson.id) {
        const insertRes = await supabaseAdmin.from("transactions").insert({
          id: invJson.id,
          date: new Date().toISOString(),
          user_id: userId,
          user_name: user.full_name,
          course_id: courseId,
          course_title: course.title,
          amount: baseAmount, // includes tools
          final_amount: finalAmount,
          // Use PENDING as placeholder (DB column is NOT NULL)
          method: "PENDING",
          status: "pending",
          instructors_id: course.instructor_id || null,
          voucher_id: voucherId,
          affiliate_code_id: affiliateCodeId,
          tools_total: toolsTotal || 0, // if a column exists; harmless if ignored
        });
        if (insertRes.error) {
          console.error("transaction pending insert failed", insertRes.error);
        } else {
          console.log("pending transaction inserted", invJson.id);
        }
      }
    } catch (e) {
      console.error("transaction pending insert exception", e);
    }

    // Replace placeholder with real invoice id in redirect URL (can't know prior to response)
    let finalInvoiceUrl = invJson.invoice_url;
    if (finalInvoiceUrl && invJson.id) {
      // Some providers echo back success_redirect_url already containing placeholders; ensure not double replaced
      finalInvoiceUrl = finalInvoiceUrl.replace(
        "__INVOICE_ID__",
        encodeURIComponent(invJson.id)
      );
    }
    return NextResponse.json({
      success: true,
      invoiceId: invJson.id,
      invoiceUrl: finalInvoiceUrl,
      externalId: invJson.external_id,
      originalAmount: baseAmount,
      finalAmount: finalAmount,
      discount: discountAmount,
      toolsTotal,
      coursePrice: courseBasePrice,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invoice error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
