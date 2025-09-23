import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const { email } = (await req.json()) as { email?: string };
    if (!email) return NextResponse.json({ exists: false }, { status: 400 });
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (error) return NextResponse.json({ exists: false }, { status: 200 });
    return NextResponse.json({ exists: !!data });
  } catch {
    return NextResponse.json({ exists: false }, { status: 200 });
  }
}
