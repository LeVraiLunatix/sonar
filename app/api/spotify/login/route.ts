import { NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/spotify-auth";
import { resolveAccount } from "@/lib/session";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "spotify_oauth_state";

// Envoie l'utilisateur autoriser l'appli sur Spotify. Nécessite d'être déjà
// connecté à Sonar (via Last.fm) : Spotify vient s'ajouter à un compte existant.
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  const account = await resolveAccount();
  if (!account) {
    return NextResponse.redirect(new URL("/login", origin), { status: 303 });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL("/spotify?error=config", origin), { status: 303 });
  }

  const state = crypto.randomUUID();
  const redirectUri = `${origin}/api/spotify/callback`;
  const res = NextResponse.redirect(authorizeUrl(clientId, redirectUri, state), { status: 303 });
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 min : le temps de l'autorisation, pas plus
  });
  return res;
}
