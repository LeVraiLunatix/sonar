/**
 * Parseur de l'export RGPD Spotify ("Historique de streaming étendu",
 * demandé sur spotify.com/account/privacy — Spotify met jusqu'à ~30 jours à
 * le préparer). C'est le SEUL moyen d'obtenir un historique complet côté
 * Spotify : l'API live ne donne que les ~50 dernières écoutes et trois tops
 * figés (lib/spotify.ts). Une fois importées ici, ces écoutes rejoignent la
 * table `scrobbles` (source = 'spotify') et profitent de TOUTE l'infra
 * d'agrégation SQL déjà écrite pour Last.fm (lib/stats.ts ne filtre pas par
 * source) : jour/semaine/mois/année marchent identiquement.
 *
 * Deux formats coexistent selon l'export demandé :
 *  - étendu ("Extended streaming history") : ts, ms_played,
 *    master_metadata_track_name, master_metadata_album_artist_name,
 *    master_metadata_album_album_name, skipped, episode_name (podcasts)…
 *  - simple ("Tes données") : endTime, artistName, trackName, msPlayed —
 *    pas de skip ni d'album, timestamp à la minute près.
 * Pur JS, sans API Node : utilisable aussi bien côté client (le fichier est
 * parsé dans le navigateur, jamais uploadé en un bloc) que côté serveur.
 */

export type ParsedPlay = {
  played_at: string; // ISO
  track: string;
  artist: string;
  album: string | null;
  ms_played: number | null;
  skipped: boolean | null;
};

type RawEntry = {
  ts?: string;
  endTime?: string;
  ms_played?: number;
  msPlayed?: number;
  master_metadata_track_name?: string | null;
  master_metadata_album_artist_name?: string | null;
  master_metadata_album_album_name?: string | null;
  trackName?: string;
  artistName?: string;
  episode_name?: string | null;
  skipped?: boolean | null;
};

function clean(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

// En dessous de ce seuil, une lecture ressemble plus à un skip accidentel
// qu'à une vraie écoute — cohérent avec le seuil minimal que Last.fm applique
// lui-même avant de scrobbler (sinon les imports gonfleraient les comptes).
const MIN_MS_PLAYED = 30_000;

/** Parse UN fichier de l'export (un tableau JSON). Format inattendu → []. */
export function parseStreamingHistoryFile(raw: unknown): ParsedPlay[] {
  if (!Array.isArray(raw)) return [];
  const out: ParsedPlay[] = [];

  for (const entry of raw as RawEntry[]) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.episode_name) continue; // épisode de podcast : pas un morceau

    const track = clean(entry.master_metadata_track_name ?? entry.trackName);
    const artist = clean(entry.master_metadata_album_artist_name ?? entry.artistName);
    if (!track || !artist) continue;

    const rawTs = entry.ts ?? entry.endTime;
    if (!rawTs) continue;
    const date = new Date(rawTs);
    if (Number.isNaN(date.getTime())) continue;

    const msPlayed =
      typeof entry.ms_played === "number"
        ? entry.ms_played
        : typeof entry.msPlayed === "number"
          ? entry.msPlayed
          : null;
    if (msPlayed !== null && msPlayed < MIN_MS_PLAYED) continue;

    out.push({
      played_at: date.toISOString(),
      track,
      artist,
      album: clean(entry.master_metadata_album_album_name),
      ms_played: msPlayed,
      skipped: typeof entry.skipped === "boolean" ? entry.skipped : null,
    });
  }

  return out;
}
