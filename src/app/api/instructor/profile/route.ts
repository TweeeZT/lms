import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/instructor/profile?instructorId=<uuid>
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  if (!instructorId) {
    return NextResponse.json(
      { success: false, error: "instructorId wajib" },
      { status: 400 }
    );
  }

  try {
    const userQ = await supabase
      .from("users")
      .select(
        "id, email, username, full_name, avatar, phone, bio, role, created_at, updated_at"
      )
      .eq("id", instructorId)
      .maybeSingle();
    if (userQ.error || !userQ.data) {
      return NextResponse.json(
        { success: false, error: "Instruktur tidak ditemukan" },
        { status: 404 }
      );
    }

    const instQ = await supabase
      .from("instructors")
      .select("user_id, total_earnings, rating, bank_account")
      .eq("user_id", instructorId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      user: userQ.data,
      instructor: instQ.data || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memuat profil";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// PATCH /api/instructor/profile
// body: { instructorId, fullName?, username?, phone?, bio?, avatarUrl?, bankAccount? }
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const instructorId = String(body.instructorId || "").trim();
    if (!instructorId) {
      return NextResponse.json(
        { success: false, error: "instructorId wajib" },
        { status: 400 }
      );
    }

    const updatesUser: Record<string, string> = {};
    if (typeof body.fullName === "string")
      updatesUser.full_name = body.fullName.trim();
    if (typeof body.username === "string")
      updatesUser.username = body.username.trim();
    if (typeof body.phone === "string") updatesUser.phone = body.phone.trim();
    if (typeof body.bio === "string") updatesUser.bio = body.bio.trim();
    if (typeof body.avatarUrl === "string")
      updatesUser.avatar = body.avatarUrl.trim();

    const updatesInst: Record<string, string> = {};
    if (typeof body.bankAccount === "string")
      updatesInst.bank_account = body.bankAccount.trim();

    // Update users
    if (Object.keys(updatesUser).length) {
      const u = await supabase
        .from("users")
        .update(updatesUser)
        .eq("id", instructorId);
      if (u.error) {
        return NextResponse.json(
          { success: false, error: `Gagal update users: ${u.error.message}` },
          { status: 400 }
        );
      }
    }
    // Update instructors (upsert for safety)
    if (Object.keys(updatesInst).length) {
      const i = await supabase
        .from("instructors")
        .upsert(
          { user_id: instructorId, ...updatesInst },
          { onConflict: "user_id" }
        );
      if (i.error) {
        return NextResponse.json(
          {
            success: false,
            error: `Gagal update instructors: ${i.error.message}`,
          },
          { status: 400 }
        );
      }
    }

    // Return fresh data
    const [userQ, instQ] = await Promise.all([
      supabase
        .from("users")
        .select(
          "id, email, username, full_name, avatar, phone, bio, role, created_at, updated_at"
        )
        .eq("id", instructorId)
        .maybeSingle(),
      supabase
        .from("instructors")
        .select("user_id, total_earnings, rating, bank_account")
        .eq("user_id", instructorId)
        .maybeSingle(),
    ]);

    if (userQ.error || !userQ.data) {
      return NextResponse.json(
        { success: false, error: "Gagal memuat ulang data pengguna" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: userQ.data,
      instructor: instQ.data || null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal menyimpan profil";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
