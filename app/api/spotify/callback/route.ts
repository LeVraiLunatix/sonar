import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/spotify-auth";
import { getProfile } from "@/lib/spotify";
import { resolveAccount } from "@/lib/session";
import { SESSION_COOKIE, signSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "spotify_oauth_state";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  // req.cookies (et non req.headers.get("cookie")) : Next.js encode la valeur
  // avec encodeURIComponent en l'écrivant (":" devient "%3A"), donc seule son
  // propre lecteur la décode symétriquement — un split(":") sur l'en-tête brut
  // ne trouve jamais le séparateur.
  const rawCookie = req.cookies.get(STATE_COOKIE)?.value ?? null;
  const sep = rawCookie?.indexOf(":") ?? -1;
  const mode = sep > 0 ? (rawCookie!.slice(0, sep) as "connect" | "signin") : null;
  const expectedState = sep > 0 ? rawCookie!.slice(sep + 1) : null;
  const failTo = mode === "connect" ? "/spotify" : "/login";

  if (!mode || !expectedState) {
    const c = mode === "connect" ? "state" : "spotify-state";
    return NextResponse.redirect(new URL(`${failTo}?error=${c}`, origin), { status: 303 });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const c = mode === "connect" ? "config" : "spotify-config";
    return NextResponse.redirect(new URL(`${failTo}?error=${c}`, origin), { status: 303 });
  }

  if (mode === "signin" && !process.env.AUTH_SECRET) {
    return NextResponse.redirect(new URL("/login?error=spotify-config", origin), { status: 303 });
  }

  if (errorParam) {
    const c = mode === "connect" ? "denied" : "spotify-denied";
    return NextResponse.redirect(new URL(`${failTo}?error=${c}`, origin), { status: 303 });
  }

  if (!code || !state || state !== expectedState) {
    const c = mode === "connect" ? "state" : "spotify-state";
    return NextResponse.redirect(new URL(`${failTo}?error=${c}`, origin), { status: 303 });
  }

  let sessionUsername: string | null = null;
  try {
    const redirectUri = `${origin}/api/spotify/callback`;
    const tokens = await exchangeCode(clientId, clientSecret, code, redirectUri);
    const profile = await getProfile(tokens.access_token);

    if (!tokens.refresh_token) {
      throw new Error("pas de refresh_token renvoyé par Spotify");
    }
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    if (mode === "connect") {
      const account = await resolveAccount();
      if (!account) {
        return NextResponse.redirect(new URL("/login", origin), { status: 303 });
      }
      const { setSpotifyTokens } = await import("@/lib/accounts");
      await setSpotifyTokens(account, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        spotifyUserId: profile.id,
        displayName: profile.display_name,
      });
    } else {
      const { accountBySpotifyId, createSpotifyAccount, setSpotifyTokens } = await import(
        "@/lib/accounts"
      );
      const existing = await accountBySpotifyId(profile.id);
      if (existing) {
        sessionUsername = existing;
        await setSpotifyTokens(existing, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt,
          spotifyUserId: profile.id,
          displayName: profile.display_name,
        });
      } else {
        sessionUsername = await createSpotifyAccount({
          spotifyUserId: profile.id,
          displayName: profile.display_name,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt,
        });
      }
    }
  } catch (e) {
    const detail = e instanceof Error ? e.message : "erreur inconnue";
    const c = mode === "connect" ? "spotify" : "spotify-failed";
    return NextResponse.redirect(
      new URL(`${failTo}?error=${c}&detail=${encodeURIComponent(detail)}`, origin),
      { status: 303 },
    );
  }

  // Pas d'historique Last.fm pour un compte Spotify : /spotify est la seule
  // page avec du contenu réel, on y envoie directement.
  const res = NextResponse.redirect(new URL("/spotify", origin), { status: 303 });
  res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  if (mode === "signin" && sessionUsername) {
    res.cookies.set(SESSION_COOKIE, await signSession(sessionUsername, process.env.AUTH_SECRET!), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}
