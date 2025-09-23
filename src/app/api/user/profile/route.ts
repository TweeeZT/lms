import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/user/profile?userId=...
// Returns basic profile + gamification summary
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = (searchParams.get("userId") || "").trim();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId wajib" },
      { status: 400 }
    );
  }
  try {
    const { data: u, error: uErr } = await supabase
      .from("users")
      .select(
        "id, email, username, full_name, avatar, phone, bio, role, created_at, updated_at"
      )
      .eq("id", userId)
      .maybeSingle();
    if (uErr) throw uErr;
    if (!u || u.role !== "user") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Fetch student stats (level/points/balance) from students table
    const { data: student, error: sErr } = await supabase
      .from("students")
      .select("level, points, balance")
      .eq("user_id", userId)
      .maybeSingle();
    if (sErr) throw sErr;

    // Gamification summary
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("course_id")
      .eq("user_id", userId);
    const coursesEnrolled = (enrollments || []).length;

    const { data: progress } = await supabase
      .from("user_progress")
      .select("course_id, completed_modules")
      .eq("user_id", userId);
    const completedCourses = new Set<string>();
    const modulesCompleted = (progress || []).reduce((acc, p) => {
      const count = Array.isArray(p.completed_modules)
        ? p.completed_modules.length
        : 0;
      // naive: if completed_modules length > 0, count towards modules
      return acc + count;
    }, 0);

    // For completed courses, we may check if completed_modules equals total_modules.
    // Fetch courses total_modules for those in progress
    const courseIds = Array.from(
      new Set((progress || []).map((p) => p.course_id))
    );
    let coursesTotalMap = new Map<string, number>();
    if (courseIds.length) {
      const { data: courses } = await supabase
        .from("courses")
        .select("id, total_modules")
        .in("id", courseIds);
      coursesTotalMap = new Map(
        (courses || []).map((c) => [c.id, c.total_modules || 0])
      );
    }
    (progress || []).forEach((p) => {
      const tot = coursesTotalMap.get(p.course_id) || 0;
      const done = Array.isArray(p.completed_modules)
        ? p.completed_modules.length
        : 0;
      if (tot && done >= tot) completedCourses.add(p.course_id);
    });

    // XP heuristic: points*10 + modulesCompleted*5
    const level = Number(student?.level ?? 1);
    const points = Number(student?.points ?? 0);
    const currentXP = points * 10 + modulesCompleted * 5;
    const nextLevelXP = Math.max(100, level * 200);

    return NextResponse.json({
      success: true,
      user: {
        id: u.id,
        email: u.email,
        username: u.username,
        fullName: u.full_name,
        avatar: u.avatar,
        phone: u.phone,
        bio: u.bio,
        role: u.role,
        level,
        points,
        balance: student?.balance ?? 0,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      },
      summary: {
        coursesEnrolled,
        coursesCompleted: completedCourses.size,
        modulesCompleted,
        currentXP,
        nextLevelXP,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memuat profil";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PATCH /api/user/profile
// Body: { userId, fullName?, username?, phone?, bio? }
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId wajib" },
        { status: 400 }
      );
    }
    const patch: Record<string, unknown> = {};
    if (typeof body.fullName === "string")
      patch.full_name = body.fullName.trim();
    if (typeof body.username === "string")
      patch.username = body.username.trim();
    if (typeof body.phone === "string") patch.phone = body.phone.trim();
    if (typeof body.bio === "string") patch.bio = body.bio.trim();
    if (!Object.keys(patch).length) {
      return NextResponse.json({ success: true, updated: 0 });
    }
    patch.updated_at = new Date().toISOString();
    const { error } = await supabase
      .from("users")
      .update(patch)
      .eq("id", userId);
    if (error) throw error;
    return NextResponse.json({ success: true, updated: 1 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal update profil";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
