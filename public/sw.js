// GSW Staff PWA Service Worker
// Strategy: Network-first for all requests.
// Falls back to cache when offline so the app shell still loads.

const CACHE_NAME = "gsw-staff-v1";

// App shell pages to pre-cache on install
const PRECACHE_URLS = [
  "/admin",
  "/alerts",
  "/admin/walk-in",
  "/admin/orders",
  "/offline",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-cache the shell pages (best effort — don't fail install if one is missing)
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => {
            console.log("[SW] Could not pre-cache:", url);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Skip Next.js internals and API routes — always go to network
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache a copy of successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        // Network failed — try cache, then offline page
        caches.match(request).then(
          (cached) =>
            cached ||
            caches.match("/offline") ||
            new Response("You are offline. Please check your connection.", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
        )
      )
  );
});
