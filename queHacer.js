// VendeFrío - Inicio "¿Qué querés hacer?" (Etapa 8, aprobado por el dueño).
// Debajo del resumen de hoy (que sigue arriba de todo), tres botones grandes
// con lo que más se hace en el día: cargar un pedido, ver los pedidos de hoy
// y cobrar. "Cobrar" aparece solo para quien cobra, en la nube.
// También "Preguntale a VendeFrío" sale de Más y queda arriba a la derecha de
// Inicio, al lado del micrófono.
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
        const pedidos = typeof obtenerPedidosQueCuentan === "function" ? obtenerPedidosQueCuentan() : (typeof obtenerHistorial === "function" ? obtenerHistorial() : []);
        const deHoy = typeof pedidosDeHoyInicio === "function" ? pedidosDeHoyInicio(pedidos) : [];
        const estado = pedido => (typeof estadoInicio === "function" ? estadoInicio(pedido) : "");
        return {
            todos: deHoy.length,
            armar: deHoy.filter(pedido => ["cargado", "enPreparacion"].includes(estado(pedido))).length,
            entregar: deHoy.filter(pedido => ["preparado", "enVehiculo", "enReparto"].includes(estado(pedido))).length
        };
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
        if (puedeCobrar()) {
            const deben = window.saldosVendeFrio?.cuentas?.() || [];
            cobrar = opcion("cobrar", "moneda", "Cobrar", deben.length
                ? deben.length + (deben.length === 1 ? " comercio te debe" : " comercios te deben")
                : "Nadie te debe", false);
        }
        bloque.innerHTML = `<h2 class="seccionTitulo" id="tituloQueHacer">¿Qué querés hacer?</h2>
            <div class="queHacerLista">
                ${opcion("pedido", "lapiz", "Cargar un pedido", "Elegís el comercio y los productos", true)}
                ${opcion("pedidosHoy", "camion", "Ver los pedidos de hoy", subPedidos, false)}
                ${cobrar}
            </div>`;
        dibujarBotonPreguntale();
    }

    function alTocar(evento) {
        const boton = evento.target.closest("[data-que-hacer]");
        if (!boton) return;
        const accion = boton.dataset.queHacer;
        if (accion === "pedido") {
            if (typeof abrirNuevoPedido === "function") abrirNuevoPedido();
            else mostrarPantalla("pedido");
        } else if (accion === "pedidosHoy") {
            if (enLaNube() && window.seguimientoVendeFrio?.abrirEtapa?.("paraArmar")) return;
            mostrarPantalla(enLaNube() ? "pedido" : "historial");
        } else if (accion === "cobrar") {
            window.saldosVendeFrio?.abrirPantalla?.();
        }
    }

    // ---------- "Preguntale a VendeFrío" arriba a la derecha ----------
    function accesoPreguntale() {
        return (window.accesosMasExtras || []).find(acceso => acceso.destino === "preguntale");
    }

    function dibujarBotonPreguntale() {
        const acceso = accesoPreguntale();
        let boton = document.getElementById("botonPreguntaleInicio");
        let visible = false;
        try { visible = Boolean(acceso && (!acceso.mostrar || acceso.mostrar())); } catch (error) { visible = false; }
        if (!visible) {
            boton?.remove();
            return;
        }
        if (boton) return;
        const microfono = document.getElementById("botonVozInicio");
        const avatar = document.getElementById("botonAvatar");
        if (!microfono && !avatar) return;
        boton = document.createElement("button");
        boton.type = "button";
        boton.id = "botonPreguntaleInicio";
        boton.className = "botonVozInicio botonPreguntaleInicio";
        boton.setAttribute("aria-label", "Preguntale a VendeFrío");
        boton.title = "Preguntale a VendeFrío";
        boton.innerHTML = p.ico("chispa", 22);
        boton.addEventListener("click", () => accesoPreguntale()?.abrir());
        // Queda donde estaba el micrófono, que se corre un lugar a la izquierda.
        if (microfono) microfono.after(boton);
        else avatar.before(boton);
    }

    // Ya no va en Más: queda en Inicio.
    const acceso = accesoPreguntale();
    if (acceso) acceso.enMas = false;

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
