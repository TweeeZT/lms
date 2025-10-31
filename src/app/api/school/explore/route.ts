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
    const userId = searchParams.get("userId") || "";

    // First, get courses that user has already purchased (in school_progress)
    let purchasedCourseIds: string[] = [];
    if (userId) {
      const { data: progressData } = await supabase
        .from("school_progress")
        .select("course_id")
        .eq("user_id", userId);

      if (progressData && progressData.length > 0) {
        purchasedCourseIds = progressData.map((p: any) => p.course_id);
      }
    }

    // Get all published courses and join instructor user (instructor_id -> users)
    let query = supabase
      .from("courses")
      .select(
        // select explicit fields and join users on instructor_id
        `id,title,description,thumbnail,category,price,duration_min,level,enrolled_count,rating,is_published,created_at,updated_at,instructor_id, users:instructor_id ( id, full_name, avatar )`,
        { count: "exact" }
      )
      .eq("is_published", true);

    // Exclude courses that user has already purchased
    if (purchasedCourseIds.length > 0) {
      query = query.not("id", "in", `(${purchasedCourseIds.join(",")})`);
    }

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

    // compute published modules count per course (since total_modules column removed)
    const courseIds = (courses || []).map((c: any) => c.id).filter(Boolean);
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

    // attach totalModules and normalize instructor & numeric fields
    const coursesWithModules = (courses || []).map((c: any) => {
      // normalize instructor returned as users array (Supabase returns array for joins)
      const usersJoin = c.users;
      let instructor = null;
      if (Array.isArray(usersJoin) && usersJoin.length > 0) {
        const u = usersJoin[0];
        instructor = {
          id: u?.id ?? null,
          fullName: u?.full_name ?? null,
          avatar: u?.avatar ?? null,
        };
      }

      return {
        ...c,
        // numeric normalization
        enrolled_count: c.enrolled_count != null ? Number(c.enrolled_count) : 0,
        duration_min: c.duration_min != null ? Number(c.duration_min) : 0,
        rating: c.rating != null ? Number(c.rating) : null,
        totalModules: modulesCountByCourse[c.id] ?? 0,
        // prefer normalized instructor object for frontend convenience
        instructor,
      };
    });

    return NextResponse.json({
      success: true,
      // compatibility: return courses + items + total/count
      courses: coursesWithModules || [],
      items: coursesWithModules || [],
      total: count || 0,
      count: count || 0,
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
