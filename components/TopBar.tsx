import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";
import { parisToday, isoWeekOf } from "@/lib/dates";

/** Barre haute partagée : marque discrète + navigation + bascule de thème. */
export default function TopBar({ current }: { current?: string }) {
  const today = parisToday();
  const [y, m] = today.split("-").map(Number);
  const { year: wy, week } = isoWeekOf(today);

  const links: { href: string; label: string; key: string }[] = [
    { href: `/day/${today}`, label: "aujourd’hui", key: "day" },
    { href: `/week/${wy}/${week}`, label: "cette semaine", key: "week" },
    { href: `/month/${y}/${m}`, label: "ce mois", key: "month" },
    { href: `/year/${y}`, label: "année", key: "year" },
    { href: `/compare`, label: "comparer", key: "compare" },
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
        <ThemeToggle />
      </div>
    </div>
  );
}
