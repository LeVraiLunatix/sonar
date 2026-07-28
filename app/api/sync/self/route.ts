import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { getAccount } from "@/lib/accounts";
import { runIncremental } from "@/lib/ingest";

/**
 * Sync « opportuniste » du compte de la session, déclenché à l'ouverture du site.
 *
 * Le cron ne passe qu'une fois par jour (limite du plan Vercel gratuit) : sans
 * ça, le compteur et les derniers scrobbles resteraient figés jusqu'au matin.
 * Le sync incrémental est léger — il repart du dernier scrobble connu — donc
 * on peut se permettre de l'appeler à chaque visite, avec un garde-fou de
 * fréquence pour ne pas marteler l'API Last.fm.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Délai minimum entre deux syncs déclenchés par la navigation. */
const MIN_INTERVAL_MS = 60_000;

export async function POST() {
  const account = await currentUser();
  if (!account) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  try {
    const acc = await getAccount(account);
    // L'import initial n'est pas fini : c'est /onboarding qui s'en occupe.
    if (!acc || acc.backfill_status !== "done") {
      return NextResponse.json({ skipped: "backfill", inserted: 0 });
    }

    if (acc.last_sync_at) {
      const age = Date.now() - new Date(acc.last_sync_at).getTime();
      if (age < MIN_INTERVAL_MS) {
        return NextResponse.json({ skipped: "recent", inserted: 0 });
      }
    }

    const inserted = await runIncremental(account, () => {});
    return NextResponse.json({ inserted });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), inserted: 0 },
      { status: 500 },
    );
  }
}
