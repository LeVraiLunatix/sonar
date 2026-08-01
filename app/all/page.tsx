import type { Metadata } from "next";
import { accountForPage } from "@/lib/guard";
import { getPeriodData } from "@/lib/period";
import { addDays, parisToday } from "@/lib/dates";
import PeriodView from "@/components/PeriodView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Depuis toujours",
};

export default async function AllTimePage() {
  const account = await accountForPage();
  const today = parisToday();
  const [year, month] = today.split("-").map(Number);

  let first = "2019-03-12";
  if (process.env.DATABASE_URL && account) {
    const stats = await import("@/lib/stats");
    const lifetime = await stats.lifetime(account);
    first = lifetime.first?.slice(0, 10) ?? today;
  }

  const data = await getPeriodData(
    account,
    { start: first, end: addDays(today, 1) },
    "all",
  );

  return (
    <PeriodView
      data={data}
      navCurrent="all"
      nav={{
        prevHref: "/",
        prevLabel: "accueil",
        nextHref: `/month/${year}/${month}`,
        nextLabel: "ce mois",
      }}
    />
  );
}
