import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  const id: string = params.id;
  if (!instructorId) {
    return NextResponse.json(
      { success: false, error: "instructorId wajib" },
      { status: 400 }
    );
  }
  try {
    const { data, error } = await supabase
      .from("courses")
      .select(
        "id, instructor_id, title, description, thumbnail, category, price, duration_min, level, total_modules, enrolled_count, rating, is_published, created_at, updated_at"
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.instructor_id !== instructorId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or not found" },
        { status: 403 }
      );
    }
    return NextResponse.json({ success: true, item: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat kursus";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// PATCH /api/instructor/courses/[id]?instructorId=...
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  const id: string = params.id;
  if (!instructorId) {
    return NextResponse.json(
      { success: false, error: "instructorId wajib" },
      { status: 400 }
    );
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    const allowed: Record<string, unknown> = {};
    let newThumbnailUrl: string | undefined;
    let newObjectPath: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const title = String(form.get("title") || "").trim();
      const description = String(form.get("description") || "").trim();
      const category = String(form.get("category") || "").trim();
      const level = String(form.get("level") || "").trim();
      const price = form.get("price");
      const total_modules = form.get("total_modules");
      const duration_min = form.get("duration_min");
      const is_published = form.get("is_published");
      const file = form.get("file");

      if (title) allowed["title"] = title;
      if (description) allowed["description"] = description;
      if (category) allowed["category"] = category;
      if (level) allowed["level"] = level;
      if (price !== null) allowed["price"] = Number(price);
      if (total_modules !== null)
        allowed["total_modules"] = Number(total_modules);
      if (duration_min !== null) allowed["duration_min"] = Number(duration_min);
      if (is_published !== null)
        allowed["is_published"] = String(is_published) === "true";

      if (file && file instanceof Blob) {
        const contentTypeFile =
          (file as Blob).type || "application/octet-stream";
        if (!/^image\//i.test(contentTypeFile)) {
          return NextResponse.json(
            { success: false, error: "Hanya file gambar yang diperbolehkan" },
            { status: 400 }
          );
        }
        const originalName = String(form.get("filename") || "thumbnail");
        const extGuess = originalName.includes(".")
          ? originalName.split(".").pop()!
          : contentTypeFile.split("/").pop() || "jpg";
        const objectPath = `${id}/thumbnail-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${extGuess}`;
        const { error: upErr } = await supabase.storage
          .from("lessons-thumbnail")
          .upload(objectPath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: contentTypeFile,
          });
        if (upErr) {
          const status = /row-level security/i.test(upErr.message) ? 403 : 400;
          const msg = /row-level security/i.test(upErr.message)
            ? "Gagal upload: kebijakan RLS storage menolak operasi."
            : upErr.message;
          return NextResponse.json({ success: false, error: msg }, { status });
        }
        const { data: urlData } = supabase.storage
          .from("lessons-thumbnail")
          .getPublicUrl(objectPath);
        newThumbnailUrl = urlData.publicUrl;
        newObjectPath = objectPath;
        allowed["thumbnail"] = newThumbnailUrl;
      }
    } else {
      // Fallback: JSON metadata-only update
      const body: Record<string, unknown> = await req.json();
      const fields = [
        "title",
        "category",
        "price",
        "level",
        "total_modules",
        "is_published",
        "description",
        "thumbnail",
        "duration_min",
      ];
      for (const f of fields) {
        if (Object.prototype.hasOwnProperty.call(body, f)) {
          if (f === "thumbnail") {
            const val = body[f];
            if (typeof val === "string") {
              const t = val.trim();
              if (!t) {
                return NextResponse.json(
                  { success: false, error: "Thumbnail wajib diisi" },
                  { status: 400 }
                );
              }
              allowed[f] = t;
            }
          } else {
            allowed[f] = body[f] as unknown;
          }
        }
      }
    }

    // Ensure ownership
    const { data: course, error: getErr } = await supabase
      .from("courses")
      .select("id, instructor_id")
      .eq("id", id)
      .maybeSingle();
    if (getErr) throw getErr;
    if (!course || course.instructor_id !== instructorId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from("courses")
      .update(allowed)
      .eq("id", id)
      .select(
        "id, instructor_id, title, description, thumbnail, category, price, duration_min, level, total_modules, enrolled_count, rating, is_published, created_at, updated_at"
      )
      .single();
    if (error) {
      // DB update failed -> if we uploaded a new file, remove it to keep atomicity
      if (newObjectPath) {
        try {
          await supabase.storage
            .from("lessons-thumbnail")
            .remove([newObjectPath]);
        } catch {}
      }
      throw error;
    }

    // If we uploaded a new thumbnail successfully, delete previous thumbnail file
    if (newThumbnailUrl) {
      // Fetch previous thumbnail URL to compute object path
      // We already selected updated row; need old value before update.
      // Workaround: query storage list in folder and delete all except the new one.
      try {
        const { data: list } = await supabase.storage
          .from("lessons-thumbnail")
          .list(id, { limit: 100, offset: 0 });
        const toDelete = (list || [])
          .filter((obj) => `${id}/${obj.name}` !== newObjectPath)
          .map((obj) => `${id}/${obj.name}`);
        if (toDelete.length) {
          await supabase.storage.from("lessons-thumbnail").remove(toDelete);
        }
      } catch {}
    }

    return NextResponse.json({ success: true, item: data });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal mengupdate kursus";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// DELETE /api/instructor/courses/[id]?instructorId=...
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  const id: string = params.id;
  if (!instructorId) {
    return NextResponse.json(
      { success: false, error: "instructorId wajib" },
      { status: 400 }
    );
  }
  try {
    // Ensure ownership
    const { data: course, error: getErr } = await supabase
      .from("courses")
      .select("id, instructor_id")
      .eq("id", id)
      .maybeSingle();
    if (getErr) throw getErr;
    if (!course || course.instructor_id !== instructorId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) throw error;

    // Best-effort: delete thumbnails folder under this course id
    try {
      const { data: list } = await supabase.storage
        .from("lessons-thumbnail")
        .list(id, { limit: 100, offset: 0 });
      const paths = (list || []).map((obj) => `${id}/${obj.name}`);
      if (paths.length) {
        await supabase.storage.from("lessons-thumbnail").remove(paths);
      }
    } catch {}

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal menghapus kursus";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
