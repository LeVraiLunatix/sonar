import Link from "next/link";
import type { Metadata } from "next";
import { accountForPage } from "@/lib/guard";
import { nf, frDate } from "@/lib/format";
import TopBar from "@/components/TopBar";
import Reveal from "@/components/Reveal";
import VisibilityToggle from "@/components/VisibilityToggle";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Chercher" };
export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const account = await accountForPage();

  let artists: Awaited<ReturnType<typeof import("@/lib/insights").searchArchive>>["artists"] = [];
  let tracks: Awaited<ReturnType<typeof import("@/lib/insights").searchArchive>>["tracks"] = [];
  let people: { username: string; scrobbles: number }[] = [];

  if (account && query.length >= 2 && process.env.DATABASE_URL) {
    const [{ searchArchive }, { searchAccounts }] = await Promise.all([
      import("@/lib/insights"),
      import("@/lib/accounts"),
    ]);
    const [res, accs] = await Promise.all([
      searchArchive(account, query, 12),
      searchAccounts(query, account, 6),
    ]);
    artists = res.artists;
    tracks = res.tracks;
    people = accs;
  }

  const rien =
    query.length >= 2 && artists.length === 0 && tracks.length === 0 && people.length === 0;

  // réglage de visibilité : seulement pour une vraie session
  const me = await currentUser();
  let visible = true;
  if (me && process.env.DATABASE_URL) {
    const { isProfilePublic } = await import("@/lib/accounts");
    visible = await isProfilePublic(me);
  }

  return (
    <main className="year year--nospine">
      <div className="flow flow--wide">
        <TopBar current="search" />

        <Reveal as="section" className="ann ann--head">
          <p className="ann__label">chercher dans l’archive</p>
          <form className="srch" method="get" action="/search" role="search">
            <input
              className="srch__input mono"
              type="search"
              name="q"
              defaultValue={query}
              placeholder="un artiste, un titre…"
              aria-label="Rechercher un artiste ou un titre"
              autoFocus
            />
            <button className="srch__go" type="submit">
              chercher
            </button>
          </form>
          <p className="note" style={{ marginTop: "0.75rem" }}>
            Un artiste, un titre — ou le pseudo d’un autre compte du site.
          </p>
        </Reveal>

        {me && (
          <Reveal as="section" className="ann">
            <p className="ann__label">ta visibilité</p>
            <VisibilityToggle initial={visible} />
          </Reveal>
        )}

        {rien && (
          <Reveal as="section" className="ann ann--wide">
            <p className="prose">
              Rien pour « {query} » dans ton archive. Un autre orthographe, ou un
              morceau de nom suffit.
            </p>
          </Reveal>
        )}

        {people.length > 0 && (
          <Reveal as="section" className="ann">
            <p className="ann__label">comptes du site</p>
            <ul className="ranks">
              {people.map((p) => (
                <li className="rank" key={p.username} style={{ gridTemplateColumns: "1fr auto" }}>
                  <Link className="srch__link" href={`/u/${encodeURIComponent(p.username)}`}>
                    <span className="trk__title">{p.username}</span>
                    <span className="note">voir ses stats</span>
                  </Link>
                  <span className="rank__val">{nf(p.scrobbles)} écoutes</span>
                </li>
              ))}
            </ul>
          </Reveal>
        )}

        {artists.length > 0 && (
          <Reveal as="section" className="ann">
            <p className="ann__label">artistes</p>
            <ul className="ranks">
              {artists.map((a) => (
                <li className="rank" key={a.key} style={{ gridTemplateColumns: "1fr auto" }}>
                  <Link className="srch__link" href={`/artist/${encodeURIComponent(a.key)}`}>
                    <span className="trk__title">{a.name}</span>
                    <span className="note">
                      {frDate(a.first + "T12:00:00Z")} → {frDate(a.last + "T12:00:00Z")}
                    </span>
                  </Link>
                  <span className="rank__val">{nf(a.count)}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        )}

        {tracks.length > 0 && (
          <Reveal as="section" className="ann">
            <p className="ann__label">titres</p>
            <ul className="ranks">
              {tracks.map((t, i) => (
                <li className="rank" key={t.artistKey + t.track + i} style={{ gridTemplateColumns: "1fr auto" }}>
                  <Link className="srch__link" href={`/artist/${encodeURIComponent(t.artistKey)}`}>
                    <span className="trk__title">{t.track}</span>
                    <span className="note">
                      {t.artist} · {frDate(t.first + "T12:00:00Z")} →{" "}
                      {frDate(t.last + "T12:00:00Z")}
                    </span>
                  </Link>
                  <span className="rank__val">{nf(t.count)}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        )}
      </div>
    </main>
  );
}
