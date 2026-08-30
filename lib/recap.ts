import type { PeriodData } from "./period";
import type { HourCount } from "./stats";
import { humanMs, frMonth } from "./format";
import { isoWeekOf, weekRange, addDays, parisToday } from "./dates";

/**
 * Rétros animées façon « Wrapped » : à partir des mêmes stats SQL que les pages
 * /week /month /year, on assemble un jeu de diapos (story) que le lecteur
 * client (`components/story/StoryPlayer`) fait défiler. Rien ici ne touche la
 * base : `buildRecap` est une fonction pure sur `PeriodData`.
 *
 * Chaque diapo porte un `media` (un artiste ou un titre) : le lecteur en tire
 * une pochette animée en fond ET l'extrait audio à jouer pendant la diapo — la
 * musique suit donc ce qui est à l'écran.
 */

export type RecapKind = "week" | "month" | "year";

/** Teinte d'une diapo — miroir des rôles riso (voir app/globals.css). */
export type Tone = "paper" | "ink" | "pink" | "blue";

/** Sujet dont on résout pochette + extrait (via /api/recap/media). */
export type MediaSubject = { key: string; artist: string; track?: string };

function artistSubject(name: string, key?: string): MediaSubject {
  return { key: "a:" + (key ?? name.toLowerCase()), artist: name };
}
function trackSubject(artist: string, track: string): MediaSubject {
  return {
    key: "t:" + artist.toLowerCase() + "|" + track.toLowerCase(),
    artist,
    track,
  };
}

type SlideBody =
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
  | { type: "track"; tone: Tone; track: string; artist: string; count: number }
  | {
      type: "list";
      id: string;
      tone: Tone;
      title: string;
      items: { name: string; sub?: string; value: number }[];
    }
  | { type: "genre"; tone: Tone; genre: string; artist: string | null }
  | { type: "album"; tone: Tone; album: string; artist: string; count: number }
  | {
      type: "obsession";
      tone: Tone;
      name: string;
      artistKey: string;
      peak: number;
      total: number;
      concentration: number;
    }
  | {
      type: "loyal";
      tone: Tone;
      name: string;
      artistKey: string;
      months: number;
      total: number;
    }
  | { type: "equiv"; tone: Tone; days: number; albums: number; scrobbles: number }
  | { type: "clock"; tone: Tone; hours: HourCount[]; peakHour: number; caption: string }
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
      podium: string[];
      topArtist: string | null;
      topTrack: string | null;
      genre: string | null;
    };

export type RecapSlide = SlideBody & { media?: MediaSubject };

export type Recap = {
  kind: RecapKind;
  label: string;
  slides: RecapSlide[];
};

/** Sujets média uniques d'une rétro — à résoudre en une seule requête. */
export function mediaSubjects(recap: Recap): MediaSubject[] {
  const seen = new Map<string, MediaSubject>();
  for (const s of recap.slides) if (s.media) seen.set(s.media.key, s.media);
  return [...seen.values()];
}

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
  const peakHour = [...data.perHour].sort((a, b) => b.count - a.count)[0]?.hour ?? 12;
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
    return { title: "L’assidu", blurb: "Presque aucun jour sans musique." };
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

/** Genres plausibles pour le mode démo (fixtures), faute d'appel Last.fm. */
const FIXTURE_GENRES: Record<string, string> = {
  alcest: "blackgaze",
  slowdive: "shoegaze",
  deafheaven: "blackgaze",
  grouper: "ambient",
  "boards of canada": "idm",
  duster: "slowcore",
  "have a nice life": "post-punk",
  "sigur rós": "post-rock",
  portishead: "trip-hop",
  "godspeed you! black emperor": "post-rock",
  "mount eerie": "folk",
  "cocteau twins": "dream pop",
  "explosions in the sky": "post-rock",
  "julien baker": "indie",
  "this will destroy you": "post-rock",
  "the microphones": "lo-fi",
};

/** Filtre le bruit des tags Last.fm ; renvoie le premier vrai genre, minuscule. */
export function pickGenre(names: string[]): string | null {
  const noise =
    /^(seen live|favou?rites?|favorito|my music|owned|beautiful|awesome|masterpiece|albums i own|spotify|19\d\d|20\d\d|\d{1,2})$/i;
  for (const raw of names) {
    const t = raw.trim();
    if (t && t.length <= 24 && !noise.test(t)) return t.toLowerCase();
  }
  return null;
}

/** Genre dominant du premier artiste, via Last.fm si une clé est configurée. */
export async function topGenre(artist: string | undefined | null): Promise<string | null> {
  if (!artist || !process.env.LASTFM_API_KEY) return null;
  try {
    const { artistTopTags } = await import("./lastfm-recommendations");
    const tags = await artistTopTags(artist);
    return pickGenre(tags.map((t) => t.name));
  } catch {
    return null;
  }
}

/** Genre du premier artiste : Last.fm si possible, sinon table démo (fixtures). */
export async function genreFor(data: PeriodData): Promise<string | null> {
  const viaLastfm = await topGenre(data.topArtists[0]?.name);
  if (viaLastfm) return viaLastfm;
  if (data.source === "fixtures") {
    return FIXTURE_GENRES[data.topArtists[0]?.key ?? ""] ?? null;
  }
  return null;
}

/** Assemble la story d'une période. Saute les diapos sans matière. */
export function buildRecap(
  data: PeriodData,
  kind: RecapKind,
  opts?: { genre?: string | null },
): Recap {
  const s = data.summary;
  const slides: RecapSlide[] = [];
  const activeDays = data.perDay.filter((d) => d.count > 0).length;
  const approx = s.durationsKnown !== s.scrobbles;
  const deep = kind === "year"; // la rétro de l'année va plus loin

  const top = data.topArtists[0];
  const artistMedia = top ? artistSubject(top.name, top.key) : undefined;
  const trackMedia = data.topTrack
    ? trackSubject(data.topTrack.artist, data.topTrack.track)
    : undefined;
  const anyMedia = trackMedia ?? artistMedia;

  // ── rotation musicale : on alterne titres et artistes du top pour ne pas
  //    entendre le même morceau toute la rétro (le lecteur crossfade entre eux)
  const pool: MediaSubject[] = [];
  {
    const seen = new Set<string>();
    const tracks = data.topTracks.map((t) => trackSubject(t.artist, t.track));
    const artists = data.topArtists.map((a) => artistSubject(a.name, a.key));
    for (let i = 0; i < Math.max(tracks.length, artists.length); i++) {
      for (const sub of [tracks[i], artists[i]]) {
        if (sub && !seen.has(sub.key)) {
          seen.add(sub.key);
          pool.push(sub);
        }
      }
    }
  }
  let mc = 0;
  const rotate = (): MediaSubject | undefined =>
    pool.length ? pool[mc++ % pool.length] : anyMedia;

  let genre = opts?.genre ?? null;
  if (!genre && data.source === "fixtures" && top) {
    genre = FIXTURE_GENRES[top.key] ?? null;
  }

  slides.push({
    type: "intro",
    tone: "paper",
    kind,
    label: data.label,
    scrobbles: s.scrobbles,
    media: rotate(),
  });

  slides.push({
    type: "bignum",
    id: "scrobbles",
    tone: "ink",
    value: s.scrobbles,
    unit: "scrobbles",
    caption: activeDays > 1 ? `sur ${activeDays} jours d’écoute` : "",
    media: rotate(),
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
      media: rotate(),
    });
  }

  // ── équivalence rigolote (année) ──
  if (deep && s.estMs > 0) {
    slides.push({
      type: "equiv",
      tone: "pink",
      days: Math.max(1, Math.round(s.estMs / 86_400_000)),
      albums: Math.max(1, Math.round(s.estMs / (42 * 60_000))),
      scrobbles: s.scrobbles,
      media: rotate(),
    });
  }

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
        sharePct >= 15 ? `soit ${sharePct} % de toutes tes écoutes` : "en tête, et de loin",
      media: artistMedia,
    });
  }

  if (data.topArtists.length > 1) {
    slides.push({
      type: "list",
      id: "artists",
      tone: "paper",
      title: kind === "year" ? "ton année en 5 artistes" : "tes artistes",
      items: data.topArtists.slice(0, 5).map((a) => ({ name: a.name, value: a.count })),
      media: rotate(),
    });
  }

  if (genre) {
    slides.push({
      type: "genre",
      tone: "blue",
      genre,
      artist: top?.name ?? null,
      media: artistMedia,
    });
  }

  // ── album le plus écouté (mois + année) ──
  if (data.topAlbums[0] && kind !== "week") {
    const al = data.topAlbums[0];
    slides.push({
      type: "album",
      tone: "ink",
      album: al.album,
      artist: al.artist,
      count: al.count,
      media: artistSubject(al.artist),
    });
  }

  if (data.topTrack) {
    slides.push({
      type: "track",
      tone: "ink",
      track: data.topTrack.track,
      artist: data.topTrack.artist,
      count: data.topTrack.count,
      media: trackMedia,
    });
  }

  if (data.topTracks.length > 1) {
    slides.push({
      type: "list",
      id: "tracks",
      tone: "blue",
      title: "les titres en boucle",
      items: data.topTracks.slice(0, 5).map((t) => ({
        name: t.track,
        sub: t.artist,
        value: t.count,
      })),
      media: rotate(),
    });
  }

  // ── obsession : concentré sur une semaine (année, long mois) ──
  if (data.insights?.showObsessions && data.insights.obsessions[0]) {
    const o = data.insights.obsessions[0];
    slides.push({
      type: "obsession",
      tone: "pink",
      name: o.name,
      artistKey: o.key,
      peak: o.peak,
      total: o.total,
      concentration: o.concentration,
      media: artistSubject(o.name, o.key),
    });
  }

  if (data.discoveries[0] && (kind === "month" || kind === "year")) {
    const d = data.discoveries[0];
    slides.push({
      type: "discovery",
      tone: "pink",
      name: d.name,
      artistKey: d.key,
      count: d.count,
      media: artistSubject(d.name, d.key),
    });
  }

  // ── le·la fidèle : présent·e mois après mois (année) ──
  if (data.insights?.showSpread && data.insights.loyal[0]) {
    const l = data.insights.loyal[0];
    slides.push({
      type: "loyal",
      tone: "blue",
      name: l.name,
      artistKey: l.key,
      months: l.months,
      total: l.total,
      media: artistSubject(l.name, l.key),
    });
  }

  if (s.scrobbles > 0) {
    const peakHour = [...data.perHour].sort((a, b) => b.count - a.count)[0]?.hour ?? 12;
    slides.push({
      type: "clock",
      tone: "paper",
      hours: data.perHour,
      peakHour,
      caption: `ton heure de pointe : ${String(peakHour).padStart(2, "0")} h`,
      media: rotate(),
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
      media: rotate(),
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
      media: rotate(),
    });
  }

  const p = personality(data);
  slides.push({
    type: "personality",
    tone: "ink",
    title: p.title,
    blurb: p.blurb,
    media: rotate(),
  });

  slides.push({
    type: "outro",
    tone: "paper",
    kind,
    label: data.label,
    topArtist: top?.name ?? null,
    topTrack: data.topTrack?.track ?? null,
    genre,
    podium: data.topArtists.slice(0, 3).map((a) => a.name),
    media: trackMedia ?? anyMedia,
    lines: [
      { k: "scrobbles", v: s.scrobbles.toLocaleString("fr-FR") },
      { k: "artistes", v: s.artists.toLocaleString("fr-FR") },
      { k: "titres uniques", v: s.tracks.toLocaleString("fr-FR") },
      { k: "écoute", v: `${approx ? "≈ " : ""}${humanMs(s.estMs)}` },
    ],
  });

  return { kind, label: data.label, slides };
}

// ─────────────────────────────────────────────────────────────
//  Fenêtres : quelle rétro proposer, et quand
// ─────────────────────────────────────────────────────────────

export type RecapRef = {
  kind: RecapKind;
  id: string;
  href: string;
  label: string;
};

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
