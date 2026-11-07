/* Naamras service worker: makes the app open without internet.
   When you upload a new version, change the number below (e.g. v1.0.1). */
const CACHE = 'naamras-v1.1.0';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './privacy.html',
  './icon-192.png',
  './icon-512.png',
  './maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(CORE.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('naamras-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !isFont) return;

  // Pages: try the network first (so updates arrive), fall back to the saved copy when offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
        }
        return res;
      } catch (err) {
        return (await caches.match(req, { ignoreSearch: true }))
          || (await caches.match('./index.html'))
          || (await caches.match('./'))
          || Response.error();
      }
    })());
    return;
  }

  // Icons, fonts and other files: answer from the saved copy at once, refresh it in the background.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const network = fetch(req)
      .then((res) => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      })
      .catch(() => cached);
    return cached || network;
  })());
});
