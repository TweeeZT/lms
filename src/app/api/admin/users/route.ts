import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const serviceClient = createClient(serviceUrl, serviceKey);

// Utility parsing helpers
function num(val: string | null, def: number, min: number, max: number) {
  const n = Number(val);
  if (Number.isFinite(n)) return Math.min(max, Math.max(min, n));
  return def;
}

// Allowed sortable columns mapping client->db
// Actual DB columns: full_name, email, role, created_at, updated_at, optionally last_login_at (if tracked via auth trigger)
// We'll expose sort keys: created_at, full_name, email, role, updated_at
const SORTABLE = new Set([
  "created_at",
  "full_name",
  "email",
  "role",
  "updated_at",
]); // client may send sortBy=name which we map to full_name

// Basic email regex (not exhaustive)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

async function requireAdmin(userId: string) {
  if (!userId) return { ok: false, error: "userId required" } as const;
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data || data.role !== "admin") {
    return { ok: false, error: "Forbidden" } as const;
  }
  return { ok: true, user: data } as const;
}

// Ensure related role specific tables exist with default values
async function ensureRoleRows(
  userId: string,
  role: string,
  opts?: { bank_account?: string | null }
) {
  if (!userId || !role) return;
  if (role === "user") {
    // students: points, coins default 0
    const { data } = await supabaseAdmin
      .from("students")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) {
      await supabaseAdmin
        .from("students")
        .insert({ user_id: userId, points: 0, coins: 0 })
        .select("user_id")
        .maybeSingle();
    }
  } else if (role === "instructor") {
    const { data } = await supabaseAdmin
      .from("instructors")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) {
      await supabaseAdmin
        .from("instructors")
        .insert({
          user_id: userId,
          total_earnings: 0,
          rating: 0,
          bank_account: opts?.bank_account || null,
        })
        .select("user_id")
        .maybeSingle();
    } else if (opts?.bank_account !== undefined) {
      await supabaseAdmin
        .from("instructors")
        .update({ bank_account: opts.bank_account })
        .eq("user_id", userId);
    }
  } else if (role === "admin") {
    const { data } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (!data) {
      await supabaseAdmin
        .from("admins")
        .insert({ id: userId })
        .select("id")
        .maybeSingle();
    }
  }
}

async function removeAvatarFolder(userId: string) {
  try {
    if (!userId) return;
    // list files under prefix userId/
    const { data: files } = await serviceClient.storage
      .from("avatar")
      .list(userId, { limit: 100 });
    if (files && files.length) {
      const paths = files.map((f) => `${userId}/${f.name}`);
      await serviceClient.storage.from("avatar").remove(paths);
    }
  } catch {
    // ignore cleanup errors
  }
}

async function uploadAvatar(
  userId: string,
  avatar_base64: string
): Promise<string> {
  const m = avatar_base64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) throw new Error("Invalid avatar_base64");
  const contentType = m[1];
  const b64 = m[2];
  const buf = Buffer.from(b64, "base64");
  const ext = contentType.split("/")[1] || "png";
  // purge existing folder then upload
  await removeAvatarFolder(userId);
  const unique = `avatar_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
  const path = `${userId}/${unique}`;
  const { error: upErr } = await serviceClient.storage
    .from("avatar")
    .upload(path, buf, { upsert: true, contentType });
  if (upErr) throw new Error("Upload avatar gagal");
  const { data: pub } = serviceClient.storage.from("avatar").getPublicUrl(path);
  return pub.publicUrl;
}

// GET: list/search/sort/paginate
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const actorId = (searchParams.get("userId") || "").trim();
  const auth = await requireAdmin(actorId);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.error === "Forbidden" ? 403 : 400 }
    );
  }

  const page = num(searchParams.get("page"), 1, 1, 5000);
  const limit = num(searchParams.get("limit"), 10, 1, 100);
  const q = (searchParams.get("q") || "").trim();
  const role = (searchParams.get("role") || "").trim();
  const sortByRaw = (searchParams.get("sortBy") || "created_at").trim();
  const sortDirRaw = (searchParams.get("sortDir") || "desc")
    .trim()
    .toLowerCase();

  // map alias 'name' -> full_name
  const mappedSort = sortByRaw === "name" ? "full_name" : sortByRaw;
  const sortBy = SORTABLE.has(mappedSort) ? mappedSort : "created_at";
  const sortDir: "asc" | "desc" = sortDirRaw === "asc" ? "asc" : "desc";

  try {
    let query = supabaseAdmin
      .from("users")
      .select(
        "id, username, full_name, email, role, bio, avatar, phone, created_at, updated_at",
        { count: "exact" }
      )
      // exclude currently logged-in admin from listing per requirement
      .neq("id", actorId);

    if (role) query = query.eq("role", role);

    if (q) {
      const safe = q.replace(/%/g, "");
      query = query.or(
        `full_name.ilike.%${safe}%,email.ilike.%${safe}%,id.ilike.%${safe}%`
      );
    }

    query = query.order(sortBy, { ascending: sortDir === "asc" });

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw error;

    const items = (data || []).map((r) => ({
      id: r.id,
      name: r.full_name ?? null,
      username: r.username ?? null,
      email: r.email ?? null,
      role: r.role ?? null,
      bio: r.bio ?? null,
      avatar_url: r.avatar ?? null,
      phone: r.phone ?? null,
      created_at: r.created_at ?? null,
      updated_at: r.updated_at ?? null,
    }));

    return NextResponse.json({
      success: true,
      items,
      total: count || 0,
      page,
      limit,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST: create user (basic). Assumes separate auth signup elsewhere; here used for admin seeding editing meta.
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const actorId = (searchParams.get("userId") || "").trim();
  const auth = await requireAdmin(actorId);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.error === "Forbidden" ? 403 : 400 }
    );
  }

  try {
    const body = await req.json();
    const {
      name,
      full_name,
      email,
      role,
      bio,
      phone,
      username,
      avatar_url,
      avatar,
      password,
      avatar_base64,
      bank_account,
    } = body || {};
    const finalName =
      typeof full_name === "string" && full_name.trim().length
        ? full_name
        : name; // allow either field name or full_name from client
    if (!finalName || typeof finalName !== "string") {
      return NextResponse.json(
        { success: false, error: "Name required" },
        { status: 400 }
      );
    }
    if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { success: false, error: "Valid email required" },
        { status: 400 }
      );
    }
    if (!username || typeof username !== "string" || !username.trim()) {
      return NextResponse.json(
        { success: false, error: "Username required" },
        { status: 400 }
      );
    }
    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return NextResponse.json(
        { success: false, error: "Phone required" },
        { status: 400 }
      );
    }
    let avatarVal = (avatar_url || avatar) as string | undefined;
    if (!role || !["admin", "instructor", "user"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "Invalid role" },
        { status: 400 }
      );
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password min 6" },
        { status: 400 }
      );
    }

    // Check duplicate email
    const { data: existingEmail } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: "Email already exists" },
        { status: 409 }
      );
    }
    // Check duplicate username
    const { data: existingUsername } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (existingUsername) {
      return NextResponse.json(
        { success: false, error: "Username already exists" },
        { status: 409 }
      );
    }

    // create auth user first
    const { data: authCreate, error: authErr } =
      await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: finalName, username },
      });
    if (authErr || !authCreate?.user) {
      return NextResponse.json(
        {
          success: false,
          error: authErr?.message || "Failed create auth user",
        },
        { status: 500 }
      );
    }
    const newId = authCreate.user.id;

    if (avatar_base64 && typeof avatar_base64 === "string") {
      try {
        avatarVal = await uploadAvatar(newId, avatar_base64);
      } catch (e) {
        return NextResponse.json(
          {
            success: false,
            error: (e as Error).message || "Process avatar failed",
          },
          { status: 400 }
        );
      }
    }
    if (!avatarVal) {
      return NextResponse.json(
        { success: false, error: "Avatar required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .insert({
        id: newId,
        full_name: finalName,
        email,
        username: username.trim(),
        role,
        bio: bio || null,
        phone: phone || null,
        avatar: avatarVal,
      })
      .select(
        "id, username, full_name, email, role, bio, avatar, phone, created_at, updated_at"
      )
      .single();

    if (error) throw error;

    if (data) {
      // create related role row with defaults
      await ensureRoleRows(data.id, role, {
        bank_account: bank_account || null,
      });
    }

    const item = data
      ? {
          id: data.id,
          name: data.full_name ?? null,
          email: data.email ?? null,
          username: data.username ?? null,
          role: data.role ?? null,
          bio: data.bio ?? null,
          avatar_url: data.avatar ?? null,
          phone: data.phone ?? null,
          created_at: data.created_at ?? null,
          updated_at: data.updated_at ?? null,
        }
      : null;
    return NextResponse.json({ success: true, item });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PATCH: update existing user meta
export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const actorId = (searchParams.get("userId") || "").trim();
  const auth = await requireAdmin(actorId);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.error === "Forbidden" ? 403 : 400 }
    );
  }
  try {
    const body = await req.json();
    const {
      id,
      name,
      full_name,
      email,
      role,
      bio,
      phone,
      username,
      avatar_url,
      avatar,
      avatar_base64,
      bank_account,
    } = body || {};
    if (!id)
      return NextResponse.json(
        { success: false, error: "id required" },
        { status: 400 }
      );

    const update: Record<string, unknown> = {};
    const finalName = (full_name || name) as string | undefined;
    if (finalName) update.full_name = finalName;
    if (email) {
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json(
          { success: false, error: "Invalid email" },
          { status: 400 }
        );
      }
      // Ensure not used by another
      const { data: dup } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .neq("id", id)
        .maybeSingle();
      if (dup) {
        return NextResponse.json(
          { success: false, error: "Email already used" },
          { status: 409 }
        );
      }
      update.email = email;
    }
    if (username) {
      const trimmed = String(username).trim();
      if (!trimmed) {
        return NextResponse.json(
          { success: false, error: "Invalid username" },
          { status: 400 }
        );
      }
      const { data: dupU } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("username", trimmed)
        .neq("id", id)
        .maybeSingle();
      if (dupU) {
        return NextResponse.json(
          { success: false, error: "Username already used" },
          { status: 409 }
        );
      }
      update.username = trimmed;
    }
    if (role) {
      if (!["admin", "instructor", "user"].includes(role)) {
        return NextResponse.json(
          { success: false, error: "Invalid role" },
          { status: 400 }
        );
      }
      update.role = role;
    }
    if (bio !== undefined) update.bio = bio;
    if (phone !== undefined) update.phone = phone;
    if (avatar_url || avatar) update.avatar = avatar_url || avatar;
    let uploadedNewAvatar = false;
    if (avatar_base64 && typeof avatar_base64 === "string") {
      try {
        const url = await uploadAvatar(id, avatar_base64);
        update.avatar = url;
        uploadedNewAvatar = true;
      } catch (e) {
        return NextResponse.json(
          {
            success: false,
            error: (e as Error).message || "Process avatar failed",
          },
          { status: 400 }
        );
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { success: false, error: "No changes" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .update(update)
      .eq("id", id)
      .select(
        "id, username, full_name, email, role, bio, avatar, phone, created_at, updated_at"
      )
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );
    }

    if (data) {
      // ensure role specific rows exist / updated (handle role change and instructor bank_account)
      await ensureRoleRows(data.id, (role || data.role) as string, {
        bank_account: bank_account ?? undefined,
      });
      if (role === "instructor" && bank_account !== undefined) {
        // already handled in ensureRoleRows, but safe guard
        await supabaseAdmin
          .from("instructors")
          .update({ bank_account })
          .eq("user_id", data.id);
      }
      // sync auth user email / metadata if changed or avatar new
      try {
        if (email || uploadedNewAvatar || name || full_name || username) {
          await serviceClient.auth.admin.updateUserById(data.id, {
            email: email || undefined,
            user_metadata: {
              full_name: (full_name || name || data.full_name) ?? undefined,
              username: username || data.username,
              avatar: update.avatar || data.avatar,
            },
          });
        }
      } catch {
        // ignore auth sync errors to not block
      }
    }

    const item = data
      ? {
          id: data.id,
          name: data.full_name ?? null,
          email: data.email ?? null,
          username: data.username ?? null,
          role: data.role ?? null,
          bio: data.bio ?? null,
          avatar_url: data.avatar ?? null,
          phone: data.phone ?? null,
          created_at: data.created_at ?? null,
          updated_at: data.updated_at ?? null,
        }
      : null;
    return NextResponse.json({ success: true, item });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE: remove a user (soft delete could be better; here hard delete)
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const actorId = (searchParams.get("userId") || "").trim();
  const auth = await requireAdmin(actorId);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.error === "Forbidden" ? 403 : 400 }
    );
  }
  try {
    const body = await req.json();
    const { id } = body || {};
    if (!id)
      return NextResponse.json(
        { success: false, error: "id required" },
        { status: 400 }
      );

    // remove related role rows first (best effort)
    try {
      await supabaseAdmin.from("students").delete().eq("user_id", id);
    } catch {}
    try {
      await supabaseAdmin.from("instructors").delete().eq("user_id", id);
    } catch {}
    try {
      await supabaseAdmin.from("admins").delete().eq("id", id);
    } catch {}

    const { error } = await supabaseAdmin.from("users").delete().eq("id", id);
    if (error) throw error;

    // delete auth user
    try {
      await serviceClient.auth.admin.deleteUser(id);
    } catch {}
    // remove avatar storage folder
    await removeAvatarFolder(id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
