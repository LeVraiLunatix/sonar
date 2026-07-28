import { sql } from "./db";

/** État d'import initial d'un compte. */
export type BackfillStatus = "pending" | "running" | "done" | "error";

export type Account = {
  username: string;
  backfill_status: BackfillStatus;
  backfill_page: number;
  backfill_pages: number | null;
  backfill_to_ts: number | null;
  backfill_error: string | null;
  last_sync_at: string | null;
};

/** Crée le compte s'il n'existe pas, met à jour la dernière visite. */
export async function upsertAccount(username: string): Promise<Account> {
  const [row] = await sql<Account[]>`
    insert into accounts (username, username_key, last_seen_at)
    values (${username}, ${username.toLowerCase()}, now())
    on conflict (username_key) do update set last_seen_at = now()
    returning username, backfill_status, backfill_page, backfill_pages,
              backfill_to_ts, backfill_error, last_sync_at
  `;
  return row;
}

export async function getAccount(username: string): Promise<Account | null> {
  const [row] = await sql<Account[]>`
    select username, backfill_status, backfill_page, backfill_pages,
           backfill_to_ts, backfill_error, last_sync_at
    from accounts where username_key = ${username.toLowerCase()}
  `;
  return row ?? null;
}

/** Tous les comptes dont l'import initial est terminé (pour le cron). */
export async function accountsToSync(): Promise<string[]> {
  const rows = await sql<{ username: string }[]>`
    select username from accounts where backfill_status = 'done' order by username
  `;
  return rows.map((r) => r.username);
}

export async function setBackfillState(
  username: string,
  patch: Partial<{
    status: BackfillStatus;
    page: number;
    pages: number;
    toTs: number;
    error: string | null;
  }>,
): Promise<void> {
  await sql`
    update accounts set
      backfill_status = coalesce(${patch.status ?? null}, backfill_status),
      backfill_page   = coalesce(${patch.page ?? null}, backfill_page),
      backfill_pages  = coalesce(${patch.pages ?? null}, backfill_pages),
      backfill_to_ts  = coalesce(${patch.toTs ?? null}, backfill_to_ts),
      backfill_error  = ${patch.error === undefined ? sql`backfill_error` : patch.error}
    where username_key = ${username.toLowerCase()}
  `;
}

/**
 * Enregistre la clé de session Last.fm du compte (méthodes d'écriture).
 * ⚠️ Identifiant : ne jamais renvoyer cette valeur au client.
 */
export async function setSessionKey(username: string, key: string): Promise<void> {
  await sql`
    update accounts set lastfm_session_key = ${key}
    where username_key = ${username.toLowerCase()}
  `;
}

/** Lecture côté serveur uniquement. */
export async function getSessionKey(username: string): Promise<string | null> {
  const [row] = await sql<{ lastfm_session_key: string | null }[]>`
    select lastfm_session_key from accounts where username_key = ${username.toLowerCase()}
  `;
  return row?.lastfm_session_key ?? null;
}

export async function markSynced(username: string): Promise<void> {
  await sql`
    update accounts set last_sync_at = now()
    where username_key = ${username.toLowerCase()}
  `;
}
