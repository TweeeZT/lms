/* Admin modules route */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseServer";

// NOTE: This admin route is extended to fully persist module detail rows
// (content, quiz + questions, assignment, live) similar to instructor route.
// Supports both JSON and multipart (for materi + file upload) payloads.

async function requireAdmin(userId: string) {
  if (!userId) return { ok: false, error: "userId required" } as const;
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data || data.role !== "admin") {
    return { ok: false, error: "Forbidden" } as const;
  }
  return { ok: true, user: data } as const;
}

// GET list modules
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(req.url);
  const actorId = (searchParams.get("userId") || "").trim();
  const auth = await requireAdmin(actorId);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.error === "Forbidden" ? 403 : 400 }
    );
  }
  const { id: courseId } = await context.params;
  try {
    const { data: course, error: cErr } = await supabaseAdmin
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!course)
      return NextResponse.json(
        { success: false, error: "Course not found" },
        { status: 404 }
      );
    const { data, error } = await supabaseAdmin
      .from("modules")
      .select(
        "id, course_id, title, description, module_kind, order_index, is_published, created_at, updated_at"
      )
      .eq("course_id", courseId)
      .order("order_index", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ success: true, items: data || [] });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}

// POST create module
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await context.params;
  const { searchParams } = new URL(req.url);
  const actorId = (searchParams.get("userId") || "").trim();
  const debugMode = searchParams.get("debug") === "1";
  const auth = await requireAdmin(actorId);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.error === "Forbidden" ? 403 : 400 }
    );
  }

  // helper
  const extractPgError = (e: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = e as any;
    return {
      error_code: typeof obj?.code === "string" ? obj.code : undefined,
      error_details: typeof obj?.details === "string" ? obj.details : undefined,
      error_hint: typeof obj?.hint === "string" ? obj.hint : undefined,
    };
  };

  try {
    const { data: course, error: cErr } = await supabaseAdmin
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!course)
      return NextResponse.json(
        { success: false, error: "Course not found" },
        { status: 404 }
      );

    const contentTypeHeader = req.headers.get("content-type") || "";

    // Normalized core fields
    let title = "";
    let description: string | null = null;
    let module_kind: "materi" | "quiz" | "tugas" | "live" = "materi";
    let order_index = 0;
    let is_published = true;

    // Materi
    let content_type: string | undefined;
    let url: string | undefined;
    let text_content: string | undefined;
    let uploadFile: Blob | undefined;
    let filename: string | undefined;

    // Quiz
    let quiz_title: string | undefined;
    let passing_score: number | undefined;
    let time_limit: number | undefined;
    let questions:
      | Array<{
          question: string;
          q_type: "multiple-choice" | "true-false" | "short-answer";
          options?: string[];
          correct: string;
          explanation?: string;
        }>
      | undefined;

    // Assignment
    let instructions: string | undefined;
    let due_date: string | undefined;
    let max_score: number | undefined;

    // Live
    let live_agenda: string | undefined;
    let live_start_at: string | undefined;
    let live_duration_min: number | undefined; // new: must satisfy check constraint (> 0)
    let live_join_url: string | undefined;
    let live_passcode: string | undefined;

    if (contentTypeHeader.includes("multipart/form-data")) {
      const form = await req.formData();
      title = (form.get("title") as string)?.trim() || "";
      description = ((form.get("description") as string) || "").trim() || null;
      const mkRaw = form.get("module_kind");
      if (
        mkRaw === "materi" ||
        mkRaw === "quiz" ||
        mkRaw === "tugas" ||
        mkRaw === "live"
      ) {
        module_kind = mkRaw;
      } else {
        module_kind = "materi";
      }
      order_index = Number(form.get("order_index") || 0);
      is_published = String(form.get("is_published") || "true") === "true";
      if (module_kind === "materi") {
        content_type = (form.get("content_type") as string) || undefined;
        url = (form.get("url") as string) || undefined;
        text_content = (form.get("text_content") as string) || undefined;
        const f = form.get("file");
        if (f instanceof Blob) {
          uploadFile = f;
          filename =
            (form.get("filename") as string) ||
            ("name" in f ? (f as File).name : "upload.bin");
        }
      } else if (module_kind === "quiz") {
        quiz_title = (form.get("quiz_title") as string) || undefined;
        passing_score = form.get("passing_score")
          ? Number(form.get("passing_score"))
          : undefined;
        time_limit = form.get("time_limit")
          ? Number(form.get("time_limit"))
          : undefined;
        const qsRaw = form.get("questions") as string;
        if (qsRaw) {
          try {
            const parsed = JSON.parse(qsRaw);
            if (Array.isArray(parsed)) questions = parsed;
          } catch {}
        }
      } else if (module_kind === "tugas") {
        instructions = (form.get("instructions") as string) || undefined;
        due_date = (form.get("due_date") as string) || undefined;
        max_score = form.get("max_score") ? Number(form.get("max_score")) : 100;
      } else if (module_kind === "live") {
        live_agenda = (form.get("live_agenda") as string)?.trim();
        live_start_at = (form.get("live_start_at") as string) || undefined;
        if (form.get("live_duration_min")) {
          const v = Number(form.get("live_duration_min"));
          if (Number.isFinite(v) && v > 0) live_duration_min = v;
        }
        live_join_url = (form.get("live_join_url") as string) || undefined;
        live_passcode = (form.get("live_passcode") as string) || undefined;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      title = (body.title || "").trim();
      description = (body.description || "").trim() || null;
      module_kind = body.module_kind || "materi";
      order_index = Number(body.order_index || 0);
      is_published = body.is_published !== false;
      if (module_kind === "materi") {
        const c = body.content || {};
        content_type = c.content_type;
        url = c.url;
        text_content = c.text_content;
      } else if (module_kind === "quiz") {
        const q = body.quiz || {};
        quiz_title = q.title;
        if (q.passing_score !== undefined)
          passing_score = Number(q.passing_score);
        if (q.time_limit !== undefined) time_limit = Number(q.time_limit);
        if (Array.isArray(q.questions)) questions = q.questions;
      } else if (module_kind === "tugas") {
        const a = body.assignment || {};
        instructions = a.instructions;
        due_date = a.due_date;
        if (a.max_score !== undefined) max_score = Number(a.max_score);
      } else if (module_kind === "live") {
        const l = body.live || {};
        live_agenda = l.agenda?.trim();
        live_start_at = l.start_at;
        if (l.duration_min !== undefined) {
          const v = Number(l.duration_min);
          if (Number.isFinite(v) && v > 0) live_duration_min = v;
        }
        live_join_url = l.join_url;
        live_passcode = l.passcode;
      }
    }

    // validation
    const missing: string[] = [];
    if (!title) missing.push("judul modul");
    if (module_kind === "materi" && !content_type) missing.push("tipe konten");
    if (module_kind === "quiz" && !quiz_title) missing.push("judul kuis");
    if (module_kind === "tugas" && !instructions)
      missing.push("instruksi tugas");
    if (module_kind === "live") {
      if (!live_agenda) missing.push("agenda");
      if (!live_start_at) missing.push("waktu mulai");
      if (!live_join_url) missing.push("link live");
      if (!live_duration_min) live_duration_min = 60; // default
    }
    if (missing.length) {
      return NextResponse.json(
        { success: false, error: `Field wajib: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // order_index normalization / collision resolution
    if (order_index < 0 || !Number.isFinite(order_index)) order_index = 0;
    const { data: existingSameOrder } = await supabaseAdmin
      .from("modules")
      .select("order_index")
      .eq("course_id", courseId)
      .eq("order_index", order_index)
      .limit(1);
    if (existingSameOrder && existingSameOrder.length) {
      const { data: allOrders } = await supabaseAdmin
        .from("modules")
        .select("order_index")
        .eq("course_id", courseId);
      const maxOrder = (allOrders || []).reduce(
        (m, r) =>
          typeof r.order_index === "number" && r.order_index > m
            ? r.order_index
            : m,
        0
      );
      order_index = maxOrder + 1;
    }

    // insert module
    const moduleId =
      globalThis?.crypto?.randomUUID?.() ||
      `mod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { error: modErr } = await supabaseAdmin.from("modules").insert({
      id: moduleId,
      course_id: courseId,
      title,
      description,
      module_kind,
      order_index,
      is_published,
    });
    if (modErr) {
      const meta = extractPgError(modErr);
      return NextResponse.json(
        {
          success: false,
          error: modErr.message,
          ...meta,
          ...(debugMode && {
            debug: {
              stage: "insert-module",
              module_kind,
              payload: { title, description, order_index, is_published },
            },
          }),
        },
        { status: 400 }
      );
    }

    try {
      if (module_kind === "materi") {
        let storedUrl: string | undefined;
        let storedPath: string | undefined;
        if (uploadFile) {
          const ct = uploadFile.type || "application/octet-stream";
          const ext =
            filename && filename.includes(".")
              ? filename.split(".").pop()!
              : ct.split("/").pop() || "bin";
          const objectPath = `courses/${courseId}/modules/${moduleId}/${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}.${ext}`;
          const { error: upErr } = await supabaseAdmin.storage
            .from("lessons-content")
            .upload(objectPath, uploadFile, {
              cacheControl: "3600",
              upsert: false,
              contentType: ct,
            });
          if (upErr) throw upErr;
          const { data: pubUrl } = supabaseAdmin.storage
            .from("lessons-content")
            .getPublicUrl(objectPath);
          storedUrl = pubUrl.publicUrl;
          storedPath = objectPath;
        }
        const { error: cErr } = await supabaseAdmin
          .from("module_contents")
          .insert({
            id:
              globalThis?.crypto?.randomUUID?.() ||
              `mc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            module_id: moduleId,
            content_type: content_type!,
            url: url || storedUrl,
            file_path: storedPath,
            text_content: text_content,
          });
        if (cErr) throw cErr;
      } else if (module_kind === "quiz") {
        const quizId =
          globalThis?.crypto?.randomUUID?.() ||
          `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { error: qErr } = await supabaseAdmin
          .from("module_quizzes")
          .insert({
            id: quizId,
            module_id: moduleId,
            title: quiz_title!,
            passing_score: Number(passing_score ?? 0),
            time_limit: time_limit ?? null,
          });
        if (qErr) throw qErr;
        if (questions?.length) {
          const rows = questions.map((q) => ({
            id:
              globalThis?.crypto?.randomUUID?.() ||
              `qq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            quiz_id: quizId,
            question: q.question,
            q_type: q.q_type,
            options_json: q.options ? JSON.stringify(q.options) : null,
            correct: q.correct,
            explanation: q.explanation || null,
          }));
          const { error: qqErr } = await supabaseAdmin
            .from("module_quiz_questions")
            .insert(rows);
          if (qqErr) throw qqErr;
        }
      } else if (module_kind === "tugas") {
        const { error: aErr } = await supabaseAdmin
          .from("module_assignments")
          .insert({
            id:
              globalThis?.crypto?.randomUUID?.() ||
              `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            module_id: moduleId,
            instructions: instructions!,
            due_date: due_date || null,
            max_score: max_score ?? 100,
          });
        if (aErr) throw aErr;
      } else if (module_kind === "live") {
        const providedJoin = live_join_url && String(live_join_url).trim();
        if (!providedJoin) {
          return NextResponse.json(
            { success: false, error: "Link live (join_url) wajib diisi" },
            { status: 400 }
          );
        }
        const passcodeVal = live_passcode ? String(live_passcode).trim() : null;
        const { error: lErr } = await supabaseAdmin
          .from("module_live_sessions")
          .insert({
            module_id: moduleId,
            agenda: live_agenda!,
            start_at: live_start_at!,
            join_url: providedJoin,
            duration_min: live_duration_min!,
            passcode: passcodeVal || null,
            created_by: actorId,
          });
        if (lErr) throw lErr;
      }
    } catch (detailErr) {
      try {
        await supabaseAdmin.from("modules").delete().eq("id", moduleId);
      } catch {}
      const meta = {
        ...extractPgError(detailErr),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        constraint: (detailErr as any)?.constraint,
        message: detailErr instanceof Error ? detailErr.message : undefined,
      };
      return NextResponse.json(
        {
          success: false,
          error:
            detailErr instanceof Error
              ? detailErr.message
              : "Gagal membuat modul",
          ...meta,
          ...(debugMode && {
            debug: {
              stage: "post-insert-detail",
              module_kind,
              raw_error: detailErr,
            },
          }),
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      id: moduleId,
      ...(debugMode && {
        debug: {
          stage: "done",
          module_kind,
          hasDetail: module_kind !== "materi" ? true : !!content_type,
          order_index,
        },
      }),
    });
  } catch (outerErr) {
    const meta = extractPgError(outerErr);
    return NextResponse.json(
      {
        success: false,
        error:
          outerErr instanceof Error ? outerErr.message : "Gagal membuat modul",
        ...meta,
        ...(debugMode && {
          debug: { stage: "outer-catch", raw_error: outerErr },
        }),
      },
      { status: 500 }
    );
  }
}
