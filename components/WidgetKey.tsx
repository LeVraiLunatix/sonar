"use client";

import { useState } from "react";

/**
 * Réglage : la clé qui laisse un tableau de bord externe (Daycord) lire le
 * résumé de mes écoutes. Elle n'est montrée qu'à la demande, puis copiée.
 */
export default function WidgetKey() {
  const [key, setKey] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle");

  async function reveal() {
    setState("loading");
    try {
      const res = await fetch("/api/widget/key", { method: "POST" });
      if (!res.ok) throw new Error();
      const { key: k } = (await res.json()) as { key: string };
      setKey(k);
      await navigator.clipboard?.writeText(k).catch(() => {});
      setState("copied");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="vis">
      <button type="button" className="vis__btn" onClick={reveal} disabled={state === "loading"}>
        <span className="vis__dot" aria-hidden="true" />
        {state === "copied" ? "clé copiée" : "copier la clé daycord"}
      </button>
      {key && (
        <input
          className="srch__input mono"
          readOnly
          value={key}
          aria-label="Clé de widget"
          onFocus={(e) => e.currentTarget.select()}
          style={{ marginTop: "0.75rem", width: "100%", fontSize: "0.8rem" }}
        />
      )}
      <p className="note vis__note" aria-live="polite">
        {state === "error"
          ? "Impossible de créer la clé pour l’instant."
          : "Colle-la dans Daycord (Réglages → Sonar) pour voir tes écoutes sur ta page d’accueil. Elle ne donne accès qu’au résumé de la semaine, rien d’autre."}
      </p>
    </div>
  );
}
