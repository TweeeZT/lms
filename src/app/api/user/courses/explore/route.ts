import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseServer";

// GET /api/user/courses/explore
// Query: q, category, level, sort (latest|popular|price_asc|price_desc), page, limit
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const category = searchParams.get("category") || "all";
  const level = searchParams.get("level") || "all";
  const sort = (searchParams.get("sort") || "latest") as
    | "latest"
    | "popular"
    | "price_asc"
    | "price_desc";
  const userId = (searchParams.get("userId") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") || "9", 10))
  );
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // base query: published courses
  let query = supabaseAdmin
    .from("courses")
    .select(
      "id,title,description,thumbnail,category,price,duration_min,level,enrolled_count,rating,is_published,created_at,updated_at,instructor_id, users:instructor_id ( id, full_name, avatar )",
      { count: "exact" }
    )
    .eq("is_published", true);

  if (q) {
    // ILIKE title OR description
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  }
  if (category && category !== "all") query = query.eq("category", category);
  if (level && level !== "all") query = query.eq("level", level);

  // sorting
  if (sort === "popular")
    query = query.order("enrolled_count", {
      ascending: false,
      nullsFirst: false,
    });
  else if (sort === "price_asc")
    query = query.order("price", { ascending: true });
  else if (sort === "price_desc")
    query = query.order("price", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  // Exclude courses already purchased/enrolled by user if userId provided
  let purchasedIds: string[] = [];
  if (userId) {
    // gather from enrollments
    interface EnrollRow {
      course_id?: string | null;
    }
    const { data: enrRows } = await supabaseAdmin
      .from("enrollments")
      .select("course_id")
      .eq("user_id", userId);
    if (Array.isArray(enrRows)) {
      purchasedIds.push(
        ...enrRows
          .map((r: EnrollRow) => r.course_id)
          .filter(
            (v: string | null | undefined): v is string =>
              typeof v === "string" && !!v
          )
      );
    }
    // gather from user_progress as fallback (legacy)
    interface ProgressRow {
      course_id?: string | null;
    }
    const { data: progRows } = await supabaseAdmin
      .from("user_progress")
      .select("course_id")
      .eq("user_id", userId);
    if (Array.isArray(progRows)) {
      purchasedIds.push(
        ...progRows
          .map((r: ProgressRow) => r.course_id)
          .filter(
            (v: string | null | undefined): v is string =>
              typeof v === "string" && !!v
          )
      );
    }
    // dedupe
    purchasedIds = Array.from(new Set(purchasedIds));
    if (purchasedIds.length) {
      // Supabase does not allow NOT IN with empty list, safe here
      query = query.not("id", "in", `(${purchasedIds.join(",")})`);
    }
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  const courseIds = (data || [])
    .map((row: any) => row?.id)
    .filter((id): id is string => typeof id === "string" && !!id);

  let modulesCountByCourse: Record<string, number> = {};
  if (courseIds.length > 0) {
    const { data: modRows, error: modulesError } = await supabaseAdmin
      .from("modules")
      .select("course_id")
      .in("course_id", courseIds)
      .or("is_published.eq.true,is_published.is.null");
    if (!modulesError && Array.isArray(modRows)) {
      modulesCountByCourse = (modRows as any[]).reduce(
        (acc: Record<string, number>, row: any) => {
          const cid = row?.course_id as string | undefined;
          if (!cid) return acc;
          acc[cid] = (acc[cid] || 0) + 1;
          return acc;
        },
        {}
      );
    }
  }

  // Supabase row type is dynamic here; mapping to response shape
  const items = (data || []).map((c: any) => {
    const usersJoin = c?.users;
    let instructor: {
      id: string | null;
      fullName: string;
      avatar: string | null;
    } | null = null;

    if (Array.isArray(usersJoin) && usersJoin.length > 0) {
      const u = usersJoin[0];
      instructor = {
        id: (u?.id ?? null) as string | null,
        fullName: (u?.full_name ??
          u?.fullName ??
          u?.name ??
          u?.display_name ??
          "") as string,
        avatar: (u?.avatar ?? u?.avatar_url ?? null) as string | null,
      };
    } else if (usersJoin) {
      instructor = {
        id: (usersJoin?.id ?? usersJoin?.user_id ?? null) as string | null,
        fullName: (usersJoin?.full_name ??
          usersJoin?.fullName ??
          usersJoin?.name ??
          usersJoin?.display_name ??
          "") as string,
        avatar: (usersJoin?.avatar ?? usersJoin?.avatar_url ?? null) as
          | string
          | null,
      };
    }

    return {
      id: c.id,
      title: c.title,
      description: c.description,
      thumbnail: c.thumbnail,
      category: c.category,
      price: c.price != null ? Number(c.price) : null,
      durationMin: c.duration_min != null ? Number(c.duration_min) : 0,
      level: c.level,
      totalModules: modulesCountByCourse[c.id] ?? 0,
      enrolledCount: c.enrolled_count != null ? Number(c.enrolled_count) : 0,
      rating:
        c.rating !== undefined && c.rating !== null ? Number(c.rating) : null,
      isPublished: c.is_published,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      instructor,
    };
  });

  return NextResponse.json({
    success: true,
    items,
    total: count || 0,
    page,
    limit,
    excludedPurchased: purchasedIds.length,
  });
}
