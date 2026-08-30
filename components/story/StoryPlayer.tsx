"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Recap } from "@/lib/recap";
import { mediaSubjects } from "@/lib/recap";
import StorySlide from "./storySlides";

/** durée d'une diapo en auto-défilement (ms) — un peu plus pour les listes */
const BASE_MS = 5200;
const LIST_MS = 6800;
const VOL = 0.32;
const FADE_MS = 650;

type Media = { cover: string | null; preview: string | null };

export default function StoryPlayer({
  recap,
  backHref,
  cardHref,
  sharePath,
}: {
  recap: Recap;
  backHref: string;
  cardHref: string;
  sharePath: string;
}) {
  const router = useRouter();
  const { slides } = recap;

  const [index, setIndex] = useState(0);
  const [togglePaused, setTogglePaused] = useState(false);
  const [holdActive, setHoldActive] = useState(false);
  const [auto, setAuto] = useState(true); // désactivé si prefers-reduced-motion
  const [soundOn, setSoundOn] = useState(true);
  const [soundReady, setSoundReady] = useState(false);
  const [mediaMap, setMediaMap] = useState<Map<string, Media>>(new Map());
  const [bg, setBg] = useState<{ a: string | null; b: string | null; showA: boolean }>({
    a: null,
    b: null,
    showA: true,
  });

  const paused = togglePaused || holdActive;

  const rootRef = useRef<HTMLDivElement>(null);
  const audioA = useRef<HTMLAudioElement>(null);
  const audioB = useRef<HTMLAudioElement>(null);
  const audioIdx = useRef(0); // quel élément audio est "actif"
  const playingUrl = useRef<string | null>(null);
  const holdTimer = useRef<number | null>(null);
  const heldRef = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const slideMs = useMemo(() => {
    const s = slides[index];
    return s && s.type === "list" ? LIST_MS : BASE_MS;
  }, [slides, index]);

  const close = useCallback(() => router.push(backHref), [router, backHref]);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => {
        const ni = i + delta;
        if (ni < 0) return 0;
        // Arrivé au bout : on RESTE sur la dernière diapo. C'est l'utilisateur
        // qui ferme (✕ / Échap / glissé bas), quand il veut.
        if (ni >= slides.length) return slides.length - 1;
        return ni;
      });
    },
    [slides.length],
  );

  // ── prefers-reduced-motion → plus d'auto-défilement ──
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
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " ") {
        e.preventDefault();
        setTogglePaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [close, go]);

  // ── résolution des pochettes + extraits, en une passe ──
  useEffect(() => {
    const subjects = mediaSubjects(recap);
    if (subjects.length === 0) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/recap/media", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: subjects }),
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { results?: Record<string, Media> };
        setMediaMap(new Map(Object.entries(data.results ?? {})));
      } catch {
        /* pas de média : les diapos gardent leur teinte pleine */
      }
    })();
    return () => ctrl.abort();
  }, [recap]);

  const currentMedia = (): Media | undefined => {
    const key = slides[index]?.media?.key;
    return key ? mediaMap.get(key) : undefined;
  };

  // ── pochette animée en fond : deux calques qui se croisent ──
  useEffect(() => {
    const cover = currentMedia()?.cover ?? null;
    setBg((prev) => {
      const shown = prev.showA ? prev.a : prev.b;
      if (cover === shown) return prev;
      return prev.showA
        ? { a: prev.a, b: cover, showA: false }
        : { a: cover, b: prev.b, showA: true };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, mediaMap]);

  // ── musique : suit la diapo (crossfade entre deux <audio>) ──
  const ramp = (el: HTMLAudioElement, to: number, ms: number, done?: () => void) => {
    const from = el.volume;
    const t0 = performance.now();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      el.volume = Math.max(0, Math.min(1, to));
      done?.();
    };
    const step = (t: number) => {
      if (finished) return;
      const p = Math.min(1, (t - t0) / ms);
      el.volume = Math.max(0, Math.min(1, from + (to - from) * p));
      if (p < 1) requestAnimationFrame(step);
      else finish();
    };
    requestAnimationFrame(step);
    // filet : si rAF est gelé (onglet caché), garantir l'état final
    window.setTimeout(finish, ms + 90);
  };

  const crossfadeTo = useCallback(
    (url: string) => {
      const cur = (audioIdx.current === 0 ? audioA : audioB).current;
      const nxt = (audioIdx.current === 0 ? audioB : audioA).current;
      if (!nxt) return;
      nxt.src = url;
      nxt.loop = true;
      nxt.volume = 0;
      const target = soundOn && !paused ? VOL : 0;
      nxt
        .play()
        .then(() => setSoundReady(true))
        .catch(() => setSoundOn(false));
      ramp(nxt, target, FADE_MS);
      if (cur && !cur.paused) ramp(cur, 0, FADE_MS, () => cur.pause());
      audioIdx.current = audioIdx.current === 0 ? 1 : 0;
      playingUrl.current = url;
    },
    [soundOn, paused],
  );

  useEffect(() => {
    if (mediaMap.size === 0) return;
    const url = currentMedia()?.preview ?? null;
    if (url && url !== playingUrl.current) crossfadeTo(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, mediaMap, crossfadeTo]);

  // ── pause / mute → volume de l'audio actif ──
  useEffect(() => {
    const el = (audioIdx.current === 0 ? audioA : audioB).current;
    if (!el || !el.src) return;
    if (paused || !soundOn) {
      ramp(el, 0, 260, () => el.pause());
    } else {
      el.play()
        .then(() => setSoundReady(true))
        .catch(() => {});
      ramp(el, VOL, 260);
    }
  }, [paused, soundOn]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    const el = (audioIdx.current === 0 ? audioA : audioB).current;
    if (next && el && el.src && !paused) {
      el.play()
        .then(() => setSoundReady(true))
        .catch(() => {});
      ramp(el, VOL, 260);
    }
  };

  // ── gestes : appui long = pause, tap = préc/suiv, glissé bas = fermer ──
  const onPointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
    heldRef.current = false;
    holdTimer.current = window.setTimeout(() => {
      heldRef.current = true;
      setHoldActive(true);
    }, 140);
  };
  const endHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    if (heldRef.current) {
      heldRef.current = false;
      setHoldActive(false);
      return true;
    }
    return false;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const wasHold = endHold();
    const start = pointerStart.current;
    pointerStart.current = null;
    if (wasHold) return;
    if (start) {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (dy > 70 && Math.abs(dy) > Math.abs(dx)) {
        close();
        return;
      }
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    go(x < rect.width * 0.32 ? -1 : 1);
  };
  const onPointerLeave = () => {
    endHold();
  };

  return (
    <div
      className={`story${paused ? " is-paused" : ""}`}
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Rétro ${recap.label}`}
    >
      <audio ref={audioA} preload="none" aria-hidden="true" />
      <audio ref={audioB} preload="none" aria-hidden="true" />

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
          className="story__icon"
          onClick={() => setTogglePaused((p) => !p)}
          aria-label={togglePaused ? "Reprendre" : "Mettre en pause"}
          aria-pressed={togglePaused}
        >
          {togglePaused ? "▶" : "⏸"}
        </button>
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
        {/* pochette animée, DANS la scène et avant les diapos : elle reste
            derrière elles par simple ordre de peinture, sans jeu de z-index */}
        <div
          className={`story__bg${bg.showA ? " is-shown" : ""}`}
          aria-hidden="true"
          style={bg.a ? { backgroundImage: `url("${bg.a}")` } : undefined}
        />
        <div
          className={`story__bg${!bg.showA ? " is-shown" : ""}`}
          aria-hidden="true"
          style={bg.b ? { backgroundImage: `url("${bg.b}")` } : undefined}
        />

        {slides.map((slide, i) => (
          <StorySlide
            key={i}
            slide={slide}
            current={i === index}
            kind={recap.kind}
            cardHref={cardHref}
            sharePath={sharePath}
          />
        ))}

        {paused && (
          <div className="story__paused" aria-hidden="true">
            <span>❙❙</span>
          </div>
        )}
      </div>

      <div className="story__foot">
        <button className="story__step" onClick={() => go(-1)} aria-label="Diapo précédente">
          ‹
        </button>
        <p className="story__hint" aria-live="polite">
          {index + 1} / {slides.length}
          {index === slides.length - 1 ? " · fin" : paused ? " · pause" : ""}
        </p>
        <button className="story__step" onClick={() => go(1)} aria-label="Diapo suivante">
          ›
        </button>
      </div>
    </div>
  );
}
