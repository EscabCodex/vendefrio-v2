// VendeFrío - Listas de precios (T78).
// Cada producto puede tener un precio por lista ("Mayorista", "Minorista",
// "Zona sur"...) en `producto.precios`, y cada comercio una lista en
// `comercio.listaPrecios` (ficha > datos). Nuevo pedido usa el precio de la
// lista del comercio (database.js, precioDeLista); si el producto no tiene
// precio en esa lista, usa el general. Los pedidos ya cargados guardan el
// precio que tenían.
(function () {
    "use strict";

    const p = window.piezas;
    const nuevas = new Set();
    const COLORES = ["pzIniInfo", "pzIni2", "pzIni1", "pzIni3"];

    function todosLosProductos() {
        if (typeof obtenerProductos !== "function") return [];
        const productos = obtenerProductos();
        return Object.keys(productos).flatMap(marca => productos[marca].map(producto => ({ ...producto, marca })));
    }

    // Los nombres de las listas: las que tienen algún precio cargado, más las
    // recién creadas.
    function listas() {
        const nombres = new Set(nuevas);
        todosLosProductos().forEach(producto => {
            const precios = producto.precios && typeof producto.precios === "object" ? producto.precios : {};
            Object.keys(precios).forEach(nombre => {
                if (Number(precios[nombre]) > 0) nombres.add(nombre);
            });
        });
        return [...nombres].filter(Boolean).sort((a, b) => a.localeCompare(b, "es"));
    }

    function comerciosEn(nombre) {
        if (typeof obtenerComercios !== "function") return 0;
        return obtenerComercios().filter(comercio => comercio.listaPrecios === nombre && comercio.archivado !== true).length;
    }

    function abrir(producto) {
        const encontrado = typeof obtenerProductoPorId === "function" ? obtenerProductoPorId(producto.id) : null;
        if (!encontrado) return;
        const actual = { ...encontrado.producto, marca: encontrado.marca };
        const precios = { ...(actual.precios && typeof actual.precios === "object" ? actual.precios : {}) };

        const seccion = p.pantalla("pantallaPreciosLista", {
            titulo: "Precios por lista",
            sub: actual.marca + " · " + actual.nombre,
            volverA: () => volverAlCatalogo()
        });
        p.mostrar(seccion);

        function dibujar() {
            const nombres = [...new Set([...listas(), ...Object.keys(precios)])].sort((a, b) => a.localeCompare(b, "es"));
            const filas = nombres.map((nombre, i) => {
                const cuantos = comerciosEn(nombre);
                const valor = Number(precios[nombre]) > 0 ? Number(precios[nombre]) : "";
                return `<div class="pzFila filaLista">
                    <div class="pzIni ${COLORES[i % COLORES.length]}">${p.ico(/zona/i.test(nombre) ? "ubicacion" : "etiqueta", 20)}</div>
                    <button type="button" class="pzFilaTxt botonTodaLista" data-toda-lista="${p.esc(nombre)}" aria-label="Ver toda la lista ${p.esc(nombre)}"><strong>${p.esc(nombre)}</strong><small>${cuantos} ${cuantos === 1 ? "comercio" : "comercios"} · <span class="enlaceTodaLista">ver toda la lista</span></small></button>
                    <label class="pzPrecioLista"><span>$</span><input type="number" inputmode="decimal" min="0" step="1" data-lista="${p.esc(nombre)}" value="${valor}" placeholder="${Number(actual.precio) || ""}" aria-label="Precio ${p.esc(nombre)}"></label>
                </div>`;
            }).join("");
            const imagen = actual.imagen ? `<img alt="" src="${p.esc(actual.imagen)}">` : p.ico("paquete", 30);
            seccion.querySelector("main").innerHTML = `<div class="pzTarjeta pzProductoCab">
                    <div class="pzProductoFoto">${imagen}</div>
                    <div><small>${p.esc(actual.marca)}</small><strong>${p.esc(actual.nombre)}</strong><span>General: ${actual.precio ? p.plata(actual.precio) : "sin precio"}</span></div>
                </div>
                <section class="pzBloque">
                    <div class="pzBloqueCab"><h2>Precios</h2><button type="button" class="pzEnlace" id="listaNueva">${p.ico("mas", 16)} Lista nueva</button></div>
                    <div class="pzTarjeta pzLista">${filas || `<div class="pzVacio">Todavía no hay listas. Tocá «Lista nueva» (por ejemplo, Mayorista).</div>`}</div>
                </section>
                <div class="pzBanner pzBanAviso" id="avisoListas">${p.ico("alerta", 22)}<div><small>Los pedidos ya cargados guardan el precio que tenían: cambiar una lista no los toca. Si un producto no tiene precio en la lista, se usa el general.</small></div></div>
                <div class="pzBotonesFijos"><button type="button" class="pzBtn pzBtnPri" id="guardarPreciosLista">Guardar</button></div>`;
        }

        seccion.querySelector("main").oninput = evento => {
            const campo = evento.target.closest("[data-lista]");
            if (!campo) return;
            const valor = Math.round(Number(String(campo.value).replace(",", ".")) * 100) / 100;
            if (Number.isFinite(valor) && valor > 0) precios[campo.dataset.lista] = valor;
            else delete precios[campo.dataset.lista];
        };
        seccion.querySelector("main").onclick = evento => {
            const toda = evento.target.closest("[data-toda-lista]");
            if (toda) {
                abrirLista(toda.dataset.todaLista, () => abrir(producto));
                return;
            }
            if (evento.target.closest("#listaNueva")) {
                p.hoja({
                    titulo: "Lista nueva",
                    sub: "Después elegís qué comercios la usan, en su ficha",
                    etiqueta: "Lista nueva",
                    html: `<label class="pzCampo"><span>Nombre</span><input id="nombreListaNueva" maxlength="30" placeholder="Ej.: Mayorista"></label>`,
                    botones: [{
                        texto: "Crear lista",
                        icono: "check",
                        alTocar: caja => {
                            const nombre = String(caja.querySelector("#nombreListaNueva").value || "").trim().replace(/\s+/g, " ").slice(0, 30);
                            if (!nombre) {
                                mostrarToast("Escribí el nombre de la lista");
                                return false;
                            }
                            if (listas().some(otra => otra.toLocaleLowerCase("es") === nombre.toLocaleLowerCase("es"))) {
                                mostrarToast("Ya hay una lista «" + nombre + "»");
                                return false;
                            }
                            nuevas.add(nombre);
                            dibujar();
                            setTimeout(() => seccion.querySelector(`[data-lista="${CSS.escape(nombre)}"]`)?.focus(), 250);
                            return true;
                        }
                    }]
                });
                setTimeout(() => document.getElementById("nombreListaNueva")?.focus(), 200);
                return;
            }
            if (evento.target.closest("#guardarPreciosLista")) {
                const limpio = {};
                Object.keys(precios).forEach(nombre => {
                    if (Number(precios[nombre]) > 0) limpio[nombre] = Number(precios[nombre]);
                });
                if (!actualizarProductoPorId(actual.id, { precios: limpio })) {
                    mostrarAviso("No se guardó", "Revisá el almacenamiento y probá de nuevo.");
                    return;
                }
                mostrarToast("Precios guardados");
                volverAlCatalogo();
            }
        };
        dibujar();
    }

    // ---------- Toda una lista en una pantalla (T115) ----------
    // Cada producto con su precio general y el de la lista. Arriba, "% sobre
    // el general" y redondeo para llenar todos de una vez; después se puede
    // corregir uno por uno.
    const REDONDEOS = [[1, "Sin redondear"], [10, "A $ 10"], [50, "A $ 50"], [100, "A $ 100"]];

    function redondear(valor, paso) {
        return paso > 1 ? Math.round(valor / paso) * paso : Math.round(valor);
    }

    function abrirLista(nombre, alVolver) {
        const productos = todosLosProductos().filter(producto => producto.archivado !== true);
        const precios = {};
        productos.forEach(producto => {
            const valor = Number(producto.precios && producto.precios[nombre]);
            if (valor > 0) precios[producto.id] = valor;
        });
        let porcentaje = "";
        let paso = 10;
        const volver = typeof alVolver === "function" ? alVolver : volverAlCatalogo;

        const seccion = p.pantalla("pantallaTodaLista", {
            titulo: nombre,
            sub: "Todos los precios de esta lista",
            volverA: () => volver()
        });
        p.mostrar(seccion);

        function filas() {
            return productos.map(producto => {
                const valor = precios[producto.id] || "";
                const general = Number(producto.precio) || 0;
                const diferencia = valor && general ? Math.round((valor - general) / general * 100) : null;
                return `<div class="pzFila filaTodaLista">
                    <div class="pzFilaTxt"><strong>${p.esc(producto.nombre)}</strong><small>${p.esc(producto.marca)} · general ${general ? p.plata(general) : "sin precio"}${diferencia !== null && diferencia !== 0 ? ` · <b class="${diferencia < 0 ? "bajaLista" : "subeLista"}">${diferencia > 0 ? "+" : ""}${diferencia}%</b>` : ""}</small></div>
                    <label class="pzPrecioLista"><span>$</span><input type="number" inputmode="decimal" min="0" step="1" data-producto-lista="${p.esc(producto.id)}" value="${valor}" placeholder="${general || ""}" aria-label="Precio ${p.esc(producto.nombre)} en ${p.esc(nombre)}"></label>
                </div>`;
            }).join("");
        }

        function dibujar() {
            const cuantos = comerciosEn(nombre);
            seccion.querySelector("main").innerHTML = `<div class="pzTarjeta pzRelleno ajusteTodaLista">
                    <strong>Llenar todos desde el precio general</strong>
                    <small>${cuantos} ${cuantos === 1 ? "comercio usa" : "comercios usan"} esta lista. Ej.: −10 para un 10% menos.</small>
                    <div class="filaAjusteLista">
                        <label class="pzCampo campoPorcentaje"><span>% sobre el general</span><input id="porcentajeLista" type="number" inputmode="decimal" step="1" placeholder="0" value="${porcentaje}"></label>
                        <button type="button" class="pzBtn pzBtnPri" id="aplicarPorcentajeLista">Aplicar a todos</button>
                    </div>
                    <div class="pzSegmentos redondeoLista" role="group" aria-label="Redondeo">
                        ${REDONDEOS.map(([valor, texto]) => `<button type="button" data-redondeo="${valor}" aria-pressed="${paso === valor}">${texto}</button>`).join("")}
                    </div>
                </div>
                <section class="pzBloque">
                    <div class="pzBloqueCab"><h2>${productos.length} ${productos.length === 1 ? "producto" : "productos"}</h2></div>
                    <div class="pzTarjeta pzLista" id="filasTodaLista">${filas() || `<div class="pzVacio">Todavía no cargaste productos.</div>`}</div>
                </section>
                <div class="pzNota">Si dejás un precio vacío, ese producto usa el general.</div>
                <div class="pzBotonesFijos"><button type="button" class="pzBtn pzBtnPri" id="guardarTodaLista">Guardar la lista</button></div>`;
        }

        seccion.querySelector("main").oninput = evento => {
            if (evento.target.id === "porcentajeLista") {
                porcentaje = evento.target.value;
                return;
            }
            const campo = evento.target.closest("[data-producto-lista]");
            if (!campo) return;
            const valor = Math.round(Number(String(campo.value).replace(",", ".")) * 100) / 100;
            if (Number.isFinite(valor) && valor > 0) precios[campo.dataset.productoLista] = valor;
            else delete precios[campo.dataset.productoLista];
        };
        seccion.querySelector("main").onclick = evento => {
            const redondeo = evento.target.closest("[data-redondeo]");
            if (redondeo) {
                paso = Number(redondeo.dataset.redondeo) || 1;
                seccion.querySelectorAll("[data-redondeo]").forEach(boton => boton.setAttribute("aria-pressed", String(boton === redondeo)));
                return;
            }
            if (evento.target.closest("#aplicarPorcentajeLista")) {
                const cuanto = Number(String(porcentaje).replace(",", "."));
                if (!Number.isFinite(cuanto) || cuanto <= -100) {
                    mostrarToast("Escribí un porcentaje, por ejemplo −10");
                    return;
                }
                productos.forEach(producto => {
                    const general = Number(producto.precio) || 0;
                    if (general > 0) precios[producto.id] = Math.max(1, redondear(general * (1 + cuanto / 100), paso));
                });
                document.getElementById("filasTodaLista").innerHTML = filas();
                mostrarToast("Listo: revisalos y tocá «Guardar la lista»");
                return;
            }
            if (evento.target.closest("#guardarTodaLista")) {
                let fallo = false;
                productos.forEach(producto => {
                    const actuales = { ...(producto.precios && typeof producto.precios === "object" ? producto.precios : {}) };
                    const antes = Number(actuales[nombre]) || 0;
                    const ahora = Number(precios[producto.id]) || 0;
                    if (antes === ahora) return;
                    if (ahora > 0) actuales[nombre] = ahora; else delete actuales[nombre];
                    if (!actualizarProductoPorId(producto.id, { precios: actuales })) fallo = true;
                });
                if (fallo) {
                    mostrarAviso("No se guardó todo", "Revisá el almacenamiento y probá de nuevo.");
                    return;
                }
                nuevas.add(nombre);
                mostrarToast("Lista «" + nombre + "» guardada");
                volver();
            }
        };
        dibujar();
    }

    function volverAlCatalogo() {
        if (typeof mostrarPantalla === "function") mostrarPantalla("catalogo");
        if (typeof window.renderizarCatalogo === "function") window.renderizarCatalogo();
    }

    window.listasDePrecios = listas;
    window.listasPreciosVendeFrio = { listas, comerciosEn, abrir, abrirLista };
}());
