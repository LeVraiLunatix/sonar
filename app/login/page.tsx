import type { Metadata } from "next";
import Logo from "@/components/Logo";
import Reveal from "@/components/Reveal";
import BigCount from "@/components/BigCount";
import InkDemo from "@/components/InkDemo";
import AmplitudeStrip from "@/components/AmplitudeStrip";
import type { DayCount } from "@/lib/stats";

export const metadata: Metadata = {
  // `absolute` : sinon le gabarit du layout ajoute « · Sonar » en double.
  title: { absolute: "Sonar — ton archive d’écoute" },
  description:
    "Un Wrapped permanent : tes écoutes Last.fm par jour, semaine, mois et année, consultables à tout moment.",
};

/** Courbe de démonstration, déterministe (aucune donnée réelle ici). */
function demoWave(): DayCount[] {
  const out: DayCount[] = [];
  for (let i = 0; i < 120; i++) {
    const season = 30 + 22 * Math.sin(i / 9) + 14 * Math.sin(i / 3.1);
    const spike = i % 37 === 0 ? 45 : 0;
    const off = i % 23 === 0 || i % 31 === 0 ? -100 : 0;
    out.push({
      day: String(i),
      count: Math.max(0, Math.round(season + spike + off)),
    });
  }
  return out;
}

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Tu connectes Last.fm",
    body: "Une autorisation, pas de mot de passe à donner. Sonar ne lit que tes écoutes, qui sont déjà publiques.",
  },
  {
    n: "02",
    title: "Tout l’historique est rapatrié",
    body: "Chaque scrobble depuis le premier jour, copié dans une base à toi. Une seule fois, puis mis à jour tout seul.",
  },
  {
    n: "03",
    title: "Tu explores n’importe quelle période",
    body: "Un jour précis, une semaine, un mois, une année. Les statistiques sont recalculées à la demande, pas figées.",
  },
];

const FEATURES: { k: string; v: string }[] = [
  { k: "horloge d’écoute", v: "à quelle heure de la journée tu écoutes, heure par heure" },
  { k: "carte de l’année", v: "chaque jour en aplat — les jours à zéro compris" },
  { k: "séries", v: "le nombre de jours consécutifs avec au moins une écoute" },
  { k: "découvertes", v: "les artistes dont le tout premier scrobble tombe dans la période" },
  { k: "comparaison", v: "deux périodes superposées, leur recouvrement en violet" },
  { k: "le fil d’une journée", v: "l’ordre exact des morceaux, minute par minute" },
];

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; denied?: string; detail?: string }>;
}) {
  const { error, denied, detail } = await searchParams;

  return (
    <main className="landing">
      {/* ── barre haute ── */}
      <header className="landing__top">
        <span className="brand">
          <Logo />
        </span>
        <a className="btn btn--ghost" href="/api/auth/login">
          se connecter
        </a>
      </header>

      {/* ── hero ── */}
      <section className="landing__hero">
        <p className="eyebrow">archive d’écoute · wrapped permanent</p>

        <h1 className="landing__h1">
          <BigCount value={365} />
          <span className="landing__unit">jours par an</span>
        </h1>

        <p className="landing__lede prose">
          Ton résumé d’écoute ne devrait pas exister une semaine en décembre.
          Sonar rapatrie tout ton historique Last.fm et le garde consultable —
          par jour, par semaine, par mois, par année.
        </p>

        <div className="landing__cta">
          <a className="btn btn--solid" href="/api/auth/login">
            Se connecter avec Last.fm
          </a>
          <span className="note">gratuit · aucune donnée revendue</span>
        </div>

        {(denied || error) && (
          <p className="login__error mono" role="alert">
            {denied
              ? `${denied} : l’accès n’est pas encore ouvert à ce compte.`
              : error === "config"
                ? "connexion Last.fm non configurée (clé / secret manquants)"
                : "la connexion Last.fm a échoué, réessaie"}
            {detail ? (
              <>
                <br />↳ {detail}
              </>
            ) : null}
          </p>
        )}
      </section>

      {/* ── la ligne signature ── */}
      <section className="landing__wave" aria-hidden="true">
        <AmplitudeStrip days={demoWave()} />
        <p className="note landing__wavecap">
          une ligne continue : la hauteur, c’est le nombre d’écoutes du jour.
          les jours à zéro restent des plats.
        </p>
      </section>

      {/* ── le principe ── */}
      <Reveal as="section" className="landing__block">
        <p className="ann__label">le principe</p>
        <h2 className="landing__h2">
          Les chiffres parlent fort. Le texte chuchote.
        </h2>
        <p className="prose">
          Dans une application de statistiques classique, le titre est énorme et
          la donnée minuscule. Ici c’est l’inverse : le compteur est la
          typographie d’affichage, parce que c’est lui le sujet. Un scrobble,
          c’est un compteur qui s’incrémente.
        </p>
      </Reveal>

      {/* ── comment ça marche ── */}
      <Reveal as="section" className="landing__block">
        <p className="ann__label">comment ça marche</p>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.n} delay={i * 90} className="step">
              <span className="step__n mono">{s.n}</span>
              <div className="step__body">
                <h3 className="step__title">{s.title}</h3>
                <p className="prose">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </Reveal>

      {/* ── la surimpression, jouable ── */}
      <Reveal as="section" className="landing__block">
        <p className="ann__label">deux encres, une troisième couleur</p>
        <h2 className="landing__h2">
          Le recouvrement <em>est</em> la comparaison.
        </h2>
        <p className="prose">
          Sonar n’est imprimé qu’en deux encres. Quand deux périodes se
          superposent, la zone commune vire au violet — cette couleur n’est
          jamais dessinée, elle apparaît toute seule. Ce que tu vois, c’est
          littéralement ce que les deux périodes ont en commun.
        </p>
        <InkDemo />
      </Reveal>

      {/* ── ce que tu y trouves ── */}
      <Reveal as="section" className="landing__block">
        <p className="ann__label">ce que tu y trouves</p>
        <ul className="feats">
          {FEATURES.map((f, i) => (
            <Reveal as="li" key={f.k} delay={i * 60} className="feat">
              <span className="feat__k mono">{f.k}</span>
              <span className="feat__v">{f.v}</span>
            </Reveal>
          ))}
        </ul>
      </Reveal>

      {/* ── sortie ── */}
      <Reveal as="section" className="landing__block landing__end">
        <h2 className="landing__h2">Ton archive t’attend.</h2>
        <p className="prose">
          L’import complet prend une minute environ. Ensuite, tout est déjà là,
          à chaque visite.
        </p>
        <div className="landing__cta">
          <a className="btn btn--solid" href="/api/auth/login">
            Se connecter avec Last.fm
          </a>
        </div>
        <p className="note" style={{ marginTop: "2rem" }}>
          Sonar lit tes écoutes publiques via l’API Last.fm. Aucun mot de passe
          ne transite par ce site.
        </p>
      </Reveal>
    </main>
  );
}
