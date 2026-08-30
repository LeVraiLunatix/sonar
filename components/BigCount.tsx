"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { nf } from "@/lib/format";

/**
 * Grand chiffre en deux encres. Les DEUX couches (fantôme rose et encre)
 * affichent la même valeur à chaque image — sinon le décalage de calage
 * montre des chiffres différents pendant que le compteur monte.
 *
 * Un troisième calque invisible (.big__sizer) porte la valeur FINALE : il fixe
 * la largeur de la boîte (pas de saut de layout pendant la montée) et sert de
 * gabarit pour la mise à l'échelle anti-débordement — si le chiffre serait plus
 * large que son conteneur, on applique un scale() plutôt que de le laisser sortir.
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
  const sizerRef = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(value);
  const [fit, setFit] = useState(1);
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

  // Anti-débordement : mesure le gabarit (valeur finale) contre la largeur utile
  // du parent, applique un facteur d'échelle si besoin. Le cqi CSS gère le cas
  // courant ; ceci couvre les grands nombres et les conteneurs sans contexte cqi.
  useLayoutEffect(() => {
    const big = ref.current;
    const sizer = sizerRef.current;
    const parent = big?.parentElement;
    if (!big || !sizer || !parent) return;

    const measure = () => {
      const cs = getComputedStyle(parent);
      const pad =
        parseFloat(cs.paddingLeft || "0") + parseFloat(cs.paddingRight || "0");
      const avail = parent.clientWidth - pad;
      const natural = sizer.offsetWidth;
      if (natural > 0 && avail > 0) {
        setFit(Math.min(1, Math.round((avail / natural) * 1000) / 1000));
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [value, suffix]);

  const text = nf(n) + suffix;
  const finalText = nf(value) + suffix;

  return (
    <span
      className="big"
      ref={ref}
      style={fit < 1 ? ({ "--big-fit": fit } as React.CSSProperties) : undefined}
    >
      <span className="big__sizer" aria-hidden="true">
        {finalText}
      </span>
      <span className="big__ghost" aria-hidden="true">
        {text}
      </span>
      <span className="big__ink">{text}</span>
    </span>
  );
}
