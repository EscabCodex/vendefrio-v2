// =====================================================
// VendeFr\u00edo Lite - menu.js
// Navegaci\u00f3n y dashboard principal
// =====================================================

const pantallas = {
    menu: document.getElementById("pantallaMenu"),
    pedido: document.getElementById("pantallaPedido"),
    comercios: document.getElementById("pantallaComercios"),
    productos: document.getElementById("pantallaProductos"),
    historial: document.getElementById("pantallaHistorial"),
    rutas: document.getElementById("pantallaRutas")
};

function mostrarPantalla(nombre) {
    if (nombre === "mas") {
        abrirMenuMas();
        return;
    }
    document.querySelectorAll('body > section[id^="pantalla"]').forEach(pantalla => {
        pantalla.classList.add("oculto");
    });

    if (pantallas[nombre]) {
        pantallas[nombre].classList.remove("oculto");
    }

    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.classList.toggle("activo", btn.dataset.pantalla === nombre);
    });

    if (nombre === "menu") actualizarDashboard();
    if (nombre === "pedido") {
        if (typeof cargarListaClientes === "function") cargarListaClientes();
        if (typeof renderizarProductosPedido === "function") renderizarProductosPedido();
    }
    if (nombre === "comercios" && typeof renderizarComerciosAdmin === "function") {
        renderizarComerciosAdmin();
    }
    if (nombre === "productos" && typeof renderizarProductosAdmin === "function") {
        renderizarProductosAdmin();
    }
    if (nombre === "historial" && typeof renderizarHistorial === "function") {
        renderizarHistorial();
    }
    if (nombre === "rutas" && typeof inicializarPantallaRutas === "function") {
        inicializarPantallaRutas();
    }
    if (nombre === "catalogo" && typeof window.abrirCatalogo === "function") window.abrirCatalogo();
    if (nombre === "mas") abrirMenuMas();

    window.scrollTo(0, 0);
}

// -----------------------------------------------------
// DASHBOARD
// -----------------------------------------------------

function obtenerResumenProductos() {
    const productos = obtenerProductos();
    const marcas = Object.keys(productos);
    const totalProductos = marcas.reduce((total, marca) => {
        return total + (Array.isArray(productos[marca]) ? productos[marca].length : 0);
    }, 0);

    return {
        totalMarcas: marcas.length,
        totalProductos
    };
}

function fechaDeHaceDias(dias) {
    const fecha = new Date();
    fecha.setHours(0, 0, 0, 0);
    fecha.setDate(fecha.getDate() - dias);
    return fecha;
}

function obtenerFechaPedidoDashboard(pedido) {
    const timestamp = Number(pedido && pedido.timestamp);

    if (Number.isFinite(timestamp) && timestamp > 0) {
        const fechaTimestamp = new Date(timestamp);
        if (!Number.isNaN(fechaTimestamp.getTime())) {
            return fechaTimestamp;
        }
    }

    const partes = String(pedido && pedido.fecha || "").split("/");

    if (partes.length === 3) {
        const fechaTexto = new Date(
            Number(partes[2]),
            Number(partes[1]) - 1,
            Number(partes[0])
        );

        if (!Number.isNaN(fechaTexto.getTime())) return fechaTexto;
    }

    return null;
}

function pedidoEstaEnPeriodoDashboard(pedido, dias) {
    const fecha = obtenerFechaPedidoDashboard(pedido);
    if (!fecha) return false;

    const inicio = fechaDeHaceDias(dias - 1);
    const ahora = new Date();

    return fecha >= inicio && fecha <= ahora;
}

function tieneGpsValidoDashboard(comercio) {
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

function comercioVisitadoRecientemente(comercio) {
    return comercioEstaVisitadoEstaSemana(comercio);
}

function crearElementoDashboard(etiqueta, valor, color) {
    const elemento = document.createElement("strong");
    elemento.textContent = String(valor);
    elemento.style.color = color;
    return elemento;
}

function actualizarUltimoPedidoDashboard(historial) {
    const contenedor = document.getElementById("dashUltimoPedido");
    if (!contenedor) return;

    contenedor.innerHTML = "";
    contenedor.onclick = null;
    contenedor.onkeydown = null;
    contenedor.classList.remove("clickeable");
    contenedor.removeAttribute("role");
    contenedor.removeAttribute("tabindex");

    const ultimo = historial[0];

    if (!ultimo) {
        const vacio = document.createElement("p");
        vacio.textContent = "Todav\u00eda no hay pedidos registrados.";
        contenedor.appendChild(vacio);
        return;
    }

    const titulo = document.createElement("h3");
    titulo.textContent = ultimo.comercio || "Comercio sin nombre";

    const detalle = document.createElement("p");
    detalle.textContent =
        "\ud83d\udcc5 " +
        (ultimo.fecha || "Sin fecha") +
        "  \u00b7  \ud83d\udce6 " +
        (Number(ultimo.cantidad) || 0) +
        " unidades";

    contenedor.append(titulo, detalle);
    contenedor.classList.add("clickeable");
    contenedor.setAttribute("role", "button");
    contenedor.setAttribute("tabindex", "0");
    contenedor.setAttribute("title", "Abrir este pedido en el historial");

    const abrirPedidoEnHistorial = () => {
        if (typeof abrirHistorialDePedido === "function") {
            abrirHistorialDePedido(0);
        }
    };

    contenedor.onclick = abrirPedidoEnHistorial;
    contenedor.onkeydown = event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            abrirPedidoEnHistorial();
        }
    };
}

let ubicacionDashboard = null;
let solicitandoUbicacionDashboard = false;

function distanciaDashboard(lat1, lng1, lat2, lng2) {
    const radio = 6371; const rad = valor => valor * Math.PI / 180; const dLat = rad(lat2 - lat1); const dLng = rad(lng2 - lng1); const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2; return radio * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function actualizarUbicacionDashboard() {
    if (ubicacionDashboard || solicitandoUbicacionDashboard || !navigator.geolocation) return;
    solicitandoUbicacionDashboard = true;
    navigator.geolocation.getCurrentPosition(posicion => { ubicacionDashboard = { lat: posicion.coords.latitude, lng: posicion.coords.longitude }; solicitandoUbicacionDashboard = false; actualizarDashboard(); }, () => { solicitandoUbicacionDashboard = false; }, { enableHighAccuracy: true, maximumAge: 120000, timeout: 8000 });
}

function actualizarDashboard() {
    actualizarUbicacionDashboard();
    const comercios = obtenerComercios();
    const historial = obtenerHistorial();
    const resumenProductos = obtenerResumenProductos();

    const pedidosHoy = historial.filter(pedido => {
        return pedidoEstaEnPeriodoDashboard(pedido, 1);
    });
    const pedidosSemana = historial.filter(pedido => {
        const fecha = obtenerFechaPedidoDashboard(pedido);
        return esFechaDeSemanaActual(fecha);
    });
    const visitadosSemana = comercios.filter(comercioVisitadoRecientemente).length;
    const pendientesSemana = comercios.length - visitadosSemana;
    const conGps = comercios.filter(
        tieneGpsValidoDashboard
    ).length;

    const elementos = {
        dashPedidosHoy: pedidosHoy.length,
        dashPedidosSemana: pedidosSemana.length,
        dashVisitadosSemana: visitadosSemana,
        dashPendientesSemana: pendientesSemana,
        dashTotalComercios: comercios.length,
        dashTotalMarcas: resumenProductos.totalMarcas,
        dashTotalProductos: resumenProductos.totalProductos,
        dashConGps: conGps
    };

    Object.keys(elementos).forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = String(elementos[id]);
    });

    actualizarUltimoPedidoDashboard(historial);

    const contenedor = document.getElementById("dashProximaParada");
    if (!contenedor) return;

    const pendientes = comercios.filter(comercio => !comercioVisitadoRecientemente(comercio));

    contenedor.innerHTML = "";

    if (pendientes.length === 0) {
        const mensaje = document.createElement("div");
        mensaje.style.cssText = "display:flex; align-items:center; gap:10px; color:#15803d; font-weight:600;";
        mensaje.innerHTML = "<span style=\"font-size:24px;\">\ud83c\udf89</span>";
        const texto = document.createElement("div");
        texto.textContent = "\u00a1Excelente trabajo! Ya visitaste todos tus comercios esta semana.";
        mensaje.appendChild(texto);
        contenedor.appendChild(mensaje);
        return;
    }

    const conUbicacion = pendientes.filter(tieneGpsValidoDashboard);
    const sugerido = ubicacionDashboard && conUbicacion.length
        ? conUbicacion.slice().sort((a, b) => distanciaDashboard(ubicacionDashboard.lat, ubicacionDashboard.lng, Number(a.lat), Number(a.lng)) - distanciaDashboard(ubicacionDashboard.lat, ubicacionDashboard.lng, Number(b.lat), Number(b.lng)))[0]
        : conUbicacion[0] || pendientes[0];
    const envoltorio = document.createElement("div");
    envoltorio.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap:12px;";

    const informacion = document.createElement("div");
    const titulo = document.createElement("h3");
    titulo.style.cssText = "font-size:16px; color:#1f2937; margin-bottom:4px;";
    titulo.textContent =
        "\ud83c\udfea " +
        sugerido.nombre;

    const direccion = document.createElement("p");
    direccion.style.cssText = "font-size:13px; color:#6b7280; margin-bottom:6px;";
    direccion.textContent =
        "\ud83d\udccd " +
        (sugerido.direccion || "Direcci\u00f3n pendiente");

    const estado = document.createElement("span");
    estado.className = "badge badge-pendiente";
    estado.textContent = "\ud83d\udd34 Pendiente esta semana";

    informacion.append(titulo, direccion, estado);

    const acciones = document.createElement("div");
    acciones.className = "accionesDashboard";

    const boton = document.createElement("button");
    boton.className = "btnAccion agregar";
    boton.style.cssText = "padding:10px 16px; font-weight:bold; background:#0f9d63; color:white; border:none; border-radius:10px;";
    boton.textContent = "\ud83d\udcdd Pedido";
    boton.addEventListener("click", () => irAPedidoRapido(sugerido.nombre));

    const botonRuta = document.createElement("button");
    botonRuta.className = "btnAccion ver";
    botonRuta.style.cssText = "padding:10px 16px; font-weight:bold; border-radius:10px;";
    botonRuta.textContent = "\ud83d\uddfa\ufe0f Ruta";
    botonRuta.addEventListener("click", () => mostrarPantalla("rutas"));

    acciones.append(boton, botonRuta);
    envoltorio.append(informacion, acciones);
    contenedor.appendChild(envoltorio);
}

function irAPedidoRapido(nombreComercio) {
    if (typeof abrirPedidoNuevoParaComercio === "function") {
        abrirPedidoNuevoParaComercio(nombreComercio);
        return;
    }

    mostrarPantalla("pedido");
    const inputCliente = document.getElementById("cliente");
    if (inputCliente) inputCliente.value = nombreComercio;
}

function abrirComerciosConFiltroDashboard(filtro) {
    const selector = document.getElementById("filtroEstadoComercios");
    const buscador = document.getElementById("buscarComercio");

    if (selector) selector.value = filtro || "todos";
    if (buscador) buscador.value = "";

    mostrarPantalla("comercios");
}

function ejecutarAccionTarjetaDashboard(accion) {
    if (accion === "pedidosHoy" && typeof abrirHistorialPorPeriodo === "function") {
        abrirHistorialPorPeriodo("hoy");
        return;
    }

    if (accion === "pedidosSemana" && typeof abrirHistorialPorPeriodo === "function") {
        abrirHistorialPorPeriodo("semana");
        return;
    }

    if (accion === "visitadosSemana") {
        abrirComerciosConFiltroDashboard("visitados");
        return;
    }

    if (accion === "pendientesSemana") {
        abrirComerciosConFiltroDashboard("pendientes");
    }
}

function prepararTarjetasDashboard() {
    document.querySelectorAll(".clickeableDashboard").forEach(tarjeta => {
        if (tarjeta.dataset.dashboardConfigurada === "true") return;

        const activar = () => {
            ejecutarAccionTarjetaDashboard(tarjeta.dataset.dashboardAccion);
        };

        tarjeta.addEventListener("click", activar);
        tarjeta.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activar();
            }
        });

        tarjeta.dataset.dashboardConfigurada = "true";
    });
}

prepararTarjetasDashboard();

// -----------------------------------------------------
// NAVEGACI\u00d3N
// -----------------------------------------------------

function abrirMenuMas() {
    let panel = document.getElementById("menuMasMovil");
    if (!panel) {
        panel = document.createElement("div");
        panel.id = "menuMasMovil";
        panel.className = "menuMasMovil";
        panel.innerHTML = `<div class="menuMasContenido"><div class="menuMasEncabezado"><strong>Más opciones</strong><button type="button" class="menuMasCerrar">×</button></div><button data-mas="rutas"><span>🗺️</span><strong>Rutas</strong><b>›</b></button><button data-mas="estadisticas"><span>📊</span><strong>Estadísticas</strong><b>›</b></button><button data-mas="historial"><span>🕒</span><strong>Historial</strong><b>›</b></button><button data-mas="configuracion"><span>⚙️</span><strong>Configuración</strong><b>›</b></button><button data-mas="productos"><span>🏷️</span><strong>Productos y marcas</strong><b>›</b></button></div>`;
        document.body.appendChild(panel);
        panel.addEventListener("click", event => { if (event.target === panel || event.target.closest(".menuMasCerrar")) { panel.remove(); return; } const boton = event.target.closest("[data-mas]"); if (!boton) return; panel.remove(); const destino = boton.dataset.mas; if (destino === "estadisticas" && typeof window.abrirEstadisticas === "function") window.abrirEstadisticas(); else if (destino === "configuracion" && typeof window.abrirConfiguracion === "function") window.abrirConfiguracion(); else mostrarPantalla(destino); });
    }
}

document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", event => {
        event.preventDefault();
        const destino = btn.dataset.pantalla;
        if (destino) mostrarPantalla(destino);
    });
});

document.querySelectorAll(".volverMenu").forEach(boton => {
    boton.addEventListener("click", () => mostrarPantalla("menu"));
});

window.actualizarDashboard = actualizarDashboard;
window.addEventListener("DOMContentLoaded", actualizarDashboard);
window.addEventListener("load", actualizarDashboard);
// Carga la pantalla de Configuración del rework sin inflar index.html.
if (!document.querySelector('script[data-configuracion="true"]')) {
    const scriptConfiguracion = document.createElement("script");
    scriptConfiguracion.src = "configuracion.js";
    scriptConfiguracion.dataset.configuracion = "true";
    scriptConfiguracion.defer = true;
    document.body.appendChild(scriptConfiguracion);
}

["estadisticas.js", "catalogo.js"].forEach(nombreArchivo => {
    if (document.querySelector(`script[data-rework="${nombreArchivo}"]`)) return;
    const script = document.createElement("script");
    script.src = nombreArchivo;
    script.dataset.rework = nombreArchivo;
    script.defer = true;
    document.body.appendChild(script);
});
