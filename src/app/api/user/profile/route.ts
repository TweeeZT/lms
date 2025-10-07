import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
if (!url || !serviceRole) {
  // Provide a clearer server-side error during development
  console.error(
    "Supabase server client not configured. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
}
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
  // Ensure server Supabase client is configured
  if (!url || !serviceRole) {
    console.error(
      "Supabase server client not configured in /api/user/profile. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
    return NextResponse.json(
      {
        success: false,
        error: "Server misconfigured: missing Supabase credentials",
      },
      { status: 500 }
    );
  }
  try {
    // Try to select including scratch_username. If the column doesn't exist
    // (migration not applied), retry the select without it so profile still loads.
    let u: any = null;
    const selectWithScratch =
      "id, email, username, full_name, avatar, phone, bio, role, created_at, updated_at, scratch_username";
    const selectWithoutScratch =
      "id, email, username, full_name, avatar, phone, bio, role, created_at, updated_at";
    const first = await supabase
      .from("users")
      .select(selectWithScratch)
      .eq("id", userId)
      .maybeSingle();
    if (first.error) {
      const msg = (first.error && (first.error as any).message) || "";
      // detect missing column error (Postgres reports column "..." does not exist)
      if (
        msg.toLowerCase().includes("scratch_username") &&
        msg.toLowerCase().includes("does not exist")
      ) {
        console.warn(
          "scratch_username column missing; retrying user select without it"
        );
        const second = await supabase
          .from("users")
          .select(selectWithoutScratch)
          .eq("id", userId)
          .maybeSingle();
        if (second.error) {
          console.error(
            "Supabase error fetching user (without scratch_username):",
            second.error
          );
          throw second.error;
        }
        u = second.data;
      } else {
        console.error("Supabase error fetching user:", first.error);
        throw first.error;
      }
    } else {
      u = first.data;
    }
    // Allow any existing user to view their profile summary (role-agnostic)
    if (!u) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Fetch student stats (level/points/balance) from students table
    const { data: student, error: sErr } = await supabase
      .from("students")
      .select("*")
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
    const parsedProgress = (progress || []).map((p) => {
      let mods: unknown = p.completed_modules as unknown;
      // Handle both JSON array and stringified JSON stored in DB
      if (typeof mods === "string") {
        try {
          mods = JSON.parse(mods);
        } catch {
          mods = [];
        }
      }
      const arr = Array.isArray(mods) ? (mods as unknown[]) : [];
      return { course_id: p.course_id as string, completed_modules: arr };
    });
    const modulesCompleted = parsedProgress.reduce((acc, p) => {
      return acc + p.completed_modules.length;
    }, 0);

    // For completed courses, we may check if completed_modules equals total_modules.
    // Fetch courses total_modules for those in progress
    const courseIds = Array.from(
      new Set(parsedProgress.map((p) => p.course_id))
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
    parsedProgress.forEach((p) => {
      const tot = coursesTotalMap.get(p.course_id) || 0;
      const done = p.completed_modules.length;
      if (tot && done >= tot) completedCourses.add(p.course_id);
    });

    // Use stored XP strictly from DB (no heuristic)
    const stuAny: unknown = student as unknown;
    const stu =
      stuAny && typeof stuAny === "object"
        ? (stuAny as {
            level?: number | null;
            points?: number | null;
            balance?: number | null;
            xp?: number | null;
          })
        : ({} as {
            level?: number | null;
            points?: number | null;
            balance?: number | null;
            xp?: number | null;
          });
    const level = Number(stu.level ?? 1);
    const points = Number(stu.points ?? 0);
    const storedXP = Number(stu.xp ?? 0);
    const currentXP = storedXP;
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
        scratchUsername: (u as any).scratch_username ?? null,
        level,
        points,
        balance: stu.balance ?? 0,
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
    // In development return details to help debugging; in production keep message minimal
    const details =
      err && typeof err === "object" && "message" in (err as any)
        ? (err as any).message
        : undefined;
    console.error("Error in /api/user/profile:", err);
    return NextResponse.json(
      {
        success: false,
        error: msg,
        details: process.env.NODE_ENV === "production" ? undefined : details,
      },
      { status: 500 }
    );
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
    // Ensure server Supabase client is configured
    if (!url || !serviceRole) {
      console.error(
        "Supabase server client not configured in /api/user/profile PATCH. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
      );
      return NextResponse.json(
        {
          success: false,
          error: "Server misconfigured: missing Supabase credentials",
        },
        { status: 500 }
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
