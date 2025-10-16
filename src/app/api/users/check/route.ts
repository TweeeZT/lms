import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("emailOrUsername");
    if (!q) {
      return NextResponse.json({ success: false, error: "emailOrUsername required" }, { status: 400 });
    }

    const { data: users, error } = await supabase
      .from("users")
      .select("id, email, full_name, username, role")
      .or(`email.eq.${q},username.eq.${q}`)
      .limit(1);

    if (error) throw error;

    if (!users || users.length === 0) {
      return NextResponse.json({ success: false, found: false });
    }

    return NextResponse.json({ success: true, found: true, user: users[0] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
