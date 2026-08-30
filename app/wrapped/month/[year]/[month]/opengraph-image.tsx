import { ImageResponse } from "next/og";
import { getPeriodData } from "@/lib/period";
import { monthRange } from "@/lib/dates";
import { resolveAccount } from "@/lib/session";
import { buildCard } from "@/lib/card";
import { genreFor } from "@/lib/recap";
import { recapCardImage } from "@/components/recapCardImage";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1080, height: 1350 };
export const alt = "Rétro Sonar du mois";

export default async function Image({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const { year, month } = await params;
  const account = await resolveAccount().catch(() => null);
  const data = await getPeriodData(
    account,
    monthRange(Number(year), Number(month)),
    "month",
  );
  const genre = await genreFor(data);
  const card = buildCard(data, "month", genre);

  return new ImageResponse(recapCardImage(card), {
    ...size,
    headers: {
      "content-disposition": `attachment; filename="sonar-${year}-${month}.png"`,
    },
  });
}
