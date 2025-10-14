import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/instructor/dashboard?instructorId=<uuid>
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  if (!instructorId) {
    return NextResponse.json(
      { success: false, error: "instructorId wajib" },
      { status: 400 }
    );
  }

  try {
    type CourseRow = {
      id: string;
      title: string;
      thumbnail: string | null;
      category: string;
      price: number | null;
      duration_min: number | null;
      level: string;
      total_modules: number | null;
      enrolled_count: number | null;
      rating: number | null;
      is_published: boolean | null;
      created_at: string;
      updated_at: string;
    };

    // 1) Profile
    const profileQ = await supabase
      .from("users")
      .select(
        "id, email, username, full_name, avatar, phone, bio, role, created_at, updated_at"
      )
      .eq("id", instructorId)
      .maybeSingle();
    if (profileQ.error || !profileQ.data) {
      return NextResponse.json(
        { success: false, error: "Instruktur tidak ditemukan" },
        { status: 404 }
      );
    }

    // 2) Instructor row
    const instQ = await supabase
      .from("instructors")
      .select("user_id, total_earnings, rating, bank_account")
      .eq("user_id", instructorId)
      .maybeSingle();

    // 3) Courses
    const coursesQ = await supabase
      .from("courses")
      .select(
        "id, title, thumbnail, category, price, duration_min, level, total_modules, enrolled_count, rating, is_published, created_at, updated_at"
      )
      .eq("instructor_id", instructorId)
      .order("created_at", { ascending: false });

    const courses = (coursesQ.data || []) as CourseRow[];

    // 4) Payouts
    const payoutsQ = await supabase
      .from("payouts")
      .select("id, amount, date, status")
      .eq("instructor_id", instructorId)
      .order("date", { ascending: false })
      .limit(12);

    // 5) Recent purchases (payments) for this instructor's courses
    type PaymentRow = {
      id: string;
      amount: number;
      created_at: string;
      course_id: string;
      user_id: string;
      status?: string | null;
    };
    let purchases: Array<{
      id: string;
      amount: number;
      date: string;
      courseId: string;
      courseTitle: string;
      userId: string;
      userName: string;
      userEmail?: string | null;
    }> = [];
    if (courses.length) {
      const courseIds = courses.map((c) => c.id);
      const paymentsQ = await supabase
        .from("payments")
        .select("id, amount, created_at, course_id, user_id, status")
        .in("course_id", courseIds)
        .order("created_at", { ascending: false })
        .limit(10);

      const paymentRows = (paymentsQ.data || []) as PaymentRow[];
      if (paymentRows.length) {
        const userIds = Array.from(new Set(paymentRows.map((p) => p.user_id)));
        const [usersQ, coursesBriefQ] = await Promise.all([
          supabase
            .from("users")
            .select("id, full_name, email")
            .in("id", userIds),
          supabase
            .from("courses")
            .select("id, title")
            .in("id", Array.from(new Set(paymentRows.map((p) => p.course_id)))),
        ]);

        type UserBrief = {
          id: string;
          full_name: string;
          email: string | null;
        };
        const userMap = new Map<string, UserBrief>();
        (usersQ.data || []).forEach((u: UserBrief) =>
          userMap.set(u.id, {
            id: u.id,
            full_name: u.full_name,
            email: u.email,
          })
        );
        type CourseBrief = { id: string; title: string };
        const courseMap = new Map<string, CourseBrief>();
        (coursesBriefQ.data || []).forEach((c: CourseBrief) =>
          courseMap.set(c.id, { id: c.id, title: c.title })
        );

        purchases = paymentRows.map((p) => ({
          id: p.id,
          amount: p.amount,
          date: p.created_at,
          courseId: p.course_id,
          courseTitle: courseMap.get(p.course_id)?.title || "",
          userId: p.user_id,
          userName: userMap.get(p.user_id)?.full_name || "",
          userEmail: userMap.get(p.user_id)?.email || null,
        }));
      }
    }

    // Derive stats
    const totalStudents = courses.reduce(
      (s, c) => s + (c.enrolled_count || 0),
      0
    );

    // Calculate totalEarnings from transactions table
    let totalEarnings = 0;
    if (courses.length) {
      const courseIds = courses.map((c) => c.id);
      const { data: transactionsData } = await supabase
        .from("transactions")
        .select("amount, status")
        .eq("instructors_id", instructorId)
        .in("status", ["paid", "completed"]);

      totalEarnings = (transactionsData || []).reduce(
        (sum, t) => sum + (Number(t.amount) || 0),
        0
      );
    }

    const avgRating = courses.length
      ? courses.reduce((s: number, c) => s + (c.rating || 0), 0) /
        courses.length
      : instQ.data?.rating || 0;

    // Monthly series from payouts by month; fallback to 6 months zeros if none
    const byMonth = new Map<string, { revenue: number; orders: number }>();
    for (const p of payoutsQ.data || []) {
      const d = new Date(p.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      const prev = byMonth.get(key) || { revenue: 0, orders: 0 };
      byMonth.set(key, {
        revenue: prev.revenue + p.amount,
        orders: prev.orders + 1,
      });
    }
    const months = Array.from(byMonth.entries()).sort((a, b) =>
      a[0] < b[0] ? -1 : 1
    );

    return NextResponse.json({
      success: true,
      profile: profileQ.data,
      instructor: instQ.data || null,
      stats: {
        coursesCount: courses.length,
        totalStudents,
        totalEarnings,
        avgRating,
      },
      courses,
      payouts: payoutsQ.data || [],
      purchases,
      monthly: months.map(([month, v]) => ({
        month,
        revenue: v.revenue,
        orders: v.orders,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat data";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
