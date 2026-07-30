import { sql } from "./db";
import { APP_TZ, FALLBACK_TRACK_MS } from "./constants";

/**
 * Toutes les stats découlent d'UNE plage [start, end) exprimée en dates locales
 * (Europe/Paris) ET d'UN compte.
 *
 * ⚠️ Bornes : toujours `'YYYY-MM-DD'::timestamp at time zone 'Europe/Paris'`.
 * NE JAMAIS écrire `::date at time zone` : Postgres promeut alors la date en
 * `timestamptz` (minuit dans le fuseau de la session), puis `at time zone` la
 * reconvertit en heure murale — le résultat est un `timestamp` SANS fuseau,
 * décalé de l'offset, et la journée démarre au mauvais moment. Avec `::timestamp`
 * la date est bien interprétée comme heure locale et le résultat est un
 * `timestamptz` correct, y compris autour des changements d'heure.
 *
 * ⚠️ Chaque requête DOIT filtrer sur `account` — c'est ce qui garantit qu'un
 * utilisateur ne voit jamais les écoutes d'un autre.
 */
export type Range = { start: string; end: string }; // 'YYYY-MM-DD', end exclusif

export type ArtistCount = { key: string; name: string; count: number };
export type TrackCount = { artist: string; track: string; count: number };
export type AlbumCount = { artist: string; album: string; count: number; image: string | null };
export type DayCount = { day: string; count: number };
export type HourCount = { hour: number; count: number };
export type Summary = {
  scrobbles: number;
  artists: number;
  tracks: number;
  estMs: number;
  /** scrobbles dont la durée réelle est connue (table `tracks`) */
  durationsKnown: number;
};

/** Fragment WHERE réutilisable : le compte, et played_at dans la plage. */
const scope = (account: string, r: Range) =>
  sql`account = ${account}
      and played_at >= (${r.start}::timestamp at time zone ${APP_TZ})
      and played_at <  (${r.end}::timestamp at time zone ${APP_TZ})`;

export async function summary(account: string, r: Range): Promise<Summary> {
  const [row] = await sql<
    { scrobbles: number; artists: number; tracks: number; ms: number; known: number }[]
  >`
    select
      count(*)::int                                   as scrobbles,
      count(distinct lower(artist))::int              as artists,
      count(distinct (lower(artist) || '␟' || lower(track)))::int as tracks,
      coalesce(sum(coalesce(t.duration_ms, ${FALLBACK_TRACK_MS})), 0)::bigint as ms,
      count(t.duration_ms)::int                       as known
    from scrobbles s
    left join tracks t
      on t.artist_key = lower(s.artist) and t.track_key = lower(s.track)
    where s.account = ${account}
      and s.played_at >= (${r.start}::timestamp at time zone ${APP_TZ})
      and s.played_at <  (${r.end}::timestamp at time zone ${APP_TZ})
  `;
  return {
    scrobbles: row?.scrobbles ?? 0,
    artists: row?.artists ?? 0,
    tracks: row?.tracks ?? 0,
    estMs: Number(row?.ms ?? 0),
    durationsKnown: row?.known ?? 0,
  };
}

export async function topArtists(
  account: string,
  r: Range,
  limit = 10,
): Promise<ArtistCount[]> {
  return sql<ArtistCount[]>`
    select
      lower(artist)                              as key,
      mode() within group (order by artist)      as name,  -- graphie la plus fréquente
      count(*)::int                              as count
    from scrobbles
    where ${scope(account, r)}
    group by lower(artist)
    order by count desc, name asc
    limit ${limit}
  `;
}

export async function topTracks(
  account: string,
  r: Range,
  limit = 10,
): Promise<TrackCount[]> {
  return sql<TrackCount[]>`
    select
      mode() within group (order by artist) as artist,
      mode() within group (order by track)  as track,
      count(*)::int                         as count
    from scrobbles
    where ${scope(account, r)}
    group by lower(artist), lower(track)
    order by count desc, track asc
    limit ${limit}
  `;
}

export async function topAlbums(
  account: string,
  r: Range,
  limit = 10,
): Promise<AlbumCount[]> {
  return sql<AlbumCount[]>`
    select
      mode() within group (order by artist)     as artist,
      mode() within group (order by album)      as album,
      count(*)::int                             as count,
      mode() within group (order by image_url)  as image
    from scrobbles
    where ${scope(account, r)} and album is not null and album <> ''
    group by lower(artist), lower(album)
    order by count desc, album asc
    limit ${limit}
  `;
}

/** Un point par jour de la plage, zéros inclus (generate_series) → la ligne d'amplitude. */
export async function perDay(account: string, r: Range): Promise<DayCount[]> {
  return sql<DayCount[]>`
    with days as (
      select generate_series(${r.start}::date, ${r.end}::date - 1, interval '1 day')::date as d
    ),
    counts as (
      select (played_at at time zone ${APP_TZ})::date as d, count(*)::int as c
      from scrobbles
      where ${scope(account, r)}
      group by 1
    )
    select to_char(days.d, 'YYYY-MM-DD') as day, coalesce(counts.c, 0)::int as count
    from days left join counts using (d)
    order by days.d
  `;
}

/** Horloge d'écoute : répartition par heure (0..23), heure locale. */
export async function perHour(account: string, r: Range): Promise<HourCount[]> {
  const rows = await sql<{ hour: number; count: number }[]>`
    select extract(hour from played_at at time zone ${APP_TZ})::int as hour,
           count(*)::int as count
    from scrobbles
    where ${scope(account, r)}
    group by 1
  `;
  const map = new Map(rows.map((x) => [x.hour, x.count]));
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, count: map.get(h) ?? 0 }));
}

/**
 * Découvertes : artistes dont le TOUT PREMIER scrobble du compte tombe dans la
 * plage. Le filtre `account` porte aussi sur le min() global, sinon la date de
 * découverte serait celle d'un autre utilisateur.
 */
export async function discoveries(
  account: string,
  r: Range,
  limit = 12,
): Promise<ArtistCount[]> {
  return sql<ArtistCount[]>`
    select lower(artist) as key,
           mode() within group (order by artist) as name,
           count(*) filter (
             where played_at >= (${r.start}::timestamp at time zone ${APP_TZ})
               and played_at <  (${r.end}::timestamp at time zone ${APP_TZ})
           )::int as count
    from scrobbles
    where account = ${account}
    group by lower(artist)
    having min(played_at) >= (${r.start}::timestamp at time zone ${APP_TZ})
       and min(played_at) <  (${r.end}::timestamp at time zone ${APP_TZ})
    order by count desc, name asc
    limit ${limit}
  `;
}

/** Le titre le plus écouté de la plage. */
export async function topTrackOf(account: string, r: Range): Promise<TrackCount | null> {
  const [t] = await topTracks(account, r, 1);
  return t ?? null;
}

export type ScrobbleRow = {
  played_at: string;
  track: string;
  artist: string;
  album: string | null;
  image_url: string | null;
};

/** Derniers scrobbles du compte — pour le dashboard. */
export async function recentScrobbles(account: string, limit = 12): Promise<ScrobbleRow[]> {
  const rows = await sql<
    { played_at: Date; track: string; artist: string; album: string | null; image_url: string | null }[]
  >`
    select played_at, track, artist, album, image_url
    from scrobbles
    where account = ${account}
    order by played_at desc
    limit ${limit}
  `;
  return rows.map((r) => ({ ...r, played_at: new Date(r.played_at).toISOString() }));
}

/** Scrobbles d'une plage, ordre chronologique inverse — pour la timeline du jour. */
export async function scrobblesInRange(
  account: string,
  r: Range,
  limit = 500,
): Promise<ScrobbleRow[]> {
  const rows = await sql<
    { played_at: Date; track: string; artist: string; album: string | null; image_url: string | null }[]
  >`
    select played_at, track, artist, album, image_url
    from scrobbles
    where ${scope(account, r)}
    order by played_at desc
    limit ${limit}
  `;
  return rows.map((r) => ({ ...r, played_at: new Date(r.played_at).toISOString() }));
}

/** Total de scrobbles du compte depuis toujours + date du tout premier. */
export async function lifetime(
  account: string,
): Promise<{ total: number; first: string | null }> {
  const [row] = await sql<{ total: number; first: Date | null }[]>`
    select count(*)::int as total, min(played_at) as first
    from scrobbles where account = ${account}
  `;
  return {
    total: row?.total ?? 0,
    first: row?.first ? new Date(row.first).toISOString() : null,
  };
}
