import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// PATCH /api/user/profile/edit
// Body: { userId, fullName?, username?, phone?, bio?, avatarUrl?, avatarPath? }
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
        "Supabase server client not configured in /api/user/profile/edit. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
      );
      return NextResponse.json(
        {
          success: false,
          error: "Server misconfigured: missing Supabase credentials",
        },
        { status: 500 }
      );
    }
    // verify actor exists and is allowed (user, instructor, or school)
    const { data: actor, error: aErr } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();
    if (aErr) throw aErr;
    if (
      !actor ||
      (actor.role !== "user" &&
        actor.role !== "instructor" &&
        actor.role !== "school")
    )
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );

    const patch: Record<string, unknown> = {};
    if (typeof body.fullName === "string")
      patch.full_name = body.fullName.trim();
    if (typeof body.username === "string")
      patch.username = body.username.trim();
    if (typeof body.phone === "string") patch.phone = body.phone.trim();
    if (typeof body.bio === "string") patch.bio = body.bio.trim();
    // handle avatar update: expect url (and optionally storage path) so we can delete old
    const newAvatarUrl: string | undefined =
      typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : undefined;
    const newAvatarPath: string | undefined =
      typeof body.avatarPath === "string" ? body.avatarPath.trim() : undefined;

    if (newAvatarUrl) patch.avatar = newAvatarUrl;
    if (!Object.keys(patch).length) {
      return NextResponse.json({ success: true, updated: 0 });
    }
    patch.updated_at = new Date().toISOString();

    // If avatar changes, delete old file safely (only in avatars bucket)
    if (newAvatarUrl || newAvatarPath) {
      // fetch current avatar URL, then update
      const { data: current, error: curErr } = await supabase
        .from("users")
        .select("avatar")
        .eq("id", userId)
        .maybeSingle();
      if (curErr) throw curErr;

      let upd = await supabase.from("users").update(patch).eq("id", userId);
      if (upd.error) {
        const m = (upd.error && (upd.error as any).message) || "";
        // If column missing (from older schema), retry without scratch_username (backwards compatible)
        if (
          m.toLowerCase().includes("scratch_username") &&
          m.toLowerCase().includes("does not exist")
        ) {
          console.warn(
            "scratch_username column missing; retrying update without it"
          );
          const { scratch_username, ...rest } = patch as any;
          upd = await supabase.from("users").update(rest).eq("id", userId);
        }
      }
      if (upd.error) {
        const msg = (upd.error && (upd.error as any).message) || "";
        if (
          msg.toLowerCase().includes("duplicate") ||
          msg.toLowerCase().includes("unique")
        ) {
          // likely username unique violation
          return NextResponse.json(
            { success: false, error: "Username sudah digunakan" },
            { status: 409 }
          );
        }
        throw upd.error;
      }

      // Try to remove previous avatar
      const oldUrl = (current?.avatar as string | null) || null;
      let oldPath: string | null = null;
      if (oldUrl) {
        // Accept either /avatar/ or /avatars/ public paths
        const markers = [
          "/storage/v1/object/public/avatar/",
          "/storage/v1/object/public/avatars/",
        ];
        for (const marker of markers) {
          const idx = oldUrl.indexOf(marker);
          if (idx >= 0) {
            // Extract path and remove query parameters (e.g., ?t=timestamp)
            const rawPath = oldUrl.substring(idx + marker.length);
            oldPath = rawPath.split("?")[0]; // Remove query params
            break;
          }
        }
      }
      if (oldPath && oldPath !== newAvatarPath) {
        // Try both avatar and avatars buckets for cleanup
        const bks = ["avatar", "avatars"] as const;
        let lastErr: Error | null = null;
        for (const bk of bks) {
          const { error: delErr } = await supabase.storage
            .from(bk)
            .remove([oldPath]);
          if (!delErr) {
            lastErr = null;
            break;
          } else {
            lastErr = new Error(delErr.message);
          }
        }
        if (lastErr)
          console.warn("Failed to delete old avatar:", lastErr.message);
      }
    } else {
      const { error } = await supabase
        .from("users")
        .update(patch)
        .eq("id", userId);
      if (error) {
        const msg = (error && (error as any).message) || "";
        if (
          msg.toLowerCase().includes("duplicate") ||
          msg.toLowerCase().includes("unique")
        ) {
          return NextResponse.json(
            { success: false, error: "Username sudah digunakan" },
            { status: 409 }
          );
        }
        throw error;
      }
    }
    return NextResponse.json({ success: true, updated: 1 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal update profil";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
