// =====================================================
// VendeFr\u00edo Lite - rutas.js
// Mapa, GPS y planificaci\u00f3n de rutas
// =====================================================

let mapaLeaflet = null;
let capaMarcadores = null;
let rutaOrdenada = [];
let distanciasRuta = [];
let comerciosSeleccionadosRuta = new Set();
let seleccionRutaInicializada = false;
let modoPinManual = false;
let marcadorPinManual = null;
let coordenadasPinPendientes = null;
let marcadoresPorNombre = new Map();
let coordenadasPinOriginales = null;
let tipoEdicionPin = "nuevo";
let rutaGuardadaEnEdicion = null;

function actualizarResumenRuta() {
    const resumen = document.getElementById("resumenRuta");
    if (!resumen) return;

    const comercios = obtenerComercios();
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
    const botonEditar = document.createElement("button");

    nombre.textContent = comercio.nombre || "Sin nombre";
    direccion.textContent = comercio.direccion || "Sin direcci\u00f3n";
    botonEditar.type = "button";
    botonEditar.className = "btnEditarPinMapa";
    botonEditar.dataset.nombre = comercio.nombre || "";
    botonEditar.textContent = "Editar ubicaci\u00f3n";

    contenido.append(nombre, salto, direccion, botonEditar);
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
    renderizarPines();
}

function crearControlesPinManual() {
    const botonGuardar = document.getElementById("btnGuardarGps");
    if (!botonGuardar || document.getElementById("btnPinManual")) return;

    const boton = document.createElement("button");
    boton.id = "btnPinManual";
    boton.type = "button";
    boton.className = "btnAccion botonPinManual";
    boton.textContent = "\ud83d\udccc Colocar pin manual en el mapa";
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

        if (!agregarRutaGuardada(nuevoNombre, ruta.comercios)) {
            mostrarAviso("No se pudo guardar", "Prob\u00e1 nuevamente.");
            return;
        }

        if (normalizarTexto(nombreOriginal) !== normalizarTexto(nuevoNombre)) {
            eliminarRutaGuardada(nombreOriginal);
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
        if (entrada) entrada.value = nuevoNombre;
        const panel = document.getElementById("rutasGuardadasPanel");
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

function crearControlesRutasGuardadas() {
    const tarjeta = document.querySelector(".tarjetaSeleccionRuta");
    if (!tarjeta || document.getElementById("rutasGuardadasPanel")) return;

    const panel = document.createElement("div");
    panel.id = "rutasGuardadasPanel";
    panel.className = "rutasGuardadasPanel";

    const titulo = document.createElement("h3");
    titulo.textContent = "Rutas guardadas";

    const ayuda = document.createElement("p");
    ayuda.textContent = "Guard\u00e1 esta selecci\u00f3n para volver a usarla m\u00e1s adelante.";

    const fila = document.createElement("div");
    fila.className = "filaRutaGuardada";

    const entrada = document.createElement("input");
    entrada.id = "nombreRutaGuardada";
    entrada.type = "text";
    entrada.placeholder = "Ej.: Ruta lunes";

    const botonGuardar = document.createElement("button");
    botonGuardar.id = "guardarRutaActual";
    botonGuardar.type = "button";
    botonGuardar.className = "btnAccion agregar";
    botonGuardar.textContent = "Guardar";
    botonGuardar.addEventListener("click", guardarRutaActual);

    fila.append(entrada, botonGuardar);

    const lista = document.createElement("div");
    lista.id = "listaRutasGuardadas";
    lista.className = "listaRutasGuardadas";

    panel.append(titulo, ayuda, fila, lista);
    tarjeta.appendChild(panel);
    renderizarRutasGuardadas();
}

function guardarRutaActual() {
    const entrada = document.getElementById("nombreRutaGuardada");
    const nombre = entrada ? entrada.value.trim() : "";
    const comercios = Array.from(comerciosSeleccionadosRuta);

    if (!nombre) {
        mostrarAviso("Falta el nombre", "Escrib\u00ed un nombre para identificar esta ruta.");
        return;
    }

    if (comercios.length === 0) {
        mostrarAviso("Sin comercios seleccionados", "Seleccion\u00e1 al menos un comercio antes de guardar la ruta.");
        return;
    }

    if (!agregarRutaGuardada(nombre, comercios)) {
        mostrarAviso("No se pudo guardar", "Prob\u00e1 nuevamente.");
        return;
    }

    if (
        rutaGuardadaEnEdicion &&
        normalizarTexto(rutaGuardadaEnEdicion) !== normalizarTexto(nombre)
    ) {
        eliminarRutaGuardada(rutaGuardadaEnEdicion);
    }

    rutaGuardadaEnEdicion = null;

    if (entrada) entrada.value = "";
    renderizarRutasGuardadas();
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
        if (!eliminarRutaGuardada(nombre)) return;
        renderizarRutasGuardadas();
        mostrarAviso("Ruta eliminada", "Se elimin\u00f3 la ruta guardada.");
    };

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
        const cantidad = document.createElement("small");
        cantidad.textContent = ruta.comercios.length + " comercio(s)";
        datos.append(nombre, cantidad);

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

    obtenerComercios()
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
        .forEach(comercio => {
            const opcion = document.createElement("option");
            opcion.value = comercio.nombre;
            opcion.textContent =
                comercio.nombre +
                " " +
                (
                    comercioTieneGps(comercio)
                        ? "\ud83d\udccd (GPS listo)"
                        : "\u26a0\ufe0f (Sin GPS)"
                );

            select.appendChild(opcion);
        });

    if (valorSeleccionado) {
        select.value = valorSeleccionado;
    }
}

function obtenerComerciosSeleccionRuta() {
    return obtenerComercios()
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

    estado.textContent =
        seleccionados.length +
        " seleccionados - " +
        conGps +
        " con GPS - " +
        sinGps +
        " sin GPS";
}

function renderizarSeleccionRuta() {
    const contenedor = document.getElementById("listaSeleccionRuta");
    if (!contenedor) return;

    contenedor.innerHTML = "";

    obtenerComerciosSeleccionRuta().forEach(comercio => {
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
            actualizarEstadoSeleccionRuta();
        });

        const texto = document.createElement("span");
        texto.textContent = comercio.nombre;

        const estado = document.createElement("small");
        estado.textContent = comercioTieneGps(comercio)
            ? "GPS listo"
            : "Sin GPS";
        estado.className = comercioTieneGps(comercio)
            ? "seleccionRutaGps"
            : "seleccionRutaSinGps";

        etiqueta.append(checkbox, texto, estado);
        contenedor.appendChild(etiqueta);
    });

    actualizarEstadoSeleccionRuta();
}

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
    renderizarSeleccionRuta();
}

function seleccionarPendientesRuta() {
    comerciosSeleccionadosRuta.clear();
    obtenerComerciosSeleccionRuta()
        .filter(comercio => !comercioEstaVisitadoEstaSemana(comercio))
        .forEach(comercio => comerciosSeleccionadosRuta.add(comercio.nombre));
    renderizarSeleccionRuta();
}

function limpiarSeleccionRuta() {
    comerciosSeleccionadosRuta.clear();
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
    if (boton) boton.textContent = "\ud83d\udccd Toc\u00e1 el punto exacto en el mapa";

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
    if (boton) boton.textContent = "\ud83d\udccc Colocar pin manual en el mapa";
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

function guardarPinManual() {
    const select = document.getElementById("selectComercioGps");
    const nombre = select ? select.value : "";

    if (!nombre || !coordenadasPinPendientes) return;

    const guardado = actualizarComercio(nombre, {
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

function editarPinGuardado(nombre) {
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

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution: "\u00a9 OpenStreetMap"
        }
    ).addTo(mapaLeaflet);

    capaMarcadores = L.layerGroup().addTo(mapaLeaflet);
    mapaLeaflet.on("click", manejarClickMapaManual);
}

function renderizarPines() {
    if (!mapaLeaflet || !capaMarcadores) return;

    capaMarcadores.clearLayers();
    marcadoresPorNombre.clear();

    const comerciosConGps = obtenerComercios().filter(
        comercioTieneGps
    );

    if (comerciosConGps.length === 0) return;

    const limites = L.latLngBounds();

    comerciosConGps.forEach(comercio => {
        const coordenadas = [
            Number(comercio.lat),
            Number(comercio.lng)
        ];

        const marcador = L.marker(coordenadas).bindPopup(
            crearPopupComercio(comercio)
        );

        capaMarcadores.addLayer(marcador);
        marcadoresPorNombre.set(comercio.nombre, marcador);
        limites.extend(coordenadas);
    });

    mapaLeaflet.fitBounds(limites, {
        padding: [30, 30]
    });
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
        "\ud83d\udccd Guardar mi GPS actual en este comercio";

    boton.disabled = true;
    boton.textContent = "\ud83d\udccd Obteniendo GPS...";

    navigator.geolocation.getCurrentPosition(
        posicion => {
            const guardado = actualizarComercio(
                nombre,
                {
                    lat: posicion.coords.latitude,
                    lng: posicion.coords.longitude,
                    origenGps: "gps"
                }
            );

            boton.disabled = false;
            boton.textContent = textoOriginal;

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
            boton.textContent = textoOriginal;

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
        const guardado = actualizarComercio(
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

            mostrarAviso(
                "Ruta m\u00ednima calculada",
                "Se revisaron todas las combinaciones posibles. Primera parada: " +
                    rutaOrdenada[0].nombre
            );

            mostrarRutaEnLista();
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
            : obtenerComercios().filter(
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

    return (distancia / 1000).toFixed(1) + " km totales";
}

function formatearDistanciaRuta(metros, indice) {
    const distancia = Number(metros) || 0;
    const referencia = indice === 0
        ? "desde tu ubicaci" + String.fromCodePoint(0xF3) + "n"
        : "desde la parada anterior";

    if (distancia < 1000) {
        return Math.round(distancia) + " m " + referencia;
    }

    return (distancia / 1000).toFixed(1) + " km " + referencia;
}

function mostrarRutaEnLista() {
    const contenedor = document.getElementById(
        "listaRutaOrdenada"
    );

    if (!contenedor) return;

    contenedor.innerHTML = "";

    const encabezado = document.createElement("div");
    encabezado.className = "encabezadoRuta";

    const titulo = document.createElement("h3");
    const distanciaTotal = distanciasRuta.reduce(
        (total, distancia) => total + (Number(distancia) || 0),
        0
    );
    titulo.textContent = rutaOrdenada.length > 0
        ? "Ruta m\u00ednima exacta - " + formatearDistanciaTotal(distanciaTotal)
        : "Ruta sugerida:";
    encabezado.appendChild(titulo);

    if (rutaOrdenada.length > 0) {
        const botonSiguiente = document.createElement("button");
        botonSiguiente.type = "button";
        botonSiguiente.className = "btnAccion agregar pedidoParadaRuta";
        botonSiguiente.dataset.nombre = rutaOrdenada[0].nombre;
        botonSiguiente.textContent = "\ud83d\udcdd Pedido siguiente";
        encabezado.appendChild(botonSiguiente);
    }

    contenedor.appendChild(encabezado);

    rutaOrdenada.forEach((comercio, indice) => {
        const elemento = document.createElement("div");
        elemento.className = "paradaRuta";

        const informacion = document.createElement("div");
        const nombre = document.createElement("strong");
        nombre.textContent =
            "#" +
            (indice + 1) +
            " - " +
            comercio.nombre;

        const direccion = document.createElement("span");
        direccion.textContent = comercio.direccion || "Sin direcci\u00f3n";

        const distancia = document.createElement("small");
        distancia.textContent = formatearDistanciaRuta(
            distanciasRuta[indice],
            indice
        );

        informacion.append(nombre, direccion, distancia);

        const botonPedido = document.createElement("button");
        botonPedido.type = "button";
        botonPedido.className = "btnAccion ver pedidoParadaRuta";
        botonPedido.dataset.nombre = comercio.nombre;
        botonPedido.textContent = "\ud83d\udcdd Pedido";

        elemento.append(informacion, botonPedido);
        contenedor.appendChild(elemento);
    });
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

    if (boton.id === "btnGoogleMaps") {
        abrirGoogleMaps();
    }
});
