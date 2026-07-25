/* Exchange Spot - offline cache.
   Bump CACHE_NAME whenever you upload a changed index.html,
   e.g. "exchangespot-v5", so phones pick up the new version. */

const CACHE_NAME = "exchangespot-v5";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg"
];

// Store the app files on first visit.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// Remove older versions when the cache name changes.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never cache the rate services - those must always be live,
  // and must fail cleanly when offline so the saved rates stay put.
  if (url.hostname.includes("exchangerate-api.com") ||
      url.hostname.includes("metals.dev")) {
    return;
  }

  // Google Fonts: use the stored copy first, refresh quietly in the background.
  if (url.hostname.includes("fonts.googleapis.com") ||
      url.hostname.includes("fonts.gstatic.com")) {
    event.respondWith(
      caches.match(req).then(hit => {
        const live = fetch(req).then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy));
          }
          return res;
        }).catch(() => hit);
        return hit || live;
      })
    );
    return;
  }

  // App files: serve from the phone, fall back to the network.
  event.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
