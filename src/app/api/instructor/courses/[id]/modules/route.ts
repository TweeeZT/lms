import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/instructor/courses/[id]/modules?instructorId=...
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  const courseId = params.id;
  if (!instructorId) {
    return NextResponse.json(
      { success: false, error: "instructorId wajib" },
      { status: 400 }
    );
  }

  try {
    // Ensure ownership
    const { data: course, error: getErr } = await supabase
      .from("courses")
      .select("id, instructor_id")
      .eq("id", courseId)
      .maybeSingle();
    if (getErr) throw getErr;
    if (!course || course.instructor_id !== instructorId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Fetch modules and enrich with type-specific summary
    const { data: modules, error } = await supabase
      .from("modules")
      .select(
        "id, course_id, title, description, module_kind, order_index, is_published, created_at, updated_at"
      )
      .eq("course_id", courseId)
      .order("order_index", { ascending: true });
    if (error) throw error;

    return NextResponse.json({ success: true, items: modules || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat modul";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// Helper to upload a Blob to storage, returns { publicUrl, objectPath }
async function uploadToStorage(
  bucket: string,
  objectPath: string,
  file: Blob,
  contentType?: string
) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: contentType || "application/octet-stream",
    });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return { publicUrl: data.publicUrl, objectPath };
}

// POST /api/instructor/courses/[id]/modules
// Supports multipart (for materi+file) and JSON (for materi link/text, quiz, tugas)
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const courseId = params.id;
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  if (!instructorId) {
    return NextResponse.json(
      { success: false, error: "instructorId wajib" },
      { status: 400 }
    );
  }

  try {
    // Ensure ownership
    const { data: course, error: getErr } = await supabase
      .from("courses")
      .select("id, instructor_id")
      .eq("id", courseId)
      .maybeSingle();
    if (getErr) throw getErr;
    if (!course || course.instructor_id !== instructorId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const contentType = req.headers.get("content-type") || "";

    // Normalized inputs
    let title = "";
    let description: string | null = null;
    let module_kind: "materi" | "quiz" | "tugas" | "live" = "materi";
    let order_index = 0;
    let is_published = true;

    // Materi specifics
    let content_type: string | undefined; // 'video','pdf','ppt','image','link','file','text'
    let url: string | undefined;
    let text_content: string | undefined;
    let uploadFile: Blob | undefined;
    let filename: string | undefined;

    // Quiz specifics
    let quiz_title: string | undefined;
    let passing_score: number | undefined;
    let time_limit: number | undefined;
    let questions:
      | Array<{
          question: string;
          q_type: "multiple-choice" | "true-false" | "short-answer";
          options?: string[];
          correct: string; // store as string index or text
          explanation?: string;
        }>
      | undefined;

    // Tugas specifics
    let instructions: string | undefined;
    let due_date: string | undefined; // ISO
    let max_score: number | undefined;

    // Live session specifics
    let live_title: string | undefined;
    let live_agenda: string | undefined;
    let live_start_at: string | undefined; // ISO datetime

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      title = String(form.get("title") || "").trim();
      description = (form.get("description")?.toString() || "").trim() || null;
      const kindVal = (form.get("module_kind") as string) || "materi";
      if (
        kindVal === "materi" ||
        kindVal === "quiz" ||
        kindVal === "tugas" ||
        kindVal === "live"
      ) {
        module_kind = kindVal;
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
      // questions not supported via multipart in this first cut

      instructions = (form.get("instructions") as string) || undefined;
      due_date = (form.get("due_date") as string) || undefined;
      max_score = form.get("max_score")
        ? Number(form.get("max_score"))
        : undefined;
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
        const content = body.content as
          | { content_type?: string; url?: string; text_content?: string }
          | undefined;
        content_type = content?.content_type;
        url = content?.url;
        text_content = content?.text_content;
      } else if (module_kind === "quiz") {
        const quiz = body.quiz as
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
        quiz_title = quiz?.title;
        passing_score =
          quiz?.passing_score !== undefined
            ? Number(quiz.passing_score)
            : undefined;
        time_limit =
          quiz?.time_limit !== undefined ? Number(quiz.time_limit) : undefined;
        questions = Array.isArray(quiz?.questions)
          ? quiz!.questions
          : undefined;
      } else if (module_kind === "tugas") {
        const assignment = body.assignment as
          | {
              instructions?: string;
              due_date?: string;
              max_score?: number | string;
            }
          | undefined;
        instructions = assignment?.instructions;
        due_date = assignment?.due_date;
        max_score =
          assignment?.max_score !== undefined
            ? Number(assignment.max_score)
            : 100;
      } else if (module_kind === "live") {
        const live = body.live as
          | { title?: string; agenda?: string; start_at?: string }
          | undefined;
        live_title = live?.title?.trim();
        live_agenda = live?.agenda?.trim();
        live_start_at = live?.start_at;
      }
    }

    // Basic validation
    const missing: string[] = [];
    if (!title) missing.push("judul modul");
    if (!module_kind) missing.push("jenis modul");
    if (module_kind === "materi" && !content_type) missing.push("tipe konten");
    if (module_kind === "quiz" && !quiz_title) missing.push("judul kuis");
    if (module_kind === "tugas" && !instructions)
      missing.push("instruksi tugas");
    if (module_kind === "live") {
      if (!live_title) missing.push("judul sesi live");
      if (!live_agenda) missing.push("agenda");
      if (!live_start_at) missing.push("waktu mulai");
    }
    if (missing.length) {
      return NextResponse.json(
        { success: false, error: `Field wajib: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // Generate IDs
    const moduleId =
      globalThis?.crypto?.randomUUID?.() ||
      `mod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Insert module row first
    const { error: modErr } = await supabase.from("modules").insert({
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
          const { publicUrl, objectPath: p } = await uploadToStorage(
            "lessons-content",
            objectPath,
            uploadFile,
            ct
          );
          storedUrl = publicUrl;
          storedPath = p;
        }

        const { error: cErr } = await supabase.from("module_contents").insert({
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
        const { error: qErr } = await supabase.from("module_quizzes").insert({
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
          const { error: qqErr } = await supabase
            .from("module_quiz_questions")
            .insert(rows);
          if (qqErr) throw qqErr;
        }
      } else if (module_kind === "tugas") {
        const { error: aErr } = await supabase
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
        // Deterministic Jitsi room name: courseId + moduleId (sanitized)
        const roomSlug = `${courseId}-${moduleId}`
          .replace(/[^a-zA-Z0-9-_]/g, "-")
          .slice(0, 120);
        const join_url = `https://meet.jit.si/${roomSlug}`;
        // 'id' column in module_live_sessions is uuid; let DB default generate it.
        const { error: lErr } = await supabase
          .from("module_live_sessions")
          .insert({
            module_id: moduleId,
            title: live_title!,
            agenda: live_agenda!,
            start_at: live_start_at!,
            join_url,
            created_by: instructorId,
          });
        if (lErr) throw lErr;
      }
    } catch (innerErr: unknown) {
      // Rollback module on any failure
      try {
        await supabase.from("modules").delete().eq("id", moduleId);
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
    const message = err instanceof Error ? err.message : "Gagal membuat modul";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
