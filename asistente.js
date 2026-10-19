// VendeFrío - Asistente (Etapa 8, pedido del dueño).
// Un solo botón arriba a la derecha de Inicio, en el lugar del micrófono.
// Se le habla o se le escribe y contesta ahí mismo, también en voz alta:
// 1. Las órdenes ("nuevo pedido para Don Pepe", "llegué") las hace al toque
//    (voz.js las entiende).
// 2. Las preguntas por los números ("¿cuánto vendí hoy?", "¿quién me debe?")
//    las contesta con los datos de este celular, sin esperar. La plata solo
//    para quien tiene permiso de verla (T93).
// 3. "¿Cómo hago…?" lo explica en pasos (ayuda.js).
// 4. Lo que no sabe, con la IA prendida (Más > Trabajo > Voz con IA), se lo
//    pregunta a la IA en la nube (api/preguntar.js) con los números y la guía.
// Reemplaza al micrófono suelto y a la pantalla "Preguntale a VendeFrío".
(function () {
    "use strict";

    const p = window.piezas;
    const SUGERENCIAS = ["¿Cuánto vendí hoy?", "¿Quién me debe?", "¿Cómo registro un cobro?", "¿A dónde voy ahora?"];
    const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

    let hoja = null;
    let charla = [];
    let esperando = false;
    let escuchando = false;

    // ---------- Preferencias ----------
    function preferencias() {
        try {
            return JSON.parse(localStorage.getItem("vendefrio_preferencias") || "{}");
        } catch (error) {
            return {};
        }
    }

    function hablaEnVozAlta() {
        return preferencias().asistenteCalla !== true;
    }

    function cambiarVozAlta(prendida) {
        try {
            localStorage.setItem("vendefrio_preferencias", JSON.stringify({ ...preferencias(), asistenteCalla: !prendida }));
        } catch (error) { /* sin lugar: queda como estaba */ }
        if (!prendida) callar();
    }

    function iaNube() {
        return preferencias().iaNube === true;
    }

    // ---------- Voz ----------
    function hablar(texto) {
        if (!hablaEnVozAlta() || !texto) return;
        try {
            const sintesis = window.speechSynthesis;
            if (!sintesis || typeof SpeechSynthesisUtterance !== "function") return;
            sintesis.cancel();
            const frase = new SpeechSynthesisUtterance(String(texto));
            frase.lang = "es-AR";
            const voz = sintesis.getVoices().find(item => /^es[-_]AR/i.test(item.lang)) || sintesis.getVoices().find(item => /^es/i.test(item.lang));
            if (voz) frase.voice = voz;
            sintesis.speak(frase);
        } catch (error) { /* sin voz: queda el texto */ }
    }

    function callar() {
        try { window.speechSynthesis?.cancel(); } catch (error) { /* nada */ }
    }

    // ---------- Respuestas con los datos del celular ----------
    const normalizar = texto => window.ayudaVendeFrio?.normalizar?.(texto) ?? String(texto || "").toLowerCase();
    const plata = numero => "$ " + Math.round(Number(numero) || 0).toLocaleString("es-AR");
    const vePlata = () => window.verPlataVendeFrio?.puedoVer?.() !== false;
    const enLaNube = () => typeof usaNubeReal === "function" && usaNubeReal();

    function pedidosQueCuentan() {
        if (typeof obtenerPedidosQueCuentan === "function") return obtenerPedidosQueCuentan();
        return typeof obtenerHistorial === "function" ? obtenerHistorial() : [];
    }

    function fechaDe(pedido) {
        if (typeof obtenerFechaPedidoDashboard === "function") return obtenerFechaPedidoDashboard(pedido);
        const hora = Number(pedido && pedido.timestamp);
        return hora ? new Date(hora) : null;
    }

    const totalDe = pedido => (typeof totalDelPedido === "function" ? Number(totalDelPedido(pedido)?.total || 0) : 0);
    const unidadesDe = pedido => (Array.isArray(pedido && pedido.productos) ? pedido.productos : []).reduce((suma, item) => suma + (Number(item && item.cantidad) || 0), 0);

    function periodoDe(dicho) {
        const ahora = new Date();
        const dia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        if (/\bayer\b/.test(dicho)) return { nombre: "ayer", desde: new Date(dia.getTime() - 86400000), hasta: dia };
        if (/\bsemana\b/.test(dicho)) {
            const lunes = new Date(dia);
            lunes.setDate(dia.getDate() - ((dia.getDay() + 6) % 7));
            return { nombre: "esta semana", desde: lunes, hasta: null };
        }
        if (/\bmes\b/.test(dicho)) return { nombre: "este mes", desde: new Date(ahora.getFullYear(), ahora.getMonth(), 1), hasta: null };
        const mes = MESES.findIndex(nombre => new RegExp("\\b" + nombre + "\\b").test(dicho));
        if (mes >= 0) {
            const anio = mes > ahora.getMonth() ? ahora.getFullYear() - 1 : ahora.getFullYear();
            return { nombre: "en " + MESES[mes], desde: new Date(anio, mes, 1), hasta: new Date(anio, mes + 1, 1) };
        }
        return { nombre: "hoy", desde: dia, hasta: null };
    }

    function delPeriodo(periodo) {
        return pedidosQueCuentan().filter(pedido => {
            if (!pedido || pedido.eliminado === true || pedido.estado === "cancelado") return false;
            const fecha = fechaDe(pedido);
            return fecha && fecha >= periodo.desde && (!periodo.hasta || fecha < periodo.hasta);
        });
    }

    function cuantosPedidos(n) {
        return n + (n === 1 ? " pedido" : " pedidos");
    }

    // Lo que se contesta sin esperar a nadie, o null.
    function respuestaLocal(texto) {
        const dicho = normalizar(texto);

        if (/\b(cuanto|que) (vendi|vendimos|vendio|se vendio|llevo vendido|facture|hice)\b|\b(ventas|vendido|facturado) (de )?(hoy|ayer|esta semana|la semana|este mes|el mes)\b/.test(dicho)) {
            const periodo = periodoDe(dicho);
            const pedidos = delPeriodo(periodo);
            const comercios = new Set(pedidos.map(pedido => String(pedido.comercio || ""))).size;
            if (!vePlata()) {
                const unidades = pedidos.reduce((suma, pedido) => suma + unidadesDe(pedido), 0);
                return { destacado: unidades + " unidades", texto: "Salieron " + unidades + " unidades " + periodo.nombre + ", en " + cuantosPedidos(pedidos.length) + ".", decir: periodo.nombre + " salieron " + unidades + " unidades en " + cuantosPedidos(pedidos.length) };
            }
            const total = pedidos.reduce((suma, pedido) => suma + totalDe(pedido), 0);
            return {
                destacado: plata(total),
                texto: "Vendiste " + plata(total) + " " + periodo.nombre + ", en " + cuantosPedidos(pedidos.length) + " a " + comercios + (comercios === 1 ? " comercio." : " comercios."),
                decir: "Vendiste " + Math.round(total).toLocaleString("es-AR") + " pesos " + periodo.nombre + ", en " + cuantosPedidos(pedidos.length)
            };
        }

        if (/\b(quien|quienes) (me )?deb|\bcuanto me deben\b|\bme deben\b|\ba cobrar\b|\bfiado\b/.test(dicho)) {
            if (!vePlata() || !window.saldosVendeFrio?.cuentas) return { texto: "Eso lo ve quien tiene permiso de ver la plata.", decir: "Eso lo ve quien tiene permiso de ver la plata" };
            const cuentas = window.saldosVendeFrio.cuentas().slice().sort((a, b) => b.total - a.total);
            if (!cuentas.length) return { texto: "Nadie te debe nada.", decir: "Nadie te debe nada" };
            const total = cuentas.reduce((suma, cuenta) => suma + cuenta.total, 0);
            const primeros = cuentas.slice(0, 3).map(cuenta => cuenta.nombre + " (" + plata(cuenta.total) + ")").join(", ");
            return {
                destacado: plata(total),
                texto: "Te deben " + plata(total) + " entre " + cuentas.length + (cuentas.length === 1 ? " comercio: " : " comercios. Los que más: ") + primeros + ".",
                decir: "Te deben " + Math.round(total).toLocaleString("es-AR") + " pesos. El que más, " + cuentas[0].nombre,
                barras: cuentas.slice(0, 5).map(cuenta => ({ etiqueta: cuenta.nombre.split(" ")[0], valor: cuenta.total }))
            };
        }

        if (/\b(cuantos|que|hay) pedidos\b|\bpedidos (para|por) (armar|preparar|entregar|repartir)\b|\bque (tengo que|me falta) (armar|entregar|repartir)\b/.test(dicho)) {
            const hoy = typeof pedidosDeHoyInicio === "function" ? pedidosDeHoyInicio(pedidosQueCuentan()) : delPeriodo(periodoDe("hoy"));
            const estado = pedido => (typeof estadoInicio === "function" ? estadoInicio(pedido) : "");
            if (!enLaNube()) return { destacado: cuantosPedidos(hoy.length), texto: "Hoy cargaste " + cuantosPedidos(hoy.length) + ".", decir: "Hoy cargaste " + cuantosPedidos(hoy.length) };
            const armar = hoy.filter(pedido => ["cargado", "enPreparacion"].includes(estado(pedido))).length;
            const entregar = hoy.filter(pedido => ["preparado", "enVehiculo", "enReparto"].includes(estado(pedido))).length;
            return {
                texto: "Hoy tenés " + armar + " para armar y " + entregar + " para entregar.",
                decir: "Hoy tenés " + armar + " para armar y " + entregar + " para entregar"
            };
        }

        if (/\b(stock|me quedan?|queda poco|que falta reponer|reponer)\b/.test(dicho) && window.stockVendeFrio?.todos) {
            const bajos = window.stockVendeFrio.todos().filter(item => item.estado && item.estado.nivel !== "ok");
            if (!bajos.length) return { texto: "No hay productos con poco stock.", decir: "No hay productos con poco stock" };
            const lista = bajos.slice(0, 5).map(item => item.producto.nombre + " (" + item.estado.hay + " u)").join(", ");
            return { texto: "Te queda poco de: " + lista + ".", decir: "Te queda poco de " + bajos.slice(0, 3).map(item => item.producto.nombre).join(", ") };
        }

        if (/\b(que|cuantos) comercios? (me )?(falta|faltan|quedan) (visitar|por visitar)\b|\bsin visitar\b/.test(dicho)) {
            const comercios = (typeof obtenerComercios === "function" ? obtenerComercios() : []).filter(comercio => comercio.archivado !== true);
            const faltan = typeof comercioVisitadoRecientemente === "function" ? comercios.filter(comercio => !comercioVisitadoRecientemente(comercio)) : [];
            if (!faltan.length) return { texto: "Ya visitaste todos tus comercios esta semana.", decir: "Ya visitaste todos tus comercios esta semana" };
            return { texto: "Te faltan visitar esta semana: " + faltan.slice(0, 6).map(comercio => comercio.nombre).join(", ") + ".", decir: "Te faltan " + faltan.length + " comercios por visitar esta semana" };
        }

        if (/\bque hora es\b/.test(dicho)) {
            const hora = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
            return { texto: "Son las " + hora + ".", decir: "Son las " + hora };
        }
        if (/\bque (dia|fecha) es\b|\ba que estamos\b/.test(dicho)) {
            const fecha = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
            return { texto: "Hoy es " + fecha + ".", decir: "Hoy es " + fecha };
        }
        return null;
    }

    // ---------- Órdenes ----------
    const PANTALLAS = { pedido: "Pedidos", menu: "Inicio", comercios: "Comercios", catalogo: "Catálogo", rutas: "Rutas", estadisticas: "Estadísticas", cierre: "Cierre del día", historial: "Historial", productos: "Catálogo" };

    function contarOrden(orden) {
        const nombre = orden.comercio && orden.comercio.nombre;
        switch (orden.accion) {
            case "nuevoPedido": return nombre ? "Abro un pedido para " + nombre + "." : "Abro un pedido nuevo.";
            case "ir": return "Te llevo a " + nombre + ".";
            case "visitado": return "Marco " + nombre + " como visitado.";
            case "ficha": return "Abro la ficha de " + nombre + ".";
            case "pantalla": return "Abro " + (PANTALLAS[orden.pantalla] || "esa pantalla") + ".";
            case "proximaParada": return "Te llevo a la próxima parada.";
            case "llegue": return "Listo, sigo con la próxima parada.";
            default: return "";
        }
    }

    // ---------- Charla ----------
    function htmlBurbuja(item) {
        if (item.quien === "yo") return `<div class="burbuja burbujaYo">${p.esc(item.texto)}</div>`;
        if (item.error) return `<div class="burbuja burbujaApp burbujaError">${p.esc(item.texto)}</div>`;
        const maximo = Math.max(1, ...(item.barras || []).map(barra => barra.valor));
        const barras = (item.barras || []).length > 1 ? `<div class="miniBarras" role="img" aria-label="${p.esc(item.barras.map(barra => barra.etiqueta + ": " + barra.valor).join(", "))}">${item.barras.map((barra, indice) =>
            `<span class="${indice === item.barras.length - 1 ? "barraFinal" : ""}" style="height:${Math.max(6, Math.round(barra.valor / maximo * 100))}%"><small>${p.esc(barra.etiqueta)}</small></span>`).join("")}</div>` : "";
        const pasos = (item.pasos || []).length ? `<ol class="pasosAsistente">${item.pasos.map(paso => `<li>${p.esc(paso)}</li>`).join("")}</ol>` : "";
        const [antes, ...resto] = String(item.texto || "").split(item.destacado || "\u0000");
        const texto = item.destacado && resto.length
            ? p.esc(antes) + `<strong>${p.esc(item.destacado)}</strong>` + p.esc(resto.join(item.destacado))
            : (item.destacado ? `<strong>${p.esc(item.destacado)}</strong>` : "") + p.esc(item.texto);
        return `<div class="burbuja burbujaApp">${texto}${pasos}${barras}</div>`;
    }

    function dibujar() {
        if (!hoja || !hoja.isConnected) return;
        const lugar = hoja.querySelector(".charla");
        lugar.innerHTML = (charla.length ? charla.map(htmlBurbuja).join("")
            : `<div class="burbuja burbujaApp">Hola. Decime qué necesitás: cargo pedidos, te digo cómo vas y te explico cómo se usa la app.</div>`)
            + (esperando ? `<div class="burbuja burbujaApp burbujaPensando" aria-label="Pensando"><span></span><span></span><span></span></div>` : "");
        lugar.scrollTop = lugar.scrollHeight;
        const estado = hoja.querySelector(".estadoAsistente");
        estado.textContent = escuchando ? "Te escucho…" : "";
        hoja.querySelector(".botonHablarAsistente")?.classList.toggle("escuchando", escuchando);
    }

    function contestar(item) {
        charla.push({ quien: "app", ...item });
        dibujar();
        hablar(item.decir || [item.destacado, item.texto].filter(Boolean).join(" "));
    }

    function dejarDeEscuchar() {
        if (!escuchando) return;
        escuchando = false;
        window.vozVendeFrio?.detener?.();
    }

    async function responder(texto, alternativas = []) {
        const pedido = String(texto || "").trim();
        if (!pedido || esperando) return;
        dejarDeEscuchar();
        charla.push({ quien: "yo", texto: pedido });
        dibujar();
        const voz = window.vozVendeFrio;
        const dicho = normalizar(pedido);

        // 1. Sus números, al toque.
        const local = respuestaLocal(pedido);
        if (local) return contestar(local);

        // 2. Las órdenes ("¿cómo llego a…?" también es una orden).
        const comoHago = /^(como|que hago|para que|donde (se|esta|encuentro))\b/.test(dicho) && !/\bcomo (llego|voy|se llega)\b/.test(dicho);
        if (!comoHago && voz?.interpretar) {
            const frase = [pedido, ...alternativas].find(opcion => {
                const orden = voz.interpretar(opcion);
                return orden && orden.accion !== "noEncontrado";
            });
            if (frase) return hacer(voz.interpretar(frase));
        }

        // 3. Cómo se usa la app.
        const tema = window.ayudaVendeFrio?.buscar(pedido);
        if (tema) return contestar({ texto: tema.titulo + ":", pasos: tema.pasos, decir: tema.titulo + ". " + tema.pasos.join(" ") });

        const noEncontrado = voz?.interpretar?.(pedido);

        // 4. La IA, si está prendida.
        if (window.vozVendeFrio && (preferencias().iaNube || preferencias().iaCelular)) {
            esperando = true;
            dibujar();
            try {
                const orden = !comoHago ? await voz.interpretarConIA?.(pedido) : null;
                if (orden) {
                    esperando = false;
                    return hacer(orden);
                }
                if (iaNube() && window.preguntaleVendeFrio?.preguntarALaNube) {
                    const resultado = await window.preguntaleVendeFrio.preguntarALaNube(pedido, datosParaLaIA(), charla.slice(0, -1));
                    esperando = false;
                    return contestar({ texto: resultado.respuesta, destacado: resultado.destacado, barras: resultado.barras });
                }
            } catch (error) {
                esperando = false;
                return contestar({ texto: error.message || "No pude contestar. Probá de nuevo.", error: true });
            }
            esperando = false;
        }

        if (noEncontrado && noEncontrado.accion === "noEncontrado") {
            return contestar({ texto: "No encontré el comercio «" + noEncontrado.texto + "». Fijate cómo está escrito en Comercios." });
        }
        contestar({
            texto: "No entendí «" + pedido + "». Probá con «nuevo pedido para…», «¿cuánto vendí hoy?» o «¿cómo registro un cobro?»."
                + (iaNube() ? "" : " Con la IA prendida (Más › Preferencias de trabajo › Voz con IA) entiendo mucho más."),
            decir: "No entendí. Probá de nuevo"
        });
    }

    function datosParaLaIA() {
        const guia = "## Cómo se usa la app\n" + (window.ayudaVendeFrio?.guiaEnTexto?.() || "");
        const numeros = vePlata() && window.preguntaleVendeFrio?.resumen ? window.preguntaleVendeFrio.resumen() : "Quien pregunta no tiene permiso para ver la plata: no des montos.";
        return numeros + "\n\n" + guia;
    }

    function hacer(orden) {
        const texto = contarOrden(orden);
        charla.push({ quien: "app", texto });
        hablar(texto);
        cerrar();
        if (typeof mostrarToast === "function" && texto) mostrarToast(texto);
        window.vozVendeFrio?.ejecutarOrden?.(orden);
    }

    // ---------- La ventana ----------
    function escucharAhora() {
        const voz = window.vozVendeFrio;
        if (!voz?.disponible || escuchando) return;
        callar();
        escuchando = true;
        dibujar();
        const campo = hoja?.querySelector("#textoAsistente");
        voz.escuchar({
            alParcial: parcial => { if (campo) campo.value = parcial; },
            alError: () => { escuchando = false; dibujar(); },
            alFinal: (final, alternativas = []) => {
                escuchando = false;
                if (campo) campo.value = "";
                dibujar();
                if (final) responder(final, alternativas);
            }
        });
    }

    function abrir({ escuchar = true } = {}) {
        escuchando = false;
        esperando = false;
        hoja = p.hoja({
            titulo: "Asistente",
            clase: "hojaAsistente",
            html: `<div class="charla" aria-live="polite"></div>
                <p class="estadoAsistente" role="status"></p>
                <div class="sugerencias">${SUGERENCIAS.map(texto => `<button type="button" class="pzFiltro" data-sugerencia="${p.esc(texto)}">${p.esc(texto)}</button>`).join("")}</div>
                <form class="entradaAsistente">
                    <input type="text" id="textoAsistente" placeholder="Hablá o escribí…" aria-label="Hablale o escribile al Asistente" autocomplete="off" maxlength="500">
                    ${window.vozVendeFrio?.disponible ? `<button type="button" class="botonRedondo botonHablarAsistente" aria-label="Hablar">${p.ico("microfono", 20)}</button>` : ""}
                    <button type="submit" class="botonRedondo" aria-label="Enviar">${p.ico("flechaDerecha", 20)}</button>
                </form>
                <label class="vozAltaAsistente"><input type="checkbox" id="vozAltaAsistente" ${hablaEnVozAlta() ? "checked" : ""}> Contestar en voz alta</label>`
        });
        hoja.addEventListener("submit", evento => {
            evento.preventDefault();
            const campo = hoja.querySelector("#textoAsistente");
            const texto = campo.value;
            campo.value = "";
            responder(texto);
        });
        hoja.addEventListener("click", evento => {
            const sugerencia = evento.target.closest("[data-sugerencia]");
            if (sugerencia) responder(sugerencia.dataset.sugerencia);
            if (evento.target.closest(".botonHablarAsistente")) escucharAhora();
        });
        hoja.querySelector("#vozAltaAsistente").addEventListener("change", evento => cambiarVozAlta(evento.target.checked));
        dibujar();
        if (escuchar) escucharAhora();
    }

    function cerrar() {
        escuchando = false;
        window.vozVendeFrio?.detener?.();
        if (hoja && hoja.isConnected) p.cerrar();
        hoja = null;
    }

    // ---------- El botón de Inicio ----------
    function agregarBoton() {
        if (document.getElementById("botonAsistente")) return;
        const avatar = document.getElementById("botonAvatar");
        if (!avatar) return;
        const boton = document.createElement("button");
        boton.type = "button";
        boton.id = "botonAsistente";
        boton.className = "botonVozInicio botonAsistente";
        boton.setAttribute("aria-label", "Asistente");
        boton.title = "Asistente";
        boton.innerHTML = p.ico("chispa", 22);
        boton.addEventListener("click", () => abrir());
        avatar.before(boton);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", agregarBoton);
    else agregarBoton();

    window.asistenteVendeFrio = { abrir, cerrar, responder, respuestaLocal };
}());
