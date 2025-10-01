import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseServer";
// body: { userId, courseId }
// Creates a Xendit invoice (mock/simple call placeholder) and inserts pending transaction.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = (body.userId || "").trim();
    const courseId = (body.courseId || "").trim();
    if (!userId || !courseId) {
      return NextResponse.json(
        { success: false, error: "userId & courseId required" },
        { status: 400 }
      );
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

    const amount = course.price || 0;

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
    const invRes = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(apiKey + ":").toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_id: externalId,
        amount: amount,
        payer_email: undefined,
        description: `Pembelian kursus ${course.title}`,
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
          amount: amount,
          method: "BCA", // placeholder, will be updated by webhook with actual payment channel
          status: "pending",
          instructors_id: course.instructor_id || null,
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
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invoice error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
