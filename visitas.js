// VendeFrío - Visita sin pedido (T65).
// "Visité, sin pedido" en la próxima parada de Inicio y "Sin pedido" en la
// ficha del comercio: se elige el motivo, el comercio queda visitado y la
// visita suma a Estadísticas. En la nube se guarda en `visitas/`.
(function () {
    "use strict";

    const MOTIVOS = [
        { clave: "cerrado", texto: "Estaba cerrado", icono: "tienda" },
        { clave: "mercaderia", texto: "Tenía mercadería", icono: "paquete" },
        { clave: "encargado", texto: "No estaba el encargado", icono: "persona" },
        { clave: "otroProveedor", texto: "Le compró a otro", icono: "camion" },
        { clave: "otro", texto: "Otro motivo (escribir)", icono: "notaLapiz" }
    ];

    function textoMotivo(visita) {
        if (!visita) return "";
        if (visita.motivo === "otro") return String(visita.texto || "Otro motivo");
        const motivo = MOTIVOS.find(item => item.clave === visita.motivo);
        return motivo ? motivo.texto : "Sin pedido";
    }

    window.extrasVendeFrio.registrar("visitas", {
        dias: 120,
        describir: visita => ({ titulo: "Visita sin pedido", nombre: visita.comercio || "", detalle: textoMotivo(visita) })
    });

    function visitas() {
        return window.extrasVendeFrio.lista("visitas");
    }

    function visitasDelComercio(nombre) {
        const buscado = String(nombre || "").trim().toLocaleLowerCase("es");
        return visitas().filter(visita => String(visita.comercio || "").trim().toLocaleLowerCase("es") === buscado);
    }

    // ---------- La hoja "¿Por qué no hubo pedido?" ----------
    function abrir(nombreComercio) {
        const comercio = typeof buscarComercioPorNombre === "function" ? buscarComercioPorNombre(nombreComercio) : null;
        if (!comercio) return;
        if (typeof window.cerrarFichaComercio === "function") window.cerrarFichaComercio();
        const { ico, esc, hora } = window.piezas;
        const html = `<div class="pzMotivos" role="group" aria-label="Motivo">
                ${MOTIVOS.map(motivo => `<button type="button" class="pzMotivo" data-motivo="${motivo.clave}" aria-pressed="false">${ico(motivo.icono, 20)}${esc(motivo.texto)}</button>`).join("")}
            </div>
            <label class="pzCampo pzOcultar" id="campoOtroMotivo">
                <span>Contá qué pasó</span>
                <textarea id="textoOtroMotivo" rows="2" maxlength="300" placeholder="Ej.: pidió que vuelva el jueves"></textarea>
            </label>`;
        let elegido = "";
        const caja = window.piezas.hoja({
            titulo: "¿Por qué no hubo pedido?",
            sub: comercio.nombre + " · hoy " + hora(Date.now()),
            html,
            botones: [{
                texto: "Guardar visita",
                icono: "check",
                id: "guardarVisita",
                alTocar: caja => guardar(comercio, elegido, caja.querySelector("#textoOtroMotivo").value)
            }]
        });
        const botonGuardar = caja.querySelector("#guardarVisita");
        botonGuardar.disabled = true;
        caja.querySelector(".pzMotivos").addEventListener("click", evento => {
            const boton = evento.target.closest("[data-motivo]");
            if (!boton) return;
            elegido = boton.dataset.motivo;
            caja.querySelectorAll("[data-motivo]").forEach(item => item.setAttribute("aria-pressed", String(item === boton)));
            const otro = elegido === "otro";
            caja.querySelector("#campoOtroMotivo").classList.toggle("pzOcultar", !otro);
            if (otro) caja.querySelector("#textoOtroMotivo").focus();
            botonGuardar.disabled = false;
        });
    }

    function guardar(comercio, motivo, texto) {
        if (!motivo) return false;
        const limpio = motivo === "otro" ? String(texto || "").trim().slice(0, 300) : "";
        if (motivo === "otro" && !limpio) {
            mostrarToast("Escribí el motivo");
            return false;
        }
        window.extrasVendeFrio.guardar("visitas", {
            idComercio: String(comercio.id || ""),
            comercio: String(comercio.nombre || "").slice(0, 120),
            motivo,
            texto: limpio,
            persona: window.piezas.persona(),
            horaCelular: Date.now()
        }, typeof generarId === "function" ? generarId("vis") : undefined);
        // Cuenta como visitado esta semana.
        actualizarComercioPorId(comercio.id, {
            ultimaVisita: new Date().toLocaleDateString("es-AR"),
            pendienteSemana: false
        });
        if (typeof renderizarComercios === "function") renderizarComercios();
        if (typeof actualizarDashboard === "function") actualizarDashboard();
        window.estadisticasVendeFrio?.redibujar();
        if (navigator.vibrate) navigator.vibrate(30);
        mostrarToast("Visita guardada · " + textoMotivo({ motivo, texto: limpio }));
        return true;
    }

    // ---------- Estadísticas: por qué no hubo pedido ----------
    function tarjetaEstadisticas() {
        const stats = window.estadisticasVendeFrio;
        const { ico, esc } = window.piezas;
        const desde = stats.inicioPeriodo();
        const lista = visitas().filter(visita => !desde || Number(visita.horaCelular) >= desde.getTime());
        const card = stats.tarjeta("cerrarX", "naranja", "Visitas sin pedido",
            lista.length ? lista.length + " " + ({ hoy: "hoy", semana: "en los últimos 7 días", mes: "este mes" }[stats.periodoElegido()] || "en total") : "Por qué no hubo pedido", "statsSinPedido");
        if (!lista.length) {
            card.insertAdjacentHTML("beforeend", stats.vacio("Cuando marques “Visité, sin pedido”, acá vas a ver los motivos."));
            return card;
        }
        const cuenta = {};
        lista.forEach(visita => { cuenta[visita.motivo] = (cuenta[visita.motivo] || 0) + 1; });
        const max = Math.max(...Object.values(cuenta), 1);
        const filas = MOTIVOS.filter(motivo => cuenta[motivo.clave]).sort((a, b) => cuenta[b.clave] - cuenta[a.clave]).map(motivo => `<div class="statsFila">
                <span class="statsFilaIcono">${ico(motivo.icono, 17)}</span>
                <div class="statsFilaTexto"><strong>${esc(motivo.clave === "otro" ? "Otro motivo" : motivo.texto)}</strong>
                    <span class="statsPista"><i style="width:${Math.round(cuenta[motivo.clave] / max * 100)}%"></i></span></div>
                <b class="statsFilaValor">${cuenta[motivo.clave]}</b>
            </div>`).join("");
        const ultimas = lista.slice(0, 3).map(visita => `<div class="statsFila">
                <span class="statsAvatar">${esc(window.piezas.iniciales(visita.comercio))}</span>
                <div class="statsFilaTexto"><strong>${esc(visita.comercio)}</strong><small>${esc(textoMotivo(visita))} · ${esc(window.piezas.fechaCorta(visita.horaCelular))}${visita.persona && visita.persona.nombre ? " · " + esc(visita.persona.nombre) : ""}</small></div>
            </div>`).join("");
        card.insertAdjacentHTML("beforeend", `<div class="statsLista">${filas}</div><p class="statsSubtitulo">Últimas</p><div class="statsLista">${ultimas}</div>`);
        return card;
    }

    (window.tarjetasEstadisticasExtra = window.tarjetasEstadisticasExtra || []).push(tarjetaEstadisticas);
    window.extrasVendeFrio.escuchar("visitas", () => window.estadisticasVendeFrio?.redibujar());

    window.visitasVendeFrio = { MOTIVOS, abrir, visitas, visitasDelComercio, textoMotivo };
}());
