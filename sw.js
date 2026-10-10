/* CONTROL INV ALPINA - DON MAIZ - Service Worker
   Estrategia: abre al instante desde la copia guardada (funciona sin
   internet, sin señal y sin datos) y, si hay conexión, descarga en
   segundo plano la versión más reciente para la próxima apertura.

   REGLAS DE SEGURIDAD
   1. Todas las apps de este GitHub comparten el mismo dominio
      (ppmesaqu06-oss.github.io), así que comparten el almacén de copias.
      Este service worker SOLO toca las copias cuyo nombre empieza por
      PREFIJO. Nunca borra ni lee las de otras apps.
   2. La versión anterior NO se borra hasta que la nueva quedó guardada
      completa. Si falla la señal en plena actualización, el celular
      conserva la versión que ya tenía.

   IMPORTANTE: cada vez que subas una versión nueva de la app, cambia el
   número de VERSION de abajo. Así los celulares descargan lo nuevo. */

const VERSION = 'v3.5';
const PREFIJO = 'recinv-alpina-donmaiz-';
const CACHE = PREFIJO + VERSION;
const PRINCIPAL = './index.html';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Cada archivo por separado: si uno falla, los demás igual quedan guardados.
    await Promise.all(ASSETS.map(async u => {
      try { await cache.add(new Request(u, { cache: 'reload' })); } catch (e) { /* se reintenta en la próxima apertura */ }
    }));
    // Sin la página principal guardada NO se instala esta versión:
    // el celular sigue con la que ya tenía y se reintenta más adelante.
    if (!(await cache.match(PRINCIPAL))) {
      await caches.delete(CACHE);
      throw new Error('No se pudo guardar la app (señal inestable). Se reintentará.');
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    if (await cache.match(PRINCIPAL)) {
      const claves = await caches.keys();
      await Promise.all(
        claves
          .filter(k => k.indexOf(PREFIJO) === 0 && k !== CACHE)   // solo copias viejas de ESTA app
          .map(k => caches.delete(k))
      );
    }
    await self.clients.claim();
  })());
});

// Busca en copias anteriores de ESTA app (nunca en las de otras).
async function buscarEnCopias(req) {
  const claves = await caches.keys();
  for (const k of claves) {
    if (k.indexOf(PREFIJO) !== 0) continue;
    const c = await caches.open(k);
    const r = await c.match(req, { ignoreSearch: true });
    if (r) return r;
  }
  return null;
}

self.addEventListener('fetch', event => {
  const req = event.request;

  // Solo páginas y archivos propios de la app. Todo lo demás (por ejemplo
  // el envío a Google Drive) pasa directo, sin que el service worker lo toque.
  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    let hit = await cache.match(req, { ignoreSearch: true });
    if (!hit) hit = await buscarEnCopias(req);

    const red = fetch(req)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      })
      .catch(() => null);

    if (hit) {
      event.waitUntil(red);   // actualiza la copia guardada en segundo plano
      return hit;
    }

    const res = await red;
    if (res) return res;

    if (req.mode === 'navigate') {
      const principal = (await cache.match(PRINCIPAL)) || (await buscarEnCopias(PRINCIPAL));
      if (principal) return principal;
    }
    return new Response('', { status: 504, statusText: 'Sin conexión' });
  })());
});
