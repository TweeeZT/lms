import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// POST /api/instructor/discussions/[id]/comments
// Body: { instructorId: string; content: string }
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json()) as {
      instructorId?: string;
      content?: string;
    };
    const instructorId = (body.instructorId || "").trim();
    const content = (body.content || "").trim();
    if (!instructorId || !content) {
      return NextResponse.json(
        { success: false, error: "instructorId dan content wajib" },
        { status: 400 }
      );
    }

    // Validate user exists (instructor or student allowed to comment)
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("id", instructorId)
      .maybeSingle();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Validate post exists
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
        user_id: instructorId,
        content,
      });
    if (insErr) {
      return NextResponse.json(
        { success: false, error: insErr.message },
        { status: 400 }
      );
    }

    // Return enriched comment
    const { data: author } = await supabase
      .from("users")
      .select("id, full_name, avatar, role")
      .eq("id", instructorId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      item: {
        id: commentId,
        post_id: postId,
        user_id: instructorId,
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
