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

  // Nothing gained by advertising the framework and its version.
  poweredByHeader: false,

  /*
   * Baseline security headers. Vercel supplies HSTS; everything here was
   * missing, so the app shipped framable and with a full referrer.
   *
   * No Content-Security-Policy yet, deliberately. A useful one needs a
   * per-request nonce threaded through proxy.ts (the recipe is in
   * next/dist/docs/01-app/02-guides/content-security-policy.md), and a CSP that
   * is subtly wrong fails silently — a blocked script is a blank dashboard at a
   * doorstep, with nothing on screen to say why. It wants its own pass, tested
   * against the canvas receipt share (needs img-src blob: data:) and Realtime
   * (needs connect-src wss:).
   */
  headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Clickjacking: the delete-receipt control must not be reachable
          // through an invisible iframe on someone else's page.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Receipt URLs carry a receipt id; do not leak paths off-origin.
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // The app asks for none of these.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
