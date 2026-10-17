// VendeFrío - Ofertas con fecha (T68).
// Desde Catálogo (tres puntos > "Poner en oferta"): el precio de oferta y
// hasta qué día vale. Catálogo y Nuevo pedido muestran el precio tachado, el
// de oferta y "Promo hasta el viernes"; al pasar la fecha vuelve solo al
// precio de siempre. El precio lo decide precioVigente (database.js).
(function () {
    "use strict";

    const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

    function aFecha(iso) {
        const [anio, mes, dia] = String(iso || "").split("-").map(Number);
        return new Date(anio, (mes || 1) - 1, dia || 1);
    }

    // "Promo solo hoy", "hasta mañana", "hasta el viernes" o "hasta el 24/10".
    function textoHasta(hasta) {
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const fin = aFecha(hasta);
        const dias = Math.round((fin - hoy) / 86400000);
        if (dias <= 0) return "Promo solo hoy";
        if (dias === 1) return "Promo hasta mañana";
        if (dias < 7) return "Promo hasta el " + DIAS[fin.getDay()];
        return "Promo hasta el " + fin.getDate() + "/" + (fin.getMonth() + 1);
    }

    function enDias(dias) {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() + dias);
        return fechaHoyISO(fecha);
    }

    // Precio para mostrar en una tarjeta: tachado y de oferta, o el normal.
    function htmlPrecio(producto, comercio) {
        const p = window.piezas;
        const oferta = ofertaVigente(producto);
        const normal = precioDeLista(producto, comercio);
        if (oferta && (!normal || oferta.precio < normal)) {
            return (normal ? `<s class="pzTachado">${p.plata(normal)}</s> ` : "") + `<span class="pzPrecioPromo">${p.plata(oferta.precio)}</span>`;
        }
        return normal ? p.plata(normal) : "Sin precio";
    }

    function abrir(producto) {
        const p = window.piezas;
        const actual = ofertaVigente(producto);
        const precioNormal = Number(producto.precio) || 0;
        const sugerido = actual ? actual.precio : (precioNormal ? Math.round(precioNormal * 0.85) : "");
        const hasta = actual ? actual.hasta : enDias(6);
        const botones = [{
            texto: actual ? "Guardar cambios" : "Poner en oferta",
            icono: "etiqueta",
            alTocar: caja => {
                const precio = Math.round(Number(caja.querySelector("#precioOferta").value));
                const fecha = caja.querySelector("#hastaOferta").value;
                if (!Number.isFinite(precio) || precio <= 0) {
                    mostrarToast("Poné el precio de oferta");
                    return false;
                }
                if (precioNormal && precio >= precioNormal) {
                    mostrarToast("La oferta tiene que ser menos de " + p.plata(precioNormal));
                    return false;
                }
                if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha < fechaHoyISO()) {
                    mostrarToast("Elegí hasta qué día (hoy o después)");
                    return false;
                }
                guardar(producto, { precio, hasta: fecha });
                mostrarToast("Oferta guardada: " + textoHasta(fecha).toLocaleLowerCase("es"));
                return true;
            }
        }];
        if (actual) {
            botones.push({
                texto: "Sacar la oferta",
                clase: "pzBtnLinea",
                alTocar: () => {
                    guardar(producto, null);
                    mostrarToast("Oferta sacada: vuelve a " + p.plata(precioNormal));
                }
            });
        }
        p.hoja({
            titulo: actual ? "Oferta de " + producto.nombre : "Poner en oferta",
            sub: producto.nombre + " · hoy " + (precioNormal ? p.plata(precioNormal) : "sin precio"),
            etiqueta: "Oferta de " + producto.nombre,
            html: `<div class="pzDosCampos">
                    <label class="pzCampo"><span>Precio de oferta</span><input id="precioOferta" type="number" inputmode="numeric" min="1" step="1" value="${sugerido}"></label>
                    <label class="pzCampo"><span>Vale hasta el</span><input id="hastaOferta" type="date" min="${fechaHoyISO()}" value="${hasta}"></label>
                </div>
                <p class="pzHojaSub">Se ve tachado en Catálogo y en Nuevo pedido. Al pasar la fecha vuelve solo a ${precioNormal ? p.plata(precioNormal) : "su precio"}.</p>`,
            botones
        });
    }

    function guardar(producto, oferta) {
        actualizarProductoPorId(producto.id, { oferta });
        if (typeof renderizarPedido === "function") renderizarPedido();
        if (typeof window.renderizarCatalogo === "function") window.renderizarCatalogo();
    }

    window.ofertasVendeFrio = { abrir, textoHasta, htmlPrecio };
}());
