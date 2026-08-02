"use client";

import { nf } from "@/lib/format";
import { useLive } from "@/lib/useLive";
import BigCount from "./BigCount";

/**
 * Réconcilie une agrégation SQL contenant aujourd'hui avec le compteur du jour
 * lu en direct chez Last.fm. L'écart disparaît naturellement après AutoSync.
 *
 * Le grand compteur anime dès le chargement vers la valeur connue à cet
 * instant. Si la réconciliation live arrive plus tard et change la cible,
 * BigCount glisse en douceur vers la nouvelle valeur au lieu de sauter —
 * jamais de vide ni de retour à 0 en cours de route.
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
