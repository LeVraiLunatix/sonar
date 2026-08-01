"use client";

import { useEffect, useState } from "react";

export type LiveScrobble = {
  played_at: string;
  track: string;
  artist: string;
  album: string | null;
  image_url: string | null;
};

export type LiveData = {
  nowPlaying: {
    track: string;
    artist: string;
    album: string | null;
    image_url: string | null;
    loved: boolean;
  } | null;
  recent: LiveScrobble[];
  todayCount: number | null;
};

/**
 * Source « temps réel » partagée (/api/live).
 *
 * Plusieurs composants en ont besoin en même temps — mini-lecteur, derniers
 * scrobbles, compteur du jour. Un état au niveau du module garantit UN SEUL
 * appel réseau pour tout le monde, au lieu d'un par composant.
 */
let data: LiveData | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;
type LovedOverride = {
  artist: string;
  track: string;
  loved: boolean;
  expiresAt: number;
};
let lovedOverride: LovedOverride | null = null;
const subscribers = new Set<(d: LiveData | null) => void>();

const emit = () => subscribers.forEach((fn) => fn(data));

function isSameTrack(
  value: { artist: string; track: string },
  other: { artist: string; track: string },
) {
  return (
    value.artist.trim().toLowerCase() === other.artist.trim().toLowerCase() &&
    value.track.trim().toLowerCase() === other.track.trim().toLowerCase()
  );
}

function preserveLovedOverride(next: LiveData): LiveData {
  if (!lovedOverride) return next;
  if (Date.now() >= lovedOverride.expiresAt) {
    lovedOverride = null;
    return next;
  }

  const nowPlaying = next.nowPlaying;
  if (!nowPlaying) return next;
  if (!isSameTrack(nowPlaying, lovedOverride)) {
    lovedOverride = null;
    return next;
  }

  if (nowPlaying.loved === lovedOverride.loved) {
    lovedOverride = null;
    return next;
  }

  return {
    ...next,
    nowPlaying: { ...nowPlaying, loved: lovedOverride.loved },
  };
}

async function load() {
  if (inFlight) return;
  inFlight = true;
  try {
    const res = await fetch("/api/live", { cache: "no-store" });
    if (!res.ok) return;
    data = preserveLovedOverride((await res.json()) as LiveData);
    emit();
  } catch {
    /* silencieux : les valeurs de la base restent affichées */
  } finally {
    inFlight = false;
  }
}

/** Force un rafraîchissement (après un « j'aime », par exemple). */
export function refreshLive() {
  return load();
}

/** Modifie l'état « aimé » sans attendre l'aller-retour réseau. */
export function setLovedOptimistic(loved: boolean) {
  if (data?.nowPlaying) {
    lovedOverride = {
      artist: data.nowPlaying.artist,
      track: data.nowPlaying.track,
      loved,
      // Last.fm peut mettre plusieurs rafraichissements avant de renvoyer
      // la nouvelle valeur. On garde le clic local jusque-la.
      expiresAt: Date.now() + 120_000,
    };
    data = { ...data, nowPlaying: { ...data.nowPlaying, loved } };
    emit();
  }
}

/** Annule l'etat optimiste si l'ecriture Last.fm a echoue. */
export function rollbackLovedOptimistic(loved: boolean) {
  const target = lovedOverride;
  lovedOverride = null;
  if (data?.nowPlaying && target && isSameTrack(data.nowPlaying, target)) {
    data = { ...data, nowPlaying: { ...data.nowPlaying, loved } };
    emit();
  }
}

export function useLive(intervalMs = 30_000): LiveData | null {
  const [local, setLocal] = useState<LiveData | null>(data);

  useEffect(() => {
    subscribers.add(setLocal);
    if (data) setLocal(data);

    if (!timer) {
      load();
      timer = setInterval(load, intervalMs);
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      subscribers.delete(setLocal);
      document.removeEventListener("visibilitychange", onVisible);
      if (subscribers.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, [intervalMs]);

  return local;
}
