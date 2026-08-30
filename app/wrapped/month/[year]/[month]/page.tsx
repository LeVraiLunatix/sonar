import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPeriodData } from "@/lib/period";
import { monthRange, periodLabel } from "@/lib/dates";
import { accountForPage } from "@/lib/guard";
import { buildRecap, recapTitle } from "@/lib/recap";
import StoryPlayer from "@/components/story/StoryPlayer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}): Promise<Metadata> {
  const { year, month } = await params;
  const label = periodLabel(monthRange(Number(year), Number(month)), "month");
  return { title: recapTitle("month", label) };
}

export default async function WrappedMonthPage({
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
  const recap = buildRecap(data, "month");

  return <StoryPlayer recap={recap} backHref={`/month/${year}/${month}`} />;
}
