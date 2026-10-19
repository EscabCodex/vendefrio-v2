// =====================================================
// VendeFr\u00edo Lite - rutas.js
// Mapa, GPS y planificaci\u00f3n de rutas
// =====================================================

let mapaLeaflet = null;
let capaMarcadores = null;
let rutaOrdenada = [];
let distanciasRuta = [];
// Elegidos sin GPS en la última ruta optimizada (salen al pie de la hoja de reparto, T28e).
let comerciosSinGpsRuta = [];
let comerciosSeleccionadosRuta = new Set();
let seleccionRutaInicializada = false;
let modoPinManual = false;
let marcadorPinManual = null;
let coordenadasPinPendientes = null;
let marcadoresPorNombre = new Map();
let coordenadasPinOriginales = null;
let tipoEdicionPin = "nuevo";
let rutaGuardadaEnEdicion = null;
let navegacionActiva = false;
let indiceParadaNavegacion = 0;
let vigilanciaNavegacion = null;
let marcadorUbicacionNavegacion = null;
let lineaNavegacion = null;
let rutaCalleNavegacion = null;
let ultimaPosicionNavegacion = null;
let pasoNavegacionActual = "";
let calculandoRutaCalle = false;

function actualizarResumenRuta() {
    const resumen = document.getElementById("resumenRuta");
    if (!resumen) return;

    const comercios = comerciosActivos();
    const conGps = comercios.filter(comercioTieneGps).length;
    const sinGps = comercios.length - conGps;

    resumen.textContent =
        "Paradas con GPS: " +
        conGps +
        "  -  Sin GPS: " +
        sinGps +
        "  -  Total: " +
        comercios.length;
}

const LATITUD_POR_DEFECTO = -34.6185;
const LONGITUD_POR_DEFECTO = -58.6382;

function capitalizarTexto(texto) {
    const valor = String(texto || "");
    return valor.charAt(0).toUpperCase() + valor.slice(1);
}

function obtenerEtiquetaOrigenGps(comercio) {
    if (!comercioTieneGps(comercio)) return "Sin ubicaci\u00f3n";

    const origen = String(comercio.origenGps || "").toLowerCase();
    if (origen === "manual") return "Pin manual";
    if (origen === "gps") return "GPS del celular";
    if (origen === "maps") return "Maps aproximado";
    return "Coordenadas guardadas";
}

function comercioTieneGps(comercio) {
    if (!comercio) return false;

    const latitud = comercio.lat;
    const longitud = comercio.lng;

    if (
        latitud === "" ||
        latitud === null ||
        longitud === "" ||
        longitud === null
    ) {
        return false;
    }

    return (
        Number.isFinite(Number(latitud)) &&
        Number.isFinite(Number(longitud))
    );
}

function crearPopupComercio(comercio) {
    const contenido = document.createElement("div");
    const nombre = document.createElement("strong");
    const salto = document.createElement("br");
    const direccion = document.createElement("span");
    const origen = document.createElement("small");
    const botonEditar = document.createElement("button");

    nombre.textContent = comercio.nombre || "Sin nombre";
    direccion.textContent = comercio.direccion || "Sin direcci\u00f3n";
    origen.textContent = "Ubicaci\u00f3n: " + obtenerEtiquetaOrigenGps(comercio);
    origen.className = "origenUbicacionMapa";
    botonEditar.type = "button";
    botonEditar.className = "btnEditarPinMapa";
    botonEditar.dataset.nombre = comercio.nombre || "";
    botonEditar.textContent = "Editar ubicaci\u00f3n";

    contenido.append(nombre, salto, direccion, origen, botonEditar);
    return contenido;
}

function configurarCierreModalAviso() {
    const modal = document.getElementById("modalAviso");
    const botonCerrar = document.getElementById("cerrarAviso");

    if (
        botonCerrar &&
        !botonCerrar.dataset.cierreConfigurado
    ) {
        botonCerrar.addEventListener("click", () => {
            if (modal) modal.classList.add("oculto");
        });

        botonCerrar.dataset.cierreConfigurado = "true";
    }

    if (
        modal &&
        !modal.dataset.cierreConfigurado
    ) {
        modal.addEventListener("click", event => {
            if (event.target === modal) {
                modal.classList.add("oculto");
            }
        });

        modal.dataset.cierreConfigurado = "true";
    }
}

function inicializarPantallaRutas() {
    actualizarResumenRuta();
    cargarSelectComerciosRuta();
    inicializarSeleccionRuta();
    iniciarMapa();
    crearControlesPinManual();
    crearControlesRutasGuardadas();
    crearModalOpcionesRutaGuardada();
    crearBotonNavegarRuta();
    renderizarPines();
    mostrarRutaEnLista();
}

function crearControlesPinManual() {
    const botonGuardar = document.getElementById("btnGuardarGps");
    if (!botonGuardar || document.getElementById("btnPinManual")) return;

    const boton = document.createElement("button");
    boton.id = "btnPinManual";
    boton.type = "button";
    boton.className = "btnAccion botonPinManual";
    boton.innerHTML = window.icono("ubicacion", 14) + " Colocar pin manual en el mapa";
    boton.title = "Elegir manualmente la ubicaci\u00f3n de este comercio";
    boton.addEventListener("click", activarModoPinManual);

    botonGuardar.insertAdjacentElement("afterend", boton);
    crearControlesEdicionPin(boton);
}

function crearControlesEdicionPin(botonReferencia) {
    if (document.getElementById("controlesPinPendiente")) return;

    const contenedor = document.createElement("div");
    contenedor.id = "controlesPinPendiente";
    contenedor.className = "controlesPinPendiente oculto";

    const botonGuardar = document.createElement("button");
    botonGuardar.id = "btnGuardarPinPendiente";
    botonGuardar.type = "button";
    botonGuardar.className = "btnAccion agregar";
    botonGuardar.textContent = "Guardar ubicaci\u00f3n";
    botonGuardar.addEventListener("click", guardarPinManual);

    const botonCancelar = document.createElement("button");
    botonCancelar.id = "btnCancelarPinPendiente";
    botonCancelar.type = "button";
    botonCancelar.className = "btnAccion secundario";
    botonCancelar.textContent = "Cancelar edici\u00f3n";
    botonCancelar.addEventListener("click", cancelarEdicionPin);

    contenedor.append(botonGuardar, botonCancelar);
    botonReferencia.insertAdjacentElement("afterend", contenedor);
}

function mostrarControlesEdicionPin() {
    const controles = document.getElementById("controlesPinPendiente");
    if (controles) controles.classList.remove("oculto");
}

function ocultarControlesEdicionPin() {
    const controles = document.getElementById("controlesPinPendiente");
    if (controles) controles.classList.add("oculto");
    document.getElementById("barraMoverPin")?.classList.add("oculto");
}

function crearModalOpcionesRutaGuardada() {
    if (document.getElementById("modalOpcionesRutaGuardada")) return;

    const modal = document.createElement("div");
    modal.id = "modalOpcionesRutaGuardada";
    modal.className = "modal oculto";

    const contenido = document.createElement("div");
    contenido.className = "modalContenido";

    const titulo = document.createElement("h2");
    titulo.id = "tituloOpcionesRutaGuardada";
    titulo.textContent = "Ruta guardada";

    const mensaje = document.createElement("p");
    mensaje.id = "mensajeOpcionesRutaGuardada";

    const etiquetaNombre = document.createElement("label");
    etiquetaNombre.textContent = "Nombre de la ruta";
    etiquetaNombre.htmlFor = "nombreRutaEnEdicion";

    const entradaNombre = document.createElement("input");
    entradaNombre.id = "nombreRutaEnEdicion";
    entradaNombre.type = "text";
    entradaNombre.placeholder = "Nombre de la ruta";

    const botones = document.createElement("div");
    botones.className = "modalBotones modalBotonesRuta";

    const cargar = document.createElement("button");
    cargar.id = "cargarYCalcularRuta";
    cargar.type = "button";
    cargar.className = "btnModalConfirmar";
    cargar.textContent = "Cargar y calcular";

    const editar = document.createElement("button");
    editar.id = "editarRutaGuardada";
    editar.type = "button";
    editar.className = "btnModalSecundario";
    editar.textContent = "Editar selecci\u00f3n";

    const guardarNombre = document.createElement("button");
    guardarNombre.id = "guardarNombreRuta";
    guardarNombre.type = "button";
    guardarNombre.className = "btnModalConfirmar";
    guardarNombre.textContent = "Guardar nombre";

    const cancelar = document.createElement("button");
    cancelar.type = "button";
    cancelar.className = "btnModalCancelar";
    cancelar.textContent = "Cancelar";

    botones.append(cargar, editar, guardarNombre, cancelar);
    contenido.append(titulo, mensaje, etiquetaNombre, entradaNombre, botones);
    modal.appendChild(contenido);
    document.body.appendChild(modal);

    cancelar.addEventListener("click", () => modal.classList.add("oculto"));
    modal.addEventListener("click", evento => {
        if (evento.target === modal) modal.classList.add("oculto");
    });

    cargar.addEventListener("click", () => {
        const nombre = modal.dataset.nombre || "";
        modal.classList.add("oculto");
        rutaGuardadaEnEdicion = null;
        cargarRutaGuardada(nombre, false);
        window.setTimeout(optimizarRuta, 100);
    });

    guardarNombre.addEventListener("click", () => {
        const nombreOriginal = modal.dataset.nombre || "";
        const entradaEdicion = document.getElementById("nombreRutaEnEdicion");
        const nuevoNombre = entradaEdicion
            ? entradaEdicion.value.trim()
            : "";
        const ruta = obtenerRutasGuardadas().find(item => {
            return normalizarTexto(item.nombre) === normalizarTexto(nombreOriginal);
        });

        if (!nuevoNombre) {
            mostrarAviso("Falta el nombre", "Escrib\u00ed un nombre para la ruta.");
            return;
        }

        if (!ruta) return;

        if (!guardarRutaRegistro(nombreOriginal, nuevoNombre, ruta.comercios, ruta.dia || "")) {
            mostrarAviso("No se pudo guardar", "Prob\u00e1 nuevamente.");
            return;
        }

        modal.classList.add("oculto");
        renderizarRutasGuardadas();
        mostrarAviso("Nombre guardado", "La ruta ahora se llama \"" + nuevoNombre + "\".");
    });

    editar.addEventListener("click", () => {
        const nombreOriginal = modal.dataset.nombre || "";
        const entradaEdicion = document.getElementById("nombreRutaEnEdicion");
        const nuevoNombre = entradaEdicion
            ? entradaEdicion.value.trim()
            : nombreOriginal;

        if (!nuevoNombre) {
            mostrarAviso("Falta el nombre", "Escrib\u00ed un nombre para la ruta.");
            return;
        }

        modal.classList.add("oculto");
        rutaGuardadaEnEdicion = nombreOriginal;
        cargarRutaGuardada(nombreOriginal, false);
        const entrada = document.getElementById("nombreRutaGuardada");
        const selectorDia = document.getElementById("diaRutaGuardada");
        const ruta = obtenerRutasGuardadas().find(item => {
            return normalizarTexto(item.nombre) === normalizarTexto(nombreOriginal);
        });
        if (entrada) entrada.value = nuevoNombre;
        if (selectorDia) selectorDia.value = ruta && ruta.dia ? ruta.dia : "";
        const panel = document.getElementById("rutasGuardadasPanel");
        panel?.closest("details")?.setAttribute("open", "");
        if (panel) panel.scrollIntoView({ behavior: "smooth", block: "center" });
    });
}

function abrirOpcionesRutaGuardada(nombre) {
    const modal = document.getElementById("modalOpcionesRutaGuardada");
    const titulo = document.getElementById("tituloOpcionesRutaGuardada");
    const mensaje = document.getElementById("mensajeOpcionesRutaGuardada");
    const entradaNombre = document.getElementById("nombreRutaEnEdicion");
    const ruta = obtenerRutasGuardadas().find(item => {
        return normalizarTexto(item.nombre) === normalizarTexto(nombre);
    });

    if (!modal || !ruta) return;

    modal.dataset.nombre = ruta.nombre;
    titulo.textContent = ruta.nombre;
    mensaje.textContent =
        ruta.comercios.length +
        " comercio(s) guardado(s). Eleg\u00ed qu\u00e9 quer\u00e9s hacer.";
    if (entradaNombre) entradaNombre.value = ruta.nombre;
    modal.classList.remove("oculto");
}

// "Navegar la ruta" (Etapa 5, T41): la navegación propia, parada por parada,
// en el orden de "Optimizar ruta". Reemplaza a la vista 3D de prueba (que
// dependía de una librería de internet).
function crearBotonNavegarRuta() {
    const botonMaps = document.getElementById("btnGoogleMaps");
    if (!botonMaps || document.getElementById("btnNavegarRuta")) return;

    const boton = document.createElement("button");
    boton.id = "btnNavegarRuta";
    boton.type = "button";
    boton.className = "btnAccion botonNavegarRuta";
    boton.innerHTML = window.icono("navegar", 16) + " Navegar la ruta";
    boton.addEventListener("click", () => {
        if (!rutaOrdenada.length) {
            mostrarAviso("Primero, la ruta", "Tocá \u00abOptimizar ruta\u00bb y despu\u00e9s \u00abNavegar la ruta\u00bb.");
            return;
        }
        const nombres = rutaOrdenada.map(parada => parada.nombre);
        if (!window.navegacionVendeFrio?.abrir?.(nombres)) {
            mostrarAviso("No se pudo navegar", "Las paradas necesitan su ubicaci\u00f3n GPS. Si elegiste Google Maps en M\u00e1s, us\u00e1 el bot\u00f3n de Google Maps.");
        }
    });
    botonMaps.insertAdjacentElement("afterend", boton);
}

function actualizarEstadoNavegacionApp(texto) {
    const estado = document.getElementById("estadoNavegacionApp");
    if (estado) estado.textContent = texto;
}

function formatearTiempoNavegacion(segundos) {
    const minutos = Math.max(1, Math.round((Number(segundos) || 0) / 60));
    if (minutos < 60) return minutos + " min";
    return Math.floor(minutos / 60) + " h " + (minutos % 60) + " min";
}

function formatearInstruccionNavegacion(paso) {
    if (!paso || !paso.maneuver) return "Seguí la ruta hasta la próxima parada.";
    const maniobra = paso.maneuver;
    const tipo = String(maniobra.type || "");
    const modificador = String(maniobra.modifier || "").replace(/-/g, " ");
    const texto = {
        depart: "Sali",
        arrive: "Llegaste al destino",
        turn: "Gira",
        'new name': "Continua",
        merge: "Incorporate",
        fork: "Toma la bifurcacion",
        roundabout: "Entra a la rotonda",
        rotary: "Entra a la rotonda"
    }[tipo] || "Continua";
    if (tipo === "arrive") return texto;
    return texto + (modificador ? " " + modificador : "") + ".";
}

async function cargarRutaPorCallesNavegacion(posicion) {
    if (calculandoRutaCalle || !posicion || !rutaOrdenada[indiceParadaNavegacion]) return;

    calculandoRutaCalle = true;
    const puntos = [
        [posicion.coords.longitude, posicion.coords.latitude],
        ...rutaOrdenada.slice(indiceParadaNavegacion).map(parada => [Number(parada.lng), Number(parada.lat)])
    ];
    const coordenadas = puntos.map(punto => punto.join(",")).join(";");
    const url = "https://router.project-osrm.org/route/v1/driving/" +
        coordenadas + "?overview=full&geometries=geojson&steps=true";

    try {
        const respuesta = await fetch(url);
        if (!respuesta.ok) throw new Error("No se pudo calcular la ruta por calles");
        const datos = await respuesta.json();
        const ruta = datos.routes && datos.routes[0];
        if (!ruta) throw new Error("No hay recorrido disponible");

        if (rutaCalleNavegacion) mapaLeaflet.removeLayer(rutaCalleNavegacion);
        const geometria = ruta.geometry.coordinates.map(punto => [punto[1], punto[0]]);
        rutaCalleNavegacion = L.polyline(geometria, {
            color: "#2563eb",
            weight: 6,
            opacity: 0.85
        }).addTo(mapaLeaflet);

        const pasos = ruta.legs.flatMap(tramo => tramo.steps || []);
        pasoNavegacionActual = pasos.length > 0
            ? formatearInstruccionNavegacion(pasos[0])
            : "Seguí el recorrido azul hasta la próxima parada.";

        actualizarEstadoNavegacionApp(
            "Proxima parada: " + rutaOrdenada[indiceParadaNavegacion].nombre +
            " - " + formatearDistanciaNavegacion(ruta.distance) +
            " - " + formatearTiempoNavegacion(ruta.duration) +
            ".\n" + pasoNavegacionActual
        );
    } catch (error) {
        pasoNavegacionActual = "No se pudo calcular el recorrido por calles. Se muestra una línea directa.";
        actualizarEstadoNavegacionApp(pasoNavegacionActual);
    } finally {
        calculandoRutaCalle = false;
    }
}

function actualizarVistaNavegacion(posicion) {
    if (!mapaLeaflet || !posicion || !rutaOrdenada[indiceParadaNavegacion]) return;

    ultimaPosicionNavegacion = posicion;
    const actual = [posicion.coords.latitude, posicion.coords.longitude];
    const parada = rutaOrdenada[indiceParadaNavegacion];
    const destino = [Number(parada.lat), Number(parada.lng)];
    const distancia = calcularDistancia(actual[0], actual[1], destino[0], destino[1]);

    if (!marcadorUbicacionNavegacion) {
        marcadorUbicacionNavegacion = L.circleMarker(actual, {
            radius: 8,
            color: "#2563eb",
            fillColor: "#60a5fa",
            fillOpacity: 0.9
        }).addTo(mapaLeaflet);
    } else {
        marcadorUbicacionNavegacion.setLatLng(actual);
    }

    if (!rutaCalleNavegacion) {
        if (lineaNavegacion) mapaLeaflet.removeLayer(lineaNavegacion);
        lineaNavegacion = L.polyline([actual, destino], {
            color: "#2563eb",
            weight: 5,
            dashArray: "10 8"
        }).addTo(mapaLeaflet);
        cargarRutaPorCallesNavegacion(posicion);
    }

    mapaLeaflet.setView(actual, Math.max(mapaLeaflet.getZoom(), 15));
    if (!pasoNavegacionActual) {
        actualizarEstadoNavegacionApp(
            "Proxima parada: " + parada.nombre + " - " + formatearDistanciaNavegacion(distancia) + "."
        );
    }
}

function formatearDistanciaNavegacion(metros) {
    const valor = Number(metros) || 0;
    return valor < 1000 ? Math.round(valor) + " m" : (valor / 1000).toFixed(1).replace(".", ",") + " km";
}

function iniciarNavegacionApp() {
    if (rutaOrdenada.length === 0) {
        mostrarAviso("Ruta no calculada", "Calcul\u00e1 una ruta antes de iniciar la navegaci\u00f3n.");
        return;
    }

    if (!navigator.geolocation) {
        mostrarAviso("GPS no disponible", "Activ\u00e1 el GPS para iniciar la navegaci\u00f3n.");
        return;
    }

    navegacionActiva = true;
    indiceParadaNavegacion = 0;
    document.getElementById("iniciarNavegacionApp")?.classList.add("oculto");
    document.getElementById("siguienteParadaNavegacion")?.classList.remove("oculto");
    document.getElementById("detenerNavegacionApp")?.classList.remove("oculto");
    actualizarEstadoNavegacionApp("Obteniendo tu ubicaci\u00f3n...");

    vigilanciaNavegacion = navigator.geolocation.watchPosition(
        actualizarVistaNavegacion,
        () => actualizarEstadoNavegacionApp("No se pudo actualizar la ubicaci\u00f3n del celular."),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );
}

function detenerNavegacionApp(mostrarMensaje = true) {
    navegacionActiva = false;
    if (vigilanciaNavegacion !== null) navigator.geolocation.clearWatch(vigilanciaNavegacion);
    vigilanciaNavegacion = null;
    if (marcadorUbicacionNavegacion && mapaLeaflet) mapaLeaflet.removeLayer(marcadorUbicacionNavegacion);
    if (lineaNavegacion && mapaLeaflet) mapaLeaflet.removeLayer(lineaNavegacion);
    if (rutaCalleNavegacion && mapaLeaflet) mapaLeaflet.removeLayer(rutaCalleNavegacion);
    marcadorUbicacionNavegacion = null;
    lineaNavegacion = null;
    rutaCalleNavegacion = null;
    ultimaPosicionNavegacion = null;
    pasoNavegacionActual = "";
    document.getElementById("iniciarNavegacionApp")?.classList.remove("oculto");
    document.getElementById("siguienteParadaNavegacion")?.classList.add("oculto");
    document.getElementById("detenerNavegacionApp")?.classList.add("oculto");
    actualizarEstadoNavegacionApp("Calcul\u00e1 una ruta para iniciar la navegaci\u00f3n dentro de la app.");
    if (mostrarMensaje) mostrarAviso("Navegaci\u00f3n detenida", "La navegaci\u00f3n dentro de VendeFr\u00edo se detuvo.");
}

function crearControlesRutasGuardadas() {
    // T51: las rutas guardadas tienen su propia tarjeta desplegable.
    const tarjeta = document.querySelector(".tarjetaRutasGuardadas") || document.querySelector(".tarjetaSeleccionRuta");
    if (!tarjeta || document.getElementById("rutasGuardadasPanel")) return;

    const panel = document.createElement("div");
    panel.id = "rutasGuardadasPanel";
    panel.className = "rutasGuardadasPanel";

    const titulo = document.createElement("h3");
    titulo.innerHTML = '<span class="iconoRutasGuardadas">' + window.icono("disquete", 18) + "</span>";
    titulo.append(document.createTextNode("Rutas guardadas"));

    const ayuda = document.createElement("p");
    ayuda.textContent = "Guard\u00e1 esta selecci\u00f3n con un nombre para volver a usarla.";

    const fila = document.createElement("div");
    fila.className = "filaRutaGuardada";

    const entrada = document.createElement("input");
    entrada.id = "nombreRutaGuardada";
    entrada.type = "text";
    entrada.placeholder = "Nombre, por ej. Ruta lunes";
    entrada.setAttribute("aria-label", "Nombre de la ruta");

    const selectorDia = document.createElement("select");
    selectorDia.id = "diaRutaGuardada";
    [
        ["", "Sin d\u00eda fijo"],
        ["lunes", "Lunes"],
        ["martes", "Martes"],
        ["miercoles", "Mi\u00e9rcoles"],
        ["jueves", "Jueves"],
        ["viernes", "Viernes"],
        ["sabado", "S\u00e1bado"],
        ["domingo", "Domingo"]
    ].forEach(([valor, texto]) => {
        const opcion = document.createElement("option");
        opcion.value = valor;
        opcion.textContent = texto;
        selectorDia.appendChild(opcion);
    });

    const botonGuardar = document.createElement("button");
    botonGuardar.id = "guardarRutaActual";
    botonGuardar.type = "button";
    botonGuardar.className = "btnAccion agregar";
    botonGuardar.innerHTML = window.icono("disquete", 16) + " Guardar ruta";
    selectorDia.setAttribute("aria-label", "D\u00eda de la ruta");
    botonGuardar.addEventListener("click", guardarRutaActual);

    fila.append(entrada, selectorDia, botonGuardar);

    const lista = document.createElement("div");
    lista.id = "listaRutasGuardadas";
    lista.className = "listaRutasGuardadas";

    panel.append(titulo, ayuda, fila, lista);
    tarjeta.appendChild(panel);
    renderizarRutasGuardadas();
}

function buscarRutaGuardadaPorNombre(nombre, rutas = obtenerRutasGuardadas()) {
    if (!nombre) return null;
    return rutas.find(ruta => {
        return normalizarTexto(ruta.nombre) === normalizarTexto(nombre);
    }) || null;
}

// Guarda una ruta registro por registro. Si se est\u00e1 editando una ruta
// (nombreOriginal), se actualiza la misma y conserva su id aunque cambie
// el nombre. Si el nombre ya es de otra ruta, esa otra se reemplaza y la
// editada se borra, igual que antes.
function guardarRutaRegistro(nombreOriginal, nombre, comercios, dia) {
    const rutas = obtenerRutasGuardadas();
    const editada = buscarRutaGuardadaPorNombre(nombreOriginal, rutas);
    const destino = buscarRutaGuardadaPorNombre(nombre, rutas) || editada;

    const guardado = destino
        ? actualizarRutaPorId(destino.id, { nombre, comercios, dia })
        : Boolean(agregarRutaConId(nombre, comercios, dia));

    if (guardado && editada && editada.id !== destino.id) {
        eliminarRutaPorId(editada.id);
    }

    return guardado;
}

function guardarRutaActual() {
    const entrada = document.getElementById("nombreRutaGuardada");
    const selectorDia = document.getElementById("diaRutaGuardada");
    const nombre = entrada ? entrada.value.trim() : "";
    const dia = selectorDia ? selectorDia.value : "";
    const comercios = Array.from(comerciosSeleccionadosRuta);

    if (!nombre) {
        mostrarAviso("Falta el nombre", "Escrib\u00ed un nombre para identificar esta ruta.");
        return;
    }

    if (comercios.length === 0) {
        mostrarAviso("Sin comercios seleccionados", "Seleccion\u00e1 al menos un comercio antes de guardar la ruta.");
        return;
    }

    if (!guardarRutaRegistro(rutaGuardadaEnEdicion, nombre, comercios, dia)) {
        mostrarAviso("No se pudo guardar", "Prob\u00e1 nuevamente.");
        return;
    }

    rutaGuardadaEnEdicion = null;

    if (entrada) entrada.value = "";
    if (selectorDia) selectorDia.value = "";
    renderizarRutasGuardadas();

    const comerciosSinGps = obtenerComercios()
        .filter(comercio => {
            return comercios.includes(comercio.nombre) && !comercioTieneGps(comercio);
        })
        .map(comercio => comercio.nombre);

    if (comerciosSinGps.length > 0) {
        mostrarAviso(
            "Ruta guardada con ubicaciones pendientes",
            "La ruta \"" + nombre + "\" se guard\u00f3 correctamente.\n\n" +
                "Sin GPS:\n" +
                comerciosSinGps.map(nombreComercio => "- " + nombreComercio).join("\n")
        );
        return;
    }

    mostrarAviso("Ruta guardada", "La selecci\u00f3n \"" + nombre + "\" qued\u00f3 guardada.");
}

function cargarRutaGuardada(nombre, mostrarMensaje = true) {
    const ruta = obtenerRutasGuardadas().find(item => {
        return normalizarTexto(item.nombre) === normalizarTexto(nombre);
    });

    if (!ruta) return;

    comerciosSeleccionadosRuta = new Set(ruta.comercios);
    inicializarSeleccionRuta();

    if (mostrarMensaje) {
        mostrarAviso("Ruta cargada", "Se seleccionaron los comercios de \"" + ruta.nombre + "\".");
    }
}

function confirmarEliminarRutaGuardada(nombre) {
    const borrar = () => {
        const ruta = buscarRutaGuardadaPorNombre(nombre);
        if (!ruta || !eliminarRutaPorId(ruta.id)) return;
        renderizarRutasGuardadas();
        mostrarAviso("Ruta eliminada", "Se elimin\u00f3 la ruta guardada.");
    };

    // Etapa 8: sin "¿Seguro?". Se borra y queda "Deshacer" unos segundos.
    if (window.piezas) {
        const rutasAntes = obtenerRutasGuardadas();
        const ruta = buscarRutaGuardadaPorNombre(nombre);
        if (!ruta || !eliminarRutaPorId(ruta.id)) return;
        renderizarRutasGuardadas();
        window.piezas.deshacer("Ruta «" + ruta.nombre + "» eliminada", () => {
            if (buscarRutaGuardadaPorNombre(ruta.nombre)) return;
            guardarRutasGuardadas(rutasAntes);
            renderizarRutasGuardadas();
        });
        return;
    }

    if (typeof abrirConfirmacion === "function") {
        abrirConfirmacion(
            "Eliminar ruta guardada",
            "\u00bfQuer\u00e9s eliminar la ruta \"" + nombre + "\"?",
            borrar
        );
    }
}

function renderizarRutasGuardadas() {
    const lista = document.getElementById("listaRutasGuardadas");
    if (!lista) return;

    lista.innerHTML = "";
    const rutas = obtenerRutasGuardadas();
    const resumen = document.getElementById("resumenRutasGuardadas");
    if (resumen) {
        resumen.textContent = rutas.length === 0
            ? "Guard\u00e1 esta selecci\u00f3n para volver a usarla."
            : rutas.length + (rutas.length === 1 ? " ruta guardada" : " rutas guardadas");
    }

    if (rutas.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "sinRutasGuardadas";
        vacio.textContent = "Todav\u00eda no guardaste ninguna ruta.";
        lista.appendChild(vacio);
        return;
    }

    rutas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    rutas.forEach(ruta => {
        const fila = document.createElement("div");
        fila.className = "filaRutaGuardadaItem";
        fila.dataset.nombre = ruta.nombre;
        fila.setAttribute("role", "button");
        fila.setAttribute("tabindex", "0");
        fila.title = "Toc\u00e1 para ver las opciones de esta ruta";
        fila.addEventListener("click", evento => {
            if (evento.target.closest("button")) return;
            abrirOpcionesRutaGuardada(ruta.nombre);
        });
        fila.addEventListener("keydown", evento => {
            if (evento.key !== "Enter" && evento.key !== " ") return;
            evento.preventDefault();
            abrirOpcionesRutaGuardada(ruta.nombre);
        });

        const datos = document.createElement("div");
        const nombre = document.createElement("strong");
        nombre.textContent = ruta.nombre;
        const comerciosRuta = obtenerComercios().filter(comercio => {
            return ruta.comercios.includes(comercio.nombre);
        });
        const conUbicacion = comerciosRuta.filter(comercioTieneGps).length;
        const faltantes = ruta.comercios.length - comerciosRuta.length;
        const sinUbicacion = comerciosRuta.length - conUbicacion;

        const cantidad = document.createElement("small");
        cantidad.textContent = ruta.comercios.length + " comercio(s) - " + conUbicacion + " ubicados";
        datos.append(nombre, cantidad);

        if (ruta.dia) {
            const dia = document.createElement("small");
            dia.className = "diaRutaGuardada";
            dia.textContent = "D\u00eda habitual: " + capitalizarTexto(ruta.dia);
            datos.appendChild(dia);
        }

        if (faltantes > 0 || sinUbicacion > 0) {
            const advertencia = document.createElement("small");
            advertencia.className = "advertenciaRutaGuardada";
            advertencia.textContent =
                (faltantes > 0 ? faltantes + " eliminado(s)" : "") +
                (faltantes > 0 && sinUbicacion > 0 ? " - " : "") +
                (sinUbicacion > 0 ? sinUbicacion + " sin ubicaci\u00f3n" : "");
            datos.appendChild(advertencia);
        }

        const acciones = document.createElement("div");
        acciones.className = "accionesRutaGuardada";

        const cargar = document.createElement("button");
        cargar.type = "button";
        cargar.className = "btnAccion ver cargarRutaGuardadaBtn";
        cargar.dataset.nombre = ruta.nombre;
        cargar.textContent = "Cargar";

        const eliminar = document.createElement("button");
        eliminar.type = "button";
        eliminar.className = "btnAccion eliminar eliminarRutaGuardadaBtn";
        eliminar.dataset.nombre = ruta.nombre;
        eliminar.textContent = "Borrar";

        acciones.append(cargar, eliminar);
        fila.append(datos, acciones);
        lista.appendChild(fila);
    });
}

function cargarSelectComerciosRuta() {
    const select = document.getElementById("selectComercioGps");
    if (!select) return;

    const valorSeleccionado = select.value;
    select.innerHTML = "";

    const opcionInicial = document.createElement("option");
    opcionInicial.value = "";
    opcionInicial.textContent = "Eleg\u00ed un comercio...";
    select.appendChild(opcionInicial);

    comerciosActivos()
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
        .forEach(comercio => {
            const opcion = document.createElement("option");
            opcion.value = comercio.nombre;
            opcion.textContent =
                comercio.nombre +
                " " +
                (
                    comercioTieneGps(comercio)
                        ? "(GPS listo)"
                        : "(Sin GPS)"
                );

            select.appendChild(opcion);
        });

    if (valorSeleccionado) {
        select.value = valorSeleccionado;
    }
}

function obtenerComerciosSeleccionRuta() {
    return comerciosActivos()
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function actualizarEstadoSeleccionRuta() {
    const estado = document.getElementById("estadoSeleccionRuta");
    if (!estado) return;

    const comercios = obtenerComerciosSeleccionRuta();
    const seleccionados = comercios.filter(comercio => {
        return comerciosSeleccionadosRuta.has(comercio.nombre);
    });
    const conGps = seleccionados.filter(comercioTieneGps).length;
    const sinGps = seleccionados.length - conGps;
    const manuales = seleccionados.filter(comercio => {
        return comercioTieneGps(comercio) && comercio.origenGps === "manual";
    }).length;

    // Resumen en chips (T50): elegidos, con GPS y sin ubicaci\u00f3n.
    estado.innerHTML = "";
    [
        ["check", seleccionados.length + (seleccionados.length === 1 ? " elegido" : " elegidos"), ""],
        ["ubicacion", conGps + " con GPS" + (manuales ? " (" + manuales + " a mano)" : ""), "listo"],
        ["alerta", sinGps + " sin ubicaci\u00f3n", sinGps ? "falta" : ""]
    ].forEach(([icono, texto, tono]) => {
        const chip = document.createElement("span");
        chip.className = "chipResumenRuta";
        if (tono) chip.dataset.tono = tono;
        chip.innerHTML = window.icono(icono, 14);
        chip.append(document.createTextNode(" " + texto));
        estado.appendChild(chip);
    });
    // Los pines y las paradas siguen a la lista (T123).
    if (mapaLeaflet && capaMarcadores) renderizarPines(false);
    if (!rutaOrdenada.length) mostrarRutaEnLista();
}

function renderizarSeleccionRuta() {
    const contenedor = document.getElementById("listaSeleccionRuta");
    if (!contenedor) return;

    contenedor.innerHTML = "";
    const busqueda = normalizarTexto(document.getElementById("buscarSeleccionRuta")?.value || "");
    const comercios = obtenerComerciosSeleccionRuta().filter(comercio => {
        return !busqueda || normalizarTexto(comercio.nombre + " " + (comercio.direccion || "")).includes(busqueda);
    });

    if (comercios.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "vacioSeleccionRuta";
        vacio.textContent = busqueda ? "Ning\u00fan comercio coincide con la b\u00fasqueda." : "Todav\u00eda no cargaste comercios.";
        contenedor.appendChild(vacio);
    }

    comercios.forEach(comercio => {
        const etiqueta = document.createElement("label");
        etiqueta.className = "opcionSeleccionRuta";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = comerciosSeleccionadosRuta.has(comercio.nombre);
        checkbox.dataset.nombre = comercio.nombre;

        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                comerciosSeleccionadosRuta.add(comercio.nombre);
            } else {
                comerciosSeleccionadosRuta.delete(comercio.nombre);
            }
            rutaOrdenada = [];
            distanciasRuta = [];
            actualizarEstadoSeleccionRuta();
        });

        const avatar = document.createElement("span");
        avatar.className = "inicialesSeleccionRuta";
        avatar.setAttribute("aria-hidden", "true");
        avatar.textContent = String(comercio.nombre || "?").trim().split(/\s+/).slice(0, 2).map(palabra => palabra.charAt(0)).join("").toUpperCase();

        const texto = document.createElement("span");
        texto.className = "textoSeleccionRuta";
        const nombre = document.createElement("strong");
        nombre.textContent = comercio.nombre;
        const detalle = document.createElement("small");
        const visitado = comercioEstaVisitadoEstaSemana(comercio);
        detalle.textContent = (comercio.direccion ? comercio.direccion + " \u00b7 " : "") + (visitado ? "Visitado" : "Pendiente");
        texto.append(nombre, detalle);

        const estado = document.createElement("small");
        estado.innerHTML = window.icono(comercioTieneGps(comercio) ? "ubicacion" : "alerta", 12);
        const origen = String(comercio.origenGps || "").toLowerCase();
        const etiquetaCorta = !comercioTieneGps(comercio) ? "Sin ubicaci\u00f3n"
            : origen === "manual" ? "Pin a mano"
            : origen === "maps" ? "Aproximado"
            : "Con GPS";
        estado.append(document.createTextNode(" " + etiquetaCorta));
        estado.title = obtenerEtiquetaOrigenGps(comercio);
        estado.className = comercioTieneGps(comercio)
            ? "seleccionRutaGps"
            : "seleccionRutaSinGps";
        texto.appendChild(estado);

        etiqueta.append(checkbox, avatar, texto);
        contenedor.appendChild(etiqueta);
    });

    actualizarEstadoSeleccionRuta();
}

document.addEventListener("input", evento => {
    if (evento.target.id === "buscarSeleccionRuta") renderizarSeleccionRuta();
});

function inicializarSeleccionRuta() {
    const comercios = obtenerComerciosSeleccionRuta();

    if (!seleccionRutaInicializada) {
        comercios
            .filter(comercioTieneGps)
            .forEach(comercio => comerciosSeleccionadosRuta.add(comercio.nombre));
        seleccionRutaInicializada = true;
    }

    const nombresActuales = new Set(comercios.map(comercio => comercio.nombre));
    comerciosSeleccionadosRuta.forEach(nombre => {
        if (!nombresActuales.has(nombre)) {
            comerciosSeleccionadosRuta.delete(nombre);
        }
    });

    renderizarSeleccionRuta();
}

function seleccionarTodosLosComerciosRuta() {
    obtenerComerciosSeleccionRuta().forEach(comercio => {
        comerciosSeleccionadosRuta.add(comercio.nombre);
    });
    rutaOrdenada = [];
    distanciasRuta = [];
    renderizarSeleccionRuta();
}

function seleccionarPendientesRuta() {
    comerciosSeleccionadosRuta.clear();
    obtenerComerciosSeleccionRuta()
        .filter(comercio => !comercioEstaVisitadoEstaSemana(comercio))
        .forEach(comercio => comerciosSeleccionadosRuta.add(comercio.nombre));
    rutaOrdenada = [];
    distanciasRuta = [];
    renderizarSeleccionRuta();
}

function limpiarSeleccionRuta() {
    comerciosSeleccionadosRuta.clear();
    rutaOrdenada = [];
    distanciasRuta = [];
    renderizarSeleccionRuta();
}

function obtenerComerciosElegidosParaRuta() {
    return obtenerComerciosSeleccionRuta().filter(comercio => {
        return comerciosSeleccionadosRuta.has(comercio.nombre);
    });
}

function activarModoPinManual() {
    const select = document.getElementById("selectComercioGps");
    const nombre = select ? select.value : "";

    if (!nombre) {
        mostrarAviso(
            "Eleg\u00ed un comercio",
            "Seleccion\u00e1 primero el comercio al que quer\u00e9s asignarle el pin."
        );
        return;
    }

    if (!mapaLeaflet) {
        mostrarAviso(
            "Mapa no disponible",
            "Esper\u00e1 a que el mapa termine de cargar para colocar el pin."
        );
        return;
    }

    modoPinManual = true;
    mapaLeaflet.getContainer().style.cursor = "crosshair";

    const boton = document.getElementById("btnPinManual");
    if (boton) boton.innerHTML = window.icono("ubicacion", 14) + " Tocá el punto exacto en el mapa";

    mostrarAviso(
        "Colocar pin manual",
        "Mov\u00e9 el mapa hasta el comercio y toc\u00e1 su ubicaci\u00f3n exacta."
    );
}

function finalizarModoPinManual() {
    modoPinManual = false;

    if (mapaLeaflet) {
        mapaLeaflet.getContainer().style.cursor = "";
    }

    const boton = document.getElementById("btnPinManual");
    if (boton) boton.innerHTML = window.icono("ubicacion", 14) + " Colocar pin manual en el mapa";
}

function cancelarEdicionPin() {
    if (tipoEdicionPin === "existente" && marcadorPinManual && coordenadasPinOriginales) {
        marcadorPinManual.setLatLng([
            coordenadasPinOriginales.lat,
            coordenadasPinOriginales.lng
        ]);
    } else if (tipoEdicionPin === "nuevo" && marcadorPinManual && mapaLeaflet) {
        mapaLeaflet.removeLayer(marcadorPinManual);
        marcadorPinManual = null;
    }

    coordenadasPinPendientes = null;
    coordenadasPinOriginales = null;
    ocultarControlesEdicionPin();
    finalizarModoPinManual();
    renderizarPines();
}

// Busca el comercio por nombre y lo guarda por su id.
function actualizarComercioPorNombre(nombre, datos) {
    const comercio = buscarComercioPorNombre(nombre);
    return comercio ? actualizarComercioPorId(comercio.id, datos) : false;
}

function guardarPinManual() {
    const select = document.getElementById("selectComercioGps");
    const nombre = select ? select.value : "";

    if (!nombre || !coordenadasPinPendientes) return;

    const guardado = actualizarComercioPorNombre(nombre, {
        lat: coordenadasPinPendientes.lat,
        lng: coordenadasPinPendientes.lng,
        origenGps: "manual"
    });

    if (!guardado) {
        mostrarAviso(
            "No se pudo guardar",
            "No se encontr\u00f3 el comercio seleccionado."
        );
        return;
    }

    if (marcadorPinManual && mapaLeaflet) {
        mapaLeaflet.removeLayer(marcadorPinManual);
    }

    marcadorPinManual = null;
    coordenadasPinPendientes = null;
    coordenadasPinOriginales = null;
    tipoEdicionPin = "nuevo";
    ocultarControlesEdicionPin();
    finalizarModoPinManual();
    actualizarResumenRuta();
    cargarSelectComerciosRuta();
    renderizarSeleccionRuta();
    renderizarPines();

    mostrarAviso(
        "Pin guardado",
        "La ubicaci\u00f3n manual de \"" + nombre + "\" qued\u00f3 guardada para mapas y rutas."
    );

    if (typeof actualizarDashboard === "function") {
        actualizarDashboard();
    }
}

function manejarClickMapaManual(evento) {
    if (!modoPinManual || !mapaLeaflet) return;

    const lat = Number(evento.latlng.lat.toFixed(7));
    const lng = Number(evento.latlng.lng.toFixed(7));
    coordenadasPinPendientes = { lat, lng };
    coordenadasPinOriginales = null;
    tipoEdicionPin = "nuevo";

    if (marcadorPinManual) {
        mapaLeaflet.removeLayer(marcadorPinManual);
    }

    marcadorPinManual = L.marker([lat, lng], {
        draggable: true
    }).addTo(mapaLeaflet);

    marcadorPinManual.bindPopup("Pin manual pendiente de guardar").openPopup();
    marcadorPinManual.on("dragend", eventoDrag => {
        const posicion = eventoDrag.target.getLatLng();
        coordenadasPinPendientes = {
            lat: Number(posicion.lat.toFixed(7)),
            lng: Number(posicion.lng.toFixed(7))
        };
        mostrarControlesEdicionPin();
    });

    finalizarModoPinManual();
    mostrarControlesEdicionPin();

    mostrarAviso(
        "Pin colocado",
        "Pod\u00e9s seguir moviendo el pin. Cuando est\u00e9 en el lugar correcto, toc\u00e1 Guardar ubicaci\u00f3n."
    );

}

function manejarArrastrePinGuardado(evento) {
    const posicion = evento.target.getLatLng();
    coordenadasPinPendientes = {
        lat: Number(posicion.lat.toFixed(7)),
        lng: Number(posicion.lng.toFixed(7))
    };

    mostrarControlesEdicionPin();
}

function editarPinGuardado(nombre, opciones = {}) {
    const marcador = marcadoresPorNombre.get(nombre);
    const select = document.getElementById("selectComercioGps");

    if (!marcador || !select) {
        mostrarAviso(
            "Pin no disponible",
            "No se pudo encontrar el pin de este comercio en el mapa."
        );
        return;
    }

    const posicion = marcador.getLatLng();
    select.value = nombre;
    marcadorPinManual = marcador;
    coordenadasPinOriginales = {
        lat: Number(posicion.lat.toFixed(7)),
        lng: Number(posicion.lng.toFixed(7))
    };
    coordenadasPinPendientes = {
        lat: coordenadasPinOriginales.lat,
        lng: coordenadasPinOriginales.lng
    };
    tipoEdicionPin = "existente";

    if (marcador.dragging) {
        marcador.dragging.enable();
    }

    marcador.off("dragend", manejarArrastrePinGuardado);
    marcador.on("dragend", manejarArrastrePinGuardado);

    mostrarControlesEdicionPin();

    if (opciones.sinAviso) return;
    mostrarAviso(
        "Editar ubicaci\u00f3n",
        "Arrastr\u00e1 el pin las veces que necesites. Despu\u00e9s eleg\u00ed Guardar o Cancelar."
    );
}

function iniciarMapa() {
    if (mapaLeaflet) {
        window.setTimeout(() => {
            mapaLeaflet.invalidateSize();
        }, 200);

        return;
    }

    const contenedor = document.getElementById("mapaRuta");

    if (!contenedor || typeof L === "undefined") {
        mostrarAviso(
            "Mapa no disponible",
            "No se pudo cargar el mapa. Revis\u00e1 tu conexi\u00f3n a internet."
        );

        return;
    }

    mapaLeaflet = L.map("mapaRuta").setView(
        [LATITUD_POR_DEFECTO, LONGITUD_POR_DEFECTO],
        13
    );

    window.mapaVendeFrio.capaDeCalles().addTo(mapaLeaflet);
    mapaLeaflet.attributionControl?.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');

    capaMarcadores = L.layerGroup().addTo(mapaLeaflet);
    mapaLeaflet.on("click", manejarClickMapaManual);
}

// Pines del mapa (T123): azul con número si el comercio está en la ruta,
// gris si no. Tocar un pin abre sus opciones: sumarlo o sacarlo de la
// ruta, mover el pin, borrar la ubicación o hacerle un pedido.
function iconoPinRuta(comercio) {
    const enRuta = comerciosSeleccionadosRuta.has(comercio.nombre);
    const orden = rutaOrdenada.findIndex(item => item.nombre === comercio.nombre);
    const texto = orden >= 0 ? String(orden + 1) : (enRuta ? "✓" : "");
    return L.divIcon({
        className: "pinRuta",
        html: `<span class="globoPinRuta${enRuta ? " enRuta" : ""}"><b>${texto}</b></span>`,
        iconSize: [34, 44],
        iconAnchor: [17, 42],
        popupAnchor: [0, -38]
    });
}

function renderizarPines(ajustar = true) {
    if (!mapaLeaflet || !capaMarcadores) return;

    capaMarcadores.clearLayers();
    marcadoresPorNombre.clear();

    const comerciosConGps = comerciosActivos().filter(
        comercioTieneGps
    );

    dibujarResumenPinesMapa(comerciosConGps);
    if (comerciosConGps.length === 0) return;

    const limites = L.latLngBounds();

    comerciosConGps.forEach(comercio => {
        const coordenadas = [
            Number(comercio.lat),
            Number(comercio.lng)
        ];

        const marcador = L.marker(coordenadas, {
            icon: iconoPinRuta(comercio),
            title: comercio.nombre,
            alt: comercio.nombre,
            keyboard: true
        });
        marcador.on("click", () => {
            // Mientras se mueve este pin, tocarlo no abre nada.
            if (marcadorPinManual === marcador && coordenadasPinPendientes) return;
            abrirOpcionesPin(comercio.nombre);
        });

        capaMarcadores.addLayer(marcador);
        marcadoresPorNombre.set(comercio.nombre, marcador);
        limites.extend(coordenadas);
    });

    if (ajustar) {
        // Arriba queda lugar para el resumen, que no tape ningún pin.
        mapaLeaflet.fitBounds(limites, {
            paddingTopLeft: [30, 70],
            paddingBottomRight: [30, 30]
        });
    }
}

// Arriba del mapa: cuántos van en la ruta.
function dibujarResumenPinesMapa(comerciosConGps) {
    const contenedor = document.getElementById("mapaRuta");
    if (!contenedor) return;
    let resumen = document.getElementById("resumenPinesMapa");
    if (!resumen) {
        resumen = document.createElement("div");
        resumen.id = "resumenPinesMapa";
        resumen.className = "resumenPinesMapa";
        resumen.setAttribute("aria-live", "polite");
        contenedor.appendChild(resumen);
        if (typeof L !== "undefined" && L.DomEvent) L.DomEvent.disableClickPropagation(resumen);
    }
    const enRuta = comerciosConGps.filter(comercio => comerciosSeleccionadosRuta.has(comercio.nombre)).length;
    resumen.classList.toggle("oculto", comerciosConGps.length === 0 || Boolean(coordenadasPinPendientes));
    resumen.innerHTML = `<span class="puntoPinResumen enRuta"></span><span><b>${enRuta}</b> en la ruta</span><span class="separadorResumenPines"></span><span class="ayudaResumenPines">Tocá un pin para sumar o sacar</span>`;
}

function abrirOpcionesPin(nombre) {
    const comercio = buscarComercioPorNombre(nombre);
    if (!comercio || !window.piezas) return;
    const p = window.piezas;
    const enRuta = comerciosSeleccionadosRuta.has(comercio.nombre);
    const orden = rutaOrdenada.findIndex(item => item.nombre === comercio.nombre);
    const carga = cargaParaParada(comercio.nombre);
    const estado = orden >= 0 ? "Parada " + (orden + 1) + " de la ruta" : enRuta ? "Está en la ruta" : "No está en la ruta";
    const detalle = [comercio.direccion || "Sin dirección", "Ubicación: " + obtenerEtiquetaOrigenGps(comercio).toLowerCase()];
    if (carga.pedidos.length) detalle.push("Lleva " + carga.unidades + " u" + (carga.total ? " · " + p.plata(carga.total) : ""));
    const caja = p.hoja({
        titulo: comercio.nombre,
        sub: estado,
        clase: "hojaPinRuta",
        etiqueta: "Opciones de " + comercio.nombre,
        html: `<p class="detallePinRuta">${detalle.map(texto => p.esc(texto)).join("<br>")}</p>
            <button type="button" class="pzBtn ${enRuta ? "pzBtnGris" : "pzBtnPri"} botonRutaPin" data-pin="ruta">${p.ico(enRuta ? "cerrarX" : "mas", 18)} ${enRuta ? "Sacar de la ruta" : "Sumar a la ruta"}</button>
            <div class="pzOpciones opcionesPinRuta">
                <button type="button" class="pzOpcion" data-pin="mover">${p.ico("ubicacion", 22)}Mover el pin</button>
                <button type="button" class="pzOpcion" data-pin="pedido">${p.ico("documento", 22)}Hacer un pedido</button>
                <button type="button" class="pzOpcion pzOpcionPeligro" data-pin="borrar">${p.ico("tacho", 22)}Borrar la ubicación</button>
            </div>`
    });
    caja.addEventListener("click", evento => {
        const accion = evento.target.closest("[data-pin]")?.dataset.pin;
        if (!accion) return;
        p.cerrar();
        if (accion === "ruta") cambiarPinEnRuta(comercio.nombre);
        else if (accion === "mover") moverPinDesdeMapa(comercio.nombre);
        else if (accion === "pedido" && typeof irAPedidoRapido === "function") irAPedidoRapido(comercio.nombre);
        else if (accion === "borrar") {
            const select = document.getElementById("selectComercioGps");
            if (select) select.value = comercio.nombre;
            borrarGpsComercio();
        }
    });
}

// Suma o saca un comercio de la ruta, de a uno, desde el mapa.
function cambiarPinEnRuta(nombre) {
    const sumar = !comerciosSeleccionadosRuta.has(nombre);
    if (sumar) comerciosSeleccionadosRuta.add(nombre);
    else comerciosSeleccionadosRuta.delete(nombre);
    if (!sumar && rutaOrdenada.some(comercio => comercio.nombre === nombre)) {
        // Sacarlo de una ruta ya armada: las demás paradas siguen en su orden.
        rutaOrdenada = rutaOrdenada.filter(comercio => comercio.nombre !== nombre);
        recalcularDistanciasRuta();
    } else if (sumar && rutaOrdenada.length) {
        // Sumarlo a una ruta ya armada: va al final y se puede mover.
        const comercio = buscarComercioPorNombre(nombre);
        if (comercio) {
            rutaOrdenada = [...rutaOrdenada, comercio];
            rutaReordenadaAMano = true;
            recalcularDistanciasRuta();
        }
    }
    renderizarSeleccionRuta();
    renderizarPines(false);
    mostrarRutaEnLista();
    const cuantos = comerciosSeleccionadosRuta.size;
    if (typeof mostrarToast === "function") {
        mostrarToast((sumar ? "Sumaste " : "Sacaste ") + nombre + (sumar ? " a la ruta" : " de la ruta") + " (" + cuantos + (cuantos === 1 ? " comercio)" : " comercios)"));
    }
}

// Mover el pin desde el mapa: se arrastra y se guarda con la barra de abajo del mapa.
function moverPinDesdeMapa(nombre) {
    editarPinGuardado(nombre, { sinAviso: true });
    if (!coordenadasPinPendientes) return;
    const contenedor = document.getElementById("mapaRuta");
    if (!contenedor) return;
    let barra = document.getElementById("barraMoverPin");
    if (!barra) {
        barra = document.createElement("div");
        barra.id = "barraMoverPin";
        barra.className = "barraMoverPin";
        contenedor.appendChild(barra);
        if (L.DomEvent) {
            L.DomEvent.disableClickPropagation(barra);
            L.DomEvent.disableScrollPropagation(barra);
        }
    }
    barra.innerHTML = `<small>Arrastrá el pin de <b>${window.piezas.esc(nombre)}</b> al lugar justo</small>
        <div><button type="button" class="pzBtn pzBtnGris" id="cancelarMoverPin">Cancelar</button><button type="button" class="pzBtn pzBtnPri" id="guardarMoverPin">Guardar</button></div>`;
    barra.classList.remove("oculto");
    barra.querySelector("#cancelarMoverPin").onclick = () => cancelarEdicionPin();
    barra.querySelector("#guardarMoverPin").onclick = () => guardarPinManual();
    document.getElementById("resumenPinesMapa")?.classList.add("oculto");
    // El pin queda en el centro, un poco arriba, para que la barra no lo tape.
    const marcador = marcadoresPorNombre.get(nombre);
    if (marcador && mapaLeaflet) {
        mapaLeaflet.setView(marcador.getLatLng(), Math.max(mapaLeaflet.getZoom(), 16), { animate: false });
        mapaLeaflet.panBy([0, 50], { animate: false });
    }
    contenedor.scrollIntoView({ block: "center", behavior: "smooth" });
}

function guardarGpsActual(boton) {
    const select = document.getElementById("selectComercioGps");
    const nombre = select ? select.value : "";

    if (!nombre) {
        mostrarAviso(
            "Atenci\u00f3n",
            "Eleg\u00ed un comercio primero en la lista."
        );

        return;
    }

    if (!navigator.geolocation) {
        mostrarAviso(
            "GPS no disponible",
            "Tu celular no soporta GPS en el navegador."
        );

        return;
    }

    const textoOriginal =
        window.icono("ubicacion", 14) + " Guardar mi GPS actual en este comercio";

    boton.disabled = true;
    boton.innerHTML = window.icono("ubicacion", 14) + " Obteniendo GPS...";

    navigator.geolocation.getCurrentPosition(
        posicion => {
            const guardado = actualizarComercioPorNombre(
                nombre,
                {
                    lat: posicion.coords.latitude,
                    lng: posicion.coords.longitude,
                    origenGps: "gps"
                }
            );

            boton.disabled = false;
            boton.innerHTML = textoOriginal;

            if (!guardado) {
                mostrarAviso(
                    "No se pudo guardar",
                    "No se encontr\u00f3 el comercio seleccionado."
                );

                return;
            }

            mostrarAviso(
                "\u00a1GPS guardado!",
                "Guardamos la ubicaci\u00f3n exacta para \"" +
                    nombre +
                    "\"."
            );

            actualizarResumenRuta();
            cargarSelectComerciosRuta();
            renderizarSeleccionRuta();
            renderizarPines();

            if (typeof actualizarDashboard === "function") {
                actualizarDashboard();
            }
        },
        () => {
            boton.disabled = false;
            boton.innerHTML = textoOriginal;

            mostrarAviso(
                "Error de GPS",
                "Asegurate de darle permiso de ubicaci\u00f3n al navegador en tu celular."
            );
        },
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15000
        }
    );
}

function borrarGpsComercio() {
    const select = document.getElementById("selectComercioGps");
    const nombre = select ? select.value : "";

    if (!nombre) {
        mostrarAviso(
            "Atenci\u00f3n",
            "Eleg\u00ed el comercio al que quer\u00e9s borrarle el GPS en la lista."
        );

        return;
    }

    const comercio = buscarComercioPorNombre(nombre);

    if (!comercio || !comercioTieneGps(comercio)) {
        mostrarAviso(
            "Sin ubicaci\u00f3n",
            "\"" +
                nombre +
                "\" no tiene ninguna ubicaci\u00f3n GPS guardada."
        );

        return;
    }

    const borrar = () => {
        const guardado = actualizarComercioPorNombre(
            nombre,
            {
                lat: "",
                lng: ""
            }
        );

        if (!guardado) {
            mostrarAviso(
                "No se pudo borrar",
                "No se encontr\u00f3 el comercio seleccionado."
            );

            return;
        }

        mostrarAviso(
            "Ubicaci\u00f3n borrada",
            "Se elimin\u00f3 el pin del mapa para \"" +
                nombre +
                "\"."
        );

        actualizarResumenRuta();
        cargarSelectComerciosRuta();
        renderizarSeleccionRuta();
        renderizarPines();

        if (typeof actualizarDashboard === "function") {
            actualizarDashboard();
        }
    };

    // Etapa 8: sin "¿Seguro?". Se borra y queda "Deshacer" unos segundos.
    if (window.piezas) {
        const lugar = { lat: comercio.lat, lng: comercio.lng };
        const redibujar = () => {
            actualizarResumenRuta();
            cargarSelectComerciosRuta();
            renderizarSeleccionRuta();
            renderizarPines();
            if (typeof actualizarDashboard === "function") actualizarDashboard();
        };
        if (!actualizarComercioPorNombre(nombre, { lat: "", lng: "" })) {
            mostrarAviso("No se pudo borrar", "No se encontr\u00f3 el comercio seleccionado.");
            return;
        }
        redibujar();
        window.piezas.deshacer("Ubicaci\u00f3n de " + nombre + " borrada", () => {
            actualizarComercioPorNombre(nombre, lugar);
            redibujar();
        });
        return;
    }

    const mensaje =
        "\u00bfEst\u00e1s seguro de borrar el pin de ubicaci\u00f3n de \"" +
        nombre +
        "\"?";

    if (typeof abrirConfirmacion === "function") {
        abrirConfirmacion(
            "Borrar ubicaci\u00f3n",
            mensaje,
            borrar
        );
    } else {
        mostrarAviso(
            "No se pudo confirmar",
            "El modal de confirmaci\u00f3n no est\u00e1 disponible."
        );
    }
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const radioTierra = 6371e3;
    const radianes = Math.PI / 180;

    const diferenciaLatitud =
        (Number(lat2) - Number(lat1)) * radianes;

    const diferenciaLongitud =
        (Number(lon2) - Number(lon1)) * radianes;

    const a =
        Math.sin(diferenciaLatitud / 2) ** 2 +
        Math.cos(Number(lat1) * radianes) *
            Math.cos(Number(lat2) * radianes) *
            Math.sin(diferenciaLongitud / 2) ** 2;

    const c = 2 * Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
    );

    return radioTierra * c;
}

const MAX_PARADAS_RUTA_EXACTA = 9;

function calcularRutaExacta(comercios, latitudInicial, longitudInicial) {
    let mejorDistanciaTotal = Infinity;
    let mejorOrden = [];
    let mejoresDistancias = [];
    const usados = new Array(comercios.length).fill(false);
    const ordenActual = [];
    const distanciasActuales = [];

    function explorar(latitudActual, longitudActual, distanciaTotal) {
        if (distanciaTotal >= mejorDistanciaTotal) return;

        if (ordenActual.length === comercios.length) {
            mejorDistanciaTotal = distanciaTotal;
            mejorOrden = [...ordenActual];
            mejoresDistancias = [...distanciasActuales];
            return;
        }

        for (let indice = 0; indice < comercios.length; indice += 1) {
            if (usados[indice]) continue;

            const comercio = comercios[indice];
            const distancia = calcularDistancia(
                latitudActual,
                longitudActual,
                comercio.lat,
                comercio.lng
            );

            usados[indice] = true;
            ordenActual.push(comercio);
            distanciasActuales.push(distancia);

            explorar(
                Number(comercio.lat),
                Number(comercio.lng),
                distanciaTotal + distancia
            );

            distanciasActuales.pop();
            ordenActual.pop();
            usados[indice] = false;
        }
    }

    explorar(latitudInicial, longitudInicial, 0);

    return {
        comercios: mejorOrden,
        distancias: mejoresDistancias,
        distanciaTotal: mejorDistanciaTotal
    };
}

function optimizarRuta() {
    const comerciosElegidos = obtenerComerciosElegidosParaRuta();

    if (comerciosElegidos.length === 0) {
        mostrarAviso(
            "Sin comercios seleccionados",
            "Eleg\u00ed al menos un comercio para preparar la ruta."
        );
        return;
    }

    const comerciosConGps = comerciosElegidos.filter(comercioTieneGps);
    const comerciosSinGps = comerciosElegidos.length - comerciosConGps.length;

    if (comerciosConGps.length < 2) {
        mostrarAviso(
            "Faltan ubicaciones",
            "Seleccionaste " +
                comerciosElegidos.length +
                " comercio(s), pero solo " +
                comerciosConGps.length +
                " tienen GPS. Guard\u00e1 al menos 2 ubicaciones para armar la ruta." +
                (comerciosSinGps > 0 ? " Hay comercios seleccionados sin GPS." : "")
        );
        return;
    }

    if (comerciosConGps.length > MAX_PARADAS_RUTA_EXACTA) {
        mostrarAviso(
            "Demasiadas paradas para c\u00e1lculo exacto",
            "La ruta exacta est\u00e1 limitada a " +
                MAX_PARADAS_RUTA_EXACTA +
                " paradas para no bloquear el celular. Reduc\u00ed la selecci\u00f3n y no se usar\u00e1 una ruta aproximada."
        );
        return;
    }

    if (!navigator.geolocation) {
        mostrarAviso(
            "GPS no disponible",
            "Activ\u00e1 el GPS del celular para calcular la ruta desde tu ubicaci\u00f3n."
        );
        return;
    }

    navigator.geolocation.getCurrentPosition(
        posicion => {
            const resultado = calcularRutaExacta(
                comerciosConGps,
                posicion.coords.latitude,
                posicion.coords.longitude
            );

            if (resultado.comercios.length === 0) {
                mostrarAviso(
                    "No se pudo calcular",
                    "No se encontraron comercios v\u00e1lidos para la ruta."
                );
                return;
            }

            rutaOrdenada = resultado.comercios;
            distanciasRuta = resultado.distancias;
            inicioRutaCalculada = { lat: posicion.coords.latitude, lng: posicion.coords.longitude };
            rutaReordenadaAMano = false;
            paradasHechasRuta = new Set();
            paradasConPedidosRuta = new Set(rutaOrdenada.filter(comercio => cargaParaParada(comercio.nombre).pedidos.length).map(comercio => comercio.nombre));
            comerciosSinGpsRuta = comerciosElegidos
                .filter(comercio => !comercioTieneGps(comercio))
                .map(comercio => comercio.nombre);

            const nombresSinGps = comerciosElegidos
                .filter(comercio => !comercioTieneGps(comercio))
                .map(comercio => comercio.nombre);
            const listaOrdenada = rutaOrdenada
                .map((comercio, indice) => (indice + 1) + ". " + comercio.nombre)
                .join("\n");
            const detalleSinGps = nombresSinGps.length > 0
                ? "\n\nSe omitieron por no tener GPS:\n" +
                    nombresSinGps.map(nombre => "- " + nombre).join("\n")
                : "";

            mostrarAviso(
                "Ruta m\u00ednima calculada",
                "Se revisaron todas las combinaciones posibles.\n\n" +
                    "Orden de paradas:\n" +
                    listaOrdenada +
                    detalleSinGps
            );

            mostrarRutaEnLista();
            renderizarPines(false);
        },
        () => {
            mostrarAviso(
                "GPS desactivado",
                "Activ\u00e1 el GPS del celular para calcular la ruta desde tu ubicaci\u00f3n."
            );
        },
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15000
        }
    );
}

function abrirGoogleMaps() {
    const paradas =
        rutaOrdenada.length > 0
            ? rutaOrdenada
            : obtenerComerciosElegidosParaRuta().filter(
                  comercio =>
                      comercioTieneGps(comercio) ||
                      Boolean(
                          comercio.direccion &&
                              comercio.direccion.trim() !== ""
                      )
              );

    if (paradas.length === 0) {
        mostrarAviso(
            "Sin datos",
            "No hay comercios con GPS ni direcci\u00f3n para enviar a Google Maps."
        );

        return;
    }

    const paradasFormateadas = paradas
        .map(comercio => {
            if (comercioTieneGps(comercio)) {
                return comercio.lat + "," + comercio.lng;
            }

            return encodeURIComponent(comercio.direccion);
        })
        .join("/");

    window.open(
        "https://www.google.com/maps/dir//" +
            paradasFormateadas,
        "_blank"
    );
}

function formatearDistanciaTotal(metros) {
    const distancia = Number(metros) || 0;

    if (distancia < 1000) {
        return Math.round(distancia) + " m totales";
    }

    return (distancia / 1000).toFixed(1).replace(".", ",") + " km totales";
}

function formatearDistanciaRuta(metros, indice) {
    const distancia = Number(metros) || 0;
    const referencia = indice === 0
        ? "desde tu ubicaci" + String.fromCodePoint(0xF3) + "n"
        : "desde la parada anterior";

    if (distancia < 1000) {
        return Math.round(distancia) + " m " + referencia;
    }

    return (distancia / 1000).toFixed(1).replace(".", ",") + " km " + referencia;
}

// -------------------------------------------------
// Paradas de la ruta (T120): cada una con minutos aproximados y lo que
// lleva, se reordenan arrastrando ≡ y la próxima queda fija abajo con
// "Ir" y "Entregar".
// -------------------------------------------------

// Desde dónde se calculó la ruta (para rehacer las distancias al reordenar).
let inicioRutaCalculada = null;
// Paradas que el repartidor marcó como hechas (o salteó) en esta ruta.
let paradasHechasRuta = new Set();
// Paradas que tenían pedidos para entregar cuando se armó la ruta.
let paradasConPedidosRuta = new Set();
let rutaReordenadaAMano = false;

const ESTADOS_PARA_ENTREGAR_RUTA = ["cargado", "enPreparacion", "preparado", "enReparto", "enVehiculo"];

function mismoNombreRuta(a, b) {
    return String(a || "").trim().toLocaleLowerCase("es") === String(b || "").trim().toLocaleLowerCase("es");
}

// Lo que lleva para un comercio: pedidos sin entregar, unidades y plata.
function cargaParaParada(nombre) {
    if (typeof obtenerHistorial !== "function") return { pedidos: [], unidades: 0, total: 0 };
    const pedidos = obtenerHistorial().filter(pedido => pedido && pedido.eliminado !== true &&
        mismoNombreRuta(pedido.comercio, nombre) &&
        ESTADOS_PARA_ENTREGAR_RUTA.includes(typeof estadoActualDelPedido === "function" ? estadoActualDelPedido(pedido) : ""));
    const unidades = pedidos.reduce((suma, pedido) => suma + (pedido.productos || []).reduce((t, item) => t + (Number(item.cantidad) || 0), 0), 0);
    const total = pedidos.reduce((suma, pedido) => suma + (typeof totalDelPedido === "function" ? Number(totalDelPedido(pedido)?.total || 0) : 0), 0);
    return { pedidos, unidades, total };
}

// Minutos aproximados en auto (línea recta: más lento en la ciudad).
function minutosAproximados(metros) {
    const km = (Number(metros) || 0) / 1000;
    return Math.max(1, Math.round(km * 60 / (km < 3 ? 20 : 45)));
}

function textoDistanciaCorta(metros) {
    const distancia = Number(metros) || 0;
    const texto = distancia < 1000 ? Math.round(distancia) + " m" : (distancia / 1000).toFixed(1).replace(".", ",") + " km";
    return texto + " · " + minutosAproximados(distancia) + " min";
}

function recalcularDistanciasRuta() {
    distanciasRuta = rutaOrdenada.map((comercio, indice) => {
        const anterior = indice === 0 ? inicioRutaCalculada : { lat: rutaOrdenada[indice - 1].lat, lng: rutaOrdenada[indice - 1].lng };
        if (!anterior) return Number(distanciasRuta[indice]) || 0;
        return calcularDistancia(Number(anterior.lat), Number(anterior.lng), Number(comercio.lat), Number(comercio.lng));
    });
}

function paradaHecha(comercio) {
    if (paradasHechasRuta.has(comercio.nombre)) return true;
    // Tenía pedidos y ya no le queda ninguno para entregar: ya se pasó.
    return paradasConPedidosRuta.has(comercio.nombre) && cargaParaParada(comercio.nombre).pedidos.length === 0;
}

function indiceProximaParada() {
    return rutaOrdenada.findIndex(comercio => !paradaHecha(comercio));
}

function mostrarRutaEnLista() {
    const contenedor = document.getElementById("listaRutaOrdenada");
    if (!contenedor) return;
    contenedor.innerHTML = "";
    contenedor.classList.toggle("conParadas", rutaOrdenada.length > 0);

    if (rutaOrdenada.length === 0) {
        dibujarProximaParada();
        return;
    }

    const distanciaTotal = distanciasRuta.reduce((total, distancia) => total + (Number(distancia) || 0), 0);
    const minutosTotal = distanciasRuta.reduce((total, distancia) => total + minutosAproximados(distancia), 0);
    const encabezado = document.createElement("div");
    encabezado.className = "encabezadoParadas";
    const titulo = document.createElement("h3");
    titulo.textContent = rutaOrdenada.length + (rutaOrdenada.length === 1 ? " parada" : " paradas") + " · " +
        formatearDistanciaTotal(distanciaTotal).replace(" totales", "") + " · unos " + minutosTotal + " min";
    const subtitulo = document.createElement("small");
    subtitulo.textContent = rutaReordenadaAMano ? "Orden a tu gusto" : "Ruta mínima exacta";
    const textos = document.createElement("div");
    textos.append(titulo, subtitulo);
    encabezado.appendChild(textos);

    // Hoja de reparto impresa (T28e): solo en la nube y con Web Bluetooth.
    if (window.impresionVendeFrio?.disponible?.()) {
        const botonHoja = document.createElement("button");
        botonHoja.type = "button";
        botonHoja.id = "btnImprimirHojaReparto";
        botonHoja.className = "pzBtn pzBtnGris imprimirHojaReparto";
        botonHoja.setAttribute("aria-label", "Imprimir hoja de reparto");
        botonHoja.innerHTML = window.icono("impresora", 16) + " Hoja";
        encabezado.appendChild(botonHoja);
    }
    contenedor.appendChild(encabezado);

    const lista = document.createElement("ol");
    lista.className = "listaParadas";
    const proxima = indiceProximaParada();
    rutaOrdenada.forEach((comercio, indice) => {
        const carga = cargaParaParada(comercio.nombre);
        const hecha = paradaHecha(comercio);
        const fila = document.createElement("li");
        fila.className = "paradaOrden" + (indice === proxima ? " proxima" : "") + (hecha ? " hecha" : "");
        fila.dataset.nombre = comercio.nombre;
        const lleva = carga.pedidos.length
            ? `<span class="pzChip pzChipGris sinPunto">${window.icono("paquete", 13)} Lleva ${carga.unidades} u${carga.total ? " · " + window.piezas.plata(carga.total) : ""}</span>`
            : `<span class="pzChip pzChipGris sinPunto">Sin pedido para entregar</span>`;
        fila.innerHTML = `<span class="numeroParada">${hecha ? window.icono("check", 16) : indice + 1}</span>
            <button type="button" class="textoParada pedidoParadaRuta" data-nombre="${window.piezas.esc(comercio.nombre)}" aria-label="Pedido de ${window.piezas.esc(comercio.nombre)}">
                <strong>${window.piezas.esc(comercio.nombre)}</strong>
                <small>${window.piezas.esc(comercio.direccion || "Sin dirección")} · ${textoDistanciaCorta(distanciasRuta[indice])}</small>
                <span class="llevaParada">${lleva}</span>
            </button>
            <span class="agarreParada" role="button" tabindex="0" aria-label="Mover ${window.piezas.esc(comercio.nombre)}. Mantené apretado y arrastrá">${window.icono("menu", 20)}</span>`;
        lista.appendChild(fila);
    });
    contenedor.appendChild(lista);

    const ayuda = document.createElement("p");
    ayuda.className = "ayudaParadas";
    ayuda.textContent = "Mantené apretado ≡ y arrastrá para cambiar el orden.";
    contenedor.appendChild(ayuda);

    conectarArrastreParadas(lista);
    dibujarProximaParada();
}

// Arrastrar ≡ para cambiar el orden (con el dedo o el mouse).
function conectarArrastreParadas(lista) {
    let arrastrando = null;
    let puntero = null;

    const terminar = () => {
        if (!arrastrando) return;
        arrastrando.classList.remove("arrastrando");
        lista.classList.remove("ordenando");
        const orden = [...lista.querySelectorAll(".paradaOrden")].map(fila => fila.dataset.nombre);
        arrastrando = null;
        puntero = null;
        const antes = rutaOrdenada.map(comercio => comercio.nombre).join("|");
        if (orden.join("|") === antes) return;
        rutaOrdenada = orden.map(nombre => rutaOrdenada.find(comercio => comercio.nombre === nombre)).filter(Boolean);
        rutaReordenadaAMano = true;
        recalcularDistanciasRuta();
        mostrarRutaEnLista();
        renderizarPines(false);
    };

    lista.addEventListener("pointerdown", evento => {
        const agarre = evento.target.closest(".agarreParada");
        if (!agarre) return;
        evento.preventDefault();
        arrastrando = agarre.closest(".paradaOrden");
        puntero = evento.pointerId;
        arrastrando.classList.add("arrastrando");
        lista.classList.add("ordenando");
        try { agarre.setPointerCapture(evento.pointerId); } catch (error) { /* sin captura */ }
    });
    lista.addEventListener("pointermove", evento => {
        if (!arrastrando || evento.pointerId !== puntero) return;
        evento.preventDefault();
        const filas = [...lista.querySelectorAll(".paradaOrden")].filter(fila => fila !== arrastrando);
        const siguiente = filas.find(fila => {
            const caja = fila.getBoundingClientRect();
            return evento.clientY < caja.top + caja.height / 2;
        });
        if (siguiente) lista.insertBefore(arrastrando, siguiente);
        else lista.appendChild(arrastrando);
    });
    lista.addEventListener("pointerup", terminar);
    lista.addEventListener("pointercancel", terminar);
    // Con el teclado: flechas arriba y abajo.
    lista.addEventListener("keydown", evento => {
        const agarre = evento.target.closest(".agarreParada");
        if (!agarre || !["ArrowUp", "ArrowDown"].includes(evento.key)) return;
        evento.preventDefault();
        const fila = agarre.closest(".paradaOrden");
        const indice = rutaOrdenada.findIndex(comercio => comercio.nombre === fila.dataset.nombre);
        const destino = indice + (evento.key === "ArrowUp" ? -1 : 1);
        if (indice < 0 || destino < 0 || destino >= rutaOrdenada.length) return;
        const [movido] = rutaOrdenada.splice(indice, 1);
        rutaOrdenada.splice(destino, 0, movido);
        rutaReordenadaAMano = true;
        recalcularDistanciasRuta();
        mostrarRutaEnLista();
        renderizarPines(false);
        document.querySelector(`.paradaOrden[data-nombre="${CSS.escape(movido.nombre)}"] .agarreParada`)?.focus();
    });
}

// La próxima parada, fija abajo (dentro de la pantalla de Rutas).
function dibujarProximaParada() {
    const pantalla = document.getElementById("pantallaRutas");
    if (!pantalla) return;
    let tarjeta = document.getElementById("proximaParadaRuta");
    const indice = indiceProximaParada();
    if (!rutaOrdenada.length || indice < 0 || navegacionActiva) {
        tarjeta?.remove();
        pantalla.classList.remove("conProximaParada");
        if (rutaOrdenada.length && indice < 0 && !navegacionActiva) {
            tarjeta = document.createElement("div");
            tarjeta.id = "proximaParadaRuta";
            tarjeta.className = "proximaParada terminada";
            tarjeta.innerHTML = `<strong>${window.icono("check", 18)} Terminaste la ruta</strong><button type="button" class="pzBtn pzBtnGris" data-parada="reiniciar">Empezar de nuevo</button>`;
            tarjeta.onclick = evento => {
                if (!evento.target.closest('[data-parada="reiniciar"]')) return;
                paradasHechasRuta.clear();
                paradasConPedidosRuta.clear();
                mostrarRutaEnLista();
            };
            pantalla.appendChild(tarjeta);
            pantalla.classList.add("conProximaParada");
        }
        return;
    }
    const comercio = rutaOrdenada[indice];
    const carga = cargaParaParada(comercio.nombre);
    if (!tarjeta) {
        tarjeta = document.createElement("div");
        tarjeta.id = "proximaParadaRuta";
        pantalla.appendChild(tarjeta);
    }
    tarjeta.className = "proximaParada";
    tarjeta.setAttribute("role", "region");
    tarjeta.setAttribute("aria-label", "Próxima parada");
    pantalla.classList.add("conProximaParada");
    tarjeta.innerHTML = `<div class="cabProximaParada">
            <small>Próxima parada · ${indice + 1} de ${rutaOrdenada.length}</small>
            <button type="button" class="pzEnlace" data-parada="saltear">Ya pasé ${window.icono("chevDerecha", 14)}</button>
        </div>
        <div class="nombreProximaParada"><strong>${window.piezas.esc(comercio.nombre)}</strong><span>${textoDistanciaCorta(distanciasRuta[indice])}</span></div>
        <div class="botonesProximaParada">
            <button type="button" class="pzBtn pzBtnSec" data-parada="ir">${window.icono("navegar", 18)} Ir</button>
            <button type="button" class="pzBtn pzBtnPri" data-parada="entregar">${window.icono(carga.pedidos.length ? "check" : "documento", 18)} ${carga.pedidos.length ? "Entregar" : "Hacer pedido"}</button>
        </div>`;
    tarjeta.onclick = evento => {
        const accion = evento.target.closest("[data-parada]")?.dataset.parada;
        if (!accion) return;
        if (accion === "ir") {
            window.open("https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + Number(comercio.lat) + "," + Number(comercio.lng), "_blank", "noopener");
        } else if (accion === "entregar") {
            const actual = cargaParaParada(comercio.nombre);
            if (actual.pedidos.length && window.seguimientoVendeFrio?.abrirPedido?.(actual.pedidos[0].id)) return;
            if (typeof irAPedidoRapido === "function") irAPedidoRapido(comercio.nombre);
        } else if (accion === "saltear") {
            paradasHechasRuta.add(comercio.nombre);
            mostrarRutaEnLista();
        }
    };
}

configurarCierreModalAviso();

const botonSeleccionarTodosRuta = document.getElementById("seleccionarTodosRuta");
const botonSeleccionarPendientesRuta = document.getElementById("seleccionarPendientesRuta");
const botonLimpiarSeleccionRuta = document.getElementById("limpiarSeleccionRuta");

if (botonSeleccionarTodosRuta) {
    botonSeleccionarTodosRuta.addEventListener("click", seleccionarTodosLosComerciosRuta);
}

if (botonSeleccionarPendientesRuta) {
    botonSeleccionarPendientesRuta.addEventListener("click", seleccionarPendientesRuta);
}

if (botonLimpiarSeleccionRuta) {
    botonLimpiarSeleccionRuta.addEventListener("click", limpiarSeleccionRuta);
}

document.addEventListener("click", event => {
    const boton = event.target.closest("button");
    if (!boton) return;

    if (boton.classList.contains("btnEditarPinMapa")) {
        editarPinGuardado(boton.dataset.nombre || "");
        return;
    }

    if (boton.classList.contains("cargarRutaGuardadaBtn")) {
        cargarRutaGuardada(boton.dataset.nombre || "");
        return;
    }

    if (boton.classList.contains("eliminarRutaGuardadaBtn")) {
        confirmarEliminarRutaGuardada(boton.dataset.nombre || "");
        return;
    }

    if (boton.classList.contains("pedidoParadaRuta")) {
        if (typeof irAPedidoRapido === "function") {
            irAPedidoRapido(boton.dataset.nombre || "");
        }
        return;
    }

    if (boton.id === "btnGuardarGps") {
        guardarGpsActual(boton);
        return;
    }

    if (boton.id === "btnBorrarGps") {
        borrarGpsComercio();
        return;
    }

    if (boton.id === "btnOptimizarRuta") {
        optimizarRuta();
        return;
    }

    if (boton.id === "btnImprimirHojaReparto") {
        const distancia = distanciasRuta.reduce((total, metros) => total + (Number(metros) || 0), 0);
        window.impresionVendeFrio?.imprimirHojaDeReparto?.(
            rutaOrdenada.map(comercio => ({
                nombre: comercio.nombre,
                direccion: comercio.direccion || "",
                telefono: comercio.telefono || ""
            })),
            { distancia: distancia > 0 ? formatearDistanciaTotal(distancia) : "", sinGps: comerciosSinGpsRuta }
        );
        return;
    }

    if (boton.id === "btnGoogleMaps") {
        abrirGoogleMaps();
    }
});
