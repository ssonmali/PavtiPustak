import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deliberately no `experimental.staleTimes`. Caching page segments to save
  // refetches on tab switches was tried and reverted: keeping them meant a
  // colleague's edit had to invalidate the other cached tabs, and the only tool
  // that does that also invalidates the shared layout — which Next otherwise
  // reuses across navigations for free. Every tab switch after any change
  // became a cold layout+page load, so the app felt slower than with no cache
  // at all. Uncached pages refetch on navigation but keep the layout, which is
  // both faster in practice and always fresh.
  // Dev-only: let phones/tablets on the LAN load /_next/* bundles and HMR.
  // Has no effect on production builds.
  allowedDevOrigins: [
    "192.168.1.7",
    "*.local",
    "*.trycloudflare.com",
    "*.loca.lt",
  ],
};

export default nextConfig;
