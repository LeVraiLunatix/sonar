import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const res = NextResponse.redirect(new URL("/login", origin), { status: 303 });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
