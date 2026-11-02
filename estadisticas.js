// VendeFrío - Estadísticas para estudiar el mercado (repaso de diseño,
// aprobado por el dueño el 2026-11-01). Cuatro partes:
//   1. Cómo vengo: lo vendido contra el período anterior del mismo largo.
//   2. Qué hacer hoy: a quién llamar (dejaron de pedir o compran menos) y qué
//      ofrecerle a cada uno (lo que llevan casi todos y él no).
//   3. Qué se mueve: quién deja más plata (comercios, productos, marcas y
//      zonas, con cuánto sube o baja) y qué día se vende más.
//   4. Para crecer: clientes nuevos y perdidos, pedidos de comercios sin
//      guardar (con "Crear"), los guardados que nunca compraron y el mapa de
//      ventas con sus zonas.
// Los períodos son corridos (Hoy, 7 días, 30 días, Año), así el primer día
// del mes no queda vacío. Nada de esta pantalla cambia los pedidos.
(function () {
    function ocultarPantallas() {
        document.querySelectorAll('body > section[id^="pantalla"]').forEach(s => s.classList.add("oculto"));
    }

    const PERIODOS = [["hoy", "Hoy"], ["semana", "7 días"], ["mes", "30 días"], ["anio", "Año"]];
    // "todo" (de antes) es el año.
    const NOMBRE_PERIODO = { hoy: "Hoy", semana: "Últimos 7 días", mes: "Últimos 30 días", anio: "Último año", todo: "Último año" };
    const DIAS_PERIODO = { hoy: 1, semana: 7, mes: 30, anio: 365 };
    const ANTERIOR = { hoy: "ayer", semana: "los 7 días de antes", mes: "los 30 días de antes", anio: "el año anterior" };

    function crearPantalla() {
        const s = document.createElement("section");
        s.id = "pantallaEstadisticas";
        s.className = "oculto pantallaExtra pantallaEstadisticas";
        const botones = PERIODOS.map(([clave, texto]) => `<button type="button" class="filtroEtapa${clave === "mes" ? " activo" : ""}" data-periodo="${clave}">${texto}<span class="filtroEtapaCantidad">0</span></button>`).join("");
        const opciones = PERIODOS.map(([clave, texto]) => `<option value="${clave}"${clave === "mes" ? " selected" : ""}>${texto}</option>`).join("");
        s.innerHTML = `<header><div class="logo">${window.icono("grafico",22)}</div><div><h1>Estadísticas</h1><p></p></div></header><main class="container"><div class="selectorPeriodoEstadisticas filaPeriodosStats" role="group" aria-label="Filtrar estadísticas por período">${botones}</div><select id="filtroPeriodoEstadisticas" class="selectorPeriodoOculto" aria-label="Período">${opciones}</select><div id="contenidoEstadisticas" class="informeEstadisticas"></div><button type="button" class="statsPlanilla" id="descargarPlanillaEstadisticas" aria-label="Descargar planilla del período"><span class="ajIcono" data-tono="verde">${window.icono("descargar",20)}</span><span class="statsPlanillaTexto"><strong>Descargar planilla del período</strong><small>Para Excel o tu contador</small></span>${window.icono("chevDerecha",18)}</button></main></section>`;
        document.body.insertBefore(s, document.querySelector("nav.bottom-nav"));
        // Planilla para el contador (T47): todos los pedidos del período
        // (también los que no se entregaron), sin los eliminados.
        s.querySelector("#descargarPlanillaEstadisticas").addEventListener("click", () => {
            const periodo = periodoElegido();
            const inicio = inicioPeriodo();
            const ahora = new Date();
            const pedidos = (typeof historialParaLeer === "function" ? historialParaLeer() : []).filter(pedido => {
                if (!pedido || pedido.eliminado === true) return false;
                const fecha = fechaPedido(pedido);
                return fecha && fecha >= inicio && fecha <= ahora;
            });
            const nombres = { hoy: "de hoy", semana: "de 7 días", mes: "de 30 días", anio: "del año" };
            window.exportarVendeFrio?.descargar(pedidos, "VendeFrío pedidos " + (nombres[periodo] || "") + " " + ahora.toISOString().slice(0, 10));
        });
        return s;
    }

    // Más rápida con muchos pedidos (T168): la lista de pedidos se lee una
    // sola vez hasta que cambia (pedidosDelHistorialParaLeer) y la fecha, las
    // unidades y la plata de cada pedido se calculan una vez y se recuerdan.
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

    const fechaPedido = pedido => datosPedido(pedido).fecha;
    const unidadesPedido = pedido => datosPedido(pedido).unidades;
    const totalPlata = pedido => datosPedido(pedido).plata;

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

    function periodoElegido() {
        const valor = document.getElementById("filtroPeriodoEstadisticas")?.value || "mes";
        return valor === "todo" ? "anio" : valor;
    }

    // Desde cuándo cuenta el período: hoy a las 0, o los últimos 7, 30 o 365
    // días contando hoy.
    function inicioPeriodo(periodo = periodoElegido()) {
        const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
        inicio.setDate(inicio.getDate() - ((DIAS_PERIODO[periodo] || 30) - 1));
        return inicio;
    }

    function entre(lista, desde, hasta) {
        return lista.filter(pedido => { const fecha = fechaPedido(pedido); return fecha && fecha >= desde && fecha < hasta; });
    }

    function pedidosDelPeriodo(periodo = periodoElegido()) {
        const lista = pedidosQueCuentan();
        return recordar(lista, "periodo-" + periodo, () => entre(lista, inicioPeriodo(periodo), new Date(Date.now() + 60000)));
    }

    // El período anterior del mismo largo (T80): ayer, los 7 días de antes...
    function pedidosDelAnterior(periodo = periodoElegido()) {
        const lista = pedidosQueCuentan();
        return recordar(lista, "anterior-" + periodo, () => {
            const fin = inicioPeriodo(periodo);
            const inicio = new Date(fin); inicio.setDate(inicio.getDate() - (DIAS_PERIODO[periodo] || 30));
            return entre(lista, inicio, fin);
        });
    }

    const ico = (nombre, tam = 18) => (window.icono ? window.icono(nombre, tam) : "");
    const esc = texto => String(texto ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const numero = valor => Number(valor || 0).toLocaleString("es-AR");
    const plata = valor => "$ " + Math.round(Number(valor || 0)).toLocaleString("es-AR");
    // Plata corta: "$ 1,6 M", "$ 263 mil".
    const plataCorta = valor => {
        const n = Number(valor) || 0;
        if (n >= 1000000) return "$ " + (Math.round(n / 100000) / 10).toLocaleString("es-AR") + " M";
        if (n >= 10000) return "$ " + Math.round(n / 1000).toLocaleString("es-AR") + " mil";
        return plata(n);
    };
    const plural = (n, uno, varios) => numero(n) + " " + (Number(n) === 1 ? uno : varios);
    const DIAS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
    const NOMBRE_DIA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábados", "domingos"];
    const verPlata = () => window.verPlataVendeFrio?.puedoVer?.() !== false;
    // Se mide en plata si se puede ver y hay precios cargados; si no (sin
    // permiso o sin precios), en unidades. Se decide al dibujar.
    let conPlata = true;
    function decidirMedida() {
        conPlata = verPlata() && [...pedidosDelPeriodo(), ...pedidosDelAnterior()].some(pedido => totalPlata(pedido) > 0);
    }
    const DIA = 86400000;

    function iniciales(nombre) {
        const partes = String(nombre || "?").trim().split(/\s+/).filter(Boolean);
        return ((partes[0]?.[0] || "?") + (partes[1]?.[0] || "")).toUpperCase();
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

    function seccion(titulo, sub) {
        const caja = document.createElement("div");
        caja.className = "statsSeccion";
        caja.innerHTML = `<h2>${titulo}</h2><small>${sub}</small>`;
        return caja;
    }

    function variacion(actual, anterior) {
        if (!anterior && !actual) return `<span class="statsCambio" data-tono="igual">igual</span>`;
        if (!anterior) return `<span class="statsCambio" data-tono="sube">${ico("chevArriba", 13)} nuevo</span>`;
        const cambio = Math.round(((actual - anterior) / anterior) * 100);
        const tono = cambio > 0 ? "sube" : cambio < 0 ? "baja" : "igual";
        const flecha = cambio > 0 ? ico("chevArriba", 13) : cambio < 0 ? ico("chevAbajo", 13) : "";
        return `<span class="statsCambio" data-tono="${tono}">${flecha} ${Math.abs(cambio)}%</span>`;
    }

    function diferencia(actual, anterior) {
        const resta = actual - anterior;
        if (!resta) return "";
        return `<span class="statsDelta" data-tono="${resta > 0 ? "sube" : "baja"}">${resta > 0 ? "+" : "−"}${numero(Math.abs(resta))}</span>`;
    }

    // La plata (o las unidades, para quien no ve la plata) por clave.
    function sumarPor(lista, claves) {
        const plataVisible = conPlata;
        const total = {};
        lista.forEach(pedido => claves(pedido).forEach(([clave, item]) => {
            if (!clave) return;
            const valor = item
                ? (plataVisible ? (Number(item.precio) || 0) * (Number(item.cantidad) || 0) : Number(item.cantidad) || 0)
                : (plataVisible ? totalPlata(pedido) : unidadesPedido(pedido));
            total[clave] = (total[clave] || 0) + valor;
        }));
        return total;
    }

    const nombreProducto = item => String(item.nombre || item.producto || "Producto");
    const porComercio = lista => sumarPor(lista, pedido => [[pedido.comercio || "Sin comercio", null]]);
    const porProducto = lista => sumarPor(lista, pedido => (pedido.productos || []).map(item => [(item.marca || "Sin marca") + " - " + nombreProducto(item), item]));
    const porMarca = lista => sumarPor(lista, pedido => (pedido.productos || []).map(item => [item.marca || "Sin marca", item]));

    // Zonas: el nombre de la ruta de cada comercio ("Centro · lunes" → "Centro").
    function zonas() {
        const rutas = typeof obtenerRutasGuardadas === "function" ? (obtenerRutasGuardadas() || []) : [];
        const zonaDe = new Map();
        rutas.forEach(ruta => (ruta.comercios || []).forEach(nombre => {
            const clave = String(nombre).trim().toLocaleLowerCase("es");
            if (!zonaDe.has(clave)) zonaDe.set(clave, String(ruta.nombre || "Ruta").split(" · ")[0].trim() || "Ruta");
        }));
        return zonaDe;
    }
    const porZona = (lista, zonaDe) => sumarPor(lista, pedido => [[zonaDe.get(String(pedido.comercio || "").trim().toLocaleLowerCase("es")) || "Sin zona", null]]);

    const valorTexto = valor => conPlata ? plataCorta(valor) : plural(valor, "unidad", "unid.");

    function comercioGuardado(nombre) {
        return typeof buscarComercioPorNombre === "function" ? buscarComercioPorNombre(nombre) : null;
    }

    // WhatsApp con un saludo, o "+ Agregar tel." si no tiene teléfono.
    function botonWhatsapp(nombre, texto) {
        const comercio = comercioGuardado(nombre);
        const base = comercio && window.yaLlegoVendeFrio ? window.yaLlegoVendeFrio.enlace(comercio, 0) : "";
        if (base) return `<a class="statsWhatsapp" href="${esc(base.split("?")[0] + "?text=" + encodeURIComponent(texto))}" target="_blank" rel="noopener" aria-label="WhatsApp a ${esc(nombre)}">${ico("whatsapp", 20)}</a>`;
        if (comercio && typeof window.abrirDatosComercio === "function") return `<button type="button" class="statsAgregarTel" data-agregar-tel="${esc(nombre)}">${ico("mas", 14)} Tel.</button>`;
        return "";
    }

    function saludo() {
        const distribuidora = window.distribuidoraVendeFrio?.nombreActual?.() || "";
        return "¡Hola! " + (distribuidora ? "Te escribo de " + distribuidora + ". " : "") + "Hace unos días que no te vemos, ¿te preparo un pedido?";
    }

    function cadaCuanto(dias) {
        if (dias >= 6 && dias <= 8) return "cada semana";
        if (dias >= 13 && dias <= 16) return "cada dos semanas";
        return "cada " + plural(dias, "día", "días");
    }

    // Filas que se muestran de a pocas, con "Ver los N".
    function listaCorta(card, filas, cuantas) {
        card.insertAdjacentHTML("beforeend", `<div class="statsLista">${filas.join("")}</div>`);
        const lista = card.lastElementChild;
        if (filas.length <= cuantas) return lista;
        [...lista.children].slice(cuantas).forEach(fila => { fila.hidden = true; });
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "pzEnlace statsVerTodos";
        boton.textContent = "Ver los " + filas.length;
        boton.addEventListener("click", () => { [...lista.children].forEach(fila => { fila.hidden = false; }); boton.remove(); });
        card.appendChild(boton);
        return lista;
    }

    // Lo de cada fila: tocar el nombre abre la ficha, el teléfono o la
    // dirección que faltan se agregan ahí mismo y "+ Pedido" empieza un
    // pedido para ese comercio.
    function conectarFilas(card) {
        const tocable = window.piezas?.tocable;
        card.querySelectorAll("[data-ficha]").forEach(fila => {
            if (tocable && window.abrirFichaComercio && comercioGuardado(fila.dataset.ficha)) tocable(fila, () => window.abrirFichaComercio(fila.dataset.ficha), { rol: false });
        });
        card.addEventListener("click", evento => {
            const tel = evento.target.closest("[data-agregar-tel]");
            if (tel) { evento.stopPropagation(); window.abrirDatosComercio(tel.dataset.agregarTel, "telefono", () => window.estadisticasVendeFrio.redibujar()); return; }
            const pedido = evento.target.closest("[data-pedido-para]");
            if (pedido) { evento.stopPropagation(); if (typeof irAPedidoRapido === "function") irAPedidoRapido(pedido.dataset.pedidoPara); return; }
            const dir = evento.target.closest("[data-agregar-dir]");
            if (dir) { evento.stopPropagation(); window.abrirDatosComercio?.(dir.dataset.agregarDir, "direccion", () => window.estadisticasVendeFrio.redibujar()); return; }
            const crear = evento.target.closest("[data-crear-comercio]");
            if (crear) { evento.stopPropagation(); crearComercio(crear.dataset.crearComercio); return; }
            if (evento.target.closest(".statsWhatsapp")) evento.stopPropagation();
        }, true);
    }

    // "Datos del comercio" nuevo, con el nombre ya escrito.
    function crearComercio(nombre) {
        const datos = window.datosComercioVendeFrio;
        if (!datos) return;
        const caja = datos.nuevo({ alGuardar: () => window.estadisticasVendeFrio.redibujar() });
        const campo = (caja && caja.querySelector ? caja : document).querySelector("#modalNombre");
        if (campo && !campo.value) {
            campo.value = nombre;
            campo.dispatchEvent(new Event("input", { bubbles: true }));
        }
    }

    // ---------- 1. Cómo vengo ----------
    function crearResumen() {
        const periodo = periodoElegido();
        const lista = pedidosDelPeriodo();
        const antes = pedidosDelAnterior();
        const comercios = new Set(lista.map(p => p.comercio).filter(Boolean)).size;
        const comerciosAntes = new Set(antes.map(p => p.comercio).filter(Boolean)).size;
        const vendido = lista.reduce((t, p) => t + totalPlata(p), 0);
        const vendidoAntes = antes.reduce((t, p) => t + totalPlata(p), 0);
        const unidades = lista.reduce((t, p) => t + unidadesPedido(p), 0);
        const unidadesAntes = antes.reduce((t, p) => t + unidadesPedido(p), 0);
        const conPlata = verPlata() && (vendido > 0 || vendidoAntes > 0);
        const card = document.createElement("section");
        card.className = "statsResumen";
        const grande = conPlata
            ? `<strong>${plata(vendido)}</strong><span>vendido ${variacion(Math.round(vendido), Math.round(vendidoAntes))}</span>`
            : `<strong>${numero(unidades)}</strong><span>${unidades === 1 ? "unidad" : "unidades"} ${variacion(unidades, unidadesAntes)}</span>`;
        const tercero = conPlata
            ? `<div><span class="statsNumIcono">${ico("moneda", 17)}</span><strong>${plataCorta(lista.length ? vendido / lista.length : 0)}</strong><small>por pedido</small></div>`
            : `<div><span class="statsNumIcono">${ico("ordenar", 17)}</span><strong>${lista.length ? (unidades / lista.length).toFixed(1).replace(".", ",") : "0"}</strong><small>por pedido</small></div>`;
        card.innerHTML = `
            <div class="statsResumenTop"><div class="statsVendido">
                <small>${ico("calendario", 14)} ${NOMBRE_PERIODO[periodo]}</small>
                ${grande}
            </div></div>
            <div class="statsNumeros">
                <div><span class="statsNumIcono">${ico("lista", 17)}</span><strong>${numero(lista.length)}${diferencia(lista.length, antes.length)}</strong><small>${lista.length === 1 ? "pedido" : "pedidos"}</small></div>
                <div><span class="statsNumIcono">${ico("tienda", 17)}</span><strong>${numero(comercios)}${diferencia(comercios, comerciosAntes)}</strong><small>${comercios === 1 ? "comercio" : "comercios"}</small></div>
                ${tercero}
            </div>`;
        // Cada número lleva a su detalle: los pedidos a Pedidos > Terminados,
        // lo vendido y los comercios a quién deja más plata.
        const tocable = window.piezas?.tocable;
        if (tocable) {
            const [pedidos, comerciosCaja] = card.querySelectorAll(".statsNumeros > div");
            tocable(card.querySelector(".statsVendido"), () => irAlRanking("comercios"));
            if (typeof abrirHistorialPorPeriodo === "function") tocable(pedidos, () => abrirHistorialPorPeriodo({ hoy: "hoy", semana: "semana", mes: "mes" }[periodo] || "todos"));
            tocable(comerciosCaja, () => irAlRanking("comercios"));
        }
        return card;
    }

    // ---------- 2. Qué hacer hoy ----------
    // Visitas para vender (repaso 2026-11-02): una sola lista de comercios
    // guardados para ir a ofrecer, del más importante al menos. Junta a los
    // que dejaron de pedir, los que compran un 20% menos, a los que les toca
    // hoy, lo que llevan casi todos y ellos no, y los que nunca compraron.
    const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const clave = nombre => String(nombre || "").trim().toLocaleLowerCase("es");
    const sinTildes = texto => clave(texto).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Un producto que llevan al menos 3 comercios (y un cuarto de los que
    // compran) que este comercio nunca llevó. Uno por comercio.
    function productosParaOfrecer(completo) {
        return recordar(completo, "ofrecer", () => {
            const desde = Date.now() - 90 * DIA;
            const recientes = completo.filter(p => { const f = fechaPedido(p); return f && f.getTime() >= desde; });
            const activos = [...new Set(recientes.map(p => p.comercio).filter(nombre => nombre && nombre !== "Sin comercio"))];
            const quienes = new Map();
            const lleva = new Map();
            completo.forEach(pedido => (pedido.productos || []).forEach(item => {
                const nombre = nombreProducto(item);
                if (!quienes.has(nombre)) quienes.set(nombre, new Set());
                quienes.get(nombre).add(pedido.comercio);
                if (!lleva.has(pedido.comercio)) lleva.set(pedido.comercio, new Set());
                lleva.get(pedido.comercio).add(nombre);
            }));
            const populares = [...quienes.entries()]
                .map(([producto, comercios]) => ({ producto, cuantos: activos.filter(c => comercios.has(c)).length }))
                .filter(item => item.cuantos >= 3 && item.cuantos / Math.max(activos.length, 1) >= 0.25)
                .sort((a, b) => b.cuantos - a.cuantos);
            const ofertas = new Map();
            activos.forEach(comercio => {
                const elegido = populares.find(item => !lleva.get(comercio)?.has(item.producto));
                if (elegido) ofertas.set(clave(comercio), elegido.producto);
            });
            return ofertas;
        });
    }

    function visitasParaVender(completo) {
        const guardados = (typeof comerciosParaLeer === "function" ? comerciosParaLeer() : [])
            .filter(comercio => comercio && comercio.nombre && comercio.archivado !== true);
        const filas = new Map(guardados.map(comercio => [clave(comercio.nombre), { comercio, chips: [], peso: 0, tono: "" }]));
        const fila = nombre => filas.get(clave(nombre));
        perfilesDe(completo).forEach(perfil => {
            const item = perfil.atrasado && fila(perfil.nombre);
            if (!item) return;
            item.chips.push(["falta", "No compra hace " + plural(perfil.diasDesdeUltimo, "día", "días")], ["", "Pedía " + cadaCuanto(perfil.promedioDias)]);
            item.peso += 40 + Math.min(perfil.diasDesdeUltimo / Math.max(perfil.promedioDias, 1), 10);
            item.tono = "atrasado";
        });
        const ahora = porComercio(pedidosDelPeriodo());
        const antes = porComercio(pedidosDelAnterior());
        Object.keys(antes).forEach(nombre => {
            const item = fila(nombre);
            if (!item || item.tono || !(antes[nombre] > 0) || (ahora[nombre] || 0) >= antes[nombre] * 0.8) return;
            item.chips.push(["menos", "Compra " + Math.round((1 - (ahora[nombre] || 0) / antes[nombre]) * 100) + "% menos"]);
            item.peso += 30 + (1 - (ahora[nombre] || 0) / antes[nombre]);
            item.tono = "semana";
        });
        const hoy = DIAS_SEMANA[new Date().getDay()];
        filas.forEach(item => {
            if (sinTildes(item.comercio.diaVisita) !== sinTildes(hoy)) return;
            item.chips.unshift(["hoy", "Le toca los " + hoy.toLocaleLowerCase("es")]);
            item.peso += 25;
        });
        productosParaOfrecer(completo).forEach((producto, nombre) => {
            const item = filas.get(nombre);
            if (!item) return;
            item.chips.push(["ofrece", "Ofrecele " + producto]);
            item.peso += 10;
        });
        const conPedido = new Set(completo.map(pedido => clave(pedido.comercio)));
        filas.forEach((item, nombre) => {
            if (conPedido.has(nombre)) return;
            item.chips.push(["nunca", "Nunca te compró"]);
            item.peso += 5;
        });
        return [...filas.values()].filter(item => item.peso > 0).sort((a, b) => b.peso - a.peso);
    }

    function crearVisitas(completo) {
        const lista = visitasParaVender(completo);
        const card = tarjeta("ubicacion", "azul", "Visitas para vender", "Para ir a ofrecer hoy, del más importante al menos", "statsVisitasVender");
        if (!lista.length) {
            card.insertAdjacentHTML("beforeend", `<div class="statsVacio statsTodoBien">${ico("check", 20)}<span>Todos te compran como siempre.</span></div>`);
            return card;
        }
        const filas = lista.map(({ comercio, chips, tono }) => {
            const nombre = comercio.nombre;
            const pildoras = chips.slice(0, 2).map(([tipo, texto]) => `<span class="statsChipVisita"${tipo ? ` data-tipo="${tipo}"` : ""}>${tipo && tipo !== "ofrece" ? "<i></i>" : ""}${esc(texto)}</span>`).join("")
                + (comercio.direccion ? "" : `<button type="button" class="statsChipVisita" data-tipo="agregar" data-agregar-dir="${esc(nombre)}">${ico("mas", 12)} Agregar dirección</button>`);
            return `<div class="statsFila statsFilaVisita" data-ficha="${esc(nombre)}">
                <span class="statsAvatar"${tono ? ` data-tono="${tono}"` : ""}>${esc(iniciales(nombre))}</span>
                <div class="statsFilaTexto"><strong>${esc(nombre)}</strong>${comercio.direccion ? `<small>${esc(comercio.direccion)}</small>` : ""}<div class="statsChipsVisita">${pildoras}</div></div>
                ${botonWhatsapp(nombre, saludo())}
            </div>`;
        });
        listaCorta(card, filas, 4);
        const armar = document.createElement("button");
        armar.type = "button";
        armar.className = "statsArmarRuta";
        armar.innerHTML = `${ico("ubicacion", 20)} Armar la ruta con ${numero(lista.length)}`;
        armar.addEventListener("click", () => {
            if (typeof window.armarRutaConComercios === "function") window.armarRutaConComercios(lista.map(item => item.comercio.nombre));
        });
        card.appendChild(armar);
        conectarFilas(card);
        return card;
    }

    // ---------- 3. Qué se mueve ----------
    function crearRanking() {
        const lista = pedidosDelPeriodo();
        const antes = pedidosDelAnterior();
        const zonaDe = zonas();
        const plataVisible = conPlata;
        const pestanas = [
            ["comercios", "Comercios", porComercio(lista), porComercio(antes)],
            ["productos", "Productos", porProducto(lista), porProducto(antes)],
            ["marcas", "Marcas", porMarca(lista), porMarca(antes)]
        ];
        if (zonaDe.size) pestanas.push(["zonas", "Zonas", porZona(lista, zonaDe), porZona(antes, zonaDe)]);
        const card = tarjeta("grafico", "azul", plataVisible ? "Quién te deja más plata" : "Lo que más se mueve",
            "Contra " + ANTERIOR[periodoElegido()], "statsRanking");
        const segmento = pestanas.map(([clave, nombre], indice) => `<button type="button" role="tab" data-ranking="${clave}" aria-selected="${indice === 0}">${nombre}</button>`).join("");
        const listas = pestanas.map(([clave, , ahora, anterior], indice) => {
            const ordenados = Object.entries(ahora).filter(([, valor]) => valor > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const max = Math.max(...ordenados.map(x => x[1]), 1);
            const filas = ordenados.map(([nombre, valor], puesto) => {
                const nombreVisible = clave === "productos" ? String(nombre).split(" - ").slice(1).join(" - ") || nombre : nombre;
                const marca = clave === "productos" ? String(nombre).split(" - ")[0] : "";
                return `<div class="statsFilaRanking" data-puesto="${puesto + 1}" data-tipo="${clave}" data-nombre="${esc(nombreVisible)}" data-marca="${esc(marca)}">
                    <span class="statsAvatar">${esc(iniciales(nombreVisible))}</span>
                    <div class="statsFilaTexto">
                        <div><strong>${esc(nombreVisible)}</strong><b>${valorTexto(valor)}</b></div>
                        <div class="statsFilaBarra"><span class="statsPista"><i style="width:${Math.round(valor / max * 100)}%"></i></span>${variacion(Math.round(valor), Math.round(anterior[nombre] || 0))}</div>
                    </div>
                </div>`;
            }).join("");
            return `<div class="statsListaRanking" data-ranking="${clave}" ${indice ? "hidden" : ""}>${filas || vacio("Todavía no hay ventas en este período.")}</div>`;
        }).join("");
        card.insertAdjacentHTML("beforeend", `<div class="statsPestanas" role="tablist" aria-label="Qué mirar" style="--pestanas:${pestanas.length}">${segmento}</div>${listas}`);
        card.addEventListener("click", evento => {
            const boton = evento.target.closest("[role=tab]");
            if (!boton) return;
            card.querySelectorAll("[role=tab]").forEach(b => b.setAttribute("aria-selected", String(b === boton)));
            card.querySelectorAll(".statsListaRanking").forEach(l => { l.hidden = l.dataset.ranking !== boton.dataset.ranking; });
        });
        // Un comercio lleva a sus pedidos; un producto o una marca, al
        // Catálogo en esa marca.
        const tocable = window.piezas?.tocable;
        if (tocable) card.querySelectorAll(".statsFilaRanking").forEach(fila => {
            const { tipo, nombre, marca } = fila.dataset;
            if (!nombre || /^Sin (comercio|marca|producto|zona)$/i.test(nombre)) return;
            if (tipo === "comercios" && typeof abrirHistorialDeComercio === "function") tocable(fila, () => abrirHistorialDeComercio(nombre));
            if (tipo === "productos" && window.abrirCatalogoEn) tocable(fila, () => window.abrirCatalogoEn({ marca, producto: nombre }));
            if (tipo === "marcas" && window.abrirCatalogoEn) tocable(fila, () => window.abrirCatalogoEn({ marca: nombre }));
        });
        return card;
    }

    function irAlRanking(pestana) {
        terminarTanda();
        const card = document.querySelector("#contenidoEstadisticas .statsRanking");
        if (!card) return;
        card.querySelector(`[role=tab][data-ranking="${pestana}"]`)?.click();
        card.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    // Qué día de la semana se vende más. Con Hoy o 7 días mira los últimos
    // 30 días (con menos no dice nada).
    function crearDias() {
        const periodo = periodoElegido();
        const corto = periodo === "hoy" || periodo === "semana";
        const lista = corto ? pedidosDelPeriodo("mes") : pedidosDelPeriodo();
        const plataVisible = conPlata;
        const porDia = [0, 0, 0, 0, 0, 0, 0];
        lista.forEach(pedido => {
            const fecha = fechaPedido(pedido);
            if (fecha) porDia[(fecha.getDay() + 6) % 7] += plataVisible ? totalPlata(pedido) : unidadesPedido(pedido);
        });
        const max = Math.max(...porDia);
        const mejor = porDia.indexOf(max);
        const donde = corto ? "en 30 días" : periodo === "anio" ? "en el año" : "en 30 días";
        const card = tarjeta("calendario", "naranja", "Qué día se vende más",
            max > 0 ? `Los ${NOMBRE_DIA[mejor]} · ${valorTexto(max)} ${donde}` : "Todavía no hay ventas", "statsDias");
        if (!(max > 0)) return card;
        const corta = valor => !valor ? "" : plataVisible ? (valor >= 1000000 ? (Math.round(valor / 100000) / 10).toLocaleString("es-AR") + "M" : valor >= 1000 ? Math.round(valor / 1000) + "k" : String(Math.round(valor))) : numero(valor);
        card.insertAdjacentHTML("beforeend", `<div class="statsDiasBarras" role="img" aria-label="Lo vendido por día de la semana">${porDia.map((valor, indice) => `<div class="${indice === mejor ? "mejor" : ""}">
            <small>${corta(valor)}</small><span><i style="height:${valor ? Math.max(8, Math.round(valor / max * 100)) : 0}%"></i></span><b>${DIAS[indice]}</b>
        </div>`).join("")}</div>`);
        return card;
    }

    // ---------- 4. Para crecer ----------
    function crearClientes(completo) {
        const lista = pedidosDelPeriodo();
        const inicio = inicioPeriodo().getTime();
        const ahora = Date.now();
        const largo = Math.max((DIAS_PERIODO[periodoElegido()] || 30), 30) * DIA;
        const primera = new Map(), ultima = new Map();
        completo.forEach(pedido => {
            const fecha = fechaPedido(pedido);
            if (!fecha || !pedido.comercio) return;
            const t = fecha.getTime();
            if (!primera.has(pedido.comercio) || t < primera.get(pedido.comercio)) primera.set(pedido.comercio, t);
            if (!ultima.has(pedido.comercio) || t > ultima.get(pedido.comercio)) ultima.set(pedido.comercio, t);
        });
        const compran = new Set(lista.map(p => p.comercio).filter(Boolean)).size;
        const nuevos = [...primera.entries()].filter(([nombre, t]) => t >= inicio && nombre !== "Sin comercio").sort((a, b) => b[1] - a[1]);
        // Perdidos: compraban y no piden hace más de 45 días.
        const perdidos = [...ultima.entries()].filter(([nombre, t]) => nombre !== "Sin comercio" && ahora - t > 45 * DIA && ahora - t <= 45 * DIA + largo).sort((a, b) => b[1] - a[1]);
        // Pedidos (cargados o entregados) a nombres que no están en Comercios.
        const sinGuardar = new Map();
        (typeof historialParaLeer === "function" ? historialParaLeer() : completo).forEach(pedido => {
            if (!pedido || pedido.eliminado === true) return;
            if (typeof estadoActualDelPedido === "function" && typeof pedidoTieneEstados === "function" && pedidoTieneEstados(pedido) && estadoActualDelPedido(pedido) === "cancelado") return;
            const nombre = String(pedido.comercio || "").trim();
            if (!nombre || comercioGuardado(nombre)) return;
            sinGuardar.set(nombre, (sinGuardar.get(nombre) || 0) + 1);
        });
        // Guardados que nunca compraron.
        const conPedido = new Set([...primera.keys()].map(nombre => String(nombre).trim().toLocaleLowerCase("es")));
        const nunca = (typeof comerciosParaLeer === "function" ? comerciosParaLeer() : [])
            .filter(comercio => comercio && comercio.archivado !== true && comercio.nombre && !conPedido.has(String(comercio.nombre).trim().toLocaleLowerCase("es")));

        const card = tarjeta("tienda", "azul", "Tus clientes", "Cuántos ganaste y perdiste", "statsClientes");
        card.insertAdjacentHTML("beforeend", `<div class="statsClientesNumeros">
            <div><strong>${numero(compran)}</strong><small>compran</small></div>
            <div data-tono="sube"><strong>${nuevos.length ? "+" + nuevos.length : 0}</strong><small>${nuevos.length === 1 ? "nuevo" : "nuevos"}</small></div>
            <div data-tono="baja"><strong>${perdidos.length ? "−" + perdidos.length : 0}</strong><small>${perdidos.length === 1 ? "perdido" : "perdidos"}</small></div>
        </div>`);
        const dias = t => Math.max(0, Math.round((ahora - t) / DIA));
        const filas = [
            ...nuevos.map(([nombre, t]) => `<div class="statsFila" data-ficha="${esc(nombre)}"><span class="statsAvatar">${esc(iniciales(nombre))}</span>
                <div class="statsFilaTexto"><strong>${esc(nombre)}</strong><small class="statsTextoVerde">Nuevo · primer pedido ${dias(t) === 0 ? "hoy" : "hace " + plural(dias(t), "día", "días")}</small></div></div>`),
            ...perdidos.map(([nombre, t]) => `<div class="statsFila" data-ficha="${esc(nombre)}"><span class="statsAvatar" data-tono="atrasado">${esc(iniciales(nombre))}</span>
                <div class="statsFilaTexto"><strong>${esc(nombre)}</strong><small class="statsTextoRojo">Perdido · último pedido hace ${plural(dias(t), "día", "días")}</small></div>${botonWhatsapp(nombre, saludo())}</div>`)
        ];
        if (filas.length) listaCorta(card, filas, 3);
        if (sinGuardar.size) {
            const total = [...sinGuardar.values()].reduce((t, n) => t + n, 0);
            card.insertAdjacentHTML("beforeend", `<div class="statsAvisoSinGuardar" role="note"><span class="ajIcono" data-tono="naranja">${ico("alerta", 18)}</span>
                <div><strong>${plural(total, "pedido", "pedidos")} de comercios sin guardar</strong><small>Cargados o entregados a nombres que no están en Comercios</small></div></div>`);
            listaCorta(card, [...sinGuardar.entries()].sort((a, b) => b[1] - a[1]).map(([nombre, cuantos]) => `<div class="statsFila statsFilaSinGuardar">
                <span class="statsAvatar" data-tono="semana">${esc(iniciales(nombre))}</span>
                <div class="statsFilaTexto"><strong>${esc(nombre)}</strong><small class="statsTextoNaranja">${plural(cuantos, "pedido", "pedidos")} · no está guardado</small></div>
                <button type="button" class="statsPildora" data-crear-comercio="${esc(nombre)}" aria-label="Crear ${esc(nombre)}">${ico("mas", 14)} Crear</button>
            </div>`), 3);
        }
        if (nunca.length) {
            card.insertAdjacentHTML("beforeend", `<p class="statsSubtitulo">Guardados que nunca te compraron</p>`);
            listaCorta(card, nunca.map(comercio => `<div class="statsFila" data-ficha="${esc(comercio.nombre)}">
                <span class="statsAvatar">${esc(iniciales(comercio.nombre))}</span>
                <div class="statsFilaTexto"><strong>${esc(comercio.nombre)}</strong><small>${esc(comercio.direccion || "Todavía sin pedidos")}</small></div>
                <button type="button" class="statsPildora" data-pedido-para="${esc(comercio.nombre)}" aria-label="Pedido para ${esc(comercio.nombre)}">${ico("mas", 14)} Pedido</button>
            </div>`), 2);
        }
        conectarFilas(card);
        return card;
    }

    // Mapa de ventas (antes una pantalla aparte en Más): cada comercio con
    // ubicación, más grande cuanto más compró, y lo vendido por zona. El mapa
    // se arma recién cuando aparece en la pantalla y no se mueve con el dedo
    // (así no traba al bajar); "Ver grande" abre el mapa completo.
    let miniMapa = null;
    function crearMapa() {
        if (!(window.piezas?.esDueno?.() || !(typeof usaNubeReal === "function" && usaNubeReal()))) return null;
        const lista = pedidosDelPeriodo();
        const antes = pedidosDelAnterior();
        const compro = porComercio(lista);
        const porNombre = {};
        Object.entries(compro).forEach(([nombre, valor]) => { porNombre[String(nombre).trim().toLocaleLowerCase("es")] = valor; });
        const conLugar = (typeof comerciosParaLeer === "function" ? comerciosParaLeer() : [])
            .filter(c => c && c.archivado !== true && c.lat !== "" && c.lat !== null && c.lng !== "" && c.lng !== null && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng)));
        const card = tarjeta("mapa", "violeta", "Mapa de ventas", "Dónde vendés y dónde no tenés clientes", "statsMapa");
        if (conLugar.length && window.mapaVendeFrio?.disponible?.()) {
            card.insertAdjacentHTML("beforeend", `<div class="statsMiniMapa" role="img" aria-label="Mapa con ${plural(conLugar.length, "comercio", "comercios")}"><div class="statsMiniMapaCaja"></div>
                <button type="button" class="statsVerGrande">${ico("mapa", 14)} Ver grande</button></div>
                <div class="statsLeyendaMapa"><span><i data-nivel="bueno"></i>Compra mucho</span><span><i data-nivel="medio"></i>Poco</span><span><i data-nivel="flojo"></i>Nada</span></div>`);
            const max = Math.max(...conLugar.map(c => porNombre[String(c.nombre).trim().toLocaleLowerCase("es")] || 0), 1);
            const caja = card.querySelector(".statsMiniMapaCaja");
            const dibujar = () => {
                if (!caja.isConnected || caja.dataset.listo) return;
                caja.dataset.listo = "1";
                if (miniMapa) { try { miniMapa.remove(); } catch (error) { /* ya no estaba */ } miniMapa = null; }
                const mapa = window.mapaVendeFrio.crearMapa(caja, { zoomControl: false });
                if (!mapa) return;
                miniMapa = mapa;
                ["dragging", "touchZoom", "doubleClickZoom", "scrollWheelZoom", "boxZoom", "keyboard"].forEach(nombre => mapa[nombre]?.disable());
                const colores = { bueno: "#14804A", medio: "#E0A100", flojo: "#D93636" };
                const puntos = conLugar.map(comercio => {
                    const valor = porNombre[String(comercio.nombre).trim().toLocaleLowerCase("es")] || 0;
                    const nivel = valor >= max * 0.5 ? "bueno" : valor > 0 ? "medio" : "flojo";
                    const punto = [Number(comercio.lat), Number(comercio.lng)];
                    L.circleMarker(punto, { radius: 6 + Math.round(valor / max * 8), color: "#fff", weight: 2, fillColor: colores[nivel], fillOpacity: 1, interactive: false }).addTo(mapa);
                    return punto;
                });
                if (puntos.length > 1) mapa.fitBounds(puntos, { padding: [24, 24], maxZoom: 16 });
                else mapa.setView(puntos[0], 15);
            };
            if ("IntersectionObserver" in window) {
                const mirar = new IntersectionObserver(entradas => {
                    if (entradas.some(e => e.isIntersecting)) { mirar.disconnect(); dibujar(); }
                }, { rootMargin: "200px" });
                requestAnimationFrame(() => mirar.observe(caja));
            } else setTimeout(dibujar, 0);
            const abrirGrande = () => window.duenoVendeFrio?.abrirMapa?.();
            card.querySelector(".statsMiniMapa").addEventListener("click", abrirGrande);
        } else {
            card.insertAdjacentHTML("beforeend", vacio("Guardá la ubicación de tus comercios (en la puerta, desde su ficha) para verlos en el mapa."));
        }
        const zonaDe = zonas();
        if (zonaDe.size) {
            const ahora = porZona(lista, zonaDe);
            const anterior = porZona(antes, zonaDe);
            const pedidosZona = {};
            lista.forEach(p => { const z = zonaDe.get(String(p.comercio || "").trim().toLocaleLowerCase("es")) || "Sin zona"; pedidosZona[z] = (pedidosZona[z] || 0) + 1; });
            const filas = Object.entries(ahora).sort((a, b) => b[1] - a[1]).map(([zona, valor]) => `<div class="statsFila">
                <span class="statsFilaIcono">${ico("ubicacion", 17)}</span>
                <div class="statsFilaTexto"><strong>${esc(zona)}</strong><small>${plural(pedidosZona[zona] || 0, "pedido", "pedidos")}</small></div>
                <b class="statsFilaValor">${valorTexto(valor)}</b>${variacion(Math.round(valor), Math.round(anterior[zona] || 0))}
            </div>`);
            if (filas.length) card.insertAdjacentHTML("beforeend", `<div class="statsLista">${filas.join("")}</div>`);
        }
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

    // Se dibuja de a partes (T168): arriba el resumen enseguida y las demás
    // tarjetas en los cuadros siguientes, así la pantalla aparece al tocar
    // aunque haya muchos pedidos. Si nada cambió desde la última vez (mismos
    // pedidos, período y día), al volver a entrar no se rehace.
    let tandaPendiente = null;
    // Pone ya las tarjetas que faltaban (para ir a una que todavía no llegó).
    let terminarTanda = () => {};
    let firmaDibujada = "";
    const idsDeListas = new WeakMap();
    let ultimoIdDeLista = 0;

    function firmaActual() {
        const lista = pedidosQueCuentan();
        if (!idsDeListas.has(lista)) idsDeListas.set(lista, ++ultimoIdDeLista);
        const todos = typeof historialParaLeer === "function" ? historialParaLeer() : lista;
        if (!idsDeListas.has(todos)) idsDeListas.set(todos, ++ultimoIdDeLista);
        return [
            idsDeListas.get(lista),
            idsDeListas.get(todos),
            typeof marcaDeColeccion === "function" ? marcaDeColeccion("comercios") : "",
            typeof marcaDeColeccion === "function" ? marcaDeColeccion("rutas") : "",
            periodoElegido(),
            new Date().toDateString(),
            verPlata(),
            window.piezas?.esDueno?.() === true
        ].join("|");
    }

    // La cantidad de pedidos de cada período, dentro de su botón.
    function contarPeriodos() {
        const s = document.getElementById("pantallaEstadisticas");
        if (!s) return;
        const elegido = periodoElegido();
        s.querySelectorAll("[data-periodo]").forEach(boton => {
            const cantidad = boton.querySelector(".filtroEtapaCantidad");
            if (cantidad) cantidad.textContent = numero(pedidosDelPeriodo(boton.dataset.periodo).length);
            boton.classList.toggle("activo", boton.dataset.periodo === elegido);
            boton.setAttribute("aria-pressed", String(boton.dataset.periodo === elegido));
        });
    }

    function renderizar() {
        const destino = document.getElementById("contenidoEstadisticas"); if (!destino) return;
        if (tandaPendiente) { clearTimeout(tandaPendiente); tandaPendiente = null; }
        if (miniMapa) { try { miniMapa.remove(); } catch (error) { /* ya no estaba */ } miniMapa = null; }
        destino.innerHTML = "";
        firmaDibujada = firmaActual();
        contarPeriodos();
        decidirMedida();
        const historial = pedidosDelPeriodo();
        const completo = pedidosQueCuentan();
        // Las de otros módulos: las metas van en "Cómo vengo" y las demás
        // (visitas sin pedido) al final de "Qué hacer hoy".
        const otras = [];
        const periodo = periodoElegido();
        const partes = [
            () => seccion("Cómo vengo", NOMBRE_PERIODO[periodo] + " comparado con " + ANTERIOR[periodo]),
            () => crearResumen(),
            () => {
                tarjetasExtra.forEach(crear => {
                    const card = extra(crear, historial, completo);
                    if (card && card.classList.contains("statsMetas")) destino.appendChild(card);
                    else if (card) otras.push(card);
                });
                return null;
            },
            () => seccion("Qué hacer hoy", "A quién ir a ver y qué ofrecerle"),
            () => crearVisitas(completo),
            () => { otras.forEach(card => destino.appendChild(card)); return null; },
            () => seccion("Qué se mueve", "Qué sube, qué baja y cuándo se vende"),
            () => crearRanking(),
            () => crearDias(),
            () => seccion("Para crecer", "Clientes nuevos, perdidos y zonas"),
            () => crearClientes(completo),
            () => crearMapa()
        ];
        const poner = parte => { const card = parte(); if (card) destino.appendChild(card); };
        partes.splice(0, 3).forEach(poner);
        const seguir = () => {
            tandaPendiente = null;
            const inicio = performance.now();
            // Unas cuantas por cuadro, sin trabar más de unos 40 ms.
            while (partes.length && performance.now() - inicio < 40) poner(partes.shift());
            if (partes.length) tandaPendiente = setTimeout(seguir, 0);
        };
        terminarTanda = () => {
            if (tandaPendiente) { clearTimeout(tandaPendiente); tandaPendiente = null; }
            while (partes.length) poner(partes.shift());
        };
        tandaPendiente = setTimeout(seguir, 0);
    }

    // Desde un número (por ejemplo "Vendido hoy" en Inicio) abre en ese
    // período.
    function abrir(periodo) {
        const s = document.getElementById("pantallaEstadisticas") || crearPantalla();
        // Al entrar, desde arriba. Si ya estaba abierta y llegan datos nuevos,
        // no se mueve.
        const entrando = s.classList.contains("oculto");
        ocultarPantallas(); s.classList.remove("oculto");
        if (entrando) window.scrollTo(0, 0);
        const elegido = document.getElementById("filtroPeriodoEstadisticas");
        if (elegido && typeof periodo === "string" && NOMBRE_PERIODO[periodo]) elegido.value = periodo === "todo" ? "anio" : periodo;
        if (tandaPendiente || firmaDibujada !== firmaActual()) renderizar();
        else contarPeriodos();
        const filtro = document.getElementById("filtroPeriodoEstadisticas");
        if (filtro && !filtro.dataset.conectado) {
            filtro.addEventListener("change", renderizar);
            filtro.dataset.conectado = "true";
            s.querySelectorAll("[data-periodo]").forEach(b => b.addEventListener("click", () => {
                if (filtro.value === b.dataset.periodo) return;
                filtro.value = b.dataset.periodo;
                renderizar();
            }));
        }
    }
    window.abrirEstadisticas = abrir;
    window.estadisticasVendeFrio = {
        tarjeta, vacio, periodoElegido, inicioPeriodo, NOMBRE_PERIODO,
        // Inicio: "Productos distintos vendidos hoy" abre el ranking en Productos.
        irAlRanking,
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
