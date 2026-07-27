// Applique db/schema.sql à la base pointée par DATABASE_URL.
// Usage : npm run db:schema   (charge .env.local via --env-file)
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquant. Renseigne .env.local (voir .env.local.example).");
  process.exit(1);
}

const schema = await readFile(join(__dirname, "..", "db", "schema.sql"), "utf8");
const sql = postgres(url, { ssl: "require", max: 1 });

try {
  await sql.unsafe(schema);
  console.log("Schéma appliqué.");
} catch (e) {
  console.error("Échec de l'application du schéma :", e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
