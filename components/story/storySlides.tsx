"use client";

import { useState } from "react";
import Clock from "@/components/Clock";
import BigCount from "@/components/BigCount";
import { nf } from "@/lib/format";
import type { RecapKind, RecapSlide } from "@/lib/recap";

/**
 * Rendu d'UNE diapo de rétro. Purement présentation : toute la matière est déjà
 * calculée dans `lib/recap.ts`. Les entrées animées ne se déclenchent que quand
 * `current` est vrai (classe `.is-current` sur `.story__slide`).
 */
export default function StorySlide({
  slide,
  current,
  kind,
  cardHref,
  sharePath,
}: {
  slide: RecapSlide;
  current: boolean;
  kind: RecapKind;
  cardHref: string;
  sharePath: string;
}) {
  return (
    <div
      className={`story__slide${current ? " is-current" : ""}`}
      data-tone={slide.tone}
      aria-hidden={current ? undefined : true}
    >
      <div className="story__inner">{body(slide, current, kind, cardHref, sharePath)}</div>
    </div>
  );
}

/** Copie le lien de partage (URL absolue) dans le presse-papier. */
function ShareLinkButton({ path }: { path: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="story__share story__reveal"
      style={rise(7)}
      onClick={async () => {
        const url =
          typeof window !== "undefined" ? window.location.origin + path : path;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          window.prompt("Copie ce lien :", url);
        }
        setDone(true);
        window.setTimeout(() => setDone(false), 2200);
      }}
    >
      {done ? "lien copié ✓" : "⧉ copier le lien de partage"}
    </button>
  );
}

function periodWord(kind: RecapKind): string {
  return kind === "week" ? "cette semaine" : kind === "month" ? "ce mois-ci" : "cette année";
}

function body(
  slide: RecapSlide,
  current: boolean,
  kind: RecapKind,
  cardHref: string,
  sharePath: string,
) {
  switch (slide.type) {
    case "intro":
      return (
        <>
          <p className="story__eyebrow story__reveal" style={rise(0)}>
            {kind === "week"
              ? "rétro de la semaine"
              : kind === "month"
                ? "rétro du mois"
                : "rétro de l’année"}
          </p>
          <p className="story__display story__reveal" style={rise(1)}>
            {slide.label}
          </p>
          <p className="story__caption story__reveal" style={rise(2)}>
            {nf(slide.scrobbles)} scrobbles à dérouler.
          </p>
          <p className="story__tip story__reveal" style={rise(3)}>
            tape pour avancer · maintiens pour mettre en pause
          </p>
        </>
      );

    case "bignum":
      return (
        <>
          <p className="story__eyebrow story__reveal" style={rise(0)}>
            {periodWord(kind)}
          </p>
          <div className="story__huge story__reveal" style={rise(1)}>
            {current ? (
              <BigCount value={slide.value} suffix={slide.suffix ?? ""} />
            ) : (
              <span className="big">
                <span className="big__sizer">{nf(slide.value) + (slide.suffix ?? "")}</span>
                <span className="big__ink">{nf(slide.value) + (slide.suffix ?? "")}</span>
              </span>
            )}
          </div>
          <p className="story__unit story__reveal" style={rise(2)}>
            {slide.unit}
          </p>
          {slide.caption && (
            <p className="story__caption story__reveal" style={rise(3)}>
              {slide.caption}
            </p>
          )}
        </>
      );

    case "artist":
      return (
        <>
          <p className="story__eyebrow story__reveal" style={rise(0)}>
            ton artiste n°1 {periodWord(kind)}
          </p>
          <p className="story__name story__reveal" style={rise(1)}>
            {slide.name}
          </p>
          <p className="story__unit story__reveal" style={rise(2)}>
            {nf(slide.count)} écoutes
            {slide.deltaPct != null && (
              <span className={`story__delta ${slide.deltaPct >= 0 ? "is-up" : "is-down"}`}>
                {slide.deltaPct >= 0 ? "▲" : "▼"} {Math.abs(slide.deltaPct)} % vs période
                précédente
              </span>
            )}
          </p>
          <p className="story__caption story__reveal" style={rise(3)}>
            {slide.caption}
          </p>
        </>
      );

    case "track":
      return (
        <>
          <p className="story__eyebrow story__reveal" style={rise(0)}>
            le titre que tu n’as pas lâché
          </p>
          <p className="story__name story__reveal" style={rise(1)}>
            {slide.track}
          </p>
          <p className="story__by story__reveal" style={rise(2)}>
            {slide.artist}
          </p>
          <p className="story__caption story__reveal" style={rise(3)}>
            {nf(slide.count)} fois
          </p>
        </>
      );

    case "genre":
      return (
        <>
          <p className="story__eyebrow story__reveal" style={rise(0)}>
            ton genre {periodWord(kind)}
          </p>
          <p className="story__display story__reveal" style={rise(1)}>
            {slide.genre}
          </p>
          {slide.artist && (
            <p className="story__caption story__reveal" style={rise(2)}>
              surtout porté par {slide.artist}
            </p>
          )}
        </>
      );

    case "album":
      return (
        <>
          <p className="story__eyebrow story__reveal" style={rise(0)}>
            l’album que tu as le plus tourné
          </p>
          <p className="story__name story__reveal" style={rise(1)}>
            {slide.album}
          </p>
          <p className="story__by story__reveal" style={rise(2)}>
            {slide.artist}
          </p>
          <p className="story__caption story__reveal" style={rise(3)}>
            {nf(slide.count)} écoutes
          </p>
        </>
      );

    case "equiv":
      return (
        <>
          <p className="story__eyebrow story__reveal" style={rise(0)}>
            mis bout à bout {periodWord(kind)}
          </p>
          <div className="story__huge story__reveal" style={rise(1)}>
            {current ? (
              <BigCount value={slide.days} suffix=" j" />
            ) : (
              <span className="big">
                <span className="big__sizer">{nf(slide.days)} j</span>
                <span className="big__ink">{nf(slide.days)} j</span>
              </span>
            )}
          </div>
          <p className="story__unit story__reveal" style={rise(2)}>
            de musique non-stop
          </p>
          <p className="story__caption story__reveal" style={rise(3)}>
            soit ≈ {nf(slide.albums)} albums enchaînés, {nf(slide.scrobbles)} titres sans
            une pause.
          </p>
        </>
      );

    case "obsession":
      return (
        <>
          <p className="story__eyebrow story__reveal" style={rise(0)}>
            ton obsession {periodWord(kind)}
          </p>
          <p className="story__name story__reveal" style={rise(1)}>
            {slide.name}
          </p>
          <p className="story__unit story__reveal" style={rise(2)}>
            {Math.round(slide.concentration * 100)} % en une seule semaine
          </p>
          <p className="story__caption story__reveal" style={rise(3)}>
            {nf(slide.peak)} de tes {nf(slide.total)} écoutes, concentrées d’un coup.
          </p>
        </>
      );

    case "loyal":
      return (
        <>
          <p className="story__eyebrow story__reveal" style={rise(0)}>
            resté·e toute l’année
          </p>
          <p className="story__name story__reveal" style={rise(1)}>
            {slide.name}
          </p>
          <p className="story__caption story__reveal" style={rise(2)}>
            présent·e {slide.months} mois sur 12 — {nf(slide.total)} écoutes en tout.
          </p>
        </>
      );

    case "list":
      return (
        <>
          <p className="story__eyebrow story__reveal" style={rise(0)}>
            {slide.title}
          </p>
          <ol className="story__list">
            {slide.items.map((it, i) => (
              <li key={`${it.name}-${i}`} className="story__reveal" style={rise(i + 1)}>
                <span className="story__list-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="story__list-main">
                  <span className="story__list-name">{it.name}</span>
                  {it.sub && <span className="story__list-sub">{it.sub}</span>}
                </span>
                <span className="story__list-v">{nf(it.value)}</span>
              </li>
            ))}
          </ol>
        </>
      );

    case "clock":
      return (
        <>
          <p className="story__eyebrow story__reveal" style={rise(0)}>
            {slide.caption}
          </p>
          <div className="story__clock story__reveal" style={rise(1)}>
            {/* monté seulement une fois la diapo active : le calcul trigo du
                Clock diffère au dernier chiffre flottant entre serveur et
                client et casserait l'hydratation sinon */}
            {current && <Clock hours={slide.hours} />}
          </div>
          <p className="story__caption story__reveal" style={rise(2)}>
            minuit en haut, midi en bas.
          </p>
        </>
      );

    case "ratio":
      return (
        <>
          <p className="story__eyebrow story__reveal" style={rise(0)}>
            nouveautés vs réécoutes
          </p>
          <div className="story__ratio story__reveal" style={rise(1)}>
            <span
              className="story__ratio-seg story__ratio-seg--fresh"
              style={{ width: `${slide.freshPct}%` }}
            />
            <span
              className="story__ratio-seg story__ratio-seg--repeat"
              style={{ width: `${100 - slide.freshPct}%` }}
            />
          </div>
          <p className="story__unit story__reveal" style={rise(2)}>
            {slide.freshPct} % de neuf
          </p>
          <p className="story__caption story__reveal" style={rise(3)}>
            {nf(slide.fresh)} découvertes · {nf(slide.repeat)} réécoutes — {slide.caption}
          </p>
        </>
      );

    case "discovery":
      return (
        <>
          <p className="story__eyebrow story__reveal" style={rise(0)}>
            ta plus belle découverte {periodWord(kind)}
          </p>
          <p className="story__name story__reveal" style={rise(1)}>
            {slide.name}
          </p>
          <p className="story__caption story__reveal" style={rise(2)}>
            premier scrobble dans la période, puis {nf(slide.count)} écoutes.
          </p>
        </>
      );

    case "personality":
      return (
        <>
          <p className="story__eyebrow story__reveal" style={rise(0)}>
            ton profil d’écoute
          </p>
          <p className="story__display story__reveal" style={rise(1)}>
            {slide.title}
          </p>
          <p className="story__caption story__reveal" style={rise(2)}>
            {slide.blurb}
          </p>
        </>
      );

    case "outro":
      return (
        <>
          <p className="story__eyebrow story__reveal" style={rise(0)}>
            {slide.kind === "week"
              ? "ta semaine"
              : slide.kind === "month"
                ? "ton mois"
                : "ton année"}{" "}
            · {slide.label}
          </p>
          <dl className="story__recap">
            {slide.lines.map((l, i) => (
              <div key={l.k} className="story__reveal" style={rise(i + 1)}>
                <dt>{l.k}</dt>
                <dd>{l.v}</dd>
              </div>
            ))}
          </dl>
          {slide.podium.length > 0 && (
            <p className="story__caption story__reveal" style={rise(5)}>
              podium : {slide.podium.join(" · ")}
            </p>
          )}
          {(slide.topTrack || slide.genre) && (
            <p className="story__caption story__reveal" style={rise(5)}>
              {slide.topTrack && <>en boucle : {slide.topTrack}</>}
              {slide.topTrack && slide.genre && " · "}
              {slide.genre && <>{slide.genre}</>}
            </p>
          )}
          <div className="story__actions story__reveal" style={rise(6)}>
            <a
              className="story__save"
              href={cardHref}
              download={
                `sonar-${slide.label}`.replace(/[^\w.-]+/g, "-").toLowerCase() + ".png"
              }
            >
              ↓ enregistrer la carte
            </a>
            <ShareLinkButton path={sharePath} />
          </div>
        </>
      );
  }
}

/** délai d'entrée échelonné, en variable CSS */
function rise(i: number): React.CSSProperties {
  return { ["--d" as string]: `${i * 90}ms` };
}
