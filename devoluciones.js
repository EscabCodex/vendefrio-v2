// VendeFrío - Devoluciones (T71).
// En un pedido entregado (⋯ > "Registrar devolución"): qué productos, cuántos
// y el motivo. Baja el total del pedido (y lo que queda por cobrar) y queda
// en su ficha. En la nube se guarda en `devoluciones/`.
(function () {
    "use strict";

    const p = window.piezas;
    const extras = window.extrasVendeFrio;
    const MOTIVOS = [
        { clave: "vencido", texto: "Vencido" },
        { clave: "roto", texto: "Roto" },
        { clave: "malEnviado", texto: "Mal enviado" },
        { clave: "otro", texto: "Otro" }
    ];
    const textoMotivo = clave => (MOTIVOS.find(motivo => motivo.clave === clave) || MOTIVOS[3]).texto;

    extras.registrar("devoluciones", {
        dias: 180,
        describir: devolucion => ({ titulo: "Devolución", nombre: devolucion.comercio || "", detalle: "− " + p.plata(devolucion.monto) })
    });

    function delPedido(idPedido) {
        return extras.lista("devoluciones").filter(devolucion => String(devolucion.idPedido) === String(idPedido));
    }

    function montoDe(idPedido) {
        return delPedido(idPedido).reduce((suma, devolucion) => suma + (Number(devolucion.monto) || 0), 0);
    }

    // Unidades ya devueltas de un producto en este pedido.
    function devueltas(idPedido, marca, producto) {
        return delPedido(idPedido).reduce((suma, devolucion) => suma + (Array.isArray(devolucion.lineas) ? devolucion.lineas : [])
            .filter(linea => linea.marca === marca && linea.producto === producto)
            .reduce((total, linea) => total + (Number(linea.cantidad) || 0), 0), 0);
    }

    function abrir(pedido) {
        const entrega = window.nubeVendeFrio.entregaDelPedido(pedido);
        const lineas = entrega.lineas.map(linea => {
            const marca = String(linea.item.marca || "");
            const producto = String(linea.item.producto || linea.item.nombre || "");
            const precio = Number(linea.item.precio);
            const maximo = Math.max(0, linea.entregada - devueltas(pedido.id, marca, producto));
            return { marca, producto, precio: Number.isFinite(precio) ? precio : 0, maximo, cantidad: 0 };
        }).filter(linea => linea.maximo > 0);
        if (!lineas.length) {
            mostrarToast("Ya se devolvió todo lo de este pedido");
            return;
        }
        let motivo = "vencido";

        const filas = lineas.map((linea, i) => `<div class="pzFila pzFilaDevolucion" data-linea="${i}">
                <div class="pzFilaTxt"><strong>${p.esc(linea.producto)}</strong><small class="subDevolucion"></small></div>
                <div class="controlesCantidad controlesEspejo" data-cantidad="0">
                    <button type="button" class="botonCantidad botonMenos" data-paso="-1" aria-label="Devolver uno menos de ${p.esc(linea.producto)}">${p.ico("menos", 18)}</button>
                    <b class="cantidadEspejo">0</b>
                    <button type="button" class="botonCantidad botonMas" data-paso="1" aria-label="Devolver uno más de ${p.esc(linea.producto)}">${p.ico("mas", 18)}</button>
                </div>
            </div>`).join("");
        const caja = p.hoja({
            titulo: "Registrar devolución",
            sub: String(pedido.comercio || ""),
            clase: "hojaDevolucion",
            html: `<div class="pzTarjeta pzLista pzEnHoja">${filas}</div>
                <p class="pzEtiquetaCampo">Motivo</p>
                <div class="pzFiltros pzEnHoja" role="group" aria-label="Motivo">${MOTIVOS.map(item => `<button type="button" class="pzFiltro" data-motivo="${item.clave}" aria-pressed="${item.clave === motivo}">${item.texto}</button>`).join("")}</div>
                <div class="pzBanner pzBanAviso pzEnHoja oculto" id="descuentoDevolucion">${p.ico("moneda", 22)}<div><strong></strong><small></small></div></div>`,
            botones: [{
                texto: "Guardar devolución",
                icono: "check",
                id: "guardarDevolucion",
                alTocar: () => guardar(pedido, lineas, motivo, entrega)
            }]
        });

        function actualizar() {
            const monto = lineas.reduce((suma, linea) => suma + linea.precio * linea.cantidad, 0);
            caja.querySelectorAll(".pzFilaDevolucion").forEach(fila => {
                const linea = lineas[Number(fila.dataset.linea)];
                const controles = fila.querySelector(".controlesCantidad");
                controles.dataset.cantidad = String(linea.cantidad);
                controles.querySelector(".cantidadEspejo").textContent = String(linea.cantidad);
                const precio = linea.precio ? p.plata(linea.precio) + " c/u" : "sin precio";
                fila.querySelector(".subDevolucion").textContent = linea.cantidad ? textoMotivo(motivo) + " · " + precio : precio;
            });
            const banner = caja.querySelector("#descuentoDevolucion");
            const unidades = lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
            banner.classList.toggle("oculto", !unidades);
            banner.querySelector("strong").textContent = "Se descuentan " + p.plata(monto);
            const total = Math.max(0, entrega.total.total - monto);
            banner.querySelector("small").textContent = "Total nuevo: " + p.plata(total);
            caja.querySelector("#guardarDevolucion").disabled = !unidades;
        }

        caja.addEventListener("click", evento => {
            const paso = evento.target.closest("[data-paso]");
            if (paso) {
                const linea = lineas[Number(paso.closest(".pzFilaDevolucion").dataset.linea)];
                linea.cantidad = Math.max(0, Math.min(linea.maximo, linea.cantidad + Number(paso.dataset.paso)));
                actualizar();
                return;
            }
            const boton = evento.target.closest("[data-motivo]");
            if (boton) {
                motivo = boton.dataset.motivo;
                caja.querySelectorAll("[data-motivo]").forEach(item => item.setAttribute("aria-pressed", String(item === boton)));
                actualizar();
            }
        });
        actualizar();
    }

    function guardar(pedido, lineas, motivo, entrega) {
        const elegidas = lineas.filter(linea => linea.cantidad > 0);
        if (!elegidas.length) return false;
        const monto = Math.round(elegidas.reduce((suma, linea) => suma + linea.precio * linea.cantidad, 0) * 100) / 100;
        extras.guardar("devoluciones", {
            idPedido: String(pedido.id),
            comercio: String(pedido.comercio || "").slice(0, 120),
            lineas: elegidas.map(linea => ({ marca: linea.marca, producto: linea.producto, cantidad: linea.cantidad, precio: linea.precio })),
            motivo,
            monto,
            persona: p.persona(),
            horaCelular: Date.now()
        }, typeof generarId === "function" ? generarId("dev") : undefined);
        mostrarToast("Devolución guardada: se descuentan " + p.plata(monto));
        refrescar();
        return true;
    }

    function refrescar() {
        window.seguimientoVendeFrio?.redibujarFicha?.();
        if (typeof renderizarHistorial === "function") {
            try { renderizarHistorial(); } catch (error) { /* la pantalla no está */ }
        }
        // Inicio, una sola vez aunque lleguen varios cambios juntos (repasada).
        if (typeof window.pedirActualizarDashboard === "function") window.pedirActualizarDashboard();
        else if (typeof actualizarDashboard === "function") actualizarDashboard();
    }

    // ---------- En la ficha del pedido ----------
    function seccionFicha(pedido, estado) {
        if (estado !== "entregado") return null;
        const lista = delPedido(pedido.id);
        if (!lista.length) return null;
        const seccion = document.createElement("section");
        seccion.className = "seccionFichaPedido seccionDevoluciones";
        const filas = lista.map(devolucion => {
            const detalle = (devolucion.lineas || []).map(linea => linea.cantidad + " " + linea.producto).join(", ");
            const quien = devolucion.persona && devolucion.persona.nombre ? devolucion.persona.nombre + " · " : "";
            return `<div class="pzFila">
                <div class="pzIni pzIniAcento">${p.ico("deshacer", 18)}</div>
                <div class="pzFilaTxt"><strong>${p.esc(detalle)}</strong><small>${p.esc(textoMotivo(devolucion.motivo) + " · " + quien + p.fechaCorta(devolucion.horaCelular) + " " + p.hora(devolucion.horaCelular))}</small></div>
                <b class="pzMonto pzMontoNegativo">− ${p.plata(devolucion.monto)}</b>
            </div>`;
        }).join("");
        seccion.innerHTML = `<h3>Devoluciones</h3><div class="pzTarjeta pzLista">${filas}</div>`;
        return seccion;
    }

    (window.fichaPedidoExtras = window.fichaPedidoExtras || []).push(seccionFicha);
    (window.accionesPedidoExtras = window.accionesPedidoExtras || []).push((pedido, estado) => {
        if (estado !== "entregado") return [];
        return [{ texto: "Registrar devolución", icono: "deshacer", alTocar: abrir }];
    });
    extras.escuchar("devoluciones", refrescar);

    window.devolucionesVendeFrio = { MOTIVOS, abrir, delPedido, montoDe };
}());
