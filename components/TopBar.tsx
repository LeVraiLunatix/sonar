import Link from "next/link";
import Logo from "./Logo";
import TopBarMenu from "./TopBarMenu";
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
    { href: "/all", label: "depuis toujours", key: "all" },
    { href: `/compare`, label: "comparer", key: "compare" },
    { href: `/search`, label: "chercher", key: "search" },
  ];

  return (
    <div className="topbar">
      <Link className="brand" href="/" aria-label="Sonar — accueil">
        <Logo />
      </Link>
      <TopBarMenu links={links} current={current} user={user} />
    </div>
  );
}
