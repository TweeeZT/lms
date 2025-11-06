import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Ensure Node runtime so service role env vars are available (Edge can strip them)
export const runtime = "nodejs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/instructor/dashboard?instructorId=<uuid>
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  // Monthly trend window controls
  const offsetMonths = Math.max(
    0,
    Number(searchParams.get("offsetMonths") || 0)
  );
  const windowMonths = Math.min(
    12,
    Math.max(1, Number(searchParams.get("months") || 6))
  );
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

    // 3) Courses (preview list) + exact count for accuracy
    const coursesQ = await supabase
      .from("courses")
      .select(
        "id, title, thumbnail, category, price, duration_min, level, total_modules, enrolled_count, rating, is_published, created_at, updated_at"
      )
      .eq("instructor_id", instructorId)
      .order("created_at", { ascending: false })
      .limit(12);

    // Head count for total courses (even if list is limited)
    const { count: coursesCountExact, error: coursesCountError } = await supabase
      .from("courses")
      .select("id", { count: "exact", head: true })
      .eq("instructor_id", instructorId);

    const courses = (coursesQ.data || []) as CourseRow[];

    // 4) Payouts
    const payoutsQ = await supabase
      .from("payouts")
      .select("id, amount, date, status")
      .eq("instructor_id", instructorId)
      .order("date", { ascending: false })
      .limit(12);

  // 5) Recent purchases from transactions table (completed/paid)
    type TransactionRow = {
      id: string;
      amount: number;
      date: string;
      course_id: string;
      course_title?: string | null;
      user_id?: string | null;
      user_name?: string | null;
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
    {
      // Try direct filter by instructors_id first
      const trxByInstructor = await supabase
        .from("transactions")
        .select(
          "id, amount, date, course_id, course_title, user_id, user_name, status"
        )
        .eq("instructors_id", instructorId)
        .order("date", { ascending: false })
        .limit(10);

      let trxRows = (trxByInstructor.data || []) as TransactionRow[];

      // Fallback: use course_id mapping if direct filter returns empty
      if (!trxRows.length && courses.length) {
        const courseIds = courses.map((c) => c.id);
        const trxByCourses = await supabase
          .from("transactions")
          .select(
            "id, amount, date, course_id, course_title, user_id, user_name, status"
          )
          .in("course_id", courseIds)
          .order("date", { ascending: false })
          .limit(10);
        trxRows = (trxByCourses.data || []) as TransactionRow[];
      }

      if (trxRows.length) {
        const userIds = Array.from(
          new Set(trxRows.map((p) => p.user_id).filter(Boolean))
        ) as string[];
        const { data: usersBrief } = await supabase
          .from("users")
          .select("id, full_name, email")
          .in("id", userIds);
        const userMap = new Map<
          string,
          { full_name: string; email: string | null }
        >();
        (usersBrief || []).forEach((u) =>
          userMap.set(u.id, { full_name: u.full_name, email: u.email })
        );

        purchases = trxRows.map((p) => ({
          id: p.id,
          amount: Number(p.amount || 0),
          date: p.date,
          courseId: p.course_id,
          courseTitle: p.course_title || "",
          userId: p.user_id || "",
          userName:
            p.user_name ||
            (p.user_id ? userMap.get(p.user_id)?.full_name || "" : ""),
          userEmail: p.user_id ? userMap.get(p.user_id)?.email || null : null,
        }));
      }
    }

  // Calculate totalEarnings and uniqueStudents (unique buyers) from transactions table
  let totalEarnings = 0;
  let uniqueStudents = 0;
    {
      // Primary: by instructors_id
      const { data: trxByInstructor } = await supabase
        .from("transactions")
        .select("amount, status, user_id")
        .eq("instructors_id", instructorId);

      let rows = trxByInstructor || [];

      // Fallback: by course_id if above empty
      if (!rows.length && courses.length) {
        const courseIds = courses.map((c) => c.id);
        const { data: trxByCourses } = await supabase
          .from("transactions")
          .select("amount, status, course_id, user_id")
          .in("course_id", courseIds);
        rows = trxByCourses || [];
      }

      const successStatuses = new Set([
        "paid",
        "completed",
        "success",
        "berhasil",
        "settled",
        "succeeded",
      ]);
      const uniqueUsers = new Set<string>();
      totalEarnings = (rows || []).reduce((sum, t) => {
        const s = String((t as any).status || "").toLowerCase();
        if (successStatuses.has(s)) {
          const amt = Number((t as any).amount) || 0;
          const uid = String((t as any).user_id || "");
          if (uid) uniqueUsers.add(uid);
          return sum + amt;
        }
        return sum;
      }, 0);
      uniqueStudents = uniqueUsers.size;
    }

    // Total siswa dalam kursus: jumlahkan enrolled_count dari SEMUA kursus milik instruktur ini
    // Gunakan query terpisah tanpa limit agar tidak terpotong oleh limit preview list
    let totalStudents = 0;
    {
      const { data: enrollRows } = await supabase
        .from("courses")
        .select("enrolled_count")
        .eq("instructor_id", instructorId);
      if (Array.isArray(enrollRows)) {
        totalStudents = enrollRows.reduce(
          (sum, r: any) => sum + (Number(r?.enrolled_count) || 0),
          0
        );
      } else {
        // Fallback to preview list sum if for some reason data is null
        totalStudents = courses.reduce(
          (sum, c) => sum + (Number(c.enrolled_count) || 0),
          0
        );
      }
    }

      // Rata-rata rating semua course milik instruktur (tanpa limit),
      // dihitung dari kolom rating yang bernilai angka (abaikan null/undefined/NaN).
      let avgRating = 0;
      {
        const { data: ratingRows } = await supabase
          .from("courses")
          .select("rating")
          .eq("instructor_id", instructorId);
        const ratingValues = (ratingRows || [])
          .map((r: any) => Number(r?.rating))
          .filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
        if (ratingValues.length) {
          const total = ratingValues.reduce((s, v) => s + v, 0);
          avgRating = total / ratingValues.length;
        }
      }

    // Helper: month arithmetic and formatting
    const startOfMonth = (dt: Date) =>
      new Date(dt.getFullYear(), dt.getMonth(), 1, 0, 0, 0, 0);
    const addMonths = (dt: Date, n: number) =>
      new Date(dt.getFullYear(), dt.getMonth() + n, 1, 0, 0, 0, 0);
    const formatMonth = (dt: Date) =>
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;

    // Build range [from, to)
    const now = new Date();
    const endMonth = startOfMonth(addMonths(now, -offsetMonths)); // inclusive end month
    const fromMonth = startOfMonth(addMonths(endMonth, -(windowMonths - 1)));
    const fromISO = fromMonth.toISOString();
    const toISO = addMonths(endMonth, 1).toISOString();

    // Initialize months bucket with zeros
    const monthsKeys: string[] = [];
    for (let i = 0; i < windowMonths; i++) {
      const d = addMonths(fromMonth, i);
      monthsKeys.push(formatMonth(d));
    }
    const byMonth = new Map<string, { revenue: number; orders: number }>();
    monthsKeys.forEach((k) => byMonth.set(k, { revenue: 0, orders: 0 }));

    // Aggregate from transactions in range
    const successStatuses = new Set([
      "paid",
      "completed",
      "success",
      "berhasil",
      "settled",
      "succeeded",
    ]);

    let trxRowsRange:
      | Array<{ amount: number; status: string | null; date: string; course_id?: string | null }>
      | null = null;
    {
      const { data: trx } = await supabase
        .from("transactions")
        .select("amount, status, date, course_id")
        .eq("instructors_id", instructorId)
        .gte("date", fromISO)
        .lt("date", toISO);
      trxRowsRange = trx as any[] | null;
      if ((!trxRowsRange || trxRowsRange.length === 0) && courses.length) {
        const courseIds = courses.map((c) => c.id);
        const { data: trx2 } = await supabase
          .from("transactions")
          .select("amount, status, date, course_id")
          .in("course_id", courseIds)
          .gte("date", fromISO)
          .lt("date", toISO);
        trxRowsRange = trx2 as any[] | null;
      }
    }
    for (const t of trxRowsRange || []) {
      const d = new Date((t as any).date);
      if (isNaN(d.getTime())) continue;
      const key = formatMonth(d);
      if (!byMonth.has(key)) continue; // outside range (defensive)
      const st = String((t as any).status || "").toLowerCase();
      if (successStatuses.has(st)) {
        const prev = byMonth.get(key)!;
        byMonth.set(key, {
          revenue: prev.revenue + (Number((t as any).amount) || 0),
          orders: prev.orders + 1,
        });
      }
    }

    const months = monthsKeys.map((k) => ({
      month: k,
      revenue: byMonth.get(k)!.revenue,
      orders: byMonth.get(k)!.orders,
    }));

    return NextResponse.json({
      success: true,
      profile: profileQ.data,
      instructor: instQ.data || null,
      stats: {
        coursesCount: typeof coursesCountExact === "number" ? coursesCountExact : courses.length,
        totalStudents,
        totalEarnings,
        avgRating,
      },
      courses,
      payouts: payoutsQ.data || [],
      purchases,
      monthly: months,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat data";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
