import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseServer";

// Helper: ensure requesting user is an admin
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

// GET /api/admin/courses/[id]?userId=<admin>
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await context.params;
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
    const { data, error } = await supabaseAdmin
      .from("courses")
      .select(
        "id, instructor_id, title, description, thumbnail, category, price, duration_min, level, total_modules, enrolled_count, rating, is_published, created_at, updated_at, users:instructor_id(full_name)"
      )
      .eq("id", courseId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { success: false, error: "Course not found" },
        { status: 404 }
      );
    }
    let instructor_name: string | null = null;
    if (data.users) {
      if (Array.isArray(data.users))
        instructor_name = data.users[0]?.full_name || null;
      else
        instructor_name =
          (data.users as { full_name: string | null }).full_name || null;
    }
    return NextResponse.json({
      success: true,
      item: { ...data, instructor_name },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
