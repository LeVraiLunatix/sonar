// Sync incrémental manuel (le cron Vercel fait la même chose automatiquement).
// Usage : npm run sync
import { sql } from "../lib/db";
import { runIncremental } from "../lib/ingest";

try {
  await runIncremental();
} catch (e) {
  console.error("Sync échoué :", e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
