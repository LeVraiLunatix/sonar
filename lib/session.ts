import { cookies } from "next/headers";
import { SESSION_COOKIE, readSession } from "./auth";

/** Pseudo Last.fm de la session en cours, ou null. */
export async function currentUser(): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const jar = await cookies();
  return readSession(jar.get(SESSION_COOKIE)?.value, secret);
}

/**
 * Compte dont on affiche les données.
 * - session ouverte → ce compte
 * - auth désactivée (dev local sans AUTH_SECRET) → le compte propriétaire
 * - sinon null (le middleware aura déjà redirigé vers /login)
 */
export async function resolveAccount(): Promise<string | null> {
  const user = await currentUser();
  if (user) return user;
  if (!process.env.AUTH_SECRET) return process.env.LASTFM_USER ?? null;
  return null;
}
