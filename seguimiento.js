// =====================================================
// VendeFrío - seguimiento.js
// Pedidos y seguimiento (T21): la sección Pedido abre la lista "Pedidos",
// con filtros por etapa, un botón flotante para cargar uno nuevo y la ficha
// de cada pedido, con el
// seguimiento de sus estados. Solo en la nube (con cuenta o con código): el
// modo personal sigue igual. Desde la ficha se cambia de estado, se vuelve un
// paso atrás y se marcan y resuelven incidencias, según los permisos de cada
// persona (T22). Los avisos abren la ficha de su pedido (T23). En "En
// preparación" la ficha muestra la checklist: cualquiera tilda, "Prepara
// pedidos" anota faltantes y marca "Preparado" con un resumen que se desliza
// para confirmar (T24). Quien cargó el pedido y el dueño lo editan desde la
// ficha; los demás ven una franja amarilla con lo que cambió, la checklist
// marca los productos a revisar y "Entendido" la cierra (T25). Quien cargó
// el pedido y el dueño lo eliminan (solo en "Cargado") o lo cancelan con
// motivo (antes de "Entregado"); el cancelado queda en "Cancelados" (T26).
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

    // Etapas de la vista. "En reparto" junta "Cargado en el vehículo" y "En
    // reparto". "Incidencias" se marca encima del estado (T17), así que un
    // pedido con incidencia también sigue en su etapa.
    const ETAPAS = [
        { id: "cargados", nombre: "Cargados", estados: ["cargado"] },
        { id: "enPreparacion", nombre: "En preparación", estados: ["enPreparacion"] },
        { id: "preparados", nombre: "Preparados", estados: ["preparado"] },
        { id: "enReparto", nombre: "En reparto", estados: ["enVehiculo", "enReparto"] },
        { id: "entregados", nombre: "Entregados", estados: ["entregado"] },
        { id: "incidencias", nombre: "Incidencias", estados: [] },
        { id: "cancelados", nombre: "Cancelados", estados: ["cancelado"] }
    ];

    // Con muchos pedidos (por ejemplo, Entregados) se dibujan de a tandas.
    const TANDA = 40;

    // Pasos que se hacen desde la ficha (T22), con el permiso que los deja
    // hacer. El mismo permiso vuelve el paso atrás, con motivo. "Controla
    // pedidos" y el dueño pueden todos. "Preparado" se marca con la
    // checklist completa y su resumen (T24). "Entregado" llega con la entrega
    // (T27): acá solo se vuelve atrás.
    const PASOS = [
        { desde: "cargado", hacia: "enPreparacion", permiso: "prepara", boton: "Empezar a preparar", hecho: "Pedido en preparación" },
        { desde: "enPreparacion", hacia: "preparado", permiso: "prepara", boton: "Marcar preparado", conChecklist: true },
        { desde: "preparado", hacia: "enVehiculo", permiso: "reparte", boton: "Cargar en el vehículo", hecho: "Pedido cargado en el vehículo" },
        { desde: "enVehiculo", hacia: "enReparto", permiso: "reparte", boton: "Salir a repartir", hecho: "Pedido en reparto" }
    ];

    const LARGO_MAXIMO_MOTIVO = 300;

    // Estados en los que el pedido ya pasó por la checklist (T24): la ficha
    // muestra sus faltantes.
    const ESTADOS_PREPARADOS = ["preparado", "enVehiculo", "enReparto", "entregado"];

    // Tilde de la casilla (dibujado acá para que se vea igual en todos lados).
    const SVG_TILDE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

    let vistaActual = "nuevo";
    let etapaActual = "cargados";
    let mostrando = TANDA;
    let idFichaAbierta = "";

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

    // El paso que sigue desde este estado, si esta persona lo puede hacer
    // desde la ficha.
    function pasoSiguiente(estado) {
        const paso = PASOS.find(item => item.desde === estado && item.boton);
        return paso && puede(paso.permiso) ? paso : null;
    }

    // El paso que se vuelve atrás desde este estado, si esta persona puede.
    function pasoAnterior(estado) {
        const paso = PASOS.find(item => item.hacia === estado);
        return paso && puede(paso.permiso) ? paso : null;
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

    function esDeLaEtapa(registro, etapa) {
        if (etapa.id === "incidencias") return tieneIncidencia(registro.pedido);
        return etapa.estados.includes(registro.estado);
    }

    function horaDelPedido(pedido) {
        const hora = Number(pedido && pedido.timestamp);
        return Number.isFinite(hora) && hora > 0 ? hora : 0;
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

    function textoTotal(pedido) {
        const { total, conPrecio, sinPrecio } = totalDelPedido(pedido);

        if (conPrecio && sinPrecio) return textoPrecio(total) + " (" + sinPrecio + " sin precio)";
        if (conPrecio) return textoPrecio(total);
        return "Sin precio";
    }

    function textoUnidades(cantidad) {
        return cantidad === 1 ? "1 unidad" : cantidad + " unidades";
    }

    function unidadesDelPedido(pedido) {
        const guardada = Number(pedido.cantidad);
        if (Number.isFinite(guardada) && guardada > 0) return guardada;

        return (Array.isArray(pedido.productos) ? pedido.productos : [])
            .reduce((total, item) => total + (Number(item && item.cantidad) || 0), 0);
    }

    function crear(tag, clase, texto) {
        const elemento = document.createElement(tag);
        if (clase) elemento.className = clase;
        if (texto !== undefined) elemento.textContent = texto;
        return elemento;
    }

    function etiquetaEstado(estado) {
        const etiqueta = crear("span", "estadoSeguimiento", nombreDeEstadoPedido(estado) || estado);
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
        botonNuevo.classList.toggle("oculto", !vistaVisible());
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

    function dibujarFiltros(registros) {
        filtros.innerHTML = "";

        ETAPAS.forEach(etapa => {
            const cantidad = registros.filter(registro => esDeLaEtapa(registro, etapa)).length;
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

    function crearTarjeta(registro) {
        const pedido = registro.pedido;
        const comercio = String(pedido.comercio || "SIN NOMBRE").trim();

        const tarjeta = crear("div", "card tarjetaSeguimiento");
        tarjeta.dataset.id = String(pedido.id || "");
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
            textoCuando(horaDelPedido(pedido)) + "  ·  " + textoUnidades(unidadesDelPedido(pedido)) + "  ·  " + textoTotal(pedido)
        );
        const autor = crear("p", "subtitulo autorSeguimiento", "Cargado por " + nombrePersona(pedido.autor));

        info.append(arriba, detalle, autor);

        // Checklist (T24): cuánto lleva armado y si hay faltantes.
        if (registro.estado === "enPreparacion" || ESTADOS_PREPARADOS.includes(registro.estado)) {
            const preparacion = preparacionDe(pedido);
            if (registro.estado === "enPreparacion") {
                info.append(crear("p", "subtitulo progresoTarjeta", "Checklist: " + preparacion.listos + " de " + preparacion.productos + " listos"));
            }
            if (preparacion.faltantes) info.append(crear("span", "badge faltanteSeguimiento", textoFaltantes(preparacion.faltantes)));
        }

        if (tieneIncidencia(pedido)) info.append(crear("span", "badge incidenciaSeguimiento", "Con incidencia"));
        if (edicionesSinVer(pedido).length) info.append(crear("span", "badge edicionSeguimiento", "Editado"));
        if (sinSubir(pedido)) info.append(etiquetaSinSubir());

        tarjeta.append(avatar, info);
        return tarjeta;
    }

    function dibujarLista() {
        const registros = pedidosDeTrabajo();
        const etapa = ETAPAS.find(item => item.id === etapaActual) || ETAPAS[0];
        const deLaEtapa = registros
            .filter(registro => esDeLaEtapa(registro, etapa))
            .sort((a, b) => horaDelPedido(b.pedido) - horaDelPedido(a.pedido));

        dibujarFiltros(registros);
        lista.innerHTML = "";

        const unidades = deLaEtapa.reduce((total, registro) => total + unidadesDelPedido(registro.pedido), 0);
        resumen.textContent = deLaEtapa.length === 1
            ? "1 pedido  ·  " + textoUnidades(unidades)
            : deLaEtapa.length + " pedidos  ·  " + textoUnidades(unidades);

        if (deLaEtapa.length === 0) {
            const vacio = crear("div", "card seguimientoVacio");
            vacio.append(
                crear("h3", "", "No hay pedidos " + etapa.nombre.toLowerCase()),
                crear("p", "", etapa.id === "incidencias"
                    ? "Acá van a aparecer los pedidos con algún problema."
                    : "Cuando un pedido llegue a esta etapa, aparece acá al instante.")
            );
            lista.appendChild(vacio);
            return;
        }

        deLaEtapa.slice(0, mostrando).forEach(registro => lista.appendChild(crearTarjeta(registro)));

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
        if (tarjeta) abrirFicha(tarjeta.dataset.id);
    });

    lista.addEventListener("keydown", evento => {
        if (evento.key !== "Enter" && evento.key !== " ") return;

        const tarjeta = evento.target.closest(".tarjetaSeguimiento");
        if (!tarjeta) return;

        evento.preventDefault();
        abrirFicha(tarjeta.dataset.id);
    });

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

        // Las ventanas de la checklist (T24) y la de editar (T25) son de
        // esta ficha.
        cerrarResumen();
        cerrarFaltante();
        cerrarConfirmacion();
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

                const subtotal = crear("span", "productoFichaSubtotal", Number.isFinite(precio) ? textoPrecio(precio * cantidad) : "—");
                fila.append(izquierda, subtotal);
                seccion.appendChild(fila);
            });
        });

        const total = crear("div", "totalFichaPedido");
        total.append(crear("span", "", "Total"), crear("strong", "", textoTotal(pedido)));
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

    function dibujarFicha() {
        const cuerpo = document.getElementById("cuerpoFichaPedido");
        if (!cuerpo || !idFichaAbierta) return;

        const pedido = buscarPedido(idFichaAbierta);
        const estado = pedido ? estadoActualDelPedido(pedido) : "";

        // Si el pedido ya no está (por ejemplo, lo eliminaron en otro
        // celular), se cierra la ficha.
        if (!pedido || !estado || pedido.eliminado === true) {
            cerrarFicha();
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

        // En preparación (T24) la ficha es la checklist: comercio, autor y
        // observaciones arriba, los productos con su casilla y, al final,
        // "Marcar preparado".
        const enChecklist = estado === "enPreparacion";

        const datos = crear("div", "datosFichaPedido");
        const hora = horaDelPedido(pedido);
        const productos = (Array.isArray(pedido.productos) ? pedido.productos : [])
            .filter(item => item && (Number(item.cantidad) || 0) > 0).length;

        const filasDatos = [
            ["Cargado por", nombrePersona(pedido.autor)],
            ["Fecha", hora ? textoFecha(hora) + " " + textoHora(hora) : String(pedido.fecha || "Sin fecha")],
            ["Unidades", unidadesDelPedido(pedido) + "  ·  " + productos + (productos === 1 ? " producto" : " productos")]
        ];
        if (enChecklist) filasDatos.push(["Total", textoTotal(pedido)]);

        filasDatos.forEach(([nombre, valor]) => {
            const fila = crear("div", "datoFichaPedido");
            fila.append(crear("span", "", nombre), crear("strong", "", valor));
            datos.appendChild(fila);
        });

        cuerpo.append(titulo, etiquetas);

        const incidencia = dibujarIncidencias(pedido);
        if (incidencia) cuerpo.appendChild(incidencia);

        const edicion = dibujarEdiciones(pedido);
        if (edicion) cuerpo.appendChild(edicion);

        const cancelacion = dibujarCancelacion(pedido, estado);
        if (cancelacion) cuerpo.appendChild(cancelacion);

        const acciones = dibujarAcciones(pedido, estado);
        if (acciones && !enChecklist) cuerpo.appendChild(acciones);

        cuerpo.append(datos);
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
        const siguiente = pasoSiguiente(estado);
        const anterior = pasoAnterior(estado);
        const marcar = estado !== "cancelado" && !tieneIncidencia(pedido);
        const editar = puedeEditar(pedido);
        const cancelar = puedeCancelar(pedido);
        const eliminar = puedeEliminar(pedido);

        // "Marcar preparado" (T24) se puede tocar solo con la checklist
        // completa; si no, dice qué falta. Quien no lo puede marcar ve quién
        // lo hace.
        const preparacion = estado === "enPreparacion" ? preparacionDe(pedido) : null;
        let pista = "";
        if (preparacion && siguiente && !preparacion.completa) pista = textoPendientes(preparacion.pendientes);
        else if (preparacion && !siguiente && preparacion.completa) pista = "Está todo listo: lo marca como preparado quien prepara pedidos.";

        if (!siguiente && !anterior && !marcar && !pista && !editar && !cancelar && !eliminar) return null;

        const acciones = crear("div", "accionesFichaPedido");

        if (siguiente) {
            const boton = crearBoton("btnAccion pasoSiguientePedido", siguiente.boton, "siguiente");
            boton.dataset.estado = siguiente.hacia;
            if (siguiente.conChecklist && !preparacion.completa) {
                boton.classList.add("incompleto");
                boton.setAttribute("aria-disabled", "true");
            }
            acciones.appendChild(boton);
        }

        if (pista) acciones.appendChild(crear("p", "pistaChecklist", pista));

        // Editar (T25): solo quien cargó el pedido y el dueño.
        if (editar) acciones.appendChild(crearBoton("btnAccion secundario botonEditarPedido", "Editar pedido", "editar"));

        const secundarias = crear("div", "accionesSecundariasPedido");
        if (anterior) secundarias.appendChild(crearBoton("btnAccion secundario", "Volver un paso atrás", "atras"));
        if (marcar) secundarias.appendChild(crearBoton("btnAccion secundario marcarIncidencia", "Marcar incidencia", "incidencia"));
        if (secundarias.children.length) acciones.appendChild(secundarias);

        // Cancelar y eliminar (T26): solo quien cargó el pedido y el dueño.
        const peligro = crear("div", "accionesSecundariasPedido");
        if (cancelar) peligro.appendChild(crearBoton("btnAccion secundario peligroPedido", "Cancelar pedido", "cancelar"));
        if (eliminar) peligro.appendChild(crearBoton("btnAccion secundario peligroPedido", "Eliminar pedido", "eliminar"));
        if (peligro.children.length) acciones.appendChild(peligro);

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

    function avanzar(id, estado) {
        const paso = pasoSiguiente(estado);
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
        const paso = pasoAnterior(estado);
        if (!paso) return;

        const desde = nombreDeEstadoPedido(estado);
        const hacia = nombreDeEstadoPedido(paso.desde);

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
                    window.nubeVendeFrio.agregarEstadoAlPedido(id, paso.desde, motivo);
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
            explicacion: "El pedido sigue en su estado y aparece también en \u00abIncidencias\u00bb hasta que la resuelva el dueño o quien controla pedidos.",
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
    function eliminarPedido(id, estado) {
        abrirConfirmacion({
            titulo: "Eliminar pedido",
            mensaje: "Es para errores, por ejemplo un pedido cargado dos veces. Desaparece de la app para todos. Si el comercio ya no lo quiere, mejor cancelalo.",
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

        if (boton.dataset.accion === "siguiente") avanzar(id, estado);
        else if (boton.dataset.accion === "atras") volverAtras(id, estado);
        else if (boton.dataset.accion === "incidencia") marcarIncidencia(id);
        else if (boton.dataset.accion === "resolver") resolverIncidencia(id);
        else if (boton.dataset.accion === "tildar") tocarProducto(id, boton.dataset.linea, boton);
        else if (boton.dataset.accion === "faltante") abrirFaltante(id, boton.dataset.linea);
        else if (boton.dataset.accion === "editar") window.abrirEdicionPedido?.(id);
        else if (boton.dataset.accion === "entendido") entendido(id);
        else if (boton.dataset.accion === "cancelar") cancelarPedido(id, estado);
        else if (boton.dataset.accion === "eliminar") eliminarPedido(id, estado);
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
        if (!pedido || estadoActualDelPedido(pedido) !== "enPreparacion") return null;
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
        } catch (error) {
            avisarError(error);
        }
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

    cambiarVista(pantalla.classList.contains("oculto") ? "nuevo" : "pedidos");

    // Avisos (T23): al tocar un aviso se abre la ficha de su pedido, desde
    // cualquier pantalla. Devuelve false si el pedido ya no está.
    window.seguimientoVendeFrio = {
        abrirPedido(id) {
            const pedido = enLaNube() ? buscarPedido(String(id || "")) : null;
            if (!pedido || pedido.eliminado === true || !estadoActualDelPedido(pedido)) return false;

            abrirFicha(String(id));
            return true;
        }
    };
})();
