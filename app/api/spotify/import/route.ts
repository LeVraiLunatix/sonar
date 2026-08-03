import { NextResponse } from "next/server";
import { resolveAccount } from "@/lib/session";
import { insertSpotifyPlays } from "@/lib/ingest";
import type { ParsedPlay } from "@/lib/spotify-import";

// Un lot d'écoutes déjà normalisées côté client (lib/spotify-import.ts a
// parsé le fichier dans le navigateur) — jamais de fichier brut ici, pour ne
// jamais dépasser la taille de requête tolérée par une fonction serverless.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BATCH = 5000;

function isValid(p: unknown): p is ParsedPlay {
  if (!p || typeof p !== "object") return false;
  const v = p as Record<string, unknown>;
  return (
    typeof v.played_at === "string" &&
    !Number.isNaN(new Date(v.played_at).getTime()) &&
    typeof v.track === "string" &&
    v.track.length > 0 &&
    typeof v.artist === "string" &&
    v.artist.length > 0
  );
}

export async function POST(req: Request) {
  const account = await resolveAccount();
  if (!account) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "base de données non configurée" }, { status: 503 });
  }

  let body: { plays?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "corps invalide" }, { status: 400 });
  }

  const plays = Array.isArray(body.plays) ? body.plays : [];
  if (plays.length === 0) {
    return NextResponse.json({ error: "aucune lecture à importer" }, { status: 400 });
  }
  if (plays.length > MAX_BATCH) {
    return NextResponse.json({ error: `lot trop grand (max ${MAX_BATCH})` }, { status: 400 });
  }

  const valid = plays.filter(isValid);

  try {
    const inserted = await insertSpotifyPlays(account, valid);
    return NextResponse.json({ received: plays.length, valid: valid.length, inserted });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
