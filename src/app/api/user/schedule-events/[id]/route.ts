// PUT /api/user/schedule-events/[id] { userId, title, category?, description?, startDate, endDate? }
export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  try {
    const body = await req.json();
    const { userId, title, category, description, startDate, endDate } = body || {};
    if (!userId || !id || !title || !startDate) {
      return NextResponse.json(
        { success: false, error: "userId, id, title, startDate wajib" },
        { status: 400 }
      );
    }
    // Auth check
    const { data: actor, error: aErr } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();
    if (aErr) throw aErr;
    if (!actor || actor.role !== "user") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }
    // Ownership check
    const { data: existing, error: exErr } = await supabase
      .from("schedule_events")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();
    if (exErr) throw exErr;
    if (!existing || existing.user_id !== userId) {
      return NextResponse.json(
        { success: false, error: "Tidak ditemukan" },
        { status: 404 }
      );
    }
    // Update event
    const { data, error: updErr } = await supabase
      .from("schedule_events")
      .update({
        title,
        category: category ?? null,
        description: description ?? null,
        start_date: startDate,
        end_date: endDate ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (updErr) throw updErr;
    return NextResponse.json({ success: true, event: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal update event";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// DELETE /api/user/schedule-events/[id]?userId=...
export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const userId = (searchParams.get("userId") || "").trim();
  const id = ctx.params.id;
  if (!userId || !id) {
    return NextResponse.json(
      { success: false, error: "userId dan id wajib" },
      { status: 400 }
    );
  }
  try {
    const { data: actor, error: aErr } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();
    if (aErr) throw aErr;
    if (!actor || actor.role !== "user") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Ensure ownership
    const { data: existing, error: exErr } = await supabase
      .from("schedule_events")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();
    if (exErr) throw exErr;
    if (!existing || existing.user_id !== userId) {
      return NextResponse.json(
        { success: false, error: "Tidak ditemukan" },
        { status: 404 }
      );
    }

    const { error: delErr } = await supabase
      .from("schedule_events")
      .delete()
      .eq("id", id);
    if (delErr) throw delErr;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menghapus event";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
