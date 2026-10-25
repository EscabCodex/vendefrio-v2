// =====================================================
// VendeFrío - Service Worker (v164 - Estilo nuevo)
// =====================================================
const CACHE_NAME = "vendefrio-v226";
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
  "./equipoRuta.js",
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
  "./tieneQuiere.js",
  "./queHacer.js",
  "./ayuda.js",
  "./asistente.js", "./ayudaPantallas.js", "./tutorial.js",
  "./vendor/leaflet/leaflet.js",
  "./vendor/leaflet/leaflet.css",
  "./vendor/leaflet/images/marker-icon.png",
  "./vendor/leaflet/images/marker-icon-2x.png",
  "./vendor/leaflet/images/marker-shadow.png",
  "./vendor/leaflet/images/layers.png",
  "./vendor/leaflet/images/layers-2x.png",
  "./vendor/inter/inter.css",
  "./vendor/inter/inter-latin.woff2",
  "./vendor/inter/inter-latin-ext.woff2",
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

// Abrir rápido (T150). Antes cada archivo se pedía primero a internet: con
// poca señal la app tardaba en abrir o quedaba en blanco. Ahora los archivos
// de la app salen del celular al instante y, mientras tanto, se baja la
// versión del servidor entera en segundo plano. Si cambió algo, se guarda todo
// junto (nunca mezcla archivos de dos versiones) y la app avisa "Hay una
// versión nueva" con el botón para actualizar.
const RUTAS_DE_LA_APP = new Set(ARCHIVOS.map(archivo => new URL(archivo, self.location).pathname));
const SEGUNDOS_ENTRE_REVISIONES = 60;
let revisandoVersion = null;
let ultimaRevisionVersion = 0;

function esArchivoDeLaApp(request) {
  return RUTAS_DE_LA_APP.has(new URL(request.url).pathname);
}

async function respuestaDesdeCacheOPrimeraVez(request) {
  const cache = await caches.open(CACHE_NAME);
  const guardada = await cache.match(request, { ignoreSearch: true });
  if (guardada) return guardada;
  return respuestaDesdeRedOCache(request);
}

function mismoContenido(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

async function bajarVersionDelServidor() {
  // Primero se baja todo; si falla un solo archivo, no se cambia nada.
  const nuevas = await Promise.all(ARCHIVOS.map(async archivo => {
    const respuesta = await fetch(archivo, { cache: "no-cache" });
    if (!respuesta.ok) throw new Error("No se pudo bajar " + archivo);
    return [archivo, respuesta];
  }));
  const cache = await caches.open(CACHE_NAME);
  const distintas = [];
  for (const [archivo, respuesta] of nuevas) {
    const guardada = await cache.match(archivo);
    const igual = guardada && mismoContenido(await guardada.arrayBuffer(), await respuesta.clone().arrayBuffer());
    if (!igual) distintas.push([archivo, respuesta]);
  }
  if (!distintas.length) return;
  await Promise.all(distintas.map(([archivo, respuesta]) => cache.put(archivo, respuesta)));
  const ventanas = await self.clients.matchAll({ type: "window" });
  ventanas.forEach(ventana => ventana.postMessage({ accion: "versionNueva" }));
}

// Al abrir, como mucho una revisión por minuto. Cuando la pide la app (al
// volver a la pantalla, cada 30 minutos) se revisa siempre.
function revisarVersionDelServidor(siempre) {
  // Si la app pide revisar mientras hay una revisión en curso, se revisa de
  // nuevo al terminar: la que está en curso pudo bajar los archivos de antes.
  if (revisandoVersion) return siempre ? revisandoVersion.then(() => revisarVersionDelServidor(true)) : revisandoVersion;
  if (!siempre && Date.now() - ultimaRevisionVersion < SEGUNDOS_ENTRE_REVISIONES * 1000) return Promise.resolve();
  ultimaRevisionVersion = Date.now();
  revisandoVersion = bajarVersionDelServidor()
    .catch(() => { /* sin señal: queda la versión guardada */ })
    .finally(() => { revisandoVersion = null; });
  return revisandoVersion;
}

self.addEventListener("message", event => {
  if (event.data && event.data.accion === "revisarVersion") event.waitUntil(revisarVersionDelServidor(true));
});

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

  if (esArchivoDeLaApp(event.request)) {
    event.respondWith(respuestaDesdeCacheOPrimeraVez(event.request));
    if (event.request.mode === "navigate") event.waitUntil(revisarVersionDelServidor());
    return;
  }

  // El resto (por ejemplo, /api): primero internet, como antes.
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
