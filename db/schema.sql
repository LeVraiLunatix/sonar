-- ─────────────────────────────────────────────────────────────
-- Sonar — schéma Postgres
-- Un seul schéma accepte Last.fm (flux vivant) ET les exports RGPD
-- (Spotify / Apple Music) via la colonne `source`.
-- ─────────────────────────────────────────────────────────────

create table if not exists scrobbles (
  id           bigserial primary key,
  played_at    timestamptz not null,
  track        text not null,
  artist       text not null,
  album        text,
  track_mbid   text,
  artist_mbid  text,
  album_mbid   text,
  image_url    text,
  loved        boolean not null default false,

  -- provenance : 'lastfm' | 'spotify' | 'applemusic'
  source       text not null default 'lastfm',
  -- rempli seulement par les exports RGPD (télémétrie réelle), sinon null
  ms_played    integer,
  skipped      boolean,

  -- idempotence du sync : insert ... on conflict do nothing
  unique (played_at, track, artist)
);

create index if not exists scrobbles_played_at_idx on scrobbles (played_at desc);
create index if not exists scrobbles_artist_played_idx on scrobbles (artist, played_at);
create index if not exists scrobbles_artist_lower_idx on scrobbles (lower(artist));
create index if not exists scrobbles_source_idx on scrobbles (source);

-- ── Dimension durée de titre (résolue une seule fois par titre unique) ──
create table if not exists tracks (
  artist_key   text not null,          -- lower(artist)
  track_key    text not null,          -- lower(track)
  duration_ms  integer,
  source       text,                   -- 'deezer' | 'musicbrainz' | 'fallback'
  updated_at   timestamptz not null default now(),
  primary key (artist_key, track_key)
);

-- ── Photos d'artistes (Deezer — les images Last.fm sont cassées depuis 2019) ──
create table if not exists artist_images (
  artist_key   text primary key,       -- lower(artist)
  image_url    text,
  source       text,                   -- 'deezer' | 'musicbrainz'
  updated_at   timestamptz not null default now()
);

-- ── Genres / tags (artist.getTopTags — mis en cache, une fois par artiste) ──
create table if not exists artist_tags (
  artist_key   text not null,          -- lower(artist)
  tag          text not null,
  weight       integer,                -- rang/poids Last.fm
  updated_at   timestamptz not null default now(),
  primary key (artist_key, tag)
);

-- ── État du backfill (reprise sur erreur) ──
create table if not exists ingest_state (
  id           text primary key,       -- 'backfill' | 'sync'
  last_page    integer,
  to_ts        bigint,                 -- borne haute figée du backfill (unix)
  total_pages  integer,
  updated_at   timestamptz not null default now()
);
