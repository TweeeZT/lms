import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { randomBytes } from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email harus diisi" },
        { status: 400 }
      );
    }

    // Check if user exists in auth.users first
    const { data: authUsers, error: authErr } =
      await supabase.auth.admin.listUsers();

    if (authErr) {
      console.error("[forgot-password] Failed to list users:", authErr);
      return NextResponse.json(
        { success: false, error: "Gagal memeriksa email" },
        { status: 500 }
      );
    }

    const authUser = authUsers.users.find((u) => u.email === email);

    if (!authUser) {
      // Return error - email not registered
      return NextResponse.json(
        { success: false, error: "Email tidak terdaftar" },
        { status: 404 }
      );
    }

    // Get profile from users table
    const { data: profile, error: profileErr } = await supabase
      .from("users")
      .select("id, full_name, email")
      .eq("id", authUser.id)
      .single();

    if (profileErr || !profile) {
      console.error("[forgot-password] Profile not found:", profileErr);
      return NextResponse.json(
        { success: false, error: "Email tidak terdaftar" },
        { status: 404 }
      );
    }

    // Generate reset token (valid 1 hour)
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token in database
    const { error: insertErr } = await supabase.from("reset_tokens").insert({
      user_id: profile.id,
      token,
      expires_at: expiresAt.toISOString(),
    });

    if (insertErr) {
      console.error("[forgot-password] Failed to store token:", insertErr);
      return NextResponse.json(
        { success: false, error: "Gagal membuat token reset" },
        { status: 500 }
      );
    }

    // Send email with custom template
    const transporter = getTransporter();
    if (!transporter) {
      console.error("[forgot-password] SMTP not configured");
      return NextResponse.json(
        { success: false, error: "Email service tidak tersedia" },
        { status: 500 }
      );
    }

    const resetUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000");
    const resetLink = `${resetUrl}/reset-password?token=${token}`;

    const html = `<!DOCTYPE html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset Password - AfterSchola</title>
  </head>
  <body
    style="margin:0; padding:0; font-family:Poppins,Montserrat,Arial,sans-serif; background-color:#f9fafc; color:#171717;"
  >
    <table
      width="100%"
      cellpadding="0"
      cellspacing="0"
      role="presentation"
      style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08);"
    >
      <!-- Header -->
      <tr>
        <td
          style="background:linear-gradient(135deg,#1e3769 0%,#4b6087 100%); padding:24px; text-align:center; color:white;"
        >
          <h1 style="margin:0; font-size:22px; font-weight:600;">
            AfterSchola
          </h1>
        </td>
      </tr>

      <!-- Content -->
      <tr>
        <td style="padding:32px 24px; text-align:center;">
          <h2 style="font-size:20px; font-weight:600; margin:0 0 16px; color:#1e3769;">
            Reset Password Anda
          </h2>
          <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#444;">
            Halo <strong>${profile.full_name}</strong>,<br/>
            Klik tombol di bawah untuk mengatur ulang password akun Anda. Jika
            Anda tidak meminta reset password, abaikan email ini.
          </p>

          <!-- Button -->
          <a
            href="${resetLink}"
            style="display:inline-block; background:linear-gradient(135deg,#f6d457,#1e3769); color:white; font-weight:600; text-decoration:none; padding:12px 24px; border-radius:8px; font-size:15px;"
          >
            Reset Password
          </a>
          
          <p style="margin:24px 0 0; font-size:13px; line-height:1.6; color:#666;">
            Atau salin link berikut ke browser:<br/>
            <a href="${resetLink}" style="color:#1e3769; word-break:break-all;">${resetLink}</a>
          </p>
          
          <p style="margin:16px 0 0; font-size:13px; color:#888;">
            Link ini berlaku selama 1 jam.
          </p>
        </td>
      </tr>

      <!-- Info -->
      <tr>
        <td style="padding:24px; background-color:#ecf3fa; text-align:center;">
          <p style="margin:0; font-size:13px; color:#555;">
            Butuh bantuan? Hubungi kami di
            <a href="mailto:info@afterschola.com" style="color:#1e3769; font-weight:500; text-decoration:none;">
              info@afterschola.com
            </a>
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td
          style="background:#1e3769; padding:16px; text-align:center; color:white; font-size:12px;"
        >
          © 2025 AfterSchola. Semua Hak Dilindungi.
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const text = `Reset Password AfterSchola\n\nHalo ${profile.full_name},\n\nKlik link berikut untuk reset password: ${resetLink}\n\nLink berlaku 1 jam.\n\nJika tidak meminta reset, abaikan email ini.\n\nAfterSchola`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM || "AfterSchola <no-reply@afterschola.local>",
      to: email,
      subject: "Reset Password - AfterSchola",
      html,
      text,
    });

    return NextResponse.json({
      success: true,
      message: "Link reset password telah dikirim ke email Anda",
    });
  } catch (error) {
    console.error("[forgot-password] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal mengirim email",
      },
      { status: 500 }
    );
  }
}
