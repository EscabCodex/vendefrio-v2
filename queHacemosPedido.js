// "¿Qué hacemos con este pedido?" (Rutas). Al guardar un pedido cargado desde
// la navegación o el carrusel de Rutas, y después de la ventana "Pedido
// generado" (donde se imprime), pregunta: Entregar ahora (abre el cobro),
// Pasarlo a En reparto o Dejarlo cargado. Así no se acumulan pedidos sin
// entregar. Pieza reusable: window.queHacemosPedido.preguntar(id).
(function () {
    "use strict";
    let marcado = "";

    const normal = texto => String(texto || "").trim().toLowerCase();

    function preguntar(id, alTerminar) {
        const pz = window.piezas;
        const nube = window.nubeVendeFrio;
        if (!id || !pz || !nube || !nube.modoNube()) return false;
        const fin = () => { if (typeof alTerminar === "function") alTerminar(); };
        const caja = pz.hoja({
            titulo: "¿Qué hacemos con este pedido?",
            sub: "Para que no te queden pedidos sin entregar.",
            clase: "hojaQueHacemosPedido",
            botones: [
                { texto: "Entregar ahora", icono: "check", clase: "pzBtnPri", alTocar: () => { window.seguimientoVendeFrio?.entregarYCobrar?.(id); fin(); } },
                { texto: "Pasarlo a En reparto", icono: "camion", clase: "pzBtnGris", alTocar: () => {
                    try {
                        nube.agregarEstadoAlPedido(id, "enReparto", "Desde la ruta");
                        if (typeof mostrarToast === "function") mostrarToast("Pedido en reparto");
                    } catch (error) {
                        if (typeof mostrarToast === "function") mostrarToast("No se pudo pasar a En reparto");
                    }
                    fin();
                } },
                { texto: "Dejarlo cargado", clase: "pzBtnGris", alTocar: fin }
            ]
        });
        return Boolean(caja);
    }

    // Rutas y la navegación marcan el comercio antes de abrir el pedido.
    function marcar(nombre) { marcado = normal(nombre); }

    window.addEventListener("pedidoGuardadoVendeFrio", evento => {
        const detalle = evento.detail || {};
        if (!marcado || normal(detalle.comercio) !== marcado || !detalle.id) return;
        marcado = "";
        const id = detalle.id;
        const ventana = document.getElementById("modalPedido");
        // Primero la ventana "Pedido generado" (imprimir); al cerrarla, la hoja.
        setTimeout(() => {
            if (!ventana || ventana.classList.contains("oculto")) { preguntar(id); return; }
            const mirar = new MutationObserver(() => {
                if (!ventana.classList.contains("oculto")) return;
                mirar.disconnect();
                setTimeout(() => preguntar(id), 150);
            });
            mirar.observe(ventana, { attributes: true, attributeFilter: ["class"] });
        }, 0);
    });

    window.queHacemosPedido = { preguntar, marcar };
}());
