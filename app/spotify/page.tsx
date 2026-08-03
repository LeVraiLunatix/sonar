import type { Metadata } from "next";
import TopBar from "@/components/TopBar";
import Reveal from "@/components/Reveal";
import { accountForPage } from "@/lib/guard";
import { humanMs, nf } from "@/lib/format";
import type { TimeRange, SpotifyTrack, SpotifyArtist, NowPlaying } from "@/lib/spotify";

export const metadata: Metadata = { title: "Spotify" };
export const dynamic = "force-dynamic";

const RANGES: { key: TimeRange; label: string }[] = [
  { key: "short_term", label: "4 dernières semaines" },
  { key: "medium_term", label: "6 derniers mois" },
  { key: "long_term", label: "plusieurs années" },
];

function errorMessage(error?: string, detail?: string): string | null {
  switch (error) {
    case "config":
      return "connexion Spotify non configurée (clé client manquante)";
    case "denied":
      return "l’autorisation Spotify a été refusée";
    case "state":
      return "la connexion Spotify a échoué (état invalide), réessaie";
    case "spotify":
      return `la connexion Spotify a échoué${detail ? ` : ${detail}` : ""}`;
    default:
      return null;
  }
}

export default async function SpotifyPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; error?: string; detail?: string }>;
}) {
  const { range: rawRange, error, detail } = await searchParams;
  const range: TimeRange = RANGES.some((r) => r.key === rawRange)
    ? (rawRange as TimeRange)
    : "medium_term";

  const account = await accountForPage();
  const message = errorMessage(error, detail);

  let connected: { displayName: string | null } | null = null;
  let nowPlaying: NowPlaying = null;
  let tracks: SpotifyTrack[] = [];
  let artists: SpotifyArtist[] = [];
  let loadError: string | null = null;

  if (account && process.env.DATABASE_URL) {
    const { getSpotifyTokens } = await import("@/lib/accounts");
    const tokens = await getSpotifyTokens(account);
    if (tokens) {
      connected = { displayName: tokens.displayName };
      try {
        const { getValidAccessToken, getCurrentlyPlaying, getTopTracks, getTopArtists } =
          await import("@/lib/spotify");
        const accessToken = await getValidAccessToken(account);
        if (!accessToken) {
          loadError = "connexion Spotify non configurée côté serveur";
        } else {
          [nowPlaying, tracks, artists] = await Promise.all([
            getCurrentlyPlaying(accessToken),
            getTopTracks(accessToken, range, 20),
            getTopArtists(accessToken, range, 20),
          ]);
        }
      } catch (e) {
        loadError = e instanceof Error ? e.message : "erreur inconnue";
      }
    }
  }

  return (
    <main className="year year--nospine">
      <div className="flow flow--wide">
        <TopBar current="spotify" />

        <Reveal as="section" className="ann ann--head">
          <p className="ann__label">en plus de Last.fm</p>
          <h1>spotify</h1>
          <p className="prose">
            Spotify ne donne pas l’historique complet comme Last.fm — seulement
            tes titres et artistes les plus écoutés sur trois fenêtres fixées
            par Spotify, et ce qui joue en ce moment.
          </p>
        </Reveal>

        {(message || loadError) && (
          <Reveal as="section" className="ann">
            <p className="login__error mono" role="alert">
              {message ?? loadError}
            </p>
          </Reveal>
        )}

        {!account && !process.env.DATABASE_URL ? null : !process.env.DATABASE_URL ? (
          <Reveal as="section" className="ann">
            <p className="prose">Nécessite une base de données configurée.</p>
          </Reveal>
        ) : !connected ? (
          <Reveal as="section" className="ann">
            <p className="ann__label">connexion</p>
            <a className="btn btn--solid" href="/api/spotify/login">
              Connecter Spotify
            </a>
            <p className="note" style={{ marginTop: "0.9rem" }}>
              Une autorisation Spotify, rien d’autre. Sonar ne lit que tes tops
              et ta lecture en cours — aucun mot de passe ne transite ici.
            </p>
          </Reveal>
        ) : (
          <>
            <Reveal as="section" className="ann">
              <p className="ann__label">connecté</p>
              <p className="prose">
                {connected.displayName ?? "compte Spotify"} — les données
                ci-dessous viennent directement de Spotify.
              </p>
              <form method="post" action="/api/spotify/disconnect" style={{ marginTop: "0.75rem" }}>
                <button className="btn btn--ghost" type="submit">
                  déconnecter Spotify
                </button>
              </form>
            </Reveal>

            {nowPlaying && (
              <Reveal as="section" className="ann">
                <p className="ann__label">
                  {nowPlaying.is_playing ? "en ce moment" : "en pause"}
                </p>
                <p className="prose">
                  <strong>{nowPlaying.track}</strong> — {nowPlaying.artists}
                </p>
              </Reveal>
            )}

            <Reveal as="section" className="ann">
              <nav className="nav" aria-label="Fenêtre Spotify" style={{ marginBottom: "0.5rem" }}>
                {RANGES.map((r) => (
                  <a
                    key={r.key}
                    href={`/spotify?range=${r.key}`}
                    className={r.key === range ? "now" : undefined}
                    aria-current={r.key === range ? "page" : undefined}
                  >
                    {r.label}
                  </a>
                ))}
              </nav>
            </Reveal>

            <Reveal as="section" className="ann">
              <p className="ann__label">artistes les plus écoutés</p>
              {artists.length === 0 ? (
                <p className="prose">Pas encore assez d’écoutes Spotify pour cette période.</p>
              ) : (
                <ol className="ranks">
                  {artists.map((a, i) => (
                    <li className="rank" key={a.id} style={{ gridTemplateColumns: "1.4em 1fr auto" }}>
                      <span className="rank__n mono">{String(i + 1).padStart(2, "0")}</span>
                      <a
                        className="rank__name rank__link"
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {a.name}
                      </a>
                      <span className="rank__val">{nf(a.popularity)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Reveal>

            <Reveal as="section" className="ann ann--wide">
              <p className="ann__label">titres les plus écoutés</p>
              {tracks.length === 0 ? (
                <p className="prose">Pas encore assez d’écoutes Spotify pour cette période.</p>
              ) : (
                <ol className="ranks">
                  {tracks.map((t, i) => (
                    <li className="rank" key={t.id} style={{ gridTemplateColumns: "1.4em 1fr auto" }}>
                      <span className="rank__n mono">{String(i + 1).padStart(2, "0")}</span>
                      <a
                        className="rank__name rank__link"
                        href={t.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t.name}
                        <span className="note" style={{ marginLeft: "0.5rem" }}>{t.artists}</span>
                      </a>
                      <span className="rank__val">{humanMs(t.duration_ms)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Reveal>
          </>
        )}
      </div>
    </main>
  );
}
