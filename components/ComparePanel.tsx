import type { CompareData } from "@/lib/period";
import { nf } from "@/lib/format";

/**
 * Le cœur du concept : deux périodes superposées. Pour chaque artiste, une
 * barre rose (période A) et une barre bleue (période B) partent du même bord et
 * se recouvrent en multiply → le violet mesure littéralement l'écoute commune.
 */
export default function ComparePanel({ data }: { data: CompareData }) {
  const max = Math.max(1, ...data.rows.map((r) => Math.max(r.a, r.b)));

  return (
    <ol className="ranks">
      {data.rows.map((r) => (
        <li className="rank" key={r.key} style={{ gridTemplateColumns: "minmax(6em, 12em) 1fr auto" }}>
          <span className="rank__name" style={{ maxWidth: "none" }}>{r.name}</span>
          <div className="rank__bar" style={{ height: "1.5rem" }}>
            <span
              className="rank__seg rank__seg--a"
              style={{ width: `${Math.min(100, (r.a / max) * 100)}%` }}
            />
            <span
              className="rank__seg rank__seg--b"
              style={{ width: `${Math.min(100, (r.b / max) * 100)}%` }}
            />
          </div>
          <span className="rank__val mono">
            {nf(r.a)} <span className="cmp__vs">/</span> {nf(r.b)}
          </span>
        </li>
      ))}
    </ol>
  );
}
