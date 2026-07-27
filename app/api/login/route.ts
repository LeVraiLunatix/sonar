import { NextResponse } from "next/server";
import { AUTH_COOKIE, sessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function safeNext(v: string): string {
  return v.startsWith("/") && !v.startsWith("//") ? v : "/";
}

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? "/"));

  const expected = process.env.SITE_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  const origin = new URL(req.url).origin;

  if (!expected || !secret || password !== expected) {
    return NextResponse.redirect(
      new URL(`/login?error=1&next=${encodeURIComponent(next)}`, origin),
      { status: 303 },
    );
  }

  const token = await sessionToken(secret);
  const res = NextResponse.redirect(new URL(next, origin), { status: 303 });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 an
  });
  return res;
}
