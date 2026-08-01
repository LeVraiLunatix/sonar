import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Newsreader } from "next/font/google";
import "./globals.css";
import SWRegister from "@/components/SWRegister";
import MiniPlayer from "@/components/MiniPlayer";
import AutoSync from "@/components/AutoSync";
import SmoothScroll from "@/components/SmoothScroll";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const text = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-text",
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "Sonar",
  title: {
    default: "Sonar — archive d’écoute",
    template: "%s · Sonar",
  },
  description: "Un Wrapped permanent. Les stats d’écoute, par jour, semaine, mois et année.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Sonar",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EDE4CB" },
    { media: "(prefers-color-scheme: dark)", color: "#201C16" },
  ],
};

// Pose le thème depuis le système avant le premier rendu (anti-flash).
const themeInit = `(function(){try{var d=matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${display.variable} ${text.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {children}
        <MiniPlayer />
        <AutoSync />
        <SmoothScroll />
        <SWRegister />
      </body>
    </html>
  );
}
