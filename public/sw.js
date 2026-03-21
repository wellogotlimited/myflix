const CACHE = "popflix";
const OFFLINE_MEDIA_CACHE = "popflix-offline-media-v1";

// Static assets to pre-cache on install
const PRECACHE = ["/offline.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Remove old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE && k !== OFFLINE_MEDIA_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept API calls, Next.js internals, or non-GET
  if (
    request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/")
  ) {
    return;
  }

  if (url.pathname.startsWith("/offline-media/")) {
    event.respondWith(
      caches.open(OFFLINE_MEDIA_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        return new Response("Offline file not found.", { status: 404 });
      })
    );
    return;
  }

  // TMDB images — cache first
  if (url.hostname === "image.tmdb.org") {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const fresh = await fetch(request);
        if (fresh.ok) cache.put(request, fresh.clone());
        return fresh;
      })
    );
    return;
  }

  // Navigation requests — network first, fall back to offline page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/offline.html").then((r) => r ?? Response.error())
      )
    );
    return;
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification?.data?.href || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(href);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(href);
      }

      return undefined;
    })
  );
});
