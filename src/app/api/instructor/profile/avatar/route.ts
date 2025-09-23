import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// POST multipart/form-data: { file: Blob, userId: string }
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const userId = String(form.get("userId") || "").trim();
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: "File avatar wajib" },
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
    if (!/^image\//i.test(contentType)) {
      return NextResponse.json(
        { success: false, error: "Hanya file gambar yang diperbolehkan" },
        { status: 400 }
      );
    }

    const filename = (form.get("filename") as string) || `avatar-${Date.now()}`;
    const ext = filename.includes(".")
      ? filename.split(".").pop()!
      : contentType.split("/").pop() || "jpg";
    const objectPath = `${userId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage
      .from("avatar")
      .upload(objectPath, file, {
        contentType,
        cacheControl: "3600",
        upsert: false,
      });
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    const { data } = supabase.storage.from("avatar").getPublicUrl(objectPath);

    // optionally update profile
    const updateProfile = String(form.get("updateProfile") || "").trim();
    if (updateProfile === "1" || /true/i.test(updateProfile)) {
      await supabase
        .from("users")
        .update({ avatar: data.publicUrl })
        .eq("id", userId);
    }

    return NextResponse.json({
      success: true,
      url: data.publicUrl,
      path: objectPath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal upload avatar";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
