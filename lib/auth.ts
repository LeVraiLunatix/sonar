/**
 * Auth mono-utilisateur, minimale et compatible Edge (middleware).
 * Un seul mot de passe (SITE_PASSWORD) ouvre un cookie de session signé,
 * dont la valeur dérive de AUTH_SECRET (inguessable sans le secret).
 */
export const AUTH_COOKIE = "sonar_auth";

/** Jeton de session déterministe dérivé du secret (SHA-256, résistant à la préimage). */
export async function sessionToken(secret: string): Promise<string> {
  const data = new TextEncoder().encode(`${secret}::sonar-session-v1`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** L'auth n'est active que si les deux variables sont présentes (sinon : ouvert, ex. en dev). */
export function authConfigured(): boolean {
  return !!process.env.AUTH_SECRET && !!process.env.SITE_PASSWORD;
}
