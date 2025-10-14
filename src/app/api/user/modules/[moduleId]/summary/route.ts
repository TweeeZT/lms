import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/user/modules/[moduleId]/summary
// Returns module_summary text_content for public overview modules
export async function GET(
  req: NextRequest,
  { params }: { params: { moduleId: string } }
) {
  const moduleId = params.moduleId;

  if (!moduleId) {
    return NextResponse.json(
      { success: false, error: "moduleId required" },
      { status: 400 }
    );
  }

  try {
    // First check if module is overview type (public/free)
    const { data: module, error: moduleErr } = await supabase
      .from("modules")
      .select("id, module_kind")
      .eq("id", moduleId)
      .maybeSingle();

    if (moduleErr) throw moduleErr;
    if (!module) {
      return NextResponse.json(
        { success: false, error: "Module not found" },
        { status: 404 }
      );
    }

    // Only allow public access to overview modules
    if (module.module_kind !== "overview") {
      return NextResponse.json(
        {
          success: false,
          error: "Only overview modules are publicly accessible",
        },
        { status: 403 }
      );
    }

    // Fetch module_summary
    const { data: summary, error: summaryErr } = await supabase
      .from("module_summary")
      .select("text_content")
      .eq("module_id", moduleId)
      .maybeSingle();

    if (summaryErr) throw summaryErr;

    return NextResponse.json({
      success: true,
      text_content: summary?.text_content || null,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to load module summary";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
