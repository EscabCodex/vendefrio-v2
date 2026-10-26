// VendeFrío - Informe completo de estadísticas / rework visual
(function () {
    function ocultarPantallas() {
        document.querySelectorAll('body > section[id^="pantalla"]').forEach(s => s.classList.add("oculto"));
    }

    function crearPantalla() {
        const s = document.createElement("section");
        s.id = "pantallaEstadisticas";
        s.className = "oculto pantallaExtra pantallaEstadisticas";
        s.innerHTML = `<header><div class="logo">${window.icono("grafico",22)}</div><div><h1>Estadísticas</h1><p>Cómo te va con las ventas</p></div></header><main class="container"><div class="selectorPeriodoEstadisticas" aria-label="Filtrar estadísticas por período"><button type="button" data-periodo="hoy">Hoy</button><button type="button" data-periodo="semana">Semana</button><button type="button" data-periodo="mes">Mes</button><button type="button" class="activo" data-periodo="todo">Todo</button></div><select id="filtroPeriodoEstadisticas" class="selectorPeriodoOculto" aria-label="Período"><option value="hoy">Hoy</option><option value="semana">Esta semana</option><option value="mes">Este mes</option><option value="todo" selected>Todo</option></select><div id="contenidoEstadisticas" class="informeEstadisticas"></div><button type="button" class="statsPlanilla" id="descargarPlanillaEstadisticas" aria-label="Descargar planilla del período"><span class="ajIcono" data-tono="verde">${window.icono("descargar",20)}</span><span class="statsPlanillaTexto"><strong>Descargar planilla del período</strong><small>Para Excel o tu contador</small></span>${window.icono("chevDerecha",18)}</button></main></section>`;
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

    // Más rápida con muchos pedidos (T168): la lista de pedidos se lee una
    // sola vez hasta que cambia (pedidosDelHistorialParaLeer) y la fecha, las
    // unidades y la plata de cada pedido se calculan una vez y se recuerdan.
    // Nada de esta pantalla cambia los pedidos.
    const datosDePedido = new WeakMap();

    function datosPedido(pedido) {
        let datos = datosDePedido.get(pedido);
        if (!datos) {
            const fecha = typeof obtenerFechaRegistro === "function" ? obtenerFechaRegistro(pedido) : new Date(Number(pedido.timestamp || 0));
            datos = {
                fecha: fecha instanceof Date && !Number.isNaN(fecha.getTime()) ? fecha : null,
                unidades: (pedido.productos || []).reduce((total, item) => total + Number(item.cantidad || 0), 0),
                plata: typeof totalDelPedido === "function" ? Number(totalDelPedido(pedido)?.total || 0) : 0
            };
            datosDePedido.set(pedido, datos);
        }
        return datos;
    }

    function fechaPedido(pedido) {
        return datosPedido(pedido).fecha;
    }

    function unidadesPedido(pedido) {
        return datosPedido(pedido).unidades;
    }

    // Eliminados y cancelados no cuentan (T26) y, en la nube, solo los
    // entregados y los "Histórico" (T27).
    function pedidosQueCuentan() {
        if (typeof pedidosDelHistorialParaLeer === "function") return pedidosDelHistorialParaLeer();
        return typeof obtenerPedidosDelHistorial === "function" ? obtenerPedidosDelHistorial() : [];
    }

    // Cuentas sobre una lista que se recuerdan mientras la lista y el día sean
    // los mismos (los perfiles dicen "hace X días").
    const cuentasRecordadas = new WeakMap();
    function recordar(lista, nombre, calcular) {
        const hoy = new Date().toDateString();
        let guardadas = cuentasRecordadas.get(lista);
        if (!guardadas || guardadas.hoy !== hoy) {
            guardadas = { hoy };
            cuentasRecordadas.set(lista, guardadas);
        }
        if (!(nombre in guardadas)) guardadas[nombre] = calcular();
        return guardadas[nombre];
    }

    function perfilesDe(lista) {
        if (typeof obtenerPerfilesComerciales !== "function") return [];
        return recordar(lista, "perfiles", () => obtenerPerfilesComerciales(lista));
    }

    // Los pedidos de cada día ("2026-10-26" → lista), para el gráfico.
    function claveDia(fecha) {
        return fecha.getFullYear() + "-" + (fecha.getMonth() + 1) + "-" + fecha.getDate();
    }

    function pedidosPorDia(lista) {
        return recordar(lista, "porDia", () => {
            const dias = new Map();
            lista.forEach(pedido => {
                const fecha = fechaPedido(pedido);
                if (!fecha) return;
                const clave = claveDia(fecha);
                if (!dias.has(clave)) dias.set(clave, []);
                dias.get(clave).push(pedido);
            });
            return dias;
        });
    }

    function obtenerHistorialPeriodo() {
        const historial = pedidosQueCuentan();
        const periodo = document.getElementById("filtroPeriodoEstadisticas")?.value || "todo";
        if (periodo === "todo") return historial;
        const ahora = new Date();
        const inicio = new Date(ahora); inicio.setHours(0, 0, 0, 0);
        if (periodo === "semana") inicio.setDate(inicio.getDate() - 6);
        if (periodo === "mes") inicio.setDate(1);
        return historial.filter(pedido => { const fecha = fechaPedido(pedido); return fecha && fecha >= inicio && fecha <= ahora; });
    }

    // El período anterior del mismo largo (T80): ayer, los 7 días de antes o
    // el mes pasado hasta el mismo día. null en "Todo".
    function historialAnterior() {
        const periodo = document.getElementById("filtroPeriodoEstadisticas")?.value || "todo";
        if (periodo === "todo") return null;
        const historial = pedidosQueCuentan();
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        let inicio, fin;
        if (periodo === "hoy") {
            inicio = new Date(hoy); inicio.setDate(inicio.getDate() - 1);
            fin = new Date(hoy);
        } else if (periodo === "semana") {
            inicio = new Date(hoy); inicio.setDate(inicio.getDate() - 13);
            fin = new Date(hoy); fin.setDate(fin.getDate() - 6);
        } else {
            inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
            const ultimo = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate();
            fin = new Date(hoy.getFullYear(), hoy.getMonth() - 1, Math.min(hoy.getDate(), ultimo) + 1);
        }
        return historial.filter(pedido => { const fecha = fechaPedido(pedido); return fecha && fecha >= inicio && fecha < fin; });
    }

    function diferencia(actual, anterior) {
        const resta = actual - anterior;
        if (!resta) return "";
        return `<span class="statsDelta" data-tono="${resta > 0 ? "sube" : "baja"}">${resta > 0 ? "+" : "−"}${numero(Math.abs(resta))}</span>`;
    }

    function estadisticasPeriodo(historial) {
        return recordar(historial, "ranking", () => contarRanking(historial));
    }

    function contarRanking(historial) {
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
        return { comercios: ordenar(comercios), productos: ordenar(productos), marcas: ordenar(marcas) };
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
        return datosPedido(pedido).plata;
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
        const anterior = historialAnterior();
        const antes = anterior ? {
            total: anterior.length,
            comercios: new Set(anterior.map(p => p.comercio).filter(Boolean)).size,
            vendido: anterior.reduce((t, p) => t + totalPlata(p), 0)
        } : null;
        const card = document.createElement("section");
        card.className = "statsResumen";
        card.innerHTML = `
            <div class="statsResumenTop">
                <div>
                    <small>${ico("calendario", 14)} ${NOMBRE_PERIODO[periodoElegido()] || "Todo"}</small>
                    <strong>${numero(total)}</strong>
                    <span>${total === 1 ? "pedido" : "pedidos"}${antes ? diferencia(total, antes.total) : ""}</span>
                </div>
                ${vendido > 0 && window.verPlataVendeFrio?.puedoVer?.() !== false ? `<div class="statsVendido"><small>Vendido</small><strong>${plata(vendido)}</strong>${antes && (antes.vendido || vendido) ? variacion(Math.round(vendido), Math.round(antes.vendido)) : ""}</div>` : ""}
            </div>
            <div class="statsNumeros">
                <div><span class="statsNumIcono">${ico("tienda", 17)}</span><strong>${numero(comercios)}${antes ? diferencia(comercios, antes.comercios) : ""}</strong><small>comercios</small></div>
                <div><span class="statsNumIcono">${ico("paquete", 17)}</span><strong>${numero(unidades)}</strong><small>unidades</small></div>
                <div><span class="statsNumIcono">${ico("ordenar", 17)}</span><strong>${promedio}</strong><small>por pedido</small></div>
            </div>`;
        return card;
    }

    // Por día en barras redondeadas, con el día de hoy marcado (T116): se
    // elige qué mirar (Plata, Pedidos o Unidades), atrás se ve en gris el
    // período anterior y tocar una barra muestra el detalle del día.
    let medidaGrafico = "pedidos";
    const MEDIDAS = {
        plata: { titulo: "Plata por día", texto: "Plata", valor: lista => lista.reduce((t, p) => t + totalPlata(p), 0), formato: v => plata(v), corto: v => v >= 1000 ? Math.round(v / 1000) + "k" : String(Math.round(v)) },
        pedidos: { titulo: "Pedidos por día", texto: "Pedidos", valor: lista => lista.length, formato: v => numero(v) + (v === 1 ? " pedido" : " pedidos"), corto: v => String(v) },
        unidades: { titulo: "Unidades por día", texto: "Unidades", valor: lista => lista.reduce((t, p) => t + unidadesPedido(p), 0), formato: v => numero(v) + (v === 1 ? " unidad" : " unidades"), corto: v => String(v) }
    };

    function pedidosDelDia(historial, dia) {
        return pedidosPorDia(historial).get(claveDia(dia)) || [];
    }

    function crearGraficoPedidos(historial) {
        const ahora = new Date();
        const periodo = periodoElegido();
        const cantidadDias = periodo === "mes" ? Math.min(14, ahora.getDate()) : periodo === "todo" ? 14 : 7;
        const verPlata = window.verPlataVendeFrio?.puedoVer?.() !== false;
        if (medidaGrafico === "plata" && !verPlata) medidaGrafico = "pedidos";
        const medida = MEDIDAS[medidaGrafico];
        // El período anterior del mismo largo, para comparar barra con barra.
        const completo = pedidosQueCuentan();
        const largo = Math.max(cantidadDias, 1);
        const puntos = [];
        for (let i = largo - 1; i >= 0; i--) {
            const dia = new Date(ahora); dia.setHours(0, 0, 0, 0); dia.setDate(dia.getDate() - i);
            const delDia = pedidosDelDia(historial, dia);
            const antes = new Date(dia); antes.setDate(dia.getDate() - largo);
            const delAnterior = pedidosDelDia(completo, antes);
            puntos.push({ dia, antes, lista: delDia, total: medida.valor(delDia), anterior: medida.valor(delAnterior), hoy: i === 0 });
        }
        const max = Math.max(...puntos.map(p => Math.max(p.total, p.anterior)), 1);
        const mejor = puntos.reduce((a, b) => (b.total > a.total ? b : a), puntos[0]);
        const sumaDias = puntos.reduce((t, p) => t + p.total, 0);
        const sumaAntes = puntos.reduce((t, p) => t + p.anterior, 0);
        const card = tarjeta("grafico", "azul", medida.titulo,
            sumaDias ? `Mejor día: ${DIAS[mejor.dia.getDay()]} ${mejor.dia.getDate()}/${mejor.dia.getMonth() + 1}, con ${medida.formato(mejor.total)}` : `Últimos ${puntos.length} días`,
            "statsGrafico");
        const opciones = Object.keys(MEDIDAS).filter(clave => clave !== "plata" || verPlata)
            .map(clave => `<button type="button" data-medida="${clave}" aria-pressed="${clave === medidaGrafico}">${MEDIDAS[clave].texto}</button>`).join("");
        const columnas = puntos.map((p, indice) => {
            const alto = p.total ? Math.max(8, Math.round((p.total / max) * 100)) : 0;
            const altoAntes = p.anterior ? Math.max(6, Math.round((p.anterior / max) * 100)) : 0;
            const etiqueta = puntos.length <= 7 ? DIAS[p.dia.getDay()] : String(p.dia.getDate());
            return `<button type="button" class="statsColumna${p.hoy ? " hoy" : ""}${p.total ? "" : " cero"}" data-columna="${indice}" aria-label="${DIAS[p.dia.getDay()]} ${p.dia.getDate()}/${p.dia.getMonth() + 1}: ${medida.formato(p.total)}">
                <span class="statsValor">${p.total ? medida.corto(p.total) : ""}</span>
                <div class="statsBarraDia">${altoAntes ? `<b class="statsBarraAntes" style="height:${altoAntes}%"></b>` : ""}<i style="height:${alto}%"></i></div>
                <small>${etiqueta}</small>
            </button>`;
        }).join("");
        const leyenda = sumaAntes || sumaDias
            ? `<div class="statsLeyenda"><span><i class="statsPuntoAhora"></i>Estos días · ${medida.formato(sumaDias)}</span><span><i class="statsPuntoAntes"></i>Los ${largo} de antes · ${medida.formato(sumaAntes)}</span></div>`
            : "";
        card.insertAdjacentHTML("beforeend", `<div class="pzSegmentos statsMedidas" role="group" aria-label="Qué mirar">${opciones}</div>
            <div class="statsColumnas" role="group" aria-label="Gráfico por día" style="--columnas:${puntos.length}">${columnas}</div>
            ${leyenda}
            <div class="statsDetalleDia" id="detalleDiaEstadisticas" role="status">Tocá una barra para ver ese día.</div>`);
        card.addEventListener("click", evento => {
            const boton = evento.target.closest("[data-medida]");
            if (boton) {
                medidaGrafico = boton.dataset.medida;
                card.replaceWith(crearGraficoPedidos(historial));
                return;
            }
            const columna = evento.target.closest("[data-columna]");
            if (!columna) return;
            const punto = puntos[Number(columna.dataset.columna)];
            card.querySelectorAll(".statsColumna").forEach(c => c.classList.toggle("elegida", c === columna));
            const lista = punto.lista;
            const partes = [numero(lista.length) + (lista.length === 1 ? " pedido" : " pedidos"), numero(MEDIDAS.unidades.valor(lista)) + " u"];
            if (verPlata) partes.push(plata(MEDIDAS.plata.valor(lista)));
            const comercios = [...new Set(lista.map(p => p.comercio).filter(Boolean))];
            card.querySelector("#detalleDiaEstadisticas").innerHTML = `<strong>${DIAS[punto.dia.getDay()]} ${punto.dia.getDate()}/${punto.dia.getMonth() + 1}</strong>
                <span>${partes.join(" · ")}</span>
                <small>${comercios.length ? esc(comercios.slice(0, 3).join(", ")) + (comercios.length > 3 ? " y " + (comercios.length - 3) + " más" : "") : "Sin pedidos"} · antes: ${medida.formato(punto.anterior)}</small>`;
        });
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
            ...atrasados.map(p => ({ perfil: p, texto: `Hace ${p.diasDesdeUltimo} días · pide cada ${p.promedioDias} días`, tono: "atrasado" })),
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
        const meses = recordar(historial, "meses", () => obtenerEstadisticasMensuales(historial));
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
    function extra(crear, historial, completo) {
        try {
            return crear(historial, completo);
        } catch (error) {
            console.error("Falló una tarjeta de Estadísticas.", error);
            return null;
        }
    }

    function inicioPeriodo() {
        const periodo = periodoElegido();
        if (periodo === "todo") return null;
        const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
        if (periodo === "semana") inicio.setDate(inicio.getDate() - 6);
        if (periodo === "mes") inicio.setDate(1);
        return inicio;
    }

    // Se dibuja de a partes (T168): arriba el resumen y el gráfico enseguida,
    // y las demás tarjetas en los cuadros siguientes, así la pantalla aparece
    // al tocar aunque haya muchos pedidos. Si nada cambió desde la última vez
    // (mismos pedidos, período y día), al volver a entrar no se rehace.
    let tandaPendiente = null;
    let firmaDibujada = "";
    const idsDeListas = new WeakMap();
    let ultimoIdDeLista = 0;

    function firmaActual() {
        const lista = pedidosQueCuentan();
        if (!idsDeListas.has(lista)) idsDeListas.set(lista, ++ultimoIdDeLista);
        return [
            idsDeListas.get(lista),
            typeof marcaDeColeccion === "function" ? marcaDeColeccion("comercios") : "",
            periodoElegido(),
            new Date().toDateString(),
            window.verPlataVendeFrio?.puedoVer?.() !== false,
            window.piezas?.esDueno?.() === true
        ].join("|");
    }

    function renderizar() {
        const destino = document.getElementById("contenidoEstadisticas"); if (!destino) return;
        if (tandaPendiente) { clearTimeout(tandaPendiente); tandaPendiente = null; }
        destino.innerHTML = "";
        firmaDibujada = firmaActual();
        const historial = obtenerHistorialPeriodo();
        const completo = pedidosQueCuentan();
        // Lo que mira hacia atrás (semanas, meses, habituales) usa todo el historial.
        const perfilesTodos = () => perfilesDe(completo);
        const partes = [
            () => crearResumen(historial),
            () => crearGraficoPedidos(historial),
            () => crearRanking(estadisticasPeriodo(historial)),
            () => crearComparativa(completo),
            () => crearParaVisitar(perfilesTodos(), perfilesTodos().filter(p => p.atrasado), completo),
            ...tarjetasExtra.map(crear => () => extra(crear, historial, completo)),
            () => crearHabituales(perfilesTodos()),
            () => crearMeses(completo)
        ];
        const poner = parte => { const card = parte(); if (card) destino.appendChild(card); };
        partes.splice(0, 2).forEach(poner);
        const seguir = () => {
            tandaPendiente = null;
            const inicio = performance.now();
            // Unas cuantas por cuadro, sin trabar más de unos 40 ms.
            while (partes.length && performance.now() - inicio < 40) poner(partes.shift());
            if (partes.length) tandaPendiente = setTimeout(seguir, 0);
        };
        tandaPendiente = setTimeout(seguir, 0);
    }

    function abrir() {
        const s=document.getElementById("pantallaEstadisticas")||crearPantalla(); ocultarPantallas(); s.classList.remove("oculto");
        if (tandaPendiente || firmaDibujada !== firmaActual()) renderizar();
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
        perfilesDe,
        // Vuelve a dibujar si la pantalla está abierta; si no, al entrar.
        redibujar() {
            const s = document.getElementById("pantallaEstadisticas");
            if (s && !s.classList.contains("oculto")) renderizar();
            else firmaDibujada = "";
        }
    };
}());
