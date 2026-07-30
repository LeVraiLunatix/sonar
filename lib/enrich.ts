import { sql } from "./db";
import { sleep } from "./lastfm";
import { artistImage, trackDuration } from "./deezer";

/**
 * Enrichissement depuis Deezer : durées de titres et photos d'artistes.
 *
 * Deux principes :
 *  - on ne résout chaque titre / artiste QU'UNE FOIS, jamais à chaque calcul ;
 *  - un échec est mémorisé (`source = 'unresolved'`) pour ne pas réinterroger
 *    Deezer en boucle sur des titres introuvables.
 *
 * Comme le backfill, le travail est découpé en tranches : une fonction
 * serverless ne peut pas tourner longtemps.
 */

const DELAY_MS = 220; // ~5 req/s, courtois avec une API publique gratuite

export type EnrichProgress = {
  tracksDone: number;
  tracksLeft: number;
  artistsDone: number;
  artistsLeft: number;
  finished: boolean;
};

/** Titres présents dans les scrobbles mais absents de la table `tracks`. */
async function pendingTracks(limit: number) {
  return sql<{ artist: string; track: string; ak: string; tk: string }[]>`
    select
      mode() within group (order by s.artist) as artist,
      mode() within group (order by s.track)  as track,
      lower(s.artist) as ak,
      lower(s.track)  as tk
    from scrobbles s
    left join tracks t
      on t.artist_key = lower(s.artist) and t.track_key = lower(s.track)
    where t.artist_key is null
    group by lower(s.artist), lower(s.track)
    order by count(*) desc          -- les plus écoutés d'abord : gain immédiat
    limit ${limit}
  `;
}

/** Artistes sans photo enregistrée. */
async function pendingArtists(limit: number) {
  return sql<{ artist: string; ak: string }[]>`
    select
      mode() within group (order by s.artist) as artist,
      lower(s.artist) as ak
    from scrobbles s
    left join artist_images ai on ai.artist_key = lower(s.artist)
    where ai.artist_key is null
    group by lower(s.artist)
    order by count(*) desc
    limit ${limit}
  `;
}

async function countPending(): Promise<{ tracks: number; artists: number }> {
  const [row] = await sql<{ tracks: number; artists: number }[]>`
    select
      (select count(*) from (
        select 1 from scrobbles s
        left join tracks t on t.artist_key = lower(s.artist) and t.track_key = lower(s.track)
        where t.artist_key is null
        group by lower(s.artist), lower(s.track)
      ) x)::int as tracks,
      (select count(*) from (
        select 1 from scrobbles s
        left join artist_images ai on ai.artist_key = lower(s.artist)
        where ai.artist_key is null
        group by lower(s.artist)
      ) y)::int as artists
  `;
  return { tracks: row?.tracks ?? 0, artists: row?.artists ?? 0 };
}

/**
 * Traite une tranche : résout quelques titres et quelques artistes.
 * Renvoie la progression pour que l'appelant sache s'il doit continuer.
 */
export async function enrichChunk(
  opts: { tracks?: number; artists?: number; budgetMs?: number } = {},
): Promise<EnrichProgress> {
  const maxTracks = opts.tracks ?? 40;
  const maxArtists = opts.artists ?? 15;
  const budgetMs = opts.budgetMs ?? 20_000;
  const startedAt = Date.now();

  let tracksDone = 0;
  let artistsDone = 0;

  for (const row of await pendingTracks(maxTracks)) {
    if (Date.now() - startedAt > budgetMs) break;
    let ms: number | null = null;
    try {
      ms = await trackDuration(row.artist, row.track);
    } catch {
      /* réseau : on réessaiera au prochain passage */
      await sleep(DELAY_MS);
      continue;
    }
    await sql`
      insert into tracks (artist_key, track_key, duration_ms, source, updated_at)
      values (${row.ak}, ${row.tk}, ${ms}, ${ms ? "deezer" : "unresolved"}, now())
      on conflict (artist_key, track_key) do update
        set duration_ms = excluded.duration_ms,
            source = excluded.source,
            updated_at = now()
    `;
    tracksDone++;
    await sleep(DELAY_MS);
  }

  for (const row of await pendingArtists(maxArtists)) {
    if (Date.now() - startedAt > budgetMs + 10_000) break;
    let img: string | null = null;
    try {
      img = await artistImage(row.artist);
    } catch {
      await sleep(DELAY_MS);
      continue;
    }
    await sql`
      insert into artist_images (artist_key, image_url, source, updated_at)
      values (${row.ak}, ${img}, ${img ? "deezer" : "unresolved"}, now())
      on conflict (artist_key) do update
        set image_url = excluded.image_url,
            source = excluded.source,
            updated_at = now()
    `;
    artistsDone++;
    await sleep(DELAY_MS);
  }

  const left = await countPending();
  return {
    tracksDone,
    tracksLeft: left.tracks,
    artistsDone,
    artistsLeft: left.artists,
    finished: left.tracks === 0 && left.artists === 0,
  };
}

/** Enrichissement complet — pour le CLI, sans limite de durée. */
export async function runEnrich(log = console.log): Promise<void> {
  let totalTracks = 0;
  let totalArtists = 0;
  for (;;) {
    const p = await enrichChunk({ tracks: 60, artists: 25, budgetMs: 60_000 });
    totalTracks += p.tracksDone;
    totalArtists += p.artistsDone;
    log(
      `+${p.tracksDone} titres, +${p.artistsDone} artistes · ` +
        `restants : ${p.tracksLeft} titres, ${p.artistsLeft} artistes`,
    );
    if (p.finished) break;
    if (p.tracksDone === 0 && p.artistsDone === 0) {
      log("aucune progression sur cette tranche, arrêt.");
      break;
    }
  }
  log(`terminé : ${totalTracks} titres et ${totalArtists} artistes résolus.`);
}
