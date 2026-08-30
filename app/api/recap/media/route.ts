import { NextResponse } from "next/server";
import { trackMedia } from "@/lib/deezer";

/**
 * Résout l'extrait audio (30 s) + la pochette d'un titre pour la musique de
 * fond des rétros. Appelé par le lecteur de story côté client, pour garder les
 * appels Deezer côté serveur et profiter du cache CDN.
 */
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const artist = searchParams.get("artist")?.trim();
  const track = searchParams.get("track")?.trim();

  if (!artist || !track) {
    return NextResponse.json(
      { preview: null, cover: null },
      { status: 400 },
    );
  }

  try {
    const media = await trackMedia(artist, track);
    return NextResponse.json(media, {
      headers: {
        "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json({ preview: null, cover: null });
  }
}
