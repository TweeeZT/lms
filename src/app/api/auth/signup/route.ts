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
      role, // now accepts 'user' or 'school'
      phone,
      bio,
      affiliateCode, // optional affiliate code
    } = (await req.json()) as {
      email?: string;
      password?: string;
      username?: string;
      fullName?: string;
      role?: "user" | "school";
      phone?: string;
      bio?: string;
      affiliateCode?: string;
    };
    if (!email || !password || !username || !fullName)
      return NextResponse.json(
        { success: false, error: "Data tidak lengkap" },
        { status: 400 }
      );

    // Only allow 'user' (siswa) or 'school'
    const enforcedRole = role === "school" ? "school" : "user";

    // Validate affiliate code if provided
    let affiliateCodeId: string | null = null;
    let referrerId: string | null = null;
    if (affiliateCode && affiliateCode.trim()) {
      const { data: codeData, error: codeErr } = await supabaseAdmin
        .from("affiliate_codes")
        .select("id, user_id, is_active")
        .eq("code", affiliateCode.trim())
        .single();

      if (codeErr || !codeData || !codeData.is_active) {
        return NextResponse.json(
          {
            success: false,
            error: "Kode afiliasi tidak valid atau sudah tidak aktif",
          },
          { status: 400 }
        );
      }

      affiliateCodeId = codeData.id;
      referrerId = codeData.user_id;
    }

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

    // Create student record (for both user and school)
    if (enforcedRole === "user") {
      await supabaseAdmin.from("students").insert({ user_id: userId });
    } else {
      // school also gets student record
      await supabaseAdmin.from("students").insert({ user_id: userId });
    }

    // Process affiliate referral if code was used
    if (affiliateCodeId && referrerId) {
      // Insert referral record
      await supabaseAdmin.from("affiliate_referrals").insert({
        affiliate_code_id: affiliateCodeId,
        referrer_id: referrerId,
        referred_user_id: userId,
        reward_coins: 100,
        bonus_coins: 0,
        status: "registered",
      });

      // Award referrer 1000 points and 100 coins
      const { data: referrerStudent } = await supabaseAdmin
        .from("students")
        .select("points, coins, total_referral_points")
        .eq("user_id", referrerId)
        .single();

      if (referrerStudent) {
        await supabaseAdmin
          .from("students")
          .update({
            points: (referrerStudent.points || 0) + 1000,
            coins: (referrerStudent.coins || 0) + 100,
            total_referral_points:
              (referrerStudent.total_referral_points || 0) + 1000,
          })
          .eq("user_id", referrerId);
      }
    }

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
