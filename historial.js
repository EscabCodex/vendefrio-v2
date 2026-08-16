// =====================================================
// VendeFrio Lite - historial.js
// Historial de pedidos
// =====================================================

const pantallaHistorial = document.getElementById("pantallaHistorial");
const buscarHistorial = document.getElementById("buscarHistorial");
const filtroFechaHistorial = document.getElementById("filtroFechaHistorial");
const resumenHistorial = document.getElementById("resumenHistorial");
const filtroHistorialActivo = document.getElementById("filtroHistorialActivo");
const textoFiltroHistorial = document.getElementById("textoFiltroHistorial");
const limpiarFiltroHistorial = document.getElementById("limpiarFiltroHistorial");

let comercioHistorialActivo = "";
let pedidoHistorialActivo = null;

// -----------------------------------------------------
// UTILIDADES
// -----------------------------------------------------

function crearTextoHistorial(tag, texto, clase = "") {
    const elemento = document.createElement(tag);

    if (clase) elemento.className = clase;

    elemento.textContent = texto;
    return elemento;
}

function obtenerTiposDelPedido(pedido) {
    const texto = String(pedido && pedido.pedido || "");

    return texto
        .split(/\r?\n/)
        .filter(linea => / x\d+\s*$/.test(linea.trim()))
        .length;
}

function obtenerFechaRegistro(pedido) {
    const timestamp = Number(pedido && pedido.timestamp);

    if (Number.isFinite(timestamp) && timestamp > 0) {
        const fecha = new Date(timestamp);
        if (!Number.isNaN(fecha.getTime())) return fecha;
    }

    const partes = String(pedido && pedido.fecha || "").split("/");

    if (partes.length === 3) {
        const fecha = new Date(
            Number(partes[2]),
            Number(partes[1]) - 1,
            Number(partes[0])
        );

        if (!Number.isNaN(fecha.getTime())) return fecha;
    }

    return null;
}

function coincidePeriodoHistorial(pedido, periodo) {
    if (periodo === "todos") return true;

    const fecha = obtenerFechaRegistro(pedido);
    if (!fecha) return false;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (periodo === "hoy") {
        return fecha.toDateString() === hoy.toDateString();
    }

    if (periodo === "semana") {
        return esFechaDeSemanaActual(fecha);
    }

    return true;
}

function obtenerPedidosFiltrados() {
    const texto = normalizarTexto(
        buscarHistorial ? buscarHistorial.value : ""
    );
    const periodo = filtroFechaHistorial
        ? filtroFechaHistorial.value
        : "todos";

    return obtenerHistorial()
        .map((pedido, indice) => ({ pedido, indice }))
        .filter(registro => {
            const comercio = normalizarTexto(registro.pedido.comercio);
            const detalle = normalizarTexto(registro.pedido.pedido);
            const coincideTexto =
                texto === "" ||
                comercio.includes(texto) ||
                detalle.includes(texto);

            const coincideComercioActivo =
                comercioHistorialActivo === "" ||
                comercio === normalizarTexto(comercioHistorialActivo);

            const coincidePedidoActivo =
                pedidoHistorialActivo === null ||
                registro.indice === pedidoHistorialActivo;

            return coincidePedidoActivo && coincideComercioActivo && coincideTexto && coincidePeriodoHistorial(
                registro.pedido,
                periodo
            );
        });
}

function actualizarResumenHistorial(pedidos) {
    if (!resumenHistorial) return;

    const unidades = pedidos.reduce((total, registro) => {
        return total + (Number(registro.pedido.cantidad) || 0);
    }, 0);

    resumenHistorial.textContent =
        "Pedidos encontrados: " +
        pedidos.length +
        "  -  Unidades: " +
        unidades;
}

function actualizarFiltroActivoHistorial() {
    if (!filtroHistorialActivo || !textoFiltroHistorial) return;

    if (pedidoHistorialActivo !== null) {
        filtroHistorialActivo.classList.remove("oculto");
        textoFiltroHistorial.textContent = "Mostrando solamente el pedido seleccionado";
        return;
    }

    if (comercioHistorialActivo === "") {
        filtroHistorialActivo.classList.add("oculto");
        textoFiltroHistorial.textContent = "";
        return;
    }

    filtroHistorialActivo.classList.remove("oculto");
    textoFiltroHistorial.textContent =
        "Mostrando solamente pedidos de: " + comercioHistorialActivo;
}

function abrirHistorialDeComercio(nombre) {
    pedidoHistorialActivo = null;
    comercioHistorialActivo = String(nombre || "").trim();

    if (buscarHistorial) {
        buscarHistorial.value = comercioHistorialActivo;
    }

    if (filtroFechaHistorial) {
        filtroFechaHistorial.value = "todos";
    }

    if (typeof mostrarPantalla === "function") {
        mostrarPantalla("historial");
    } else {
        renderizarHistorial();
    }
}

function abrirHistorialPorPeriodo(periodo) {
    pedidoHistorialActivo = null;
    comercioHistorialActivo = "";

    if (buscarHistorial) {
        buscarHistorial.value = "";
    }

    if (filtroFechaHistorial) {
        filtroFechaHistorial.value = periodo || "todos";
    }

    if (typeof mostrarPantalla === "function") {
        mostrarPantalla("historial");
    } else {
        renderizarHistorial();
    }
}

function abrirHistorialDePedido(indice) {
    const indiceNumerico = Number(indice);
    const historial = obtenerHistorial();

    if (!Number.isInteger(indiceNumerico) || !historial[indiceNumerico]) return;

    pedidoHistorialActivo = indiceNumerico;
    comercioHistorialActivo = "";

    if (buscarHistorial) {
        buscarHistorial.value = "";
    }

    if (filtroFechaHistorial) {
        filtroFechaHistorial.value = "todos";
    }

    if (typeof mostrarPantalla === "function") {
        mostrarPantalla("historial");
    } else {
        renderizarHistorial();
    }
}

// -----------------------------------------------------
// RENDERIZAR HISTORIAL
// -----------------------------------------------------

function renderizarHistorial() {
    if (!pantallaHistorial) return;

    const contenedor = document.getElementById("contenedorHistorial");
    if (!contenedor) return;

    const pedidos = obtenerPedidosFiltrados();
    contenedor.innerHTML = "";

    actualizarResumenHistorial(pedidos);
    actualizarFiltroActivoHistorial();

    if (pedidos.length === 0) {
        const tarjeta = document.createElement("div");
        tarjeta.className = "card historialVacio";

        const hayFiltros = Boolean(
            comercioHistorialActivo !== "" ||
            (buscarHistorial && buscarHistorial.value.trim()) ||
            (filtroFechaHistorial && filtroFechaHistorial.value !== "todos")
        );

        tarjeta.append(
            crearTextoHistorial(
                "h2",
                hayFiltros ? "Sin coincidencias" : "Sin pedidos"
            ),
            crearTextoHistorial(
                "p",
                hayFiltros
                    ? "Prob" +
                        String.fromCodePoint(0xE1) +
                        " con otro comercio o per" +
                        String.fromCodePoint(0xED) +
                        "odo."
                    : "Todav\u00eda no realizaste ning\u00fan pedido."
            )
        );

        contenedor.appendChild(tarjeta);
        return;
    }

    pedidos.forEach(registro => {
        const pedido = registro.pedido;
        const indice = registro.indice;
        const comercio = String(pedido.comercio || "SIN NOMBRE").trim();
        const fecha = String(pedido.fecha || "Sin fecha");
        const cantidad = Number(pedido.cantidad) || 0;
        const tipos = obtenerTiposDelPedido(pedido);

        const tarjeta = document.createElement("div");
        tarjeta.className = "card historialCard";

        const cabecera = document.createElement("div");
        cabecera.className = "cabeceraCard";

        const avatar = document.createElement("div");
        avatar.className = "avatar";
        avatar.style.background = colorAvatar(comercio);
        avatar.textContent = iniciales(comercio);

        const informacion = document.createElement("div");
        informacion.className = "infoCard";

        const titulo = crearTextoHistorial("h3", comercio);
        const resumen = crearTextoHistorial(
            "p",
            "\ud83d\udcc5 " +
                fecha +
                "  \u00b7  \ud83d\udce6 " +
                cantidad +
                " unidades  \u00b7  " +
                String.fromCodePoint(0x1F9FE) +
                " " +
                tipos +
                " productos diferentes",
            "subtitulo"
        );

        informacion.append(titulo, resumen);
        cabecera.append(avatar, informacion);

        const acciones = document.createElement("div");
        acciones.className = "accionesHistorial";

        const botonVer = document.createElement("button");
        botonVer.type = "button";
        botonVer.className = "btnAccion ver verPedido";
        botonVer.dataset.indice = String(indice);
        botonVer.textContent = "\ud83d\udc41\ufe0f Ver pedido";

        const botonEliminar = document.createElement("button");
        botonEliminar.type = "button";
        botonEliminar.className = "btnAccion eliminar eliminarPedidoHistorial";
        botonEliminar.dataset.indice = String(indice);
        botonEliminar.textContent = "\ud83d\uddd1\ufe0f Eliminar";

        acciones.append(botonVer, botonEliminar);
        tarjeta.append(cabecera, acciones);
        contenedor.appendChild(tarjeta);
    });
}

// -----------------------------------------------------
// FILTROS
// -----------------------------------------------------

if (buscarHistorial) {
    buscarHistorial.addEventListener("input", renderizarHistorial);
}

if (filtroFechaHistorial) {
    filtroFechaHistorial.addEventListener("change", renderizarHistorial);
}

if (limpiarFiltroHistorial) {
    limpiarFiltroHistorial.addEventListener("click", () => {
        comercioHistorialActivo = "";
        pedidoHistorialActivo = null;

        if (buscarHistorial) {
            buscarHistorial.value = "";
        }

        renderizarHistorial();
    });
}

// -----------------------------------------------------
// ACCIONES DEL HISTORIAL
// -----------------------------------------------------

if (pantallaHistorial) {
    pantallaHistorial.addEventListener("click", event => {
        const boton = event.target.closest("button");
        if (!boton) return;

        if (boton.classList.contains("verPedido")) {
            const indice = Number(boton.dataset.indice);
            const historial = obtenerHistorial();
            const pedido = historial[indice];

            if (!pedido) return;

            ultimoPedidoTexto = String(pedido.pedido || "");

            if (pedidoCliente) {
                pedidoCliente.textContent = pedido.comercio || "SIN NOMBRE";
            }

            if (pedidoCantidad) {
                pedidoCantidad.textContent = String(Number(pedido.cantidad) || 0);
            }

            if (typeof mostrarVistaPreviaPedido === "function") {
                mostrarVistaPreviaPedido(ultimoPedidoTexto);
            } else if (pedidoDetalle) {
                pedidoDetalle.textContent = ultimoPedidoTexto;
            }

            if (modalPedido) modalPedido.classList.remove("oculto");
            return;
        }

        if (boton.classList.contains("eliminarPedidoHistorial")) {
            const indice = Number(boton.dataset.indice);

            abrirConfirmacion(
                "Eliminar pedido",
                "\u00bfSeguro que quer\u00e9s eliminar este pedido del historial?",
                () => {
                    eliminarHistorial(indice);
                    renderizarHistorial();

                    if (typeof actualizarDashboard === "function") {
                        actualizarDashboard();
                    }
                }
            );
        }
    });
}