// =====================================================
// VendeFrío - Service Worker (v125 - Rework Visual + Íconos)
// =====================================================
const CACHE_NAME = "vendefrio-v125";
const ARCHIVOS = [
  "./",
  "./index.html",
  "./styles.css",
  "./iconos.js",
  "./productos.js",
  "./comercios.js",
  "./database.js",
  "./menu.js",
  "./configuracion.js",
  "./estadisticas.js",
  "./catalogo.js",
  "./pedidos.js",
  "./comerciosAdmin.js",
  "./comercioFicha.js",
  "./productosAdmin.js",
  "./historial.js",
  "./rutas.js",
  "./navegacion3d.js",
  "./navegacion3d.css",
  "./manifest.json",
  "./icon.svg"
];

function esSolicitudGETMismaApp(request) {
  const url = new URL(request.url);
  return request.method === "GET" && url.origin === self.location.origin;
}

async function guardarEnCache(request, respuesta) {
  if (!respuesta || !respuesta.ok) return respuesta;

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, respuesta.clone());
  return respuesta;
}

async function respuestaDesdeRedOCache(request) {
  try {
    const respuestaRed = await fetch(request);
    return guardarEnCache(request, respuestaRed);
  } catch (error) {
    const respuestaCache = await caches.match(request);
    if (respuestaCache) return respuestaCache;

    if (request.mode === "navigate") {
      return caches.match("./index.html");
    }

    return Response.error();
  }
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ARCHIVOS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(nombres => {
      return Promise.all(
        nombres
          .filter(nombre => nombre !== CACHE_NAME)
          .map(nombre => caches.delete(nombre))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (!esSolicitudGETMismaApp(event.request)) return;

  // Network First
  event.respondWith(respuestaDesdeRedOCache(event.request));
});
