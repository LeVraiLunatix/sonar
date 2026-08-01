"use client";

import { nf } from "@/lib/format";
import { useLive } from "@/lib/useLive";
import BigCount from "./BigCount";

/**
 * Réconcilie une agrégation SQL contenant aujourd'hui avec le compteur du jour
 * lu en direct chez Last.fm. L'écart disparaît naturellement après AutoSync.
 */
export default function LivePeriodCount({
  initial,
  todayInitial,
  big = false,
}: {
  initial: number;
  todayInitial: number;
  big?: boolean;
}) {
  const live = useLive();
  const liveToday = typeof live?.todayCount === "number" ? live.todayCount : todayInitial;
  const value = initial + Math.max(0, liveToday - todayInitial);

  return big ? <BigCount value={value} /> : <>{nf(value)}</>;
}
