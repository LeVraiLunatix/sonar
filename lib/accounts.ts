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

/** Comptes consultables dont le pseudo correspond à la recherche. */
export async function searchAccounts(
  q: string,
  exclude: string,
  limit = 6,
): Promise<{ username: string; scrobbles: number }[]> {
  return sql<{ username: string; scrobbles: number }[]>`
    select a.username,
           (select count(*) from scrobbles s where s.account = a.username)::int as scrobbles
    from accounts a
    where a.public_profile
      and a.backfill_status = 'done'
      and a.username_key <> ${exclude.toLowerCase()}
      and a.username_key like ${`%${q.trim().toLowerCase()}%`}
    order by scrobbles desc
    limit ${limit}
  `;
}

/** Un compte est-il consultable par les autres ? Renvoie sa graphie exacte. */
export async function publicAccount(username: string): Promise<string | null> {
  const [row] = await sql<{ username: string }[]>`
    select username from accounts
    where username_key = ${username.toLowerCase()}
      and public_profile and backfill_status = 'done'
  `;
  return row?.username ?? null;
}

export async function setProfileVisibility(
  username: string,
  isPublic: boolean,
): Promise<void> {
  await sql`
    update accounts set public_profile = ${isPublic}
    where username_key = ${username.toLowerCase()}
  `;
}

export async function isProfilePublic(username: string): Promise<boolean> {
  const [row] = await sql<{ public_profile: boolean }[]>`
    select public_profile from accounts where username_key = ${username.toLowerCase()}
  `;
  return row?.public_profile ?? true;
}

export async function markSynced(username: string): Promise<void> {
  await sql`
    update accounts set last_sync_at = now()
    where username_key = ${username.toLowerCase()}
  `;
}

export type SpotifyTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  spotifyUserId: string | null;
  displayName: string | null;
};

/** Jetons Spotify du compte, ou null si non connecté. Lecture côté serveur uniquement. */
export async function getSpotifyTokens(username: string): Promise<SpotifyTokens | null> {
  const [row] = await sql<
    {
      spotify_access_token: string | null;
      spotify_refresh_token: string | null;
      spotify_token_expires_at: string | null;
      spotify_user_id: string | null;
      spotify_display_name: string | null;
    }[]
  >`
    select spotify_access_token, spotify_refresh_token, spotify_token_expires_at,
           spotify_user_id, spotify_display_name
    from accounts where username_key = ${username.toLowerCase()}
  `;
  if (!row?.spotify_access_token || !row.spotify_refresh_token) return null;
  return {
    accessToken: row.spotify_access_token,
    refreshToken: row.spotify_refresh_token,
    expiresAt: row.spotify_token_expires_at ?? new Date(0).toISOString(),
    spotifyUserId: row.spotify_user_id,
    displayName: row.spotify_display_name,
  };
}

/** Enregistre les jetons obtenus au callback OAuth (première connexion). */
export async function setSpotifyTokens(
  username: string,
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    spotifyUserId: string;
    displayName: string | null;
  },
): Promise<void> {
  await sql`
    update accounts set
      spotify_access_token = ${tokens.accessToken},
      spotify_refresh_token = ${tokens.refreshToken},
      spotify_token_expires_at = ${tokens.expiresAt},
      spotify_user_id = ${tokens.spotifyUserId},
      spotify_display_name = ${tokens.displayName}
    where username_key = ${username.toLowerCase()}
  `;
}

/** Met à jour uniquement le jeton d'accès (rafraîchissement silencieux). */
export async function updateSpotifyAccessToken(
  username: string,
  accessToken: string,
  expiresAt: string,
): Promise<void> {
  await sql`
    update accounts set
      spotify_access_token = ${accessToken},
      spotify_token_expires_at = ${expiresAt}
    where username_key = ${username.toLowerCase()}
  `;
}

/** Déconnecte Spotify (garde le compte Sonar/Last.fm intact). */
export async function clearSpotifyTokens(username: string): Promise<void> {
  await sql`
    update accounts set
      spotify_access_token = null,
      spotify_refresh_token = null,
      spotify_token_expires_at = null,
      spotify_user_id = null,
      spotify_display_name = null
    where username_key = ${username.toLowerCase()}
  `;
}

/** Compte déjà créé pour cet identifiant Spotify (reconnexion), ou null. */
export async function accountBySpotifyId(spotifyUserId: string): Promise<string | null> {
  const [row] = await sql<{ username: string }[]>`
    select username from accounts where spotify_user_id = ${spotifyUserId}
  `;
  return row?.username ?? null;
}

/**
 * Crée un compte Sonar dont l'identité est Spotify — pas de Last.fm associé.
 * Rien à importer (l'API Spotify ne donne pas d'historique) : le compte est
 * marqué "import terminé" dès la création, pour ne jamais passer par /onboarding.
 */
export async function createSpotifyAccount(opts: {
  spotifyUserId: string;
  displayName: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}): Promise<string> {
  const base =
    (opts.displayName ?? "").trim().slice(0, 64) || `spotify-${opts.spotifyUserId.slice(0, 8)}`;

  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base} ${attempt + 1}`;
    const [row] = await sql<{ username: string }[]>`
      insert into accounts (
        username, username_key, backfill_status,
        spotify_access_token, spotify_refresh_token, spotify_token_expires_at,
        spotify_user_id, spotify_display_name
      )
      values (
        ${candidate}, ${candidate.toLowerCase()}, 'done',
        ${opts.accessToken}, ${opts.refreshToken}, ${opts.expiresAt},
        ${opts.spotifyUserId}, ${opts.displayName}
      )
      on conflict (username_key) do nothing
      returning username
    `;
    if (row) return row.username;
  }
  throw new Error("impossible de créer un pseudo Spotify unique");
}
