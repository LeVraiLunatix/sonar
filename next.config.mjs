/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Pochettes (Last.fm) + photos d'artistes (Deezer)
    remotePatterns: [
      { protocol: "https", hostname: "*.lastfm.freetls.fastly.net" },
      { protocol: "https", hostname: "lastfm.freetls.fastly.net" },
      { protocol: "https", hostname: "*.dzcdn.net" },
      { protocol: "https", hostname: "e-cdns-images.dzcdn.net" },
    ],
  },
};

export default nextConfig;
