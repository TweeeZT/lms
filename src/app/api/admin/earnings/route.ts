import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseServer";

// Helper: parse number with bounds
function parseNum(val: string | null, def: number, min: number, max: number) {
  const n = Number(val);
  if (Number.isFinite(n)) return Math.min(max, Math.max(min, n));
  return def;
}

// GET /api/admin/earnings?userId=...&page=&limit=&q=&status=&method=&sortBy=&sortDir=
// Only admins can access. Returns transactions + summary + payouts aggregation.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const actorId = (searchParams.get("userId") || "").trim();
  if (!actorId) {
    return NextResponse.json(
      { success: false, error: "userId required" },
      { status: 400 }
    );
  }

  // Auth check
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

  const page = parseNum(searchParams.get("page"), 1, 1, 5000);
  const limit = parseNum(searchParams.get("limit"), 10, 1, 100);
  const q = (searchParams.get("q") || "").trim();
  const status = (searchParams.get("status") || "").trim();
  const method = (searchParams.get("method") || "").trim();
  const sortByRaw = (searchParams.get("sortBy") || "date").trim();
  const sortDirRaw = (searchParams.get("sortDir") || "desc")
    .trim()
    .toLowerCase();

  type SortCol =
    | "date"
    | "user_name"
    | "course_title"
    | "method"
    | "status"
    | "amount";
  const allowedSort: SortCol[] = [
    "date",
    "user_name",
    "course_title",
    "method",
    "status",
    "amount",
  ];
  const sortBy: SortCol = allowedSort.includes(sortByRaw as SortCol)
    ? (sortByRaw as SortCol)
    : "date";
  const sortDir: "asc" | "desc" = sortDirRaw === "asc" ? "asc" : "desc";

  try {
    let query = supabaseAdmin
      .from("transactions")
      .select(
        "id, date, user_id, user_name, course_id, course_title, amount, method, status, instructors_id",
        { count: "exact" }
      );

    if (status) {
      const s = status.toLowerCase();
      if (s === "completed" || s === "paid") {
        query = query.in("status", ["completed", "paid"]);
      } else {
        query = query.eq("status", status);
      }
    }
    if (method) query = query.eq("method", method);

    // Simple text search (ILIKE) across user_name, course_title, id
    if (q) {
      const safe = q.replace(/%/g, "");
      query = query.or(
        `user_name.ilike.%${safe}%,course_title.ilike.%${safe}%,id.ilike.%${safe}%`
      );
    }

    query = query.order(sortBy, { ascending: sortDir === "asc" });

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data: rows, error, count } = await query.range(from, to);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Failed to load transactions",
        },
        { status: 500 }
      );
    }

    const items = (rows || []).map((r) => {
      const raw = String(r.status || "").toLowerCase();
      // Normalize: treat 'completed' as canonical 'paid' for clients
      const normalizedStatus = raw === "completed" ? "paid" : raw;
      const status_label =
        normalizedStatus === "paid"
          ? "Selesai"
          : normalizedStatus === "pending"
          ? "Menunggu"
          : normalizedStatus === "failed"
          ? "Gagal"
          : r.status;
      return {
        ...r,
        status: normalizedStatus,
        status_label,
      };
    });

    // Summary calculations (server side for accuracy) - operate on filtered set but without pagination.
    // For full summary ignoring pagination, re-run count query without range.
    let summaryTotalRevenue = 0;
    let summaryTotalOrders = 0;
    items.forEach((r) => {
      // Only count revenue for completed/paid transactions
      const s = String(r.status).toLowerCase();
      if (s === "paid") {
        summaryTotalRevenue += Number(r.amount || 0);
        summaryTotalOrders += 1;
      }
    });
    const summaryAvgOrder = summaryTotalOrders
      ? Math.round(summaryTotalRevenue / summaryTotalOrders)
      : 0;

    // Payout aggregation per instructor (join via instructors_id is stored in transactions table?)
    // We rely on transactions table only: group by user_name? Instead, instructor payout logically refers to instructor of the course.
    // Assuming transactions table has instructors_id (as shown in Supabase UI). We'll select additional field if present.
    const { data: payoutSource } = await supabaseAdmin
      .from("transactions")
      .select("instructors_id, amount, status, course_title")
      .neq("instructors_id", "")
      .not("instructors_id", "is", null);

    interface PayoutAggRow {
      instructors_id: string | null;
      amount: number | null;
      status: string | null;
      course_title: string | null;
    }
    const instructorRevenue = new Map<
      string,
      {
        instructorId: string;
        total: number;
        completed: number;
        pending: number;
      }
    >();
    ((payoutSource as PayoutAggRow[] | null) || []).forEach((r) => {
      if (!r || !r.instructors_id) return;
      const key = r.instructors_id;
      if (!instructorRevenue.has(key)) {
        instructorRevenue.set(key, {
          instructorId: key,
          total: 0,
          completed: 0,
          pending: 0,
        });
      }
      const agg = instructorRevenue.get(key)!;
      const amt = Number(r.amount || 0);
      agg.total += amt;
      const s = String(r.status || "").toLowerCase();
      if (s === "completed" || s === "paid") agg.completed += amt;
      else if (s === "pending") agg.pending += amt;
    });

    const instructorTotals = Array.from(instructorRevenue.values());

    // Distinct payment methods list (for client filter UI)
    const { data: methodRows } = await supabaseAdmin
      .from("transactions")
      .select("method")
      .not("method", "is", null);
    const methods = Array.from(
      new Set(
        (methodRows || [])
          .map((m: { method?: string | null }) => m.method || "")
          .filter((v) => v && v.trim().length > 0)
      )
    ).sort();

    return NextResponse.json({
      success: true,
      items,
      total: count || 0,
      page,
      limit,
      summary: {
        totalRevenue: summaryTotalRevenue,
        totalOrders: summaryTotalOrders,
        avgOrder: summaryAvgOrder,
        activeInstructors: instructorTotals.length,
      },
      instructorTotals,
      methods,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
