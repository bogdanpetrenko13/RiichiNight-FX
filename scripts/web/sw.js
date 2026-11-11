// Service worker of the web version (GitHub Pages; the APK does not use it).
// Template: scripts/web/pwa.mjs fills in VERSION and FILES (every file of the
// build) when it copies this into dist/sw.js.
//
// The whole game (Pyodide, Mortal and its weights, art, sounds) is cached on
// install, so after the first visit it starts and plays offline. A new build
// installs next to the old one and takes over once every window of the game
// has been closed: the running game never mixes files of two builds.
const VERSION = "__VERSION__";
const FILES = __FILES__;
const CACHE = `riichinightfx-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // In small batches: one failed file fails the install (and is retried
      // on the next visit) instead of leaving a half-filled cache in use.
      for (let i = 0; i < FILES.length; i += 8) {
        await cache.addAll(FILES.slice(i, i + 8).map((f) => new Request(f, { cache: "reload" })));
      }
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("riichinightfx-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // The page itself is found whatever its query (?seed=, ?scenario=).
      const hit = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
      if (hit) return hit;
      if (req.mode === "navigate") {
        const index = await cache.match("./index.html");
        if (index) return index;
      }
      return fetch(req);
    })(),
  );
});
