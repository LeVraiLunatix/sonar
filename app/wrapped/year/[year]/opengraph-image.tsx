import { ImageResponse } from "next/og";
import { getPeriodData } from "@/lib/period";
import { yearRange } from "@/lib/dates";
import { resolveAccount } from "@/lib/session";
import { buildCard } from "@/lib/card";
import { genreFor } from "@/lib/recap";
import { recapCardImage } from "@/components/recapCardImage";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1080, height: 1350 };
export const alt = "Rétro Sonar de l’année";

export default async function Image({ params }: { params: Promise<{ year: string }> }) {
  const { year: raw } = await params;
  const year = Number(raw);
  const account = await resolveAccount().catch(() => null);
  const data = await getPeriodData(account, yearRange(year), "year");
  const genre = await genreFor(data);
  const card = buildCard(data, "year", genre);

  return new ImageResponse(recapCardImage(card), {
    ...size,
    headers: {
      "content-disposition": `attachment; filename="sonar-${year}.png"`,
    },
  });
}
