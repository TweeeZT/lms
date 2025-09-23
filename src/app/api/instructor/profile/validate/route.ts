import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/instructor/profile/validate?username=...&phone=...&excludeId=...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = (searchParams.get("username") || "").trim();
  const phone = (searchParams.get("phone") || "").trim();
  const excludeId = (searchParams.get("excludeId") || "").trim();

  try {
    // Validate username if provided
    if (username) {
      if (!/^[A-Za-z0-9_.-]{3,20}$/.test(username)) {
        return NextResponse.json({
          valid: false,
          error: "Format username tidak valid",
        });
      }
      const q = supabase
        .from("users")
        .select("id")
        .eq("username", username)
        .limit(1);
      const { data, error } = await q;
      if (error) throw error;
      const exists = (data || []).some((u) => u.id !== excludeId);
      return NextResponse.json({
        valid: !exists,
        error: exists ? "Username sudah dipakai" : undefined,
      });
    }

    // Validate phone if provided
    if (phone) {
      if (!/^\+?\d{6,15}$/.test(phone)) {
        return NextResponse.json({
          valid: false,
          error: "Format nomor telepon tidak valid",
        });
      }
      const q = supabase.from("users").select("id").eq("phone", phone).limit(1);
      const { data, error } = await q;
      if (error) throw error;
      const exists = (data || []).some((u) => u.id !== excludeId);
      return NextResponse.json({
        valid: !exists,
        error: exists ? "Nomor sudah terdaftar" : undefined,
      });
    }

    return NextResponse.json({ valid: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal validasi";
    return NextResponse.json({ valid: false, error: message }, { status: 500 });
  }
}
