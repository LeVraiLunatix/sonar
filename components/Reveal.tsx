"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Révèle un bloc quand il entre dans le champ : l'encre « se pose » (léger
 * décalage + montée en opacité), comme une feuille qui passe sous la presse.
 * Ne s'anime qu'une fois, et pas du tout si prefers-reduced-motion.
 */
export default function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  as?: "div" | "section" | "li" | "p";
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Pas d'animation demandée, ou observateur indisponible → on montre tout de suite.
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    io.observe(el);

    /* Filet de sécurité : l'animation est un bonus, pas une condition
       d'affichage. Si l'observateur ne se déclenche pas (onglet non rendu,
       cas limite du navigateur…), le contenu apparaît quand même — il ne doit
       jamais rester invisible. */
    const fallback = window.setTimeout(() => {
      setShown(true);
      io.disconnect();
    }, 1500);

    return () => {
      window.clearTimeout(fallback);
      io.disconnect();
    };
  }, []);

  return (
    <Tag
      // @ts-expect-error — ref polymorphe volontaire
      ref={ref}
      className={`reveal ${shown ? "is-in" : ""} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
