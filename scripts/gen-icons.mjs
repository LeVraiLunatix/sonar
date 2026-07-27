// Génère le logo Sonar et toutes les icônes PWA/favicon à partir d'un SVG.
// Usage : npm run icons
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PAPER = "#EDEAD8";
const PINK = "#FF4FA3";
const BLUE = "#2E4FD6";
const INK = "#1C1A17";

/** Motif « sonar » : un point d'origine + deux ondes concentriques, deux encres. */
function markSVG(size, { rounded = true, safeScale = 1, bg = PAPER } = {}) {
  const c = size / 2;
  const k = safeScale;
  const dotR = 0.07 * size * k;
  const r1 = 0.185 * size * k;
  const r2 = 0.31 * size * k;
  const sw = 0.06 * size * k;
  const rx = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${bg}"/>
  <g fill="none" stroke-width="${sw}">
    <circle cx="${c}" cy="${c}" r="${r2}" stroke="${BLUE}"/>
    <circle cx="${c}" cy="${c}" r="${r1}" stroke="${PINK}"/>
  </g>
  <circle cx="${c}" cy="${c}" r="${dotR}" fill="${INK}"/>
</svg>`;
}

async function png(svg, size, out) {
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  await writeFile(out, buf);
  console.log("→", out);
}

await mkdir(join(root, "public"), { recursive: true });

// Logo vectoriel (pour référence / usage éventuel)
await writeFile(join(root, "public", "logo.svg"), markSVG(512, { rounded: false, bg: "none" }));

// Favicon + icône générale (Next sert app/icon.png)
await png(markSVG(512, { rounded: true }), 512, join(root, "app", "icon.png"));
// iOS home-screen : carré plein, iOS arrondit lui-même
await png(markSVG(512, { rounded: false }), 180, join(root, "app", "apple-icon.png"));
// Manifeste PWA
await png(markSVG(512, { rounded: true }), 192, join(root, "public", "icon-192.png"));
await png(markSVG(512, { rounded: true }), 512, join(root, "public", "icon-512.png"));
// Maskable : plein cadre, motif réduit dans la zone sûre
await png(markSVG(512, { rounded: false, safeScale: 0.72 }), 512, join(root, "public", "icon-maskable.png"));

console.log("Icônes générées.");
