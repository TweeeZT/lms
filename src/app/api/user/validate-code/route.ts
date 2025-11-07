import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const type = searchParams.get("type"); // 'affiliate' or 'voucher'

    if (!code || !type) {
      return NextResponse.json(
        { success: false, error: "Code dan type wajib diisi" },
        { status: 400 }
      );
    }

    if (type === "affiliate") {
      const { data, error } = await supabase
        .from("affiliate_codes")
        .select("id, user_id, is_active")
        .eq("code", code)
        .single();

      if (error || !data || !data.is_active) {
        return NextResponse.json({
          success: true,
          valid: false,
          error: "Kode afiliasi tidak valid atau tidak aktif",
        });
      }

      return NextResponse.json({
        success: true,
        valid: true,
        discountType: "percentage",
        discountValue: 10,
      });
    } else if (type === "voucher") {
      const { data, error } = await supabase
        .from("vouchers")
        .select(
          "id, discount_type, discount_value, max_uses, used_count, start_date, end_date, is_active"
        )
        .eq("code", code)
        .single();

      if (error || !data || !data.is_active) {
        return NextResponse.json({
          success: true,
          valid: false,
          error: "Kode voucher tidak valid atau tidak aktif",
        });
      }

      // Check max uses
      if (data.max_uses !== null && data.used_count >= data.max_uses) {
        return NextResponse.json({
          success: true,
          valid: false,
          error: `Voucher sudah habis digunakan (dipakai ${data.used_count}× dari maksimal ${data.max_uses}×)`,
        });
      }

      // Check date validity
      const now = new Date();
      if (data.start_date && new Date(data.start_date) > now) {
        return NextResponse.json({
          success: true,
          valid: false,
          error: "Voucher belum dapat digunakan",
        });
      }
      if (data.end_date && new Date(data.end_date) < now) {
        return NextResponse.json({
          success: true,
          valid: false,
          error: "Voucher sudah kadaluarsa",
        });
      }

      return NextResponse.json({
        success: true,
        valid: true,
        discountType: data.discount_type,
        discountValue: Number(data.discount_value || 0),
      });
    }

    return NextResponse.json(
      { success: false, error: "Type tidak valid" },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal validasi kode";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
