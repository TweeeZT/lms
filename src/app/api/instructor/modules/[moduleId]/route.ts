import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/instructor/modules/[moduleId]?instructorId=...
export async function GET(
  req: Request,
  { params }: { params: { moduleId: string } }
) {
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  const moduleId = params.moduleId;
  if (!instructorId) {
    return NextResponse.json(
      { success: false, error: "instructorId wajib" },
      { status: 400 }
    );
  }
  try {
    // Load module and ensure ownership via course
    const { data: mod, error: mErr } = await supabase
      .from("modules")
      .select(
        "id, course_id, title, description, module_kind, order_index, is_published"
      )
      .eq("id", moduleId)
      .maybeSingle();
    if (mErr) throw mErr;
    if (!mod)
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );

    const { data: course, error: cErr } = await supabase
      .from("courses")
      .select("id, instructor_id")
      .eq("id", mod.course_id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!course || course.instructor_id !== instructorId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Attach detail
    let detail: unknown = null;
    if (mod.module_kind === "materi") {
      const { data } = await supabase
        .from("module_contents")
        .select("id, content_type, url, file_path, text_content, created_at")
        .eq("module_id", moduleId)
        .order("created_at", { ascending: true });
      detail = data || [];
    } else if (mod.module_kind === "quiz") {
      const { data: quiz } = await supabase
        .from("module_quizzes")
        .select("id, title, passing_score, time_limit")
        .eq("module_id", moduleId)
        .maybeSingle();
      if (quiz) {
        const { data: qs } = await supabase
          .from("module_quiz_questions")
          .select("id, question, q_type, options_json, correct, explanation")
          .eq("quiz_id", quiz.id);
        detail = { ...quiz, questions: qs || [] };
      }
    } else if (mod.module_kind === "tugas") {
      const { data: a } = await supabase
        .from("module_assignments")
        .select("id, instructions, due_date, max_score, created_at")
        .eq("module_id", moduleId)
        .maybeSingle();
      detail = a || null;
    }

    return NextResponse.json({ success: true, item: mod, detail });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat modul";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// PATCH /api/instructor/modules/[moduleId]?instructorId=...
export async function PATCH(
  req: Request,
  { params }: { params: { moduleId: string } }
) {
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  const moduleId = params.moduleId;
  if (!instructorId) {
    return NextResponse.json(
      { success: false, error: "instructorId wajib" },
      { status: 400 }
    );
  }

  try {
    // Load module and ensure ownership
    const { data: mod, error: mErr } = await supabase
      .from("modules")
      .select("id, course_id, module_kind")
      .eq("id", moduleId)
      .maybeSingle();
    if (mErr) throw mErr;
    if (!mod)
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );
    const { data: course, error: cErr } = await supabase
      .from("courses")
      .select("id, instructor_id")
      .eq("id", mod.course_id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!course || course.instructor_id !== instructorId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    const allowed: Record<string, unknown> = {};
    let newFilePath: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const title = String(form.get("title") || "").trim();
      const description = (form.get("description")?.toString() || "").trim();
      const order_index = Number(form.get("order_index") || 0);
      const is_published =
        String(form.get("is_published") || "true") === "true";
      if (title) allowed.title = title;
      if (description) allowed.description = description;
      if (!Number.isNaN(order_index)) allowed.order_index = order_index;
      allowed.is_published = is_published;

      // For materi file replacement
      const f = form.get("file");
      const content_type = (form.get("content_type") as string) || undefined;
      const url = (form.get("url") as string) || undefined;
      const text_content = (form.get("text_content") as string) || undefined;
      const filename = (form.get("filename") as string) || "file";
      if (
        mod.module_kind === "materi" &&
        (f instanceof Blob || url || text_content)
      ) {
        if (f && f instanceof Blob) {
          const ct = f.type || "application/octet-stream";
          const ext = filename.includes(".")
            ? filename.split(".").pop()!
            : ct.split("/").pop() || "bin";
          const objectPath = `courses/${
            mod.course_id
          }/modules/${moduleId}/${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}.${ext}`;
          const { error } = await supabase.storage
            .from("lessons-content")
            .upload(objectPath, f, {
              cacheControl: "3600",
              upsert: false,
              contentType: ct,
            });
          if (error) {
            const status = /row-level security/i.test(error.message)
              ? 403
              : 400;
            return NextResponse.json(
              { success: false, error: error.message },
              { status }
            );
          }
          newFilePath = objectPath;
        }
        // Insert new content row and delete old ones
        // Delete existing contents first
        const { data: oldContents } = await supabase
          .from("module_contents")
          .select("id, file_path")
          .eq("module_id", moduleId);
        if (oldContents?.length) {
          const ids = oldContents.map((c) => c.id);
          await supabase.from("module_contents").delete().in("id", ids);
          // delete files
          const paths = oldContents
            .map((c) => c.file_path)
            .filter(Boolean) as string[];
          if (paths.length) {
            await supabase.storage.from("lessons-content").remove(paths);
          }
        }
        const { error: insErr } = await supabase
          .from("module_contents")
          .insert({
            id:
              globalThis?.crypto?.randomUUID?.() ||
              `mc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            module_id: moduleId,
            content_type: content_type || (f ? "file" : url ? "link" : "text"),
            url:
              url ||
              (newFilePath
                ? supabase.storage
                    .from("lessons-content")
                    .getPublicUrl(newFilePath).data.publicUrl
                : null),
            file_path: newFilePath || null,
            text_content: text_content || null,
          });
        if (insErr) {
          // cleanup uploaded file
          if (newFilePath) {
            try {
              await supabase.storage
                .from("lessons-content")
                .remove([newFilePath]);
            } catch {}
          }
          return NextResponse.json(
            { success: false, error: insErr.message },
            { status: 400 }
          );
        }
      }
    } else {
      const body = (await req.json()) as Record<string, unknown>;
      const fields = [
        "title",
        "description",
        "order_index",
        "is_published",
      ] as const;
      for (const f of fields) {
        if (Object.prototype.hasOwnProperty.call(body, f)) {
          allowed[f] = body[f] as unknown;
        }
      }
      if (
        mod.module_kind === "quiz" &&
        Object.prototype.hasOwnProperty.call(body, "quiz")
      ) {
        // Replace quiz and questions
        const quiz = body.quiz as {
          title?: string;
          passing_score?: number | string;
          time_limit?: number | string;
          questions?: Array<{
            question: string;
            q_type: "multiple-choice" | "true-false" | "short-answer";
            options?: string[];
            correct: string | number;
            explanation?: string;
          }>;
        };
        const { data: old } = await supabase
          .from("module_quizzes")
          .select("id")
          .eq("module_id", moduleId)
          .maybeSingle();
        if (old) {
          await supabase
            .from("module_quiz_questions")
            .delete()
            .eq("quiz_id", old.id);
          await supabase.from("module_quizzes").delete().eq("id", old.id);
        }
        const quizId =
          globalThis?.crypto?.randomUUID?.() ||
          `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { error: qErr } = await supabase.from("module_quizzes").insert({
          id: quizId,
          module_id: moduleId,
          title: quiz?.title || "",
          passing_score: Number(quiz?.passing_score || 0),
          time_limit: quiz?.time_limit ? Number(quiz.time_limit) : null,
        });
        if (qErr)
          return NextResponse.json(
            { success: false, error: qErr.message },
            { status: 400 }
          );
        if (Array.isArray(quiz?.questions) && quiz.questions.length) {
          const rows = quiz.questions.map((q) => ({
            id:
              globalThis?.crypto?.randomUUID?.() ||
              `qq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            quiz_id: quizId,
            question: q.question,
            q_type: q.q_type,
            options_json: q.options ? JSON.stringify(q.options) : null,
            correct: String(q.correct),
            explanation: q.explanation || null,
          }));
          const { error: qqErr } = await supabase
            .from("module_quiz_questions")
            .insert(rows);
          if (qqErr)
            return NextResponse.json(
              { success: false, error: qqErr.message },
              { status: 400 }
            );
        }
      }
      if (
        mod.module_kind === "tugas" &&
        Object.prototype.hasOwnProperty.call(body, "assignment")
      ) {
        const a = body.assignment as {
          instructions?: string;
          due_date?: string;
          max_score?: number | string;
        };
        // Replace assignment
        await supabase
          .from("module_assignments")
          .delete()
          .eq("module_id", moduleId);
        const { error: aErr } = await supabase
          .from("module_assignments")
          .insert({
            id:
              globalThis?.crypto?.randomUUID?.() ||
              `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            module_id: moduleId,
            instructions: a?.instructions || "",
            due_date: a?.due_date || null,
            max_score: a?.max_score ? Number(a.max_score) : 100,
          });
        if (aErr)
          return NextResponse.json(
            { success: false, error: aErr.message },
            { status: 400 }
          );
      }
    }

    if (Object.keys(allowed).length) {
      const { error: uErr } = await supabase
        .from("modules")
        .update(allowed)
        .eq("id", moduleId);
      if (uErr)
        return NextResponse.json(
          { success: false, error: uErr.message },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal mengupdate modul";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// DELETE /api/instructor/modules/[moduleId]?instructorId=...
export async function DELETE(
  req: Request,
  { params }: { params: { moduleId: string } }
) {
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  const moduleId = params.moduleId;
  if (!instructorId) {
    return NextResponse.json(
      { success: false, error: "instructorId wajib" },
      { status: 400 }
    );
  }
  try {
    // Load module and ensure ownership
    const { data: mod, error: mErr } = await supabase
      .from("modules")
      .select("id, course_id, module_kind")
      .eq("id", moduleId)
      .maybeSingle();
    if (mErr) throw mErr;
    if (!mod)
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );
    const { data: course, error: cErr } = await supabase
      .from("courses")
      .select("id, instructor_id")
      .eq("id", mod.course_id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!course || course.instructor_id !== instructorId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Gather storage paths to delete (materi only)
    let paths: string[] = [];
    if (mod.module_kind === "materi") {
      const { data: contents } = await supabase
        .from("module_contents")
        .select("file_path")
        .eq("module_id", moduleId);
      paths = (contents || [])
        .map((c) => c.file_path)
        .filter(Boolean) as string[];
    }

    // Delete module (cascade takes care of children if FK set ON DELETE CASCADE)
    const { error } = await supabase
      .from("modules")
      .delete()
      .eq("id", moduleId);
    if (error) throw error;

    if (paths.length) {
      try {
        await supabase.storage.from("lessons-content").remove(paths);
      } catch {}
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal menghapus modul";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
