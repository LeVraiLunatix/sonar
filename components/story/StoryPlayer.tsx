"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Recap } from "@/lib/recap";
import StorySlide from "./storySlides";

/** durée d'une diapo en auto-défilement (ms) — un peu plus pour les listes */
const BASE_MS = 5200;
const LIST_MS = 6800;

export default function StoryPlayer({
  recap,
  backHref,
}: {
  recap: Recap;
  backHref: string;
}) {
  const router = useRouter();
  const { slides } = recap;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [auto, setAuto] = useState(true); // désactivé si prefers-reduced-motion
  const [soundOn, setSoundOn] = useState(true);
  const [soundReady, setSoundReady] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<number | null>(null);
  const held = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const slideMs = useMemo(() => {
    const s = slides[index];
    return s && s.type === "list" ? LIST_MS : BASE_MS;
  }, [slides, index]);

  const close = useCallback(() => {
    router.push(backHref);
  }, [router, backHref]);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => {
        const ni = i + delta;
        if (ni < 0) return 0;
        if (ni >= slides.length) {
          close();
          return i;
        }
        return ni;
      });
    },
    [slides.length, close],
  );

  // ── réglages système : pas d'auto-défilement si l'utilisateur le refuse ──
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setAuto(!mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // ── verrou de scroll + focus + clavier ──
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    rootRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [close, go]);

  // ── musique de fond : extrait Deezer du titre n°1 ──
  useEffect(() => {
    const s = recap.soundtrack;
    if (!s) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/recap/media?artist=${encodeURIComponent(s.artist)}&track=${encodeURIComponent(s.track)}`,
          { signal: ctrl.signal },
        );
        const media = (await res.json()) as { preview: string | null; cover: string | null };
        if (media.cover) setCoverUrl(media.cover);
        const el = audioRef.current;
        if (media.preview && el) {
          el.src = media.preview;
          el.loop = true;
          el.volume = 0.32;
          try {
            await el.play();
            setSoundReady(true);
          } catch {
            // autoplay bloqué : on attend un geste (bouton son)
            setSoundOn(false);
          }
        }
      } catch {
        /* pas de musique, tant pis */
      }
    })();
    return () => ctrl.abort();
  }, [recap.soundtrack]);

  // ── suit l'état lecture : pause de la story = pause du son ──
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !el.src) return;
    if (paused || !soundOn) {
      el.pause();
    } else {
      el.play().then(() => setSoundReady(true)).catch(() => {});
    }
  }, [paused, soundOn, index]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    const el = audioRef.current;
    if (next && el && el.src) el.play().then(() => setSoundReady(true)).catch(() => {});
  };

  // ── gestes sur la scène : appui long = pause, tap = préc/suiv, glissé bas = fermer ──
  const onPointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
    held.current = false;
    holdTimer.current = window.setTimeout(() => {
      held.current = true;
      setPaused(true);
    }, 220);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    const start = pointerStart.current;
    pointerStart.current = null;

    if (held.current) {
      setPaused(false);
      held.current = false;
      return;
    }
    if (start) {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (dy > 70 && Math.abs(dy) > Math.abs(dx)) {
        close();
        return;
      }
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        // glissé horizontal léger : on traite quand même comme un tap
      }
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    go(x < rect.width * 0.32 ? -1 : 1);
  };
  const onPointerLeave = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    if (held.current) {
      setPaused(false);
      held.current = false;
    }
  };

  return (
    <div
      className="story"
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Rétro ${recap.label}`}
    >
      {coverUrl && (
        <div
          className="story__bg"
          style={{ backgroundImage: `url("${coverUrl}")` }}
          aria-hidden="true"
        />
      )}

      <audio ref={audioRef} preload="none" aria-hidden="true" />

      <div className="story__bars">
        {slides.map((_, i) => (
          <span
            key={i}
            className={`story__bar${i < index ? " is-done" : ""}${i === index ? " is-active" : ""}`}
          >
            <span
              key={i === index ? `fill-${index}` : `fill-static-${i}`}
              className="story__bar-fill"
              style={
                i === index && auto
                  ? {
                      animationDuration: `${slideMs}ms`,
                      animationPlayState: paused ? "paused" : "running",
                    }
                  : undefined
              }
              onAnimationEnd={i === index && auto ? () => go(1) : undefined}
            />
          </span>
        ))}
      </div>

      <div className="story__top">
        <button className="story__icon" onClick={close} aria-label="Fermer la rétro">
          ✕
        </button>
        <span className="story__top-label">{recap.label}</span>
        <button
          className={`story__icon${soundOn && soundReady ? " is-on" : ""}`}
          onClick={toggleSound}
          aria-label={soundOn ? "Couper le son" : "Activer le son"}
          aria-pressed={soundOn}
        >
          {soundOn && soundReady ? "♪" : "♪̸"}
        </button>
      </div>

      <div
        className="story__stage"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
      >
        {slides.map((slide, i) => (
          <StorySlide key={i} slide={slide} current={i === index} kind={recap.kind} />
        ))}
      </div>

      <div className="story__foot">
        <button className="story__step" onClick={() => go(-1)} aria-label="Diapo précédente">
          ‹
        </button>
        <p className="story__hint" aria-live="polite">
          {index + 1} / {slides.length}
          {paused ? " · pause" : ""}
        </p>
        <button className="story__step" onClick={() => go(1)} aria-label="Diapo suivante">
          ›
        </button>
      </div>
    </div>
  );
}
