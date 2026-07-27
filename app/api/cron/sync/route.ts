import { NextResponse } from "next/server";
import { runIncremental } from "@/lib/ingest";
import { accountsToSync } from "@/lib/accounts";

// Appelé par Vercel Cron (voir vercel.json). Synchronise TOUS les comptes
// dont l'import initial est terminé.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  // Vercel Cron envoie "Authorization: Bearer <CRON_SECRET>"
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const results: { account: string; inserted?: number; error?: string }[] = [];

  try {
    const accounts = await accountsToSync();
    for (const account of accounts) {
      // Garde une marge sous la durée max : les comptes restants passeront
      // au prochain déclenchement.
      if (Date.now() - started > 45_000) break;
      try {
        const inserted = await runIncremental(account, () => {});
        results.push({ account, inserted });
      } catch (e) {
        results.push({ account, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return NextResponse.json({ ok: true, synced: results.length, results });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
