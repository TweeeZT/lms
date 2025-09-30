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

// GET /api/admin/courses/[id]/modules?userId=<admin>
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
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
  const courseId = params.id;
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST create module (full persistence)
// JSON body variants:
//  - materi: { title, description, module_kind:"materi", order_index, is_published, content: { content_type, url?, text_content? } }
//  - quiz:   { title, module_kind:"quiz", quiz: { title, passing_score, time_limit?, questions:[{question,q_type,options?,correct,explanation?}] } }
//  - tugas:  { title, module_kind:"tugas", assignment: { instructions, due_date?, max_score? } }
//  - live:   { title, module_kind:"live", live: { title, agenda, start_at } }
// Multipart (content-type includes multipart/form-data) is only required when uploading a file for materi. Fields mirror instructor implementation.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
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
  const courseId = params.id;
  try {
    // Ensure course exists
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

    const contentType = req.headers.get("content-type") || "";

    // Normalized fields
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
    let live_title: string | undefined;
    let live_agenda: string | undefined;
    let live_start_at: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      title = String(form.get("title") || "").trim();
      description = (form.get("description")?.toString() || "").trim() || null;
      const kindVal = (form.get("module_kind") as string) || "materi";
      if (["materi", "quiz", "tugas", "live"].includes(kindVal)) {
        module_kind = kindVal as typeof module_kind;
      }
      order_index = Number(form.get("order_index") || 0);
      is_published = String(form.get("is_published") || "true") === "true";

      content_type = (form.get("content_type") as string) || undefined;
      url = (form.get("url") as string) || undefined;
      text_content = (form.get("text_content") as string) || undefined;
      const f = form.get("file");
      if (f && f instanceof Blob) {
        uploadFile = f;
        filename = (form.get("filename") as string) || "file";
      }

      quiz_title = (form.get("quiz_title") as string) || undefined;
      passing_score = form.get("passing_score")
        ? Number(form.get("passing_score"))
        : undefined;
      time_limit = form.get("time_limit")
        ? Number(form.get("time_limit"))
        : undefined;
      // questions excluded via multipart (limitation)

      instructions = (form.get("instructions") as string) || undefined;
      due_date = (form.get("due_date") as string) || undefined;
      max_score = form.get("max_score")
        ? Number(form.get("max_score"))
        : undefined;

      live_title = (form.get("live_title") as string) || undefined;
      live_agenda = (form.get("live_agenda") as string) || undefined;
      live_start_at = (form.get("live_start_at") as string) || undefined;
    } else {
      const body = (await req.json()) as Record<string, unknown>;
      title = String(body.title || "").trim();
      description =
        (body.description ? String(body.description) : "").trim() || null;
      const mk = body.module_kind as string | undefined;
      if (mk === "materi" || mk === "quiz" || mk === "tugas" || mk === "live")
        module_kind = mk;
      order_index = Number(body.order_index || 0);
      is_published = Boolean(
        typeof body.is_published === "boolean" ? body.is_published : true
      );

      if (module_kind === "materi") {
        const c = body.content as
          | { content_type?: string; url?: string; text_content?: string }
          | undefined;
        content_type = c?.content_type;
        url = c?.url;
        text_content = c?.text_content;
      } else if (module_kind === "quiz") {
        const q = body.quiz as
          | {
              title?: string;
              passing_score?: number | string;
              time_limit?: number | string;
              questions?: Array<{
                question: string;
                q_type: "multiple-choice" | "true-false" | "short-answer";
                options?: string[];
                correct: string;
                explanation?: string;
              }>;
            }
          | undefined;
        quiz_title = q?.title;
        passing_score =
          q?.passing_score !== undefined ? Number(q.passing_score) : undefined;
        time_limit =
          q?.time_limit !== undefined ? Number(q.time_limit) : undefined;
        questions = Array.isArray(q?.questions) ? q!.questions : undefined;
      } else if (module_kind === "tugas") {
        const a = body.assignment as
          | {
              instructions?: string;
              due_date?: string;
              max_score?: number | string;
            }
          | undefined;
        instructions = a?.instructions;
        due_date = a?.due_date;
        max_score = a?.max_score !== undefined ? Number(a.max_score) : 100;
      } else if (module_kind === "live") {
        const l = body.live as
          | { title?: string; agenda?: string; start_at?: string }
          | undefined;
        live_title = l?.title?.trim();
        live_agenda = l?.agenda?.trim();
        live_start_at = l?.start_at;
      }
    }

    // Validation
    const missing: string[] = [];
    if (!title) missing.push("judul modul");
    if (!module_kind) missing.push("jenis modul");
    if (module_kind === "materi" && !content_type) missing.push("tipe konten");
    if (module_kind === "quiz" && !quiz_title) missing.push("judul kuis");
    if (module_kind === "tugas" && !instructions)
      missing.push("instruksi tugas");
    if (module_kind === "live") {
      if (!live_title) missing.push("judul live");
      if (!live_agenda) missing.push("agenda");
      if (!live_start_at) missing.push("waktu mulai");
    }
    if (missing.length) {
      return NextResponse.json(
        { success: false, error: `Field wajib: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // Insert module
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
      return NextResponse.json(
        { success: false, error: modErr.message },
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
        const roomSlug = `${courseId}-${moduleId}`
          .replace(/[^a-zA-Z0-9-_]/g, "-")
          .slice(0, 120);
        const join_url = `https://meet.jit.si/${roomSlug}`;
        const { error: lErr } = await supabaseAdmin
          .from("module_live_sessions")
          .insert({
            id:
              globalThis?.crypto?.randomUUID?.() ||
              `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            module_id: moduleId,
            title: live_title!,
            agenda: live_agenda!,
            start_at: live_start_at!,
            join_url,
            created_by: actorId,
          });
        if (lErr) throw lErr;
      }
    } catch (innerErr: unknown) {
      // rollback module
      try {
        await supabaseAdmin.from("modules").delete().eq("id", moduleId);
      } catch {}
      return NextResponse.json(
        {
          success: false,
          error:
            innerErr instanceof Error
              ? innerErr.message
              : "Gagal membuat modul",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, id: moduleId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
