import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json(
        { success: false, error: "Token dan password harus diisi" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password minimal 6 karakter" },
        { status: 400 }
      );
    }

    // Verify token and get user_id
    const { data: resetToken, error: tokenErr } = await supabase
      .from("reset_tokens")
      .select("user_id, expires_at, used_at")
      .eq("token", token)
      .single();

    if (tokenErr || !resetToken) {
      return NextResponse.json(
        { success: false, error: "Token tidak valid" },
        { status: 400 }
      );
    }

    // Check if token expired
    const now = new Date();
    const expiresAt = new Date(resetToken.expires_at);
    if (now > expiresAt) {
      return NextResponse.json(
        { success: false, error: "Token sudah kadaluarsa" },
        { status: 400 }
      );
    }

    // Check if token already used
    if (resetToken.used_at) {
      return NextResponse.json(
        { success: false, error: "Token sudah digunakan" },
        { status: 400 }
      );
    }

    // Get user from auth
    const { data: authUser, error: authErr } =
      await supabase.auth.admin.getUserById(resetToken.user_id);

    if (authErr || !authUser.user) {
      return NextResponse.json(
        { success: false, error: "User tidak ditemukan" },
        { status: 404 }
      );
    }

    // Update password using admin API
    const { error: updateErr } = await supabase.auth.admin.updateUserById(
      resetToken.user_id,
      { password }
    );

    if (updateErr) {
      console.error("[reset-password] Failed to update password:", updateErr);
      return NextResponse.json(
        { success: false, error: "Gagal mengubah password" },
        { status: 500 }
      );
    }

    // Mark token as used
    await supabase
      .from("reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token);

    return NextResponse.json({
      success: true,
      message: "Password berhasil diubah",
    });
  } catch (error) {
    console.error("[reset-password] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal reset password",
      },
      { status: 500 }
    );
  }
}
