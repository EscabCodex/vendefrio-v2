// VendeFrío - Alias y QR para cobrar (T77).
// El dueño carga el alias (y si quiere, el titular y una foto del QR de su
// banco o billetera) en Más > Cuenta > Tu distribuidora. Al cobrar por
// transferencia, "Mostrar alias y QR" abre una pantalla para que el comercio
// la vea, con "Ya me transfirió". Que Mercado Pago confirme solo el pago
// queda para más adelante (M18). En la nube: `ajustes/cobro`.
(function () {
    "use strict";

    const p = window.piezas;
    const extras = window.extrasVendeFrio;
    const ID = "cobro";

    extras.registrar("ajustes", {
        describir: () => ({ titulo: "Alias y QR", nombre: "", detalle: "" })
    });

    function datos() {
        const doc = extras.lista("ajustes").find(item => item.id === ID) || {};
        return {
            alias: String(doc.alias || ""),
            titular: String(doc.titular || ""),
            qr: typeof doc.qr === "string" ? doc.qr : ""
        };
    }

    const hay = () => Boolean(datos().alias || datos().qr);

    function editar(alGuardar) {
        const actual = datos();
        let qr = actual.qr;
        const caja = p.hoja({
            titulo: "Alias y QR para cobrar",
            sub: "Se muestran al cobrar por transferencia",
            etiqueta: "Alias y QR para cobrar",
            html: `<label class="pzCampo"><span>Alias o CBU</span><input id="aliasCobro" maxlength="40" autocapitalize="off" placeholder="Ej.: distri.prueba.mp" value="${p.esc(actual.alias)}"></label>
                <label class="pzCampo"><span>Titular (opcional)</span><input id="titularCobro" maxlength="60" placeholder="Ej.: Distribuidora Prueba SRL" value="${p.esc(actual.titular)}"></label>
                <p class="pzEtiquetaCampo">Foto del QR (opcional)</p>
                <div class="pzFotos pzFotosQr">
                    ${qr ? `<div class="pzFotoVista"><img alt="QR para cobrar" src="${qr}"></div>` : ""}
                    <label class="pzFotoAgregar" id="agregarQr">${p.ico("qr", 22)}<span class="textoAgregarFoto">${qr ? "Cambiar QR" : "Subir el QR"}</span>
                        <input type="file" accept="image/*" class="pzOcultar" id="archivoQr">
                    </label>
                </div>
                <p class="pzHojaSub">Sacale captura al QR de tu banco o de Mercado Pago y subila acá.</p>`,
            botones: [
                qr ? { texto: "Quitar QR", icono: "tacho", clase: "pzBtnSec", par: true, alTocar: caja => {
                    qr = "";
                    caja.querySelector(".pzFotosQr .pzFotoVista")?.remove();
                    caja.querySelector("#agregarQr .textoAgregarFoto").textContent = "Subir el QR";
                    return false;
                } } : null,
                {
                    texto: "Guardar",
                    icono: "check",
                    par: true,
                    alTocar: caja => {
                        const alias = String(caja.querySelector("#aliasCobro").value || "").trim().slice(0, 40);
                        if (!alias && !qr) {
                            mostrarToast("Escribí el alias o subí el QR");
                            return false;
                        }
                        extras.guardar("ajustes", {
                            alias,
                            titular: String(caja.querySelector("#titularCobro").value || "").trim().slice(0, 60),
                            qr,
                            horaCelular: Date.now()
                        }, ID);
                        mostrarToast("Alias y QR guardados");
                        if (typeof alGuardar === "function") setTimeout(alGuardar, 50);
                        return true;
                    }
                }
            ].filter(Boolean)
        });
        caja.querySelector("#archivoQr").addEventListener("change", async evento => {
            const archivo = evento.target.files && evento.target.files[0];
            evento.target.value = "";
            if (!archivo) return;
            try {
                // El QR necesita nitidez: más lado y más calidad que una foto.
                qr = await p.comprimirImagen(archivo, { lado: 900, calidad: 0.85, largoMaximo: 340000 });
                caja.querySelector(".pzFotosQr .pzFotoVista")?.remove();
                const vista = document.createElement("div");
                vista.className = "pzFotoVista";
                vista.innerHTML = `<img alt="QR para cobrar" src="${qr}">`;
                caja.querySelector("#agregarQr").before(vista);
                caja.querySelector("#agregarQr .textoAgregarFoto").textContent = "Cambiar QR";
            } catch (error) {
                mostrarToast("No se pudo usar esa imagen");
            }
        });
    }

    async function copiar(texto) {
        try {
            await navigator.clipboard.writeText(texto);
            mostrarToast("Alias copiado");
        } catch (error) {
            mostrarToast("No se pudo copiar: " + texto);
        }
    }

    // La pantalla para el comercio: "X paga $ N", el QR y el alias.
    function mostrar({ comercio, monto, alConfirmar }) {
        const d = datos();
        const caja = p.hoja({
            titulo: (comercio ? comercio + " paga " : "Paga ") + (Number.isFinite(monto) ? p.plata(monto) : ""),
            sub: "Mostrale esta pantalla",
            etiqueta: "Cobrar por transferencia",
            clase: "hojaCobrarQr",
            html: `${d.qr ? `<div class="pzQrCobro"><img alt="QR para transferir" src="${d.qr}"></div>` : ""}
                ${d.alias ? `<button type="button" class="pzAliasCobro" id="copiarAlias" aria-label="Copiar alias ${p.esc(d.alias)}">
                    <span>Alias</span><strong>${p.esc(d.alias)}</strong>${p.ico("copiar", 20)}
                </button>` : ""}
                ${d.titular ? `<p class="pzHojaSub pzTitularCobro">A nombre de ${p.esc(d.titular)}</p>` : ""}`,
            botones: [{
                texto: "Ya me transfirió",
                icono: "check",
                id: "yaMeTransfirio",
                alTocar: () => {
                    if (typeof alConfirmar === "function") setTimeout(alConfirmar, 50);
                    return true;
                }
            }]
        });
        caja.querySelector("#copiarAlias")?.addEventListener("click", () => copiar(d.alias));
    }

    window.cobrarQrVendeFrio = { datos, hay, editar, mostrar };
}());
