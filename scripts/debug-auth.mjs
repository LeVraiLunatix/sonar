// Diagnostic OAuth Last.fm : teste la signature sans révéler le secret.
// Usage : node --env-file=.env.local scripts/debug-auth.mjs
import crypto from "node:crypto";

const key = process.env.LASTFM_API_KEY;
const secret = process.env.LASTFM_API_SECRET;

const mask = (v) => (v ? `${v.slice(0, 4)}…${v.slice(-4)}` : "(vide)");
console.log("LASTFM_API_KEY    :", mask(key), "· longueur:", key?.length ?? 0);
console.log("LASTFM_API_SECRET :", mask(secret), "· longueur:", secret?.length ?? 0);
console.log("LASTFM_USER       :", process.env.LASTFM_USER ?? "(absent)");
if (key && secret && key === secret) {
  console.log(
    "\n❌ PROBLÈME TROUVÉ : LASTFM_API_SECRET est IDENTIQUE à LASTFM_API_KEY.",
    "\n   Tu as collé l'API key à la place du Shared secret.",
    "\n   Va sur https://www.last.fm/api/accounts → ton appli → copie le champ",
    "\n   « Shared secret » (une valeur DIFFÉRENTE de l'API key).",
  );
  process.exit(0);
}
if (!key || !secret) {
  console.log("\n→ Il manque une valeur en LOCAL. (Sur Vercel elle peut être là.)");
  process.exit(0);
}

// Signature avec un token bidon : on veut savoir si Last.fm ACCEPTE la signature.
const token = "0000000000000000000000000000000000";
const params = { api_key: key, method: "auth.getSession", token };
const base = Object.keys(params).sort().map((k) => k + params[k]).join("") + secret;
const sig = crypto.createHash("md5").update(base, "utf8").digest("hex");
const url = `https://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=${key}&token=${token}&api_sig=${sig}&format=json`;

const r = await fetch(url, { headers: { "User-Agent": "Sonar/0.1" } });
const body = await r.text();
console.log("\nHTTP", r.status);
console.log("Réponse Last.fm :", body);
console.log(
  "\nLecture :\n" +
    " - error 4  (token invalide)     → SIGNATURE OK ✅ (le secret local est bon)\n" +
    " - error 13 (signature invalide) → le secret est FAUX ❌\n" +
    " - error 10 (clé invalide)       → l'API key est fausse",
);
