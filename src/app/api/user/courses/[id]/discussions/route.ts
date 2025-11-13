import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

// GET /api/user/courses/[id]/discussions?userId=...&q=...&sort=latest|popular&mine=true|false&page=1&limit=10
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const courseId = params.id;
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const sort = (req.nextUrl.searchParams.get("sort") || "latest") as "latest" | "popular";
  const mine = String(req.nextUrl.searchParams.get("mine") || "false") === "true";
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") || 1));
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 10)));
  if (!userId) return NextResponse.json({ success: false, error: "userId wajib" }, { status: 400 });
  const supabase = supabaseAdmin;
  try {
    // Enrollment gate with instructor override
    const { data: roleRow } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
    if (!roleRow) return NextResponse.json({ success: false, error: "User tidak ditemukan" }, { status: 404 });
    const isSchool = roleRow.role === "school";
    const { data: enrollment } = await supabase
      .from(isSchool ? "school_progress" : "user_progress")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();
    // if not enrolled, allow if user is the instructor of the course
    if (!enrollment) {
      const { data: c } = await supabase.from("courses").select("instructor_id").eq("id", courseId).maybeSingle();
      const isInstructorOfCourse = c && String(c.instructor_id) === String(userId);
      if (!isInstructorOfCourse) {
        return NextResponse.json({ success: false, error: "Diskusi hanya untuk peserta kursus" }, { status: 403 });
      }
    }

    let query = supabase
      .from("discussion_posts")
      .select("id,user_id,title,content,likes,tags,created_at,course_id", { count: "exact" })
      .eq("course_id", courseId);
    if (mine) query = query.eq("user_id", userId);
    if (q) query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);
    if (sort === "latest") query = query.order("created_at", { ascending: false });
    else if (sort === "popular") query = query.order("likes", { ascending: false });

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data: posts, error, count } = await query.range(from, to);
    if (error) throw error;
    const authorIds = Array.from(new Set((posts || []).map(p => p.user_id)));
    const { data: authors } = await supabase.from("users").select("id,full_name,avatar,role").in("id", authorIds);
    const authorsMap = new Map((authors || []).map(a => [a.id, a]));

    // Fetch media for these posts
    const postIds = (posts || []).map(p => p.id);
    let mediaByPost: Record<string, any[]> = {};
    if (postIds.length) {
      const { data: mediaRows } = await supabase
        .from("discussion_media")
        .select("id,post_id,m_type,url,thumbnail")
        .in("post_id", postIds);
      (mediaRows || []).forEach(m => {
        if (!mediaByPost[m.post_id]) mediaByPost[m.post_id] = [];
        mediaByPost[m.post_id].push(m);
      });
    }

    return NextResponse.json({ success: true, items: (posts || []).map(p => ({ ...p, user: authorsMap.get(p.user_id) || null, media: mediaByPost[p.id] || [] })), total: count || 0, page, limit });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Gagal memuat diskusi kursus" }, { status: 500 });
  }
}

// POST multipart (userId, title, content, tags(JSON), files[])
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const courseId = params.id;
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ success: false, error: "Gunakan multipart/form-data" }, { status: 400 });
    }
    const form = await req.formData();
    const userId = String(form.get("userId") || "").trim();
    const title = String(form.get("title") || "").trim();
    const content = String(form.get("content") || "").trim();
    let tags: string[] = [];
    const tagsRaw = form.get("tags");
    if (typeof tagsRaw === "string" && tagsRaw) {
      try { tags = JSON.parse(tagsRaw); } catch { tags = []; }
    }
    if (!userId || !title || !content) {
      return NextResponse.json({ success: false, error: "userId, title, content wajib" }, { status: 400 });
    }
    const supabase = supabaseAdmin;
    const { data: roleRow } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
    if (!roleRow) return NextResponse.json({ success: false, error: "User tidak ditemukan" }, { status: 404 });
    const isSchool = roleRow.role === "school";
    const { data: enrollment } = await supabase
      .from(isSchool ? "school_progress" : "user_progress")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (!enrollment) {
      const { data: c } = await supabase.from("courses").select("instructor_id").eq("id", courseId).maybeSingle();
      const isInstructorOfCourse = c && String(c.instructor_id) === String(userId);
      if (!isInstructorOfCourse) {
        return NextResponse.json({ success: false, error: "Diskusi hanya untuk peserta kursus" }, { status: 403 });
      }
    }

    const postId = globalThis.crypto?.randomUUID?.() || `cdisc-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const { error: insErr } = await supabase.from("discussion_posts").insert({ id: postId, user_id: userId, title, content, likes: 0, tags, course_id: courseId });
    if (insErr) throw insErr;

    const files = form.getAll("files");
    const uploaded: Array<{ id: string; m_type: string; url: string; thumbnail?: string | null }> = [];
    for (const f of files) {
      if (f instanceof Blob) {
        const file = f as Blob;
        const ct = file.type || "application/octet-stream";
        const isImage = /^image\//i.test(ct);
        const isVideo = /^video\//i.test(ct);
        if (!isImage && !isVideo) continue;
        const ext = (ct.split("/").pop() || "bin").toLowerCase();
        const objectPath = `${postId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("discussion").upload(objectPath, file, { cacheControl: "3600", upsert: false, contentType: ct });
        if (upErr) {
          await supabase.from("discussion_posts").delete().eq("id", postId);
          return NextResponse.json({ success: false, error: upErr.message }, { status: 400 });
        }
        const { data: urlData } = supabase.storage.from("discussion").getPublicUrl(objectPath);
        uploaded.push({ id: globalThis.crypto?.randomUUID?.() || `med-${Date.now()}`, m_type: isImage ? "image" : "video", url: urlData.publicUrl, thumbnail: null });
      }
    }
    if (uploaded.length) {
      const rows = uploaded.map(m => ({ id: m.id, post_id: postId, m_type: m.m_type, url: m.url, thumbnail: m.thumbnail }));
      const { error: mErr } = await supabase.from("discussion_media").insert(rows);
      if (mErr) return NextResponse.json({ success: false, error: mErr.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, id: postId });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Gagal membuat diskusi kursus" }, { status: 500 });
  }
}
