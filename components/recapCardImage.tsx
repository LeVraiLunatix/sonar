import type { RecapCard } from "@/lib/card";

/**
 * Carte-résumé façon « Wrapped » rendue en image par `next/og` (Satori).
 * Contraintes Satori : tout conteneur multi-enfants doit être `display:flex`,
 * pas de `gap` hérité, couleurs littérales. Les polices sont celles du site,
 * injectées via l'option `fonts` de `ImageResponse` (voir `lib/cardFonts.ts`) :
 *  - Bricolage Grotesque : titres / grands mots
 *  - Departure Mono : chiffres
 *  - Newsreader : texte courant
 */
const PAPER = "#ede4cb";
const INK = "#1c1a17";
const PINK = "#ff4fa3";
const BLUE = "#2e4fd6";
const GRAY = "#7c7768";

const DISPLAY = '"Bricolage Grotesque", system-ui, sans-serif';
const MONO = '"Departure Mono", ui-monospace, "Cascadia Mono", monospace';
const TEXT = '"Newsreader", Georgia, serif';

function Metric({ v, k }: { v: string; k: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginRight: 56 }}>
      <div style={{ fontSize: 58, color: BLUE, fontFamily: MONO }}>{v}</div>
      <div
        style={{
          fontSize: 20,
          color: GRAY,
          letterSpacing: 3,
          marginTop: 8,
          fontFamily: MONO,
        }}
      >
        {k.toUpperCase()}
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginBottom: 30 }}>
      <div style={{ fontSize: 20, color: GRAY, letterSpacing: 3, fontFamily: MONO }}>{k}</div>
      <div
        style={{
          fontSize: 46,
          color: INK,
          fontWeight: 700,
          fontFamily: DISPLAY,
          marginTop: 6,
        }}
      >
        {v}
      </div>
    </div>
  );
}

export function recapCardImage(c: RecapCard) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: PAPER,
        padding: 80,
        fontFamily: TEXT,
        color: INK,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 24, letterSpacing: 8, color: GRAY, fontFamily: MONO }}>
          {c.heading}
        </div>
        <div
          style={{
            fontSize: 128,
            fontWeight: 800,
            letterSpacing: -5,
            marginTop: 6,
            fontFamily: DISPLAY,
          }}
        >
          {c.label}
        </div>
      </div>

      <div style={{ display: "flex", position: "relative", marginTop: 10 }}>
        <div
          style={{
            position: "absolute",
            left: 7,
            top: 9,
            fontSize: 190,
            fontFamily: MONO,
            color: PINK,
          }}
        >
          {c.scrobbles}
        </div>
        <div style={{ fontSize: 190, fontFamily: MONO, color: INK }}>{c.scrobbles}</div>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 28,
          color: GRAY,
          letterSpacing: 4,
          marginTop: -4,
          fontFamily: MONO,
        }}
      >
        SCROBBLES
      </div>

      <div style={{ display: "flex", marginTop: 24 }}>
        <Metric v={c.minutes} k="minutes" />
        <Metric v={c.artists} k="artistes" />
        <Metric v={c.tracks} k="titres" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 30 }}>
        <Field k="ARTISTE N°1" v={c.topArtist} />
        <Field k="TITRE EN BOUCLE" v={c.topTrack} />
        {c.genre ? <Field k="GENRE" v={c.genre} /> : null}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 22,
          color: GRAY,
          letterSpacing: 4,
          borderTop: `2px solid ${INK}`,
          paddingTop: 20,
          fontFamily: MONO,
        }}
      >
        <div style={{ display: "flex" }}>SONAR</div>
        <div style={{ display: "flex" }}>{c.listen} D’ÉCOUTE</div>
      </div>
    </div>
  );
}
