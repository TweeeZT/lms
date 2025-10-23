import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseServer";

// Helper to enforce admin role
async function requireAdmin(userId: string) {
  if (!userId) return { ok: false, error: "userId required" } as const;
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data || data.role !== "admin") {
    return { ok: false, error: "Forbidden" } as const;
  }
  return { ok: true, user: data } as const;
}

function num(val: string | null, def: number, min: number, max: number) {
  const n = Number(val);
  if (Number.isFinite(n)) return Math.min(max, Math.max(min, n));
  return def;
}

// GET /api/admin/courses?userId=<adminId>&q=&status=all|published|draft&page=1&limit=20&instructorId=optional
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const actorId = (searchParams.get("userId") || "").trim();
  const auth = await requireAdmin(actorId);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.error === "Forbidden" ? 403 : 400 }
    );
  }

  const q = (searchParams.get("q") || "").trim();
  const status = (searchParams.get("status") || "all").trim();
  const instructorFilter = (searchParams.get("instructorId") || "").trim();
  const page = num(searchParams.get("page"), 1, 1, 10000);
  const limit = num(searchParams.get("limit"), 20, 1, 100);

  try {
    let query = supabaseAdmin
      .from("courses")
      .select(
        // removed total_modules from select
        "id, instructor_id, title, description, thumbnail, category, price, duration_min, level, enrolled_count, rating, is_published, points, created_at, updated_at, users:instructor_id(full_name)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (q) {
      const safe = q.replace(/%/g, "");
      query = query.ilike("title", `%${safe}%`);
    }
    if (status === "published") query = query.eq("is_published", true);
    else if (status === "draft") query = query.eq("is_published", false);
    if (instructorFilter) query = query.eq("instructor_id", instructorFilter);

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    type RawCourse = {
      id: string;
      instructor_id: string;
      title: string;
      description: string | null;
      thumbnail: string | null;
      category: string;
      price: number | null;
      duration_min: number | null;
      level: string;
      // total_modules removed
      enrolled_count: number | null;
      rating: number | null;
      is_published: boolean | null;
      created_at: string;
      updated_at: string | null;
      // Supabase can return a single object or array depending on join; we accept both
      users?:
        | { full_name: string | null }
        | { full_name: string | null }[]
        | null;
    };
    // Align total_modules with actual published modules count (like detail pages)
    const courseIds = (data || []).map((c: RawCourse) => c.id);
    let modulesCountByCourse: Record<string, number> = {};
    if (courseIds.length > 0) {
      const { data: modRows } = await supabaseAdmin
        .from("modules")
        .select("course_id")
        .in("course_id", courseIds)
        // count only published modules (or null = published)
        .or("is_published.eq.true,is_published.is.null");
      if (Array.isArray(modRows)) {
        modulesCountByCourse = modRows.reduce<Record<string, number>>((acc, r: any) => {
          const cid = r.course_id;
          acc[cid] = (acc[cid] || 0) + 1;
          return acc;
        }, {});
      }
    }

    const items = (data || []).map((c: RawCourse) => {
      let instructor_name: string | null = null;
      if (c.users) {
        // users can be object or array
        if (Array.isArray(c.users)) instructor_name = c.users[0]?.full_name || null;
        else instructor_name = c.users?.full_name || null;
      }
      return {
        ...c,
        instructor_name,
        // derive total_modules from actual module counts only
        total_modules: modulesCountByCourse[c.id] ?? 0,
      };
    });

    return NextResponse.json({
      success: true,
      items,
      total: count || 0,
      page,
      limit,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST multipart create (admin chooses instructorId)
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const actorId = (searchParams.get("userId") || "").trim();
  const auth = await requireAdmin(actorId);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.error === "Forbidden" ? 403 : 400 }
    );
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { success: false, error: "Gunakan multipart/form-data" },
        { status: 400 }
      );
    }
    const form = await req.formData();
    const instructor_id = String(form.get("instructor_id") || "").trim();
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const category = String(form.get("category") || "").trim();
    const level = String(form.get("level") || "").trim();
    const price = Number(form.get("price") || 0);
    const total_modules = undefined; // removed usage
    const duration_min = Number(form.get("duration_min") || 0);
    const points = Number(form.get("points") || 0);
    const is_published = String(form.get("is_published") || "false") === "true";
    const overviewTitle = String(form.get("overviewTitle") || "").trim();
    const overviewContent = String(form.get("overviewContent") || "").trim();
    const file = form.get("file");

    const missing: string[] = [];
    if (!instructor_id) missing.push("instructor");
    if (!title) missing.push("judul");
    if (!description) missing.push("deskripsi");
    if (!category) missing.push("kategori");
    if (!level) missing.push("level");
    // removed check for total_modules
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

    // Ensure instructor exists and role is instructor
    const { data: inst, error: instErr } = await supabaseAdmin
      .from("users")
      .select("id, role, full_name")
      .eq("id", instructor_id)
      .maybeSingle();
    if (instErr || !inst || inst.role !== "instructor") {
      return NextResponse.json(
        { success: false, error: "Instructor tidak valid" },
        { status: 400 }
      );
    }

    const newId: string =
      (
        globalThis as { crypto?: { randomUUID?: () => string } }
      )?.crypto?.randomUUID?.() ||
      `course-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const contentTypeFile = (file as Blob).type || "application/octet-stream";
    if (!/^image\//i.test(contentTypeFile)) {
      return NextResponse.json(
        { success: false, error: "Hanya file gambar" },
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

    const { error: upErr } = await supabaseAdmin.storage
      .from("lessons-thumbnail")
      .upload(objectPath, file as Blob, {
        cacheControl: "3600",
        upsert: false,
        contentType: contentTypeFile,
      });
    if (upErr) {
      return NextResponse.json(
        { success: false, error: upErr.message || "Upload gagal" },
        { status: 400 }
      );
    }
    const { data: urlData } = supabaseAdmin.storage
      .from("lessons-thumbnail")
      .getPublicUrl(objectPath);
    const thumbnail = urlData.publicUrl;

    const insertPayload = {
      id: newId,
      instructor_id,
      title,
      description,
      thumbnail,
      category,
      price: Number(price || 0),
      duration_min: Number(duration_min),
      level,
      // removed: total_modules
      points: Number(points),
      enrolled_count: 0,
      rating: 0,
      is_published: Boolean(is_published),
    };

    const { data, error } = await supabaseAdmin
      .from("courses")
      .insert(insertPayload)
      .select(
        "id, instructor_id, title, description, thumbnail, category, price, duration_min, level, total_modules, points, enrolled_count, rating, is_published, created_at, updated_at"
      )
      .single();
    if (error) {
      try {
        await supabaseAdmin.storage
          .from("lessons-thumbnail")
          .remove([objectPath]);
      } catch {}
      return NextResponse.json(
        { success: false, error: error.message || "Insert gagal" },
        { status: 400 }
      );
    }

    // Create overview module if provided
    if (overviewTitle || overviewContent) {
      const moduleId =
        globalThis?.crypto?.randomUUID?.() ||
        `module-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const moduleTitle = overviewTitle || "Pengenalan";

      console.log("[ADMIN CREATE] Inserting overview module:", {
        moduleId,
        courseId: newId,
        title: moduleTitle,
      });

      const { error: moduleError } = await supabaseAdmin
        .from("modules")
        .insert({
          id: moduleId,
          course_id: newId,
          title: moduleTitle,
          module_kind: "overview",
          description: "Modul pengantar gratis untuk memperkenalkan kursus",
          is_published: true,
        });

      if (moduleError) {
        console.error(
          "[ADMIN CREATE] Failed to insert overview module:",
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
        console.log("[ADMIN CREATE] Inserting module_summary:", {
          moduleId,
          contentLength: overviewContent.length,
        });

        const { error: summaryError } = await supabaseAdmin
          .from("module_summary")
          .insert({
            id: globalThis?.crypto?.randomUUID?.() || `summary-${Date.now()}`,
            module_id: moduleId,
            text_content: overviewContent,
          });

        if (summaryError) {
          console.error(
            "[ADMIN CREATE] Failed to insert module_summary:",
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

        console.log("[ADMIN CREATE] Module summary inserted successfully");
      }
    }

    return NextResponse.json({ success: true, item: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PATCH JSON metadata update or multipart with new thumbnail
export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const actorId = (searchParams.get("userId") || "").trim();
  const auth = await requireAdmin(actorId);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.error === "Forbidden" ? 403 : 400 }
    );
  }
  try {
    const contentType = req.headers.get("content-type") || "";
    let id: string | null = null;
    const allowed: Record<string, unknown> = {};
    let newObjectPath: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      id = String(form.get("id") || "").trim();
      const title = String(form.get("title") || "").trim();
      const description = String(form.get("description") || "").trim();
      const category = String(form.get("category") || "").trim();
      const level = String(form.get("level") || "").trim();
      const price = form.get("price");
      // removed total_modules handling
      const duration_min = form.get("duration_min");
      const points = form.get("points");
      const is_published = form.get("is_published");
      const instructor_id = String(form.get("instructor_id") || "").trim();
      const overviewTitle = String(form.get("overviewTitle") || "").trim();
      const overviewContent = String(form.get("overviewContent") || "").trim();
      const file = form.get("file");

      if (title) allowed.title = title;
      if (description) allowed.description = description;
      if (category) allowed.category = category;
      if (level) allowed.level = level;
      if (price !== null) allowed.price = Number(price);
      // removed: if (total_modules !== null) allowed.total_modules = Number(total_modules);
      if (duration_min !== null) allowed.duration_min = Number(duration_min);
      if (points !== null) allowed.points = Number(points);
      if (is_published !== null)
        allowed.is_published = String(is_published) === "true";

      // Store overview data for later module creation/update
      allowed["__overviewTitle"] = overviewTitle;
      allowed["__overviewContent"] = overviewContent;

      if (instructor_id) {
        // validate instructor role
        const { data: inst, error: instErr } = await supabaseAdmin
          .from("users")
          .select("id, role")
          .eq("id", instructor_id)
          .maybeSingle();
        if (!instErr && inst && inst.role === "instructor") {
          allowed.instructor_id = instructor_id;
        }
      }

      if (file && file instanceof Blob) {
        if (!id) {
          return NextResponse.json(
            { success: false, error: "id diperlukan untuk update" },
            { status: 400 }
          );
        }
        const contentTypeFile =
          (file as Blob).type || "application/octet-stream";
        if (!/^image\//i.test(contentTypeFile)) {
          return NextResponse.json(
            { success: false, error: "Hanya file gambar" },
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
        const { error: upErr } = await supabaseAdmin.storage
          .from("lessons-thumbnail")
          .upload(objectPath, file as Blob, {
            cacheControl: "3600",
            upsert: false,
            contentType: contentTypeFile,
          });
        if (upErr) {
          return NextResponse.json(
            { success: false, error: upErr.message || "Upload gagal" },
            { status: 400 }
          );
        }
        const { data: urlData } = supabaseAdmin.storage
          .from("lessons-thumbnail")
          .getPublicUrl(objectPath);
        allowed.thumbnail = urlData.publicUrl;
        newObjectPath = objectPath;
      }
    } else {
      const body = await req.json();
      id = String(body.id || "").trim();
      const fields = [
        "title",
        "description",
        "category",
        "price",
        "level",
        // "total_modules", // removed
        "duration_min",
        "points",
        "is_published",
        "thumbnail",
        "instructor_id",
      ];
      for (const f of fields) {
        if (Object.prototype.hasOwnProperty.call(body, f)) {
          if (f === "instructor_id") {
            const val = String(body[f] || "").trim();
            if (val) {
              const { data: inst, error: instErr } = await supabaseAdmin
                .from("users")
                .select("id, role")
                .eq("id", val)
                .maybeSingle();
              if (!instErr && inst && inst.role === "instructor") {
                allowed.instructor_id = val;
              }
            }
          } else {
            allowed[f] = body[f];
          }
        }
      }
      // Store overview data for later module creation/update
      if (Object.prototype.hasOwnProperty.call(body, "overviewTitle")) {
        allowed["__overviewTitle"] = body.overviewTitle;
      }
      if (Object.prototype.hasOwnProperty.call(body, "overviewContent")) {
        allowed["__overviewContent"] = body.overviewContent;
      }
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id required" },
        { status: 400 }
      );
    }

    const { data: existing, error: getErr } = await supabaseAdmin
      .from("courses")
      .select("id, thumbnail")
      .eq("id", id)
      .maybeSingle();
    if (getErr) throw getErr;
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );
    }

    // Extract overview data before updating (these shouldn't go to courses table)
    const overviewTitle = allowed["__overviewTitle"] as string | undefined;
    const overviewContent = allowed["__overviewContent"] as string | undefined;
    delete allowed["__overviewTitle"];
    delete allowed["__overviewContent"];

    if (
      Object.keys(allowed).length === 0 &&
      !overviewTitle &&
      !overviewContent
    ) {
      return NextResponse.json(
        { success: false, error: "No changes" },
        { status: 400 }
      );
    }

    // Only update course if there are course fields to update
    let data = existing;
    if (Object.keys(allowed).length > 0) {
      const { data: updated, error } = await supabaseAdmin
        .from("courses")
        .update(allowed)
        .eq("id", id)
        .select(
          // removed total_modules from returned fields
          "id, instructor_id, title, description, thumbnail, category, price, duration_min, level, points, enrolled_count, rating, is_published, created_at, updated_at"
        )
        .maybeSingle();
      if (error) {
        if (newObjectPath) {
          try {
            await supabaseAdmin.storage
              .from("lessons-thumbnail")
              .remove([newObjectPath]);
          } catch {}
        }
        return NextResponse.json(
          { success: false, error: error.message || "Update gagal" },
          { status: 400 }
        );
      }
      data = updated || data;
    }

    // Handle overview module creation/update
    if (overviewTitle || overviewContent) {
      // Check if overview module already exists for this course
      const { data: existingModule } = await supabaseAdmin
        .from("modules")
        .select("id")
        .eq("course_id", id)
        .eq("module_kind", "overview")
        .maybeSingle();

      if (existingModule) {
        // Update existing overview module
        const moduleTitle = overviewTitle || "Pengenalan";
        console.log("[ADMIN UPDATE] Updating existing overview module:", {
          moduleId: existingModule.id,
          title: moduleTitle,
        });

        const { error: updateModuleError } = await supabaseAdmin
          .from("modules")
          .update({ title: moduleTitle })
          .eq("id", existingModule.id);

        if (updateModuleError) {
          console.error(
            "[ADMIN UPDATE] Failed to update module:",
            updateModuleError
          );
        }

        if (overviewContent) {
          // Update or create module_summary
          const { data: existingSummary } = await supabaseAdmin
            .from("module_summary")
            .select("id")
            .eq("module_id", existingModule.id)
            .maybeSingle();

          if (existingSummary) {
            console.log("[ADMIN UPDATE] Updating module_summary:", {
              summaryId: existingSummary.id,
              contentLength: overviewContent.length,
            });

            const { error: updateSummaryError } = await supabaseAdmin
              .from("module_summary")
              .update({ text_content: overviewContent })
              .eq("id", existingSummary.id);

            if (updateSummaryError) {
              console.error(
                "[ADMIN UPDATE] Failed to update module_summary:",
                updateSummaryError
              );
              return NextResponse.json(
                {
                  success: false,
                  error:
                    "Gagal mengupdate konten modul pengantar: " +
                    updateSummaryError.message,
                },
                { status: 500 }
              );
            }

            console.log("[ADMIN UPDATE] Module summary updated successfully");
          } else {
            console.log("[ADMIN UPDATE] Creating new module_summary:", {
              moduleId: existingModule.id,
              contentLength: overviewContent.length,
            });

            const { error: insertSummaryError } = await supabaseAdmin
              .from("module_summary")
              .insert({
                id:
                  globalThis?.crypto?.randomUUID?.() || `summary-${Date.now()}`,
                module_id: existingModule.id,
                text_content: overviewContent,
              });

            if (insertSummaryError) {
              console.error(
                "[ADMIN UPDATE] Failed to insert module_summary:",
                insertSummaryError
              );
              return NextResponse.json(
                {
                  success: false,
                  error:
                    "Gagal menyimpan konten modul pengantar: " +
                    insertSummaryError.message,
                },
                { status: 500 }
              );
            }

            console.log("[ADMIN UPDATE] Module summary created successfully");
          }
        }
      } else {
        // Create new overview module
        const moduleId =
          globalThis?.crypto?.randomUUID?.() ||
          `module-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const moduleTitle = overviewTitle || "Pengenalan";

        console.log("[ADMIN UPDATE] Creating new overview module:", {
          moduleId,
          courseId: id,
          title: moduleTitle,
        });

        const { error: moduleError } = await supabaseAdmin
          .from("modules")
          .insert({
            id: moduleId,
            course_id: id,
            title: moduleTitle,
            module_kind: "overview",
            description: "Modul pengantar gratis untuk memperkenalkan kursus",
            is_published: true,
          });

        if (moduleError) {
          console.error("[ADMIN UPDATE] Failed to insert module:", moduleError);
          return NextResponse.json(
            {
              success: false,
              error: "Gagal membuat modul pengantar: " + moduleError.message,
            },
            { status: 500 }
          );
        }

        if (overviewContent) {
          console.log("[ADMIN UPDATE] Creating module_summary:", {
            moduleId,
            contentLength: overviewContent.length,
          });

          const { error: summaryError } = await supabaseAdmin
            .from("module_summary")
            .insert({
              id: globalThis?.crypto?.randomUUID?.() || `summary-${Date.now()}`,
              module_id: moduleId,
              text_content: overviewContent,
            });

          if (summaryError) {
            console.error(
              "[ADMIN UPDATE] Failed to insert module_summary:",
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

          console.log("[ADMIN UPDATE] Module summary created successfully");
        }
      }
    }

    // If new thumbnail uploaded, optional cleanup old folder images (best-effort)
    if (newObjectPath) {
      try {
        const courseFolder = id;
        const { data: list } = await supabaseAdmin.storage
          .from("lessons-thumbnail")
          .list(courseFolder, { limit: 100, offset: 0 });
        const toDelete = (list || [])
          .filter((obj) => `${courseFolder}/${obj.name}` !== newObjectPath)
          .map((obj) => `${courseFolder}/${obj.name}`);
        if (toDelete.length) {
          await supabaseAdmin.storage
            .from("lessons-thumbnail")
            .remove(toDelete);
        }
      } catch {}
    }

    return NextResponse.json({ success: true, item: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE: body { id }
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const actorId = (searchParams.get("userId") || "").trim();
  const auth = await requireAdmin(actorId);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.error === "Forbidden" ? 403 : 400 }
    );
  }
  try {
    const body = await req.json();
    const { id } = body || {};
    if (!id)
      return NextResponse.json(
        { success: false, error: "id required" },
        { status: 400 }
      );

    const { error } = await supabaseAdmin.from("courses").delete().eq("id", id);
    if (error) throw error;

    try {
      const { data: list } = await supabaseAdmin.storage
        .from("lessons-thumbnail")
        .list(id, { limit: 100, offset: 0 });
      const paths = (list || []).map((o) => `${id}/${o.name}`);
      if (paths.length) {
        await supabaseAdmin.storage.from("lessons-thumbnail").remove(paths);
      }
    } catch {}

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
