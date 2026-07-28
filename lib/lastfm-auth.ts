import crypto from "node:crypto";

/**
 * OAuth Last.fm (Web Auth). Nécessite la clé API ET le "shared secret"
 * (page https://www.last.fm/api/accounts de ton appli) pour signer getSession.
 * Runtime Node (md5) — à n'utiliser que dans des route handlers, pas en Edge.
 */

/** URL vers laquelle envoyer l'utilisateur pour autoriser l'appli. */
export function authorizeUrl(apiKey: string, callback: string): string {
  return `https://www.last.fm/api/auth/?api_key=${encodeURIComponent(apiKey)}&cb=${encodeURIComponent(callback)}`;
}

/** Signature Last.fm : md5(params triés concaténés + secret). `format` exclu. */
function sign(params: Record<string, string>, secret: string): string {
  const base =
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("") + secret;
  return crypto.createHash("md5").update(base, "utf8").digest("hex");
}

/**
 * « J'aime » / « je n'aime plus » un titre (méthode d'écriture).
 * Nécessite la clé de session du compte — d'où son stockage en base.
 */
export async function loveTrack(opts: {
  apiKey: string;
  secret: string;
  sessionKey: string;
  artist: string;
  track: string;
  love: boolean;
}): Promise<void> {
  const method = opts.love ? "track.love" : "track.unlove";
  const params: Record<string, string> = {
    api_key: opts.apiKey,
    artist: opts.artist,
    method,
    sk: opts.sessionKey,
    track: opts.track,
  };
  const body = new URLSearchParams({
    ...params,
    api_sig: sign(params, opts.secret),
    format: "json",
  });

  const res = await fetch("https://ws.audioscrobbler.com/2.0/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Sonar/0.1",
    },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: number;
    message?: string;
  };
  if (json.error) {
    throw new Error(`Last.fm ${method} ${json.error}: ${json.message ?? "?"}`);
  }
}

/** Échange le token de callback contre une session { name, key }. */
export async function getSession(
  apiKey: string,
  secret: string,
  token: string,
): Promise<{ name: string; key: string }> {
  const params: Record<string, string> = {
    api_key: apiKey,
    method: "auth.getSession",
    token,
  };
  const apiSig = sign(params, secret);

  const url = `https://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=${encodeURIComponent(
    apiKey,
  )}&token=${encodeURIComponent(token)}&api_sig=${apiSig}&format=json`;

  const res = await fetch(url, { headers: { "User-Agent": "Sonar/0.1" } });
  const json = (await res.json()) as {
    error?: number;
    message?: string;
    session?: { name: string; key: string };
  };
  if (json.error || !json.session) {
    throw new Error(`Last.fm auth ${json.error ?? "?"}: ${json.message ?? "pas de session"}`);
  }
  return { name: json.session.name, key: json.session.key };
}
