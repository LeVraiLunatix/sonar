import { NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/lastfm-auth";

export const dynamic = "force-dynamic";

// Envoie l'utilisateur autoriser l'appli sur Last.fm.
export async function GET(req: Request) {
  const apiKey = process.env.LASTFM_API_KEY;
  const origin = new URL(req.url).origin;
  if (!apiKey) {
    return NextResponse.redirect(new URL("/login?error=config", origin), { status: 303 });
  }
  const callback = `${origin}/api/auth/callback`;
  return NextResponse.redirect(authorizeUrl(apiKey, callback), { status: 303 });
}
