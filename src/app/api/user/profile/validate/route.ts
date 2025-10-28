import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/user/profile/validate?username=...&phone=...&excludeId=...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = (searchParams.get("username") || "").trim();
  const phone = (searchParams.get("phone") || "").trim();
  const excludeId = (searchParams.get("excludeId") || "").trim();

  try {
    // Validate username if provided
    if (username) {
      // Check minimum length
      if (username.length < 3) {
        return NextResponse.json({
          valid: false,
          error: "Username minimal 3 karakter",
        });
      }

      // Check allowed characters
      if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
        return NextResponse.json({
          valid: false,
          error: "Username hanya boleh huruf, angka, titik, dan underscore",
        });
      }

      // Check uniqueness
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("username", username)
        .neq("id", excludeId)
        .limit(1);

      if (existingUser && existingUser.length > 0) {
        return NextResponse.json({
          valid: false,
          error: "Username sudah digunakan",
        });
      }
    }

    // Validate phone if provided
    if (phone) {
      // Check format (only numbers, can start with +)
      if (!/^\+?\d+$/.test(phone)) {
        return NextResponse.json({
          valid: false,
          error: "Nomor telepon hanya boleh angka dan tanda +",
        });
      }

      // Check minimum length (excluding + if present)
      const phoneDigits = phone.replace(/^\+/, "");
      if (phoneDigits.length < 10) {
        return NextResponse.json({
          valid: false,
          error: "Nomor telepon minimal 10 digit",
        });
      }

      // Check uniqueness
      const { data: existingPhone } = await supabase
        .from("users")
        .select("id")
        .eq("phone", phone)
        .neq("id", excludeId)
        .limit(1);

      if (existingPhone && existingPhone.length > 0) {
        return NextResponse.json({
          valid: false,
          error: "Nomor telepon sudah digunakan",
        });
      }
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("Validation error:", error);
    return NextResponse.json(
      { valid: false, error: "Gagal memvalidasi" },
      { status: 500 }
    );
  }
}