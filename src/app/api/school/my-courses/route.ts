import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolUserId = searchParams.get("schoolUserId");
    const q = searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "6", 10);

    if (!schoolUserId) {
      return NextResponse.json(
        { success: false, error: "schoolUserId required" },
        { status: 400 }
      );
    }

    // Get courses from school_progress
    let query = supabase
      .from("school_progress")
      .select(
        `
        id,
        enrolled_at,
        progress_percentage,
        completed_modules,
        current_module_id,
        courses (
          id,
          title,
          description,
          thumbnail,
          category,
          price,
          duration_min,
          level,
          total_modules,
          enrolled_count,
          rating,
          points
        )
      `,
        { count: "exact" }
      )
      .eq("user_id", schoolUserId)
      .order("enrolled_at", { ascending: false });

    // Search filter
    if (q.trim()) {
      query = query.ilike("courses.title", `%${q.trim()}%`);
    }

    // Pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    // Transform data
    const items = (data || []).map((row: any) => ({
      enrollmentId: row.id,
      enrolledAt: row.enrolled_at,
      progress: {
        percentage: row.progress_percentage || 0,
        completedCount: Array.isArray(row.completed_modules)
          ? row.completed_modules.length
          : 0,
        currentModuleId: row.current_module_id,
      },
      course: row.courses
        ? {
            id: row.courses.id,
            title: row.courses.title,
            description: row.courses.description,
            thumbnail: row.courses.thumbnail,
            category: row.courses.category,
            price: row.courses.price,
            durationMin: row.courses.duration_min,
            level: row.courses.level,
            totalModules: row.courses.total_modules || 0,
            enrolledCount: row.courses.enrolled_count,
            rating: row.courses.rating,
            points: row.courses.points,
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      items,
      total: count || 0,
      page,
      limit,
    });
  } catch (err: any) {
    console.error("[school/my-courses] error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
