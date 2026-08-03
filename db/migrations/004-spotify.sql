-- ─────────────────────────────────────────────────────────────
-- Migration 004 — connexion Spotify (stats live, en plus de Last.fm)
--
-- L'API Spotify ne donne ni l'historique complet ni des agrégations sur
-- mesure (contrairement à Last.fm) : seulement les top titres/artistes sur
-- trois fenêtres glissantes (4 semaines / 6 mois / plusieurs années) et la
-- lecture en cours. On stocke donc juste les jetons OAuth du compte, lus et
-- rafraîchis côté serveur — jamais renvoyés au client.
-- ─────────────────────────────────────────────────────────────

alter table accounts
  add column if not exists spotify_access_token  text,
  add column if not exists spotify_refresh_token  text,
  add column if not exists spotify_token_expires_at timestamptz,
  add column if not exists spotify_user_id  text,
  add column if not exists spotify_display_name text;
