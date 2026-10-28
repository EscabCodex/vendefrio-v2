// VendeFrío - Para el dueño (T80, T81, T83).
// En Estadísticas: "Se están enfriando" (comercios que dejaron de pedir, con
// WhatsApp) y "Metas del mes" por vendedor (`metas/`). En Más: "Mapa de
// ventas" con cada comercio pintado según lo que compró este mes.
(function () {
    "use strict";

    const p = window.piezas;
    const extras = window.extrasVendeFrio;
    const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const BUENO = 80000;
    const FLOJO = 20000;

    extras.registrar("metas", {
        describir: meta => ({ titulo: "Metas", nombre: meta.mes || "", detalle: "" })
    });

    const claveMes = (fecha = new Date()) => fecha.getFullYear() + "-" + String(fecha.getMonth() + 1).padStart(2, "0");

    function totalPedido(pedido) {
        return typeof totalDelPedido === "function" ? Number(totalDelPedido(pedido)?.total || 0) : 0;
    }

    function fechaPedido(pedido) {
        const fecha = typeof obtenerFechaRegistro === "function" ? obtenerFechaRegistro(pedido) : new Date(Number(pedido.timestamp || 0));
        return fecha instanceof Date && !Number.isNaN(fecha.getTime()) ? fecha : null;
    }

    function pedidosDelMes() {
        const inicio = new Date(); inicio.setDate(1); inicio.setHours(0, 0, 0, 0);
        // Solo se lee (T168): la lista compartida, sin volver a leer el historial.
        const lista = typeof pedidosDelHistorialParaLeer === "function" ? pedidosDelHistorialParaLeer()
            : typeof obtenerPedidosDelHistorial === "function" ? obtenerPedidosDelHistorial() : [];
        return lista.filter(pedido => { const fecha = fechaPedido(pedido); return fecha && fecha >= inicio; });
    }

    // Plata en millones o miles, corta: "$ 1,95 M", "$ 850 mil".
    function plataCorta(valor) {
        const numero = Number(valor) || 0;
        if (numero >= 1000000) return "$ " + (Math.round(numero / 10000) / 100).toLocaleString("es-AR") + " M";
        if (numero >= 10000) return "$ " + Math.round(numero / 1000).toLocaleString("es-AR") + " mil";
        return p.plata(numero);
    }

    function enlaceWhatsapp(nombre, texto) {
        const comercio = typeof buscarComercioPorNombre === "function" ? buscarComercioPorNombre(nombre) : null;
        const base = comercio && window.yaLlegoVendeFrio ? window.yaLlegoVendeFrio.enlace(comercio, 0) : "";
        return base ? base.split("?")[0] + "?text=" + encodeURIComponent(texto) : "";
    }

    // ---------- Se están enfriando (T80) ----------
    let verTodosEnfriando = false;

    function cadaCuanto(dias) {
        if (dias >= 6 && dias <= 8) return "cada semana";
        if (dias >= 13 && dias <= 16) return "cada dos semanas";
        return "cada " + dias + (dias === 1 ? " día" : " días");
    }

    function tarjetaEnfriando(historial, completo) {
        const estadisticas = window.estadisticasVendeFrio;
        if (!estadisticas || typeof obtenerPerfilesComerciales !== "function") return null;
        const lista = completo || historial;
        const enfriando = (estadisticas.perfilesDe ? estadisticas.perfilesDe(lista) : obtenerPerfilesComerciales(lista))
            .filter(perfil => perfil.atrasado && perfil.nombre !== "Sin comercio")
            .sort((a, b) => (b.diasDesdeUltimo / b.promedioDias) - (a.diasDesdeUltimo / a.promedioDias));
        if (!enfriando.length) return null;
        const card = estadisticas.tarjeta("alerta", "naranja", "Se están enfriando", "Pedían seguido y dejaron de pedir", "statsEnfriando");
        const mostrar = verTodosEnfriando ? enfriando : enfriando.slice(0, 3);
        const distribuidora = window.distribuidoraVendeFrio?.nombreActual?.() || "";
        const filas = mostrar.map(perfil => {
            const enlace = enlaceWhatsapp(perfil.nombre, "¡Hola! " + (distribuidora ? "Te escribo de " + distribuidora + ". " : "") + "Hace unos días que no te vemos, ¿te preparo un pedido?");
            return `<div class="statsFila filaEnfriando" data-ficha="${p.esc(perfil.nombre)}">
                <span class="pzIni ${p.colorIni(perfil.nombre)}">${p.esc(p.iniciales(perfil.nombre))}</span>
                <div class="statsFilaTexto"><strong>${p.esc(perfil.nombre)}</strong><small>Pedía ${cadaCuanto(perfil.promedioDias)} · hace ${perfil.diasDesdeUltimo} días que no</small></div>
                ${enlace ? `<a class="botonWaEnfriando" href="${enlace}" target="_blank" rel="noopener" aria-label="WhatsApp a ${p.esc(perfil.nombre)}">${p.ico("whatsapp", 20)}</a>`
                    : window.agregarDatoVendeFrio && typeof buscarComercioPorNombre === "function" && buscarComercioPorNombre(perfil.nombre)
                        ? `<button type="button" class="botonWaEnfriando agregarTelEnfriando" data-agregar-dato="telefono" data-comercio="${p.esc(perfil.nombre)}" aria-label="Agregar teléfono de ${p.esc(perfil.nombre)}">${p.ico("mas", 20)}</button>` : ""}
            </div>`;
        }).join("");
        const verTodos = enfriando.length > 3 && !verTodosEnfriando
            ? `<button type="button" class="pzEnlace verTodosEnfriando">Ver los ${enfriando.length}</button>` : "";
        card.insertAdjacentHTML("beforeend", `<div class="statsLista">${filas}</div>${verTodos}`);
        // Repasada: tocar el comercio abre su ficha (el WhatsApp sigue aparte).
        if (window.abrirFichaComercio) card.querySelectorAll("[data-ficha]").forEach(fila => {
            p.tocable(fila, () => window.abrirFichaComercio(fila.dataset.ficha), { rol: false });
        });
        card.querySelector(".verTodosEnfriando")?.addEventListener("click", () => {
            verTodosEnfriando = true;
            estadisticas.redibujar();
        });
        return card;
    }

    // ---------- Metas del mes (T81) ----------
    function metasDelMes() {
        const doc = extras.lista("metas").find(item => item.id === claveMes());
        return doc && doc.metas && typeof doc.metas === "object" ? doc.metas : {};
    }

    // Lo vendido este mes por cada persona que cargó pedidos.
    function vendidoPorPersona() {
        const porPersona = {};
        pedidosDelMes().forEach(pedido => {
            const autor = pedido.autor && typeof pedido.autor === "object" ? pedido.autor : null;
            if (!autor || !autor.idPersona) return;
            if (!porPersona[autor.idPersona]) porPersona[autor.idPersona] = { nombre: autor.nombre || "", total: 0 };
            porPersona[autor.idPersona].total += totalPedido(pedido);
        });
        return porPersona;
    }

    // Quiénes pueden tener meta: los que cargaron pedidos en los últimos
    // 60 días, el dueño y los que ya tienen.
    function equipo() {
        const desde = Date.now() - 60 * 86400000;
        const personas = {};
        const yo = p.persona();
        if (yo && yo.idPersona) personas[yo.idPersona] = yo.nombre;
        (typeof historialParaLeer === "function" ? historialParaLeer() : []).forEach(pedido => {
            const autor = pedido && pedido.autor;
            const fecha = fechaPedido(pedido);
            if (autor && autor.idPersona && fecha && fecha.getTime() >= desde) personas[autor.idPersona] = autor.nombre || personas[autor.idPersona];
        });
        Object.entries(metasDelMes()).forEach(([id, meta]) => { personas[id] = personas[id] || meta.nombre; });
        return Object.entries(personas).map(([idPersona, nombre]) => ({ idPersona, nombre: String(nombre || "Sin nombre") }));
    }

    function tarjetaMetas() {
        const estadisticas = window.estadisticasVendeFrio;
        if (!estadisticas || !(typeof usaNubeReal === "function" && usaNubeReal())) return null;
        const metas = metasDelMes();
        const ids = Object.keys(metas).filter(id => Number(metas[id].monto) > 0);
        const esDueno = p.esDueno();
        if (!ids.length && !esDueno) return null;
        const mes = MESES[new Date().getMonth()];
        const card = estadisticas.tarjeta("bandera", "verde", "Metas de " + mes, window.verPlataVendeFrio?.puedoVer?.() === false ? "Cuánto le falta a cada uno" : "Lo vendido este mes por cada uno", "statsMetas");
        if (esDueno) card.querySelector(".statsCabeza").insertAdjacentHTML("beforeend", `<button type="button" class="pzEnlace editarMetas">${ids.length ? "Editar" : "Poner metas"}</button>`);
        const vendido = vendidoPorPersona();
        // T93: sin permiso para ver la plata, solo el porcentaje.
        const vePlata = window.verPlataVendeFrio?.puedoVer?.() !== false;
        const filas = ids.map(id => {
            const meta = Number(metas[id].monto);
            const total = vendido[id] ? vendido[id].total : 0;
            const porcentaje = Math.round(total / meta * 100);
            return `<div class="filaMeta">
                <div class="filaMetaCab"><strong>${p.esc(metas[id].nombre || (vendido[id] && vendido[id].nombre) || "")}</strong><b>${porcentaje} %</b></div>
                <span class="barraMeta${porcentaje >= 100 ? " cumplida" : ""}"><i style="width:${Math.min(100, porcentaje)}%"></i></span>
                ${vePlata ? `<small>${plataCorta(total)} de ${plataCorta(meta)}</small>` : ""}
            </div>`;
        }).join("");
        card.insertAdjacentHTML("beforeend", ids.length
            ? `<div class="statsLista listaMetas">${filas}</div>`
            : estadisticas.vacio("Poné una meta de ventas del mes para cada vendedor y mirá cómo van."));
        card.querySelector(".editarMetas")?.addEventListener("click", editarMetas);
        return card;
    }

    function editarMetas() {
        const metas = metasDelMes();
        const personas = equipo();
        const mes = MESES[new Date().getMonth()];
        p.hoja({
            titulo: "Metas de " + mes,
            sub: "Cuánto querés que venda cada uno este mes",
            etiqueta: "Metas del mes",
            html: personas.map((persona, i) => `<label class="pzCampo campoMeta"><span>${p.esc(persona.nombre)}</span>
                <input type="number" inputmode="numeric" min="0" step="10000" data-meta="${p.esc(persona.idPersona)}" data-nombre="${p.esc(persona.nombre)}" placeholder="Sin meta" value="${Number(metas[persona.idPersona]?.monto) || ""}" aria-label="Meta de ${p.esc(persona.nombre)}" ${i === 0 ? "" : ""}>
            </label>`).join(""),
            botones: [{
                texto: "Guardar metas",
                icono: "check",
                alTocar: caja => {
                    const nuevas = {};
                    caja.querySelectorAll("[data-meta]").forEach(campo => {
                        const monto = Math.round(Number(campo.value) || 0);
                        if (monto > 0) nuevas[campo.dataset.meta] = { nombre: campo.dataset.nombre.slice(0, 60), monto: Math.min(monto, 10000000000) };
                    });
                    extras.guardar("metas", { mes: claveMes(), metas: nuevas, horaCelular: Date.now() }, claveMes());
                    mostrarToast("Metas guardadas");
                    setTimeout(() => window.estadisticasVendeFrio?.redibujar(), 100);
                    return true;
                }
            }]
        });
    }

    (window.tarjetasEstadisticasExtra = window.tarjetasEstadisticasExtra || []).unshift(tarjetaMetas);
    window.tarjetasEstadisticasExtra.unshift(tarjetaEnfriando);
    extras.escuchar("metas", () => window.estadisticasVendeFrio?.redibujar());

    // ---------- Mapa de ventas (T83) ----------
    let mapa = null;
    let capa = null;

    function ventasPorComercio() {
        const porComercio = {};
        pedidosDelMes().forEach(pedido => {
            const nombre = String(pedido.comercio || "").trim().toLocaleLowerCase("es");
            porComercio[nombre] = (porComercio[nombre] || 0) + totalPedido(pedido);
        });
        const comercios = typeof comerciosParaLeer === "function" ? comerciosParaLeer() : [];
        return comercios
            .filter(comercio => comercio.archivado !== true && comercio.lat !== "" && comercio.lng !== "" &&
                Number.isFinite(Number(comercio.lat)) && Number.isFinite(Number(comercio.lng)) && comercio.lat !== null)
            .map(comercio => {
                const total = porComercio[String(comercio.nombre).trim().toLocaleLowerCase("es")] || 0;
                return { comercio, total, nivel: total >= BUENO ? "bueno" : total >= FLOJO ? "medio" : "flojo" };
            });
    }

    function abrirMapa() {
        const mes = MESES[new Date().getMonth()];
        const seccion = p.pantalla("pantallaMapaVentas", { titulo: "Ventas de " + mes, sub: "Cada comercio según lo que compró este mes", icono: "mapa", volverA: "mas" });
        if (!seccion.querySelector("#mapaVentas")) {
            seccion.querySelector("main").innerHTML = `<div class="pzMapa pzMapaVentas" id="mapaVentas"></div>
                <div class="pzTarjeta leyendaVentas">
                    <span><i class="puntoVentas bueno"></i>Más de ${plataCorta(BUENO)}</span>
                    <span><i class="puntoVentas medio"></i>${plataCorta(FLOJO).replace(" mil", "")} a ${plataCorta(BUENO)}</span>
                    <span><i class="puntoVentas flojo"></i>Menos</span>
                </div>
                <div id="resumenMapaVentas"></div>`;
        }
        p.mostrar(seccion);
        dibujarMapa();
    }

    function dibujarMapa() {
        const seccion = document.getElementById("pantallaMapaVentas");
        if (!seccion || seccion.classList.contains("oculto")) return;
        const lista = ventasPorComercio();
        const flojos = lista.filter(item => item.nivel === "flojo");
        const resumen = seccion.querySelector("#resumenMapaVentas");
        resumen.innerHTML = !lista.length
            ? `<div class="pzBanner pzBanInfo">${p.ico("ubicacion", 22)}<div><strong>Todavía no hay comercios con ubicación</strong><small>Guardá la ubicación desde la ficha de cada comercio (en la puerta, «Guardar ubicación»).</small></div></div>`
            : flojos.length
                ? `<button type="button" class="pzBanner pzBanPeligro" id="verFlojos">${p.ico("ubicacion", 22)}<div><strong>${flojos.length === 1 ? "Un comercio flojo" : flojos.length + " comercios flojos"} este mes</strong><small>Compraron menos de ${plataCorta(FLOJO)}</small></div>${p.ico("chevDerecha", 20)}</button>`
                : `<div class="pzBanner pzBanOk">${p.ico("check", 22)}<div><strong>Todos compraron más de ${plataCorta(FLOJO)}</strong><small>Este mes, en los comercios con ubicación</small></div></div>`;
        resumen.querySelector("#verFlojos")?.addEventListener("click", () => {
            p.hoja({
                titulo: "Comercios flojos",
                sub: "Compraron menos de " + plataCorta(FLOJO) + " este mes",
                html: `<div class="pzTarjeta pzLista pzEnHoja">${flojos.sort((a, b) => a.total - b.total).map(item => `<button type="button" class="pzFila" data-ficha="${p.esc(item.comercio.nombre)}">
                    <div class="pzIni ${p.colorIni(item.comercio.nombre)}">${p.esc(p.iniciales(item.comercio.nombre))}</div>
                    <div class="pzFilaTxt"><strong>${p.esc(item.comercio.nombre)}</strong><small>${p.esc(item.comercio.direccion || "")}</small></div>
                    <b class="pzMonto">${p.plata(item.total)}</b>
                </button>`).join("")}</div>`
            }).addEventListener("click", evento => {
                const fila = evento.target.closest("[data-ficha]");
                if (!fila) return;
                p.cerrar();
                window.abrirFichaComercio?.(fila.dataset.ficha);
            });
        });

        const caja = seccion.querySelector("#mapaVentas");
        if (!window.mapaVendeFrio?.disponible?.() || !lista.length) {
            caja.classList.toggle("pzOcultar", !lista.length || !window.mapaVendeFrio?.disponible?.());
            return;
        }
        caja.classList.remove("pzOcultar");
        if (!mapa) mapa = window.mapaVendeFrio.crearMapa(caja, { centro: [Number(lista[0].comercio.lat), Number(lista[0].comercio.lng)], zoom: 14, zoomControl: false });
        if (capa) capa.remove();
        capa = L.layerGroup().addTo(mapa);
        const colores = { bueno: "#14804A", medio: "#E0A100", flojo: "#D93636" };
        lista.forEach(item => {
            const punto = [Number(item.comercio.lat), Number(item.comercio.lng)];
            L.circle(punto, { radius: 120, stroke: false, fillColor: colores[item.nivel], fillOpacity: 0.16, interactive: false }).addTo(capa);
            L.circleMarker(punto, { radius: 9, color: "#fff", weight: 3, fillColor: colores[item.nivel], fillOpacity: 1 })
                .bindTooltip(item.comercio.nombre + " · " + p.plata(item.total))
                .addTo(capa);
        });
        setTimeout(() => {
            mapa.invalidateSize();
            const puntos = lista.map(item => [Number(item.comercio.lat), Number(item.comercio.lng)]);
            if (puntos.length > 1) mapa.fitBounds(puntos, { padding: [40, 40], maxZoom: 16 });
            else mapa.setView(puntos[0], 15);
        }, 60);
    }

    (window.accesosMasExtras = window.accesosMasExtras || []).push({
        destino: "mapaVentas", icono: "mapa", texto: "Mapa de ventas",
        mostrar: () => p.esDueno() || !(typeof usaNubeReal === "function" && usaNubeReal()),
        abrir: abrirMapa
    });

    window.duenoVendeFrio = { tarjetaEnfriando, tarjetaMetas, editarMetas, vendidoPorPersona, abrirMapa, ventasPorComercio };
}());
