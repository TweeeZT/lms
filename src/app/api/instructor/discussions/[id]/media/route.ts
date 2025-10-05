import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// PATCH /api/instructor/discussions/[id]/media (multipart)
// Body: instructorId, files[], deleteMediaIds (JSON array string)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { success: false, error: "Gunakan multipart/form-data" },
        { status: 400 }
      );
    }

    const form = await req.formData();
    const instructorId = String(form.get("instructorId") || "").trim();
    const postId = params.id;
    const deleteMediaIdsRaw = form.get("deleteMediaIds");
    let deleteMediaIds: string[] = [];

    if (typeof deleteMediaIdsRaw === "string" && deleteMediaIdsRaw) {
      try {
        deleteMediaIds = JSON.parse(deleteMediaIdsRaw);
      } catch {
        deleteMediaIds = [];
      }
    }

    if (!instructorId) {
      return NextResponse.json(
        { success: false, error: "instructorId wajib" },
        { status: 400 }
      );
    }

    // Verify ownership
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

    if (post.user_id !== instructorId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Delete specified media
    if (deleteMediaIds.length > 0) {
      const { data: mediaToDelete } = await supabase
        .from("discussion_media")
        .select("id, url")
        .eq("post_id", postId)
        .in("id", deleteMediaIds);

      if (mediaToDelete && mediaToDelete.length > 0) {
        // Delete from storage
        for (const m of mediaToDelete) {
          const urlObj = new URL(m.url);
          const pathParts = urlObj.pathname.split("/discussion/");
          if (pathParts.length > 1) {
            const objectPath = pathParts[1];
            await supabase.storage.from("discussion").remove([objectPath]);
          }
        }

        // Delete from database
        await supabase
          .from("discussion_media")
          .delete()
          .in("id", deleteMediaIds);
      }
    }

    // Upload new media
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
        const isImage = ct.startsWith("image/");
        const isVideo = ct.startsWith("video/");
        if (!isImage && !isVideo) continue;

        const ext = ct.split("/")[1] || "bin";
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

    // Insert new media into database
    if (uploaded.length > 0) {
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

    return NextResponse.json({
      success: true,
      deletedCount: deleteMediaIds.length,
      uploadedCount: uploaded.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal update media";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
