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

        <Reveal as="section" className="ann ann--head">
          <p className="ann__label">
            artiste · {profile.rank}
            <sup>{profile.rank === 1 ? "er" : "e"}</sup> sur {nf(profile.outOf)}
          </p>
          <div className="art-head">
            {profile.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="art-head__photo" src={profile.image} alt="" width={112} height={112} />
            )}
            <div>
              <h1 className="art-head__name display">{profile.name}</h1>
              <BigCount value={profile.scrobbles} />
              <p className="prose" style={{ marginTop: "0.5rem" }}>
                <span className="big__unit">écoutes</span> · {nf(profile.tracks)} titres
                {profile.albums > 0 ? ` · ${nf(profile.albums)} albums` : ""}
              </p>
            </div>
          </div>
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
          <Reveal as="section" className="ann">
            <p className="ann__label">albums</p>
            <ol className="ranks">
              {topAlbums.map((al, i) => (
                <li
                  className="rank"
                  key={al.album + i}
                  style={{ gridTemplateColumns: "1.4em minmax(0, 1fr) auto" }}
                >
                  <span className="rank__n mono">{String(i + 1).padStart(2, "0")}</span>
                  <span className="trk">
                    <span className="trk__title">{al.album}</span>
                  </span>
                  <span className="rank__val">{nf(al.count)}</span>
                </li>
              ))}
            </ol>
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
