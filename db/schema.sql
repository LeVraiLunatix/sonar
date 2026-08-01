-- ─────────────────────────────────────────────────────────────
-- Sonar — schéma Postgres (multi-utilisateur)
-- Un seul schéma accepte Last.fm (flux vivant) ET les exports RGPD
-- (Spotify / Apple Music) via la colonne `source`.
-- Chaque ligne appartient à un compte Last.fm via la colonne `account`.
--
-- Base existante → utilise plutôt `npm run db:migrate` (db/migrations/).
-- ─────────────────────────────────────────────────────────────

-- ── Comptes connus + état d'import de chacun ──
create table if not exists accounts (
  username        text primary key,
  username_key    text not null unique,      -- lower(username)
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  backfill_status text not null default 'pending',  -- pending|running|done|error
  backfill_page   integer not null default 0,
  backfill_pages  integer,
  backfill_to_ts  bigint,
  backfill_error  text,
  last_sync_at    timestamptz,
  -- clé de session Last.fm (méthodes d'écriture : track.love).
  -- IDENTIFIANT : jamais renvoyé au client, lu côté serveur uniquement.
  lastfm_session_key text,
  -- profil consultable par les autres comptes du site (désactivable)
  public_profile boolean not null default true
);

create index if not exists accounts_public_idx on accounts (public_profile);

create index if not exists accounts_status_idx on accounts (backfill_status);

create table if not exists scrobbles (
  id           bigserial primary key,
  account      text not null,
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
  skipped      boolean
);

-- idempotence du sync, par compte : insert ... on conflict do nothing
create unique index if not exists scrobbles_account_unique_idx
  on scrobbles (account, played_at, track, artist);

create index if not exists scrobbles_account_played_idx
  on scrobbles (account, played_at desc);
create index if not exists scrobbles_account_artist_idx
  on scrobbles (account, lower(artist));
create index if not exists scrobbles_source_idx on scrobbles (source);

-- ── Dimension durée de titre (partagée entre comptes : c'est une donnée du titre) ──
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
