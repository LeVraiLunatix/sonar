import { NextResponse } from "next/server";
import { fetchRecent } from "@/lib/lastfm";
import { resolveAccount } from "@/lib/session";
import { verifyWidgetKey, widgetData } from "@/lib/widget";

/**
 * Résumé des écoutes pour un tableau de bord externe (Daycord).
 * Public au sens du middleware, mais rien ne sort sans une clé de widget
 * valide (`Authorization: Bearer w1.…`) : la clé désigne le compte.
 * En dev local sans AUTH_SECRET, le compte propriétaire répond sans clé.
 *
 * CORS ouvert : la clé voyage dans un en-tête, jamais dans un cookie, donc un
 * autre site ne peut rien lire sans la connaître.
 */
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization",
  "Access-Control-Max-Age": "86400",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  const account = key
    ? await verifyWidgetKey(key)
    : process.env.AUTH_SECRET
      ? null
      : await resolveAccount();

  if (!account) {
    return NextResponse.json({ error: "clé invalide" }, { status: 401, headers: CORS });
  }

  try {
    const apiKey = process.env.LASTFM_API_KEY;
    const [data, live] = await Promise.all([
      widgetData(account),
      apiKey
        ? fetchRecent({ user: account, apiKey, limit: 1 }).catch(() => null)
        : Promise.resolve(null),
    ]);
    const np = live?.nowPlaying ?? null;
    return NextResponse.json(
      {
        ...data,
        nowPlaying: np ? { track: np.track, artist: np.artist, image: np.image_url } : null,
      },
      { headers: { ...CORS, "Cache-Control": "private, max-age=60" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500, headers: CORS },
    );
  }
}
