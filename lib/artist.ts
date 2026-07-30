import { sql } from "./db";
import { APP_TZ, FALLBACK_TRACK_MS } from "./constants";

/**
 * Tout ce qui concerne UN artiste, pour la page /artist/[nom].
 *
 * L'identité d'un artiste est `lower(artist)` — « MF DOOM », « MF Doom » et
 * « Mf doom » sont la même personne. La graphie affichée est la plus fréquente.
 * Comme partout, chaque requête filtre sur le compte.
 */

export type ArtistProfile = {
  key: string;
  name: string;
  scrobbles: number;
  tracks: number;
  albums: number;
  first: string | null;
  last: string | null;
  estMs: number;
  durationsKnown: number;
  /** rang de l'artiste dans l'écoute totale du compte */
  rank: number | null;
  /** artistes distincts du compte, pour situer le rang */
  outOf: number;
  image: string | null;
};

export async function artistProfile(
  account: string,
  key: string,
): Promise<ArtistProfile | null> {
  const k = key.toLowerCase();

  const [row] = await sql<
    {
      name: string;
      scrobbles: number;
      tracks: number;
      albums: number;
      first: Date | null;
      last: Date | null;
      ms: number;
      known: number;
      image: string | null;
    }[]
  >`
    select
      mode() within group (order by s.artist)                        as name,
      count(*)::int                                                  as scrobbles,
      count(distinct lower(s.track))::int                            as tracks,
      count(distinct lower(s.album)) filter (
        where s.album is not null and s.album <> ''
      )::int                                                         as albums,
      min(s.played_at)                                               as first,
      max(s.played_at)                                               as last,
      coalesce(sum(coalesce(t.duration_ms, ${FALLBACK_TRACK_MS})), 0)::bigint as ms,
      count(t.duration_ms)::int                                      as known,
      max(ai.image_url)                                              as image
    from scrobbles s
    left join tracks t
      on t.artist_key = lower(s.artist) and t.track_key = lower(s.track)
    left join artist_images ai on ai.artist_key = lower(s.artist)
    where s.account = ${account} and lower(s.artist) = ${k}
  `;

  if (!row || row.scrobbles === 0) return null;

  // rang : combien d'artistes ont strictement plus d'écoutes ?
  const [r] = await sql<{ rank: number; total: number }[]>`
    with par_artiste as (
      select lower(artist) as k, count(*)::int as n
      from scrobbles where account = ${account}
      group by lower(artist)
    )
    select
      (select count(*) + 1 from par_artiste
        where n > (select n from par_artiste where k = ${k}))::int as rank,
      (select count(*) from par_artiste)::int                     as total
  `;

  return {
    key: k,
    name: row.name,
    scrobbles: row.scrobbles,
    tracks: row.tracks,
    albums: row.albums,
    first: row.first ? new Date(row.first).toISOString() : null,
    last: row.last ? new Date(row.last).toISOString() : null,
    estMs: Number(row.ms),
    durationsKnown: row.known,
    rank: r?.rank ?? null,
    outOf: r?.total ?? 0,
    image: row.image,
  };
}

/** Écoutes par mois depuis le premier scrobble — la courbe de vie de l'artiste. */
export async function artistPerMonth(
  account: string,
  key: string,
): Promise<{ month: string; count: number }[]> {
  return sql<{ month: string; count: number }[]>`
    with bornes as (
      select
        date_trunc('month', min(played_at) at time zone ${APP_TZ}) as debut,
        date_trunc('month', max(played_at) at time zone ${APP_TZ}) as fin
      from scrobbles where account = ${account} and lower(artist) = ${key.toLowerCase()}
    ),
    mois as (
      select generate_series((select debut from bornes), (select fin from bornes),
                             interval '1 month') as m
    ),
    comptes as (
      select date_trunc('month', played_at at time zone ${APP_TZ}) as m, count(*)::int as n
      from scrobbles
      where account = ${account} and lower(artist) = ${key.toLowerCase()}
      group by 1
    )
    select to_char(mois.m, 'YYYY-MM') as month, coalesce(comptes.n, 0)::int as count
    from mois left join comptes using (m)
    order by mois.m
  `;
}

export async function artistTopTracks(
  account: string,
  key: string,
  limit = 10,
): Promise<{ track: string; count: number; first: string | null }[]> {
  const rows = await sql<{ track: string; count: number; first: Date | null }[]>`
    select
      mode() within group (order by track) as track,
      count(*)::int                        as count,
      min(played_at)                       as first
    from scrobbles
    where account = ${account} and lower(artist) = ${key.toLowerCase()}
    group by lower(track)
    order by count desc, track asc
    limit ${limit}
  `;
  return rows.map((r) => ({
    track: r.track,
    count: r.count,
    first: r.first ? new Date(r.first).toISOString() : null,
  }));
}

/**
 * Pic d'obsession : la fenêtre de 7 jours où l'artiste a été le plus écouté.
 * On compare chaque jour à la somme des 7 jours qui le suivent.
 */
export async function artistPeakWindow(
  account: string,
  key: string,
  days = 7,
): Promise<{ start: string; count: number } | null> {
  const [row] = await sql<{ start: string; count: number }[]>`
    with jours as (
      select (played_at at time zone ${APP_TZ})::date as d, count(*)::int as n
      from scrobbles
      where account = ${account} and lower(artist) = ${key.toLowerCase()}
      group by 1
    ),
    fenetres as (
      -- tri sur une date : le décalage de fenêtre doit être un INTERVAL
      select d,
             sum(n) over (order by d range between current row
                          and make_interval(days => ${days - 1}) following) as total
      from jours
    )
    select to_char(d, 'YYYY-MM-DD') as start, total::int as count
    from fenetres order by total desc, d asc limit 1
  `;
  return row ?? null;
}

/** Le jour le plus intense pour cet artiste. */
export async function artistPeakDay(
  account: string,
  key: string,
): Promise<{ day: string; count: number } | null> {
  const [row] = await sql<{ day: string; count: number }[]>`
    select to_char((played_at at time zone ${APP_TZ})::date, 'YYYY-MM-DD') as day,
           count(*)::int as count
    from scrobbles
    where account = ${account} and lower(artist) = ${key.toLowerCase()}
    group by 1
    order by count desc, day asc
    limit 1
  `;
  return row ?? null;
}

/** Albums les plus écoutés de l'artiste. */
export async function artistTopAlbums(
  account: string,
  key: string,
  limit = 6,
): Promise<{ album: string; count: number; image: string | null }[]> {
  return sql<{ album: string; count: number; image: string | null }[]>`
    select
      mode() within group (order by album)     as album,
      count(*)::int                            as count,
      mode() within group (order by image_url) as image
    from scrobbles
    where account = ${account} and lower(artist) = ${key.toLowerCase()}
      and album is not null and album <> ''
    group by lower(album)
    order by count desc, album asc
    limit ${limit}
  `;
}
