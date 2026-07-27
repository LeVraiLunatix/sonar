// Sync incrémental manuel (le cron Vercel fait la même chose automatiquement).
// Usage : npm run sync            → tous les comptes prêts
//         npm run sync -- pseudo  → un seul compte
import { sql } from "../lib/db";
import { runIncremental } from "../lib/ingest";
import { accountsToSync } from "../lib/accounts";

const only = process.argv[2];

try {
  const accounts = only ? [only] : await accountsToSync();
  if (accounts.length === 0) {
    console.log("Aucun compte à synchroniser.");
  }
  for (const account of accounts) {
    await runIncremental(account);
  }
} catch (e) {
  console.error("Sync échoué :", e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
