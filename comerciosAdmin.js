// =====================================================
// VendeFrio Lite - comerciosAdmin.js
// Administracion de comercios
// =====================================================

const listaComerciosAdmin = document.getElementById("listaComerciosAdmin");
const buscarComercio = document.getElementById("buscarComercio");
const filtroEstadoComercios = document.getElementById("filtroEstadoComercios");
const resumenComercios = document.getElementById("resumenComercios");
// Todos / Pendientes / Visitados con el número adentro, como en Pedidos
// (repaso de diseño de Comercios). El select oculto sigue mandando.
const filtrosEstadoComercios = document.getElementById("filtrosEstadoComercios");
const cantidadComercios = document.getElementById("cantidadComercios");
const botonAgregar = document.getElementById("agregarComercio");

const modalConfirmacion = document.getElementById("modalConfirmacion");
const tituloConfirmacion = document.getElementById("tituloConfirmacion");
const mensajeConfirmacion = document.getElementById("mensajeConfirmacion");
const cancelarConfirmacion = document.getElementById("cancelarConfirmacion");
const aceptarConfirmacion = document.getElementById("aceptarConfirmacion");

let comercioSeleccionado = null;
let accionConfirmada = null;
let comercioMostradoIndividual = "";

// Es la misma lista que la de Nuevo pedido (#listaComercios): se arma ahí,
// y solo si los comercios cambiaron.
function actualizarDatalist() {
    if (typeof actualizarDatalistPedido === "function") actualizarDatalistPedido();
}

// "Visitados hoy" de Inicio: la última visita es de hoy.
function visitadoHoy(comercio) {
    if (typeof comercioVisitadoHoyInicio === "function") return comercioVisitadoHoyInicio(comercio);
    const fecha = comercio && comercio.ultimaVisita ? obtenerFechaLocalDesdeTexto(comercio.ultimaVisita) : null;
    return Boolean(fecha) && fecha.toDateString() === new Date().toDateString();
}

function estaVisitadoEstaSemana(comercio) {
    return comercioEstaVisitadoEstaSemana(comercio);
}

function actualizarResumenComercios(comercios, fueVisitado = estaVisitadoEstaSemana) {
    const visitados = comercios.filter(fueVisitado).length;
    const pendientes = comercios.length - visitados;

    if (resumenComercios) {
        resumenComercios.textContent =
            comercios.length + (comercios.length === 1 ? " comercio" : " comercios") +
            "  ·  " + pendientes + (pendientes === 1 ? " pendiente" : " pendientes") +
            "  ·  " + visitados + (visitados === 1 ? " visitado" : " visitados") + " esta semana";
    }
    if (filtrosEstadoComercios) {
        const cuentas = { todos: comercios.length, pendientes, visitados };
        const elegido = filtroEstadoComercios ? filtroEstadoComercios.value : "todos";
        // "Visitados hoy" (desde Inicio) marca Visitados; el cartel dice que es de hoy.
        const marcado = elegido === "visitadosHoy" ? "visitados" : elegido;
        filtrosEstadoComercios.querySelectorAll("[data-filtro]").forEach(boton => {
            const activo = boton.dataset.filtro === marcado;
            boton.classList.toggle("activo", activo);
            boton.setAttribute("aria-pressed", String(activo));
            boton.querySelector(".filtroEtapaCantidad").textContent = String(cuentas[boton.dataset.filtro]);
        });
    }
}

if (filtrosEstadoComercios) {
    filtrosEstadoComercios.addEventListener("click", evento => {
        const boton = evento.target.closest("[data-filtro]");
        if (!boton || !filtroEstadoComercios) return;
        filtroEstadoComercios.value = boton.dataset.filtro;
        filtroEstadoComercios.dispatchEvent(new Event("change"));
    });
}

// "hace 3 días", "ayer" u "hoy".
function textoHaceDias(dias) {
    if (dias <= 0) return "hoy";
    if (dias === 1) return "ayer";
    return "hace " + dias + " días";
}

// Días desde una fecha guardada como "28/10/2026".
function diasDesdeFechaGuardada(texto) {
    const partes = String(texto || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!partes) return null;
    const fecha = new Date(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1]));
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((hoy - fecha) / 86400000));
}

function crearBotonComercio(clase, texto, nombre) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btnAccion " + clase;
    boton.dataset.nombre = nombre;
    boton.innerHTML = texto;
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
    const comercio = buscarComercioPorNombre(nombre);

    if (!comercio) return;

    const guardado = actualizarComercioPorId(comercio.id, {
        ultimaVisita: new Date().toLocaleDateString("es-AR"),
        pendienteSemana: false
    });

    if (!guardado) {
        return;
    }

    renderizarComercios();

    if (typeof actualizarDashboard === "function") {
        actualizarDashboard();
    }

    mostrarToast("Se marc\u00f3 " + nombre + " como visitado hoy");
}

function marcarPendienteManual(nombre) {
    const comercio = buscarComercioPorNombre(nombre);

    if (!comercio) return;

    const antes = Boolean(comercio.pendienteSemana);
    if (!actualizarComercioPorId(comercio.id, { pendienteSemana: true })) {
        return;
    }

    renderizarComercios();

    if (typeof actualizarDashboard === "function") {
        actualizarDashboard();
    }

    if (window.piezas) {
        window.piezas.deshacer(nombre + " quedó pendiente esta semana", () => {
            actualizarComercioPorId(comercio.id, { pendienteSemana: antes });
            renderizarComercios();
            if (typeof actualizarDashboard === "function") actualizarDashboard();
        });
        return;
    }

    mostrarAviso(
        "Comercio pendiente",
        nombre + " volver\u00e1 a aparecer entre los pendientes de esta semana."
    );
}

function nombresComercioCompatibles(nombreGuardado, nombreHistorial) {
    const comercio = normalizarTexto(nombreGuardado);
    const historial = normalizarTexto(nombreHistorial);
    if (!comercio || !historial) return false;
    return historial === comercio || historial.startsWith(comercio + " ") || comercio.startsWith(historial + " ");
}

function contarPedidosDelComercio(nombre, historial) {
    return historial.filter(pedido => nombresComercioCompatibles(nombre, pedido.comercio || pedido.cliente)).length;
}

// Lo mismo para toda la lista de una vez (T151): antes se recorría el
// historial entero por cada tarjeta y en cada comparación del orden.
function contarPedidosDeComercios(comercios, historial) {
    // Cuántos pedidos tiene cada nombre escrito en el historial.
    const porNombre = new Map();
    historial.forEach(pedido => {
        const nombre = normalizarTexto(pedido.comercio || pedido.cliente);
        if (nombre) porNombre.set(nombre, (porNombre.get(nombre) || 0) + 1);
    });
    const cuentas = new Map();
    comercios.forEach(comercio => {
        const nombre = normalizarTexto(comercio.nombre);
        let cantidad = 0;
        if (nombre) porNombre.forEach((pedidos, delHistorial) => {
            if (delHistorial === nombre || delHistorial.startsWith(nombre + " ") || nombre.startsWith(delHistorial + " ")) cantidad += pedidos;
        });
        cuentas.set(comercio.nombre, cantidad);
    });
    return cuentas;
}

let verComerciosArchivados = false;

function agregarFilaArchivados(cantidad) {
    if (!cantidad || verComerciosArchivados || !window.piezas) return;
    const fila = document.createElement("button");
    fila.type = "button";
    fila.className = "pzTarjeta pzFila filaComerciosArchivados";
    fila.innerHTML = '<div class="pzIni pzIniAcento">' + window.piezas.ico("archivo", 20) + '</div><div class="pzFilaTxt"><strong>Archivados (' + cantidad + ')</strong><small>Comercios que ya no visitás</small></div>' + window.piezas.ico("chevDerecha", 20);
    fila.addEventListener("click", () => { verComerciosArchivados = true; renderizarComercios(); window.scrollTo(0, 0); });
    listaComerciosAdmin.appendChild(fila);
}

function redibujarComerciosEnTodasPartes() {
    actualizarDatalist();
    renderizarComercios();
    if (typeof actualizarDatalistPedido === "function") actualizarDatalistPedido();
    if (typeof actualizarDashboard === "function") actualizarDashboard();
}

// Archivar en vez de borrar (T63): con "Deshacer" unos segundos.
function archivarComercioConDeshacer(nombre) {
    const comercio = buscarComercioPorNombre(nombre);
    if (!comercio || !archivarComercioPorId(comercio.id, true)) return;
    redibujarComerciosEnTodasPartes();
    if (navigator.vibrate) navigator.vibrate(20);
    window.piezas?.deshacer("“" + comercio.nombre + "” archivado", () => {
        archivarComercioPorId(comercio.id, false);
        redibujarComerciosEnTodasPartes();
    });
}
window.archivarComercioConDeshacer = archivarComercioConDeshacer;

function renderizarComercios() {
    if (!listaComerciosAdmin) return;
    // Con Comercios oculta no se dibuja: mostrarPantalla la dibuja al abrirla (T150).
    if (document.getElementById("pantallaComercios")?.classList.contains("oculto")) return;

    // Archivados (T63): aparte, con "Archivados (N)" al final de la lista.
    const guardados = comerciosParaLeer();
    const archivados = guardados.filter(comercioArchivado);
    if (!archivados.length) verComerciosArchivados = false;
    const todosLosComercios = verComerciosArchivados ? archivados : comerciosActivosParaLeer();
    // Eliminados y cancelados no cuentan (T26). Se cuenta una vez por cada
    // cambio, no en cada letra del buscador.
    const pedidosPorComercio = recordarHastaQueCambie("pedidosPorComercio", ["comercios", "historial"], () => {
        return contarPedidosDeComercios(guardados, pedidosQueCuentanParaLeer());
    });
    // Pidió hace / No pide hace: una vez por cada cambio del historial.
    const perfilesPorComercio = recordarHastaQueCambie("perfilesPorComercio", ["historial"], () => {
        const mapa = new Map();
        if (typeof obtenerPerfilesComerciales === "function") {
            obtenerPerfilesComerciales(pedidosQueCuentanParaLeer()).forEach(perfil => mapa.set(normalizarTexto(perfil.nombre), perfil));
        }
        return mapa;
    });

    const texto = buscarComercio ? buscarComercio.value : "";
    const filtro = filtroEstadoComercios
        ? filtroEstadoComercios.value
        : "todos";
    const filtroNormalizado = normalizarTexto(texto);

    // Visitado o no, una vez por comercio (no en cada comparación del orden).
    const visitados = new Map();
    const fueVisitado = comercio => {
        if (!visitados.has(comercio)) visitados.set(comercio, estaVisitadoEstaSemana(comercio));
        return visitados.get(comercio);
    };
    // Más > Preferencias de trabajo > "Comercios: mostrar primero" (T50).
    const orden = window.preferenciasVendeFrio?.valor("orden") || "pendientes";
    actualizarResumenComercios(verComerciosArchivados ? guardados.filter(comercio => !comercioArchivado(comercio)) : todosLosComercios, fueVisitado);

    const comercios = todosLosComercios
        .filter(comercio => {
            const coincideIndividual = !comercioMostradoIndividual ||
                normalizarTexto(comercio.nombre) === normalizarTexto(comercioMostradoIndividual);
            const coincideTexto = normalizarTexto(comercio.nombre)
                .includes(filtroNormalizado) && coincideIndividual;
            const visitado = fueVisitado(comercio);

            const coincideEstado =
                filtro === "todos" ||
                (filtro === "visitados" && visitado) ||
                (filtro === "visitadosHoy" && visitadoHoy(comercio)) ||
                (filtro === "pendientes" && !visitado);

            return coincideTexto && coincideEstado;
        })
        .sort((a, b) => {
            if (orden === "frecuentes") {
                const diferencia = pedidosPorComercio.get(b.nombre) - pedidosPorComercio.get(a.nombre);
                if (diferencia) return diferencia;
            } else if (orden === "pendientes") {
                const pendienteA = !fueVisitado(a);
                const pendienteB = !fueVisitado(b);

                if (pendienteA !== pendienteB) {
                    return pendienteA ? -1 : 1;
                }
            }

            return ordenAlfabeticoEs.compare(a.nombre, b.nombre);
        });

    if (cantidadComercios) {
        cantidadComercios.textContent = comercios.length + (comercios.length === 1 ? " comercio" : " comercios");
    }

    window.piezas?.cortarTandas(listaComerciosAdmin);
    listaComerciosAdmin.innerHTML = "";

    if (comercioMostradoIndividual) {
        const volver = document.createElement("button");
        volver.type = "button";
        volver.className = "btnAccion secundario volverTodosComerciosBtn";
        volver.textContent = "Mostrar todos los comercios";
        volver.addEventListener("click", limpiarComercioIndividual);
        listaComerciosAdmin.appendChild(volver);
    }

    if (filtro === "visitadosHoy" && !verComerciosArchivados) {
        const cartel = document.createElement("button");
        cartel.type = "button";
        cartel.className = "pzBanner pzBanInfo cartelVisitadosHoy";
        cartel.innerHTML = window.piezas.ico("check", 22) + "<div><strong>Visitados hoy</strong><small>Tocá para ver los de toda la semana.</small></div>" + window.piezas.ico("cerrarX", 18);
        cartel.addEventListener("click", () => {
            filtroEstadoComercios.value = "visitados";
            filtroEstadoComercios.dispatchEvent(new Event("change"));
        });
        listaComerciosAdmin.appendChild(cartel);
    }

    if (verComerciosArchivados) {
        const volver = document.createElement("button");
        volver.type = "button";
        volver.className = "pzBanner pzBanAviso";
        volver.innerHTML = window.piezas.ico("archivo", 22) + "<div><strong>Comercios archivados</strong><small>No aparecen para visitar ni para vender. Tocá para volver a la lista.</small></div>" + window.piezas.ico("cerrarX", 18);
        volver.addEventListener("click", () => { verComerciosArchivados = false; renderizarComercios(); });
        listaComerciosAdmin.appendChild(volver);
    }

    if (comercios.length === 0) {
        const vacio = document.createElement("div");
        vacio.className = "card historialVacio";
        vacio.innerHTML = "<h2>Sin coincidencias</h2><p>No hay comercios con este filtro.</p>";
        listaComerciosAdmin.appendChild(vacio);
        agregarFilaArchivados(archivados.length);
        return;
    }

    // Con muchos comercios se dibujan de a tandas, sin trabar (T151).
    // La tarjeta (repaso de diseño de Comercios): abajo del nombre, un dato
    // por renglón (pedidos, dirección, teléfono, horario); el que falta se
    // agrega ahí mismo. A la derecha: Pendiente, Debe, cuándo pidió y cuándo
    // se lo visitó. Con muchos comercios se dibujan de a tandas (T151).
    const p = window.piezas;
    const dato = (clase, icono, texto) => `<span class="datoComercio ${clase}">${window.icono(icono, 13)} ${p.esc(texto)}</span>`;
    const falta = (campo, texto, nombre) => `<button type="button" class="datoComercio datoFalta agregarDatoBtn" data-campo="${campo}" data-nombre="${p.esc(nombre)}">${window.icono("mas", 13)} ${texto}</button>`;
    const chip = (texto, tono, clase = "") => `<span class="chipEstado ${clase}"${tono ? ` data-tono="${tono}"` : ""}>${p.esc(texto)}</span>`;
    const dibujarComercio = comercio => {
        const card = document.createElement("div");
        card.className = "card comercioCard";
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", "Abrir ficha de " + comercio.nombre);

        const nombre = comercio.nombre;
        const cantidadPedidos = pedidosPorComercio.get(nombre) || 0;
        const textoPedidos = cantidadPedidos + (cantidadPedidos === 1 ? " pedido" : " pedidos");
        const datos = [
            cantidadPedidos
                ? `<button type="button" class="datoComercio datoPedidos historialComercioBtn" data-nombre="${p.esc(nombre)}" aria-label="Ver los ${textoPedidos} de ${p.esc(nombre)}">${window.icono("paquete", 13)} ${textoPedidos}</button>`
                : dato("datoPedidos", "paquete", "Sin pedidos"),
            comercio.direccion ? dato("datoDireccion", "ubicacion", comercio.direccion) : falta("direccion", "Agregar dirección", nombre),
            comercio.telefono ? dato("datoTelefono", "telefono", comercio.telefono) : falta("telefono", "Agregar teléfono", nombre),
            comercio.horario ? dato("datoHorario", "alarma", comercio.horario) : falta("horario", "Agregar horario", nombre)
        ];

        const visitado = fueVisitado(comercio);
        const chips = [];
        if (comercioArchivado(comercio)) chips.push(chip("Archivado", "", "estadoComercio"));
        else chips.push(chip(visitado ? "Visitado" : "Pendiente", visitado ? "ok" : "aviso", "estadoComercio"));
        // Lo que debe (informe del desconocido; solo para quien cobra, lo calcula "A cobrar").
        const debe = window.saldosVendeFrio?.deudaDe?.(nombre) || 0;
        if (debe > 0) chips.push(chip("Debe " + p.plata(debe), "peligro", "chipDebe"));
        const perfil = perfilesPorComercio.get(normalizarTexto(nombre));
        if (perfil) chips.push(chip((perfil.atrasado ? "No pide " : "Pidió ") + textoHaceDias(perfil.diasDesdeUltimo), perfil.atrasado ? "aviso" : "", "chipGris chipPidio"));
        else chips.push(chip("Nunca pidió", "", "chipGris chipPidio"));
        const diasVisita = diasDesdeFechaGuardada(comercio.ultimaVisita);
        chips.push(chip(diasVisita === null ? "Nunca visitado" : "Visita " + textoHaceDias(diasVisita), "", "chipGris chipVisita"));

        card.innerHTML = `<div class="cabeceraCard">
                <div class="avatar" style="background:${colorAvatar(nombre)}">${p.esc(iniciales(nombre))}</div>
                <div class="infoCard">
                    <div class="filaTituloComercio"><h3>${p.esc(nombre)}</h3></div>
                    <div class="datosComercioGrid">${datos.join("")}</div>
                </div>
                <div class="chipsComercio">${chips.join("")}</div>
            </div>`;
        return card;
    };
    const dibujarTodo = () => {
        comercios.forEach(comercio => listaComerciosAdmin.appendChild(dibujarComercio(comercio)));
        agregarFilaArchivados(archivados.length);
    };
    if (window.piezas?.dibujarDeATandas) {
        window.piezas.dibujarDeATandas(listaComerciosAdmin, comercios, dibujarComercio, { alTerminar: () => agregarFilaArchivados(archivados.length) });
    } else dibujarTodo();
}

// Alias que utiliza menu.js al abrir la pantalla.
const renderizarComerciosAdmin = renderizarComercios;

if (buscarComercio) {
    buscarComercio.addEventListener("input", renderizarComercios);
}

if (filtroEstadoComercios) {
    filtroEstadoComercios.addEventListener("change", renderizarComercios);
}

// Agregar y editar usan la hoja única "Datos del comercio" (datosComercio.js).
function abrirModalNuevo() {
    window.datosComercioVendeFrio?.nuevo();
}

function abrirModalEditar(comercio, campo) {
    if (comercio) window.datosComercioVendeFrio?.editar(comercio.nombre, { campo });
}

function mostrarComercioIndividual(nombre) {
    comercioMostradoIndividual = String(nombre || "").trim();
    if (buscarComercio) buscarComercio.value = "";
    if (filtroEstadoComercios) filtroEstadoComercios.value = "todos";

    if (typeof mostrarPantalla === "function") {
        mostrarPantalla("comercios");
    } else {
        renderizarComercios();
    }
}

// Inicio (visitados, sin visitar): la lista entera, no la de un solo
// comercio (la deja Historial) ni la de archivados.
function verTodaLaListaDeComercios() {
    comercioMostradoIndividual = "";
    verComerciosArchivados = false;
}

function limpiarComercioIndividual() {
    comercioMostradoIndividual = "";
    renderizarComercios();
}

if (botonAgregar) botonAgregar.onclick = abrirModalNuevo;

if (listaComerciosAdmin) {
    listaComerciosAdmin.addEventListener("click", event => {
        const elemento = event.target.closest("button");
        if (!elemento) return;

        const nombre = elemento.dataset.nombre;
        if (!nombre) return;

        if (elemento.classList.contains("agregarDatoBtn")) {
            window.abrirDatosComercio?.(nombre, elemento.dataset.campo);
            return;
        }

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
            // Etapa 8: sin "¿Seguro?"; marcarPendienteManual deja "Deshacer".
            marcarPendienteManual(nombre);
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

        if (elemento.classList.contains("archivarComercioBtn")) {
            archivarComercioConDeshacer(nombre);
            return;
        }

        if (elemento.classList.contains("recuperarComercioBtn")) {
            const comercio = buscarComercioPorNombre(nombre);
            if (comercio) archivarComercioPorId(comercio.id, false);
            redibujarComerciosEnTodasPartes();
            mostrarToast("Comercio recuperado");
            return;
        }

        if (elemento.classList.contains("eliminarBtn")) {
            abrirConfirmacion(
                "Eliminar para siempre",
                "Se borra \"" + nombre + "\". Sus pedidos viejos quedan en el historial. ¿Seguro?",
                () => {
                    const comercio = buscarComercioPorNombre(nombre);
                    if (comercio) eliminarComercioPorId(comercio.id);
                    actualizarDatalist();
                    renderizarComercios();
                    if (typeof actualizarDashboard === "function") actualizarDashboard();
                }
            );
        }
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
    cerrarConfirmacion();
    if (typeof cerrarModalProducto === "function") cerrarModalProducto();
});

actualizarDatalist();
renderizarComercios();

// Carga la ficha interactiva sin modificar la estructura de index.html.
if (!document.querySelector('script[data-ficha-comercio="true"]')) {
    const scriptFichaComercio = document.createElement("script");
    scriptFichaComercio.src = "comercioFicha.js";
    scriptFichaComercio.dataset.fichaComercio = "true";
    scriptFichaComercio.defer = true;
    document.body.appendChild(scriptFichaComercio);
}
