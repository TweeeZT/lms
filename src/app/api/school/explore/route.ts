import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("q") || "";
    const category = searchParams.get("category") || "";
    const level = searchParams.get("level") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");

    // Get all published courses
    let query = supabase
      .from("courses")
      .select("*", { count: "exact" })
      .eq("is_published", true);

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (category) {
      query = query.eq("category", category);
    }
    if (level) {
      query = query.eq("level", level);
    }

    const offset = (page - 1) * limit;
    const {
      data: courses,
      count,
      error: coursesErr,
    } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (coursesErr) throw coursesErr;

    return NextResponse.json({
      success: true,
      courses: courses || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat kursus";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
