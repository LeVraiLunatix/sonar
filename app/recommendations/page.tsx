import type { Metadata } from "next";
import Link from "next/link";
import { accountForPage } from "@/lib/guard";
import {
  getRecommendations,
  RECOMMENDATION_WINDOWS,
  type RecommendationWindow,
} from "@/lib/recommendations";
import { nf } from "@/lib/format";
import TopBar from "@/components/TopBar";
import BigCount from "@/components/BigCount";
import Reveal from "@/components/Reveal";
import RecommendationsView from "@/components/RecommendationsView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recommandations",
  description: "Des pistes calculées depuis ton véritable historique Last.fm.",
};

function parseWindow(value: string | undefined): RecommendationWindow {
  const parsed = Number(value);
  return RECOMMENDATION_WINDOWS.includes(parsed as RecommendationWindow)
    ? (parsed as RecommendationWindow)
    : 90;
}

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const { periode } = await searchParams;
  const windowDays = parseWindow(periode);
  const account = await accountForPage();
  const data = await getRecommendations(account, windowDays);
  const total = data.similar.length + data.tracks.length + data.rediscoveries.length;

  return (
    <main className="year year--nospine">
      <div className="flow flow--wide rec-page">
        <TopBar current="recommendations" />

        <Reveal as="section" className="ann ann--head rec-head">
          <div className="rec-head__copy">
            <p className="ann__label">calculées depuis ton archive</p>
            <h1 className="rec-head__title">recommandations</h1>
            <p className="prose rec-head__prose">
              {nf(data.recentScrobbles)} scrobbles et {nf(data.recentArtists)} artistes analysés sur les {windowDays} derniers jours, comparés à ton historique.
            </p>
          </div>
          <div className="rec-head__count" aria-label={`${total} recommandations`}>
            <BigCount value={total} />
            <span className="stat__k">pistes à suivre</span>
          </div>
          <nav className="rec-window" aria-label="Période récente analysée">
            {RECOMMENDATION_WINDOWS.map((days) => (
              <Link
                key={days}
                href={`/recommendations?periode=${days}`}
                className={windowDays === days ? "is-current" : undefined}
                aria-current={windowDays === days ? "page" : undefined}
              >
                {days} jours
              </Link>
            ))}
          </nav>
          <p className="note rec-head__cache">
            recalcul toutes les 6 h · catalogue Last.fm conservé 7 jours
          </p>
        </Reveal>

        <RecommendationsView data={data} />

        <nav className="ann period-nav" aria-label="Navigation recommandations">
          <Link href="/" className="mono">← accueil</Link>
          <a
            href="https://www.last.fm/home"
            target="_blank"
            rel="noopener noreferrer"
            className="mono"
          >
            ouvrir Last.fm →
          </a>
        </nav>
      </div>
    </main>
  );
}
