
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// GET /api/scratch/projects/[id]
export async function GET(
	req: NextRequest,
	{ params }: { params: { id: string } }
) {
	// In Next.js dynamic API routes, `params` may be async — await it before using.
	const { id } = (await params) as { id?: string };
	if (!id) {
		return NextResponse.json({ success: false, error: "Missing project id" }, { status: 400 });
	}

	try {
		// Official Scratch project data endpoint
		const url = `https://projects.scratch.mit.edu/projects/${encodeURIComponent(id)}`;
		const res = await fetch(url, {
			headers: { "User-Agent": "Afterschola/1.0 (+https://afterschola.example/)" },
		});

		if (!res.ok) {
			const text = await res.text().catch(() => "");
			return NextResponse.json(
				{ success: false, error: `Scratch API returned ${res.status}`, details: text ? text.slice(0, 1000) : undefined },
				{ status: res.status }
			);
		}

		const projectJson = await res.json();

		return NextResponse.json({ success: true, project: projectJson }, {
			headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : "Unknown error";
		return NextResponse.json({ success: false, error: msg }, { status: 500 });
	}
}

