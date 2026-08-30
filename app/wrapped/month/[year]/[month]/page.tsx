import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getPeriodData } from "@/lib/period";
import { monthRange, periodLabel } from "@/lib/dates";
import { accountForPage } from "@/lib/guard";
import { currentUser } from "@/lib/session";
import { buildRecap, recapTitle, genreFor } from "@/lib/recap";
import { signShare, verifyShare } from "@/lib/share";
import StoryPlayer from "@/components/story/StoryPlayer";

type SP = Promise<{ [key: string]: string | string[] | undefined }>;

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ year: string; month: string }>;
  searchParams: SP;
}): Promise<Metadata> {
  const { year, month } = await params;
  const s = (await searchParams).s;
  const token = typeof s === "string" ? s : "";
  const label = periodLabel(monthRange(Number(year), Number(month)), "month");
  const title = recapTitle("month", label);
  const base = `${await origin()}/wrapped/month/${year}/${month}/card`;
  const img = token ? `${base}?s=${encodeURIComponent(token)}` : base;
  return {
    title,
    openGraph: { title, images: [{ url: img, width: 1080, height: 1350 }] },
    twitter: { card: "summary_large_image", title, images: [img] },
  };
}

export default async function WrappedMonthPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string; month: string }>;
  searchParams: SP;
}) {
  const { year: ry, month: rm } = await params;
  const year = Number(ry);
  const month = Number(rm);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    notFound();
  }

  const s = (await searchParams).s;
  const token = typeof s === "string" ? s : "";
  const secret = process.env.AUTH_SECRET;
  const shared = secret ? await verifyShare(token, secret) : null;
  const viaShare =
    shared && shared.kind === "month" && shared.periodId === `${year}-${month}`
      ? shared.account
      : null;

  const account = viaShare ?? (await accountForPage());
  const data = await getPeriodData(account, monthRange(year, month), "month");
  const genre = await genreFor(data);
  const recap = buildRecap(data, "month", { genre });

  const viewer = viaShare ? null : await currentUser();
  const shareAccount = viaShare ?? viewer;
  const shareTok =
    viaShare && token
      ? token
      : secret && shareAccount
        ? await signShare(
            { account: shareAccount, kind: "month", periodId: `${year}-${month}` },
            secret,
          )
        : "";
  const sharePath = `/wrapped/month/${year}/${month}${shareTok ? `?s=${shareTok}` : ""}`;
  const cardHref = `/wrapped/month/${year}/${month}/card${token && viaShare ? `?s=${token}` : ""}`;

  return (
    <StoryPlayer
      recap={recap}
      backHref={`/month/${year}/${month}`}
      cardHref={cardHref}
      sharePath={sharePath}
    />
  );
}
