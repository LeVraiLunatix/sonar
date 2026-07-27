import { notFound } from "next/navigation";
import { getPeriodData } from "@/lib/period";
import { weekRange, isoWeekOf, addDays } from "@/lib/dates";
import { accountForPage } from "@/lib/guard";
import PeriodView from "@/components/PeriodView";

export default async function WeekPage({
  params,
}: {
  params: Promise<{ year: string; week: string }>;
}) {
  const { year: ry, week: rw } = await params;
  const year = Number(ry);
  const week = Number(rw);
  if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) {
    notFound();
  }

  const range = weekRange(year, week);
  const account = await accountForPage();
  const data = await getPeriodData(account, range, "week");

  // Semaines voisines via les lundis adjacents (robuste aux années à 52/53 semaines).
  const prevW = isoWeekOf(addDays(range.start, -7));
  const nextW = isoWeekOf(addDays(range.start, 7));

  return (
    <PeriodView
      data={data}
      navCurrent="week"
      nav={{
        prevHref: `/week/${prevW.year}/${prevW.week}`,
        nextHref: `/week/${nextW.year}/${nextW.week}`,
        prevLabel: `sem. ${prevW.week}`,
        nextLabel: `sem. ${nextW.week}`,
      }}
    />
  );
}
