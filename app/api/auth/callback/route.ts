import { NextResponse } from "next/server";
import { getSession } from "@/lib/lastfm-auth";
import { SESSION_COOKIE, signSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const token = url.searchParams.get("token");

  const apiKey = process.env.LASTFM_API_KEY;
  const secret = process.env.LASTFM_API_SECRET;
  const authSecret = process.env.AUTH_SECRET;

  if (!token || !apiKey || !secret || !authSecret) {
    return NextResponse.redirect(new URL("/login?error=config", origin), { status: 303 });
  }

  let username: string;
  try {
    const session = await getSession(apiKey, secret, token);
    username = session.name;
  } catch (e) {
    const detail = e instanceof Error ? e.message : "erreur inconnue";
    return NextResponse.redirect(
      new URL(`/login?error=lastfm&detail=${encodeURIComponent(detail)}`, origin),
      { status: 303 },
    );
  }

  // Les données sont cloisonnées par compte ; ALLOW_ALL_USERS ouvre l'inscription.
  const owner = (process.env.LASTFM_USER ?? "").toLowerCase();
  const allowAll = process.env.ALLOW_ALL_USERS === "1";
  if (!allowAll && username.toLowerCase() !== owner) {
    return NextResponse.redirect(
      new URL(`/login?denied=${encodeURIComponent(username)}`, origin),
      { status: 303 },
    );
  }

  // Crée le compte au premier passage ; l'import initial se fait sur /onboarding.
  let destination = "/";
  if (process.env.DATABASE_URL) {
    try {
      const { upsertAccount } = await import("@/lib/accounts");
      const acc = await upsertAccount(username);
      if (acc.backfill_status !== "done") destination = "/onboarding";
    } catch {
      // base indisponible : on laisse entrer, les pages afficheront l'erreur
    }
  }

  const res = NextResponse.redirect(new URL(destination, origin), { status: 303 });
  res.cookies.set(SESSION_COOKIE, await signSession(username, authSecret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
