import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, sessionToken } from "./lib/auth";

// Routes toujours accessibles sans session.
const PUBLIC = ["/login", "/api/login", "/api/cron"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const secret = process.env.AUTH_SECRET;
  const password = process.env.SITE_PASSWORD;
  // Auth non configurée (ex. dev local) → on laisse passer.
  if (!secret || !password) return NextResponse.next();

  const expected = await sessionToken(secret);
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Tout sauf les assets Next et les fichiers (avec extension : icônes, manifest, sw.js…).
  matcher: ["/((?!_next/|.*\\..*).*)"],
};
