import { sql } from "./db";
import { fetchRecent, sleep, type Scrobble } from "./lastfm";

const PAGE_LIMIT = 200;
const DELAY_MS = 220; // ~5 req/s, usage toléré

function creds() {
  const apiKey = process.env.LASTFM_API_KEY;
  const user = process.env.LASTFM_USER;
  if (!apiKey || !user) {
    throw new Error("LASTFM_API_KEY / LASTFM_USER manquants dans .env.local");
  }
  return { apiKey, user };
}

/** Insertion en batch, idempotente grâce à la contrainte unique. */
export async function insertScrobbles(rows: Scrobble[]): Promise<number> {
  if (rows.length === 0) return 0;
  const values = rows.map((s) => ({
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
    on conflict (played_at, track, artist) do nothing
  `;
  return res.count;
}

async function maxPlayedAtUnix(): Promise<number | null> {
  const [row] = await sql<{ ts: Date | null }[]>`
    select max(played_at) as ts from scrobbles where source = 'lastfm'
  `;
  return row?.ts ? Math.floor(new Date(row.ts).getTime() / 1000) : null;
}

/**
 * Backfill initial. Fige `to` au lancement pour que la pagination ne bouge pas.
 * Reprise sur erreur : la dernière page traitée est stockée dans ingest_state.
 */
export async function runBackfill(log = console.log): Promise<void> {
  const { apiKey, user } = creds();

  let [state] = await sql<{ to_ts: number; last_page: number; total_pages: number }[]>`
    select to_ts, last_page, total_pages from ingest_state where id = 'backfill'
  `;

  if (!state) {
    const to = Math.floor(Date.now() / 1000);
    const head = await fetchRecent({ user, apiKey, limit: 1, to });
    log(`total scrobbles annoncés : ${head.total}`);
    const totalPages = Math.max(1, Math.ceil(head.total / PAGE_LIMIT));
    await sql`
      insert into ingest_state (id, to_ts, last_page, total_pages, updated_at)
      values ('backfill', ${to}, 0, ${totalPages}, now())
      on conflict (id) do update set to_ts = excluded.to_ts,
        total_pages = excluded.total_pages, updated_at = now()
    `;
    state = { to_ts: to, last_page: 0, total_pages: totalPages };
  } else {
    log(`reprise du backfill à la page ${state.last_page + 1}/${state.total_pages}`);
  }

  let inserted = 0;
  for (let page = state.last_page + 1; page <= state.total_pages; page++) {
    const res = await fetchRecent({ user, apiKey, limit: PAGE_LIMIT, page, to: state.to_ts });
    const n = await insertScrobbles(res.scrobbles);
    inserted += n;
    await sql`update ingest_state set last_page = ${page}, updated_at = now() where id = 'backfill'`;
    if (page % 10 === 0 || page === state.total_pages) {
      log(`page ${page}/${state.total_pages} — +${inserted} lignes`);
    }
    await sleep(DELAY_MS);
  }
  log(`backfill terminé : ${inserted} nouvelles lignes.`);
}

/** Sync incrémental : from = dernier scrobble + 1s, pagination jusqu'à épuisement. */
export async function runIncremental(log = console.log): Promise<number> {
  const { apiKey, user } = creds();
  const max = await maxPlayedAtUnix();
  const from = max ? max + 1 : undefined;

  let page = 1;
  let inserted = 0;
  let totalPages = 1;
  do {
    const res = await fetchRecent({ user, apiKey, limit: PAGE_LIMIT, page, from });
    totalPages = res.totalPages;
    inserted += await insertScrobbles(res.scrobbles);
    page++;
    if (page <= totalPages) await sleep(DELAY_MS);
  } while (page <= totalPages);

  log(`sync : +${inserted} lignes (from=${from ?? "origine"}).`);
  return inserted;
}
