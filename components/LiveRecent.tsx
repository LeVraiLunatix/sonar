"use client";

import type { ScrobbleRow } from "@/lib/stats";
import { timeAgo } from "@/lib/format";
import { useLive } from "@/lib/useLive";

/**
 * Derniers scrobbles lus en direct chez Last.fm.
 * Les valeurs de la base (rendues côté serveur) servent de point de départ :
 * si l'API ne répond pas, la liste reste affichée au lieu de disparaître.
 */
export default function LiveRecent({ initial }: { initial: ScrobbleRow[] }) {
  const live = useLive();
  const rows = live?.recent?.length ? live.recent : initial;

  if (rows.length === 0) {
    return <p className="prose">Aucun scrobble pour l’instant.</p>;
  }

  return (
    <ul className="recent">
      {rows.map((r, i) => (
        <li className="recent__row" key={`${r.played_at}-${i}`}>
          <span className="recent__track">
            <span className="recent__title">{r.track}</span>
            <span className="recent__artist">{r.artist}</span>
          </span>
          <span className="recent__when mono">{timeAgo(r.played_at)}</span>
        </li>
      ))}
    </ul>
  );
}
