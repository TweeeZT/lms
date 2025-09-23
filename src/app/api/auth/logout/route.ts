import { NextResponse } from "next/server";

export async function POST() {
  const expired = new Date(0).toUTCString();
  const res = NextResponse.json({ success: true });
  const cookies = [
    `a_role=; Path=/; Expires=${expired}; SameSite=Lax;`,
    `a_uid=; Path=/; Expires=${expired}; SameSite=Lax;`,
    `a_uname=; Path=/; Expires=${expired}; SameSite=Lax;`,
  ];
  for (const c of cookies) res.headers.append("Set-Cookie", c);
  return res;
}
