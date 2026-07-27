import type {
  AlbumCount,
  ArtistCount,
  DayCount,
  HourCount,
  Range,
  Summary,
  TrackCount,
} from "./stats";
import { FALLBACK_TRACK_MS } from "./constants";

/**
 * Données fictives DÉTERMINISTES (seed = bornes de la plage) pour construire et
 * juger l'UI sans base. Fonctionne pour n'importe quelle plage [start, end).
 * Mêmes formes que lib/stats.ts. Déterministe = pas de mismatch d'hydratation.
 */

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ARTISTS = [
  "Alcest", "Slowdive", "Godspeed You! Black Emperor", "Have a Nice Life",
  "Deafheaven", "Grouper", "Boards of Canada", "Mount Eerie",
  "Duster", "This Will Destroy You", "Cocteau Twins", "Sigur Rós",
  "Portishead", "Explosions in the Sky", "Julien Baker", "The Microphones",
];

const ALBUMS: [string, string][] = [
  ["Alcest", "Souvenirs d'un autre monde"],
  ["Slowdive", "Souvlaki"],
  ["Deafheaven", "Sunbather"],
  ["Grouper", "Ruins"],
  ["Boards of Canada", "Music Has the Right to Children"],
  ["Duster", "Stratosphere"],
  ["Have a Nice Life", "Deathconsciousness"],
  ["Sigur Rós", "( )"],
  ["Portishead", "Dummy"],
  ["Mount Eerie", "A Crow Looked at Me"],
];

const TRACKS: [string, string][] = [
  ["Alcest", "Écailles de lune, Pt. 1"],
  ["Slowdive", "When the Sun Hits"],
  ["Deafheaven", "Dream House"],
  ["Grouper", "Holding"],
  ["Duster", "Inside Out"],
  ["Boards of Canada", "Roygbiv"],
  ["Have a Nice Life", "Bloodhail"],
  ["Sigur Rós", "Svefn-g-englar"],
  ["Portishead", "Roads"],
  ["Julien Baker", "Appointments"],
  ["Cocteau Twins", "Cherry-coloured Funk"],
  ["The Microphones", "The Glow"],
];

const HOUR_SHAPE = [
  2, 1, 1, 0, 0, 1, 2, 4, 6, 7, 8, 9, 10, 9, 8, 9, 11, 13, 16, 18, 17, 13, 8, 4,
];

function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(start + "T00:00:00Z");
  const stop = new Date(end + "T00:00:00Z");
  while (d < stop) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export type BuiltPeriod = {
  range: Range;
  summary: Summary;
  perDay: DayCount[];
  perHour: HourCount[];
  topArtists: ArtistCount[];
  topAlbums: AlbumCount[];
  topTracks: TrackCount[];
  discoveries: ArtistCount[];
  topTrack: TrackCount | null;
};

export function buildRange(start: string, end: string): BuiltPeriod {
  const rnd = mulberry32(hash(start + "|" + end));
  const days = eachDay(start, end);

  const perDay: DayCount[] = days.map((day) => {
    const dow = new Date(day + "T00:00:00Z").getUTCDay();
    const doy = Math.floor(
      (Date.parse(day + "T00:00:00Z") - Date.parse(day.slice(0, 4) + "-01-01T00:00:00Z")) /
        86400000,
    );
    const weekend = dow === 0 || dow === 6 ? 1.35 : 1;
    const season = 1 + 0.4 * Math.sin((doy / 365) * Math.PI * 2);
    let count = Math.round((14 + rnd() * 46) * weekend * season);
    if (rnd() < 0.06) count = 0;
    if (rnd() < 0.03) count += Math.round(80 + rnd() * 220);
    return { day, count };
  });

  const scrobbles = perDay.reduce((a, d) => a + d.count, 0);

  const hourSum = HOUR_SHAPE.reduce((a, b) => a + b, 0);
  const perHour: HourCount[] = HOUR_SHAPE.map((w, hour) => ({
    hour,
    count: Math.round((w / hourSum) * scrobbles),
  }));

  const mk = (base: number, spread: number, i: number) =>
    Math.max(1, Math.round(base - i * spread + (rnd() - 0.5) * spread));

  const topArtists: ArtistCount[] = ARTISTS.slice(0, 10)
    .map((name, i) => ({
      key: name.toLowerCase(),
      name,
      count: mk(scrobbles * 0.11, scrobbles * 0.008, i),
    }))
    .sort((a, b) => b.count - a.count);

  const topAlbums: AlbumCount[] = ALBUMS.map(([artist, album], i) => ({
    artist,
    album,
    count: mk(scrobbles * 0.05, scrobbles * 0.004, i),
    image: null,
  })).sort((a, b) => b.count - a.count);

  const topTracks: TrackCount[] = TRACKS.map(([artist, track], i) => ({
    artist,
    track,
    count: mk(scrobbles * 0.02, scrobbles * 0.0015, i),
  })).sort((a, b) => b.count - a.count);

  const discoveries: ArtistCount[] = ARTISTS.slice(6, 14)
    .map((name, i) => ({
      key: name.toLowerCase(),
      name,
      count: mk(scrobbles * 0.03, scrobbles * 0.003, i),
    }))
    .sort((a, b) => b.count - a.count);

  const summary: Summary = {
    scrobbles,
    artists: Math.min(ARTISTS.length * 10, Math.max(1, Math.round(scrobbles / 12))),
    tracks: Math.max(1, Math.round(scrobbles / 2.2)),
    estMs: scrobbles * FALLBACK_TRACK_MS,
  };

  return {
    range: { start, end },
    summary,
    perDay,
    perHour,
    topArtists,
    topAlbums,
    topTracks,
    discoveries,
    topTrack: topTracks[0] ?? null,
  };
}

/** Quelques scrobbles synthétiques pour la timeline d'une journée (mode fixtures). */
export function buildDayTimeline(date: string, count: number) {
  const rnd = mulberry32(hash("day|" + date));
  const n = Math.min(count, 40);
  const rows = Array.from({ length: n }, () => {
    const [artist, track] = TRACKS[Math.floor(rnd() * TRACKS.length)];
    const hour = HOUR_SHAPE.reduce((acc, w, h) => (rnd() < 0.15 ? h : acc), 20);
    const min = Math.floor(rnd() * 60);
    return {
      played_at: `${date}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`,
      artist,
      track,
      album: null as string | null,
      image_url: null as string | null,
    };
  });
  return rows.sort((a, b) => b.played_at.localeCompare(a.played_at));
}
