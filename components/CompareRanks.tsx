import type { ArtistCount } from "@/lib/stats";
import { nf } from "@/lib/format";

/**
 * Classement d'artistes où la surimpression EST la comparaison :
 *  - barre rose pleine   = écoutes de cette année
 *  - barre bleue fine    = écoutes de l'an dernier (même artiste)
 * Les deux sont en multiply → là où elles se recouvrent, du violet apparaît.
 * On ne code jamais le violet : il naît du chevauchement.
 */
export default function CompareRanks({
  artists,
  prev,
}: {
  artists: ArtistCount[];
  prev: Record<string, number>;
}) {
  // L'échelle tient compte des DEUX périodes : sinon un artiste très écouté
  // avant (barre bleue) dépasserait 100 % et déborderait de l'écran.
  const max = Math.max(
    1,
    ...artists.map((a) => Math.max(a.count, prev[a.key] ?? 0)),
  );
  return (
    <ol className="ranks">
      {artists.map((a, i) => {
        const now = Math.min(100, (a.count / max) * 100);
        const before = Math.min(100, ((prev[a.key] ?? 0) / max) * 100);
        return (
          <li className="rank" key={a.key}>
            <span className="rank__n mono">{String(i + 1).padStart(2, "0")}</span>
            <span className="rank__name">{a.name}</span>
            <div className="rank__bar">
              <span className="rank__seg rank__seg--now" style={{ width: `${now}%` }} />
              <span className="rank__seg rank__seg--prev" style={{ width: `${before}%` }} />
            </div>
            <span className="rank__val">{nf(a.count)}</span>
          </li>
        );
      })}
    </ol>
  );
}
