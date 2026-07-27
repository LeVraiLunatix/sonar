import type { HourCount } from "@/lib/stats";

/**
 * Horloge d'écoute : 24 bandes polaires, une par heure locale, longueur =
 * nombre de scrobbles. Minuit en haut, midi en bas. Bleu en multiply.
 */
export default function Clock({ hours }: { hours: HourCount[] }) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const inner = 34;
  const outer = size / 2 - 10;
  const max = Math.max(1, ...hours.map((h) => h.count));

  return (
    <div className="clock">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Répartition des écoutes par heure">
        {hours.map((h) => {
          const angle = (h.hour / 24) * Math.PI * 2 - Math.PI / 2; // 0h en haut
          const r = inner + (h.count / max) * (outer - inner);
          const x1 = cx + Math.cos(angle) * inner;
          const y1 = cy + Math.sin(angle) * inner;
          const x2 = cx + Math.cos(angle) * r;
          const y2 = cy + Math.sin(angle) * r;
          return (
            <line
              key={h.hour}
              className="clock__bar"
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              strokeWidth={6}
              stroke="var(--blue)"
              strokeLinecap="round"
            />
          );
        })}
        {[0, 6, 12, 18].map((h) => {
          const angle = (h / 24) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(angle) * (outer + 6);
          const y = cy + Math.sin(angle) * (outer + 6);
          return (
            <text
              key={h}
              className="clock__tick"
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {String(h).padStart(2, "0")}h
            </text>
          );
        })}
      </svg>
    </div>
  );
}
