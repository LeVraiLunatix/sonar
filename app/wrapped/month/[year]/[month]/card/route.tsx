import { ImageResponse } from "next/og";
import { getPeriodData } from "@/lib/period";
import { monthRange } from "@/lib/dates";
import { resolveAccount } from "@/lib/session";
import { buildCard } from "@/lib/card";
import { genreFor } from "@/lib/recap";
import { verifyShare } from "@/lib/share";
import { recapCardImage } from "@/components/recapCardImage";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ year: string; month: string }> },
) {
  const { year, month } = await params;
  const s = new URL(req.url).searchParams.get("s");
  const secret = process.env.AUTH_SECRET;

  const shared = secret ? await verifyShare(s, secret) : null;
  const account =
    (shared && shared.kind === "month" && shared.periodId === `${year}-${month}`
      ? shared.account
      : null) ?? (await resolveAccount().catch(() => null));

  const data = await getPeriodData(
    account,
    monthRange(Number(year), Number(month)),
    "month",
  );
  const genre = await genreFor(data);
  const card = buildCard(data, "month", genre);

  return new ImageResponse(recapCardImage(card), { width: 1080, height: 1350 });
}
