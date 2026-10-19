// =====================================================
// VendeFrío - Service Worker (v164 - Estilo nuevo)
// =====================================================
const CACHE_NAME = "vendefrio-v190";
const ARCHIVOS = [
  "./",
  "./index.html",
  "./styles.css",
  "./tema.css",
  "./piezas.css",
  "./piezas.js",
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
  "./impresion.js",
  "./cierre.js",
  "./seguimiento.js",
  "./avisos.js",
  "./notificaciones.js",
  "./mapa.js",
  "./rutas.js",
  "./navegacion.js",
  "./voz.js",
  "./novedades.js",
  "./volver.js",
  "./exportar.js",
  "./whatsapp.js",
  "./confianza.js",
  "./extras.js",
  "./visitas.js",
  "./ofertas.js",
  "./sugerencias.js",
  "./pruebaEntrega.js",
  "./devoluciones.js",
  "./yaLlego.js",
  "./repartidores.js",
  "./saldos.js",
  "./gastos.js",
  "./cobrarQr.js",
  "./listasPrecios.js",
  "./cambios.js",
  "./dueno.js",
  "./resumenNoche.js",
  "./importar.js",
  "./ejemplo.js",
  "./paginas.css",
  "./presentacion.html",
  "./terminos.html",
  "./pedidoWeb.js",
  "./pedir.html",
  "./pedir.js",
  "./pedir.css",
  "./codigoBarras.js",
  "./stock.js",
  "./preguntale.js",
  "./heladeras.js",
  "./verPlata.js",
  "./nuevoPedido.js",
  "./queHacer.js",
  "./vendor/leaflet/leaflet.js",
  "./vendor/leaflet/leaflet.css",
  "./vendor/leaflet/images/marker-icon.png",
  "./vendor/leaflet/images/marker-icon-2x.png",
  "./vendor/leaflet/images/marker-shadow.png",
  "./vendor/leaflet/images/layers.png",
  "./vendor/leaflet/images/layers-2x.png",
  "./navegacion3d.js",
  "./navegacion3d.css",
  "./manifest.json",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./badge.png",
  "./firebase/firebase-app-compat.js",
  "./firebase/firebase-auth-compat.js",
  "./firebase/firebase-firestore-compat.js",
  "./firebase/firebase-messaging-compat.js",
  "./firebase-config.js",
  "./cuenta.js",
  "./distribuidora.js",
  "./nube.js",
  "./empleados.js",
  "./inicio.js"
];

// Mapas ya vistos (T40): cache aparte, que no se borra al actualizar la app.
// Se guardan como mucho MAXIMO_MAPAS cuadraditos; los más viejos se van.
const CACHE_MAPAS = "vendefrio-mapas-v1";
// Lo compartido desde WhatsApp (T56): se guarda un momento hasta que la app
// lo lee, y no se borra al actualizar la app.
const CACHE_COMPARTIDO = "vendefrio-compartido";
const MAXIMO_MAPAS = 600;

function esCuadraditoDeMapa(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  return url.hostname === "tile.openstreetmap.org";
}

async function cuadraditoDeMapa(request) {
  const cache = await caches.open(CACHE_MAPAS);
  const guardado = await cache.match(request);
  if (guardado) return guardado;

  const respuesta = await fetch(request);
  if (respuesta && respuesta.ok) {
    await cache.put(request, respuesta.clone());
    const claves = await cache.keys();
    if (claves.length > MAXIMO_MAPAS) {
      await Promise.all(claves.slice(0, claves.length - MAXIMO_MAPAS).map(clave => cache.delete(clave)));
    }
  }
  return respuesta;
}

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
          .filter(nombre => nombre !== CACHE_NAME && nombre !== CACHE_MAPAS && nombre !== CACHE_COMPARTIDO)
          .map(nombre => caches.delete(nombre))
      );
    })
  );
  self.clients.claim();
});

// "Compartir a VendeFrío" (T56): Android manda acá el texto o el audio que
// se compartió desde WhatsApp (ver "share_target" en manifest.json). Se guarda
// en un cache aparte y se abre la app, que lo lee y arma el pedido.
function esCompartido(request) {
  if (request.method !== "POST") return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin && url.pathname.endsWith("/compartir");
}

async function recibirCompartido(request) {
  const destino = new URL("./index.html?compartido=1", self.registration.scope).href;
  try {
    const formulario = await request.formData();
    const datos = {
      titulo: String(formulario.get("title") || ""),
      texto: String(formulario.get("text") || ""),
      enlace: String(formulario.get("url") || ""),
      hora: Date.now()
    };
    const cache = await caches.open(CACHE_COMPARTIDO);
    await cache.delete("./compartido/audio");
    const audio = formulario.getAll("audio").find(archivo => archivo && typeof archivo === "object" && archivo.size > 0);
    if (audio) {
      datos.audio = { nombre: String(audio.name || "audio"), tipo: String(audio.type || "audio/ogg") };
      await cache.put("./compartido/audio", new Response(audio, { headers: { "Content-Type": datos.audio.tipo } }));
    }
    await cache.put("./compartido/datos", new Response(JSON.stringify(datos), { headers: { "Content-Type": "application/json" } }));
  } catch (error) {
    console.error("No se pudo guardar lo compartido.", error);
  }
  return Response.redirect(destino, 303);
}

self.addEventListener("fetch", event => {
  if (esCompartido(event.request)) {
    event.respondWith(recibirCompartido(event.request));
    return;
  }
  if (esCuadraditoDeMapa(event.request)) {
    event.respondWith(cuadraditoDeMapa(event.request));
    return;
  }
  if (!esSolicitudGETMismaApp(event.request)) return;

  // Network First
  event.respondWith(respuestaDesdeRedOCache(event.request));
});

// -------------------------------------------------
// Notificaciones con la app cerrada (T29)
// -------------------------------------------------
// Las manda la función de Vercel (api/notificar.js) por Firebase Cloud
// Messaging. Llegan acá aunque la app esté cerrada.

function datosDeLaNotificacion(event) {
  let mensaje = {};
  try {
    mensaje = event.data ? event.data.json() : {};
  } catch (error) {
    mensaje = {};
  }

  const datos = mensaje && typeof mensaje.data === "object" && mensaje.data ? mensaje.data : {};
  const notificacion = mensaje && typeof mensaje.notification === "object" && mensaje.notification ? mensaje.notification : {};

  return {
    titulo: String(notificacion.title || datos.titulo || "VendeFrío"),
    texto: String(notificacion.body || datos.texto || ""),
    aviso: {
      idAviso: String(datos.idAviso || ""),
      idPedido: String(datos.idPedido || ""),
      tipo: String(datos.tipo || "")
    }
  };
}

function esIphone() {
  return /iPhone|iPad|iPod|Macintosh/i.test(self.navigator && self.navigator.userAgent || "");
}

self.addEventListener("push", event => {
  const { titulo, texto, aviso } = datosDeLaNotificacion(event);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(ventanas => {
      // Con la app a la vista ya sale el aviso emergente de la app. En
      // iPhone (y en Safari) se muestra igual: exige que cada una se vea.
      const aLaVista = ventanas.some(ventana => ventana.visibilityState === "visible");
      if (aLaVista && !esIphone()) return undefined;

      // icon: el logo grande. badge: el copo chico de la barra de arriba
      // (Android usa solo la silueta). Los dos en PNG: Android no muestra SVG.
      return self.registration.showNotification(titulo, {
        body: texto,
        icon: "icon-192.png",
        badge: "badge.png",
        tag: aviso.idAviso || undefined,
        data: aviso,
        vibrate: [30, 60, 30]
      });
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const aviso = event.notification.data || {};
  const parametros = new URLSearchParams();
  if (aviso.idAviso) parametros.set("aviso", aviso.idAviso);
  if (aviso.idPedido) parametros.set("pedido", aviso.idPedido);
  if (aviso.tipo) parametros.set("tipo", aviso.tipo);
  const direccion = new URL("./index.html" + (parametros.toString() ? "?" + parametros.toString() : ""), self.registration.scope).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(ventanas => {
      // Si la app ya está abierta, se trae al frente y abre el pedido ahí.
      const abierta = ventanas.find(ventana => new URL(ventana.url).origin === self.location.origin);
      if (abierta) {
        abierta.postMessage({ accion: "abrirAviso", aviso });
        return abierta.focus();
      }
      return self.clients.openWindow(direccion);
    })
  );
});
