// VendeFrío - Inicio "¿Qué querés hacer?" (Etapa 8, aprobado por el dueño).
// Debajo del resumen de hoy (que sigue arriba de todo), tres botones grandes
// con lo que más se hace en el día: cargar un pedido, ver los pedidos de hoy
// y cobrar. "Cobrar" aparece solo para quien cobra, en la nube.
// T178: arranca apagado; en Más > Apariencia se prende y se elige qué
// botones van (inicioQueHacerPedido, inicioQueHacerPedidosHoy, inicioQueHacerCobrar).
(function () {
    "use strict";

    const p = window.piezas;

    function enLaNube() {
        return typeof usaNubeReal === "function" && usaNubeReal();
    }

    function puedeCobrar() {
        return enLaNube() && Boolean(window.nubeVendeFrio?.puedeCobrar?.());
    }

    function cuantosDeHoy() {
        // Los mismos "Pedidos de hoy" que Inicio, ya contados (repasada).
        const deHoy = typeof cuentasDeInicio === "function" ? cuentasDeInicio().pedidosHoy : [];
        const estado = pedido => (typeof estadoInicio === "function" ? estadoInicio(pedido) : "");
        return {
            todos: deHoy.length,
            armar: deHoy.filter(pedido => ["cargado", "enPreparacion"].includes(estado(pedido))).length,
            entregar: deHoy.filter(pedido => ["preparado", "enVehiculo", "enReparto"].includes(estado(pedido))).length
        };
    }

    function elegido(campo) {
        return window.preferenciasVendeFrio?.valor?.(campo) !== false;
    }

    function opcion(accion, icono, titulo, sub, principal) {
        return `<button type="button" class="queHacerOpcion${principal ? " principal" : ""}" data-que-hacer="${accion}">
            <span class="queHacerIcono">${p.ico(icono, 26)}</span>
            <span class="queHacerTexto"><strong>${p.esc(titulo)}</strong><small>${p.esc(sub)}</small></span>
        </button>`;
    }

    function dibujar() {
        const resumen = document.getElementById("resumenHoy");
        if (!resumen) return;
        let bloque = document.getElementById("queHacerInicio");
        if (!bloque) {
            bloque = document.createElement("section");
            bloque.id = "queHacerInicio";
            bloque.className = "queHacer";
            bloque.setAttribute("aria-labelledby", "tituloQueHacer");
            bloque.addEventListener("click", alTocar);
            resumen.after(bloque);
        }
        const hoy = cuantosDeHoy();
        const subPedidos = enLaNube()
            ? hoy.armar + " para armar · " + hoy.entregar + " para entregar"
            : hoy.todos + (hoy.todos === 1 ? " pedido hoy" : " pedidos hoy");
        let cobrar = "";
        if (puedeCobrar() && elegido("inicioQueHacerCobrar")) {
            const deben = window.saldosVendeFrio?.cuentas?.() || [];
            cobrar = opcion("cobrar", "moneda", "Cobrar", deben.length
                ? deben.length + (deben.length === 1 ? " comercio te debe" : " comercios te deben")
                : "Nadie te debe", false);
        }
        const opciones = [
            elegido("inicioQueHacerPedido") ? opcion("pedido", "lapiz", "Cargar un pedido", "Elegís el comercio y los productos", true) : "",
            elegido("inicioQueHacerPedidosHoy") ? opcion("pedidosHoy", "camion", "Pedidos de hoy", subPedidos, false) : "",
            cobrar
        ].filter(Boolean);
        // El principal va a lo ancho; los otros dos, lado a lado (T178).
        const html = `<h2 class="seccionTitulo" id="tituloQueHacer">¿Qué querés hacer?</h2>
            <div class="queHacerLista" data-cantidad="${opciones.length}">${opciones.join("")}</div>`;
        bloque.classList.toggle("oculto", !opciones.length);
        // Igual que antes: no se rehace (Inicio se dibuja muchas veces seguidas).
        if (dibujado.bloque !== bloque || dibujado.html !== html) {
            bloque.innerHTML = html;
            dibujado = { bloque, html };
        }
    }
    let dibujado = { bloque: null, html: "" };

    function alTocar(evento) {
        const boton = evento.target.closest("[data-que-hacer]");
        if (!boton) return;
        const accion = boton.dataset.queHacer;
        if (accion === "pedido") {
            if (typeof abrirNuevoPedido === "function") abrirNuevoPedido();
            else mostrarPantalla("pedido");
        } else if (accion === "pedidosHoy") {
            if (enLaNube() && window.seguimientoVendeFrio?.abrirEtapa?.("paraArmar")) return;
            if (!enLaNube() && typeof abrirHistorialPorPeriodo === "function") abrirHistorialPorPeriodo("hoy");
            else mostrarPantalla(enLaNube() ? "pedido" : "historial");
        } else if (accion === "cobrar") {
            window.saldosVendeFrio?.abrirPantalla?.();
        }
    }

    if (typeof window.actualizarDashboard === "function") {
        const original = window.actualizarDashboard;
        window.actualizarDashboard = function () {
            const resultado = original.apply(this, arguments);
            try { dibujar(); } catch (error) { console.error("No se pudo dibujar «¿Qué querés hacer?».", error); }
            return resultado;
        };
    }
    dibujar();
    window.extrasVendeFrio?.escuchar?.("pagos", dibujar);
}());
