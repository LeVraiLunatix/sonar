import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/session";
import { publicAccount } from "@/lib/accounts";
import { nf, humanMs, frDate } from "@/lib/format";
import { yearRange, parisToday } from "@/lib/dates";
import TopBar from "@/components/TopBar";
import Reveal from "@/components/Reveal";
import BigCount from "@/components/BigCount";
import Heatmap from "@/components/Heatmap";
import Clock from "@/components/Clock";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: decodeURIComponent(username) };
}

/**
 * Profil d'un AUTRE compte du site, en lecture seule.
 *
 * Deux garde-fous : il faut être connecté pour consulter, et le compte visé
 * doit avoir gardé son profil consultable. Les scrobbles Last.fm sont déjà
 * publics, mais chacun garde la main sur sa présence ici.
 */
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: raw } = await params;
  const asked = decodeURIComponent(raw);

  // consultation réservée aux comptes connectés
  const viewer = await currentUser();
  if (!viewer && process.env.AUTH_SECRET) notFound();
  if (!process.env.DATABASE_URL) notFound();

  const account = await publicAccount(asked);
  if (!account) notFound();

  // son propre profil → renvoyer vers le vrai tableau de bord
  const soi = viewer?.toLowerCase() === account.toLowerCase();

  const year = Number(parisToday().slice(0, 4));
  const s = await import("@/lib/stats");
  const range = yearRange(year);
  const [summary, topArtists, topTracks, perDay, perHour, life] = await Promise.all([
    s.summary(account, range),
    s.topArtists(account, range, 8),
    s.topTracks(account, range, 8),
    s.perDay(account, range),
    s.perHour(account, range),
    s.lifetime(account),
  ]);

  const exact = summary.durationsKnown === summary.scrobbles;

  return (
    <main className="year year--nospine">
      <div className="flow flow--wide">
        <TopBar current="search" />

        <Reveal as="section" className="ann ann--head">
          <p className="ann__label">
            profil · {account}
            {soi ? " · c’est toi" : ""}
          </p>
          <BigCount value={life.total} />
          <p className="prose" style={{ marginTop: "0.75rem" }}>
            <span className="big__unit">scrobbles</span> depuis toujours
            {life.first ? `, depuis le ${frDate(life.first)}` : ""}.
          </p>
          {soi && (
            <p className="note" style={{ marginTop: "1rem" }}>
              <Link href="/">→ ouvrir ton tableau de bord</Link>
            </p>
          )}
        </Reveal>

        <Reveal as="section" className="ann ann--stat">
          <span className="stat__v">{nf(summary.scrobbles)}</span>
          <span className="stat__k">écoutes en {year}</span>
        </Reveal>
        <Reveal as="section" className="ann ann--stat" delay={60}>
          <span className="stat__v">{nf(summary.artists)}</span>
          <span className="stat__k">artistes en {year}</span>
        </Reveal>
        <Reveal as="section" className="ann ann--stat" delay={120}>
          <span className="stat__v">
            {exact ? "" : "~"}
            {humanMs(summary.estMs)}
          </span>
          <span className="stat__k">{exact ? "d’écoute" : "d’écoute estimée"}</span>
        </Reveal>

        {topArtists.length > 0 && (
          <Reveal as="section" className="ann">
            <p className="ann__label">ses artistes en {year}</p>
            <ol className="ranks">
              {topArtists.map((a, i) => (
                <li className="rank" key={a.key} style={{ gridTemplateColumns: "1.4em 1fr auto" }}>
                  <span className="rank__n mono">{String(i + 1).padStart(2, "0")}</span>
                  <span className="trk__title">{a.name}</span>
                  <span className="rank__val">{nf(a.count)}</span>
                </li>
              ))}
            </ol>
            <p className="note" style={{ marginTop: "0.9rem" }}>
              les pages artiste montrent TON écoute, pas la sienne.
            </p>
          </Reveal>
        )}

        {topTracks.length > 0 && (
          <Reveal as="section" className="ann">
            <p className="ann__label">ses titres en {year}</p>
            <ol className="ranks">
              {topTracks.map((t, i) => (
                <li
                  className="rank"
                  key={t.artist + t.track + i}
                  style={{ gridTemplateColumns: "1.4em minmax(0, 1fr) auto" }}
                >
                  <span className="rank__n mono">{String(i + 1).padStart(2, "0")}</span>
                  <span className="trk">
                    <span className="trk__title">{t.track}</span>
                    <span className="trk__by">{t.artist}</span>
                  </span>
                  <span className="rank__val">{nf(t.count)}</span>
                </li>
              ))}
            </ol>
          </Reveal>
        )}

        {summary.scrobbles > 0 && (
          <Reveal as="section" className="ann">
            <p className="ann__label">à quelle heure cette personne écoute</p>
            <Clock hours={perHour} />
          </Reveal>
        )}

        {perDay.length >= 28 && (
          <Reveal as="section" className="ann ann--wide">
            <p className="ann__label">son année {year}, jour par jour</p>
            <Heatmap days={perDay} />
          </Reveal>
        )}

        <nav className="ann period-nav">
          <Link href="/search" className="mono">
            ← chercher
          </Link>
          <a
            className="mono"
            href={`https://www.last.fm/user/${encodeURIComponent(account)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            son profil Last.fm →
          </a>
        </nav>
      </div>
    </main>
  );
}
