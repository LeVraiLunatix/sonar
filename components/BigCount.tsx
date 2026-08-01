"use client";

import { useEffect, useRef, useState } from "react";
import { nf } from "@/lib/format";

/**
 * Grand chiffre en deux encres. Les DEUX couches (fantôme rose et encre)
 * affichent la même valeur à chaque image — sinon le décalage de calage
 * montre des chiffres différents pendant que le compteur monte.
 */
export default function BigCount({
  value,
  suffix = "",
  duration = 1100,
}: {
  value: number;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Une valeur peut être réconciliée en direct après le premier rendu.
    // L'animation d'entrée ne se rejoue pas, mais le chiffre doit se mettre à jour.
    if (started.current) {
      setN(value);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(value);
      return;
    }

    let frame = 0;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting || started.current) continue;
        started.current = true;
        io.disconnect();

        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setN(Math.round(value * eased));
          if (p < 1) frame = requestAnimationFrame(tick);
        };
        setN(0);
        frame = requestAnimationFrame(tick);
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  const text = nf(n) + suffix;

  return (
    <span className="big" ref={ref}>
      <span className="big__ghost" aria-hidden="true">
        {text}
      </span>
      <span className="big__ink">{text}</span>
    </span>
  );
}
