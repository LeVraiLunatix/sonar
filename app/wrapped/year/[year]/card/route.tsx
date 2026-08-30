import { ImageResponse } from "next/og";
import { getPeriodData } from "@/lib/period";
import { yearRange } from "@/lib/dates";
import { resolveAccount } from "@/lib/session";
import { buildCard } from "@/lib/card";
import { genreFor } from "@/lib/recap";
import { verifyShare } from "@/lib/share";
import { recapCardImage } from "@/components/recapCardImage";

/**
 * Carte-résumé PNG (1080×1350). Sert l'aperçu Open Graph ET le téléchargement.
 * Le compte affiché vient, dans l'ordre : du jeton de partage `?s=` (aperçu d'un
 * lien partagé, sans session), sinon de la session, sinon rien → données
 * fictives (jamais les stats d'autrui).
 */
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const { year: raw } = await params;
  const year = Number(raw);
  const s = new URL(req.url).searchParams.get("s");
  const secret = process.env.AUTH_SECRET;

  const shared = secret ? await verifyShare(s, secret) : null;
  const account =
    (shared && shared.kind === "year" && shared.periodId === String(year)
      ? shared.account
      : null) ?? (await resolveAccount().catch(() => null));

  const data = await getPeriodData(account, yearRange(year), "year");
  const genre = await genreFor(data);
  const card = buildCard(data, "year", genre);

  return new ImageResponse(recapCardImage(card), { width: 1080, height: 1350 });
}
