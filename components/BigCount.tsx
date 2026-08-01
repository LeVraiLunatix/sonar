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
  const nRef = useRef(value);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Une valeur peut être réconciliée en direct après le premier rendu, y
    // compris pendant que le compteur d'entrée est encore en train de monter.
    // On glisse depuis le chiffre actuellement affiché vers la nouvelle
    // valeur au lieu de sauter dessus, sinon le compteur semble s'arrêter
    // en cours de route puis re-sauter plus loin.
    if (started.current) {
      if (reduced) {
        nRef.current = value;
        setN(value);
        return;
      }
      const from = nRef.current;
      const delta = value - from;
      if (delta === 0) return;

      let frame = 0;
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        const next = Math.round(from + delta * eased);
        nRef.current = next;
        setN(next);
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }
    if (reduced) {
      nRef.current = value;
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
          const next = Math.round(value * eased);
          nRef.current = next;
          setN(next);
          if (p < 1) frame = requestAnimationFrame(tick);
        };
        nRef.current = 0;
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
