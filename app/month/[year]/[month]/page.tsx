import { notFound } from "next/navigation";
import { getPeriodData } from "@/lib/period";
import { monthRange } from "@/lib/dates";
import { accountForPage } from "@/lib/guard";
import { frMonth } from "@/lib/format";
import PeriodView from "@/components/PeriodView";

export default async function MonthPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const { year: ry, month: rm } = await params;
  const year = Number(ry);
  const month = Number(rm);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    notFound();
  }

  const account = await accountForPage();
  const data = await getPeriodData(account, monthRange(year, month), "month");

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <PeriodView
      data={data}
      navCurrent="month"
      nav={{
        prevHref: `/month/${prev.y}/${prev.m}`,
        nextHref: `/month/${next.y}/${next.m}`,
        prevLabel: `${frMonth(prev.m)} ${prev.y}`,
        nextLabel: `${frMonth(next.m)} ${next.y}`,
      }}
    />
  );
}
