"use client";

import { nf } from "@/lib/format";
import { useLive } from "@/lib/useLive";

/**
 * Compteur du jour en direct. `initial` vient de la base (rendu serveur) et
 * reste affiché si l'API ne répond pas — on ne remplace que par une vraie valeur.
 */
export default function LiveToday({ initial }: { initial: number }) {
  const live = useLive();
  const value = typeof live?.todayCount === "number" ? Math.max(initial, live.todayCount) : initial;
  return <>{nf(value)}</>;
}
