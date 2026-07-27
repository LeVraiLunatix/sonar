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
npm run db:schema     # crée les tables (db/schema.sql)
```

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

`vercel.json` déclenche `/api/cron/sync` toutes les 30 min. Sur Vercel, ajoute
`CRON_SECRET` en variable d'environnement (le cron doit envoyer
`Authorization: Bearer <CRON_SECRET>`). En local : `npm run sync`.

## Structure

```
app/
  page.tsx                accueil (liste des années)
  year/[year]/page.tsx    le Wrapped annuel — bande verticale continue
  api/cron/sync/route.ts  endpoint appelé par Vercel Cron
components/                AmplitudeSpine, CompareRanks, Heatmap, Clock, ThemeToggle
lib/
  lastfm.ts               client user.getRecentTracks (pièges section 5 gérés)
  db.ts                   connexion postgres.js (paresseuse)
  stats.ts                LA requête d'agrégation générique [début, fin]
  ingest.ts               backfill + sync incrémental
  year.ts                 source de la page /year (bascule fixtures ↔ base)
  fixtures.ts             données fictives déterministes
db/schema.sql             schéma (scrobbles + tracks + artist_tags + …)
scripts/                  apply-schema, backfill, sync
reference/hero.html       le hero validé (référence design)
```

## Reste à faire (ordre du brief)

Granularités jour / semaine / mois · comparateur `/compare` · pages artiste ·
temps d'écoute réel (durées Deezer/MusicBrainz) · photos d'artistes Deezer ·
genres (`artist.getTopTags`) · import des exports RGPD (Spotify/Apple) via la
colonne `source`.
