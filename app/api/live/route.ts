import { NextResponse } from "next/server";
import { fetchRecent } from "@/lib/lastfm";
import { resolveAccount } from "@/lib/session";
import { APP_TZ } from "@/lib/constants";

/**
 * Surface « temps réel » lue DIRECTEMENT chez Last.fm, sans passer par la base :
 * morceau en cours, derniers scrobbles, et total du jour.
 *
 * Pourquoi ne pas tout lire ici ? Les endpoints de stats de Last.fm n'acceptent
 * que des périodes figées (7day, 1month, …) : impossible d'obtenir un mois
 * précis, une journée heure par heure, une série ou une comparaison. Ces
 * agrégations restent calculées en SQL sur la base. Cette route ne sert que
 * l'instantané, là où la fraîcheur compte plus que la profondeur.
 */
export const dynamic = "force-dynamic";

/** Minuit à Paris (aujourd'hui), en secondes unix. */
function parisMidnightUnix(): number {
  const now = new Date();
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  // décalage de Paris à cet instant, pour convertir la date locale en UTC
  const asUtc = new Date(`${ymd}T00:00:00Z`).getTime();
  const offsetMs =
    new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime() -
    new Date(now.toLocaleString("en-US", { timeZone: APP_TZ })).getTime();
  return Math.floor((asUtc + offsetMs) / 1000);
}

export async function GET() {
  const apiKey = process.env.LASTFM_API_KEY;
  const user = await resolveAccount();
  if (!apiKey || !user) {
    return NextResponse.json({ nowPlaying: null, recent: [], todayCount: null });
  }

  try {
    const [head, today] = await Promise.all([
      fetchRecent({ user, apiKey, limit: 12 }),
      fetchRecent({ user, apiKey, limit: 1, from: parisMidnightUnix() }),
    ]);

    return NextResponse.json({
      nowPlaying: head.nowPlaying,
      recent: head.scrobbles.slice(0, 12).map((s) => ({
        played_at: s.played_at.toISOString(),
        track: s.track,
        artist: s.artist,
        album: s.album,
        image_url: s.image_url,
      })),
      // `@attr.total` de la plage = nombre de scrobbles depuis minuit
      todayCount: today.total,
    });
  } catch {
    return NextResponse.json({ nowPlaying: null, recent: [], todayCount: null });
  }
}
