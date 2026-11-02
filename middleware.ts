import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "./lib/auth";

// Routes accessibles sans session.
// /api/spotify/login|callback : nécessaires pour le "se connecter avec Spotify"
// depuis /login, qui n'a par définition pas encore de session au moment de
// l'appel. Le reste de /api/spotify (import, disconnect) reste protégé.
// /wrapped : public pour que les aperçus de partage (Open Graph) fonctionnent —
// un crawler doit pouvoir lire la page ET son opengraph-image. Sans session,
// la rétro et la carte affichent les données fictives (aucune donnée réelle
// n'est exposée) ; connecté, ce sont les vraies stats.
const PUBLIC = [
  "/login",
  "/api/auth",
  "/api/spotify/login",
  "/api/spotify/callback",
  "/api/cron",
  "/wrapped",
  // /api/recap/media ne renvoie que des données publiques Deezer (pochette +
  // extrait) : nécessaire pour qu'un lien de rétro partagé (sans session) ait
  // aussi son fond animé et sa musique.
  "/api/recap",
  // /api/widget : lu par Daycord sans session. Rien ne sort sans une clé de
  // widget signée (lib/widget.ts), vérifiée par la route elle-même.
  "/api/widget",
];

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
