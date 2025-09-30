import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/user/schedule-events?userId=...
// POST /api/user/schedule-events { userId, title, category?, description?, startDate, endDate? }
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = (searchParams.get("userId") || "").trim();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId wajib" },
      { status: 400 }
    );
  }
  try {
    // ensure actor is the same user (role user)
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

    const { data, error } = await supabase
      .from("schedule_events")
      .select(
        "id, user_id, title, category, description, start_date, end_date, created_at, updated_at"
      )
      .eq("user_id", userId)
      .order("start_date", { ascending: true });
    if (error) throw error;

    const events = (data || []).map((e) => ({
      id: e.id,
      userId: e.user_id,
      title: e.title,
      category: e.category,
      description: e.description,
      startDate: e.start_date,
      endDate: e.end_date,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    }));
    return NextResponse.json({ success: true, events });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memuat events";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, title, category, description, startDate, endDate } =
      body || {};
    if (!userId || !title || !startDate) {
      return NextResponse.json(
        { success: false, error: "userId, title, startDate wajib" },
        { status: 400 }
      );
    }
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

    const insertPayload = {
      user_id: userId,
      title: String(title).slice(0, 120),
      category: category ? String(category).slice(0, 60) : null,
      description: description ? String(description).slice(0, 500) : null,
      start_date: startDate,
      end_date: endDate || null,
    };
    const { data, error } = await supabase
      .from("schedule_events")
      .insert(insertPayload)
      .select(
        "id, user_id, title, category, description, start_date, end_date, created_at, updated_at"
      )
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json({
      success: true,
      event: data && {
        id: data.id,
        userId: data.user_id,
        title: data.title,
        category: data.category,
        description: data.description,
        startDate: data.start_date,
        endDate: data.end_date,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal membuat event";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
