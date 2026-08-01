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

/**
 * Correspondance STRICTE : égalité après normalisation.
 *
 * ⚠️ Ne pas revenir à une comparaison par inclusion. « Luther » serait accepté
 * pour « Luther Vandross » (deux artistes différents), et un nom court comme
 * « H » ou « R2 » correspondrait à presque tout. Mieux vaut aucune photo
 * qu'une photo fausse.
 */
function sameName(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  return !!x && !!y && x === y;
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
    const okTrack = hit.title ? sameName(hit.title, track) : false;
    const okArtist = hit.artist?.name ? sameName(hit.artist.name, artist) : false;
    if (okTrack && okArtist) return Math.round(hit.duration * 1000);
  }
  return null;
}

/**
 * Photo d'un artiste, ou null.
 *
 * Sur un nom exact, Deezer peut renvoyer plusieurs homonymes (reprises,
 * hommages, comptes parasites). On garde celui qui a le plus de fans : c'est
 * presque toujours l'artiste que la personne écoute réellement.
 */
export async function artistImage(
  artist: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const url = `${API}/search/artist?q=${encodeURIComponent(artist)}&limit=10`;
  const json = (await getJson(url, signal)) as {
    data?: {
      name?: string;
      nb_fan?: number;
      picture_medium?: string;
      picture_big?: string;
      picture_xl?: string;
    }[];
  };

  const exacts = (json.data ?? []).filter((h) => h.name && sameName(h.name, artist));
  exacts.sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0));

  for (const hit of exacts) {
    const img = hit.picture_xl ?? hit.picture_big ?? hit.picture_medium;
    // Deezer sert parfois un visuel vide : l'URL existe mais ne finit par rien
    if (img && !/\/\/$/.test(img)) return img;
  }
  return null;
}
