import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseServer";

// GET /api/admin/courses/[id]/overview?userId=...
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const courseId = params.id;

  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId wajib" },
      { status: 400 }
    );
  }

  try {
    // Verify admin role
    const { data: admin, error: adminErr } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (adminErr || !admin || admin.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    // Fetch overview module
    const { data: module, error: moduleErr } = await supabaseAdmin
      .from("modules")
      .select("id, title")
      .eq("course_id", courseId)
      .eq("module_kind", "overview")
      .maybeSingle();

    if (moduleErr) throw moduleErr;

    if (!module) {
      return NextResponse.json({
        success: true,
        overview: null,
      });
    }

    // Fetch module_summary
    const { data: summary, error: summaryErr } = await supabaseAdmin
      .from("module_summary")
      .select("text_content")
      .eq("module_id", module.id)
      .maybeSingle();

    if (summaryErr) throw summaryErr;

    return NextResponse.json({
      success: true,
      overview: {
        moduleId: module.id,
        title: module.title,
        content: summary?.text_content || "",
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal memuat overview";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
