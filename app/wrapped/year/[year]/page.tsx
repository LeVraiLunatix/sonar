import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPeriodData } from "@/lib/period";
import { yearRange } from "@/lib/dates";
import { accountForPage } from "@/lib/guard";
import { buildRecap, recapTitle } from "@/lib/recap";
import StoryPlayer from "@/components/story/StoryPlayer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}): Promise<Metadata> {
  const { year } = await params;
  return { title: recapTitle("year", year) };
}

export default async function WrappedYearPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year: raw } = await params;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 2002 || year > 2100) notFound();

  const account = await accountForPage();
  const data = await getPeriodData(account, yearRange(year), "year");
  const recap = buildRecap(data, "year");

  return <StoryPlayer recap={recap} backHref={`/year/${year}`} />;
}
