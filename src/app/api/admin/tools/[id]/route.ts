import { NextRequest, NextResponse } from "next/server";
import supabaseAdmin from "@/lib/supabaseServer";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = supabaseAdmin;
    const { id } = await params;

    const { data, error } = await supabase
      .from("course_tools")
      .select(
        `
        *,
        courses!course_tools_courses_id_fkey (
          id,
          title
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching tool:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Tool not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("GET /api/admin/tools/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = supabaseAdmin;
    const { id } = await params;
    const body = await req.json();

    const { courses_id, text_content, price } = body;

    const updates: any = {};
    if (courses_id !== undefined) updates.courses_id = courses_id;
    if (text_content !== undefined) updates.text_content = text_content;
    if (price !== undefined) updates.price = price;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("course_tools")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating tool:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("PATCH /api/admin/tools/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = supabaseAdmin;
    const { id } = await params;

    const { error } = await supabase.from("course_tools").delete().eq("id", id);

    if (error) {
      console.error("Error deleting tool:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/admin/tools/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
