/** Formatage FR — espaces fines insécables pour les grands nombres. */

export function nf(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}

/** Durée lisible à partir de millisecondes : "12 h 40", "48 min". */
export function humanMs(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 1) return `${nf(h)} h ${String(m).padStart(2, "0")}`;
  return `${m} min`;
}

/** "12 mars 2021" */
export function frDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Nom de mois FR à partir de 1..12 */
export function frMonth(m: number): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(
    new Date(2000, m - 1, 1),
  );
}

/** clé jour ISO "YYYY-MM-DD" */
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Temps relatif court en français : "à l'instant", "12 min", "3 h", "hier", date. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const s = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (s < 60) return "à l’instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "hier";
  if (d < 7) return `il y a ${d} j`;
  return frDate(then);
}

/** Heure locale "14:07" (Europe/Paris). */
export function frTime(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}
