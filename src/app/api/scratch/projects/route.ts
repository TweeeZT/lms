import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// GET /api/scratch/projects?username=<username>
// returns list of public projects for a Scratch username
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const username = url.searchParams.get("username");
  if (!username) {
    return NextResponse.json({ success: false, error: "Missing username query parameter" }, { status: 400 });
  }

  try {
    // Scratch API for user projects
    const apiUrl = `https://api.scratch.mit.edu/users/${encodeURIComponent(username)}/projects`;
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "Afterschola/1.0 (+https://afterschola.example/)" },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { success: false, error: `Scratch API returned ${res.status}`, details: text ? text.slice(0, 1000) : undefined },
        { status: res.status }
      );
    }

    const projects = await res.json();

    return NextResponse.json({ success: true, projects }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
