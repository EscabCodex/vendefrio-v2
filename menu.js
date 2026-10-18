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
    if (typeof window.cerrarFichaComercio === "function" && nombre !== "comercios") window.cerrarFichaComercio();
    if (nombre === "mas") {
        abrirMenuMas();
        return;
    }
    // Historial dentro de Pedidos (T27b): en la nube no se abre la pantalla
    // Historial de antes, sino el filtro "Historial" de la sección Pedido.
    if (nombre === "historial" && usaNubeReal() && window.seguimientoVendeFrio?.abrirHistorial?.({})) {
        return;
    }
    document.querySelectorAll('body > section[id^="pantalla"]').forEach(pantalla => {
        pantalla.classList.add("oculto");
    });

    if (pantallas[nombre]) {
        pantallas[nombre].classList.remove("oculto");
        pantallas[nombre].classList.remove("entrada-pantalla");
        void pantallas[nombre].offsetWidth;
        pantallas[nombre].classList.add("entrada-pantalla");
    }

    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.classList.toggle("activo", btn.dataset.pantalla === nombre || btn.dataset.tambien === nombre);
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

let ubicacionDashboard = null;
let solicitandoUbicacionDashboard = false;

function distanciaDashboard(lat1, lng1, lat2, lng2) {
    const radio = 6371; const rad = valor => valor * Math.PI / 180; const dLat = rad(lat2 - lat1); const dLng = rad(lng2 - lng1); const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2; return radio * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function actualizarUbicacionDashboard(forzar = false) {
    if ((!forzar && ubicacionDashboard) || solicitandoUbicacionDashboard || !navigator.geolocation) return;
    solicitandoUbicacionDashboard = true;
    navigator.geolocation.getCurrentPosition(posicion => { ubicacionDashboard = { lat: posicion.coords.latitude, lng: posicion.coords.longitude }; solicitandoUbicacionDashboard = false; actualizarDashboard(); }, () => { solicitandoUbicacionDashboard = false; }, { enableHighAccuracy: true, maximumAge: 120000, timeout: 8000 });
}

// -----------------------------------------------------
// INICIO (T32): resumen de hoy, próxima parada, pedidos de hoy y semana
// -----------------------------------------------------

const ESTADOS_KPI_INICIO = [
    { id: "aPreparar", texto: "A preparar", estados: ["cargado", "enPreparacion"], etapa: "cargados" },
    { id: "preparados", texto: "Preparados", estados: ["preparado"], etapa: "preparados" },
    { id: "enReparto", texto: "En reparto", estados: ["enVehiculo", "enReparto"], etapa: "enReparto" },
    { id: "entregados", texto: "Entregados", estados: ["entregado"], etapa: "historial" }
];

// Estado de cada pedido la última vez que se dibujó Inicio: si cambia (por
// ejemplo, otro celular lo marcó "Preparado"), su fila se ilumina.
const estadosVistosInicio = new Map();
let inicioDibujadoUnaVez = false;

function textoPlataInicio(valor) {
    const numero = Math.round(Number(valor) || 0);
    return "$ " + numero.toLocaleString("es-AR");
}

function textoPlataCortoInicio(valor) {
    const numero = Number(valor) || 0;
    if (numero >= 1000000) return "$ " + (numero / 1000000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " M";
    if (numero >= 10000) return "$ " + Math.round(numero / 1000).toLocaleString("es-AR") + " mil";
    return textoPlataInicio(numero);
}

function esDeHoyInicio(pedido) {
    const fecha = obtenerFechaPedidoDashboard(pedido);
    if (!fecha) return false;
    const hoy = new Date();
    return fecha.getFullYear() === hoy.getFullYear() && fecha.getMonth() === hoy.getMonth() && fecha.getDate() === hoy.getDate();
}

function estadoInicio(pedido) {
    if (!usaNubeReal() || typeof pedidoTieneEstados !== "function" || !pedidoTieneEstados(pedido)) return "";
    return estadoActualDelPedido(pedido);
}

// Hora en que el pedido pasó a su estado actual (para "Entregados" de hoy).
function horaDelEstadoInicio(pedido) {
    const estados = pedido && pedido.estados && typeof pedido.estados === "object" ? Object.values(pedido.estados) : [];
    return estados.reduce((mayor, entrada) => Math.max(mayor, Number(entrada && entrada.horaCelular) || 0), 0);
}

function totalInicio(pedido) {
    return typeof totalDelPedido === "function" ? totalDelPedido(pedido).total : 0;
}

function unidadesInicio(pedido) {
    const guardada = Number(pedido && pedido.cantidad);
    if (Number.isFinite(guardada) && guardada > 0) return guardada;
    return (Array.isArray(pedido && pedido.productos) ? pedido.productos : [])
        .reduce((total, item) => total + (Number(item && item.cantidad) || 0), 0);
}

// Los pedidos que van en "Pedidos de hoy": en la nube, los cargados hoy,
// los que siguen en camino aunque sean de otro día y los entregados hoy.
// En el modo personal, los cargados hoy.
function pedidosDeHoyInicio(pedidos) {
    return pedidos.filter(pedido => {
        if (esDeHoyInicio(pedido)) return true;
        const estado = estadoInicio(pedido);
        if (!estado) return false;
        if (estado === "entregado") {
            const hora = horaDelEstadoInicio(pedido);
            return hora > 0 && esDeHoyInicio({ timestamp: hora });
        }
        return estado !== "cancelado";
    }).sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
}

function abrirPedidoDesdeInicio(pedido) {
    if (usaNubeReal() && window.seguimientoVendeFrio?.abrirPedido?.(pedido.id)) return;
    if (typeof abrirHistorialDePedido === "function") {
        const indice = obtenerHistorial().findIndex(item => item.id === pedido.id);
        if (indice >= 0) abrirHistorialDePedido(indice);
    }
}

function dibujarKpisInicio(pedidosHoy, nube, semana) {
    const caja = document.getElementById("dashKpis");
    if (!caja) return;
    caja.innerHTML = "";

    const kpis = nube
        ? ESTADOS_KPI_INICIO.map(kpi => ({
            ...kpi,
            valor: pedidosHoy.filter(pedido => kpi.estados.includes(estadoInicio(pedido))).length
        }))
        : [
            { id: "hoy", texto: "Pedidos hoy", valor: pedidosHoy.length, accion: "pedidosHoy" },
            { id: "semana", texto: "Esta semana", valor: semana.pedidos, accion: "pedidosSemana" },
            { id: "pendientes", texto: "Sin visitar", valor: semana.sinVisitar, accion: "pendientesSemana" }
        ];

    kpis.forEach(kpi => {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "kpiHoy";
        boton.dataset.kpi = kpi.id;
        boton.innerHTML = "<strong></strong><span></span>";
        boton.querySelector("strong").textContent = String(kpi.valor);
        boton.querySelector("span").textContent = kpi.texto;
        boton.addEventListener("click", () => {
            if (kpi.etapa && window.seguimientoVendeFrio?.abrirEtapa?.(kpi.etapa)) return;
            ejecutarAccionTarjetaDashboard(kpi.accion);
        });
        caja.appendChild(boton);
    });
}

function dibujarPedidosDeHoyInicio(pedidosHoy) {
    const caja = document.getElementById("dashPedidosDeHoy");
    if (!caja) return;
    caja.innerHTML = "";

    if (!pedidosHoy.length) {
        const vacio = document.createElement("p");
        vacio.className = "vacioInicio";
        vacio.textContent = "Todavía no hay pedidos hoy. Tocá + para cargar uno.";
        caja.appendChild(vacio);
        return;
    }

    pedidosHoy.slice(0, 6).forEach(pedido => {
        const nombre = pedido.comercio || pedido.cliente || "Comercio sin nombre";
        const estado = estadoInicio(pedido);
        const fila = document.createElement("button");
        fila.type = "button";
        fila.className = "filaInicio";

        const inicial = document.createElement("span");
        inicial.className = "inicialesInicio";
        inicial.dataset.tono = String(nombre.length % 4);
        inicial.textContent = typeof iniciales === "function" ? iniciales(nombre) : nombre.slice(0, 2).toUpperCase();

        const texto = document.createElement("span");
        texto.className = "textoFilaInicio";
        const titulo = document.createElement("strong");
        titulo.textContent = nombre;
        const detalle = document.createElement("small");
        const partes = [];
        if (typeof numeroCortoDelPedido === "function" && pedido.id && estado) partes.push("N° " + numeroCortoDelPedido(pedido));
        partes.push(unidadesInicio(pedido) + " u");
        const autor = pedido.autor && pedido.autor.nombre;
        if (autor) partes.push(autor);
        detalle.textContent = partes.join(" · ");
        texto.append(titulo, detalle);

        const derecha = document.createElement("span");
        derecha.className = "derechaFilaInicio";
        if (estado) {
            const chip = document.createElement("span");
            chip.className = "estadoSeguimiento";
            chip.dataset.estado = estado;
            chip.textContent = nombreDeEstadoPedido(estado);
            derecha.appendChild(chip);
        }
        const total = totalInicio(pedido);
        if (total > 0) {
            const plata = document.createElement("small");
            plata.textContent = textoPlataInicio(total);
            derecha.appendChild(plata);
        }

        fila.append(inicial, texto, derecha);
        fila.addEventListener("click", () => abrirPedidoDesdeInicio(pedido));

        const visto = estadosVistosInicio.get(pedido.id);
        if (inicioDibujadoUnaVez && estado && visto !== undefined && visto !== estado) {
            fila.classList.add("filaCambio");
        }
        caja.appendChild(fila);
    });

    pedidosHoy.forEach(pedido => estadosVistosInicio.set(pedido.id, estadoInicio(pedido)));
}

function dibujarProximaParadaInicio(comercios) {
    const contenedor = document.getElementById("dashProximaParada");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    const pendientes = comercios.filter(comercio => !comercioVisitadoRecientemente(comercio));

    if (!comercios.length || pendientes.length === 0) {
        const mensaje = document.createElement("div");
        mensaje.className = "paradaListo";
        mensaje.innerHTML = `<span class="paradaIcono" data-tono="ok">${window.icono("check", 22)}</span>`;
        const texto = document.createElement("p");
        texto.textContent = comercios.length
            ? "¡Excelente! Ya visitaste todos tus comercios esta semana."
            : "Todavía no cargaste comercios.";
        mensaje.appendChild(texto);
        contenedor.appendChild(mensaje);
        return;
    }

    const conUbicacion = pendientes.filter(tieneGpsValidoDashboard);
    const sugerido = ubicacionDashboard && conUbicacion.length
        ? conUbicacion.slice().sort((a, b) => distanciaDashboard(ubicacionDashboard.lat, ubicacionDashboard.lng, Number(a.lat), Number(a.lng)) - distanciaDashboard(ubicacionDashboard.lat, ubicacionDashboard.lng, Number(b.lat), Number(b.lng)))[0]
        : conUbicacion[0] || pendientes[0];

    // La tarjeta abre la ficha del comercio.
    const info = document.createElement("button");
    info.type = "button";
    info.className = "paradaInfo";
    info.setAttribute("aria-label", "Ver ficha de " + sugerido.nombre);
    info.innerHTML = `<span class="paradaIcono">${window.icono("tienda", 22)}</span><span class="paradaTexto"><strong></strong><small></small><span class="chipEstado" data-tono="aviso">Sin visitar esta semana</span></span>`;
    info.querySelector("strong").textContent = sugerido.nombre;
    // Con horario cargado (T69), el chip dice cuándo atiende.
    if (String(sugerido.horario || "").trim()) {
        const chip = info.querySelector(".chipEstado");
        chip.textContent = String(sugerido.horario).trim();
        chip.classList.add("chipHorario");
    }
    const partes = [sugerido.direccion || "Dirección pendiente"];
    if (ubicacionDashboard && tieneGpsValidoDashboard(sugerido)) {
        const km = distanciaDashboard(ubicacionDashboard.lat, ubicacionDashboard.lng, Number(sugerido.lat), Number(sugerido.lng));
        partes.push(km < 1 ? "a " + Math.round(km * 100) * 10 + " m" : "a " + km.toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " km");
    }
    info.querySelector("small").textContent = partes.join(" · ");
    info.addEventListener("click", () => {
        if (typeof window.abrirFichaComercio === "function") window.abrirFichaComercio(sugerido.nombre);
    });

    const acciones = document.createElement("div");
    acciones.className = "paradaAcciones";

    const pedido = document.createElement("button");
    pedido.type = "button";
    pedido.className = "btnAccion agregar";
    pedido.innerHTML = window.icono("documento", 18) + " Cargar pedido";
    pedido.addEventListener("click", () => irAPedidoRapido(sugerido.nombre));

    // "Ir": la navegación propia (navegacion.js) o, si no se puede, Google Maps.
    const ir = document.createElement("a");
    ir.className = "btnAccion ver botonIr";
    ir.target = "_blank";
    ir.rel = "noopener";
    ir.innerHTML = window.icono("navegar", 18) + " Ir";
    const destino = tieneGpsValidoDashboard(sugerido)
        ? sugerido.lat + "," + sugerido.lng
        : sugerido.direccion || sugerido.nombre;
    ir.href = "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + encodeURIComponent(destino);
    // Con GPS guardado, "Ir" abre la navegación propia (Etapa 5).
    ir.dataset.navegarA = sugerido.nombre;

    acciones.append(pedido, ir);

    // "Ya llego" por WhatsApp (T72): con teléfono, entre "Cargar pedido" e
    // "Ir" (que queda solo con el ícono).
    const yaLlego = window.yaLlegoVendeFrio ? window.yaLlegoVendeFrio.enlace(sugerido) : "";
    if (yaLlego) {
        const aviso = document.createElement("a");
        aviso.className = "pzBtn pzBtnWa paradaYaLlego";
        aviso.href = yaLlego;
        aviso.target = "_blank";
        aviso.rel = "noopener";
        aviso.innerHTML = window.icono("whatsapp", 18) + " Ya llego";
        pedido.after(aviso);
        ir.innerHTML = window.icono("navegar", 20);
        ir.setAttribute("aria-label", "Ir");
        ir.classList.add("soloIcono");
        acciones.classList.add("conYaLlego");
    }

    // "Visité, sin pedido" (T65): pide el motivo y lo marca visitado.
    if (window.visitasVendeFrio) {
        const sinPedido = document.createElement("button");
        sinPedido.type = "button";
        sinPedido.className = "pzBtn pzBtnSec paradaSinPedido";
        sinPedido.innerHTML = window.icono("cerrarX", 16) + " Visité, sin pedido";
        sinPedido.addEventListener("click", () => window.visitasVendeFrio.abrir(sugerido.nombre));
        acciones.appendChild(sinPedido);
    }
    contenedor.append(info, acciones);

    if (!ubicacionDashboard && navigator.geolocation) {
        const ubicar = document.createElement("button");
        ubicar.type = "button";
        ubicar.className = "btnUbicacionDashboard";
        ubicar.innerHTML = window.icono("mira", 14) + " Usar mi ubicación para elegir la más cercana";
        ubicar.addEventListener("click", () => actualizarUbicacionDashboard(true));
        contenedor.appendChild(ubicar);
    }
}

function actualizarEncabezadoInicio() {
    const quien = window.empleadosVendeFrio?.quienSoy?.();
    const nombre = quien?.nombre || "";
    const saludo = document.getElementById("dashSaludo");
    if (saludo) saludo.textContent = nombre ? "Hola, " + nombre.split(" ")[0] : "Hola";
    const avatar = document.getElementById("botonAvatar");
    if (avatar) {
        const inicial = nombre.trim().charAt(0).toLocaleUpperCase("es");
        avatar.innerHTML = inicial ? "" : window.icono("persona", 22);
        if (inicial) avatar.textContent = inicial;
    }
}

function actualizarDashboard() {
    actualizarUbicacionDashboard();
    actualizarEncabezadoInicio();

    const nube = usaNubeReal();
    const comercios = comerciosActivos();
    const pedidos = typeof obtenerPedidosQueCuentan === "function" ? obtenerPedidosQueCuentan() : obtenerHistorial();
    const pedidosHoy = pedidosDeHoyInicio(pedidos);
    const cargadosHoy = pedidos.filter(esDeHoyInicio);
    const pedidosSemana = pedidos.filter(pedido => esFechaDeSemanaActual(obtenerFechaPedidoDashboard(pedido)));
    const visitadosSemana = comercios.filter(comercioVisitadoRecientemente).length;
    const sinVisitar = comercios.length - visitadosSemana;

    // Resumen de hoy.
    const hoy = new Date();
    const fecha = document.getElementById("dashFechaHoy");
    if (fecha) fecha.textContent = "Hoy · " + hoy.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
    const vendido = cargadosHoy.reduce((total, pedido) => total + totalInicio(pedido), 0);
    const hayPrecios = cargadosHoy.some(pedido => totalInicio(pedido) > 0);
    const comerciosHoy = new Set(cargadosHoy.map(pedido => String(pedido.comercio || pedido.cliente || "").trim().toLocaleLowerCase("es"))).size;
    // T93: sin permiso para ver la plata, unidades en vez de pesos.
    const vePlata = window.verPlataVendeFrio?.puedoVer?.() !== false;
    const conPlata = vePlata && (hayPrecios || nube);
    const textos = {
        dashTituloHoy: conPlata ? "Vendido hoy" : "Unidades hoy",
        dashVendidoHoy: conPlata
            ? textoPlataInicio(vendido)
            : String(cargadosHoy.reduce((total, pedido) => total + unidadesInicio(pedido), 0)),
        dashResumenHoy: cargadosHoy.length + (cargadosHoy.length === 1 ? " pedido" : " pedidos") + " · " +
            comerciosHoy + (comerciosHoy === 1 ? " comercio" : " comercios"),
        dashVisitadosSemana: visitadosSemana,
        dashTotalComercios: comercios.length,
        dashPedidosSemana: pedidosSemana.length,
        dashVendidoSemana: vePlata
            ? textoPlataCortoInicio(pedidosSemana.reduce((total, pedido) => total + totalInicio(pedido), 0))
            : pedidosSemana.reduce((total, pedido) => total + unidadesInicio(pedido), 0).toLocaleString("es-AR"),
        dashEtiquetaVendidoSemana: vePlata ? "vendido" : "unidades",
        dashPendientesSemana: sinVisitar
    };
    Object.keys(textos).forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = String(textos[id]);
    });
    const barra = document.getElementById("dashBarraSemana");
    if (barra) barra.style.width = (comercios.length ? Math.round(visitadosSemana / comercios.length * 100) : 0) + "%";

    dibujarKpisInicio(pedidosHoy, nube, { pedidos: pedidosSemana.length, sinVisitar });
    dibujarPedidosDeHoyInicio(nube ? pedidosHoy : cargadosHoy);
    dibujarProximaParadaInicio(comercios);
    dibujarPrimerosPasos(comercios, pedidos);
    dibujarVisitarHoy(comercios, pedidos, cargadosHoy);
    inicioDibujadoUnaVez = true;
}

// -----------------------------------------------------
// Primeros pasos (Etapa 6, T45): en una cuenta nueva, una guía corta que
// se tilda sola. Se esconde al terminar o con "Ocultar".
// -----------------------------------------------------

const CLAVE_PRIMEROS_PASOS = "vendefrio_primeros_pasos";

function dibujarPrimerosPasos(comercios, pedidos) {
    const caja = document.getElementById("dashPrimerosPasos");
    if (!caja) return;
    let cerrado = false;
    try { cerrado = localStorage.getItem(CLAVE_PRIMEROS_PASOS) === "cerrado"; } catch (error) { cerrado = false; }

    const productos = obtenerProductos();
    const hayProductos = Object.values(productos).some(lista => Array.isArray(lista) && lista.length > 0);
    const pasos = [
        { hecho: hayProductos, texto: "Cargá tus productos y precios", accion: () => mostrarPantalla("productos") },
        { hecho: comercios.length > 0, texto: "Sumá los comercios que visitás", accion: () => mostrarPantalla("comercios") },
        { hecho: pedidos.length > 0, texto: "Cargá tu primer pedido", accion: () => abrirNuevoPedido() }
    ];
    const hechos = pasos.filter(paso => paso.hecho).length;
    if (cerrado || hechos === pasos.length) {
        caja.classList.add("oculto");
        return;
    }

    caja.classList.remove("oculto");
    caja.innerHTML = "";
    const cabecera = document.createElement("div");
    cabecera.className = "primerosPasosCabecera";
    cabecera.innerHTML = "<div><strong>Primeros pasos</strong><small></small></div>";
    cabecera.querySelector("small").textContent = hechos + " de " + pasos.length + " listos";
    const ocultar = document.createElement("button");
    ocultar.type = "button";
    ocultar.className = "ocultarPrimerosPasos";
    ocultar.textContent = "Ocultar";
    ocultar.addEventListener("click", () => {
        try { localStorage.setItem(CLAVE_PRIMEROS_PASOS, "cerrado"); } catch (error) { /* sin lugar */ }
        caja.classList.add("oculto");
    });
    cabecera.appendChild(ocultar);
    caja.appendChild(cabecera);

    const barra = document.createElement("div");
    barra.className = "barraSemana";
    barra.innerHTML = "<span></span>";
    barra.querySelector("span").style.width = Math.round(hechos / pasos.length * 100) + "%";
    caja.appendChild(barra);

    pasos.forEach(paso => {
        const fila = document.createElement("button");
        fila.type = "button";
        fila.className = "pasoPrimeros" + (paso.hecho ? " hecho" : "");
        fila.innerHTML = '<span class="tildePaso">' + (paso.hecho ? window.icono("check", 14) : "") + "</span><span></span>" + (paso.hecho ? "" : window.icono("chevDerecha", 16));
        fila.children[1].textContent = paso.texto;
        if (!paso.hecho) fila.addEventListener("click", paso.accion);
        else fila.disabled = true;
        caja.appendChild(fila);
    });
}

// -----------------------------------------------------
// "Suelen pedir hoy" (Etapa 6, T46): comercios que en las últimas 8
// semanas pidieron este mismo día de la semana al menos 2 veces y hoy
// todavía no tienen pedido.
// -----------------------------------------------------

const DIAS_SEMANA = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];

function comerciosQueSuelenPedirHoy(pedidos, cargadosHoy) {
    const hoy = new Date();
    const dia = hoy.getDay();
    const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 56).getTime();
    const normalizarNombre = texto => String(texto || "").trim().toLocaleLowerCase("es");
    const conPedidoHoy = new Set(cargadosHoy.map(pedido => normalizarNombre(pedido.comercio || pedido.cliente)));
    const dias = new Map();
    pedidos.forEach(pedido => {
        const fecha = obtenerFechaPedidoDashboard(pedido);
        if (!fecha || fecha.getTime() < desde || fecha.getDay() !== dia || esDeHoyInicio(pedido)) return;
        const clave = normalizarNombre(pedido.comercio || pedido.cliente);
        if (!clave) return;
        if (!dias.has(clave)) dias.set(clave, new Set());
        dias.get(clave).add(fecha.toDateString());
    });
    return Array.from(dias.entries())
        .filter(([clave, fechas]) => fechas.size >= 2 && !conPedidoHoy.has(clave))
        .map(([clave, fechas]) => ({ clave, veces: fechas.size }))
        .sort((a, b) => b.veces - a.veces);
}

function dibujarVisitarHoy(comercios, pedidos, cargadosHoy) {
    const seccion = document.getElementById("dashVisitarHoy");
    const lista = document.getElementById("dashListaVisitarHoy");
    if (!seccion || !lista) return;
    const sugeridos = comerciosQueSuelenPedirHoy(pedidos, cargadosHoy)
        .map(item => ({ ...item, comercio: comercios.find(comercio => String(comercio.nombre || "").trim().toLocaleLowerCase("es") === item.clave) }))
        .filter(item => item.comercio)
        .slice(0, 5);
    seccion.classList.toggle("oculto", sugeridos.length === 0);
    if (!sugeridos.length) return;
    const dia = DIAS_SEMANA[new Date().getDay()];
    document.getElementById("tituloVisitarHoy").textContent = "Suelen pedir los " + dia;
    lista.innerHTML = "";
    sugeridos.forEach(item => {
        const fila = document.createElement("div");
        fila.className = "filaInicio filaVisitarHoy";
        const avatar = document.createElement("span");
        avatar.className = "inicialesInicio";
        avatar.dataset.tono = String(item.comercio.nombre.length % 4);
        avatar.textContent = typeof iniciales === "function" ? iniciales(item.comercio.nombre) : String(item.comercio.nombre).trim().slice(0, 2).toUpperCase();
        const texto = document.createElement("span");
        texto.className = "textoFilaInicio";
        const nombre = document.createElement("strong");
        nombre.textContent = item.comercio.nombre;
        const detalle = document.createElement("small");
        detalle.textContent = "Pidió " + item.veces + " de los últimos 8 " + dia;
        texto.append(nombre, detalle);
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "btnAccion agregar botonPedidoVisitarHoy";
        boton.innerHTML = window.icono("mas", 16) + " Pedido";
        boton.setAttribute("aria-label", "Cargar pedido para " + item.comercio.nombre);
        boton.addEventListener("click", () => irAPedidoRapido(item.comercio.nombre));
        fila.append(avatar, texto, boton);
        lista.appendChild(fila);
    });
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

    if (accion === "vendidoSemana" && typeof window.abrirEstadisticas === "function") {
        window.abrirEstadisticas();
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

document.getElementById("botonAvatar")?.addEventListener("click", () => abrirMenuMas());
document.getElementById("dashVerTodos")?.addEventListener("click", () => {
    if (usaNubeReal() && window.seguimientoVendeFrio?.abrirHistorial) {
        if (window.seguimientoVendeFrio.abrirEtapa("cargados")) return;
    }
    mostrarPantalla(usaNubeReal() ? "pedido" : "historial");
});
window.empleadosVendeFrio?.escucharQuienSoy?.(() => actualizarEncabezadoInicio());

// -----------------------------------------------------
// NAVEGACI\u00d3N
// -----------------------------------------------------

// "Más" (T31): es la pantalla de configuración agrupada, que arriba tiene
// los accesos a Rutas, Estadísticas y las demás secciones.
function abrirMenuMas() {
    if (typeof window.abrirConfiguracion === "function") window.abrirConfiguracion();
    document.querySelectorAll(".nav-item").forEach(btn => btn.classList.toggle("activo", btn.dataset.pantalla === "mas"));
    window.scrollTo(0, 0);
}

document.addEventListener("click", event => {
    const boton = event.target.closest?.("[data-mas]");
    if (!boton) return;
    const destino = boton.dataset.mas;
    if (destino === "estadisticas" && typeof window.abrirEstadisticas === "function") window.abrirEstadisticas();
    else if (destino === "cierre" && window.cierreVendeFrio) window.cierreVendeFrio.abrir();
    else if (destino === "configuracion") abrirMenuMas();
    else if ((window.accesosMasExtras || []).some(acceso => acceso.destino === destino)) {
        window.accesosMasExtras.find(acceso => acceso.destino === destino).abrir();
    }
    else mostrarPantalla(destino);
});

// Botón "+" de la barra (T31): abre "Nuevo pedido". Si ya se ve la lista
// de Pedidos (en la nube), usa su botón de "Nuevo pedido".
function abrirNuevoPedido() {
    const pedido = pantallas.pedido;
    if (pedido && !pedido.classList.contains("oculto")) {
        document.querySelector(".botonNuevoPedido")?.click();
    } else {
        mostrarPantalla("pedido");
    }
    document.querySelectorAll(".nav-item").forEach(btn => btn.classList.remove("activo"));
}
window.abrirNuevoPedido = abrirNuevoPedido;

// Mientras se carga un pedido (T34) no se ve la barra de abajo: el total y
// "Guardar pedido" quedan fijos abajo. En el modo personal, la "X" de arriba
// vuelve a Inicio (en la nube, la flecha vuelve a la lista de Pedidos).
function actualizarModoCargaPedido() {
    const pedido = pantallas.pedido;
    if (!pedido) return;
    const cargando = !pedido.classList.contains("oculto") && pedido.dataset.vista !== "pedidos";
    document.documentElement.classList.toggle("enCargaPedido", cargando);
    document.getElementById("cerrarCargaPedido")?.classList.toggle("oculto", !cargando || usaNubeReal());
}
if (pantallas.pedido) {
    new MutationObserver(actualizarModoCargaPedido)
        .observe(pantallas.pedido, { attributes: true, attributeFilter: ["class", "data-vista"] });
}
document.getElementById("cerrarCargaPedido")?.addEventListener("click", () => mostrarPantalla("menu"));

document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", event => {
        event.preventDefault();
        if (btn.dataset.accion === "nuevoPedido") {
            abrirNuevoPedido();
            return;
        }
        let destino = btn.dataset.pantalla;
        // "Pedidos" en el modo personal: la lista es Historial.
        if (destino === "pedido" && !usaNubeReal()) destino = "historial";
        if (destino) mostrarPantalla(destino);
    });
});

document.querySelectorAll(".volverMenu").forEach(boton => {
    boton.addEventListener("click", () => mostrarPantalla("menu"));
});

// Nombre de la distribuidora debajo de "VendeFrío" (T13), solo con sesión.
function mostrarNombreDistribuidora(nombre) {
    const texto = document.getElementById("dashNombreDistribuidora");
    if (!texto) return;

    const conSesion = Boolean(window.cuentaVendeFrio?.usuarioActual());
    const visible = conSesion && Boolean(nombre);
    // Estilo nuevo (T31): sin sesión o sin nombre dice "VendeFrío".
    texto.textContent = visible ? nombre : "VendeFrío";
    texto.classList.remove("oculto");
}

if (window.distribuidoraVendeFrio?.escucharNombre) {
    window.distribuidoraVendeFrio.escucharNombre(mostrarNombreDistribuidora);
}

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

// Etapa 4: botones en fila (Hoy / Semana / Mes / Todo, Todos / Pendientes /
// Visitados) en lugar de un desplegable. El desplegable queda escondido y
// sigue siendo el que manda: el botón le cambia el valor y avisa el cambio,
// y quien cambia el valor por código llama a sincronizarSegmento.
function crearSegmentoDeSelect(select, opciones, etiqueta, inicial) {
    if (!select) return null;
    select.innerHTML = "";
    opciones.forEach(([valor, texto]) => {
        const opcion = document.createElement("option");
        opcion.value = valor;
        opcion.textContent = texto;
        select.appendChild(opcion);
    });
    select.value = inicial;
    select.classList.add("oculto");

    const segmento = document.createElement("div");
    segmento.className = "segmentoPeriodo";
    segmento.setAttribute("role", "radiogroup");
    segmento.setAttribute("aria-label", etiqueta);
    opciones.forEach(([valor, texto]) => {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.dataset.valor = valor;
        boton.setAttribute("role", "radio");
        boton.textContent = texto;
        boton.addEventListener("click", () => {
            if (select.value === valor) return;
            select.value = valor;
            sincronizarSegmento(segmento, valor);
            select.dispatchEvent(new Event("change"));
        });
        segmento.appendChild(boton);
    });
    select.after(segmento);
    sincronizarSegmento(segmento, select.value);
    return segmento;
}

function sincronizarSegmento(segmento, valor) {
    if (!segmento) return;
    segmento.querySelectorAll("button[data-valor]").forEach(boton => {
        const activo = boton.dataset.valor === valor;
        boton.classList.toggle("activo", activo);
        boton.setAttribute("aria-checked", activo ? "true" : "false");
    });
}
