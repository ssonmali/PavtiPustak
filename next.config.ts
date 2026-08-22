import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Volunteers collect at doorsteps on patchy mobile data. With this on, a
    // navigation or Server Action interrupted by a connectivity drop stays
    // pending and completes when the network returns, instead of throwing.
    useOffline: true,
  },
  // Dev-only: let phones/tablets on the LAN load /_next/* bundles and HMR.
  // Has no effect on production builds.
  allowedDevOrigins: ["192.168.1.7", "*.local"],
};

export default nextConfig;
