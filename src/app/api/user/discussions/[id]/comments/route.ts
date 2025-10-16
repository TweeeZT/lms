import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// POST /api/user/discussions/[id]/comments
// Body: { userId: string; content: string }
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json()) as { userId?: string; content?: string };
    const userId = (body.userId || "").trim();
    const content = (body.content || "").trim();
    if (!userId || !content) {
      return NextResponse.json(
        { success: false, error: "userId dan content wajib" },
        { status: 400 }
      );
    }
    const { data: user } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();
    if (!user || (user.role !== "user" && user.role !== "school"))
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );

    const postId = params.id;
    const { data: post } = await supabase
      .from("discussion_posts")
      .select("id")
      .eq("id", postId)
      .maybeSingle();
    if (!post)
      return NextResponse.json(
        { success: false, error: "Post tidak ditemukan" },
        { status: 404 }
      );

    const commentId =
      globalThis.crypto?.randomUUID?.() ||
      `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { error: insErr } = await supabase
      .from("discussion_comments")
      .insert({
        id: commentId,
        post_id: postId,
        user_id: userId,
        content,
      });
    if (insErr)
      return NextResponse.json(
        { success: false, error: insErr.message },
        { status: 400 }
      );

    const { data: author } = await supabase
      .from("users")
      .select("id, full_name, avatar, role")
      .eq("id", userId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      item: {
        id: commentId,
        post_id: postId,
        user_id: userId,
        content,
        created_at: new Date().toISOString(),
        user: author || null,
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal menambah komentar";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
