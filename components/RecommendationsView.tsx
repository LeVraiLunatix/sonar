import Link from "next/link";
import { nf } from "@/lib/format";
import type { RecommendationsData } from "@/lib/recommendations";
import Reveal from "./Reveal";

function ExternalLink({
  href,
  title,
  artist,
}: {
  href: string;
  title: string;
  artist: string;
}) {
  return (
    <a className="rec-item__link" href={href} target="_blank" rel="noopener noreferrer">
      <span className="rec-item__title">{title}</span>
      <span className="rec-item__artist">{artist}</span>
    </a>
  );
}

export default function RecommendationsView({ data }: { data: RecommendationsData }) {
  if (!data.available) {
    return (
      <Reveal as="section" className="ann rec-empty">
        <p className="ann__label">archive requise</p>
        <p className="prose">
          Les recommandations apparaîtront ici dès que ton historique Last.fm aura été importé.
        </p>
      </Reveal>
    );
  }

  const recommendationCount =
    data.similar.length + data.tracks.length + data.rediscoveries.length;

  return (
    <>
      {data.signals.length > 0 && (
        <Reveal as="section" className="ann ann--wide rec-patterns">
          <p className="ann__label">ce qui bouge dans ton écoute</p>
          <ul className="rec-signals">
            {data.signals.map((signal) => (
              <li className="rec-signal" key={signal.key}>
                <span className="rec-signal__value">{signal.value}</span>
                <span className="rec-signal__label">{signal.label}</span>
                <span className="rec-signal__detail">{signal.detail}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      )}

      {recommendationCount > 0 && (
        <Reveal as="section" className="ann ann--wide rec-moment">
          <p className="ann__label">à écouter maintenant</p>
          <h2 className="rec-moment__title">recommandations du moment</h2>
          <p className="note rec-moment__note">
            une sélection liée à ce que vous avez réellement écouté ces {data.windowDays} derniers jours.
          </p>
        </Reveal>
      )}

      {data.similar.length > 0 && (
        <Reveal as="section" className="ann rec-group">
          <p className="ann__label">hors de ton archive</p>
          <h2 className="rec-group__title">artistes proches</h2>
          <p className="note rec-group__intro">
            absents de tes scrobbles, reliés à tes artistes récents par Last.fm.
          </p>
          <ol className="rec-list">
            {data.similar.map((item, index) => (
              <li className="rec-item" key={item.artist}>
                <span className="rec-item__rank">{String(index + 1).padStart(2, "0")}</span>
                <ExternalLink
                  href={item.url}
                  title={item.artist}
                  artist={`parce que vous avez écouté ${item.seed}`}
                />
                <span className="rec-item__metric">
                  <strong>{item.match} %</strong>
                  <small>proximité</small>
                </span>
              </li>
            ))}
          </ol>
        </Reveal>
      )}

      {data.tracks.length > 0 && (
        <Reveal as="section" className="ann rec-group" delay={60}>
          <p className="ann__label">dans tes artistes</p>
          <h2 className="rec-group__title">titres inexplorés</h2>
          <p className="note rec-group__intro">
            des titres populaires qui n’apparaissent jamais dans ton archive.
          </p>
          <ol className="rec-list">
            {data.tracks.map((item, index) => (
              <li className="rec-item" key={`${item.artist}-${item.track}`}>
                <span className="rec-item__rank">{String(index + 1).padStart(2, "0")}</span>
                <ExternalLink
                  href={item.url}
                  title={item.track}
                  artist={
                    item.becauseTrack
                      ? `parce que vous avez écouté « ${item.becauseTrack} »`
                      : `parce que vous avez écouté ${item.artist}`
                  }
                />
                <span className="rec-item__metric">
                  <strong>0</strong>
                  <small>chez toi</small>
                </span>
              </li>
            ))}
          </ol>
        </Reveal>
      )}

      {data.rediscoveries.length > 0 && (
        <Reveal as="section" className="ann rec-group" delay={120}>
          <p className="ann__label">retour possible</p>
          <h2 className="rec-group__title">redécouvertes</h2>
          <p className="note rec-group__intro">
            beaucoup écoutés auparavant, silencieux sur la période récente.
          </p>
          <ol className="rec-list">
            {data.rediscoveries.map((item, index) => (
              <li className="rec-item" key={item.artist}>
                <span className="rec-item__rank">{String(index + 1).padStart(2, "0")}</span>
                <Link className="rec-item__link" href={item.artistHref}>
                  <span className="rec-item__title">{item.artist}</span>
                  <span className="rec-item__artist">
                    {item.track
                      ? `parce que vous avez écouté « ${item.track} »`
                      : `parce que vous l’avez écouté ${nf(item.totalScrobbles)} fois`}
                  </span>
                </Link>
                <span className="rec-item__metric">
                  <strong>{nf(item.silentDays)} j</strong>
                  <small>sans écoute</small>
                </span>
              </li>
            ))}
          </ol>
        </Reveal>
      )}

      {!data.lastfmAvailable && (
        <Reveal as="section" className="ann rec-empty">
          <p className="ann__label">Last.fm momentanément muet</p>
          <p className="note">
            Les redécouvertes locales restent disponibles. Les suggestions externes reviendront au prochain calcul.
          </p>
        </Reveal>
      )}
    </>
  );
}
