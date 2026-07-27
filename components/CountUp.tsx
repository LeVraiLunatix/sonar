"use client";

import { useEffect, useRef, useState } from "react";
import { nf } from "@/lib/format";

/**
 * Compteur qui s'incrémente jusqu'à sa valeur quand il entre dans le champ.
 * Cohérent avec le sujet : un scrobble, c'est un compteur qui monte.
 * Affiche directement la valeur finale si prefers-reduced-motion.
 */
export default function CountUp({
  value,
  duration = 1100,
  suffix = "",
}: {
  value: number;
  duration?: number;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(value);
      return;
    }

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting || started.current) continue;
        started.current = true;
        io.disconnect();

        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / duration);
          // easing doux en fin de course
          const eased = 1 - Math.pow(1 - p, 3);
          setN(Math.round(value * eased));
          if (p < 1) requestAnimationFrame(tick);
        };
        setN(0);
        requestAnimationFrame(tick);
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref}>
      {nf(n)}
      {suffix}
    </span>
  );
}
