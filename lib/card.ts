import type { PeriodData } from "./period";
import type { RecapKind } from "./recap";
import { humanMs } from "./format";

/** Données de la carte-résumé finale (image partageable, rendue par next/og). */
export type RecapCard = {
  heading: string;
  label: string;
  scrobbles: string;
  minutes: string;
  artists: string;
  tracks: string;
  listen: string;
  topArtist: string;
  topArtists: string[];
  topTrack: string;
  topTracks: string[];
  genre: string | null;
};

export function buildCard(
  data: PeriodData,
  kind: RecapKind,
  genre: string | null,
): RecapCard {
  const s = data.summary;
  const approx = s.durationsKnown !== s.scrobbles;
  const heading =
    kind === "week"
      ? "MA SEMAINE EN MUSIQUE"
      : kind === "month"
        ? "MON MOIS EN MUSIQUE"
        : "MON ANNÉE EN MUSIQUE";

  return {
    heading,
    label: data.label,
    scrobbles: s.scrobbles.toLocaleString("fr-FR"),
    minutes: Math.round(s.estMs / 60_000).toLocaleString("fr-FR"),
    artists: s.artists.toLocaleString("fr-FR"),
    tracks: s.tracks.toLocaleString("fr-FR"),
    // "~" et pas "≈" : la police par défaut de Satori n'a pas le glyphe ≈
    listen: `${approx ? "~ " : ""}${humanMs(s.estMs)}`,
    topArtist: data.topArtists[0]?.name ?? "—",
    topArtists: data.topArtists.slice(0, 5).map((a) => a.name),
    topTrack: data.topTrack ? `${data.topTrack.track} · ${data.topTrack.artist}` : "—",
    topTracks: data.topTracks.slice(0, 5).map((t) => `${t.track} — ${t.artist}`),
    genre,
  };
}
