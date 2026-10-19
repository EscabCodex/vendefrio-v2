// VendeFrío - Nuevo pedido: "Quiere" o "Tiene" (T124).
// Arriba de los productos se elige qué se anota. "Quiere" es como siempre:
// lo que pide el comercio. "Tiene": lo que hay en su heladera; no se calcula
// nada (lo eligió el dueño), el pedido queda guardado así y en Pedidos la
// tarjeta dice "Tiene" o "Quiere". La marca viaja en las observaciones del
// pedido (primer renglón), así el pedido no cambia de forma.
(function () {
    "use strict";

    const MARCA = "TIENE en la heladera (no es lo que pide).";

    function esTiene(pedido) {
        return String(pedido && (pedido.observaciones ?? pedido.observacion) || "").split("\n")[0].trim() === MARCA;
    }

    // Saca la marca de unas observaciones (para mostrarlas sin repetirla).
    function sinMarca(texto) {
        return String(texto || "").split("\n").filter(renglon => renglon.trim() !== MARCA).join("\n").trim();
    }

    window.tieneQuiereVendeFrio = { esTiene, sinMarca, MARCA };

    const pantalla = document.getElementById("pantallaPedido");
    const tarjetaCliente = pantalla && pantalla.querySelector(".clientePedido");
    const obs = document.getElementById("obs");
    if (!pantalla || !tarjetaCliente || !obs || !window.piezas) return;

    const p = window.piezas;

    const selector = document.createElement("div");
    selector.id = "modoPedido";
    selector.className = "modoPedido";
    selector.innerHTML = `<div class="pzSegmentos" role="group" aria-label="Qué anotás">
            <button type="button" data-modo="quiere" aria-pressed="true">${p.ico("documento", 16)} Quiere</button>
            <button type="button" data-modo="tiene" aria-pressed="false">${p.ico("paquete", 16)} Tiene</button>
        </div>
        <small id="ayudaModoPedido">Anotás lo que pide el comercio.</small>`;
    (document.getElementById("sugerenciasPedido") || tarjetaCliente).after(selector);

    function modoActual() {
        return obs.value.split("\n")[0].trim() === MARCA ? "tiene" : "quiere";
    }

    // El selector sigue a las observaciones: así vale también para un
    // borrador guardado o un pedido que se edita.
    function dibujar() {
        const modo = modoActual();
        selector.querySelectorAll("[data-modo]").forEach(boton => boton.setAttribute("aria-pressed", String(boton.dataset.modo === modo)));
        selector.querySelector("#ayudaModoPedido").textContent = modo === "tiene"
            ? "Anotás lo que hay en la heladera. En Pedidos se ve como «Tiene»."
            : "Anotás lo que pide el comercio.";
        pantalla.classList.toggle("modoTiene", modo === "tiene");
    }

    function cambiar(modo) {
        const resto = sinMarca(obs.value);
        obs.value = modo === "tiene" ? MARCA + (resto ? "\n" + resto : "") : resto;
        obs.dispatchEvent(new Event("input", { bubbles: true }));
        if (typeof guardarBorradorPedido === "function") guardarBorradorPedido();
        dibujar();
    }

    selector.addEventListener("click", evento => {
        const modo = evento.target.closest("[data-modo]")?.dataset.modo;
        if (!modo || modo === modoActual()) return;
        cambiar(modo);
        if (typeof mostrarToast === "function") mostrarToast(modo === "tiene" ? "Ahora anotás lo que TIENE en la heladera" : "Ahora anotás lo que QUIERE");
    });
    obs.addEventListener("input", dibujar);

    if (typeof window.actualizarResumenPedido === "function") {
        const original = window.actualizarResumenPedido;
        window.actualizarResumenPedido = function () {
            const resultado = original.apply(this, arguments);
            try { dibujar(); } catch (error) { console.error("No se pudo dibujar Quiere/Tiene.", error); }
            return resultado;
        };
    }
    dibujar();
}());
