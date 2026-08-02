"use client";

import { useEffect, useState } from "react";
import { nf } from "@/lib/format";
import { useLive } from "@/lib/useLive";
import BigCount from "./BigCount";

// Délai maximum qu'on patiente pour la réconciliation live avant d'afficher
// quand même le compteur (API lente ou hors-ligne) plutôt que de rester vide.
const LIVE_GRACE_MS = 1500;

/**
 * Réconcilie une agrégation SQL contenant aujourd'hui avec le compteur du jour
 * lu en direct chez Last.fm. L'écart disparaît naturellement après AutoSync.
 *
 * Le grand compteur (big) n'apparaît qu'une fois cette réconciliation connue
 * (ou le délai ci-dessus dépassé) : sinon son animation d'entrée démarre sur
 * une valeur provisoire, se termine, puis reprend en cours de route dès que
 * le direct arrive — un palier visible au milieu de la montée.
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

  const [settled, setSettled] = useState(live !== null);
  useEffect(() => {
    if (live !== null) {
      setSettled(true);
      return;
    }
    const t = setTimeout(() => setSettled(true), LIVE_GRACE_MS);
    return () => clearTimeout(t);
  }, [live]);

  if (!big) return <>{nf(value)}</>;
  if (!settled) {
    return (
      <span className="big" aria-hidden="true">
        <span className="big__ghost" />
        <span className="big__ink" />
      </span>
    );
  }

  return <BigCount value={value} />;
}
