import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Keep the dev-only Next.js badge out of the collapsed sidebar's bottom-left
  // corner (it overlaps the avatar/utility icons there). Dev-only; no prod effect.
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
