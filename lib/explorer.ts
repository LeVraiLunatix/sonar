import { addDays, isoWeekOf, parisToday, weekRange } from "./dates";
import { sql } from "./db";
import { freshVsRepeat, obsessions } from "./insights";
import { albumTracklist, userFriendListens } from "./lastfm-recommendations";
import { artistsReleaseGroups } from "./musicbrainz";
import {
  discoveries,
  perDay,
  perHour,
  summary,
  topArtists,
  topTracks,
  type ArtistCount,
} from "./stats";
import { longestStreak } from "./streak";
import { APP_TZ } from "./constants";

const normalise = (value: string) => value.trim().toLocaleLowerCase("fr-FR");

const lastfmTrackUrl = (artist: string, track: string) =>
  `https://www.last.fm/music/${encodeURIComponent(artist)}/_/${encodeURIComponent(track)}`;

const lastfmAlbumUrl = (artist: string, album: string) =>
  `https://www.last.fm/music/${encodeURIComponent(artist)}/${encodeURIComponent(album)}`;

export type MusicalDna = {
  loyalty: number;
  curiosity: number;
  replay: number;
  night: number;
  recentScrobbles: number;
};

export type Flashback = {
  date: string;
  distance: number;
  scrobbles: number;
  artist: string;
  track: string;
};

export type WeeklyWrap = {
  start: string;
  end: string;
  scrobbles: number;
  delta: number | null;
  estMs: number;
  topArtist: ArtistCount | null;
  topTrack: { artist: string; track: string; count: number } | null;
  discoveries: number;
  freshPercent: number;
  peakDay: { day: string; count: number } | null;
  peakHour: { hour: number; count: number } | null;
  streak: number;
  obsession: string | null;
};

export type AlbumToResume = {
  artist: string;
  album: string;
  scrobbles: number;
  silentDays: number;
  url: string;
};

export type ArchivedFavourite = {
  artist: string;
  track: string;
  scrobbles: number;
  silentDays: number;
  url: string;
};

export type RadarListen = {
  friend: string;
  artist: string;
  track: string;
  url: string;
  nowPlaying: boolean;
  knownArtist: boolean;
};

export type ProfileMatch = {
  username: string;
  score: number;
  shared: Array<{ name: string; yours: number; theirs: number }>;
  forYou: Array<{ name: string; count: number }>;
  forThem: Array<{ name: string; count: number }>;
};

export type ReleaseSignal = {
  artist: string;
  title: string;
  type: "Album" | "Single" | "EP";
  date: string;
  url: string;
};

export type AlbumToFinish = {
  artist: string;
  album: string;
  heard: number;
  total: number;
  percent: number;
  missing: string[];
  url: string;
};

export type CleanupIssue = {
  artist: string;
  canonical: string;
  variants: string[];
  scrobbles: number;
};

export type ArtistTrajectory = {
  artist: string;
  scrobbles: number;
  discovered: string;
  peakMonth: string;
  peakScrobbles: number;
  longestGapDays: number;
  lastListen: string;
};

export type ExplorerData = {
  available: boolean;
  dna: MusicalDna;
  yearlyFlashbacks: Flashback[];
  monthlyFlashbacks: Flashback[];
  wrap: WeeklyWrap;
  albums: AlbumToResume[];
  favourites: ArchivedFavourite[];
  radar: RadarListen[];
  radarAvailable: boolean;
  missedReleases: ReleaseSignal[];
  upcomingReleases: ReleaseSignal[];
  albumsToFinish: AlbumToFinish[];
  cleanupIssues: CleanupIssue[];
  trajectories: ArtistTrajectory[];
};

async function musicalDna(account: string, today: string): Promise<MusicalDna> {
  const since = addDays(today, -89);
  const [row] = await sql<{
    total: number;
    recent_artists: number;
    discoveries: number;
    repeated: number;
    night: number;
    loyal: number;
  }[]>`
    with recent as (
      select lower(artist) as ak, lower(track) as tk, played_at
      from scrobbles
      where account = ${account}
        and played_at >= (${since}::timestamp at time zone ${APP_TZ})
        and played_at < (${addDays(today, 1)}::timestamp at time zone ${APP_TZ})
    ),
    tracks as (
      select ak, tk, count(*)::int as n from recent group by ak, tk
    ),
    artist_months as (
      select lower(artist) as ak,
             count(distinct date_trunc('month', played_at at time zone ${APP_TZ}))::int as months
      from scrobbles where account = ${account} group by 1
    ),
    first_artists as (
      select lower(artist) as ak, min(played_at) as first
      from scrobbles where account = ${account} group by 1
    )
    select
      (select count(*)::int from recent) as total,
      (select count(distinct ak)::int from recent) as recent_artists,
      (select count(distinct r.ak)::int from recent r join first_artists f using (ak)
        where f.first >= (${since}::timestamp at time zone ${APP_TZ})) as discoveries,
      (select coalesce(sum(greatest(n - 1, 0)), 0)::int from tracks) as repeated,
      (select count(*)::int from recent
        where extract(hour from played_at at time zone ${APP_TZ}) between 0 and 5) as night,
      (select count(*)::int from recent r join artist_months a using (ak) where a.months >= 3) as loyal
  `;
  const total = row?.total ?? 0;
  const artists = row?.recent_artists ?? 0;
  const pct = (value: number, base = total) =>
    base > 0 ? Math.round((value / base) * 100) : 0;
  return {
    loyalty: pct(row?.loyal ?? 0),
    curiosity: pct(row?.discoveries ?? 0, artists),
    replay: pct(row?.repeated ?? 0),
    night: pct(row?.night ?? 0),
    recentScrobbles: total,
  };
}

async function flashbacks(
  account: string,
  today: string,
  mode: "year" | "month",
): Promise<Flashback[]> {
  const [, month, day] = today.split("-").map(Number);
  const rows = await sql<{
    date: string;
    scrobbles: number;
    artist: string;
    track: string;
  }[]>`
    with base as (
      select (played_at at time zone ${APP_TZ})::date as d, artist, track
      from scrobbles
      where account = ${account}
        and (played_at at time zone ${APP_TZ})::date < ${today}::date
        and (
          (${mode} = 'year'
            and extract(month from played_at at time zone ${APP_TZ}) = ${month}
            and extract(day from played_at at time zone ${APP_TZ}) = ${day})
          or
          (${mode} = 'month'
            and extract(day from played_at at time zone ${APP_TZ}) = ${day}
            and (played_at at time zone ${APP_TZ})::date >= ${today}::date - interval '12 months')
        )
    ),
    grouped as (
      select d, artist, track, count(*)::int as plays
      from base group by d, artist, track
    ),
    ranked as (
      select *, row_number() over (partition by d order by plays desc, track asc) as rank
      from grouped
    ),
    totals as (
      select d, sum(plays)::int as total from grouped group by d
    )
    select to_char(r.d, 'YYYY-MM-DD') as date, t.total as scrobbles,
           r.artist, r.track
    from ranked r join totals t using (d)
    where r.rank = 1
    order by r.d desc
  `;
  const [year, currentMonth] = today.split("-").map(Number);
  return rows.map((row) => {
    const [rowYear, rowMonth] = row.date.split("-").map(Number);
    return {
      ...row,
      distance:
        mode === "year"
          ? year - rowYear
          : (year - rowYear) * 12 + currentMonth - rowMonth,
    };
  });
}

async function weeklyWrap(account: string, today: string): Promise<WeeklyWrap> {
  const { year, week } = isoWeekOf(today);
  const current = { start: weekRange(year, week).start, end: addDays(today, 1) };
  const elapsed = Math.max(1, Math.round((Date.parse(current.end) - Date.parse(current.start)) / 86_400_000));
  const previous = { start: addDays(current.start, -7), end: addDays(current.start, -7 + elapsed) };
  const [currentSummary, previousSummary, artists, tracks, found, days, hours, fresh, obs] =
    await Promise.all([
      summary(account, current),
      summary(account, previous),
      topArtists(account, current, 1),
      topTracks(account, current, 1),
      discoveries(account, current, 1000),
      perDay(account, current),
      perHour(account, current),
      freshVsRepeat(account, current),
      obsessions(account, current, 1),
    ]);
  const peakDay = days.reduce<(typeof days)[number] | null>(
    (best, item) => (!best || item.count > best.count ? item : best),
    null,
  );
  const peakHour = hours.reduce<(typeof hours)[number] | null>(
    (best, item) => (!best || item.count > best.count ? item : best),
    null,
  );
  const delta =
    previousSummary.scrobbles > 0
      ? Math.round(((currentSummary.scrobbles - previousSummary.scrobbles) / previousSummary.scrobbles) * 100)
      : null;
  return {
    start: current.start,
    end: today,
    scrobbles: currentSummary.scrobbles,
    delta,
    estMs: currentSummary.estMs,
    topArtist: artists[0] ?? null,
    topTrack: tracks[0] ?? null,
    discoveries: found.length,
    freshPercent: fresh.fresh + fresh.repeat > 0 ? Math.round((fresh.fresh / (fresh.fresh + fresh.repeat)) * 100) : 0,
    peakDay: peakDay && peakDay.count > 0 ? peakDay : null,
    peakHour: peakHour && peakHour.count > 0 ? peakHour : null,
    streak: longestStreak(days),
    obsession: obs[0]?.name ?? null,
  };
}

async function albumsToResume(account: string, today: string): Promise<AlbumToResume[]> {
  const rows = await sql<{
    artist: string;
    album: string;
    scrobbles: number;
    last: string;
  }[]>`
    select mode() within group (order by artist) as artist,
           mode() within group (order by album) as album,
           count(*)::int as scrobbles,
           to_char(max(played_at) at time zone ${APP_TZ}, 'YYYY-MM-DD') as last
    from scrobbles
    where account = ${account} and album is not null and album <> ''
    group by lower(artist), lower(album)
    having count(*) >= 5
       and max(played_at) < (${addDays(today, -30)}::timestamp at time zone ${APP_TZ})
    order by scrobbles desc, max(played_at) asc
    limit 8
  `;
  return rows.map((row) => ({
    artist: row.artist,
    album: row.album,
    scrobbles: row.scrobbles,
    silentDays: Math.max(0, Math.floor((Date.parse(today) - Date.parse(row.last)) / 86_400_000)),
    url: lastfmAlbumUrl(row.artist, row.album),
  }));
}

async function releaseSignals(
  account: string,
  today: string,
): Promise<{ missed: ReleaseSignal[]; upcoming: ReleaseSignal[] }> {
  const [artists, heard] = await Promise.all([
    sql<{ artist: string; scrobbles: number }[]>`
      select mode() within group (order by artist) as artist,
             count(*)::int as scrobbles
      from scrobbles
      where account = ${account}
        and played_at >= (${addDays(today, -365)}::timestamp at time zone ${APP_TZ})
      group by lower(artist)
      order by scrobbles desc
      limit 8
    `,
    sql<{ artist_key: string; title_key: string }[]>`
      select distinct lower(artist) as artist_key, lower(album) as title_key
      from scrobbles
      where account = ${account} and album is not null and album <> ''
      union
      select distinct lower(artist) as artist_key, lower(track) as title_key
      from scrobbles
      where account = ${account}
    `,
  ]);
  try {
    const releases = await artistsReleaseGroups(artists.map((item) => item.artist));
    const heardKeys = new Set(
      heard.map((item) => `${normalise(item.artist_key)}\u001f${normalise(item.title_key)}`),
    );
    const seen = new Set<string>();
    const unique = releases.filter((release) => {
      const key = `${normalise(release.artist)}\u001f${normalise(release.title)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const asSignal = (release: (typeof releases)[number]): ReleaseSignal => ({
      artist: release.artist,
      title: release.title,
      type: release.type,
      date: release.date,
      url: release.url,
    });
    const missed = unique
      .filter((release) => {
        const key = `${normalise(release.artist)}\u001f${normalise(release.title)}`;
        return release.date <= today
          && release.date >= addDays(today, -550)
          && !heardKeys.has(key);
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8)
      .map(asSignal);
    const upcoming = unique
      .filter((release) => release.date > today && release.date <= addDays(today, 370))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8)
      .map(asSignal);
    return { missed, upcoming };
  } catch {
    return { missed: [], upcoming: [] };
  }
}

async function albumsToFinish(account: string): Promise<AlbumToFinish[]> {
  const candidates = await sql<{
    artist: string;
    album: string;
    tracks: string[];
  }[]>`
    select mode() within group (order by artist) as artist,
           mode() within group (order by album) as album,
           array_agg(distinct track order by track)::text[] as tracks
    from scrobbles
    where account = ${account} and album is not null and album <> ''
    group by lower(artist), lower(album)
    having count(distinct lower(track)) >= 2
    order by max(played_at) desc, count(*) desc
    limit 6
  `;
  const results = await Promise.allSettled(
    candidates.map(async (candidate) => {
      const info = await albumTracklist(candidate.artist, candidate.album);
      if (!info || info.tracks.length < 3) return null;
      const heardKeys = new Set(candidate.tracks.map(normalise));
      const missing = info.tracks.filter((track) => !heardKeys.has(normalise(track)));
      const heard = info.tracks.length - missing.length;
      if (heard <= 0 || missing.length === 0) return null;
      return {
        artist: info.artist,
        album: info.album,
        heard,
        total: info.tracks.length,
        percent: Math.round((heard / info.tracks.length) * 100),
        missing: missing.slice(0, 3),
        url: lastfmAlbumUrl(info.artist, info.album),
      } satisfies AlbumToFinish;
    }),
  );
  return results
    .filter((result): result is PromiseFulfilledResult<AlbumToFinish | null> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((item): item is AlbumToFinish => item !== null)
    .sort((a, b) => b.percent - a.percent || a.total - b.total)
    .slice(0, 6);
}

async function archiveCleanup(account: string): Promise<CleanupIssue[]> {
  const rows = await sql<{
    artist: string;
    variants: string[];
    scrobbles: number;
  }[]>`
    with prepared as (
      select artist, track,
             lower(artist) as artist_key,
             trim(regexp_replace(
               regexp_replace(lower(track),
                 '\\s*[-–—]\\s*(\\d{4}\\s*)?remaster(ed)?(\\s*\\d{4})?.*$', '', 'i'),
               '\\s*[\\[(]\\s*(\\d{4}\\s*)?remaster(ed)?[^\\])]*[\\])]\\s*$', '', 'i'
             )) as base_key
      from scrobbles
      where account = ${account}
    )
    select mode() within group (order by artist) as artist,
           array_agg(distinct track order by track)::text[] as variants,
           count(*)::int as scrobbles
    from prepared
    where base_key <> ''
    group by artist_key, base_key
    having count(distinct track) > 1
    order by scrobbles desc
    limit 8
  `;
  return rows.map((row) => ({
    artist: row.artist,
    canonical: [...row.variants].sort((a, b) => a.length - b.length)[0] ?? row.variants[0],
    variants: row.variants,
    scrobbles: row.scrobbles,
  }));
}

async function artistTrajectories(account: string): Promise<ArtistTrajectory[]> {
  return sql<ArtistTrajectory[]>`
    with top as (
      select lower(artist) as artist_key
      from scrobbles where account = ${account}
      group by lower(artist)
      order by count(*) desc
      limit 6
    ),
    base as (
      select lower(s.artist) as artist_key, s.artist,
             (s.played_at at time zone ${APP_TZ})::date as day
      from scrobbles s join top t on t.artist_key = lower(s.artist)
      where s.account = ${account}
    ),
    totals as (
      select artist_key, mode() within group (order by artist) as artist,
             count(*)::int as scrobbles, min(day) as discovered, max(day) as last_listen
      from base group by artist_key
    ),
    monthly as (
      select artist_key, date_trunc('month', day)::date as month, count(*)::int as scrobbles
      from base group by artist_key, date_trunc('month', day)
    ),
    peak as (
      select *, row_number() over (partition by artist_key order by scrobbles desc, month desc) as rank
      from monthly
    ),
    distinct_days as (
      select distinct artist_key, day from base
    ),
    gap_rows as (
      select artist_key, day - lag(day) over (partition by artist_key order by day) as gap
      from distinct_days
    ),
    gaps as (
      select artist_key, coalesce(max(gap), 0)::int as longest_gap
      from gap_rows group by artist_key
    )
    select t.artist, t.scrobbles,
           to_char(t.discovered, 'YYYY-MM-DD') as discovered,
           to_char(p.month, 'YYYY-MM') as "peakMonth",
           p.scrobbles::int as "peakScrobbles",
           g.longest_gap::int as "longestGapDays",
           to_char(t.last_listen, 'YYYY-MM-DD') as "lastListen"
    from totals t
    join peak p on p.artist_key = t.artist_key and p.rank = 1
    join gaps g on g.artist_key = t.artist_key
    order by t.scrobbles desc
  `;
}

async function archivedFavourites(account: string, today: string): Promise<ArchivedFavourite[]> {
  const rows = await sql<{
    artist: string;
    track: string;
    scrobbles: number;
    last: string;
  }[]>`
    with loved_tracks as (
      select distinct lower(artist) as ak, lower(track) as tk
      from scrobbles where account = ${account} and loved
    )
    select mode() within group (order by s.artist) as artist,
           mode() within group (order by s.track) as track,
           count(*)::int as scrobbles,
           to_char(max(s.played_at) at time zone ${APP_TZ}, 'YYYY-MM-DD') as last
    from scrobbles s join loved_tracks l
      on l.ak = lower(s.artist) and l.tk = lower(s.track)
    where s.account = ${account}
    group by l.ak, l.tk
    order by max(s.played_at) asc, scrobbles asc
    limit 8
  `;
  return rows.map((row) => ({
    artist: row.artist,
    track: row.track,
    scrobbles: row.scrobbles,
    silentDays: Math.max(0, Math.floor((Date.parse(today) - Date.parse(row.last)) / 86_400_000)),
    url: lastfmTrackUrl(row.artist, row.track),
  }));
}

async function radar(account: string): Promise<{ items: RadarListen[]; available: boolean }> {
  let listens;
  try {
    listens = await userFriendListens(account);
  } catch {
    return { items: [], available: false };
  }
  if (listens.length === 0) return { items: [], available: true };
  const artistKeys = [...new Set(listens.map((item) => normalise(item.artist)))];
  const heard = await sql<{ artist_key: string; track_key: string }[]>`
    select distinct lower(artist) as artist_key, lower(track) as track_key
    from scrobbles
    where account = ${account} and lower(artist) in ${sql(artistKeys)}
  `;
  const heardTracks = new Set(heard.map((item) => `${item.artist_key}\u001f${item.track_key}`));
  const heardArtists = new Set(heard.map((item) => item.artist_key));
  const seen = new Set<string>();
  const items: RadarListen[] = [];
  for (const listen of listens) {
    const artistKey = normalise(listen.artist);
    const trackKey = normalise(listen.track);
    const key = `${artistKey}\u001f${trackKey}`;
    if (heardTracks.has(key) || seen.has(key)) continue;
    seen.add(key);
    items.push({
      friend: listen.friend,
      artist: listen.artist,
      track: listen.track,
      url: listen.url,
      nowPlaying: listen.nowPlaying,
      knownArtist: heardArtists.has(artistKey),
    });
    if (items.length >= 8) break;
  }
  return { items, available: true };
}

async function lifetimeArtists(account: string): Promise<ArtistCount[]> {
  return sql<ArtistCount[]>`
    select lower(artist) as key,
           mode() within group (order by artist) as name,
           count(*)::int as count
    from scrobbles where account = ${account}
    group by lower(artist)
    order by count desc
    limit 100
  `;
}

export async function matchProfiles(account: string, target: string): Promise<ProfileMatch> {
  const [yours, theirs] = await Promise.all([lifetimeArtists(account), lifetimeArtists(target)]);
  const yoursTotal = yours.reduce((sum, item) => sum + item.count, 0) || 1;
  const theirsTotal = theirs.reduce((sum, item) => sum + item.count, 0) || 1;
  const yoursMap = new Map(yours.map((item) => [item.key, item]));
  const theirsMap = new Map(theirs.map((item) => [item.key, item]));
  const keys = new Set([...yoursMap.keys(), ...theirsMap.keys()]);
  let intersection = 0;
  let union = 0;
  for (const key of keys) {
    const a = (yoursMap.get(key)?.count ?? 0) / yoursTotal;
    const b = (theirsMap.get(key)?.count ?? 0) / theirsTotal;
    intersection += Math.min(a, b);
    union += Math.max(a, b);
  }
  const shared = yours
    .filter((item) => theirsMap.has(item.key))
    .map((item) => ({ name: item.name, yours: item.count, theirs: theirsMap.get(item.key)?.count ?? 0 }))
    .sort((a, b) => b.yours + b.theirs - (a.yours + a.theirs))
    .slice(0, 8);
  return {
    username: target,
    score: union > 0 ? Math.round((intersection / union) * 100) : 0,
    shared,
    forYou: theirs.filter((item) => !yoursMap.has(item.key)).slice(0, 6).map((item) => ({ name: item.name, count: item.count })),
    forThem: yours.filter((item) => !theirsMap.has(item.key)).slice(0, 6).map((item) => ({ name: item.name, count: item.count })),
  };
}

const emptyWrap = (today: string): WeeklyWrap => ({
  start: today,
  end: today,
  scrobbles: 0,
  delta: null,
  estMs: 0,
  topArtist: null,
  topTrack: null,
  discoveries: 0,
  freshPercent: 0,
  peakDay: null,
  peakHour: null,
  streak: 0,
  obsession: null,
});

export async function getExplorerData(account: string | null): Promise<ExplorerData> {
  const today = parisToday();
  if (!account || !process.env.DATABASE_URL) {
    return {
      available: false,
      dna: { loyalty: 0, curiosity: 0, replay: 0, night: 0, recentScrobbles: 0 },
      yearlyFlashbacks: [],
      monthlyFlashbacks: [],
      wrap: emptyWrap(today),
      albums: [],
      favourites: [],
      radar: [],
      radarAvailable: false,
      missedReleases: [],
      upcomingReleases: [],
      albumsToFinish: [],
      cleanupIssues: [],
      trajectories: [],
    };
  }
  const [
    dna,
    yearlyFlashbacks,
    monthlyFlashbacks,
    wrap,
    albums,
    favourites,
    radarData,
    releases,
    unfinished,
    cleanupIssues,
    trajectories,
  ] =
    await Promise.all([
      musicalDna(account, today),
      flashbacks(account, today, "year"),
      flashbacks(account, today, "month"),
      weeklyWrap(account, today),
      albumsToResume(account, today),
      archivedFavourites(account, today),
      radar(account),
      releaseSignals(account, today),
      albumsToFinish(account),
      archiveCleanup(account),
      artistTrajectories(account),
    ]);
  return {
    available: true,
    dna,
    yearlyFlashbacks,
    monthlyFlashbacks,
    wrap,
    albums,
    favourites,
    radar: radarData.items,
    radarAvailable: radarData.available,
    missedReleases: releases.missed,
    upcomingReleases: releases.upcoming,
    albumsToFinish: unfinished,
    cleanupIssues,
    trajectories,
  };
}
