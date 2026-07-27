// Applique les migrations SQL de db/migrations dans l'ordre.
// Usage : npm run db:migrate
//
// Le placeholder :owner est remplacé par LASTFM_USER (échappé), pour que les
// données existantes soient rattachées au compte propriétaire.
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const url = process.env.DATABASE_URL;
const owner = process.env.LASTFM_USER;
if (!url) {
  console.error("DATABASE_URL manquant (voir .env.local).");
  process.exit(1);
}
if (!owner) {
  console.error("LASTFM_USER manquant : impossible de rattacher les données existantes.");
  process.exit(1);
}

/** Échappe une chaîne en littéral SQL ('O''Brien'). */
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

const sql = postgres(url, { ssl: "require", max: 1 });

try {
  // Journal des migrations déjà appliquées.
  await sql`
    create table if not exists schema_migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    )
  `;
  const done = new Set(
    (await sql`select name from schema_migrations`).map((r) => r.name),
  );

  const dir = join(root, "db", "migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  let applied = 0;
  for (const file of files) {
    if (done.has(file)) {
      console.log(`· ${file} (déjà appliquée)`);
      continue;
    }
    const raw = await readFile(join(dir, file), "utf8");
    const body = raw.replaceAll(":owner", lit(owner));
    console.log(`→ application de ${file} …`);
    // Transaction : en cas d'erreur, la base revient à son état d'origine.
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (name) values (${file})`;
    });
    applied++;
    console.log(`  ✓ ${file}`);
  }

  console.log(
    applied === 0
      ? "Base déjà à jour."
      : `${applied} migration(s) appliquée(s). Compte propriétaire : ${owner}`,
  );
} catch (e) {
  console.error("Échec de la migration :", e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
