import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabase = createClient(url, serviceRole);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const userId = String(formData.get("userId") || "").trim();
    const rawBucket = String(formData.get("bucket") || "avatar").trim();
    // Allow assignment submission buckets
    const bucket =
      /^(avatar|avatars|uploads|module-submission|assignments-submissions)$/i.test(
        rawBucket
      )
        ? rawBucket
        : "avatar";

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: "File gambar wajib" },
        { status: 400 }
      );
    }
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId wajib" },
        { status: 400 }
      );
    }

    const contentType = (file as Blob).type || "application/octet-stream";
    // For assignment buckets allow common doc/video types else restrict to images
    const isAssignmentBucket =
      /module-submission|assignments-submissions/i.test(bucket);
    if (!isAssignmentBucket && !/^image\//i.test(contentType)) {
      return NextResponse.json(
        { success: false, error: "Hanya file gambar yang diperbolehkan" },
        { status: 400 }
      );
    }
    if (isAssignmentBucket) {
      const allowed = [
        /^image\//i,
        /^video\//i,
        /pdf$/i,
        /zip$/i,
        /octet-stream$/i,
        /msword$/i,
        /officedocument/i,
      ];
      const ok = allowed.some((r) => r.test(contentType));
      if (!ok) {
        return NextResponse.json(
          { success: false, error: "Tipe file tidak diizinkan" },
          { status: 400 }
        );
      }
    }

    const originalName = ((formData.get("filename") as string) || "avatar.jpg")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .slice(0, 80);
    const extGuess =
      (originalName.includes(".")
        ? originalName.split(".").pop()!
        : contentType.split("/").pop() || "jpg"
      )
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "jpg";
    // Deterministic path: <userId>/avatar.<ext> to auto-replace
    // For assignment store path: <userId>/<timestamp>-<sanitized>
    const objectPath = isAssignmentBucket
      ? `${userId}/${Date.now()}-${originalName}`
      : `${userId}/avatar.${extGuess}`;

    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(objectPath, file, {
        cacheControl: "3600",
        upsert: true,
        contentType,
      });
    if (upErr) {
      const status = /row-level security/i.test(upErr.message) ? 403 : 400;
      const msg = /row-level security/i.test(upErr.message)
        ? "Gagal upload: kebijakan RLS storage menolak operasi."
        : upErr.message;
      return NextResponse.json({ success: false, error: msg }, { status });
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    return NextResponse.json({
      success: true,
      url: data.publicUrl,
      path: objectPath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal upload";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
