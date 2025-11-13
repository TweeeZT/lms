import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

// POST comment on course discussion
// Body { userId, content }
export async function POST(req: NextRequest, { params }: { params: { id: string; discussionId: string } }) {
  const courseId = params.id;
  const discussionId = params.discussionId;
  try {
    const body = await req.json();
    const userId = String(body.userId || '').trim();
    const content = String(body.content || '').trim();
    if (!userId || !content) {
      return NextResponse.json({ success: false, error: 'userId dan content wajib' }, { status: 400 });
    }
    const supabase = supabaseAdmin;
    // Enrollment gate with instructor override
    const { data: roleRow } = await supabase.from('users').select('role').eq('id', userId).maybeSingle();
    if (!roleRow) return NextResponse.json({ success: false, error: 'User tidak ditemukan' }, { status: 404 });
    const isSchool = roleRow.role === 'school';
    const { data: enrollment } = await supabase
      .from(isSchool ? 'school_progress' : 'user_progress')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .maybeSingle();
    if (!enrollment) {
      const { data: c } = await supabase.from('courses').select('instructor_id').eq('id', courseId).maybeSingle();
      const isInstructorOfCourse = c && String(c.instructor_id) === String(userId);
      if (!isInstructorOfCourse) {
        return NextResponse.json({ success: false, error: 'Diskusi hanya untuk peserta kursus' }, { status: 403 });
      }
    }

    // Verify the post belongs to the course
    const { data: post } = await supabase
      .from('discussion_posts')
      .select('id')
      .eq('id', discussionId)
      .eq('course_id', courseId)
      .maybeSingle();
    if (!post) return NextResponse.json({ success: false, error: 'Post tidak ditemukan' }, { status: 404 });

    const commentId = globalThis.crypto?.randomUUID?.() || `cdcm-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const { error: insErr } = await supabase.from('discussion_comments').insert({
      id: commentId,
      post_id: discussionId,
      user_id: userId,
      content
    });
    if (insErr) throw insErr;
    const { data: author } = await supabase.from('users').select('id,full_name,avatar,role').eq('id', userId).maybeSingle();
    return NextResponse.json({ success: true, item: { id: commentId, post_id: discussionId, user_id: userId, content, created_at: new Date().toISOString(), user: author || null } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menambah komentar';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
