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
                    <div class="pzFilaTxt"><strong>${p.esc(nombre)}</strong><small>${cuantos} ${cuantos === 1 ? "comercio" : "comercios"}</small></div>
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

    function volverAlCatalogo() {
        if (typeof mostrarPantalla === "function") mostrarPantalla("catalogo");
        if (typeof window.renderizarCatalogo === "function") window.renderizarCatalogo();
    }

    window.listasDePrecios = listas;
    window.listasPreciosVendeFrio = { listas, comerciosEn, abrir };
}());
