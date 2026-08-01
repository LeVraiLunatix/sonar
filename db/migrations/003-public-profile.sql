-- ─────────────────────────────────────────────────────────────
-- Migration 003 — profils consultables entre comptes
--
-- Les scrobbles Last.fm sont DÉJÀ publics : `user.getRecentTracks` ne demande
-- aucune authentification, n'importe qui peut consulter l'historique d'un
-- pseudo sur last.fm. Rendre un profil visible dans Sonar n'expose donc rien
-- de nouveau — c'est une autre présentation de données déjà publiques.
--
-- Malgré ça, chacun garde la main : `public_profile` peut être désactivé, et
-- le compte disparaît alors de la recherche et des profils consultables.
-- ─────────────────────────────────────────────────────────────

alter table accounts
  add column if not exists public_profile boolean not null default true;

create index if not exists accounts_public_idx on accounts (public_profile);
