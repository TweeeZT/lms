import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Auth client (anon) and admin client (service role) for DB reads
const supabaseAuth = createClient(url, anon);
const supabaseAdmin = createClient(url, serviceRole);

export async function POST(req: Request) {
  try {
    const { email, password } = (await req.json()) as {
      email?: string;
      password?: string;
    };
    if (!email || !password)
      return NextResponse.json(
        { success: false, error: "Email dan password wajib" },
        { status: 400 }
      );

    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });
    if (error)
      return NextResponse.json(
        {
          success: false,
          error: /invalid login credentials/i.test(error.message)
            ? "Email atau password salah"
            : error.message,
        },
        { status: 401 }
      );

    const userId = data.user?.id;
    const userEmail = data.user?.email ?? email;
    if (!userId)
      return NextResponse.json(
        { success: false, error: "Session tidak ditemukan" },
        { status: 500 }
      );

    // Fetch profile from public.users by id or email
    let profile = null as {
      id: string;
      email: string;
      username: string;
      full_name: string;
      avatar?: string | null;
      phone?: string | null;
      bio?: string | null;
      role?: "admin" | "instructor" | "user" | null;
      created_at: string;
      updated_at: string;
    } | null;

    const byId = await supabaseAdmin
      .from("users")
      .select(
        "id, email, username, full_name, avatar, phone, bio, role, created_at, updated_at"
      )
      .eq("id", userId)
      .maybeSingle();
    if (!byId.error && byId.data) profile = byId.data;

    if (!profile && userEmail) {
      const byEmail = await supabaseAdmin
        .from("users")
        .select(
          "id, email, username, full_name, avatar, phone, bio, role, created_at, updated_at"
        )
        .eq("email", userEmail)
        .maybeSingle();
      if (!byEmail.error && byEmail.data) profile = byEmail.data;
    }

    if (!profile)
      return NextResponse.json(
        { success: false, error: "Profil tidak ditemukan" },
        { status: 404 }
      );

    // Resolve role if null by checking role tables
    let role = profile.role ?? null;
    if (!role) {
      // Admins may use either id or user_id as FK; check both
      const adminById = await supabaseAdmin
        .from("admins")
        .select("id")
        .eq("id", profile.id)
        .maybeSingle();
      const adminByUserId = adminById.data
        ? { data: null, error: null }
        : await supabaseAdmin
            .from("admins")
            .select("user_id")
            .eq("user_id", profile.id)
            .maybeSingle();

      // Instructors table (try user_id then id)
      const instrByUserId = await supabaseAdmin
        .from("instructors")
        .select("user_id")
        .eq("user_id", profile.id)
        .maybeSingle();
      const instrById = instrByUserId.data
        ? { data: null, error: null }
        : await supabaseAdmin
            .from("instructors")
            .select("id")
            .eq("id", profile.id)
            .maybeSingle();

      // Students table (try user_id then id)
      const studByUserId = await supabaseAdmin
        .from("students")
        .select("user_id")
        .eq("user_id", profile.id)
        .maybeSingle();
      const studById = studByUserId.data
        ? { data: null, error: null }
        : await supabaseAdmin
            .from("students")
            .select("id")
            .eq("id", profile.id)
            .maybeSingle();

      if (
        (!adminById.error && adminById.data) ||
        (!adminByUserId.error && adminByUserId.data)
      ) {
        role = "admin";
      } else if (
        (!instrByUserId.error && instrByUserId.data) ||
        (!instrById.error && instrById.data)
      ) {
        role = "instructor";
      } else if (
        (!studByUserId.error && studByUserId.data) ||
        (!studById.error && studById.data)
      ) {
        role = "user";
      } else {
        role = "user";
      }
    }

    const res = NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        username: profile.username,
        fullName: profile.full_name,
        role,
        avatar: profile.avatar ?? undefined,
        phone: profile.phone ?? undefined,
        bio: profile.bio ?? undefined,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      },
    });
    // Set lightweight cookies for persistence and quick client redirects
    const maxAge = 60 * 60 * 24 * 30; // 30 days
    res.headers.append(
      "Set-Cookie",
      `a_role=${role}; Path=/; Max-Age=${maxAge}; SameSite=Lax;` +
        (process.env.NODE_ENV === "production" ? " Secure;" : "")
    );
    res.headers.append(
      "Set-Cookie",
      `a_uid=${profile.id}; Path=/; Max-Age=${maxAge}; SameSite=Lax;` +
        (process.env.NODE_ENV === "production" ? " Secure;" : "")
    );
    res.headers.append(
      "Set-Cookie",
      `a_uname=${encodeURIComponent(
        profile.full_name || profile.username
      )}; Path=/; Max-Age=${maxAge}; SameSite=Lax;` +
        (process.env.NODE_ENV === "production" ? " Secure;" : "")
    );
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Login gagal";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
