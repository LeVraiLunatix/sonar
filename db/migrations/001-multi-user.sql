-- ─────────────────────────────────────────────────────────────
-- Migration 001 — multi-utilisateur
-- Chaque scrobble appartient à un compte Last.fm.
--
-- ⚠️ Conçue pour être appliquée AVANT le déploiement du nouveau code :
-- la colonne `account` a un DEFAULT (le compte propriétaire), donc l'ancien
-- code — qui insère sans cette colonne — continue de fonctionner pendant la
-- fenêtre de déploiement. Le DEFAULT est retiré ensuite (migration 002).
--
-- Le placeholder :owner est remplacé par scripts/migrate.mjs (= LASTFM_USER).
-- ─────────────────────────────────────────────────────────────

-- ── Comptes connus + état d'import de chacun ──
create table if not exists accounts (
  username        text primary key,          -- pseudo Last.fm (casse d'origine)
  username_key    text not null unique,      -- lower(username), pour les jointures
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),

  -- import initial : 'pending' | 'running' | 'done' | 'error'
  backfill_status text not null default 'pending',
  backfill_page   integer not null default 0,
  backfill_pages  integer,                   -- nb total de pages à traiter
  backfill_to_ts  bigint,                    -- borne haute figée du backfill
  backfill_error  text,
  last_sync_at    timestamptz
);

create index if not exists accounts_status_idx on accounts (backfill_status);

-- ── scrobbles : rattachement au compte ──
alter table scrobbles
  add column if not exists account text not null default :owner;

-- Les lignes existantes appartiennent au propriétaire (le DEFAULT s'en charge,
-- mais on est explicite pour les cas où la colonne existait déjà en NULL).
update scrobbles set account = :owner where account is null or account = '';

-- L'ancienne contrainte empêchait deux personnes d'avoir le même scrobble.
alter table scrobbles drop constraint if exists scrobbles_played_at_track_artist_key;

-- Nouvelle unicité, par compte → l'insertion reste idempotente.
create unique index if not exists scrobbles_account_unique_idx
  on scrobbles (account, played_at, track, artist);

-- Index de lecture, tous préfixés par le compte.
create index if not exists scrobbles_account_played_idx
  on scrobbles (account, played_at desc);
create index if not exists scrobbles_account_artist_idx
  on scrobbles (account, lower(artist));

-- ── Le propriétaire existe déjà et son historique est complet ──
insert into accounts (username, username_key, backfill_status, backfill_page, backfill_pages)
values (:owner, lower(:owner), 'done', 0, 0)
on conflict (username) do nothing;
