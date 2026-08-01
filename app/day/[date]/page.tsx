import Link from "next/link";
import { notFound } from "next/navigation";
import { getDayData } from "@/lib/period";
import { prevDay, nextDay, isoWeekOf, parisToday } from "@/lib/dates";
import { accountForPage } from "@/lib/guard";
import { nf, humanMs, frDate, frTime } from "@/lib/format";
import TopBar from "@/components/TopBar";
import BigCount from "@/components/BigCount";
import LivePeriodCount from "@/components/LivePeriodCount";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!DATE_RE.test(date)) notFound();

  const account = await accountForPage();
  const data = await getDayData(account, date);
  const { summary, perHour, topArtists, timeline } = data;
  const maxHour = Math.max(1, ...perHour.map((h) => h.count));
  const [y, m] = date.split("-").map(Number);
  const { year: wy, week } = isoWeekOf(date);
  const isToday = date === parisToday();

  return (
    <main className="year year--nospine">
      <div className="flow">
        <TopBar current="day" />

        <section className="ann">
          <p className="ann__label">journée · {frDate(date + "T12:00:00Z")}</p>
          {isToday ? (
            <LivePeriodCount
              initial={summary.scrobbles}
              todayInitial={summary.scrobbles}
              big
            />
          ) : (
            <BigCount value={summary.scrobbles} />
          )}
          <p className="prose" style={{ marginTop: "0.75rem" }}>
            <span className="big__unit">scrobbles</span> ce jour-là.
          </p>
          <div className="tallies">
            <div><span className="v">{nf(summary.artists)}</span><span className="k">artistes</span></div>
            <div><span className="v">~{humanMs(summary.estMs)}</span><span className="k">d’écoute estimée</span></div>
            {topArtists[0] && (
              <div><span className="v v--name">{topArtists[0].name}</span><span className="k">le plus écouté</span></div>
            )}
          </div>
        </section>

        {summary.scrobbles > 0 && (
          <section className="ann">
            <p className="ann__label">heure par heure</p>
            <div className="hours" role="img" aria-label="Écoutes par heure">
              {perHour.map((h) => (
                <div className="hours__col" key={h.hour} title={`${h.hour}h — ${h.count}`}>
                  <span className="hours__bar" style={{ height: `${(h.count / maxHour) * 100}%` }} />
                  {h.hour % 6 === 0 && <span className="hours__tick mono">{String(h.hour).padStart(2, "0")}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="ann">
          <p className="ann__label">le fil de la journée</p>
          {timeline.length === 0 ? (
            <p className="prose">Rien n’a été écouté ce jour-là. Un plat sur la ligne.</p>
          ) : (
            <ul className="timeline">
              {timeline.map((r, i) => (
                <li className="timeline__row" key={`${r.played_at}-${i}`}>
                  <span className="timeline__time mono">{frTime(r.played_at)}</span>
                  <span className="timeline__track">
                    <span className="timeline__title">{r.track}</span>
                    <span className="timeline__artist">{r.artist}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <nav className="ann period-nav" aria-label="Navigation jour" style={{ paddingBottom: "4rem" }}>
          <Link href={`/day/${prevDay(date)}`} className="mono">← {prevDay(date)}</Link>
          <span className="mono" style={{ display: "flex", gap: "1.25rem" }}>
            <Link href={`/week/${wy}/${week}`}>semaine</Link>
            <Link href={`/month/${y}/${m}`}>mois</Link>
          </span>
          <Link href={`/day/${nextDay(date)}`} className="mono">{nextDay(date)} →</Link>
        </nav>
      </div>
    </main>
  );
}
