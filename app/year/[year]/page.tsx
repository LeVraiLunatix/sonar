import { notFound } from "next/navigation";
import { getPeriodData } from "@/lib/period";
import { yearRange } from "@/lib/dates";
import { accountForPage } from "@/lib/guard";
import PeriodView from "@/components/PeriodView";

export default async function YearPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year: raw } = await params;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 2002 || year > 2100) notFound();

  const account = await accountForPage();
  const data = await getPeriodData(account, yearRange(year), "year");

  return (
    <PeriodView
      data={data}
      navCurrent="year"
      nav={{
        prevHref: `/year/${year - 1}`,
        nextHref: `/year/${year + 1}`,
        prevLabel: String(year - 1),
        nextLabel: String(year + 1),
      }}
    />
  );
}
