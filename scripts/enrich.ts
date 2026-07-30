// Enrichissement Deezer : durées de titres + photos d'artistes.
// Usage : npm run enrich
import { sql } from "../lib/db";
import { runEnrich } from "../lib/enrich";

try {
  await runEnrich();
} catch (e) {
  console.error("Enrichissement interrompu :", e);
  console.error("Relance la commande : il reprend où il s'est arrêté.");
  process.exitCode = 1;
} finally {
  await sql.end();
}
