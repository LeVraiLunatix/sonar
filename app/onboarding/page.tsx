import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getAccount, upsertAccount } from "@/lib/accounts";
import BackfillRunner from "@/components/BackfillRunner";
import Logo from "@/components/Logo";

export const metadata: Metadata = { title: "Import de ton historique" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const account = await currentUser();
  if (!account) redirect("/login");

  // Pas de base configurée → rien à importer.
  if (!process.env.DATABASE_URL) redirect("/");

  const acc = (await getAccount(account)) ?? (await upsertAccount(account));
  if (acc.backfill_status === "done") redirect("/");

  return (
    <main className="year year--nospine">
      <div className="flow flow--wide">
        <div className="topbar">
          <span className="brand">
            <Logo />
          </span>
        </div>
        <BackfillRunner username={account} />
      </div>
    </main>
  );
}
