import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/instructor/discussions/[id]?instructorId=...
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  if (!instructorId) {
    return NextResponse.json(
      { success: false, error: "instructorId wajib" },
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
      .select("id, post_id, user_id, content, likes, created_at")
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

// PATCH like/unlike: Body { instructorId, action: "like"|"unlike" }
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json()) as {
      instructorId?: string;
      action?: "like" | "unlike";
    };
    const { instructorId, action } = body;
    if (!instructorId || !action) {
      return NextResponse.json(
        { success: false, error: "instructorId dan action wajib" },
        { status: 400 }
      );
    }
    // Validate actor exists
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("id", instructorId)
      .maybeSingle();
    if (!user)
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    const postId = params.id;
    // naive like counter (no per-user like table implemented here)
    const diff = action === "like" ? 1 : -1;
    const { error } = await supabase.rpc("increment_likes", {
      p_post_id: postId,
      p_diff: diff,
    });
    if (error) {
      // Fallback if RPC missing: fetch current, then update
      const { data: cur } = await supabase
        .from("discussion_posts")
        .select("likes")
        .eq("id", postId)
        .maybeSingle();
      const newLikes = Math.max(0, (cur?.likes ?? 0) + diff);
      await supabase
        .from("discussion_posts")
        .update({ likes: newLikes })
        .eq("id", postId);
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal update like";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
