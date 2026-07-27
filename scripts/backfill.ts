// Backfill de l'historique Last.fm d'un compte.
// Usage : npm run backfill            → le compte LASTFM_USER
//         npm run backfill -- pseudo  → un autre compte
import { sql } from "../lib/db";
import { runBackfill } from "../lib/ingest";
import { upsertAccount } from "../lib/accounts";

const account = process.argv[2] ?? process.env.LASTFM_USER;
if (!account) {
  console.error("Aucun compte : renseigne LASTFM_USER ou passe un pseudo en argument.");
  process.exit(1);
}

try {
  await upsertAccount(account);
  await runBackfill(account);
} catch (e) {
  console.error("Backfill interrompu :", e);
  console.error("Relance la commande : il reprendra à la dernière page traitée.");
  process.exitCode = 1;
} finally {
  await sql.end();
}
