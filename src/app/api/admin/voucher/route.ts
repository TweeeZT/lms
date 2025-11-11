import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Prefer service role key on the server; fallback to anon key if not set
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY =
	(process.env.SUPABASE_SERVICE_ROLE_KEY as string) ||
	(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	console.warn(
		"Supabase URL or Key missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)"
	);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type VoucherPayload = {
	id?: string;
	code?: string;
	discount_type?: "percentage" | "nominal" | string;
	discount_value?: number;
	max_uses?: number | null;
	used_count?: number | null;
	start_date?: string | null;
	end_date?: string | null;
	is_active?: boolean;
	created_by?: string | null;
	created_at?: string;
	courses_id?: string | null;
};

function toISOStringOrNull(value?: string | null, endDateMode: boolean = false) {
	if (!value) return null;
	// Accept 'YYYY-MM-DD' and set time to 00:00 (start) or 23:59:59 (end) local, then convert to ISO
	// Also accept 'YYYY-MM-DDTHH:mm' and use provided time.
	let dateObj: Date;
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		const [y, m, d] = value.split('-').map(Number);
		if (endDateMode) {
			dateObj = new Date(y, m - 1, d, 23, 59, 59, 999);
		} else {
			dateObj = new Date(y, m - 1, d, 0, 0, 0, 0);
		}
	} else {
		dateObj = new Date(value);
	}
	if (isNaN(dateObj.getTime())) return null;
	return dateObj.toISOString();
}

function validatePayload(body: VoucherPayload, isUpdate = false) {
	const errors: string[] = [];
	// Required base fields on create
	if (!isUpdate) {
		if (!body.code) errors.push("code is required");
		if (!body.discount_type) errors.push("discount_type is required");
		if (body.discount_value === undefined || body.discount_value === null) errors.push("discount_value is required");
		if (!body.courses_id) errors.push("courses_id is required");
		if (!body.start_date) errors.push("start_date is required");
		if (!body.end_date) errors.push("end_date is required");
		if (body.max_uses === undefined || body.max_uses === null) errors.push("max_uses is required");
	}
	if (body.discount_type && !["percentage", "nominal"].includes(body.discount_type)) {
		errors.push("discount_type must be either 'percentage' or 'nominal'");
	}
	if (body.discount_value !== undefined && body.discount_value !== null) {
		const dv = Number(body.discount_value);
		if (body.discount_type === "percentage") {
			if (dv < 1 || dv > 100) errors.push("percentage discount_value must be between 1 and 100");
		} else {
			if (dv < 1) errors.push("nominal discount_value must be >= 1");
		}
	}
	if (body.max_uses !== undefined && body.max_uses !== null && body.max_uses < 1) {
		errors.push("max_uses must be at least 1");
	}
	// If both dates provided ensure ordering
	if (body.start_date && body.end_date) {
		const s = new Date(body.start_date).getTime();
		const e = new Date(body.end_date).getTime();
		if (!isNaN(s) && !isNaN(e) && e < s) errors.push("end_date cannot be before start_date");
	}
	return errors;
}

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const id = searchParams.get("id");

	if (id) {
		const { data, error } = await supabase
			.from("vouchers")
			.select("*")
			.eq("id", id)
			.single();
		if (error) return NextResponse.json({ error: error.message }, { status: 400 });
		return NextResponse.json({ data });
	}

	const { data, error } = await supabase
		.from("vouchers")
		.select("*")
		.order("created_at", { ascending: false });

	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	return NextResponse.json({ data });
}

export async function POST(request: Request) {
	let body: VoucherPayload;
	try {
		body = await request.json();
	} catch (e) {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const errors = validatePayload(body, false);
	if (errors.length) return NextResponse.json({ errors }, { status: 400 });

	  const payload: VoucherPayload = {
	    code: body.code?.trim(),
	    discount_type: body.discount_type as "percentage" | "nominal",
	    discount_value: Number(body.discount_value),
	    max_uses: body.max_uses ?? 1,
	    used_count: body.used_count ?? 0,
	    start_date: toISOStringOrNull(body.start_date ?? null, false),
	    end_date: toISOStringOrNull(body.end_date ?? null, true),
	    is_active: body.is_active ?? true,
	    created_by: body.created_by ?? null,
	    created_at: new Date().toISOString(),
	    courses_id: body.courses_id ?? null,
	  };

	const { data, error } = await supabase.from("vouchers").insert([payload]).select("*").single();

	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	return NextResponse.json({ data }, { status: 201 });
}

export async function PUT(request: Request) {
	let body: VoucherPayload;
	try {
		body = await request.json();
	} catch (e) {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

	const errors = validatePayload(body, true);
	if (errors.length) return NextResponse.json({ errors }, { status: 400 });

	const updatePayload: Record<string, any> = {};
	if (body.code !== undefined) updatePayload.code = body.code?.trim();
	if (body.discount_type !== undefined) updatePayload.discount_type = body.discount_type;
	if (body.discount_value !== undefined) updatePayload.discount_value = Number(body.discount_value);
	if (body.max_uses !== undefined) updatePayload.max_uses = body.max_uses;
	if (body.used_count !== undefined) updatePayload.used_count = body.used_count;
		if (body.start_date !== undefined)
			updatePayload.start_date = toISOStringOrNull(body.start_date ?? null, false);
		if (body.end_date !== undefined)
			updatePayload.end_date = toISOStringOrNull(body.end_date ?? null, true);
	if (body.is_active !== undefined) updatePayload.is_active = body.is_active;
	if (body.courses_id !== undefined) updatePayload.courses_id = body.courses_id;

	const { data, error } = await supabase
		.from("vouchers")
		.update(updatePayload)
		.eq("id", body.id)
		.select("*")
		.single();

	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	return NextResponse.json({ data });
}

export async function DELETE(request: Request) {
	const { searchParams } = new URL(request.url);
	const idParam = searchParams.get("id");
	let id = idParam as string | null;

	if (!id) {
		try {
			const body = (await request.json()) as { id?: string };
			id = body.id ?? null;
		} catch {}
	}

	if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

	const { error } = await supabase.from("vouchers").delete().eq("id", id);
	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	return NextResponse.json({ success: true });
}

