import { sql } from "./db";
import { APP_TZ } from "./constants";
import type { Range } from "./stats";

/**
 * Les stats « qui rendent le truc intéressant » (section 6 du brief) et la
 * recherche dans l'archive. Comme partout : filtrage par compte obligatoire.
 */

/**
 * Obsessions : artistes dont l'écoute s'est concentrée sur une courte fenêtre.
 * On compare le meilleur pic de 7 jours au total de la période — un artiste
 * écouté 80 fois en une semaine est une obsession, 80 fois étalées sur l'année
 * est une habitude.
 */
export type Obsession = {
  key: string;
  name: string;
  total: number;
  peak: number;
  peakStart: string;
  /** part du total concentrée dans la meilleure semaine (0..1) */
  concentration: number;
};

export async function obsessions(
  account: string,
  r: Range,
  limit = 6,
): Promise<Obsession[]> {
  return sql<Obsession[]>`
    with base as (
      select lower(artist) as k, artist,
             (played_at at time zone ${APP_TZ})::date as d
      from scrobbles
      where account = ${account}
        and played_at >= (${r.start}::timestamp at time zone ${APP_TZ})
        and played_at <  (${r.end}::timestamp at time zone ${APP_TZ})
    ),
    jours as (
      select k, d, count(*)::int as n from base group by k, d
    ),
    fenetres as (
      -- fenêtre glissante de 7 jours. Avec un tri sur une date, Postgres
      -- exige un INTERVAL comme décalage de fenêtre, pas un entier.
      select k, d,
             sum(n) over (partition by k order by d
                          range between current row
                          and interval '6 days' following) as w
      from jours
    ),
    pics as (
      select k, max(w) as peak,
             (array_agg(to_char(d,'YYYY-MM-DD') order by w desc, d asc))[1] as peak_start
      from fenetres group by k
    ),
    totaux as (
      select k, mode() within group (order by artist) as name, count(*)::int as total
      from base group by k
    )
    select t.k as key, t.name, t.total, p.peak::int as peak,
           p.peak_start as "peakStart",
           round(p.peak::numeric / t.total, 3)::float8 as concentration
    from totaux t join pics p using (k)
    where t.total >= 12          -- en dessous, la notion d'obsession n'a pas de sens
    order by concentration desc, t.total desc
    limit ${limit}
  `;
}

/**
 * Fidèles vs éphémères : sur combien de mois distincts un artiste a-t-il été
 * écouté dans la période ? Beaucoup de mois = fidèle, un seul = éphémère.
 */
export type Spread = { key: string; name: string; total: number; months: number };

export async function loyalAndFleeting(
  account: string,
  r: Range,
  limit = 6,
): Promise<{ loyal: Spread[]; fleeting: Spread[]; monthsInRange: number }> {
  const rows = await sql<Spread[]>`
    select lower(artist) as key,
           mode() within group (order by artist) as name,
           count(*)::int as total,
           count(distinct date_trunc('month', played_at at time zone ${APP_TZ}))::int as months
    from scrobbles
    where account = ${account}
      and played_at >= (${r.start}::timestamp at time zone ${APP_TZ})
      and played_at <  (${r.end}::timestamp at time zone ${APP_TZ})
    group by lower(artist)
    having count(*) >= 12
    order by total desc
    limit 400
  `;

  const [m] = await sql<{ n: number }[]>`
    select greatest(1, (
      extract(year from ${r.end}::date) * 12 + extract(month from ${r.end}::date)
      - extract(year from ${r.start}::date) * 12 - extract(month from ${r.start}::date)
    ))::int as n
  `;

  const loyal = [...rows].sort((a, b) => b.months - a.months || b.total - a.total).slice(0, limit);
  const fleeting = [...rows]
    .filter((x) => x.months === 1)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

  return { loyal, fleeting, monthsInRange: m?.n ?? 1 };
}

/**
 * Nouveautés vs réécoutes : part des écoutes de la période qui sont la
 * PREMIÈRE écoute de ce titre (jamais avant), par opposition aux réécoutes.
 */
export async function freshVsRepeat(
  account: string,
  r: Range,
): Promise<{ fresh: number; repeat: number }> {
  const [row] = await sql<{ fresh: number; repeat: number }[]>`
    with dans as (
      select lower(artist) as ak, lower(track) as tk, played_at
      from scrobbles
      where account = ${account}
        and played_at >= (${r.start}::timestamp at time zone ${APP_TZ})
        and played_at <  (${r.end}::timestamp at time zone ${APP_TZ})
    ),
    premieres as (
      select lower(artist) as ak, lower(track) as tk, min(played_at) as first
      from scrobbles where account = ${account}
      group by 1, 2
    )
    select
      count(*) filter (where d.played_at = p.first)::int as fresh,
      count(*) filter (where d.played_at <> p.first)::int as repeat
    from dans d join premieres p on p.ak = d.ak and p.tk = d.tk
  `;
  return { fresh: row?.fresh ?? 0, repeat: row?.repeat ?? 0 };
}

/** Recherche dans l'archive : artistes et titres, avec première et dernière écoute. */
export type SearchArtist = {
  key: string;
  name: string;
  count: number;
  first: string;
  last: string;
};
export type SearchTrack = {
  artist: string;
  artistKey: string;
  track: string;
  count: number;
  first: string;
  last: string;
};

export async function searchArchive(
  account: string,
  q: string,
  limit = 12,
): Promise<{ artists: SearchArtist[]; tracks: SearchTrack[] }> {
  const needle = `%${q.trim().toLowerCase()}%`;

  const [artists, tracks] = await Promise.all([
    sql<SearchArtist[]>`
      select lower(artist) as key,
             mode() within group (order by artist) as name,
             count(*)::int as count,
             to_char(min(played_at) at time zone ${APP_TZ}, 'YYYY-MM-DD') as first,
             to_char(max(played_at) at time zone ${APP_TZ}, 'YYYY-MM-DD') as last
      from scrobbles
      where account = ${account} and lower(artist) like ${needle}
      group by lower(artist)
      order by count desc
      limit ${limit}
    `,
    sql<SearchTrack[]>`
      select mode() within group (order by artist) as artist,
             lower(artist) as "artistKey",
             mode() within group (order by track) as track,
             count(*)::int as count,
             to_char(min(played_at) at time zone ${APP_TZ}, 'YYYY-MM-DD') as first,
             to_char(max(played_at) at time zone ${APP_TZ}, 'YYYY-MM-DD') as last
      from scrobbles
      where account = ${account} and lower(track) like ${needle}
      group by lower(artist), lower(track)
      order by count desc
      limit ${limit}
    `,
  ]);

  return { artists, tracks };
}
