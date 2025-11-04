import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseServer";

// GET /api/admin/dashboard?userId=...
// Returns aggregated platform metrics for admin dashboard
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const actorId = (searchParams.get("userId") || "").trim();
  if (!actorId) {
    return NextResponse.json(
      { success: false, error: "userId required" },
      { status: 400 }
    );
  }
  // Auth check (admin only)
  const { data: actor, error: actorErr } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("id", actorId)
    .maybeSingle();
  if (actorErr || !actor || actor.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  try {
    // Parallel aggregate queries
    const [usersAgg, coursesAgg, modulesAgg, discussionsAgg, progressAgg] =
      await Promise.all([
        supabaseAdmin.from("users").select("id, role", { count: "exact" }),
        supabaseAdmin
          .from("courses")
          .select("id, enrolled_count, rating", { count: "exact" })
          .eq("is_published", true),
        supabaseAdmin.from("modules").select("id", { count: "exact" }),
        supabaseAdmin.from("discussion_posts").select("id", { count: "exact" }),
        supabaseAdmin
          .from("user_progress")
          .select("id, course_id", { count: "exact" }),
      ]);

    if (usersAgg.error) throw usersAgg.error;
    if (coursesAgg.error) throw coursesAgg.error;
    if (modulesAgg.error) throw modulesAgg.error;
    if (discussionsAgg.error) throw discussionsAgg.error;
    if (progressAgg.error) throw progressAgg.error;

    interface UserRow {
      id: string;
      role?: string | null;
    }
    interface CourseRow {
      id: string;
      enrolled_count?: number | null;
      rating?: number | string | null;
    }
    const userRows: UserRow[] = Array.isArray(usersAgg.data)
      ? (usersAgg.data as UserRow[])
      : [];
    const courseRows: CourseRow[] = Array.isArray(coursesAgg.data)
      ? (coursesAgg.data as CourseRow[])
      : [];

    // User role distribution
    let adminCount = 0;
    let instructorCount = 0;
    let userCount = 0;
    let schoolCount = 0;
    userRows.forEach((u) => {
      if (u.role === "admin") adminCount++;
      else if (u.role === "instructor") instructorCount++;
      else if (u.role === "school") schoolCount++;
      else userCount++;
    });

    const totalUsers = usersAgg.count || 0;
    const totalCourses = coursesAgg.count || 0;
    const totalModules = modulesAgg.count || 0;
    const totalDiscussions = discussionsAgg.count || 0;

    // Aggregate enrolled_count, rating stats from courses
    let totalEnrolled = 0;
    let ratingSum = 0;
    let ratingCount = 0;
    courseRows.forEach((c) => {
      if (typeof c.enrolled_count === "number")
        totalEnrolled += c.enrolled_count;
      if (c.rating != null) {
        const r = Number(c.rating);
        if (!Number.isNaN(r)) {
          ratingSum += r;
          ratingCount++;
        }
      }
    });
    const avgCourseRating = ratingCount
      ? Number((ratingSum / ratingCount).toFixed(2))
      : 0;

    // Active enrollments from user_progress (distinct user_id+course_id) - approximate: count rows
    const activeEnrollments = progressAgg.count || 0;

    // Compose role distribution for donut chart
    const roleDistribution = [
      { role: "admin", value: adminCount },
      { role: "instructor", value: instructorCount },
      { role: "user", value: userCount },
      { role: "school", value: schoolCount },
    ];

    // Placeholder revenue metrics: derive from transactions if table exists
    const revenueSummary: {
      totalRevenue: number;
      totalOrders: number;
      avgOrder: number;
    } = {
      totalRevenue: 0,
      totalOrders: 0,
      avgOrder: 0,
    };
    try {
      const { data: txRows, error: txErr } = await supabaseAdmin
        .from("transactions")
        .select("amount, status");
      if (!txErr && txRows) {
        let rev = 0;
        let orders = 0;
        (
          txRows as { amount?: number | null; status?: string | null }[]
        ).forEach((t) => {
          const s = String(t.status || "").toLowerCase();
          if (s === "paid" || s === "completed") {
            rev += Number(t.amount || 0);
            orders += 1;
          }
        });
        revenueSummary.totalRevenue = rev;
        revenueSummary.totalOrders = orders;
        revenueSummary.avgOrder = orders ? Math.round(rev / orders) : 0;
      }
    } catch {}

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        totalCourses,
        totalModules,
        totalDiscussions,
        activeEnrollments,
        totalEnrolled,
        avgCourseRating,
        revenue: revenueSummary,
      },
      roleDistribution,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
