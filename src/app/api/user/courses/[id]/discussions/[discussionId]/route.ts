import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

// GET single course discussion thread including comments
export async function GET(req: NextRequest, { params }: { params: { id: string; discussionId: string } }) {
  const courseId = params.id;
  const discussionId = params.discussionId;
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ success: false, error: 'userId wajib' }, { status: 400 });
  const supabase = supabaseAdmin;
  try {
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

    const { data: post, error: postErr } = await supabase
      .from('discussion_posts')
      .select('id,user_id,title,content,likes,tags,created_at')
      .eq('id', discussionId)
      .eq('course_id', courseId)
      .maybeSingle();
    if (postErr) throw postErr;
    if (!post) return NextResponse.json({ success: false, error: 'Post tidak ditemukan' }, { status: 404 });

    const { data: author } = await supabase.from('users').select('id,full_name,avatar,role').eq('id', post.user_id).maybeSingle();
    const { data: comments } = await supabase
      .from('discussion_comments')
      .select('id,post_id,user_id,content,created_at')
      .eq('post_id', discussionId)
      .order('created_at', { ascending: true });
    const commentAuthorIds = Array.from(new Set((comments || []).map(c => c.user_id)));
    const { data: cAuthors } = await supabase.from('users').select('id,full_name,avatar,role').in('id', commentAuthorIds);
    const authorsMap = new Map((cAuthors || []).map(u => [u.id, u]));

    const { data: media } = await supabase
      .from('discussion_media')
      .select('id,post_id,m_type,url,thumbnail')
      .eq('post_id', discussionId);
    return NextResponse.json({ success: true, item: { ...post, user: author || null, comments: (comments || []).map(c => ({ ...c, user: authorsMap.get(c.user_id) || null })), media: media || [] } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memuat diskusi';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PATCH update a course-scoped discussion post (title/content/tags)
export async function PATCH(req: NextRequest, { params }: { params: { id: string; discussionId: string } }) {
  const courseId = params.id;
  const discussionId = params.discussionId;
  const supabase = supabaseAdmin;
  try {
    const body = await req.json();
    const { userId, title, content, tags } = body || {};
    if (!userId) return NextResponse.json({ success: false, error: 'userId wajib' }, { status: 400 });
    if (!title || !content) return NextResponse.json({ success: false, error: 'Judul & konten wajib' }, { status: 400 });
    const { data: post } = await supabase
      .from('discussion_posts')
      .select('id,user_id')
      .eq('id', discussionId)
      .eq('course_id', courseId)
      .maybeSingle();
    if (!post) return NextResponse.json({ success: false, error: 'Post tidak ditemukan' }, { status: 404 });
    if (post.user_id !== userId) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    const { error: updErr } = await supabase
      .from('discussion_posts')
      .update({ title: String(title), content: String(content), tags: Array.isArray(tags) ? tags : [] })
      .eq('id', discussionId);
    if (updErr) return NextResponse.json({ success: false, error: updErr.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal update';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE remove a course-scoped discussion post (and its comments & media)
export async function DELETE(req: NextRequest, { params }: { params: { id: string; discussionId: string } }) {
  const courseId = params.id;
  const discussionId = params.discussionId;
  const supabase = supabaseAdmin;
  try {
    const body = await req.json();
    const { userId } = body || {};
    if (!userId) return NextResponse.json({ success: false, error: 'userId wajib' }, { status: 400 });
    const { data: post } = await supabase
      .from('discussion_posts')
      .select('id,user_id')
      .eq('id', discussionId)
      .eq('course_id', courseId)
      .maybeSingle();
    if (!post) return NextResponse.json({ success: false, error: 'Post tidak ditemukan' }, { status: 404 });
    if (post.user_id !== userId) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    // delete dependents first (if no cascade)
    await supabase.from('discussion_comments').delete().eq('post_id', discussionId);
    // remove media files from storage, then delete rows
    const { data: mediaRows } = await supabase
      .from('discussion_media')
      .select('id,url')
      .eq('post_id', discussionId);
    if (mediaRows && mediaRows.length > 0) {
      const objects: string[] = [];
      for (const m of mediaRows) {
        try {
          const urlObj = new URL(m.url);
          const parts = urlObj.pathname.split('/discussion/');
          if (parts.length > 1) {
            objects.push(parts[1]);
          }
        } catch {}
      }
      if (objects.length) {
        await supabase.storage.from('discussion').remove(objects);
      }
    }
    await supabase.from('discussion_media').delete().eq('post_id', discussionId);
    const { error: delErr } = await supabase.from('discussion_posts').delete().eq('id', discussionId);
    if (delErr) return NextResponse.json({ success: false, error: delErr.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal hapus';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
