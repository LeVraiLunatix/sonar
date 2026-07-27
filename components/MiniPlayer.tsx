"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/format";

type Now = {
  nowPlaying: { track: string; artist: string; album: string | null; image_url: string | null } | null;
  last: { track: string; artist: string; played_at: string } | null;
};

/**
 * Mini-lecteur persistant (mobile) façon Apple Music : toujours en bas, montre
 * le morceau en cours (ou le dernier écouté). Interroge /api/now toutes les 30 s.
 * Purement informatif (pas de contrôle de lecture). Masqué en desktop via CSS.
 */
export default function MiniPlayer() {
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
  const last = data?.last;
  const title = np?.track ?? last?.track;
  const artist = np?.artist ?? last?.artist;

  // Rien à montrer tant qu'on n'a aucune donnée.
  if (!title || !artist) return null;

  const art = np?.image_url ?? null;

  return (
    <Link href="/" className="miniplayer" role="status" aria-live="polite">
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="miniplayer__art" src={art} alt="" width={44} height={44} />
      ) : (
        <span className="miniplayer__mark" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="26" height="26">
            <circle cx="24" cy="24" r="15" fill="none" stroke="var(--blue)" strokeWidth="3.4" />
            <circle cx="24" cy="24" r="8.6" fill="none" stroke="var(--pink)" strokeWidth="3.4" />
            <circle cx="24" cy="24" r="3.4" fill="var(--ink)" />
          </svg>
        </span>
      )}

      <span className="miniplayer__track">
        <span className="miniplayer__title">{title}</span>
        <span className="miniplayer__artist">{artist}</span>
      </span>

      <span className="miniplayer__status mono">
        {np ? (
          <>
            <span className="miniplayer__dot" aria-hidden="true" />
            en écoute
          </>
        ) : last ? (
          timeAgo(last.played_at)
        ) : null}
      </span>
    </Link>
  );
}
