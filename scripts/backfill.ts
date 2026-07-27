// Backfill one-shot de tout l'historique Last.fm.
// Usage : npm run backfill   (charge .env.local via --env-file)
import { sql } from "../lib/db";
import { runBackfill } from "../lib/ingest";

try {
  await runBackfill();
} catch (e) {
  console.error("Backfill interrompu :", e);
  console.error("Relance `npm run backfill` : il reprendra à la dernière page traitée.");
  process.exitCode = 1;
} finally {
  await sql.end();
}
