import type { DayCount } from "./stats";

/** Plus longue série de jours consécutifs avec ≥ 1 scrobble. Pur, sans base. */
export function longestStreak(days: DayCount[]): number {
  let best = 0;
  let cur = 0;
  for (const d of days) {
    if (d.count > 0) {
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 0;
    }
  }
  return best;
}
