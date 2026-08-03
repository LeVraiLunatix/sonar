import { NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/spotify-auth";
import { resolveAccount } from "@/lib/session";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "spotify_oauth_state";

/**
 * Envoie l'utilisateur autoriser l'appli sur Spotify. Deux usages, distingués
 * par la présence d'une session Sonar :
 *  - déjà connecté (via Last.fm)  → "connect" : Spotify vient s'ajouter au compte.
 *  - pas de session               → "signin"  : Spotify EST le compte (pas de
 *    Last.fm associé, donc pas d'historique complet — seulement /spotify).
 * Le mode est encodé dans le cookie d'état, jamais dans l'URL.
 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const account = await resolveAccount();
  const mode: "connect" | "signin" = account ? "connect" : "signin";
  const failTo = mode === "connect" ? "/spotify" : "/login";

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    const code = mode === "connect" ? "config" : "spotify-config";
    return NextResponse.redirect(new URL(`${failTo}?error=${code}`, origin), { status: 303 });
  }

  if (mode === "signin") {
    // Comme pour Last.fm (ALLOW_ALL_USERS), la création de compte reste
    // fermée par défaut : sans ça, n'importe qui pourrait créer un compte.
    if (process.env.ALLOW_ALL_USERS !== "1") {
      return NextResponse.redirect(new URL("/login?error=spotify-closed", origin), { status: 303 });
    }
    if (!process.env.AUTH_SECRET) {
      return NextResponse.redirect(new URL("/login?error=spotify-config", origin), { status: 303 });
    }
  }

  const state = crypto.randomUUID();
  const redirectUri = `${origin}/api/spotify/callback`;
  const res = NextResponse.redirect(authorizeUrl(clientId, redirectUri, state), { status: 303 });
  res.cookies.set(STATE_COOKIE, `${mode}:${state}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 min : le temps de l'autorisation, pas plus
  });
  return res;
}
