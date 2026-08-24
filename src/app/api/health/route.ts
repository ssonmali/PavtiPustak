/**
 * Is the site actually reachable from this device?
 *
 * `navigator.onLine` answers a different question — whether the OS believes a
 * network interface is up — and it gets that wrong often enough to matter: a
 * VPN connecting, wifi handing over to mobile data, or a laptop waking up all
 * produce a spurious `offline` event on a connection that is working fine, and
 * the app then told a volunteer it was offline while they were online.
 *
 * So the client treats that event as a suspicion and confirms it here. The
 * route touches nothing — no database, no cookies, no session — because the
 * only thing it has to prove is that a request from the browser reached the
 * server and came back.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(null, {
    status: 204,
    headers: {
      // Must never be answered from a cache, or it would report a reachable
      // server while the device is in a tunnel. The service worker passes it
      // through untouched for the same reason: it is neither a navigation nor
      // an asset, so nothing intercepts it.
      "cache-control": "no-store, must-revalidate",
    },
  });
}
