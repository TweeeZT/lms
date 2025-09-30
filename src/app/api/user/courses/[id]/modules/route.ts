import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseServer";

// GET /api/user/courses/[id]/modules?userId=...
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const courseId = params.id;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId)
    return NextResponse.json(
      { success: false, error: "Missing userId" },
      { status: 400 }
    );

  // Load modules for the course (ordered)
  type ModRow = {
    id: string;
    title: string;
    description?: string | null;
    module_kind?: string | null;
    order_index?: number | null;
    is_published?: boolean | null;
  };

  const { data: modules, error: modErr } = await supabaseAdmin
    .from("modules")
    .select("id, title, description, module_kind, order_index, is_published")
    .eq("course_id", courseId)
    .or("is_published.eq.true,is_published.is.null")
    .order("order_index", { ascending: true });
  if (modErr)
    return NextResponse.json(
      { success: false, error: modErr.message },
      { status: 500 }
    );

  // Progress
  const { data: upRows } = await supabaseAdmin
    .from("user_progress")
    .select("id, completed_modules, current_module_id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  const completed = Array.isArray(upRows?.completed_modules)
    ? (upRows!.completed_modules as string[])
    : (() => {
        try {
          return upRows?.completed_modules
            ? JSON.parse(String(upRows?.completed_modules))
            : [];
        } catch {
          return [] as string[];
        }
      })();

  const items = (modules || []).map((m: ModRow) => ({
    id: m.id,
    title: m.title,
    kind: (m.module_kind as string) || "content",
    order: m.order_index ?? 0,
    isCompleted: completed.includes(m.id),
  }));

  const ordered = items.sort(
    (a: { order: number }, b: { order: number }) => a.order - b.order
  );
  const firstIncomplete =
    ordered.find((i: { isCompleted: boolean; id: string }) => !i.isCompleted)
      ?.id ||
    ordered.at(-1)?.id ||
    null;
  const currentModuleId = upRows?.current_module_id || firstIncomplete;

  return NextResponse.json({ success: true, items: ordered, currentModuleId });
}
