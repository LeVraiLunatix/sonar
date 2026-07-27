import { NextResponse } from "next/server";
import { fetchRecent } from "@/lib/lastfm";

// Le morceau en cours n'est jamais en base (pas de date) : on le lit en direct.
export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.LASTFM_API_KEY;
  const user = process.env.LASTFM_USER;
  if (!apiKey || !user) {
    return NextResponse.json({ nowPlaying: null, last: null });
  }
  try {
    const page = await fetchRecent({ user, apiKey, limit: 1 });
    return NextResponse.json({
      nowPlaying: page.nowPlaying,
      last: page.scrobbles[0]
        ? {
            track: page.scrobbles[0].track,
            artist: page.scrobbles[0].artist,
            played_at: page.scrobbles[0].played_at.toISOString(),
          }
        : null,
    });
  } catch {
    return NextResponse.json({ nowPlaying: null, last: null });
  }
}
