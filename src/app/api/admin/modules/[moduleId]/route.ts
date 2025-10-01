/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseServer";

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

async function fetchModule(moduleId: string) {
  // Base module
  const { data: mod, error: modErr } = await supabaseAdmin
    .from("modules")
    .select(
      "id, course_id, title, description, module_kind, order_index, is_published, created_at, updated_at"
    )
    .eq("id", moduleId)
    .maybeSingle();
  if (modErr) throw modErr;
  if (!mod) return null;

  // Attach detail depending on kind
  if (mod.module_kind === "materi") {
    const { data: contentRow } = await supabaseAdmin
      .from("module_contents")
      .select("content_type, url, file_path, text_content")
      .eq("module_id", moduleId)
      .maybeSingle();
    return { ...mod, content: contentRow || null };
  }
  if (mod.module_kind === "quiz") {
    const { data: quizRow } = await supabaseAdmin
      .from("module_quizzes")
      .select("id, title, passing_score, time_limit")
      .eq("module_id", moduleId)
      .maybeSingle();
    const { data: questions } = await supabaseAdmin
      .from("module_quiz_questions")
      .select("id, question, q_type, options_json, correct, explanation")
      .eq("quiz_id", quizRow?.id || "")
      .order("created_at", { ascending: true });
    return {
      ...mod,
      quiz: quizRow
        ? {
            ...quizRow,
            questions: (questions || []).map((q) => ({
              id: q.id,
              question: q.question,
              q_type: q.q_type,
              options: q.options_json ? JSON.parse(q.options_json) : [],
              correct: q.correct,
              explanation: q.explanation,
            })),
          }
        : null,
    };
  }
  if (mod.module_kind === "tugas") {
    const { data: assignRow } = await supabaseAdmin
      .from("module_assignments")
      .select("id, instructions, due_date, max_score")
      .eq("module_id", moduleId)
      .maybeSingle();
    return { ...mod, assignment: assignRow || null };
  }
  if (mod.module_kind === "live") {
    const { data: liveRow } = await supabaseAdmin
      .from("module_live_sessions")
      .select(
        // Select only existing columns; removed non-existent reminder_minutes & actual_end_at
        "id, agenda, start_at, duration_min, join_url, passcode, status, time_zone, recording_url, created_by, created_at, updated_at"
      )
      .eq("module_id", moduleId)
      .maybeSingle();
    return { ...mod, live: liveRow || null };
  }
  return mod;
}

// GET single module
export async function GET(
  req: NextRequest,
  { params }: { params: { moduleId: string } }
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
  try {
    const modData = await fetchModule(params.moduleId);
    if (!modData)
      return NextResponse.json(
        { success: false, error: "Module not found" },
        { status: 404 }
      );
    return NextResponse.json({ success: true, item: modData });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PATCH update based on kind.
// Common: title, description, order_index, is_published
// Materi: content (content_type/url/text_content not implemented for edit here)
// Quiz: quiz (title, passing_score, time_limit, questions[])
// Tugas: assignment (instructions, due_date, max_score)
// Live: live (title, agenda, start_at, duration_min, status)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { moduleId: string } }
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
  try {
    const existing = await fetchModule(params.moduleId);
    if (!existing)
      return NextResponse.json(
        { success: false, error: "Module not found" },
        { status: 404 }
      );

    const body = await req.json().catch(() => ({}));
    const baseUpdate: Record<string, unknown> = {};
    if ("title" in body) baseUpdate.title = body.title;
    if ("description" in body) baseUpdate.description = body.description;
    if ("order_index" in body) baseUpdate.order_index = body.order_index;
    if ("is_published" in body) baseUpdate.is_published = body.is_published;

    if (Object.keys(baseUpdate).length) {
      const { error: modUpErr } = await supabaseAdmin
        .from("modules")
        .update(baseUpdate)
        .eq("id", existing.id);
      if (modUpErr) throw modUpErr;
    }

    if (existing.module_kind === "live") {
      // Support legacy nested body.live AND new flat snake_case fields
      let hasLive = false;
      let agenda: string | undefined;
      let start_at: string | undefined;
      let join_url: string | undefined;
      let passcode: string | null | undefined;
      if (body.live) {
        const l = body.live as Record<string, unknown>;
        hasLive = true;
        if (typeof l.agenda === "string") agenda = l.agenda;
        if (typeof l.start_at === "string") start_at = l.start_at;
        if (typeof l.join_url === "string") join_url = l.join_url;
        if (typeof l.passcode === "string") passcode = l.passcode || null;
      }
      if (Object.prototype.hasOwnProperty.call(body, "live_agenda")) {
        hasLive = true;
        agenda = (body.live_agenda as string | undefined) ?? agenda;
      }
      if (Object.prototype.hasOwnProperty.call(body, "live_start_at")) {
        hasLive = true;
        start_at = (body.live_start_at as string | undefined) ?? start_at;
      }
      if (Object.prototype.hasOwnProperty.call(body, "live_join_url")) {
        hasLive = true;
        join_url = (body.live_join_url as string | undefined) ?? join_url;
      }
      if (Object.prototype.hasOwnProperty.call(body, "live_passcode")) {
        hasLive = true;
        const pv = body.live_passcode as string | undefined;
        passcode = pv ? pv : null;
      }
      if (hasLive) {
        const livePatch: Record<string, unknown> = {};
        if (agenda !== undefined) livePatch.agenda = agenda;
        if (start_at !== undefined) livePatch.start_at = start_at;
        if (join_url !== undefined) livePatch.join_url = join_url;
        if (passcode !== undefined) livePatch.passcode = passcode;
        if (join_url !== undefined && (!join_url || !join_url.trim())) {
          return NextResponse.json(
            { success: false, error: "join_url wajib" },
            { status: 400 }
          );
        }
        if (Object.keys(livePatch).length) {
          const { error: liveErr } = await supabaseAdmin
            .from("module_live_sessions")
            .update(livePatch)
            .eq("module_id", existing.id);
          if (liveErr) throw liveErr;
        }
      }
    }
    if (existing.module_kind === "materi" && body.content) {
      // simple text content update not implemented; skip
    }
    if (existing.module_kind === "quiz" && body.quiz) {
      const q = body.quiz;
      const quizUpdate: Record<string, unknown> = {};
      if ("title" in q) quizUpdate.title = q.title;
      if ("passing_score" in q) quizUpdate.passing_score = q.passing_score;
      if ("time_limit" in q) quizUpdate.time_limit = q.time_limit;
      if (Object.keys(quizUpdate).length) {
        const { data: quizRow } = await supabaseAdmin
          .from("module_quizzes")
          .select("id")
          .eq("module_id", existing.id)
          .maybeSingle();
        if (quizRow) {
          const { error: quErr } = await supabaseAdmin
            .from("module_quizzes")
            .update(quizUpdate)
            .eq("id", quizRow.id);
          if (quErr) throw quErr;
        }
      }
      if (Array.isArray(q.questions)) {
        // Replace strategy
        const { data: quizRow } = await supabaseAdmin
          .from("module_quizzes")
          .select("id")
          .eq("module_id", existing.id)
          .maybeSingle();
        if (quizRow) {
          await supabaseAdmin
            .from("module_quiz_questions")
            .delete()
            .eq("quiz_id", quizRow.id);
          if (q.questions.length) {
            const rows = q.questions.map((ques: any) => ({
              id:
                globalThis?.crypto?.randomUUID?.() ||
                `qq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              quiz_id: quizRow.id,
              question: ques.question,
              q_type: ques.q_type,
              options_json: ques.options ? JSON.stringify(ques.options) : null,
              correct: ques.correct,
              explanation: ques.explanation || null,
            }));
            const { error: insErr } = await supabaseAdmin
              .from("module_quiz_questions")
              .insert(rows);
            if (insErr) throw insErr;
          }
        }
      }
    }
    if (existing.module_kind === "tugas" && body.assignment) {
      const a = body.assignment;
      const assignUpdate: Record<string, unknown> = {};
      if ("instructions" in a) assignUpdate.instructions = a.instructions;
      if ("due_date" in a) assignUpdate.due_date = a.due_date;
      if ("max_score" in a) assignUpdate.max_score = a.max_score;
      if (Object.keys(assignUpdate).length) {
        const { error: aErr } = await supabaseAdmin
          .from("module_assignments")
          .update(assignUpdate)
          .eq("module_id", existing.id);
        if (aErr) throw aErr;
      }
    }

    const fresh = await fetchModule(existing.id);
    return NextResponse.json({ success: true, item: fresh });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE module
export async function DELETE(
  req: NextRequest,
  { params }: { params: { moduleId: string } }
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
  try {
    const existing = await fetchModule(params.moduleId);
    if (!existing)
      return NextResponse.json(
        { success: false, error: "Module not found" },
        { status: 404 }
      );

    const { error } = await supabaseAdmin
      .from("modules")
      .delete()
      .eq("id", existing.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
