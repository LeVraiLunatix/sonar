import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "./lib/auth";

// Routes accessibles sans session.
// /api/spotify/login|callback : nécessaires pour le "se connecter avec Spotify"
// depuis /login, qui n'a par définition pas encore de session au moment de
// l'appel. Le reste de /api/spotify (import, disconnect) reste protégé.
const PUBLIC = ["/login", "/api/auth", "/api/spotify/login", "/api/spotify/callback", "/api/cron"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const secret = process.env.AUTH_SECRET;
  // Auth non configurée (ex. dev local) → on laisse passer.
  if (!secret) return NextResponse.next();

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const user = await readSession(cookie, secret);
  if (user) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|.*\\..*).*)"],
};
