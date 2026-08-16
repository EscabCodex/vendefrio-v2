// =====================================================
// VendeFrio Lite - comerciosAdmin.js
// Administracion de comercios
// =====================================================

const listaComerciosAdmin = document.getElementById("listaComerciosAdmin");
const buscarComercio = document.getElementById("buscarComercio");
const filtroEstadoComercios = document.getElementById("filtroEstadoComercios");
const resumenComercios = document.getElementById("resumenComercios");
const botonAgregar = document.getElementById("agregarComercio");

const modal = document.getElementById("modal");
const modalTitulo = document.getElementById("modalTitulo");
const modalNombre = document.getElementById("modalNombre");
const modalDireccion = document.getElementById("modalDireccion");
const modalEnlaceMaps = document.getElementById("modalEnlaceMaps");
const modalTelefono = document.getElementById("modalTelefono");
const guardarModal = document.getElementById("guardarModal");
const cancelarModal = document.getElementById("cancelarModal");

const modalConfirmacion = document.getElementById("modalConfirmacion");
const tituloConfirmacion = document.getElementById("tituloConfirmacion");
const mensajeConfirmacion = document.getElementById("mensajeConfirmacion");
const cancelarConfirmacion = document.getElementById("cancelarConfirmacion");
const aceptarConfirmacion = document.getElementById("aceptarConfirmacion");

let comercioSeleccionado = null;
let accionConfirmada = null;

function actualizarDatalist() {
    const lista = document.getElementById("listaComercios");
    if (!lista) return;

    lista.innerHTML = "";

    obtenerComercios()
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
        .forEach(comercio => {
            const option = document.createElement("option");
            option.value = comercio.nombre;
            lista.appendChild(option);
        });
}

function estaVisitadoEstaSemana(comercio) {
    return comercioEstaVisitadoEstaSemana(comercio);
}

function actualizarResumenComercios(comercios) {
    if (!resumenComercios) return;

    const visitados = comercios.filter(estaVisitadoEstaSemana).length;
    const pendientes = comercios.length - visitados;

    resumenComercios.textContent =
        "Comercios: " +
        comercios.length +
        "  -  Pendientes: " +
        pendientes +
        "  -  Visitados: " +
        visitados;
}

function crearBotonComercio(clase, texto, nombre) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btnAccion " + clase;
    boton.dataset.nombre = nombre;
    boton.textContent = texto;
    return boton;
}

function extraerCoordenadasDeMaps(enlace) {
    const texto = String(enlace || "").trim();
    if (!texto) return null;

    let decodificado = texto;
    try {
        decodificado = decodeURIComponent(texto);
    } catch (error) {
        decodificado = texto;
    }

    const patrones = [
        /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
        /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
        /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/
    ];

    for (const patron of patrones) {
        const coincidencia = decodificado.match(patron);
        if (!coincidencia) continue;

        const lat = Number(coincidencia[1]);
        const lng = Number(coincidencia[2]);

        if (
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            lat >= -90 &&
            lat <= 90 &&
            lng >= -180 &&
            lng <= 180
        ) {
            return { lat, lng };
        }
    }

    return null;
}

async function resolverEnlaceMaps(enlace) {
    const respuesta = await fetch(
        "/api/resolver-maps?url=" + encodeURIComponent(enlace)
    );

    if (!respuesta.ok) {
        throw new Error("No se pudo resolver el enlace");
    }

    const datos = await respuesta.json();
    if (!datos || datos.ok !== true) {
        throw new Error("La respuesta no contiene datos v\u00e1lidos");
    }

    return datos;
}

function obtenerEnlaceMapsComercio(comercio) {
    if (!comercio) return "";

    if (comercio.enlaceMaps) {
        return comercio.enlaceMaps;
    }

    if (comercio.direccion) {
        return "https://www.google.com/maps/search/?api=1&query=" +
            encodeURIComponent(comercio.direccion);
    }

    return "";
}

function abrirMapsComercio(nombre) {
    const comercio = buscarComercioPorNombre(nombre);
    const enlace = obtenerEnlaceMapsComercio(comercio);

    if (!enlace) {
        mostrarAviso(
            "Sin ubicaci\u00f3n",
            "Este comercio no tiene una direcci\u00f3n ni un enlace de Google Maps guardado."
        );
        return;
    }

    window.open(enlace, "_blank", "noopener,noreferrer");
}

function marcarVisitaManual(nombre) {
    const comercios = obtenerComercios();
    const comercio = buscarComercioPorNombre(nombre, comercios);

    if (!comercio) return;

    comercio.ultimaVisita = new Date().toLocaleDateString("es-AR");
    comercio.pendienteSemana = false;

    if (!guardarComercios(comercios)) {
        return;
    }

    renderizarComercios();

    if (typeof actualizarDashboard === "function") {
        actualizarDashboard();
    }

    mostrarAviso(
        "Visita registrada",
        "Se marc\u00f3 " + nombre + " como visitado hoy."
    );
}

function marcarPendienteManual(nombre) {
    const comercios = obtenerComercios();
    const comercio = buscarComercioPorNombre(nombre, comercios);

    if (!comercio) return;

    comercio.pendienteSemana = true;

    if (!guardarComercios(comercios)) {
        return;
    }

    renderizarComercios();

    if (typeof actualizarDashboard === "function") {
        actualizarDashboard();
    }

    mostrarAviso(
        "Comercio pendiente",
        nombre + " volver\u00e1 a aparecer entre los pendientes de esta semana."
    );
}

function renderizarComercios() {
    if (!listaComerciosAdmin) return;

    const todosLosComercios = obtenerComercios();
    actualizarResumenComercios(todosLosComercios);

    const texto = buscarComercio ? buscarComercio.value : "";
    const filtro = filtroEstadoComercios
        ? filtroEstadoComercios.value
        : "todos";
    const filtroNormalizado = normalizarTexto(texto);

    const comercios = todosLosComercios
        .filter(comercio => {
            const coincideTexto = normalizarTexto(comercio.nombre)
                .includes(filtroNormalizado);
            const visitado = estaVisitadoEstaSemana(comercio);

            const coincideEstado =
                filtro === "todos" ||
                (filtro === "visitados" && visitado) ||
                (filtro === "pendientes" && !visitado);

            return coincideTexto && coincideEstado;
        })
        .sort((a, b) => {
            const pendienteA = !estaVisitadoEstaSemana(a);
            const pendienteB = !estaVisitadoEstaSemana(b);

            if (pendienteA !== pendienteB) {
                return pendienteA ? -1 : 1;
            }

            return a.nombre.localeCompare(b.nombre, "es");
        });

    listaComerciosAdmin.innerHTML = "";

    if (comercios.length === 0) {
        const vacio = document.createElement("div");
        vacio.className = "card historialVacio";
        vacio.innerHTML = "<h2>Sin coincidencias</h2><p>No hay comercios con este filtro.</p>";
        listaComerciosAdmin.appendChild(vacio);
        return;
    }

    comercios.forEach(comercio => {
        const card = document.createElement("div");
        card.className = "card comercioCard";

        const cabecera = document.createElement("div");
        cabecera.className = "cabeceraCard";

        const avatar = document.createElement("div");
        avatar.className = "avatar";
        avatar.style.background = colorAvatar(comercio.nombre);
        avatar.textContent = iniciales(comercio.nombre);

        const informacion = document.createElement("div");
        informacion.className = "infoCard";

        const titulo = document.createElement("h3");
        titulo.textContent = comercio.nombre;

        const datosComercio = document.createElement("div");
        datosComercio.className = "datosComercioGrid";

        const pedidos = document.createElement("span");
        pedidos.className = "datoComercio";
        pedidos.textContent =
            "\ud83d\udce6 " +
            (comercio.pedidosRealizados || 0) +
            " pedidos";

        const ultimaVisita = document.createElement("span");
        ultimaVisita.className = "datoComercio";
        ultimaVisita.textContent =
            "\ud83d\udcc5 " +
            (comercio.ultimaVisita || "Nunca");

        const direccion = document.createElement("span");
        direccion.className = "datoComercio";
        direccion.textContent = comercio.direccion
            ? "\ud83d\udccd " + comercio.direccion
            : "";

        const telefono = document.createElement("span");
        telefono.className = "datoComercio";
        telefono.textContent = comercio.telefono
            ? "\ud83d\udcde " + comercio.telefono
            : "";

        datosComercio.append(
            pedidos,
            ultimaVisita,
            direccion,
            telefono
        );

        const visitado = estaVisitadoEstaSemana(comercio);
        const estado = document.createElement("span");
        estado.className = visitado
            ? "badge badge-visitado"
            : "badge badge-pendiente";
        estado.textContent = visitado
            ? "\u2705 Visitado esta semana"
            : "\ud83d\udd34 Pendiente esta semana";

        informacion.append(titulo, datosComercio, estado);
        cabecera.append(avatar, informacion);
        card.appendChild(cabecera);

        const acciones = document.createElement("div");
        acciones.className = "accionesComercio";
        acciones.append(
            crearBotonComercio(
                "agregar pedidoComercioBtn",
                "\ud83d\udcdd Pedido",
                comercio.nombre
            ),
            crearBotonComercio(
                "ver historialComercioBtn",
                "\ud83e\uddfE Historial",
                comercio.nombre
            ),
            crearBotonComercio(
                "editar editarBtn",
                "\u270f\ufe0f Editar",
                comercio.nombre
            ),
            crearBotonComercio(
                "eliminar eliminarBtn",
                "\ud83d\uddd1\ufe0f Eliminar",
                comercio.nombre
            )
        );

        if (comercio.enlaceMaps || comercio.direccion) {
            acciones.insertBefore(
                crearBotonComercio(
                    "ver abrirMapsBtn",
                    "\ud83d\udccd Maps",
                    comercio.nombre
                ),
                acciones.children[2]
            );
        }

        if (!visitado) {
            acciones.insertBefore(
                crearBotonComercio(
                    "ver marcarVisitaBtn",
                    "\u2705 Marcar visitado",
                    comercio.nombre
                ),
                acciones.children[2]
            );
        } else {
            acciones.insertBefore(
                crearBotonComercio(
                    "secundario marcarPendienteBtn",
                    "\ud83d\udd34 Marcar pendiente",
                    comercio.nombre
                ),
                acciones.children[2]
            );
        }

        card.appendChild(acciones);
        listaComerciosAdmin.appendChild(card);
    });
}

// Alias que utiliza menu.js al abrir la pantalla.
const renderizarComerciosAdmin = renderizarComercios;

if (buscarComercio) {
    buscarComercio.addEventListener("input", renderizarComercios);
}

if (filtroEstadoComercios) {
    filtroEstadoComercios.addEventListener("change", renderizarComercios);
}

function abrirModalNuevo() {
    comercioSeleccionado = null;
    modalTitulo.textContent = "Nuevo Comercio";
    modalNombre.value = "";
    modalDireccion.value = "";
    if (modalEnlaceMaps) modalEnlaceMaps.value = "";
    modalTelefono.value = "";
    modal.classList.remove("oculto");
}

function abrirModalEditar(comercio) {
    comercioSeleccionado = comercio;
    modalTitulo.textContent = "Editar Comercio";
    modalNombre.value = comercio.nombre;
    modalDireccion.value = comercio.direccion || "";
    if (modalEnlaceMaps) modalEnlaceMaps.value = comercio.enlaceMaps || "";
    modalTelefono.value = comercio.telefono || "";
    modal.classList.remove("oculto");
}

function cerrarModal() {
    if (modal) modal.classList.add("oculto");
}

if (cancelarModal) cancelarModal.onclick = cerrarModal;

if (guardarModal) {
    guardarModal.onclick = async () => {
        const nombre = modalNombre.value.trim();
        let direccion = modalDireccion.value.trim();
        const enlaceMaps = modalEnlaceMaps
            ? modalEnlaceMaps.value.trim()
            : "";
        const telefono = modalTelefono.value.trim();

        if (!nombre) {
            mostrarAviso(
                "Falta el nombre",
                "Ingres\u00e1 un nombre antes de guardar el comercio."
            );
            return;
        }

        let coordenadasMaps = extraerCoordenadasDeMaps(enlaceMaps);
        let datosMapsRemotos = null;

        if (enlaceMaps && !coordenadasMaps) {
            try {
                datosMapsRemotos = await resolverEnlaceMaps(enlaceMaps);

                if (!direccion && datosMapsRemotos.direccion) {
                    direccion = datosMapsRemotos.direccion;
                }

                if (
                    datosMapsRemotos.lat !== null &&
                    datosMapsRemotos.lng !== null
                ) {
                    coordenadasMaps = {
                        lat: Number(datosMapsRemotos.lat),
                        lng: Number(datosMapsRemotos.lng)
                    };
                }
            } catch (error) {
                datosMapsRemotos = null;
            }
        }

        let guardado;

        if (comercioSeleccionado === null) {
            guardado = agregarComercio({
                nombre,
                direccion,
                enlaceMaps,
                telefono,
                lat: coordenadasMaps ? coordenadasMaps.lat : "",
                lng: coordenadasMaps ? coordenadasMaps.lng : "",
                pedidosRealizados: 0,
                ultimaVisita: ""
            });

            if (!guardado) {
                mostrarAviso(
                    "Comercio no creado",
                    "Ese comercio ya existe o el nombre no es v\u00e1lido."
                );
                return;
            }
        } else {
            const datosActualizacion = {
                nombre,
                direccion,
                enlaceMaps,
                telefono
            };

            if (coordenadasMaps) {
                datosActualizacion.lat = coordenadasMaps.lat;
                datosActualizacion.lng = coordenadasMaps.lng;
            }

            guardado = actualizarComercio(
                comercioSeleccionado.nombre,
                datosActualizacion
            );

            if (!guardado) {
                mostrarAviso(
                    "Comercio no modificado",
                    "No se pudo guardar. Revis\u00e1 que el nombre no est\u00e9 repetido."
                );
                return;
            }
        }

        cerrarModal();

        if (coordenadasMaps) {
            mostrarAviso(
                "Ubicaci\u00f3n detectada",
                "Se guardaron autom\u00e1ticamente las coordenadas encontradas en el enlace de Maps."
            );
        }

        actualizarDatalist();
        renderizarComercios();
        if (typeof actualizarDashboard === "function") actualizarDashboard();
    };
}

if (botonAgregar) botonAgregar.onclick = abrirModalNuevo;

if (listaComerciosAdmin) {
    listaComerciosAdmin.addEventListener("click", event => {
        const elemento = event.target.closest("button");
        if (!elemento) return;

        const nombre = elemento.dataset.nombre;
        if (!nombre) return;

        if (elemento.classList.contains("pedidoComercioBtn")) {
            if (typeof irAPedidoRapido === "function") {
                irAPedidoRapido(nombre);
            }
            return;
        }

        if (elemento.classList.contains("marcarVisitaBtn")) {
            marcarVisitaManual(nombre);
            return;
        }

        if (elemento.classList.contains("marcarPendienteBtn")) {
            if (typeof abrirConfirmacion === "function") {
                abrirConfirmacion(
                    "Marcar pendiente",
                    "El comercio volver\u00e1 a aparecer como pendiente esta semana.",
                    () => marcarPendienteManual(nombre)
                );
            } else {
                marcarPendienteManual(nombre);
            }
            return;
        }

        if (elemento.classList.contains("historialComercioBtn")) {
            if (typeof abrirHistorialDeComercio === "function") {
                abrirHistorialDeComercio(nombre);
            }
            return;
        }

        if (elemento.classList.contains("abrirMapsBtn")) {
            abrirMapsComercio(nombre);
            return;
        }

        if (elemento.classList.contains("editarBtn")) {
            const comercio = buscarComercioPorNombre(nombre);
            if (comercio) abrirModalEditar(comercio);
            return;
        }

        if (elemento.classList.contains("eliminarBtn")) {
            abrirConfirmacion(
                "Eliminar comercio",
                "\u00bfEliminar \"" + nombre + "\"?",
                () => {
                    eliminarComercio(nombre);
                    actualizarDatalist();
                    renderizarComercios();
                    if (typeof actualizarDashboard === "function") actualizarDashboard();
                }
            );
        }
    });
}

if (modal) {
    modal.addEventListener("click", event => {
        if (event.target === modal) cerrarModal();
    });
}

function abrirConfirmacion(titulo, mensaje, accion) {
    tituloConfirmacion.textContent = titulo;
    mensajeConfirmacion.textContent = mensaje;
    accionConfirmada = accion;
    modalConfirmacion.classList.remove("oculto");
}

function cerrarConfirmacion() {
    modalConfirmacion.classList.add("oculto");
    accionConfirmada = null;
}

if (cancelarConfirmacion) cancelarConfirmacion.onclick = cerrarConfirmacion;

if (aceptarConfirmacion) {
    aceptarConfirmacion.onclick = () => {
        const accion = accionConfirmada;
        cerrarConfirmacion();
        if (accion) accion();
    };
}

if (modalConfirmacion) {
    modalConfirmacion.addEventListener("click", event => {
        if (event.target === modalConfirmacion) cerrarConfirmacion();
    });
}

document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    cerrarModal();
    cerrarConfirmacion();
    if (typeof cerrarModalProducto === "function") cerrarModalProducto();
});

actualizarDatalist();
renderizarComercios();