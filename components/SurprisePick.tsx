"use client";

import { useState } from "react";
import type { TrackRecommendation } from "@/lib/recommendations";

export default function SurprisePick({ tracks }: { tracks: TrackRecommendation[] }) {
  const [index, setIndex] = useState(-1);
  const [spinning, setSpinning] = useState(false);
  const picked = index >= 0 ? tracks[index] : null;

  function pick() {
    if (tracks.length === 0 || spinning) return;
    setSpinning(true);
    const next =
      tracks.length === 1
        ? 0
        : (index + 1 + Math.floor(Math.random() * (tracks.length - 1))) % tracks.length;
    window.setTimeout(() => {
      setIndex(next);
      setSpinning(false);
    }, 420);
  }

  if (tracks.length === 0) {
    return <p className="note">La pioche se remplira avec les prochaines recommandations.</p>;
  }

  return (
    <div className="pick">
      <button
        type="button"
        className={`pick__button${spinning ? " is-spinning" : ""}`}
        onClick={pick}
        disabled={spinning}
      >
        <span aria-hidden="true">↻</span>
        {picked ? "repiocher" : "piocher un titre"}
      </button>
      <div className="pick__result" aria-live="polite" aria-busy={spinning}>
        {spinning ? (
          <span className="pick__waiting mono">le radar tourne…</span>
        ) : picked ? (
          <a href={picked.url} target="_blank" rel="noopener noreferrer">
            <strong>{picked.track}</strong>
            <span>{picked.artist}</span>
            <small>
              {picked.becauseTrack
                ? `parce que vous avez écouté « ${picked.becauseTrack} »`
                : `parce que vous avez écouté ${picked.artist}`}
            </small>
          </a>
        ) : (
          <span className="note">un titre inexploré, choisi dans tes recommandations du moment.</span>
        )}
      </div>
    </div>
  );
}
