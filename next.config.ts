import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Dev-only Next.js badge disabled: the app chrome now occupies every
  // corner (collapsed sidebar avatar cluster bottom-left, topbar utility
  // cluster top-right, and the Help/Support panel's message composer
  // bottom-right — the badge pinned at right:20px/bottom:20px sat exactly
  // on top of the circular send button with z-index 2147483647, making it
  // unclickable in dev). No production effect: the badge never ships.
  devIndicators: false,
};

export default nextConfig;
