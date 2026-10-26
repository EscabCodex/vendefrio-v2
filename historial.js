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

function formatearPrecioHistorial(valor) {
    return "$ " + Number(valor || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

// Total del pedido para la tarjeta (T167): con los precios guardados al
// cargarlo y, si ya se entregó en la nube, con lo entregado.
function totalParaHistorial(pedido) {
    const entrega = estadoActualDelPedido(pedido) === "entregado"
        ? window.nubeVendeFrio?.entregaDelPedido?.(pedido)
        : null;
    const { total, conPrecio } = entrega ? entrega.total : totalDelPedido(pedido);
    return conPrecio ? { valor: total, texto: formatearPrecioHistorial(total) } : { valor: 0, texto: "" };
}

function textoAutorHistorial(pedido) {
    const nombre = String(pedido.autor.nombre || "").trim() ||
        (pedido.autor.idPersona === "dueno" ? "el due\u00f1o" : "un empleado");
    return "Cargado por " + nombre;
}

// "10:42" si el pedido tiene la hora guardada.
function obtenerHoraHistorial(pedido) {
    const timestamp = Number(pedido && pedido.timestamp);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
    const fecha = new Date(timestamp);
    if (Number.isNaN(fecha.getTime())) return "";
    return fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// "Hoy · sábado 25", "Ayer · viernes 24" o "jueves 23 de octubre".
function nombreDelDiaHistorial(textoFecha) {
    const partes = String(textoFecha || "").split("/");
    if (partes.length !== 3) return textoFecha;
    const fecha = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
    if (Number.isNaN(fecha.getTime())) return textoFecha;
    return nombreDelDiaDeFecha(fecha);
}

// También la usa Pedidos > Terminados en la nube (seguimiento.js).
function nombreDelDiaDeFecha(fecha) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const dias = Math.round((hoy.getTime() - fecha.getTime()) / 86400000);
    const dia = fecha.toLocaleDateString("es-AR", { weekday: "long" }) + " " + fecha.getDate();
    if (dias === 0) return "Hoy \u00b7 " + dia;
    if (dias === 1) return "Ayer \u00b7 " + dia;
    const conMes = fecha.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }).replace(",", "");
    return fecha.getFullYear() === hoy.getFullYear() ? conMes : conMes + " de " + fecha.getFullYear();
}

function claseChipEstadoHistorial(estado) {
    if (estado === "entregado") return "pzChipOk";
    if (estado === "cancelado") return "pzChipPeligro";
    if (estado === "cargado") return "pzChipInfo";
    return "pzChipAviso";
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

    if (periodo === "mes") {
        return fecha.getMonth() === hoy.getMonth() && fecha.getFullYear() === hoy.getFullYear();
    }

    return true;
}

// Etapa 4 (T33): el período se elige con botones (Hoy / Semana / Mes /
// Todo) en vez del desplegable. El desplegable queda escondido y sigue
// siendo el que manda: el botón le cambia el valor y avisa el cambio.
const PERIODOS_HISTORIAL = [["hoy", "Hoy"], ["semana", "Semana"], ["mes", "Mes"], ["todos", "Todo"]];

function crearSegmentoPeriodo(select) {
    return crearSegmentoDeSelect(select, PERIODOS_HISTORIAL, "Período", "todos");
}

function sincronizarSegmentoPeriodo(segmento, valor) {
    sincronizarSegmento(segmento, valor);
}

const segmentoPeriodoHistorial = crearSegmentoPeriodo(filtroFechaHistorial);

function obtenerMarcaPorProductoHistorial(nombreProducto) {
    const buscado = normalizarTexto(nombreProducto);
    if (!buscado || buscado === "sin producto") return "Sin marca";

    const productosDisponibles = obtenerProductos();
    const coincidencias = Object.entries(productosDisponibles)
        .filter(([, productos]) => {
            return Array.isArray(productos) && productos.some(producto => {
                return normalizarTexto(producto) === buscado;
            });
        })
        .map(([marca]) => marca);

    return coincidencias.length === 1 ? coincidencias[0] : "Sin marca";
}

function obtenerMarcaDesdeLineaHistorial(lineaOriginal) {
    let linea = String(lineaOriginal || "").trim();
    linea = linea.replace(/^[🔴🟠🟡🟢🔵🟣🟤⚫⚪📦🏪🔎]\s*/, "");
    linea = linea.replace(/^[-•]\s*/, "").replace(/^\*|\*$/g, "").trim();
    linea = linea.replace(/[:：]\s*$/, "").trim();
    if (!linea) return "";

    const excluidos = [
        "resumen del pedido",
        "observaciones",
        "unidades totales",
        "productos diferentes",
        "sin observaciones"
    ];
    if (excluidos.some(texto => normalizarTexto(linea).startsWith(texto))) return "";

    const marcaCatalogo = Object.keys(obtenerProductos()).find(marca => {
        return normalizarTexto(marca) === normalizarTexto(linea);
    });
    if (marcaCatalogo) return marcaCatalogo;

    const esMayuscula = linea === linea.toLocaleUpperCase("es-AR");
    return esMayuscula && linea.length <= 60 ? linea : "";
}

function obtenerMarcaDesdeMensajeHistorial(registro, producto) {
    const lineas = String(registro && registro.pedido || "").split(/\r?\n/);
    let marcaActual = "";
    const buscado = normalizarTexto(producto);

    for (const lineaOriginal of lineas) {
        const linea = lineaOriginal.trim();
        const posibleMarca = obtenerMarcaDesdeLineaHistorial(linea);
        const productoLinea = linea.match(/^[-•]?\s*(.+?)\s+x\s*\d+\s*$/i);
        if (!productoLinea && posibleMarca) {
            marcaActual = posibleMarca;
            continue;
        }
        if (productoLinea && normalizarTexto(productoLinea[1]) === buscado && marcaActual) {
            return marcaActual;
        }
    }

    return "";
}

function normalizarMarcaHistorial(marca, producto, registro) {
    const texto = String(marca || "").trim();
    if (!texto || normalizarTexto(texto) === "sin marca") {
        return obtenerMarcaDesdeMensajeHistorial(registro, producto) ||
            obtenerMarcaPorProductoHistorial(producto);
    }
    return texto;
}

function obtenerProductosAnaliticosHistorial(registro) {
    if (Array.isArray(registro && registro.productos)) {
        return registro.productos
            .map(item => {
                const producto = String(item.producto || "Sin producto");
                return {
                marca: normalizarMarcaHistorial(item.marca, producto, registro),
                producto,
                cantidad: Number(item.cantidad) || 0
            };
            })
            .filter(item => item.cantidad > 0);
    }

    const texto = String(registro && registro.pedido || "");
    let marcaActual = "";

    return texto.split(/\r?\n/)
        .map(linea => linea.trim())
        .map(linea => {
            const coincidencia = linea.match(/^[-•]?\s*(.+?)\s+x\s*(\d+)\s*$/i);
            const posibleMarca = obtenerMarcaDesdeLineaHistorial(linea);
            if (!coincidencia && posibleMarca) {
                marcaActual = posibleMarca;
                return null;
            }
            if (!coincidencia) return null;
            const producto = coincidencia[1].trim();
            return {
                marca: marcaActual || obtenerMarcaPorProductoHistorial(producto),
                producto,
                cantidad: Number(coincidencia[2]) || 0
            };
        })
        .filter(Boolean);
}

function obtenerUnidadesAnaliticasHistorial(registro) {
    const cantidadGuardada = Number(registro && registro.cantidad);
    if (Number.isFinite(cantidadGuardada) && cantidadGuardada > 0) return cantidadGuardada;
    return obtenerProductosAnaliticosHistorial(registro)
        .reduce((total, item) => total + item.cantidad, 0);
}

function obtenerPedidosFiltrados() {
    const texto = normalizarTexto(
        buscarHistorial ? buscarHistorial.value : ""
    );
    const periodo = filtroFechaHistorial
        ? filtroFechaHistorial.value
        : "todos";

    // Eliminados y cancelados no cuentan (T26) y, en la nube, solo los
    // entregados y los "Histórico" (T27). El índice es el de la lista
    // completa, como antes.
    return obtenerHistorial()
        .map((pedido, indice) => ({ pedido, indice }))
        .filter(registro => pedidoEstaEnHistorial(registro.pedido))
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
        })
        .sort((a, b) => {
            const fechaA = obtenerFechaRegistro(a.pedido);
            const fechaB = obtenerFechaRegistro(b.pedido);
            if (fechaA && fechaB) return fechaB.getTime() - fechaA.getTime();
            if (fechaB) return 1;
            if (fechaA) return -1;
            return b.indice - a.indice;
        });
}

function actualizarResumenHistorial(pedidos) {
    if (!resumenHistorial) return;

    const unidades = pedidos.reduce((total, registro) => {
        return total + obtenerUnidadesAnaliticasHistorial(registro.pedido);
    }, 0);

    const total = pedidos.reduce((suma, registro) => suma + totalParaHistorial(registro.pedido).valor, 0);
    resumenHistorial.textContent =
        pedidos.length + (pedidos.length === 1 ? " pedido" : " pedidos") +
        " \u00b7 " + unidades + (unidades === 1 ? " unidad" : " unidades") +
        (total > 0 ? " \u00b7 " + formatearPrecioHistorial(total) : "");
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

// Historial dentro de Pedidos (T27b): en la nube, Historial es el filtro
// "Historial" de la sección Pedido (seguimiento.js). Devuelve true si lo
// abrió ahí; en el modo personal sigue esta pantalla de siempre.
function abrirHistorialEnPedidos(opciones) {
    return usaNubeReal() && Boolean(window.seguimientoVendeFrio?.abrirHistorial?.(opciones));
}

function abrirHistorialDeComercio(nombre) {
    if (abrirHistorialEnPedidos({ comercio: nombre })) return;

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
    if (abrirHistorialEnPedidos({ periodo })) return;

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
    if (abrirHistorialEnPedidos({ idPedido: historial[indiceNumerico].id })) return;

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

function formatearFechaCortaHistorial(fecha) {
    if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) return "sin fecha";
    return String(fecha.getDate()).padStart(2, "0") + "/" +
        String(fecha.getMonth() + 1).padStart(2, "0");
}

function obtenerPerfilesComerciales(historial) {
    const agrupados = new Map();

    historial.forEach(registro => {
        const nombre = String(registro.comercio || "Sin comercio");
        const fecha = obtenerFechaRegistro(registro);
        if (!fecha) return;

        if (!agrupados.has(nombre)) {
            agrupados.set(nombre, {
                nombre,
                fechas: [],
                unidades: 0,
                productos: new Map()
            });
        }

        const perfil = agrupados.get(nombre);
        perfil.fechas.push(fecha);
        perfil.unidades += obtenerUnidadesAnaliticasHistorial(registro);

        obtenerProductosAnaliticosHistorial(registro).forEach(item => {
            const producto = item.producto;
            const cantidad = item.cantidad;
            perfil.productos.set(
                producto,
                (perfil.productos.get(producto) || 0) + cantidad
            );
        });
    });

    return Array.from(agrupados.values()).map(perfil => {
        const fechas = perfil.fechas.sort((a, b) => a - b);
        const intervalos = [];

        for (let indice = 1; indice < fechas.length; indice += 1) {
            intervalos.push(
                Math.round((fechas[indice] - fechas[indice - 1]) / 86400000)
            );
        }

        const promedio = intervalos.length > 0
            ? Math.round(intervalos.reduce((total, dias) => total + dias, 0) / intervalos.length)
            : 0;
        const ultima = fechas[fechas.length - 1];
        const diasDesdeUltimo = Math.max(
            0,
            Math.floor((Date.now() - ultima.getTime()) / 86400000)
        );
        const productosHabituales = Array.from(perfil.productos.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        return {
            nombre: perfil.nombre,
            cantidadPedidos: fechas.length,
            unidades: perfil.unidades,
            promedioUnidades: fechas.length > 0 ? Math.round(perfil.unidades / fechas.length) : 0,
            ultimaFecha: ultima,
            promedioDias: promedio,
            diasDesdeUltimo,
            productosHabituales,
            atrasado: fechas.length >= 3 && promedio > 0 && diasDesdeUltimo > promedio * 1.5
        };
    }).sort((a, b) => b.cantidadPedidos - a.cantidadPedidos);
}

function obtenerEstadisticasMensuales(historial) {
    const meses = new Map();

    historial.forEach(registro => {
        const fecha = obtenerFechaRegistro(registro);
        if (!fecha) return;

        const clave = fecha.getFullYear() + "-" + String(fecha.getMonth() + 1).padStart(2, "0");
        if (!meses.has(clave)) {
            meses.set(clave, {
                clave,
                pedidos: 0,
                unidades: 0,
                comercios: new Set()
            });
        }

        const mes = meses.get(clave);
        mes.pedidos += 1;
        mes.unidades += obtenerUnidadesAnaliticasHistorial(registro);
        mes.comercios.add(String(registro.comercio || "Sin comercio"));
    });

    return Array.from(meses.values())
        .sort((a, b) => b.clave.localeCompare(a.clave))
        .slice(0, 6);
}

function crearModalAccionesComercioSeguimiento() {
    if (document.getElementById("modalAccionesSeguimiento")) return;

    const modal = document.createElement("div");
    modal.id = "modalAccionesSeguimiento";
    modal.className = "modal modalHoja oculto";

    const contenido = document.createElement("div");
    contenido.className = "modalContenido";

    const titulo = document.createElement("h2");
    titulo.id = "tituloAccionesSeguimiento";

    const mensaje = document.createElement("p");
    mensaje.textContent = "Eleg\u00ed qu\u00e9 quer\u00e9s hacer con este comercio.";

    const botones = document.createElement("div");
    botones.className = "modalBotones modalBotonesSeguimiento";

    const acciones = [
        ["pedido", "Ir a pedido"],
        ["comercio", "Ver este comercio"],
        ["navegar", "Navegar a este comercio"],
        ["historial", "Ir a historial"]
    ];

    acciones.forEach(([accion, texto]) => {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = accion === "pedido" ? "btnModalConfirmar" : "btnModalSecundario";
        boton.dataset.accion = accion;
        boton.textContent = texto;
        botones.appendChild(boton);
    });

    const cancelar = document.createElement("button");
    cancelar.type = "button";
    cancelar.className = "btnModalCancelar";
    cancelar.textContent = "Cancelar";
    botones.appendChild(cancelar);

    contenido.append(titulo, mensaje, botones);
    modal.appendChild(contenido);
    document.body.appendChild(modal);

    cancelar.addEventListener("click", () => modal.classList.add("oculto"));
    modal.addEventListener("click", evento => {
        if (evento.target === modal) modal.classList.add("oculto");
    });

    botones.addEventListener("click", evento => {
        const boton = evento.target.closest("button[data-accion]");
        if (!boton) return;

        const nombre = modal.dataset.nombre || "";
        const accion = boton.dataset.accion;
        modal.classList.add("oculto");

        if (accion === "pedido") {
            if (typeof abrirPedidoNuevoParaComercio === "function") {
                abrirPedidoNuevoParaComercio(nombre);
            }
            return;
        }

        if (accion === "comercio") {
            if (typeof mostrarComercioIndividual === "function") {
                mostrarComercioIndividual(nombre);
            } else if (typeof mostrarPantalla === "function") {
                mostrarPantalla("comercios");
            }
            return;
        }

        if (accion === "navegar") {
            if (typeof abrirMapsComercio === "function") {
                abrirMapsComercio(nombre);
            }
            return;
        }

        if (accion === "historial") {
            abrirHistorialDeComercio(nombre);
        }
    });
}

function abrirAccionesComercioSeguimiento(nombre) {
    crearModalAccionesComercioSeguimiento();
    const modal = document.getElementById("modalAccionesSeguimiento");
    const titulo = document.getElementById("tituloAccionesSeguimiento");
    if (!modal || !titulo) return;

    modal.dataset.nombre = nombre;
    titulo.textContent = nombre;
    modal.classList.remove("oculto");
}

function renderizarHistorial() {
    if (!pantallaHistorial) return;

    const contenedor = document.getElementById("contenedorHistorial");
    if (!contenedor) return;

    if (filtroFechaHistorial) sincronizarSegmentoPeriodo(segmentoPeriodoHistorial, filtroFechaHistorial.value);
    const pedidos = obtenerPedidosFiltrados();
    window.piezas?.cortarTandas(contenedor);
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

    const gruposPorFecha = [];
    pedidos.forEach(registro => {
        const fechaGrupo = String(registro.pedido.fecha || "Sin fecha");
        let grupo = gruposPorFecha.find(item => item.fecha === fechaGrupo);
        if (!grupo) { grupo = { fecha: fechaGrupo, pedidos: [], total: 0 }; gruposPorFecha.push(grupo); }
        registro.total = totalParaHistorial(registro.pedido);
        grupo.total += registro.total.valor;
        grupo.pedidos.push(registro);
    });

    // Con muchos pedidos se dibujan de a tandas, sin trabar (T151): cada
    // fecha es un marcador seguido de sus pedidos.
    const filas = [];
    gruposPorFecha.forEach(grupo => {
        filas.push({ grupo });
        grupo.pedidos.forEach(registro => filas.push({ registro }));
    });
    const dibujarFila = fila => {
        if (fila.grupo) {
            const grupo = fila.grupo;
            const marcador = document.createElement("div");
            marcador.className = "marcadorFechaHistorial";
            const cuantos = grupo.pedidos.length + (grupo.pedidos.length === 1 ? " pedido" : " pedidos");
            marcador.append(
                crearTextoHistorial("strong", nombreDelDiaHistorial(grupo.fecha)),
                crearTextoHistorial("small", cuantos + (grupo.total > 0 ? " \u00b7 " + formatearPrecioHistorial(grupo.total) : ""))
            );
            return marcador;
        }
        // Historial con el estilo nuevo (T167, opción A): una tarjeta por
        // pedido; tocarla abre el pedido y "⋯" tiene Ver y Eliminar.
        const registro = fila.registro;
        const pedido = registro.pedido;
        const indice = registro.indice;
        const comercio = String(pedido.comercio || "SIN NOMBRE").trim();
        const cantidad = Number(pedido.cantidad) || 0;
        const hora = obtenerHoraHistorial(pedido);

        const tarjeta = document.createElement("div");
        tarjeta.className = "card historialCard";

        const ver = document.createElement("button");
        ver.type = "button";
        ver.className = "verPedido abrirPedidoHistorial";
        ver.dataset.indice = String(indice);
        ver.setAttribute("aria-label", "Ver pedido de " + comercio);

        const avatar = document.createElement("span");
        avatar.className = "pzIni " + (window.piezas?.colorIni?.(comercio) || "pzIni1");
        avatar.textContent = iniciales(comercio);

        const informacion = document.createElement("span");
        informacion.className = "infoCard";
        const partes = [];
        if (hora) partes.push(hora);
        partes.push(cantidad + (cantidad === 1 ? " unidad" : " unidades"));
        informacion.append(
            crearTextoHistorial("strong", comercio),
            crearTextoHistorial("small", partes.join(" \u00b7 "))
        );

        // Pedido completo (T20): quién lo cargó.
        if (pedido.autor && typeof pedido.autor === "object") {
            informacion.append(crearTextoHistorial("small", textoAutorHistorial(pedido), "autorPedidoHistorial"));
        }

        // Pedidos subidos a la nube desde este celular (T11) y, en la nube,
        // los que no tienen historial de estados (T20). Los demás muestran
        // su estado actual.
        const estadoActual = estadoActualDelPedido(pedido);
        const etiquetas = document.createElement("span");
        etiquetas.className = "etiquetasHistorial";

        if (pedido.estado === "historico" || (!estadoActual && usaNubeReal())) {
            etiquetas.append(crearTextoHistorial("span", "Hist\u00f3rico", "pzChip pzChipGris badgeHistorico"));
        } else if (estadoActual) {
            const etiqueta = crearTextoHistorial(
                "span",
                nombreDeEstadoPedido(estadoActual) || estadoActual,
                "pzChip " + claseChipEstadoHistorial(estadoActual) + " badgeEstadoPedido"
            );
            etiqueta.dataset.estado = estadoActual;
            etiquetas.append(etiqueta);
        }

        // Pedido que todav\u00eda no confirm\u00f3 la nube (T12).
        if (window.nubeVendeFrio?.pedidoSinSubir?.(pedido.id)) {
            etiquetas.append(crearTextoHistorial("span", "Pendiente de sincronizar", "pzChip pzChipAviso badgeSinSubir"));
        }
        if (etiquetas.childElementCount) informacion.append(etiquetas);

        const total = crearTextoHistorial("b", registro.total.texto, "totalHistorial");
        ver.append(avatar, informacion, total);

        const opciones = document.createElement("button");
        opciones.type = "button";
        opciones.className = "opcionesPedidoHistorial";
        opciones.dataset.indice = String(indice);
        opciones.setAttribute("aria-label", "Opciones del pedido de " + comercio);
        opciones.innerHTML = window.icono("puntos", 18);

        tarjeta.append(ver, opciones);
        return tarjeta;
    };
    if (window.piezas?.dibujarDeATandas) window.piezas.dibujarDeATandas(contenedor, filas, dibujarFila);
    else filas.forEach(fila => contenedor.appendChild(dibujarFila(fila)));
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

// "Ver pedido": la ventana del pedido con su mensaje y "Enviar por
// WhatsApp". También la usa la ficha del pedido en la nube (T27b).
function mostrarPedidoGuardado(pedido) {
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
}

if (pantallaHistorial) {
    pantallaHistorial.addEventListener("click", event => {
        const boton = event.target.closest("button");
        if (!boton) return;

        if (boton.classList.contains("verPedido")) {
            const indice = Number(boton.dataset.indice);
            const historial = obtenerHistorial();
            const pedido = historial[indice];

            if (!pedido) return;

            mostrarPedidoGuardado(pedido);
            return;
        }

        if (boton.classList.contains("opcionesPedidoHistorial")) {
            abrirOpcionesPedidoHistorial(Number(boton.dataset.indice));
        }
    });
}

// "⋯" de cada pedido (T167): Ver pedido y Eliminar pedido en una hoja.
function abrirOpcionesPedidoHistorial(indice) {
    const pedido = obtenerHistorial()[indice];
    if (!pedido || !window.piezas) return;

    // Eliminar (T26): en la nube, solo quien cargó el pedido o el dueño
    // y solo mientras está "Cargado" (un "Histórico", solo el dueño). En
    // el modo personal, como siempre.
    const puedeEliminar = !usaNubeReal() ||
        Boolean(window.nubeVendeFrio?.puedeEliminarElPedido?.(pedido));
    const botones = [{ texto: "Ver pedido", icono: "ojo", clase: "pzBtnSec", alTocar: () => mostrarPedidoGuardado(pedido) }];
    if (puedeEliminar) {
        botones.push({ texto: "Eliminar pedido", icono: "tacho", clase: "pzBtnPeligro eliminarPedidoHistorial", alTocar: () => eliminarPedidoDelHistorial(String(pedido.id || "")) });
    }
    window.piezas.hoja({
        titulo: String(pedido.comercio || "SIN NOMBRE").trim(),
        sub: [pedido.fecha, (Number(pedido.cantidad) || 0) + " unidades"].filter(Boolean).join(" \u00b7 "),
        botones,
        etiqueta: "Opciones del pedido"
    });
}

function eliminarPedidoDelHistorial(id) {
    // En la nube (T26) el pedido no se borra: queda guardado por
    // dentro como eliminado y desaparece de la app para todos.
    if (usaNubeReal()) {
        abrirConfirmacion(
            "Eliminar pedido",
            "Desaparece de la app para todos, pero queda guardado por dentro. \u00bfLo elimin\u00e1s?",
            () => {
                try {
                    window.nubeVendeFrio.eliminarPedido(id);
                    mostrarToast("Pedido eliminado");
                } catch (error) {
                    console.error("No se pudo eliminar el pedido.", error);
                    mostrarAviso(
                        "No se pudo eliminar",
                        error && error.code === "pedido" ? error.message : "Prob\u00e1 de nuevo en unos segundos."
                    );
                }

                renderizarHistorial();

                if (typeof actualizarDashboard === "function") {
                    actualizarDashboard();
                }
            }
        );
        return;
    }

    // Etapa 8: sin "¿Seguro?". Se borra y queda "Deshacer" unos
    // segundos (en este celular, sin nube).
    const historialAntes = obtenerHistorial();
    const redibujar = () => {
        renderizarHistorial();
        if (typeof actualizarDashboard === "function") actualizarDashboard();
    };
    if (!eliminarPedidoPorId(id)) return;
    redibujar();
    window.piezas?.deshacer("Pedido eliminado", () => {
        guardarHistorial(historialAntes);
        redibujar();
    });
}
