import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPeriodData } from "@/lib/period";
import { weekRange } from "@/lib/dates";
import { accountForPage } from "@/lib/guard";
import { buildRecap, recapTitle, genreFor } from "@/lib/recap";
import StoryPlayer from "@/components/story/StoryPlayer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string; week: string }>;
}): Promise<Metadata> {
  const { year, week } = await params;
  return { title: recapTitle("week", `semaine ${Number(week)} · ${year}`) };
}

export default async function WrappedWeekPage({
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

  const account = await accountForPage();
  const data = await getPeriodData(account, weekRange(year, week), "week");
  const genre = await genreFor(data);
  const recap = buildRecap(data, "week", { genre });

  return (
    <StoryPlayer
      recap={recap}
      backHref={`/week/${year}/${week}`}
      cardHref={`/wrapped/week/${year}/${week}/opengraph-image`}
    />
  );
}
