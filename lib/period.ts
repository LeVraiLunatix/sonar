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

const hasDb = () => !!process.env.DATABASE_URL;

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

export async function getPeriodData(range: Range, kind: PeriodKind): Promise<PeriodData> {
  const label = periodLabel(range, kind);
  const prev = prevRangeOf(range, kind);

  if (!hasDb()) {
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
      s.summary(range),
      s.perDay(range),
      s.perHour(range),
      s.topArtists(range, 10),
      s.topAlbums(range, 8),
      s.topTracks(range, 10),
      s.discoveries(range, 12),
      s.topArtists(prev, 500),
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
    source: hasDb() ? "db" : "fixtures",
  };
}

// ── Journée : période + timeline détaillée ──
export type DayData = PeriodData & { timeline: ScrobbleRow[] };

export async function getDayData(date: string): Promise<DayData> {
  const base = await getPeriodData({ start: date, end: nextDayStr(date) }, "day");
  let timeline: ScrobbleRow[];
  if (!hasDb()) {
    timeline = buildDayTimeline(date, base.summary.scrobbles) as ScrobbleRow[];
  } else {
    const s = await import("./stats");
    timeline = await s.scrobblesInRange(base.range, 500);
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
  aRange: Range,
  bRange: Range,
  aLabel: string,
  bLabel: string,
): Promise<CompareData> {
  let aList: ArtistCount[];
  let bList: ArtistCount[];
  let aSum: Summary;
  let bSum: Summary;

  if (!hasDb()) {
    const fa = buildRange(aRange.start, aRange.end);
    const fb = buildRange(bRange.start, bRange.end);
    aList = fa.topArtists;
    bList = fb.topArtists;
    aSum = fa.summary;
    bSum = fb.summary;
  } else {
    const s = await import("./stats");
    [aSum, bSum, aList, bList] = await Promise.all([
      s.summary(aRange),
      s.summary(bRange),
      s.topArtists(aRange, 500),
      s.topArtists(bRange, 500),
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
  ranges: { today: Range; week: Range; month: Range; last90: Range },
): Promise<HomeData> {
  const [today, week, month] = await Promise.all([
    getPeriodData(ranges.today, "day"),
    getPeriodData(ranges.week, "week"),
    getPeriodData(ranges.month, "month"),
  ]);

  if (!hasDb()) {
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
    s.perDay(ranges.last90),
    s.recentScrobbles(12),
    s.lifetime(),
  ]);
  return { today, week, month, last90, recent, lifetime: life, source: "db" };
}
