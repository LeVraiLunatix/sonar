"use client";

import { useEffect, useRef } from "react";
import type { DayCount } from "@/lib/stats";

/**
 * Variante horizontale de la ligne d'amplitude, pour le dashboard.
 * x = jour, y = scrobbles. Deux encres décalées → violet au recouvrement.
 * Se trace de gauche à droite au chargement (respecte prefers-reduced-motion).
 */
export default function AmplitudeStrip({ days }: { days: DayCount[] }) {
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
      const w = svg!.clientWidth || 600;
      const h = svg!.clientHeight || 120;
      svg!.setAttribute("viewBox", `0 0 ${w} ${h}`);
      const baseY = h - 4;
      const usable = baseY - 4;
      const n = days.length;
      let d = "";
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 0 : (i / (n - 1)) * w;
        const y = baseY - (days[i].count / max) * usable;
        d += (i === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2) + " ";
      }
      d = d.trim();
      pink!.setAttribute("d", d);
      blue!.setAttribute("d", d);
      base!.setAttribute("x1", "0");
      base!.setAttribute("x2", String(w));
      base!.setAttribute("y1", String(baseY));
      base!.setAttribute("y2", String(baseY));

      for (const p of [pink!, blue!]) {
        const len = p.getTotalLength();
        p.style.strokeDasharray = String(len);
        if (animate && !reduce) {
          p.classList.remove("is-drawing");
          p.style.strokeDashoffset = String(len);
          p.getBoundingClientRect();
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
    const ro = new ResizeObserver(() => build(false));
    ro.observe(svg);
    return () => ro.disconnect();
  }, [days]);

  return (
    <div className="strip" aria-hidden="true">
      <svg ref={svgRef} preserveAspectRatio="none">
        <line ref={baseRef} className="amp-base" />
        <path ref={pinkRef} className="amp-line amp-line--pink" transform="translate(0,2)" d="" />
        <path ref={blueRef} className="amp-line amp-line--blue" d="" />
      </svg>
    </div>
  );
}
