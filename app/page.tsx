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
import { accountForPage } from "@/lib/guard";
import { nf, frDate } from "@/lib/format";
import TopBar from "@/components/TopBar";
import AmplitudeStrip from "@/components/AmplitudeStrip";
import LiveRecent from "@/components/LiveRecent";
import LiveToday from "@/components/LiveToday";
import LivePeriodCount from "@/components/LivePeriodCount";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";

export default async function Home() {
  const today = parisToday();
  const [y, m] = today.split("-").map(Number);
  const { year: wy, week } = isoWeekOf(today);

  const account = await accountForPage();
  const data = await getHomeData(account, {
    today: dayRange(today),
    week: weekRange(wy, week),
    month: monthRange(y, m),
    last90: { start: addDays(today, -89), end: addDays(today, 1) },
  });

  const tiles = [
    // Les valeurs contenant aujourd'hui sont réconciliées avec Last.fm côté client.
    { href: `/day/${today}`, label: "aujourd’hui", v: data.today.summary.scrobbles, live: "today" },
    { href: `/week/${wy}/${week}`, label: "cette semaine", v: data.week.summary.scrobbles, live: "period" },
    { href: `/month/${y}/${m}`, label: "ce mois-ci", v: data.month.summary.scrobbles, live: "period" },
  ];

  const now = new Date().getFullYear();

  return (
    <main className="year year--nospine">
      <div className="flow flow--wide">
        <TopBar />

        <Reveal as="section" className="ann">
          <p className="ann__label">
            ce mois-ci
            {data.source === "fixtures" ? " · données fictives" : ""}
          </p>
          <LivePeriodCount
            initial={data.month.summary.scrobbles}
            todayInitial={data.today.summary.scrobbles}
            big
          />
          <p className="prose" style={{ marginTop: "0.75rem" }}>
            <span className="big__unit">scrobbles</span> ce mois-ci. Ci-dessous, les 90 derniers jours.
          </p>
        </Reveal>

        <Reveal as="section" className="ann">
          <AmplitudeStrip days={data.last90} />
        </Reveal>

        <Reveal as="section" className="ann">
          <p className="ann__label">en ce moment</p>
          <ul className="tiles">
            {tiles.map((t) => (
              <li key={t.href}>
                <Link href={t.href} className="tile">
                  <span className="tile__v mono">
                    {t.live === "today" ? (
                      <LiveToday initial={t.v} />
                    ) : (
                      <LivePeriodCount
                        initial={t.v}
                        todayInitial={data.today.summary.scrobbles}
                      />
                    )}
                  </span>
                  <span className="tile__k">{t.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal as="section" className="ann">
          <p className="ann__label">depuis toujours</p>
          <Link href="/all" className="tile">
            <span className="stat__v">{nf(data.lifetime.total)}</span>
            <span className="stat__k">scrobbles au total · voir toutes les données →</span>
          </Link>
          {data.lifetime.first && (
            <p className="note" style={{ margin: "0.9rem 0 0" }}>
              premier scrobble le {frDate(data.lifetime.first)}
            </p>
          )}
        </Reveal>

        <Reveal as="section" className="ann">
          <p className="ann__label">derniers scrobbles</p>
          <LiveRecent initial={data.recent} />
        </Reveal>

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
