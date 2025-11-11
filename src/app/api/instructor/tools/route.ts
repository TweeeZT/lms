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
    const instructorId = searchParams.get("instructorId") || "";

    const offset = (page - 1) * limit;

    let query = supabase.from("course_tools").select(
      `
        *,
        courses!course_tools_courses_id_fkey (
          id,
          title,
          instructor_id
        )
      `,
      { count: "exact" }
    );

    if (search) {
      query = query.or(`text_content.ilike.%${search}%`);
    }

    if (courseId) {
      query = query.eq("courses_id", courseId);
    }

    // Filter by instructor's courses if instructorId provided
    if (instructorId) {
      const { data: courses } = await supabase
        .from("courses")
        .select("id")
        .eq("instructor_id", instructorId);

      if (courses && courses.length > 0) {
        const courseIds = courses.map((c) => c.id);
        query = query.in("courses_id", courseIds);
      } else {
        // No courses found for this instructor
        return NextResponse.json({
          success: true,
          data: [],
          total: 0,
          page,
          limit,
        });
      }
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
    console.error("GET /api/instructor/tools error:", err);
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

    const { courses_id, text_content, price, instructorId } = body;

    if (!courses_id || !text_content) {
      return NextResponse.json(
        { success: false, error: "courses_id and text_content are required" },
        { status: 400 }
      );
    }

    // Verify that the course belongs to this instructor
    if (instructorId) {
      const { data: courseData } = await supabase
        .from("courses")
        .select("instructor_id")
        .eq("id", courses_id)
        .single();

      if (!courseData || courseData.instructor_id !== instructorId) {
        return NextResponse.json(
          {
            success: false,
            error: "Unauthorized: Course does not belong to this instructor",
          },
          { status: 403 }
        );
      }
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
    console.error("POST /api/instructor/tools error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
