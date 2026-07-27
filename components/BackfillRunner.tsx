"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Progress = {
  status: "pending" | "running" | "done" | "error";
  page: number;
  pages: number | null;
  inserted?: number;
  done?: boolean;
  error?: string | null;
};

/**
 * Pilote l'import initial : appelle /api/backfill/run en boucle, chaque appel
 * traitant une tranche de pages. Affiche la progression jusqu'à l'import complet.
 * (Découpage nécessaire : une fonction serverless ne peut pas tourner longtemps.)
 */
export default function BackfillRunner({ username }: { username: string }) {
  const router = useRouter();
  const [p, setP] = useState<Progress>({ status: "pending", page: 0, pages: null });
  const [imported, setImported] = useState(0);
  const running = useRef(false);

  const step = useCallback(async (): Promise<boolean> => {
    const res = await fetch("/api/backfill/run", { method: "POST" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setP((prev) => ({ ...prev, status: "error", error: body.error ?? `HTTP ${res.status}` }));
      return true; // on arrête
    }
    const data = (await res.json()) as Progress;
    setP(data);
    setImported((n) => n + (data.inserted ?? 0));
    if (data.status === "error") return true;
    return !!data.done;
  }, []);

  useEffect(() => {
    if (running.current) return;
    running.current = true;

    let cancelled = false;
    (async () => {
      for (;;) {
        if (cancelled) return;
        let finished = false;
        try {
          finished = await step();
        } catch {
          setP((prev) => ({ ...prev, status: "error", error: "connexion interrompue" }));
          return;
        }
        if (finished) {
          if (!cancelled) {
            // laisse voir le 100 % une seconde, puis entre dans le site
            setTimeout(() => router.replace("/"), 1200);
          }
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step, router]);

  const pages = p.pages ?? 0;
  const pct = pages > 0 ? Math.min(100, Math.round((p.page / pages) * 100)) : 0;
  const failed = p.status === "error";

  return (
    <div className="onb">
      <p className="ann__label">
        {failed ? "import interrompu" : p.status === "done" ? "import terminé" : "import en cours"}
        {" · "}
        {username}
      </p>

      <span className="big">
        <span className="big__ghost" aria-hidden="true">{pct}%</span>
        <span className="big__ink">{pct}%</span>
      </span>

      <div className="onb__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span className="onb__fill" style={{ width: `${pct}%` }} />
      </div>

      <p className="prose" style={{ marginTop: "1.25rem" }}>
        {failed ? (
          <>L’import s’est arrêté : {p.error}. Recharge la page pour reprendre là où il en était.</>
        ) : p.status === "done" ? (
          <>Tout est là. Ouverture de ton archive…</>
        ) : (
          <>
            Sonar rapatrie tout ton historique Last.fm. C’est fait une seule fois,
            et l’import reprend tout seul s’il est interrompu.
          </>
        )}
      </p>

      <ul className="tallies" style={{ marginTop: "1.5rem" }}>
        <li style={{ display: "grid", gap: ".25em" }}>
          <span className="v">{imported.toLocaleString("fr-FR")}</span>
          <span className="k">scrobbles importés</span>
        </li>
        {pages > 0 && (
          <li style={{ display: "grid", gap: ".25em" }}>
            <span className="v">
              {p.page} / {pages}
            </span>
            <span className="k">pages traitées</span>
          </li>
        )}
      </ul>
    </div>
  );
}
