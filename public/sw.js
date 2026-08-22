/*
 * Pavti Pustak service worker.
 *
 * Purpose: make the app open at all without a network. Volunteers collect at
 * doorsteps where signal drops, and a navigation with nothing cached hangs on
 * a blank screen.
 *
 * Strategy:
 *   - static assets (immutable, hashed)  -> cache first
 *   - navigations                        -> network first, fall back to the
 *                                           last good copy, then /offline
 *   - everything else (POSTs, actions)   -> straight to the network
 */

const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const PAGES_CACHE = `pages-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;

const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older versions of this worker.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.endsWith(VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Signing out must not leave another volunteer's ledger in the cache. */
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_PRIVATE_CACHE") {
    event.waitUntil(caches.delete(PAGES_CACHE));
  }
});

function isAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:png|jpg|jpeg|svg|webp|woff2?|css|js)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only ever touch our own origin, and only GETs. Server Actions are POSTs
  // and must never be served from a cache.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Auth callbacks and the Supabase session must always hit the network.
  if (url.pathname.startsWith("/auth/")) return;

  if (isAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        // Hashed filenames are immutable, so this can be kept indefinitely.
        if (response.ok) cache.put(request, response.clone());
        return response;
      })(),
    );
    return;
  }

  const isNavigation =
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html");

  if (isNavigation) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES_CACHE);
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          // Serve the last successful copy of this exact page if we have one,
          // so the volunteer sees their ledger instead of a blank screen.
          const hit = await cache.match(request, { ignoreSearch: true });
          if (hit) return hit;

          const shell = await caches.open(SHELL_CACHE);
          const offline = await shell.match(OFFLINE_URL);
          return (
            offline ??
            new Response("Offline", {
              status: 503,
              headers: { "content-type": "text/plain" },
            })
          );
        }
      })(),
    );
  }
});
