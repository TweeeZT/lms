import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/school/leaderboard?schoolUserId=...&limit=5&page=1
// Returns leaderboard limited to a school's students, ranked by the same score metric as global (avg of coursesCompleted, points, xp)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const schoolUserId = searchParams.get("schoolUserId");
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 5)));
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  if (!schoolUserId) {
    return NextResponse.json(
      { success: false, error: "schoolUserId is required" },
      { status: 400 }
    );
  }

  try {
    // 1) Read school_students as the single source of truth (like Manage Students page)
    const { data: ssRows, error: ssErr } = await supabase
      .from("school_students")
      .select("id, user_id, email, name, invited_at")
      .eq("school_user_id", schoolUserId)
      .order("invited_at", { ascending: false });
    if (ssErr) throw ssErr;

    const rows = ssRows || [];
    if (!rows.length) {
      return NextResponse.json({ success: true, items: [], total: 0, page, limit });
    }

  // 2) Enrich avatar (and fill missing user_id via email when possible)
    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
    const emails = Array.from(new Set(rows.map((r: any) => r.email).filter(Boolean)));

    const [byId, byEmail] = await Promise.all([
      userIds.length
        ? supabase.from("users").select("id, avatar").in("id", userIds)
        : Promise.resolve({ data: [] as any[], error: null } as any),
      emails.length
        ? supabase.from("users").select("id, email, avatar").in("email", emails)
        : Promise.resolve({ data: [] as any[], error: null } as any),
    ]);
    if (byId.error) throw byId.error;
    if (byEmail.error) throw byEmail.error;

    const avatarById = new Map<string, string | null>();
    (byId.data || []).forEach((u: any) => avatarById.set(u.id, u.avatar ?? null));

    const userIdByEmail = new Map<string, string>();
    const avatarByEmail = new Map<string, string | null>();
    (byEmail.data || []).forEach((u: any) => {
      if (u.email) userIdByEmail.set(u.email, u.id);
      if (u.email) avatarByEmail.set(u.email, u.avatar ?? null);
    });

    // 3) Build raw records and resolve points from students table
    const records = rows.map((r: any, idx: number) => {
      const resolvedUserId: string | undefined = r.user_id || (r.email ? userIdByEmail.get(r.email) : undefined);
      const avatar: string | null = resolvedUserId
        ? avatarById.get(resolvedUserId) ?? null
        : (r.email ? avatarByEmail.get(r.email) ?? null : null);
      return {
        userId: resolvedUserId as string | undefined,
        email: r.email as string | undefined,
        name: (r.name || r.email || "Siswa") as string,
        avatar,
        invited_at: r.invited_at,
      };
    });

    const resolvedIds = records.map((r) => r.userId).filter(Boolean) as string[];
    const { data: studentsStats, error: stErr } = resolvedIds.length
      ? await supabase
          .from("students")
          .select("user_id, points")
          .in("user_id", resolvedIds)
      : { data: [] as any[], error: null } as any;
    if (stErr) throw stErr;
    const pointsById = new Map<string, number>();
    (studentsStats || []).forEach((s: any) => pointsById.set(s.user_id, Number(s.points || 0)));

    // 4) Sort by points descending (fallback 0) and then by name
    records.sort((a, b) => {
      const pa = a.userId ? pointsById.get(a.userId) || 0 : 0;
      const pb = b.userId ? pointsById.get(b.userId) || 0 : 0;
      if (pb !== pa) return pb - pa;
      return a.name.localeCompare(b.name);
    });

    // 5) Rank + paginate
    const itemsAll = records.map((r, idx) => ({
      rank: idx + 1,
      userId: r.userId || r.email || `school_student_${idx}`,
      name: r.name,
      avatar: r.avatar,
      points: r.userId ? pointsById.get(r.userId) || 0 : 0,
    }));

    const totalAll = itemsAll.length;
    const paged = itemsAll.slice(from, to + 1);

    return NextResponse.json({ success: true, items: paged, total: totalAll, page, limit });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memuat leaderboard sekolah";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
