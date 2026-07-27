"use client";

import { useEffect, useRef } from "react";
import type { DayCount } from "@/lib/stats";

/**
 * Colonne vertébrale du site : une ligne d'amplitude continue, verticale,
 * qui court sur toute la hauteur de la page. La déformation horizontale = le
 * nombre de scrobbles du jour. Les jours à zéro sont des plats (sur l'axe).
 * Deux encres décalées → le recouvrement vire au violet (multiply).
 * Au chargement, elle se trace de la première écoute (haut) à la dernière (bas).
 */
export default function AmplitudeSpine({ days }: { days: DayCount[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pinkRef = useRef<SVGPathElement>(null);
  const blueRef = useRef<SVGPathElement>(null);
  const baseRef = useRef<SVGLineElement>(null);
  const drawn = useRef(false);

  useEffect(() => {
    const svg = svgRef.current;
    const pink = pinkRef.current;
    const blue = blueRef.current;
    const base = baseRef.current;
    if (!svg || !pink || !blue || !base || days.length === 0) return;

    const max = Math.max(1, ...days.map((d) => d.count));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function build(animate: boolean) {
      const w = svg!.clientWidth || 100;
      const h = svg!.clientHeight || 100;
      svg!.setAttribute("viewBox", `0 0 ${w} ${h}`);

      const baseX = 5; // axe de repos, collé à gauche
      const usable = w - baseX - 3;
      const n = days.length;

      let d = "";
      for (let i = 0; i < n; i++) {
        const y = n === 1 ? 0 : (i / (n - 1)) * h;
        const x = baseX + (days[i].count / max) * usable;
        d += (i === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2) + " ";
      }
      d = d.trim();
      pink!.setAttribute("d", d);
      blue!.setAttribute("d", d);
      base!.setAttribute("x1", String(baseX));
      base!.setAttribute("x2", String(baseX));
      base!.setAttribute("y1", "0");
      base!.setAttribute("y2", String(h));

      for (const p of [pink!, blue!]) {
        const len = p.getTotalLength();
        p.style.strokeDasharray = String(len);
        if (animate && !reduce) {
          p.classList.remove("is-drawing");
          p.style.strokeDashoffset = String(len);
          p.getBoundingClientRect(); // reflow
          p.classList.add("is-drawing");
          p.style.strokeDashoffset = "0";
        } else {
          p.classList.remove("is-drawing");
          p.style.strokeDashoffset = "0";
        }
      }
    }

    build(!drawn.current);
    drawn.current = true;

    // La hauteur dépend du contenu : on reconstruit (sans réanimer) si ça bouge.
    const ro = new ResizeObserver(() => build(false));
    ro.observe(svg);
    return () => ro.disconnect();
  }, [days]);

  return (
    <div className="spine" aria-hidden="true">
      <svg ref={svgRef} preserveAspectRatio="none">
        <line ref={baseRef} className="amp-base" />
        <path ref={pinkRef} className="amp-line amp-line--pink" transform="translate(2,0)" d="" />
        <path ref={blueRef} className="amp-line amp-line--blue" d="" />
      </svg>
    </div>
  );
}
