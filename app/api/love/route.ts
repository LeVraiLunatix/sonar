import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { getSessionKey } from "@/lib/accounts";
import { loveTrack } from "@/lib/lastfm-auth";

/**
 * « J'aime » / « je n'aime plus » un titre sur Last.fm.
 *
 * La clé de session ne quitte jamais le serveur : le client envoie seulement
 * l'artiste, le titre et l'intention. On agit uniquement sur le compte de la
 * session — pas de compte cible dans la requête, donc rien à usurper.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const account = await currentUser();
  if (!account) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const apiKey = process.env.LASTFM_API_KEY;
  const secret = process.env.LASTFM_API_SECRET;
  if (!apiKey || !secret) {
    return NextResponse.json({ error: "configuration incomplète" }, { status: 500 });
  }

  let body: { artist?: string; track?: string; love?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "corps invalide" }, { status: 400 });
  }

  const artist = body.artist?.trim();
  const track = body.track?.trim();
  if (!artist || !track) {
    return NextResponse.json({ error: "artiste et titre requis" }, { status: 400 });
  }

  const sessionKey = await getSessionKey(account);
  if (!sessionKey) {
    // Session ouverte avant l'ajout du stockage de clé → reconnexion nécessaire.
    return NextResponse.json({ error: "reconnexion requise" }, { status: 409 });
  }

  try {
    await loveTrack({
      apiKey,
      secret,
      sessionKey,
      artist,
      track,
      love: body.love !== false,
    });
    return NextResponse.json({ ok: true, loved: body.love !== false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
