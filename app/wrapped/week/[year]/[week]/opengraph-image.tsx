import { ImageResponse } from "next/og";
import { getPeriodData } from "@/lib/period";
import { weekRange } from "@/lib/dates";
import { resolveAccount } from "@/lib/session";
import { buildCard } from "@/lib/card";
import { genreFor } from "@/lib/recap";
import { recapCardImage } from "@/components/recapCardImage";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1080, height: 1350 };
export const alt = "Rétro Sonar de la semaine";

export default async function Image({
  params,
}: {
  params: Promise<{ year: string; week: string }>;
}) {
  const { year, week } = await params;
  const account = await resolveAccount().catch(() => null);
  const data = await getPeriodData(
    account,
    weekRange(Number(year), Number(week)),
    "week",
  );
  const genre = await genreFor(data);
  const card = buildCard(data, "week", genre);

  return new ImageResponse(recapCardImage(card), {
    ...size,
    headers: {
      "content-disposition": `attachment; filename="sonar-${year}-s${week}.png"`,
    },
  });
}
