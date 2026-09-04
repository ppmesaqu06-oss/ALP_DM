/* RECINV ALPINA DON MAIZ - Service Worker
   Estrategia: cache-first. En la primera carga guarda la app completa;
   desde ahí abre sin internet, sin señal y sin datos. */

const CACHE = 'recinv-alpina-donmaiz-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;

  event.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;

      return fetch(req)
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => {
          // Sin red: si piden una página, servimos la app cacheada.
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('', { status: 504, statusText: 'Sin conexión' });
        });
    })
  );
});
