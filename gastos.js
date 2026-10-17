// VendeFrío - Gastos del día (T76).
// En el Cierre del día: "Gastos de hoy · + Agregar" (nafta, peaje, comida u
// otro, con foto del ticket opcional) y "Queda en caja" = lo cobrado (con los
// pagos parciales) menos los gastos. En la nube se guarda en `gastos/`.
(function () {
    "use strict";

    const p = window.piezas;
    const extras = window.extrasVendeFrio;
    const CATEGORIAS = [
        { clave: "nafta", texto: "Nafta", icono: "auto", color: "1" },
        { clave: "peaje", texto: "Peaje", icono: "navegar", color: "Info" },
        { clave: "comida", texto: "Comida", icono: "bolsa", color: "2" },
        { clave: "otro", texto: "Otro", icono: "notaLapiz", color: "Gris" }
    ];
    const categoria = clave => CATEGORIAS.find(item => item.clave === clave) || CATEGORIAS[3];

    extras.registrar("gastos", {
        dias: 120,
        describir: gasto => ({ titulo: "Gasto", nombre: categoria(gasto.categoria).texto, detalle: p.plata(gasto.monto) })
    });

    function inicioDelDia(hora) {
        const fecha = new Date(hora);
        fecha.setHours(0, 0, 0, 0);
        return fecha.getTime();
    }

    function delDia(inicio) {
        const fin = inicioDelDia(inicio + 26 * 3600000);
        return extras.lista("gastos")
            .filter(gasto => Number(gasto.horaCelular) >= inicio && Number(gasto.horaCelular) < fin)
            .sort((a, b) => Number(a.horaCelular) - Number(b.horaCelular));
    }

    const totalDe = lista => Math.round(lista.reduce((suma, gasto) => suma + (Number(gasto.monto) || 0), 0) * 100) / 100;

    // Pagos parciales (T74) registrados ese día.
    function pagosDelDia(inicio) {
        const fin = inicioDelDia(inicio + 26 * 3600000);
        return extras.lista("pagos").filter(pago => Number(pago.horaCelular) >= inicio && Number(pago.horaCelular) < fin);
    }

    function htmlFilas(lista) {
        if (!lista.length) return `<div class="pzVacio">Todavía no hay gastos este día.</div>`;
        return lista.map(gasto => {
            const cat = categoria(gasto.categoria);
            const quien = gasto.persona && gasto.persona.nombre ? " · " + gasto.persona.nombre : "";
            const extra = gasto.foto ? " · con foto del ticket" : "";
            const titulo = gasto.detalle ? cat.texto + " · " + gasto.detalle : cat.texto;
            return `<button type="button" class="pzFila filaGasto" data-gasto="${p.esc(gasto.id)}">
                <div class="pzIni pzIniGasto pzIni${cat.color}">${p.ico(cat.icono, 20)}</div>
                <div class="pzFilaTxt"><strong>${p.esc(titulo)}</strong><small>${p.esc(p.hora(gasto.horaCelular) + quien + extra)}</small></div>
                <b class="pzMonto">${p.plata(gasto.monto)}</b>
            </button>`;
        }).join("");
    }

    // La parte de arriba del Cierre: "Queda en caja" y "Gastos de hoy".
    function htmlCierre(datos, esHoy) {
        const gastos = delDia(datos.inicio);
        const totalGastos = totalDe(gastos);
        const queda = Math.round((datos.totalRecaudado - totalGastos) * 100) / 100;
        return `<div class="pzTarjeta pzRelleno pzTotalGrande cajaQueda" id="quedaEnCaja">
                <small>Queda en caja</small>
                <strong>${queda < 0 ? "− " : ""}${p.plata(Math.abs(queda))}</strong>
                <div class="pzTresNumeros">
                    <div><b>${p.plata(datos.totalRecaudado)}</b><span>cobrado</span></div>
                    <div><b>${totalGastos ? "− " : ""}${p.plata(totalGastos)}</b><span>gastos</span></div>
                    <div><b>${p.plata(datos.aCobrar)}</b><span>a cobrar</span></div>
                </div>
            </div>
            <section class="pzBloque" id="gastosCierre">
                <div class="pzBloqueCab"><h2>${esHoy ? "Gastos de hoy" : "Gastos del día"}</h2><button type="button" class="pzEnlace" id="agregarGasto">${p.ico("mas", 16)} Agregar</button></div>
                <div class="pzTarjeta pzLista">${htmlFilas(gastos)}</div>
            </section>`;
    }

    function agregar(alGuardar) {
        let elegida = "nafta";
        let foto = "";
        const caja = p.hoja({
            titulo: "Agregar gasto",
            sub: "Se descuenta de lo que queda en caja",
            etiqueta: "Agregar gasto",
            html: `<div class="pzFiltros pzEnHoja" role="group" aria-label="Qué gasto">${CATEGORIAS.map(cat => `<button type="button" class="pzFiltro" data-categoria="${cat.clave}" aria-pressed="${cat.clave === elegida}">${p.ico(cat.icono, 16)}${cat.texto}</button>`).join("")}</div>
                <div class="pzDosCampos">
                    <label class="pzCampo"><span>Monto</span><input id="montoGasto" type="number" inputmode="decimal" min="1" step="1" placeholder="$"></label>
                    <label class="pzCampo"><span>Detalle (opcional)</span><input id="detalleGasto" maxlength="60" placeholder="Ej.: YPF Ruta 3"></label>
                </div>
                <div class="pzFotos pzFotosGasto">
                    <label class="pzFotoAgregar" id="agregarFotoGasto">${p.ico("camara", 22)}<span class="textoAgregarFoto">Foto del ticket</span>
                        <input type="file" accept="image/*" capture="environment" class="pzOcultar" id="archivoFotoGasto">
                    </label>
                </div>`,
            botones: [{
                texto: "Guardar gasto",
                icono: "check",
                alTocar: caja => {
                    const monto = Math.round(Number(String(caja.querySelector("#montoGasto").value).replace(",", ".")) * 100) / 100;
                    if (!Number.isFinite(monto) || monto <= 0) {
                        mostrarToast("Escribí cuánto gastaste");
                        return false;
                    }
                    const datos = {
                        categoria: elegida,
                        detalle: String(caja.querySelector("#detalleGasto").value || "").trim().slice(0, 60),
                        monto,
                        persona: p.persona(),
                        horaCelular: Date.now()
                    };
                    if (foto) datos.foto = foto;
                    extras.guardar("gastos", datos, typeof generarId === "function" ? generarId("gasto") : undefined);
                    mostrarToast("Gasto guardado: " + categoria(elegida).texto + " " + p.plata(monto));
                    if (typeof alGuardar === "function") alGuardar();
                    return true;
                }
            }]
        });
        caja.addEventListener("click", evento => {
            const boton = evento.target.closest("[data-categoria]");
            if (!boton) return;
            elegida = boton.dataset.categoria;
            caja.querySelectorAll("[data-categoria]").forEach(otro => otro.setAttribute("aria-pressed", String(otro === boton)));
        });
        const zona = caja.querySelector("#agregarFotoGasto");
        caja.querySelector("#archivoFotoGasto").addEventListener("change", async evento => {
            const archivo = evento.target.files && evento.target.files[0];
            evento.target.value = "";
            if (!archivo) return;
            try {
                foto = await p.comprimirImagen(archivo, { lado: 1000, calidad: 0.6, largoMaximo: 340000 });
                caja.querySelector(".pzFotosGasto .pzFotoVista")?.remove();
                const vista = document.createElement("div");
                vista.className = "pzFotoVista";
                vista.innerHTML = `<img alt="Foto del ticket" src="${foto}">`;
                zona.before(vista);
                zona.querySelector(".textoAgregarFoto").textContent = "Cambiar foto";
            } catch (error) {
                mostrarToast("No se pudo usar esa foto");
            }
        });
    }

    // Tocar un gasto: verlo y, si es tuyo o sos el dueño, borrarlo.
    function verGasto(id, alBorrar) {
        const gasto = extras.lista("gastos").find(item => item.id === id);
        if (!gasto) return;
        const cat = categoria(gasto.categoria);
        const persona = p.persona();
        const puedeBorrar = p.esDueno() || (persona && gasto.persona && gasto.persona.idPersona === persona.idPersona);
        p.hoja({
            titulo: cat.texto + " · " + p.plata(gasto.monto),
            sub: [gasto.detalle, p.hora(gasto.horaCelular), gasto.persona && gasto.persona.nombre].filter(Boolean).join(" · "),
            etiqueta: "Gasto",
            html: gasto.foto ? `<div class="pzFotoTicket"><img alt="Foto del ticket" src="${gasto.foto}"></div>` : "",
            botones: puedeBorrar ? [{
                texto: "Borrar gasto",
                icono: "tacho",
                clase: "pzBtnPeligro",
                alTocar: () => {
                    extras.borrar("gastos", gasto.id);
                    mostrarToast("Gasto borrado");
                    if (typeof alBorrar === "function") alBorrar();
                }
            }] : []
        });
    }

    extras.escuchar("gastos", () => window.cierreVendeFrio?.redibujar?.());
    extras.escuchar("pagos", () => window.cierreVendeFrio?.redibujar?.());

    window.gastosVendeFrio = { CATEGORIAS, delDia, totalDe, pagosDelDia, htmlCierre, agregar, verGasto };
}());
