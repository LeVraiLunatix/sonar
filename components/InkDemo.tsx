"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Démonstration jouable de la surimpression : deux encres, une par période.
 * Là où elles se recouvrent, une troisième couleur apparaît — le violet n'est
 * jamais dessiné, il naît du multiply. C'est le mécanisme de comparaison du
 * site, expliqué en le manipulant.
 */
export default function InkDemo() {
  const [b, setB] = useState(58);
  const touched = useRef(false);

  // Va-et-vient discret tant que personne n'a touché au curseur.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (t: number) => {
      if (touched.current) return;
      const phase = (t - t0) / 2600;
      setB(58 + Math.sin(phase) * 26);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const a = 72;
  const overlap = Math.round(Math.min(a, b));

  return (
    <div className="inkdemo">
      <div className="inkdemo__stage">
        <span className="inkdemo__bar inkdemo__bar--a" style={{ width: `${a}%` }} />
        <span className="inkdemo__bar inkdemo__bar--b" style={{ width: `${b}%` }} />
      </div>

      <div className="inkdemo__legend">
        <span className="inkdemo__key inkdemo__key--a">cette année</span>
        <span className="inkdemo__key inkdemo__key--b">l’an dernier</span>
        <span className="inkdemo__key inkdemo__key--x">
          recouvrement · {overlap}
        </span>
      </div>

      <label className="inkdemo__control">
        <span className="k">fais glisser la seconde encre</span>
        <input
          type="range"
          min={5}
          max={100}
          value={Math.round(b)}
          onChange={(e) => {
            touched.current = true;
            setB(Number(e.target.value));
          }}
          aria-label="Largeur de la seconde encre"
        />
      </label>
    </div>
  );
}
