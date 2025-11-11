import { NextRequest, NextResponse } from "next/server";
import supabaseAdmin from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  try {
    const supabase = supabaseAdmin;
    const { searchParams } = new URL(req.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const courseId = searchParams.get("courseId") || "";

    const offset = (page - 1) * limit;

    let query = supabase.from("course_tools").select(
      `
        *,
        courses!course_tools_courses_id_fkey (
          id,
          title
        )
      `,
      { count: "exact" }
    );

    if (search) {
      query = query.or(
        `text_content.ilike.%${search}%,title.ilike.%${search}%`
      );
    }

    if (courseId) {
      query = query.eq("courses_id", courseId);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching tools:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (err: any) {
    console.error("GET /api/admin/tools error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseAdmin;
    const body = await req.json();

    const { courses_id, title, text_content, price } = body;

    if (!courses_id || !title || !text_content) {
      return NextResponse.json(
        {
          success: false,
          error: "courses_id, title, and text_content are required",
        },
        { status: 400 }
      );
    }

    // Generate UUID for id
    const id =
      globalThis?.crypto?.randomUUID?.() ||
      `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const { data, error } = await supabase
      .from("course_tools")
      .insert({
        id,
        courses_id,
        title,
        text_content,
        price: price || 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating tool:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("POST /api/admin/tools error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
