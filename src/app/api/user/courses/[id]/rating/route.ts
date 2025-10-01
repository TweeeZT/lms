import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseServer";

// GET: fetch current user's rating (requires userId query) + course average
// POST: body { userId, rating } upsert (1-5) and recalc average

async function recalcAverage(courseId: string) {
  // Aggregate from ratings table (create if not exist in DB: course_ratings (id uuid, course_id text, user_id text, rating int, created_at timestamptz default now(), updated_at timestamptz default now()))
  const { data, error } = await supabaseAdmin
    .from("course_ratings")
    .select("rating")
    .eq("course_id", courseId);
  if (error) return null;
  if (!data || !data.length) return 0;
  type RatingRow = { rating: number };
  const avg =
    (data as RatingRow[]).reduce(
      (s: number, r: RatingRow) => s + Number(r.rating || 0),
      0
    ) / data.length;
  // Update courses.rating (capped max 5)
  const safeAvg = Math.min(5, Math.round(avg * 10) / 10);
  await supabaseAdmin
    .from("courses")
    .update({ rating: safeAvg })
    .eq("id", courseId);
  return safeAvg;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const courseId = params.id;
  const url = new URL(_req.url);
  const userId = url.searchParams.get("userId") || "";
  if (!courseId) {
    return NextResponse.json(
      { success: false, error: "courseId required" },
      { status: 400 }
    );
  }
  // fetch user rating
  let userRating: number | null = null;
  if (userId) {
    const { data: ur } = await supabaseAdmin
      .from("course_ratings")
      .select("rating")
      .eq("course_id", courseId)
      .eq("user_id", userId)
      .maybeSingle();
    if (ur) userRating = ur.rating as number;
  }
  // course average (already stored in courses table)
  const { data: courseRow } = await supabaseAdmin
    .from("courses")
    .select("rating")
    .eq("id", courseId)
    .maybeSingle();
  return NextResponse.json({
    success: true,
    rating: userRating,
    average: courseRow?.rating ?? 0,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const courseId = params.id;
  const body = await req.json().catch(() => ({}));
  const userId = (body.userId || "").trim();
  const rating = Number(body.rating);
  if (!courseId || !userId || !rating) {
    return NextResponse.json(
      { success: false, error: "courseId,userId,rating required" },
      { status: 400 }
    );
  }
  if (rating < 1 || rating > 5) {
    return NextResponse.json(
      { success: false, error: "rating must be 1..5" },
      { status: 400 }
    );
  }
  // Upsert logic: try update existing else insert
  const { data: existing } = await supabaseAdmin
    .from("course_ratings")
    .select("id")
    .eq("course_id", courseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    const upd = await supabaseAdmin
      .from("course_ratings")
      .update({ rating, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (upd.error)
      return NextResponse.json(
        { success: false, error: upd.error.message },
        { status: 500 }
      );
  } else {
    const ins = await supabaseAdmin.from("course_ratings").insert({
      course_id: courseId,
      user_id: userId,
      rating,
    });
    if (ins.error)
      return NextResponse.json(
        { success: false, error: ins.error.message },
        { status: 500 }
      );
  }
  const avg = await recalcAverage(courseId);
  return NextResponse.json({ success: true, average: avg, rating });
}
