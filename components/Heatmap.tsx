import type { DayCount } from "@/lib/stats";

/**
 * Heatmap année entière, façon contributions. Semaines en colonnes, jours en
 * lignes (lundi en haut). Intensité = nombre de scrobbles, en aplat rose
 * (le rose est réservé aux aplats/traits). Les jours à zéro restent visibles,
 * à peine encrés — eux aussi racontent quelque chose.
 */
export default function Heatmap({ days }: { days: DayCount[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));

  // Décalage pour que la 1re colonne commence le bon jour (lundi = 0).
  const first = days[0] ? new Date(days[0].day + "T00:00:00Z").getUTCDay() : 0;
  const pad = (first + 6) % 7;

  return (
    <div className="heat" role="img" aria-label="Carte de chaleur des écoutes sur l'année">
      {Array.from({ length: pad }).map((_, i) => (
        <i key={`pad-${i}`} style={{ opacity: 0, background: "transparent" }} />
      ))}
      {days.map((d) => {
        const t = d.count / max;
        // 0.06 pour un jour à zéro (visible mais discret) → 1 pour le pic
        const opacity = d.count === 0 ? 0.06 : 0.18 + t * 0.82;
        return <i key={d.day} title={`${d.day} — ${d.count}`} style={{ opacity }} />;
      })}
    </div>
  );
}
