// =====================================================
// VendeFrío - seguimiento.js
// Pedidos y seguimiento (T21): la sección Pedido abre la lista "Pedidos",
// con filtros por etapa, un botón flotante para cargar uno nuevo y la ficha
// de cada pedido, con el
// seguimiento de sus estados. Solo en la nube (con cuenta o con código): el
// modo personal sigue igual. Solo ver: los cambios de estado llegan en T22.
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

    // Incidencias: las marca T22. Hasta entonces ningún pedido tiene una.
    function tieneIncidencia() {
        return false;
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

    function dibujarProductos(pedido) {
        const seccion = seccionFicha("Productos");
        const productos = (Array.isArray(pedido.productos) ? pedido.productos : [])
            .filter(item => item && typeof item === "object" && (Number(item.cantidad) || 0) > 0);

        if (productos.length === 0) {
            seccion.appendChild(crear("p", "subtitulo", "Este pedido no tiene productos."));
            return seccion;
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
    function dibujarSeguimiento(pedido) {
        const seccion = seccionFicha("Seguimiento");
        const entradas = Object.keys(pedido.estados || {})
            .map(id => ({ id, entrada: pedido.estados[id] }))
            .filter(item => item.entrada && typeof item.entrada === "object")
            .sort((a, b) => {
                const diferencia = (Number(b.entrada.horaCelular) || 0) - (Number(a.entrada.horaCelular) || 0);
                if (diferencia !== 0) return diferencia;
                return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
            });

        const linea = crear("ol", "lineaSeguimiento");

        entradas.forEach((item, indice) => {
            const entrada = item.entrada;
            const hora = Number(entrada.horaCelular) || 0;
            const paso = crear("li", indice === 0 ? "pasoSeguimiento actual" : "pasoSeguimiento");
            paso.dataset.estado = String(entrada.estado || "");

            paso.append(
                crear("strong", "", nombreDeEstadoPedido(entrada.estado) || String(entrada.estado || "Sin estado")),
                crear("small", "", [textoFecha(hora), textoHora(hora), nombrePersona(entrada.persona)].filter(Boolean).join("  ·  "))
            );

            const nota = String(entrada.nota || "").trim();
            if (nota) paso.appendChild(crear("p", "notaSeguimiento", nota));

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

        cuerpo.innerHTML = "";

        const titulo = crear("h2", "", String(pedido.comercio || "SIN NOMBRE").trim());
        titulo.id = "tituloFichaPedido";

        const etiquetas = crear("div", "etiquetasFichaPedido");
        etiquetas.appendChild(etiquetaEstado(estado));
        if (sinSubir(pedido)) etiquetas.appendChild(etiquetaSinSubir());

        const datos = crear("div", "datosFichaPedido");
        const hora = horaDelPedido(pedido);
        const productos = (Array.isArray(pedido.productos) ? pedido.productos : [])
            .filter(item => item && (Number(item.cantidad) || 0) > 0).length;

        [
            ["Cargado por", nombrePersona(pedido.autor)],
            ["Fecha", hora ? textoFecha(hora) + " " + textoHora(hora) : String(pedido.fecha || "Sin fecha")],
            ["Unidades", unidadesDelPedido(pedido) + "  ·  " + productos + (productos === 1 ? " producto" : " productos")]
        ].forEach(([nombre, valor]) => {
            const fila = crear("div", "datoFichaPedido");
            fila.append(crear("span", "", nombre), crear("strong", "", valor));
            datos.appendChild(fila);
        });

        cuerpo.append(titulo, etiquetas, datos, dibujarProductos(pedido));

        const observaciones = String(pedido.observaciones || "").trim();
        if (observaciones) {
            const seccion = seccionFicha("Observaciones");
            seccion.appendChild(crear("p", "observacionesFichaPedido", observaciones));
            cuerpo.appendChild(seccion);
        }

        cuerpo.appendChild(dibujarSeguimiento(pedido));
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
    }

    // Un pedido cargado en otro celular (o en este) aparece al instante.
    if (typeof escucharCambiosDatos === "function") {
        escucharCambiosDatos(aviso => {
            if (aviso && Array.isArray(aviso.colecciones) && aviso.colecciones.includes("historial")) dibujar();
        });
    }

    // "Pendiente de sincronizar" se va cuando la nube confirma el pedido.
    window.nubeVendeFrio?.escucharSincronizacion?.(() => dibujar());

    cambiarVista(pantalla.classList.contains("oculto") ? "nuevo" : "pedidos");
})();
