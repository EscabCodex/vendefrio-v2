// VendeFrío - Prueba de entrega (T70).
// Foto, firma con el dedo y ubicación al entregar; todo opcional. Con
// "Pedir foto y firma al entregar" (Más > Trabajo), al deslizar "Entregado"
// primero se abre la hoja. Si no, se agrega después desde la ficha (⋯).
// Se guarda en la nube en `entregas/{idPedido}` y se ve en la ficha.
(function () {
    "use strict";

    const p = window.piezas;
    const extras = window.extrasVendeFrio;
    extras.registrar("entregas", { puedeLeer: () => false });

    const enMemoria = new Map();

    function pedidoPorId(id) {
        const todos = typeof obtenerHistorial === "function" ? obtenerHistorial() : [];
        return todos.find(pedido => String(pedido.id) === String(id)) || null;
    }

    function distanciaMetros(lat1, lng1, lat2, lng2) {
        const r = 6371000;
        const rad = valor => valor * Math.PI / 180;
        const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
        return Math.round(2 * r * Math.asin(Math.sqrt(a)));
    }

    function textoUbicacion(prueba) {
        if (!prueba || prueba.lat === null || prueba.lat === undefined) return "";
        if (Number.isFinite(Number(prueba.distancia)) && prueba.distancia !== null) {
            const metros = Number(prueba.distancia);
            return "Ubicación guardada · a " + (metros < 1000 ? metros + " m" : (metros / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " km") + " del comercio";
        }
        return "Ubicación guardada";
    }

    // ---------- La firma con el dedo ----------
    function prepararFirma(lienzo) {
        const ctx = lienzo.getContext("2d");
        let dibujando = false;
        let trazos = 0;
        function ajustar() {
            const caja = lienzo.getBoundingClientRect();
            lienzo.width = Math.max(1, Math.round(caja.width * 2));
            lienzo.height = Math.max(1, Math.round(caja.height * 2));
            ctx.lineWidth = 5;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.strokeStyle = getComputedStyle(lienzo).color || "#0C0F13";
        }
        function punto(evento) {
            const caja = lienzo.getBoundingClientRect();
            return [(evento.clientX - caja.left) * 2, (evento.clientY - caja.top) * 2];
        }
        lienzo.addEventListener("pointerdown", evento => {
            evento.preventDefault();
            if (!lienzo.width || lienzo.width < 4) ajustar();
            dibujando = true;
            lienzo.setPointerCapture?.(evento.pointerId);
            const [x, y] = punto(evento);
            ctx.beginPath();
            ctx.moveTo(x, y);
        });
        lienzo.addEventListener("pointermove", evento => {
            if (!dibujando) return;
            evento.preventDefault();
            const [x, y] = punto(evento);
            ctx.lineTo(x, y);
            ctx.stroke();
            trazos += 1;
            lienzo.closest(".pzFirma")?.classList.add("firmada");
        });
        const terminar = () => { dibujando = false; };
        lienzo.addEventListener("pointerup", terminar);
        lienzo.addEventListener("pointercancel", terminar);
        requestAnimationFrame(ajustar);
        return {
            firmada: () => trazos > 2,
            limpiar() {
                ctx.clearRect(0, 0, lienzo.width, lienzo.height);
                trazos = 0;
                lienzo.closest(".pzFirma")?.classList.remove("firmada");
            },
            // JPEG chico con fondo blanco: se ve igual en modo claro y oscuro.
            imagen() {
                if (trazos <= 2) return null;
                const salida = document.createElement("canvas");
                salida.width = 600;
                salida.height = Math.round(600 * lienzo.height / lienzo.width) || 200;
                const sctx = salida.getContext("2d");
                sctx.fillStyle = "#FFFFFF";
                sctx.fillRect(0, 0, salida.width, salida.height);
                sctx.drawImage(lienzo, 0, 0, salida.width, salida.height);
                // El trazo en oscuro: si se dibujó claro (modo oscuro), se invierte.
                const datos = sctx.getImageData(0, 0, salida.width, salida.height);
                for (let i = 0; i < datos.data.length; i += 4) {
                    const brillo = (datos.data[i] + datos.data[i + 1] + datos.data[i + 2]) / 3;
                    if (brillo < 250) {
                        datos.data[i] = datos.data[i + 1] = datos.data[i + 2] = 20;
                    }
                }
                sctx.putImageData(datos, 0, 0);
                return salida.toDataURL("image/jpeg", 0.7);
            }
        };
    }

    // ---------- La hoja ----------
    // alEntregar: si viene, el botón dice "Entregado" y entrega el pedido.
    function abrir(idPedido, alEntregar) {
        const pedido = pedidoPorId(idPedido);
        if (!pedido) return;
        const comercio = typeof buscarComercioPorNombre === "function" ? buscarComercioPorNombre(String(pedido.comercio || "")) : null;
        let resumen = "";
        try {
            const entrega = window.nubeVendeFrio.entregaDelPedido(pedido);
            resumen = (alEntregar ? entrega.unidadesPreparadas : entrega.unidadesEntregadas) + " u" +
                (entrega.total.total ? " · " + p.plata(entrega.total.total) : "");
        } catch (error) {
            resumen = "";
        }
        const fotos = [];
        let ubicacion = null;

        const caja = p.hoja({
            titulo: (alEntregar ? "Entregar a " : "Prueba de entrega · ") + String(pedido.comercio || ""),
            sub: [resumen, "todo opcional"].filter(Boolean).join(" · "),
            etiqueta: "Prueba de entrega",
            html: `<p class="pzEtiquetaCampo">Foto de la entrega</p>
                <div class="pzFotos" id="fotosEntrega">
                    <label class="pzFotoAgregar" id="agregarFotoEntrega">${p.ico("camara", 22)}<span class="textoAgregarFoto">Sacar foto</span>
                        <input type="file" accept="image/*" capture="environment" class="pzOcultar" id="archivoFotoEntrega">
                    </label>
                </div>
                <p class="pzEtiquetaCampo">Firma de quien recibe</p>
                <div class="pzFirma">
                    <canvas id="lienzoFirma" aria-label="Firmá con el dedo"></canvas>
                    <span class="pzFirmaPista">Firmá acá con el dedo</span>
                    <button type="button" class="pzFirmaBorrar" id="borrarFirma" aria-label="Borrar la firma">${p.ico("deshacer", 16)}</button>
                    <input id="recibioEntrega" maxlength="60" placeholder="Nombre de quien recibe" aria-label="Quién recibe">
                </div>
                <p class="pzUbicacionEntrega" id="ubicacionEntrega">${p.ico("ubicacion", 18)}<span class="textoUbicacion">Buscando la ubicación…</span></p>`,
            botones: [{
                texto: alEntregar ? "Entregado" : "Guardar",
                icono: "check",
                id: "guardarPruebaEntrega",
                alTocar: caja => {
                    const prueba = {
                        idPedido: String(pedido.id),
                        comercio: String(pedido.comercio || "").slice(0, 120),
                        fotos: fotos.slice(0, 2),
                        firma: firma.imagen(),
                        recibio: String(caja.querySelector("#recibioEntrega").value || "").trim().slice(0, 60),
                        lat: ubicacion ? ubicacion.lat : null,
                        lng: ubicacion ? ubicacion.lng : null,
                        distancia: ubicacion && Number.isFinite(ubicacion.distancia) ? ubicacion.distancia : null,
                        persona: p.persona(),
                        horaCelular: Date.now()
                    };
                    const algo = prueba.fotos.length || prueba.firma || prueba.recibio;
                    if (algo || ubicacion) {
                        extras.guardar("entregas", prueba, String(pedido.id));
                        enMemoria.set(String(pedido.id), prueba);
                    }
                    if (alEntregar) alEntregar();
                    else if (algo || ubicacion) mostrarToast("Prueba de entrega guardada");
                    window.seguimientoVendeFrio?.redibujarFicha?.();
                }
            }]
        });

        const firma = prepararFirma(caja.querySelector("#lienzoFirma"));
        caja.querySelector("#borrarFirma").addEventListener("click", () => firma.limpiar());

        const zonaFotos = caja.querySelector("#fotosEntrega");
        const agregar = caja.querySelector("#agregarFotoEntrega");
        caja.querySelector("#archivoFotoEntrega").addEventListener("change", async evento => {
            const archivo = evento.target.files && evento.target.files[0];
            evento.target.value = "";
            if (!archivo) return;
            try {
                const foto = await p.comprimirImagen(archivo, { lado: 1000, calidad: 0.6, largoMaximo: 340000 });
                fotos.push(foto);
                const vista = document.createElement("div");
                vista.className = "pzFotoVista";
                vista.innerHTML = `<img alt="Foto de la entrega ${fotos.length}" src="${foto}">`;
                agregar.before(vista);
                agregar.querySelector(".textoAgregarFoto").textContent = "Otra foto";
                agregar.classList.toggle("pzOcultar", fotos.length >= 2);
            } catch (error) {
                mostrarToast("No se pudo usar esa foto");
            }
        });
        zonaFotos.dataset.listo = "1";

        // Ubicación: una sola vez, sin esperar más de 10 segundos.
        const textoUbic = caja.querySelector("#ubicacionEntrega");
        if (!navigator.geolocation) {
            textoUbic.classList.add("sinDato");
            textoUbic.querySelector(".textoUbicacion").textContent = "Este celular no da la ubicación";
        } else {
            navigator.geolocation.getCurrentPosition(posicion => {
                ubicacion = { lat: posicion.coords.latitude, lng: posicion.coords.longitude, distancia: NaN };
                if (comercio && Number.isFinite(Number(comercio.lat)) && Number.isFinite(Number(comercio.lng)) && comercio.lat !== "" && comercio.lng !== "") {
                    ubicacion.distancia = distanciaMetros(ubicacion.lat, ubicacion.lng, Number(comercio.lat), Number(comercio.lng));
                }
                textoUbic.classList.add("conDato");
                textoUbic.querySelector(".textoUbicacion").textContent = textoUbicacion({ ...ubicacion, distancia: Number.isFinite(ubicacion.distancia) ? ubicacion.distancia : null });
            }, () => {
                textoUbic.classList.add("sinDato");
                textoUbic.querySelector(".textoUbicacion").textContent = "Sin ubicación (no se dio permiso)";
            }, { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 });
        }

        // Si se cierra sin entregar, el deslizador vuelve a su lugar.
        const fondo = caja.closest(".pzFondo");
        const observador = new MutationObserver(() => {
            if (document.body.contains(fondo)) return;
            observador.disconnect();
            window.seguimientoVendeFrio?.redibujarFicha?.();
        });
        observador.observe(document.body, { childList: true });
    }

    // Antes de entregar (desde el deslizador). Devuelve true si abrió la hoja.
    function antesDeEntregar(idPedido, entregar) {
        const pedir = window.preferenciasVendeFrio?.valor?.("pruebaEntrega");
        if (pedir !== true) return false;
        abrir(idPedido, entregar);
        return true;
    }

    // ---------- En la ficha del pedido ----------
    function verFoto(src, titulo) {
        p.modal({ icono: "camara", color: "pri", titulo, html: `<img class="pzCapturaGrande" alt="${p.esc(titulo)}" src="${src}">`, botones: [{ texto: "Cerrar", clase: "pzBtnSec" }] });
    }

    function seccionFicha(pedido, estado) {
        if (estado !== "entregado") return null;
        const id = String(pedido.id || "");
        const seccion = document.createElement("section");
        seccion.className = "seccionFichaPedido seccionPruebaEntrega oculto";
        const dibujar = prueba => {
            if (!prueba) return;
            seccion.classList.remove("oculto");
            const fotos = (Array.isArray(prueba.fotos) ? prueba.fotos : []).map((foto, i) =>
                `<button type="button" class="pzFotoVista" data-ver-foto="${i}" aria-label="Ver foto ${i + 1} de la entrega"><img alt="" src="${foto}"></button>`).join("");
            const ubic = textoUbicacion(prueba);
            seccion.innerHTML = `<h3>Prueba de entrega</h3>
                ${fotos ? `<div class="pzFotos">${fotos}</div>` : ""}
                ${prueba.firma ? `<div class="pzFirmaVista"><img alt="Firma de quien recibió" src="${prueba.firma}">${prueba.recibio ? `<small>${p.esc(prueba.recibio)}</small>` : ""}</div>` : (prueba.recibio ? `<p class="pzFirmaVista"><small>Recibió ${p.esc(prueba.recibio)}</small></p>` : "")}
                ${ubic ? `<p class="pzUbicacionEntrega conDato">${p.ico("ubicacion", 18)}<span>${p.esc(ubic)}</span></p>` : ""}`;
            seccion.querySelectorAll("[data-ver-foto]").forEach(boton => boton.addEventListener("click", () =>
                verFoto(prueba.fotos[Number(boton.dataset.verFoto)], "Foto de la entrega")));
        };
        if (enMemoria.has(id)) dibujar(enMemoria.get(id));
        else extras.leer("entregas", id).then(prueba => {
            enMemoria.set(id, prueba);
            dibujar(prueba);
        });
        return seccion;
    }

    (window.fichaPedidoExtras = window.fichaPedidoExtras || []).push(seccionFicha);
    (window.accionesPedidoExtras = window.accionesPedidoExtras || []).push((pedido, estado) => {
        if (estado !== "entregado") return [];
        const tiene = Boolean(enMemoria.get(String(pedido.id)));
        return [{ texto: tiene ? "Cambiar la prueba de entrega" : "Agregar foto y firma", icono: "camara", alTocar: pedidoElegido => abrir(pedidoElegido.id) }];
    });

    window.pruebaEntregaVendeFrio = { abrir, antesDeEntregar, textoUbicacion, distanciaMetros };
}());
