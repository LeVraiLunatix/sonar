import { ImageResponse } from "next/og";
import { getPeriodData } from "@/lib/period";
import { weekRange } from "@/lib/dates";
import { resolveAccount } from "@/lib/session";
import { buildCard } from "@/lib/card";
import { genreFor } from "@/lib/recap";
import { verifyShare } from "@/lib/share";
import { recapCardImage } from "@/components/recapCardImage";
import { cardFonts } from "@/lib/cardFonts";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ year: string; week: string }> },
) {
  const { year, week } = await params;
  const s = new URL(req.url).searchParams.get("s");
  const secret = process.env.AUTH_SECRET;

  const shared = secret ? await verifyShare(s, secret) : null;
  const account =
    (shared && shared.kind === "week" && shared.periodId === `${year}-${week}`
      ? shared.account
      : null) ?? (await resolveAccount().catch(() => null));

  const data = await getPeriodData(account, weekRange(Number(year), Number(week)), "week");
  const genre = await genreFor(data);
  const card = buildCard(data, "week", genre);

  return new ImageResponse(recapCardImage(card), {
    width: 1080,
    height: 1350,
    fonts: await cardFonts(),
  });
}
