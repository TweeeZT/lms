import nodemailer from "nodemailer";

// Basic reusable transporter (lazy init to avoid cold start cost if not needed)
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    // Incomplete config: create a stub that logs instead of throwing.
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: { user, pass },
  });
  return transporter;
}

export interface WelcomeEmailOptions {
  to: string;
  fullName: string;
  role: string;
}

export async function sendWelcomeEmail(opts: WelcomeEmailOptions) {
  const tx = getTransporter();
  const subject = "Selamat Datang di AfterSchola";
  const roleLabel = opts.role === "user" ? "Siswa" : opts.role;
  const primary = "#1e3769";
  const accent = "#ecf3fa";
  const html = `<!DOCTYPE html>
  <html lang="id" style="margin:0;padding:0">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${subject}</title>
    <style>
      @media (max-width:600px){
        .container{padding:20px !important;}
        .hero-title{font-size:22px !important;}
      }
      a.btn{display:inline-block;padding:12px 22px;font-weight:600;border-radius:8px;text-decoration:none;background:linear-gradient(135deg,#1e386a,#4b6087);color:#fff;box-shadow:0 4px 12px rgba(30,56,106,.25);}a.btn:hover{opacity:.9}
    </style>
  </head>
  <body style="margin:0;padding:0;background:${accent};font-family:'Poppins','Montserrat',Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center" style="padding:32px 12px;">
          <table class="container" width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;padding:40px;box-shadow:0 8px 28px rgba(9,53,105,0.12);border:1px solid #e3e6ea;">
            <tr>
              <td style="text-align:center;padding-bottom:8px;">
                <div style="font-size:18px;font-weight:700;color:${primary};letter-spacing:.5px;">AfterSchola</div>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:4px;">
                <h1 class="hero-title" style="margin:0;font-size:26px;line-height:1.3;color:${primary};font-weight:700;">Selamat Datang, ${
    opts.fullName.split(" ")[0]
  }! 👋</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0 18px;">
                <p style="margin:0;font-size:15px;color:#333;line-height:1.55;">Akun kamu berhasil dibuat sebagai <strong style="color:${primary}">${roleLabel}</strong>.<br/>Kami senang kamu bergabung untuk mulai belajar, menyelesaikan modul, dan mengumpulkan sertifikat.</p>
              </td>
            </tr>
            <tr>
              <td>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${accent};border:1px solid #d6dee7;padding:18px 20px;border-radius:14px;">
                  <tr>
                    <td style="font-size:14px;color:#1f2937;line-height:1.5;">
                      <strong style="color:${primary}">Langkah selanjutnya:</strong><br/>
                      1. Masuk ke dashboard kursus.<br/>
                      2. Mulai modul pertama & ikuti alurnya.<br/>
                      3. Selesaikan kuis dan tugas untuk naik progres.<br/>
                      4. Raih poin & unduh sertifikat setelah selesai.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 0 10px;text-align:center;">
                <a class="btn" href="${
                  process.env.NEXT_PUBLIC_APP_URL ||
                  "https://afterschola.example.com"
                }" target="_blank" rel="noopener">Mulai Belajar</a>
              </td>
            </tr>
            <tr>
              <td style="padding-top:18px;">
                <p style="margin:0;font-size:13px;color:#555;line-height:1.6;">Kalau kamu merasa tidak mendaftar, abaikan email ini. Untuk bantuan, hubungi support kami.</p>
              </td>
            </tr>
            <tr>
              <td style="padding-top:30px;">
                <p style="margin:0;font-size:12px;color:#7b8693;line-height:1.5;text-align:center;">&copy; ${new Date().getFullYear()} AfterSchola. Semua hak dilindungi.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
  const text = `Selamat datang di AfterSchola, ${opts.fullName}!\nAkun kamu siap digunakan sebagai ${roleLabel}. Mulai belajar sekarang.`;

  if (!tx) {
    console.log("[mailer] Missing SMTP config, skip send to", opts.to);
    return { skipped: true } as const;
  }

  await tx.sendMail({
    from: process.env.MAIL_FROM || "AfterSchola <no-reply@afterschola.local>",
    to: opts.to,
    subject,
    html,
    text,
  });
  return { skipped: false } as const;
}

// ================= Purchase Result Email =================
export interface PurchaseEmailOptions {
  to: string;
  fullName: string;
  courseTitle: string;
  amount: number;
  status: "completed" | "cancelled"; // internal mapped status
}

/**
 * Kirim email hasil pembelian kursus (berhasil / gagal / kadaluarsa).
 * Tidak melempar error fatal: jika SMTP belum dikonfigurasi akan skip diam-diam.
 */
export async function sendPurchaseResultEmail(opts: PurchaseEmailOptions) {
  const tx = getTransporter();
  if (!tx) {
    console.log(
      "[mailer] Missing SMTP config, skip send purchase email to",
      opts.to
    );
    return { skipped: true } as const;
  }
  const primary = "#1e3769";
  const accent = "#ecf3fa";
  const isSuccess = opts.status === "completed";
  const subject = isSuccess
    ? `Pembelian Kursus Berhasil: ${opts.courseTitle}`
    : `Pembayaran Kursus Gagal / Kadaluarsa: ${opts.courseTitle}`;

  const amountFmt = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(opts.amount || 0);

  const actionCta = isSuccess
    ? `<a class="btn" href="${
        process.env.NEXT_PUBLIC_APP_URL || "https://afterschola.example.com"
      }" target="_blank" rel="noopener">Buka Dashboard</a>`
    : `<a class="btn" href="${
        process.env.NEXT_PUBLIC_APP_URL || "https://afterschola.example.com"
      }/user/courses" target="_blank" rel="noopener">Coba Lagi</a>`;

  const heroLine = isSuccess
    ? `Pembelian kursus <strong style="color:${primary}">${opts.courseTitle}</strong> telah <strong>BERHASIL</strong>.`
    : `Pembayaran untuk kursus <strong style="color:${primary}">${opts.courseTitle}</strong> <strong>GAGAL / KADALUARSA</strong>.`;

  const nextSteps = isSuccess
    ? `1. Mulai belajar modul pertama.<br/>2. Ikuti materi & kuis sampai selesai.<br/>3. Raih sertifikat setelah progres 100%.`
    : `1. Pastikan metode pembayaran valid / saldo cukup.<br/>2. Buat ulang invoice dari halaman kursus.<br/>3. Hubungi support jika tetap bermasalah.`;

  const html = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"/><title>${subject}</title>
  <style>@media (max-width:600px){.container{padding:20px !important;} .hero{font-size:20px !important;}}
  a.btn{display:inline-block;padding:12px 22px;font-weight:600;border-radius:8px;text-decoration:none;background:linear-gradient(135deg,#1e386a,#4b6087);color:#fff;box-shadow:0 4px 12px rgba(30,56,106,.25);}a.btn:hover{opacity:.9}
  </style></head>
  <body style="margin:0;padding:0;background:${accent};font-family:'Poppins','Montserrat',Arial,sans-serif;">
    <table width="100%" role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px;">
      <table class="container" width="100%" role="presentation" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;padding:40px;box-shadow:0 8px 28px rgba(9,53,105,0.12);border:1px solid #e3e6ea;">
        <tr><td style="text-align:center;padding-bottom:12px;font-size:20px;font-weight:700;color:${primary}">AfterSchola</td></tr>
        <tr><td style="padding-bottom:8px;"><h1 class="hero" style="margin:0;font-size:24px;color:${primary};font-weight:700;line-height:1.3;">${
    isSuccess ? "Pembelian Berhasil" : "Pembayaran Gagal / Kadaluarsa"
  }</h1></td></tr>
        <tr><td style="padding:4px 0 16px;font-size:15px;color:#333;line-height:1.6;">Halo <strong>${
          opts.fullName.split(" ")[0]
        }</strong>,<br/>${heroLine} Total dibayar: <strong>${amountFmt}</strong>.</td></tr>
        <tr><td><table width="100%" style="background:${accent};border:1px solid #d6dee7;padding:18px 20px;border-radius:14px;" role="presentation"><tr><td style="font-size:14px;color:#1f2937;line-height:1.55;"><strong style="color:${primary}">Langkah Selanjutnya:</strong><br/>${nextSteps}</td></tr></table></td></tr>
        <tr><td style="text-align:center;padding:26px 0 6px;">${actionCta}</td></tr>
        <tr><td style="padding-top:16px;font-size:12px;color:#596273;line-height:1.5;">Jika ini bukan aktivitas kamu, abaikan email ini.</td></tr>
        <tr><td style="padding-top:28px;font-size:11px;color:#7b8693;text-align:center;">&copy; ${new Date().getFullYear()} AfterSchola. All rights reserved.</td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const text = isSuccess
    ? `Pembelian kursus ${opts.courseTitle} berhasil. Total: ${amountFmt}. Selamat belajar!`
    : `Pembayaran kursus ${opts.courseTitle} gagal atau kadaluarsa. Silakan coba lagi.`;

  await tx.sendMail({
    from: process.env.MAIL_FROM || "AfterSchola <no-reply@afterschola.local>",
    to: opts.to,
    subject,
    html,
    text,
  });
  return { skipped: false } as const;
}

// ================= Certificate Email =================
export interface CertificateEmailOptions {
  to: string;
  fullName: string;
  courseTitle: string;
  certificateUrl: string;
  isRegenerate?: boolean; // true jika regenerate, false jika pertama kali
}

/**
 * Kirim email selamat telah menyelesaikan kursus dengan attachment sertifikat.
 */
export async function sendCertificateEmail(opts: CertificateEmailOptions) {
  const tx = getTransporter();
  if (!tx) {
    console.log(
      "[mailer] Missing SMTP config, skip send certificate email to",
      opts.to
    );
    return { skipped: true } as const;
  }

  const primary = "#1e3769";
  const accent = "#ecf3fa";
  const subject = opts.isRegenerate
    ? `Sertifikat Diperbaharui: ${opts.courseTitle}`
    : `🎉 Selamat! Sertifikat Kursus ${opts.courseTitle}`;

  const heroText = opts.isRegenerate
    ? "Sertifikat Diperbaharui"
    : "🎉 Selamat, Kamu Lulus!";

  const congratsMessage = opts.isRegenerate
    ? `Sertifikat kamu untuk kursus <strong style="color:${primary}">${opts.courseTitle}</strong> telah <strong>diperbaharui</strong>.`
    : `Kamu telah <strong>berhasil menyelesaikan</strong> kursus <strong style="color:${primary}">${opts.courseTitle}</strong>!`;

  const nextSteps = opts.isRegenerate
    ? `1. Sertifikat baru sudah tersimpan di profil kamu.<br/>2. Kamu bisa mengunduhnya kapan saja.<br/>3. Bagikan prestasi kamu di media sosial!`
    : `1. Sertifikat digital sudah tersedia di dashboard kamu.<br/>2. Unduh dan bagikan di LinkedIn atau media sosial.<br/>3. Lanjutkan belajar untuk kursus berikutnya!`;

  const html = `<!DOCTYPE html>
  <html lang="id">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>${subject}</title>
    <style>
      @media (max-width:600px){
        .container{padding:20px !important;}
        .hero{font-size:22px !important;}
      }
      a.btn{display:inline-block;padding:14px 28px;font-weight:600;border-radius:8px;text-decoration:none;background:linear-gradient(135deg,#1e386a,#4b6087);color:#fff;box-shadow:0 4px 12px rgba(30,56,106,.25);transition:all .3s;}
      a.btn:hover{opacity:.9;transform:translateY(-2px);}
      .certificate-box{background:linear-gradient(135deg, #f6d457 0%, #1e3769 100%);padding:24px;border-radius:12px;text-align:center;margin:20px 0;}
      .trophy{font-size:48px;margin-bottom:12px;}
    </style>
  </head>
  <body style="margin:0;padding:0;background:${accent};font-family:'Poppins','Montserrat',Arial,sans-serif;">
    <table width="100%" role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:32px 12px;">
          <table class="container" width="100%" role="presentation" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;padding:40px;box-shadow:0 10px 30px rgba(9,53,105,0.15);border:1px solid #e3e6ea;">
            <!-- Logo -->
            <tr>
              <td style="text-align:center;padding-bottom:16px;">
                <div style="font-size:24px;font-weight:700;color:${primary};letter-spacing:.5px;">AfterSchola</div>
              </td>
            </tr>
            
            <!-- Hero Title -->
            <tr>
              <td style="padding-bottom:8px;">
                <h1 class="hero" style="margin:0;font-size:28px;line-height:1.3;color:${primary};font-weight:700;text-align:center;">${heroText}</h1>
              </td>
            </tr>
            
            <!-- Trophy Icon -->
            <tr>
              <td style="text-align:center;padding:12px 0;">
                <div class="trophy">🏆</div>
              </td>
            </tr>
            
            <!-- Main Message -->
            <tr>
              <td style="padding:8px 0 20px;">
                <p style="margin:0;font-size:16px;color:#333;line-height:1.6;text-align:center;">Halo <strong>${
                  opts.fullName.split(" ")[0]
                }</strong>,<br/>${congratsMessage}</p>
              </td>
            </tr>
            
            <!-- Certificate Download Box -->
            <tr>
              <td>
                <div class="certificate-box">
                  <p style="margin:0 0 16px 0;font-size:16px;color:#fff;font-weight:600;">📜 Sertifikat Kamu Siap!</p>
                  <a class="btn" href="${
                    opts.certificateUrl
                  }" target="_blank" rel="noopener" style="background:#fff;color:${primary};font-weight:700;">Unduh Sertifikat</a>
                </div>
              </td>
            </tr>
            
            <!-- Next Steps -->
            <tr>
              <td>
                <table width="100%" style="background:${accent};border:1px solid #d6dee7;padding:20px;border-radius:14px;" role="presentation">
                  <tr>
                    <td style="font-size:14px;color:#1f2937;line-height:1.6;">
                      <strong style="color:${primary}">Apa Selanjutnya?</strong><br/>
                      ${nextSteps}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            
            <!-- CTA Button -->
            <tr>
              <td style="text-align:center;padding:28px 0 12px;">
                <a class="btn" href="${
                  process.env.NEXT_PUBLIC_APP_URL ||
                  "https://afterschola.example.com"
                }/user/courses" target="_blank" rel="noopener">Lihat Kursus Lainnya</a>
              </td>
            </tr>
            
            <!-- Share Message -->
            <tr>
              <td style="padding:16px 0;">
                <p style="margin:0;font-size:13px;color:#555;line-height:1.6;text-align:center;">Bagikan pencapaian kamu dan inspirasi teman-teman untuk belajar! 🌟</p>
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td style="padding-top:28px;border-top:1px solid #e3e6ea;">
                <p style="margin:0;font-size:12px;color:#7b8693;line-height:1.5;text-align:center;">
                  &copy; ${new Date().getFullYear()} AfterSchola. Semua hak dilindungi.<br/>
                  Email ini dikirim karena kamu menyelesaikan kursus di platform kami.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;

  const text = opts.isRegenerate
    ? `Sertifikat kamu untuk kursus ${opts.courseTitle} telah diperbaharui. Unduh di: ${opts.certificateUrl}`
    : `Selamat ${opts.fullName}! Kamu telah menyelesaikan kursus ${opts.courseTitle}. Unduh sertifikat: ${opts.certificateUrl}`;

  // Download PDF dari URL untuk attachment
  let attachmentBuffer: Buffer | null = null;
  try {
    const certResponse = await fetch(opts.certificateUrl);
    if (certResponse.ok) {
      const arrayBuffer = await certResponse.arrayBuffer();
      attachmentBuffer = Buffer.from(arrayBuffer);
    }
  } catch (err) {
    console.error("[mailer] Failed to fetch certificate for attachment:", err);
  }

  const mailOptions: any = {
    from: process.env.MAIL_FROM || "AfterSchola <no-reply@afterschola.local>",
    to: opts.to,
    subject,
    html,
    text,
  };

  // Add attachment if we successfully downloaded the PDF
  if (attachmentBuffer) {
    const safeFileName = `Sertifikat-${opts.courseTitle.replace(
      /[^a-zA-Z0-9]/g,
      "-"
    )}.pdf`;
    mailOptions.attachments = [
      {
        filename: safeFileName,
        content: attachmentBuffer,
        contentType: "application/pdf",
      },
    ];
  }

  await tx.sendMail(mailOptions);
  return { skipped: false } as const;
}
