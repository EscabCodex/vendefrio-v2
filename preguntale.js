// VendeFrío - Preguntale a VendeFrío (T91).
// Más > "Preguntale a VendeFrío": el dueño pregunta con sus palabras (o con
// la voz) y la IA en la nube (api/preguntar.js) contesta con un resumen de
// los números que arma este celular: ventas por mes, por producto, por
// comercio y por vendedor, lo que deben y el stock bajo. Solo con la cuenta
// del dueño y con «IA en la nube» prendida (Más > Trabajo > Voz con IA).
(function () {
    "use strict";

    const p = window.piezas;
    const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const SUGERENCIAS = ["¿Cuánto vendí este mes?", "¿Quién me debe más?", "¿Qué comercio compró menos?", "¿Qué producto se vende más?"];

    let charla = [];
    let esperando = false;

    function iaPrendida() {
        try {
            return JSON.parse(localStorage.getItem("vendefrio_preferencias") || "{}").iaNube === true;
        } catch (error) {
            return false;
        }
    }

    function puedeVer() {
        return Boolean(p.refNube()) && p.esDueno();
    }

    function plataTexto(numero) {
        return "$ " + Math.round(Number(numero) || 0).toLocaleString("es-AR");
    }

    function sumar(mapa, clave, monto, unidades) {
        const fila = mapa.get(clave) || { monto: 0, unidades: 0, pedidos: 0 };
        fila.monto += monto;
        fila.unidades += unidades;
        fila.pedidos += 1;
        mapa.set(clave, fila);
    }

    function top(mapa, cuantos) {
        return [...mapa.entries()].sort((a, b) => b[1].monto - a[1].monto).slice(0, cuantos)
            .map(([nombre, fila]) => "- " + nombre + ": " + plataTexto(fila.monto) + ", " + fila.unidades + " u, " + fila.pedidos + " pedidos");
    }

    // El resumen que ve la IA: corto, en texto y solo con números.
    function resumen() {
        const ahora = new Date();
        const lineas = ["Hoy es " + ahora.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + "."];
        const historial = (typeof obtenerHistorial === "function" ? obtenerHistorial() : [])
            .filter(pedido => pedido && pedido.eliminado !== true && pedido.estado !== "cancelado");
        const meses = [];
        for (let atras = 0; atras < 4; atras++) {
            const desde = new Date(ahora.getFullYear(), ahora.getMonth() - atras, 1).getTime();
            const hasta = new Date(ahora.getFullYear(), ahora.getMonth() - atras + 1, 1).getTime();
            meses.push({ nombre: MESES[new Date(desde).getMonth()] + " " + new Date(desde).getFullYear(), desde, hasta });
        }
        const marcasPorProducto = new Map();
        meses.forEach((mes, indice) => {
            const pedidos = historial.filter(pedido => Number(pedido.timestamp) >= mes.desde && Number(pedido.timestamp) < mes.hasta);
            const productos = new Map();
            const marcas = new Map();
            const comercios = new Map();
            const vendedores = new Map();
            let total = 0;
            let unidades = 0;
            pedidos.forEach(pedido => {
                const monto = typeof totalDelPedido === "function" ? Number(totalDelPedido(pedido)?.total || 0) : 0;
                const cantidad = (pedido.productos || []).reduce((suma, linea) => suma + (Number(linea.cantidad) || 0), 0);
                total += monto;
                unidades += cantidad;
                sumar(comercios, String(pedido.comercio || "Sin comercio"), monto, cantidad);
                const vendedor = pedido.autor && pedido.autor.nombre;
                if (vendedor) sumar(vendedores, vendedor, monto, cantidad);
                (pedido.productos || []).forEach(linea => {
                    const cantidadLinea = Number(linea.cantidad) || 0;
                    const montoLinea = cantidadLinea * (Number(linea.precio) || 0);
                    sumar(productos, linea.producto + " (" + linea.marca + ")", montoLinea, cantidadLinea);
                    sumar(marcas, String(linea.marca || ""), montoLinea, cantidadLinea);
                    marcasPorProducto.set(linea.producto, linea.marca);
                });
            });
            lineas.push("", "## " + (indice === 0 ? "Este mes, " : "") + mes.nombre + (indice === 0 ? " (hasta hoy)" : ""),
                "Vendido: " + plataTexto(total) + " en " + pedidos.length + " pedidos, " + unidades + " unidades, " + comercios.size + " comercios.");
            if (!pedidos.length) return;
            lineas.push("Por marca:", ...top(marcas, 10));
            lineas.push("Productos:", ...top(productos, indice === 0 ? 25 : 12));
            lineas.push("Comercios:", ...top(comercios, indice === 0 ? 40 : 15));
            if (vendedores.size) lineas.push("Por vendedor:", ...top(vendedores, 10));
        });

        // Comercios que este mes no compraron.
        const delMes = new Set(historial.filter(pedido => Number(pedido.timestamp) >= meses[0].desde).map(pedido => String(pedido.comercio || "")));
        const sinComprar = (typeof obtenerComercios === "function" ? obtenerComercios() : [])
            .filter(comercio => comercio.archivado !== true && !delMes.has(comercio.nombre)).map(comercio => comercio.nombre);
        if (sinComprar.length) lineas.push("", "Comercios que este mes no compraron: " + sinComprar.slice(0, 40).join(", ") + ".");

        const cuentas = window.saldosVendeFrio?.cuentas?.() || [];
        lineas.push("", "## Lo que deben (a cobrar)");
        if (cuentas.length) {
            cuentas.slice(0, 30).forEach(cuenta => lineas.push("- " + cuenta.nombre + ": " + plataTexto(cuenta.total) + " en " + cuenta.pedidos.length + " pedidos"
                + (cuenta.tope ? ", tope " + plataTexto(cuenta.tope) + (cuenta.pasoTope ? " (pasó el tope)" : "") : "")
                + ", desde el " + new Date(cuenta.desde || Date.now()).toLocaleDateString("es-AR")));
        } else {
            lineas.push("Nadie debe nada.");
        }

        const stock = (window.stockVendeFrio?.todos?.() || []).filter(item => item.estado);
        if (stock.length) {
            lineas.push("", "## Stock");
            stock.slice(0, 40).forEach(({ producto, estado }) => lineas.push("- " + producto.nombre + " (" + producto.marca + "): hay " + estado.hay + " u, " + estado.reservadas + " reservadas" + (estado.nivel !== "ok" ? " (poco)" : "")));
        }
        return lineas.join("\n");
    }

    async function preguntarALaNube(pregunta) {
        const usuario = window.firebase?.auth?.().currentUser;
        if (!usuario) throw new Error("Entrá con la cuenta de la distribuidora para preguntar.");
        const respuesta = await fetch("/api/preguntar", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + await usuario.getIdToken() },
            body: JSON.stringify({ pregunta, datos: resumen(), charla: charla.slice(-6).map(({ quien, texto }) => ({ quien, texto })) })
        });
        const cuerpo = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok || !cuerpo.resultado) {
            throw new Error(cuerpo.codigo === "sinConfigurar" ? "Falta configurar la IA en Vercel."
                : respuesta.status === 429 ? "Muchas preguntas seguidas. Esperá un minuto."
                    : respuesta.status === 401 ? "Tu sesión venció: salí de la cuenta y volvé a entrar."
                        : "La IA no pudo contestar. Probá de nuevo.");
        }
        return cuerpo.resultado;
    }

    // ---------- Pantalla ----------
    function htmlBurbuja(item) {
        if (item.quien === "yo") return `<div class="burbuja burbujaYo">${p.esc(item.texto)}</div>`;
        if (item.error) return `<div class="burbuja burbujaApp burbujaError">${p.esc(item.texto)}</div>`;
        const maximo = Math.max(1, ...(item.barras || []).map(barra => barra.valor));
        const barras = (item.barras || []).length > 1 ? `<div class="miniBarras" role="img" aria-label="${p.esc(item.barras.map(barra => barra.etiqueta + ": " + barra.valor).join(", "))}">${item.barras.map((barra, indice) =>
            `<span class="${indice === item.barras.length - 1 ? "barraFinal" : ""}" style="height:${Math.max(6, Math.round(barra.valor / maximo * 100))}%"><small>${p.esc(barra.etiqueta)}</small></span>`).join("")}</div>` : "";
        const [antes, ...resto] = String(item.texto || "").split(item.destacado || "\u0000");
        const texto = item.destacado && resto.length
            ? p.esc(antes) + `<strong>${p.esc(item.destacado)}</strong>` + p.esc(resto.join(item.destacado))
            : (item.destacado ? `<strong>${p.esc(item.destacado)}</strong>` : "") + p.esc(item.texto);
        return `<div class="burbuja burbujaApp">${texto}${barras}</div>`;
    }

    function dibujar() {
        const seccion = document.getElementById("pantallaPreguntale");
        if (!seccion) return;
        const main = seccion.querySelector("main");
        const aviso = iaPrendida() ? "" : `<div class="pzBanner pzBanInfo" id="avisoIaApagada">${p.ico("chispa", 22)}<div><strong>Prendé la IA en la nube</strong><small>Más › Trabajo › Voz con IA › «IA en la nube». Usa la misma clave que la voz.</small></div></div>`;
        main.innerHTML = aviso + `
            <div class="charla" aria-live="polite">${charla.length ? charla.map(htmlBurbuja).join("") : `<div class="burbuja burbujaApp">Preguntame lo que quieras de tus ventas, cobros o stock. Contesto con los números de la app.</div>`}
                ${esperando ? `<div class="burbuja burbujaApp burbujaPensando"><span></span><span></span><span></span></div>` : ""}</div>
            <div class="sugerencias">${SUGERENCIAS.map(texto => `<button type="button" class="pzFiltro" data-sugerencia="${p.esc(texto)}">${p.esc(texto)}</button>`).join("")}</div>
            <form class="entradaPregunta">
                <input type="text" id="textoPregunta" placeholder="Escribí o hablá…" aria-label="Tu pregunta" autocomplete="off" maxlength="500">
                ${window.vozVendeFrio?.disponible ? `<button type="button" class="botonRedondo botonVozPregunta" aria-label="Preguntar con la voz">${p.ico("microfono", 20)}</button>` : ""}
                <button type="submit" class="botonRedondo" aria-label="Preguntar">${p.ico("flechaDerecha", 20)}</button>
            </form>`;
        main.querySelector(".charla").lastElementChild?.scrollIntoView({ block: "end" });
    }

    async function preguntar(texto) {
        const pregunta = String(texto || "").trim();
        if (!pregunta || esperando) return;
        charla.push({ quien: "yo", texto: pregunta });
        esperando = true;
        dibujar();
        try {
            if (!iaPrendida()) throw new Error("Prendé «IA en la nube» en Más › Trabajo para preguntar.");
            const resultado = await preguntarALaNube(pregunta);
            charla.push({ quien: "app", texto: resultado.respuesta, destacado: resultado.destacado, barras: resultado.barras });
        } catch (error) {
            charla.push({ quien: "app", texto: error.message, error: true });
        }
        esperando = false;
        dibujar();
    }

    function abrir() {
        const seccion = p.pantalla("pantallaPreguntale", { titulo: "Preguntale a VendeFrío", sub: "Ventas, cobros y stock, con tus palabras", volverA: "mas" });
        if (!seccion.dataset.listo) {
            seccion.dataset.listo = "1";
            seccion.addEventListener("submit", evento => {
                evento.preventDefault();
                const campo = seccion.querySelector("#textoPregunta");
                const texto = campo.value;
                campo.value = "";
                preguntar(texto);
            });
            seccion.addEventListener("click", evento => {
                const sugerencia = evento.target.closest("[data-sugerencia]");
                if (sugerencia) preguntar(sugerencia.dataset.sugerencia);
                if (evento.target.closest(".botonVozPregunta")) {
                    const boton = evento.target.closest(".botonVozPregunta");
                    boton.classList.add("escuchando");
                    window.vozVendeFrio.escuchar({
                        alParcial: texto => { const campo = seccion.querySelector("#textoPregunta"); if (campo) campo.value = texto; },
                        alFinal: texto => { boton.classList.remove("escuchando"); preguntar(texto); },
                        alError: () => boton.classList.remove("escuchando")
                    });
                }
            });
        }
        p.mostrar(seccion);
        dibujar();
    }

    (window.accesosMasExtras = window.accesosMasExtras || []).push({
        destino: "preguntale", icono: "chispa", texto: "Preguntale a VendeFrío",
        mostrar: puedeVer,
        abrir
    });

    window.preguntaleVendeFrio = { abrir, resumen, preguntar };
}());
