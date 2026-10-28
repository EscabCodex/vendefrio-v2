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

// Las listas largas de las pantallas que se dejan se vacían: se vuelven a
// dibujar al entrar, y miles de tarjetas ocultas hacen más lento todo lo
// demás (T151).
function vaciarListasOcultas(nombre) {
    [["historial", "contenedorHistorial"], ["comercios", "listaComerciosAdmin"]].forEach(([pantalla, id]) => {
        const lista = document.getElementById(id);
        if (pantalla === nombre || !lista || !lista.firstChild) return;
        window.piezas?.cortarTandas(lista);
        lista.replaceChildren();
    });
}

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
    vaciarListasOcultas(nombre);

    if (pantallas[nombre]) {
        pantallas[nombre].classList.remove("oculto");
        pantallas[nombre].classList.remove("entrada-pantalla");
        void pantallas[nombre].offsetWidth;
        pantallas[nombre].classList.add("entrada-pantalla");
    }

    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.classList.toggle("activo", btn.dataset.pantalla === nombre || btn.dataset.tambien === nombre);
    });
    window.piezas?.acomodarCabeceras?.();

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
let horaUbicacionDashboard = 0;
let solicitandoUbicacionDashboard = false;

function distanciaDashboard(lat1, lng1, lat2, lng2) {
    const radio = 6371; const rad = valor => valor * Math.PI / 180; const dLat = rad(lat2 - lat1); const dLng = rad(lng2 - lng1); const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2; return radio * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// La ubicación se pide de nuevo si tiene más de 2 minutos: andando, la
// parada más cercana cambia. "Actualizar mi ubicación" la pide en el momento.
function actualizarUbicacionDashboard(forzar = false) {
    const vieja = Date.now() - horaUbicacionDashboard > 120000;
    if ((!forzar && ubicacionDashboard && !vieja) || solicitandoUbicacionDashboard || !navigator.geolocation) return;
    solicitandoUbicacionDashboard = true;
    navigator.geolocation.getCurrentPosition(posicion => {
        ubicacionDashboard = { lat: posicion.coords.latitude, lng: posicion.coords.longitude };
        horaUbicacionDashboard = Date.now();
        solicitandoUbicacionDashboard = false;
        actualizarDashboard();
    }, error => {
        solicitandoUbicacionDashboard = false;
        if (!forzar) return;
        document.querySelectorAll(".btnUbicacionDashboard").forEach(boton => { boton.disabled = false; boton.classList.remove("buscando"); });
        if (error && error.code === 1) explicarPermisoUbicacion();
        else if (typeof mostrarToast === "function") mostrarToast("No se pudo saber dónde estás. Revisá que el GPS esté prendido.");
    }, { enableHighAccuracy: true, maximumAge: forzar ? 0 : 120000, timeout: 8000 });
}

// T178: si el permiso de ubicación está negado, el celular ya no pregunta;
// una hoja explica cómo prenderlo. La ubicación no es obligatoria.
function explicarPermisoUbicacion() {
    const p = window.piezas;
    if (!p || typeof p.hoja !== "function") {
        if (typeof mostrarToast === "function") mostrarToast("La app no tiene permiso para saber dónde estás.");
        return;
    }
    p.hoja({
        titulo: "Prendé la ubicación",
        sub: "Así Inicio te muestra el comercio sin visitar más cerca tuyo. Es opcional: sin ella, la app anda igual.",
        clase: "hojaPermisoUbicacion",
        html: `<ol class="pasosPermiso">
            <li>Tocá el candadito o los tres puntitos de Chrome, arriba al lado de la dirección.</li>
            <li>Entrá a <b>Permisos</b> (o <b>Configuración del sitio</b>) › <b>Ubicación</b>.</li>
            <li>Elegí <b>Permitir</b> y volvé a tocar el botón de ubicación.</li>
        </ol>
        <p class="pzHojaSub">Si instalaste la app, también está en Ajustes del teléfono › Apps › VendeFrío › Permisos. Y revisá que el GPS del celular esté prendido.</p>`,
        botones: [{ texto: "Entendido" }]
    });
}

// -----------------------------------------------------
// INICIO (T32): resumen de hoy, próxima parada, pedidos de hoy y semana
// -----------------------------------------------------

// Repaso de diseño de Inicio (T178): los cuadritos de la tarjeta azul son
// accesos. Arriba, la semana (cargados que faltan entregar y entregados) y
// lo cobrado hoy; abajo, lo de hoy.
const ESTADOS_EN_CAMINO_INICIO = ["cargado", "enPreparacion", "preparado", "enVehiculo", "enReparto"];

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
        const indice = historialParaLeer().findIndex(item => item.id === pedido.id);
        if (indice >= 0) abrirHistorialDePedido(indice);
    }
}

function dibujarKpisInicio(cuentas, nube, conPlata) {
    const caja = document.getElementById("dashKpis");
    if (!caja) return;

    const deHoy = typeof cuentas.visitadosHoy === "number" ? cuentas.visitadosHoy : 0;
    let kpis;
    if (nube) {
        kpis = [
            { id: "cargados", texto: "Cargados", valor: cuentas.cargadosSemana, etapa: "paraArmar" },
            { id: "entregados", texto: "Entregados", valor: cuentas.entregadosSemana, etapa: "historial" }
        ];
        const cobrado = conPlata && window.cierreVendeFrio?.disponible?.() ? cobradoHoyInicio() : null;
        if (cobrado !== null) kpis.push({ id: "cobradoHoy", texto: "Cobrado hoy", valor: textoPlataCortoInicio(cobrado), accion: "cobradoHoy" });
        kpis.push(
            { id: "cargadosHoy", texto: "Cargados hoy", valor: cuentas.cargadosHoy.length, etapa: "paraArmar" },
            { id: "entregadosHoy", texto: "Entregados hoy", valor: cuentas.entregadosHoy, etapa: "historial" },
            { id: "visitadosHoy", texto: "Visitados hoy", valor: deHoy, accion: "visitadosSemana" }
        );
    } else {
        kpis = [
            { id: "semana", texto: "Pedidos", valor: cuentas.pedidosSemana.length, accion: "pedidosSemana" },
            { id: "pendientes", texto: "Sin visitar", valor: cuentas.comercios.length - cuentas.visitadosSemana, accion: "pendientesSemana" },
            { id: "hoy", texto: "Pedidos hoy", valor: cuentas.cargadosHoy.length, accion: "pedidosHoy" },
            { id: "comerciosHoy", texto: "Comercios hoy", valor: comerciosDistintosInicio(cuentas.cargadosHoy), accion: "pedidosHoy" },
            { id: "visitadosHoy", texto: "Visitados hoy", valor: deHoy, accion: "visitadosSemana" }
        ];
    }
    // Sin "Cobrado hoy", la fila de arriba lleva dos cuadros más anchos.
    caja.classList.toggle("kpisDosArriba", kpis.length === 5);

    const firma = kpis.map(kpi => kpi.id + ":" + kpi.valor).join("|");
    if (caja.dataset.firma === firma) return;
    caja.dataset.firma = firma;
    caja.innerHTML = "";
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

function comerciosDistintosInicio(pedidos) {
    return new Set(pedidos.map(pedido => String(pedido.comercio || pedido.cliente || "").trim().toLocaleLowerCase("es"))).size;
}

// Lo cobrado hoy, igual que la caja del Cierre (cobros y pagos de hoy).
// Se recuerda hasta que cambian los pedidos, los pagos o el día.
function cobradoHoyInicio() {
    const pagos = window.extrasVendeFrio?.marca?.("pagos");
    return recordarHastaQueCambie("cobradoHoyInicio", ["historial"], () => {
        try {
            const inicio = new Date();
            inicio.setHours(0, 0, 0, 0);
            return Number(window.cierreVendeFrio.calcular(inicio).totalRecaudado) || 0;
        } catch (error) {
            return 0;
        }
    }, new Date().toDateString() + "|" + pagos);
}

// "Semana 5 de 5": las semanas del mes, de lunes a domingo.
function semanaDelMesInicio(fecha) {
    const corrimiento = (new Date(fecha.getFullYear(), fecha.getMonth(), 1).getDay() + 6) % 7;
    const dias = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
    return {
        numero: Math.floor((fecha.getDate() - 1 + corrimiento) / 7) + 1,
        total: Math.ceil((dias + corrimiento) / 7)
    };
}

function comercioVisitadoHoyInicio(comercio) {
    if (!comercio || !comercio.ultimaVisita) return false;
    const fecha = obtenerFechaLocalDesdeTexto(comercio.ultimaVisita);
    return Boolean(fecha) && fecha.toDateString() === new Date().toDateString();
}

function dibujarPedidosDeHoyInicio(pedidosHoy, vePlata = true) {
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
        if (vePlata) partes.push(unidadesInicio(pedido) + " u");
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
        if (!vePlata) {
            // T178: sin permiso para ver la plata, productos y unidades.
            const productos = new Set((Array.isArray(pedido.productos) ? pedido.productos : [])
                .filter(item => item && Number(item.cantidad) > 0)
                .map(item => String(item.marca || "") + "|" + String(item.producto || item.nombre || ""))).size;
            const cantidad = document.createElement("small");
            cantidad.className = "cantidadFilaInicio";
            cantidad.textContent = productos + (productos === 1 ? " producto" : " productos") + " | " + unidadesInicio(pedido) + " u";
            derecha.appendChild(cantidad);
        } else if (total > 0) {
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

// Datos cortos de la próxima parada (T178): hace cuánto se visitó, si debe
// y cada cuánto pide. Van en una sola línea, sin agrandar la tarjeta.
function diasDesdeVisitaInicio(comercio) {
    const fecha = comercio && comercio.ultimaVisita ? obtenerFechaLocalDesdeTexto(comercio.ultimaVisita) : null;
    if (!fecha) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((hoy - fecha) / 86400000));
}

function pideCadaInicio(nombre, pedidos) {
    const clave = String(nombre || "").trim().toLocaleLowerCase("es");
    return recordarHastaQueCambie("pideCadaInicio", ["historial"], () => {
        const dias = [...new Set(pedidos
            .filter(pedido => String(pedido.comercio || pedido.cliente || "").trim().toLocaleLowerCase("es") === clave)
            .map(pedido => obtenerFechaPedidoDashboard(pedido))
            .filter(Boolean)
            .map(fecha => new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime()))]
            .sort((a, b) => b - a)
            .slice(0, 6);
        // Hacen falta al menos tres pedidos en días distintos.
        if (dias.length < 3) return 0;
        return Math.max(1, Math.round((dias[0] - dias[dias.length - 1]) / 86400000 / (dias.length - 1)));
    }, clave);
}

function chipsProximaParadaInicio(comercio, pedidos, vePlata) {
    const chips = [];
    const horario = String(comercio.horario || "").trim();
    // Con horario cargado (T69), el primero dice cuándo atiende.
    if (horario) chips.push(["chipEstado chipHorario", horario]);
    const dias = diasDesdeVisitaInicio(comercio);
    chips.push(["chipEstado", dias === null ? "Sin visitas" : dias === 0 ? "Visitado hoy" : "Hace " + dias + (dias === 1 ? " día" : " días")]);
    const debe = vePlata && window.saldosVendeFrio?.deudaDe ? window.saldosVendeFrio.deudaDe(comercio.nombre) : 0;
    if (debe > 0) chips.push(["chipDebeParada", "Debe " + textoPlataInicio(debe)]);
    const cada = pideCadaInicio(comercio.nombre, pedidos);
    if (cada) chips.push(["chipDatoParada", "Pide cada " + cada + (cada === 1 ? " día" : " días")]);
    const caja = document.createElement("span");
    caja.className = "paradaChips";
    chips.forEach(([clase, texto]) => {
        const chip = document.createElement("span");
        chip.className = clase;
        if (clase.startsWith("chipEstado") && !horario) chip.dataset.tono = "aviso";
        chip.textContent = texto;
        caja.appendChild(chip);
    });
    return caja;
}

// Un acceso como los de la ficha del comercio: cuadradito con ícono y nombre.
function accesoParadaInicio(etiqueta, icono, texto, clase) {
    const acceso = document.createElement(etiqueta);
    acceso.className = "paradaAcceso " + clase;
    if (etiqueta === "button") acceso.type = "button";
    acceso.innerHTML = `<span class="paradaAccesoIcono">${window.icono(icono, 20)}</span><span class="paradaAccesoTexto"></span>`;
    acceso.querySelector(".paradaAccesoTexto").textContent = texto;
    return acceso;
}

function dibujarProximaParadaInicio(comercios, pedidos = [], vePlata = true) {
    const contenedor = document.getElementById("dashProximaParada");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    // T178: con la ubicación dice que es el más cercano.
    const titulo = document.getElementById("tituloProximaParada");
    if (titulo) titulo.textContent = ubicacionDashboard ? "Más cerca tuyo, sin visitar" : "Siguiente parada";

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

    const cabeza = document.createElement("div");
    cabeza.className = "paradaCabeza";

    // El nombre abre la ficha del comercio arriba de Inicio.
    const info = document.createElement("button");
    info.type = "button";
    info.className = "paradaInfo";
    info.setAttribute("aria-label", "Ver ficha de " + sugerido.nombre);
    info.innerHTML = `<span class="paradaIcono">${window.icono("tienda", 22)}</span><span class="paradaTexto"><strong></strong><small></small></span>`;
    info.querySelector("strong").textContent = sugerido.nombre;
    const partes = [sugerido.direccion || "Dirección pendiente"];
    if (ubicacionDashboard && tieneGpsValidoDashboard(sugerido)) {
        const km = distanciaDashboard(ubicacionDashboard.lat, ubicacionDashboard.lng, Number(sugerido.lat), Number(sugerido.lng));
        partes.push(km < 1 ? "a " + Math.round(km * 100) * 10 + " m" : "a " + km.toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " km");
    }
    info.querySelector("small").textContent = partes.join(" · ");
    info.querySelector(".paradaTexto").appendChild(chipsProximaParadaInicio(sugerido, pedidos, vePlata));
    info.addEventListener("click", () => {
        if (typeof window.abrirFichaComercio === "function") window.abrirFichaComercio(sugerido.nombre);
    });
    cabeza.appendChild(info);

    // Botoncito redondo: sin ubicación la pide (y prende el permiso); con
    // ubicación la vuelve a pedir y elige otra vez la más cercana.
    if (navigator.geolocation) {
        const ubicar = document.createElement("button");
        ubicar.type = "button";
        ubicar.className = "btnUbicacionDashboard";
        const etiqueta = ubicacionDashboard ? "Actualizar mi ubicación" : "Usar mi ubicación";
        ubicar.setAttribute("aria-label", etiqueta);
        ubicar.title = etiqueta;
        ubicar.innerHTML = window.icono("mira", 19);
        ubicar.addEventListener("click", () => {
            ubicar.disabled = true;
            ubicar.classList.add("buscando");
            actualizarUbicacionDashboard(true);
        });
        cabeza.appendChild(ubicar);
    }

    // Los mismos accesos que la ficha: Pedido, Llamar, Ya llego, Ir y Sin pedido.
    const acciones = document.createElement("div");
    acciones.className = "paradaAcciones";

    const pedido = accesoParadaInicio("button", "documento", "Pedido", "agregar");
    pedido.setAttribute("aria-label", "Cargar pedido");
    pedido.addEventListener("click", () => irAPedidoRapido(sugerido.nombre));
    acciones.appendChild(pedido);

    const telefono = String(sugerido.telefono || "").replace(/[^\d+]/g, "");
    if (telefono) {
        const llamar = accesoParadaInicio("a", "telefono", "Llamar", "paradaLlamar");
        llamar.href = "tel:" + telefono;
        acciones.appendChild(llamar);
    }

    // "Ya llego" por WhatsApp (T72), con teléfono.
    const yaLlego = window.yaLlegoVendeFrio ? window.yaLlegoVendeFrio.enlace(sugerido) : "";
    if (yaLlego) {
        const aviso = accesoParadaInicio("a", "whatsapp", "Ya llego", "paradaYaLlego");
        aviso.href = yaLlego;
        aviso.target = "_blank";
        aviso.rel = "noopener";
        acciones.appendChild(aviso);
    }

    // "Ir": la navegación propia (navegacion.js) o, si no se puede, Google Maps.
    const ir = accesoParadaInicio("a", "navegar", "Ir", "botonIr");
    ir.target = "_blank";
    ir.rel = "noopener";
    const destino = tieneGpsValidoDashboard(sugerido)
        ? sugerido.lat + "," + sugerido.lng
        : sugerido.direccion || sugerido.nombre;
    ir.href = "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + encodeURIComponent(destino);
    // Con GPS guardado, "Ir" abre la navegación propia (Etapa 5).
    ir.dataset.navegarA = sugerido.nombre;
    acciones.appendChild(ir);

    // "Visité, sin pedido" (T65): pide el motivo y lo marca visitado.
    if (window.visitasVendeFrio) {
        const sinPedido = accesoParadaInicio("button", "cerrarX", "Sin pedido", "paradaSinPedido");
        sinPedido.setAttribute("aria-label", "Visité, sin pedido");
        sinPedido.addEventListener("click", () => window.visitasVendeFrio.abrir(sugerido.nombre));
        acciones.appendChild(sinPedido);
    }
    acciones.style.setProperty("--accesos", String(acciones.children.length));
    contenedor.append(cabeza, acciones);
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

// Las cuentas de Inicio, recordadas hasta que cambian los pedidos, los
// comercios o el día (repasada): Inicio se dibuja muchas veces seguidas y
// con miles de pedidos recorrerlos todos cada vez trababa el celular.
function cuentasDeInicio() {
    return recordarHastaQueCambie("cuentasDeInicio", ["historial", "comercios"], () => {
        const comercios = comerciosActivosParaLeer();
        const pedidos = pedidosQueCuentanParaLeer();
        const cargadosHoy = pedidos.filter(esDeHoyInicio);
        const pedidosSemana = pedidos.filter(pedido => esFechaDeSemanaActual(obtenerFechaPedidoDashboard(pedido)));
        // T178: los entregados se cuentan el día que se entregaron.
        const entregados = pedidos.filter(pedido => estadoInicio(pedido) === "entregado")
            .map(pedido => horaDelEstadoInicio(pedido)).filter(hora => hora > 0);
        const inicioSemana = obtenerInicioSemanaActual().getTime();
        const productosHoy = new Set();
        cargadosHoy.forEach(pedido => (Array.isArray(pedido.productos) ? pedido.productos : []).forEach(item => {
            if (item && Number(item.cantidad) > 0) productosHoy.add(String(item.marca || "") + "|" + String(item.producto || item.nombre || ""));
        }));
        return Object.freeze({
            comercios,
            pedidos,
            pedidosHoy: Object.freeze(pedidosDeHoyInicio(pedidos)),
            cargadosHoy: Object.freeze(cargadosHoy),
            pedidosSemana: Object.freeze(pedidosSemana),
            visitadosSemana: comercios.filter(comercioVisitadoRecientemente).length,
            visitadosHoy: comercios.filter(comercioVisitadoHoyInicio).length,
            cargadosSemana: pedidosSemana.filter(pedido => ESTADOS_EN_CAMINO_INICIO.includes(estadoInicio(pedido))).length,
            entregadosSemana: entregados.filter(hora => hora >= inicioSemana).length,
            entregadosHoy: entregados.filter(hora => esDeHoyInicio({ timestamp: hora })).length,
            productosHoy: productosHoy.size
        });
    }, new Date().toDateString() + "|" + usaNubeReal());
}

function actualizarDashboard() {
    actualizarUbicacionDashboard();
    actualizarEncabezadoInicio();

    const nube = usaNubeReal();
    // Para leer, sin copiar los datos en cada dibujo (repasada).
    const cuentas = cuentasDeInicio();
    const { comercios, pedidos, pedidosHoy, cargadosHoy, pedidosSemana, visitadosSemana } = cuentas;
    const sinVisitar = comercios.length - visitadosSemana;

    // Resumen de hoy, con la semana del mes (T178).
    const hoy = new Date();
    const fecha = document.getElementById("dashFechaHoy");
    if (fecha) {
        const semana = semanaDelMesInicio(hoy);
        fecha.textContent = "Hoy · " + hoy.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }) +
            " / Semana " + semana.numero + " de " + semana.total;
    }
    const vendido = cargadosHoy.reduce((total, pedido) => total + totalInicio(pedido), 0);
    const hayPrecios = cargadosHoy.some(pedido => totalInicio(pedido) > 0);
    const comerciosHoy = comerciosDistintosInicio(cargadosHoy);
    // T93: sin permiso para ver la plata, unidades en vez de pesos.
    const vePlata = window.verPlataVendeFrio?.puedoVer?.() !== false;
    const conPlata = vePlata && (hayPrecios || nube);
    const textos = {
        dashTituloHoy: conPlata ? "Vendido hoy" : "Unidades hoy",
        dashVendidoHoy: conPlata
            ? textoPlataInicio(vendido)
            : String(cargadosHoy.reduce((total, pedido) => total + unidadesInicio(pedido), 0)) + " u",
        dashResumenHoy: cargadosHoy.length + (cargadosHoy.length === 1 ? " pedido" : " pedidos") + " · " +
            comerciosHoy + (comerciosHoy === 1 ? " comercio" : " comercios"),
        dashVisitasHechas: visitadosSemana,
        dashVisitasTotal: "de " + comercios.length,
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
    const avance = (comercios.length ? Math.round(visitadosSemana / comercios.length * 100) : 0) + "%";
    ["dashBarraSemana", "dashVisitasBarra"].forEach(id => {
        const barra = document.getElementById(id);
        if (barra) barra.style.width = avance;
    });
    dibujarDerechaResumenInicio(cuentas, vePlata);

    dibujarKpisInicio(cuentas, nube, vePlata);
    dibujarPedidosDeHoyInicio(nube ? pedidosHoy : cargadosHoy, vePlata);
    dibujarProximaParadaInicio(comercios, pedidos, vePlata);
    dibujarPrimerosPasos(comercios, pedidos);
    dibujarVisitarHoy(comercios, pedidos, cargadosHoy);
    inicioDibujadoUnaVez = true;
}

// A la derecha de "Vendido hoy" (T178): "Te deben" del mismo tamaño para
// quien cobra (lo mismo que calcula "A cobrar"); si no, los productos
// distintos vendidos hoy.
function dibujarDerechaResumenInicio(cuentas, vePlata) {
    const caja = document.getElementById("dashDerechaHoy");
    if (!caja) return;
    const deudas = vePlata && window.saldosVendeFrio?.resumenDeudas?.();
    const debe = Boolean(deudas);
    caja.classList.toggle("resumenHoyDeben", debe);
    caja.dataset.accion = debe ? "teDeben" : "vendidoHoy";
    const textos = debe
        ? ["Te deben", textoPlataInicio(deudas.total),
            deudas.comercios ? deudas.comercios + (deudas.comercios === 1 ? " comercio" : " comercios") : "Nadie te debe"]
        : ["Productos distintos", String(cuentas.productosHoy), "vendidos hoy"];
    caja.querySelector("small").textContent = textos[0];
    caja.querySelector("strong").textContent = textos[1];
    caja.querySelector("span").textContent = textos[2];
    caja.setAttribute("aria-label", textos.join(" ") + (debe ? ". Ver a cobrar por comercio" : ""));
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

    const productos = productosParaLeer();
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

    // Tutorial (T157): primero, la invitación a hacer lo básico con los
    // botones señalados en la pantalla real.
    if (window.tutorialVendeFrio) {
        const recorrido = document.createElement("button");
        recorrido.type = "button";
        recorrido.className = "pasoPrimeros recorridoPrimeros";
        recorrido.innerHTML = '<span class="tildePaso">' + window.icono("chispa", 14) + "</span><span></span>" + window.icono("chevDerecha", 16);
        recorrido.children[1].textContent = window.tutorialVendeFrio.yaLoVio() ? "Ver de nuevo el tutorial" : "Hacelo con el tutorial, paso a paso";
        recorrido.addEventListener("click", () => window.tutorialVendeFrio.abrir());
        caja.appendChild(recorrido);
    }

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

function tarjetaInicioPrendida(campo, porDefecto) {
    try {
        const valor = (JSON.parse(localStorage.getItem("vendefrio_preferencias")) || {})[campo];
        return valor === undefined ? porDefecto : valor === true;
    } catch (error) {
        return porDefecto;
    }
}

function dibujarVisitarHoy(comercios, pedidos, cargadosHoy) {
    const seccion = document.getElementById("dashVisitarHoy");
    const lista = document.getElementById("dashListaVisitarHoy");
    if (!seccion || !lista) return;
    // T156: arranca apagada; si está apagada en Más > Apariencia, ni se calcula.
    if (!tarjetaInicioPrendida("inicioVerSuelenPedir", false)) {
        seccion.classList.add("oculto");
        return;
    }
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

    if (accion === "teDeben" && window.saldosVendeFrio?.abrirPantalla) {
        window.saldosVendeFrio.abrirPantalla();
    }

    if (accion === "cobradoHoy" && window.cierreVendeFrio?.abrir) {
        window.cierreVendeFrio.abrir();
    }

    // Repasada: Estadísticas abre en el período del número que se tocó.
    if (accion === "vendidoSemana" && typeof window.abrirEstadisticas === "function") {
        window.abrirEstadisticas("semana");
    }

    if (accion === "vendidoHoy" && typeof window.abrirEstadisticas === "function") {
        window.abrirEstadisticas("hoy");
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

    // Repasada: "Vendido hoy" lleva a Estadísticas de hoy y "23 de 80
    // comercios visitados" a la lista de los visitados.
    const tocable = window.piezas && window.piezas.tocable;
    if (!tocable) return;
    tocable(document.getElementById("dashHoyVendido"), () => ejecutarAccionTarjetaDashboard("vendidoHoy"));
    tocable(document.getElementById("dashSemanaVisitados"), () => ejecutarAccionTarjetaDashboard("visitadosSemana"));
    // T178: la barra de visitados lleva a los que faltan; "Te deben", a A cobrar.
    document.getElementById("dashVisitas")?.addEventListener("click", () => ejecutarAccionTarjetaDashboard("pendientesSemana"));
    document.getElementById("dashDerechaHoy")?.addEventListener("click", evento => {
        ejecutarAccionTarjetaDashboard(evento.currentTarget.dataset.accion || "vendidoHoy");
    });
    // El logo y el nombre, juntos, llevan a Tu cuenta.
    const marca = document.querySelector("#pantallaMenu .dashboardMarca");
    const irACuenta = () => {
        if (typeof window.abrirConfiguracionEn === "function") window.abrirConfiguracionEn("cuenta");
        else abrirMenuMas();
    };
    if (marca) tocable(marca, irACuenta, { rol: false });
    document.querySelector("#pantallaMenu .inicioLogo")?.addEventListener("click", irACuenta);
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

// Para los cambios que llegan solos (de la nube o de otro celular): Inicio se
// redibuja una sola vez aunque lleguen varios juntos. Al abrir la app llegan
// por separado los comercios, los productos, los pedidos y los pagos, y
// redibujar Inicio con cada uno trababa un celular barato.
// Con Inicio escondido se espera más (repasada): lo que llega de la nube en
// tandas se junta en menos redibujos mientras se usa otra pantalla. No se
// saltea, porque de este redibujo cuelgan avisos que trabajan aunque no se
// vea Inicio (por ejemplo, apagar la ubicación al terminar el reparto). Al
// volver a Inicio se dibuja enseguida (mostrarPantalla).
let relojInicio = null;
function pedirActualizarDashboard() {
    if (relojInicio) return;
    const escondido = Boolean(pantallas.menu && pantallas.menu.classList.contains("oculto"));
    relojInicio = setTimeout(() => {
        relojInicio = null;
        window.actualizarDashboard();
    }, escondido ? 1500 : 100);
}
window.pedirActualizarDashboard = pedirActualizarDashboard;

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
