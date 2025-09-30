import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(url, serviceRole);

// GET /api/user/blockly-projects?userId=...
// List user's own projects (or public if later extended)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = (searchParams.get("userId") || "").trim();
  const projectId = (searchParams.get("projectId") || "").trim();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId wajib" },
      { status: 400 }
    );
  }
  try {
    let query = supabase.from("blockly_projects").select("*");
    query = query.eq("user_id", userId);
    if (projectId) {
      query = query.eq("id", projectId).limit(1);
    } else {
      query = query.order("updated_at", { ascending: false });
    }
    const { data, error } = await query;
    if (error) throw error;
    if (projectId) {
      return NextResponse.json({ success: true, project: data?.[0] || null });
    }
    return NextResponse.json({ success: true, projects: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memuat project";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST /api/user/blockly-projects
// Body: { userId, title, description?, blocksJson?, javascriptCode?, isPublic? }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    const title = String(body.title || "").trim();
    if (!userId || !title) {
      return NextResponse.json(
        { success: false, error: "userId & title wajib" },
        { status: 400 }
      );
    }
    // Default starter workspace XML (simple when run block)
    const DEFAULT_XML =
      '<xml xmlns="https://developers.google.com/blockly/xml"><block type="controls_repeat_ext" x="20" y="20"><value name="TIMES"><shadow type="math_number"><field name="NUM">5</field></shadow></value><statement name="DO"><block type="text_print"><value name="TEXT"><shadow type="text"><field name="TEXT">Halo Dunia</field></shadow></value></block></statement></block></xml>';
    const workspaceXml = body.workspaceXml
      ? String(body.workspaceXml)
      : DEFAULT_XML;
    const codeJs = body.codeJs
      ? String(body.codeJs)
      : "for (let count = 0; count < 5; count++) {\n  console.log('Halo Dunia');\n}";
    const isPublic = !!body.isPublic;
    const insert = {
      user_id: userId,
      title,
      description: body.description ? String(body.description).trim() : null,
      workspace_xml: workspaceXml,
      code_js: codeJs,
      is_public: isPublic,
    };
    const { data, error } = await supabase
      .from("blockly_projects")
      .insert(insert)
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, id: data.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menambah project";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PATCH /api/user/blockly-projects
// Body: { projectId, userId, title?, description?, blocksJson?, javascriptCode?, isPublic? }
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const projectId = String(body.projectId || "").trim();
    const userId = String(body.userId || "").trim();
    if (!projectId || !userId) {
      return NextResponse.json(
        { success: false, error: "projectId & userId wajib" },
        { status: 400 }
      );
    }
    const update: Record<string, unknown> = {};
    if (typeof body.title === "string") update.title = body.title.trim();
    if (typeof body.description === "string")
      update.description = body.description.trim();
    if (typeof body.workspaceXml === "string")
      update.workspace_xml = body.workspaceXml;
    else if (typeof body.blocksJson === "string")
      update.workspace_xml = body.blocksJson; // legacy alias
    if (typeof body.codeJs === "string") update.code_js = body.codeJs;
    else if (typeof body.javascriptCode === "string")
      update.code_js = body.javascriptCode; // legacy alias
    if (typeof body.isPublic === "boolean") update.is_public = body.isPublic;
    // Always touches updated_at via trigger if exists; ensure at least one field beyond id
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }
    const { error } = await supabase
      .from("blockly_projects")
      .update(update)
      .eq("id", projectId)
      .eq("user_id", userId);
    if (error) throw error;
    return NextResponse.json({ success: true, updated: 1 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal update project";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/user/blockly-projects?projectId=...&userId=...
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = (searchParams.get("projectId") || "").trim();
  const userId = (searchParams.get("userId") || "").trim();
  if (!projectId || !userId) {
    return NextResponse.json(
      { success: false, error: "projectId & userId wajib" },
      { status: 400 }
    );
  }
  try {
    const { error } = await supabase
      .from("blockly_projects")
      .delete()
      .eq("id", projectId)
      .eq("user_id", userId);
    if (error) throw error;
    return NextResponse.json({ success: true, deleted: 1 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal hapus project";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
