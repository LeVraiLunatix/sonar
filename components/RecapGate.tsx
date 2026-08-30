"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RecapRef } from "@/lib/recap";

const SEEN_PREFIX = "sonar:recap-seen:";

function seen(id: string): boolean {
  try {
    return localStorage.getItem(SEEN_PREFIX + id) === "1";
  } catch {
    return false;
  }
}
function markSeen(id: string) {
  try {
    localStorage.setItem(SEEN_PREFIX + id, "1");
  } catch {
    /* mode privé : tant pis, le bandeau réapparaîtra */
  }
}

/**
 * Bandeau « ta rétro est prête », affiché une seule fois par période close et
 * par appareil (persistance locale). Les rétros restent consultables à tout
 * moment via leur URL — ceci ne fait que la mettre en avant au bon moment.
 */
export default function RecapGate({ recaps }: { recaps: RecapRef[] }) {
  const [pick, setPick] = useState<RecapRef | null>(null);

  useEffect(() => {
    // priorité : année > mois > semaine (la plus « rare » d'abord)
    const order = { year: 0, month: 1, week: 2 } as const;
    const next = [...recaps]
      .sort((a, b) => order[a.kind] - order[b.kind])
      .find((r) => !seen(r.id));
    if (next) setPick(next);
  }, [recaps]);

  if (!pick) return null;

  const noun =
    pick.kind === "week" ? "ta semaine" : pick.kind === "month" ? "ton mois" : "ton année";

  return (
    <aside className="recap-gate" role="region" aria-label="Rétro disponible">
      <span className="recap-gate__spark" aria-hidden="true">
        ✦
      </span>
      <p className="recap-gate__text">
        <strong>{noun} en musique</strong> — {pick.label} est prête à défiler.
      </p>
      <Link
        href={pick.href}
        className="recap-gate__go"
        onClick={() => markSeen(pick.id)}
      >
        Lancer la rétro →
      </Link>
      <button
        className="recap-gate__close"
        onClick={() => {
          markSeen(pick.id);
          setPick(null);
        }}
        aria-label="Plus tard"
      >
        ✕
      </button>
    </aside>
  );
}
