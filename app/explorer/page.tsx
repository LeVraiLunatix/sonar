import type { Metadata } from "next";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import Reveal from "@/components/Reveal";
import SurprisePick from "@/components/SurprisePick";
import InkValue from "@/components/InkValue";
import { publicAccount } from "@/lib/accounts";
import { getExplorerData, matchProfiles, type Flashback } from "@/lib/explorer";
import { frDate, humanMs, nf } from "@/lib/format";
import { accountForPage } from "@/lib/guard";
import { getRecommendations } from "@/lib/recommendations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explorer",
  description: "ADN musical, FLASHBACK, Wrap, RADAR et archives personnelles.",
};

const pad = (value: number) => String(value).padStart(2, "0");

function FlashbackList({ items, unit }: { items: Flashback[]; unit: "an" | "mois" }) {
  if (items.length === 0) {
    return <p className="note">aucun souvenir retrouvé pour cette date.</p>;
  }
  return (
    <ol className="exp-list">
      {items.map((item) => (
        <li className="exp-row" key={`${unit}-${item.date}`}>
          <span className="exp-row__metric">
            <InkValue>{item.distance}</InkValue>
            <small>{unit}{unit === "an" && item.distance > 1 ? "s" : ""}</small>
          </span>
          <Link className="exp-row__main" href={`/day/${item.date}`}>
            <strong>{item.track}</strong>
            <span>{item.artist} · {frDate(`${item.date}T12:00:00Z`)}</span>
          </Link>
          <span className="exp-row__tail"><InkValue as="span">{nf(item.scrobbles)}</InkValue><small>écoutes</small></span>
        </li>
      ))}
    </ol>
  );
}

export default async function ExplorerPage({
  searchParams,
}: {
  searchParams: Promise<{ profil?: string }>;
}) {
  const [{ profil }, account] = await Promise.all([searchParams, accountForPage()]);
  const requestedProfile = profil?.trim().slice(0, 64) ?? "";
  const targetPromise =
    account && requestedProfile && requestedProfile.toLowerCase() !== account.toLowerCase()
      ? publicAccount(requestedProfile)
      : Promise.resolve(null);
  const [data, recommendations, target] = await Promise.all([
    getExplorerData(account),
    getRecommendations(account, 90),
    targetPromise,
  ]);
  const match = account && target ? await matchProfiles(account, target) : null;
  const wrap = data.wrap;

  return (
    <main className="year year--nospine">
      <div className="flow flow--wide exp-page">
        <TopBar current="explorer" />

        <Reveal as="section" className="ann ann--head exp-head">
          <p className="ann__label">huit façons de relire ton archive</p>
          <h1>explorer</h1>
          <p className="prose">Ton historique ne compte pas seulement les écoutes. Il garde les retours, les habitudes et les morceaux laissés derrière.</p>
          <nav className="exp-index" aria-label="Fonctionnalités d’Explorer">
            <a href="#adn">ADN</a>
            <a href="#flashback">FLASHBACK</a>
            <a href="#wrap">Le Wrap</a>
            <a href="#albums">Albums</a>
            <a href="#pioche">Pioche</a>
            <a href="#match">Match</a>
            <a href="#radar">RADAR</a>
            <a href="#favoris">Favoris</a>
          </nav>
        </Reveal>

        {!data.available ? (
          <Reveal as="section" className="ann ann--wide">
            <p className="ann__label">archive requise</p>
            <p className="prose">Explorer apparaîtra dès que ton historique Last.fm sera importé.</p>
          </Reveal>
        ) : (
          <>
            <Reveal as="section" className="ann ann--wide exp-section" id="adn">
              <p className="ann__label">90 derniers jours · {nf(data.dna.recentScrobbles)} scrobbles</p>
              <h2>ADN musical</h2>
              <div className="exp-metrics">
                <div><InkValue>{data.dna.loyalty}%</InkValue><span>fidélité</span><small>écoutes d’artistes suivis sur au moins trois mois</small></div>
                <div><InkValue>{data.dna.curiosity}%</InkValue><span>curiosité</span><small>artistes récents découverts pendant la période</small></div>
                <div><InkValue>{data.dna.replay}%</InkValue><span>répétition</span><small>écoutes qui reviennent sur un titre déjà lancé</small></div>
                <div><InkValue>{data.dna.night}%</InkValue><span>nuit</span><small>écoutes enregistrées entre minuit et six heures</small></div>
              </div>
            </Reveal>

            <Reveal as="section" className="ann ann--wide exp-section" id="flashback">
              <p className="ann__label">le même jour, ailleurs dans ton histoire</p>
              <h2 className="exp-title--giant">FLASHBACK</h2>
              <div className="exp-split">
                <div>
                  <h3>année après année</h3>
                  <FlashbackList items={data.yearlyFlashbacks} unit="an" />
                </div>
                <div>
                  <h3>mois après mois</h3>
                  <FlashbackList items={data.monthlyFlashbacks} unit="mois" />
                </div>
              </div>
            </Reveal>

            <Reveal as="section" className="ann ann--wide exp-section" id="wrap">
              <p className="ann__label">du {frDate(`${wrap.start}T12:00:00Z`)} au {frDate(`${wrap.end}T12:00:00Z`)}</p>
              <h2>Le Wrap <em>(de la semaine)</em></h2>
              <div className="wrap-lead">
                <InkValue>{nf(wrap.scrobbles)}</InkValue>
                <span>scrobbles</span>
                <small>{wrap.delta === null ? "première mesure comparable" : `${wrap.delta >= 0 ? "+" : ""}${wrap.delta} % face à la semaine passée`}</small>
              </div>
              <div className="exp-metrics exp-metrics--wrap">
                <div><InkValue>{humanMs(wrap.estMs)}</InkValue><span>temps estimé</span></div>
                <div><strong>{wrap.topArtist?.name ?? "—"}</strong><span>artiste n° 1</span><small>{wrap.topArtist ? `${nf(wrap.topArtist.count)} écoutes` : "aucune écoute"}</small></div>
                <div><InkValue>{wrap.discoveries}</InkValue><span>découvertes</span><small>{wrap.freshPercent} % de premières écoutes</small></div>
                <div><InkValue>{wrap.streak} j</InkValue><span>série</span><small>{wrap.obsession ? `obsession : ${wrap.obsession}` : "jours consécutifs"}</small></div>
              </div>
              {wrap.topTrack && (
                <p className="wrap-note">titre de la semaine · <strong>{wrap.topTrack.track}</strong> par {wrap.topTrack.artist} · {nf(wrap.topTrack.count)} écoutes</p>
              )}
              {wrap.peakDay && wrap.peakHour && (
                <p className="note">pic le {frDate(`${wrap.peakDay.day}T12:00:00Z`)} · heure forte autour de {pad(wrap.peakHour.hour)} h</p>
              )}
            </Reveal>

            <Reveal as="section" className="ann exp-section" id="albums">
              <p className="ann__label">silencieux depuis au moins 30 jours</p>
              <h2>albums à reprendre</h2>
              {data.albums.length > 0 ? (
                <ol className="exp-list">
                  {data.albums.map((album) => (
                    <li className="exp-row" key={`${album.artist}-${album.album}`}>
                      <span className="exp-row__metric"><InkValue>{nf(album.scrobbles)}</InkValue><small>écoutes</small></span>
                      <a className="exp-row__main" href={album.url} target="_blank" rel="noopener noreferrer"><strong>{album.album}</strong><span>{album.artist}</span></a>
                      <span className="exp-row__tail"><InkValue as="span">{nf(album.silentDays)}</InkValue><small>jours</small></span>
                    </li>
                  ))}
                </ol>
              ) : <p className="note">aucun album assez ancien à relancer.</p>}
            </Reveal>

            <Reveal as="section" className="ann exp-section" id="pioche">
              <p className="ann__label">une décision en moins</p>
              <h2>pioche-moi un titre</h2>
              <SurprisePick tracks={recommendations.tracks} />
            </Reveal>

            <Reveal as="section" className="ann ann--wide exp-section" id="match">
              <p className="ann__label">deux archives, une zone commune</p>
              <h2>match musical</h2>
              <form className="match-form" method="get" action="/explorer#match">
                <label htmlFor="profil">profil Sonar public</label>
                <input id="profil" name="profil" defaultValue={requestedProfile} placeholder="pseudo Last.fm" maxLength={64} />
                <button type="submit">calculer le match</button>
              </form>
              {requestedProfile && !match && (
                <p className="note">profil introuvable, privé, ou identique au tien.</p>
              )}
              {match && (
                <div className="match-result">
                  <div className="match-score"><InkValue>{match.score}%</InkValue><span>avec {match.username}</span></div>
                  <div className="exp-split">
                    <div><h3>terrain commun</h3><ol className="match-list">{match.shared.map((item) => <li key={item.name}><strong>{item.name}</strong><span>{nf(item.yours)} · {nf(item.theirs)}</span></li>)}</ol></div>
                    <div><h3>à te faire découvrir</h3><ol className="match-list">{match.forYou.map((item) => <li key={item.name}><strong>{item.name}</strong><span>{nf(item.count)} chez {match.username}</span></li>)}</ol></div>
                  </div>
                </div>
              )}
            </Reveal>

            <Reveal as="section" className="ann exp-section" id="radar">
              <p className="ann__label">ce qui passe chez tes amis Last.fm</p>
              <h2 className="exp-title--giant">RADAR</h2>
              {data.radar.length > 0 ? (
                <ol className="exp-list">
                  {data.radar.map((item) => (
                    <li className="exp-row" key={`${item.friend}-${item.artist}-${item.track}`}>
                      <span className={`radar-dot${item.nowPlaying ? " is-live" : ""}`} aria-hidden="true" />
                      <a className="exp-row__main" href={item.url} target="_blank" rel="noopener noreferrer"><strong>{item.track}</strong><span>{item.artist} · chez {item.friend}</span></a>
                      <span className="exp-row__tail exp-row__tail--text"><small>{item.knownArtist ? "titre neuf" : "artiste neuf"}</small></span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="note">{data.radarAvailable ? "aucun signal neuf chez tes amis pour le moment." : "Last.fm ne répond pas au radar pour le moment."}</p>
              )}
            </Reveal>

            <Reveal as="section" className="ann exp-section" id="favoris">
              <p className="ann__label">aimés, puis laissés au silence</p>
              <h2>archives des favoris</h2>
              {data.favourites.length > 0 ? (
                <ol className="exp-list">
                  {data.favourites.map((item) => (
                    <li className="exp-row" key={`${item.artist}-${item.track}`}>
                      <span className="exp-row__metric"><InkValue>{nf(item.scrobbles)}</InkValue><small>écoutes</small></span>
                      <a className="exp-row__main" href={item.url} target="_blank" rel="noopener noreferrer"><strong>{item.track}</strong><span>{item.artist}</span></a>
                      <span className="exp-row__tail"><InkValue as="span">{nf(item.silentDays)}</InkValue><small>jours</small></span>
                    </li>
                  ))}
                </ol>
              ) : <p className="note">aucun ancien favori détecté dans l’archive.</p>}
            </Reveal>
          </>
        )}

        <nav className="ann period-nav" aria-label="Navigation Explorer">
          <Link href="/">← accueil</Link>
          <Link href="/recommendations">recommandations →</Link>
        </nav>
      </div>
    </main>
  );
}
