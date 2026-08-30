import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getPeriodData } from "@/lib/period";
import { yearRange } from "@/lib/dates";
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
  params: Promise<{ year: string }>;
  searchParams: SP;
}): Promise<Metadata> {
  const { year } = await params;
  const s = (await searchParams).s;
  const token = typeof s === "string" ? s : "";
  const title = recapTitle("year", year);
  const base = `${await origin()}/wrapped/year/${year}/card`;
  const img = token ? `${base}?s=${encodeURIComponent(token)}` : base;
  return {
    title,
    openGraph: { title, images: [{ url: img, width: 1080, height: 1350 }] },
    twitter: { card: "summary_large_image", title, images: [img] },
  };
}

export default async function WrappedYearPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string }>;
  searchParams: SP;
}) {
  const { year: raw } = await params;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 2002 || year > 2100) notFound();

  const s = (await searchParams).s;
  const token = typeof s === "string" ? s : "";
  const secret = process.env.AUTH_SECRET;
  const shared = secret ? await verifyShare(token, secret) : null;
  const viaShare =
    shared && shared.kind === "year" && shared.periodId === String(year)
      ? shared.account
      : null;

  const account = viaShare ?? (await accountForPage());
  const data = await getPeriodData(account, yearRange(year), "year");
  const genre = await genreFor(data);
  const recap = buildRecap(data, "year", { genre });

  // lien de partage : le jeton reçu s'il est valide, sinon un neuf pour le
  // compte de la session (bouton « copier le lien » de la diapo finale)
  const viewer = viaShare ? null : await currentUser();
  const shareAccount = viaShare ?? viewer;
  const shareTok =
    viaShare && token
      ? token
      : secret && shareAccount
        ? await signShare({ account: shareAccount, kind: "year", periodId: String(year) }, secret)
        : "";
  const sharePath = `/wrapped/year/${year}${shareTok ? `?s=${shareTok}` : ""}`;
  const cardHref = `/wrapped/year/${year}/card${token && viaShare ? `?s=${token}` : ""}`;

  return (
    <StoryPlayer
      recap={recap}
      backHref={`/year/${year}`}
      cardHref={cardHref}
      sharePath={sharePath}
    />
  );
}
