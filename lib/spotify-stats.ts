import { sql } from "./db";

/**
 * Agrégations réservées aux écoutes Spotify importées (source = 'spotify'),
 * séparées de lib/stats.ts qui agrège TOUT le compte (Last.fm + Spotify
 * mélangés) — un espace dédié pour ce que Spotify seul a fourni. Contrairement
 * à Last.fm (durée estimée via lib/enrich.ts), l'export RGPD donne `ms_played`
 * exact pour chaque écoute : le temps d'écoute ci-dessous n'est pas une
 * estimation.
 */

export type SpotifyArchiveSummary = {
  total: number;
  first: string | null; // ISO
  last: string | null;
  totalMs: number;
};

export async function spotifyArchiveSummary(account: string): Promise<SpotifyArchiveSummary> {
  const [row] = await sql<
    { total: number; first: Date | null; last: Date | null; ms: string | number | null }[]
  >`
    select
      count(*)::int as total,
      min(played_at) as first,
      max(played_at) as last,
      coalesce(sum(ms_played), 0)::bigint as ms
    from scrobbles
    where account = ${account} and source = 'spotify'
  `;
  return {
    total: row?.total ?? 0,
    first: row?.first ? new Date(row.first).toISOString() : null,
    last: row?.last ? new Date(row.last).toISOString() : null,
    totalMs: Number(row?.ms ?? 0),
  };
}

export type SpotifyArtistCount = { key: string; name: string; count: number };
export type SpotifyTrackCount = { artist: string; track: string; count: number };

export async function spotifyTopArtists(account: string, limit = 15): Promise<SpotifyArtistCount[]> {
  return sql<SpotifyArtistCount[]>`
    select
      lower(artist) as key,
      mode() within group (order by artist) as name,
      count(*)::int as count
    from scrobbles
    where account = ${account} and source = 'spotify'
    group by lower(artist)
    order by count desc, name asc
    limit ${limit}
  `;
}

export async function spotifyTopTracks(account: string, limit = 15): Promise<SpotifyTrackCount[]> {
  return sql<SpotifyTrackCount[]>`
    select
      mode() within group (order by artist) as artist,
      mode() within group (order by track) as track,
      count(*)::int as count
    from scrobbles
    where account = ${account} and source = 'spotify'
    group by lower(artist), lower(track)
    order by count desc, track asc
    limit ${limit}
  `;
}
