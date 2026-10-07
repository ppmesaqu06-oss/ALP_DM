/* CONTROL INV ALPINA - DON MAIZ - Service Worker
   Estrategia: abre al instante desde la copia guardada (funciona sin
   internet, sin señal y sin datos) y, si hay conexión, descarga en
   segundo plano la versión más reciente para la próxima apertura.

   IMPORTANTE: cada vez que subas una versión nueva de la app, cambia
   el número de VERSION de abajo. Así los celulares descargan lo nuevo
   en vez de quedarse con la copia vieja. */

const VERSION = 'v3.3';
const CACHE = 'recinv-alpina-donmaiz-' + VERSION;

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
      // cache:'reload' evita que el navegador entregue una copia vieja al instalar
      .then(cache => cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
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

  // Solo páginas y archivos propios de la app. Todo lo demás (por ejemplo
  // el envío a Google Drive) pasa directo, sin que el service worker lo toque.
  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req).then(hit => {
        const red = fetch(req)
          .then(res => {
            if (res && res.status === 200 && res.type === 'basic') {
              cache.put(req, res.clone()).catch(() => {});
            }
            return res;
          })
          .catch(() => null);

        if (hit) {
          event.waitUntil(red); // actualiza la copia guardada en segundo plano
          return hit;
        }

        return red.then(res => {
          if (res) return res;
          if (req.mode === 'navigate') {
            return cache.match('./index.html').then(p => p || new Response('', { status: 504, statusText: 'Sin conexión' }));
          }
          return new Response('', { status: 504, statusText: 'Sin conexión' });
        });
      })
    )
  );
});
