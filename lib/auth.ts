/**
 * Session mono-cookie signée, compatible Edge (middleware) et Node (routes).
 * Le cookie contient le pseudo Last.fm + une signature HMAC(AUTH_SECRET) :
 * inforgeable sans le secret, lisible sans base de données.
 */
export const SESSION_COOKIE = "sonar_session";

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Fabrique la valeur de cookie pour un pseudo. */
export async function signSession(username: string, secret: string): Promise<string> {
  const sig = await hmacHex(secret, username);
  return `${encodeURIComponent(username)}.${sig}`;
}

/** Vérifie un cookie et renvoie le pseudo, ou null si invalide. */
export async function readSession(
  cookieValue: string | undefined,
  secret: string,
): Promise<string | null> {
  if (!cookieValue) return null;
  const i = cookieValue.lastIndexOf(".");
  if (i < 1) return null;
  const username = decodeURIComponent(cookieValue.slice(0, i));
  const sig = cookieValue.slice(i + 1);
  const expected = await hmacHex(secret, username);
  // comparaison en temps constant
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let k = 0; k < sig.length; k++) diff |= sig.charCodeAt(k) ^ expected.charCodeAt(k);
  return diff === 0 ? username : null;
}

/** L'auth n'est active que si AUTH_SECRET est défini (sinon : ouvert, ex. dev). */
export function authConfigured(): boolean {
  return !!process.env.AUTH_SECRET;
}
