/**
 * Polices réelles du site pour la carte-résumé rendue par `next/og` (Satori).
 * Satori lit ttf / otf / woff — PAS woff2 — et il faut lui passer les binaires.
 *  - Bricolage Grotesque & Newsreader : API Google Fonts. Avec un User-Agent
 *    Chrome ancien, `css2` sert du woff (au lieu du woff2 par défaut).
 *  - Departure Mono : pas sur Google ; le paquet npm expose un .woff.
 * Cache long ; un échec sur une police = repli silencieux sur les autres.
 */

export type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700 | 800;
  style: "normal" | "italic";
};

const MONTH = 60 * 60 * 24 * 30;
// UA Chrome ancien → Google Fonts renvoie du woff plutôt que du woff2
const OLD_UA =
  "Mozilla/5.0 (Windows NT 5.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40 Safari/537.36";

async function buf(url: string, headers?: Record<string, string>): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, { headers, next: { revalidate: MONTH } });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** Récupère un binaire de police (woff/ttf/otf, jamais woff2) depuis Google Fonts. */
async function googleFont(spec: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${spec}`, {
      headers: { "User-Agent": OLD_UA },
      next: { revalidate: MONTH },
    }).then((r) => r.text());
    const urls = [
      ...css.matchAll(/url\((https:\/\/[^)]+?\.(?:woff|ttf|otf))\)/g),
    ].map((m) => m[1]);
    // css2 liste les sous-ensembles vietnamese → latin-ext → latin : le dernier
    // couvre bien l'ASCII + les accents FR.
    const chosen = urls[urls.length - 1] ?? urls[0];
    return chosen ? await buf(chosen) : null;
  } catch {
    return null;
  }
}

let cache: Promise<OgFont[]> | null = null;

export function cardFonts(): Promise<OgFont[]> {
  if (!cache) cache = load();
  return cache;
}

async function load(): Promise<OgFont[]> {
  const [bri700, bri800, news, newsItalic, mono] = await Promise.all([
    googleFont("Bricolage+Grotesque:wght@700"),
    googleFont("Bricolage+Grotesque:wght@800"),
    googleFont("Newsreader:wght@400"),
    googleFont("Newsreader:ital,wght@1,400"),
    buf(
      "https://cdn.jsdelivr.net/npm/@proj-airi/font-departure-mono@0.11.3/dist/files/DepartureMono-Regular.woff",
    ),
  ]);

  const out: OgFont[] = [];
  if (bri700) out.push({ name: "Bricolage Grotesque", data: bri700, weight: 700, style: "normal" });
  if (bri800) out.push({ name: "Bricolage Grotesque", data: bri800, weight: 800, style: "normal" });
  if (news) out.push({ name: "Newsreader", data: news, weight: 400, style: "normal" });
  if (newsItalic)
    out.push({ name: "Newsreader", data: newsItalic, weight: 400, style: "italic" });
  if (mono) out.push({ name: "Departure Mono", data: mono, weight: 400, style: "normal" });
  return out;
}
