import { NextResponse } from "next/server";
import { trackMedia, artistMedia, type TrackMedia } from "@/lib/deezer";

/**
 * Résout, en un seul appel, la pochette + l'extrait audio (30 s) de chaque
 * sujet d'une rétro (artiste ou titre). Le lecteur de story s'en sert pour la
 * pochette animée en fond ET pour changer la musique selon la diapo affichée.
 * Appels Deezer côté serveur → cache CDN, aucune clé.
 */
export const runtime = "nodejs";

type Item = { key: string; artist: string; track?: string };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { items?: Item[] } | null;
  const items = (body?.items ?? [])
    .filter((it) => it && typeof it.key === "string" && typeof it.artist === "string")
    .slice(0, 16);

  const entries = await Promise.all(
    items.map(async (it): Promise<[string, TrackMedia]> => {
      try {
        const media = it.track
          ? await trackMedia(it.artist, it.track)
          : await artistMedia(it.artist);
        return [it.key, media];
      } catch {
        return [it.key, { preview: null, cover: null }];
      }
    }),
  );

  return NextResponse.json(
    { results: Object.fromEntries(entries) },
    {
      headers: {
        "cache-control": "private, max-age=3600, stale-while-revalidate=86400",
      },
    },
  );
}
