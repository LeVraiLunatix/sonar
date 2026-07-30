"use client";

import { useEffect, useRef } from "react";

/**
 * Courbe de vie d'un artiste : une écoute par mois, en deux encres décalées
 * (le violet naît du recouvrement). Même langage visuel que la ligne
 * d'amplitude du site, en plus compact.
 */
export default function ArtistSpark({
  months,
}: {
  months: { month: string; count: number }[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pinkRef = useRef<SVGPathElement>(null);
  const blueRef = useRef<SVGPathElement>(null);
  const drawn = useRef(false);

  useEffect(() => {
    const svg = svgRef.current;
    const pink = pinkRef.current;
    const blue = blueRef.current;
    if (!svg || !pink || !blue || months.length === 0) return;

    const max = Math.max(1, ...months.map((m) => m.count));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function build(animate: boolean) {
      const w = svg!.clientWidth || 600;
      const h = svg!.clientHeight || 90;
      svg!.setAttribute("viewBox", `0 0 ${w} ${h}`);
      const baseY = h - 2;
      const n = months.length;
      let d = "";
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? w / 2 : (i / (n - 1)) * w;
        const y = baseY - (months[i].count / max) * (baseY - 4);
        d += (i === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2) + " ";
      }
      d = d.trim();
      pink!.setAttribute("d", d);
      blue!.setAttribute("d", d);

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
  }, [months]);

  return (
    <div className="spark" aria-hidden="true">
      <svg ref={svgRef} preserveAspectRatio="none">
        <path ref={pinkRef} className="amp-line amp-line--pink" transform="translate(0,2)" d="" />
        <path ref={blueRef} className="amp-line amp-line--blue" d="" />
      </svg>
    </div>
  );
}
