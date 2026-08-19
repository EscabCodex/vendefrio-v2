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

function obtenerEstadisticasComerciales() {
    const historial = obtenerHistorial();
    const comercios = new Map();
    const productos = new Map();
    const marcas = new Map();

    historial.forEach(registro => {
        const comercio = String(registro.comercio || "Sin comercio");
        comercios.set(comercio, (comercios.get(comercio) || 0) + 1);

        if (!Array.isArray(registro.productos)) return;

        registro.productos.forEach(item => {
            const marca = String(item.marca || "Sin marca");
            const producto = String(item.producto || "Sin producto");
            const cantidad = Number(item.cantidad) || 0;
            const claveProducto = marca + " - " + producto;

            productos.set(
                claveProducto,
                (productos.get(claveProducto) || 0) + cantidad
            );
            marcas.set(marca, (marcas.get(marca) || 0) + cantidad);
        });
    });

    const ordenar = mapa => Array.from(mapa.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const perfiles = obtenerPerfilesComerciales(historial);

    return {
        comercios: ordenar(comercios),
        productos: ordenar(productos),
        marcas: ordenar(marcas),
        perfiles,
        atrasados: perfiles.filter(perfil => perfil.atrasado)
    };
}

function formatearFechaCortaHistorial(fecha) {
    if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) return "sin fecha";
    return String(fecha.getDate()).padStart(2, "0") + "/" +
        String(fecha.getMonth() + 1).padStart(2, "0");
}

function obtenerVariacionSemanal(actual, anterior) {
    if (anterior === 0 && actual === 0) return "sin cambios";
    if (anterior === 0) return "+100%";
    const variacion = Math.round(((actual - anterior) / anterior) * 100);
    return (variacion > 0 ? "+" : "") + variacion + "%";
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
        perfil.unidades += Number(registro.cantidad) || 0;

        if (Array.isArray(registro.productos)) {
            registro.productos.forEach(item => {
                const producto = String(item.producto || "Sin producto");
                const cantidad = Number(item.cantidad) || 0;
                perfil.productos.set(
                    producto,
                    (perfil.productos.get(producto) || 0) + cantidad
                );
            });
        }
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

function crearListaEstadistica(titulo, datos, sufijo) {
    const bloque = document.createElement("div");
    bloque.className = "bloqueEstadisticaComercial";

    const encabezado = document.createElement("h3");
    encabezado.textContent = titulo;
    bloque.appendChild(encabezado);

    if (datos.length === 0) {
        const vacio = document.createElement("p");
        vacio.textContent = "Todav\u00eda no hay datos.";
        bloque.appendChild(vacio);
        return bloque;
    }

    const lista = document.createElement("ol");
    datos.forEach(([nombre, cantidad]) => {
        const item = document.createElement("li");
        item.textContent = nombre + " — " + cantidad + " " + sufijo;
        lista.appendChild(item);
    });
    bloque.appendChild(lista);
    return bloque;
}

function obtenerResumenSemana(historial, desplazamientoSemanas) {
    const inicio = obtenerInicioSemanaActual();
    inicio.setDate(inicio.getDate() + desplazamientoSemanas * 7);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 7);

    const comercios = new Set();
    let pedidos = 0;
    let unidades = 0;

    historial.forEach(registro => {
        const fecha = obtenerFechaRegistro(registro);
        if (!fecha || fecha < inicio || fecha >= fin) return;
        pedidos += 1;
        unidades += Number(registro.cantidad) || 0;
        comercios.add(String(registro.comercio || "Sin comercio"));
    });

    return { pedidos, unidades, comercios: comercios.size };
}

function crearComparativaSemanal(historial) {
    const bloque = document.createElement("div");
    bloque.className = "comparativaSemanalComercial";

    const titulo = document.createElement("h3");
    titulo.textContent = "Comparativa semanal";
    bloque.appendChild(titulo);

    const actual = obtenerResumenSemana(historial, 0);
    const anterior = obtenerResumenSemana(historial, -1);
    const filas = [
        ["Pedidos", actual.pedidos, anterior.pedidos],
        ["Unidades", actual.unidades, anterior.unidades],
        ["Comercios activos", actual.comercios, anterior.comercios]
    ];

    filas.forEach(([nombre, valorActual, valorAnterior]) => {
        const fila = document.createElement("div");
        fila.className = "filaComparativaSemanal";

        const etiqueta = document.createElement("strong");
        etiqueta.textContent = nombre;
        const actualTexto = document.createElement("span");
        actualTexto.textContent = "Esta semana: " + valorActual;
        const anteriorTexto = document.createElement("span");
        anteriorTexto.textContent = "Semana anterior: " + valorAnterior;
        const variacion = document.createElement("small");
        variacion.textContent = obtenerVariacionSemanal(valorActual, valorAnterior);
        variacion.className = valorActual >= valorAnterior
            ? "variacionSemanal positiva"
            : "variacionSemanal negativa";

        fila.append(etiqueta, actualTexto, anteriorTexto, variacion);
        bloque.appendChild(fila);
    });

    return bloque;
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
        mes.unidades += Number(registro.cantidad) || 0;
        mes.comercios.add(String(registro.comercio || "Sin comercio"));
    });

    return Array.from(meses.values())
        .sort((a, b) => b.clave.localeCompare(a.clave))
        .slice(0, 6);
}

function crearResumenMensual(historial) {
    const bloque = document.createElement("div");
    bloque.className = "resumenMensualComercial";

    const titulo = document.createElement("h3");
    titulo.textContent = "Actividad mensual";
    bloque.appendChild(titulo);

    const meses = obtenerEstadisticasMensuales(historial);
    if (meses.length === 0) {
        const vacio = document.createElement("p");
        vacio.textContent = "Todav\u00eda no hay pedidos con fecha v\u00e1lida.";
        bloque.appendChild(vacio);
        return bloque;
    }

    meses.forEach(mes => {
        const fila = document.createElement("div");
        fila.className = "filaResumenMensual";

        const nombre = document.createElement("strong");
        nombre.textContent = mes.clave;

        const detalle = document.createElement("span");
        detalle.textContent = mes.pedidos + " pedido(s) - " + mes.unidades + " unidad(es) - " + mes.comercios.size + " comercio(s)";

        fila.append(nombre, detalle);
        bloque.appendChild(fila);
    });

    return bloque;
}

function crearPanelPerfilesComerciales(perfiles) {
    const bloque = document.createElement("div");
    bloque.className = "bloquePerfilesComerciales";

    const titulo = document.createElement("h3");
    titulo.textContent = "Pedido habitual por comercio";
    bloque.appendChild(titulo);

    perfiles.slice(0, 8).forEach(perfil => {
        const fila = document.createElement("div");
        fila.className = "filaPerfilComercial";

        const nombre = document.createElement("strong");
        nombre.textContent = perfil.nombre;

        const detalle = document.createElement("small");
        const frecuencia = perfil.promedioDias > 0
            ? "cada " + perfil.promedioDias + " d\u00eda(s)"
            : "frecuencia en formaci\u00f3n";
        const habituales = perfil.productosHabituales.length > 0
            ? "Productos: " + perfil.productosHabituales.map(item => item[0]).join(", ")
            : "Sin productos estructurados";
        detalle.textContent = perfil.cantidadPedidos + " pedido(s) - " +
            perfil.promedioUnidades + " unidad(es) promedio - " +
            frecuencia + ". \u00daltimo: " + formatearFechaCortaHistorial(perfil.ultimaFecha) +
            ". " + habituales;

        fila.title = "Toc\u00e1 para ver el historial de este comercio";
        fila.setAttribute("role", "button");
        fila.tabIndex = 0;
        fila.addEventListener("click", () => abrirHistorialDeComercio(perfil.nombre));
        fila.addEventListener("keydown", evento => {
            if (evento.key === "Enter" || evento.key === " ") {
                evento.preventDefault();
                abrirHistorialDeComercio(perfil.nombre);
            }
        });

        fila.append(nombre, detalle);
        bloque.appendChild(fila);
    });

    return bloque;
}

function crearSeguimientoSemanal(perfiles, historial) {
    const bloque = document.createElement("div");
    bloque.className = "bloqueSeguimientoSemanal";

    const titulo = document.createElement("h3");
    titulo.textContent = "Seguimiento de esta semana";
    bloque.appendChild(titulo);

    const inicio = obtenerInicioSemanaActual();
    const pedidosEstaSemana = new Set();
    historial.forEach(registro => {
        const fecha = obtenerFechaRegistro(registro);
        if (fecha && fecha >= inicio) {
            pedidosEstaSemana.add(String(registro.comercio || ""));
        }
    });

    const pendientes = perfiles.filter(perfil => {
        return perfil.nombre !== "Sin comercio" && !pedidosEstaSemana.has(perfil.nombre);
    }).slice(0, 8);

    if (pendientes.length === 0) {
        const mensaje = document.createElement("p");
        mensaje.textContent = "No hay comercios pendientes de seguimiento con los datos actuales.";
        bloque.appendChild(mensaje);
        return bloque;
    }

    pendientes.forEach(perfil => {
        const fila = document.createElement("div");
        fila.className = "filaSeguimientoSemanal";
        fila.textContent = perfil.nombre + " - " + perfil.cantidadPedidos + " pedido(s) hist\u00f3rico(s).";
        bloque.appendChild(fila);
    });

    return bloque;
}

function crearAlertasComerciales(perfiles) {
    const bloque = document.createElement("div");
    bloque.className = "bloqueAlertasComerciales";

    const titulo = document.createElement("h3");
    titulo.textContent = "Comercios posiblemente atrasados";
    bloque.appendChild(titulo);

    if (perfiles.length === 0) {
        const mensaje = document.createElement("p");
        mensaje.textContent = "No hay alertas con los datos actuales.";
        bloque.appendChild(mensaje);
        return bloque;
    }

    perfiles.slice(0, 8).forEach(perfil => {
        const fila = document.createElement("div");
        fila.className = "filaAlertaComercial";
        fila.textContent = perfil.nombre + " - hace " + perfil.diasDesdeUltimo + " d\u00eda(s); suele pedir cada " + perfil.promedioDias + " d\u00eda(s).";
        bloque.appendChild(fila);
    });

    return bloque;
}

function crearPanelInteligenciaComercial() {
    const estadisticas = obtenerEstadisticasComerciales();
    const historialCompleto = obtenerHistorial();
    const hayDatos = estadisticas.comercios.length > 0 ||
        estadisticas.productos.length > 0 ||
        estadisticas.marcas.length > 0;

    if (!hayDatos) return null;

    const panel = document.createElement("section");
    panel.className = "card panelInteligenciaComercial";

    const titulo = document.createElement("h2");
    titulo.textContent = "Resumen comercial";

    const ayuda = document.createElement("p");
    ayuda.textContent = "Datos calculados a partir de tus pedidos guardados.";

    const columnas = document.createElement("div");
    columnas.className = "columnasEstadisticaComercial";
    columnas.append(
        crearListaEstadistica("Comercios con m\u00e1s pedidos", estadisticas.comercios, "pedido(s)"),
        crearListaEstadistica("Productos m\u00e1s pedidos", estadisticas.productos, "unidad(es)"),
        crearListaEstadistica("Marcas m\u00e1s pedidas", estadisticas.marcas, "unidad(es)")
    );

    const perfiles = crearPanelPerfilesComerciales(estadisticas.perfiles);
    const alertas = crearAlertasComerciales(estadisticas.atrasados);
    const seguimiento = crearSeguimientoSemanal(estadisticas.perfiles, historialCompleto);

    const comparativaSemanal = crearComparativaSemanal(historialCompleto);
    const actividadMensual = crearResumenMensual(historialCompleto);
    panel.append(titulo, ayuda, comparativaSemanal, actividadMensual, columnas, perfiles, seguimiento, alertas);
    return panel;
}

function renderizarHistorial() {
    if (!pantallaHistorial) return;

    const contenedor = document.getElementById("contenedorHistorial");
    if (!contenedor) return;

    const pedidos = obtenerPedidosFiltrados();
    contenedor.innerHTML = "";

    const panelInteligencia = crearPanelInteligenciaComercial();
    if (panelInteligencia) contenedor.appendChild(panelInteligencia);

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
