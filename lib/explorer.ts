import { addDays, isoWeekOf, parisToday, weekRange } from "./dates";
import { sql } from "./db";
import { freshVsRepeat, obsessions } from "./insights";
import { userFriendListens } from "./lastfm-recommendations";
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
    };
  }
  const [dna, yearlyFlashbacks, monthlyFlashbacks, wrap, albums, favourites, radarData] =
    await Promise.all([
      musicalDna(account, today),
      flashbacks(account, today, "year"),
      flashbacks(account, today, "month"),
      weeklyWrap(account, today),
      albumsToResume(account, today),
      archivedFavourites(account, today),
      radar(account),
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
  };
}
