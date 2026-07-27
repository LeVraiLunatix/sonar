import type {
  AlbumCount,
  ArtistCount,
  DayCount,
  HourCount,
  Range,
  ScrobbleRow,
  Summary,
  TrackCount,
} from "./stats";
import { buildRange, buildDayTimeline } from "./fixtures";
import { longestStreak } from "./streak";
import { periodLabel, prevRangeOf, type PeriodKind } from "./dates";

/** Données réelles seulement si une base est configurée ET un compte identifié. */
const useDb = (account: string | null): account is string =>
  !!process.env.DATABASE_URL && !!account;

export type PeriodData = {
  range: Range;
  kind: PeriodKind;
  label: string;
  summary: Summary;
  perDay: DayCount[];
  perHour: HourCount[];
  topArtists: ArtistCount[];
  topAlbums: AlbumCount[];
  topTracks: TrackCount[];
  discoveries: ArtistCount[];
  topTrack: TrackCount | null;
  streak: number;
  /** écoutes par artiste sur la période précédente (clé = lower(artist)) → comparaison */
  prevArtist: Record<string, number>;
  source: "fixtures" | "db";
};

export async function getPeriodData(
  account: string | null,
  range: Range,
  kind: PeriodKind,
): Promise<PeriodData> {
  const label = periodLabel(range, kind);
  const prev = prevRangeOf(range, kind);

  if (!useDb(account)) {
    const f = buildRange(range.start, range.end);
    const p = buildRange(prev.start, prev.end);
    return {
      ...f,
      range,
      kind,
      label,
      streak: longestStreak(f.perDay),
      prevArtist: Object.fromEntries(p.topArtists.map((a) => [a.key, a.count])),
      source: "fixtures",
    };
  }

  const s = await import("./stats");
  const [summary, perDay, perHour, topArtists, topAlbums, topTracks, discoveries, prevTop] =
    await Promise.all([
      s.summary(account, range),
      s.perDay(account, range),
      s.perHour(account, range),
      s.topArtists(account, range, 10),
      s.topAlbums(account, range, 8),
      s.topTracks(account, range, 10),
      s.discoveries(account, range, 12),
      s.topArtists(account, prev, 500),
    ]);

  return {
    range,
    kind,
    label,
    summary,
    perDay,
    perHour,
    topArtists,
    topAlbums,
    topTracks,
    discoveries,
    topTrack: topTracks[0] ?? null,
    streak: longestStreak(perDay),
    prevArtist: Object.fromEntries(prevTop.map((a) => [a.key, a.count])),
    source: "db",
  };
}

// ── Journée : période + timeline détaillée ──
export type DayData = PeriodData & { timeline: ScrobbleRow[] };

export async function getDayData(account: string | null, date: string): Promise<DayData> {
  const base = await getPeriodData(account, { start: date, end: nextDayStr(date) }, "day");
  let timeline: ScrobbleRow[];
  if (!useDb(account)) {
    timeline = buildDayTimeline(date, base.summary.scrobbles) as ScrobbleRow[];
  } else {
    const s = await import("./stats");
    timeline = await s.scrobblesInRange(account, base.range, 500);
  }
  return { ...base, timeline };
}

function nextDayStr(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ── Comparateur de deux périodes ──
export type CompareRow = { key: string; name: string; a: number; b: number };
export type CompareData = {
  a: { label: string; scrobbles: number; artists: number };
  b: { label: string; scrobbles: number; artists: number };
  rows: CompareRow[];
  shared: number;
};

export async function getCompareData(
  account: string | null,
  aRange: Range,
  bRange: Range,
  aLabel: string,
  bLabel: string,
): Promise<CompareData> {
  let aList: ArtistCount[];
  let bList: ArtistCount[];
  let aSum: Summary;
  let bSum: Summary;

  if (!useDb(account)) {
    const fa = buildRange(aRange.start, aRange.end);
    const fb = buildRange(bRange.start, bRange.end);
    aList = fa.topArtists;
    bList = fb.topArtists;
    aSum = fa.summary;
    bSum = fb.summary;
  } else {
    const s = await import("./stats");
    [aSum, bSum, aList, bList] = await Promise.all([
      s.summary(account, aRange),
      s.summary(account, bRange),
      s.topArtists(account, aRange, 500),
      s.topArtists(account, bRange, 500),
    ]);
  }

  const aMap = new Map(aList.map((x) => [x.key, x]));
  const bMap = new Map(bList.map((x) => [x.key, x]));
  const keys = new Set([...aMap.keys(), ...bMap.keys()]);

  let shared = 0;
  const rows: CompareRow[] = [];
  for (const key of keys) {
    const a = aMap.get(key)?.count ?? 0;
    const b = bMap.get(key)?.count ?? 0;
    if (a > 0 && b > 0) shared++;
    rows.push({ key, name: aMap.get(key)?.name ?? bMap.get(key)?.name ?? key, a, b });
  }
  rows.sort((x, y) => y.a + y.b - (x.a + x.b));

  return {
    a: { label: aLabel, scrobbles: aSum.scrobbles, artists: aSum.artists },
    b: { label: bLabel, scrobbles: bSum.scrobbles, artists: bSum.artists },
    rows: rows.slice(0, 14),
    shared,
  };
}

// ── Dashboard d'accueil ──
export type HomeData = {
  today: PeriodData;
  week: PeriodData;
  month: PeriodData;
  last90: DayCount[];
  recent: ScrobbleRow[];
  lifetime: { total: number; first: string | null };
  source: "fixtures" | "db";
};

export async function getHomeData(
  account: string | null,
  ranges: { today: Range; week: Range; month: Range; last90: Range },
): Promise<HomeData> {
  const [today, week, month] = await Promise.all([
    getPeriodData(account, ranges.today, "day"),
    getPeriodData(account, ranges.week, "week"),
    getPeriodData(account, ranges.month, "month"),
  ]);

  if (!useDb(account)) {
    const b = buildRange(ranges.last90.start, ranges.last90.end);
    return {
      today,
      week,
      month,
      last90: b.perDay,
      recent: buildDayTimeline(ranges.today.start, 12) as ScrobbleRow[],
      lifetime: { total: 1369, first: "2019-03-12T00:00:00Z" },
      source: "fixtures",
    };
  }

  const s = await import("./stats");
  const [last90, recent, life] = await Promise.all([
    s.perDay(account, ranges.last90),
    s.recentScrobbles(account, 12),
    s.lifetime(account),
  ]);
  return { today, week, month, last90, recent, lifetime: life, source: "db" };
}
