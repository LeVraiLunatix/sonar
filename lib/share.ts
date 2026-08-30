import { hmacHex } from "./auth";
import type { RecapKind } from "./recap";

/**
 * Jeton de partage d'une rétro — capacité signée : le posséder = pouvoir voir
 * CETTE rétro (compte + période précis), rien d'autre. Sert à deux choses :
 *  - l'aperçu Open Graph d'un lien partagé rend les VRAIES stats (le crawler
 *    n'a pas de session, mais le jeton dans l'URL l'autorise pour cette rétro)
 *  - n'importe qui avec le lien voit la rétro, comme un lien Spotify Wrapped
 *
 * Format : v1.<b64url(account)>.<kind>.<periodId>.<exp>.<sig hex>
 * sig = HMAC-SHA256(AUTH_SECRET, "v1.<b64url(account)>.<kind>.<periodId>.<exp>")
 */

const TTL_SECONDS = 400 * 24 * 60 * 60; // ~13 mois

export type SharePayload = { account: string; kind: RecapKind; periodId: string };

function b64urlEncode(s: string): string {
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signShare(p: SharePayload, secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const body = `v1.${b64urlEncode(p.account)}.${p.kind}.${encodeURIComponent(p.periodId)}.${exp}`;
  const sig = await hmacHex(secret, body);
  return `${body}.${sig}`;
}

export async function verifyShare(
  token: string | undefined | null,
  secret: string,
): Promise<SharePayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 6 || parts[0] !== "v1") return null;
  const [, accB64, kind, periodEnc, expStr, sig] = parts;
  if (kind !== "week" && kind !== "month" && kind !== "year") return null;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;

  const body = `v1.${accB64}.${kind}.${periodEnc}.${expStr}`;
  const expected = await hmacHex(secret, body);
  if (!safeEqual(sig, expected)) return null;

  try {
    return { account: b64urlDecode(accB64), kind, periodId: decodeURIComponent(periodEnc) };
  } catch {
    return null;
  }
}

/** Identifiant de période stable pour un jeton. */
export function periodIdOf(kind: RecapKind, a: number, b?: number): string {
  return kind === "year" ? String(a) : `${a}-${b}`;
}
