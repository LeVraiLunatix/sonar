/**
 * Client Deezer — API publique, aucune clé requise.
 * Sert :
 *  - la durée réelle des titres (Last.fm n'en fournit aucune dans les scrobbles)
 *  - les photos d'artistes (Last.fm renvoie une étoile grise depuis 2019)
 *  - pochette + extrait 30 s pour les rétros animées
 */

const API = "https://api.deezer.com";

/** Normalisation « avec espaces » : ponctuation → espace. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .replace(/\(.*?\)|\[.*?\]/g, "") // (feat. X), [Deluxe]…
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Normalisation « collée » : plus aucun séparateur (P.L.K == PLK, FA-VE == fave). */
function normTight(s: string): string {
  return norm(s).replace(/\s+/g, "");
}

/**
 * Correspondance de noms. Égalité après normalisation — sur la forme « avec
 * espaces » OU la forme « collée ». Ça rattrape la ponctuation (P.L.K / PLK,
 * accents, tirets) sans jamais accepter une inclusion : « Luther » ≠ « Luther
 * Vandross », « PNL » ≠ « Favé ». Mieux vaut aucun média qu'un mauvais.
 */
function sameName(a: string, b: string): boolean {
  const xa = norm(a);
  const ya = norm(b);
  if (xa && ya && xa === ya) return true;
  const xt = normTight(a);
  const yt = normTight(b);
  return !!xt && !!yt && xt === yt;
}

/** Retire «feat.», «ft.», «featuring», «avec»… et ce qui suit → artiste principal. */
function primaryArtist(name: string): string {
  return name.replace(/\s+(?:feat\.?|ft\.?|featuring|avec|w[/.]|vs\.?)\s+.*$/i, "").trim() || name;
}

/** Deux titres « assez proches » : égalité, inclusion prudente, ou fort recouvrement. */
function titleSimilar(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (short.length >= 4 && short.length >= long.length * 0.5 && long.includes(short)) {
    return true;
  }

  const ta = new Set(na.split(" ").filter(Boolean));
  const tb = new Set(nb.split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return false;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter) >= 0.6;
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, {
    signal,
    headers: { "User-Agent": "Sonar/0.1 (stats perso)" },
    // catalogue Deezer : stable, mutualisable entre comptes, mais jamais un
    // échec figé en cache
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`Deezer HTTP ${res.status} for ${url}`);
  const json = (await res.json()) as { error?: { code?: number; message?: string } };
  if (json && typeof json === "object" && "error" in json && json.error) {
    throw new Error(`Deezer API error ${json.error.code}: ${json.error.message} (${url})`);
  }
  return json;
}

const q = (s: string) => s.replace(/"/g, "");

/**
 * Durée d'un titre en millisecondes, ou null si introuvable.
 * Correspondance STRICTE titre + artiste : une recherche approximative
 * renverrait la durée d'un autre morceau.
 */
export async function trackDuration(
  artist: string,
  track: string,
  signal?: AbortSignal,
): Promise<number | null> {
  const query = `artist:"${q(artist)}" track:"${q(track)}"`;
  const url = `${API}/search?q=${encodeURIComponent(query)}&limit=3`;
  const json = (await getJson(url, signal)) as {
    data?: { duration?: number; title?: string; artist?: { name?: string } }[];
  };
  for (const hit of json.data ?? []) {
    if (!hit.duration || hit.duration <= 0) continue;
    const okTrack = hit.title ? sameName(hit.title, track) : false;
    const okArtist = hit.artist?.name ? sameName(hit.artist.name, artist) : false;
    if (okTrack && okArtist) return Math.round(hit.duration * 1000);
  }
  return null;
}

type DzArtist = {
  id?: number;
  name?: string;
  nb_fan?: number;
  picture_medium?: string;
  picture_big?: string;
  picture_xl?: string;
};

/**
 * Résout un nom vers l'artiste Deezer : id + photo. On EXIGE une correspondance
 * de nom (aucune inclusion) et on garde, parmi les homonymes exacts, celui qui a
 * le plus de fans. Pas de correspondance → null (on ne devine pas).
 */
async function findArtist(
  name: string,
  signal?: AbortSignal,
): Promise<{ id: number; picture: string | null; name: string } | null> {
  const url = `${API}/search/artist?q=${encodeURIComponent(name)}&limit=15`;
  let data: DzArtist[] = [];
  try {
    data = (((await getJson(url, signal)) as { data?: DzArtist[] }).data ?? []).filter(
      (a) => typeof a.id === "number",
    );
  } catch {
    return null;
  }

  const exact = data.filter((a) => a.name && sameName(a.name, name));
  if (exact.length === 0) return null;
  exact.sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0));

  const best = exact[0];
  const pic = best.picture_xl ?? best.picture_big ?? best.picture_medium ?? null;
  return {
    id: best.id as number,
    name: best.name as string,
    picture: pic && !/\/\/$/.test(pic) ? pic : null,
  };
}

/** Photo d'un artiste, ou null. */
export async function artistImage(
  artist: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const found = await findArtist(primaryArtist(artist), signal);
  return found?.picture ?? null;
}

export type TrackMedia = { preview: string | null; cover: string | null };

type DzTrack = {
  preview?: string;
  title?: string;
  artist?: { name?: string };
  album?: { cover_medium?: string; cover_big?: string; cover_xl?: string };
};

function pickTrack(hit: DzTrack): TrackMedia {
  return {
    preview: hit.preview && hit.preview.length > 8 ? hit.preview : null,
    cover: hit.album?.cover_xl ?? hit.album?.cover_big ?? hit.album?.cover_medium ?? null,
  };
}

/**
 * Média d'un ARTISTE : sa photo + l'extrait d'un de ses titres phares.
 * On passe par l'id Deezer de l'artiste puis `/artist/{id}/top` : le résultat
 * est GARANTI du bon artiste (contrairement à `/search` qui mélange les
 * homonymes et les collaborations). Artiste introuvable → média vide, jamais
 * l'extrait de quelqu'un d'autre.
 */
export async function artistMedia(
  artist: string,
  signal?: AbortSignal,
): Promise<TrackMedia> {
  const found = await findArtist(primaryArtist(artist), signal);
  if (!found) return { preview: null, cover: null };

  let preview: string | null = null;
  let albumCover: string | null = null;
  try {
    const url = `${API}/artist/${found.id}/top?limit=12`;
    const json = (await getJson(url, signal)) as { data?: DzTrack[] };
    for (const t of json.data ?? []) {
      if (!preview && t.preview && t.preview.length > 8) preview = t.preview;
      if (!albumCover)
        albumCover = t.album?.cover_xl ?? t.album?.cover_big ?? t.album?.cover_medium ?? null;
      if (preview && albumCover) break;
    }
  } catch {
    /* on garde au moins la photo */
  }

  return { preview, cover: found.picture ?? albumCover };
}

/**
 * Extrait audio + pochette d'un TITRE. Cascade, du plus sûr au plus souple :
 *  1. même artiste + même titre
 *  2. même artiste + titre proche (feat., édit, live…)
 *  3. même artiste, n'importe lequel de ses titres du résultat
 *  4. aucun résultat du bon artiste → un titre phare de CET artiste
 *     (`artistMedia`) — jamais le 1er résultat Deezer, qui peut être un autre
 *     artiste (c'est ce qui faisait apparaître PNL sur un titre de Favé).
 */
export async function trackMedia(
  artist: string,
  track: string,
  signal?: AbortSignal,
): Promise<TrackMedia> {
  const pa = primaryArtist(artist);
  const query = `artist:"${q(pa)}" track:"${q(track)}"`;
  const url = `${API}/search?q=${encodeURIComponent(query)}&limit=12`;

  let data: DzTrack[] = [];
  try {
    data = ((await getJson(url, signal)) as { data?: DzTrack[] }).data ?? [];
  } catch {
    /* on tentera l'artiste */
  }

  const byArtist = data.filter((h) => h.artist?.name && sameName(h.artist.name, pa));
  const hit =
    byArtist.find((h) => h.title && sameName(h.title, track)) ??
    byArtist.find((h) => h.title && titleSimilar(h.title, track)) ??
    byArtist.find((h) => h.preview);

  if (hit) return pickTrack(hit);

  return artistMedia(pa, signal);
}
