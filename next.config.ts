import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only: let phones/tablets on the LAN load /_next/* bundles and HMR.
  // Has no effect on production builds.
  allowedDevOrigins: ["192.168.1.7", "*.local"],
};

export default nextConfig;
