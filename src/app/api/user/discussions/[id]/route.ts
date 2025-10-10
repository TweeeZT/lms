import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/user/discussions/[id]?userId=...
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId wajib" },
      { status: 400 }
    );
  }
  try {
    const postId = params.id;
    const { data: post, error } = await supabase
      .from("discussion_posts")
      .select(
        "id, user_id, title, content, likes, tags, created_at, updated_at"
      )
      .eq("id", postId)
      .maybeSingle();
    if (error) throw error;
    if (!post)
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );

    const { data: author } = await supabase
      .from("users")
      .select("id, full_name, email, avatar, role")
      .eq("id", post.user_id)
      .maybeSingle();
    const { data: media } = await supabase
      .from("discussion_media")
      .select("id, post_id, m_type, url, thumbnail")
      .eq("post_id", post.id);
    const { data: comments } = await supabase
      .from("discussion_comments")
      .select("id, post_id, user_id, content, created_at")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    const commentAuthorIds = Array.from(
      new Set((comments || []).map((c) => c.user_id))
    );
    const { data: cAuthors } = await supabase
      .from("users")
      .select("id, full_name, avatar, role")
      .in("id", commentAuthorIds);
    const authorsMap = new Map((cAuthors || []).map((u) => [u.id, u]));
    const commentsEnriched = (comments || []).map((c) => ({
      ...c,
      user: authorsMap.get(c.user_id) || null,
    }));

    return NextResponse.json({
      success: true,
      item: {
        ...post,
        user: author || null,
        media: media || [],
        comments: commentsEnriched,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat diskusi";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// PATCH like/unlike: Body { userId, action: "like"|"unlike" }
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    interface UpdateBody {
      userId?: string;
      action?: string; // like | unlike | update
      title?: string;
      content?: string;
      tags?: unknown;
    }
    const body: UpdateBody = await req.json();
    const userId: string | undefined = body.userId;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId wajib" },
        { status: 400 }
      );
    }
    // action can be like/unlike OR update
    const action = body.action as string | undefined; // like|unlike|update
    // Validate actor exists
    const { data: actor } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();
    if (!actor)
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    const postId = params.id;

    if (action === "like" || action === "unlike") {
      // Check for existing like record
      const { data: existingLike } = await supabase
        .from("discussion_likes")
        .select("id, liked, update_at")
        .eq("user_id", userId)
        .eq("discussion_id", postId)
        .maybeSingle();

      const now = new Date();

      // Anti-spam: jika baru update < 2 detik, tolak
      if (existingLike && existingLike.update_at) {
        const lastUpdate = new Date(existingLike.update_at);
        const diffMs = now.getTime() - lastUpdate.getTime();
        if (diffMs < 2000) {
          // 2 detik delay
          return NextResponse.json(
            {
              success: false,
              error: "Mohon tunggu sebentar sebelum like/unlike lagi",
            },
            { status: 429 } // Too Many Requests
          );
        }
      }

      const newLikedState = action === "like";

      if (existingLike) {
        // Update existing record
        await supabase
          .from("discussion_likes")
          .update({
            liked: newLikedState,
            update_at: now.toISOString(),
          })
          .eq("id", existingLike.id);
      } else {
        // Create new record
        await supabase.from("discussion_likes").insert({
          user_id: userId,
          discussion_id: postId,
          liked: newLikedState,
          update_at: now.toISOString(),
        });
      }

      // Update likes count in discussion_posts
      const { data: allLikes } = await supabase
        .from("discussion_likes")
        .select("liked")
        .eq("discussion_id", postId);

      const likeCount = (allLikes || []).filter((l) => l.liked === true).length;

      await supabase
        .from("discussion_posts")
        .update({ likes: likeCount })
        .eq("id", postId);

      return NextResponse.json({ success: true, likes: likeCount });
    }

    if (action === "update") {
      const title = (body.title || "").trim();
      const content = (body.content || "").trim();
      let tags: string[] = [];
      if (Array.isArray(body.tags))
        tags = body.tags.map((t: unknown) => String(t));
      // fetch ownership
      const { data: post } = await supabase
        .from("discussion_posts")
        .select("id, user_id")
        .eq("id", postId)
        .maybeSingle();
      if (!post)
        return NextResponse.json(
          { success: false, error: "Post tidak ditemukan" },
          { status: 404 }
        );
      if (post.user_id !== userId) {
        return NextResponse.json(
          { success: false, error: "Tidak boleh mengedit posting orang lain" },
          { status: 403 }
        );
      }
      if (!title || !content) {
        return NextResponse.json(
          { success: false, error: "title & content wajib" },
          { status: 400 }
        );
      }
      const { error: upErr } = await supabase
        .from("discussion_posts")
        .update({ title, content, tags, updated_at: new Date().toISOString() })
        .eq("id", postId);
      if (upErr)
        return NextResponse.json(
          { success: false, error: upErr.message },
          { status: 400 }
        );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "action tidak dikenal" },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal update like";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// DELETE /api/user/discussions/[id]  Body { userId }
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json().catch(() => ({}))) as { userId?: string };
    const userId = body.userId;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId wajib" },
        { status: 400 }
      );
    }
    const postId = params.id;
    const { data: post } = await supabase
      .from("discussion_posts")
      .select("id, user_id")
      .eq("id", postId)
      .maybeSingle();
    if (!post)
      return NextResponse.json(
        { success: false, error: "Post tidak ditemukan" },
        { status: 404 }
      );
    if (post.user_id !== userId) {
      return NextResponse.json(
        { success: false, error: "Tidak boleh menghapus posting orang lain" },
        { status: 403 }
      );
    }

    // Fetch media to optionally delete storage objects
    const { data: media } = await supabase
      .from("discussion_media")
      .select("id, url")
      .eq("post_id", postId);

    // Delete likes first (foreign key constraint)
    await supabase
      .from("discussion_likes")
      .delete()
      .eq("discussion_id", postId);
    // Delete comments
    await supabase.from("discussion_comments").delete().eq("post_id", postId);
    // Delete media rows
    await supabase.from("discussion_media").delete().eq("post_id", postId);
    // Delete post
    await supabase.from("discussion_posts").delete().eq("id", postId);

    // Best-effort delete storage objects (derive path after domain /object/public/discussion/)
    const paths: string[] = [];
    interface MediaRow {
      id: string;
      url: string;
    }
    (media || []).forEach((m: MediaRow) => {
      const marker = "/object/public/discussion/";
      const idx = m.url.indexOf(marker);
      if (idx !== -1) {
        const path = m.url.substring(idx + marker.length);
        if (path) paths.push(path);
      }
    });
    if (paths.length) {
      await supabase.storage.from("discussion").remove(paths);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
