"use client";

import { useState } from "react";

/**
 * Réglage : mon profil est-il consultable par les autres comptes du site ?
 * Les scrobbles Last.fm sont déjà publics, mais chacun garde la main sur sa
 * présence dans la recherche de Sonar.
 */
export default function VisibilityToggle({ initial }: { initial: boolean }) {
  const [isPublic, setIsPublic] = useState(initial);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    const next = !isPublic;
    setPending(true);
    setIsPublic(next); // retour immédiat
    try {
      const res = await fetch("/api/profile/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public: next }),
      });
      if (!res.ok) setIsPublic(!next); // échec → on revient en arrière
    } catch {
      setIsPublic(!next);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="vis">
      <button
        type="button"
        className={`vis__btn${isPublic ? " is-on" : ""}`}
        onClick={toggle}
        disabled={pending}
        aria-pressed={isPublic}
      >
        <span className="vis__dot" aria-hidden="true" />
        {isPublic ? "profil consultable" : "profil masqué"}
      </button>
      <p className="note vis__note">
        {isPublic
          ? "Les autres comptes du site peuvent trouver ton pseudo et voir tes stats. Tes écoutes sont de toute façon déjà publiques sur Last.fm."
          : "Ton pseudo n’apparaît plus dans la recherche et ton profil n’est plus consultable ici."}
      </p>
    </div>
  );
}
