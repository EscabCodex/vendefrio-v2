// =====================================================
// VendeFrío - rutas.js
// El mapa con los pines y la ruta del día (repaso de Rutas, 2026-11-02):
// arriba, cómo y desde dónde salís; abajo, «Armar ruta» o la ruta armada
// con Iniciar, Paradas y ⋯. Cada pin y cada parada abren su menú.
// =====================================================

let mapaLeaflet = null;
let capaMarcadores = null;
let rutaOrdenada = [];
let distanciasRuta = [];
// Del último comercio al lugar de la vuelta (0 si termina en la última parada).
let distanciaVueltaRuta = 0;
// Elegidos sin GPS en la última ruta armada (salen al pie de la hoja de reparto, T28e).
let comerciosSinGpsRuta = [];
// Los pines marcados en el mapa (y, con la ruta armada, sus paradas).
let comerciosSeleccionadosRuta = new Set();
let marcadoresPorNombre = new Map();
// Poner o mover el pin de un comercio a mano.
let nombrePinEnEdicion = "";
let marcadorPinManual = null;
let coordenadasPinPendientes = null;
let coordenadasPinOriginales = null;
let tipoEdicionPin = "nuevo";
// Lo que hace el próximo toque en el mapa (poner un pin, marcar el depósito).
let alTocarMapaRuta = null;
// La ruta guardada de la que salió la ruta de hoy (para volver a guardarla).
let rutaGuardadaActual = null;
let marcadorYoRutas = null;

const LATITUD_POR_DEFECTO = -34.6185;
const LONGITUD_POR_DEFECTO = -58.6382;

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

function inicializarPantallaRutas() {
    // Rutas abre siempre en el mapa (T136); la lista se abre con «Paradas».
    document.getElementById("pantallaRutas")?.classList.remove("conParadasAbiertas");
    // Sin ruta armada, los pines arrancan destildados (repaso de Rutas).
    if (!rutaOrdenada.length) comerciosSeleccionadosRuta.clear();
    quitarComerciosQueYaNoEstan();
    iniciarMapa();
    prepararVistaPreviaRutas();
    renderizarPines();
    mostrarRutaEnLista();
}

function quitarComerciosQueYaNoEstan() {
    const nombres = new Set(comerciosActivosParaLeer().map(comercio => comercio.nombre));
    comerciosSeleccionadosRuta.forEach(nombre => {
        if (!nombres.has(nombre)) comerciosSeleccionadosRuta.delete(nombre);
    });
}

// Cambiaron los comercios o las rutas guardadas en la nube: si Rutas está a
// la vista, se redibuja (los pines y la hoja de abajo).
function refrescarRutasDesdeNube() {
    const pantalla = document.getElementById("pantallaRutas");
    if (!pantalla || pantalla.classList.contains("oculto")) return;
    quitarComerciosQueYaNoEstan();
    refrescarPines();
    mostrarRutaEnLista();
}

function iniciarNavegacionRuta() {
    if (!rutaOrdenada.length) {
        abrirArmarRuta();
        return;
    }
    const nombres = rutaOrdenada.map(parada => parada.nombre);
    if (!window.navegacionVendeFrio?.abrir?.(nombres)) {
        mostrarAviso("No se pudo navegar", "Las paradas necesitan su ubicación GPS. Si elegiste Google Maps en Más, usá «Abrir en Google Maps» del ⋯.");
    }
}

// -------------------------------------------------
// Rutas guardadas
// -------------------------------------------------

function buscarRutaGuardadaPorNombre(nombre, rutas = rutasGuardadasParaLeer()) {
    if (!nombre) return null;
    return rutas.find(ruta => {
        return normalizarTexto(ruta.nombre) === normalizarTexto(nombre);
    }) || null;
}

// Guarda una ruta registro por registro. Si se está editando una ruta
// (nombreOriginal), se actualiza la misma y conserva su id aunque cambie
// el nombre. Si el nombre ya es de otra ruta, esa otra se reemplaza y la
// editada se borra, igual que antes.
function guardarRutaRegistro(nombreOriginal, nombre, comercios, dia) {
    const rutas = rutasGuardadasParaLeer();
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

// Se borra y queda «Deshacer» unos segundos (Etapa 8).
function borrarRutaGuardada(nombre, alCambiar) {
    const rutasAntes = obtenerRutasGuardadas();
    const ruta = buscarRutaGuardadaPorNombre(nombre);
    if (!ruta || !eliminarRutaPorId(ruta.id)) return;
    if (rutaGuardadaActual && rutaGuardadaActual.id === ruta.id) rutaGuardadaActual = null;
    if (typeof alCambiar === "function") alCambiar();
    window.piezas.deshacer("Ruta «" + ruta.nombre + "» borrada", () => {
        if (buscarRutaGuardadaPorNombre(ruta.nombre)) return;
        guardarRutasGuardadas(rutasAntes);
        if (typeof alCambiar === "function") alCambiar();
    });
}

// -------------------------------------------------
// Pines marcados
// -------------------------------------------------

function obtenerComerciosSeleccionRuta() {
    return comerciosActivosOrdenadosParaLeer().slice();
}

function obtenerComerciosElegidosParaRuta() {
    return obtenerComerciosSeleccionRuta().filter(comercio => {
        return comerciosSeleccionadosRuta.has(comercio.nombre);
    });
}

// Desmarca todo y vacía la ruta.
function limpiarSeleccionRuta() {
    comerciosSeleccionadosRuta.clear();
    rutaOrdenada = [];
    distanciasRuta = [];
    distanciaVueltaRuta = 0;
    rutaGuardadaActual = null;
    refrescarPines();
    mostrarRutaEnLista();
}

// «Vaciar la ruta» del ⋯, con «Deshacer».
function vaciarRuta() {
    const antes = {
        seleccion: new Set(comerciosSeleccionadosRuta),
        ruta: rutaOrdenada.slice(),
        distancias: distanciasRuta.slice(),
        vuelta: distanciaVueltaRuta,
        guardada: rutaGuardadaActual,
        aMano: rutaReordenadaAMano
    };
    limpiarSeleccionRuta();
    window.piezas.deshacer("Vaciaste la ruta", () => {
        comerciosSeleccionadosRuta = antes.seleccion;
        rutaOrdenada = antes.ruta;
        distanciasRuta = antes.distancias;
        distanciaVueltaRuta = antes.vuelta;
        rutaGuardadaActual = antes.guardada;
        rutaReordenadaAMano = antes.aMano;
        refrescarPines();
        mostrarRutaEnLista();
    });
}

// Busca el comercio por nombre y lo guarda por su id.
function actualizarComercioPorNombre(nombre, datos) {
    const comercio = buscarComercioPorNombre(nombre);
    return comercio ? actualizarComercioPorId(comercio.id, datos) : false;
}

// -------------------------------------------------
// El mapa
// -------------------------------------------------

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
            "No se pudo cargar el mapa. Revisá tu conexión a internet."
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
    mapaLeaflet.on("click", alTocarMapa);
}

// El próximo toque en el mapa elige un lugar: el pin de un comercio o el
// depósito. Mientras tanto, abajo queda una barra con «Cancelar».
function esperarToqueMapa(texto, alTocar) {
    if (!mapaLeaflet) return;
    cerrarPanelParadas();
    alTocarMapaRuta = alTocar;
    mapaLeaflet.getContainer().style.cursor = "crosshair";
    barraMapaRutas(texto, [{ id: "cancelarToqueMapa", texto: "Cancelar", clase: "pzBtnGris", alTocar: terminarToqueMapa }]);
}

function terminarToqueMapa() {
    alTocarMapaRuta = null;
    if (mapaLeaflet) mapaLeaflet.getContainer().style.cursor = "";
    ocultarBarraMapaRutas();
}

function alTocarMapa(evento) {
    if (!alTocarMapaRuta) return;
    const accion = alTocarMapaRuta;
    terminarToqueMapa();
    accion({ lat: Number(evento.latlng.lat.toFixed(7)), lng: Number(evento.latlng.lng.toFixed(7)) });
}

// La barra de abajo del mapa (mover un pin, marcar un lugar). El texto ya
// viene escapado.
function barraMapaRutas(texto, botones) {
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
    barra.innerHTML = `<small>${texto}</small><div>${botones.map((boton, indice) => `<button type="button" class="pzBtn ${boton.clase}" id="${boton.id}" data-i="${indice}">${window.piezas.esc(boton.texto)}</button>`).join("")}</div>`;
    barra.classList.remove("oculto");
    barra.querySelectorAll("button").forEach(boton => {
        boton.onclick = () => botones[Number(boton.dataset.i)].alTocar();
    });
}

function ocultarBarraMapaRutas() {
    document.getElementById("barraMoverPin")?.classList.add("oculto");
}

// «Ver dónde estoy»: el mapa va a tu posición con un punto.
function centrarEnMiRutas() {
    if (!navigator.geolocation || !mapaLeaflet) {
        if (typeof mostrarToast === "function") mostrarToast("Este celular no deja saber dónde estás");
        return;
    }
    navigator.geolocation.getCurrentPosition(posicion => {
        const lugar = [posicion.coords.latitude, posicion.coords.longitude];
        if (marcadorYoRutas) marcadorYoRutas.setLatLng(lugar);
        else marcadorYoRutas = L.circleMarker(lugar, { className: "yoPlanRutas", radius: 9, weight: 4, opacity: 1, fillOpacity: 1, interactive: false }).addTo(mapaLeaflet);
        mapaLeaflet.setView(lugar, Math.max(mapaLeaflet.getZoom(), 15));
    }, () => {
        if (typeof mostrarToast === "function") mostrarToast("Prendé el GPS para ver dónde estás");
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
}

// -------------------------------------------------
// Poner o mover el pin de un comercio
// -------------------------------------------------

// Un comercio sin ubicación: se toca el mapa donde está y después se
// puede arrastrar el pin antes de guardarlo.
function ponerPinAMano(nombre) {
    if (!nombre || !mapaLeaflet) return;
    cancelarEdicionPin();
    esperarToqueMapa("Tocá en el mapa dónde está <b>" + window.piezas.esc(nombre) + "</b>", punto => {
        nombrePinEnEdicion = nombre;
        coordenadasPinPendientes = punto;
        coordenadasPinOriginales = null;
        tipoEdicionPin = "nuevo";
        marcadorPinManual = L.marker([punto.lat, punto.lng], { draggable: true }).addTo(mapaLeaflet);
        marcadorPinManual.on("dragend", manejarArrastrePinGuardado);
        mostrarBarraMoverPin(nombre);
    });
}

// Mover el pin desde el mapa: se arrastra y se guarda con la barra de abajo.
function moverPinDesdeMapa(nombre) {
    const marcador = marcadoresPorNombre.get(nombre);
    if (!marcador || !mapaLeaflet) return;
    cancelarEdicionPin();
    const posicion = marcador.getLatLng();
    nombrePinEnEdicion = nombre;
    marcadorPinManual = marcador;
    coordenadasPinOriginales = { lat: Number(posicion.lat.toFixed(7)), lng: Number(posicion.lng.toFixed(7)) };
    coordenadasPinPendientes = { ...coordenadasPinOriginales };
    tipoEdicionPin = "existente";
    if (marcador.dragging) marcador.dragging.enable();
    marcador.off("dragend", manejarArrastrePinGuardado);
    marcador.on("dragend", manejarArrastrePinGuardado);
    mostrarBarraMoverPin(nombre);
    // El pin queda en el centro, un poco arriba, para que la barra no lo tape.
    mapaLeaflet.setView(posicion, Math.max(mapaLeaflet.getZoom(), 16), { animate: false });
    mapaLeaflet.panBy([0, 50], { animate: false });
}

function manejarArrastrePinGuardado(evento) {
    const posicion = evento.target.getLatLng();
    coordenadasPinPendientes = {
        lat: Number(posicion.lat.toFixed(7)),
        lng: Number(posicion.lng.toFixed(7))
    };
}

function mostrarBarraMoverPin(nombre) {
    barraMapaRutas("Arrastrá el pin de <b>" + window.piezas.esc(nombre) + "</b> al lugar justo", [
        { id: "cancelarMoverPin", texto: "Cancelar", clase: "pzBtnGris", alTocar: cancelarEdicionPin },
        { id: "guardarMoverPin", texto: "Guardar", clase: "pzBtnPri", alTocar: guardarPinManual }
    ]);
}

function terminarEdicionPin() {
    if (tipoEdicionPin === "existente" && marcadorPinManual?.dragging) marcadorPinManual.dragging.disable();
    nombrePinEnEdicion = "";
    marcadorPinManual = null;
    coordenadasPinPendientes = null;
    coordenadasPinOriginales = null;
    tipoEdicionPin = "nuevo";
    ocultarBarraMapaRutas();
}

function cancelarEdicionPin() {
    if (!nombrePinEnEdicion && !alTocarMapaRuta) return;
    if (alTocarMapaRuta) terminarToqueMapa();
    if (tipoEdicionPin === "existente" && marcadorPinManual && coordenadasPinOriginales) {
        marcadorPinManual.setLatLng([coordenadasPinOriginales.lat, coordenadasPinOriginales.lng]);
    } else if (tipoEdicionPin === "nuevo" && marcadorPinManual && mapaLeaflet) {
        mapaLeaflet.removeLayer(marcadorPinManual);
    }
    terminarEdicionPin();
}

function guardarPinManual() {
    const nombre = nombrePinEnEdicion;
    if (!nombre || !coordenadasPinPendientes) return;

    const guardado = actualizarComercioPorNombre(nombre, {
        lat: coordenadasPinPendientes.lat,
        lng: coordenadasPinPendientes.lng,
        origenGps: "manual"
    });

    if (!guardado) {
        mostrarAviso("No se pudo guardar", "No se encontró el comercio.");
        return;
    }

    if (tipoEdicionPin === "nuevo" && marcadorPinManual && mapaLeaflet) mapaLeaflet.removeLayer(marcadorPinManual);
    terminarEdicionPin();
    // Si está en la ruta, su lugar nuevo cambia las distancias.
    if (rutaOrdenada.some(comercio => comercio.nombre === nombre)) {
        rutaOrdenada = rutaOrdenada.map(comercio => (comercio.nombre === nombre ? buscarComercioPorNombre(nombre) || comercio : comercio));
        recalcularDistanciasRuta();
    }
    renderizarPines(false);
    mostrarRutaEnLista();
    if (typeof mostrarToast === "function") mostrarToast("Ubicación de " + nombre + " guardada");
    if (typeof actualizarDashboard === "function") actualizarDashboard();
}

// Se borra y queda «Deshacer» unos segundos (Etapa 8). Sin ubicación, sale
// de la ruta armada.
function borrarUbicacionComercio(nombre) {
    const comercio = buscarComercioPorNombre(nombre);
    if (!comercio || !comercioTieneGps(comercio)) return;
    const lugar = { lat: comercio.lat, lng: comercio.lng, origenGps: comercio.origenGps || "" };
    const redibujar = () => {
        renderizarPines(false);
        mostrarRutaEnLista();
        if (typeof actualizarDashboard === "function") actualizarDashboard();
    };
    if (!actualizarComercioPorNombre(nombre, { lat: "", lng: "" })) {
        mostrarAviso("No se pudo borrar", "No se encontró el comercio.");
        return;
    }
    if (rutaOrdenada.some(parada => parada.nombre === nombre)) {
        rutaOrdenada = rutaOrdenada.filter(parada => parada.nombre !== nombre);
        recalcularDistanciasRuta();
    }
    redibujar();
    window.piezas.deshacer("Ubicación de " + nombre + " borrada", () => {
        actualizarComercioPorNombre(nombre, lugar);
        redibujar();
    });
}

// -------------------------------------------------
// Pines (T123): azul con número si el comercio está en la ruta, con tilde
// si está marcado y gris si no. Tocar un pin abre su menú.
// -------------------------------------------------
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

    const comerciosConGps = comerciosActivosParaLeer().filter(comercioTieneGps);
    if (comerciosConGps.length === 0) return;

    const limites = L.latLngBounds();

    comerciosConGps.forEach(comercio => {
        const coordenadas = [Number(comercio.lat), Number(comercio.lng)];
        const marcador = L.marker(coordenadas, {
            icon: iconoPinRuta(comercio),
            title: comercio.nombre,
            alt: comercio.nombre,
            keyboard: true
        });
        marcador.on("click", () => {
            // Mientras se mueve este pin, tocarlo no abre nada.
            if (marcadorPinManual === marcador && coordenadasPinPendientes) return;
            abrirMenuPin(comercio.nombre);
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

// T141: al marcar, ordenar o sacar una parada no se rearman los 80 pines
// (en un celular barato el mapa se trababa): se cambia solo el dibujo de los
// que cambiaron. Si hay comercios nuevos, movidos o un pin en edición, se
// rearman todos como antes.
function refrescarPines() {
    if (!mapaLeaflet || !capaMarcadores) return;
    const comerciosConGps = comerciosActivosParaLeer().filter(comercioTieneGps);
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
    destacarPinRuta(paradaDestacadaRuta);
}

// "+ Agregar dirección" (y otros datos que falten) en Rutas: abre la hoja
// "Datos del comercio" en ese dato y, al guardar, se redibuja la ruta.
function textoAgregarDato(nombre, campo, texto) {
    return `<span class="agregarDatoRuta" data-agregar-dato="${campo}" data-nombre="${window.piezas.esc(nombre)}">${window.icono("mas", 13)} ${texto}</span>`;
}

function agregarDatoEnRuta(nombre, campo, alGuardar) {
    if (typeof window.abrirDatosComercio !== "function") return false;
    window.abrirDatosComercio(nombre, campo, nombreFinal => {
        const nuevo = nombreFinal || nombre;
        if (nuevo !== nombre && comerciosSeleccionadosRuta.delete(nombre)) comerciosSeleccionadosRuta.add(nuevo);
        rutaOrdenada = rutaOrdenada.map(comercio => buscarComercioPorNombre(comercio.nombre === nombre ? nuevo : comercio.nombre) || comercio);
        refrescarPines();
        mostrarRutaEnLista();
        if (typeof alGuardar === "function") alGuardar(nuevo);
    });
    return true;
}

// Va antes que el toque de la parada (la línea está adentro de su botón).
document.addEventListener("click", evento => {
    const dato = evento.target.closest?.("[data-agregar-dato]");
    if (!dato || !dato.closest("#pantallaRutas")) return;
    evento.preventDefault();
    evento.stopPropagation();
    agregarDatoEnRuta(dato.dataset.nombre, dato.dataset.agregarDato);
}, true);

// Los datos que le faltan a un comercio, para el «+ Agregar …» de los menús.
function datosQueFaltanRuta(comercio) {
    if (typeof window.abrirDatosComercio !== "function") return [];
    return [["telefono", "Agregar teléfono"], ["direccion", "Agregar dirección"]]
        .filter(([campo]) => !String(comercio[campo] || "").trim());
}

function irConGoogleMaps(comercio) {
    window.open("https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + Number(comercio.lat) + "," + Number(comercio.lng), "_blank", "noopener");
}

// El menú del pin (repaso de Rutas, imagen 6).
function abrirMenuPin(nombre) {
    const comercio = buscarComercioPorNombre(nombre);
    if (!comercio || !window.piezas?.menu) return;
    const p = window.piezas;
    const marcado = comerciosSeleccionadosRuta.has(nombre);
    const orden = rutaOrdenada.findIndex(item => item.nombre === nombre);
    const armada = rutaOrdenada.length > 0;
    const estado = orden >= 0 ? "Parada " + (orden + 1) : marcado ? "Marcado para la ruta" : "";
    const ancla = marcadoresPorNombre.get(nombre)?.getElement() || document.getElementById("mapaRuta");
    const textoMarcar = marcado ? (armada && orden >= 0 ? "Sacar de la ruta" : "Desmarcar") : (armada ? "Sumar a la ruta" : "Marcar para la ruta");
    p.menu(ancla, {
        titulo: nombre,
        sub: [estado, comercio.direccion || ""].filter(Boolean).join(" · "),
        clase: "menuPinRuta",
        items: [
            { icono: marcado ? "cerrarX" : "check", texto: textoMarcar, principal: !marcado, alTocar: () => cambiarPinEnRuta(nombre) },
            { icono: "tienda", texto: "Ver la ficha", alTocar: () => window.abrirFichaComercio?.(nombre) },
            typeof irAPedidoRapido === "function" ? { icono: "documento", texto: "Hacer pedido", alTocar: () => irAPedidoRapido(nombre) } : null,
            { icono: "navegar", texto: "Ir", alTocar: () => irConGoogleMaps(comercio) },
            { icono: "ubicacion", texto: "Mover el pin", alTocar: () => moverPinDesdeMapa(nombre) },
            ...datosQueFaltanRuta(comercio).map(([campo, texto]) => ({ icono: "mas", tono: "aviso", texto, alTocar: () => agregarDatoEnRuta(nombre, campo) })),
            "-",
            { icono: "tacho", texto: "Borrar la ubicación", peligro: true, alTocar: () => borrarUbicacionComercio(nombre) }
        ]
    });
}

// Marca o desmarca un pin. Con la ruta armada, lo suma de paso (donde menos
// se desvía) o lo saca; las demás paradas siguen en su orden.
function cambiarPinEnRuta(nombre) {
    const sumar = !comerciosSeleccionadosRuta.has(nombre);
    if (sumar) comerciosSeleccionadosRuta.add(nombre);
    else comerciosSeleccionadosRuta.delete(nombre);
    let dePaso = null;
    if (rutaOrdenada.length) {
        if (!sumar) {
            rutaOrdenada = rutaOrdenada.filter(comercio => comercio.nombre !== nombre);
            recalcularDistanciasRuta();
        } else {
            const comercio = buscarComercioPorNombre(nombre);
            if (comercio && comercioTieneGps(comercio)) dePaso = sumarParadaDePaso(comercio);
        }
    }
    refrescarPines();
    mostrarRutaEnLista();
    if (typeof mostrarToast !== "function") return;
    if (dePaso) mostrarToast("Sumaste " + nombre + " de paso, como parada " + (dePaso.posicion + 1));
    else if (rutaOrdenada.length && !sumar) mostrarToast("Sacaste " + nombre + " de la ruta");
    else {
        const cuantos = comerciosSeleccionadosRuta.size;
        mostrarToast((sumar ? "Marcaste " : "Desmarcaste ") + nombre + " (" + cuantos + (cuantos === 1 ? " marcado)" : " marcados)"));
    }
}

// Dónde se desvía menos para pasar por un comercio más, sin tocar las
// paradas que ya pasaste: { posicion, metros } (los metros de más).
function costoDePaso(comercio) {
    const desde = Math.max(0, indiceProximaParada() < 0 ? rutaOrdenada.length : indiceProximaParada());
    const fin = puntoVueltaRuta();
    const punto = lugar => [Number(lugar.lat), Number(lugar.lng)];
    const distancia = (a, b) => (a && b ? calcularDistancia(...punto(a), ...punto(b)) : 0);
    let mejor = null;
    for (let posicion = desde; posicion <= rutaOrdenada.length; posicion += 1) {
        const antes = posicion === 0 ? inicioRutaCalculada : rutaOrdenada[posicion - 1];
        const despues = posicion === rutaOrdenada.length ? fin : rutaOrdenada[posicion];
        const metros = distancia(antes, comercio) + distancia(comercio, despues) - distancia(antes, despues);
        if (!mejor || metros < mejor.metros) mejor = { posicion, metros };
    }
    return mejor || { posicion: rutaOrdenada.length, metros: 0 };
}

function sumarParadaDePaso(comercio) {
    const lugar = costoDePaso(comercio);
    rutaOrdenada.splice(lugar.posicion, 0, comercio);
    recalcularDistanciasRuta();
    return lugar;
}

// -------------------------------------------------
// Salida y vuelta (repaso de Rutas): desde donde estás, el depósito, tu
// casa u otra dirección. Los lugares se guardan en este celular.
// -------------------------------------------------
const LUGARES_RUTAS = {
    deposito: { nombre: "El depósito", desde: "Desde el depósito", de: "del depósito", a: "al depósito", icono: "tienda", agregar: "Agregar el depósito", cambiar: "Cambiar el lugar del depósito", titulo: "Dónde está el depósito" },
    casa: { nombre: "Mi casa", desde: "Desde tu casa", de: "de tu casa", a: "a tu casa", icono: "casa", agregar: "Agregar mi casa", cambiar: "Cambiar el lugar de tu casa", titulo: "Dónde está tu casa" },
    otra: { nombre: "Otra dirección", desde: "Desde otra dirección", de: "de otra dirección", a: "a otra dirección", icono: "ubicacion", agregar: "Otra dirección", cambiar: "Cambiar la otra dirección", titulo: "Otra dirección" }
};

function lugaresRutas() {
    return preferenciasRutas().lugares || {};
}

function lugarGuardadoRutas(clave) {
    const lugar = lugaresRutas()[clave];
    if (!lugar || lugar.lat === "" || lugar.lat == null || lugar.lng === "" || lugar.lng == null) return null;
    return Number.isFinite(Number(lugar.lat)) && Number.isFinite(Number(lugar.lng)) ? lugar : null;
}

function salidaRutas() {
    const salida = preferenciasRutas().salida || "yo";
    return salida === "yo" || lugarGuardadoRutas(salida) ? salida : "yo";
}

function vueltaRutas() {
    const vuelta = preferenciasRutas().vuelta || "ninguno";
    return vuelta === "ninguno" || lugarGuardadoRutas(vuelta) ? vuelta : "ninguno";
}

function puntoVueltaRuta() {
    const lugar = lugarGuardadoRutas(vueltaRutas());
    return lugar ? { lat: Number(lugar.lat), lng: Number(lugar.lng) } : null;
}

function textoSalidaRutas(corto) {
    const salida = salidaRutas();
    if (salida === "yo") return corto ? "Desde vos" : "Sal\u00eds de donde est\u00e1s";
    return corto ? LUGARES_RUTAS[salida].desde : "Sal\u00eds " + LUGARES_RUTAS[salida].de;
}

function textoLugarRutas(tipo) {
    const clave = tipo === "salida" ? salidaRutas() : vueltaRutas();
    if (clave === "yo") return "Donde estoy";
    if (clave === "ninguno") return "No vuelvo";
    return LUGARES_RUTAS[clave].nombre;
}

// El menú de «Desde vos ▾» y de «Salgo de» y «Vuelvo a».
function menuLugaresRutas(ancla, tipo, alElegir) {
    const actual = tipo === "salida" ? salidaRutas() : vueltaRutas();
    const elegir = clave => {
        guardarPreferenciaRutas(tipo, clave);
        cambioLugaresRutas();
        if (typeof alElegir === "function") alElegir();
    };
    const opcion = clave => {
        const datos = LUGARES_RUTAS[clave];
        const guardado = lugarGuardadoRutas(clave);
        if (!guardado) return { icono: "mas", tono: "aviso", texto: datos.agregar, alTocar: () => abrirHojaLugarRutas(clave, () => elegir(clave)) };
        return { icono: datos.icono, texto: datos.nombre + (guardado.direccion ? " · " + guardado.direccion : ""), actual: actual === clave, alTocar: () => elegir(clave) };
    };
    const items = [
        tipo === "salida"
            ? { icono: "mira", texto: "Desde donde estoy", actual: actual === "yo", alTocar: () => elegir("yo") }
            : { icono: "bandera", texto: "No vuelvo, termino en la última", actual: actual === "ninguno", alTocar: () => elegir("ninguno") },
        opcion("deposito"),
        opcion("casa"),
        opcion("otra")
    ];
    const conLugar = Object.keys(LUGARES_RUTAS).filter(lugarGuardadoRutas);
    if (conLugar.length) {
        items.push("-");
        conLugar.forEach(clave => items.push({ icono: "lapiz", tono: "gris", texto: LUGARES_RUTAS[clave].cambiar, alTocar: () => abrirHojaLugarRutas(clave, () => elegir(clave)) }));
    }
    window.piezas.menu(ancla, {
        titulo: tipo === "salida" ? "¿Desde dónde salís?" : "¿A dónde volvés al terminar?",
        items,
        clase: "menuLugaresRutas"
    });
}

// Cambió la salida o la vuelta: con la ruta armada, se vuelve a ordenar.
function cambioLugaresRutas() {
    dibujarChipsRutas();
    if (rutaOrdenada.length) optimizarRuta({ silencioso: true });
    else dibujarVistaPreviaRutas();
}

// Dónde está el depósito (o tu casa, u otra dirección): parado ahí con
// «Usar dónde estoy ahora» o marcándolo en el mapa.
function abrirHojaLugarRutas(clave, alGuardar) {
    const p = window.piezas;
    const datos = LUGARES_RUTAS[clave];
    const actual = lugaresRutas()[clave] || {};
    let sugerida = "";
    try {
        if (clave === "deposito") sugerida = window.distribuidoraVendeFrio?.datosTicket?.()?.direccion || "";
    } catch (error) {
        sugerida = "";
    }
    const guardar = punto => {
        const direccion = (document.getElementById("direccionLugarRutas")?.value ?? direccionEscrita).trim();
        guardarPreferenciaRutas("lugares", { ...lugaresRutas(), [clave]: { direccion, lat: punto.lat, lng: punto.lng } });
        if (typeof mostrarToast === "function") mostrarToast(datos.nombre + " quedó guardado en el mapa");
        if (typeof alGuardar === "function") alGuardar();
    };
    let direccionEscrita = actual.direccion || sugerida;
    p.hoja({
        titulo: datos.titulo,
        sub: "Se guarda en este celular, para salir o volver ahí.",
        clase: "hojaLugarRutas",
        etiqueta: datos.titulo,
        html: `<label class="pzCampo"><span>Dirección</span><input id="direccionLugarRutas" type="text" autocomplete="off" placeholder="Por ej. Av. Rivadavia 1234" value="${p.esc(direccionEscrita)}"></label>
            <p class="ayudaLugarRutas">Para que la app sepa dónde queda, parate ahí y tocá «Usar dónde estoy ahora», o marcalo vos en el mapa.</p>`,
        botones: [
            { id: "usarDondeEstoyRutas", texto: "Usar dónde estoy ahora", icono: "mira", clase: "pzBtnPri", cerrar: false, alTocar: (caja, boton) => {
                if (!navigator.geolocation) {
                    if (typeof mostrarToast === "function") mostrarToast("Este celular no deja saber dónde estás: marcalo en el mapa");
                    return false;
                }
                boton.disabled = true;
                navigator.geolocation.getCurrentPosition(posicion => {
                    boton.disabled = false;
                    guardar({ lat: Number(posicion.coords.latitude.toFixed(7)), lng: Number(posicion.coords.longitude.toFixed(7)) });
                    p.cerrar();
                }, () => {
                    boton.disabled = false;
                    if (typeof mostrarToast === "function") mostrarToast("Prendé el GPS o marcalo en el mapa");
                }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
                return false;
            } },
            { id: "marcarEnMapaRutas", texto: "Marcarlo en el mapa", icono: "ubicacion", clase: "pzBtnSec", alTocar: caja => {
                direccionEscrita = caja.querySelector("#direccionLugarRutas").value;
                setTimeout(() => esperarToqueMapa("Tocá en el mapa dónde está " + p.esc(datos.nombre.toLowerCase()), guardar), 220);
            } }
        ]
    });
}

// -------------------------------------------------
// El orden más corto
// -------------------------------------------------

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const radioTierra = 6371e3;
    const radianes = Math.PI / 180;
    const diferenciaLatitud = (Number(lat2) - Number(lat1)) * radianes;
    const diferenciaLongitud = (Number(lon2) - Number(lon1)) * radianes;
    const a =
        Math.sin(diferenciaLatitud / 2) ** 2 +
        Math.cos(Number(lat1) * radianes) *
            Math.cos(Number(lat2) * radianes) *
            Math.sin(diferenciaLongitud / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return radioTierra * c;
}

const MAX_PARADAS_RUTA_EXACTA = 9;
// Google Maps acepta hasta 10 puntos por enlace: tu ubicación (el origen vacío
// de "dir//") y 9 paradas. Con más, el resto no aparece.
const MAX_PARADAS_GOOGLE_MAPS = 9;

// Prueba todos los órdenes. La salida queda fija; el final es libre o, con
// «Vuelvo a», el lugar de la vuelta (fin).
function calcularRutaExacta(comercios, latitudInicial, longitudInicial, fin = null) {
    let mejorDistanciaTotal = Infinity;
    let mejorOrden = [];
    let mejoresDistancias = [];
    const usados = new Array(comercios.length).fill(false);
    const ordenActual = [];
    const distanciasActuales = [];

    function explorar(latitudActual, longitudActual, distanciaTotal) {
        if (distanciaTotal >= mejorDistanciaTotal) return;

        if (ordenActual.length === comercios.length) {
            const total = distanciaTotal + (fin ? calcularDistancia(latitudActual, longitudActual, fin.lat, fin.lng) : 0);
            if (total >= mejorDistanciaTotal) return;
            mejorDistanciaTotal = total;
            mejorOrden = [...ordenActual];
            mejoresDistancias = [...distanciasActuales];
            return;
        }

        for (let indice = 0; indice < comercios.length; indice += 1) {
            if (usados[indice]) continue;
            const comercio = comercios[indice];
            const distancia = calcularDistancia(latitudActual, longitudActual, comercio.lat, comercio.lng);
            usados[indice] = true;
            ordenActual.push(comercio);
            distanciasActuales.push(distancia);
            explorar(Number(comercio.lat), Number(comercio.lng), distanciaTotal + distancia);
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
// paradas y da vuelta tramos del recorrido mientras eso lo acorte. La salida
// queda fija y el final es libre o el lugar de la vuelta, como en calcularRutaExacta.
function calcularRutaAproximada(comercios, latitudInicial, longitudInicial, fin = null) {
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

    // Desde cada punto del camino, cuánto cuesta ir hasta el siguiente: después
    // del último, hasta el lugar de la vuelta (o nada si termina ahí).
    const tramo = (a, b) => {
        if (b !== undefined) return distancia(a, b);
        return fin ? calcularDistancia(puntos[a].lat, puntos[a].lng, fin.lat, fin.lng) : 0;
    };

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
                const antes = distancia(orden[i - 1], orden[i]) + tramo(orden[j], orden[j + 1]);
                const despues = distancia(orden[i - 1], orden[j]) + tramo(orden[i], orden[j + 1]);
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
        distanciaTotal: distancias.reduce((total, metros) => total + metros, 0) + tramo(orden[orden.length - 1], undefined)
    };
}

// De dónde sale la ruta: tu posición (con el GPS) o el lugar guardado.
function puntoDeSalidaRutas(listo) {
    const salida = salidaRutas();
    if (salida !== "yo") {
        const lugar = lugarGuardadoRutas(salida);
        listo({ lat: Number(lugar.lat), lng: Number(lugar.lng) });
        return;
    }
    if (!navigator.geolocation) {
        mostrarAviso("GPS no disponible", "Prendé el GPS del celular, o elegí salir desde el depósito con «Desde vos ▾».");
        return;
    }
    navigator.geolocation.getCurrentPosition(
        posicion => listo({ lat: posicion.coords.latitude, lng: posicion.coords.longitude }),
        () => mostrarAviso("GPS desactivado", "Prendé el GPS del celular para salir desde donde estás, o elegí salir desde el depósito con «Desde vos ▾»."),
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
    );
}

// Ordena los comercios marcados por el camino más corto (sola al armar la
// ruta; «Optimizar el orden» del ⋯ la vuelve a ordenar).
function optimizarRuta({ silencioso = false } = {}) {
    const comerciosElegidos = obtenerComerciosElegidosParaRuta();
    if (comerciosElegidos.length === 0) {
        mostrarAviso("Sin comercios", "Elegí al menos un comercio para armar la ruta.");
        return;
    }
    const comerciosConGps = comerciosElegidos.filter(comercioTieneGps);
    if (comerciosConGps.length === 0) {
        mostrarAviso("Faltan ubicaciones", "Ninguno de los comercios elegidos tiene su lugar en el mapa. Abrí su ficha y tocá «Actualizar con mi GPS», o poné el pin a mano.");
        return;
    }

    puntoDeSalidaRutas(inicio => {
        // Hasta MAX_PARADAS_RUTA_EXACTA se prueban todas las combinaciones;
        // con más paradas sería eterno, así que se busca un orden muy bueno.
        const exacta = comerciosConGps.length <= MAX_PARADAS_RUTA_EXACTA;
        const resultado = (exacta ? calcularRutaExacta : calcularRutaAproximada)(comerciosConGps, inicio.lat, inicio.lng, puntoVueltaRuta());
        if (resultado.comercios.length === 0) {
            mostrarAviso("No se pudo calcular", "No se encontraron comercios válidos para la ruta.");
            return;
        }
        rutaOrdenada = resultado.comercios;
        inicioRutaCalculada = inicio;
        recalcularDistanciasRuta();
        rutaReordenadaAMano = false;
        paradasHechasRuta = new Set();
        paradasConPedidosRuta = new Set(rutaOrdenada.filter(comercio => cargaParaParada(comercio.nombre).pedidos.length).map(comercio => comercio.nombre));
        pedidosAlArmarRuta = idsDePedidosRuta();
        // El índice de recién se armó con los pedidos de la ruta anterior.
        indicePedidosRuta = null;
        comerciosSinGpsRuta = comerciosElegidos.filter(comercio => !comercioTieneGps(comercio)).map(comercio => comercio.nombre);
        mostrarRutaEnLista();
        refrescarPines();
        if (silencioso || typeof mostrarToast !== "function") return;
        const sinGps = comerciosSinGpsRuta.length;
        mostrarToast("Ruta armada: " + rutaOrdenada.length + (rutaOrdenada.length === 1 ? " parada" : " paradas") +
            " en el orden más corto" + (sinGps ? " · " + sinGps + " sin ubicación" : ""));
    });
}

// Arma la ruta con estos comercios (de los pines, los pedidos, una ruta
// guardada o elegidos a mano).
function armarRutaCon(nombres, { guardada = null } = {}) {
    comerciosSeleccionadosRuta = new Set(nombres.filter(nombre => buscarComercioPorNombre(nombre)));
    rutaGuardadaActual = guardada;
    optimizarRuta();
}

// -------------------------------------------------
// «Armar la ruta de hoy» (repaso de Rutas, imágenes 5 a 8): se abre solo con
// el botón. Pines marcados, pedidos para entregar, la ruta guardada del día,
// otra guardada o elegir a mano; abajo, de dónde salís y a dónde volvés.
// -------------------------------------------------
const DIAS_RUTA = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const NOMBRES_DIAS_RUTA = { lunes: "lunes", martes: "martes", miercoles: "miércoles", jueves: "jueves", viernes: "viernes", sabado: "sábados", domingo: "domingos" };

function diaDeHoyRuta() {
    return DIAS_RUTA[new Date().getDay()];
}

function claveDiaRuta(dia) {
    return normalizarTexto(String(dia || "")).replace(/[^a-z]/g, "");
}

function comerciosConPedidosRuta() {
    return obtenerComerciosSeleccionRuta().filter(comercio => cargaParaParada(comercio.nombre).pedidos.length > 0);
}

function opcionesArmarRuta() {
    const opciones = [];
    const marcados = obtenerComerciosElegidosParaRuta();
    if (marcados.length) {
        opciones.push({ clave: "marcados", icono: "ubicacion", tono: "pri", titulo: "Pines marcados", sub: "Los que marcaste en el mapa", nombres: marcados.map(comercio => comercio.nombre) });
    }
    const conPedidos = comerciosConPedidosRuta();
    if (conPedidos.length) {
        opciones.push({ clave: "pedidos", icono: "paquete", tono: "pri", titulo: "Pedidos para entregar", sub: "Los comercios con pedidos sin entregar", nombres: conPedidos.map(comercio => comercio.nombre) });
    }
    const rutas = rutasGuardadasParaLeer();
    const hoy = diaDeHoyRuta();
    const delDia = rutas.filter(ruta => claveDiaRuta(ruta.dia) === hoy);
    delDia.forEach(ruta => {
        opciones.push({ clave: "ruta:" + ruta.id, icono: "calendario", tono: "ok", titulo: ruta.nombre + " · ruta de los " + NOMBRES_DIAS_RUTA[hoy], sub: "Ruta guardada · " + ruta.comercios.length + (ruta.comercios.length === 1 ? " comercio" : " comercios"), nombres: ruta.comercios, guardada: ruta });
    });
    const otras = rutas.filter(ruta => !delDia.includes(ruta));
    if (otras.length) {
        opciones.push({ clave: "guardadas", icono: "historial", tono: "pri", titulo: delDia.length ? "Otra ruta guardada" : "Una ruta guardada", sub: otras.slice(0, 3).map(ruta => ruta.nombre).join(", ") + (otras.length > 3 ? "…" : ""), accion: abrirRutasGuardadas });
    }
    opciones.push({ clave: "mano", icono: "check", tono: "aviso", titulo: "Elegir comercios a mano", sub: "Para una zona sin pedidos, vendiendo en el momento", accion: () => abrirElegirComercios() });
    return opciones;
}

function abrirArmarRuta() {
    const p = window.piezas;
    const opciones = opcionesArmarRuta();
    let elegida = opciones.find(opcion => opcion.nombres);
    const fecha = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
    const caja = p.hoja({
        titulo: "Armar la ruta de hoy",
        sub: fecha.charAt(0).toUpperCase() + fecha.slice(1) + " · elegí con qué arrancar",
        clase: "hojaArmarRuta",
        html: `<div class="opcionesArmarRuta">${opciones.map(opcion => `<button type="button" class="opcionArmarRuta" data-clave="${p.esc(opcion.clave)}"${opcion.nombres ? ` aria-pressed="${opcion === elegida}"` : ""}>
                <span class="icoArmarRuta" data-tono="${opcion.tono}">${p.ico(opcion.icono, 22)}</span>
                <span class="textoArmarRuta"><strong>${p.esc(opcion.titulo)}</strong><small>${p.esc(opcion.sub)}</small></span>
                ${opcion.nombres ? `<b class="cantidadArmarRuta">${opcion.nombres.length}</b>` : p.ico("chevDerecha", 18)}
            </button>`).join("")}</div>
            <h3 class="tituloSalidaRutas">Salida y vuelta</h3>
            <div class="salidaVueltaRutas">
                <button type="button" class="lugarArmarRuta" data-lugar="salida"><span><small>Salgo de</small><strong></strong></span>${p.ico("chevAbajo", 16)}</button>
                <button type="button" class="lugarArmarRuta" data-lugar="vuelta"><span><small>Vuelvo a</small><strong></strong></span>${p.ico("chevAbajo", 16)}</button>
            </div>`,
        botones: [{ id: "btnArmarConEsto", texto: "Armar la ruta", clase: "pzBtnPri", alTocar: () => {
            if (!elegida) return false;
            armarRutaCon(elegida.nombres, { guardada: elegida.guardada || null });
            return true;
        } }]
    });
    const dibujarLugares = () => {
        caja.querySelector('[data-lugar="salida"] strong').textContent = textoLugarRutas("salida");
        caja.querySelector('[data-lugar="vuelta"] strong').textContent = textoLugarRutas("vuelta");
    };
    dibujarLugares();
    const botonArmar = caja.querySelector("#btnArmarConEsto");
    botonArmar.disabled = !elegida;
    caja.addEventListener("click", evento => {
        const lugar = evento.target.closest("[data-lugar]");
        if (lugar) {
            menuLugaresRutas(lugar, lugar.dataset.lugar, dibujarLugares);
            return;
        }
        const fila = evento.target.closest(".opcionArmarRuta");
        if (!fila) return;
        const opcion = opciones.find(item => item.clave === fila.dataset.clave);
        if (!opcion) return;
        if (opcion.accion) {
            opcion.accion();
            return;
        }
        elegida = opcion;
        caja.querySelectorAll(".opcionArmarRuta[aria-pressed]").forEach(boton => boton.setAttribute("aria-pressed", String(boton === fila)));
        botonArmar.disabled = false;
    });
}

// -------------------------------------------------
// «Elegir comercios»: como elegir varios en Pedidos (X · N elegidos · Marcar
// todos, la lupa y los filtros, y abajo «Armar la ruta con N» y ⋯).
// -------------------------------------------------
function abrirElegirComercios(estado = {}) {
    const p = window.piezas;
    const elegidos = estado.elegidos || new Set(obtenerComerciosElegidosParaRuta().map(comercio => comercio.nombre));
    let filtro = estado.filtro || "todos";
    const datos = obtenerComerciosSeleccionRuta().map(comercio => ({
        comercio,
        pendiente: !comercioEstaVisitadoEstaSemana(comercio),
        conPedido: cargaParaParada(comercio.nombre).pedidos.length > 0,
        sinDireccion: !String(comercio.direccion || "").trim()
    }));
    const FILTROS = [
        ["todos", "Todos", () => true],
        ["pendientes", "Pendientes", dato => dato.pendiente],
        ["pedido", "Con pedido", dato => dato.conPedido],
        ["sinDireccion", "Sin dirección", dato => dato.sinDireccion]
    ];
    const caja = p.hoja({
        titulo: "Elegir comercios",
        clase: "hojaElegirRuta",
        etiqueta: "Elegir comercios para la ruta",
        html: `<div class="barraElegirRuta">
                <button type="button" class="botonDejarDeElegir" data-elegir="cerrar" aria-label="Cerrar sin cambiar nada">${p.ico("cerrarX", 20)}</button>
                <strong class="cuantosElegidosRuta" aria-live="polite"></strong>
                <button type="button" class="botonMarcarTodosRuta" data-elegir="todos"></button>
            </div>
            <div class="filtrosEtapaPedidos filtrosElegirRuta" role="group" aria-label="Filtrar comercios"></div>
            <div class="listaElegirRuta" role="group" aria-label="Comercios"></div>
            <div class="pieElegirRuta">
                <button type="button" class="pzBtn pzBtnPri" data-elegir="armar"></button>
                <button type="button" class="masPlanRutas" data-elegir="mas" aria-label="Más opciones">${p.ico("puntos", 24)}</button>
            </div>`
    });
    const buscador = document.createElement("input");
    buscador.type = "search";
    buscador.placeholder = "Buscar comercio";
    buscador.autocomplete = "off";
    buscador.value = estado.busqueda || "";
    const lupa = p.lupa(buscador, { etiqueta: "Buscar comercio" });
    const fila = caja.querySelector(".filtrosElegirRuta");
    const lista = caja.querySelector(".listaElegirRuta");

    const visibles = () => {
        const busqueda = normalizarTexto(buscador.value || "");
        const pasa = FILTROS.find(([clave]) => clave === filtro)[2];
        return datos.filter(dato => pasa(dato) && (!busqueda || normalizarTexto(dato.comercio.nombre + " " + (dato.comercio.direccion || "")).includes(busqueda)));
    };
    const dibujarFiltros = () => {
        fila.innerHTML = FILTROS.map(([clave, texto, pasa]) => `<button type="button" class="filtroEtapa${clave === filtro ? " activo" : ""}" data-filtro="${clave}" aria-pressed="${clave === filtro}"><span>${texto}</span><span class="filtroEtapaCantidad">${datos.filter(pasa).length}</span></button>`).join("");
        lupa.poner(fila);
    };
    const dibujarPie = () => {
        const cuantos = elegidos.size;
        caja.querySelector(".cuantosElegidosRuta").textContent = cuantos + (cuantos === 1 ? " elegido" : " elegidos");
        const mostrados = visibles();
        const todos = mostrados.length > 0 && mostrados.every(dato => elegidos.has(dato.comercio.nombre));
        const marcar = caja.querySelector(".botonMarcarTodosRuta");
        marcar.textContent = todos ? "Desmarcar todos" : "Marcar todos";
        marcar.dataset.todos = todos ? "si" : "no";
        const armar = caja.querySelector('[data-elegir="armar"]');
        armar.innerHTML = p.ico("ubicacion", 18) + " Armar la ruta con " + cuantos;
        armar.disabled = cuantos === 0;
    };
    const dibujarLista = () => {
        const mostrados = visibles();
        lista.innerHTML = mostrados.length ? mostrados.map(({ comercio, pendiente, conPedido, sinDireccion }) => {
            const nombre = p.esc(comercio.nombre);
            const elegido = elegidos.has(comercio.nombre);
            const detalle = sinDireccion ? textoAgregarDato(comercio.nombre, "direccion", "Agregar dirección") : p.esc(comercio.direccion);
            const chips = [
                conPedido ? `<span class="pzChip pzChipAcento sinPunto">Con pedido</span>` : "",
                pendiente ? `<span class="pzChip pzChipAviso">Pendiente</span>` : ""
            ].join("");
            return `<div class="filaElegirRuta${elegido ? " elegida" : ""}" role="checkbox" tabindex="0" aria-checked="${elegido}" data-nombre="${nombre}">
                <span class="avatarElegirRuta ${p.colorIni(comercio.nombre)}"><span class="inicialesElegirRuta">${p.esc(p.iniciales(comercio.nombre))}</span><span class="tildeElegirRuta">${p.ico("check", 20)}</span></span>
                <span class="textoElegirRuta"><strong>${nombre}</strong><small>${detalle}${comercioTieneGps(comercio) ? "" : ` · <span class="sinUbicacionElegir">sin ubicación en el mapa</span>`}</small></span>
                ${chips}
            </div>`;
        }).join("") : `<p class="vacioElegirRuta">${buscador.value ? "Ningún comercio coincide con la búsqueda." : "No hay comercios acá."}</p>`;
        dibujarPie();
    };
    const cambiar = filaElegida => {
        const nombre = filaElegida.dataset.nombre;
        const elegido = !elegidos.has(nombre);
        if (elegido) elegidos.add(nombre);
        else elegidos.delete(nombre);
        filaElegida.classList.toggle("elegida", elegido);
        filaElegida.setAttribute("aria-checked", String(elegido));
        dibujarPie();
    };
    dibujarFiltros();
    dibujarLista();
    buscador.addEventListener("input", dibujarLista);
    caja.addEventListener("keydown", evento => {
        const filaElegida = evento.target.closest?.(".filaElegirRuta");
        if (!filaElegida || (evento.key !== "Enter" && evento.key !== " ")) return;
        evento.preventDefault();
        cambiar(filaElegida);
    });
    caja.addEventListener("click", evento => {
        const dato = evento.target.closest("[data-agregar-dato]");
        if (dato) {
            const seguir = { elegidos, filtro, busqueda: buscador.value };
            agregarDatoEnRuta(dato.dataset.nombre, dato.dataset.agregarDato, () => setTimeout(() => abrirElegirComercios(seguir), 250));
            return;
        }
        const filtroTocado = evento.target.closest("[data-filtro]");
        if (filtroTocado) {
            filtro = filtroTocado.dataset.filtro;
            dibujarFiltros();
            dibujarLista();
            return;
        }
        const accion = evento.target.closest("[data-elegir]");
        if (accion) {
            const que = accion.dataset.elegir;
            if (que === "cerrar") p.cerrar();
            else if (que === "todos") {
                const todos = accion.dataset.todos === "si";
                visibles().forEach(({ comercio }) => (todos ? elegidos.delete(comercio.nombre) : elegidos.add(comercio.nombre)));
                dibujarLista();
            } else if (que === "armar" && elegidos.size) {
                p.cerrar();
                armarRutaCon([...elegidos]);
            } else if (que === "mas") {
                p.menu(accion, {
                    titulo: elegidos.size + (elegidos.size === 1 ? " elegido" : " elegidos"),
                    items: [
                        { icono: "disquete", texto: "Guardar como ruta", desactivado: !elegidos.size, alTocar: () => abrirGuardarRuta({ nombres: [...elegidos] }) },
                        { icono: "cerrarX", tono: "gris", texto: "Desmarcar todos", desactivado: !elegidos.size, alTocar: () => {
                            elegidos.clear();
                            dibujarLista();
                        } }
                    ]
                });
            }
            return;
        }
        const filaElegida = evento.target.closest(".filaElegirRuta");
        if (filaElegida) cambiar(filaElegida);
    });
}

// -------------------------------------------------
// Rutas guardadas: tocar una la arma; su ⋯ la renombra o la borra.
// -------------------------------------------------
function abrirRutasGuardadas() {
    const p = window.piezas;
    const caja = p.hoja({ titulo: "Rutas guardadas", clase: "hojaRutasGuardadas", html: `<div class="listaGuardadasRuta"></div>` });
    const lista = caja.querySelector(".listaGuardadasRuta");
    const dibujar = () => {
        const rutas = rutasGuardadasParaLeer().slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        const hoy = diaDeHoyRuta();
        lista.innerHTML = rutas.length ? rutas.map(ruta => {
            const comercios = ruta.comercios.map(nombre => buscarComercioPorNombre(nombre)).filter(Boolean);
            const sinUbicacion = comercios.filter(comercio => !comercioTieneGps(comercio)).length;
            const dia = claveDiaRuta(ruta.dia);
            const detalle = [ruta.comercios.length + (ruta.comercios.length === 1 ? " comercio" : " comercios"), dia ? "los " + (NOMBRES_DIAS_RUTA[dia] || ruta.dia) : "", sinUbicacion ? sinUbicacion + " sin ubicación" : ""].filter(Boolean).join(" · ");
            return `<div class="filaGuardadaRuta" data-nombre="${p.esc(ruta.nombre)}">
                <button type="button" class="datosGuardadaRuta" data-ruta="armar"><span class="icoArmarRuta" data-tono="${dia === hoy ? "ok" : "pri"}">${p.ico("calendario", 22)}</span><span class="textoArmarRuta"><strong>${p.esc(ruta.nombre)}</strong><small>${p.esc(detalle)}</small></span></button>
                <button type="button" class="masRutaGuardada" data-ruta="mas" aria-label="Opciones de ${p.esc(ruta.nombre)}">${p.ico("puntos", 20)}</button>
            </div>`;
        }).join("") : `<p class="vacioElegirRuta">Todavía no guardaste ninguna ruta. Armá una y tocá ⋯ y «Guardar esta ruta».</p>`;
    };
    dibujar();
    caja.addEventListener("click", evento => {
        const boton = evento.target.closest("[data-ruta]");
        if (!boton) return;
        const ruta = buscarRutaGuardadaPorNombre(boton.closest(".filaGuardadaRuta").dataset.nombre);
        if (!ruta) return;
        const armar = () => {
            p.cerrar();
            armarRutaCon(ruta.comercios, { guardada: ruta });
        };
        if (boton.dataset.ruta === "armar") {
            armar();
            return;
        }
        p.menu(boton, {
            titulo: ruta.nombre,
            items: [
                { icono: "ubicacion", texto: "Armar esta ruta", principal: true, alTocar: armar },
                { icono: "lapiz", texto: "Cambiar nombre o día", alTocar: () => abrirGuardarRuta({ nombres: ruta.comercios, editada: ruta }) },
                "-",
                { icono: "tacho", texto: "Borrar la ruta", peligro: true, alTocar: () => borrarRutaGuardada(ruta.nombre, dibujar) }
            ]
        });
    });
}

// Guardar la ruta (o cambiarle el nombre o el día): nombre y día de la semana.
function abrirGuardarRuta({ nombres = null, editada = null } = {}) {
    const p = window.piezas;
    const comercios = nombres || (rutaOrdenada.length ? rutaOrdenada.map(comercio => comercio.nombre) : [...comerciosSeleccionadosRuta]);
    const base = editada || rutaGuardadaActual;
    if (!comercios.length) {
        mostrarAviso("Sin comercios", "Armá la ruta o elegí los comercios antes de guardarla.");
        return;
    }
    const diaBase = claveDiaRuta(base?.dia);
    const caja = p.hoja({
        titulo: editada ? "Cambiar la ruta" : "Guardar esta ruta",
        sub: comercios.length + (comercios.length === 1 ? " comercio" : " comercios"),
        clase: "hojaGuardarRuta",
        html: `<label class="pzCampo"><span>Nombre</span><input id="nombreRutaGuardada" type="text" autocomplete="off" placeholder="Por ej. Zona Sur" value="${p.esc(base?.nombre || "")}"></label>
            <label class="pzCampo"><span>Día de la ruta</span><select id="diaRutaGuardada">
                <option value="">Sin día fijo</option>
                ${["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"].map(dia => `<option value="${dia}"${dia === diaBase ? " selected" : ""}>${{ miercoles: "Miércoles", sabado: "Sábado" }[dia] || dia.charAt(0).toUpperCase() + dia.slice(1)}</option>`).join("")}
            </select></label>`,
        botones: [{ id: "guardarRutaActual", texto: "Guardar", icono: "disquete", clase: "pzBtnPri", alTocar: cajaHoja => {
            const nombre = cajaHoja.querySelector("#nombreRutaGuardada").value.trim();
            const dia = cajaHoja.querySelector("#diaRutaGuardada").value;
            if (!nombre) {
                cajaHoja.querySelector("#nombreRutaGuardada").focus();
                if (typeof mostrarToast === "function") mostrarToast("Escribí un nombre para la ruta");
                return false;
            }
            if (!guardarRutaRegistro(base ? base.nombre : null, nombre, comercios, dia)) {
                mostrarAviso("No se pudo guardar", "Probá nuevamente.");
                return false;
            }
            const guardada = buscarRutaGuardadaPorNombre(nombre);
            if (!editada || (rutaGuardadaActual && rutaGuardadaActual.id === editada.id)) rutaGuardadaActual = guardada;
            if (typeof mostrarToast === "function") mostrarToast("Ruta «" + nombre + "» guardada");
            return true;
        } }]
    });
    setTimeout(() => caja.querySelector("#nombreRutaGuardada")?.focus(), 220);
}

// El ⋯ de la ruta armada (en el mapa y en Paradas).
function abrirMenuRuta(ancla) {
    const rutas = rutasGuardadasParaLeer().length;
    const imprimir = window.impresionVendeFrio?.disponible?.();
    window.piezas.menu(ancla, {
        titulo: "Ruta de hoy",
        sub: rutaOrdenada.length + (rutaOrdenada.length === 1 ? " parada" : " paradas"),
        clase: "menuRutaHoy",
        items: [
            { icono: "rayo", texto: "Optimizar el orden", principal: rutaReordenadaAMano, alTocar: () => optimizarRuta() },
            { icono: "check", texto: "Elegir comercios", alTocar: () => abrirElegirComercios() },
            { icono: "disquete", texto: "Guardar esta ruta", alTocar: () => abrirGuardarRuta() },
            rutas ? { icono: "historial", texto: "Rutas guardadas", cantidad: rutas, alTocar: abrirRutasGuardadas } : null,
            { icono: "mapa", texto: "Abrir en Google Maps", alTocar: abrirGoogleMaps },
            imprimir ? { icono: "impresora", texto: "Imprimir hoja de reparto", alTocar: imprimirHojaReparto } : null,
            "-",
            { icono: "tacho", texto: "Vaciar la ruta", peligro: true, alTocar: vaciarRuta }
        ]
    });
}

// Hoja de reparto impresa (T28e): solo en la nube y con Web Bluetooth.
function imprimirHojaReparto() {
    const distancia = distanciasRuta.reduce((total, metros) => total + (Number(metros) || 0), 0);
    window.impresionVendeFrio?.imprimirHojaDeReparto?.(
        rutaOrdenada.map(comercio => ({
            nombre: comercio.nombre,
            direccion: comercio.direccion || "",
            telefono: comercio.telefono || ""
        })),
        { distancia: distancia > 0 ? formatearDistanciaTotal(distancia) : "", sinGps: comerciosSinGpsRuta }
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
    if (typeof historialParaLeer !== "function") return new Set();
    return new Set(historialParaLeer().filter(pedido => pedido && pedido.id != null).map(pedido => String(pedido.id)));
}

// T141: leer el historial es caro (cientos de pedidos) y la lista de paradas
// lo pedía 3 veces por parada; en un celular barato, 80 paradas tardaban
// segundos. Se arma una vez por dibujo un índice por comercio y se tira
// apenas termina (el próximo dibujo ve los pedidos nuevos).
let indicePedidosRuta = null;

function pedidosRutaPorComercio() {
    if (indicePedidosRuta) return indicePedidosRuta;
    const indice = { carga: new Map(), nuevos: new Set() };
    const historial = typeof historialParaLeer === "function" ? historialParaLeer() : [];
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

// Lo que debe cada comercio (saldos.js). Pedirlo por parada leía el historial
// entero cada vez: con 80 paradas, optimizar tardaba 12 s en un celular
// barato. Se arma una vez por dibujo, como los pedidos (T141).
let indiceSaldosRuta = null;

function saldoParaParada(nombre) {
    if (!indiceSaldosRuta) {
        indiceSaldosRuta = new Map();
        const cuentas = window.saldosVendeFrio?.cuentas?.() || [];
        cuentas.forEach(grupo => indiceSaldosRuta.set(String(grupo.nombre || "").trim().toLocaleLowerCase("es"), Number(grupo.total) || 0));
        setTimeout(() => { indiceSaldosRuta = null; }, 0);
    }
    return indiceSaldosRuta.get(String(nombre || "").trim().toLocaleLowerCase("es")) || 0;
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
    const ultima = rutaOrdenada[rutaOrdenada.length - 1];
    const fin = puntoVueltaRuta();
    distanciaVueltaRuta = ultima && fin ? calcularDistancia(Number(ultima.lat), Number(ultima.lng), fin.lat, fin.lng) : 0;
}

// Los minutos que suele tardar en cada comercio (se guardan en su ficha con
// el reloj de la ruta). Sin dato, 0.
function minutosEnParada(comercio) {
    const minutos = Number(comercio && comercio.minutosEnComercio);
    return Number.isFinite(minutos) && minutos > 0 ? minutos : 0;
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

// -------------------------------------------------
// Paradas (T138 y repaso de Rutas): la línea de tiempo con la hora de llegada,
// el número y lo que lleva o debe cada una; arriba, la lupa y los filtros
// Todas, Por entregar, A cobrar y Hechas. Con «Todas», se ordenan con ≡.
// -------------------------------------------------
let filtroParadasRuta = "todas";
let lupaParadasRuta = null;

const FILTROS_PARADAS = [
    ["todas", "Todas", () => true],
    ["entregar", "Por entregar", dato => dato.carga.pedidos.length > 0 && !dato.hecha],
    ["cobrar", "A cobrar", dato => dato.saldo > 0],
    ["hechas", "Hechas", dato => dato.hecha]
];

function dibujarFiltrosParadas(datos) {
    const fila = document.getElementById("filtrosParadas");
    if (!fila) return;
    fila.innerHTML = FILTROS_PARADAS.map(([clave, texto, pasa]) => `<button type="button" class="filtroEtapa${clave === filtroParadasRuta ? " activo" : ""}" data-filtro-paradas="${clave}" aria-pressed="${clave === filtroParadasRuta}"><span>${texto}</span><span class="filtroEtapaCantidad">${datos.filter(pasa).length}</span></button>`).join("");
    // El buscador queda adentro de la lupa: al rehacer la fila se vuelve a poner.
    const buscador = buscadorParadasRuta();
    if (buscador && window.piezas?.lupa) {
        if (!lupaParadasRuta) lupaParadasRuta = window.piezas.lupa(buscador, { etiqueta: "Buscar parada" });
        lupaParadasRuta.poner(fila);
    }
}

let buscadorParadas = null;
function buscadorParadasRuta() {
    if (!buscadorParadas) buscadorParadas = document.getElementById("buscarParadas");
    return buscadorParadas;
}

function mostrarRutaEnLista() {
    const contenedor = document.getElementById("listaRutaOrdenada");
    if (!contenedor) return;
    contenedor.innerHTML = "";
    contenedor.classList.toggle("conParadas", rutaOrdenada.length > 0);

    dibujarVistaPreviaRutas();
    dibujarNumerosParadas();
    dibujarSinUbicacionParadas();
    const verPlata = !window.verPlataVendeFrio || window.verPlataVendeFrio.puedoVer();
    const datos = rutaOrdenada.map((comercio, indice) => ({
        comercio,
        indice,
        carga: cargaParaParada(comercio.nombre),
        saldo: verPlata ? saldoParaParada(comercio.nombre) : 0,
        hecha: paradaHecha(comercio)
    }));
    dibujarFiltrosParadas(datos);
    if (rutaOrdenada.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "vacioParadas";
        vacio.textContent = "Todavía no armaste la ruta. Volvé al mapa y tocá «Armar ruta».";
        contenedor.appendChild(vacio);
        dibujarProximaParada();
        return;
    }

    const encabezado = document.createElement("div");
    encabezado.className = "encabezadoParadas";
    const subtitulo = document.createElement("small");
    subtitulo.textContent = rutaReordenadaAMano ? "Orden a tu gusto" : "El orden más corto";
    encabezado.appendChild(subtitulo);
    contenedor.appendChild(encabezado);

    const busqueda = normalizarTexto(buscadorParadasRuta()?.value || "");
    const pasa = (FILTROS_PARADAS.find(([clave]) => clave === filtroParadasRuta) || FILTROS_PARADAS[0])[2];
    const mostradas = datos.filter(dato => pasa(dato) && (!busqueda || normalizarTexto(dato.comercio.nombre + " " + (dato.comercio.direccion || "")).includes(busqueda)));
    // Ordenar arrastrando solo con la lista entera a la vista.
    const ordenable = filtroParadasRuta === "todas" && !busqueda;

    const lista = document.createElement("ol");
    lista.className = "listaParadas" + (ordenable ? "" : " filtrada");
    const proxima = indiceProximaParada();
    const llegadas = llegadasRuta();
    const horas = horasDeLlegadaRuta();
    const p = window.piezas;
    mostradas.forEach(({ comercio, indice, carga, saldo, hecha }) => {
        const fila = document.createElement("li");
        fila.className = "paradaOrden" + (indice === proxima ? " proxima" : "") + (hecha ? " hecha" : "");
        fila.dataset.nombre = comercio.nombre;
        const chips = [];
        if (carga.pedidos.length) chips.push(`<span class="pzChip pzChipAcento sinPunto">${window.icono("paquete", 13)} Lleva ${carga.unidades} u${carga.total && verPlata ? " · " + p.plata(carga.total) : ""}</span>`);
        if (saldo > 0) chips.push(`<span class="pzChip pzChipAviso sinPunto chipCobrarParada">Debe ${p.plata(saldo)}</span>`);
        if (!hecha) {
            const horario = chipHorarioParada(comercio, llegadas[indice]);
            if (horario) chips.push(horario);
        }
        fila.innerHTML = `<span class="horaParada">${horas[indice]}</span>
            <span class="lineaParada" aria-hidden="true"><span class="numeroParada">${hecha ? window.icono("check", 14) : indice + 1}</span></span>
            <div class="cajaParada">
                <button type="button" class="textoParada pedidoParadaRuta" data-nombre="${p.esc(comercio.nombre)}" aria-label="Pedido de ${p.esc(comercio.nombre)}">
                    <strong>${p.esc(comercio.nombre)}</strong>
                    <small>${comercio.direccion ? p.esc(comercio.direccion) : textoAgregarDato(comercio.nombre, "direccion", "Agregar dirección")} · ${textoDistanciaCorta(distanciasRuta[indice])}</small>
                    ${chips.length ? `<span class="llevaParada">${chips.join("")}</span>` : ""}
                </button>
                ${ordenable ? `<span class="agarreParada" role="button" tabindex="0" aria-label="Mover ${p.esc(comercio.nombre)}. Mantené apretado y arrastrá">${window.icono("menu", 20)}</span>` : ""}
            </div>`;
        lista.appendChild(fila);
    });
    if (!mostradas.length) {
        const vacio = document.createElement("p");
        vacio.className = "vacioParadas";
        vacio.textContent = busqueda ? "Ninguna parada coincide con la búsqueda." : "No hay paradas acá.";
        contenedor.appendChild(vacio);
    }
    contenedor.appendChild(lista);

    if (ordenable) {
        const ayuda = document.createElement("p");
        ayuda.className = "ayudaParadas";
        ayuda.textContent = "Mantené apretado ≡ y arrastrá para cambiar el orden.";
        contenedor.appendChild(ayuda);
        conectarArrastreParadas(lista);
    }
    dibujarProximaParada();
}

// Lo que tarda la ruta: manejando (por calles si llegó el camino, si no la
// cuenta aproximada) más lo que suele tardar en cada comercio.
function cuentaRuta() {
    const elegido = recorridoElegidoPlan();
    const conVuelta = Boolean(puntoVueltaRuta());
    const manejando = elegido ? elegido.duracion
        : (distanciasRuta.reduce((total, metros) => total + minutosAproximados(metros), 0) + (conVuelta && distanciaVueltaRuta ? minutosAproximados(distanciaVueltaRuta) : 0)) * 60;
    const metros = elegido ? elegido.distancia
        : distanciasRuta.reduce((total, distancia) => total + (Number(distancia) || 0), 0) + (conVuelta ? distanciaVueltaRuta : 0);
    const enParadas = rutaOrdenada.reduce((total, comercio) => total + minutosEnParada(comercio), 0) * 60;
    return { segundos: manejando + enParadas, manejando, enParadas, metros, porCalles: Boolean(elegido) };
}

function textoDuracionRuta(segundos) {
    const minutos = Math.max(1, Math.round(segundos / 60));
    if (minutos < 60) return minutos + " min";
    return Math.floor(minutos / 60) + " h " + String(minutos % 60).padStart(2, "0");
}

function textoKmRuta(metros) {
    const kilometros = (Number(metros) || 0) / 1000;
    return (kilometros < 10 ? kilometros.toFixed(1).replace(".", ",") : String(Math.round(kilometros))) + " km";
}

// Paradas, km, tiempo y plata a cobrar del día.
function dibujarNumerosParadas() {
    const caja = document.getElementById("numerosParadas");
    if (!caja) return;
    let paradas = rutaOrdenada.length;
    let km = "—";
    let tiempo = "—";
    let cobrar = 0;
    const verPlata = !window.verPlataVendeFrio || window.verPlataVendeFrio.puedoVer();
    if (rutaOrdenada.length) {
        const cuenta = cuentaRuta();
        km = textoKmRuta(cuenta.metros).replace(" km", "");
        tiempo = textoDuracionRuta(cuenta.segundos);
        if (verPlata) {
            rutaOrdenada.forEach(comercio => {
                cobrar += cargaParaParada(comercio.nombre).total + saldoParaParada(comercio.nombre);
            });
        }
    } else {
        paradas = obtenerComerciosElegidosParaRuta().filter(comercioTieneGps).length;
    }
    const plata = !verPlata || !rutaOrdenada.length ? "—" : cobrar < 1000 ? String(Math.round(cobrar)) : cobrar < 1e6 ? Math.round(cobrar / 1000) + "k" : (cobrar / 1e6).toFixed(1).replace(".", ",") + "M";
    caja.innerHTML = [[paradas, "Paradas"], [km, "Km"], [tiempo, "Tiempo"], [plata, "$ Cobrar"]]
        .map(([valor, nombre]) => `<div class="numeroParadas"><strong>${valor}</strong><small>${nombre}</small></div>`).join("");
    // Repasada: las paradas llevan a la próxima de la lista, y los km y el
    // tiempo al mapa con el recorrido.
    const tocable = window.piezas && window.piezas.tocable;
    if (!tocable || !rutaOrdenada.length) return;
    const [numeroParadas, numeroKm, numeroTiempo] = caja.querySelectorAll(".numeroParadas");
    tocable(numeroParadas, () => {
        const parada = document.querySelector("#listaRutaOrdenada .paradaOrden.proxima") || document.querySelector("#listaRutaOrdenada .paradaOrden");
        if (parada) parada.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    tocable(numeroKm, cerrarPanelParadas);
    tocable(numeroTiempo, cerrarPanelParadas);
}

// Los elegidos sin ubicación no entran a la ruta: «Poner pin» los ubica a mano.
function dibujarSinUbicacionParadas() {
    const caja = document.getElementById("sinUbicacionParadas");
    if (!caja) return;
    const sinUbicacion = obtenerComerciosElegidosParaRuta().filter(comercio => !comercioTieneGps(comercio));
    caja.classList.toggle("oculto", !sinUbicacion.length);
    if (!sinUbicacion.length) {
        caja.innerHTML = "";
        return;
    }
    const p = window.piezas;
    caja.innerHTML = `<h3>${window.icono("alerta", 16)} Sin ubicación (${sinUbicacion.length})</h3>` + sinUbicacion.slice(0, 30).map(comercio => {
        const nombre = p.esc(comercio.nombre);
        return `<div class="filaSinUbicacion"><span><strong>${nombre}</strong><small>${comercio.direccion ? p.esc(comercio.direccion) : textoAgregarDato(comercio.nombre, "direccion", "Agregar dirección")}</small></span>
            <button type="button" class="pzBtn pzBtnSec" data-poner-pin="${nombre}" aria-label="Poner pin a ${nombre}">${window.icono("ubicacion", 16)} Poner pin</button></div>`;
    }).join("") + (sinUbicacion.length > 30 ? `<p class="ayudaParadas">Y ${sinUbicacion.length - 30} más sin ubicación.</p>` : "");
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
// tarjeta por parada que falta, empezando por la próxima. Al deslizarla o
// tocarla, el mapa va a ese comercio y su pin se agranda. Su ⋯ abre el menú
// de la parada (repaso de Rutas).
let paradaDestacadaRuta = "";
let esperaCarrusel = null;

function dibujarProximaParada() {
    const pantalla = document.getElementById("pantallaRutas");
    if (!pantalla) return;
    let carrusel = document.getElementById("proximaParadaRuta");
    const indice = indiceProximaParada();
    if (!rutaOrdenada.length) {
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
        const saldo = verPlata ? saldoParaParada(comercio.nombre) : 0;
        const detalle = [comercio.direccion || "", horas[i]];
        if (carga.pedidos.length) detalle.push("lleva " + carga.unidades + " u");
        if (saldo > 0) detalle.push("debe " + window.piezas.plata(saldo));
        const nombre = window.piezas.esc(comercio.nombre);
        const sinDireccion = comercio.direccion ? "" : textoAgregarDato(comercio.nombre, "direccion", "Agregar dirección") + " · ";
        tarjetas.push(`<article class="paradaCarrusel${i === indice ? " actual" : ""}" data-nombre="${nombre}" aria-label="Parada ${i + 1} de ${rutaOrdenada.length}: ${nombre}">
            <span class="numeroCarrusel">${i + 1}</span>
            <button type="button" class="datosCarrusel" data-parada="ver"><strong>${nombre}</strong><small>${sinDireccion}${window.piezas.esc(detalle.filter(Boolean).join(" · "))}</small></button>
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
// con la cuenta aproximada, más lo que suele tardar en las anteriores.
function llegadasRuta() {
    const tramos = recorridoElegidoPlan()?.tramos;
    const porCalles = tramos && tramos.length >= rutaOrdenada.length;
    let segundos = 0;
    return rutaOrdenada.map((comercio, indice) => {
        if (indice > 0) segundos += minutosEnParada(rutaOrdenada[indice - 1]) * 60;
        segundos += porCalles ? tramos[indice] : minutosAproximados(distanciasRuta[indice]) * 60;
        return new Date(Date.now() + segundos * 1000);
    });
}

function horasDeLlegadaRuta() {
    return llegadasRuta().map(hora => String(hora.getHours()).padStart(2, "0") + ":" + String(hora.getMinutes()).padStart(2, "0"));
}

// -------------------------------------------------
// Horarios (repaso de Rutas, imagen 5): si a la hora que llegás el comercio
// está abierto, cierra pronto o ya cerró; sin horario, «+ Agregar horario».
// -------------------------------------------------

function textoMinutosDelDia(minutos) {
    return String(Math.floor(minutos / 60)).padStart(2, "0") + ":" + String(minutos % 60).padStart(2, "0");
}

function horarioDeParada(comercio, llegada) {
    const texto = String(comercio?.horario || "").trim();
    if (!texto) return { tipo: "falta" };
    const leido = window.datosComercioVendeFrio?.leerHorario?.(texto);
    if (!leido) return { tipo: "otro" };
    if (!leido.dias[(llegada.getDay() + 6) % 7]) return { tipo: "cerrado", texto: "Hoy no abre", cierre: -1 };
    const minuto = llegada.getHours() * 60 + llegada.getMinutes();
    const turnos = [leido.manana, leido.tarde].filter(turno => turno.prendido).sort((a, b) => a.desde - b.desde);
    const adentro = turnos.find(turno => minuto >= turno.desde && minuto < turno.hasta);
    if (adentro) {
        const falta = adentro.hasta - minuto;
        return falta <= 30
            ? { tipo: "cierra", texto: "Cierra " + textoMinutosDelDia(adentro.hasta), cierre: adentro.hasta }
            : { tipo: "abierto", texto: "Abierto hasta " + textoMinutosDelDia(adentro.hasta), cierre: adentro.hasta };
    }
    const despues = turnos.find(turno => turno.desde > minuto);
    if (despues) return { tipo: "abre", texto: "Abre " + textoMinutosDelDia(despues.desde), cierre: despues.hasta };
    return { tipo: "cerrado", texto: "Cerró " + textoMinutosDelDia(turnos[turnos.length - 1].hasta), cierre: turnos[turnos.length - 1].hasta };
}

function chipHorarioParada(comercio, llegada) {
    const estado = horarioDeParada(comercio, llegada);
    if (estado.tipo === "falta") return textoAgregarDato(comercio.nombre, "horario", "Agregar horario");
    if (estado.tipo === "otro") return "";
    const clase = { abierto: "pzChipOk", cierra: "pzChipAviso", abre: "pzChipInfo", cerrado: "pzChipPeligro" }[estado.tipo];
    return `<span class="pzChip ${clase} chipHorarioParada">${window.piezas.esc(estado.texto)}</span>`;
}

// Las paradas que faltan y llegás cuando ya cerró (o hoy no abre).
function paradasQueCierranAntes() {
    const llegadas = llegadasRuta();
    return rutaOrdenada.map((comercio, indice) => ({ comercio, estado: horarioDeParada(comercio, llegadas[indice]) }))
        .filter(({ comercio, estado }) => estado.tipo === "cerrado" && !paradaHecha(comercio));
}

// «Ordenar»: primero las que cierran más temprano (de las que hoy abren),
// las demás quedan en el orden que estaban.
function ordenarPorHorarioRuta() {
    const llegadas = llegadasRuta();
    const conCierre = [];
    const resto = [];
    rutaOrdenada.forEach((comercio, indice) => {
        const estado = horarioDeParada(comercio, llegadas[indice]);
        if (!paradaHecha(comercio) && estado.cierre > 0 && ["cerrado", "cierra"].includes(estado.tipo)) conCierre.push({ comercio, cierre: estado.cierre });
        else resto.push(comercio);
    });
    if (!conCierre.length) return;
    conCierre.sort((a, b) => a.cierre - b.cierre);
    const hechas = resto.filter(paradaHecha);
    rutaOrdenada = [...hechas, ...conCierre.map(dato => dato.comercio), ...resto.filter(comercio => !paradaHecha(comercio))];
    rutaReordenadaAMano = true;
    recalcularDistanciasRuta();
    pedirCaminoPlan();
    mostrarRutaEnLista();
    refrescarPines();
    const quedan = paradasQueCierranAntes().length;
    mostrarToast(quedan ? "Primero los que cierran antes. Igual " + quedan + (quedan === 1 ? " no llega" : " no llegan") + " a tiempo." : "Listo: primero los que cierran antes.");
}

// -------------------------------------------------
// «Completar los datos» (imagen 5): horario y, si la ruta guardada tiene día,
// el día de visita de cada comercio.
// -------------------------------------------------

const DIA_VISITA_RUTA = { domingo: "Domingo", lunes: "Lunes", martes: "Martes", miercoles: "Miércoles", jueves: "Jueves", viernes: "Viernes", sabado: "Sábado" };

function diaVisitaDeLaRuta() {
    return DIA_VISITA_RUTA[claveDiaRuta(rutaGuardadaActual?.dia)] || "";
}

function faltanDatosRuta() {
    const dia = diaVisitaDeLaRuta();
    return rutaOrdenada.map(parada => buscarComercioPorNombre(parada.nombre) || parada).map(comercio => ({
        comercio,
        horario: !String(comercio.horario || "").trim(),
        dia: Boolean(dia) && !String(comercio.diaVisita || "").trim()
    })).filter(dato => dato.horario || dato.dia);
}

function dibujarFaltanDatosRuta() {
    const fila = document.getElementById("faltanDatosRutas");
    if (!fila) return;
    const cuantos = rutaOrdenada.length ? faltanDatosRuta().length : 0;
    fila.hidden = cuantos === 0;
    if (cuantos) fila.querySelector(".textoAvisoPlan").textContent = "Faltan datos de " + cuantos + (cuantos === 1 ? " comercio" : " comercios");
}

function dibujarCierranAntesRuta() {
    const aviso = document.getElementById("cierranAntesRutas");
    if (!aviso) return;
    const cuantos = rutaOrdenada.length ? paradasQueCierranAntes().length : 0;
    aviso.hidden = cuantos === 0;
    if (cuantos) aviso.querySelector(".textoAvisoPlan").textContent = cuantos === 1 ? "1 cierra antes de que llegues" : cuantos + " cierran antes de que llegues";
}

function abrirCompletarDatosRuta() {
    const p = window.piezas;
    if (!p?.hoja) return;
    const dia = diaVisitaDeLaRuta();
    const filas = () => faltanDatosRuta().map(({ comercio, horario, dia: sinDia }) => `<div class="filaCompletarRuta" data-nombre="${p.esc(comercio.nombre)}">
            <span class="avatarCompletarRuta ${p.colorIni(comercio.nombre)}">${p.esc(p.iniciales(comercio.nombre))}</span>
            <strong>${p.esc(comercio.nombre)}</strong>
            <span class="botonesCompletarRuta">
                ${horario ? `<button type="button" class="pzBtn pzBtnSec" data-completar="horario">${window.icono("mas", 14)} Agregar horario</button>` : ""}
                ${sinDia ? `<button type="button" class="pzBtn pzBtnSec" data-completar="dia">${window.icono("calendario", 14)} Guardar los ${p.esc(NOMBRES_DIAS_RUTA[claveDiaRuta(dia)] || dia)}</button>` : ""}
            </span>
        </div>`).join("");
    const caja = p.hoja({
        titulo: "Completar los datos",
        sub: dia ? "Para avisarte si cierran y para saber qué comercios van los " + (NOMBRES_DIAS_RUTA[claveDiaRuta(dia)] || dia) + "." : "Para avisarte si un comercio cierra antes de que llegues.",
        clase: "hojaCompletarRuta",
        html: `<div class="listaCompletarRuta">${filas()}</div>`,
        botones: [{ id: "listoCompletarRuta", texto: "Listo", clase: "pzBtnPri", cerrar: true }]
    });
    if (!caja) return;
    const redibujar = () => {
        const lista = caja.querySelector(".listaCompletarRuta");
        if (!lista) return;
        lista.innerHTML = filas() || `<p class="vacioParadas">${window.icono("check", 16)} Ya están todos los datos.</p>`;
        mostrarRutaEnLista();
    };
    caja.addEventListener("click", evento => {
        const boton = evento.target.closest("[data-completar]");
        if (!boton) return;
        const nombre = boton.closest(".filaCompletarRuta")?.dataset.nombre;
        if (!nombre) return;
        if (boton.dataset.completar === "dia") {
            actualizarComercioPorNombre(nombre, { diaVisita: dia });
            rutaOrdenada = rutaOrdenada.map(parada => parada.nombre === nombre ? (buscarComercioPorNombre(nombre) || parada) : parada);
            redibujar();
        } else {
            agregarDatoEnRuta(nombre, "horario", () => abrirCompletarDatosRuta());
        }
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
        abrirOpcionesParadaRuta(nombre, boton);
    }
}

// El ⋯ de la tarjeta (repaso de Rutas): Hacer pedido o Entregar, Pasé sin
// pedido, Saltear, Ir, la ficha, lo que le falte y Sacar de la ruta.
function abrirOpcionesParadaRuta(nombre, ancla) {
    const indice = rutaOrdenada.findIndex(comercio => comercio.nombre === nombre);
    if (indice < 0 || !window.piezas?.menu) return;
    const comercio = buscarComercioPorNombre(nombre) || rutaOrdenada[indice];
    const carga = cargaParaParada(nombre);
    const pasar = () => {
        paradasHechasRuta.add(nombre);
        mostrarRutaEnLista();
    };
    window.piezas.menu(ancla || document.getElementById("proximaParadaRuta"), {
        titulo: nombre,
        sub: "Parada " + (indice + 1) + " de " + rutaOrdenada.length,
        clase: "menuParadaRuta",
        items: [
            { icono: carga.pedidos.length ? "check" : "documento", texto: carga.pedidos.length ? "Entregar" : "Hacer pedido", principal: true, alTocar: () => {
                const actual = cargaParaParada(nombre);
                if (actual.pedidos.length && window.seguimientoVendeFrio?.abrirPedido?.(actual.pedidos[0].id)) return;
                if (typeof irAPedidoRapido === "function") irAPedidoRapido(nombre);
            } },
            window.visitasVendeFrio?.abrir ? { icono: "chevDerecha", texto: "Pasé, sin pedido", alTocar: () => window.visitasVendeFrio.abrir(nombre, pasar) } : null,
            { icono: "reloj", tono: "aviso", texto: "Saltear (queda para después)", alTocar: () => saltearParadaRuta(nombre) },
            { icono: "navegar", texto: "Ir", alTocar: () => irConGoogleMaps(comercio) },
            { icono: "tienda", texto: "Ver la ficha", alTocar: () => window.abrirFichaComercio?.(nombre) },
            ...datosQueFaltanRuta(comercio).map(([campo, texto]) => ({ icono: "mas", tono: "aviso", texto, alTocar: () => agregarDatoEnRuta(nombre, campo) })),
            "-",
            { icono: "cerrarX", texto: "Sacar de la ruta", peligro: true, alTocar: () => cambiarPinEnRuta(nombre) }
        ]
    });
}

// Saltear: la parada pasa al final de la ruta, para después.
function saltearParadaRuta(nombre) {
    const indice = rutaOrdenada.findIndex(comercio => comercio.nombre === nombre);
    if (indice < 0) return;
    const [parada] = rutaOrdenada.splice(indice, 1);
    rutaOrdenada.push(parada);
    rutaReordenadaAMano = true;
    recalcularDistanciasRuta();
    mostrarRutaEnLista();
    refrescarPines();
    if (typeof mostrarToast === "function") mostrarToast(nombre + " queda para el final");
}

// -------------------------------------------------
// Vista previa (T136): el mapa ocupa toda la pantalla con el camino entero
// por calles. Arriba, el título, «Auto ▾» y «Desde vos ▾»; abajo, «Armar
// ruta» o la ruta armada con Iniciar, Paradas y ⋯.
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
    const clic = (id, accion) => document.getElementById(id)?.addEventListener("click", evento => accion(evento.currentTarget));
    clic("pillVehiculoRutas", menuVehiculoRutas);
    clic("pillDesdeRutas", boton => menuLugaresRutas(boton, "salida"));
    clic("btnCentrarRutas", centrarEnMiRutas);
    clic("btnArmarRuta", abrirArmarRuta);
    clic("btnNavegarRuta", iniciarNavegacionRuta);
    clic("btnParadasRutas", () => abrirPanelParadas());
    clic("btnMasRutas", abrirMenuRuta);
    clic("cierranAntesRutas", ordenarPorHorarioRuta);
    clic("faltanDatosRutas", abrirCompletarDatosRuta);
    clic("btnMasParadas", abrirMenuRuta);
    clic("btnCerrarParadas", cerrarPanelParadas);
    clic("btnListoParadas", cerrarPanelParadas);
    buscadorParadasRuta()?.addEventListener("input", mostrarRutaEnLista);
    document.getElementById("filtrosParadas")?.addEventListener("click", evento => {
        const boton = evento.target.closest("[data-filtro-paradas]");
        if (!boton) return;
        filtroParadasRuta = boton.dataset.filtroParadas;
        mostrarRutaEnLista();
    });

    // El alto de la hoja de abajo, para el mapa y la tarjeta de la parada.
    const hoja = vista.querySelector(".hojaPlanRutas");
    const medir = () => pantalla.style.setProperty("--altoHojaPlan", hoja.offsetHeight + "px");
    if (window.ResizeObserver) new ResizeObserver(medir).observe(hoja);
    else medir();
}

// «Auto ▾»: Auto o Moto, y sin autopistas.
function menuVehiculoRutas(ancla) {
    const preferencias = preferenciasRutas();
    const vehiculo = preferencias.vehiculo || "auto";
    const elegir = valor => {
        guardarPreferenciaRutas("vehiculo", valor);
        dibujarChipsRutas();
    };
    window.piezas.menu(ancla, {
        titulo: "¿Cómo vas?",
        clase: "menuVehiculoRutas",
        items: [
            { icono: "auto", texto: "Auto", actual: vehiculo === "auto", alTocar: () => elegir("auto") },
            { icono: "velocimetro", texto: "Moto", actual: vehiculo === "moto", alTocar: () => elegir("moto") },
            "-",
            { icono: preferencias.sinAutopistas ? "check" : "camion", texto: preferencias.sinAutopistas ? "Sin autopistas: sí" : "Sin autopistas", actual: Boolean(preferencias.sinAutopistas), alTocar: () => elegirRecorridoPlan(!preferencias.sinAutopistas) }
        ]
    });
}

// Lo que el mapa deja libre arriba (cabecera y botones) y abajo (hoja y parada).
function margenesMapaRutas() {
    const pantalla = document.getElementById("pantallaRutas");
    const chips = pantalla?.querySelector(".chipsRutas");
    const hoja = pantalla?.querySelector(".hojaPlanRutas");
    const proxima = document.getElementById("proximaParadaRuta");
    const arriba = chips && chips.offsetHeight ? chips.offsetTop + chips.offsetHeight : 0;
    const abajo = (hoja?.offsetHeight || 0) + (proxima?.offsetHeight ? proxima.offsetHeight + 10 : 0);
    return { paddingTopLeft: [30, arriba + 24], paddingBottomRight: [30, abajo + 24] };
}

function abrirPanelParadas() {
    const pantalla = document.getElementById("pantallaRutas");
    if (!pantalla) return;
    cancelarEdicionPin();
    pantalla.classList.add("conParadasAbiertas");
    pantalla.querySelector(".panelParadasRutas").scrollTop = 0;
}

function cerrarPanelParadas() {
    const pantalla = document.getElementById("pantallaRutas");
    if (!pantalla?.classList.contains("conParadasAbiertas")) return false;
    pantalla.classList.remove("conParadasAbiertas");
    if (mapaLeaflet) mapaLeaflet.invalidateSize();
    return true;
}

// El atrás del celular en Rutas (regla 2): primero suelta el pin que se
// mueve o el lugar que se marca, después cierra Paradas.
window.rutasVendeFrio = {
    atras() {
        const pantalla = document.getElementById("pantallaRutas");
        if (!pantalla || pantalla.classList.contains("oculto")) return false;
        if (nombrePinEnEdicion || alTocarMapaRuta) {
            cancelarEdicionPin();
            return true;
        }
        return cerrarPanelParadas();
    },
    costoDePaso,
    sumarParadaDePaso
};

function dibujarChipsRutas() {
    const preferencias = preferenciasRutas();
    const vehiculo = document.querySelector("#pillVehiculoRutas span");
    const texto = (preferencias.vehiculo === "moto" ? "Moto" : "Auto") + (preferencias.sinAutopistas ? ", sin autopistas" : "");
    if (vehiculo && vehiculo.textContent !== texto) vehiculo.textContent = texto;
    const desde = document.querySelector("#pillDesdeRutas span");
    const textoDesde = textoSalidaRutas(true);
    if (desde && desde.textContent !== textoDesde) desde.textContent = textoDesde;
}

// Se llama con cada cambio de la ruta (no con el GPS): es barato y el camino
// se pide solo si cambió.
function dibujarVistaPreviaRutas() {
    if (!document.querySelector("#pantallaRutas .vistaPreviaRutas")) return;
    dibujarChipsRutas();
    pedirCaminoPlan();
    dibujarResumenPlan();
}

function pedirCaminoPlan() {
    clearTimeout(esperaCaminoPlan);
    esperaCaminoPlan = setTimeout(calcularCaminoPlan, 250);
}

// Salida, paradas y, si vuelve, el lugar de la vuelta.
function puntosCaminoPlan() {
    if (!rutaOrdenada.length || !inicioRutaCalculada) return [];
    const fin = puntoVueltaRuta();
    return [inicioRutaCalculada, ...rutaOrdenada.map(comercio => ({ lat: Number(comercio.lat), lng: Number(comercio.lng) }))].concat(fin ? [fin] : []);
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
    const indices = new Map(rutaOrdenada.map((comercio, indice) => [comercio.nombre, indice]));
    document.querySelectorAll("#listaRutaOrdenada .paradaOrden").forEach(fila => {
        const hora = fila.querySelector(".horaParada");
        const texto = horas[indices.get(fila.dataset.nombre)];
        if (hora && texto && hora.textContent !== texto) hora.textContent = texto;
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

// La hoja de abajo. Sin ruta: «Ruta de hoy» y «Armar ruta» (con cuántos
// pines marcaste). Con ruta: paradas, tiempo y km, de dónde salís y a qué
// hora volvés o terminás, e Iniciar · Paradas · ⋯.
function dibujarResumenPlan() {
    const pantalla = document.getElementById("pantallaRutas");
    if (!pantalla) return;
    const armada = rutaOrdenada.length > 0;
    pantalla.classList.toggle("conRutaArmada", armada);
    if (!armada) {
        const marcados = obtenerComerciosElegidosParaRuta().length;
        const texto = marcados ? "Marcaste " + marcados + (marcados === 1 ? " comercio" : " comercios") + " en el mapa." : "Todavía no armaste la ruta.";
        const parrafo = document.getElementById("textoVaciaRutas");
        if (parrafo && parrafo.textContent !== texto) parrafo.textContent = texto;
        return;
    }
    dibujarCierranAntesRuta();
    dibujarFaltanDatosRuta();
    const cuenta = cuentaRuta();
    const numeros = document.getElementById("numerosPlanRutas");
    if (numeros) {
        numeros.innerHTML = [
            [String(rutaOrdenada.length), rutaOrdenada.length === 1 ? "parada" : "paradas"],
            [(cuenta.porCalles ? "" : "~") + textoDuracionRuta(cuenta.segundos), cuenta.enParadas ? "con las paradas" : "manejando"],
            [textoKmRuta(cuenta.metros), "de camino"]
        ].map(([valor, nombre]) => `<div class="numeroPlanRutas"><strong>${valor}</strong><small>${nombre}</small></div>`).join("");
    }
    const fin = new Date(Date.now() + cuenta.segundos * 1000);
    const hora = String(fin.getHours()).padStart(2, "0") + ":" + String(fin.getMinutes()).padStart(2, "0");
    const detalle = document.getElementById("detallePlanRutas");
    if (detalle) detalle.innerHTML = window.piezas.esc(textoSalidaRutas(false)) + " · " + (puntoVueltaRuta() ? "volvés " : "terminás ") + "<b>" + hora + "</b>";
}

// Las paradas de la lista (pedido) y «Poner pin» de los que no tienen ubicación.
document.addEventListener("click", evento => {
    const boton = evento.target.closest("#pantallaRutas button");
    if (!boton) return;
    if (boton.classList.contains("pedidoParadaRuta")) {
        if (typeof irAPedidoRapido === "function") irAPedidoRapido(boton.dataset.nombre || "");
        return;
    }
    if (boton.dataset.ponerPin) ponerPinAMano(boton.dataset.ponerPin);
});

// Estadísticas > "Visitas para vender" (2026-11-02): abre Rutas con esos
// comercios y arma el orden más corto.
window.armarRutaConComercios = function (nombres) {
    const lista = (Array.isArray(nombres) ? nombres : []).filter(Boolean);
    if (!lista.length) return;
    rutaOrdenada = [];
    distanciasRuta = [];
    if (typeof mostrarPantalla === "function") mostrarPantalla("rutas");
    armarRutaCon(lista);
};
