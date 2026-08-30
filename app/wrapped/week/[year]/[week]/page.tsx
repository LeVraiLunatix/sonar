import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getPeriodData } from "@/lib/period";
import { weekRange } from "@/lib/dates";
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
  params: Promise<{ year: string; week: string }>;
  searchParams: SP;
}): Promise<Metadata> {
  const { year, week } = await params;
  const s = (await searchParams).s;
  const token = typeof s === "string" ? s : "";
  const title = recapTitle("week", `semaine ${Number(week)} · ${year}`);
  const base = `${await origin()}/wrapped/week/${year}/${week}/card`;
  const img = token ? `${base}?s=${encodeURIComponent(token)}` : base;
  return {
    title,
    openGraph: { title, images: [{ url: img, width: 1080, height: 1350 }] },
    twitter: { card: "summary_large_image", title, images: [img] },
  };
}

export default async function WrappedWeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string; week: string }>;
  searchParams: SP;
}) {
  const { year: ry, week: rw } = await params;
  const year = Number(ry);
  const week = Number(rw);
  if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) {
    notFound();
  }

  const s = (await searchParams).s;
  const token = typeof s === "string" ? s : "";
  const secret = process.env.AUTH_SECRET;
  const shared = secret ? await verifyShare(token, secret) : null;
  const viaShare =
    shared && shared.kind === "week" && shared.periodId === `${year}-${week}`
      ? shared.account
      : null;

  const account = viaShare ?? (await accountForPage());
  const data = await getPeriodData(account, weekRange(year, week), "week");
  const genre = await genreFor(data);
  const recap = buildRecap(data, "week", { genre });

  const viewer = viaShare ? null : await currentUser();
  const shareAccount = viaShare ?? viewer;
  const shareTok =
    viaShare && token
      ? token
      : secret && shareAccount
        ? await signShare(
            { account: shareAccount, kind: "week", periodId: `${year}-${week}` },
            secret,
          )
        : "";
  const sharePath = `/wrapped/week/${year}/${week}${shareTok ? `?s=${shareTok}` : ""}`;
  const cardHref = `/wrapped/week/${year}/${week}/card${token && viaShare ? `?s=${token}` : ""}`;

  return (
    <StoryPlayer
      recap={recap}
      backHref={`/week/${year}/${week}`}
      cardHref={cardHref}
      sharePath={sharePath}
    />
  );
}
