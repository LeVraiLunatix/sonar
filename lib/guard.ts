import { redirect } from "next/navigation";
import { resolveAccount } from "./session";

/**
 * Compte à afficher sur une page de données.
 * Renvoie vers /onboarding tant que l'import initial du compte n'est pas fini,
 * pour ne jamais montrer une archive à moitié remplie.
 */
export async function accountForPage(): Promise<string | null> {
  const account = await resolveAccount();
  if (!account || !process.env.DATABASE_URL) return account;

  const { getAccount } = await import("./accounts");
  const acc = await getAccount(account);
  if (acc && acc.backfill_status !== "done") redirect("/onboarding");
  return account;
}
