import postgres from "postgres";

/**
 * Connexion Postgres paresseuse (postgres.js).
 * On ne crée la connexion qu'à la PREMIÈRE utilisation : importer ce module
 * (par ex. via lib/stats) ne doit rien tenter tant qu'aucune requête n'est
 * lancée — sinon le mode fixtures (sans DATABASE_URL) planterait à l'import.
 * Une seule instance est réutilisée en dev pour survivre au hot-reload.
 */
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

function create(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL manquant. Copie .env.local.example en .env.local et renseigne la chaîne Neon.",
    );
  }
  const client = postgres(url, { max: 5, ssl: "require" });
  if (process.env.NODE_ENV !== "production") globalForDb.sql = client;
  return client;
}

function get(): postgres.Sql {
  return globalForDb.sql ?? create();
}

// Proxy : se comporte exactement comme l'instance postgres.js (tag `sql\`\``,
// `sql(values, ...cols)`, `sql.unsafe`, `sql.end`…) mais n'initialise la
// connexion qu'au premier accès réel.
export const sql: postgres.Sql = new Proxy(function () {} as unknown as postgres.Sql, {
  apply(_target, _thisArg, args: unknown[]) {
    return (get() as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_target, prop) {
    const value = (get() as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof value === "function" ? value.bind(get()) : value;
  },
});
