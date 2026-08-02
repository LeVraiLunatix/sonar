"use client";

import { useMemo, useRef, useState } from "react";
import type { TrackRecommendation } from "@/lib/recommendations";

const STORAGE_KEY = "sonar-surprise-pick-v2";

const trackKey = (track: TrackRecommendation) =>
  `${track.artist.trim().toLocaleLowerCase("fr-FR")}\u001f${track.track.trim().toLocaleLowerCase("fr-FR")}`;

function shuffle(values: number[]): number[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export default function SurprisePick({ tracks }: { tracks: TrackRecommendation[] }) {
  const pool = useMemo(() => {
    const seen = new Set<string>();
    return tracks.filter((track) => {
      const key = trackKey(track);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [tracks]);
  const [index, setIndex] = useState(-1);
  const [spinning, setSpinning] = useState(false);
  const queue = useRef<number[]>([]);
  const cycle = useRef<Set<string> | null>(null);
  const picked = index >= 0 ? pool[index] : null;

  function savedCycle(): Set<string> {
    if (cycle.current) return cycle.current;
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      cycle.current = new Set(Array.isArray(saved) ? saved.filter((key): key is string => typeof key === "string") : []);
    } catch {
      cycle.current = new Set();
    }
    return cycle.current;
  }

  function nextIndex(): number {
    const used = savedCycle();
    if (queue.current.length === 0) {
      const unseen = pool
        .map((track, trackIndex) => ({ key: trackKey(track), trackIndex }))
        .filter((item) => !used.has(item.key) && item.trackIndex !== index)
        .map((item) => item.trackIndex);
      if (unseen.length === 0) {
        used.clear();
        if (index >= 0) used.add(trackKey(pool[index]));
      }
      const candidates = unseen.length > 0
        ? unseen
        : pool.map((_, trackIndex) => trackIndex).filter((trackIndex) => trackIndex !== index);
      queue.current = shuffle(candidates);
    }
    return queue.current.shift() ?? Math.max(0, index);
  }

  function pick() {
    if (pool.length === 0 || spinning) return;
    setSpinning(true);
    const next = pool.length === 1 ? 0 : nextIndex();
    window.setTimeout(() => {
      setIndex(next);
      const used = savedCycle();
      used.add(trackKey(pool[next]));
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...used]));
      } catch {
        // La pioche continue en mémoire si le stockage privé est indisponible.
      }
      setSpinning(false);
    }, 420);
  }

  if (pool.length === 0) {
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
