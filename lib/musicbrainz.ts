const MUSICBRAINZ_API = "https://musicbrainz.org/ws/2";
const CATALOG_TTL = 3 * 24 * 60 * 60;

const clean = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const normalise = (value: string): string =>
  value
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const escapeQuery = (value: string): string =>
  value.replace(/[+\-&|!(){}\[\]^"~*?:\\/]/g, "\\$&");

export type ReleaseGroup = {
  id: string;
  artist: string;
  title: string;
  type: "Album" | "Single" | "EP";
  date: string;
  url: string;
};

/**
 * Discographie publique d'un artiste. MusicBrainz change lentement : trois
 * jours de cache suffisent pour voir les nouvelles annonces sans solliciter
 * son API à chaque ouverture d'Explorer.
 */
export async function artistsReleaseGroups(artists: string[]): Promise<ReleaseGroup[]> {
  const wanted = [...new Set(artists.map((artist) => artist.trim()).filter(Boolean))].slice(0, 8);
  if (wanted.length === 0) return [];
  const query = wanted
    .map((artist) => `artist:\"${escapeQuery(artist)}\"`)
    .join(" OR ");
  const url = new URL(`${MUSICBRAINZ_API}/release-group`);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", "100");
  url.searchParams.set("fmt", "json");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Sonar/0.1 (https://soonaar.vercel.app)",
    },
    signal: AbortSignal.timeout(5_000),
    next: { revalidate: CATALOG_TTL },
  });
  if (!response.ok) throw new Error(`MusicBrainz HTTP ${response.status}`);

  const json = (await response.json()) as {
    "release-groups"?: Array<{
      id?: string;
      title?: string;
      "primary-type"?: string;
      "first-release-date"?: string;
      "artist-credit"?: Array<{ name?: string; artist?: { name?: string } }>;
    }>;
  };
  const expected = new Set(wanted.map(normalise));

  return (json["release-groups"] ?? [])
    .map((group) => {
      const credited = clean(group["artist-credit"]?.[0]?.artist?.name)
        || clean(group["artist-credit"]?.[0]?.name);
      const type = clean(group["primary-type"]);
      const id = clean(group.id);
      const title = clean(group.title);
      const date = clean(group["first-release-date"]);
      if (
        !id
        || !title
        || !/^\d{4}-\d{2}-\d{2}$/.test(date)
        || !expected.has(normalise(credited))
        || !["Album", "Single", "EP"].includes(type)
      ) return null;
      return {
        id,
        artist: credited,
        title,
        type: type as ReleaseGroup["type"],
        date,
        url: `https://musicbrainz.org/release-group/${id}`,
      };
    })
    .filter((group): group is ReleaseGroup => group !== null);
}
