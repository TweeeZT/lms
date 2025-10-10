import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// PATCH edit komentar
// Body: { userId: string; content: string }
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const { id: postId, commentId } = params;
    const body = (await req.json()) as { userId?: string; content?: string };
    const { userId, content } = body;

    if (!userId || !content) {
      return NextResponse.json(
        { success: false, error: "userId dan content wajib" },
        { status: 400 }
      );
    }

    // cek komentar ada
    const { data: comment, error: cErr } = await supabase
      .from("discussion_comments")
      .select("id, user_id")
      .eq("id", commentId)
      .eq("post_id", postId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!comment) {
      return NextResponse.json({ success: false, error: "Komentar tidak ditemukan" }, { status: 404 });
    }
    if (comment.user_id !== userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    // update komentar
    const { error: updErr } = await supabase
      .from("discussion_comments")
      .update({ content })
      .eq("id", commentId);
    if (updErr) throw updErr;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengedit komentar";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE komentar
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const { id: postId, commentId } = params;
    const body = (await req.json()) as { userId?: string };
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId wajib" }, { status: 400 });
    }

    // cek komentar ada
    const { data: comment, error: cErr } = await supabase
      .from("discussion_comments")
      .select("id, user_id")
      .eq("id", commentId)
      .eq("post_id", postId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!comment) {
      return NextResponse.json({ success: false, error: "Komentar tidak ditemukan" }, { status: 404 });
    }
    if (comment.user_id !== userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    // hapus komentar
    const { error: delErr } = await supabase.from("discussion_comments").delete().eq("id", commentId);
    if (delErr) throw delErr;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus komentar";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
