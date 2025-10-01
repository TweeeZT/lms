import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseServer";
import crypto from "crypto";

interface XenditInvoice {
  id?: string;
  status?: string; // PENDING, PAID, SETTLED, EXPIRED, VOIDED
  external_id?: string;
  amount?: number;
  payer_email?: string;
  payer_name?: string;
  payment_method?: string;
  payment_channel?: string;
  bank_code?: string;
}

// GET /api/user/checkout/confirm?invoiceId=...&courseId=...
// Poll invoice status from DB (and optionally Xendit if still pending) and auto-enroll if paid.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const invoiceId = (searchParams.get("invoiceId") || "").trim();
  const courseId = (searchParams.get("courseId") || "").trim();
  const userIdFromQuery = (searchParams.get("userId") || "").trim();
  if (!invoiceId) {
    return NextResponse.json(
      { success: false, error: "invoiceId required" },
      { status: 400 }
    );
  }
  try {
    // Get existing transaction (if any)
    const { data: tx, error: txErr } = await supabaseAdmin
      .from("transactions")
      .select("id,status,user_id,course_id")
      .eq("id", invoiceId)
      .maybeSingle();
    if (txErr) throw txErr;
    let currentStatus = tx?.status || "pending";

    // If unknown or pending -> fetch from Xendit directly
    if (!tx || currentStatus === "pending") {
      const apiKey = process.env.XENDIT_SECRET_KEY;
      if (apiKey) {
        try {
          const invRes = await fetch(
            `https://api.xendit.co/v2/invoices/${invoiceId}`,
            {
              headers: {
                Authorization:
                  "Basic " + Buffer.from(apiKey + ":").toString("base64"),
              },
              cache: "no-store",
            }
          );
          if (invRes.ok) {
            const data: XenditInvoice = await invRes.json();
            if (data.status) {
              const lower = data.status.toLowerCase();
              if (lower === "paid" || lower === "settled")
                currentStatus = "completed";
              else if (lower === "expired" || lower === "voided")
                currentStatus = "cancelled";
              else currentStatus = "pending";
            }
            // Upsert transaction if missing
            // Store raw payment channel / bank code directly (DB column is text)

            if (!tx) {
              // Attempt parse external_id inv:<courseId>:<userId>:<ts>
              let parsedCourse: string | null = null;
              let parsedUser: string | null = null;
              if (data.external_id && data.external_id.startsWith("inv:")) {
                const parts = data.external_id.split(":");
                if (parts.length >= 4) {
                  parsedCourse = parts[1] || null;
                  parsedUser = parts[2] || null;
                }
              }
              let cMeta: {
                title?: string | null;
                instructor_id?: string | null;
              } = {};
              if (parsedCourse) {
                const { data: cInfo } = await supabaseAdmin
                  .from("courses")
                  .select("title,instructor_id")
                  .eq("id", parsedCourse)
                  .maybeSingle();
                if (cInfo) cMeta = cInfo;
              }
              try {
                await supabaseAdmin.from("transactions").insert({
                  id: invoiceId,
                  date: new Date().toISOString(),
                  user_id: parsedUser || userIdFromQuery || null,
                  user_name: data.payer_name || null,
                  course_id: parsedCourse || courseId || null,
                  course_title: cMeta.title || null,
                  amount: data.amount || 0,
                  method:
                    data.payment_channel ||
                    data.bank_code ||
                    data.payment_method ||
                    null,
                  status: currentStatus,
                  instructors_id: cMeta.instructor_id || null,
                });
              } catch (e) {
                console.error("confirm insert transaction failed", e);
              }
            } else if (tx.status !== currentStatus) {
              await supabaseAdmin
                .from("transactions")
                .update({ status: currentStatus })
                .eq("id", invoiceId);
            }
          }
        } catch {}
      }
    }

    // If completed ensure enrollment & user_progress
    if (currentStatus === "completed") {
      const { data: refreshed } = await supabaseAdmin
        .from("transactions")
        .select("user_id,course_id")
        .eq("id", invoiceId)
        .maybeSingle();
      const userId = refreshed?.user_id || tx?.user_id;
      const resolvedCourse = refreshed?.course_id || tx?.course_id || courseId;
      if (userId && resolvedCourse) {
        const { data: existing } = await supabaseAdmin
          .from("enrollments")
          .select("id")
          .eq("user_id", userId)
          .eq("course_id", resolvedCourse)
          .maybeSingle();
        if (!existing) {
          try {
            await supabaseAdmin
              .from("enrollments")
              .insert({ user_id: userId, course_id: resolvedCourse });
          } catch {}
        }
        try {
          const { data: progress } = await supabaseAdmin
            .from("user_progress")
            .select("id")
            .eq("user_id", userId)
            .eq("course_id", resolvedCourse)
            .maybeSingle();
          if (!progress) {
            // fetch first published module for course
            let firstModule: string | null = null;
            try {
              const { data: first } = await supabaseAdmin
                .from("modules")
                .select("id, order_index")
                .eq("course_id", resolvedCourse)
                .eq("is_published", true)
                .order("order_index", { ascending: true })
                .limit(1);
              if (first && first.length) firstModule = first[0].id;
            } catch {}
            await supabaseAdmin.from("user_progress").insert({
              id: crypto.randomUUID(),
              user_id: userId,
              course_id: resolvedCourse,
              completed_modules: [],
              progress_percentage: 0,
              current_module_id: firstModule,
            });
          }
        } catch {}
      }
    }

    return NextResponse.json({ success: true, status: currentStatus });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Confirm error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
