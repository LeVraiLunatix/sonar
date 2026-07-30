import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";
import { parisToday, isoWeekOf } from "@/lib/dates";
import { currentUser } from "@/lib/session";

/** Barre haute partagée : marque + navigation + compte connecté + thème. */
export default async function TopBar({ current }: { current?: string }) {
  const user = await currentUser();
  const today = parisToday();
  const [y, m] = today.split("-").map(Number);
  const { year: wy, week } = isoWeekOf(today);

  const links: { href: string; label: string; key: string }[] = [
    { href: `/day/${today}`, label: "aujourd’hui", key: "day" },
    { href: `/week/${wy}/${week}`, label: "cette semaine", key: "week" },
    { href: `/month/${y}/${m}`, label: "ce mois", key: "month" },
    { href: `/year/${y}`, label: "année", key: "year" },
    { href: `/compare`, label: "comparer", key: "compare" },
    { href: `/search`, label: "chercher", key: "search" },
  ];

  return (
    <div className="topbar">
      <Link className="brand" href="/" aria-label="Sonar — accueil">
        <Logo />
      </Link>
      <div className="top__right">
        <nav className="nav" aria-label="Périodes">
          {links.map((l) => (
            <Link
              key={l.key}
              href={l.href}
              className={current === l.key ? "now" : undefined}
              aria-current={current === l.key ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        {user && (
          <form className="whoami" method="post" action="/api/auth/logout">
            <span className="whoami__name mono">{user}</span>
            <button className="whoami__out mono" type="submit">
              sortir
            </button>
          </form>
        )}
        <ThemeToggle />
      </div>
    </div>
  );
}
