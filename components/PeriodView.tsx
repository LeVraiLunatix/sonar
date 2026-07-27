import Link from "next/link";
import type { PeriodData } from "@/lib/period";
import { nf, humanMs } from "@/lib/format";
import AmplitudeSpine from "./AmplitudeSpine";
import CompareRanks from "./CompareRanks";
import Heatmap from "./Heatmap";
import Clock from "./Clock";
import TopBar from "./TopBar";

function BigNumber({ value }: { value: number }) {
  const s = nf(value);
  return (
    <span className="big">
      <span className="big__ghost" aria-hidden="true">{s}</span>
      <span className="big__ink">{s}</span>
    </span>
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
  const { summary, perDay, perHour, topArtists, topTracks, discoveries, streak, kind } = data;
  const withSpine = perDay.length >= 14;
  const withHeat = perDay.length >= 28;
  const activeDays = perDay.filter((d) => d.count > 0).length;
  const peak = perDay.reduce((a, b) => (b.count > a.count ? b : a), perDay[0]);

  return (
    <main className={withSpine ? "year" : "year year--nospine"}>
      {withSpine && <AmplitudeSpine days={perDay} />}

      <div className="flow">
        <TopBar current={navCurrent} />

        <section className="ann">
          <p className="ann__label">
            {kind === "year" ? "archive" : kind} · {data.label}
            {data.source === "fixtures" ? " · données fictives" : ""}
          </p>
          <BigNumber value={summary.scrobbles} />
          <p className="prose" style={{ marginTop: "0.75rem" }}>
            <span className="big__unit">scrobbles</span>
            {activeDays > 1 ? `, sur ${activeDays} jours d’écoute.` : "."}
          </p>
          <div className="tallies">
            <div><span className="v">{nf(summary.artists)}</span><span className="k">artistes</span></div>
            <div><span className="v">{nf(summary.tracks)}</span><span className="k">titres uniques</span></div>
            <div><span className="v">~{humanMs(summary.estMs)}</span><span className="k">d’écoute estimée</span></div>
            {streak > 1 && (
              <div><span className="v">{streak} j</span><span className="k">plus longue série</span></div>
            )}
          </div>
        </section>

        {topArtists.length > 0 && (
          <section className="ann">
            <p className="ann__label">artistes — vs période précédente</p>
            <CompareRanks artists={topArtists} prev={data.prevArtist} />
            <p className="note" style={{ marginTop: "1rem" }}>
              barre rose : cette période. trait bleu : la précédente. le violet est leur recouvrement.
            </p>
          </section>
        )}

        {summary.scrobbles > 0 && (
          <section className="ann">
            <p className="ann__label">à quelle heure ça écoute</p>
            <Clock hours={perHour} />
          </section>
        )}

        {withHeat && (
          <section className="ann">
            <p className="ann__label">jour par jour</p>
            <Heatmap days={perDay} />
            {peak && (
              <p className="prose" style={{ marginTop: "1rem" }}>
                Jour le plus dense : le {peak.day} — {nf(peak.count)} scrobbles.
              </p>
            )}
          </section>
        )}

        {topTracks.length > 0 && (
          <section className="ann">
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
          </section>
        )}

        {discoveries.length > 0 && (
          <section className="ann">
            <p className="ann__label">découvertes — premier scrobble dans la période</p>
            <ul className="ranks">
              {discoveries.slice(0, 8).map((d) => (
                <li className="rank" key={d.key} style={{ gridTemplateColumns: "1fr auto" }}>
                  <span className="rank__name" style={{ maxWidth: "none" }}>{d.name}</span>
                  <span className="rank__val">{nf(d.count)} écoutes ensuite</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav className="ann period-nav" aria-label="Navigation période" style={{ paddingBottom: "4rem" }}>
          <Link href={nav.prevHref} className="mono">← {nav.prevLabel}</Link>
          <Link href={nav.nextHref} className="mono">{nav.nextLabel} →</Link>
        </nav>
      </div>
    </main>
  );
}
