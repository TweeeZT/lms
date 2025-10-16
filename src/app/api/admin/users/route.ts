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
  } else if (role === "sekolah") {
    // ensure a schools row exists for this user
    try {
      const { data } = await supabaseAdmin
        .from("schools")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!data) {
          try {
            await supabaseAdmin
              .from("schools")
              .insert({ user_id: userId, school_name: null })
              .select("user_id")
              .maybeSingle();
          } catch (e) {
            console.error("[ensureRoleRows] failed to insert schools row:", e);
          }
      }
    } catch (e) {
      console.error("[ensureRoleRows] error checking schools row:", e);
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

    // Map users to items and then check whether each user has a schools row.
    // If a schools row exists, report role = 'sekolah' to the admin UI.
    const rows = data || [];
    const items: Array<any> = [];
    for (const r of rows) {
      let reportedRole = r.role ?? null;
      try {
        const { data: schoolRow } = await supabaseAdmin
          .from("schools")
          .select("user_id")
          .eq("user_id", r.id)
          .maybeSingle();
        if (schoolRow) reportedRole = "sekolah";
      } catch (e) {
        // ignore and fall back to DB role
      }
      items.push({
        id: r.id,
        name: r.full_name ?? null,
        username: r.username ?? null,
        email: r.email ?? null,
        role: reportedRole,
        bio: r.bio ?? null,
        avatar_url: r.avatar ?? null,
        phone: r.phone ?? null,
        created_at: r.created_at ?? null,
        updated_at: r.updated_at ?? null,
      });
    }

    // If caller specifically requested role=sekolah, filter to only those items
    // which actually have a schools row.
    let filteredItems = items;
    if (role === "sekolah") {
      filteredItems = items.filter((it) => it.role === "sekolah");
    }

    return NextResponse.json({
      success: true,
      items: filteredItems,
      total: count || 0,
      page,
      limit,
    });
  } catch (err: unknown) {
    // Log and return error details for local debugging
    const isError = err instanceof Error;
    const msg = isError ? err.message : String(err);
    const stack = isError ? (err as Error).stack : undefined;
    console.error("[api/admin/users PATCH] error:", err);
    return NextResponse.json(
      { success: false, error: msg, stack: stack },
      { status: 500 }
    );
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
    if (!role || !["admin", "instructor", "user", "sekolah"].includes(role)) {
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
    const isError = err instanceof Error;
    const msg = isError ? err.message : String(err);
    const stack = isError ? (err as Error).stack : undefined;
    console.error("[api/admin/users PATCH] uncaught error:", err);
    return NextResponse.json(
      { success: false, error: msg, stack },
      { status: 500 }
    );
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
  console.debug("[api/admin/users PATCH] actorId:", actorId);
  try {
    const body = await req.json();
    console.debug("[api/admin/users PATCH] body:", body);
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
      if (!["admin", "instructor", "user", "sekolah"].includes(role)) {
        return NextResponse.json(
          { success: false, error: "Invalid role" },
          { status: 400 }
        );
      }
      // Some DBs use an enum for users.role that may not include 'sekolah'.
      // To avoid invalid enum writes, map the client-visible 'sekolah' role
      // to a DB-safe role (keep as 'user') when updating the users table.
      const dbRole = role === "sekolah" ? "user" : role;
      update.role = dbRole;
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

    // Try to write the update as-is (this mirrors instructor/admin behavior).
    // If the DB rejects the role (e.g., enum doesn't include 'sekolah'),
    // and the requested role was 'sekolah', retry with a DB-safe value ('user').
    let data: any = null;
    try {
      const res = await supabaseAdmin
        .from("users")
        .update(update)
        .eq("id", id)
        .select(
          "id, username, full_name, email, role, bio, avatar, phone, created_at, updated_at"
        )
        .maybeSingle();
      // result shape: { data, error }
      if (res.error) throw res.error;
      data = res.data;
    } catch (e: any) {
      // If the request was to set role = 'sekolah' and DB enum rejects it,
      // retry by mapping to a DB-safe role ('user'). Otherwise rethrow.
      const isEnumErr = e && e.message && String(e.message).includes("invalid input value for enum");
      if (role === "sekolah" && isEnumErr) {
        try {
          update.role = "user"; // db-safe fallback
          const res2 = await supabaseAdmin
            .from("users")
            .update(update)
            .eq("id", id)
            .select(
              "id, username, full_name, email, role, bio, avatar, phone, created_at, updated_at"
            )
            .maybeSingle();
          if (res2.error) throw res2.error;
          data = res2.data;
        } catch (e2) {
          throw e2;
        }
      } else {
        throw e;
      }
    }
    if (!data) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );
    }

    if (data) {
      // ensure role specific rows exist / updated (handle role change and instructor bank_account)
      try {
        await ensureRoleRows(data.id, (role || data.role) as string, {
          bank_account: bank_account ?? undefined,
        });
      } catch (e) {
        // Fail gracefully: log and return a helpful error to the client
        const emsg = e instanceof Error ? e.message : String(e);
        return NextResponse.json(
          { success: false, error: `Failed ensure role rows: ${emsg}` },
          { status: 500 }
        );
      }

      // If admin explicitly set role to 'sekolah', ensure a schools row exists.
      // If role was changed away from 'sekolah', remove any existing schools row.
      try {
        if (role === "sekolah") {
          // create schools row if not exists
          const { data: existing } = await supabaseAdmin
            .from("schools")
            .select("user_id")
            .eq("user_id", data.id)
            .maybeSingle();
          if (!existing) {
            try {
              await supabaseAdmin
                .from("schools")
                .insert({ user_id: data.id, school_name: null });
            } catch (e) {
              // ignore best-effort insert errors
            }
          }
        } else {
          // if role is not sekolah, remove possible schools row
          try {
            await supabaseAdmin.from("schools").delete().eq("user_id", data.id);
          } catch (e) {
            // ignore delete errors
          }
        }
      } catch (e) {
        // ignore schools ops errors
      }

      if (role === "instructor" && bank_account !== undefined) {
        // already handled in ensureRoleRows, but safe guard
        try {
          await supabaseAdmin
            .from("instructors")
            .update({ bank_account })
            .eq("user_id", data.id);
        } catch {}
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
      } catch (e) {
        // ignore auth sync errors, but capture message in logs if helpful
        // (do not block main flow)
      }
    }

      // Determine what role to return to the client. If a schools row
      // exists for this user we should report 'sekolah' to the admin UI
      // even though the users.role DB column may contain a DB-safe value.
      let returnedRole = data.role ?? null;
      let schoolsPresent = false;
      try {
        const { data: schoolRow } = await supabaseAdmin
          .from("schools")
          .select("user_id")
          .eq("user_id", data.id)
          .maybeSingle();
        if (schoolRow) {
          returnedRole = "sekolah";
          schoolsPresent = true;
        }
      } catch (e) {
        // ignore errors and fall back to DB role
      }

      const item = data
        ? {
            id: data.id,
            name: data.full_name ?? null,
            email: data.email ?? null,
            username: data.username ?? null,
            role: returnedRole ?? null,
            bio: data.bio ?? null,
            avatar_url: data.avatar ?? null,
            phone: data.phone ?? null,
            created_at: data.created_at ?? null,
            updated_at: data.updated_at ?? null,
            // debug info (non-destructive): whether admin requested sekolah and whether schools row exists
            _requested_role: role ?? null,
            _schools_present: schoolsPresent,
          }
        : null;
    return NextResponse.json({ success: true, item });
  } catch (err: unknown) {
    // Log full error for local debugging
    console.error("[api/admin/users PATCH] final catch:", err);
    let msg: string;
    if (err instanceof Error) msg = err.message;
    else if (err && typeof err === "object") {
      // try common supabase error shapes
      // @ts-ignore
      msg = (err.message || err.error || JSON.stringify(err));
    } else msg = String(err);
    return NextResponse.json({ success: false, error: msg, raw: err }, { status: 500 });
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
