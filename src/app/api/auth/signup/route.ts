import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWelcomeEmail } from "../../../../lib/mailer";

// Pastikan runtime Node.js (dibutuhkan untuk nodemailer & modul node core)
export const runtime = "nodejs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabaseAuth = createClient(url, anon);
const supabaseAdmin = createClient(url, serviceRole);

export async function POST(req: Request) {
  try {
    const {
      email,
      password,
      username,
      fullName,
      /* role ignored */ phone,
      bio,
    } = (await req.json()) as {
      email?: string;
      password?: string;
      username?: string;
      fullName?: string;
      role?: "instructor" | "user"; // will be ignored, always 'user'
      phone?: string;
      bio?: string;
    };
    if (!email || !password || !username || !fullName)
      return NextResponse.json(
        { success: false, error: "Data tidak lengkap" },
        { status: 400 }
      );

    const { data: auth, error: authError } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, username },
      },
    });
    if (authError)
      return NextResponse.json(
        {
          success: false,
          error: /User already registered/i.test(authError.message)
            ? "Email sudah terdaftar"
            : authError.message,
        },
        { status: 400 }
      );

    const userId = auth.user?.id;
    if (!userId)
      return NextResponse.json(
        { success: false, error: "Gagal membuat akun" },
        { status: 500 }
      );

    const enforcedRole = "user";
    const { error: profileError } = await supabaseAdmin.from("users").insert([
      {
        id: userId,
        email,
        username,
        full_name: fullName,
        role: enforcedRole,
        phone: phone ?? null,
        bio: bio ?? null,
      },
    ]);
    if (profileError)
      return NextResponse.json(
        { success: false, error: profileError.message },
        { status: 400 }
      );

    // Always treat as student
    await supabaseAdmin.from("students").insert({ user_id: userId });

    // Fire and forget welcome email (do not block response)
    sendWelcomeEmail({ to: email, fullName, role: enforcedRole }).catch((e) => {
      console.warn("Failed to send welcome email", e);
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Signup gagal";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
