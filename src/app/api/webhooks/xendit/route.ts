import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseServer";
import { sendPurchaseResultEmail } from "../../../../lib/mailer";
import crypto from "crypto";

export const runtime = "nodejs";

// Xendit invoice webhook
// Docs: https://docs.xendit.co/api-reference/#invoices
// Expect JSON body containing id, status, external_id, amount, paid_at etc.
// We verify callback token if provided via header 'x-callback-token' (set in Xendit dashboard)

const CALLBACK_TOKEN = process.env.XENDIT_CALLBACK_TOKEN;

export async function POST(req: NextRequest) {
  console.log("=== WEBHOOK CALLED ===");
  interface XenditWebhookBody {
    id?: string;
    status?: string; // PAID, PENDING, EXPIRED, SETTLED, VOIDED
    external_id?: string;
    amount?: number;
    payer_name?: string;
    payer_email?: string;
    payment_method?: string; // BANK_TRANSFER etc
    payment_channel?: string; // BNC, BCA, etc
    bank_code?: string; // sometimes provided
    // We include metadata when creating invoice so webhook can be idempotent
    // NOTE: Xendit may return metadata values as strings even if sent as numbers
    metadata?: {
      affiliate_code_id?: string | null;
      voucher_id?: string | null;
      base_amount?: string | number | null;
      final_amount?: string | number | null;
      user_id?: string | null;
      course_id?: string | null;
      participants?: string | number | null;
    } | null;
  }
  let payload: XenditWebhookBody;
  try {
    payload = await req.json();
    console.log("webhook payload received:", JSON.stringify(payload, null, 2));
    console.log("[webhook] metadata received:", payload.metadata);
  } catch (e) {
    console.error("webhook JSON parse failed:", e);
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  // Basic optional token check
  if (CALLBACK_TOKEN) {
    const token = req.headers.get("x-callback-token");
    if (token !== CALLBACK_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
  }

  const invoiceId = payload.id as string | undefined;
  const statusRaw = payload.status?.toLowerCase();
  const status = statusRaw;
  console.log("invoice ID:", invoiceId, "status:", status);

  if (!invoiceId) {
    console.error("webhook missing invoice ID");
    return NextResponse.json(
      { success: false, error: "Missing invoice id" },
      { status: 400 }
    );
  }

  // Map Xendit statuses to our DB enum (completed/pending/cancelled)
  let internalStatus: string = "pending";
  if (status === "paid" || status === "settled") internalStatus = "completed";
  else if (status === "expired" || status === "voided")
    internalStatus = "cancelled";

  console.log("mapped internal status:", internalStatus);

  // Store raw Xendit channel/bank code directly (DB method column now text).
  const paymentMethod =
    payload.payment_channel ||
    payload.bank_code ||
    payload.payment_method ||
    null;

  // Fetch existing transaction
  const { data: existingTx, error: existingErr } = await supabaseAdmin
    .from("transactions")
    .select(
      "id, status, user_id, course_id, course_title, instructors_id, voucher_id, affiliate_code_id, final_amount"
    )
    .eq("id", invoiceId)
    .maybeSingle();
  if (existingErr) {
    console.error("webhook fetch existing transaction error", existingErr);
  }

  console.log("existing transaction:", existingTx);

  // If already paid and webhook repeats, short-circuit (idempotent)
  if (
    existingTx &&
    existingTx.status === "completed" &&
    internalStatus === "completed"
  ) {
    console.log("already completed, skipping");
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "already-paid",
    });
  }

  // Parse external_id pattern inv:<courseId>:<userId>:<timestamp>
  let parsedCourse: string | null = null;
  let parsedUser: string | null = null;
  if (payload.external_id) {
    if (payload.external_id.startsWith("inv:")) {
      const parts = payload.external_id.split(":");
      if (parts.length >= 4) {
        parsedCourse = parts[1] || null;
        parsedUser = parts[2] || null;
      }
    } else {
      console.log(
        "external_id legacy/unrecognized format",
        payload.external_id
      );
    }
  }

  console.log(
    "parsed from external_id - course:",
    parsedCourse,
    "user:",
    parsedUser
  );

  // Attempt to fetch course meta if we have course id (for title + instructor)
  let courseMeta: { title?: string | null; instructor_id?: string | null } = {};
  if (parsedCourse) {
    const { data: cMeta, error: cErr } = await supabaseAdmin
      .from("courses")
      .select("title,instructor_id")
      .eq("id", parsedCourse)
      .maybeSingle();
    if (!cErr && cMeta) courseMeta = cMeta;
  }

  if (!existingTx) {
    console.log("no existing transaction, creating new one");
    try {
      // If missing payer_name we'll attempt to derive from users table after parsing external id
      let derivedUserName: string | null = payload.payer_name || null;
      if (!derivedUserName && parsedUser) {
        try {
          const { data: uMeta } = await supabaseAdmin
            .from("users")
            .select("full_name")
            .eq("id", parsedUser)
            .maybeSingle();
          if (uMeta?.full_name) derivedUserName = uMeta.full_name;
        } catch {}
      }
      // Ensure students row exists before inserting (FK constraint)
      if (parsedUser) {
        try {
          const studRes = await supabaseAdmin
            .from("students")
            .upsert(
              { user_id: parsedUser, points: 0, coins: 0 },
              { onConflict: "user_id" }
            );
          if (studRes.error) {
            console.error("webhook students upsert failed", studRes.error);
          }
        } catch (e) {
          console.error("webhook students upsert exception", e);
        }
      }
      // Parse metadata strings to numbers (Xendit returns metadata as strings)
      const baseAmountMeta = payload.metadata?.base_amount;
      const finalAmountMeta = payload.metadata?.final_amount;
      const insertRes = await supabaseAdmin.from("transactions").insert({
        id: invoiceId,
        date: new Date().toISOString(),
        user_id: parsedUser,
        user_name: derivedUserName,
        course_id: parsedCourse,
        course_title: courseMeta.title || null,
        amount: Number(baseAmountMeta ?? payload.amount ?? 0),
        final_amount: Number(finalAmountMeta ?? payload.amount ?? 0),
        method: paymentMethod,
        status: internalStatus,
        instructors_id: courseMeta.instructor_id || null,
        voucher_id: payload.metadata?.voucher_id ?? null,
        affiliate_code_id: payload.metadata?.affiliate_code_id ?? null,
      });
      if (insertRes.error) {
        console.error("webhook insert transaction error", insertRes.error);
      } else {
        console.log("webhook insert transaction SUCCESS");
      }
    } catch (e) {
      console.error("webhook insert transaction failed", e);
    }
  } else {
    console.log("updating existing transaction");
    const patch: {
      status: string;
      user_id?: string | null;
      course_id?: string | null;
      course_title?: string | null;
      instructors_id?: string | null;
      method?: string | null;
      final_amount?: number | null;
      voucher_id?: string | null;
      affiliate_code_id?: string | null;
    } = { status: internalStatus };
    if (!existingTx.user_id && parsedUser) patch.user_id = parsedUser;
    if (!existingTx.course_id && parsedCourse) patch.course_id = parsedCourse;
    if (!existingTx.course_title && courseMeta.title)
      patch.course_title = courseMeta.title;
    if (!existingTx.instructors_id && courseMeta.instructor_id)
      patch.instructors_id = courseMeta.instructor_id;
    // Always update method to latest payment channel if present
    if (paymentMethod) patch.method = paymentMethod;
    // CRITICAL: Only fill metadata fields if transaction is missing them
    // (pending insert should have already set voucher_id, amounts correctly)
    // Metadata from Xendit webhook may be empty/unreliable, so DON'T overwrite existing values
    const existingVoucherId = (existingTx as any)?.voucher_id;
    const existingAffiliateId = (existingTx as any)?.affiliate_code_id;
    const existingFinalAmount = (existingTx as any)?.final_amount;

    if (payload.metadata?.final_amount != null && !existingFinalAmount) {
      patch.final_amount = Number(payload.metadata.final_amount);
    }
    if (payload.metadata?.voucher_id && !existingVoucherId) {
      patch.voucher_id = String(payload.metadata.voucher_id);
    }
    if (payload.metadata?.affiliate_code_id && !existingAffiliateId) {
      patch.affiliate_code_id = String(payload.metadata.affiliate_code_id);
    }

    console.log("patch data:", patch);

    try {
      const updRes = await supabaseAdmin
        .from("transactions")
        .update(patch)
        .eq("id", invoiceId);
      if (updRes.error) {
        console.error("webhook update transaction error", updRes.error);
      } else {
        console.log("webhook update transaction SUCCESS");
      }
    } catch (e) {
      console.error("webhook update transaction failed", e);
    }
  }

  // If paid: auto-enroll (only if not yet enrolled) + kirim email sukses (best-effort)
  if (internalStatus === "completed") {
    console.log("status is completed, processing enrollment");
    let courseId: string | undefined = existingTx?.course_id || undefined;
    if (!courseId && parsedCourse) courseId = parsedCourse;

    // fetch transaction to get user + course + affiliate/voucher data if not derived
    const { data: trx } = await supabaseAdmin
      .from("transactions")
      .select(
        "user_id, course_id, affiliate_code_id, voucher_id, amount, final_amount"
      )
      .eq("id", invoiceId)
      .maybeSingle();

    const userId = trx?.user_id ?? payload.metadata?.user_id ?? undefined;
    const course =
      (trx?.course_id || courseId) ?? payload.metadata?.course_id ?? undefined;
    const affiliateCodeId =
      trx?.affiliate_code_id ??
      payload.metadata?.affiliate_code_id ??
      undefined;
    const voucherId =
      trx?.voucher_id ?? payload.metadata?.voucher_id ?? undefined;
    // Parse metadata amounts as numbers
    const totalAmount = Number(
      trx?.amount ?? payload.metadata?.base_amount ?? payload.amount ?? 0
    );
    const finalAmount = Number(
      trx?.final_amount ??
        payload.metadata?.final_amount ??
        payload.amount ??
        totalAmount
    );

    console.log("enrollment data - userId:", userId, "course:", course);

    if (userId && course) {
      // Process affiliate referral rewards if code was used
      if (affiliateCodeId) {
        console.log("processing affiliate rewards for code:", affiliateCodeId);
        try {
          // Get referrer ID from affiliate code
          const { data: codeData } = await supabaseAdmin
            .from("affiliate_codes")
            .select("user_id")
            .eq("id", affiliateCodeId)
            .single();

          if (codeData?.user_id) {
            const referrerId = codeData.user_id;

            // Check if referral already recorded
            const { data: existingReferral } = await supabaseAdmin
              .from("affiliate_referrals")
              .select("id")
              .eq("affiliate_code_id", affiliateCodeId)
              .eq("referred_user_id", userId)
              .eq("course_id", course)
              .eq("status", "purchased")
              .maybeSingle();

            if (!existingReferral) {
              // Insert referral record
              await supabaseAdmin.from("affiliate_referrals").insert({
                affiliate_code_id: affiliateCodeId,
                referrer_id: referrerId,
                referred_user_id: userId,
                course_id: course,
                reward_coins: 100,
                bonus_coins: 0,
                status: "purchased",
              });

              // Ensure referrer has students row before awarding rewards
              try {
                await supabaseAdmin
                  .from("students")
                  .upsert(
                    { user_id: referrerId, points: 0, coins: 0 },
                    { onConflict: "user_id" }
                  );
              } catch (upsertErr) {
                console.error("referrer students upsert failed", upsertErr);
              }

              // Award referrer 1000 points and 100 coins
              const { data: referrerStudent } = await supabaseAdmin
                .from("students")
                .select("points, coins, total_referral_points")
                .eq("user_id", referrerId)
                .single();

              if (referrerStudent) {
                const newPoints = (referrerStudent.points || 0) + 1000;
                const newCoins = (referrerStudent.coins || 0) + 100;
                const newRefPoints =
                  (referrerStudent.total_referral_points || 0) + 1000;

                const updateRes = await supabaseAdmin
                  .from("students")
                  .update({
                    points: newPoints,
                    coins: newCoins,
                    total_referral_points: newRefPoints,
                  })
                  .eq("user_id", referrerId);

                if (updateRes.error) {
                  console.error(
                    "affiliate reward update failed",
                    updateRes.error
                  );
                } else {
                  console.log(
                    `affiliate rewards awarded to referrer ${referrerId}: +1000 points, +100 coins (total: ${newPoints} points, ${newCoins} coins)`
                  );
                }
              } else {
                console.error("referrer student row not found after upsert");
              }
            } else {
              console.log("affiliate referral already processed");
            }
          }
        } catch (e) {
          console.error("affiliate processing failed", e);
        }
      }

      // Process voucher usage if voucher was used
      if (voucherId) {
        console.log("processing voucher usage for:", voucherId);
        try {
          // Check if already recorded
          const { data: existingUsage } = await supabaseAdmin
            .from("voucher_usages")
            .select("id")
            .eq("voucher_id", voucherId)
            .eq("user_id", userId)
            .eq("transaction_id", invoiceId)
            .maybeSingle();

          if (!existingUsage) {
            // Record voucher usage
            const discountApplied = totalAmount - finalAmount;
            await supabaseAdmin.from("voucher_usages").insert({
              voucher_id: voucherId,
              user_id: userId,
              transaction_id: invoiceId,
              discount_applied: discountApplied,
            });

            // Increment used_count HANYA SEKALI (karena idempotent check di atas)
            try {
              const rpcRes = await supabaseAdmin.rpc(
                "increment_voucher_usage",
                {
                  voucher_uuid: voucherId,
                }
              );
              if ((rpcRes as any).error) throw (rpcRes as any).error;
            } catch (rpcErr) {
              console.warn(
                "RPC increment_voucher_usage unavailable, falling back:",
                rpcErr
              );
              // Best-effort fallback increment (still safe due to existingUsage check above)
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
                  "voucher used_count fallback increment failed",
                  fallbackErr
                );
              }
            }

            console.log("voucher usage recorded and count incremented");
          } else {
            console.log("voucher usage already recorded, skipping increment");
          }
        } catch (e) {
          console.error("voucher processing failed", e);
        }
      }

      // Ambil meta user + course + role untuk email (non-blocking error)
      let userMeta: {
        email?: string | null;
        full_name?: string | null;
        role?: string | null;
      } = {};
      let courseTitle: string | null = null;
      try {
        const [{ data: u }, { data: c }] = await Promise.all([
          supabaseAdmin
            .from("users")
            .select("email,full_name,role")
            .eq("id", userId)
            .maybeSingle(),
          supabaseAdmin
            .from("courses")
            .select("title")
            .eq("id", course)
            .maybeSingle(),
        ]);
        if (u) userMeta = u;
        if (c) courseTitle = c.title || null;
      } catch (e) {
        console.log("email meta fetch failed", e);
      }

      const userRole = userMeta?.role || null;

      // check existing enrollment
      try {
        const { data: existing, error: enrollFetchErr } = await supabaseAdmin
          .from("enrollments")
          .select("id")
          .eq("user_id", userId)
          .eq("course_id", course)
          .maybeSingle();
        if (enrollFetchErr) {
          const code = (enrollFetchErr as { code?: string }).code;
          if (code === "PGRST205") {
            console.warn("enrollments table missing, skipping enrollment");
          } else {
            console.error("enrollment fetch error", enrollFetchErr);
          }
        } else if (!existing) {
          console.log("creating new enrollment");
          const enrollRes = await supabaseAdmin
            .from("enrollments")
            .insert({ user_id: userId, course_id: course });
          if (enrollRes.error) {
            console.error("webhook enroll insert error", enrollRes.error);
          } else {
            console.log("webhook enrollment SUCCESS");
          }
        } else {
          console.log("enrollment already exists");
        }
      } catch (e) {
        console.error("webhook enrollment block failed", e);
      }

      // Ensure progress row: school → school_progress, user/instructor/admin → user_progress
      // Compute expire_at based on course.access_duration_days if provided
      let computedExpireAt: string | null = null;
      let accessDaysVar: number | null = null;
      try {
        const { data: courseMeta } = await supabaseAdmin
          .from("courses")
          .select("access_duration_days")
          .eq("id", course)
          .maybeSingle();
        const accessDays = (courseMeta as any)?.access_duration_days as
          | number
          | null
          | undefined;
        if (accessDays && accessDays > 0) {
          accessDaysVar = Number(accessDays);
          const base = new Date();
          base.setDate(base.getDate() + accessDaysVar);
          computedExpireAt = base.toISOString();
        }
      } catch (e) {
        console.warn("Failed to compute expire_at from course meta", e);
      }

      try {
        const progressTable =
          userRole === "school" ? "school_progress" : "user_progress";
        console.log(`checking ${progressTable} for user ${userId}`);

        const { data: progress } = await supabaseAdmin
          .from(progressTable)
          .select("id, expire_at")
          .eq("user_id", userId)
          .eq("course_id", course)
          .maybeSingle();

        if (!progress) {
          console.log(`creating ${progressTable}`);
          const id = crypto.randomUUID();
          // Get first published module as starting current_module_id
          let firstModule: string | null = null;
          try {
            const { data: first } = await supabaseAdmin
              .from("modules")
              .select("id")
              .eq("course_id", course)
              .eq("is_published", true)
              .limit(1);
            if (first && first.length) firstModule = first[0].id;
          } catch {}

          const progressRes = await supabaseAdmin.from(progressTable).insert({
            id,
            user_id: userId,
            course_id: course,
            completed_modules: [],
            progress_percentage: 0,
            current_module_id: firstModule,
            expire_at: computedExpireAt,
          });
          if (progressRes.error) {
            console.error(
              `webhook ${progressTable} insert error`,
              progressRes.error
            );
          } else {
            console.log(`webhook ${progressTable} SUCCESS`);
          }
        } else {
          console.log(`${progressTable} already exists`);
          // If course grants limited access and we have accessDaysVar, extend expire_at
          try {
            if (accessDaysVar && accessDaysVar > 0) {
              const existingExpire = (progress as any)?.expire_at;
              const nowTs = Date.now();
              const existingTs = existingExpire ? Date.parse(existingExpire) : NaN;
              const baseTs = !isNaN(existingTs) && existingTs > nowTs ? existingTs : nowTs;
              const newDate = new Date(baseTs);
              newDate.setDate(newDate.getDate() + accessDaysVar);
              const newIso = newDate.toISOString();
              const { error: updErr } = await supabaseAdmin
                .from(progressTable)
                .update({ expire_at: newIso })
                .eq("id", (progress as any).id);
              if (updErr) {
                console.error(`Failed to extend expire_at for ${progressTable}:`, updErr);
              } else {
                console.log(`Extended expire_at to ${newIso} for ${progressTable}`);
              }
            }
          } catch (e) {
            console.error("Error while extending existing progress expire_at", e);
          }
        }
      } catch (e) {
        console.error("webhook progress insert failed", e);
      }

      // Kirim email sukses (tidak blokir proses)
      if (userMeta.email && courseTitle) {
        sendPurchaseResultEmail({
          to: userMeta.email,
          fullName: userMeta.full_name || "User",
          courseTitle: courseTitle,
          amount: payload.amount || 0,
          status: "completed",
        }).catch((e) => console.log("send purchase email failed", e));
      }
    } else {
      console.log("missing userId or course for enrollment:", {
        userId,
        course,
      });
    }
  } else {
    console.log("status not completed, skipping enrollment");
  }

  console.log("=== WEBHOOK COMPLETE ===");
  return NextResponse.json({ success: true });
}
