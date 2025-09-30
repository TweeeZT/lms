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
  const { data, error } = await supabaseAdmin
    .from("modules")
    .select(
      "id, course_id, title, description, module_kind, order_index, is_published, content, quiz_questions, assignment, live_session_link, created_at, updated_at"
    )
    .eq("id", moduleId)
    .maybeSingle();
  if (error) throw error;
  return data;
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

// PATCH update metadata or content depending on module_kind
// Body can include: title, description, order_index, is_published, content (for materi), quiz_questions (for quiz), assignment (for tugas), live_session_link (for live)
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

    const body = await req.json();
    const update: Record<string, unknown> = {};
    const allowed = [
      "title",
      "description",
      "order_index",
      "is_published",
      "content",
      "quiz_questions",
      "assignment",
      "live_session_link",
    ];
    for (const k of allowed) {
      if (k in body) update[k] = body[k];
    }

    // Validate based on kind
    if ("content" in update && existing.module_kind !== "materi") {
      return NextResponse.json(
        { success: false, error: "content hanya untuk module_kind materi" },
        { status: 400 }
      );
    }
    if ("quiz_questions" in update && existing.module_kind !== "quiz") {
      return NextResponse.json(
        {
          success: false,
          error: "quiz_questions hanya untuk module_kind quiz",
        },
        { status: 400 }
      );
    }
    if ("assignment" in update && existing.module_kind !== "tugas") {
      return NextResponse.json(
        { success: false, error: "assignment hanya untuk module_kind tugas" },
        { status: 400 }
      );
    }
    if ("live_session_link" in update && existing.module_kind !== "live") {
      return NextResponse.json(
        {
          success: false,
          error: "live_session_link hanya untuk module_kind live",
        },
        { status: 400 }
      );
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada field untuk diupdate" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("modules")
      .update(update)
      .eq("id", existing.id)
      .select(
        "id, course_id, title, description, module_kind, order_index, is_published, content, quiz_questions, assignment, live_session_link, created_at, updated_at"
      )
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ success: true, item: data });
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
