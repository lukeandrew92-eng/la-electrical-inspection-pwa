const CACHE_NAME = 'la-electrical-inspection-final-v2-20260615';
const CORE = [
  './',
  './index.html?v=final-v2',
  './app.css?v=final-v2',
  './app.js?v=final-v2',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './LAELECTRICAL-LOGO-2026-REBRAND-HORIZONTAL.png',
  './LAELECTRICAL-LOGO-2026-REBRAND-SYMBOL.png',
  './LAELECTRICAL-LOGO-2026-REBRAND-BLACK.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE.filter(Boolean))).catch(() => {}));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(cached => cached || caches.match('./index.html?v=final-v2')))
  );
});
