import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET: List students for a school
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolUserId = searchParams.get("schoolUserId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    if (!schoolUserId) {
      return NextResponse.json(
        { success: false, error: "schoolUserId required" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("school_students")
      .select("*", { count: "exact" })
      .eq("school_user_id", schoolUserId);

    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const offset = (page - 1) * limit;
    const { data, count, error } = await query
      .order("invited_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      students: data || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat siswa";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// POST: Add student by email/username
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { schoolUserId, emailOrUsername } = body;

    if (!schoolUserId || !emailOrUsername) {
      return NextResponse.json(
        { success: false, error: "schoolUserId dan emailOrUsername wajib" },
        { status: 400 }
      );
    }

    // Find user by email or username (including role)
    const { data: users, error: userErr } = await supabase
      .from("users")
      .select("id, email, full_name, username, role")
      .or(`email.eq.${emailOrUsername},username.eq.${emailOrUsername}`)
      .limit(1);

    if (userErr || !users || users.length === 0) {
      return NextResponse.json(
        { success: false, error: "User tidak ditemukan" },
        { status: 404 }
      );
    }

    const targetUser = users[0];

    // Only regular users (siswa) can be added to a school
    // reject admins, instructors, or other school accounts
    if (targetUser.role && targetUser.role !== "user") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Hanya akun pengguna biasa (siswa) yang bisa ditambahkan. Akun ini bukan siswa.",
        },
        { status: 400 }
      );
    }

    // Check if already added
    const { data: existing } = await supabase
      .from("school_students")
      .select("id")
      .eq("school_user_id", schoolUserId)
      .eq("user_id", targetUser.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Siswa sudah ditambahkan" },
        { status: 400 }
      );
    }

    // Insert into school_students
    const { data: inserted, error: insertErr } = await supabase
      .from("school_students")
      .insert({
        school_user_id: schoolUserId,
        email: targetUser.email,
        user_id: targetUser.id,
        name: targetUser.full_name || targetUser.username,
        status: "accepted",
        invited_by: schoolUserId,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return NextResponse.json({
      success: true,
      student: inserted,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menambah siswa";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// DELETE: Remove student
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("school_students")
      .delete()
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal menghapus siswa";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
