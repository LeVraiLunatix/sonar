"use client";

import { useEffect, useState } from "react";

type Now = {
  nowPlaying: { track: string; artist: string; album: string | null } | null;
  last: { track: string; artist: string; played_at: string } | null;
};

/** Indicateur « en écoute » : interroge /api/now au chargement puis toutes les 30 s. */
export default function NowPlaying() {
  const [data, setData] = useState<Now | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/now", { cache: "no-store" });
        const json = (await res.json()) as Now;
        if (alive) setData(json);
      } catch {
        /* silencieux */
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const np = data?.nowPlaying;

  return (
    <div className="np" aria-live="polite">
      {np ? (
        <>
          <span className="np__dot" aria-hidden="true" />
          <span className="np__label mono">en écoute</span>
          <span className="np__track">
            <span className="np__title">{np.track}</span>
            <span className="np__artist">{np.artist}</span>
          </span>
        </>
      ) : (
        <span className="np__idle mono">
          {data ? "rien en écoute en ce moment" : "…"}
        </span>
      )}
    </div>
  );
}
