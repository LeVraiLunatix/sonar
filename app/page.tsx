import Link from "next/link";
import { getHomeData } from "@/lib/period";
import {
  parisToday,
  dayRange,
  weekRange,
  monthRange,
  isoWeekOf,
  addDays,
} from "@/lib/dates";
import { nf, frDate } from "@/lib/format";
import TopBar from "@/components/TopBar";
import NowPlaying from "@/components/NowPlaying";
import AmplitudeStrip from "@/components/AmplitudeStrip";
import RecentList from "@/components/RecentList";

export const dynamic = "force-dynamic";

export default async function Home() {
  const today = parisToday();
  const [y, m] = today.split("-").map(Number);
  const { year: wy, week } = isoWeekOf(today);

  const data = await getHomeData({
    today: dayRange(today),
    week: weekRange(wy, week),
    month: monthRange(y, m),
    last90: { start: addDays(today, -89), end: addDays(today, 1) },
  });

  const tiles = [
    { href: `/day/${today}`, label: "aujourd’hui", v: data.today.summary.scrobbles },
    { href: `/week/${wy}/${week}`, label: "cette semaine", v: data.week.summary.scrobbles },
    { href: `/month/${y}/${m}`, label: "ce mois-ci", v: data.month.summary.scrobbles },
  ];

  const now = new Date().getFullYear();

  return (
    <main className="year year--nospine">
      <div className="flow flow--wide">
        <TopBar />

        <div className="np-inline">
          <NowPlaying />
        </div>

        <section className="ann">
          <p className="ann__label">
            depuis toujours{data.lifetime.first ? ` · premier scrobble le ${frDate(data.lifetime.first)}` : ""}
            {data.source === "fixtures" ? " · données fictives" : ""}
          </p>
          <span className="big">
            <span className="big__ghost" aria-hidden="true">{nf(data.lifetime.total)}</span>
            <span className="big__ink">{nf(data.lifetime.total)}</span>
          </span>
          <p className="prose" style={{ marginTop: "0.75rem" }}>
            <span className="big__unit">scrobbles</span> enregistrés. Ci-dessous, les 90 derniers jours.
          </p>
        </section>

        <section className="ann" aria-label="90 derniers jours">
          <AmplitudeStrip days={data.last90} />
        </section>

        <section className="ann">
          <p className="ann__label">en ce moment</p>
          <ul className="tiles">
            {tiles.map((t) => (
              <li key={t.href}>
                <Link href={t.href} className="tile">
                  <span className="tile__v mono">{nf(t.v)}</span>
                  <span className="tile__k">{t.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="ann">
          <p className="ann__label">derniers scrobbles</p>
          <RecentList rows={data.recent} />
        </section>

        <nav className="ann" aria-label="Par année" style={{ paddingBottom: "4rem" }}>
          <p className="ann__label">par année</p>
          <p className="mono" style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "1.4rem" }}>
            {[now, now - 1, now - 2, now - 3].map((yr) => (
              <Link key={yr} href={`/year/${yr}`}>{yr}</Link>
            ))}
          </p>
        </nav>
      </div>
    </main>
  );
}
