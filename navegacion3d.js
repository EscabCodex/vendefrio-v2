let navegacion3DActiva = false;
let mapaNavegacion3D = null;
let vigilanciaNavegacion3D = null;
let marcadorVehiculo3D = null;
let lineaRuta3D = null;
let posicionNavegacion3D = null;
let paradaNavegacion3D = 0;
let rutaNavegacion3D = [];

function cargarRecursoNavegacion3D(tipo, url) {
    return new Promise((resolver, rechazar) => {
        const selector = tipo === "script" ? `script[src="${url}"]` : `link[href="${url}"]`;
        if (document.querySelector(selector)) {
            resolver();
            return;
        }

        const elemento = document.createElement(tipo);
        if (tipo === "script") {
            elemento.src = url;
            elemento.onload = resolver;
            elemento.onerror = rechazar;
        } else {
            elemento.rel = "stylesheet";
            elemento.href = url;
            document.head.appendChild(elemento);
            resolver();
            return;
        }
        document.head.appendChild(elemento);
    });
}

async function cargarMapLibreNavegacion3D() {
    await cargarRecursoNavegacion3D(
        "script",
        "https://unpkg.com/maplibre-gl@v5.24.0/dist/maplibre-gl.js"
    );
    await cargarRecursoNavegacion3D(
        "link",
        "https://unpkg.com/maplibre-gl@v5.24.0/dist/maplibre-gl.css"
    );
}

function crearVehiculoNavegacion3D() {
    const elemento = document.createElement("div");
    elemento.className = "vehiculoNavegacion3D";
    elemento.textContent = "🏍️";
    elemento.style.cssText = "font-size:34px;filter:drop-shadow(0 3px 3px rgba(0,0,0,.45));transform:translate(-50%,-50%);";
    return elemento;
}

function formatearDistancia3D(metros) {
    return Number(metros) < 1000
        ? Math.round(Number(metros) || 0) + " m"
        : ((Number(metros) || 0) / 1000).toFixed(1) + " km";
}

function formatearTiempo3D(segundos) {
    const minutos = Math.max(1, Math.round((Number(segundos) || 0) / 60));
    return minutos < 60 ? minutos + " min" : Math.floor(minutos / 60) + " h " + (minutos % 60) + " min";
}

function textoManiobra3D(paso) {
    if (!paso || !paso.maneuver) return "Seguí la ruta marcada";
    const tipo = String(paso.maneuver.type || "");
    const modificador = String(paso.maneuver.modifier || "").replace(/-/g, " ");
    if (tipo === "arrive") return "Llegaste a la parada";
    if (tipo === "depart") return "Comenzá el recorrido";
    if (tipo === "roundabout" || tipo === "rotary") return "Entrá a la rotonda";
    if (tipo === "fork") return "Tomá la bifurcación";
    if (tipo === "merge") return "Incorporate";
    if (tipo === "new name") return "Continuá";
    return "Gira " + (modificador || "en la proxima calle");
}

function actualizarPanelNavegacion3D(indicacion, distancia, tiempo) {
    const texto = document.getElementById("indicacionNavegacion3D");
    const detalle = document.getElementById("detalleNavegacion3D");
    if (texto) texto.textContent = indicacion;
    if (detalle) detalle.textContent = distancia + " · " + tiempo;
}

async function calcularRutaCalles3D() {
    if (!posicionNavegacion3D || !rutaNavegacion3D[paradaNavegacion3D]) return;
    const puntos = [
        [posicionNavegacion3D.coords.longitude, posicionNavegacion3D.coords.latitude],
        ...rutaNavegacion3D.slice(paradaNavegacion3D).map(parada => [Number(parada.lng), Number(parada.lat)])
    ];
    const url = "https://router.project-osrm.org/route/v1/driving/" +
        puntos.map(punto => punto.join(",")).join(";") +
        "?overview=full&geometries=geojson&steps=true";

    const respuesta = await fetch(url);
    if (!respuesta.ok) throw new Error("No se pudo calcular la ruta por calles");
    const datos = await respuesta.json();
    const ruta = datos.routes && datos.routes[0];
    if (!ruta) throw new Error("No se encontró un recorrido");

    const datosGeoJson = {
        type: "Feature",
        geometry: ruta.geometry
    };

    if (!mapaNavegacion3D.getSource("ruta-navegacion-3d")) {
        mapaNavegacion3D.addSource("ruta-navegacion-3d", {
            type: "geojson",
            data: datosGeoJson
        });
    } else {
        mapaNavegacion3D.getSource("ruta-navegacion-3d").setData(datosGeoJson);
    }
    lineaRuta3D = true;

    if (!mapaNavegacion3D.getLayer("linea-ruta-navegacion-3d")) {
        mapaNavegacion3D.addLayer({
            id: "linea-ruta-navegacion-3d",
            type: "line",
            source: "ruta-navegacion-3d",
            paint: {
                "line-color": "#facc15",
                "line-width": 7,
                "line-opacity": 0.95
            }
        });
    } else {
        mapaNavegacion3D.getSource("ruta-navegacion-3d").setData({
            type: "Feature",
            geometry: ruta.geometry
        });
    }

    const paso = ruta.legs.flatMap(tramo => tramo.steps || [])[0];
    actualizarPanelNavegacion3D(
        textoManiobra3D(paso),
        formatearDistancia3D(ruta.distance),
        formatearTiempo3D(ruta.duration)
    );
}

function actualizarPosicionNavegacion3D(posicion) {
    posicionNavegacion3D = posicion;
    if (!mapaNavegacion3D || !marcadorVehiculo3D) return;

    const lngLat = [posicion.coords.longitude, posicion.coords.latitude];
    marcadorVehiculo3D.setLngLat(lngLat);
    mapaNavegacion3D.easeTo({
        center: lngLat,
        zoom: 17,
        pitch: 60,
        bearing: Number.isFinite(posicion.coords.heading) && posicion.coords.heading >= 0
            ? posicion.coords.heading
            : mapaNavegacion3D.getBearing(),
        duration: 700
    });

    calcularRutaCalles3D().catch(() => {
        const error = document.getElementById("errorNavegacion3D");
        if (error) error.textContent = "No se pudo actualizar el recorrido por calles.";
    });
}

function cerrarNavegacion3D() {
    navegacion3DActiva = false;
    if (vigilanciaNavegacion3D !== null) navigator.geolocation.clearWatch(vigilanciaNavegacion3D);
    vigilanciaNavegacion3D = null;
    if (mapaNavegacion3D) mapaNavegacion3D.remove();
    mapaNavegacion3D = null;
    marcadorVehiculo3D = null;
    lineaRuta3D = null;
    document.getElementById("pantallaNavegacion3D")?.remove();
}

function avanzarNavegacion3D() {
    paradaNavegacion3D += 1;
    if (paradaNavegacion3D >= rutaNavegacion3D.length) {
        cerrarNavegacion3D();
        if (typeof mostrarAviso === "function") mostrarAviso("Ruta finalizada", "Completaste todas las paradas.");
        return;
    }
    calcularRutaCalles3D().catch(() => {});
}

async function iniciarVistaNavegacion3D(ruta) {
    if (!Array.isArray(ruta) || ruta.length === 0) {
        mostrarAviso("Ruta no calculada", "Calculá una ruta antes de iniciar la navegación.");
        return;
    }
    if (!navigator.geolocation) {
        mostrarAviso("GPS no disponible", "Activá el GPS para iniciar la navegación.");
        return;
    }

    try {
        const respuestaConfiguracion = await fetch("/api/maptiler-config", {
            cache: "no-store"
        });
        const configuracion = await respuestaConfiguracion.json();
        if (!respuestaConfiguracion.ok || !configuracion.ok || !configuracion.key) {
            throw new Error(configuracion.message || "MapTiler no está configurado");
        }
        await cargarMapLibreNavegacion3D();

        rutaNavegacion3D = ruta;
        paradaNavegacion3D = 0;
        navegacion3DActiva = true;

        const pantalla = document.createElement("section");
        pantalla.id = "pantallaNavegacion3D";
        pantalla.innerHTML = `
            <div id="mapaNavegacion3D"></div>
            <div class="navegacion3DBarraSuperior">
                <div><strong>Navegación VendeFrío</strong><small id="destinoNavegacion3D"></small></div>
                <button class="navegacion3DBotonCerrar" id="cerrarNavegacion3D" type="button">×</button>
            </div>
            <div class="navegacion3DError" id="errorNavegacion3D"></div>
            <div class="navegacion3DPanelInferior">
                <div class="navegacion3DIndicacion"><div class="navegacion3DIconoManiobra">➜</div><div><strong id="indicacionNavegacion3D">Preparando recorrido...</strong><small id="detalleNavegacion3D"></small></div></div>
                <div class="navegacion3DAcciones"><button class="navegacion3DBotonSiguiente" id="siguienteNavegacion3D" type="button">Llegué / siguiente</button><button class="navegacion3DBotonRecentrar" id="recentrarNavegacion3D" type="button">Recentrar</button></div>
            </div>`;
        document.body.appendChild(pantalla);
        document.getElementById("errorNavegacion3D").textContent = "";
        document.getElementById("destinoNavegacion3D").textContent = "Próxima parada: " + ruta[0].nombre;
        document.getElementById("cerrarNavegacion3D").addEventListener("click", cerrarNavegacion3D);
        document.getElementById("siguienteNavegacion3D").addEventListener("click", avanzarNavegacion3D);

        navigator.geolocation.getCurrentPosition(async posicion => {
            posicionNavegacion3D = posicion;
            mapaNavegacion3D = new maplibregl.Map({
                container: "mapaNavegacion3D",
                style: "https://api.maptiler.com/maps/streets-v4/style.json?key=" + encodeURIComponent(configuracion.key),
                center: [posicion.coords.longitude, posicion.coords.latitude],
                zoom: 17,
                pitch: 60,
                bearing: Number(posicion.coords.heading) >= 0 ? posicion.coords.heading : 0,
                attributionControl: true
            });
            mapaNavegacion3D.addControl(new maplibregl.NavigationControl({showCompass: true}), "top-right");
            mapaNavegacion3D.on("load", () => {
                marcadorVehiculo3D = new maplibregl.Marker({element: crearVehiculoNavegacion3D(), rotationAlignment: "map"})
                    .setLngLat([posicion.coords.longitude, posicion.coords.latitude])
                    .addTo(mapaNavegacion3D);
                calcularRutaCalles3D().catch(() => {
                    document.getElementById("errorNavegacion3D").textContent = "No se pudo calcular el recorrido por calles.";
                });
            });
            vigilanciaNavegacion3D = navigator.geolocation.watchPosition(actualizarPosicionNavegacion3D, () => {}, {enableHighAccuracy: true, maximumAge: 2000, timeout: 15000});
        }, () => {
            document.getElementById("errorNavegacion3D").textContent = "Activá el GPS para ver tu ubicación en el mapa.";
        }, {enableHighAccuracy: true, maximumAge: 0, timeout: 15000});
    } catch (error) {
        console.error("Error al abrir la navegación 3D:", error);
        mostrarAviso(
            "No se pudo abrir la navegación 3D",
            error && error.message
                ? error.message
                : "Revisá la configuración de MapTiler en Vercel."
        );
    }
}

window.iniciarVistaNavegacion3D = iniciarVistaNavegacion3D;
