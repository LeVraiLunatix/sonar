import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { accountForPage } from "@/lib/guard";
import { nf, humanMs, frDate, frMonth } from "@/lib/format";
import TopBar from "@/components/TopBar";
import Reveal from "@/components/Reveal";
import BigCount from "@/components/BigCount";
import ArtistSpark from "@/components/ArtistSpark";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  return { title: decodeURIComponent(name) };
}

/** Écart en jours entre deux dates ISO. */
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name: raw } = await params;
  const key = decodeURIComponent(raw).toLowerCase();
  if (!key.trim()) notFound();

  const account = await accountForPage();
  if (!account) notFound();

  const a = await import("@/lib/artist");
  const [profile, months, topTracks, topAlbums, peakDay, peakWindow] = await Promise.all([
    a.artistProfile(account, key),
    a.artistPerMonth(account, key),
    a.artistTopTracks(account, key, 10),
    a.artistTopAlbums(account, key, 6),
    a.artistPeakDay(account, key),
    a.artistPeakWindow(account, key, 7),
  ]);

  if (!profile) notFound();

  const exact = profile.durationsKnown === profile.scrobbles;
  const silence = profile.last ? daysBetween(profile.last, new Date().toISOString()) : 0;

  return (
    <main className="year year--nospine">
      <div className="flow flow--wide">
        <TopBar />

        <section className="ann ann--head ann--bleed">
          <div className="art-hero">
            {profile.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="art-hero__img" src={profile.image} alt="" />
            )}
            <span className="art-hero__scrim" aria-hidden="true" />
            <div className="art-hero__text">
              <p className="ann__label" style={{ margin: 0 }}>
                {profile.rank}
                <sup>{profile.rank === 1 ? "er" : "e"}</sup> artiste sur {nf(profile.outOf)}
              </p>
              <h1 className="art-hero__name">{profile.name}</h1>
              <p className="art-hero__meta">
                {nf(profile.scrobbles)} écoutes · {nf(profile.tracks)} titres
                {profile.releases > 0 ? ` · ${nf(profile.releases)} sorties` : ""}
              </p>
            </div>
          </div>
        </section>

        <Reveal as="section" className="ann ann--stat">
          <BigCount value={profile.scrobbles} />
          <span className="stat__k">écoutes au total</span>
        </Reveal>

        <Reveal as="section" className="ann ann--stat">
          <span className="stat__v">{exact ? "" : "~"}{humanMs(profile.estMs)}</span>
          <span className="stat__k">{exact ? "d’écoute" : "d’écoute estimée"}</span>
        </Reveal>

        {profile.first && (
          <Reveal as="section" className="ann ann--stat" delay={60}>
            <span className="stat__v" style={{ fontSize: "1.1rem" }}>
              {frDate(profile.first)}
            </span>
            <span className="stat__k">premier scrobble</span>
          </Reveal>
        )}

        {profile.last && (
          <Reveal as="section" className="ann ann--stat" delay={120}>
            <span className="stat__v" style={{ fontSize: "1.1rem" }}>
              {frDate(profile.last)}
            </span>
            <span className="stat__k">
              {silence > 60 ? `dernière écoute — ${nf(silence)} j de silence` : "dernière écoute"}
            </span>
          </Reveal>
        )}

        {peakDay && (
          <Reveal as="section" className="ann ann--stat" delay={180}>
            <span className="stat__v">{nf(peakDay.count)}</span>
            <span className="stat__k">record en un jour — {peakDay.day}</span>
          </Reveal>
        )}

        {peakWindow && peakWindow.count > peakDay!.count && (
          <Reveal as="section" className="ann ann--stat" delay={240}>
            <span className="stat__v">{nf(peakWindow.count)}</span>
            <span className="stat__k">pic sur 7 jours — dès le {peakWindow.start}</span>
          </Reveal>
        )}

        {months.length > 1 && (
          <Reveal as="section" className="ann ann--wide">
            <p className="ann__label">mois par mois</p>
            <ArtistSpark months={months} />
            <p className="note" style={{ marginTop: "0.75rem" }}>
              de {frMonth(Number(months[0].month.slice(5))) + " " + months[0].month.slice(0, 4)} à{" "}
              {frMonth(Number(months[months.length - 1].month.slice(5))) +
                " " +
                months[months.length - 1].month.slice(0, 4)}
            </p>
          </Reveal>
        )}

        {topTracks.length > 0 && (
          <Reveal as="section" className="ann">
            <p className="ann__label">titres les plus écoutés</p>
            <ol className="ranks">
              {topTracks.map((t, i) => (
                <li
                  className="rank"
                  key={t.track + i}
                  style={{ gridTemplateColumns: "1.4em minmax(0, 1fr) auto" }}
                >
                  <span className="rank__n mono">{String(i + 1).padStart(2, "0")}</span>
                  <span className="trk">
                    <span className="trk__title">{t.track}</span>
                  </span>
                  <span className="rank__val">{nf(t.count)}</span>
                </li>
              ))}
            </ol>
          </Reveal>
        )}

        {topAlbums.length > 0 && (
          <Reveal as="section" className="ann ann--wide">
            <p className="ann__label">albums et singles</p>
            <div className="shelf">
              {topAlbums.map((al, i) => (
                <div className="shelf__item" key={al.album + i}>
                  {al.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="shelf__cover" src={al.image} alt="" loading="lazy" />
                  ) : (
                    <span className="shelf__cover shelf__cover--vide" aria-hidden="true">
                      <svg viewBox="0 0 48 48" width="30" height="30">
                        <circle cx="24" cy="24" r="15" fill="none" stroke="var(--blue)" strokeWidth="3.4" />
                        <circle cx="24" cy="24" r="8.6" fill="none" stroke="var(--pink)" strokeWidth="3.4" />
                        <circle cx="24" cy="24" r="3.4" fill="var(--ink)" />
                      </svg>
                    </span>
                  )}
                  <span className="shelf__title">{al.album}</span>
                  <span className="shelf__count">{nf(al.count)} écoutes</span>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        <nav className="ann period-nav" aria-label="Navigation">
          <Link href="/search" className="mono">
            ← chercher un autre artiste
          </Link>
          <a
            className="mono"
            href={`https://www.last.fm/music/${encodeURIComponent(profile.name).replace(/%20/g, "+")}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            voir sur Last.fm →
          </a>
        </nav>
      </div>
    </main>
  );
}
