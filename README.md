# Sonar

Un « Wrapped » permanent des écoutes musicales. Tout l'historique Last.fm est
rapatrié en local (Postgres), puis **100 % des stats sont recalculées en SQL**
pour n'importe quelle plage de dates — ce que les endpoints de stats de Last.fm
ne permettent pas (périodes figées uniquement).

## Stack

- **Next.js** (App Router) · **Postgres/Neon** · **SQL brut** (`postgres.js`) · **Recharts** · **Vercel Cron**
- Polices : Bricolage Grotesque (display) · Newsreader (texte) · Departure Mono (données, via CDN)
- Direction : risographie deux encres, le violet naît du recouvrement (`mix-blend-mode: multiply`), jamais codé en dur.

## État actuel

La page **`/year/[année]`** est construite et jugeable **sans base** : sans
`DATABASE_URL`, elle affiche des **données fictives déterministes**. Dès que
`.env.local` est renseigné, la même page passe automatiquement sur les vraies
stats calculées en SQL (`lib/year.ts`).

## Mise en route

### 1. Comptes & secrets (2 min, à faire par toi)

1. Clé API Last.fm (gratuite, instantanée, aucune auth pour lire) : https://www.last.fm/api/account/create
2. Base Neon (tier gratuit) : https://neon.tech → récupère la chaîne **pooled**.
3. Copie le gabarit et remplis-le :
   ```bash
   cp .env.local.example .env.local
   ```
   Renseigne `LASTFM_API_KEY`, `LASTFM_USER`, `DATABASE_URL`, `CRON_SECRET`.
   `.env.local` est gitignoré : rien n'est committé.

### 2. Base de données

```bash
npm install
npm run db:schema     # nouvelle base : crée les tables (db/schema.sql)
```

Base déjà en place → appliquer les migrations à la place :

```bash
npm run db:migrate    # db/migrations/, transactionnel et rejouable
```

⚠️ **Ordre en production** : appliquer la migration **avant** de déployer le
code correspondant. Les lectures de l'ancienne version continuent de
fonctionner pendant la fenêtre ; seul le sync attend le déploiement.

### 3. Rapatrier l'historique

```bash
npm run backfill      # tout l'historique ; reprend à la dernière page si interrompu
```

50 000 scrobbles ≈ 250 requêtes ≈ 1 min. Relançable sans risque (insertion
idempotente via la contrainte `unique`).

### 4. Lancer

```bash
npm run dev           # http://localhost:3000
```

### 5. Sync automatique (en prod)

`vercel.json` déclenche `/api/cron/sync` une fois par jour (le plan Vercel
gratuit n'autorise qu'un cron quotidien). Sur Vercel, ajoute `CRON_SECRET` en
variable d'environnement (le cron doit envoyer `Authorization: Bearer
<CRON_SECRET>`). En local : `npm run sync`.

Entre deux passages du cron, le site se met à jour tout seul : `AutoSync`
appelle `/api/sync/self` à l'ouverture, toutes les 60 s et au retour sur
l'onglet — avec un garde-fou de fréquence, et un rafraîchissement de la page
uniquement si de nouveaux scrobbles sont réellement arrivés.

## Structure

```
app/
  page.tsx                  dashboard (en écoute, aujourd'hui/semaine/mois, récents)
  day|week|month|year/…     les quatre granularités
  compare/page.tsx          deux périodes en surimpression
  onboarding/page.tsx       import initial, par tranches, avec progression
  api/live/route.ts         lecture DIRECTE Last.fm (en cours, récents, jour)
  api/love/route.ts         track.love — écriture Last.fm
  api/sync/self/route.ts    sync opportuniste du compte de la session
  api/backfill/…            import initial piloté depuis le client
  api/auth/…                OAuth Last.fm (login, callback, logout)
  api/cron/sync/route.ts    endpoint appelé par Vercel Cron (tous les comptes)
components/                 MiniPlayer, PeriodView, AmplitudeSpine, Clock, Heatmap,
                            SmoothScroll, Reveal, BigCount, AutoSync…
lib/
  lastfm.ts                 client user.getRecentTracks (pièges section 5 gérés)
  lastfm-auth.ts            OAuth + signature md5 + track.love
  auth.ts / session.ts      cookie signé HMAC, compte de la session
  guard.ts                  compte d'une page (+ renvoi vers /onboarding)
  db.ts                     connexion postgres.js (paresseuse)
  stats.ts                  LES agrégations, toutes filtrées par compte
  period.ts                 source des pages (bascule base ↔ fixtures)
  dates.ts                  plages Europe/Paris, semaines ISO
  ingest.ts                 backfill par tranches + sync incrémental
  accounts.ts               comptes, état d'import, clé de session
  useLive.ts                source temps réel partagée (un seul appel réseau)
  fixtures.ts               données fictives déterministes
db/schema.sql               schéma complet · db/migrations/  migrations rejouables
scripts/                    migrate, apply-schema, backfill, sync, gen-icons
reference/hero.html         le hero validé (référence design)
```

## Multi-utilisateur

Chaque scrobble porte le compte Last.fm auquel il appartient (`scrobbles.account`),
et **toutes** les requêtes de `lib/stats.ts` filtrent dessus : un utilisateur ne
voit jamais les écoutes d'un autre.

- **Connexion** : OAuth Last.fm (`/login` → `/api/auth/callback`).
- **Premier login** : le compte est créé, puis `/onboarding` importe tout
  l'historique **par tranches** (`/api/backfill/run` rappelée en boucle par le
  client) — nécessaire car une fonction serverless ne peut pas tourner longtemps.
  L'import reprend là où il s'est arrêté s'il est interrompu.
- **Sync** : le cron parcourt tous les comptes dont l'import est terminé.
- **Ouverture** : tant que `ALLOW_ALL_USERS` ≠ `1`, seul `LASTFM_USER` peut se
  connecter. Mettre `ALLOW_ALL_USERS=1` pour ouvrir l'inscription à tous.

⚠️ Ouvrir à tous stocke l'historique de chaque visiteur dans la même base et
partage un seul quota d'API Last.fm — à surveiller au-delà de quelques comptes.

## Ce que Last.fm permet — et ne permet pas

- **Lecture en direct** : morceau en cours, derniers scrobbles, total du jour
  (`/api/live`). C'est là que la fraîcheur compte.
- **Agrégations** : impossibles en direct — les endpoints de stats de Last.fm
  n'acceptent que des périodes figées (`7day`, `1month`, …). Un mois précis, une
  journée heure par heure, une série ou une comparaison exigeraient de repaginer
  tout l'historique à chaque affichage. D'où la base locale.
- **Écriture** : `track.love` fonctionne (nécessite la clé de session, stockée
  côté serveur uniquement). **Pause / titre suivant sont impossibles** : Last.fm
  journalise les écoutes, il ne commande aucun lecteur.

## Reste à faire (ordre du brief)

Pages artiste · temps d'écoute réel (durées Deezer/MusicBrainz) · photos
d'artistes Deezer · genres (`artist.getTopTags`) · import des exports RGPD
(Spotify/Apple) via la colonne `source`.
