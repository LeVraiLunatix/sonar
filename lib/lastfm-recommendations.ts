const API = "https://ws.audioscrobbler.com/2.0/";
// Ces données publiques changent lentement et sont partagées entre les comptes.
// Le cache de fetch évite donc de rappeler Last.fm pour un même artiste.
const LASTFM_CATALOG_TTL = 7 * 24 * 60 * 60;

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
}

async function callLastfm<T>(
  method: string,
  params: Record<string, string>,
): Promise<T> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) throw new Error("LASTFM_API_KEY manquante");

  const query = new URLSearchParams({
    method,
    api_key: apiKey,
    format: "json",
    autocorrect: "1",
    ...params,
  });
  const response = await fetch(`${API}?${query.toString()}`, {
    headers: { "User-Agent": "Sonar/0.1 (personal recommendations)" },
    next: { revalidate: LASTFM_CATALOG_TTL },
  });
  if (!response.ok) {
    throw new Error(`Last.fm HTTP ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as T & { error?: number; message?: string };
  if (json.error) {
    throw new Error(`Last.fm error ${json.error}: ${json.message ?? "?"}`);
  }
  return json;
}

export type SimilarArtist = {
  name: string;
  match: number;
};

export async function similarArtists(artist: string): Promise<SimilarArtist[]> {
  const json = await callLastfm<{
    similarartists?: {
      artist?:
        | { name?: string; match?: string | number }
        | { name?: string; match?: string | number }[];
    };
  }>("artist.getsimilar", { artist, limit: "16" });

  return asArray(json.similarartists?.artist)
    .map((item) => ({
      name: clean(item.name) ?? "",
      match: Math.max(0, Math.min(1, Number(item.match ?? 0))),
    }))
    .filter((item) => item.name && item.match > 0);
}

export type ArtistTopTrack = {
  name: string;
  listeners: number;
};

export async function artistTopTracks(artist: string): Promise<ArtistTopTrack[]> {
  const json = await callLastfm<{
    toptracks?: {
      track?:
        | { name?: string; listeners?: string | number }
        | { name?: string; listeners?: string | number }[];
    };
  }>("artist.gettoptracks", { artist, limit: "20" });

  return asArray(json.toptracks?.track)
    .map((item) => ({
      name: clean(item.name) ?? "",
      listeners: Math.max(0, Number(item.listeners ?? 0)),
    }))
    .filter((item) => item.name);
}

export type ArtistTag = {
  name: string;
  weight: number;
};

export async function artistTopTags(artist: string): Promise<ArtistTag[]> {
  const json = await callLastfm<{
    toptags?: {
      tag?:
        | { name?: string; count?: string | number }
        | { name?: string; count?: string | number }[];
    };
  }>("artist.gettoptags", { artist });

  return asArray(json.toptags?.tag)
    .map((item) => ({
      name: clean(item.name) ?? "",
      weight: Math.max(0, Number(item.count ?? 0)),
    }))
    .filter((item) => item.name && item.weight > 0)
    .slice(0, 10);
}
