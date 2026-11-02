import { hmacHex } from "./auth";
import { addDays, parisToday } from "./dates";
import { buildRange } from "./fixtures";
import type { DayCount } from "./stats";

/**
 * Clé de widget — capacité signée et personnelle : la posséder = pouvoir lire
 * le RÉSUMÉ des écoutes d'UN compte (7 derniers jours, en cours, tops), rien
 * d'autre. Sert aux tableaux de bord externes (Daycord) qui n'ont pas de
 * session Sonar. Pas d'expiration : on révoque toutes les clés en changeant
 * WIDGET_SECRET (sans toucher aux sessions, signées par AUTH_SECRET).
 *
 * Format : w1.<b64url(account)>.<sig hex>
 * sig = HMAC-SHA256(WIDGET_SECRET ?? AUTH_SECRET, "w1.<b64url(account)>")
 */

const secret = () => process.env.WIDGET_SECRET || process.env.AUTH_SECRET || "";

function b64urlEncode(s: string): string {
  return Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8");
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signWidgetKey(account: string): Promise<string | null> {
  const s = secret();
  if (!s) return null;
  const body = `w1.${b64urlEncode(account)}`;
  return `${body}.${await hmacHex(s, body)}`;
}

export async function verifyWidgetKey(key: string | null | undefined): Promise<string | null> {
  const s = secret();
  if (!key || !s) return null;
  const parts = key.split(".");
  if (parts.length !== 3 || parts[0] !== "w1") return null;
  const body = `w1.${parts[1]}`;
  if (!safeEqual(parts[2], await hmacHex(s, body))) return null;
  const account = b64urlDecode(parts[1]);
  return account || null;
}

export type WidgetData = {
  account: string;
  source: "fixtures" | "db";
  nowPlaying: { track: string; artist: string; image: string | null } | null;
  /** 7 jours glissants, aujourd'hui en dernier (dates locales Paris) */
  days: DayCount[];
  week: { scrobbles: number; prev: number; artists: number; minutes: number };
  topArtist: { name: string; count: number } | null;
  topTrack: { artist: string; track: string; count: number } | null;
  topAlbum: { artist: string; album: string; image: string | null; count: number } | null;
  total: number | null;
};

/** Le résumé lu par le widget. Sans base (dev, démo) : données fictives déterministes. */
export async function widgetData(account: string): Promise<Omit<WidgetData, "nowPlaying">> {
  const today = parisToday();
  const range = { start: addDays(today, -6), end: addDays(today, 1) };
  const prev = { start: addDays(today, -13), end: addDays(today, -6) };

  if (!process.env.DATABASE_URL) {
    const f = buildRange(range.start, range.end);
    const p = buildRange(prev.start, prev.end);
    return {
      account,
      source: "fixtures",
      days: f.perDay,
      week: {
        scrobbles: f.summary.scrobbles,
        prev: p.summary.scrobbles,
        artists: f.summary.artists,
        minutes: Math.round(f.summary.estMs / 60000),
      },
      topArtist: f.topArtists[0] ? { name: f.topArtists[0].name, count: f.topArtists[0].count } : null,
      topTrack: f.topTracks[0] ?? null,
      topAlbum: f.topAlbums[0] ?? null,
      total: 1369,
    };
  }

  const s = await import("./stats");
  const [summary, prevSummary, perDay, artists, tracks, albums, life] = await Promise.all([
    s.summary(account, range),
    s.summary(account, prev),
    s.perDay(account, range),
    s.topArtists(account, range, 1),
    s.topTracks(account, range, 1),
    s.topAlbums(account, range, 1),
    s.lifetime(account),
  ]);

  // perDay omet les jours sans écoute : on remet chaque jour, zéro compris.
  const byDay = new Map(perDay.map((d) => [d.day, d.count]));
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(range.start, i);
    return { day, count: byDay.get(day) ?? 0 };
  });

  return {
    account,
    source: "db",
    days,
    week: {
      scrobbles: summary.scrobbles,
      prev: prevSummary.scrobbles,
      artists: summary.artists,
      minutes: Math.round(summary.estMs / 60000),
    },
    topArtist: artists[0] ? { name: artists[0].name, count: artists[0].count } : null,
    topTrack: tracks[0] ?? null,
    topAlbum: albums[0] ?? null,
    total: life.total,
  };
}
