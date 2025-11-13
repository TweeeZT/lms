import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/user/discussions?userId=...&q=...&sort=latest|popular&mine=true|false&page=1&limit=10
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = (searchParams.get("userId") || "").trim();
  const q = (searchParams.get("q") || "").trim();
  const sort = (searchParams.get("sort") || "latest") as "latest" | "popular";
  const mine = String(searchParams.get("mine") || "false") === "true";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get("limit") || 10))
  );
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId wajib" },
      { status: 400 }
    );
  }

  try {
    // Validate role: allow regular users and school accounts to access forum
    const { data: actor, error: uErr } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();
    if (uErr) throw uErr;
    if (!actor || (actor.role !== "user" && actor.role !== "school")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Global forum: hanya ambil posting yang TIDAK terkait kursus (course_id IS NULL)
    let query = supabase
      .from("discussion_posts")
      .select(
        "id, user_id, title, content, likes, tags, created_at, updated_at, course_id",
        { count: "exact" }
      )
      .is("course_id", null);
    if (mine) query = query.eq("user_id", userId);
    if (q) query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);
    if (sort === "latest")
      query = query.order("created_at", { ascending: false });
    else if (sort === "popular")
      query = query.order("likes", { ascending: false });

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data: posts, error, count } = await query.range(from, to);
    if (error) throw error;

    const ids = (posts || []).map((p) => p.id);
    const authorIds = Array.from(new Set((posts || []).map((p) => p.user_id)));
    const { data: authors } = await supabase
      .from("users")
      .select("id, full_name, email, avatar, role")
      .in("id", authorIds);
    const authorsMap = new Map((authors || []).map((a) => [a.id, a]));
    const { data: media } = await supabase
      .from("discussion_media")
      .select("id, post_id, m_type, url, thumbnail")
      .in("post_id", ids);
    type MediaRow = {
      id: string;
      post_id: string;
      m_type: string;
      url: string;
      thumbnail?: string | null;
    };
    const mediaByPost = new Map<string, MediaRow[]>();
    (media || []).forEach((m: MediaRow) => {
      if (!mediaByPost.has(m.post_id)) mediaByPost.set(m.post_id, []);
      mediaByPost.get(m.post_id)!.push(m);
    });

    const items = (posts || []).map((p) => ({
      ...p,
      user: authorsMap.get(p.user_id) || null,
      media: mediaByPost.get(p.id) || [],
    }));

    return NextResponse.json({
      success: true,
      items,
      total: count || 0,
      page,
      limit,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat diskusi";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// POST /api/user/discussions (multipart)
// Fields: userId, title, content, tags (JSON), files[]
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          success: false,
          error: "Gunakan multipart/form-data untuk upload media",
        },
        { status: 400 }
      );
    }
    const form = await req.formData();
    const userId = String(form.get("userId") || "").trim();
    const title = String(form.get("title") || "").trim();
    const content = String(form.get("content") || "").trim();
    const tagsRaw = form.get("tags");
    let tags: string[] = [];
    if (typeof tagsRaw === "string" && tagsRaw) {
      try {
        tags = JSON.parse(tagsRaw);
      } catch {
        tags = [];
      }
    }
    if (!userId || !title || !content) {
      return NextResponse.json(
        { success: false, error: "userId, title, content wajib" },
        { status: 400 }
      );
    }
    // Validate role (allow both user and school)
    const { data: actor, error: uErr } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();
    if (uErr) throw uErr;
    if (!actor || (actor.role !== "user" && actor.role !== "school")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const postId =
      globalThis.crypto?.randomUUID?.() ||
      `disc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { error: insErr } = await supabase.from("discussion_posts").insert({
      id: postId,
      user_id: userId,
      title,
      content,
      likes: 0,
      tags,
    });
    if (insErr) throw insErr;

    const files = form.getAll("files");
    const uploaded: Array<{
      id: string;
      m_type: string;
      url: string;
      thumbnail?: string | null;
    }> = [];
    for (const f of files) {
      if (f instanceof Blob) {
        const file = f as Blob;
        const ct = file.type || "application/octet-stream";
        const isImage = /^image\//i.test(ct);
        const isVideo = /^video\//i.test(ct);
        if (!isImage && !isVideo) continue;
        const ext = (ct.split("/").pop() || "bin").toLowerCase();
        const objectPath = `${postId}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("discussion")
          .upload(objectPath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: ct,
          });
        if (upErr) {
          await supabase.from("discussion_posts").delete().eq("id", postId);
          return NextResponse.json(
            { success: false, error: upErr.message },
            { status: 400 }
          );
        }
        const { data: urlData } = supabase.storage
          .from("discussion")
          .getPublicUrl(objectPath);
        uploaded.push({
          id: globalThis.crypto?.randomUUID?.() || `med-${Date.now()}`,
          m_type: isImage ? "image" : "video",
          url: urlData.publicUrl,
          thumbnail: null,
        });
      }
    }
    if (uploaded.length) {
      const rows = uploaded.map((m) => ({
        id: m.id,
        post_id: postId,
        m_type: m.m_type,
        url: m.url,
        thumbnail: m.thumbnail,
      }));
      const { error: mErr } = await supabase
        .from("discussion_media")
        .insert(rows);
      if (mErr)
        return NextResponse.json(
          { success: false, error: mErr.message },
          { status: 400 }
        );
    }
    return NextResponse.json({ success: true, id: postId });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal membuat diskusi";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
