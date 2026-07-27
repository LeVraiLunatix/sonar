import type { Range } from "./stats";
import { APP_TZ } from "./constants";
import { frDate, frMonth } from "./format";

/**
 * Toutes les plages sont des chaînes de dates locales 'YYYY-MM-DD' (fin exclusive).
 * lib/stats les convertit en timestamptz via `date at time zone Europe/Paris`,
 * ce qui cale les journées sur minuit à Paris (piège UTC de la section 5).
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Ajoute n jours à une date 'YYYY-MM-DD' (via UTC midi, insensible au DST). */
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Date du jour à Paris, 'YYYY-MM-DD'. */
export function parisToday(): string {
  // en-CA formate en ISO YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// ── Jour ──
export function dayRange(date: string): Range {
  return { start: date, end: addDays(date, 1) };
}
export function prevDay(date: string): string {
  return addDays(date, -1);
}
export function nextDay(date: string): string {
  return addDays(date, 1);
}

// ── Mois ──
export function monthRange(year: number, month: number): Range {
  const start = `${year}-${pad(month)}-01`;
  const end = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
  return { start, end };
}

// ── Année ──
export function yearRange(year: number): Range {
  return { start: `${year}-01-01`, end: `${year + 1}-01-01` };
}

// ── Semaine ISO ──
/** Lundi de la semaine ISO (year, week) → 'YYYY-MM-DD'. */
function isoWeekMonday(year: number, week: number): string {
  // Le 4 janvier est toujours en semaine 1 (norme ISO-8601).
  const jan4 = new Date(Date.UTC(year, 0, 4, 12));
  const dow = (jan4.getUTCDay() + 6) % 7; // 0 = lundi
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - dow);
  week1Monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return week1Monday.toISOString().slice(0, 10);
}
export function weekRange(year: number, week: number): Range {
  const monday = isoWeekMonday(year, week);
  return { start: monday, end: addDays(monday, 7) };
}
/** {year, week} ISO d'une date 'YYYY-MM-DD'. */
export function isoWeekOf(date: string): { year: number; week: number } {
  const d = new Date(date + "T12:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3); // jeudi de cette semaine
  const thursday = d.getTime();
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4, 12));
  const ftDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ftDay + 3);
  const week = 1 + Math.round((thursday - firstThursday.getTime()) / (7 * 86400000));
  return { year: d.getUTCFullYear(), week };
}

/** Période précédente de même longueur (pour la comparaison en surimpression). */
export function prevRangeOf(r: Range, kind: PeriodKind): Range {
  switch (kind) {
    case "day":
      return { start: addDays(r.start, -1), end: r.start };
    case "week":
      return { start: addDays(r.start, -7), end: r.start };
    case "month": {
      const [y, m] = r.start.split("-").map(Number);
      return monthRange(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1);
    }
    case "year": {
      const y = Number(r.start.slice(0, 4));
      return yearRange(y - 1);
    }
  }
}

export type PeriodKind = "day" | "week" | "month" | "year";

// ── Libellés ──
export function periodLabel(r: Range, kind: PeriodKind): string {
  switch (kind) {
    case "day":
      return frDate(r.start + "T12:00:00Z");
    case "week": {
      const { year, week } = isoWeekOf(r.start);
      return `semaine ${week} · ${year}`;
    }
    case "month": {
      const [y, m] = r.start.split("-").map(Number);
      return `${frMonth(m)} ${y}`;
    }
    case "year":
      return r.start.slice(0, 4);
  }
}
