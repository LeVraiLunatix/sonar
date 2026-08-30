import type { PeriodData } from "./period";
import type { HourCount } from "./stats";
import { humanMs, frMonth } from "./format";
import { isoWeekOf, weekRange, addDays, parisToday } from "./dates";

/**
 * Rétros animées façon « Wrapped » : à partir des mêmes stats SQL que les pages
 * /week /month /year, on assemble un jeu de diapos (story) que le lecteur
 * client (`components/story/StoryPlayer`) fait défiler. Rien ici ne touche la
 * base : `buildRecap` est une fonction pure sur `PeriodData`.
 */

export type RecapKind = "week" | "month" | "year";

/** Teinte d'une diapo — miroir des rôles riso (voir app/globals.css). */
export type Tone = "paper" | "ink" | "pink" | "blue";

export type RecapSlide =
  | { type: "intro"; tone: Tone; kind: RecapKind; label: string; scrobbles: number }
  | {
      type: "bignum";
      id: string;
      tone: Tone;
      value: number;
      suffix?: string;
      unit: string;
      caption: string;
    }
  | {
      type: "artist";
      tone: Tone;
      name: string;
      artistKey: string;
      count: number;
      deltaPct: number | null;
      sharePct: number;
      caption: string;
    }
  | {
      type: "track";
      tone: Tone;
      track: string;
      artist: string;
      count: number;
    }
  | {
      type: "list";
      id: string;
      tone: Tone;
      title: string;
      items: { name: string; sub?: string; value: number }[];
    }
  | {
      type: "clock";
      tone: Tone;
      hours: HourCount[];
      peakHour: number;
      caption: string;
    }
  | {
      type: "ratio";
      tone: Tone;
      fresh: number;
      repeat: number;
      freshPct: number;
      caption: string;
    }
  | { type: "discovery"; tone: Tone; name: string; artistKey: string; count: number }
  | { type: "personality"; tone: Tone; title: string; blurb: string }
  | {
      type: "outro";
      tone: Tone;
      kind: RecapKind;
      label: string;
      lines: { k: string; v: string }[];
      topArtist: string | null;
      topTrack: string | null;
    };

export type Recap = {
  kind: RecapKind;
  label: string;
  slides: RecapSlide[];
  /** titre à résoudre côté client pour la musique de fond (extrait Deezer) */
  soundtrack: { artist: string; track: string } | null;
};

function rangeDays(r: { start: string; end: string }): number {
  return Math.max(
    1,
    Math.round(
      (Date.parse(r.end + "T12:00:00Z") - Date.parse(r.start + "T12:00:00Z")) / 86_400_000,
    ),
  );
}

function personality(data: PeriodData): { title: string; blurb: string } {
  const s = data.summary;
  const days = rangeDays(data.range);
  const activeDays = data.perDay.filter((d) => d.count > 0).length;
  const top = data.topArtists[0];
  const topShare = s.scrobbles > 0 && top ? top.count / s.scrobbles : 0;
  const peakHour =
    [...data.perHour].sort((a, b) => b.count - a.count)[0]?.hour ?? 12;
  const fresh = data.insights?.fresh ?? 0;
  const repeat = data.insights?.repeat ?? 0;
  const freshPct = fresh + repeat > 0 ? fresh / (fresh + repeat) : 0;

  if (s.scrobbles > 0 && peakHour <= 5)
    return {
      title: "Le noctambule",
      blurb: "Tes meilleures écoutes tombent quand tout le monde dort.",
    };
  if (topShare >= 0.28 && top)
    return {
      title: "Le cœur fidèle",
      blurb: `${top.name} occupe une place que personne d’autre n’approche.`,
    };
  if (freshPct >= 0.55)
    return {
      title: "L’explorateur",
      blurb: "Plus d’une écoute sur deux est une première fois.",
    };
  if (activeDays / days >= 0.85)
    return {
      title: "L’assidu",
      blurb: "Presque aucun jour sans musique.",
    };
  if (s.artists >= Math.max(20, s.scrobbles / 8))
    return {
      title: "L’éclectique",
      blurb: "Ta bibliothèque part dans toutes les directions à la fois.",
    };
  return {
    title: "L’habitué",
    blurb: "Un rythme régulier, des valeurs sûres — et c’est très bien comme ça.",
  };
}

/** Assemble la story d'une période. Saute les diapos qui n'ont pas de matière. */
export function buildRecap(data: PeriodData, kind: RecapKind): Recap {
  const s = data.summary;
  const slides: RecapSlide[] = [];
  const activeDays = data.perDay.filter((d) => d.count > 0).length;
  const approx = s.durationsKnown !== s.scrobbles;

  slides.push({
    type: "intro",
    tone: "paper",
    kind,
    label: data.label,
    scrobbles: s.scrobbles,
  });

  slides.push({
    type: "bignum",
    id: "scrobbles",
    tone: "ink",
    value: s.scrobbles,
    unit: "scrobbles",
    caption: activeDays > 1 ? `sur ${activeDays} jours d’écoute` : "",
  });

  const minutes = Math.round(s.estMs / 60_000);
  if (minutes > 0) {
    slides.push({
      type: "bignum",
      id: "minutes",
      tone: "blue",
      value: minutes,
      unit: approx ? "minutes (estimées)" : "minutes",
      caption: `${approx ? "≈ " : ""}${humanMs(s.estMs)} bout à bout`,
    });
  }

  const top = data.topArtists[0];
  if (top) {
    const prev = data.prevArtist[top.key] ?? 0;
    const deltaPct = prev > 0 ? Math.round(((top.count - prev) / prev) * 100) : null;
    const sharePct = s.scrobbles > 0 ? Math.round((top.count / s.scrobbles) * 100) : 0;
    slides.push({
      type: "artist",
      tone: "pink",
      name: top.name,
      artistKey: top.key,
      count: top.count,
      deltaPct,
      sharePct,
      caption:
        sharePct >= 15
          ? `soit ${sharePct} % de toutes tes écoutes`
          : "en tête, et de loin",
    });
  }

  if (data.topArtists.length > 1) {
    slides.push({
      type: "list",
      id: "artists",
      tone: "paper",
      title: kind === "year" ? "ton année en 5 artistes" : "tes artistes",
      items: data.topArtists.slice(0, 5).map((a) => ({ name: a.name, value: a.count })),
    });
  }

  if (data.topTrack) {
    slides.push({
      type: "track",
      tone: "blue",
      track: data.topTrack.track,
      artist: data.topTrack.artist,
      count: data.topTrack.count,
    });
  }

  if (data.topTracks.length > 1) {
    slides.push({
      type: "list",
      id: "tracks",
      tone: "ink",
      title: "les titres en boucle",
      items: data.topTracks.slice(0, 5).map((t) => ({
        name: t.track,
        sub: t.artist,
        value: t.count,
      })),
    });
  }

  if (data.discoveries[0] && (kind === "month" || kind === "year")) {
    const d = data.discoveries[0];
    slides.push({
      type: "discovery",
      tone: "paper",
      name: d.name,
      artistKey: d.key,
      count: d.count,
    });
  }

  if (s.scrobbles > 0) {
    const peakHour =
      [...data.perHour].sort((a, b) => b.count - a.count)[0]?.hour ?? 12;
    slides.push({
      type: "clock",
      tone: "paper",
      hours: data.perHour,
      peakHour,
      caption: `ton heure de pointe : ${String(peakHour).padStart(2, "0")} h`,
    });
  }

  if (data.insights && data.insights.fresh + data.insights.repeat > 0) {
    const { fresh, repeat } = data.insights;
    const freshPct = Math.round((fresh / (fresh + repeat)) * 100);
    slides.push({
      type: "ratio",
      tone: "blue",
      fresh,
      repeat,
      freshPct,
      caption:
        freshPct >= 50
          ? "tu passes plus de temps à découvrir qu’à réécouter"
          : "les valeurs sûres l’emportent",
    });
  }

  if (data.streak > 2) {
    slides.push({
      type: "bignum",
      id: "streak",
      tone: "pink",
      value: data.streak,
      suffix: " j",
      unit: "jours d’affilée",
      caption: "sans jamais lâcher",
    });
  }

  const p = personality(data);
  slides.push({ type: "personality", tone: "ink", title: p.title, blurb: p.blurb });

  slides.push({
    type: "outro",
    tone: "paper",
    kind,
    label: data.label,
    topArtist: top?.name ?? null,
    topTrack: data.topTrack?.track ?? null,
    lines: [
      { k: "scrobbles", v: s.scrobbles.toLocaleString("fr-FR") },
      { k: "artistes", v: s.artists.toLocaleString("fr-FR") },
      { k: "titres uniques", v: s.tracks.toLocaleString("fr-FR") },
      { k: "écoute", v: `${approx ? "≈ " : ""}${humanMs(s.estMs)}` },
    ],
  });

  return {
    kind,
    label: data.label,
    slides,
    soundtrack: data.topTrack
      ? { artist: data.topTrack.artist, track: data.topTrack.track }
      : null,
  };
}

// ─────────────────────────────────────────────────────────────
//  Fenêtres : quelle rétro proposer, et quand
// ─────────────────────────────────────────────────────────────

export type RecapRef = {
  kind: RecapKind;
  /** clé stable pour la persistance « déjà vue » */
  id: string;
  href: string;
  label: string;
};

/**
 * Rétros de la période qui vient de se clore, à mettre en avant (bandeau
 * « ta rétro est prête »). N'importe quelle période reste consultable en
 * tapant l'URL — ceci ne pilote que la proposition automatique.
 *
 * - semaine : la semaine écoulée, toute la semaine suivante
 * - mois    : le mois écoulé, les 12 premiers jours du mois courant
 * - année   : l'année écoulée, du 20 décembre au 31 janvier
 */
export function availableRecaps(today: string = parisToday()): RecapRef[] {
  const out: RecapRef[] = [];
  const t = new Date(today + "T12:00:00Z");
  const [y, mo] = today.split("-").map(Number);

  const cur = isoWeekOf(today);
  const lastWeekMonday = addDays(weekRange(cur.year, cur.week).start, -7);
  const lw = isoWeekOf(lastWeekMonday);
  out.push({
    kind: "week",
    id: `week-${lw.year}-${lw.week}`,
    href: `/wrapped/week/${lw.year}/${lw.week}`,
    label: `semaine ${lw.week}`,
  });

  if (t.getUTCDate() <= 12) {
    const pm = mo === 1 ? 12 : mo - 1;
    const py = mo === 1 ? y - 1 : y;
    out.push({
      kind: "month",
      id: `month-${py}-${pm}`,
      href: `/wrapped/month/${py}/${pm}`,
      label: `${frMonth(pm)} ${py}`,
    });
  }

  if (mo === 1 || (mo === 12 && t.getUTCDate() >= 20)) {
    const ty = mo === 1 ? y - 1 : y;
    out.push({
      kind: "year",
      id: `year-${ty}`,
      href: `/wrapped/year/${ty}`,
      label: String(ty),
    });
  }

  return out;
}

export function recapTitle(kind: RecapKind, label: string): string {
  const noun =
    kind === "week" ? "Ta semaine" : kind === "month" ? "Ton mois" : "Ton année";
  return `${noun} en musique — ${label}`;
}
