// =====================================================
// VendeFrío - Pedido en hoja y pedido a medio hacer (repaso de Catálogo)
// =====================================================
// - abrir(): el Nuevo pedido sube como hoja encima de la pantalla donde se
//   está (Catálogo, la ficha del comercio). Se baja deslizando desde la
//   rayita, tocando arriba, con la X o con el atrás, y se sigue ahí.
// - El pedido que se va armando es uno solo para toda la app: el borrador de
//   siempre ("vendefrio_borrador_pedido"), guardado en el celular.
// - La barrita "Pedido nuevo · Ver pedido" se ve arriba de la barra de abajo
//   en todas las pantallas (menos Más) mientras ese pedido tenga productos.
// - Si se empieza un pedido para un comercio con otro a medio hacer, se
//   pregunta si seguir con ese o empezar uno nuevo.
(function () {
    const BORRADOR = "vendefrio_borrador_pedido";
    const PENDIENTE = "vendefrio_producto_catalogo_pendiente";
    let abierta = false;
    let fondo = null;
    let barra = null;

    const seccion = () => document.getElementById("pantallaPedido");
    const normal = texto => typeof normalizarTexto === "function" ? normalizarTexto(texto) : String(texto || "").trim().toLowerCase();

    function leerBorrador() {
        try {
            const datos = JSON.parse(localStorage.getItem(BORRADOR) || "null");
            if (!datos || typeof datos !== "object") return null;
            datos.cantidades = Array.isArray(datos.cantidades) ? datos.cantidades.filter(item => Number(item.cantidad) > 0) : [];
            return datos;
        } catch (error) {
            return null;
        }
    }

    // Cuánto lleva el pedido a medio hacer: productos, unidades y plata.
    function resumen() {
        const datos = leerBorrador();
        if (!datos || !datos.cantidades.length) return null;
        const productos = typeof productosParaLeer === "function" ? productosParaLeer() : {};
        let unidades = 0;
        let total = 0;
        datos.cantidades.forEach(item => {
            const cantidad = Number(item.cantidad) || 0;
            unidades += cantidad;
            const lista = Object.entries(productos).find(([marca]) => normal(marca) === normal(item.marca));
            const producto = lista && (lista[1] || []).find(p => normal(p && p.nombre) === normal(item.producto));
            total += cantidad * (Number(producto && producto.precio) || 0);
        });
        return { cliente: String(datos.cliente || ""), productos: datos.cantidades.length, unidades, total };
    }

    // Cuántas unidades de un producto hay en el pedido a medio hacer (Catálogo).
    function cantidadDe(marca, producto) {
        const datos = leerBorrador();
        const item = datos && datos.cantidades.find(i => normal(i.marca) === normal(marca) && normal(i.producto) === normal(producto));
        return item ? Number(item.cantidad) || 0 : 0;
    }

    // Suma uno sin abrir la hoja (con el pedido ya empezado).
    function sumar(marca, producto) {
        const datos = leerBorrador() || { cliente: "", observaciones: "", cantidades: [] };
        const item = datos.cantidades.find(i => normal(i.marca) === normal(marca) && normal(i.producto) === normal(producto));
        if (item) item.cantidad = Math.min(40, (Number(item.cantidad) || 0) + 1);
        else datos.cantidades.push({ marca, producto, cantidad: 1 });
        try {
            localStorage.setItem(BORRADOR, JSON.stringify(datos));
        } catch (error) {
            return false;
        }
        actualizarBarra();
        return true;
    }

    function crearFondo() {
        if (fondo) return;
        fondo = document.createElement("div");
        fondo.id = "fondoPedidoEnHoja";
        fondo.className = "fondoPedidoNavegacion fondoPedidoEnHoja oculto";
        fondo.addEventListener("click", cerrar);
        document.body.appendChild(fondo);
    }

    function ponerX() {
        const s = seccion();
        const cabeza = s && s.querySelector(":scope > header");
        if (!cabeza) return;
        let x = cabeza.querySelector(".cerrarPedidoEncima");
        if (!x) {
            // La misma X que la del pedido en la navegación (T179).
            x = document.createElement("button");
            x.type = "button";
            x.className = "cerrarPedidoEncima";
            x.setAttribute("aria-label", "Cerrar el pedido");
            x.innerHTML = window.icono ? window.icono("cerrarX", 22) : "×";
            cabeza.appendChild(x);
        }
        if (!x.dataset.enHoja) {
            x.dataset.enHoja = "1";
            x.addEventListener("click", () => { if (abierta) cerrar(); });
        }
    }

    // abrir({ comercio, producto: { marca, producto } })
    function abrir(opciones = {}) {
        const s = seccion();
        if (!s) return;
        if (opciones.producto) {
            try {
                localStorage.setItem(PENDIENTE, JSON.stringify(opciones.producto));
            } catch (error) { /* sin lugar: se abre igual */ }
        }
        crearFondo();
        ponerX();
        abierta = true;
        s.dataset.fondo = fondo.id;
        s.classList.add("pedidoEnHoja", "pedidoSobreTodo");
        s.classList.remove("oculto");
        fondo.classList.remove("oculto");
        if (typeof cargarListaClientes === "function") cargarListaClientes();
        // Dibuja los productos, recupera el pedido a medio hacer y suma el
        // producto que se tocó en el Catálogo.
        if (typeof renderizarProductosPedido === "function") renderizarProductosPedido();
        if (typeof opciones.comercio === "string" && opciones.comercio) {
            const cliente = document.getElementById("cliente");
            if (cliente) {
                cliente.value = opciones.comercio;
                cliente.dispatchEvent(new Event("input", { bubbles: true }));
            }
            if (typeof guardarBorradorPedido === "function") guardarBorradorPedido();
        }
        s.scrollTop = 0;
        actualizarBarra();
    }

    function cerrar() {
        if (!abierta) return;
        abierta = false;
        const s = seccion();
        if (s) {
            s.classList.add("oculto");
            s.classList.remove("pedidoEnHoja", "pedidoSobreTodo");
            s.style.transform = "";
        }
        if (fondo) fondo.classList.add("oculto");
        if (typeof window.renderizarCatalogo === "function" && !document.getElementById("pantallaCatalogo")?.classList.contains("oculto")) window.renderizarCatalogo();
        actualizarBarra();
    }

    // Con un pedido a medio hacer para otro comercio (o sin comercio), se
    // pregunta. alSeguir(true) sigue con ese; alSeguir(false) empieza uno nuevo.
    function preguntarSiHayOtro(nombre, alElegir) {
        const datos = resumen();
        const pz = window.piezas;
        if (!datos || !pz || (nombre && normal(datos.cliente) === normal(nombre))) {
            alElegir(Boolean(datos));
            return;
        }
        const cuantos = datos.productos === 1 ? "1 producto" : datos.productos + " productos";
        const caja = pz.modal({
            icono: "documento",
            color: "pri",
            titulo: "Tenés un pedido a medio hacer",
            texto: `Lleva ${cuantos}${datos.cliente ? " para " + datos.cliente : ""}. ¿Lo seguís${nombre ? " para " + nombre : ""} o empezás uno nuevo?`,
            botones: [
                { texto: "Empezar uno nuevo", clase: "pzBtnGris", alTocar: () => alElegir(false) },
                { texto: "Seguir con ese", clase: "pzBtnPri", alTocar: () => alElegir(true) }
            ]
        });
        caja.classList.add("preguntaPedidoMedio");
    }

    // Desde la ficha del comercio (hilo de Comercios): el pedido se carga
    // encima de la ficha y al bajarlo se sigue en la ficha.
    function abrirParaComercio(nombre) {
        preguntarSiHayOtro(nombre, seguir => {
            if (!seguir && typeof window.limpiarPedido === "function") window.limpiarPedido();
            abrir({ comercio: nombre });
        });
    }

    // ---------- La barrita del pedido a medio hacer ----------
    function crearBarra() {
        barra = document.createElement("div");
        barra.id = "barraPedidoMedio";
        barra.className = "barraPedidoMedio oculto";
        barra.setAttribute("role", "region");
        barra.setAttribute("aria-label", "Pedido a medio hacer");
        barra.innerHTML = `<span class="iconoPedidoMedio" aria-hidden="true">${window.icono ? window.icono("documento", 22) : ""}</span>
            <span class="textoPedidoMedio"><strong>Pedido nuevo</strong><small></small></span>
            <button type="button" class="verPedidoMedio">Ver pedido</button>`;
        barra.addEventListener("click", () => abrir());
        document.body.appendChild(barra);
    }

    function seVe(id) {
        const elemento = document.getElementById(id);
        return Boolean(elemento && !elemento.classList.contains("oculto"));
    }

    function tocaMostrar() {
        if (abierta) return false;
        const html = document.documentElement;
        if (html.classList.contains("enNavegacion") || html.classList.contains("enCargaPedido") || html.classList.contains("conPieTanda")) return false;
        if (seVe("pantallaPedido") || seVe("pantallaConfiguracion") || seVe("pantallaInicioSesion")) return false;
        const nav = document.querySelector("body > nav.bottom-nav");
        if (!nav || getComputedStyle(nav).display === "none") return false;
        if (document.querySelector(".nav-item.activo")?.dataset.pantalla === "mas") return false;
        return true;
    }

    let pedida = false;
    function actualizarBarra() {
        if (pedida) return;
        pedida = true;
        setTimeout(() => {
            pedida = false;
            const datos = resumen();
            const mostrar = Boolean(datos) && tocaMostrar();
            if (!barra && !mostrar) return;
            if (!barra) crearBarra();
            barra.classList.toggle("oculto", !mostrar);
            document.documentElement.classList.toggle("conPedidoMedio", mostrar);
            if (!mostrar) return;
            const plata = window.piezas ? window.piezas.plata(datos.total) : "$ " + Math.round(datos.total).toLocaleString("es-AR");
            barra.querySelector("small").textContent = (datos.productos === 1 ? "1 producto" : datos.productos + " productos") +
                (datos.total > 0 ? " · " + plata : "");
        }, 0);
    }

    // Se mira de nuevo al cambiar de pantalla, al tocar algo y al guardar
    // el borrador. Solo lee el celular: no pesa en los celulares baratos.
    ["guardarBorradorPedido", "borrarBorradorPedido"].forEach(nombre => {
        const original = window[nombre];
        if (typeof original !== "function") return;
        window[nombre] = function () {
            const resultado = original.apply(this, arguments);
            actualizarBarra();
            return resultado;
        };
    });
    const mostrarOriginal = window.mostrarPantalla;
    if (typeof mostrarOriginal === "function") {
        window.mostrarPantalla = function () {
            // Si se va a otra pantalla con la hoja abierta, se baja primero.
            if (abierta) cerrar();
            const resultado = mostrarOriginal.apply(this, arguments);
            actualizarBarra();
            return resultado;
        };
    }
    document.addEventListener("click", actualizarBarra, true);
    window.addEventListener("pedidoGuardadoVendeFrio", () => { cerrar(); actualizarBarra(); });
    window.addEventListener("storage", evento => { if (evento.key === BORRADOR) actualizarBarra(); });
    window.addEventListener("load", actualizarBarra);
    actualizarBarra();

    window.pedidoEnHoja = { abrir, cerrar, abierta: () => abierta, sumar, cantidadDe, resumen, preguntarSiHayOtro, actualizarBarra };
    window.abrirPedidoEnHoja = abrirParaComercio;
}());
