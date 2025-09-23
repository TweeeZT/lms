import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseServer";

// GET /api/auth/guard?userId=...
// Ensures OAuth is login-only: returns profile if exists, otherwise deletes the auth user and returns error.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "missing_userId" },
        { status: 400 }
      );
    }

    // Check profile existence
    const { data: profile, error: profErr } = await supabaseAdmin
      .from("users")
      .select(
        "id, email, username, full_name, role, avatar, phone, bio, created_at, updated_at"
      )
      .eq("id", userId)
      .maybeSingle();

    if (profErr) {
      return NextResponse.json(
        { success: false, error: profErr.message },
        { status: 500 }
      );
    }

    if (!profile) {
      // Delete accidentally created auth user to avoid unwanted signups via OAuth
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch {
        // ignore delete errors
      }
      return NextResponse.json(
        { success: false, error: "not_found" },
        { status: 404 }
      );
    }

    const mapped = {
      id: profile.id,
      email: profile.email,
      username: profile.username,
      fullName: profile.full_name,
      role: profile.role,
      avatar: profile.avatar ?? undefined,
      phone: profile.phone ?? undefined,
      bio: profile.bio ?? undefined,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };

    return NextResponse.json({ success: true, user: mapped });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unexpected_error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
