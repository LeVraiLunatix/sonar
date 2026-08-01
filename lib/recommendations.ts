import { unstable_cache } from "next/cache";
import { sql } from "./db";
import { APP_TZ } from "./constants";
import { addDays, parisToday } from "./dates";
import {
  artistTopTags,
  artistTopTracks,
  similarArtists,
  type ArtistTag,
} from "./lastfm-recommendations";

export const RECOMMENDATION_WINDOWS = [30, 90, 180] as const;
export type RecommendationWindow = (typeof RECOMMENDATION_WINDOWS)[number];

type ArtistHistory = {
  key: string;
  name: string;
  total: number;
  recent: number;
  previous: number;
  first: Date;
  last: Date;
  discovered: boolean;
};

type StreakRow = { key: string; days: number };
type FavouriteTrack = { key: string; artist: string; track: string; count: number };
type HeardTrack = { artistKey: string; trackKey: string };

export type ListeningSignal = {
  key: "discoveries" | "genre" | "rise" | "streak";
  value: string;
  label: string;
  detail: string;
};

export type SimilarRecommendation = {
  artist: string;
  seed: string;
  match: number;
  url: string;
};

export type TrackRecommendation = {
  artist: string;
  track: string;
  becauseTrack: string | null;
  seedScrobbles: number;
  url: string;
};

export type RediscoveryRecommendation = {
  artist: string;
  track: string | null;
  totalScrobbles: number;
  silentDays: number;
  artistHref: string;
};

export type RecommendationsData = {
  available: boolean;
  windowDays: RecommendationWindow;
  since: string;
  generatedAt: string;
  recentScrobbles: number;
  recentArtists: number;
  signals: ListeningSignal[];
  similar: SimilarRecommendation[];
  tracks: TrackRecommendation[];
  rediscoveries: RediscoveryRecommendation[];
  lastfmAvailable: boolean;
};

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase("fr");
}

function lastfmArtistUrl(artist: string): string {
  return `https://www.last.fm/music/${encodeURIComponent(artist).replace(/%20/g, "+")}`;
}

function lastfmTrackUrl(artist: string, track: string): string {
  const encode = (value: string) => encodeURIComponent(value).replace(/%20/g, "+");
  return `https://www.last.fm/music/${encode(artist)}/_/${encode(track)}`;
}

function daysSince(value: Date): number {
  return Math.max(1, Math.floor((Date.now() - value.getTime()) / 86_400_000));
}

const TAGS_TO_IGNORE = new Set([
  "seen live",
  "favorites",
  "favourites",
  "favorite",
  "favourite",
  "albums i own",
  "spotify",
  "last.fm",
  "under 2000 listeners",
]);

function strongestGenreTrend(
  histories: ArtistHistory[],
  tagsByArtist: Map<string, ArtistTag[]>,
): { name: string; points: number } | null {
  const recentTotal = histories.reduce((sum, artist) => sum + artist.recent, 0);
  const previousTotal = histories.reduce((sum, artist) => sum + artist.previous, 0);
  if (!recentTotal) return null;

  const recentScores = new Map<string, { name: string; score: number }>();
  const previousScores = new Map<string, { name: string; score: number }>();

  for (const artist of histories) {
    const tags = tagsByArtist.get(artist.key) ?? [];
    const topWeight = tags[0]?.weight || 1;
    for (const tag of tags) {
      const key = normalise(tag.name);
      if (TAGS_TO_IGNORE.has(key)) continue;
      const tagWeight = tag.weight / topWeight;
      const recent = recentScores.get(key)?.score ?? 0;
      const previous = previousScores.get(key)?.score ?? 0;
      recentScores.set(key, {
        name: tag.name,
        score: recent + (artist.recent / recentTotal) * tagWeight,
      });
      previousScores.set(key, {
        name: tag.name,
        score:
          previous +
          (previousTotal ? (artist.previous / previousTotal) * tagWeight : 0),
      });
    }
  }

  const candidates = [...recentScores.entries()]
    .map(([key, recent]) => ({
      name: recent.name,
      recent: recent.score,
      delta: recent.score - (previousScores.get(key)?.score ?? 0),
    }))
    .filter((tag) => tag.recent >= 0.08 && tag.delta > 0.015)
    .sort((a, b) => b.delta - a.delta);

  const winner = candidates[0];
  return winner
    ? { name: winner.name, points: Math.max(1, Math.round(winner.delta * 100)) }
    : null;
}

async function listeningHistory(account: string, windowDays: RecommendationWindow) {
  const today = parisToday();
  const since = addDays(today, -(windowDays - 1));
  const previousSince = addDays(since, -windowDays);

  const [histories, streaks, favourites, heardTracks] = await Promise.all([
    sql<ArtistHistory[]>`
      select lower(artist) as key,
             mode() within group (order by artist) as name,
             count(*)::int as total,
             count(*) filter (
               where played_at >= (${since}::timestamp at time zone ${APP_TZ})
             )::int as recent,
             count(*) filter (
               where played_at >= (${previousSince}::timestamp at time zone ${APP_TZ})
                 and played_at < (${since}::timestamp at time zone ${APP_TZ})
             )::int as previous,
             min(played_at) as first,
             max(played_at) as last,
             (min(played_at) >= (${since}::timestamp at time zone ${APP_TZ})) as discovered
      from scrobbles
      where account = ${account}
      group by lower(artist)
      order by total desc
    `,
    sql<StreakRow[]>`
      with days as (
        select distinct lower(artist) as key,
               (played_at at time zone ${APP_TZ})::date as day
        from scrobbles
        where account = ${account}
          and played_at >= (${since}::timestamp at time zone ${APP_TZ})
      ), numbered as (
        select key, day,
               day - row_number() over (partition by key order by day)::int as run
        from days
      ), runs as (
        select key, count(*)::int as days
        from numbered
        group by key, run
      )
      select key, max(days)::int as days
      from runs
      group by key
      order by days desc
      limit 12
    `,
    sql<FavouriteTrack[]>`
      with counts as (
        select lower(artist) as key,
               mode() within group (order by artist) as artist,
               mode() within group (order by track) as track,
               count(*)::int as count
        from scrobbles
        where account = ${account}
        group by lower(artist), lower(track)
      ), ranked as (
        select *, row_number() over (partition by key order by count desc, track) as rank
        from counts
      )
      select key, artist, track, count
      from ranked
      where rank = 1
    `,
    sql<HeardTrack[]>`
      select lower(artist) as "artistKey", lower(track) as "trackKey"
      from scrobbles
      where account = ${account}
      group by lower(artist), lower(track)
    `,
  ]);

  return { since, histories, streaks, favourites, heardTracks };
}

async function generateRecommendations(
  account: string,
  windowDays: RecommendationWindow,
): Promise<RecommendationsData> {
  const history = await listeningHistory(account, windowDays);
  const recent = [...history.histories]
    .filter((artist) => artist.recent > 0)
    .sort((a, b) => b.recent - a.recent || b.total - a.total);
  const previous = [...history.histories]
    .filter((artist) => artist.previous > 0)
    .sort((a, b) => b.previous - a.previous || b.total - a.total);
  const seeds = recent.slice(0, 6);
  const tagSeeds = [...seeds.slice(0, 4), ...previous.slice(0, 4)].filter(
    (artist, index, all) => all.findIndex((item) => item.key === artist.key) === index,
  );

  const tagResults = await Promise.allSettled(
    tagSeeds.map(async (artist) => ({
      key: artist.key,
      tags: await artistTopTags(artist.name),
    })),
  );
  const tagsByArtist = new Map<string, ArtistTag[]>();
  for (const result of tagResults) {
    if (result.status === "fulfilled") {
      tagsByArtist.set(result.value.key, result.value.tags);
    }
  }

  const [similarResults, trackResults] = await Promise.all([
    Promise.allSettled(
      seeds.slice(0, 4).map(async (seed) => ({
        seed,
        artists: await similarArtists(seed.name),
      })),
    ),
    Promise.allSettled(
      seeds.map(async (seed) => ({
        seed,
        tracks: await artistTopTracks(seed.name),
      })),
    ),
  ]);

  const heardArtists = new Set(history.histories.map((artist) => artist.key));
  const similarMap = new Map<
    string,
    { artist: string; seed: string; match: number; weighted: number }
  >();
  const strongestSeed = Math.max(1, seeds[0]?.recent ?? 1);
  for (const result of similarResults) {
    if (result.status !== "fulfilled") continue;
    const seedWeight = 0.7 + 0.3 * (result.value.seed.recent / strongestSeed);
    for (const artist of result.value.artists) {
      const key = normalise(artist.name);
      if (heardArtists.has(key)) continue;
      const weighted = artist.match * seedWeight;
      const current = similarMap.get(key);
      if (!current || weighted > current.weighted) {
        similarMap.set(key, {
          artist: artist.name,
          seed: result.value.seed.name,
          match: artist.match,
          weighted,
        });
      }
    }
  }
  const similar: SimilarRecommendation[] = [...similarMap.values()]
    .sort((a, b) => b.weighted - a.weighted)
    .slice(0, 8)
    .map((artist) => ({
      artist: artist.artist,
      seed: artist.seed,
      match: Math.round(artist.match * 100),
      url: lastfmArtistUrl(artist.artist),
    }));

  const heardTrackKeys = new Set(
    history.heardTracks.map((track) => `${track.artistKey}\u001f${track.trackKey}`),
  );
  const favouriteByArtist = new Map(history.favourites.map((track) => [track.key, track]));
  const tracks: TrackRecommendation[] = [];
  const proposedTracks = new Set<string>();
  for (const result of trackResults) {
    if (result.status !== "fulfilled" || tracks.length >= 8) continue;
    const artistKey = result.value.seed.key;
    let addedForSeed = 0;
    for (const track of result.value.tracks) {
      if (tracks.length >= 8 || addedForSeed >= 2) break;
      const key = `${artistKey}\u001f${normalise(track.name)}`;
      if (heardTrackKeys.has(key) || proposedTracks.has(key)) continue;
      proposedTracks.add(key);
      tracks.push({
        artist: result.value.seed.name,
        track: track.name,
        becauseTrack: favouriteByArtist.get(artistKey)?.track ?? null,
        seedScrobbles: result.value.seed.recent,
        url: lastfmTrackUrl(result.value.seed.name, track.name),
      });
      addedForSeed += 1;
    }
  }

  const rediscoveries: RediscoveryRecommendation[] = history.histories
    .filter((artist) => artist.total >= 8 && artist.recent === 0)
    .sort((a, b) => b.total - a.total || a.last.getTime() - b.last.getTime())
    .slice(0, 8)
    .map((artist) => ({
      artist: artist.name,
      track: favouriteByArtist.get(artist.key)?.track ?? null,
      totalScrobbles: artist.total,
      silentDays: daysSince(artist.last),
      artistHref: `/artist/${encodeURIComponent(artist.key)}`,
    }));

  const recentScrobbles = recent.reduce((sum, artist) => sum + artist.recent, 0);
  const discoveries = recent.filter((artist) => artist.discovered).length;
  const rising = recent
    .filter((artist) => artist.recent >= 5 && artist.recent > artist.previous * 1.35)
    .sort(
      (a, b) =>
        b.recent / Math.max(1, b.previous) - a.recent / Math.max(1, a.previous),
    )[0];
  const streakMap = new Map(history.streaks.map((streak) => [streak.key, streak.days]));
  const streakArtist = recent
    .map((artist) => ({ artist, days: streakMap.get(artist.key) ?? 0 }))
    .filter((item) => item.days >= 2)
    .sort((a, b) => b.days - a.days || b.artist.recent - a.artist.recent)[0];
  const genre = strongestGenreTrend(tagSeeds, tagsByArtist);

  const signals: ListeningSignal[] = [];
  if (discoveries > 0) {
    signals.push({
      key: "discoveries",
      value: String(discoveries),
      label: `artiste${discoveries > 1 ? "s" : ""} découvert${discoveries > 1 ? "s" : ""}`,
      detail: `première écoute au cours des ${windowDays} derniers jours`,
    });
  }
  if (genre) {
    signals.push({
      key: "genre",
      value: `+${genre.points} pts`,
      label: `${genre.name} en hausse`,
      detail: "poids du genre face à la période précédente",
    });
  }
  if (rising) {
    const rise = Math.round(
      ((rising.recent - rising.previous) / Math.max(1, rising.previous)) * 100,
    );
    signals.push({
      key: "rise",
      value: rising.previous === 0 ? String(rising.recent) : `+${Math.min(999, rise)} %`,
      label: rising.name,
      detail:
        rising.previous === 0
          ? "écoutes récentes, aucune sur la période précédente"
          : "progression face à la période précédente",
    });
  }
  if (streakArtist) {
    signals.push({
      key: "streak",
      value: `${streakArtist.days} j`,
      label: `avec ${streakArtist.artist.name}`,
      detail: "plus longue série récente pour un même artiste",
    });
  }

  return {
    available: true,
    windowDays,
    since: history.since,
    generatedAt: new Date().toISOString(),
    recentScrobbles,
    recentArtists: recent.length,
    signals: signals.slice(0, 4),
    similar,
    tracks,
    rediscoveries,
    lastfmAvailable:
      similarResults.some((result) => result.status === "fulfilled") ||
      trackResults.some((result) => result.status === "fulfilled"),
  };
}

// Instantané personnalisé : la clé inclut automatiquement le compte et la
// fenêtre reçus en arguments. Six heures gardent les résultats frais sans
// recalculer le profil ni solliciter Last.fm à chaque visite.
const cachedRecommendations = unstable_cache(
  generateRecommendations,
  ["sonar-recommendations-v3"],
  { revalidate: 6 * 60 * 60 },
);

export async function getRecommendations(
  account: string | null,
  windowDays: RecommendationWindow,
): Promise<RecommendationsData> {
  if (!account || !process.env.DATABASE_URL) {
    return {
      available: false,
      windowDays,
      since: addDays(parisToday(), -(windowDays - 1)),
      generatedAt: new Date().toISOString(),
      recentScrobbles: 0,
      recentArtists: 0,
      signals: [],
      similar: [],
      tracks: [],
      rediscoveries: [],
      lastfmAvailable: false,
    };
  }
  return cachedRecommendations(account, windowDays);
}
