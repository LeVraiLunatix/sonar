import type { ScrobbleRow } from "@/lib/stats";
import { timeAgo } from "@/lib/format";

/** Derniers scrobbles, ton archive : titre, artiste, temps relatif. */
export default function RecentList({ rows }: { rows: ScrobbleRow[] }) {
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
