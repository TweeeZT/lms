import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseServer";
import { sendPurchaseResultEmail } from "../../../../../lib/mailer";
import crypto from "crypto";

export const runtime = "nodejs";

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
  // NOTE: Xendit may return metadata values as strings even if sent as numbers
  metadata?: {
    base_amount?: string | number | null;
    final_amount?: string | number | null;
    voucher_id?: string | null;
    affiliate_code_id?: string | null;
    user_id?: string | null;
    course_id?: string | null;
  } | null;
}

// GET /api/user/checkout/confirm?invoiceId=...&courseId=...
// Poll invoice status from DB (and optionally Xendit if still pending) and auto-enroll if paid.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const invoiceId = (searchParams.get("invoiceId") || "").trim();
  // Some callers added a stray trailing '$' (seen in logs). Sanitize it.
  let courseId = (searchParams.get("courseId") || "").trim();
  if (courseId.endsWith("$")) courseId = courseId.slice(0, -1);
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
                  // Parse metadata values to numbers (Xendit returns as strings)
                  amount: Number(
                    data.metadata?.base_amount ?? data.amount ?? 0
                  ),
                  final_amount: Number(
                    data.metadata?.final_amount ?? data.amount ?? 0
                  ),
                  method:
                    data.payment_channel ||
                    data.bank_code ||
                    data.payment_method ||
                    null,
                  status: currentStatus,
                  instructors_id: cMeta.instructor_id || null,
                  voucher_id: (data as any)?.metadata?.voucher_id ?? null,
                  affiliate_code_id:
                    (data as any)?.metadata?.affiliate_code_id ?? null,
                });
              } catch (e) {
                console.error("confirm insert transaction failed", e);
              }
            } else {
              // Update status and also the method if Xendit returns a channel
              const patch: Record<string, any> = { status: currentStatus };
              const m =
                data.payment_channel ||
                data.bank_code ||
                data.payment_method ||
                null;
              if (m) patch.method = m;
              await supabaseAdmin
                .from("transactions")
                .update(patch)
                .eq("id", invoiceId);
            }
          }
        } catch {}
      }
    }

    // If completed ensure enrollment & user_progress
    const shouldSendEmail =
      currentStatus === "completed" || currentStatus === "cancelled"; // cancelled = gagal/kadaluarsa
    let emailPayload: { userId?: string; courseId?: string } = {};
    if (currentStatus === "completed") {
      const { data: refreshed } = await supabaseAdmin
        .from("transactions")
        .select("user_id,course_id,voucher_id,amount,final_amount")
        .eq("id", invoiceId)
        .maybeSingle();
      const userId = refreshed?.user_id || tx?.user_id;
      const resolvedCourse = refreshed?.course_id || tx?.course_id || courseId;
      if (userId && resolvedCourse) {
        // Ensure student row exists (foreign key requirement for transactions/enrollments logic elsewhere)
        try {
          const studRes = await supabaseAdmin
            .from("students")
            .upsert(
              { user_id: userId, points: 0, coins: 0 },
              { onConflict: "user_id" }
            );
          if (studRes.error) {
            console.error("confirm students upsert failed", studRes.error);
          }
        } catch (e) {
          console.error("confirm students upsert exception", e);
        }
        emailPayload = { userId, courseId: resolvedCourse };

        // Ensure voucher usage is recorded and used_count incremented (idempotent)
        try {
          const voucherId = refreshed?.voucher_id as string | null;
          if (voucherId) {
            const { data: existingUsage } = await supabaseAdmin
              .from("voucher_usages")
              .select("id")
              .eq("voucher_id", voucherId)
              .eq("user_id", userId)
              .eq("transaction_id", invoiceId)
              .maybeSingle();
            if (!existingUsage) {
              // Parse amounts to numbers for accurate discount calculation
              const totalAmount = Number(refreshed?.amount ?? 0);
              const finalAmt = Number(refreshed?.final_amount ?? totalAmount);
              const discountApplied = Math.max(0, totalAmount - finalAmt);
              await supabaseAdmin.from("voucher_usages").insert({
                voucher_id: voucherId,
                user_id: userId,
                transaction_id: invoiceId,
                discount_applied: discountApplied,
              });
              // Increment used_count safely
              try {
                const rpcRes = await (supabaseAdmin as any).rpc(
                  "increment_voucher_usage",
                  { voucher_uuid: voucherId }
                );
                if (rpcRes?.error) throw rpcRes.error;
              } catch (_rpcErr) {
                try {
                  const { data: v } = await supabaseAdmin
                    .from("vouchers")
                    .select("used_count")
                    .eq("id", voucherId)
                    .maybeSingle();
                  const next = ((v?.used_count as number | null) ?? 0) + 1;
                  await supabaseAdmin
                    .from("vouchers")
                    .update({ used_count: next })
                    .eq("id", voucherId);
                } catch (fallbackErr) {
                  console.error(
                    "voucher used_count increment (confirm) failed",
                    fallbackErr
                  );
                }
              }
            }
          }
        } catch (e) {
          console.error("confirm voucher usage block failed", e);
        }
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
          // Check user role to determine which progress table to use
          const { data: userInfo } = await supabaseAdmin
            .from("users")
            .select("role")
            .eq("id", userId)
            .maybeSingle();

          const progressTable =
            userInfo?.role === "school" ? "school_progress" : "user_progress";

          const { data: progress } = await supabaseAdmin
            .from(progressTable)
            .select("id")
            .eq("user_id", userId)
            .eq("course_id", resolvedCourse)
            .maybeSingle();
          if (!progress) {
            // Compute expire_at based on course access_duration_days for paid enrollments
            let expireAt: string | null = null;
            try {
              const { data: courseMeta } = await supabaseAdmin
                .from("courses")
                .select("access_duration_days")
                .eq("id", resolvedCourse)
                .maybeSingle();
              const accessDays = (courseMeta as any)?.access_duration_days as
                | number
                | null
                | undefined;
              if (accessDays && accessDays > 0) {
                const base = new Date();
                base.setDate(base.getDate() + accessDays);
                expireAt = base.toISOString();
              }
            } catch {}

            // fetch first published module for course
            let firstModule: string | null = null;
            try {
              const { data: first } = await supabaseAdmin
                .from("modules")
                .select("id")
                .eq("course_id", resolvedCourse)
                .eq("is_published", true)
                .limit(1);
              if (first && first.length) firstModule = first[0].id;
            } catch {}
            await supabaseAdmin.from(progressTable).insert({
              id: crypto.randomUUID(),
              user_id: userId,
              course_id: resolvedCourse,
              completed_modules: [],
              progress_percentage: 0,
              current_module_id: firstModule,
              expire_at: expireAt,
            });
          }
        } catch {}
      }
    }

    // Kirim email hasil (best-effort) - ambil meta hanya jika kita punya context user+course
    if (shouldSendEmail) {
      const uId =
        emailPayload.userId || tx?.user_id || userIdFromQuery || undefined;
      const cId =
        emailPayload.courseId || tx?.course_id || courseId || undefined;
      if (uId && cId) {
        try {
          const [{ data: u }, { data: c }] = await Promise.all([
            supabaseAdmin
              .from("users")
              .select("email,full_name")
              .eq("id", uId)
              .maybeSingle(),
            supabaseAdmin
              .from("courses")
              .select("title, price")
              .eq("id", cId)
              .maybeSingle(),
          ]);
          if (u?.email && c?.title) {
            sendPurchaseResultEmail({
              to: u.email,
              fullName: u.full_name || "User",
              courseTitle: c.title,
              amount: c.price || 0,
              status: currentStatus === "completed" ? "completed" : "cancelled",
            }).catch((e) =>
              console.log("send purchase email (confirm) failed", e)
            );
          }
        } catch (e) {
          console.log("confirm email meta fetch failed", e);
        }
      }
    }

    return NextResponse.json({ success: true, status: currentStatus });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Confirm error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST /api/user/checkout/confirm
// Handle free course enrollment (price = 0)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, courseId, isFree } = body;

    if (!userId || !courseId) {
      return NextResponse.json(
        { success: false, error: "userId and courseId required" },
        { status: 400 }
      );
    }

    // Get course details
    const { data: course, error: courseErr } = await supabaseAdmin
      .from("courses")
      .select("id, title, price, instructor_id, access_duration_days")
      .eq("id", courseId)
      .maybeSingle();

    if (courseErr || !course) {
      return NextResponse.json(
        { success: false, error: "Kursus tidak ditemukan" },
        { status: 404 }
      );
    }

    // Verify it's actually free
    if (!isFree && (course.price || 0) !== 0) {
      return NextResponse.json(
        { success: false, error: "Kursus ini tidak gratis" },
        { status: 400 }
      );
    }

    // Get user details
    const { data: userInfo, error: userErr } = await supabaseAdmin
      .from("users")
      .select("email, full_name")
      .eq("id", userId)
      .maybeSingle();

    if (userErr || !userInfo) {
      return NextResponse.json(
        { success: false, error: "User tidak ditemukan" },
        { status: 404 }
      );
    }

    // Check if already enrolled
    const { data: existing } = await supabaseAdmin
      .from("user_progress")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Anda sudah terdaftar di kursus ini" },
        { status: 400 }
      );
    }

    // Create transaction with status completed
    const transactionId = crypto.randomUUID();
    const { error: txErr } = await supabaseAdmin.from("transactions").insert({
      id: transactionId,
      date: new Date().toISOString(),
      user_id: userId,
      user_name: userInfo.full_name || userInfo.email || "User",
      course_id: courseId,
      course_title: course.title,
      amount: 0,
      method: "free",
      status: "completed",
      instructors_id: course.instructor_id,
    });

    if (txErr) {
      console.error("Failed to create transaction:", txErr);
      return NextResponse.json(
        { success: false, error: "Gagal membuat transaksi" },
        { status: 500 }
      );
    }

    // Compute expire_at based on course access_duration_days (if limited)
    let expireAt: string | null = null;
    const accessDays = (course as any)?.access_duration_days as
      | number
      | null
      | undefined;
    if (accessDays && accessDays > 0) {
      const now = new Date();
      now.setDate(now.getDate() + accessDays);
      expireAt = now.toISOString();
    }

    // Create user_progress (enrollment)
    const { error: progressErr } = await supabaseAdmin
      .from("user_progress")
      .insert({
        id: crypto.randomUUID(),
        user_id: userId,
        course_id: courseId,
        completed_modules: [],
        progress_percentage: 0,
        enrolled_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
        expire_at: expireAt,
      });

    if (progressErr) {
      console.error("Failed to create user_progress:", progressErr);
      return NextResponse.json(
        { success: false, error: "Gagal mendaftarkan ke kursus" },
        { status: 500 }
      );
    }

    // Increment enrolled_count
    const { data: currentCourse } = await supabaseAdmin
      .from("courses")
      .select("enrolled_count")
      .eq("id", courseId)
      .maybeSingle();

    if (currentCourse) {
      await supabaseAdmin
        .from("courses")
        .update({ enrolled_count: (currentCourse.enrolled_count || 0) + 1 })
        .eq("id", courseId);
    }

    // Send email notification
    try {
      await sendPurchaseResultEmail({
        to: userInfo.email,
        fullName: userInfo.full_name || "User",
        courseTitle: course.title,
        amount: 0,
        status: "completed",
      });
    } catch (e) {
      console.log("Failed to send email:", e);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: "Berhasil terdaftar di kursus gratis",
      transactionId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("POST /api/user/checkout/confirm error:", e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
