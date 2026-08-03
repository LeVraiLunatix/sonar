/**
 * OAuth Spotify (Authorization Code Flow). Runtime Node (Buffer pour le
 * Basic Auth du token endpoint) — à n'utiliser que dans des route handlers.
 */

const SCOPES = "user-top-read user-read-currently-playing user-read-recently-played";

/** URL vers laquelle envoyer l'utilisateur pour autoriser l'appli. */
export function authorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export type SpotifyTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // secondes
};

function basicAuth(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
}

async function tokenRequest(
  clientId: string,
  clientSecret: string,
  body: URLSearchParams,
): Promise<SpotifyTokenResponse> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth(clientId, clientSecret)}`,
    },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as SpotifyTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok || json.error) {
    throw new Error(`Spotify token ${json.error ?? res.status}: ${json.error_description ?? "?"}`);
  }
  return json;
}

/** Échange le code du callback contre un jeton d'accès + un jeton de rafraîchissement. */
export async function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<SpotifyTokenResponse> {
  return tokenRequest(
    clientId,
    clientSecret,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  );
}

/** Renouvelle un jeton d'accès expiré. Spotify ne renvoie pas toujours un nouveau refresh_token. */
export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<SpotifyTokenResponse> {
  return tokenRequest(
    clientId,
    clientSecret,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );
}
