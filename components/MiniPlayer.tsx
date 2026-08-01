"use client";

import Link from "next/link";
import { useState } from "react";
import { timeAgo } from "@/lib/format";
import { parisToday } from "@/lib/dates";
import {
  useLive,
  setLovedOptimistic,
  rollbackLovedOptimistic,
  refreshLive,
} from "@/lib/useLive";

/** Page Last.fm d'un titre (pas d'URL dans la réponse : on la reconstruit). */
function lastfmUrl(artist: string, track: string) {
  const e = (s: string) => encodeURIComponent(s).replace(/%20/g, "+");
  return `https://www.last.fm/music/${e(artist)}/_/${e(track)}`;
}

/**
 * Mini-lecteur flottant, silhouette façon Apple Music : pilule arrondie,
 * pochette, titre/artiste, actions à droite. Mobile ET PC.
 *
 * ⚠️ Sonar ne pilote pas la lecture : Last.fm journalise les écoutes, il ne
 * commande aucun lecteur — pause/suivant sont impossibles, pas juste absents.
 * En revanche « j'aime » est une vraie écriture Last.fm, donc le bouton agit
 * réellement.
 */
export default function MiniPlayer() {
  const live = useLive();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const np = live?.nowPlaying;
  const last = live?.recent?.[0];
  const title = np?.track ?? last?.track;
  const artist = np?.artist ?? last?.artist;

  if (!title || !artist) return null;

  const art = np?.image_url ?? last?.image_url ?? null;
  const isLive = !!np;
  const loved = !!np?.loved;

  async function toggleLove() {
    if (!np || pending) return;
    const next = !loved;
    setPending(true);
    setNotice(null);
    setLovedOptimistic(next); // retour visuel immédiat
    try {
      const res = await fetch("/api/love", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist: np.artist, track: np.track, love: next }),
      });
      if (res.ok) {
        refreshLive();
      } else {
        rollbackLovedOptimistic(!next); // échec → on remet l'état d'avant
        // 409 : session ouverte avant que Sonar ne conserve la clé d'écriture
        setNotice(
          res.status === 409
            ? "reconnecte-toi pour pouvoir aimer"
            : "impossible d’enregistrer pour l’instant",
        );
        setTimeout(() => setNotice(null), 5000);
      }
    } catch {
      rollbackLovedOptimistic(!next);
      setNotice("connexion interrompue");
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mp" role="status" aria-live="polite">
      <div className="mp__pill">
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="mp__art" src={art} alt="" width={44} height={44} />
        ) : (
          <span className="mp__art mp__art--placeholder" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="26" height="26">
              <circle cx="24" cy="24" r="15" fill="none" stroke="var(--blue)" strokeWidth="3.4" />
              <circle cx="24" cy="24" r="8.6" fill="none" stroke="var(--pink)" strokeWidth="3.4" />
              <circle cx="24" cy="24" r="3.4" fill="var(--ink)" />
            </svg>
          </span>
        )}

        <Link className="mp__text" href={`/day/${parisToday()}`}>
          <span className="mp__title">{title}</span>
          <span className="mp__sub">
            {notice ? (
              <span className="mp__notice">{notice}</span>
            ) : (
              <>
                {isLive && <span className="mp__dot" aria-hidden="true" />}
                <span className="mp__artist">{artist}</span>
                {!isLive && last && (
                  <span className="mp__ago">· {timeAgo(last.played_at)}</span>
                )}
              </>
            )}
          </span>
        </Link>

        {isLive && (
          <button
            type="button"
            className={`mp__action mp__love${loved ? " is-loved" : ""}`}
            onClick={toggleLove}
            disabled={pending}
            aria-pressed={loved}
            aria-label={loved ? "Retirer des titres aimés" : "Ajouter aux titres aimés"}
            title={loved ? "Retirer des titres aimés" : "J’aime"}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M12 20.4 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 0 1 19.4 13Z"
                fill={loved ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        <a
          className="mp__action"
          href={lastfmUrl(artist, title)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ouvrir « ${title} » sur Last.fm`}
          title="Ouvrir sur Last.fm"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M7 17 17 7M17 7h-7M17 7v7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>
    </div>
  );
}
