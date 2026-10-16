// =====================================================
// VendeFrío - seguimiento.js
// Pedidos y seguimiento (T21): la sección Pedido abre la lista "Pedidos",
// con filtros por etapa, un botón flotante para cargar uno nuevo y la ficha
// de cada pedido, con el
// seguimiento de sus estados. Solo en la nube (con cuenta o con código): el
// modo personal sigue igual. Desde la ficha se cambia de estado, se vuelve un
// paso atrás y se marcan y resuelven incidencias, según los permisos de cada
// persona (T22). Los avisos abren la ficha de su pedido (T23). En "Cargado"
// y "En preparación" la ficha muestra la checklist: cualquiera tilda, el
// primer tilde pasa el pedido solo a "En preparación" (T29b), "Prepara
// pedidos" anota faltantes y marca "Preparado" con un resumen que se desliza
// para confirmar (T24). Quien cargó el pedido y el dueño lo editan desde la
// ficha; los demás ven una franja amarilla con lo que cambió, la checklist
// marca los productos a revisar y "Entendido" la cierra (T25). Quien cargó
// el pedido y el dueño lo eliminan (solo en "Cargado") o lo cancelan con
// motivo (antes de "Entregado"); el cancelado queda en "Cancelados" (T26).
// Cualquiera lo entrega deslizando "Entregado" (desde Cargado, En
// preparación, Preparado o En reparto, T29b) o con "Entregar con cambios" (lo entregado de cada
// producto, con motivo); la ficha muestra el total a cobrar con lo
// entregado y, si se entregó por error, se vuelve un paso atrás (T27).
// Quien tiene "Cobra" registra el cobro ("¿Cómo pagó?": efectivo,
// transferencia con foto opcional del comprobante o "Todavía no pagó"), al
// entregar o después desde "A cobrar" (T28). Cualquiera imprime el ticket
// del pedido por Bluetooth, desde "Cargado" en adelante (T28b, con
// impresion.js). En la nube, Historial es el filtro "Historial" de esta
// lista (T27b): los entregados y los "Histórico", con buscador, filtro por
// fecha y el filtro de un comercio o de un pedido. En "Cargados" y
// "Preparados", quien reparte elige varios pedidos y los saca a reparto de
// una sola vez (T29c).
// =====================================================

(function () {
    const pantalla = document.getElementById("pantallaPedido");
    const vista = document.getElementById("vistaPedidos");
    const filtros = document.getElementById("filtrosEtapaPedidos");
    const resumen = document.getElementById("resumenVistaPedidos");
    const lista = document.getElementById("listaVistaPedidos");

    if (!pantalla || !vista || !filtros || !resumen || !lista) return;

    const tituloPantalla = pantalla.querySelector("header h1");
    const TITULO_NUEVO = tituloPantalla ? tituloPantalla.textContent : "Nuevo Pedido";

    // Etapas de la vista. Un pedido que quedó en "Cargado en el vehículo" (ya
    // no existe, T29b) está en "En reparto": así lo da estadoActualDelPedido.
    // "Incidencias" se marca encima del estado (T17), así que un
    // pedido con incidencia también sigue en su etapa.
    const ETAPAS = [
        { id: "cargados", nombre: "Cargados", estados: ["cargado"] },
        { id: "enPreparacion", nombre: "En preparación", estados: ["enPreparacion"] },
        { id: "preparados", nombre: "Preparados", estados: ["preparado"] },
        { id: "enReparto", nombre: "En reparto", estados: ["enReparto"] },
        // Historial (T27b): reemplaza a "Entregados" y a la sección
        // Historial. Lleva los entregados y los "Histórico" (los de antes,
        // sin estados), sin eliminados ni cancelados (pedidosDelHistorial).
        { id: "historial", nombre: "Historial", estados: [] },
        // Cobro (T28): los entregados sin cobro registrado. Solo lo ve quien
        // tiene "Cobra" (y el dueño).
        { id: "aCobrar", nombre: "A cobrar", estados: [], soloCobra: true },
        { id: "incidencias", nombre: "Incidencias", estados: [] },
        { id: "cancelados", nombre: "Cancelados", estados: ["cancelado"] }
    ];

    // Con muchos pedidos (por ejemplo, Historial) se dibujan de a tandas.
    const TANDA = 40;

    // Pasos que se hacen desde la ficha (T22), con el permiso que los deja
    // hacer. El mismo permiso vuelve el paso atrás, con motivo. "Controla
    // pedidos" y el dueño pueden todos. Pasos más cortos (T29b): "En
    // preparación" no tiene botón, llega solo con el primer tilde de la
    // checklist; "Preparado" es opcional y se marca con la checklist
    // completa y su resumen (T24); "Salir a repartir" lleva a "En reparto"
    // desde cualquier paso anterior. "Entregado" se marca con la entrega
    // (T27), que tiene sus propios botones y su vuelta atrás.
    const PASOS = [
        { desde: ["cargado"], hacia: "enPreparacion", permiso: "prepara" },
        { desde: ["enPreparacion"], hacia: "preparado", permiso: "prepara", boton: "Marcar preparado", conChecklist: true },
        { desde: ["cargado", "enPreparacion", "preparado"], hacia: "enReparto", permiso: "reparte", boton: "Salir a repartir", hecho: "Pedido en reparto" }
    ];

    // Estados en los que la ficha es la checklist (T29b: también "Cargado").
    const ESTADOS_CON_CHECKLIST = ["cargado", "enPreparacion"];

    const LARGO_MAXIMO_MOTIVO = 300;

    // Estados en los que el pedido ya pasó por la checklist (T24): la ficha
    // muestra sus faltantes.
    const ESTADOS_PREPARADOS = ["preparado", "enReparto", "entregado"];

    // Tilde de la casilla (dibujado acá para que se vea igual en todos lados).
    const SVG_TILDE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

    let vistaActual = "nuevo";
    let etapaActual = "cargados";
    let mostrando = TANDA;
    let idFichaAbierta = "";

    // Filtros del Historial (T27b), como en la sección Historial de antes.
    let busquedaHistorial = "";
    let periodoHistorial = "todos";
    let comercioHistorial = "";
    let idPedidoHistorial = "";

    // "Salir a repartir" en tanda (T29c): las etapas donde se eligen varios
    // pedidos y los ids elegidos. Cada pedido sale en su propia escritura.
    const ETAPAS_EN_TANDA = ["cargados", "preparados"];
    let eligiendo = false;
    const elegidos = new Set();

    // -------------------------------------------------
    // Datos
    // -------------------------------------------------

    function enLaNube() {
        return typeof usaNubeReal === "function" && usaNubeReal();
    }

    // Incidencias (T22): las que todavía no se resolvieron.
    function incidenciasAbiertas(pedido) {
        return window.nubeVendeFrio?.incidenciasAbiertas?.(pedido) || [];
    }

    function tieneIncidencia(pedido) {
        return incidenciasAbiertas(pedido).length > 0;
    }

    // Checklist (T24): cómo va la preparación del pedido.
    function preparacionDe(pedido) {
        return window.nubeVendeFrio?.preparacionDelPedido?.(pedido) || {
            lineas: [], productos: 0, listos: 0, pendientes: 0, faltantes: 0,
            unidadesPedidas: 0, unidadesPreparadas: 0, completa: true
        };
    }

    function textoFaltantes(cantidad) {
        return cantidad === 1 ? "1 faltante" : cantidad + " faltantes";
    }

    // Ediciones (T25): las de otro que esta persona todavía no cerró con
    // "Entendido", la más nueva primero.
    function edicionesSinVer(pedido) {
        return window.nubeVendeFrio?.edicionesSinVer?.(pedido) || [];
    }

    // Productos a revisar por esas ediciones: id de línea -> "Nuevo" o
    // "Antes x3" (vale la edición más nueva).
    function productosARevisar(pedido) {
        const revisar = new Map();
        edicionesSinVer(pedido).forEach(edicion => {
            const lineas = edicion.revisar && typeof edicion.revisar === "object" ? edicion.revisar : {};
            Object.keys(lineas).forEach(linea => {
                if (!revisar.has(linea)) revisar.set(linea, String(lineas[linea] || "Revisar"));
            });
        });
        return revisar;
    }

    function puedeEditar(pedido) {
        return Boolean(window.nubeVendeFrio?.puedeEditarElPedido?.(pedido));
    }

    // Eliminar y cancelar (T26): solo quien cargó el pedido y el dueño.
    function puedeEliminar(pedido) {
        return Boolean(window.nubeVendeFrio?.puedeEliminarElPedido?.(pedido));
    }

    function puedeCancelar(pedido) {
        return Boolean(window.nubeVendeFrio?.puedeCancelarElPedido?.(pedido));
    }

    // Entrega (T27): lo entregado de cada producto y el total a cobrar.
    function entregaDe(pedido, cambios) {
        return window.nubeVendeFrio?.entregaDelPedido?.(pedido, cambios) || null;
    }

    function puedeEntregar(pedido) {
        return Boolean(window.nubeVendeFrio?.puedeEntregarElPedido?.(pedido));
    }

    function puedeVolverDeEntregado(pedido) {
        return Boolean(window.nubeVendeFrio?.puedeVolverDeEntregado?.(pedido));
    }

    // Cobro (T28): el registrado (o null si está pendiente) y quién lo puede
    // registrar ("Cobra" y el dueño; "Controla pedidos" no alcanza).
    function cobroDe(pedido) {
        return window.nubeVendeFrio?.cobroDelPedido?.(pedido) || null;
    }

    function cobroPendiente(pedido) {
        return Boolean(window.nubeVendeFrio?.cobroPendiente?.(pedido));
    }

    function puedeCobrar() {
        return Boolean(window.nubeVendeFrio?.puedeCobrar?.());
    }

    function puedeRegistrarCobro(pedido) {
        return Boolean(window.nubeVendeFrio?.puedeRegistrarElCobro?.(pedido));
    }

    function textoCobro(cobro) {
        return window.nubeVendeFrio?.textoDelCobro?.(cobro) || "Pendiente";
    }

    // La persona de este celular hizo esa entrada.
    function esMio(persona) {
        const yo = typeof personaDeEsteCelular === "function" ? personaDeEsteCelular() : null;
        return Boolean(yo && persona && persona.idPersona === yo.idPersona);
    }

    // -------------------------------------------------
    // Permisos (T22)
    // -------------------------------------------------

    function puede(permiso) {
        const empleados = window.empleadosVendeFrio;
        if (!empleados) return false;
        return empleados.puede(permiso) || empleados.puede("controla");
    }

    // Los pasos que siguen desde este estado y que esta persona puede hacer
    // desde la ficha (en "En preparación", "Marcar preparado" y "Salir a
    // repartir").
    function pasosSiguientes(estado) {
        return PASOS.filter(item => item.desde.includes(estado) && item.boton && puede(item.permiso));
    }

    // El paso que se vuelve atrás desde este estado, si esta persona puede:
    // { hacia }. Desde "En reparto" vuelve al paso que tenía antes de salir
    // (T29b), con el permiso de "Salir a repartir".
    function pasoAnterior(pedido, estado) {
        const paso = PASOS.find(item => item.hacia === estado);
        if (!paso || !puede(paso.permiso)) return null;

        const hacia = estado === "enReparto"
            ? window.nubeVendeFrio?.estadoAntesDelReparto?.(pedido) || ""
            : paso.desde[0];
        return hacia ? { hacia } : null;
    }

    function puedeResolverIncidencias() {
        return puede("controla");
    }

    // Faltantes (T24): "Prepara pedidos" (y "Controla pedidos" y el dueño).
    function puedeAnotarFaltantes() {
        return puede("prepara");
    }

    // Los pedidos de trabajo: con historial de estados, sin "Histórico" ni
    // eliminados. Cada uno con su estado actual.
    function pedidosDeTrabajo() {
        return obtenerHistorial()
            .filter(pedido => pedido.estado !== "historico" && pedido.eliminado !== true)
            .map(pedido => ({ pedido, estado: estadoActualDelPedido(pedido) }))
            .filter(registro => registro.estado !== "");
    }

    // Historial (T27b): los mismos pedidos que la sección Historial de antes
    // (pedidoEstaEnHistorial). Los "Histórico" no tienen estado: se marcan
    // como "historico".
    function pedidosDelHistorial() {
        return obtenerHistorial()
            .filter(pedidoEstaEnHistorial)
            .map(pedido => ({ pedido, estado: estadoActualDelPedido(pedido) || "historico" }));
    }

    function hayFiltrosDelHistorial() {
        return Boolean(busquedaHistorial.trim() || periodoHistorial !== "todos" || comercioHistorial || idPedidoHistorial);
    }

    // Buscador (comercio, texto del pedido o N°), fecha y, si se entró desde
    // un comercio o desde "Último pedido", solo ese comercio o ese pedido.
    function coincideConElHistorial(registro) {
        const pedido = registro.pedido;
        if (idPedidoHistorial) return String(pedido.id || "") === idPedidoHistorial;

        const comercio = normalizarTexto(pedido.comercio);
        if (comercioHistorial && comercio !== normalizarTexto(comercioHistorial)) return false;

        const texto = normalizarTexto(busquedaHistorial);
        const coincideTexto = !texto ||
            comercio.includes(texto) ||
            normalizarTexto(pedido.pedido).includes(texto) ||
            normalizarTexto(numeroCortoDelPedido(pedido)).includes(texto);

        return coincideTexto && coincidePeriodoHistorial(pedido, periodoHistorial);
    }

    function esDeLaEtapa(registro, etapa) {
        if (etapa.id === "incidencias") return tieneIncidencia(registro.pedido);
        if (etapa.id === "aCobrar") return cobroPendiente(registro.pedido);
        return etapa.estados.includes(registro.estado);
    }

    function horaDelPedido(pedido) {
        const hora = Number(pedido && pedido.timestamp);
        return Number.isFinite(hora) && hora > 0 ? hora : 0;
    }

    // Para ordenar: los "Histórico" muy viejos pueden tener solo la fecha.
    function horaParaOrdenar(pedido) {
        const hora = horaDelPedido(pedido);
        if (hora || typeof obtenerFechaRegistro !== "function") return hora;
        const fecha = obtenerFechaRegistro(pedido);
        return fecha ? fecha.getTime() : 0;
    }

    function sinSubir(pedido) {
        return Boolean(window.nubeVendeFrio?.pedidoSinSubir?.(pedido.id));
    }

    function buscarPedido(id) {
        return obtenerHistorial().find(pedido => String(pedido.id || "") === id) || null;
    }

    // -------------------------------------------------
    // Textos
    // -------------------------------------------------

    function dosDigitos(numero) {
        return String(numero).padStart(2, "0");
    }

    function textoFecha(hora) {
        const fecha = new Date(hora);
        if (!hora || Number.isNaN(fecha.getTime())) return "";
        return dosDigitos(fecha.getDate()) + "/" + dosDigitos(fecha.getMonth() + 1) + "/" + fecha.getFullYear();
    }

    function textoHora(hora) {
        const fecha = new Date(hora);
        if (!hora || Number.isNaN(fecha.getTime())) return "";
        return dosDigitos(fecha.getHours()) + ":" + dosDigitos(fecha.getMinutes());
    }

    // "Hoy 14:35", "Ayer 09:10" o "10/10/2026 18:02".
    function textoCuando(hora) {
        if (!hora) return "Sin fecha";

        const fecha = new Date(hora);
        const hoy = new Date();
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);

        let dia = textoFecha(hora);
        if (fecha.toDateString() === hoy.toDateString()) dia = "Hoy";
        else if (fecha.toDateString() === ayer.toDateString()) dia = "Ayer";

        return dia + " " + textoHora(hora);
    }

    function textoPrecio(valor) {
        return "$ " + Number(valor || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
    }

    function nombrePersona(persona) {
        const nombre = String(persona && persona.nombre || "").trim();
        if (nombre) return nombre;
        return persona && persona.idPersona === "dueno" ? "el dueño" : "un empleado";
    }

    function textoMonto({ total, conPrecio, sinPrecio }) {
        if (conPrecio && sinPrecio) return textoPrecio(total) + " (" + sinPrecio + " sin precio)";
        if (conPrecio) return textoPrecio(total);
        return "Sin precio";
    }

    // Entregado (T27): el total a cobrar sale de lo entregado.
    function textoTotal(pedido) {
        const entrega = estadoActualDelPedido(pedido) === "entregado" ? entregaDe(pedido) : null;
        return textoMonto(entrega ? entrega.total : totalDelPedido(pedido));
    }

    function textoUnidades(cantidad) {
        return cantidad === 1 ? "1 unidad" : cantidad + " unidades";
    }

    function unidadesDelPedido(pedido) {
        const guardada = Number(pedido.cantidad);
        if (Number.isFinite(guardada) && guardada > 0) return guardada;

        const unidades = (Array.isArray(pedido.productos) ? pedido.productos : [])
            .reduce((total, item) => total + (Number(item && item.cantidad) || 0), 0);

        // Historial (T27b): un "Histórico" muy viejo puede tener solo el
        // texto del pedido; se cuentan como en Historial.
        if (!unidades && typeof obtenerUnidadesAnaliticasHistorial === "function") {
            return obtenerUnidadesAnaliticasHistorial(pedido);
        }
        return unidades;
    }

    function crear(tag, clase, texto) {
        const elemento = document.createElement(tag);
        if (clase) elemento.className = clase;
        if (texto !== undefined) elemento.textContent = texto;
        return elemento;
    }

    function etiquetaEstado(estado) {
        const nombre = estado === "historico" ? "Histórico" : nombreDeEstadoPedido(estado) || estado;
        const etiqueta = crear("span", "estadoSeguimiento", nombre);
        etiqueta.dataset.estado = estado;
        return etiqueta;
    }

    function etiquetaSinSubir() {
        return crear("span", "badge badgeSinSubir sinSubirSeguimiento", "Pendiente de sincronizar");
    }

    // -------------------------------------------------
    // Cambiar de vista: la lista "Pedidos" o el formulario "Nuevo pedido"
    // -------------------------------------------------
    // En la nube, la barra de abajo abre la lista y el botón flotante abre el
    // formulario (la flecha del encabezado vuelve a la lista). Los demás
    // accesos ("Ir a pedido" de un comercio, "Agregar al pedido" del
    // catálogo) abren el formulario, como antes. En el modo personal no hay
    // lista: la sección es el formulario de siempre.

    const botonNuevo = crear("button", "botonNuevoPedido oculto");
    botonNuevo.type = "button";
    botonNuevo.setAttribute("aria-label", "Nuevo pedido");
    botonNuevo.title = "Nuevo pedido";
    botonNuevo.innerHTML = window.icono ? window.icono("notaLapiz", 26) : "+";
    document.body.appendChild(botonNuevo);

    const botonVolver = crear("button", "botonVolverPedidos oculto");
    botonVolver.type = "button";
    botonVolver.setAttribute("aria-label", "Volver a Pedidos");
    botonVolver.title = "Volver a Pedidos";
    botonVolver.innerHTML = window.icono ? window.icono("flechaIzquierda", 22) : "←";
    const encabezado = pantalla.querySelector("header");
    if (encabezado) encabezado.insertBefore(botonVolver, encabezado.firstChild);

    function cambiarVista(nueva) {
        const nube = enLaNube();
        vistaActual = nube && nueva === "pedidos" ? "pedidos" : "nuevo";
        if (vistaActual !== "pedidos") dejarDeElegir();

        pantalla.dataset.vista = vistaActual;
        vista.classList.toggle("oculto", vistaActual !== "pedidos");
        if (tituloPantalla) tituloPantalla.textContent = vistaActual === "pedidos" ? "Pedidos" : TITULO_NUEVO;
        botonVolver.classList.toggle("oculto", !nube || vistaActual !== "nuevo");
        actualizarBotonNuevo();

        if (vistaActual === "pedidos") {
            mostrando = TANDA;
            dibujar();
        }
    }

    function actualizarBotonNuevo() {
        // Mientras se eligen pedidos (T29c), abajo va "Salir a repartir (N)".
        botonNuevo.classList.toggle("oculto", !vistaVisible() || eligiendo);
        if (typeof actualizarPieTanda === "function") actualizarPieTanda();
    }

    botonNuevo.addEventListener("click", () => {
        cambiarVista("nuevo");
        window.scrollTo(0, 0);
    });

    botonVolver.addEventListener("click", () => {
        cambiarVista("pedidos");
        window.scrollTo(0, 0);
    });

    // Se anota en la captura, antes de que menu.js cambie de pantalla.
    let entrarPorLaBarra = false;
    document.querySelectorAll('.nav-item[data-pantalla="pedido"]').forEach(boton => {
        boton.addEventListener("click", () => {
            entrarPorLaBarra = true;
        }, true);
    });

    let pantallaOculta = pantalla.classList.contains("oculto");

    new MutationObserver(() => {
        const oculta = pantalla.classList.contains("oculto");

        if (!oculta && entrarPorLaBarra) {
            cambiarVista("pedidos");
        } else if (pantallaOculta && !oculta) {
            cambiarVista("nuevo");
        }

        // Al irse a otra sección se deja de elegir (T29c).
        if (oculta) dejarDeElegir();

        entrarPorLaBarra = false;
        pantallaOculta = oculta;
        actualizarBotonNuevo();
    }).observe(pantalla, { attributes: true, attributeFilter: ["class"] });

    // Después de "Generar Pedido" se vuelve solo a la lista, en "Cargados".
    // El pedido se sigue copiando al portapapeles y la ventana "Pedido
    // generado" (con WhatsApp) queda arriba, como antes. Se reconoce porque
    // esa ventana se abre con la sección Pedido a la vista.
    const ventanaPedidoGenerado = document.getElementById("modalPedido");
    if (ventanaPedidoGenerado) {
        let ventanaOculta = ventanaPedidoGenerado.classList.contains("oculto");

        new MutationObserver(() => {
            const oculta = ventanaPedidoGenerado.classList.contains("oculto");

            if (ventanaOculta && !oculta && enLaNube() && vistaActual === "nuevo" && !pantalla.classList.contains("oculto")) {
                etapaActual = "cargados";
                cambiarVista("pedidos");
                window.scrollTo(0, 0);
            }

            ventanaOculta = oculta;
        }).observe(ventanaPedidoGenerado, { attributes: true, attributeFilter: ["class"] });
    }

    // -------------------------------------------------
    // Lista de pedidos por etapa
    // -------------------------------------------------

    // "A cobrar" (T28) solo aparece para quien cobra.
    function etapasVisibles() {
        const cobra = puedeCobrar();
        return ETAPAS.filter(etapa => !etapa.soloCobra || cobra);
    }

    // Historial (T27b): buscador, filtro por fecha y el aviso del filtro de
    // un comercio o de un pedido, con "Ver todos". Solo en "Historial".
    const barraHistorial = crear("div", "card filtrosHistorial filtrosHistorialPedidos oculto");

    const buscadorHistorial = document.createElement("input");
    buscadorHistorial.type = "search";
    buscadorHistorial.placeholder = "Buscar por comercio, pedido o N°...";
    buscadorHistorial.setAttribute("aria-label", "Buscar en el historial");

    const fechaHistorial = document.createElement("select");
    fechaHistorial.setAttribute("aria-label", "Filtrar historial por fecha");

    const avisoFiltroHistorial = crear("div", "filtroHistorialActivo oculto");
    const textoAvisoHistorial = crear("span", "");
    const verTodosHistorial = crear("button", "btnAccion secundario", "Ver todos");
    verTodosHistorial.type = "button";
    avisoFiltroHistorial.append(textoAvisoHistorial, verTodosHistorial);

    barraHistorial.append(buscadorHistorial, fechaHistorial, avisoFiltroHistorial);
    filtros.after(barraHistorial);
    // Hoy / Semana / Mes / Todo (T33), del mismo modo que en el modo personal.
    const segmentoHistorial = typeof crearSegmentoPeriodo === "function" ? crearSegmentoPeriodo(fechaHistorial) : null;

    buscadorHistorial.addEventListener("input", () => {
        busquedaHistorial = buscadorHistorial.value;
        mostrando = TANDA;
        dibujarLista();
    });

    fechaHistorial.addEventListener("change", () => {
        periodoHistorial = fechaHistorial.value;
        mostrando = TANDA;
        dibujarLista();
    });

    verTodosHistorial.addEventListener("click", () => {
        comercioHistorial = "";
        idPedidoHistorial = "";
        busquedaHistorial = "";
        mostrando = TANDA;
        dibujarLista();
    });

    function dibujarBarraHistorial(visible) {
        barraHistorial.classList.toggle("oculto", !visible);
        if (!visible) return;

        if (buscadorHistorial.value !== busquedaHistorial) buscadorHistorial.value = busquedaHistorial;
        fechaHistorial.value = periodoHistorial;
        if (segmentoHistorial) sincronizarSegmentoPeriodo(segmentoHistorial, periodoHistorial);

        const aviso = idPedidoHistorial
            ? "Mostrando solamente el pedido seleccionado"
            : comercioHistorial ? "Mostrando solamente pedidos de: " + comercioHistorial : "";
        textoAvisoHistorial.textContent = aviso;
        avisoFiltroHistorial.classList.toggle("oculto", !aviso);
    }

    function dibujarFiltros(registros, historial) {
        filtros.innerHTML = "";

        etapasVisibles().forEach(etapa => {
            const cantidad = etapa.id === "historial"
                ? historial.length
                : registros.filter(registro => esDeLaEtapa(registro, etapa)).length;
            const boton = crear("button", "filtroEtapa");
            boton.type = "button";
            boton.setAttribute("role", "tab");
            boton.dataset.etapa = etapa.id;
            boton.setAttribute("aria-selected", etapa.id === etapaActual ? "true" : "false");
            if (etapa.id === etapaActual) boton.classList.add("activo");

            boton.append(crear("span", "filtroEtapaNombre", etapa.nombre), crear("span", "filtroEtapaCantidad", String(cantidad)));
            filtros.appendChild(boton);
        });
    }

    // En vivo (T33): la tarjeta que cambió de estado (o que llegó nueva)
    // desde el último dibujo se ilumina un momento.
    const estadosVistos = new Map();
    let listaDibujadaUnaVez = false;

    function huellaDelRegistro(registro) {
        const pedido = registro.pedido;
        return [registro.estado, tieneIncidencia(pedido) ? "i" : "", cobroDe(pedido) ? "c" : ""].join("|");
    }

    function recordarEstados(registros) {
        registros.forEach(registro => estadosVistos.set(String(registro.pedido.id || ""), huellaDelRegistro(registro)));
        listaDibujadaUnaVez = true;
    }

    function cambioDesdeLaUltimaVez(registro) {
        if (!listaDibujadaUnaVez) return false;
        const visto = estadosVistos.get(String(registro.pedido.id || ""));
        return visto !== huellaDelRegistro(registro);
    }

    function crearTarjeta(registro) {
        const pedido = registro.pedido;
        const comercio = String(pedido.comercio || "SIN NOMBRE").trim();

        const tarjeta = crear("div", "card tarjetaSeguimiento");
        tarjeta.dataset.id = String(pedido.id || "");
        const hora = horaDelPedido(pedido);
        tarjeta.setAttribute("role", "button");
        tarjeta.tabIndex = 0;
        tarjeta.setAttribute("aria-label", "Ver el pedido de " + comercio);

        const avatar = crear("div", "avatar", iniciales(comercio));
        avatar.style.background = colorAvatar(comercio);

        const info = crear("div", "infoSeguimiento");
        const arriba = crear("div", "filaSeguimientoArriba");
        arriba.append(crear("h3", "", comercio), etiquetaEstado(registro.estado));

        const detalle = crear(
            "p",
            "subtitulo",
            (hora ? textoCuando(hora) : String(pedido.fecha || "Sin fecha")) + "  ·  " + textoUnidades(unidadesDelPedido(pedido)) + "  ·  " + textoTotal(pedido)
        );
        // Número corto (T28b): el mismo del ticket impreso. Un "Histórico"
        // puede no tener autor (T27b).
        const numero = numeroCortoDelPedido(pedido);
        const conAutor = Boolean(pedido.autor && typeof pedido.autor === "object");
        const textoAutor = [conAutor ? "Cargado por " + nombrePersona(pedido.autor) : "", numero ? "N° " + numero : ""]
            .filter(Boolean)
            .join("  ·  ");

        info.append(arriba, detalle);
        if (textoAutor) info.append(crear("p", "subtitulo autorSeguimiento", textoAutor));

        // Checklist (T24): cuánto lleva armado y si hay faltantes. En
        // "Cargado", solo si alguien ya tildó (T29b).
        if (ESTADOS_CON_CHECKLIST.includes(registro.estado) || ESTADOS_PREPARADOS.includes(registro.estado)) {
            const preparacion = preparacionDe(pedido);
            if (registro.estado === "enPreparacion" || (registro.estado === "cargado" && preparacion.listos > 0)) {
                info.append(crear("p", "subtitulo progresoTarjeta", "Checklist: " + preparacion.listos + " de " + preparacion.productos + " listos"));
            }
            if (preparacion.faltantes) info.append(crear("span", "badge faltanteSeguimiento", textoFaltantes(preparacion.faltantes)));
        }

        // Entrega (T27): si se entregó distinto de lo preparado.
        if (registro.estado === "entregado" && (entregaDe(pedido)?.cambios || 0) > 0) {
            info.append(crear("span", "badge entregaSeguimiento", "Entregado con cambios"));
        }

        // Cobro (T28): "Cobro pendiente" o cómo se cobró.
        if (registro.estado === "entregado") {
            const cobro = cobroDe(pedido);
            info.append(cobro
                ? crear("span", "badge cobradoSeguimiento", "Cobrado: " + textoCobro(cobro))
                : crear("span", "badge cobroPendienteSeguimiento", "Cobro pendiente"));
        }

        if (tieneIncidencia(pedido)) info.append(crear("span", "badge incidenciaSeguimiento", "Con incidencia"));
        if (edicionesSinVer(pedido).length) info.append(crear("span", "badge edicionSeguimiento", "Editado"));
        if (sinSubir(pedido)) info.append(etiquetaSinSubir());

        tarjeta.append(avatar, info);
        if (cambioDesdeLaUltimaVez(registro)) tarjeta.classList.add("filaCambio");

        // Elegir varios (T29c): la tarjeta se marca en vez de abrir la ficha.
        if (eligiendo) {
            const casilla = crear("span", "casillaTanda");
            casilla.innerHTML = SVG_TILDE;
            tarjeta.prepend(casilla);
            tarjeta.classList.add("eligiendoTanda");
            tarjeta.setAttribute("role", "checkbox");
            tarjeta.setAttribute("aria-label", "Elegir el pedido de " + comercio);
            marcarTarjeta(tarjeta, elegidos.has(tarjeta.dataset.id));
        }

        return tarjeta;
    }

    function marcarTarjeta(tarjeta, elegido) {
        tarjeta.classList.toggle("elegidaTanda", elegido);
        tarjeta.setAttribute("aria-checked", elegido ? "true" : "false");
    }

    function dibujarLista() {
        const registros = pedidosDeTrabajo();
        const historial = pedidosDelHistorial();
        // Si a esta persona le sacaron "Cobra" mientras miraba "A cobrar",
        // vuelve a la primera etapa.
        const visibles = etapasVisibles();
        if (!visibles.some(item => item.id === etapaActual)) etapaActual = visibles[0].id;
        const etapa = visibles.find(item => item.id === etapaActual) || visibles[0];
        const enHistorial = etapa.id === "historial";
        const deLaEtapa = (enHistorial
            ? historial.filter(coincideConElHistorial)
            : registros.filter(registro => esDeLaEtapa(registro, etapa)))
            .sort((a, b) => horaParaOrdenar(b.pedido) - horaParaOrdenar(a.pedido));

        dibujarFiltros(registros, historial);
        // Los que no se ven en esta etapa igual se recuerdan, para que no se
        // iluminen todos al cambiar de pestaña.
        if (!listaDibujadaUnaVez || deLaEtapa.length === 0) recordarEstados(registros.concat(historial));
        dibujarBarraHistorial(enHistorial);
        dibujarBarraTanda(etapa, deLaEtapa);
        lista.innerHTML = "";
        // Lo que suman otras partes arriba de la lista (T74: "A cobrar" por comercio).
        (window.listaPedidosExtras || []).forEach(extra => {
            try {
                const elemento = extra(etapa.id, deLaEtapa);
                if (elemento) lista.appendChild(elemento);
            } catch (error) {
                console.error("No se pudo dibujar un agregado de la lista.", error);
            }
        });

        const unidades = deLaEtapa.reduce((total, registro) => total + unidadesDelPedido(registro.pedido), 0);
        resumen.textContent = deLaEtapa.length === 1
            ? "1 pedido  ·  " + textoUnidades(unidades)
            : deLaEtapa.length + " pedidos  ·  " + textoUnidades(unidades);

        if (deLaEtapa.length === 0 && enHistorial) {
            const vacio = crear("div", "card seguimientoVacio");
            const conFiltros = hayFiltrosDelHistorial();
            vacio.append(
                crear("h3", "", conFiltros ? "Sin coincidencias" : "Todavía no hay pedidos en Historial"),
                crear("p", "", conFiltros
                    ? "Probá con otro comercio o período."
                    : "Acá van a aparecer los pedidos entregados y los de antes (Histórico).")
            );
            lista.appendChild(vacio);
            return;
        }

        if (deLaEtapa.length === 0) {
            const vacio = crear("div", "card seguimientoVacio");
            vacio.append(
                crear("h3", "", "No hay pedidos " + etapa.nombre.toLowerCase()),
                crear("p", "", etapa.id === "incidencias"
                    ? "Acá van a aparecer los pedidos con algún problema."
                    : etapa.id === "aCobrar"
                        ? "Acá van a aparecer los pedidos entregados que todavía no se cobraron."
                        : "Cuando un pedido llegue a esta etapa, aparece acá al instante.")
            );
            lista.appendChild(vacio);
            return;
        }

        deLaEtapa.slice(0, mostrando).forEach(registro => lista.appendChild(crearTarjeta(registro)));
        recordarEstados(registros.concat(historial));

        if (deLaEtapa.length > mostrando) {
            const verMas = crear("button", "btnAccion secundario verMasSeguimiento", "Ver más (" + (deLaEtapa.length - mostrando) + ")");
            verMas.type = "button";
            lista.appendChild(verMas);
        }
    }

    filtros.addEventListener("click", evento => {
        const boton = evento.target.closest("button[data-etapa]");
        if (!boton || boton.dataset.etapa === etapaActual) return;

        etapaActual = boton.dataset.etapa;
        mostrando = TANDA;
        dejarDeElegir();
        dibujarLista();
        boton.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    });

    lista.addEventListener("click", evento => {
        if (evento.target.closest(".verMasSeguimiento")) {
            mostrando += TANDA;
            dibujarLista();
            return;
        }

        const tarjeta = evento.target.closest(".tarjetaSeguimiento");
        if (!tarjeta) return;
        if (eligiendo) alternarElegido(tarjeta);
        else abrirFicha(tarjeta.dataset.id);
    });

    lista.addEventListener("keydown", evento => {
        if (evento.key !== "Enter" && evento.key !== " ") return;

        const tarjeta = evento.target.closest(".tarjetaSeguimiento");
        if (!tarjeta) return;

        evento.preventDefault();
        if (eligiendo) alternarElegido(tarjeta);
        else abrirFicha(tarjeta.dataset.id);
    });

    // -------------------------------------------------
    // "Salir a repartir" en tanda (T29c)
    // -------------------------------------------------
    // En "Cargados" y "Preparados", quien puede "Salir a repartir" toca
    // "Elegir varios", marca pedidos (o "Marcar todos") y abajo toca "Salir a
    // repartir (N)". Pide confirmar con un resumen y pasa cada pedido a "En
    // reparto" en su propia escritura (las mismas reglas que desde la
    // ficha). Sin señal quedan pendientes y suben solos. Si alguno ya no se
    // puede mover (otro lo canceló o lo movió), lo dice y mueve los demás.

    const barraTanda = crear("div", "barraTandaPedidos oculto");
    const botonElegir = crear("button", "btnAccion secundario botonElegirVarios", "Elegir varios");
    botonElegir.type = "button";
    const botonMarcarTodos = crear("button", "btnAccion secundario botonMarcarTodos", "Marcar todos");
    botonMarcarTodos.type = "button";
    const botonDejarDeElegir = crear("button", "btnAccion secundario botonDejarDeElegir", "Cancelar");
    botonDejarDeElegir.type = "button";
    barraTanda.append(botonElegir, botonMarcarTodos, botonDejarDeElegir);
    resumen.after(barraTanda);

    const pieTanda = crear("div", "pieTandaPedidos oculto");
    const botonSalirEnTanda = crear("button", "btnAccion botonSalirEnTanda", "Salir a repartir");
    botonSalirEnTanda.type = "button";
    pieTanda.appendChild(botonSalirEnTanda);
    document.body.appendChild(pieTanda);

    // Los ids de la etapa que se ve ahora (todos, no solo los dibujados).
    let idsDeLaEtapaTanda = [];

    function puedeSalirEnTanda(etapa) {
        return Boolean(etapa) && ETAPAS_EN_TANDA.includes(etapa.id) && pasosSiguientes(etapa.estados[0]).some(paso => paso.hacia === "enReparto");
    }

    function dibujarBarraTanda(etapa, deLaEtapa) {
        const tanda = puedeSalirEnTanda(etapa) && deLaEtapa.length > 0;
        idsDeLaEtapaTanda = tanda ? deLaEtapa.map(registro => String(registro.pedido.id || "")) : [];

        if (!tanda) {
            dejarDeElegir();
        } else {
            // Un pedido que salió de la etapa (otro celular lo movió o lo
            // canceló) deja de estar elegido.
            [...elegidos].forEach(id => {
                if (!idsDeLaEtapaTanda.includes(id)) elegidos.delete(id);
            });
        }

        barraTanda.classList.toggle("oculto", !tanda);
        actualizarTanda();
    }

    function actualizarTanda() {
        botonElegir.classList.toggle("oculto", eligiendo);
        botonMarcarTodos.classList.toggle("oculto", !eligiendo);
        botonDejarDeElegir.classList.toggle("oculto", !eligiendo);

        const todos = idsDeLaEtapaTanda.length > 0 && idsDeLaEtapaTanda.every(id => elegidos.has(id));
        botonMarcarTodos.textContent = todos ? "Desmarcar todos" : "Marcar todos";

        botonSalirEnTanda.textContent = "Salir a repartir (" + elegidos.size + ")";
        botonSalirEnTanda.disabled = elegidos.size === 0;
        actualizarBotonNuevo();
    }

    function actualizarPieTanda() {
        pieTanda.classList.toggle("oculto", !eligiendo || !vistaVisible());
        document.documentElement.classList.toggle("conPieTanda", eligiendo && vistaVisible());
    }

    function dejarDeElegir() {
        if (!eligiendo && !elegidos.size) return;
        eligiendo = false;
        elegidos.clear();
    }

    function alternarElegido(tarjeta) {
        const id = tarjeta.dataset.id;
        if (elegidos.has(id)) elegidos.delete(id);
        else elegidos.add(id);
        marcarTarjeta(tarjeta, elegidos.has(id));
        actualizarTanda();
    }

    botonElegir.addEventListener("click", () => {
        eligiendo = true;
        elegidos.clear();
        dibujarLista();
    });

    botonDejarDeElegir.addEventListener("click", () => {
        dejarDeElegir();
        dibujarLista();
    });

    botonMarcarTodos.addEventListener("click", () => {
        const todos = idsDeLaEtapaTanda.every(id => elegidos.has(id));
        elegidos.clear();
        if (!todos) idsDeLaEtapaTanda.forEach(id => elegidos.add(id));
        // Con "Marcar todos" se ven todos los elegidos, también los que
        // estaban después de "Ver más".
        if (!todos) mostrando = Math.max(mostrando, idsDeLaEtapaTanda.length);
        dibujarLista();
    });

    botonSalirEnTanda.addEventListener("click", () => {
        if (elegidos.size) abrirConfirmarTanda();
    });

    function textoPedidos(cantidad) {
        return cantidad === 1 ? "1 pedido" : cantidad + " pedidos";
    }

    function crearModalTanda() {
        let modal = document.getElementById("modalRepartoTanda");
        if (modal) return modal;

        modal = crear("div", "modal oculto");
        modal.id = "modalRepartoTanda";

        const contenido = crear("div", "modalContenido repartoTanda");
        contenido.setAttribute("role", "dialog");
        contenido.setAttribute("aria-modal", "true");
        contenido.setAttribute("aria-labelledby", "tituloRepartoTanda");

        const titulo = crear("h2", "", "Salir a repartir");
        titulo.id = "tituloRepartoTanda";

        const explicacion = crear("p", "explicacionTextoPedido");
        explicacion.id = "explicacionRepartoTanda";

        const listaTanda = crear("ul", "listaRepartoTanda");
        listaTanda.id = "listaRepartoTanda";

        const botones = crear("div", "modalBotones");
        const volver = crear("button", "btnModalCancelar", "Volver");
        volver.type = "button";
        const confirmar = crear("button", "btnModalConfirmar", "Salir a repartir");
        confirmar.type = "button";
        confirmar.id = "confirmarRepartoTanda";
        botones.append(volver, confirmar);

        contenido.append(titulo, explicacion, listaTanda, botones);
        modal.appendChild(contenido);
        document.body.appendChild(modal);

        const cerrar = () => modal.classList.add("oculto");
        volver.addEventListener("click", cerrar);
        modal.addEventListener("click", evento => {
            if (evento.target === modal) cerrar();
        });
        confirmar.addEventListener("click", () => {
            cerrar();
            salirEnTanda();
        });

        return modal;
    }

    // Los pedidos que se confirman: los elegidos al abrir la ventana. Si
    // mientras tanto otro celular mueve alguno, al confirmar se avisa.
    let idsAConfirmar = [];

    function abrirConfirmarTanda() {
        const modal = crearModalTanda();
        idsAConfirmar = [...elegidos];
        const pedidos = idsAConfirmar.map(buscarPedido).filter(Boolean);
        const unidades = pedidos.reduce((total, pedido) => total + unidadesDelPedido(pedido), 0);

        document.getElementById("explicacionRepartoTanda").textContent =
            textoPedidos(idsAConfirmar.length) + " (" + textoUnidades(unidades) + ") pasan a \u00abEn reparto\u00bb, a tu nombre.";

        const listaTanda = document.getElementById("listaRepartoTanda");
        listaTanda.innerHTML = "";
        pedidos.forEach(pedido => {
            const item = crear("li", "");
            item.append(
                crear("strong", "", String(pedido.comercio || "SIN NOMBRE").trim()),
                crear("span", "", textoTotal(pedido))
            );
            listaTanda.appendChild(item);
        });

        document.getElementById("confirmarRepartoTanda").textContent = "Salir a repartir (" + idsAConfirmar.length + ")";
        modal.classList.remove("oculto");
    }

    function salirEnTanda() {
        const ids = idsAConfirmar;
        idsAConfirmar = [];
        const noSalieron = [];
        let salieron = 0;

        ids.forEach(id => {
            const pedido = buscarPedido(id);
            const comercio = String(pedido && pedido.comercio || "Un pedido").trim();
            const estado = pedido && pedido.eliminado !== true ? estadoActualDelPedido(pedido) : "";
            const paso = pasosSiguientes(estado).find(item => item.hacia === "enReparto");

            if (!paso) {
                noSalieron.push(comercio + (estado ? " (ahora está \u00ab" + (nombreDeEstadoPedido(estado) || estado) + "\u00bb)" : " (ya no está)"));
                return;
            }

            try {
                window.nubeVendeFrio.agregarEstadoAlPedido(id, "enReparto", "");
                salieron += 1;
            } catch (error) {
                console.error("No se pudo sacar a reparto el pedido.", error);
                noSalieron.push(comercio + (error && error.code === "pedido" ? " (" + error.message + ")" : ""));
            }
        });

        dejarDeElegir();
        dibujarLista();

        if (!noSalieron.length) {
            mostrarToast(salieron === 1 ? "Pedido en reparto" : salieron + " pedidos en reparto");
            return;
        }

        mostrarAviso(
            salieron ? "Algunos pedidos no salieron" : "No salió ningún pedido",
            "Salieron " + salieron + " de " + ids.length + " a reparto. No se movieron: " + noSalieron.join("; ") + "."
        );
    }

    // -------------------------------------------------
    // Ficha del pedido
    // -------------------------------------------------

    function crearModalFicha() {
        let modal = document.getElementById("modalFichaPedido");
        if (modal) return modal;

        modal = crear("div", "modal oculto");
        modal.id = "modalFichaPedido";

        const contenido = crear("div", "modalContenido fichaPedido");
        contenido.setAttribute("role", "dialog");
        contenido.setAttribute("aria-modal", "true");
        contenido.setAttribute("aria-labelledby", "tituloFichaPedido");

        const cuerpo = crear("div", "cuerpoFichaPedido");
        cuerpo.id = "cuerpoFichaPedido";

        const botones = crear("div", "modalBotones");
        const cerrar = crear("button", "btnModalSecundario", "Cerrar");
        cerrar.type = "button";
        botones.appendChild(cerrar);

        contenido.append(cuerpo, botones);
        modal.appendChild(contenido);
        document.body.appendChild(modal);

        cerrar.addEventListener("click", cerrarFicha);
        modal.addEventListener("click", evento => {
            if (evento.target === modal) cerrarFicha();
        });

        return modal;
    }

    function cerrarFicha() {
        idFichaAbierta = "";
        const modal = document.getElementById("modalFichaPedido");
        if (modal) modal.classList.add("oculto");

        // Las ventanas de la checklist (T24), la de editar (T25), la de la
        // entrega (T27) y las del cobro (T28) son de esta ficha.
        cerrarResumen();
        cerrarFaltante();
        cerrarConfirmacion();
        cerrarEntrega();
        cerrarCobro();
        cerrarComprobante();
        window.cerrarEdicionPedido?.();
    }

    function abrirFicha(id) {
        if (!id || !buscarPedido(id)) return;

        idFichaAbierta = id;
        const modal = crearModalFicha();
        dibujarFicha();
        modal.classList.remove("oculto");

        const contenido = modal.querySelector(".modalContenido");
        if (contenido) contenido.scrollTop = 0;
    }

    function seccionFicha(titulo) {
        const seccion = crear("section", "seccionFichaPedido");
        seccion.appendChild(crear("h3", "", titulo));
        return seccion;
    }

    function dibujarProductos(pedido, estado) {
        const seccion = seccionFicha("Productos");
        const productos = (Array.isArray(pedido.productos) ? pedido.productos : [])
            .filter(item => item && typeof item === "object" && (Number(item.cantidad) || 0) > 0);

        if (productos.length === 0) {
            seccion.appendChild(crear("p", "subtitulo", "Este pedido no tiene productos."));
            return seccion;
        }

        // Editado (T25): lo nuevo o con otra cantidad, hasta "Entendido".
        const revisar = productosARevisar(pedido);

        // Ya preparado (T24): lo preparado y los faltantes, con quién los
        // anotó. Lo pedido y su precio se conservan.
        const lineasPreparadas = new Map();
        if (ESTADOS_PREPARADOS.includes(estado)) {
            const preparacion = preparacionDe(pedido);
            preparacion.lineas.forEach(linea => lineasPreparadas.set(linea.item, linea));

            if (preparacion.faltantes) {
                seccion.appendChild(crear(
                    "p",
                    "resumenFaltantesFicha",
                    "Se prepararon " + preparacion.unidadesPreparadas + " de " + textoUnidades(preparacion.unidadesPedidas) +
                        "  ·  " + textoFaltantes(preparacion.faltantes)
                ));
            }
        }

        // Entregado (T27): lo entregado de cada producto (si cambió, con su
        // motivo) y el total a cobrar con lo entregado.
        const entrega = estado === "entregado" ? entregaDe(pedido) : null;
        const lineasEntregadas = new Map();
        if (entrega) {
            entrega.lineas.forEach(linea => lineasEntregadas.set(linea.item, linea));

            if (entrega.cambios) {
                seccion.appendChild(crear(
                    "p",
                    "resumenEntregaFicha",
                    "Se entregaron " + entrega.unidadesEntregadas + " de " + textoUnidades(entrega.unidadesPreparadas) +
                        "  ·  " + (entrega.cambios === 1 ? "1 cambio" : entrega.cambios + " cambios")
                ));
            }
        }

        // Agrupados por marca, en el orden en que se cargaron.
        const marcas = [];
        productos.forEach(item => {
            const marca = String(item.marca || "Sin marca").trim() || "Sin marca";
            let grupo = marcas.find(actual => actual.marca === marca);
            if (!grupo) {
                grupo = { marca, items: [] };
                marcas.push(grupo);
            }
            grupo.items.push(item);
        });

        marcas.forEach(grupo => {
            seccion.appendChild(crear("p", "marcaFichaPedido", grupo.marca));

            grupo.items.forEach(item => {
                const cantidad = Number(item.cantidad) || 0;
                const precio = item.precio === null || item.precio === undefined ? NaN : Number(item.precio);
                const fila = crear("div", "productoFichaPedido");

                const izquierda = crear("div", "productoFichaNombre");
                izquierda.append(
                    crear("strong", "", String(item.producto || "Sin producto")),
                    crear("small", "", Number.isFinite(precio)
                        ? "x" + cantidad + "  ·  " + textoPrecio(precio) + " c/u"
                        : "x" + cantidad + "  ·  Sin precio")
                );

                const aRevisar = revisar.get(String(item.id || ""));
                if (aRevisar) {
                    fila.classList.add("aRevisar");
                    izquierda.appendChild(crear("small", "revisarPedido", "A revisar: " + aRevisar));
                }

                const faltante = lineasPreparadas.get(item)?.faltante;
                if (faltante) {
                    izquierda.append(
                        crear("small", "faltanteFichaPedido", "Faltante: se prepararon " + faltante.preparada + " de " + cantidad + "  ·  " + nombrePersona(faltante.persona)),
                        crear("small", "observacionFaltante", String(faltante.observacion || ""))
                    );
                }

                const entregada = lineasEntregadas.get(item);
                if (entregada && entregada.cambio) {
                    izquierda.append(
                        crear("small", "cambioEntregaFicha", "Entregado: " + entregada.entregada + " de " + entregada.preparada),
                        crear("small", "observacionFaltante", entregada.motivo)
                    );
                }

                const unidades = entregada ? entregada.entregada : cantidad;
                const subtotal = crear("span", "productoFichaSubtotal", Number.isFinite(precio) ? textoPrecio(precio * unidades) : "—");
                fila.append(izquierda, subtotal);
                seccion.appendChild(fila);
            });
        });

        const total = crear("div", "totalFichaPedido");
        total.append(crear("span", "", entrega ? "Total a cobrar" : "Total"), crear("strong", "", textoTotal(pedido)));
        seccion.appendChild(total);

        return seccion;
    }

    // El seguimiento, como el de un envío: el cambio más nuevo arriba (mismo
    // orden que usa estadoActualDelPedido: hora del celular y, si empatan, id).
    // Las incidencias y sus resoluciones van mezcladas, por hora (T22); el
    // punto grande marca el estado actual.
    function dibujarSeguimiento(pedido) {
        const seccion = seccionFicha("Seguimiento");
        const entradas = Object.keys(pedido.estados || {})
            .map(id => ({ id, entrada: pedido.estados[id] }))
            .filter(item => item.entrada && typeof item.entrada === "object")
            .map(item => ({
                id: item.id,
                tipo: "estado",
                titulo: nombreDeEstadoPedido(item.entrada.estado) || String(item.entrada.estado || "Sin estado"),
                estado: String(item.entrada.estado || ""),
                persona: item.entrada.persona,
                hora: Number(item.entrada.horaCelular) || 0,
                nota: item.entrada.nota
            }));

        const incidencias = pedido.incidencias && typeof pedido.incidencias === "object" ? pedido.incidencias : {};
        const resueltas = pedido.incidenciasResueltas && typeof pedido.incidenciasResueltas === "object"
            ? pedido.incidenciasResueltas
            : {};
        Object.keys(incidencias).forEach(id => {
            const incidencia = incidencias[id];
            if (!incidencia || typeof incidencia !== "object") return;

            entradas.push({
                id,
                tipo: "incidencia",
                titulo: "Con incidencia",
                persona: incidencia.persona,
                hora: Number(incidencia.horaCelular) || 0,
                nota: incidencia.motivo
            });

            const resolucion = resueltas[id];
            if (resolucion && typeof resolucion === "object") {
                entradas.push({
                    id: id + "_resuelta",
                    tipo: "resuelta",
                    titulo: "Incidencia resuelta",
                    persona: resolucion.persona,
                    hora: Number(resolucion.horaCelular) || 0,
                    nota: resolucion.nota
                });
            }
        });

        // Ediciones (T25): qué cambió, quién y cuándo, y quién la vio.
        const ediciones = pedido.ediciones && typeof pedido.ediciones === "object" ? pedido.ediciones : {};
        const vieron = window.nubeVendeFrio?.quienesVieronLasEdiciones?.(pedido) || new Map();
        Object.keys(ediciones).forEach(id => {
            const edicion = ediciones[id];
            if (!edicion || typeof edicion !== "object") return;

            const vistas = (vieron.get(id) || []).map(nombrePersona);
            entradas.push({
                id,
                tipo: "edicion",
                titulo: "Pedido editado",
                persona: edicion.persona,
                hora: Number(edicion.horaCelular) || 0,
                nota: edicion.texto,
                extra: vistas.length ? "Lo vio " + vistas.join(", ") : ""
            });
        });

        // Cobro (T28): cómo se cobró, quién y cuándo (el último registrado).
        const cobro = cobroDe(pedido);
        if (cobro) {
            entradas.push({
                id: "cobro",
                tipo: "cobro",
                titulo: "Cobro registrado",
                persona: cobro.persona,
                hora: cobro.horaCelular,
                nota: textoCobro(cobro)
            });
        }

        // Ticket impreso (T28d): quién, cuándo y cuántas copias.
        (window.nubeVendeFrio?.impresionesDelPedido?.(pedido) || []).forEach(impresion => {
            entradas.push({
                id: impresion.id,
                tipo: "impresion",
                titulo: "Ticket impreso",
                persona: impresion.persona,
                hora: Number(impresion.horaCelular) || 0,
                nota: impresion.copias === 1 ? "Una copia (comercio)" : "Dos copias (comercio y distribuidora)"
            });
        });

        entradas.sort((a, b) => {
            const diferencia = b.hora - a.hora;
            if (diferencia !== 0) return diferencia;
            return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
        });

        const actual = entradas.find(item => item.tipo === "estado");
        const linea = crear("ol", "lineaSeguimiento");

        entradas.forEach(entrada => {
            const hora = entrada.hora;
            const paso = crear("li", "pasoSeguimiento");
            if (entrada === actual) paso.classList.add("actual");
            if (entrada.tipo !== "estado") paso.classList.add(entrada.tipo);
            if (entrada.tipo === "estado") paso.dataset.estado = entrada.estado;

            paso.append(
                crear("strong", "", entrada.titulo),
                crear("small", "", [textoFecha(hora), textoHora(hora), nombrePersona(entrada.persona)].filter(Boolean).join("  ·  "))
            );

            const nota = String(entrada.nota || "").trim();
            if (nota) paso.appendChild(crear("p", "notaSeguimiento", nota));
            if (entrada.extra) paso.appendChild(crear("small", "vistoSeguimiento", entrada.extra));

            linea.appendChild(paso);
        });

        seccion.appendChild(linea);
        return seccion;
    }

    let redibujoPendiente = 0;

    // Línea de pasos de la ficha (T35): cada paso con la hora en que pasó.
    const PASOS_LINEA = [
        { estados: ["cargado"], nombre: "Cargado" },
        { estados: ["enPreparacion"], nombre: "Armando" },
        { estados: ["preparado"], nombre: "Preparado" },
        { estados: ["enVehiculo", "enReparto"], nombre: "En reparto" },
        { estados: ["entregado"], nombre: "Entregado" }
    ];

    function dibujarLineaPasos(pedido, estado) {
        const linea = crear("ol", "lineaPasosPedido");
        linea.setAttribute("aria-label", "Pasos del pedido");
        const entradas = Object.values(pedido.estados || {}).filter(entrada => entrada && typeof entrada === "object");
        const actual = PASOS_LINEA.findIndex(paso => paso.estados.includes(estado));

        PASOS_LINEA.forEach((paso, indice) => {
            const hora = entradas
                .filter(entrada => paso.estados.includes(entrada.estado))
                .reduce((mayor, entrada) => Math.max(mayor, Number(entrada.horaCelular) || 0), 0);
            const item = crear("li", "pasoLinea");
            if (actual >= 0 && indice < actual) item.dataset.paso = hora ? "hecho" : "salteado";
            if (indice === actual) item.dataset.paso = "actual";
            item.append(crear("span", "puntoPaso"), crear("strong", "", paso.nombre), crear("small", "", hora && indice <= actual ? textoHora(hora) : "—"));
            linea.appendChild(item);
        });
        return linea;
    }

    function dibujarFicha() {
        const cuerpo = document.getElementById("cuerpoFichaPedido");
        if (!cuerpo || !idFichaAbierta) return;

        // No se corta un deslizamiento a medias (T27): se redibuja al soltar.
        clearTimeout(redibujoPendiente);
        if (cuerpo.querySelector(".deslizador.arrastrando")) {
            redibujoPendiente = setTimeout(dibujarFicha, 300);
            return;
        }

        const pedido = buscarPedido(idFichaAbierta);
        const estado = pedido ? estadoActualDelPedido(pedido) : "";
        // Historial (T27b): un "Histórico" (sin estados) tiene su ficha, más
        // simple.
        const historico = Boolean(pedido) && !estado && pedidoEstaEnHistorial(pedido);

        // Si el pedido ya no está (por ejemplo, lo eliminaron en otro
        // celular), se cierra la ficha.
        if (!pedido || (!estado && !historico) || pedido.eliminado === true) {
            cerrarFicha();
            return;
        }

        if (historico) {
            dibujarFichaHistorica(cuerpo, pedido);
            return;
        }

        // Al redibujar (por ejemplo, con un tilde de otro celular) se
        // conserva el botón que tenía el foco.
        const activo = document.activeElement;
        const enfoque = activo && cuerpo.contains(activo) && activo.dataset && activo.dataset.accion
            ? { accion: activo.dataset.accion, linea: activo.dataset.linea || "" }
            : null;

        cuerpo.innerHTML = "";

        const titulo = crear("h2", "", String(pedido.comercio || "SIN NOMBRE").trim());
        titulo.id = "tituloFichaPedido";

        const etiquetas = crear("div", "etiquetasFichaPedido");
        etiquetas.appendChild(etiquetaEstado(estado));
        if (sinSubir(pedido)) etiquetas.appendChild(etiquetaSinSubir());

        // En "Cargado" y "En preparación" (T24, T29b) la ficha es la
        // checklist: comercio, autor y observaciones arriba, los productos
        // con su casilla y, al final, los pasos y la entrega.
        const enChecklist = ESTADOS_CON_CHECKLIST.includes(estado);

        const datos = crear("div", "datosFichaPedido");
        const hora = horaDelPedido(pedido);
        const productos = (Array.isArray(pedido.productos) ? pedido.productos : [])
            .filter(item => item && (Number(item.cantidad) || 0) > 0).length;

        const filasDatos = [
            // Número corto (T28b): el mismo del ticket impreso.
            ["Pedido N°", numeroCortoDelPedido(pedido)],
            ["Cargado por", nombrePersona(pedido.autor)],
            ["Fecha", hora ? textoFecha(hora) + " " + textoHora(hora) : String(pedido.fecha || "Sin fecha")],
            ["Unidades", unidadesDelPedido(pedido) + "  ·  " + productos + (productos === 1 ? " producto" : " productos")]
        ];
        if (enChecklist) filasDatos.push(["Total", textoTotal(pedido)]);

        // Entregado (T27): quién lo entregó y el cobro (T28): "Pendiente" o
        // cómo se cobró, quién y cuándo.
        const cobro = estado === "entregado" ? cobroDe(pedido) : null;
        if (estado === "entregado") {
            const entrega = entregaDe(pedido);
            if (entrega && entrega.persona) {
                filasDatos.push(["Entregado por", nombrePersona(entrega.persona) + "  ·  " + textoCuando(entrega.horaCelular)]);
            }
            filasDatos.push(["Cobro", textoCobro(cobro), cobro ? "cobrado" : "pendiente"]);
            if (cobro && cobro.persona) {
                filasDatos.push(["Cobrado por", nombrePersona(cobro.persona) + "  ·  " + textoCuando(cobro.horaCelular)]);
            }
        }

        filasDatos.forEach(([nombre, valor, cobroFila]) => {
            const fila = crear("div", "datoFichaPedido");
            if (cobroFila) fila.dataset.cobro = cobroFila;
            fila.append(crear("span", "", nombre), crear("strong", "", valor));
            datos.appendChild(fila);
        });

        // Transferencia con foto (T28): se ve desde cualquier celular.
        if (cobro && cobro.forma === "transferencia" && cobro.comprobante) {
            const fila = crear("div", "datoFichaPedido comprobanteFichaPedido");
            const sinSubirFoto = window.nubeVendeFrio?.comprobanteSinSubir?.(cobro.comprobante);
            fila.append(
                crear("span", "", sinSubirFoto ? "Comprobante · sin subir todavía" : "Comprobante"),
                crearBoton("botonVerComprobante", "Ver foto", "verComprobante")
            );
            datos.appendChild(fila);
        }

        // Encabezado (T35): número, comercio con su estado y la línea de pasos.
        const numero = crear("p", "numeroFichaPedido", "Pedido N° " + numeroCortoDelPedido(pedido));
        const comercio = typeof buscarComercioPorNombre === "function" ? buscarComercioPorNombre(String(pedido.comercio || "")) : null;
        const direccion = comercio && comercio.direccion ? crear("p", "direccionFichaPedido", comercio.direccion) : null;
        const tarjeta = crear("div", "tarjetaFichaPedido");
        tarjeta.append(numero, titulo);
        if (direccion) tarjeta.appendChild(direccion);
        tarjeta.appendChild(etiquetas);
        if (estado !== "cancelado") tarjeta.appendChild(dibujarLineaPasos(pedido, estado));
        cuerpo.append(tarjeta);

        const incidencia = dibujarIncidencias(pedido);
        if (incidencia) cuerpo.appendChild(incidencia);

        const edicion = dibujarEdiciones(pedido);
        if (edicion) cuerpo.appendChild(edicion);

        const cancelacion = dibujarCancelacion(pedido, estado);
        if (cancelacion) cuerpo.appendChild(cancelacion);

        const acciones = dibujarAcciones(pedido, estado);
        if (acciones && !enChecklist) cuerpo.appendChild(acciones);

        cuerpo.append(datos);
        // Secciones que suman otros módulos (prueba de entrega, devoluciones).
        (window.fichaPedidoExtras || []).forEach(crearSeccion => {
            try {
                const seccion = crearSeccion(pedido, estado);
                if (seccion) cuerpo.appendChild(seccion);
            } catch (error) {
                console.error("Falló una sección de la ficha del pedido.", error);
            }
        });
        if (!enChecklist) cuerpo.appendChild(dibujarProductos(pedido, estado));

        const observaciones = String(pedido.observaciones || "").trim();
        if (observaciones) {
            const seccion = seccionFicha("Observaciones");
            seccion.appendChild(crear("p", "observacionesFichaPedido", observaciones));
            cuerpo.appendChild(seccion);
        }

        if (enChecklist) {
            cuerpo.appendChild(dibujarChecklist(pedido));
            if (acciones) cuerpo.appendChild(acciones);
        }

        cuerpo.appendChild(dibujarSeguimiento(pedido));

        if (enfoque) {
            const selector = '[data-accion="' + enfoque.accion + '"]' +
                (enfoque.linea ? '[data-linea="' + enfoque.linea.replace(/["\\]/g, "") + '"]' : "");
            const igual = cuerpo.querySelector(selector);
            if (igual) igual.focus({ preventScroll: true });
        }
    }

    // Ficha de un "Histórico" (T27b): sin seguimiento ni pasos. Se ve el
    // pedido, se reenvía su mensaje y el dueño lo elimina (T26).
    function dibujarFichaHistorica(cuerpo, pedido) {
        cuerpo.innerHTML = "";

        const titulo = crear("h2", "", String(pedido.comercio || "SIN NOMBRE").trim());
        titulo.id = "tituloFichaPedido";

        const etiquetas = crear("div", "etiquetasFichaPedido");
        etiquetas.appendChild(etiquetaEstado("historico"));
        if (sinSubir(pedido)) etiquetas.appendChild(etiquetaSinSubir());

        const acciones = crear("div", "accionesFichaPedido");
        acciones.appendChild(crearBoton("btnAccion secundario botonVerMensajePedido", "Ver mensaje del pedido", "verMensaje"));
        if (puedeEliminar(pedido)) {
            const peligro = crear("div", "accionesSecundariasPedido");
            peligro.appendChild(crearBoton("btnAccion secundario peligroPedido", "Eliminar pedido", "eliminar"));
            acciones.appendChild(peligro);
        }

        const datos = crear("div", "datosFichaPedido");
        const hora = horaDelPedido(pedido);
        const filasDatos = [
            ["Pedido N°", numeroCortoDelPedido(pedido)],
            pedido.autor && typeof pedido.autor === "object" ? ["Cargado por", nombrePersona(pedido.autor)] : null,
            ["Fecha", hora ? textoFecha(hora) + " " + textoHora(hora) : String(pedido.fecha || "Sin fecha")],
            ["Unidades", textoUnidades(unidadesDelPedido(pedido))]
        ].filter(fila => fila && fila[1]);
        filasDatos.forEach(([nombre, valor]) => {
            const fila = crear("div", "datoFichaPedido");
            fila.append(crear("span", "", nombre), crear("strong", "", valor));
            datos.appendChild(fila);
        });

        cuerpo.append(titulo, etiquetas, acciones, datos);

        // Los "Histórico" muy viejos tienen solo el texto del pedido.
        const conProductos = (Array.isArray(pedido.productos) ? pedido.productos : [])
            .some(item => item && typeof item === "object" && (Number(item.cantidad) || 0) > 0);
        if (conProductos) {
            cuerpo.appendChild(dibujarProductos(pedido, ""));
        } else {
            const seccion = seccionFicha("Pedido");
            seccion.appendChild(crear("p", "observacionesFichaPedido", String(pedido.pedido || "Este pedido no tiene productos.")));
            cuerpo.appendChild(seccion);
        }

        const observaciones = String(pedido.observaciones || "").trim();
        if (observaciones) {
            const seccion = seccionFicha("Observaciones");
            seccion.appendChild(crear("p", "observacionesFichaPedido", observaciones));
            cuerpo.appendChild(seccion);
        }

        cuerpo.appendChild(crear("p", "pistaChecklist", "Pedido de antes de los estados: no tiene seguimiento."));
    }

    // "Ver mensaje del pedido" (T27b): la ventana de siempre con el mensaje
    // y "Enviar por WhatsApp", como "Ver pedido" del Historial de antes.
    function verMensajeDelPedido(id) {
        const pedido = buscarPedido(id);
        if (!pedido || typeof mostrarPedidoGuardado !== "function") return;

        cerrarFicha();
        mostrarPedidoGuardado(pedido);
        // El ticket que se imprime desde esa ventana es el de este pedido.
        if (typeof mostrarImprimirPedidoGenerado === "function") mostrarImprimirPedidoGenerado(String(pedido.id || ""));
    }

    // -------------------------------------------------
    // Cambiar de estado e incidencias (T22)
    // -------------------------------------------------

    function crearBoton(clase, texto, accion) {
        const boton = crear("button", clase, texto);
        boton.type = "button";
        boton.dataset.accion = accion;
        return boton;
    }

    // Franja con las incidencias abiertas: motivo, quién y cuándo.
    function dibujarIncidencias(pedido) {
        const abiertas = incidenciasAbiertas(pedido)
            .sort((a, b) => (Number(b.horaCelular) || 0) - (Number(a.horaCelular) || 0));
        if (!abiertas.length) return null;

        const franja = crear("div", "incidenciaFichaPedido");
        franja.setAttribute("role", "status");
        franja.appendChild(crear("strong", "", abiertas.length === 1 ? "Con incidencia" : "Con " + abiertas.length + " incidencias"));

        abiertas.forEach(incidencia => {
            const hora = Number(incidencia.horaCelular) || 0;
            franja.append(
                crear("p", "motivoIncidencia", String(incidencia.motivo || "")),
                crear("small", "", [textoCuando(hora), nombrePersona(incidencia.persona)].join("  ·  "))
            );
        });

        if (puedeResolverIncidencias()) {
            franja.appendChild(crearBoton("btnAccion resolverIncidencia", "Resolver incidencia", "resolver"));
        } else {
            franja.appendChild(crear("small", "avisoIncidencia", "La resuelve el dueño o quien controla pedidos."));
        }

        return franja;
    }

    // Franja amarilla (T25): lo que cambió en las ediciones de otro que esta
    // persona todavía no vio. "Entendido" la cierra (solo para ella).
    function dibujarEdiciones(pedido) {
        const sinVer = edicionesSinVer(pedido);
        if (!sinVer.length) return null;

        const franja = crear("div", "edicionFichaPedido");
        franja.setAttribute("role", "status");
        franja.appendChild(crear("strong", "", sinVer.length === 1 ? "Pedido editado" : "Pedido editado " + sinVer.length + " veces"));

        sinVer.forEach(edicion => {
            const hora = Number(edicion.horaCelular) || 0;
            franja.append(
                crear("p", "textoEdicion", String(edicion.texto || "")),
                crear("small", "", [textoCuando(hora), nombrePersona(edicion.persona)].join("  ·  "))
            );
        });

        if (productosARevisar(pedido).size) {
            franja.appendChild(crear("small", "pistaEdicion", "Los productos nuevos o con otra cantidad están marcados para revisar."));
        }

        franja.appendChild(crearBoton("btnAccion entendidoEdicion", "Entendido", "entendido"));
        return franja;
    }

    // Franja del pedido cancelado (T26): el motivo, quién y cuándo.
    function dibujarCancelacion(pedido, estado) {
        if (estado !== "cancelado") return null;

        let cancelacion = null;
        let idCancelacion = "";
        Object.keys(pedido.estados || {}).forEach(id => {
            const entrada = pedido.estados[id];
            if (!entrada || typeof entrada !== "object" || entrada.estado !== "cancelado") return;

            const hora = Number(entrada.horaCelular) || 0;
            const horaElegida = cancelacion ? Number(cancelacion.horaCelular) || 0 : -Infinity;
            if (hora > horaElegida || (hora === horaElegida && id > idCancelacion)) {
                cancelacion = entrada;
                idCancelacion = id;
            }
        });
        if (!cancelacion) return null;

        const franja = crear("div", "canceladoFichaPedido");
        franja.setAttribute("role", "status");
        franja.appendChild(crear("strong", "", "Pedido cancelado"));

        const motivo = String(cancelacion.nota || "").trim();
        if (motivo) franja.appendChild(crear("p", "motivoCancelacion", motivo));
        franja.appendChild(crear("small", "", [textoCuando(Number(cancelacion.horaCelular) || 0), nombrePersona(cancelacion.persona)].join("  ·  ")));
        franja.appendChild(crear("small", "", "No cuenta en Historial ni en Estadísticas."));

        return franja;
    }

    // Botones de la ficha: solo los pasos que esta persona puede hacer.
    function dibujarAcciones(pedido, estado) {
        const siguientes = pasosSiguientes(estado);
        const preparar = siguientes.find(paso => paso.conChecklist) || null;
        // Entregado (T27): vuelve al estado que tenía antes de la entrega.
        const anterior = estado === "entregado" ? puedeVolverDeEntregado(pedido) : pasoAnterior(pedido, estado);
        const marcar = estado !== "cancelado" && !tieneIncidencia(pedido);
        const editar = puedeEditar(pedido);
        const cancelar = puedeCancelar(pedido);
        const eliminar = puedeEliminar(pedido);
        const entregar = puedeEntregar(pedido);
        // Cobro (T28): registrarlo si está pendiente o corregirlo. Con el
        // cobro registrado, el pedido ya no vuelve atrás.
        const cobrar = puedeRegistrarCobro(pedido);
        const cobrado = estado === "entregado" ? cobroDe(pedido) : null;
        // Ticket (T28b): cualquiera, desde "Cargado" en adelante, con
        // Web Bluetooth (en iPhone no aparece).
        const imprimir = Boolean(window.impresionVendeFrio?.puedeImprimir?.(pedido));

        // "Marcar preparado" (T24) se puede tocar solo con la checklist
        // completa; si no, dice qué falta. Quien no lo puede marcar ve quién
        // lo hace. En "Cargado" (T29b) dice que el primer tilde lo pasa a
        // "En preparación".
        const preparacion = estado === "enPreparacion" ? preparacionDe(pedido) : null;
        let pista = "";
        if (preparacion && preparar && !preparacion.completa) pista = textoPendientes(preparacion.pendientes);
        else if (preparacion && !preparar && preparacion.completa) pista = "Está todo listo: lo marca como preparado quien prepara pedidos.";
        else if (estado === "cargado") {
            pista = puedeAnotarFaltantes()
                ? "Al tildar el primer producto, el pedido pasa a \u00abEn preparaci\u00f3n\u00bb."
                : "Tus tildes quedan anotados. El pedido pasa a \u00abEn preparaci\u00f3n\u00bb cuando tilda quien prepara pedidos.";
        }

        if (!siguientes.length && !anterior && !marcar && !pista && !editar && !cancelar && !eliminar && !entregar && !cobrar && !cobrado && !imprimir && estado !== "entregado") return null;

        const acciones = crear("div", "accionesFichaPedido");

        if (cobrar && !cobrado) acciones.appendChild(crearBoton("btnAccion pasoSiguientePedido botonRegistrarCobro", "Registrar cobro", "cobrar"));

        // Los pasos que siguen. En "En preparación", "Marcar preparado" va
        // primero y "Salir a repartir" (sin pasar por "Preparado", T29b) al
        // lado, más discreto.
        siguientes.forEach(paso => {
            const secundario = Boolean(preparar) && paso !== preparar;
            const boton = crearBoton(secundario ? "btnAccion secundario botonSalirARepartir" : "btnAccion pasoSiguientePedido", paso.boton, "siguiente");
            boton.dataset.estado = paso.hacia;
            if (paso.conChecklist && !preparacion.completa) {
                boton.classList.add("incompleto");
                boton.setAttribute("aria-disabled", "true");
            }
            acciones.appendChild(boton);
            if (paso === preparar && pista) acciones.appendChild(crear("p", "pistaChecklist", pista));
        });

        if (pista && !preparar) acciones.appendChild(crear("p", "pistaChecklist", pista));

        // Entrega (T27): el botón que se desliza y, al lado, "Entregar con
        // cambios", desde cualquier paso anterior a "Entregado" (T29b).
        if (entregar) {
            const id = String(pedido.id || "");
            acciones.append(
                crearDeslizador("Deslizá para marcar Entregado", () => {
                    // Prueba de entrega (T70): si está pedida, antes la foto y la firma.
                    const prueba = window.pruebaEntregaVendeFrio;
                    if (prueba && prueba.antesDeEntregar(id, () => entregarSinCambios(id, estado))) return;
                    entregarSinCambios(id, estado);
                }),
                crearBoton("btnAccion secundario botonEntregarConCambios", "Entregar con cambios", "entregarConCambios")
            );
        }

        // Editar (T25): solo quien cargó el pedido y el dueño.
        if (editar) acciones.appendChild(crearBoton("btnAccion secundario botonEditarPedido", "Editar pedido", "editar"));

        if (imprimir) {
            const enCurso = window.impresionVendeFrio.imprimiendo();
            const boton = crearBoton(
                "btnAccion secundario botonImprimirTicket",
                enCurso === String(pedido.id || "") ? "Imprimiendo…" : "Imprimir ticket",
                "imprimir"
            );
            boton.insertAdjacentHTML("afterbegin", window.icono ? window.icono("impresora", 18) : "");
            boton.disabled = Boolean(enCurso);
            acciones.appendChild(boton);
        }

        // Historial (T27b): el mensaje del pedido, para reenviarlo.
        if (estado === "entregado") acciones.appendChild(crearBoton("btnAccion secundario botonVerMensajePedido", "Ver mensaje del pedido", "verMensaje"));

        if (cobrar && cobrado) acciones.appendChild(crearBoton("btnAccion secundario botonCorregirCobro", "Corregir cobro", "cobrar"));

        // Opciones que suman otros módulos (devolución, prueba de entrega).
        (window.accionesPedidoExtras || []).forEach(crearAcciones => {
            try {
                (crearAcciones(pedido, estado) || []).forEach(extra => {
                    const boton = crearBoton("btnAccion secundario botonExtraPedido", extra.texto, "");
                    if (extra.icono && window.icono) boton.insertAdjacentHTML("afterbegin", window.icono(extra.icono, 18));
                    boton.removeAttribute("data-accion");
                    boton.addEventListener("click", evento => {
                        evento.stopPropagation();
                        document.getElementById("menuFichaPedido")?.classList.add("oculto");
                        extra.alTocar(pedido);
                    });
                    acciones.appendChild(boton);
                });
            } catch (error) {
                console.error("Falló una opción de la ficha del pedido.", error);
            }
        });
        if (cobrado) acciones.appendChild(crear("p", "pistaChecklist", "Tiene el cobro registrado: ya no vuelve atrás de \u00abEntregado\u00bb."));

        const secundarias = crear("div", "accionesSecundariasPedido");
        if (anterior) secundarias.appendChild(crearBoton("btnAccion secundario", "Volver un paso atrás", "atras"));
        if (marcar) secundarias.appendChild(crearBoton("btnAccion secundario marcarIncidencia", "Marcar incidencia", "incidencia"));
        if (secundarias.children.length) acciones.appendChild(secundarias);

        // Cancelar y eliminar (T26): solo quien cargó el pedido y el dueño.
        const peligro = crear("div", "accionesSecundariasPedido");
        if (cancelar) peligro.appendChild(crearBoton("btnAccion secundario peligroPedido", "Cancelar pedido", "cancelar"));
        if (eliminar) peligro.appendChild(crearBoton("btnAccion secundario peligroPedido", "Eliminar pedido", "eliminar"));
        if (peligro.children.length) acciones.appendChild(peligro);

        // Estilo nuevo (T35): a la vista queda solo el próximo paso (y la
        // entrega). Lo demás va en "Más opciones" (⋯).
        const opciones = Array.from(acciones.querySelectorAll(
            ".botonEntregarConCambios, .botonEditarPedido, .botonImprimirTicket, .botonVerMensajePedido, .botonCorregirCobro, .botonExtraPedido, .accionesSecundariasPedido .btnAccion"
        ));
        if (opciones.length) {
            const menu = crear("div", "menuFichaPedido oculto");
            menu.id = "menuFichaPedido";
            menu.setAttribute("role", "menu");
            opciones.forEach(boton => {
                boton.classList.add("opcionMenuFicha");
                boton.setAttribute("role", "menuitem");
                menu.appendChild(boton);
            });
            acciones.querySelectorAll(".accionesSecundariasPedido").forEach(caja => { if (!caja.children.length) caja.remove(); });

            const abrir = crear("button", "botonMenuFicha");
            abrir.type = "button";
            abrir.setAttribute("aria-label", "Más opciones");
            abrir.setAttribute("aria-expanded", "false");
            abrir.setAttribute("aria-controls", "menuFichaPedido");
            abrir.innerHTML = (window.icono ? window.icono("puntos", 20) : "⋯") + "<span>Más opciones</span>";
            abrir.addEventListener("click", () => {
                const abierto = menu.classList.toggle("oculto") === false;
                abrir.setAttribute("aria-expanded", String(abierto));
            });
            acciones.append(abrir, menu);
        }

        return acciones;
    }

    function avisarError(error) {
        console.error("No se pudo cambiar el pedido.", error);
        if (typeof mostrarAviso === "function") {
            mostrarAviso("No se pudo hacer el cambio", error && error.code === "pedido" ? error.message : "Probá de nuevo en unos segundos.");
        }
    }

    // El estado que ve esta persona ahora (el de la ficha). Si mientras tanto
    // otro celular lo cambió, no se hace nada y la ficha ya muestra el nuevo.
    function pedidoSigueEn(id, estado) {
        const pedido = buscarPedido(id);
        return Boolean(pedido) && estadoActualDelPedido(pedido) === estado;
    }

    function avanzar(id, estado, hacia) {
        const paso = pasosSiguientes(estado).find(item => item.hacia === hacia);
        if (!paso || !pedidoSigueEn(id, estado)) return;

        // "Preparado" (T24): primero el resumen, que se desliza para confirmar.
        if (paso.conChecklist) {
            abrirResumen(id);
            return;
        }

        try {
            window.nubeVendeFrio.agregarEstadoAlPedido(id, paso.hacia, "");
            mostrarToast(paso.hecho);
        } catch (error) {
            avisarError(error);
        }
    }

    // Ventana para escribir un motivo o una nota (obligatorio).
    let alConfirmarTexto = null;

    function crearModalTexto() {
        let modal = document.getElementById("modalTextoPedido");
        if (modal) return modal;

        modal = crear("div", "modal oculto");
        modal.id = "modalTextoPedido";

        const contenido = crear("div", "modalContenido textoPedido");
        contenido.setAttribute("role", "dialog");
        contenido.setAttribute("aria-modal", "true");
        contenido.setAttribute("aria-labelledby", "tituloTextoPedido");

        const titulo = crear("h2", "");
        titulo.id = "tituloTextoPedido";

        const explicacion = crear("p", "explicacionTextoPedido");
        explicacion.id = "explicacionTextoPedido";

        const etiqueta = crear("label", "");
        etiqueta.id = "etiquetaTextoPedido";
        etiqueta.htmlFor = "campoTextoPedido";

        const campo = document.createElement("textarea");
        campo.id = "campoTextoPedido";
        campo.maxLength = LARGO_MAXIMO_MOTIVO;
        campo.rows = 3;

        const error = crear("p", "errorTextoPedido oculto", "");
        error.id = "errorTextoPedido";
        error.setAttribute("role", "alert");

        const botones = crear("div", "modalBotones");
        const cancelar = crear("button", "btnModalCancelar", "Cancelar");
        cancelar.type = "button";
        cancelar.id = "volverTextoPedido";
        const confirmar = crear("button", "btnModalConfirmar", "Confirmar");
        confirmar.type = "button";
        confirmar.id = "confirmarTextoPedido";
        botones.append(cancelar, confirmar);

        contenido.append(titulo, explicacion, etiqueta, campo, error, botones);
        modal.appendChild(contenido);
        document.body.appendChild(modal);

        cancelar.addEventListener("click", cerrarModalTexto);
        modal.addEventListener("click", evento => {
            if (evento.target === modal) cerrarModalTexto();
        });
        campo.addEventListener("input", () => error.classList.add("oculto"));

        confirmar.addEventListener("click", () => {
            const texto = campo.value.trim();
            if (!texto) {
                error.textContent = "Escribí " + (etiqueta.dataset.falta || "el motivo") + " para seguir.";
                error.classList.remove("oculto");
                campo.focus();
                return;
            }

            const accion = alConfirmarTexto;
            cerrarModalTexto();
            if (accion) accion(texto);
        });

        return modal;
    }

    // "volver" cambia el texto del botón que cierra sin hacer nada (T26:
    // "Volver" al cancelar un pedido, para no confundirlo con "Cancelar").
    function abrirModalTexto({ titulo, explicacion, etiqueta, falta, boton, peligro, volver, alConfirmar }) {
        const modal = crearModalTexto();

        document.getElementById("tituloTextoPedido").textContent = titulo;
        document.getElementById("explicacionTextoPedido").textContent = explicacion;
        const campoEtiqueta = document.getElementById("etiquetaTextoPedido");
        campoEtiqueta.textContent = etiqueta;
        campoEtiqueta.dataset.falta = falta;

        const campo = document.getElementById("campoTextoPedido");
        campo.value = "";
        campo.placeholder = "Hasta " + LARGO_MAXIMO_MOTIVO + " letras";
        document.getElementById("errorTextoPedido").classList.add("oculto");

        const confirmar = document.getElementById("confirmarTextoPedido");
        confirmar.textContent = boton;
        confirmar.className = peligro ? "btnModalPeligro" : "btnModalConfirmar";
        document.getElementById("volverTextoPedido").textContent = volver || "Cancelar";

        alConfirmarTexto = alConfirmar;
        modal.classList.remove("oculto");
        setTimeout(() => campo.focus(), 50);
    }

    function cerrarModalTexto() {
        alConfirmarTexto = null;
        const modal = document.getElementById("modalTextoPedido");
        if (modal) modal.classList.add("oculto");
    }

    function volverAtras(id, estado) {
        if (estado === "entregado") {
            volverDeEntregado(id);
            return;
        }

        const paso = pasoAnterior(buscarPedido(id), estado);
        if (!paso) return;

        const desde = nombreDeEstadoPedido(estado);
        const hacia = nombreDeEstadoPedido(paso.hacia);

        abrirModalTexto({
            titulo: "Volver un paso atrás",
            explicacion: "El pedido pasa de \u00ab" + desde + "\u00bb a \u00ab" + hacia + "\u00bb. Queda en el seguimiento con tu nombre y el motivo.",
            etiqueta: "¿Por qué vuelve atrás?",
            falta: "el motivo",
            boton: "Volver a " + hacia,
            peligro: true,
            alConfirmar: motivo => {
                // Si otro celular ya lo movió, no se vuelve atrás desde otro estado.
                if (!pedidoSigueEn(id, estado)) {
                    mostrarAviso("El pedido cambió", "Otra persona lo cambió mientras escribías. Revisá el estado nuevo y probá de nuevo si hace falta.");
                    return;
                }

                try {
                    window.nubeVendeFrio.agregarEstadoAlPedido(id, paso.hacia, motivo);
                    mostrarToast("Volvió a " + hacia);
                } catch (error) {
                    avisarError(error);
                }
            }
        });
    }

    function marcarIncidencia(id) {
        abrirModalTexto({
            titulo: "Marcar incidencia",
            // Con "Todos pueden hacer todo" la resuelve cualquiera (T29d).
            explicacion: "El pedido sigue en su estado y aparece también en \u00abIncidencias\u00bb hasta que " +
                (window.empleadosVendeFrio?.todosPuedenTodo?.() !== false
                    ? "alguien del equipo la resuelva."
                    : "la resuelva el dueño o quien controla pedidos."),
            etiqueta: "¿Qué pasó?",
            falta: "el motivo",
            boton: "Marcar incidencia",
            peligro: true,
            alConfirmar: motivo => {
                try {
                    window.nubeVendeFrio.marcarIncidencia(id, motivo);
                    mostrarToast("Incidencia marcada");
                } catch (error) {
                    avisarError(error);
                }
            }
        });
    }

    function resolverIncidencia(id) {
        if (!puedeResolverIncidencias()) return;

        abrirModalTexto({
            titulo: "Resolver incidencia",
            explicacion: "El pedido sale de \u00abIncidencias\u00bb. La nota queda en el seguimiento con tu nombre.",
            etiqueta: "¿Cómo se resolvió?",
            falta: "una nota",
            boton: "Resolver",
            peligro: false,
            alConfirmar: nota => {
                try {
                    if (window.nubeVendeFrio.resolverIncidencias(id, nota) > 0) mostrarToast("Incidencia resuelta");
                } catch (error) {
                    avisarError(error);
                }
            }
        });
    }

    // Cancelar (T26): con motivo, antes de "Entregado". Queda en
    // "Cancelados" y en el seguimiento, y se avisa a quien ya trabajaba en
    // el pedido.
    function cancelarPedido(id, estado) {
        abrirModalTexto({
            titulo: "Cancelar pedido",
            explicacion: "Es para cuando el comercio ya no lo quiere. El pedido queda en \u00abCancelados\u00bb, con tu nombre y el motivo, y no cuenta en Historial ni en Estadísticas. Se avisa a quien ya estaba trabajando en él.",
            etiqueta: "¿Por qué se cancela?",
            falta: "el motivo",
            boton: "Cancelar pedido",
            peligro: true,
            volver: "Volver",
            alConfirmar: motivo => {
                if (!pedidoSigueEn(id, estado)) {
                    mostrarAviso("El pedido cambió", "Otra persona lo cambió mientras escribías. Revisá el estado nuevo y probá de nuevo si hace falta.");
                    return;
                }

                try {
                    window.nubeVendeFrio.cancelarPedido(id, motivo);
                    mostrarToast("Pedido cancelado");
                } catch (error) {
                    avisarError(error);
                }
            }
        });
    }

    // Eliminar (T26): solo en "Cargado", para errores (por ejemplo, un pedido
    // cargado dos veces). Desaparece de la app, pero queda guardado por dentro.
    // Un "Histórico" (sin estado), solo el dueño, como en Historial (T27b).
    function eliminarPedido(id, estado) {
        abrirConfirmacion({
            titulo: "Eliminar pedido",
            mensaje: estado
                ? "Es para errores, por ejemplo un pedido cargado dos veces. Desaparece de la app para todos. Si el comercio ya no lo quiere, mejor cancelalo."
                : "Desaparece de la app para todos, pero queda guardado por dentro. ¿Lo eliminás?",
            boton: "Eliminar",
            alConfirmar: () => {
                if (!pedidoSigueEn(id, estado)) {
                    mostrarAviso("El pedido cambió", "Otra persona lo cambió recién. Revisá el estado nuevo y probá de nuevo si hace falta.");
                    return;
                }

                try {
                    window.nubeVendeFrio.eliminarPedido(id);
                    cerrarFicha();
                    mostrarToast("Pedido eliminado");
                } catch (error) {
                    avisarError(error);
                }
            }
        });
    }

    document.addEventListener("click", evento => {
        const boton = evento.target.closest("#cuerpoFichaPedido button[data-accion]");
        if (!boton || !idFichaAbierta) return;

        const id = idFichaAbierta;
        const pedido = buscarPedido(id);
        if (!pedido) return;
        const estado = estadoActualDelPedido(pedido);

        if (boton.dataset.accion === "siguiente") avanzar(id, estado, boton.dataset.estado);
        else if (boton.dataset.accion === "atras") volverAtras(id, estado);
        else if (boton.dataset.accion === "incidencia") marcarIncidencia(id);
        else if (boton.dataset.accion === "resolver") resolverIncidencia(id);
        else if (boton.dataset.accion === "tildar") tocarProducto(id, boton.dataset.linea, boton);
        else if (boton.dataset.accion === "faltante") abrirFaltante(id, boton.dataset.linea);
        else if (boton.dataset.accion === "editar") window.abrirEdicionPedido?.(id);
        else if (boton.dataset.accion === "entendido") entendido(id);
        else if (boton.dataset.accion === "cancelar") cancelarPedido(id, estado);
        else if (boton.dataset.accion === "eliminar") eliminarPedido(id, estado);
        else if (boton.dataset.accion === "entregarConCambios") abrirEntrega(id, true);
        else if (boton.dataset.accion === "cobrar") abrirCobro(id, false);
        else if (boton.dataset.accion === "verComprobante") abrirComprobante(id);
        else if (boton.dataset.accion === "imprimir") window.impresionVendeFrio?.elegirCopias(id);
        else if (boton.dataset.accion === "verMensaje") verMensajeDelPedido(id);
    });

    // "Entendido" (T25): cierra la franja de las ediciones para esta persona.
    function entendido(id) {
        try {
            window.nubeVendeFrio.marcarEdicionesVistas(id);
        } catch (error) {
            avisarError(error);
        }
    }

    // -------------------------------------------------
    // Checklist de preparación y faltantes (T24)
    // -------------------------------------------------
    // En "En preparación" cada producto tiene su casilla. Para no
    // equivocarse: cada tilde dice quién lo puso, los tildes se ven en vivo
    // en todos los celulares, "Marcar preparado" pide todo tildado o con
    // faltante, antes se ve un resumen que se desliza para confirmar y
    // destildar lo que tildó otro pide confirmación.

    function textoPendientes(cantidad) {
        return cantidad === 1
            ? "Falta 1 producto: tildalo o marcalo como faltante."
            : "Faltan " + cantidad + " productos: tildalos o marcalos como faltante.";
    }

    // El producto sin tildar que se resalta un momento (sigue resaltado
    // aunque la ficha se redibuje).
    let resaltado = { clave: "", hasta: 0 };

    function crearFilaChecklist(linea, conFaltantes, aRevisar) {
        const estado = linea.faltante ? "faltante" : linea.lista ? "lista" : "pendiente";
        const nombre = String(linea.item.producto || "Sin producto");

        const fila = crear("div", "lineaChecklist");
        fila.dataset.estado = estado;
        fila.dataset.clave = linea.clave;
        if (estado === "pendiente" && resaltado.clave === linea.clave && Date.now() < resaltado.hasta) fila.classList.add("resaltada");

        const casilla = crearBoton("casillaChecklist", undefined, "tildar");
        casilla.dataset.linea = linea.clave;
        casilla.setAttribute("role", "checkbox");
        casilla.setAttribute("aria-checked", linea.lista ? "true" : "false");

        const cuadro = crear("span", "cuadroChecklist");
        cuadro.setAttribute("aria-hidden", "true");
        if (estado === "faltante") cuadro.textContent = "!";
        else cuadro.innerHTML = SVG_TILDE;

        const textos = crear("span", "textoChecklist");
        textos.appendChild(crear("strong", "", nombre));

        // Editado (T25): producto nuevo o con otra cantidad, hasta "Entendido".
        if (aRevisar) {
            fila.classList.add("aRevisar");
            textos.appendChild(crear("small", "revisarPedido", "A revisar: " + aRevisar));
        }

        // Quién hizo lo último sobre este producto.
        const tilde = linea.tilde;
        if (linea.faltante) {
            const faltante = linea.faltante;
            textos.append(
                crear("small", "quienChecklist", "Faltante: " + faltante.preparada + " de " + linea.cantidad + "  ·  " +
                    nombrePersona(faltante.persona) + " " + textoHora(Number(faltante.horaCelular) || 0)),
                crear("small", "observacionFaltante", String(faltante.observacion || ""))
            );
        } else if (tilde && tilde.tildado) {
            textos.appendChild(crear("small", "quienChecklist", "✓ " + nombrePersona(tilde.persona) + " " + textoHora(Number(tilde.horaCelular) || 0)));
        } else if (tilde) {
            textos.appendChild(crear("small", "quienChecklist", "Lo destildó " + nombrePersona(tilde.persona) + " " + textoHora(Number(tilde.horaCelular) || 0)));
        }

        const cantidad = crear("span", "cantidadChecklist", linea.faltante ? linea.faltante.preparada + "/" + linea.cantidad : "x" + linea.cantidad);

        casilla.append(cuadro, textos, cantidad);
        fila.appendChild(casilla);

        if (conFaltantes) {
            const boton = crearBoton("botonFaltante", linea.faltante ? "Cambiar" : "Falta", "faltante");
            boton.dataset.linea = linea.clave;
            boton.setAttribute("aria-label", (linea.faltante ? "Cambiar el faltante de " : "Anotar un faltante de ") + nombre);
            fila.appendChild(boton);
        }

        return fila;
    }

    function dibujarChecklist(pedido) {
        const preparacion = preparacionDe(pedido);
        const seccion = seccionFicha("Checklist");
        seccion.classList.add("checklistPedido");

        const progreso = crear("div", "progresoChecklist");
        const texto = preparacion.listos + " de " + preparacion.productos + " listos" +
            (preparacion.faltantes ? "  ·  " + textoFaltantes(preparacion.faltantes) : "");
        const barra = crear("div", "barraChecklist");
        barra.setAttribute("role", "progressbar");
        barra.setAttribute("aria-label", "Productos listos");
        barra.setAttribute("aria-valuemin", "0");
        barra.setAttribute("aria-valuemax", String(preparacion.productos));
        barra.setAttribute("aria-valuenow", String(preparacion.listos));
        const relleno = crear("span", "");
        relleno.style.width = (preparacion.productos ? Math.round(preparacion.listos * 100 / preparacion.productos) : 100) + "%";
        barra.appendChild(relleno);
        progreso.append(crear("p", "textoProgresoChecklist", texto), barra);
        if (preparacion.completa) progreso.classList.add("completa");
        seccion.appendChild(progreso);

        if (!preparacion.lineas.length) {
            seccion.appendChild(crear("p", "subtitulo", "Este pedido no tiene productos."));
            return seccion;
        }

        // Agrupados por marca, en el orden en que se cargaron.
        const marcas = [];
        preparacion.lineas.forEach(linea => {
            const marca = String(linea.item.marca || "Sin marca").trim() || "Sin marca";
            let grupo = marcas.find(actual => actual.marca === marca);
            if (!grupo) {
                grupo = { marca, lineas: [] };
                marcas.push(grupo);
            }
            grupo.lineas.push(linea);
        });

        const conFaltantes = puedeAnotarFaltantes();
        const revisar = productosARevisar(pedido);
        marcas.forEach(grupo => {
            seccion.appendChild(crear("p", "marcaFichaPedido", grupo.marca));
            grupo.lineas.forEach(linea => seccion.appendChild(crearFilaChecklist(linea, conFaltantes, revisar.get(linea.clave))));
        });

        return seccion;
    }

    function lineaDelPedido(id, clave) {
        const pedido = buscarPedido(id);
        if (!pedido || !ESTADOS_CON_CHECKLIST.includes(estadoActualDelPedido(pedido))) return null;
        return preparacionDe(pedido).lineas.find(linea => linea.clave === clave) || null;
    }

    function tildar(id, clave, tildado) {
        try {
            window.nubeVendeFrio.tildarProducto(id, clave, tildado);
            if (navigator.vibrate) navigator.vibrate(12);
        } catch (error) {
            avisarError(error);
        }
    }

    // Tocar un producto: lo tilda o lo destilda. Si lo tildó otro, pregunta
    // antes. Un faltante se cambia desde su ventana.
    function tocarProducto(id, clave, casilla) {
        const linea = lineaDelPedido(id, clave);
        if (!linea) return;

        if (linea.faltante) {
            if (puedeAnotarFaltantes()) abrirFaltante(id, clave);
            else mostrarToast("Es un faltante: lo cambia quien prepara pedidos");
            return;
        }

        if (!linea.lista) {
            // Se ve tildado al instante; la nube (o la copia del celular)
            // confirma enseguida y la ficha se redibuja.
            casilla?.closest(".lineaChecklist")?.setAttribute("data-estado", "lista");
            tildar(id, clave, true);
            return;
        }

        if (esMio(linea.tilde && linea.tilde.persona)) {
            casilla?.closest(".lineaChecklist")?.setAttribute("data-estado", "pendiente");
            tildar(id, clave, false);
            return;
        }

        const quien = nombrePersona(linea.tilde && linea.tilde.persona);
        const idTilde = linea.tilde ? linea.tilde.id : "";
        abrirConfirmacion({
            titulo: "¿Lo destildás?",
            mensaje: "Lo tildó " + quien + ". " + String(linea.item.producto || "Este producto") + " vuelve a quedar sin tildar.",
            boton: "Destildar",
            alConfirmar: () => {
                // Si mientras tanto alguien lo cambió, no se toca.
                const actual = lineaDelPedido(id, clave);
                if (!actual || !actual.lista || actual.faltante || (actual.tilde ? actual.tilde.id : "") !== idTilde) {
                    mostrarAviso("El producto cambió", "Otra persona lo cambió mientras confirmabas. Revisá la checklist.");
                    return;
                }
                tildar(id, clave, false);
            }
        });
    }

    // Ventana de confirmación (sin las del navegador): verde y rojo.
    let alConfirmarConfirmacion = null;

    function crearModalConfirmacion() {
        let modal = document.getElementById("modalConfirmarPedido");
        if (modal) return modal;

        modal = crear("div", "modal oculto");
        modal.id = "modalConfirmarPedido";

        const contenido = crear("div", "modalContenido confirmarPedido");
        contenido.setAttribute("role", "dialog");
        contenido.setAttribute("aria-modal", "true");
        contenido.setAttribute("aria-labelledby", "tituloConfirmarPedido");

        const titulo = crear("h2", "");
        titulo.id = "tituloConfirmarPedido";
        const mensaje = crear("p", "explicacionTextoPedido");
        mensaje.id = "mensajeConfirmarPedido";

        const botones = crear("div", "modalBotones");
        const cancelar = crear("button", "btnModalConfirmar", "Cancelar");
        cancelar.type = "button";
        const confirmar = crear("button", "btnModalPeligro", "Confirmar");
        confirmar.type = "button";
        confirmar.id = "botonConfirmarPedido";
        botones.append(cancelar, confirmar);

        contenido.append(titulo, mensaje, botones);
        modal.appendChild(contenido);
        document.body.appendChild(modal);

        cancelar.addEventListener("click", cerrarConfirmacion);
        modal.addEventListener("click", evento => {
            if (evento.target === modal) cerrarConfirmacion();
        });
        confirmar.addEventListener("click", () => {
            const accion = alConfirmarConfirmacion;
            cerrarConfirmacion();
            if (accion) accion();
        });

        return modal;
    }

    function abrirConfirmacion({ titulo, mensaje, boton, alConfirmar }) {
        const modal = crearModalConfirmacion();
        document.getElementById("tituloConfirmarPedido").textContent = titulo;
        document.getElementById("mensajeConfirmarPedido").textContent = mensaje;
        document.getElementById("botonConfirmarPedido").textContent = boton;
        alConfirmarConfirmacion = alConfirmar;
        modal.classList.remove("oculto");
    }

    function cerrarConfirmacion() {
        alConfirmarConfirmacion = null;
        const modal = document.getElementById("modalConfirmarPedido");
        if (modal) modal.classList.add("oculto");
    }

    // Ventana del faltante: cuánto se preparó (menos de lo pedido) y una
    // observación. Lo pedido se conserva.
    let faltanteAbierto = null;

    function crearModalFaltante() {
        let modal = document.getElementById("modalFaltantePedido");
        if (modal) return modal;

        modal = crear("div", "modal oculto");
        modal.id = "modalFaltantePedido";

        const contenido = crear("div", "modalContenido faltantePedido");
        contenido.setAttribute("role", "dialog");
        contenido.setAttribute("aria-modal", "true");
        contenido.setAttribute("aria-labelledby", "tituloFaltantePedido");

        const titulo = crear("h2", "", "Faltante");
        titulo.id = "tituloFaltantePedido";

        const explicacion = crear("p", "explicacionTextoPedido");
        explicacion.id = "explicacionFaltantePedido";

        const etiquetaCantidad = crear("label", "", "¿Cuántas preparaste?");
        etiquetaCantidad.htmlFor = "cantidadFaltantePedido";

        const contador = crear("div", "contadorFaltante");
        const menos = crear("button", "pasoContadorFaltante", "−");
        menos.type = "button";
        menos.dataset.paso = "-1";
        menos.setAttribute("aria-label", "Una menos");
        const campoCantidad = document.createElement("input");
        campoCantidad.id = "cantidadFaltantePedido";
        campoCantidad.type = "number";
        campoCantidad.inputMode = "numeric";
        campoCantidad.min = "0";
        campoCantidad.step = "1";
        const mas = crear("button", "pasoContadorFaltante", "+");
        mas.type = "button";
        mas.dataset.paso = "1";
        mas.setAttribute("aria-label", "Una más");
        contador.append(menos, campoCantidad, mas);

        const etiquetaObservacion = crear("label", "", "Observación");
        etiquetaObservacion.htmlFor = "observacionFaltantePedido";
        const campoObservacion = document.createElement("textarea");
        campoObservacion.id = "observacionFaltantePedido";
        campoObservacion.maxLength = LARGO_MAXIMO_MOTIVO;
        campoObservacion.rows = 2;
        campoObservacion.placeholder = "Por ejemplo: no había más en el depósito";

        const error = crear("p", "errorTextoPedido oculto", "");
        error.id = "errorFaltantePedido";
        error.setAttribute("role", "alert");

        const quitar = crear("button", "btnAccion secundario quitarFaltante", "Quitar faltante");
        quitar.type = "button";
        quitar.id = "quitarFaltantePedido";

        const botones = crear("div", "modalBotones");
        const cancelar = crear("button", "btnModalCancelar", "Cancelar");
        cancelar.type = "button";
        const guardar = crear("button", "btnModalConfirmar", "Guardar faltante");
        guardar.type = "button";
        botones.append(cancelar, guardar);

        contenido.append(titulo, explicacion, etiquetaCantidad, contador, etiquetaObservacion, campoObservacion, error, quitar, botones);
        modal.appendChild(contenido);
        document.body.appendChild(modal);

        const ocultarError = () => error.classList.add("oculto");
        const mostrarError = (texto, campo) => {
            error.textContent = texto;
            error.classList.remove("oculto");
            if (campo) campo.focus();
        };

        cancelar.addEventListener("click", cerrarFaltante);
        modal.addEventListener("click", evento => {
            if (evento.target === modal) cerrarFaltante();
        });
        campoCantidad.addEventListener("input", ocultarError);
        campoObservacion.addEventListener("input", ocultarError);

        contador.addEventListener("click", evento => {
            const boton = evento.target.closest("button[data-paso]");
            if (!boton || !faltanteAbierto) return;

            const actual = Number.parseInt(campoCantidad.value, 10);
            const base = Number.isFinite(actual) ? actual : faltanteAbierto.pedida;
            const nuevo = Math.min(faltanteAbierto.pedida - 1, Math.max(0, base + Number(boton.dataset.paso)));
            campoCantidad.value = String(nuevo);
            ocultarError();
        });

        guardar.addEventListener("click", () => {
            if (!faltanteAbierto) return;

            const { id, clave, pedida } = faltanteAbierto;
            const texto = campoCantidad.value.trim();
            const cantidad = Number(texto);
            if (texto === "" || !Number.isInteger(cantidad) || cantidad < 0 || cantidad >= pedida) {
                mostrarError(pedida === 1
                    ? "Si no pusiste ninguna, escribí 0."
                    : "Escribí cuántas pusiste en el cajón: de 0 a " + (pedida - 1) + ".", campoCantidad);
                return;
            }

            const observacion = campoObservacion.value.trim();
            if (!observacion) {
                mostrarError("Escribí una observación para seguir.", campoObservacion);
                return;
            }

            if (!lineaDelPedido(id, clave)) {
                cerrarFaltante();
                mostrarAviso("El pedido cambió", "El pedido ya no está en preparación. Revisá su estado.");
                return;
            }

            try {
                window.nubeVendeFrio.marcarFaltante(id, clave, cantidad, observacion);
                cerrarFaltante();
                mostrarToast("Faltante anotado");
            } catch (falla) {
                avisarError(falla);
            }
        });

        quitar.addEventListener("click", () => {
            if (!faltanteAbierto) return;

            const { id, clave } = faltanteAbierto;
            try {
                const quitado = window.nubeVendeFrio.quitarFaltante(id, clave);
                cerrarFaltante();
                if (quitado) mostrarToast("Faltante quitado");
            } catch (falla) {
                cerrarFaltante();
                avisarError(falla);
            }
        });

        return modal;
    }

    function abrirFaltante(id, clave) {
        if (!puedeAnotarFaltantes()) return;

        const linea = lineaDelPedido(id, clave);
        if (!linea) return;

        const modal = crearModalFaltante();
        faltanteAbierto = { id, clave, pedida: linea.cantidad };

        document.getElementById("explicacionFaltantePedido").textContent =
            String(linea.item.producto || "Sin producto") + ": se " + (linea.cantidad === 1 ? "pidió 1" : "pidieron " + linea.cantidad) +
            ". Lo pedido se conserva y se avisa a quien cargó el pedido y a quien recibe aviso de faltantes.";

        const campoCantidad = document.getElementById("cantidadFaltantePedido");
        campoCantidad.max = String(linea.cantidad - 1);
        campoCantidad.value = linea.faltante ? String(linea.faltante.preparada) : "";
        campoCantidad.placeholder = "De 0 a " + (linea.cantidad - 1);

        document.getElementById("observacionFaltantePedido").value = linea.faltante ? String(linea.faltante.observacion || "") : "";
        document.getElementById("errorFaltantePedido").classList.add("oculto");
        document.getElementById("quitarFaltantePedido").classList.toggle("oculto", !linea.faltante);

        modal.classList.remove("oculto");
        setTimeout(() => campoCantidad.focus(), 50);
    }

    function cerrarFaltante() {
        faltanteAbierto = null;
        const modal = document.getElementById("modalFaltantePedido");
        if (modal) modal.classList.add("oculto");
    }

    // Botón que se desliza para confirmar (resumen de la checklist). Sirve
    // con el dedo y, si el celular es viejo, con eventos táctiles. Con el
    // teclado se confirma con Enter. Un toque solo no confirma.
    function crearDeslizador(texto, alCompletar) {
        const pista = crear("div", "deslizador");
        const relleno = crear("span", "rellenoDeslizador");
        const etiqueta = crear("span", "textoDeslizador", texto);
        etiqueta.setAttribute("aria-hidden", "true");
        const tirador = crear("button", "tiradorDeslizador");
        tirador.type = "button";
        tirador.setAttribute("aria-label", texto + " (Enter para confirmar)");
        tirador.innerHTML = window.icono ? window.icono("flechaDerecha", 24) : "→";
        pista.append(relleno, etiqueta, tirador);

        const MARGEN = 4;
        let inicio = null;
        let recorrido = 0;
        let maximo = 0;
        let completo = false;

        function ubicar(valor) {
            recorrido = Math.max(0, Math.min(maximo, valor));
            tirador.style.transform = "translateX(" + recorrido + "px)";
            relleno.style.width = (recorrido + tirador.offsetWidth + MARGEN * 2) + "px";
            etiqueta.style.opacity = String(maximo ? Math.max(0, 1 - recorrido / (maximo * 0.6)) : 1);
        }

        function completar() {
            if (completo) return;
            completo = true;
            maximo = Math.max(0, pista.clientWidth - tirador.offsetWidth - MARGEN * 2);
            pista.classList.add("completo");
            ubicar(maximo);
            if (navigator.vibrate) navigator.vibrate(30);
            setTimeout(alCompletar, 160);
        }

        function xDe(evento) {
            const toque = evento.touches && evento.touches[0] || evento.changedTouches && evento.changedTouches[0];
            return toque ? toque.clientX : evento.clientX;
        }

        function empezar(evento) {
            if (completo) return;
            inicio = xDe(evento) - recorrido;
            maximo = Math.max(0, pista.clientWidth - tirador.offsetWidth - MARGEN * 2);
            pista.classList.add("arrastrando");
            if (evento.pointerId !== undefined && tirador.setPointerCapture) tirador.setPointerCapture(evento.pointerId);
        }

        function mover(evento) {
            if (inicio === null || completo) return;
            if (evento.cancelable) evento.preventDefault();
            ubicar(xDe(evento) - inicio);
        }

        function soltar() {
            if (inicio === null || completo) return;
            inicio = null;
            pista.classList.remove("arrastrando");
            if (maximo && recorrido >= maximo * 0.9) completar();
            else ubicar(0);
        }

        if (window.PointerEvent) {
            tirador.addEventListener("pointerdown", empezar);
            tirador.addEventListener("pointermove", mover);
            tirador.addEventListener("pointerup", soltar);
            tirador.addEventListener("pointercancel", soltar);
        } else {
            tirador.addEventListener("touchstart", empezar, { passive: true });
            tirador.addEventListener("touchmove", mover, { passive: false });
            tirador.addEventListener("touchend", soltar);
            tirador.addEventListener("touchcancel", soltar);
        }

        // Un toque sin deslizar explica qué hacer.
        tirador.addEventListener("click", () => {
            if (completo || recorrido > 0) return;
            pista.classList.remove("sacudir");
            void pista.offsetWidth;
            pista.classList.add("sacudir");
        });

        tirador.addEventListener("keydown", evento => {
            if (evento.key !== "Enter" && evento.key !== " ") return;
            evento.preventDefault();
            completar();
        });

        return pista;
    }

    // Resumen antes de "Preparado": productos, unidades y faltantes. Se
    // actualiza solo si otro celular cambia la checklist; si deja de estar
    // completa, se cierra.
    let idResumenAbierto = "";
    let textoResumenDibujado = "";

    function crearModalResumen() {
        let modal = document.getElementById("modalResumenPreparacion");
        if (modal) return modal;

        modal = crear("div", "modal oculto");
        modal.id = "modalResumenPreparacion";

        const contenido = crear("div", "modalContenido resumenPreparacion");
        contenido.setAttribute("role", "dialog");
        contenido.setAttribute("aria-modal", "true");
        contenido.setAttribute("aria-labelledby", "tituloResumenPreparacion");

        const titulo = crear("h2", "", "Resumen de la preparación");
        titulo.id = "tituloResumenPreparacion";

        const cuerpo = crear("div", "cuerpoResumenPreparacion");
        cuerpo.id = "cuerpoResumenPreparacion";

        const botones = crear("div", "modalBotones");
        const cancelar = crear("button", "btnModalCancelar", "Volver a la checklist");
        cancelar.type = "button";
        botones.appendChild(cancelar);

        contenido.append(titulo, cuerpo, botones);
        modal.appendChild(contenido);
        document.body.appendChild(modal);

        cancelar.addEventListener("click", cerrarResumen);
        modal.addEventListener("click", evento => {
            if (evento.target === modal) cerrarResumen();
        });

        return modal;
    }

    // Lleva la ficha al primer producto sin tildar y lo resalta.
    function mostrarPrimerPendiente() {
        const fila = document.querySelector('#cuerpoFichaPedido .lineaChecklist[data-estado="pendiente"]');
        if (!fila) return;

        fila.scrollIntoView?.({ block: "center", behavior: "smooth" });
        resaltado = { clave: fila.dataset.clave, hasta: Date.now() + 1400 };
        fila.classList.remove("resaltada");
        void fila.offsetWidth;
        fila.classList.add("resaltada");
    }

    function abrirResumen(id) {
        const pedido = buscarPedido(id);
        if (!pedido || estadoActualDelPedido(pedido) !== "enPreparacion") return;

        const preparacion = preparacionDe(pedido);
        if (!preparacion.completa) {
            mostrarToast(preparacion.pendientes === 1 ? "Falta 1 producto por tildar" : "Faltan " + preparacion.pendientes + " productos por tildar");
            mostrarPrimerPendiente();
            return;
        }

        idResumenAbierto = id;
        textoResumenDibujado = "";
        const modal = crearModalResumen();
        dibujarResumen();
        if (idResumenAbierto) modal.classList.remove("oculto");
    }

    function cerrarResumen() {
        idResumenAbierto = "";
        textoResumenDibujado = "";
        const modal = document.getElementById("modalResumenPreparacion");
        if (modal) modal.classList.add("oculto");
    }

    function dibujarResumen() {
        const cuerpo = document.getElementById("cuerpoResumenPreparacion");
        if (!cuerpo || !idResumenAbierto) return;

        const id = idResumenAbierto;
        const pedido = buscarPedido(id);
        const abierto = !document.getElementById("modalResumenPreparacion").classList.contains("oculto");

        if (!pedido || estadoActualDelPedido(pedido) !== "enPreparacion") {
            cerrarResumen();
            if (abierto) mostrarAviso("El pedido cambió", "Otra persona cambió el estado del pedido mientras confirmabas. Revisá la ficha.");
            return;
        }

        const preparacion = preparacionDe(pedido);
        if (!preparacion.completa) {
            cerrarResumen();
            if (abierto) mostrarAviso("La checklist cambió", "Mientras confirmabas, alguien destildó un producto. Revisá la checklist y probá de nuevo.");
            return;
        }

        // Solo se redibuja si cambió lo que muestra (así no se corta un
        // deslizamiento a medias).
        const faltantes = preparacion.lineas.filter(linea => linea.faltante);
        const texto = JSON.stringify([
            pedido.comercio, preparacion.productos, preparacion.unidadesPedidas, preparacion.unidadesPreparadas,
            faltantes.map(linea => [linea.clave, linea.faltante.preparada, linea.faltante.observacion])
        ]);
        if (texto === textoResumenDibujado) return;
        textoResumenDibujado = texto;

        cuerpo.innerHTML = "";
        cuerpo.appendChild(crear("p", "explicacionTextoPedido", String(pedido.comercio || "SIN NOMBRE").trim() + ". Revisá que coincida con lo que armaste."));

        const numeros = crear("div", "numerosResumen");
        [
            [preparacion.productos, preparacion.productos === 1 ? "producto" : "productos", ""],
            [preparacion.unidadesPreparadas, preparacion.unidadesPreparadas === 1 ? "unidad" : "unidades", ""],
            [preparacion.faltantes, preparacion.faltantes === 1 ? "faltante" : "faltantes", preparacion.faltantes ? "conFaltantes" : ""]
        ].forEach(([valor, nombre, clase]) => {
            const numero = crear("div", "numeroResumen " + clase);
            numero.append(crear("strong", "", String(valor)), crear("span", "", nombre));
            numeros.appendChild(numero);
        });
        cuerpo.appendChild(numeros);

        if (preparacion.unidadesPreparadas !== preparacion.unidadesPedidas) {
            cuerpo.appendChild(crear("p", "pedidasResumen", "Se pidieron " + textoUnidades(preparacion.unidadesPedidas) + "."));
        }

        if (faltantes.length) {
            const lista = crear("ul", "faltantesResumen");
            faltantes.forEach(linea => {
                const item = crear("li", "");
                item.append(
                    crear("strong", "", String(linea.item.producto || "Sin producto") + ": " + linea.faltante.preparada + " de " + linea.cantidad),
                    crear("small", "", String(linea.faltante.observacion || ""))
                );
                lista.appendChild(item);
            });
            cuerpo.appendChild(lista);
        }

        cuerpo.appendChild(crearDeslizador("Deslizá para marcar Preparado", () => confirmarPreparado(id)));
    }

    function confirmarPreparado(id) {
        if (idResumenAbierto !== id) return;

        // Se cierra antes: el cambio de estado redibuja la ficha enseguida.
        cerrarResumen();
        try {
            window.nubeVendeFrio.marcarPreparado(id);
            mostrarToast("Pedido preparado");
            // Ticket (T28b): terminado de armar, pregunta si se imprime.
            window.impresionVendeFrio?.preguntarSiImprimir?.(id);
        } catch (error) {
            avisarError(error);
        }
    }

    // -------------------------------------------------
    // Entrega (T27)
    // -------------------------------------------------
    // "Entregado" lo marca cualquiera: se desliza desde la ficha, en
    // cualquier paso anterior a "Entregado" (T29b; antes, fuera de "En
    // reparto", "Entregar en el mostrador" abría la ventana de la entrega).
    // Por defecto se entrega todo lo preparado;
    // "Entregar con cambios" deja ajustar lo entregado de cada producto, con
    // motivo. Lo pedido y lo preparado se conservan.

    // Cobro (T28): si quien entrega tiene "Cobra", enseguida le pregunta
    // "¿Cómo pagó?".
    function avisarEntregado(resultado, id) {
        mostrarToast(resultado && resultado.cambios ? "Pedido entregado con cambios" : "Pedido entregado");
        if (navigator.vibrate) navigator.vibrate(30);
        if (id && puedeCobrar()) preguntarCobroTrasEntrega(id);
    }

    // El botón deslizable de la ficha: entrega todo lo preparado.
    function entregarSinCambios(id, estado) {
        if (!pedidoSigueEn(id, estado)) {
            mostrarAviso("El pedido cambió", "Otra persona lo cambió recién. Revisá el estado nuevo y probá de nuevo si hace falta.");
            return;
        }

        try {
            window.nubeVendeFrio.entregarPedido(id, {});
            avisarEntregado(null, id);
        } catch (error) {
            avisarError(error);
        }
    }

    // Si se entregó por error: vuelve al estado que tenía antes de la
    // entrega, con motivo. Sale de Historial y vuelve a "Pedidos".
    function volverDeEntregado(id) {
        const pedido = buscarPedido(id);
        if (!pedido || !puedeVolverDeEntregado(pedido)) return;

        const hacia = nombreDeEstadoPedido(window.nubeVendeFrio.estadoAntesDeLaEntrega(pedido));

        abrirModalTexto({
            titulo: "Volver un paso atrás",
            explicacion: "El pedido pasa de \u00abEntregado\u00bb a \u00ab" + hacia + "\u00bb: sale de Historial y vuelve a \u00abPedidos\u00bb. Queda en el seguimiento con tu nombre y el motivo.",
            etiqueta: "¿Por qué vuelve atrás?",
            falta: "el motivo",
            boton: "Volver a " + hacia,
            peligro: true,
            alConfirmar: motivo => {
                if (!pedidoSigueEn(id, "entregado")) {
                    mostrarAviso("El pedido cambió", "Otra persona lo cambió mientras escribías. Revisá el estado nuevo y probá de nuevo si hace falta.");
                    return;
                }

                try {
                    const estado = window.nubeVendeFrio.volverDeEntregado(id, motivo);
                    mostrarToast("Volvió a " + nombreDeEstadoPedido(estado));
                } catch (error) {
                    avisarError(error);
                }
            }
        });
    }

    // La ventana de la entrega: { id, estado, firma, conCambios, cantidades,
    // motivos }. cantidades y motivos van por id de línea. "firma" dice qué
    // productos y cantidades preparadas tenía el pedido al abrirla: si
    // cambian (por ejemplo, el autor lo editó), se cierra y avisa.
    let entregaAbierta = null;

    function firmaDeEntrega(entrega) {
        return JSON.stringify(entrega.lineas.map(linea => [linea.clave, linea.pedida, linea.preparada]));
    }

    // Los productos que se entregan distinto de lo preparado.
    function cambiosDeLaEntrega(entrega) {
        const cambios = {};
        if (!entregaAbierta || !entregaAbierta.conCambios) return cambios;

        entrega.lineas.forEach(linea => {
            const cantidad = entregaAbierta.cantidades[linea.clave];
            if (cantidad === undefined || cantidad === linea.preparada) return;
            cambios[linea.clave] = { entregada: cantidad, motivo: String(entregaAbierta.motivos[linea.clave] || "").trim() };
        });

        return cambios;
    }

    function crearModalEntrega() {
        let modal = document.getElementById("modalEntregaPedido");
        if (modal) return modal;

        modal = crear("div", "modal oculto");
        modal.id = "modalEntregaPedido";

        const contenido = crear("div", "modalContenido entregaPedido");
        contenido.setAttribute("role", "dialog");
        contenido.setAttribute("aria-modal", "true");
        contenido.setAttribute("aria-labelledby", "tituloEntregaPedido");

        const titulo = crear("h2", "", "Entregar pedido");
        titulo.id = "tituloEntregaPedido";

        const cuerpo = crear("div", "cuerpoEntregaPedido");
        cuerpo.id = "cuerpoEntregaPedido";

        const botones = crear("div", "modalBotones");
        const volver = crear("button", "btnModalCancelar", "Volver");
        volver.type = "button";
        botones.appendChild(volver);

        contenido.append(titulo, cuerpo, botones);
        modal.appendChild(contenido);
        document.body.appendChild(modal);

        volver.addEventListener("click", cerrarEntrega);
        modal.addEventListener("click", evento => {
            if (evento.target === modal) cerrarEntrega();
        });

        cuerpo.addEventListener("click", evento => {
            const boton = evento.target.closest("button[data-entrega]");
            if (!boton || !entregaAbierta) return;

            if (boton.dataset.entrega === "conCambios") {
                entregaAbierta.conCambios = !entregaAbierta.conCambios;
                entregaAbierta.error = "";
                dibujarEntrega();
                return;
            }

            const pedido = buscarPedido(entregaAbierta.id);
            const linea = pedido ? entregaDe(pedido)?.lineas.find(item => item.clave === boton.dataset.linea) : null;
            if (!linea) return;

            const actual = entregaAbierta.cantidades[linea.clave] ?? linea.preparada;
            const nueva = Math.min(linea.pedida, Math.max(0, actual + Number(boton.dataset.entrega)));
            entregaAbierta.cantidades[linea.clave] = nueva;
            entregaAbierta.error = "";
            dibujarEntrega();
        });

        // El motivo se escribe sin redibujar (no se pierde lo que se tipea).
        cuerpo.addEventListener("input", evento => {
            const campo = evento.target.closest("input[data-motivo]");
            if (!campo || !entregaAbierta) return;

            entregaAbierta.motivos[campo.dataset.motivo] = campo.value;
            campo.closest(".filaEntrega")?.classList.remove("sinMotivo");
            const error = document.getElementById("errorEntregaPedido");
            if (error) error.classList.add("oculto");
        });

        return modal;
    }

    function abrirEntrega(id, conCambios) {
        const pedido = buscarPedido(id);
        if (!pedido || !puedeEntregar(pedido)) return;

        const entrega = entregaDe(pedido);
        if (!entrega) return;

        entregaAbierta = {
            id,
            estado: estadoActualDelPedido(pedido),
            firma: firmaDeEntrega(entrega),
            conCambios: Boolean(conCambios),
            cantidades: {},
            motivos: {},
            error: ""
        };

        const modal = crearModalEntrega();
        dibujarEntrega();
        modal.classList.remove("oculto");

        const contenido = modal.querySelector(".modalContenido");
        if (contenido) contenido.scrollTop = 0;
    }

    function cerrarEntrega() {
        entregaAbierta = null;
        const modal = document.getElementById("modalEntregaPedido");
        if (modal) modal.classList.add("oculto");
    }

    // Con los cambios de otro celular: si el pedido ya no se puede entregar
    // o cambiaron sus productos, se cierra y avisa. Si no, sigue como está
    // (no se pierde lo que se está escribiendo).
    function revisarEntrega() {
        const pedido = buscarPedido(entregaAbierta.id);
        const entrega = pedido ? entregaDe(pedido) : null;

        if (!pedido || !entrega || !puedeEntregar(pedido) || estadoActualDelPedido(pedido) !== entregaAbierta.estado) {
            cerrarEntrega();
            mostrarAviso("El pedido cambió", "Otra persona cambió el estado del pedido mientras lo entregabas. Revisá la ficha.");
            return;
        }

        if (firmaDeEntrega(entrega) !== entregaAbierta.firma) {
            cerrarEntrega();
            mostrarAviso("El pedido cambió", "Mientras lo entregabas cambiaron sus productos. Revisá la ficha y probá de nuevo.");
        }
    }

    function crearFilaEntrega(linea, conCambios) {
        const fila = crear("div", "filaEntrega");
        fila.dataset.clave = linea.clave;
        if (linea.cambio) fila.classList.add("conCambio");

        const textos = crear("div", "textoFilaEntrega");
        const nombre = String(linea.item.producto || "Sin producto");
        textos.appendChild(crear("strong", "", nombre));

        const detalles = [];
        if (linea.preparada !== linea.pedida) detalles.push("Se prepararon " + linea.preparada + " de " + linea.pedida);
        if (linea.cambio) detalles.push("Antes: " + linea.preparada);
        if (detalles.length) textos.appendChild(crear("small", "", detalles.join("  ·  ")));

        const arriba = crear("div", "filaEntregaArriba");
        arriba.appendChild(textos);

        if (conCambios) {
            const contador = crear("div", "contadorEntrega");
            const menos = crear("button", "pasoContadorEntrega", "−");
            menos.type = "button";
            menos.dataset.entrega = "-1";
            menos.dataset.linea = linea.clave;
            menos.setAttribute("aria-label", "Una menos de " + nombre);
            const mas = crear("button", "pasoContadorEntrega", "+");
            mas.type = "button";
            mas.dataset.entrega = "1";
            mas.dataset.linea = linea.clave;
            mas.setAttribute("aria-label", "Una más de " + nombre);
            contador.append(menos, crear("span", "cantidadEntrega", String(linea.entregada)), mas);
            arriba.appendChild(contador);
        } else {
            arriba.appendChild(crear("span", "cantidadEntrega", "x" + linea.entregada));
        }

        fila.appendChild(arriba);

        if (conCambios && linea.cambio) {
            const campo = document.createElement("input");
            campo.type = "text";
            campo.className = "motivoEntrega";
            campo.dataset.motivo = linea.clave;
            campo.maxLength = LARGO_MAXIMO_MOTIVO;
            campo.placeholder = "Motivo (por ejemplo: rechazó 2)";
            campo.setAttribute("aria-label", "Motivo del cambio de " + nombre);
            campo.value = String(entregaAbierta.motivos[linea.clave] || "");
            fila.appendChild(campo);
        }

        return fila;
    }

    function dibujarEntrega() {
        const cuerpo = document.getElementById("cuerpoEntregaPedido");
        if (!cuerpo || !entregaAbierta) return;

        const pedido = buscarPedido(entregaAbierta.id);
        if (!pedido) {
            cerrarEntrega();
            return;
        }

        const entrega = entregaDe(pedido, cambiosDeLaEntrega(entregaDe(pedido)));
        const conCambios = entregaAbierta.conCambios;
        cuerpo.innerHTML = "";

        cuerpo.appendChild(crear(
            "p",
            "explicacionTextoPedido",
            String(pedido.comercio || "SIN NOMBRE").trim() + ". " + (conCambios
                ? "Ajustá lo entregado de cada producto. Cada cambio pide un motivo; lo pedido y lo preparado se conservan."
                : "Se entrega todo lo preparado. Si el comercio no recibió algo, tocá \u00abEntregar con cambios\u00bb.")
        ));

        const numeros = crear("div", "numerosResumen");
        [
            [String(entrega.lineas.length), entrega.lineas.length === 1 ? "producto" : "productos", ""],
            [String(entrega.unidadesEntregadas), entrega.unidadesEntregadas === 1 ? "unidad" : "unidades", ""],
            [String(entrega.cambios), entrega.cambios === 1 ? "cambio" : "cambios", entrega.cambios ? "conFaltantes" : ""]
        ].forEach(([valor, nombre, clase]) => {
            const numero = crear("div", "numeroResumen " + clase);
            numero.append(crear("strong", "", valor), crear("span", "", nombre));
            numeros.appendChild(numero);
        });
        cuerpo.appendChild(numeros);

        const total = crear("div", "totalFichaPedido totalEntrega");
        total.append(crear("span", "", "Total a cobrar"), crear("strong", "", textoMonto(entrega.total)));
        cuerpo.appendChild(total);

        // Agrupados por marca, en el orden en que se cargaron.
        const lista = crear("div", "listaEntrega");
        let marcaAnterior = null;
        entrega.lineas.forEach(linea => {
            const marca = String(linea.item.marca || "Sin marca").trim() || "Sin marca";
            if (marca !== marcaAnterior) {
                lista.appendChild(crear("p", "marcaFichaPedido", marca));
                marcaAnterior = marca;
            }
            lista.appendChild(crearFilaEntrega(linea, conCambios));
        });
        cuerpo.appendChild(lista);

        const alternar = crear(
            "button",
            "btnAccion secundario alternarEntrega",
            conCambios ? "Sin cambios: entregar todo lo preparado" : "Entregar con cambios"
        );
        alternar.type = "button";
        alternar.dataset.entrega = "conCambios";
        cuerpo.appendChild(alternar);

        const error = crear("p", "errorTextoPedido" + (entregaAbierta.error ? "" : " oculto"), entregaAbierta.error || "");
        error.id = "errorEntregaPedido";
        error.setAttribute("role", "alert");
        cuerpo.appendChild(error);

        cuerpo.appendChild(crearDeslizador(
            entrega.cambios ? "Deslizá para entregar con cambios" : "Deslizá para marcar Entregado",
            confirmarEntrega
        ));
    }

    function confirmarEntrega() {
        if (!entregaAbierta) return;

        const { id, estado } = entregaAbierta;
        const pedido = buscarPedido(id);
        if (!pedido || !pedidoSigueEn(id, estado)) {
            cerrarEntrega();
            mostrarAviso("El pedido cambió", "Otra persona lo cambió recién. Revisá el estado nuevo y probá de nuevo si hace falta.");
            return;
        }

        const cambios = cambiosDeLaEntrega(entregaDe(pedido));
        const sinMotivo = Object.keys(cambios).filter(clave => !cambios[clave].motivo);
        if (sinMotivo.length) {
            entregaAbierta.error = sinMotivo.length === 1
                ? "Escribí el motivo del cambio para seguir."
                : "Escribí el motivo de cada cambio para seguir.";
            dibujarEntrega();
            sinMotivo.forEach(clave => {
                document.querySelector('#cuerpoEntregaPedido .filaEntrega[data-clave="' + clave.replace(/["\\]/g, "") + '"]')?.classList.add("sinMotivo");
            });
            document.querySelector('#cuerpoEntregaPedido input[data-motivo="' + sinMotivo[0].replace(/["\\]/g, "") + '"]')?.focus();
            return;
        }

        try {
            window.nubeVendeFrio.entregarPedido(id, cambios);
            cerrarEntrega();
            avisarEntregado({ cambios: Object.keys(cambios).length }, id);
        } catch (error) {
            entregaAbierta.error = error && error.code === "pedido" ? error.message : "No se pudo entregar. Probá de nuevo en unos segundos.";
            console.error("No se pudo entregar el pedido.", error);
            dibujarEntrega();
        }
    }

    // -------------------------------------------------
    // Cobro (T28)
    // -------------------------------------------------
    // "¿Cómo pagó?": "Efectivo", "Transferencia" (con foto opcional del
    // comprobante) o "Todavía no pagó". El monto viene escrito con el total
    // a cobrar y se puede corregir. Solo quien tiene "Cobra" (y el dueño): al
    // entregar, si quien entrega lo tiene, o después desde la ficha
    // ("Registrar cobro" o "Corregir cobro"). Si después de entregar queda
    // pendiente (o se cierra la pregunta), avisa a los demás de "Cobra".

    // La ventana del cobro: { id, forma, monto, foto, quitarFoto,
    // trasEntrega, firma, error, procesando }. "firma" es el cobro que tenía
    // el pedido al abrirla: si otro lo cambia, se cierra y avisa.
    let cobroAbierto = null;
    // Recién entregado: se abre cuando el pedido ya figura como entregado.
    let cobroPorAbrir = "";
    let esperaCobroPorAbrir = 0;

    // Lado más largo de la foto del comprobante y tamaño máximo (en letras;
    // las reglas aceptan hasta 700.000).
    const LADO_MAXIMO_FOTO = 1280;
    const LARGO_BUSCADO_FOTO = 600000;

    function firmaDeCobro(pedido) {
        return JSON.stringify(cobroDe(pedido));
    }

    // "12.500,50", "12500.5" o "$ 12.500" -> 12500.5. NaN si no es un monto.
    function leerMonto(texto) {
        let limpio = String(texto || "").replace(/[$\s]/g, "");
        if (!limpio) return NaN;

        if (limpio.includes(",")) {
            limpio = limpio.replace(/\./g, "").replace(",", ".");
        } else if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) {
            limpio = limpio.replace(/\./g, "");
        }

        return /^\d+(\.\d{1,2})?$/.test(limpio) ? Number(limpio) : NaN;
    }

    // 12500.5 -> "12500,5" (para escribirlo en el campo).
    function montoParaEscribir(valor) {
        const numero = Math.round((Number(valor) || 0) * 100) / 100;
        return String(numero).replace(".", ",");
    }

    function crearModalCobro() {
        let modal = document.getElementById("modalCobroPedido");
        if (modal) return modal;

        modal = crear("div", "modal oculto");
        modal.id = "modalCobroPedido";

        const contenido = crear("div", "modalContenido cobroPedido");
        contenido.setAttribute("role", "dialog");
        contenido.setAttribute("aria-modal", "true");
        contenido.setAttribute("aria-labelledby", "tituloCobroPedido");

        const titulo = crear("h2", "", "¿Cómo pagó?");
        titulo.id = "tituloCobroPedido";

        const cuerpo = crear("div", "cuerpoCobroPedido");
        cuerpo.id = "cuerpoCobroPedido";

        // Para sacar la foto o elegirla de la galería.
        const archivo = document.createElement("input");
        archivo.type = "file";
        archivo.accept = "image/*";
        archivo.id = "archivoComprobantePedido";
        archivo.className = "oculto";
        archivo.setAttribute("aria-hidden", "true");
        archivo.tabIndex = -1;

        const botones = crear("div", "modalBotones");
        const volver = crear("button", "btnModalCancelar", "Volver");
        volver.type = "button";
        const guardar = crear("button", "btnModalConfirmar", "Guardar cobro");
        guardar.type = "button";
        guardar.id = "guardarCobroPedido";
        botones.append(volver, guardar);

        contenido.append(titulo, cuerpo, archivo, botones);
        modal.appendChild(contenido);
        document.body.appendChild(modal);

        volver.addEventListener("click", () => cerrarCobro(true));
        modal.addEventListener("click", evento => {
            if (evento.target === modal) cerrarCobro(true);
        });
        guardar.addEventListener("click", guardarCobro);

        cuerpo.addEventListener("click", evento => {
            const boton = evento.target.closest("button[data-cobro]");
            if (!boton || !cobroAbierto) return;

            const accion = boton.dataset.cobro;
            if (accion === "foto") {
                archivo.value = "";
                archivo.click();
                return;
            }
            if (accion === "quitarFoto") {
                cobroAbierto.foto = null;
                cobroAbierto.quitarFoto = true;
            } else {
                cobroAbierto.forma = accion;
            }
            cobroAbierto.error = "";
            dibujarCobro();
        });

        // El monto se escribe sin redibujar (no se pierde lo que se tipea).
        cuerpo.addEventListener("input", evento => {
            if (evento.target.id !== "montoCobroPedido" || !cobroAbierto) return;
            cobroAbierto.monto = evento.target.value;
            const error = document.getElementById("errorCobroPedido");
            if (error) error.classList.add("oculto");
        });

        archivo.addEventListener("change", () => {
            const elegido = archivo.files && archivo.files[0];
            if (!elegido || !cobroAbierto) return;

            const abierto = cobroAbierto;
            abierto.procesando = true;
            abierto.error = "";
            dibujarCobro();

            comprimirFoto(elegido)
                .then(foto => {
                    if (cobroAbierto !== abierto) return;
                    abierto.foto = foto;
                    abierto.quitarFoto = false;
                })
                .catch(error => {
                    console.warn("No se pudo preparar la foto.", error);
                    if (cobroAbierto === abierto) abierto.error = "No se pudo usar esa foto. Probá con otra.";
                })
                .finally(() => {
                    if (cobroAbierto !== abierto) return;
                    abierto.procesando = false;
                    dibujarCobro();
                });
        });

        return modal;
    }

    // Después de entregar: se abre apenas el pedido figura como entregado
    // (enseguida, también sin señal).
    function preguntarCobroTrasEntrega(id) {
        cobroPorAbrir = id;
        clearTimeout(esperaCobroPorAbrir);
        esperaCobroPorAbrir = setTimeout(() => {
            cobroPorAbrir = "";
        }, 5000);
        abrirCobroPendienteDeAbrir();
    }

    function abrirCobroPendienteDeAbrir() {
        const id = cobroPorAbrir;
        const pedido = id ? buscarPedido(id) : null;
        if (!pedido || !puedeRegistrarCobro(pedido)) return;

        cobroPorAbrir = "";
        clearTimeout(esperaCobroPorAbrir);
        abrirCobro(id, true);
    }

    function abrirCobro(id, trasEntrega) {
        const pedido = buscarPedido(id);
        if (!pedido || !puedeRegistrarCobro(pedido)) return;

        const cobro = cobroDe(pedido);
        const monto = cobro ? cobro.monto : window.nubeVendeFrio.montoACobrar(pedido);

        cobroAbierto = {
            id,
            forma: cobro ? cobro.forma : "",
            monto: montoParaEscribir(monto),
            foto: null,
            quitarFoto: false,
            trasEntrega: Boolean(trasEntrega),
            firma: firmaDeCobro(pedido),
            error: "",
            procesando: false
        };

        const modal = crearModalCobro();
        dibujarCobro();
        modal.classList.remove("oculto");

        const contenido = modal.querySelector(".modalContenido");
        if (contenido) contenido.scrollTop = 0;
    }

    // avisar: se cerró sin guardar ("Volver" o tocando afuera). Si se acaba
    // de entregar, el cobro queda pendiente y se avisa a "Cobra".
    function cerrarCobro(avisar) {
        const abierto = cobroAbierto;
        cobroAbierto = null;
        const modal = document.getElementById("modalCobroPedido");
        if (modal) modal.classList.add("oculto");

        if (avisar === true && abierto && abierto.trasEntrega) dejarCobroPendiente(abierto.id);
    }

    function dejarCobroPendiente(id) {
        try {
            if (window.nubeVendeFrio.avisarCobroPendiente(id)) mostrarToast("Cobro pendiente: queda en «A cobrar»");
        } catch (error) {
            console.warn("No se pudo avisar el cobro pendiente.", error);
        }
    }

    // Con los cambios de otro celular: si el pedido ya no está entregado o
    // otra persona registró el cobro, se cierra y avisa.
    function revisarCobro() {
        const pedido = buscarPedido(cobroAbierto.id);

        if (!pedido || !puedeRegistrarCobro(pedido)) {
            cerrarCobro(false);
            mostrarAviso("El pedido cambió", "El pedido ya no está entregado o ya no podés registrar su cobro. Revisá la ficha.");
            return;
        }

        if (firmaDeCobro(pedido) !== cobroAbierto.firma) {
            cerrarCobro(false);
            mostrarAviso("El cobro cambió", "Otra persona registró o corrigió el cobro de este pedido. Revisá la ficha.");
        }
    }

    function dibujarCobro() {
        const cuerpo = document.getElementById("cuerpoCobroPedido");
        if (!cuerpo || !cobroAbierto) return;

        const pedido = buscarPedido(cobroAbierto.id);
        if (!pedido) {
            cerrarCobro(false);
            return;
        }

        const anterior = cobroDe(pedido);
        const entrega = entregaDe(pedido);
        const forma = cobroAbierto.forma;
        cuerpo.innerHTML = "";

        cuerpo.appendChild(crear(
            "p",
            "explicacionTextoPedido",
            String(pedido.comercio || "SIN NOMBRE").trim() + ". " + (anterior
                ? "Ahora: " + textoCobro(anterior) + ". Elegí cómo quedó."
                : "Elegí cómo pagó. Si todavía no pagó, queda en «A cobrar».")
        ));

        if (entrega) {
            const total = crear("div", "totalFichaPedido totalEntrega");
            total.append(crear("span", "", "Total a cobrar"), crear("strong", "", textoMonto(entrega.total)));
            cuerpo.appendChild(total);
        }

        const opciones = crear("div", "opcionesCobro");
        opciones.setAttribute("role", "group");
        opciones.setAttribute("aria-label", "Cómo pagó");
        [
            ["efectivo", "Efectivo"],
            ["transferencia", "Transferencia"],
            ["pendiente", "Todavía no pagó"]
        ].forEach(([id, nombre]) => {
            const boton = crear("button", "opcionCobro", nombre);
            boton.type = "button";
            boton.dataset.cobro = id;
            boton.setAttribute("aria-pressed", forma === id ? "true" : "false");
            if (forma === id) boton.classList.add("activa");
            opciones.appendChild(boton);
        });
        cuerpo.appendChild(opciones);

        if (forma === "efectivo" || forma === "transferencia") {
            const etiqueta = crear("label", "etiquetaCobro", "Monto que pagó");
            etiqueta.htmlFor = "montoCobroPedido";
            const campo = document.createElement("input");
            campo.id = "montoCobroPedido";
            campo.type = "text";
            campo.inputMode = "decimal";
            campo.autocomplete = "off";
            campo.className = "montoCobro";
            campo.value = cobroAbierto.monto;
            const ayuda = crear("small", "ayudaCobro", entrega && entrega.total.sinPrecio
                ? "Hay productos sin precio: revisá el monto."
                : "Viene escrito el total a cobrar. Si pagó otro monto, corregilo.");
            cuerpo.append(etiqueta, campo, ayuda);
        }

        if (forma === "transferencia") {
            const foto = crear("div", "fotoCobro");
            foto.appendChild(crear("span", "etiquetaCobro", "Foto del comprobante (opcional)"));

            const conFotoVieja = anterior && anterior.forma === "transferencia" && anterior.comprobante && !cobroAbierto.quitarFoto;
            if (cobroAbierto.procesando) {
                foto.appendChild(crear("small", "ayudaCobro", "Preparando la foto..."));
            } else if (cobroAbierto.foto) {
                const imagen = document.createElement("img");
                imagen.className = "vistaFotoCobro";
                imagen.alt = "Foto del comprobante";
                imagen.src = cobroAbierto.foto;
                foto.appendChild(imagen);
            } else if (conFotoVieja) {
                foto.appendChild(crear("small", "ayudaCobro", "Ya tiene una foto. Si sacás otra, reemplaza a la anterior."));
            }

            const acciones = crear("div", "accionesFotoCobro");
            const elegir = crear("button", "btnAccion secundario", cobroAbierto.foto || conFotoVieja ? "Cambiar foto" : "Sacar o elegir foto");
            elegir.type = "button";
            elegir.dataset.cobro = "foto";
            if (cobroAbierto.procesando) elegir.disabled = true;
            acciones.appendChild(elegir);
            if (cobroAbierto.foto || conFotoVieja) {
                const quitar = crear("button", "btnAccion secundario peligroPedido", "Quitar foto");
                quitar.type = "button";
                quitar.dataset.cobro = "quitarFoto";
                acciones.appendChild(quitar);
            }
            foto.appendChild(acciones);
            cuerpo.appendChild(foto);

            // Alias y QR de la distribuidora (T77): se le muestran al comercio.
            const cobrarQr = window.cobrarQrVendeFrio;
            if (cobrarQr && cobrarQr.hay()) {
                const mostrar = crear("button", "btnAccion secundario mostrarAliasCobro", "Mostrar alias y QR");
                mostrar.type = "button";
                mostrar.id = "mostrarAliasCobro";
                mostrar.addEventListener("click", () => {
                    if (!cobroAbierto) return;
                    const abierto = cobroAbierto;
                    cobrarQr.mostrar({
                        comercio: String(pedido.comercio || ""),
                        monto: leerMonto(abierto.monto),
                        alConfirmar: () => {
                            if (cobroAbierto !== abierto) return;
                            abierto.forma = "transferencia";
                            guardarCobro();
                        }
                    });
                });
                cuerpo.appendChild(mostrar);
            }
        }

        if (forma === "pendiente") {
            cuerpo.appendChild(crear("small", "ayudaCobro ayudaCobroPendiente", anterior
                ? "El cobro vuelve a quedar pendiente y el pedido vuelve a «A cobrar»."
                : "Queda «Cobro pendiente» y el pedido aparece en «A cobrar»."));
        }

        const error = crear("p", "errorTextoPedido" + (cobroAbierto.error ? "" : " oculto"), cobroAbierto.error || "");
        error.id = "errorCobroPedido";
        error.setAttribute("role", "alert");
        cuerpo.appendChild(error);

        const guardar = document.getElementById("guardarCobroPedido");
        if (guardar) {
            guardar.textContent = forma === "pendiente" ? "Dejar pendiente" : "Guardar cobro";
            guardar.disabled = cobroAbierto.procesando;
        }
    }

    function mostrarErrorCobro(texto) {
        if (!cobroAbierto) return;
        cobroAbierto.error = texto;
        dibujarCobro();
        if (texto.includes("monto")) document.getElementById("montoCobroPedido")?.focus();
    }

    function guardarCobro() {
        if (!cobroAbierto || cobroAbierto.procesando) return;

        const { id, forma, trasEntrega } = cobroAbierto;
        if (!forma) {
            mostrarErrorCobro("Elegí cómo pagó: efectivo, transferencia o todavía no pagó.");
            return;
        }

        const pedido = buscarPedido(id);
        if (!pedido || !puedeRegistrarCobro(pedido) || firmaDeCobro(pedido) !== cobroAbierto.firma) {
            cerrarCobro(false);
            mostrarAviso("El pedido cambió", "Otra persona lo cambió recién. Revisá la ficha y probá de nuevo si hace falta.");
            return;
        }

        const datos = { forma };
        if (forma !== "pendiente") {
            const monto = leerMonto(cobroAbierto.monto);
            if (!Number.isFinite(monto)) {
                mostrarErrorCobro("Escribí el monto que pagó, por ejemplo 12500 o 12.500,50.");
                return;
            }
            datos.monto = monto;
            if (forma === "transferencia") {
                datos.foto = cobroAbierto.foto || "";
                datos.quitarFoto = cobroAbierto.quitarFoto;
            }
        }

        try {
            const cobro = window.nubeVendeFrio.registrarCobro(id, datos);
            cerrarCobro(false);

            if (cobro) {
                mostrarToast("Cobro registrado: " + textoCobro(cobro));
                if (navigator.vibrate) navigator.vibrate(30);
            } else if (trasEntrega) {
                dejarCobroPendiente(id);
            } else {
                mostrarToast("Cobro pendiente: queda en «A cobrar»");
            }
        } catch (error) {
            console.error("No se pudo registrar el cobro.", error);
            mostrarErrorCobro(error && error.code === "pedido" ? error.message : "No se pudo guardar el cobro. Probá de nuevo en unos segundos.");
        }
    }

    // Achica la foto en el celular (lado más largo de 1280 px, JPEG) hasta
    // que entre en el documento. Devuelve "data:image/jpeg;base64,...".
    function cargarImagen(archivo) {
        return new Promise((resolver, rechazar) => {
            const url = URL.createObjectURL(archivo);
            const imagen = new Image();
            imagen.onload = () => {
                URL.revokeObjectURL(url);
                resolver(imagen);
            };
            imagen.onerror = () => {
                URL.revokeObjectURL(url);
                rechazar(new Error("No se pudo leer la imagen."));
            };
            imagen.src = url;
        });
    }

    async function comprimirFoto(archivo) {
        if (!archivo || !/^image\//.test(archivo.type || "image/")) throw new Error("No es una imagen.");

        const imagen = await cargarImagen(archivo);
        const ancho = imagen.naturalWidth || imagen.width;
        const alto = imagen.naturalHeight || imagen.height;
        if (!ancho || !alto) throw new Error("La imagen está vacía.");

        const maximo = window.nubeVendeFrio?.LARGO_MAXIMO_FOTO || 700000;
        const lienzo = document.createElement("canvas");
        const contexto = lienzo.getContext("2d");

        for (const lado of [LADO_MAXIMO_FOTO, 1024, 800, 640]) {
            const escala = Math.min(1, lado / Math.max(ancho, alto));
            lienzo.width = Math.max(1, Math.round(ancho * escala));
            lienzo.height = Math.max(1, Math.round(alto * escala));
            // Fondo blanco: una imagen con transparencia no queda negra.
            contexto.fillStyle = "#fff";
            contexto.fillRect(0, 0, lienzo.width, lienzo.height);
            contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);

            for (const calidad of [0.72, 0.6, 0.5, 0.4]) {
                const foto = lienzo.toDataURL("image/jpeg", calidad);
                if (foto.startsWith("data:image/jpeg") && foto.length <= LARGO_BUSCADO_FOTO) return foto;
            }
        }

        const ultima = lienzo.toDataURL("image/jpeg", 0.3);
        if (ultima.startsWith("data:image/jpeg") && ultima.length <= maximo) return ultima;
        throw new Error("La foto es demasiado grande.");
    }

    // Ver la foto del comprobante (desde cualquier celular).
    let idComprobanteAbierto = "";

    function crearModalComprobante() {
        let modal = document.getElementById("modalComprobantePedido");
        if (modal) return modal;

        modal = crear("div", "modal oculto");
        modal.id = "modalComprobantePedido";

        const contenido = crear("div", "modalContenido comprobantePedido");
        contenido.setAttribute("role", "dialog");
        contenido.setAttribute("aria-modal", "true");
        contenido.setAttribute("aria-labelledby", "tituloComprobantePedido");

        const titulo = crear("h2", "", "Comprobante");
        titulo.id = "tituloComprobantePedido";
        const cuerpo = crear("div", "cuerpoComprobantePedido");
        cuerpo.id = "cuerpoComprobantePedido";

        const botones = crear("div", "modalBotones");
        const cerrar = crear("button", "btnModalSecundario", "Cerrar");
        cerrar.type = "button";
        botones.appendChild(cerrar);

        contenido.append(titulo, cuerpo, botones);
        modal.appendChild(contenido);
        document.body.appendChild(modal);

        cerrar.addEventListener("click", cerrarComprobante);
        modal.addEventListener("click", evento => {
            if (evento.target === modal) cerrarComprobante();
        });

        return modal;
    }

    function abrirComprobante(id) {
        const pedido = buscarPedido(id);
        const cobro = pedido ? cobroDe(pedido) : null;
        if (!cobro || !cobro.comprobante) return;

        const idComprobante = cobro.comprobante;
        idComprobanteAbierto = idComprobante;

        const modal = crearModalComprobante();
        const cuerpo = document.getElementById("cuerpoComprobantePedido");
        cuerpo.innerHTML = "";
        cuerpo.appendChild(crear("p", "explicacionTextoPedido", String(pedido.comercio || "SIN NOMBRE").trim() + ". " + textoCobro(cobro) + "."));
        const cargando = crear("p", "ayudaCobro", "Cargando la foto...");
        cuerpo.appendChild(cargando);
        modal.classList.remove("oculto");

        window.nubeVendeFrio.leerComprobante(idComprobante).then(registro => {
            if (idComprobanteAbierto !== idComprobante) return;

            if (!registro) {
                cargando.textContent = navigator.onLine
                    ? "La foto todavía no llegó a la nube: falta que suba desde el celular de quien cobró."
                    : "Sin internet no se puede traer la foto. Probá de nuevo con señal.";
                return;
            }

            const imagen = document.createElement("img");
            imagen.className = "fotoComprobante";
            imagen.alt = "Foto del comprobante de la transferencia";
            imagen.src = registro.foto;
            cargando.replaceWith(imagen);

            const quien = [registro.persona ? nombrePersona(registro.persona) : "", registro.horaCelular ? textoCuando(registro.horaCelular) : ""]
                .filter(Boolean).join("  ·  ");
            if (quien) cuerpo.appendChild(crear("small", "ayudaCobro", "Subida por " + quien));
            if (window.nubeVendeFrio.comprobanteSinSubir(idComprobante)) {
                cuerpo.appendChild(crear("small", "ayudaCobro ayudaCobroPendiente", "Todavía no subió a la nube: sube sola cuando haya señal."));
            }
        });
    }

    function cerrarComprobante() {
        idComprobanteAbierto = "";
        const modal = document.getElementById("modalComprobantePedido");
        if (modal) modal.classList.add("oculto");
    }

    // -------------------------------------------------
    // Redibujar solo
    // -------------------------------------------------

    function vistaVisible() {
        return vistaActual === "pedidos" && !pantalla.classList.contains("oculto");
    }

    function dibujar() {
        if (vistaVisible()) dibujarLista();
        if (idFichaAbierta) dibujarFicha();
        if (idResumenAbierto) dibujarResumen();
        if (entregaAbierta) revisarEntrega();
        if (cobroPorAbrir) abrirCobroPendienteDeAbrir();
        if (cobroAbierto) revisarCobro();
    }

    // Un pedido cargado en otro celular (o en este) aparece al instante.
    if (typeof escucharCambiosDatos === "function") {
        escucharCambiosDatos(aviso => {
            if (aviso && Array.isArray(aviso.colecciones) && aviso.colecciones.includes("historial")) dibujar();
        });
    }

    // "Pendiente de sincronizar" se va cuando la nube confirma el pedido.
    window.nubeVendeFrio?.escucharSincronizacion?.(() => dibujar());

    // Si el dueño cambia los permisos o los roles, los botones de la ficha
    // cambian al instante (T22).
    window.empleadosVendeFrio?.escucharPermisos?.(() => dibujar());

    // Ticket (T28b): "Imprimiendo…" mientras se manda a la impresora.
    window.impresionVendeFrio?.escuchar?.(() => dibujar());

    cambiarVista(pantalla.classList.contains("oculto") ? "nuevo" : "pedidos");

    // Avisos (T23): al tocar un aviso se abre la ficha de su pedido, desde
    // cualquier pantalla. Devuelve false si el pedido ya no está.
    window.seguimientoVendeFrio = {
        redibujarFicha: () => dibujarFicha(),
        pedidoAbierto: () => idFichaAbierta,
        // Inicio (T32): abre Pedidos en una etapa ("cargados", "enReparto"...).
        abrirEtapa(etapa) {
            if (!enLaNube() || !ETAPAS.some(item => item.id === etapa)) return false;
            etapaActual = etapa;
            if (idFichaAbierta) cerrarFicha();
            if (pantalla.classList.contains("oculto")) {
                entrarPorLaBarra = true;
                mostrarPantalla("pedido");
            } else {
                cambiarVista("pedidos");
            }
            window.scrollTo(0, 0);
            return true;
        },

        abrirPedido(id) {
            const pedido = enLaNube() ? buscarPedido(String(id || "")) : null;
            if (!pedido || pedido.eliminado === true || !estadoActualDelPedido(pedido)) return false;

            abrirFicha(String(id));
            return true;
        },

        // Historial (T27b): abre la sección Pedido en "Historial", con el
        // período, el comercio o el pedido pedidos. Es lo que abren "Pedidos
        // hoy", "Pedidos semana" y "Último pedido" de Inicio, "Historial" de
        // un comercio e "Ir a historial". Devuelve false en el modo personal.
        abrirHistorial({ periodo = "todos", comercio = "", idPedido = "" } = {}) {
            if (!enLaNube()) return false;

            etapaActual = "historial";
            comercioHistorial = String(comercio || "").trim();
            idPedidoHistorial = String(idPedido || "");
            // Como antes: el buscador muestra el comercio elegido.
            busquedaHistorial = comercioHistorial;
            periodoHistorial = ["hoy", "semana", "mes"].includes(periodo) ? periodo : "todos";
            if (idFichaAbierta) cerrarFicha();

            if (pantalla.classList.contains("oculto")) {
                entrarPorLaBarra = true;
                mostrarPantalla("pedido");
            } else {
                cambiarVista("pedidos");
                window.scrollTo(0, 0);
            }
            return true;
        }
    };
})();
