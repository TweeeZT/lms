import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// Generate random alphanumeric code
function generateCode(length: number = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId wajib diisi" },
        { status: 400 }
      );
    }

    // Check if user already has affiliate code
    const { data: existing } = await supabase
      .from("affiliate_codes")
      .select("id, code")
      .eq("user_id", userId)
      .single();

    if (existing) {
      return NextResponse.json({
        success: true,
        code: existing.code,
        isNew: false,
      });
    }

    // Generate unique code
    let code = generateCode(8);
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const { data: duplicate } = await supabase
        .from("affiliate_codes")
        .select("id")
        .eq("code", code)
        .single();

      if (!duplicate) break; // Code is unique
      code = generateCode(8);
      attempts++;
    }

    if (attempts === maxAttempts) {
      return NextResponse.json(
        { success: false, error: "Gagal generate kode unik" },
        { status: 500 }
      );
    }

    // Insert new affiliate code
    const { data: newCode, error: insertError } = await supabase
      .from("affiliate_codes")
      .insert({
        user_id: userId,
        code: code,
        is_active: true,
      })
      .select("id, code")
      .single();

    if (insertError || !newCode) {
      throw new Error(insertError?.message || "Gagal membuat kode affiliate");
    }

    return NextResponse.json({
      success: true,
      code: newCode.code,
      isNew: true,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal generate affiliate code";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId wajib diisi" },
        { status: 400 }
      );
    }

    // Get user's affiliate code
    const { data: affiliateCode, error: codeError } = await supabase
      .from("affiliate_codes")
      .select("id, code, is_active")
      .eq("user_id", userId)
      .single();

    if (codeError || !affiliateCode) {
      return NextResponse.json({
        success: true,
        code: null,
      });
    }

    // Get referral stats
    const { count: signupCount } = await supabase
      .from("affiliate_referrals")
      .select("*", { count: "exact", head: true })
      .eq("referrer_user_id", userId)
      .eq("status", "registered");

    const { count: purchaseCount } = await supabase
      .from("affiliate_referrals")
      .select("*", { count: "exact", head: true })
      .eq("referrer_user_id", userId)
      .eq("status", "purchased");

    return NextResponse.json({
      success: true,
      code: affiliateCode.code,
      isActive: affiliateCode.is_active,
      stats: {
        signupReferrals: signupCount || 0,
        purchaseReferrals: purchaseCount || 0,
        totalReferrals: (signupCount || 0) + (purchaseCount || 0),
        totalRewardsPoints: ((signupCount || 0) + (purchaseCount || 0)) * 1000,
        totalRewardsCoins: ((signupCount || 0) + (purchaseCount || 0)) * 100,
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal mengambil affiliate code";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
