import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/instructor/earnings
// Query:
// - instructorId=<uuid> (required)
// - startDate=YYYY-MM-DD (optional)
// - endDate=YYYY-MM-DD (optional)
// - range=week|month|quarter|year (fallback if dates not provided)
// - page=1
// - limit=10
// - search=string (filters user_name or course_title)
// - sortBy=date|course_title|user_name|status|amount
// - sortDir=asc|desc
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  const range = (searchParams.get("range") || "month") as
    | "week"
    | "month"
    | "quarter"
    | "year";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get("limit") || 10))
  );
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");

  let dateFilter: { gte?: string; lte?: string } = {};
  if (startDateParam && endDateParam) {
    dateFilter = { gte: startDateParam, lte: endDateParam };
  } else if (startDateParam) {
    dateFilter = { gte: startDateParam };
  } else if (endDateParam) {
    dateFilter = { lte: endDateParam };
  }
  // kalau kosong, biarin tanpa filter → tampil semua

  const search = (searchParams.get("search") || "").trim();
  const sortBy = (searchParams.get("sortBy") || "date") as
    | "date"
    | "course_title"
    | "user_name"
    | "status"
    | "amount";
  const sortDir = (searchParams.get("sortDir") || "desc") as "asc" | "desc";
  if (!instructorId) {
    return NextResponse.json(
      { success: false, error: "instructorId wajib" },
      { status: 400 }
    );
  }
  try {
    // Validate instructor
    const { data: inst } = await supabase
      .from("instructors")
      .select("user_id")
      .eq("user_id", instructorId)
      .maybeSingle();
    if (!inst)
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );

    // Commission percent from platform_settings
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("commission_percent")
      .eq("id", "settings")
      .maybeSingle();
    const commissionPercent = Number(settings?.commission_percent ?? 10);

    // Date range
    const now = new Date();
    const end = endDateParam ? new Date(endDateParam) : now;
    const start = startDateParam
      ? new Date(startDateParam)
      : (() => {
          const s = new Date(end);
          if (range === "week") s.setDate(end.getDate() - 7);
          else if (range === "month") s.setMonth(end.getMonth() - 1);
          else if (range === "quarter") s.setMonth(end.getMonth() - 3);
          else if (range === "year") s.setFullYear(end.getFullYear() - 1);
          return s;
        })();
    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);
    // For transactions.timestamptz we want end-of-day inclusive; use end-exclusive bound
    const endExclusive = (() => {
      const e = new Date(end);
      e.setDate(e.getDate() + 1);
      return e.toISOString().slice(0, 10);
    })();

    // Revenues table per day for instructor
    const { data: revs } = await supabase
      .from("revenues")
      .select("date, gross_revenue, net_revenue, commission_percent")
      .eq("instructor_id", instructorId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });
    const trend = (revs || []).map((r) => ({
      date: r.date as unknown as string,
      gross: Number(r.gross_revenue || 0),
      commission: Math.round(
        (Number(r.gross_revenue || 0) *
          Number(r.commission_percent ?? commissionPercent)) /
          100
      ),
      net: Number(r.net_revenue || 0),
    }));

    // Calculate totals from transactions with date filter (completed only)
    const { data: rangedTrx } = await supabase
      .from("transactions")
      .select("amount, status, date")
      .eq("instructors_id", instructorId)
      .eq("status", "completed")
      .gte("date", startDate)
      .lt("date", endExclusive);

    const totals = (rangedTrx || []).reduce(
      (a, x) => {
        const gross = Number(x.amount || 0);
        const commission = Math.round((gross * commissionPercent) / 100);
        const net = gross - commission;
        a.gross += gross;
        a.commission += commission;
        a.net += net;
        return a;
      },
      { gross: 0, commission: 0, net: 0 }
    );

    // Transactions joined by instructor: assuming transactions has course_id; we need courses to filter by instructor
    const { data: courses } = await supabase
      .from("courses")
      .select("id")
      .eq("instructor_id", inst?.user_id);

    const courseIds = (courses || []).map((c) => c.id);

    type TransactionRow = {
      id: string;
      date: string;
      user_id?: string | null;
      user_name: string;
      course_id: string;
      course_title: string;
      amount: number;
      method: string;
      status: string;
    };
    let trxItems: TransactionRow[] = [];
    let trxCount = 0;
    if (courseIds.length) {
      // Supabase range pagination for filtered list
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      let q = supabase
        .from("transactions")
        .select(
          "id, date, user_id, user_name, course_id, course_title, amount, method, status",
          { count: "exact" }
        )
        .in("course_id", courseIds)
        .gte("date", startDate) // inclusive start
        .lt("date", endExclusive); // end-exclusive to include full end day

      if (dateFilter.gte) q = q.gte("date", dateFilter.gte + "T00:00:00");
      if (dateFilter.lte) q = q.lte("date", dateFilter.lte + "T23:59:59");

      if (search) {
        const term = search.replace(/%/g, "");
        q = q.or(`user_name.ilike.%${term}%,course_title.ilike.%${term}%`);
      }

      // Sort mapping with default date desc
      const allowedSort: Record<string, string> = {
        date: "date",
        course_title: "course_title",
        user_name: "user_name",
        status: "status",
        amount: "amount",
      };
      const sortCol = allowedSort[sortBy] || "date";
      q = q.order(sortCol, { ascending: sortDir === "asc" });

      const { data: tx, count } = await q.range(from, to);
      trxItems = tx || [];
      trxCount = count || 0;
    }

    return NextResponse.json({
      success: true,
      commissionPercent,
      totals,
      trend,
      transactions: { items: trxItems, total: trxCount, page, limit },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal memuat earnings";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
