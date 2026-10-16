// VendeFrío - Informe completo de estadísticas / rework visual
(function () {
    function ocultarPantallas() {
        document.querySelectorAll('body > section[id^="pantalla"]').forEach(s => s.classList.add("oculto"));
    }

    function crearPantalla() {
        const s = document.createElement("section");
        s.id = "pantallaEstadisticas";
        s.className = "oculto pantallaExtra pantallaEstadisticas";
        s.innerHTML = `<header><div class="logo">${window.icono("grafico",22)}</div><div><h1>Estadísticas</h1><p>Una vista clara de cómo se mueve tu negocio</p></div></header><main class="container"><div class="selectorPeriodoEstadisticas" aria-label="Filtrar estadísticas por período"><button type="button" data-periodo="hoy">Hoy</button><button type="button" data-periodo="semana">Semana</button><button type="button" data-periodo="mes">Mes</button><button type="button" class="activo" data-periodo="todo">Todo</button></div><select id="filtroPeriodoEstadisticas" class="selectorPeriodoOculto" aria-label="Período"><option value="hoy">Hoy</option><option value="semana">Esta semana</option><option value="mes">Este mes</option><option value="todo" selected>Todo</option></select><div id="contenidoEstadisticas" class="informeEstadisticas"></div><button type="button" class="statsPlanilla" id="descargarPlanillaEstadisticas" aria-label="Descargar planilla del período"><span class="ajIcono" data-tono="verde">${window.icono("descargar",20)}</span><span class="statsPlanillaTexto"><strong>Descargar planilla del período</strong><small>Para Excel o tu contador</small></span>${window.icono("chevDerecha",18)}</button></main></section>`;
        document.body.insertBefore(s, document.querySelector("nav.bottom-nav"));
        // Planilla para el contador (T47): todos los pedidos del período
        // (también los que no se entregaron), sin los eliminados.
        s.querySelector("#descargarPlanillaEstadisticas").addEventListener("click", () => {
            const periodo = document.getElementById("filtroPeriodoEstadisticas")?.value || "todo";
            const ahora = new Date();
            const inicio = new Date(ahora); inicio.setHours(0, 0, 0, 0);
            if (periodo === "semana") inicio.setDate(inicio.getDate() - 6);
            if (periodo === "mes") inicio.setDate(1);
            const pedidos = (typeof obtenerHistorial === "function" ? obtenerHistorial() : []).filter(pedido => {
                if (!pedido || pedido.eliminado === true) return false;
                if (periodo === "todo") return true;
                const fecha = fechaPedido(pedido);
                return fecha && fecha >= inicio && fecha <= ahora;
            });
            const nombres = { hoy: "de hoy", semana: "de la semana", mes: "del mes", todo: "todos" };
            window.exportarVendeFrio?.descargar(pedidos, "VendeFrío pedidos " + (nombres[periodo] || "") + " " + ahora.toISOString().slice(0, 10));
        });
        return s;
    }

    function fechaPedido(pedido) {
        const fecha = typeof obtenerFechaRegistro === "function" ? obtenerFechaRegistro(pedido) : new Date(Number(pedido.timestamp || 0));
        return fecha instanceof Date && !Number.isNaN(fecha.getTime()) ? fecha : null;
    }

    function unidadesPedido(pedido) {
        return (pedido.productos || []).reduce((total, item) => total + Number(item.cantidad || 0), 0);
    }

    function obtenerHistorialPeriodo() {
        // Eliminados y cancelados no cuentan (T26) y, en la nube, solo los
        // entregados y los "Histórico" (T27).
        const historial = typeof obtenerPedidosDelHistorial === "function" ? obtenerPedidosDelHistorial() : [];
        const periodo = document.getElementById("filtroPeriodoEstadisticas")?.value || "todo";
        if (periodo === "todo") return historial;
        const ahora = new Date();
        const inicio = new Date(ahora); inicio.setHours(0, 0, 0, 0);
        if (periodo === "semana") inicio.setDate(inicio.getDate() - 6);
        if (periodo === "mes") inicio.setDate(1);
        return historial.filter(pedido => { const fecha = fechaPedido(pedido); return fecha && fecha >= inicio && fecha <= ahora; });
    }

    function estadisticasPeriodo(historial) {
        const comercios = {}, productos = {}, marcas = {};
        historial.forEach(pedido => {
            const comercio = pedido.comercio || "Sin comercio";
            comercios[comercio] = (comercios[comercio] || 0) + 1;
            (pedido.productos || []).forEach(item => {
                const nombre = item.nombre || item.producto || "Producto";
                const marca = item.marca || "Sin marca";
                const cantidad = Number(item.cantidad || 0);
                productos[marca + " - " + nombre] = (productos[marca + " - " + nombre] || 0) + cantidad;
                marcas[marca] = (marcas[marca] || 0) + cantidad;
            });
        });
        const ordenar = datos => Object.entries(datos).sort((a,b) => b[1]-a[1]).slice(0,5);
        const perfiles = typeof obtenerPerfilesComerciales === "function" ? obtenerPerfilesComerciales(historial) : [];
        return { comercios: ordenar(comercios), productos: ordenar(productos), marcas: ordenar(marcas), perfiles, atrasados: perfiles.filter(p => p.atrasado) };
    }

    // --- Estadísticas con el estilo nuevo (T52): todo en tarjetas con
    // título e ícono, números grandes y listas con avatar.
    const ico = (nombre, tam = 18) => (window.icono ? window.icono(nombre, tam) : "");
    const esc = texto => String(texto ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const numero = valor => Number(valor || 0).toLocaleString("es-AR");
    const plata = valor => "$ " + Math.round(Number(valor || 0)).toLocaleString("es-AR");
    const DIAS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
    const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const NOMBRE_PERIODO = { hoy: "Hoy", semana: "Últimos 7 días", mes: "Este mes", todo: "Todo" };

    function periodoElegido() {
        return document.getElementById("filtroPeriodoEstadisticas")?.value || "todo";
    }

    function iniciales(nombre) {
        const partes = String(nombre || "?").trim().split(/\s+/).filter(Boolean);
        return ((partes[0]?.[0] || "?") + (partes[1]?.[0] || "")).toUpperCase();
    }

    function totalPlata(pedido) {
        return typeof totalDelPedido === "function" ? Number(totalDelPedido(pedido)?.total || 0) : 0;
    }

    function tarjeta(icono, tono, titulo, subtitulo, clase = "") {
        const card = document.createElement("section");
        card.className = "statsTarjeta " + clase;
        card.innerHTML = `<div class="statsCabeza"><span class="ajIcono" data-tono="${tono}">${ico(icono)}</span><div><h2>${titulo}</h2>${subtitulo ? `<p>${subtitulo}</p>` : ""}</div></div>`;
        return card;
    }

    function vacio(texto) {
        return `<div class="statsVacio">${ico("grafico", 20)}<span>${texto}</span></div>`;
    }

    function variacion(actual, anterior) {
        if (!anterior && !actual) return `<span class="statsCambio" data-tono="igual">igual</span>`;
        if (!anterior) return `<span class="statsCambio" data-tono="sube">${ico("chevArriba", 13)} nuevo</span>`;
        const cambio = Math.round(((actual - anterior) / anterior) * 100);
        const tono = cambio > 0 ? "sube" : cambio < 0 ? "baja" : "igual";
        const flecha = cambio > 0 ? ico("chevArriba", 13) : cambio < 0 ? ico("chevAbajo", 13) : "";
        return `<span class="statsCambio" data-tono="${tono}">${flecha} ${Math.abs(cambio)}%</span>`;
    }

    // Resumen: pedidos y lo vendido grandes, y tres números con ícono.
    function crearResumen(historial) {
        const total = historial.length;
        const unidades = historial.reduce((t, p) => t + unidadesPedido(p), 0);
        const comercios = new Set(historial.map(p => p.comercio).filter(Boolean)).size;
        const vendido = historial.reduce((t, p) => t + totalPlata(p), 0);
        const promedio = total ? (unidades / total).toFixed(1).replace(".", ",") : "0";
        const card = document.createElement("section");
        card.className = "statsResumen";
        card.innerHTML = `
            <div class="statsResumenTop">
                <div>
                    <small>${ico("calendario", 14)} ${NOMBRE_PERIODO[periodoElegido()] || "Todo"}</small>
                    <strong>${numero(total)}</strong>
                    <span>${total === 1 ? "pedido" : "pedidos"}</span>
                </div>
                ${vendido > 0 ? `<div class="statsVendido"><small>Vendido</small><strong>${plata(vendido)}</strong></div>` : ""}
            </div>
            <div class="statsNumeros">
                <div><span class="statsNumIcono">${ico("tienda", 17)}</span><strong>${numero(comercios)}</strong><small>comercios</small></div>
                <div><span class="statsNumIcono">${ico("paquete", 17)}</span><strong>${numero(unidades)}</strong><small>unidades</small></div>
                <div><span class="statsNumIcono">${ico("ordenar", 17)}</span><strong>${promedio}</strong><small>por pedido</small></div>
            </div>`;
        return card;
    }

    // Pedidos por día en barras redondeadas, con el día de hoy marcado.
    function crearGraficoPedidos(historial) {
        const ahora = new Date();
        const periodo = periodoElegido();
        const cantidadDias = periodo === "mes" ? Math.min(14, ahora.getDate()) : periodo === "todo" ? 14 : 7;
        const puntos = [];
        for (let i = Math.max(cantidadDias, 1) - 1; i >= 0; i--) {
            const dia = new Date(ahora); dia.setHours(0, 0, 0, 0); dia.setDate(dia.getDate() - i);
            const siguiente = new Date(dia); siguiente.setDate(dia.getDate() + 1);
            const total = historial.filter(p => { const f = fechaPedido(p); return f && f >= dia && f < siguiente; }).length;
            puntos.push({ dia, total, hoy: i === 0 });
        }
        const max = Math.max(...puntos.map(p => p.total), 1);
        const mejor = puntos.reduce((a, b) => (b.total > a.total ? b : a), puntos[0]);
        const sumaDias = puntos.reduce((t, p) => t + p.total, 0);
        const card = tarjeta("grafico", "azul", "Pedidos por día",
            sumaDias ? `Mejor día: ${DIAS[mejor.dia.getDay()]} ${mejor.dia.getDate()}/${mejor.dia.getMonth() + 1}, con ${mejor.total}` : `Últimos ${puntos.length} días`,
            "statsGrafico");
        const columnas = puntos.map(p => {
            const alto = p.total ? Math.max(8, Math.round((p.total / max) * 100)) : 0;
            const etiqueta = puntos.length <= 7 ? DIAS[p.dia.getDay()] : String(p.dia.getDate());
            return `<div class="statsColumna${p.hoy ? " hoy" : ""}${p.total ? "" : " cero"}" title="${p.dia.getDate()}/${p.dia.getMonth() + 1}: ${p.total}">
                <span class="statsValor">${p.total || ""}</span>
                <div class="statsBarraDia"><i style="height:${alto}%"></i></div>
                <small>${etiqueta}</small>
            </div>`;
        }).join("");
        card.insertAdjacentHTML("beforeend", `<div class="statsColumnas" role="img" aria-label="Gráfico de pedidos por día" style="--columnas:${puntos.length}">${columnas}</div>`);
        return card;
    }

    // Lo más pedido: una tarjeta con tres pestañas (comercios, productos, marcas).
    function crearRanking(estadisticas) {
        const card = tarjeta("chispa", "naranja", "Lo más pedido", "Top 5 del período", "statsRanking");
        const pestanas = [
            ["comercios", "Comercios", estadisticas.comercios, "pedidos", "tienda"],
            ["productos", "Productos", estadisticas.productos, "unid.", "paquete"],
            ["marcas", "Marcas", estadisticas.marcas, "unid.", "etiqueta"]
        ];
        const segmento = pestanas.map(([clave, nombre], indice) => `<button type="button" role="tab" data-ranking="${clave}" aria-selected="${indice === 0}">${nombre}</button>`).join("");
        const listas = pestanas.map(([clave, , datos, sufijo, icono], indice) => {
            const max = Math.max(...(datos || []).map(x => Number(x[1]) || 0), 1);
            const filas = (datos || []).map(([nombre, valor], puesto) => {
                const pct = Math.round((Number(valor) || 0) / max * 100);
                const nombreVisible = clave === "productos" ? String(nombre).split(" - ").slice(1).join(" - ") || nombre : nombre;
                const marca = clave === "productos" ? String(nombre).split(" - ")[0] : "";
                const avatar = clave === "comercios" ? esc(iniciales(nombreVisible)) : ico(icono, 16);
                return `<div class="statsFilaRanking" data-puesto="${puesto + 1}">
                    <span class="statsAvatar">${avatar}</span>
                    <div class="statsFilaTexto">
                        <div><strong>${esc(nombreVisible)}</strong><b>${numero(valor)} <small>${sufijo}</small></b></div>
                        ${marca ? `<small>${esc(marca)}</small>` : ""}
                        <span class="statsPista"><i style="width:${pct}%"></i></span>
                    </div>
                </div>`;
            }).join("");
            return `<div class="statsListaRanking" data-ranking="${clave}" ${indice ? "hidden" : ""}>${filas || vacio("Todavía no hay datos en este período.")}</div>`;
        }).join("");
        card.insertAdjacentHTML("beforeend", `<div class="statsPestanas" role="tablist" aria-label="Lo más pedido">${segmento}</div>${listas}`);
        card.addEventListener("click", evento => {
            const boton = evento.target.closest("[role=tab]");
            if (!boton) return;
            card.querySelectorAll("[role=tab]").forEach(b => b.setAttribute("aria-selected", String(b === boton)));
            card.querySelectorAll(".statsListaRanking").forEach(l => { l.hidden = l.dataset.ranking !== boton.dataset.ranking; });
        });
        return card;
    }

    // Esta semana contra la anterior, con flechas de sube o baja.
    function crearComparativa(historial) {
        if (typeof obtenerInicioSemanaActual !== "function") return null;
        const semana = desplazamiento => {
            const inicio = obtenerInicioSemanaActual();
            inicio.setDate(inicio.getDate() + desplazamiento * 7);
            const fin = new Date(inicio); fin.setDate(fin.getDate() + 7);
            const pedidos = historial.filter(p => { const f = fechaPedido(p); return f && f >= inicio && f < fin; });
            return {
                pedidos: pedidos.length,
                unidades: pedidos.reduce((t, p) => t + (Number(p.cantidad) || unidadesPedido(p)), 0),
                comercios: new Set(pedidos.map(p => String(p.comercio || "Sin comercio"))).size
            };
        };
        const actual = semana(0);
        const anterior = semana(-1);
        const card = tarjeta("calendario", "violeta", "Esta semana", "Comparada con la semana anterior", "statsComparativa");
        const filas = [
            ["lista", "Pedidos", actual.pedidos, anterior.pedidos],
            ["paquete", "Unidades", actual.unidades, anterior.unidades],
            ["tienda", "Comercios activos", actual.comercios, anterior.comercios]
        ].map(([icono, nombre, a, b]) => `<div class="statsFila">
            <span class="statsFilaIcono">${ico(icono, 17)}</span>
            <div class="statsFilaTexto"><strong>${nombre}</strong><small>Antes: ${numero(b)}</small></div>
            <b class="statsFilaValor">${numero(a)}</b>${variacion(a, b)}
        </div>`).join("");
        card.insertAdjacentHTML("beforeend", `<div class="statsLista">${filas}</div>`);
        return card;
    }

    // Comercios para visitar: los atrasados y los que no pidieron esta semana.
    function crearParaVisitar(perfiles, atrasados, historial) {
        const card = tarjeta("alerta", "rojo", "Para visitar", "Atrasados o sin pedido esta semana", "statsVisitar");
        const inicio = typeof obtenerInicioSemanaActual === "function" ? obtenerInicioSemanaActual() : null;
        const conPedido = new Set();
        historial.forEach(p => { const f = fechaPedido(p); if (inicio && f && f >= inicio) conPedido.add(String(p.comercio || "")); });
        const nombresAtrasados = new Set(atrasados.map(p => p.nombre));
        const lista = [
            ...atrasados.map(p => ({ perfil: p, texto: `Hace ${p.diasDesdeUltimo} días · suele pedir cada ${p.promedioDias}`, tono: "atrasado" })),
            ...perfiles.filter(p => p.nombre !== "Sin comercio" && !conPedido.has(p.nombre) && !nombresAtrasados.has(p.nombre))
                .map(p => ({ perfil: p, texto: `Sin pedido esta semana · ${p.cantidadPedidos} ${p.cantidadPedidos === 1 ? "pedido" : "pedidos"} en total`, tono: "semana" }))
        ].slice(0, 8);
        if (!lista.length) {
            card.insertAdjacentHTML("beforeend", `<div class="statsVacio statsTodoBien">${ico("check", 20)}<span>Todos tus comercios pidieron esta semana.</span></div>`);
            return card;
        }
        const filas = lista.map(({ perfil, texto, tono }) => `<button type="button" class="statsFila statsFilaBoton" data-visitar="${esc(perfil.nombre)}" aria-label="Opciones para ${esc(perfil.nombre)}">
            <span class="statsAvatar" data-tono="${tono}">${esc(iniciales(perfil.nombre))}</span>
            <div class="statsFilaTexto"><strong>${esc(perfil.nombre)}</strong><small>${texto}</small></div>
            ${tono === "atrasado" ? `<span class="statsChip" data-tono="falta">Atrasado</span>` : ""}
            ${ico("chevDerecha", 16)}
        </button>`).join("");
        card.insertAdjacentHTML("beforeend", `<div class="statsLista">${filas}</div>`);
        card.addEventListener("click", evento => {
            const fila = evento.target.closest("[data-visitar]");
            if (fila && typeof abrirAccionesComercioSeguimiento === "function") abrirAccionesComercioSeguimiento(fila.dataset.visitar);
        });
        return card;
    }

    // Lo que suele pedir cada comercio.
    function crearHabituales(perfiles) {
        const card = tarjeta("historial", "verde", "Pedido habitual", "Cada cuánto pide cada comercio y qué lleva", "statsHabituales");
        if (!perfiles.length) {
            card.insertAdjacentHTML("beforeend", vacio("Cuando tengas pedidos, acá vas a ver qué pide cada comercio."));
            return card;
        }
        const filas = perfiles.slice(0, 8).map(perfil => {
            const frecuencia = perfil.promedioDias > 0 ? `Cada ${perfil.promedioDias} ${perfil.promedioDias === 1 ? "día" : "días"}` : "Primer pedido";
            const ultimo = typeof formatearFechaCortaHistorial === "function" ? formatearFechaCortaHistorial(perfil.ultimaFecha) : "";
            const productos = (perfil.productosHabituales || []).map(item => `<span class="statsChip">${esc(String(item[0]).split(" - ").pop())}</span>`).join("");
            return `<button type="button" class="statsFila statsFilaBoton statsFilaHabitual" data-historial="${esc(perfil.nombre)}" aria-label="Historial de ${esc(perfil.nombre)}">
                <span class="statsAvatar">${esc(iniciales(perfil.nombre))}</span>
                <div class="statsFilaTexto">
                    <strong>${esc(perfil.nombre)}</strong>
                    <small>${ico("reloj", 12)} ${frecuencia} · último ${ultimo} · ${perfil.promedioUnidades} unid.</small>
                    ${productos ? `<div class="statsChips">${productos}</div>` : ""}
                </div>
                ${ico("chevDerecha", 16)}
            </button>`;
        }).join("");
        card.insertAdjacentHTML("beforeend", `<div class="statsLista">${filas}</div>`);
        card.addEventListener("click", evento => {
            const fila = evento.target.closest("[data-historial]");
            if (fila && typeof abrirHistorialDeComercio === "function") abrirHistorialDeComercio(fila.dataset.historial);
        });
        return card;
    }

    // Mes por mes: los últimos seis.
    function crearMeses(historial) {
        if (typeof obtenerEstadisticasMensuales !== "function") return null;
        const meses = obtenerEstadisticasMensuales(historial);
        const card = tarjeta("calendario", "gris", "Mes por mes", "Los últimos meses con pedidos", "statsMeses");
        if (!meses.length) {
            card.insertAdjacentHTML("beforeend", vacio("Todavía no hay pedidos con fecha."));
            return card;
        }
        const max = Math.max(...meses.map(m => m.pedidos), 1);
        const filas = meses.map(mes => {
            const [anio, numeroMes] = mes.clave.split("-").map(Number);
            return `<div class="statsFila">
                <span class="statsFilaIcono statsMes">${MESES[numeroMes - 1]?.slice(0, 3) || ""}</span>
                <div class="statsFilaTexto">
                    <strong>${MESES[numeroMes - 1] || mes.clave} ${anio}</strong>
                    <small>${numero(mes.unidades)} unid. · ${mes.comercios.size} ${mes.comercios.size === 1 ? "comercio" : "comercios"}</small>
                    <span class="statsPista"><i style="width:${Math.round(mes.pedidos / max * 100)}%"></i></span>
                </div>
                <b class="statsFilaValor">${numero(mes.pedidos)} <small>ped.</small></b>
            </div>`;
        }).join("");
        card.insertAdjacentHTML("beforeend", `<div class="statsLista">${filas}</div>`);
        return card;
    }

    // Tarjetas que suman otros módulos (visitas sin pedido, metas, etc.).
    // Es una lista compartida: los módulos que cargan antes ya la llenan.
    const tarjetasExtra = window.tarjetasEstadisticasExtra = window.tarjetasEstadisticasExtra || [];
    function extras(historial, completo) {
        return tarjetasExtra.map(crear => {
            try {
                return crear(historial, completo);
            } catch (error) {
                console.error("Falló una tarjeta de Estadísticas.", error);
                return null;
            }
        });
    }

    function inicioPeriodo() {
        const periodo = periodoElegido();
        if (periodo === "todo") return null;
        const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
        if (periodo === "semana") inicio.setDate(inicio.getDate() - 6);
        if (periodo === "mes") inicio.setDate(1);
        return inicio;
    }

    function renderizar() {
        const destino = document.getElementById("contenidoEstadisticas"); if (!destino) return;
        destino.innerHTML = "";
        const historial = obtenerHistorialPeriodo();
        const completo = typeof obtenerPedidosDelHistorial === "function" ? obtenerPedidosDelHistorial() : historial;
        const estadisticas = estadisticasPeriodo(historial);
        // Lo que mira hacia atrás (semanas, meses, habituales) usa todo el historial.
        const perfilesTodos = typeof obtenerPerfilesComerciales === "function" ? obtenerPerfilesComerciales(completo) : estadisticas.perfiles;
        [
            crearResumen(historial),
            crearGraficoPedidos(historial),
            crearRanking(estadisticas),
            crearComparativa(completo),
            crearParaVisitar(perfilesTodos, perfilesTodos.filter(p => p.atrasado), completo),
            ...extras(historial, completo),
            crearHabituales(perfilesTodos),
            crearMeses(completo)
        ].filter(Boolean).forEach(card => destino.appendChild(card));
    }

    function abrir() {
        const s=document.getElementById("pantallaEstadisticas")||crearPantalla(); ocultarPantallas(); s.classList.remove("oculto"); renderizar();
        const filtro=document.getElementById("filtroPeriodoEstadisticas");
        if(filtro && !filtro.dataset.conectado){
            filtro.addEventListener("change",()=>{const boton=s.querySelector(`[data-periodo="${filtro.value}"]`);s.querySelectorAll("[data-periodo]").forEach(b=>b.classList.remove("activo"));boton?.classList.add("activo");renderizar();}); filtro.dataset.conectado="true";
            s.querySelectorAll("[data-periodo]").forEach(b=>b.addEventListener("click",()=>{filtro.value=b.dataset.periodo;s.querySelectorAll("[data-periodo]").forEach(x=>x.classList.remove("activo"));b.classList.add("activo");renderizar();}));
        }
    }
    window.abrirEstadisticas=abrir;
    window.estadisticasVendeFrio = {
        tarjeta, vacio, periodoElegido, inicioPeriodo, NOMBRE_PERIODO,
        sumarTarjeta(crear) { if (typeof crear === "function") tarjetasExtra.push(crear); },
        // Vuelve a dibujar si la pantalla está abierta.
        redibujar() {
            const s = document.getElementById("pantallaEstadisticas");
            if (s && !s.classList.contains("oculto")) renderizar();
        }
    };
}());
