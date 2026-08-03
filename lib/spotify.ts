/**
 * Client Spotify Web API — top titres/artistes et lecture en cours.
 * Contrairement à Last.fm, Spotify ne donne ni l'historique complet ni
 * d'agrégations sur mesure : seulement trois fenêtres glissantes fixées par
 * Spotify lui-même (short_term ≈ 4 semaines, medium_term ≈ 6 mois,
 * long_term ≈ plusieurs années) et les ~50 dernières écoutes.
 */

import { getSpotifyTokens, updateSpotifyAccessToken } from "./accounts";
import { refreshAccessToken } from "./spotify-auth";

const API = "https://api.spotify.com/v1";

export type TimeRange = "short_term" | "medium_term" | "long_term";

export type SpotifyImage = { url: string; width: number | null; height: number | null };

export type SpotifyTrack = {
  id: string;
  name: string;
  artists: string;
  album: string;
  image_url: string | null;
  duration_ms: number;
  popularity: number;
  url: string;
};

export type SpotifyArtist = {
  id: string;
  name: string;
  genres: string[];
  image_url: string | null;
  popularity: number;
  url: string;
};

export type NowPlaying = {
  track: string;
  artists: string;
  album: string;
  image_url: string | null;
  is_playing: boolean;
  url: string;
} | null;

function pickImage(images: SpotifyImage[] | undefined): string | null {
  if (!images || images.length === 0) return null;
  return images[0]?.url ?? null;
}

async function api<T>(accessToken: string, path: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 204) return null; // ex. rien en cours de lecture
  if (!res.ok) {
    throw new Error(`Spotify HTTP ${res.status} ${res.statusText} (${path})`);
  }
  return (await res.json()) as T;
}

type RawTrack = {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: SpotifyImage[] };
  duration_ms: number;
  popularity: number;
  external_urls: { spotify: string };
};

type RawArtist = {
  id: string;
  name: string;
  genres: string[];
  images: SpotifyImage[];
  popularity: number;
  external_urls: { spotify: string };
};

export async function getTopTracks(
  accessToken: string,
  range: TimeRange,
  limit = 20,
): Promise<SpotifyTrack[]> {
  const json = await api<{ items: RawTrack[] }>(
    accessToken,
    `/me/top/tracks?time_range=${range}&limit=${limit}`,
  );
  return (json?.items ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    artists: t.artists.map((a) => a.name).join(", "),
    album: t.album.name,
    image_url: pickImage(t.album.images),
    duration_ms: t.duration_ms,
    popularity: t.popularity,
    url: t.external_urls.spotify,
  }));
}

export async function getTopArtists(
  accessToken: string,
  range: TimeRange,
  limit = 20,
): Promise<SpotifyArtist[]> {
  const json = await api<{ items: RawArtist[] }>(
    accessToken,
    `/me/top/artists?time_range=${range}&limit=${limit}`,
  );
  return (json?.items ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    genres: a.genres,
    image_url: pickImage(a.images),
    popularity: a.popularity,
    url: a.external_urls.spotify,
  }));
}

export async function getCurrentlyPlaying(accessToken: string): Promise<NowPlaying> {
  const json = await api<{
    is_playing: boolean;
    item: RawTrack | null;
  }>(accessToken, "/me/player/currently-playing");
  if (!json?.item) return null;
  return {
    track: json.item.name,
    artists: json.item.artists.map((a) => a.name).join(", "),
    album: json.item.album.name,
    image_url: pickImage(json.item.album.images),
    is_playing: json.is_playing,
    url: json.item.external_urls.spotify,
  };
}

export async function getProfile(
  accessToken: string,
): Promise<{ id: string; display_name: string | null }> {
  const json = await api<{ id: string; display_name: string | null }>(accessToken, "/me");
  if (!json) throw new Error("Spotify /me : réponse vide");
  return json;
}

/**
 * Jeton d'accès valide pour un compte, ou null si Spotify n'est pas connecté.
 * Rafraîchit et persiste automatiquement si le jeton stocké a expiré.
 */
export async function getValidAccessToken(account: string): Promise<string | null> {
  const tokens = await getSpotifyTokens(account);
  if (!tokens) return null;

  const expiresAt = tokens.expiresAt ? new Date(tokens.expiresAt).getTime() : 0;
  const marginMs = 60_000; // renouvelle un peu avant l'expiration réelle
  if (expiresAt - marginMs > Date.now()) return tokens.accessToken;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const refreshed = await refreshAccessToken(clientId, clientSecret, tokens.refreshToken);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await updateSpotifyAccessToken(account, refreshed.access_token, newExpiresAt);
  return refreshed.access_token;
}
