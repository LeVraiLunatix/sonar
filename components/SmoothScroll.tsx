"use client";

import { useEffect } from "react";

/**
 * Défilement doux à inertie, façon « scroll lissé » — uniquement sur PC.
 *
 * Principe : on intercepte la molette, on garde une position CIBLE, et à
 * chaque image la position RÉELLE se rapproche de la cible d'une fraction.
 * Le mouvement devient continu au lieu de sauter cran par cran.
 *
 * Choix volontaires :
 * - on déplace la vraie page (`window.scrollTo`) et non un conteneur
 *   transformé : les éléments en `position: fixed` (mini-lecteur), la barre
 *   de défilement native et les ancres continuent de fonctionner ;
 * - désactivé sur écran tactile et si le système demande moins d'animations ;
 * - une zone interne défilante (carte de l'année…) garde son défilement natif ;
 * - barre de défilement, clavier, ancres : on se recale automatiquement.
 */

/** Douceur : plus la valeur est basse, plus le mouvement est long et doux. */
const EASE = 0.095;
/** Sensibilité de la molette (1 = distance native). */
const SENSITIVITY = 1;

export default function SmoothScroll() {
  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Tactile ou « moins d'animations » → on laisse le défilement natif.
    if (!finePointer.matches || reduced.matches) return;

    let target = window.scrollY;
    let current = target;
    let rafId = 0;
    let running = false;
    let last = 0;

    const maxScroll = () =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const clamp = (v: number) => Math.min(Math.max(v, 0), maxScroll());

    /** Un ancêtre peut-il absorber ce défilement (zone à débordement) ? */
    function absorbedByInner(node: EventTarget | null, dy: number): boolean {
      let el = node instanceof Element ? (node as HTMLElement) : null;
      while (el && el !== document.body && el !== document.documentElement) {
        const oy = getComputedStyle(el).overflowY;
        if (
          (oy === "auto" || oy === "scroll") &&
          el.scrollHeight > el.clientHeight + 1
        ) {
          const atTop = el.scrollTop <= 0;
          const atBottom =
            el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
          // il reste de la marge dans la direction demandée → il gère
          if (!((dy < 0 && atTop) || (dy > 0 && atBottom))) return true;
        }
        el = el.parentElement;
      }
      return false;
    }

    const frame = (now: number) => {
      const dt = Math.min(64, now - last || 16.7);
      last = now;

      const diff = target - current;
      if (Math.abs(diff) < 0.5) {
        current = target;
        window.scrollTo(0, current);
        running = false;
        return;
      }

      // Lissage exponentiel indépendant du taux de rafraîchissement :
      // même douceur en 60 Hz et en 120 Hz.
      const f = 1 - Math.pow(1 - EASE, dt / 16.7);
      current += diff * f;
      window.scrollTo(0, current);
      rafId = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running) return;
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.defaultPrevented) return; // zoom navigateur
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // geste horizontal
      if (absorbedByInner(e.target, e.deltaY)) return; // zone interne

      e.preventDefault();
      const unit =
        e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      target = clamp(target + e.deltaY * unit * SENSITIVITY);
      start();
    };

    /**
     * Défilement venu d'ailleurs (glissement de la barre, clavier, ancre,
     * focus…) : la position réelle s'écarte de la nôtre, on se recale.
     * Nos propres `scrollTo` ne déclenchent pas ce recalage car l'écart
     * reste inférieur au seuil.
     */
    const onScroll = () => {
      if (Math.abs(window.scrollY - current) > 2) {
        current = window.scrollY;
        target = current;
      }
    };

    const onResize = () => {
      target = clamp(target);
      current = clamp(current);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return null;
}
