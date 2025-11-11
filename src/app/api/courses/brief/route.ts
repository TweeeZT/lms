import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY =
  (process.env.SUPABASE_SERVICE_ROLE_KEY as string) ||
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function GET() {
  const { data, error } = await supabase
    .from("courses")
    .select("id, title")
    .order("title", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
