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
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") || "12", 10))
  );
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // base query: published courses
  let query = supabaseAdmin
    .from("courses")
    .select(
      "id,title,description,thumbnail,category,price,duration_min,level,total_modules,enrolled_count,rating,is_published,created_at,updated_at,instructor_id, users:instructor_id ( id, full_name, avatar )",
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

  const { data, error, count } = await query.range(from, to);
  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  // Supabase row type is dynamic here; mapping to response shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (data || []).map((c: any) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    thumbnail: c.thumbnail,
    category: c.category,
    price: c.price,
    durationMin: c.duration_min,
    level: c.level,
    totalModules: c.total_modules,
    enrolledCount: c.enrolled_count,
    rating: Number(c.rating || 0),
    isPublished: c.is_published,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    instructor: c.users
      ? {
          id: c.users.id,
          fullName: c.users.full_name,
          avatar: c.users.avatar || null,
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
}
