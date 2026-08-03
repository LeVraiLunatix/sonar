import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/spotify-auth";
import { getProfile } from "@/lib/spotify";
import { resolveAccount } from "@/lib/session";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "spotify_oauth_state";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const account = await resolveAccount();
  if (!account) {
    return NextResponse.redirect(new URL("/login", origin), { status: 303 });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/spotify?error=config", origin), { status: 303 });
  }

  if (errorParam) {
    return NextResponse.redirect(new URL("/spotify?error=denied", origin), { status: 303 });
  }

  const cookieJar = req.headers.get("cookie") ?? "";
  const expectedState = cookieJar
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${STATE_COOKIE}=`))
    ?.slice(STATE_COOKIE.length + 1);

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/spotify?error=state", origin), { status: 303 });
  }

  try {
    const redirectUri = `${origin}/api/spotify/callback`;
    const tokens = await exchangeCode(clientId, clientSecret, code, redirectUri);
    const profile = await getProfile(tokens.access_token);

    if (!tokens.refresh_token) {
      throw new Error("pas de refresh_token renvoyé par Spotify");
    }

    const { setSpotifyTokens } = await import("@/lib/accounts");
    await setSpotifyTokens(account, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      spotifyUserId: profile.id,
      displayName: profile.display_name,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "erreur inconnue";
    return NextResponse.redirect(
      new URL(`/spotify?error=spotify&detail=${encodeURIComponent(detail)}`, origin),
      { status: 303 },
    );
  }

  const res = NextResponse.redirect(new URL("/spotify", origin), { status: 303 });
  res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
