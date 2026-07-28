-- ─────────────────────────────────────────────────────────────
-- Migration 002
--  a) clé de session Last.fm par compte, nécessaire aux méthodes d'écriture
--     (track.love). C'est un IDENTIFIANT : jamais exposé côté client, lu
--     uniquement côté serveur par /api/love.
--  b) retrait du DEFAULT sur scrobbles.account, posé par la migration 001
--     le temps de la fenêtre de déploiement. Tout le code passe désormais
--     le compte explicitement.
-- ─────────────────────────────────────────────────────────────

alter table accounts
  add column if not exists lastfm_session_key text;

alter table scrobbles
  alter column account drop default;
