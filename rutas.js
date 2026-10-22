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
    // Rutas abre siempre en el mapa (T136); la lista se abre con «Paradas».
    document.getElementById("pantallaRutas")?.classList.remove("conParadasAbiertas");
    actualizarResumenRuta();
    cargarSelectComerciosRuta();
    inicializarSeleccionRuta();
    iniciarMapa();
    crearControlesPinManual();
    crearControlesRutasGuardadas();
    crearModalOpcionesRutaGuardada();
    crearBotonNavegarRuta();
    prepararVistaPreviaRutas();
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
// T136: «Iniciar» ya está en la hoja de abajo de la vista previa.
function crearBotonNavegarRuta() {
    const boton = document.getElementById("btnNavegarRuta");
    if (!boton || boton.dataset.listo) return;
    boton.dataset.listo = "1";
    boton.addEventListener("click", () => {
        if (!rutaOrdenada.length) {
            mostrarAviso("Primero, la ruta", "Tocá \u00abOptimizar\u00bb y despu\u00e9s \u00abIniciar\u00bb.");
            return;
        }
        const nombres = rutaOrdenada.map(parada => parada.nombre);
        if (!window.navegacionVendeFrio?.abrir?.(nombres)) {
            mostrarAviso("No se pudo navegar", "Las paradas necesitan su ubicaci\u00f3n GPS. Si elegiste Google Maps en M\u00e1s, us\u00e1 el bot\u00f3n de Google Maps.");
        }
    });
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
    // T133: solo calles de auto, el mismo servidor y perfil que navegacion.js
    // (el OSRM de demostración mezclaba pasos peatonales).
    const url = "https://routing.openstreetmap.de/routed-car/route/v1/driving/" +
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
    refrescarPines();
    if (!rutaOrdenada.length) mostrarRutaEnLista();
    else dibujarSinUbicacionParadas();
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

// Todos, Pendientes y Ninguno solo cambian las tildes (T141): la lista ya
// está armada y no hace falta rehacerla.
function actualizarCasillasSeleccionRuta() {
    const casillas = document.querySelectorAll("#listaSeleccionRuta input[type=checkbox]");
    if (!casillas.length) {
        renderizarSeleccionRuta();
        return;
    }
    casillas.forEach(casilla => {
        const marcada = comerciosSeleccionadosRuta.has(casilla.dataset.nombre);
        if (casilla.checked !== marcada) casilla.checked = marcada;
    });
    actualizarEstadoSeleccionRuta();
}

function seleccionarTodosLosComerciosRuta() {
    obtenerComerciosSeleccionRuta().forEach(comercio => {
        comerciosSeleccionadosRuta.add(comercio.nombre);
    });
    rutaOrdenada = [];
    distanciasRuta = [];
    actualizarCasillasSeleccionRuta();
}

function seleccionarPendientesRuta() {
    comerciosSeleccionadosRuta.clear();
    obtenerComerciosSeleccionRuta()
        .filter(comercio => !comercioEstaVisitadoEstaSemana(comercio))
        .forEach(comercio => comerciosSeleccionadosRuta.add(comercio.nombre));
    rutaOrdenada = [];
    distanciasRuta = [];
    actualizarCasillasSeleccionRuta();
}

function limpiarSeleccionRuta() {
    comerciosSeleccionadosRuta.clear();
    rutaOrdenada = [];
    distanciasRuta = [];
    actualizarCasillasSeleccionRuta();
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
    // El pin se pone en el mapa, que está detrás de las paradas (T136).
    cerrarPanelParadas();

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
    const select = document.getElementById("selectComercioGps");

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
    mostrarBarraMoverPin(select ? select.value : "");

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

    // T136: sin los botones + y − (se agranda con dos dedos): arriba y abajo
    // van la cabecera y la hoja de la vista previa.
    mapaLeaflet = L.map("mapaRuta", { zoomControl: false }).setView(
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
function textoPinRuta(comercio, ordenes) {
    const enRuta = comerciosSeleccionadosRuta.has(comercio.nombre);
    const orden = ordenes ? (ordenes.has(comercio.nombre) ? ordenes.get(comercio.nombre) : -1)
        : rutaOrdenada.findIndex(item => item.nombre === comercio.nombre);
    return orden >= 0 ? String(orden + 1) : (enRuta ? "✓" : "");
}

function iconoPinRuta(comercio, ordenes) {
    const enRuta = comerciosSeleccionadosRuta.has(comercio.nombre);
    const texto = textoPinRuta(comercio, ordenes);
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

        marcador.clavePinRuta = textoPinRuta(comercio) + (comerciosSeleccionadosRuta.has(comercio.nombre) ? "+" : "-");
        capaMarcadores.addLayer(marcador);
        marcadoresPorNombre.set(comercio.nombre, marcador);
        limites.extend(coordenadas);
    });

    destacarPinRuta(paradaDestacadaRuta);
    if (ajustar) {
        // Arriba la cabecera y abajo la hoja de la vista previa: que no tapen ningún pin.
        mapaLeaflet.fitBounds(limites, margenesMapaRutas());
    }
}

// T141: al tildar, ordenar o sacar una parada no se rearman los 80 pines
// (en un celular barato el mapa se trababa): se cambia solo el dibujo de los
// que cambiaron. Si hay comercios nuevos, movidos o un pin en edición, se
// rearman todos como antes.
function refrescarPines() {
    if (!mapaLeaflet || !capaMarcadores) return;
    const comerciosConGps = comerciosActivos().filter(comercioTieneGps);
    const igual = !coordenadasPinPendientes && comerciosConGps.length === marcadoresPorNombre.size &&
        comerciosConGps.every(comercio => {
            const marcador = marcadoresPorNombre.get(comercio.nombre);
            if (!marcador) return false;
            const lugar = marcador.getLatLng();
            return lugar.lat === Number(comercio.lat) && lugar.lng === Number(comercio.lng);
        });
    if (!igual) {
        renderizarPines(false);
        return;
    }
    const ordenes = new Map(rutaOrdenada.map((comercio, indice) => [comercio.nombre, indice]));
    comerciosConGps.forEach(comercio => {
        const marcador = marcadoresPorNombre.get(comercio.nombre);
        const clave = textoPinRuta(comercio, ordenes) + (comerciosSeleccionadosRuta.has(comercio.nombre) ? "+" : "-");
        if (marcador.clavePinRuta === clave) return;
        marcador.setIcon(iconoPinRuta(comercio, ordenes));
        marcador.clavePinRuta = clave;
    });
    dibujarResumenPinesMapa(comerciosConGps);
    destacarPinRuta(paradaDestacadaRuta);
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
    if (rutaOrdenada.length) mostrarRutaEnLista();
    const cuantos = comerciosSeleccionadosRuta.size;
    if (typeof mostrarToast === "function") {
        mostrarToast((sumar ? "Sumaste " : "Sacaste ") + nombre + (sumar ? " a la ruta" : " de la ruta") + " (" + cuantos + (cuantos === 1 ? " comercio)" : " comercios)"));
    }
}

// Mover el pin desde el mapa: se arrastra y se guarda con la barra de abajo del mapa.
function moverPinDesdeMapa(nombre) {
    editarPinGuardado(nombre, { sinAviso: true });
    if (!coordenadasPinPendientes) return;
    mostrarBarraMoverPin(nombre);
    // El pin queda en el centro, un poco arriba, para que la barra no lo tape.
    const marcador = marcadoresPorNombre.get(nombre);
    if (marcador && mapaLeaflet) {
        mapaLeaflet.setView(marcador.getLatLng(), Math.max(mapaLeaflet.getZoom(), 16), { animate: false });
        mapaLeaflet.panBy([0, 50], { animate: false });
    }
}

// Barra de abajo del mapa para guardar o cancelar el pin que se está moviendo.
function mostrarBarraMoverPin(nombre) {
    const contenedor = document.getElementById("mapaRuta");
    if (!contenedor || !nombre) return;
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
// Google Maps acepta hasta 10 puntos por enlace: tu ubicación (el origen vacío
// de "dir//") y 9 paradas. Con más, el resto no aparece.
const MAX_PARADAS_GOOGLE_MAPS = 9;

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

// Con muchas paradas: arranca por la más cercana cada vez y después mueve
// paradas y da vuelta tramos del recorrido mientras eso lo acorte. El punto de partida
// queda fijo y el final es libre, como en calcularRutaExacta.
function calcularRutaAproximada(comercios, latitudInicial, longitudInicial) {
    const puntos = [{ lat: latitudInicial, lng: longitudInicial }].concat(comercios);
    const distancia = (a, b) => calcularDistancia(puntos[a].lat, puntos[a].lng, puntos[b].lat, puntos[b].lng);

    const orden = [0];
    const pendientes = new Set(comercios.map((comercio, indice) => indice + 1));
    while (pendientes.size) {
        const ultimo = orden[orden.length - 1];
        let mejor = null;
        pendientes.forEach(indice => {
            if (mejor === null || distancia(ultimo, indice) < distancia(ultimo, mejor)) mejor = indice;
        });
        orden.push(mejor);
        pendientes.delete(mejor);
    }

    // Desde cada punto del camino, cuánto cuesta ir hasta el siguiente (0 si es el último).
    const tramo = (a, b) => (b === undefined ? 0 : distancia(a, b));

    let mejoro = true;
    let vueltas = 0;
    while (mejoro && vueltas < 50) {
        mejoro = false;
        vueltas += 1;
        // Mover 1 a 3 paradas seguidas a otro lugar del camino (o-opt), al derecho o al revés.
        for (let largo = 1; largo <= 3; largo += 1) {
            for (let i = 1; i + largo <= orden.length; i += 1) {
                const tramoMovido = orden.slice(i, i + largo);
                const resto = orden.slice(0, i).concat(orden.slice(i + largo));
                const ahorro = distancia(orden[i - 1], tramoMovido[0]) +
                    tramo(tramoMovido[largo - 1], orden[i + largo]) -
                    tramo(orden[i - 1], orden[i + largo]);
                let mejorLugar = null;
                for (let lugar = 0; lugar < resto.length; lugar += 1) {
                    if (lugar === i - 1) continue;
                    [tramoMovido, tramoMovido.slice().reverse()].forEach(version => {
                        const costo = distancia(resto[lugar], version[0]) +
                            tramo(version[largo - 1], resto[lugar + 1]) -
                            tramo(resto[lugar], resto[lugar + 1]);
                        if (costo < ahorro - 0.01 && (!mejorLugar || costo < mejorLugar.costo)) {
                            mejorLugar = { lugar, version, costo };
                        }
                    });
                }
                if (mejorLugar) {
                    resto.splice(mejorLugar.lugar + 1, 0, ...mejorLugar.version);
                    orden.splice(0, orden.length, ...resto);
                    mejoro = true;
                }
            }
        }
        // Dar vuelta un tramo del camino (2-opt).
        for (let i = 1; i < orden.length - 1; i += 1) {
            for (let j = i + 1; j < orden.length; j += 1) {
                const antes = distancia(orden[i - 1], orden[i]) +
                    (j + 1 < orden.length ? distancia(orden[j], orden[j + 1]) : 0);
                const despues = distancia(orden[i - 1], orden[j]) +
                    (j + 1 < orden.length ? distancia(orden[i], orden[j + 1]) : 0);
                if (despues < antes - 0.01) {
                    orden.splice(i, j - i + 1, ...orden.slice(i, j + 1).reverse());
                    mejoro = true;
                }
            }
        }
    }

    const distancias = orden.slice(1).map((indice, posicion) => distancia(orden[posicion], indice));
    return {
        comercios: orden.slice(1).map(indice => puntos[indice]),
        distancias,
        distanciaTotal: distancias.reduce((total, metros) => total + metros, 0)
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

    if (!navigator.geolocation) {
        mostrarAviso(
            "GPS no disponible",
            "Activ\u00e1 el GPS del celular para calcular la ruta desde tu ubicaci\u00f3n."
        );
        return;
    }

    navigator.geolocation.getCurrentPosition(
        posicion => {
            // Hasta MAX_PARADAS_RUTA_EXACTA se prueban todas las combinaciones;
            // con más paradas sería eterno, así que se busca un orden muy bueno.
            const exacta = comerciosConGps.length <= MAX_PARADAS_RUTA_EXACTA;
            const resultado = (exacta ? calcularRutaExacta : calcularRutaAproximada)(
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
            pedidosAlArmarRuta = idsDePedidosRuta();
            // El índice de recién se armó con los pedidos de la ruta anterior.
            indicePedidosRuta = null;
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
                exacta ? "Ruta m\u00ednima calculada" : "Ruta optimizada",
                (exacta
                    ? "Se revisaron todas las combinaciones posibles.\n\n"
                    : "Se busc\u00f3 el orden m\u00e1s corto para las " + rutaOrdenada.length + " paradas.\n\n") +
                    "Orden de paradas:\n" +
                    listaOrdenada +
                    detalleSinGps
            );

            mostrarRutaEnLista();
            refrescarPines();
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

    if (paradas.length <= MAX_PARADAS_GOOGLE_MAPS) {
        abrirParadasEnGoogleMaps(paradas);
        return;
    }

    // Google Maps no acepta más paradas: se pasa la ruta en partes, en el mismo orden.
    const partes = [];
    for (let desde = 0; desde < paradas.length; desde += MAX_PARADAS_GOOGLE_MAPS) {
        partes.push(paradas.slice(desde, desde + MAX_PARADAS_GOOGLE_MAPS));
    }
    const titulo = "Google Maps acepta hasta " + MAX_PARADAS_GOOGLE_MAPS + " paradas";
    const explicacion = "Tu ruta tiene " + paradas.length + " paradas. Te la paso en " + partes.length +
        " partes: abr\u00ed la Parte 1 y, cuando la termines, volv\u00e9 y abr\u00ed la siguiente.";

    if (!window.piezas?.hoja) {
        mostrarAviso(titulo, explicacion + " Ahora te abro la Parte 1.");
        abrirParadasEnGoogleMaps(partes[0]);
        return;
    }

    const proxima = Math.min(ultimaParteGoogleMaps.paradas === claveParadasGoogleMaps(paradas) ? ultimaParteGoogleMaps.parte + 1 : 0, partes.length - 1);
    let numero = 0;
    window.piezas.hoja({
        titulo,
        sub: explicacion,
        clase: "hojaPartesGoogleMaps",
        botones: partes.map((parte, indice) => {
            const primera = numero + 1;
            numero += parte.length;
            return {
                id: "btnParteGoogleMaps" + (indice + 1),
                texto: "Parte " + (indice + 1) + " \u00b7 paradas " + primera + (parte.length > 1 ? " a " + numero : ""),
                icono: "auto",
                clase: indice === proxima ? "pzBtnPri" : "pzBtnSec",
                alTocar: () => {
                    ultimaParteGoogleMaps = { paradas: claveParadasGoogleMaps(paradas), parte: indice };
                    abrirParadasEnGoogleMaps(parte);
                }
            };
        }).concat([{ texto: "Cancelar", clase: "pzBtnGris" }])
    });
}

// Para resaltar la parte que sigue la próxima vez que se toca "Google Maps".
let ultimaParteGoogleMaps = { paradas: "", parte: -1 };

function claveParadasGoogleMaps(paradas) {
    return paradas.map(comercio => comercio.nombre).join("|");
}

function abrirParadasEnGoogleMaps(paradas) {
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
// Pedidos que ya existían al armar la ruta: uno nuevo para una parada
// (tocando "Pedido" o "Hacer pedido") la deja hecha sola.
let pedidosAlArmarRuta = null;

function idsDePedidosRuta() {
    if (typeof obtenerHistorial !== "function") return new Set();
    return new Set(obtenerHistorial().filter(pedido => pedido && pedido.id != null).map(pedido => String(pedido.id)));
}

// T141: leer el historial es caro (cientos de pedidos) y la lista de paradas
// lo pedía 3 veces por parada; en un celular barato, 80 paradas tardaban
// segundos. Se arma una vez por dibujo un índice por comercio y se tira
// apenas termina (el próximo dibujo ve los pedidos nuevos).
let indicePedidosRuta = null;

function pedidosRutaPorComercio() {
    if (indicePedidosRuta) return indicePedidosRuta;
    const indice = { carga: new Map(), nuevos: new Set() };
    const historial = typeof obtenerHistorial === "function" ? obtenerHistorial() : [];
    historial.forEach(pedido => {
        if (!pedido || pedido.eliminado === true) return;
        const clave = String(pedido.comercio || "").trim().toLocaleLowerCase("es");
        if (pedidosAlArmarRuta && pedido.id != null && !pedidosAlArmarRuta.has(String(pedido.id))) indice.nuevos.add(clave);
        const estado = typeof estadoActualDelPedido === "function" ? estadoActualDelPedido(pedido) : "";
        if (!ESTADOS_PARA_ENTREGAR_RUTA.includes(estado)) return;
        const carga = indice.carga.get(clave) || { pedidos: [], unidades: 0, total: 0 };
        carga.pedidos.push(pedido);
        carga.unidades += (pedido.productos || []).reduce((t, item) => t + (Number(item.cantidad) || 0), 0);
        carga.total += typeof totalDelPedido === "function" ? Number(totalDelPedido(pedido)?.total || 0) : 0;
        indice.carga.set(clave, carga);
    });
    indicePedidosRuta = indice;
    setTimeout(() => { indicePedidosRuta = null; }, 0);
    return indice;
}

function tienePedidoNuevoRuta(nombre) {
    if (!pedidosAlArmarRuta) return false;
    return pedidosRutaPorComercio().nuevos.has(String(nombre || "").trim().toLocaleLowerCase("es"));
}

const ESTADOS_PARA_ENTREGAR_RUTA = ["cargado", "enPreparacion", "preparado", "enReparto", "enVehiculo"];

// Lo que lleva para un comercio: pedidos sin entregar, unidades y plata.
function cargaParaParada(nombre) {
    const carga = pedidosRutaPorComercio().carga.get(String(nombre || "").trim().toLocaleLowerCase("es"));
    return carga ? { pedidos: carga.pedidos.slice(), unidades: carga.unidades, total: carga.total } : { pedidos: [], unidades: 0, total: 0 };
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
    if (tienePedidoNuevoRuta(comercio.nombre)) return true;
    // Tenía pedidos y ya no le queda ninguno para entregar: ya se pasó.
    return paradasConPedidosRuta.has(comercio.nombre) && cargaParaParada(comercio.nombre).pedidos.length === 0;
}

function indiceProximaParada() {
    return rutaOrdenada.findIndex(comercio => !paradaHecha(comercio));
}

// T138: las paradas del día como línea de tiempo: la hora de llegada, el
// número y lo que lleva o cobra cada una; se ordenan arrastrando ≡. Arriba,
// 4 números del día; abajo, los elegidos sin ubicación con «Poner pin».
function mostrarRutaEnLista() {
    const contenedor = document.getElementById("listaRutaOrdenada");
    if (!contenedor) return;
    contenedor.innerHTML = "";
    contenedor.classList.toggle("conParadas", rutaOrdenada.length > 0);

    dibujarVistaPreviaRutas();
    dibujarNumerosParadas();
    dibujarSinUbicacionParadas();
    if (rutaOrdenada.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "vacioParadas";
        vacio.textContent = "Elegí los comercios y tocá «Optimizar orden» para armar la ruta.";
        contenedor.appendChild(vacio);
        dibujarProximaParada();
        return;
    }

    const encabezado = document.createElement("div");
    encabezado.className = "encabezadoParadas";
    const subtitulo = document.createElement("small");
    subtitulo.textContent = rutaReordenadaAMano ? "Orden a tu gusto" : "Ruta mínima exacta";
    encabezado.appendChild(subtitulo);

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
    const horas = horasDeLlegadaRuta();
    const verPlata = !window.verPlataVendeFrio || window.verPlataVendeFrio.puedoVer();
    rutaOrdenada.forEach((comercio, indice) => {
        const carga = cargaParaParada(comercio.nombre);
        const hecha = paradaHecha(comercio);
        const saldo = verPlata ? Number(window.saldosVendeFrio?.cuentaDe?.(comercio.nombre)?.total) || 0 : 0;
        const fila = document.createElement("li");
        fila.className = "paradaOrden" + (indice === proxima ? " proxima" : "") + (hecha ? " hecha" : "");
        fila.dataset.nombre = comercio.nombre;
        const chips = [];
        if (carga.pedidos.length) chips.push(`<span class="pzChip pzChipGris sinPunto">${window.icono("paquete", 13)} Lleva ${carga.unidades} u${carga.total && verPlata ? " · " + window.piezas.plata(carga.total) : ""}</span>`);
        if (saldo > 0) chips.push(`<span class="pzChip chipCobrarParada sinPunto">Cobrar ${window.piezas.plata(saldo)}</span>`);
        if (!chips.length) chips.push(`<span class="pzChip pzChipGris sinPunto">Sin pedido para entregar</span>`);
        fila.innerHTML = `<span class="horaParada">${horas[indice]}</span>
            <span class="lineaParada" aria-hidden="true"><span class="numeroParada">${hecha ? window.icono("check", 14) : indice + 1}</span></span>
            <div class="cajaParada">
                <button type="button" class="textoParada pedidoParadaRuta" data-nombre="${window.piezas.esc(comercio.nombre)}" aria-label="Pedido de ${window.piezas.esc(comercio.nombre)}">
                    <strong>${window.piezas.esc(comercio.nombre)}</strong>
                    <small>${window.piezas.esc(comercio.direccion || "Sin dirección")} · ${textoDistanciaCorta(distanciasRuta[indice])}</small>
                    <span class="llevaParada">${chips.join("")}</span>
                </button>
                <span class="agarreParada" role="button" tabindex="0" aria-label="Mover ${window.piezas.esc(comercio.nombre)}. Mantené apretado y arrastrá">${window.icono("menu", 20)}</span>
            </div>`;
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

// Paradas, km, horas y plata a cobrar del día.
function dibujarNumerosParadas() {
    const caja = document.getElementById("numerosParadas");
    if (!caja) return;
    const elegido = rutaOrdenada.length ? recorridoElegidoPlan() : null;
    let paradas = rutaOrdenada.length;
    let km = "—";
    let horas = "—";
    let cobrar = 0;
    const verPlata = !window.verPlataVendeFrio || window.verPlataVendeFrio.puedoVer();
    if (rutaOrdenada.length) {
        const metros = elegido ? elegido.distancia : distanciasRuta.reduce((total, distancia) => total + (Number(distancia) || 0), 0);
        const segundos = elegido ? elegido.duracion : distanciasRuta.reduce((total, distancia) => total + minutosAproximados(distancia), 0) * 60;
        const kilometros = metros / 1000;
        km = kilometros < 10 ? kilometros.toFixed(1).replace(".", ",") : String(Math.round(kilometros));
        const minutos = Math.max(1, Math.round(segundos / 60));
        horas = Math.floor(minutos / 60) + ":" + String(minutos % 60).padStart(2, "0");
        if (verPlata) {
            rutaOrdenada.forEach(comercio => {
                cobrar += cargaParaParada(comercio.nombre).total + (Number(window.saldosVendeFrio?.cuentaDe?.(comercio.nombre)?.total) || 0);
            });
        }
    } else {
        paradas = comerciosActivos().filter(comercio => comerciosSeleccionadosRuta.has(comercio.nombre) && comercioTieneGps(comercio)).length;
    }
    const plata = !verPlata || !rutaOrdenada.length ? "—" : cobrar < 1000 ? String(Math.round(cobrar)) : cobrar < 1e6 ? Math.round(cobrar / 1000) + "k" : (cobrar / 1e6).toFixed(1).replace(".", ",") + "M";
    caja.innerHTML = [[paradas, "Paradas"], [km, "Km"], [horas, "Horas"], [plata, "$ Cobrar"]]
        .map(([valor, nombre]) => `<div class="numeroParadas"><strong>${valor}</strong><small>${nombre}</small></div>`).join("");
}

// Los elegidos sin ubicación no entran a la ruta: «Poner pin» los ubica a mano.
function dibujarSinUbicacionParadas() {
    const caja = document.getElementById("sinUbicacionParadas");
    if (!caja) return;
    const sinUbicacion = comerciosActivos().filter(comercio => comerciosSeleccionadosRuta.has(comercio.nombre) && !comercioTieneGps(comercio));
    caja.classList.toggle("oculto", !sinUbicacion.length);
    if (!sinUbicacion.length) {
        caja.innerHTML = "";
        return;
    }
    caja.innerHTML = `<h3>${window.icono("alerta", 16)} Sin ubicación (${sinUbicacion.length})</h3>` + sinUbicacion.slice(0, 20).map(comercio => {
        const nombre = window.piezas.esc(comercio.nombre);
        return `<div class="filaSinUbicacion"><span><strong>${nombre}</strong><small>${window.piezas.esc(comercio.direccion || "Sin dirección")}</small></span>
            <button type="button" class="pzBtn pzBtnSec" data-poner-pin="${nombre}" aria-label="Poner pin a ${nombre}">${window.icono("ubicacion", 16)} Poner pin</button></div>`;
    }).join("") + (sinUbicacion.length > 20 ? `<p class="ayudaParadas">Y ${sinUbicacion.length - 20} más: buscalos en «Ubicaciones de los comercios».</p>` : "");
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
        refrescarPines();
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
        refrescarPines();
        document.querySelector(`.paradaOrden[data-nombre="${CSS.escape(movido.nombre)}"] .agarreParada`)?.focus();
    });
}

// Carrusel de paradas (T137): arriba de la hoja de la vista previa, una
// tarjeta por parada que falta, empezando por la próxima. Al deslizar, el
// mapa va a ese comercio y su pin se agranda. En el ⋯ de cada tarjeta:
// Hacer pedido o Entregar, Ir con Google Maps, Ya pasé, Ir primero y Sacar
// de la ruta.
let paradaDestacadaRuta = "";
let esperaCarrusel = null;

function dibujarProximaParada() {
    const pantalla = document.getElementById("pantallaRutas");
    if (!pantalla) return;
    let carrusel = document.getElementById("proximaParadaRuta");
    const indice = indiceProximaParada();
    if (!rutaOrdenada.length || navegacionActiva) {
        carrusel?.remove();
        pantalla.classList.remove("conProximaParada");
        destacarPinRuta("");
        return;
    }
    if (!carrusel) {
        carrusel = document.createElement("div");
        carrusel.id = "proximaParadaRuta";
        carrusel.className = "carruselParadas";
        carrusel.setAttribute("role", "region");
        carrusel.setAttribute("aria-label", "Paradas de la ruta");
        carrusel.addEventListener("click", tocarCarruselParadas);
        (pantalla.querySelector(".vistaPreviaRutas") || pantalla).appendChild(carrusel);
        if (window.L?.DomEvent) {
            L.DomEvent.disableClickPropagation(carrusel);
            L.DomEvent.disableScrollPropagation(carrusel);
        }
    }
    pantalla.classList.add("conProximaParada");
    if (indice < 0) {
        carrusel.classList.add("terminada");
        carrusel.innerHTML = `<div class="paradaCarrusel terminada"><strong>${window.icono("check", 18)} Terminaste la ruta</strong><button type="button" class="pzBtn pzBtnGris" data-parada="reiniciar">Empezar de nuevo</button></div>`;
        destacarPinRuta("");
        return;
    }
    carrusel.classList.remove("terminada");
    const horas = horasDeLlegadaRuta();
    const verPlata = !window.verPlataVendeFrio || window.verPlataVendeFrio.puedoVer();
    const tarjetas = [];
    for (let i = indice; i < rutaOrdenada.length; i++) {
        const comercio = rutaOrdenada[i];
        if (paradaHecha(comercio)) continue;
        const carga = cargaParaParada(comercio.nombre);
        const saldo = verPlata ? Number(window.saldosVendeFrio?.cuentaDe?.(comercio.nombre)?.total) || 0 : 0;
        const detalle = [comercio.direccion || "Sin dirección", horas[i]];
        if (carga.pedidos.length) detalle.push("lleva " + carga.unidades + " u");
        if (saldo > 0) detalle.push("cobrar " + window.piezas.plata(saldo));
        const nombre = window.piezas.esc(comercio.nombre);
        tarjetas.push(`<article class="paradaCarrusel${i === indice ? " actual" : ""}" data-nombre="${nombre}" aria-label="Parada ${i + 1} de ${rutaOrdenada.length}: ${nombre}">
            <span class="numeroCarrusel">${i + 1}</span>
            <button type="button" class="datosCarrusel" data-parada="ver"><strong>${nombre}</strong><small>${window.piezas.esc(detalle.filter(Boolean).join(" · "))}</small></button>
            <button type="button" class="masCarrusel" data-parada="opciones" aria-label="Opciones de ${nombre}">${window.icono("puntos", 18)}</button>
        </article>`);
    }
    carrusel.innerHTML = `<div class="pistaCarrusel">${tarjetas.join("")}</div>`;
    const pista = carrusel.firstElementChild;
    pista.addEventListener("scroll", () => {
        clearTimeout(esperaCarrusel);
        esperaCarrusel = setTimeout(() => alDeslizarCarrusel(pista), 120);
    }, { passive: true });
    // La próxima, con su pin grande (sin mover el mapa).
    destacarPinRuta(rutaOrdenada[indice].nombre);
}

// Hora de llegada a cada parada: con el camino por calles si llegó, si no
// con la cuenta aproximada.
function horasDeLlegadaRuta() {
    const tramos = recorridoElegidoPlan()?.tramos;
    let segundos = 0;
    return rutaOrdenada.map((comercio, indice) => {
        segundos += tramos && tramos.length === rutaOrdenada.length ? tramos[indice] : minutosAproximados(distanciasRuta[indice]) * 60;
        const hora = new Date(Date.now() + segundos * 1000);
        return String(hora.getHours()).padStart(2, "0") + ":" + String(hora.getMinutes()).padStart(2, "0");
    });
}

function alDeslizarCarrusel(pista) {
    const centro = pista.scrollLeft + pista.clientWidth / 2;
    let elegida = null;
    let menor = Infinity;
    pista.querySelectorAll(".paradaCarrusel").forEach(tarjeta => {
        const distancia = Math.abs(tarjeta.offsetLeft + tarjeta.offsetWidth / 2 - centro);
        if (distancia < menor) {
            menor = distancia;
            elegida = tarjeta;
        }
    });
    // Pegada al borde izquierdo, la primera.
    if (pista.scrollLeft < 8) elegida = pista.querySelector(".paradaCarrusel");
    if (elegida) irAParadaEnMapa(elegida.dataset.nombre);
}

function irAParadaEnMapa(nombre) {
    if (!nombre || nombre === paradaDestacadaRuta) return;
    destacarPinRuta(nombre);
    const comercio = rutaOrdenada.find(item => item.nombre === nombre);
    if (comercio && mapaLeaflet) mapaLeaflet.panTo([Number(comercio.lat), Number(comercio.lng)], { animate: true, duration: 0.35 });
}

// El pin de la parada de la tarjeta, más grande y arriba de los demás.
function destacarPinRuta(nombre) {
    const anterior = marcadoresPorNombre.get(paradaDestacadaRuta);
    if (anterior) {
        anterior.getElement()?.classList.remove("pinDestacado");
        anterior.setZIndexOffset(0);
    }
    paradaDestacadaRuta = nombre;
    const marcador = marcadoresPorNombre.get(nombre);
    if (marcador) {
        marcador.getElement()?.classList.add("pinDestacado");
        marcador.setZIndexOffset(1000);
    }
}

function tocarCarruselParadas(evento) {
    const boton = evento.target.closest("[data-parada]");
    if (!boton) return;
    const accion = boton.dataset.parada;
    if (accion === "reiniciar") {
        paradasHechasRuta.clear();
        paradasConPedidosRuta.clear();
        pedidosAlArmarRuta = idsDePedidosRuta();
        indicePedidosRuta = null;
        mostrarRutaEnLista();
        return;
    }
    const tarjeta = boton.closest(".paradaCarrusel");
    const nombre = tarjeta?.dataset.nombre;
    if (!nombre) return;
    if (accion === "ver") {
        tarjeta.scrollIntoView({ inline: "start", block: "nearest", behavior: "smooth" });
        irAParadaEnMapa(nombre);
    } else if (accion === "opciones") {
        abrirOpcionesParadaRuta(nombre);
    }
}

function abrirOpcionesParadaRuta(nombre) {
    const indice = rutaOrdenada.findIndex(comercio => comercio.nombre === nombre);
    if (indice < 0 || !window.piezas) return;
    const comercio = rutaOrdenada[indice];
    const p = window.piezas;
    const carga = cargaParaParada(nombre);
    const esLaProxima = indice === indiceProximaParada();
    const caja = p.hoja({
        titulo: nombre,
        sub: "Parada " + (indice + 1) + " de " + rutaOrdenada.length,
        clase: "hojaParadaCarrusel",
        etiqueta: "Opciones de la parada " + nombre,
        html: `<button type="button" class="pzBtn pzBtnPri botonRutaPin" data-carrusel="entregar">${p.ico(carga.pedidos.length ? "check" : "documento", 18)} ${carga.pedidos.length ? "Entregar" : "Hacer pedido"}</button>
            <div class="pzOpciones">
                <button type="button" class="pzOpcion" data-carrusel="ir">${p.ico("navegar", 22)}Ir con Google Maps</button>
                ${esLaProxima ? `<button type="button" class="pzOpcion" data-carrusel="saltear">${p.ico("chevDerecha", 22)}Ya pasé</button>` : `<button type="button" class="pzOpcion" data-carrusel="primero">${p.ico("rayo", 22)}Ir primero</button>`}
                <button type="button" class="pzOpcion pzOpcionPeligro" data-carrusel="sacar">${p.ico("cerrarX", 22)}Sacar de la ruta</button>
            </div>`
    });
    caja.addEventListener("click", evento => {
        const accion = evento.target.closest("[data-carrusel]")?.dataset.carrusel;
        if (!accion) return;
        p.cerrar();
        if (accion === "entregar") {
            const actual = cargaParaParada(nombre);
            if (actual.pedidos.length && window.seguimientoVendeFrio?.abrirPedido?.(actual.pedidos[0].id)) return;
            if (typeof irAPedidoRapido === "function") irAPedidoRapido(nombre);
        } else if (accion === "ir") {
            window.open("https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + Number(comercio.lat) + "," + Number(comercio.lng), "_blank", "noopener");
        } else if (accion === "saltear") {
            paradasHechasRuta.add(nombre);
            mostrarRutaEnLista();
        } else if (accion === "primero") {
            // Pasa adelante de la próxima; las demás siguen en su orden.
            const destino = Math.max(0, indiceProximaParada());
            rutaOrdenada.splice(indice, 1);
            rutaOrdenada.splice(destino, 0, comercio);
            rutaReordenadaAMano = true;
            recalcularDistanciasRuta();
            mostrarRutaEnLista();
            refrescarPines();
        } else if (accion === "sacar") {
            cambiarPinEnRuta(nombre);
            refrescarPines();
        }
    });
}

// -------------------------------------------------
// Vista previa (T136): el mapa ocupa toda la pantalla con el camino entero
// por calles. Arriba, desde dónde y hasta dónde, y cómo se arma el camino
// (Auto o Moto, Sin autopistas); abajo, cuánto tarda, Iniciar y Paradas, y
// las herramientas. Paradas abre la lista con todo lo de antes.
// -------------------------------------------------

const SERVIDOR_CAMINO_RUTAS = "https://routing.openstreetmap.de/routed-car/route/v1/driving/";
const CLAVE_PREFERENCIAS_RUTAS = "vendefrio_preferencias";
// Hasta 2 recorridos: el más rápido y, si es distinto, uno sin autopistas.
let caminoPlanRutas = { clave: "", recorridos: [], recto: false };
let capaCaminoPlan = null;
let esperaCaminoPlan = null;

function preferenciasRutas() {
    try {
        return JSON.parse(localStorage.getItem(CLAVE_PREFERENCIAS_RUTAS)) || {};
    } catch (error) {
        return {};
    }
}

function guardarPreferenciaRutas(campo, valor) {
    const datos = preferenciasRutas();
    datos[campo] = valor;
    try {
        localStorage.setItem(CLAVE_PREFERENCIAS_RUTAS, JSON.stringify(datos));
    } catch (error) {
        // Sin lugar: queda para esta vez.
    }
}

function prepararVistaPreviaRutas() {
    const pantalla = document.getElementById("pantallaRutas");
    const vista = pantalla?.querySelector(".vistaPreviaRutas");
    if (!vista || vista.dataset.listo) return;
    vista.dataset.listo = "1";
    if (window.L?.DomEvent) {
        vista.querySelectorAll(".cabezaRutas, .chipsRutas, .hojaPlanRutas").forEach(caja => {
            L.DomEvent.disableClickPropagation(caja);
            L.DomEvent.disableScrollPropagation(caja);
        });
    }
    vista.querySelector(".cabezaRutas .volverRutas").addEventListener("click", () => mostrarPantalla("mas"));
    vista.querySelectorAll(".chipRutas[data-vehiculo]").forEach(chip => chip.addEventListener("click", () => {
        guardarPreferenciaRutas("vehiculo", chip.dataset.vehiculo);
        dibujarChipsRutas();
    }));
    document.getElementById("chipSinAutopistas").addEventListener("click", () => {
        elegirRecorridoPlan(!preferenciasRutas().sinAutopistas);
    });
    document.getElementById("btnParadasRutas").addEventListener("click", () => abrirPanelParadas());
    document.getElementById("btnElegirRutas").addEventListener("click", () => abrirPanelParadas(".tarjetaSeleccionRuta"));
    document.getElementById("btnGuardadasRutas").addEventListener("click", () => abrirPanelParadas(".tarjetaRutasGuardadas"));
    document.getElementById("btnCerrarParadas").addEventListener("click", cerrarPanelParadas);
    document.getElementById("btnListoParadas").addEventListener("click", cerrarPanelParadas);
    document.getElementById("btnGuardarRutaParadas").addEventListener("click", () => {
        abrirPanelParadas(".tarjetaRutasGuardadas");
        document.getElementById("nombreRutaGuardada")?.focus();
    });
    document.getElementById("btnBuscarParadas").addEventListener("click", () => {
        abrirPanelParadas(".tarjetaSeleccionRuta");
        document.getElementById("buscarSeleccionRuta")?.focus();
    });

    // El alto de la hoja de abajo, para el mapa y la tarjeta de la parada.
    const hoja = vista.querySelector(".hojaPlanRutas");
    const medir = () => pantalla.style.setProperty("--altoHojaPlan", hoja.offsetHeight + "px");
    if (window.ResizeObserver) new ResizeObserver(medir).observe(hoja);
    else medir();
}

// Lo que el mapa deja libre arriba (cabecera y chips) y abajo (hoja y parada).
function margenesMapaRutas() {
    const pantalla = document.getElementById("pantallaRutas");
    const chips = pantalla?.querySelector(".chipsRutas");
    const hoja = pantalla?.querySelector(".hojaPlanRutas");
    const proxima = document.getElementById("proximaParadaRuta");
    const arriba = chips && chips.offsetHeight ? chips.offsetTop + chips.offsetHeight : 0;
    const abajo = (hoja?.offsetHeight || 0) + (proxima?.offsetHeight ? proxima.offsetHeight + 10 : 0);
    return { paddingTopLeft: [30, arriba + 24], paddingBottomRight: [30, abajo + 24] };
}

function abrirPanelParadas(seccion) {
    const pantalla = document.getElementById("pantallaRutas");
    if (!pantalla) return;
    pantalla.classList.add("conParadasAbiertas");
    const panel = pantalla.querySelector(".panelParadasRutas");
    panel.scrollTop = 0;
    const tarjeta = seccion ? panel.querySelector(seccion) : null;
    if (tarjeta) {
        tarjeta.open = true;
        tarjeta.scrollIntoView({ block: "start" });
    }
}

function cerrarPanelParadas() {
    const pantalla = document.getElementById("pantallaRutas");
    if (!pantalla?.classList.contains("conParadasAbiertas")) return;
    pantalla.classList.remove("conParadasAbiertas");
    if (mapaLeaflet) mapaLeaflet.invalidateSize();
}

function dibujarChipsRutas() {
    const preferencias = preferenciasRutas();
    const vehiculo = preferencias.vehiculo || "auto";
    document.querySelectorAll("#pantallaRutas .chipRutas[data-vehiculo]").forEach(chip => {
        const elegido = chip.dataset.vehiculo === vehiculo ? "true" : "false";
        if (chip.getAttribute("aria-pressed") !== elegido) chip.setAttribute("aria-pressed", elegido);
    });
    const sinAutopistas = document.getElementById("chipSinAutopistas");
    if (sinAutopistas) sinAutopistas.setAttribute("aria-pressed", preferencias.sinAutopistas ? "true" : "false");
}

// Arriba, hasta dónde va; abajo, cuánto tarda. Se llama con cada cambio de
// la ruta (no con el GPS): es barato y el camino se pide solo si cambió.
function dibujarVistaPreviaRutas() {
    if (!document.querySelector("#pantallaRutas .vistaPreviaRutas")) return;
    dibujarChipsRutas();
    const destino = document.getElementById("destinoRutas");
    let texto;
    if (rutaOrdenada.length) {
        texto = rutaOrdenada.length + (rutaOrdenada.length === 1 ? " parada" : " paradas") + " · última: " + rutaOrdenada[rutaOrdenada.length - 1].nombre;
    } else {
        // Solo los que tienen ubicación entran a la ruta.
        const elegidos = comerciosActivos().filter(comercio => comerciosSeleccionadosRuta.has(comercio.nombre) && comercioTieneGps(comercio)).length;
        texto = elegidos ? elegidos + (elegidos === 1 ? " parada elegida" : " paradas elegidas") : "Elegí los comercios de la ruta";
    }
    if (destino && destino.textContent !== texto) destino.textContent = texto;
    pedirCaminoPlan();
    dibujarResumenPlan();
}

function pedirCaminoPlan() {
    clearTimeout(esperaCaminoPlan);
    esperaCaminoPlan = setTimeout(calcularCaminoPlan, 250);
}

function puntosCaminoPlan() {
    if (!rutaOrdenada.length || !inicioRutaCalculada) return [];
    return [inicioRutaCalculada, ...rutaOrdenada.map(comercio => ({ lat: Number(comercio.lat), lng: Number(comercio.lng) }))];
}

async function pedirRecorridoPlan(puntos, sinAutopistas) {
    const url = SERVIDOR_CAMINO_RUTAS + puntos.map(punto => punto.lng + "," + punto.lat).join(";") +
        "?overview=simplified&geometries=geojson" + (sinAutopistas ? "&exclude=motorway" : "");
    try {
        const respuesta = await fetch(url);
        if (!respuesta.ok) return null;
        const datos = await respuesta.json();
        const ruta = datos && Array.isArray(datos.routes) ? datos.routes[0] : null;
        if (!ruta || !ruta.geometry || !Array.isArray(ruta.geometry.coordinates)) return null;
        return {
            sinAutopistas,
            puntos: ruta.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
            distancia: Number(ruta.distance) || 0,
            duracion: Number(ruta.duration) || 0,
            // Cuánto tarda cada tramo, para la hora de cada parada (T137).
            tramos: Array.isArray(ruta.legs) ? ruta.legs.map(tramo => Number(tramo.duration) || 0) : []
        };
    } catch (error) {
        return null;
    }
}

async function calcularCaminoPlan() {
    const puntos = puntosCaminoPlan();
    const clave = puntos.map(punto => punto.lat + "," + punto.lng).join(";");
    if (clave === caminoPlanRutas.clave) {
        dibujarCaminoPlan();
        return;
    }
    // Mientras llega el camino por calles, una línea recta entre las paradas.
    caminoPlanRutas = { clave, recorridos: [], recto: puntos.length > 1 };
    dibujarCaminoPlan();
    dibujarResumenPlan();
    if (puntos.length < 2) return;
    // La ruta nueva entera a la vista, entre la cabecera y la hoja.
    if (mapaLeaflet) mapaLeaflet.fitBounds(L.latLngBounds(puntos.map(punto => [punto.lat, punto.lng])), margenesMapaRutas());
    const [rapido, sinAutopistas] = await Promise.all([pedirRecorridoPlan(puntos, false), pedirRecorridoPlan(puntos, true)]);
    if (clave !== caminoPlanRutas.clave) return;
    const recorridos = [rapido, sinAutopistas].filter(Boolean);
    // Si los dos son casi iguales, se muestra uno solo.
    if (rapido && sinAutopistas && Math.abs(rapido.distancia - sinAutopistas.distancia) <= rapido.distancia * 0.01) recorridos.pop();
    caminoPlanRutas = { clave, recorridos, recto: !recorridos.length };
    dibujarCaminoPlan();
    dibujarResumenPlan();
    dibujarProximaParada();
    dibujarNumerosParadas();
    actualizarHorasParadas();
}

// Con el camino por calles, la hora de cada parada de la lista (sin rearmarla).
function actualizarHorasParadas() {
    const horas = horasDeLlegadaRuta();
    document.querySelectorAll("#listaRutaOrdenada .paradaOrden .horaParada").forEach((hora, indice) => {
        if (horas[indice] && hora.textContent !== horas[indice]) hora.textContent = horas[indice];
    });
}

// El recorrido elegido: el sin autopistas si está pedido y existe.
function recorridoElegidoPlan() {
    const recorridos = caminoPlanRutas.recorridos;
    if (!recorridos.length) return null;
    const quiere = Boolean(preferenciasRutas().sinAutopistas);
    return recorridos.find(recorrido => recorrido.sinAutopistas === quiere) || recorridos[0];
}

function elegirRecorridoPlan(sinAutopistas) {
    guardarPreferenciaRutas("sinAutopistas", Boolean(sinAutopistas));
    dibujarChipsRutas();
    dibujarCaminoPlan();
    dibujarResumenPlan();
    dibujarProximaParada();
    dibujarNumerosParadas();
    actualizarHorasParadas();
}

function textoMinutosPlan(segundos) {
    const minutos = Math.max(1, Math.round(segundos / 60));
    if (minutos < 60) return minutos + " min";
    return Math.floor(minutos / 60) + " h " + String(minutos % 60).padStart(2, "0") + " min";
}

function dibujarCaminoPlan() {
    if (!mapaLeaflet || typeof L === "undefined") return;
    if (capaCaminoPlan) capaCaminoPlan.clearLayers();
    else capaCaminoPlan = L.layerGroup().addTo(mapaLeaflet);
    const puntos = puntosCaminoPlan();
    if (puntos.length < 2) return;
    const yo = L.circleMarker([puntos[0].lat, puntos[0].lng], { className: "yoPlanRutas", radius: 9, weight: 4, opacity: 1, fillOpacity: 1, interactive: false }).addTo(capaCaminoPlan);
    if (caminoPlanRutas.recto || !caminoPlanRutas.recorridos.length) {
        L.polyline(puntos.map(punto => [punto.lat, punto.lng]), { className: "caminoPlan recto", color: "#1F5FE0", weight: 5, opacity: 0.9, dashArray: "2 10", lineCap: "round", interactive: false }).addTo(capaCaminoPlan);
        yo.bringToFront();
        return;
    }
    const elegido = recorridoElegidoPlan();
    const otros = caminoPlanRutas.recorridos.filter(recorrido => recorrido !== elegido);
    otros.forEach(recorrido => {
        const linea = L.polyline(recorrido.puntos, { className: "caminoPlan otro", color: "#A9B8CC", weight: 8, opacity: 1, lineCap: "round", lineJoin: "round" }).addTo(capaCaminoPlan);
        linea.on("click", () => elegirRecorridoPlan(recorrido.sinAutopistas));
    });
    L.polyline(elegido.puntos, { className: "caminoPlan borde", color: "#0F3E9E", weight: 12, opacity: 1, lineCap: "round", lineJoin: "round", interactive: false }).addTo(capaCaminoPlan);
    L.polyline(elegido.puntos, { className: "caminoPlan elegido", color: "#1F5FE0", weight: 8, opacity: 1, lineCap: "round", lineJoin: "round", interactive: false }).addTo(capaCaminoPlan);
    yo.bringToFront();
    // Con dos recorridos, cada uno con su cartelito de minutos para elegirlo.
    if (!otros.length) return;
    caminoPlanRutas.recorridos.forEach(recorrido => {
        const otro = caminoPlanRutas.recorridos.find(item => item !== recorrido);
        const medio = puntoParaEtiquetaPlan(recorrido.puntos, otro ? otro.puntos : []);
        const nombre = recorrido.sinAutopistas ? "Sin autopistas" : "Más rápida";
        const icono = L.divIcon({
            className: "etiquetaCaminoPlan" + (recorrido === elegido ? " elegida" : ""),
            html: `<div class="globoEtiquetaPlan"><span>${textoMinutosPlan(recorrido.duracion)}</span><small>${nombre}</small></div>`,
            iconSize: [0, 0]
        });
        L.marker(medio, { icon: icono, keyboard: true, title: nombre + ", " + textoMinutosPlan(recorrido.duracion), zIndexOffset: 500 })
            .on("click", () => elegirRecorridoPlan(recorrido.sinAutopistas))
            .addTo(capaCaminoPlan);
    });
}

// Donde el cartelito de un recorrido no se confunde con el otro: el punto
// más lejos del otro camino (mirando hasta 60 puntos de cada uno).
function puntoParaEtiquetaPlan(puntos, otros) {
    const muestra = lista => {
        const paso = Math.max(1, Math.floor(lista.length / 60));
        return lista.filter((punto, indice) => indice % paso === 0);
    };
    const propios = muestra(puntos);
    const ajenos = muestra(otros);
    if (!ajenos.length) return propios[Math.floor(propios.length / 2)];
    let mejor = propios[Math.floor(propios.length / 2)];
    let lejos = -1;
    propios.forEach(punto => {
        let cerca = Infinity;
        ajenos.forEach(ajeno => {
            const d = (punto[0] - ajeno[0]) ** 2 + (punto[1] - ajeno[1]) ** 2;
            if (d < cerca) cerca = d;
        });
        if (cerca > lejos) {
            lejos = cerca;
            mejor = punto;
        }
    });
    return mejor;
}

// Abajo: «48 min (23 km) · terminás 11:02». Sin camino por calles, la cuenta
// aproximada de la lista.
function dibujarResumenPlan() {
    const minutos = document.getElementById("minutosPlanRutas");
    const detalle = document.getElementById("detallePlanRutas");
    if (!minutos || !detalle) return;
    let textoMinutos = "";
    let textoDetalle = "Elegí los comercios y tocá Optimizar.";
    if (rutaOrdenada.length) {
        const elegido = recorridoElegidoPlan();
        const segundos = elegido ? elegido.duracion : distanciasRuta.reduce((total, metros) => total + minutosAproximados(metros), 0) * 60;
        const metros = elegido ? elegido.distancia : distanciasRuta.reduce((total, distancia) => total + (Number(distancia) || 0), 0);
        const fin = new Date(Date.now() + segundos * 1000);
        textoMinutos = (elegido ? "" : "unos ") + textoMinutosPlan(segundos);
        textoDetalle = "(" + formatearDistanciaTotal(metros).replace(" totales", "") + ") · terminás " +
            String(fin.getHours()).padStart(2, "0") + ":" + String(fin.getMinutes()).padStart(2, "0");
    }
    if (minutos.textContent !== textoMinutos) minutos.textContent = textoMinutos;
    if (detalle.textContent !== textoDetalle) detalle.textContent = textoDetalle;
    document.getElementById("btnNavegarRuta")?.classList.toggle("sinRuta", !rutaOrdenada.length);
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

    if (boton.id === "btnOptimizarRuta" || boton.id === "btnOptimizarOrden") {
        optimizarRuta();
        return;
    }

    if (boton.dataset.ponerPin) {
        const select = document.getElementById("selectComercioGps");
        if (select) select.value = boton.dataset.ponerPin;
        activarModoPinManual();
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
