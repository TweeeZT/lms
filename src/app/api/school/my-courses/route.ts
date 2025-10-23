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

    // Get courses from school_progress and include instructor user via join (instructor_id -> users)
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
          enrolled_count,
          rating,
          points,
          instructor_id,
          users:instructor_id ( id, full_name, avatar )
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

    // Build a map of published modules count per course to align with detail page
    const courseIds = (data || [])
      .map((row: any) => row.courses?.id)
      .filter((id: string | undefined): id is string => Boolean(id));

    let modulesCountByCourse: Record<string, number> = {};
    if (courseIds.length > 0) {
      const { data: modRows, error: modErr } = await supabase
        .from("modules")
        .select("course_id")
        .in("course_id", courseIds)
        .or("is_published.eq.true,is_published.is.null");
      if (!modErr && Array.isArray(modRows)) {
        modulesCountByCourse = (modRows as any[]).reduce(
          (acc: Record<string, number>, r: any) => {
            const cid = r.course_id as string;
            acc[cid] = (acc[cid] || 0) + 1;
            return acc;
          },
          {}
        );
      }
    }

    const extractInstructor = (courseSrc: any) => {
      const candidate =
        courseSrc?.instructor ??
        courseSrc?.users ??
        courseSrc?.user ??
        courseSrc?.instructor_user ??
        null;

      if (!candidate) return null;

      const mapUser = (u: any) => ({
        id: (u?.id ?? u?.user_id ?? null) as string | null,
        fullName: (u?.full_name ??
          u?.fullName ??
          u?.name ??
          u?.display_name ??
          "") as string,
        avatar: (u?.avatar ?? u?.avatar_url ?? null) as string | null,
      });

      if (Array.isArray(candidate) && candidate.length > 0) {
        return mapUser(candidate[0]);
      }

      if (typeof candidate === "object") {
        return mapUser(candidate);
      }

      return null;
    };

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
        ? (() => {
            const courseSrc = row.courses;
            const instructor = extractInstructor(courseSrc);

            return {
              id: courseSrc.id,
              title: courseSrc.title,
              description: courseSrc.description,
              thumbnail: courseSrc.thumbnail,
              category: courseSrc.category,
              price: courseSrc.price != null ? Number(courseSrc.price) : null,
              durationMin:
                courseSrc.duration_min != null
                  ? Number(courseSrc.duration_min)
                  : 0,
              level: courseSrc.level,
              // Use published modules count (computed from modules table)
              totalModules: modulesCountByCourse[courseSrc.id] ?? 0,
              enrolledCount:
                courseSrc.enrolled_count != null
                  ? Number(courseSrc.enrolled_count)
                  : 0,
              rating:
                courseSrc.rating != null ? Number(courseSrc.rating) : null,
              points:
                courseSrc.points != null ? Number(courseSrc.points) : null,
              instructor,
            };
          })()
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
