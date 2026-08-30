import type { RecapCard } from "@/lib/card";

/**
 * Carte-résumé façon « Wrapped » rendue en image par `next/og` (Satori).
 * Contraintes Satori : tout conteneur multi-enfants doit être `display:flex`,
 * pas de `gap` hérité, on ne compte que sur des couleurs littérales.
 */
const PAPER = "#ede4cb";
const INK = "#1c1a17";
const PINK = "#ff4fa3";
const BLUE = "#2e4fd6";
const GRAY = "#7c7768";

const mono =
  '"Departure Mono", ui-monospace, "Cascadia Mono", "DejaVu Sans Mono", monospace';

function Metric({ v, k }: { v: string; k: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginRight: 56 }}>
      <div style={{ fontSize: 60, color: BLUE, fontFamily: mono }}>{v}</div>
      <div style={{ fontSize: 22, color: GRAY, letterSpacing: 2, marginTop: 6 }}>
        {k.toUpperCase()}
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginBottom: 30 }}>
      <div style={{ fontSize: 22, color: GRAY, letterSpacing: 3 }}>{k}</div>
      <div style={{ fontSize: 46, color: INK, fontWeight: 700, marginTop: 4 }}>{v}</div>
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
        fontFamily: '"Newsreader", Georgia, serif',
        color: INK,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 26, letterSpacing: 6, color: GRAY }}>{c.heading}</div>
        <div style={{ fontSize: 130, fontWeight: 800, letterSpacing: -4, marginTop: 4 }}>
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
            fontFamily: mono,
            color: PINK,
          }}
        >
          {c.scrobbles}
        </div>
        <div style={{ fontSize: 190, fontFamily: mono, color: INK }}>{c.scrobbles}</div>
      </div>
      <div style={{ display: "flex", fontSize: 30, color: GRAY, letterSpacing: 3, marginTop: -6 }}>
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
          fontSize: 24,
          color: GRAY,
          letterSpacing: 3,
          borderTop: `2px solid ${INK}`,
          paddingTop: 20,
        }}
      >
        <div style={{ display: "flex" }}>SONAR</div>
        <div style={{ display: "flex" }}>{c.listen} d’écoute</div>
      </div>
    </div>
  );
}
