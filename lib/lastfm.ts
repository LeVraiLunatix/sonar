/**
 * Client Last.fm — uniquement user.getRecentTracks (aucune authentification).
 * Gère explicitement les pièges de la section 5 du brief :
 *  - le morceau "now playing" n'a pas de date → exclu
 *  - réponse mono-élément : objet au lieu d'un tableau → normalisé
 *  - album souvent "" au lieu de null
 *  - timestamps en UTC (on stocke tel quel, l'agrégation se fait en Europe/Paris)
 */

const API = "https://ws.audioscrobbler.com/2.0/";

export type Scrobble = {
  played_at: Date;
  track: string;
  artist: string;
  album: string | null;
  track_mbid: string | null;
  artist_mbid: string | null;
  album_mbid: string | null;
  image_url: string | null;
  loved: boolean;
};

export type NowPlaying = {
  track: string;
  artist: string;
  album: string | null;
  image_url: string | null;
  loved: boolean;
};

export type RecentPage = {
  scrobbles: Scrobble[];
  nowPlaying: NowPlaying | null;
  page: number;
  totalPages: number;
  total: number;
};

/** Last.fm renvoie un objet seul quand il n'y a qu'un élément → toujours un tableau. */
function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** "" → null, et trim. */
function clean(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

/** Extrait l'URL d'image la plus grande d'un tableau d'images Last.fm. */
function pickImage(images: unknown): string | null {
  const arr = asArray(images as { size?: string; ["#text"]?: string }[]);
  // ordre small→extralarge : on prend la dernière non vide
  for (let i = arr.length - 1; i >= 0; i--) {
    const url = clean(arr[i]?.["#text"]);
    if (url) return url;
  }
  return null;
}

type RawTrack = {
  name?: string;
  mbid?: string;
  url?: string;
  artist?: { name?: string; "#text"?: string; mbid?: string };
  album?: { "#text"?: string; mbid?: string };
  image?: unknown;
  date?: { uts?: string };
  loved?: string;
  "@attr"?: { nowplaying?: string };
};

function parseTrack(t: RawTrack): { scrobble?: Scrobble; nowPlaying?: NowPlaying } {
  const track = clean(t.name) ?? "";
  const artist = clean(t.artist?.name ?? t.artist?.["#text"]) ?? "";
  const album = clean(t.album?.["#text"]);
  const image_url = pickImage(t.image);

  // Le morceau en cours : @attr.nowplaying = "true" et pas de champ date.
  if (t["@attr"]?.nowplaying === "true" || !t.date?.uts) {
    if (!track || !artist) return {};
    return { nowPlaying: { track, artist, album, image_url, loved: t.loved === "1" } };
  }

  if (!track || !artist) return {};
  return {
    scrobble: {
      played_at: new Date(Number(t.date.uts) * 1000),
      track,
      artist,
      album,
      track_mbid: clean(t.mbid),
      artist_mbid: clean(t.artist?.mbid),
      album_mbid: clean(t.album?.mbid),
      image_url,
      loved: t.loved === "1",
    },
  };
}

export type FetchOpts = {
  user: string;
  apiKey: string;
  page?: number;
  limit?: number;
  from?: number; // unix (s)
  to?: number; // unix (s)
  signal?: AbortSignal;
};

export async function fetchRecent(opts: FetchOpts): Promise<RecentPage> {
  const params = new URLSearchParams({
    method: "user.getrecenttracks",
    user: opts.user,
    api_key: opts.apiKey,
    format: "json",
    extended: "1",
    limit: String(opts.limit ?? 200),
    page: String(opts.page ?? 1),
  });
  if (opts.from) params.set("from", String(opts.from));
  if (opts.to) params.set("to", String(opts.to));

  const res = await fetch(`${API}?${params.toString()}`, {
    signal: opts.signal,
    headers: { "User-Agent": "Sonar/0.1 (perso stats)" },
  });
  if (!res.ok) {
    throw new Error(`Last.fm HTTP ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as {
    error?: number;
    message?: string;
    recenttracks?: {
      track?: RawTrack | RawTrack[];
      "@attr"?: { page?: string; totalPages?: string; total?: string };
    };
  };
  if (json.error) {
    throw new Error(`Last.fm error ${json.error}: ${json.message ?? "?"}`);
  }

  const rt = json.recenttracks;
  const attr = rt?.["@attr"];
  const scrobbles: Scrobble[] = [];
  let nowPlaying: NowPlaying | null = null;

  for (const raw of asArray(rt?.track)) {
    const { scrobble, nowPlaying: np } = parseTrack(raw);
    if (scrobble) scrobbles.push(scrobble);
    if (np) nowPlaying = np;
  }

  return {
    scrobbles,
    nowPlaying,
    page: Number(attr?.page ?? 1),
    totalPages: Number(attr?.totalPages ?? 1),
    total: Number(attr?.total ?? 0),
  };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
