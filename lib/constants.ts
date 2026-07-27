/** Fuseau des agrégations "par jour". Les played_at sont en UTC en base. */
export const APP_TZ = process.env.APP_TZ ?? "Europe/Paris";

/** Estimation haute quand la durée d'un titre est inconnue (section 9). */
export const FALLBACK_TRACK_MS = 210_000; // 3 min 30

/** Palette riso — miroir des tokens CSS (voir app/globals.css). */
export const INK = {
  paper: "#EDEAD8",
  pink: "#FF4FA3",
  blue: "#2E4FD6",
  overlay: "#5B2E86", // ne JAMAIS poser à la main dans le rendu : multiply only
  ink: "#1C1A17",
  gray: "#8A8578",
} as const;
