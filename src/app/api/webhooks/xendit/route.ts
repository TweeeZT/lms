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
  }
  let payload: XenditWebhookBody;
  try {
    payload = await req.json();
    console.log("webhook payload received:", JSON.stringify(payload, null, 2));
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
    .select("id, status, user_id, course_id, course_title, instructors_id")
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
      const insertRes = await supabaseAdmin.from("transactions").insert({
        id: invoiceId,
        date: new Date().toISOString(),
        user_id: parsedUser,
        user_name: derivedUserName,
        course_id: parsedCourse,
        course_title: courseMeta.title || null,
        amount: payload.amount || 0,
        method: paymentMethod,
        status: internalStatus,
        instructors_id: courseMeta.instructor_id || null,
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
    } = { status: internalStatus };
    if (!existingTx.user_id && parsedUser) patch.user_id = parsedUser;
    if (!existingTx.course_id && parsedCourse) patch.course_id = parsedCourse;
    if (!existingTx.course_title && courseMeta.title)
      patch.course_title = courseMeta.title;
    if (!existingTx.instructors_id && courseMeta.instructor_id)
      patch.instructors_id = courseMeta.instructor_id;
    // Always update method to latest payment channel if present
    if (paymentMethod) patch.method = paymentMethod;

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

    // fetch transaction to get user + course if not derived
    const { data: trx } = await supabaseAdmin
      .from("transactions")
      .select("user_id, course_id")
      .eq("id", invoiceId)
      .maybeSingle();

    const userId = trx?.user_id;
    const course = trx?.course_id || courseId;
    console.log("enrollment data - userId:", userId, "course:", course);

    if (userId && course) {
      // Ambil meta user + course untuk email (non-blocking error)
      let userMeta: { email?: string | null; full_name?: string | null } = {};
      let courseTitle: string | null = null;
      try {
        const [{ data: u }, { data: c }] = await Promise.all([
          supabaseAdmin
            .from("users")
            .select("email,full_name")
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
      // ensure user_progress row
      try {
        const { data: progress } = await supabaseAdmin
          .from("user_progress")
          .select("id")
          .eq("user_id", userId)
          .eq("course_id", course)
          .maybeSingle();
        if (!progress) {
          console.log("creating user_progress");
          const id = crypto.randomUUID();
          // Determine first published module (lowest order_index) as starting current_module_id
          let firstModule: string | null = null;
          try {
            const { data: first } = await supabaseAdmin
              .from("modules")
              .select("id, order_index")
              .eq("course_id", course)
              .eq("is_published", true)
              .order("order_index", { ascending: true })
              .limit(1);
            if (first && first.length) firstModule = first[0].id;
          } catch {}
          const progressRes = await supabaseAdmin.from("user_progress").insert({
            id,
            user_id: userId,
            course_id: course,
            completed_modules: [],
            progress_percentage: 0,
            current_module_id: firstModule,
          });
          if (progressRes.error) {
            console.error(
              "webhook user_progress insert error",
              progressRes.error
            );
          } else {
            console.log("webhook user_progress SUCCESS");
          }
        } else {
          console.log("user_progress already exists");
        }
      } catch (e) {
        console.error("webhook user_progress insert failed", e);
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
