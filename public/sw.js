/*
 * Pavti Pustak service worker.
 *
 * Purpose: make the app open at all without a network. Volunteers collect at
 * doorsteps where signal drops, and a navigation with nothing cached hangs on
 * a blank screen.
 *
 * Strategy:
 *   - static assets (immutable, hashed)  -> cache first
 *   - navigations                        -> network, but only for as long as
 *                                           NAV_TIMEOUT; then the last good
 *                                           copy, then /offline
 *   - everything else (POSTs, actions)   -> straight to the network
 */

// Bump on every deploy that changes this file: `activate` deletes caches whose
// key does not end in the current VERSION, so a stale worker's caches persist
// on a volunteer's phone until this changes.
const VERSION = "v2";

/*
 * How long a navigation waits for the network before the cache answers.
 *
 * The failure this exists for is not being offline — `fetch` rejects then and
 * the catch below handles it. It is a signal that is technically present and
 * effectively dead, at a doorstep: `fetch` neither resolves nor rejects, and
 * the browser's own navigation timeout is tens of seconds. For all of those
 * seconds the volunteer looks at a blank screen while a good copy of their
 * ledger sits in PAGES_CACHE.
 *
 * 2.5s is above a normal 3G-ish response for these pages, so a working
 * connection is still served fresh, and far below the point where someone
 * standing at a door decides the app is broken.
 */
const NAV_TIMEOUT = 2500;
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

  // Vercel's own endpoints, analytics among them. Its script lives at
  // /_vercel/insights/script.js — which the asset rule below would match on the
  // .js extension and then cache forever, on the assumption that asset
  // filenames are hashed and immutable. That path is not hashed, so the cache
  // would pin one version of a script Vercel updates.
  if (url.pathname.startsWith("/_vercel/")) return;

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
    event.respondWith(handleNavigation(event, request));
  }
});

/**
 * The last good copy of this page, or undefined.
 *
 * The query string is only ignored where it narrows a view that is still
 * recognisably the same page. On the report it *defines* the figures, so a
 * cached "1st–10th" answering a request for "11th–20th" would print totals for
 * the wrong period with nothing to show that is what happened — there, an exact
 * match or nothing.
 */
async function cachedPage(cache, request) {
  const exact = await cache.match(request);
  if (exact) return exact;
  if (new URL(request.url).pathname === "/dashboard/report") return undefined;
  return cache.match(request, { ignoreSearch: true });
}

async function offlinePage() {
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

async function handleNavigation(event, request) {
  const cache = await caches.open(PAGES_CACHE);
  const cached = await cachedPage(cache, request);

  // Kept running past whichever answer we return, so a response that arrives
  // after NAV_TIMEOUT still refreshes the cache for the next navigation.
  const network = fetch(request).then(async (response) => {
    if (response.ok) await cache.put(request, response.clone());
    return response;
  });
  event.waitUntil(network.catch(() => {}));

  // Nothing cached: the network is the only answer there is, so wait for it
  // rather than timing out into the offline page while it is still coming.
  if (!cached) return network.catch(() => offlinePage());

  // Otherwise the cached ledger is a good enough answer that it is not worth
  // more than NAV_TIMEOUT of blank screen to improve on it.
  let timer;
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => resolve(cached), NAV_TIMEOUT);
  });

  return Promise.race([network, deadline])
    .catch(() => cached)
    .finally(() => clearTimeout(timer));
}
