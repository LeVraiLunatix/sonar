import Link from "next/link";
import type { PeriodData } from "@/lib/period";
import { nf, humanMs } from "@/lib/format";
import AmplitudeSpine from "./AmplitudeSpine";
import CompareRanks from "./CompareRanks";
import Heatmap from "./Heatmap";
import Clock from "./Clock";
import TopBar from "./TopBar";
import Reveal from "./Reveal";
import BigCount from "./BigCount";

/** Petite brique de statistique — une valeur, un intitulé. */
function Stat({ v, k, delay = 0 }: { v: string; k: string; delay?: number }) {
  return (
    <Reveal as="section" className="ann ann--stat" delay={delay}>
      <span className="stat__v">{v}</span>
      <span className="stat__k">{k}</span>
    </Reveal>
  );
}

export type PeriodNav = {
  prevHref: string;
  nextHref: string;
  prevLabel: string;
  nextLabel: string;
};

export default function PeriodView({
  data,
  nav,
  navCurrent,
}: {
  data: PeriodData;
  nav: PeriodNav;
  navCurrent: string;
}) {
  const {
    summary,
    perDay,
    perHour,
    topArtists,
    topAlbums,
    topTracks,
    discoveries,
    streak,
    kind,
  } = data;
  const withSpine = perDay.length >= 14;
  const withHeat = perDay.length >= 28;
  const activeDays = perDay.filter((d) => d.count > 0).length;
  const peak = perDay.reduce((a, b) => (b.count > a.count ? b : a), perDay[0]);

  return (
    <main className={withSpine ? "year" : "year year--nospine"}>
      {withSpine && <AmplitudeSpine days={perDay} />}

      <div className="flow">
        <TopBar current={navCurrent} />

        {/* ── en-tête : pleine largeur ── */}
        <Reveal as="section" className="ann ann--head">
          <p className="ann__label">
            {kind === "year" ? "archive" : kind === "all" ? "archive complète" : kind} · {data.label}
            {data.source === "fixtures" ? " · données fictives" : ""}
          </p>
          <BigCount value={summary.scrobbles} />
          <p className="prose" style={{ marginTop: "0.75rem" }}>
            <span className="big__unit">scrobbles</span>
            {activeDays > 1 ? `, sur ${activeDays} jours d’écoute.` : "."}
          </p>
        </Reveal>

        {/* ── briques de chiffres ── */}
        <Stat v={nf(summary.artists)} k="artistes" />
        <Stat v={nf(summary.tracks)} k="titres uniques" delay={60} />
        {/* le « ~ » n'apparaît que si des durées manquent encore (voir Deezer) */}
        <Stat
          v={`${summary.durationsKnown === summary.scrobbles ? "" : "~"}${humanMs(summary.estMs)}`}
          k={summary.durationsKnown === summary.scrobbles ? "d’écoute" : "d’écoute estimée"}
          delay={120}
        />
        {streak > 1 && <Stat v={`${streak} j`} k="plus longue série" delay={180} />}
        {activeDays > 0 && (
          <Stat v={nf(activeDays)} k="jours avec écoute" delay={240} />
        )}
        {peak && peak.count > 0 && (
          <Stat v={nf(peak.count)} k={`record — ${peak.day}`} delay={300} />
        )}

        {topArtists.length > 0 && (
          <Reveal as="section" className="ann">
            <p className="ann__label">
              {kind === "all" ? "artistes les plus écoutés" : "artistes — vs période précédente"}
            </p>
            <CompareRanks artists={topArtists} prev={data.prevArtist} />
            {kind !== "all" && (
              <p className="note" style={{ marginTop: "1rem" }}>
                barre rose : cette période. trait bleu : la précédente. le violet est
                leur recouvrement.
              </p>
            )}
          </Reveal>
        )}

        {summary.scrobbles > 0 && (
          <Reveal as="section" className="ann">
            <p className="ann__label">à quelle heure ça écoute</p>
            <Clock hours={perHour} />
          </Reveal>
        )}

        {topTracks.length > 0 && (
          <Reveal as="section" className="ann">
            <p className="ann__label">titres les plus écoutés</p>
            <ol className="ranks">
              {topTracks.slice(0, 8).map((t, i) => (
                <li
                  className="rank"
                  key={`${t.artist}-${t.track}-${i}`}
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

        {topAlbums.length > 0 && (
          <Reveal as="section" className="ann">
            <p className="ann__label">Albums, Singles et EP les plus écoutés</p>
            <ol className="ranks">
              {topAlbums.slice(0, 6).map((a, i) => (
                <li
                  className="rank"
                  key={`${a.artist}-${a.album}-${i}`}
                  style={{ gridTemplateColumns: "1.4em minmax(0, 1fr) auto" }}
                >
                  <span className="rank__n mono">{String(i + 1).padStart(2, "0")}</span>
                  <span className="trk">
                    <span className="trk__title">{a.album}</span>
                    <span className="trk__by">{a.artist}</span>
                  </span>
                  <span className="rank__val">{nf(a.count)}</span>
                </li>
              ))}
            </ol>
          </Reveal>
        )}

        {discoveries.length > 0 && (
          <Reveal as="section" className="ann">
            <p className="ann__label">
              {kind === "all" ? "découvertes depuis le début" : "découvertes — premier scrobble dans la période"}
            </p>
            <ul className="ranks">
              {discoveries.slice(0, 8).map((d) => (
                <li className="rank" key={d.key} style={{ gridTemplateColumns: "1fr auto" }}>
                  <Link className="srch__link" href={`/artist/${encodeURIComponent(d.key)}`}>
                    <span className="trk__title">{d.name}</span>
                  </Link>
                  <span className="rank__val">{nf(d.count)} écoutes ensuite</span>
                </li>
              ))}
            </ul>
          </Reveal>
        )}

        {data.insights?.showObsessions && data.insights.obsessions.length > 0 && (
          <Reveal as="section" className="ann">
            <p className="ann__label">obsessions — concentré sur une semaine</p>
            <ol className="ranks">
              {data.insights.obsessions.map((o) => (
                <li className="rank" key={o.key} style={{ gridTemplateColumns: "1fr auto" }}>
                  <Link className="srch__link" href={`/artist/${encodeURIComponent(o.key)}`}>
                    <span className="trk__title">{o.name}</span>
                    <span className="note">
                      {nf(o.peak)} des {nf(o.total)} écoutes dès le {o.peakStart}
                    </span>
                  </Link>
                  <span className="rank__val">{Math.round(o.concentration * 100)} %</span>
                </li>
              ))}
            </ol>
          </Reveal>
        )}

        {data.insights?.showSpread && data.insights.loyal.length > 0 && (
          <Reveal as="section" className="ann">
            <p className="ann__label">les fidèles — présents mois après mois</p>
            <ol className="ranks">
              {data.insights.loyal.map((l) => (
                <li className="rank" key={l.key} style={{ gridTemplateColumns: "1fr auto" }}>
                  <Link className="srch__link" href={`/artist/${encodeURIComponent(l.key)}`}>
                    <span className="trk__title">{l.name}</span>
                  </Link>
                  <span className="rank__val">
                    {l.months} mois · {nf(l.total)}
                  </span>
                </li>
              ))}
            </ol>
          </Reveal>
        )}

        {data.insights?.showSpread && data.insights.fleeting.length > 0 && (
          <Reveal as="section" className="ann">
            <p className="ann__label">les éphémères — un seul mois, puis plus rien</p>
            <ol className="ranks">
              {data.insights.fleeting.map((f) => (
                <li className="rank" key={f.key} style={{ gridTemplateColumns: "1fr auto" }}>
                  <Link className="srch__link" href={`/artist/${encodeURIComponent(f.key)}`}>
                    <span className="trk__title">{f.name}</span>
                  </Link>
                  <span className="rank__val">{nf(f.total)}</span>
                </li>
              ))}
            </ol>
          </Reveal>
        )}

        {data.insights && data.insights.fresh + data.insights.repeat > 0 && (
          <Reveal as="section" className="ann">
            <p className="ann__label">nouveautés vs réécoutes</p>
            <div className="ratio">
              <span
                className="ratio__seg ratio__seg--fresh"
                style={{
                  width: `${(data.insights.fresh / (data.insights.fresh + data.insights.repeat)) * 100}%`,
                }}
              />
              <span
                className="ratio__seg ratio__seg--repeat"
                style={{
                  width: `${(data.insights.repeat / (data.insights.fresh + data.insights.repeat)) * 100}%`,
                }}
              />
            </div>
            <p className="prose" style={{ marginTop: "0.9rem" }}>
              <span className="mono">{nf(data.insights.fresh)}</span> découvertes de
              titres, <span className="mono">{nf(data.insights.repeat)}</span>{" "}
              réécoutes —{" "}
              {Math.round(
                (data.insights.fresh / (data.insights.fresh + data.insights.repeat)) * 100,
              )}{" "}
              % de neuf.
            </p>
          </Reveal>
        )}

        {/* ── la carte de l'année : pleine largeur ── */}
        {withHeat && (
          <Reveal as="section" className="ann ann--wide">
            <p className="ann__label">jour par jour</p>
            <Heatmap days={perDay} />
            {peak && (
              <p className="prose" style={{ marginTop: "1rem" }}>
                Jour le plus dense : le {peak.day} — {nf(peak.count)} scrobbles.
              </p>
            )}
          </Reveal>
        )}

        <nav
          className="ann period-nav"
          aria-label="Navigation période"
          style={{ paddingBottom: "4rem" }}
        >
          <Link href={nav.prevHref} className="mono">← {nav.prevLabel}</Link>
          <Link href={nav.nextHref} className="mono">{nav.nextLabel} →</Link>
        </nav>
      </div>
    </main>
  );
}
