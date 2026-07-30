/**
 * Client Deezer — API publique, aucune clé requise.
 * Sert deux choses que Last.fm ne donne pas correctement :
 *  - la durée réelle des titres (Last.fm n'en fournit aucune dans les scrobbles)
 *  - les photos d'artistes (Last.fm renvoie une étoile grise depuis 2019)
 */

const API = "https://api.deezer.com";

/** Normalise pour comparer deux noms sans se faire piéger par la ponctuation. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .replace(/\(.*?\)|\[.*?\]/g, "") // (feat. X), [Deluxe]…
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Les deux noms désignent-ils vraisemblablement la même chose ? */
function plausible(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, {
    signal,
    headers: { "User-Agent": "Sonar/0.1 (stats perso)" },
  });
  if (!res.ok) throw new Error(`Deezer HTTP ${res.status}`);
  return res.json();
}

/**
 * Durée d'un titre en millisecondes, ou null si introuvable.
 * On vérifie que le résultat correspond vraiment au titre demandé : une
 * recherche approximative renverrait sinon la durée d'un autre morceau.
 */
export async function trackDuration(
  artist: string,
  track: string,
  signal?: AbortSignal,
): Promise<number | null> {
  const q = `artist:"${artist.replace(/"/g, "")}" track:"${track.replace(/"/g, "")}"`;
  const url = `${API}/search?q=${encodeURIComponent(q)}&limit=3`;
  const json = (await getJson(url, signal)) as {
    data?: { duration?: number; title?: string; artist?: { name?: string } }[];
  };
  for (const hit of json.data ?? []) {
    if (!hit.duration || hit.duration <= 0) continue;
    const okTrack = hit.title ? plausible(hit.title, track) : false;
    const okArtist = hit.artist?.name ? plausible(hit.artist.name, artist) : false;
    if (okTrack && okArtist) return Math.round(hit.duration * 1000);
  }
  return null;
}

/** Photo d'un artiste (taille moyenne), ou null. */
export async function artistImage(
  artist: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const url = `${API}/search/artist?q=${encodeURIComponent(artist)}&limit=3`;
  const json = (await getJson(url, signal)) as {
    data?: { name?: string; picture_medium?: string; picture_big?: string }[];
  };
  for (const hit of json.data ?? []) {
    if (!hit.name || !plausible(hit.name, artist)) continue;
    const img = hit.picture_big ?? hit.picture_medium;
    // Deezer renvoie parfois un artiste sans visuel : l'URL existe mais est vide
    if (img && !/\/\/$/.test(img)) return img;
  }
  return null;
}
