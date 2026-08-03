import { sql } from "./db";
import { fetchRecent, sleep, type Scrobble } from "./lastfm";
import type { ParsedPlay } from "./spotify-import";
import {
  getAccount,
  markSynced,
  setBackfillState,
  upsertAccount,
  type BackfillStatus,
} from "./accounts";

const PAGE_LIMIT = 200;
const DELAY_MS = 220; // ~5 req/s, usage toléré

function apiKey(): string {
  const key = process.env.LASTFM_API_KEY;
  if (!key) throw new Error("LASTFM_API_KEY manquant");
  return key;
}

/** Insertion en batch pour UN compte, idempotente grâce à l'index unique. */
export async function insertScrobbles(account: string, rows: Scrobble[]): Promise<number> {
  if (rows.length === 0) return 0;
  const values = rows.map((s) => ({
    account,
    played_at: s.played_at,
    track: s.track,
    artist: s.artist,
    album: s.album,
    track_mbid: s.track_mbid,
    artist_mbid: s.artist_mbid,
    album_mbid: s.album_mbid,
    image_url: s.image_url,
    loved: s.loved,
    source: "lastfm",
  }));
  const res = await sql`
    insert into scrobbles ${sql(
      values,
      "account",
      "played_at",
      "track",
      "artist",
      "album",
      "track_mbid",
      "artist_mbid",
      "album_mbid",
      "image_url",
      "loved",
      "source",
    )}
    on conflict (account, played_at, track, artist) do nothing
  `;
  return res.count;
}

/** Insertion en batch de lectures Spotify importées (export RGPD), idempotente. */
export async function insertSpotifyPlays(account: string, plays: ParsedPlay[]): Promise<number> {
  if (plays.length === 0) return 0;
  const values = plays.map((p) => ({
    account,
    played_at: p.played_at,
    track: p.track,
    artist: p.artist,
    album: p.album,
    ms_played: p.ms_played,
    skipped: p.skipped,
    source: "spotify",
  }));
  const res = await sql`
    insert into scrobbles ${sql(
      values,
      "account",
      "played_at",
      "track",
      "artist",
      "album",
      "ms_played",
      "skipped",
      "source",
    )}
    on conflict (account, played_at, track, artist) do nothing
  `;
  return res.count;
}

async function maxPlayedAtUnix(account: string): Promise<number | null> {
  const [row] = await sql<{ ts: Date | null }[]>`
    select max(played_at) as ts from scrobbles
    where account = ${account} and source = 'lastfm'
  `;
  return row?.ts ? Math.floor(new Date(row.ts).getTime() / 1000) : null;
}

export type BackfillProgress = {
  status: BackfillStatus;
  page: number;
  pages: number;
  inserted: number;
  done: boolean;
  error?: string | null;
};

/**
 * Traite UNE TRANCHE du backfill d'un compte, puis rend la main.
 * Les fonctions serverless ont une durée limitée : le client rappelle cette
 * route jusqu'à `done`, ce qui permet d'importer un historique de n'importe
 * quelle taille sans jamais dépasser le budget d'une requête.
 */
export async function backfillChunk(
  account: string,
  opts: { maxPages?: number; budgetMs?: number } = {},
): Promise<BackfillProgress> {
  const maxPages = opts.maxPages ?? 10;
  const budgetMs = opts.budgetMs ?? 20_000;
  const startedAt = Date.now();
  const key = apiKey();

  let acc = (await getAccount(account)) ?? (await upsertAccount(account));
  if (acc.backfill_status === "done") {
    return {
      status: "done",
      page: acc.backfill_page,
      pages: acc.backfill_pages ?? acc.backfill_page,
      inserted: 0,
      done: true,
    };
  }

  // Initialisation : on fige `to` pour que la pagination ne bouge pas pendant l'import.
  if (!acc.backfill_to_ts || !acc.backfill_pages) {
    const to = Math.floor(Date.now() / 1000);
    const head = await fetchRecent({ user: account, apiKey: key, limit: 1, to });
    const pages = Math.max(1, Math.ceil(head.total / PAGE_LIMIT));
    await setBackfillState(account, { status: "running", toTs: to, pages, page: 0, error: null });
    acc = (await getAccount(account))!;
  } else if (acc.backfill_status !== "running") {
    await setBackfillState(account, { status: "running", error: null });
  }

  const pages = acc.backfill_pages ?? 1;
  const toTs = acc.backfill_to_ts ?? Math.floor(Date.now() / 1000);
  let page = acc.backfill_page;
  let inserted = 0;

  try {
    while (page < pages && page - acc.backfill_page < maxPages) {
      if (Date.now() - startedAt > budgetMs) break;
      const next = page + 1;
      const res = await fetchRecent({
        user: account,
        apiKey: key,
        limit: PAGE_LIMIT,
        page: next,
        to: toTs,
      });
      inserted += await insertScrobbles(account, res.scrobbles);
      page = next;
      await setBackfillState(account, { page });
      if (page < pages) await sleep(DELAY_MS);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await setBackfillState(account, { status: "error", error: message });
    return { status: "error", page, pages, inserted, done: false, error: message };
  }

  const done = page >= pages;
  if (done) await setBackfillState(account, { status: "done", error: null });

  return { status: done ? "done" : "running", page, pages, inserted, done };
}

/** Backfill complet en une fois — pour le CLI (pas de limite de durée). */
export async function runBackfill(account: string, log = console.log): Promise<void> {
  let total = 0;
  for (;;) {
    const p = await backfillChunk(account, { maxPages: 25, budgetMs: 60_000 });
    total += p.inserted;
    if (p.error) throw new Error(p.error);
    log(`page ${p.page}/${p.pages} — +${total} lignes`);
    if (p.done) break;
  }
  log(`backfill terminé pour ${account} : ${total} nouvelles lignes.`);
}

/** Sync incrémental d'UN compte : from = dernier scrobble + 1s. */
export async function runIncremental(account: string, log = console.log): Promise<number> {
  const key = apiKey();
  const max = await maxPlayedAtUnix(account);
  const from = max ? max + 1 : undefined;

  let page = 1;
  let inserted = 0;
  let totalPages = 1;
  do {
    const res = await fetchRecent({ user: account, apiKey: key, limit: PAGE_LIMIT, page, from });
    totalPages = res.totalPages;
    inserted += await insertScrobbles(account, res.scrobbles);
    page++;
    if (page <= totalPages) await sleep(DELAY_MS);
  } while (page <= totalPages);

  await markSynced(account);
  log(`sync ${account} : +${inserted} lignes (from=${from ?? "origine"}).`);
  return inserted;
}
