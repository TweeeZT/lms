import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // ensure access to env vars (not edge)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
if (!url || !serviceRole) {
  console.error(
    "Supabase env tidak lengkap. Cek NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"
  );
}
const supabase = createClient(url!, serviceRole!);

// GET /api/instructor/courses?instructorId=<uuid>&q=<search>&status=all|published|draft&page=1&limit=20
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  const q = searchParams.get("q") || "";
  const status = (searchParams.get("status") || "all") as
    | "all"
    | "published"
    | "draft";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get("limit") || 20))
  );

  if (!instructorId) {
    return NextResponse.json(
      { success: false, error: "instructorId wajib" },
      { status: 400 }
    );
  }

  try {
    let query = supabase
      .from("courses")
      .select(
        "id, instructor_id, title, description, thumbnail, category, price, duration_min, level, total_modules, enrolled_count, rating, is_published, points, created_at, updated_at",
        { count: "exact" }
      )
      .eq("instructor_id", instructorId)
      .order("created_at", { ascending: false });

    if (q) {
      query = query.ilike("title", `%${q}%`);
    }
    if (status === "published") {
      query = query.eq("is_published", true);
    } else if (status === "draft") {
      query = query.eq("is_published", false);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    return NextResponse.json({
      success: true,
      items: data || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat kursus";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// POST /api/instructor/courses
// Body: { instructorId, title, price?, level?, total_modules?, is_published? }
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Gunakan multipart/form-data berisi file thumbnail. Upload hanya dilakukan saat Simpan.",
        },
        { status: 400 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    const instructorId = String(form.get("instructorId") || "").trim();
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const category = String(form.get("category") || "").trim();
    const level = String(form.get("level") || "").trim();
    const price = Number(form.get("price") || 0);
    const total_modules = Number(form.get("total_modules") || 0);
    const duration_min = Number(form.get("duration_min") || 0);
    const points = Number(form.get("points") || 0);
    const is_published = String(form.get("is_published") || "false") === "true";
    const overviewTitle = String(form.get("overviewTitle") || "").trim();
    const overviewContent = String(form.get("overviewContent") || "").trim();

    if (!instructorId || !title) {
      return NextResponse.json(
        { success: false, error: "instructorId dan title wajib" },
        { status: 400 }
      );
    }

    const missing: string[] = [];
    if (!title) missing.push("judul");
    if (!description) missing.push("deskripsi");
    if (!category) missing.push("kategori");
    if (!level) missing.push("level");
    if (!Number.isFinite(total_modules) || total_modules <= 0)
      missing.push("total modul (> 0)");
    if (!Number.isFinite(duration_min) || duration_min <= 0)
      missing.push("durasi (menit > 0)");
    if (!file || !(file instanceof Blob)) missing.push("thumbnail (file)");

    if (missing.length) {
      return NextResponse.json(
        {
          success: false,
          error: `Field wajib belum lengkap: ${missing.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const newId: string =
      globalThis?.crypto?.randomUUID?.() ||
      `course-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Upload image to storage using courseId as path
    const contentTypeFile = (file as Blob).type || "application/octet-stream";
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
    const objectPath = `${newId}/thumbnail-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${extGuess}`;

    const { error: upErr } = await supabase.storage
      .from("lessons-thumbnail")
      .upload(objectPath, file as Blob, {
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
    const publicUrl = urlData.publicUrl;

    const insertPayload = {
      id: newId,
      instructor_id: instructorId,
      title,
      description,
      // ensure non-null value for NOT NULL constraint
      thumbnail: publicUrl || "",
      category,
      price: Number(price ?? 0),
      duration_min: Number(duration_min),
      level,
      total_modules: Number(total_modules),
      enrolled_count: 0,
      rating: 0,
      is_published: Boolean(is_published ?? false),
      points: Number(points ?? 0),
    } as const;

    const { data, error } = await supabase
      .from("courses")
      .insert(insertPayload)
      .select(
        "id, instructor_id, title, description, thumbnail, category, price, duration_min, level, total_modules, enrolled_count, rating, is_published, points, created_at, updated_at"
      )
      .single();
    if (error) {
      // cleanup uploaded file to keep operation atomic
      try {
        await supabase.storage.from("lessons-thumbnail").remove([objectPath]);
      } catch {}
      const status = /row-level security/i.test(error.message) ? 403 : 400;
      const msg = /row-level security/i.test(error.message)
        ? "Gagal: kebijakan RLS menolak insert."
        : error.message || "Supabase error";
      return NextResponse.json(
        { success: false, error: msg, details: error },
        { status }
      );
    }

    // Create overview module if overviewTitle or overviewContent provided
    if (overviewTitle || overviewContent) {
      const moduleId =
        globalThis?.crypto?.randomUUID?.() ||
        `module-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const moduleTitle = overviewTitle || "Pengenalan";

      console.log("[CREATE] Inserting overview module:", {
        moduleId,
        courseId: newId,
        title: moduleTitle,
      });

      const { error: moduleError } = await supabase.from("modules").insert({
        id: moduleId,
        course_id: newId,
        title: moduleTitle,
        module_kind: "overview",
        description: "Modul pengantar gratis untuk memperkenalkan kursus",
        is_published: true,
      });

      if (moduleError) {
        console.error(
          "[CREATE] Failed to insert overview module:",
          moduleError
        );
        return NextResponse.json(
          {
            success: false,
            error: "Gagal membuat modul pengantar: " + moduleError.message,
          },
          { status: 500 }
        );
      }

      if (overviewContent) {
        console.log("[CREATE] Inserting module_summary:", {
          moduleId,
          contentLength: overviewContent.length,
        });

        const { error: summaryError } = await supabase
          .from("module_summary")
          .insert({
            id: globalThis?.crypto?.randomUUID?.() || `summary-${Date.now()}`,
            module_id: moduleId,
            text_content: overviewContent,
          });

        if (summaryError) {
          console.error(
            "[CREATE] Failed to insert module_summary:",
            summaryError
          );
          return NextResponse.json(
            {
              success: false,
              error:
                "Gagal menyimpan konten modul pengantar: " +
                summaryError.message,
            },
            { status: 500 }
          );
        }

        console.log("[CREATE] Module summary inserted successfully");
      }
    }

    return NextResponse.json({ success: true, item: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal membuat kursus";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
