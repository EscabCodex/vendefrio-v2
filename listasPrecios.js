// VendeFrío - Listas de precios (T78).
// Cada producto puede tener un precio por lista ("Kioscos", "Supermercados"...)
// en `producto.precios`, y cada comercio una lista en `comercio.listaPrecios`.
// Nuevo pedido usa el precio de la lista del comercio (database.js,
// precioDeLista); si el producto no tiene precio en esa lista, usa el
// general. Los pedidos ya cargados guardan el precio que tenían.
// T161: Más > Listas de precios para crear, renombrar y borrar listas.
// T162: «Exportar a planilla» (CSV) y «Folleto para imprimir».
// Repaso de diseño (2026-11-02): cada lista tiene su regla («+5% sobre el
// general, redondeo a $ 10»). Si «sigue al general», cuando cambia el precio
// general de un producto su precio en la lista se vuelve a calcular solo
// (database.js, guardarProductos → aplicarReglas). Los precios cambiados a
// mano quedan fijos: `producto.preciosAMano` guarda en qué listas. Desde la
// pantalla también se eligen los comercios que usan cada lista.
(function () {
    "use strict";

    const p = window.piezas;
    // Las listas creadas que todavía no tienen precios (en este celular).
    const DB_CREADAS = "vendefrio_listas_creadas";
    const nuevas = {
        leer: () => {
            const guardadas = p.lsLeer(DB_CREADAS, []);
            return Array.isArray(guardadas) ? guardadas.map(String).filter(Boolean) : [];
        },
        add(nombre) {
            const lista = this.leer();
            if (!lista.includes(nombre)) p.lsGuardar(DB_CREADAS, [...lista, nombre]);
        },
        cambiar(viejo, nuevo) {
            const lista = this.leer().filter(nombre => nombre !== viejo);
            p.lsGuardar(DB_CREADAS, nuevo ? [...lista, nuevo] : lista);
        },
        [Symbol.iterator]() { return this.leer()[Symbol.iterator](); }
    };
    const COLORES = ["pzIniInfo", "pzIni2", "pzIni1", "pzIni3"];

    // ---------- Reglas de cada lista ----------
    // { [lista]: { porcentaje, redondeo, sigue } }. Sin nube, en este
    // celular; con nube, en config/listas (la ven todos los del equipo).
    const DB_REGLAS = "vendefrio_listas_reglas";
    const REDONDEOS = [[1, "Sin"], [10, "$ 10"], [50, "$ 50"], [100, "$ 100"]];
    let reglasNube = {};
    let dejarDeEscuchar = null;
    let idEscuchando = null;

    function enLaNube() {
        return typeof usaNubeReal === "function" && usaNubeReal();
    }

    function limpiarReglas(datos) {
        const limpias = {};
        if (!datos || typeof datos !== "object") return limpias;
        Object.keys(datos).forEach(nombre => {
            const regla = datos[nombre];
            const porcentaje = Number(regla && regla.porcentaje);
            if (!nombre || !regla || !Number.isFinite(porcentaje) || porcentaje <= -100) return;
            const redondeo = REDONDEOS.some(([valor]) => valor === Number(regla.redondeo)) ? Number(regla.redondeo) : 1;
            limpias[nombre] = { porcentaje, redondeo, sigue: regla.sigue !== false };
        });
        return limpias;
    }

    function escucharReglas() {
        const ref = p.refNube();
        const id = ref ? ref.id : null;
        if (id === idEscuchando && (dejarDeEscuchar || !id)) return;
        if (dejarDeEscuchar) dejarDeEscuchar();
        dejarDeEscuchar = null;
        idEscuchando = id;
        reglasNube = {};
        if (!ref) return;
        dejarDeEscuchar = ref.collection("config").doc("listas").onSnapshot(foto => {
            const nuevas = limpiarReglas(foto.exists ? (foto.data() || {}).reglas : null);
            if (JSON.stringify(nuevas) === JSON.stringify(reglasNube)) return;
            reglasNube = nuevas;
            if (seccionMas && !seccionMas.classList.contains("oculto")) dibujarPantalla();
        }, error => {
            console.warn("No se pudieron leer las reglas de las listas.", error);
            dejarDeEscuchar = null;
            idEscuchando = null;
        });
    }

    function reglas() {
        if (!enLaNube()) return limpiarReglas(p.lsLeer(DB_REGLAS, {}));
        escucharReglas();
        return reglasNube;
    }

    function reglaDe(nombre) {
        return reglas()[nombre] || null;
    }

    function guardarReglas(todas) {
        const limpias = limpiarReglas(todas);
        if (!enLaNube()) return p.lsGuardar(DB_REGLAS, limpias);
        const ref = p.refNube();
        if (!ref) return false;
        reglasNube = limpias;
        // Sin señal queda en el celular y se sube sola al volver.
        ref.collection("config").doc("listas").set({ reglas: limpias }).catch(error => {
            console.error("No se guardaron las reglas de las listas.", error);
            if (typeof mostrarAviso === "function") mostrarAviso("No se guardó la regla", "Revisá la conexión y probá de nuevo.");
        });
        return true;
    }

    function ponerRegla(nombre, regla) {
        const todas = { ...reglas() };
        if (regla) todas[nombre] = regla; else delete todas[nombre];
        return guardarReglas(todas);
    }

    function redondear(valor, paso) {
        return paso > 1 ? Math.round(valor / paso) * paso : Math.round(valor);
    }

    // El precio que da la regla para un precio general (0 si no hay general).
    function precioPorRegla(regla, general) {
        const base = Number(general) || 0;
        if (!regla || base <= 0) return 0;
        return Math.max(1, redondear(base * (1 + regla.porcentaje / 100), regla.redondeo));
    }

    function aMano(producto, nombre) {
        return Array.isArray(producto && producto.preciosAMano) && producto.preciosAMano.includes(nombre);
    }

    // Antes de guardar el catálogo: las listas que siguen al general vuelven
    // a calcular el precio de cada producto (menos los cambiados a mano).
    function aplicarReglas(productos) {
        const queSiguen = Object.entries(reglas()).filter(([, regla]) => regla.sigue);
        if (!queSiguen.length || !productos || typeof productos !== "object") return;
        Object.keys(productos).forEach(marca => {
            const lista = productos[marca];
            if (!Array.isArray(lista) || Object.isFrozen(lista)) return;
            lista.forEach((producto, i) => {
                if (!producto || typeof producto !== "object") return;
                const precios = { ...(producto.precios && typeof producto.precios === "object" ? producto.precios : {}) };
                let cambio = false;
                queSiguen.forEach(([nombre, regla]) => {
                    if (aMano(producto, nombre)) return;
                    const valor = precioPorRegla(regla, producto.precio);
                    if (valor > 0 && precios[nombre] !== valor) { precios[nombre] = valor; cambio = true; }
                    if (!valor && nombre in precios) { delete precios[nombre]; cambio = true; }
                });
                if (cambio) lista[i] = { ...producto, precios };
            });
        });
    }

    function textoPorcentaje(valor) {
        const n = Math.round(Number(valor) * 10) / 10;
        return (n > 0 ? "+" : n < 0 ? "−" : "") + String(Math.abs(n)).replace(".", ",") + "%";
    }

    function textoRedondeo(paso) {
        return paso > 1 ? "redondeo a $ " + paso : "sin redondeo";
    }

    function todosLosProductos() {
        if (typeof productosParaLeer !== "function") return [];
        const productos = productosParaLeer();
        return Object.keys(productos).flatMap(marca => productos[marca].map(producto => ({ ...producto, marca })));
    }

    // Los nombres de las listas: las que tienen regla o algún precio
    // cargado, más las recién creadas.
    function listas() {
        const nombres = new Set([...nuevas, ...Object.keys(reglas())]);
        todosLosProductos().forEach(producto => {
            const precios = producto.precios && typeof producto.precios === "object" ? producto.precios : {};
            Object.keys(precios).forEach(nombre => {
                if (Number(precios[nombre]) > 0) nombres.add(nombre);
            });
        });
        return [...nombres].filter(Boolean).sort((a, b) => a.localeCompare(b, "es"));
    }

    function comerciosActivos() {
        return typeof comerciosParaLeer === "function" ? comerciosParaLeer().filter(comercio => comercio.archivado !== true) : [];
    }

    function comerciosEn(nombre) {
        return comerciosActivos().filter(comercio => comercio.listaPrecios === nombre).length;
    }

    const plural = (n, uno, varios) => n + " " + (n === 1 ? uno : varios);

    // La etiqueta de la derecha del nombre: «a mano» o cuánto difiere del general.
    function etiquetaPrecio(valor, general, manual) {
        if (manual) return `<span class="lpTag lpTagMano">a mano</span>`;
        if (!valor || !general) return "";
        const diferencia = Math.round((valor - general) / general * 100);
        return diferencia ? `<span class="lpTag">${textoPorcentaje(diferencia)}</span>` : "";
    }

    // Cabeza de las hojas: ícono, título, una línea y la X.
    function cabezaHoja(icono, titulo, sub) {
        return `<div class="lpHCab"><span class="lpHIco">${p.ico(icono, 22)}</span><div><strong>${p.esc(titulo)}</strong><small>${p.esc(sub)}</small></div><button type="button" class="lpHX" data-cerrar-hoja aria-label="Cerrar">${p.ico("cerrarX", 20)}</button></div>`;
    }

    function cerrarConX(caja) {
        caja.addEventListener("click", evento => {
            if (evento.target.closest("[data-cerrar-hoja]")) p.cerrar();
        });
    }

    // ---------- Un producto en todas las listas ----------
    function abrir(producto) {
        const encontrado = typeof obtenerProductoPorId === "function" ? obtenerProductoPorId(producto.id) : null;
        if (!encontrado) return;
        const actual = { ...encontrado.producto, marca: encontrado.marca };
        const general = Number(actual.precio) || 0;
        const precios = { ...(actual.precios && typeof actual.precios === "object" ? actual.precios : {}) };
        const manuales = new Set(Array.isArray(actual.preciosAMano) ? actual.preciosAMano : []);

        const seccion = p.pantalla("pantallaPreciosLista", {
            titulo: "Precios por lista",
            volverA: () => volverAlCatalogo()
        });
        p.mostrar(seccion);

        function dibujar() {
            const nombres = [...new Set([...listas(), ...Object.keys(precios)])].sort((a, b) => a.localeCompare(b, "es"));
            const algunaSigue = nombres.some(nombre => reglaDe(nombre)?.sigue);
            const filas = nombres.map((nombre, i) => {
                const cuantos = comerciosEn(nombre);
                const regla = reglaDe(nombre);
                const valor = Number(precios[nombre]) > 0 ? Number(precios[nombre]) : "";
                const manual = Boolean(regla?.sigue) && manuales.has(nombre);
                const sugerido = regla?.sigue ? precioPorRegla(regla, general) : general;
                return `<div class="pzFila filaLista">
                    <div class="pzIni ${COLORES[i % COLORES.length]}">${p.ico(/zona/i.test(nombre) ? "ubicacion" : "etiqueta", 20)}</div>
                    <div class="pzFilaTxt"><strong>${p.esc(nombre)}</strong><small>${plural(cuantos, "comercio", "comercios")}<span data-etiqueta-lista="${p.esc(nombre)}">${etiquetaPrecio(valor, general, manual)}</span></small></div>
                    <label class="pzPrecioLista"><span>$</span><input type="number" inputmode="decimal" min="0" step="1" data-lista="${p.esc(nombre)}" value="${valor}" placeholder="${sugerido || ""}" aria-label="Precio ${p.esc(nombre)}"></label>
                </div>`;
            }).join("");
            const imagen = actual.imagen ? `<img alt="" src="${p.esc(actual.imagen)}">` : p.ico("paquete", 30);
            seccion.querySelector("main").innerHTML = `<div class="pzTarjeta pzProductoCab">
                    <div class="pzProductoFoto">${imagen}</div>
                    <div><small>${p.esc(actual.marca)}</small><strong>${p.esc(actual.nombre)}</strong><span>General: ${general ? p.plata(general) : "sin precio"}</span></div>
                </div>
                <section class="pzBloque">
                    <div class="pzBloqueCab"><h2>Precio en cada lista</h2><button type="button" class="pzEnlace" id="listaNueva">${p.ico("mas", 16)} Lista nueva</button></div>
                    <div class="pzTarjeta pzLista">${filas || `<div class="pzVacio">Todavía no hay listas. Tocá «Lista nueva» (por ejemplo, Kioscos).</div>`}</div>
                    ${algunaSigue ? `<p class="lpNota">Si lo cambiás a mano, ese precio queda fijo aunque la lista suba.</p>` : ""}
                </section>
                <div class="pzBotonesFijos"><button type="button" class="pzBtn pzBtnPri" id="guardarPreciosLista">Guardar</button></div>`;
        }

        seccion.querySelector("main").oninput = evento => {
            const campo = evento.target.closest("[data-lista]");
            if (!campo) return;
            const nombre = campo.dataset.lista;
            const regla = reglaDe(nombre);
            const valor = Math.round(Number(String(campo.value).replace(",", ".")) * 100) / 100;
            if (Number.isFinite(valor) && valor > 0) precios[nombre] = valor;
            else delete precios[nombre];
            if (regla?.sigue) {
                if (precios[nombre] && precios[nombre] !== precioPorRegla(regla, general)) manuales.add(nombre);
                else manuales.delete(nombre);
            }
            const etiqueta = seccion.querySelector(`[data-etiqueta-lista="${CSS.escape(nombre)}"]`);
            if (etiqueta) etiqueta.innerHTML = etiquetaPrecio(precios[nombre], general, Boolean(regla?.sigue) && manuales.has(nombre));
        };
        seccion.querySelector("main").onclick = evento => {
            if (evento.target.closest("#listaNueva")) {
                pedirNombre({
                    titulo: "Lista nueva",
                    boton: "Crear lista",
                    alGuardar: nombre => {
                        nuevas.add(nombre);
                        dibujar();
                        setTimeout(() => seccion.querySelector(`[data-lista="${CSS.escape(nombre)}"]`)?.focus(), 250);
                    }
                });
                return;
            }
            if (evento.target.closest("#guardarPreciosLista")) {
                const limpio = {};
                Object.keys(precios).forEach(nombre => {
                    if (Number(precios[nombre]) > 0) limpio[nombre] = Number(precios[nombre]);
                });
                // Las que siguen al general y quedaron vacías vuelven a la regla.
                const aManoAhora = [...manuales].filter(nombre => reglaDe(nombre)?.sigue && limpio[nombre]);
                const otrosAMano = (Array.isArray(actual.preciosAMano) ? actual.preciosAMano : []).filter(nombre => !reglaDe(nombre)?.sigue);
                const preciosAMano = [...new Set([...otrosAMano, ...aManoAhora])];
                if (!actualizarProductoPorId(actual.id, { precios: limpio, preciosAMano: preciosAMano.length ? preciosAMano : undefined })) {
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
    // Arriba, la regla («+5% sobre el general») con «Cambiar»; abajo, los
    // productos por marca con la lupa y los filtros. Cada precio se puede
    // corregir a mano.
    function abrirLista(nombre, alVolver) {
        const productos = todosLosProductos().filter(producto => producto.archivado !== true);
        const precios = {};
        const manuales = new Set();
        productos.forEach(producto => {
            const valor = Number(producto.precios && producto.precios[nombre]);
            if (valor > 0) precios[producto.id] = valor;
            if (aMano(producto, nombre)) manuales.add(producto.id);
        });
        let regla = reglaDe(nombre);
        let reglaCambiada = false;
        let filtro = "todos";
        let busqueda = "";
        const volver = typeof alVolver === "function" ? alVolver : volverAlCatalogo;
        const marcas = [...new Set(productos.map(producto => producto.marca))];

        const seccion = p.pantalla("pantallaTodaLista", {
            titulo: nombre,
            volverA: () => volver()
        });
        p.mostrar(seccion);

        const esManual = producto => Boolean(regla?.sigue) && manuales.has(producto.id);

        function fila(producto) {
            const general = Number(producto.precio) || 0;
            const valor = precios[producto.id] || "";
            const sugerido = regla?.sigue ? precioPorRegla(regla, general) : general;
            return `<div class="lpFila filaTodaLista">
                <div class="lpFilaTxt"><strong>${p.esc(producto.nombre)}</strong><small>general ${general ? p.plata(general) : "sin precio"}<span data-etiqueta-producto="${p.esc(producto.id)}">${etiquetaPrecio(valor, general, esManual(producto))}</span></small></div>
                <label class="pzPrecioLista${esManual(producto) ? " lpPrecioMano" : ""}"><span>$</span><input type="number" inputmode="decimal" min="0" step="1" data-producto-lista="${p.esc(producto.id)}" value="${valor}" placeholder="${sugerido || ""}" aria-label="Precio ${p.esc(producto.nombre)} en ${p.esc(nombre)}"></label>
            </div>`;
        }

        function filas() {
            const texto = busqueda.trim().toLocaleLowerCase("es");
            const visibles = productos.filter(producto => {
                if (filtro === "mano" && !esManual(producto)) return false;
                if (filtro !== "todos" && filtro !== "mano" && producto.marca !== filtro) return false;
                return !texto || String(producto.nombre).toLocaleLowerCase("es").includes(texto);
            });
            if (!productos.length) return `<div class="pzVacio">Todavía no cargaste productos.</div>`;
            if (!visibles.length) return `<div class="pzVacio">No hay productos con «${p.esc(busqueda.trim())}».</div>`;
            return marcas.map(marca => {
                const deMarca = visibles.filter(producto => producto.marca === marca);
                return deMarca.length ? `<div class="lpMarca">${p.esc(marca)}</div><div class="lpLista">${deMarca.map(fila).join("")}</div>` : "";
            }).join("");
        }

        function tarjetaRegla() {
            const cuantos = comerciosEn(nombre);
            if (!regla) {
                return `<div class="lpRegla"><div class="lpReglaPct">%</div><div class="lpReglaTxt"><strong>Precios a mano</strong>${plural(cuantos, "comercio", "comercios")}. Poné un % sobre el general para llenarlos todos.</div><button type="button" class="lpBtnChico" id="cambiarRegla">Poner %</button></div>`;
            }
            return `<div class="lpRegla"><div class="lpReglaPct">${textoPorcentaje(regla.porcentaje)}</div><div class="lpReglaTxt"><strong>Sobre el general</strong>${textoRedondeo(regla.redondeo).replace(/^./, letra => letra.toUpperCase())} · ${plural(cuantos, "comercio", "comercios")}. ${regla.sigue ? "Si subís el general, sube sola." : "No cambia sola."}</div><button type="button" class="lpBtnChico" id="cambiarRegla">Cambiar</button></div>`;
        }

        function botonFiltro(clave, texto, cantidad, clase = "") {
            return `<button type="button" class="filtroEtapa${filtro === clave ? " activo" : ""}${clase ? " " + clase : ""}" data-filtro-lista="${p.esc(clave)}" aria-pressed="${filtro === clave}"><span class="filtroEtapaNombre">${p.esc(texto)}</span><small class="filtroEtapaCantidad">${cantidad}</small></button>`;
        }

        let lupa = null;
        function dibujarFiltros() {
            const fila = seccion.querySelector("#filtrosTodaLista");
            if (!fila) return;
            const manualesHoy = productos.filter(esManual).length;
            if (filtro === "mano" && !manualesHoy) filtro = "todos";
            fila.querySelectorAll(".filtroEtapa").forEach(boton => boton.remove());
            fila.insertAdjacentHTML("beforeend", botonFiltro("todos", "Todos", productos.length) +
                (marcas.length > 1 ? marcas.map(marca => botonFiltro(marca, marca, productos.filter(producto => producto.marca === marca).length,
                    typeof tonoDeMarca === "function" ? "conTono " + tonoDeMarca(marca) : "")).join("") : "") +
                (manualesHoy ? botonFiltro("mano", "A mano", manualesHoy) : ""));
            if (lupa) lupa.poner(fila);
        }

        function redibujarFilas() {
            const caja = seccion.querySelector("#filasTodaLista");
            if (caja) caja.innerHTML = filas();
        }

        function dibujar() {
            seccion.querySelector("main").innerHTML = `<div id="reglaTodaLista">${tarjetaRegla()}</div>
                <div class="filtrosEtapaPedidos lpFiltros" id="filtrosTodaLista" role="group" aria-label="Filtrar productos"></div>
                <div id="filasTodaLista">${filas()}</div>
                <div class="pzBotonesFijos"><button type="button" class="pzBtn pzBtnPri" id="guardarTodaLista">Guardar la lista</button></div>`;
            if (window.piezas.lupa) {
                const input = document.createElement("input");
                input.type = "search";
                input.id = "buscarTodaLista";
                input.placeholder = "Buscar producto";
                input.value = busqueda;
                input.addEventListener("input", () => { busqueda = input.value; redibujarFilas(); });
                lupa = p.lupa(input, { etiqueta: "Buscar producto" });
            }
            dibujarFiltros();
        }

        function abrirRegla() {
            let porcentaje = regla ? regla.porcentaje : 0;
            let paso = regla ? regla.redondeo : 10;
            let sigue = regla ? regla.sigue : true;
            const ejemplos = productos.filter(producto => Number(producto.precio) > 0).slice(0, 2);
            const caja = p.hoja({
                clase: "lpHoja",
                etiqueta: "Precios de " + nombre,
                html: cabezaHoja("etiqueta", "Precios de " + nombre, "Cuánto sobre el precio general") + `
                    <div class="lpEt">Porcentaje sobre el general</div>
                    <div class="lpCampoPct">
                        <button type="button" data-pct="-1" aria-label="Un punto menos">${p.ico("menos", 22)}</button>
                        <label class="lpPctValor"><input id="porcentajeLista" type="number" inputmode="decimal" step="1" value="${porcentaje}" aria-label="Porcentaje sobre el general"><span>%</span></label>
                        <button type="button" data-pct="1" aria-label="Un punto más">${p.ico("mas", 22)}</button>
                    </div>
                    <div class="lpEt">Redondeo</div>
                    <div class="lpSeg" role="group" aria-label="Redondeo">${REDONDEOS.map(([valor, texto]) => `<button type="button" data-redondeo="${valor}" aria-pressed="${paso === valor}">${texto}</button>`).join("")}</div>
                    <div class="lpEjemplo" id="ejemploRegla"></div>
                    <label class="lpCheck"><input type="checkbox" id="sigueGeneral" ${sigue ? "checked" : ""}><span>Seguir al general<small>Cuando subís un precio en el Catálogo, esta lista sube sola. Los precios «a mano» no se tocan.</small></span></label>`,
                botones: [{
                    texto: productos.length === 1 ? "Aplicar a 1 producto" : "Aplicar a los " + productos.length + " productos",
                    icono: "check",
                    alTocar: () => {
                        if (!Number.isFinite(porcentaje) || porcentaje <= -100) {
                            mostrarToast("Escribí un porcentaje, por ejemplo −10");
                            return false;
                        }
                        regla = { porcentaje, redondeo: paso, sigue };
                        reglaCambiada = true;
                        productos.forEach(producto => {
                            if (sigue && manuales.has(producto.id)) return;
                            manuales.delete(producto.id);
                            const valor = precioPorRegla(regla, producto.precio);
                            if (valor > 0) precios[producto.id] = valor; else delete precios[producto.id];
                        });
                        seccion.querySelector("#reglaTodaLista").innerHTML = tarjetaRegla();
                        dibujarFiltros();
                        redibujarFilas();
                        mostrarToast("Listo: revisalos y tocá «Guardar la lista»");
                        return true;
                    }
                }]
            });
            cerrarConX(caja);
            const campo = caja.querySelector("#porcentajeLista");
            const ejemplo = () => {
                caja.querySelector("#ejemploRegla").innerHTML = ejemplos.length
                    ? "Ejemplo: " + ejemplos.map(producto => `${p.esc(producto.nombre)} <b>${p.plata(producto.precio)} → ${p.plata(precioPorRegla({ porcentaje: Number.isFinite(porcentaje) ? porcentaje : 0, redondeo: paso }, producto.precio))}</b>`).join("<br>")
                    : "Los productos sin precio general quedan sin precio.";
            };
            caja.addEventListener("input", evento => {
                if (evento.target === campo) porcentaje = Number(String(campo.value).replace(",", "."));
                if (evento.target.id === "sigueGeneral") sigue = evento.target.checked;
                ejemplo();
            });
            caja.addEventListener("change", evento => {
                if (evento.target.id === "sigueGeneral") sigue = evento.target.checked;
            });
            caja.addEventListener("click", evento => {
                const boton = evento.target.closest("[data-pct]");
                if (boton) {
                    porcentaje = Math.round(((Number.isFinite(porcentaje) ? porcentaje : 0) + Number(boton.dataset.pct)) * 10) / 10;
                    campo.value = porcentaje;
                    ejemplo();
                    return;
                }
                const redondeo = evento.target.closest("[data-redondeo]");
                if (redondeo) {
                    paso = Number(redondeo.dataset.redondeo) || 1;
                    caja.querySelectorAll("[data-redondeo]").forEach(otro => otro.setAttribute("aria-pressed", String(otro === redondeo)));
                    ejemplo();
                }
            });
            ejemplo();
        }

        seccion.querySelector("main").oninput = evento => {
            const campo = evento.target.closest("[data-producto-lista]");
            if (!campo) return;
            const id = campo.dataset.productoLista;
            const producto = productos.find(item => item.id === id);
            const general = Number(producto && producto.precio) || 0;
            const valor = Math.round(Number(String(campo.value).replace(",", ".")) * 100) / 100;
            if (Number.isFinite(valor) && valor > 0) precios[id] = valor;
            else delete precios[id];
            if (regla?.sigue) {
                const antes = manuales.has(id);
                if (precios[id] && precios[id] !== precioPorRegla(regla, general)) manuales.add(id);
                else manuales.delete(id);
                campo.closest(".pzPrecioLista")?.classList.toggle("lpPrecioMano", manuales.has(id));
                if (antes !== manuales.has(id)) dibujarFiltros();
            }
            const etiqueta = seccion.querySelector(`[data-etiqueta-producto="${CSS.escape(id)}"]`);
            if (etiqueta && producto) etiqueta.innerHTML = etiquetaPrecio(precios[id], general, esManual(producto));
        };
        seccion.querySelector("main").onclick = evento => {
            const boton = evento.target.closest("[data-filtro-lista]");
            if (boton) {
                filtro = boton.dataset.filtroLista;
                dibujarFiltros();
                redibujarFilas();
                return;
            }
            if (evento.target.closest("#cambiarRegla")) {
                abrirRegla();
                return;
            }
            if (evento.target.closest("#guardarTodaLista")) {
                if (reglaCambiada) ponerRegla(nombre, regla);
                const todos = obtenerProductos();
                let cambio = false;
                Object.keys(todos).forEach(marca => (todos[marca] || []).forEach((producto, i) => {
                    if (!producto || !(producto.id in precios || (producto.precios && nombre in producto.precios) || aMano(producto, nombre) || manuales.has(producto.id))) return;
                    const actuales = { ...(producto.precios && typeof producto.precios === "object" ? producto.precios : {}) };
                    const manual = Boolean(regla?.sigue) && manuales.has(producto.id) && Number(precios[producto.id]) > 0;
                    // Los que siguen al general toman el de la regla (vacío = vuelve a la regla).
                    const ahora = regla?.sigue && !manual ? precioPorRegla(regla, producto.precio) : Number(precios[producto.id]) || 0;
                    if (ahora > 0) actuales[nombre] = ahora; else delete actuales[nombre];
                    const otros = (Array.isArray(producto.preciosAMano) ? producto.preciosAMano : []).filter(lista => lista !== nombre);
                    const preciosAMano = manual ? [...otros, nombre] : otros;
                    if (actuales[nombre] === (producto.precios || {})[nombre] && aMano(producto, nombre) === manual) return;
                    const nuevo = { ...producto, precios: actuales };
                    if (preciosAMano.length) nuevo.preciosAMano = preciosAMano; else delete nuevo.preciosAMano;
                    todos[marca][i] = nuevo;
                    cambio = true;
                }));
                if (cambio && !guardarProductos(todos)) {
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

    // ---------- Más > Listas de precios (T161) ----------
    // Una tarjeta por lista: su regla, sus comercios y sus productos. Toda
    // tarjeta abre la lista; el ⋯ abre el menú con lo demás.
    function puedeEditar() {
        const enNube = typeof usaNubeReal === "function" && usaNubeReal();
        return !enNube || p.esDueno() || Boolean(window.empleadosVendeFrio?.puede?.("editaCatalogo"));
    }

    function productosEn(nombre) {
        return todosLosProductos().filter(producto => producto.archivado !== true &&
            producto.precios && Number(producto.precios[nombre]) > 0).length;
    }

    function nombreLimpio(texto) {
        return String(texto || "").trim().replace(/\s+/g, " ").slice(0, 30);
    }

    function yaExiste(nombre, salvo = "") {
        const buscado = nombre.toLocaleLowerCase("es");
        return listas().some(otra => otra !== salvo && otra.toLocaleLowerCase("es") === buscado);
    }

    function pedirNombre({ titulo, boton, actual = "", alGuardar }) {
        p.hoja({
            titulo,
            sub: actual ? "Los comercios y los precios de la lista quedan igual" : "Por ejemplo, Supermercados, Almacenes o Kioscos",
            html: `<label class="pzCampo"><span>Nombre</span><input id="nombreListaPrecios" maxlength="30" value="${p.esc(actual)}" placeholder="Ej.: Almacenes"></label>`,
            botones: [{
                texto: boton,
                icono: "check",
                alTocar: caja => {
                    const nombre = nombreLimpio(caja.querySelector("#nombreListaPrecios").value);
                    if (!nombre) {
                        mostrarToast("Escribí el nombre de la lista");
                        return false;
                    }
                    if (nombre === actual) return true;
                    if (yaExiste(nombre, actual)) {
                        mostrarToast("Ya hay una lista «" + nombre + "»");
                        return false;
                    }
                    return alGuardar(nombre) !== false;
                }
            }]
        });
        setTimeout(() => document.getElementById("nombreListaPrecios")?.select(), 200);
    }

    // Cambia el nombre de la lista en los precios de cada producto, en los
    // comercios que la usan y en su regla. Todo de una vez, con un solo
    // guardado. Con nuevo vacío, la borra.
    function cambiarLista(viejo, nuevo) {
        const regla = reglaDe(viejo);
        if (regla) {
            const todas = { ...reglas() };
            delete todas[viejo];
            if (nuevo) todas[nuevo] = regla;
            guardarReglas(todas);
        }
        const productos = obtenerProductos();
        let tocados = 0;
        Object.keys(productos).forEach(marca => (productos[marca] || []).forEach(producto => {
            if (!producto) return;
            const tienePrecio = producto.precios && typeof producto.precios === "object" && viejo in producto.precios;
            if (!tienePrecio && !aMano(producto, viejo)) return;
            if (tienePrecio) {
                const precios = { ...producto.precios };
                if (nuevo && Number(precios[viejo]) > 0) precios[nuevo] = precios[viejo];
                delete precios[viejo];
                producto.precios = precios;
            }
            if (aMano(producto, viejo)) {
                const manuales = producto.preciosAMano.filter(nombre => nombre !== viejo);
                if (nuevo) manuales.push(nuevo);
                if (manuales.length) producto.preciosAMano = manuales; else delete producto.preciosAMano;
            }
            tocados += 1;
        }));
        if (tocados && !guardarProductos(productos)) return false;
        const comercios = obtenerComercios();
        const usan = comercios.filter(comercio => comercio.listaPrecios === viejo);
        if (usan.length) {
            usan.forEach(comercio => { comercio.listaPrecios = nuevo || ""; });
            if (!guardarComercios(comercios)) return false;
        }
        nuevas.cambiar(viejo, nuevo);
        return true;
    }

    function crearLista(nombre) {
        nuevas.add(nombre);
        abrirLista(nombre, abrirPantalla);
        mostrarToast("Lista «" + nombre + "» creada: poné el % o cargá los precios");
    }

    // Tanda 2: el Asistente crea una lista con un % sobre el general (o
    // vacía, para cargarla a mano). Devuelve si la pudo crear.
    function crearConRegla(nombre, porcentaje = 0) {
        const limpio = String(nombre || "").trim().slice(0, 40);
        if (!limpio || !puedeEditar() || listas().includes(limpio)) return false;
        nuevas.add(limpio);
        const pct = Number(porcentaje);
        if (Number.isFinite(pct) && pct !== 0 && pct > -100) {
            ponerRegla(limpio, { porcentaje: pct, redondeo: 10, sigue: true });
            const productos = JSON.parse(JSON.stringify(obtenerProductos() || {}));
            aplicarReglas(productos);
            guardarProductos(productos);
        }
        return true;
    }

    // ---------- Comercios que usan una lista ----------
    // Elegir varios al estilo Pedidos: filtros, «N elegidos», Marcar todos,
    // el círculo pasa a ser un tilde, y abajo «Guardar · N comercios».
    function iniciales(nombre) {
        return String(nombre || "?").trim().split(/\s+/).slice(0, 2).map(parte => parte[0] || "").join("").toUpperCase() || "?";
    }

    function elegirComercios(nombre, filtroInicial = "todos") {
        const comercios = comerciosActivos().slice().sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
        const elegidos = new Set(comercios.filter(comercio => comercio.listaPrecios === nombre).map(comercio => comercio.nombre));
        let filtro = filtroInicial;
        let busqueda = "";
        const grupo = comercio => comercio.listaPrecios === nombre ? "esta" : comercio.listaPrecios ? "otra" : "sin";

        const caja = p.hoja({
            clase: "lpHoja lpHojaComercios",
            etiqueta: "Comercios con " + nombre,
            html: cabezaHoja("tienda", "Comercios con " + nombre, "Los marcados pagan con esta lista") +
                `<div class="filtrosEtapaPedidos lpFiltros" id="filtrosComerciosLista" role="group" aria-label="Filtrar comercios"></div>
                <div class="lpSel"><b id="elegidosLista"></b><button type="button" class="lpPill" id="marcarTodosLista"></button></div>
                <div id="comerciosLista" class="lpComs"></div>`,
            botones: [{
                texto: "Guardar",
                icono: "check",
                alTocar: () => {
                    const todos = obtenerComercios();
                    let cambio = false;
                    todos.forEach(comercio => {
                        if (comercio.archivado === true) return;
                        const quiere = elegidos.has(comercio.nombre);
                        if (quiere && comercio.listaPrecios !== nombre) { comercio.listaPrecios = nombre; cambio = true; }
                        if (!quiere && comercio.listaPrecios === nombre) { comercio.listaPrecios = ""; cambio = true; }
                    });
                    if (cambio && !guardarComercios(todos)) {
                        mostrarAviso("No se guardó", "Revisá el almacenamiento y probá de nuevo.");
                        return false;
                    }
                    nuevas.add(nombre);
                    mostrarToast(plural(elegidos.size, "comercio usa", "comercios usan") + " «" + nombre + "»");
                    dibujarPantalla();
                    return true;
                }
            }]
        });
        cerrarConX(caja);
        const botonGuardar = caja.querySelector(".pzBtnPri");

        const visibles = () => {
            const texto = busqueda.trim().toLocaleLowerCase("es");
            return comercios.filter(comercio => (filtro === "todos" || grupo(comercio) === filtro) &&
                (!texto || String(comercio.nombre).toLocaleLowerCase("es").includes(texto)));
        };

        const input = document.createElement("input");
        input.type = "search";
        input.placeholder = "Buscar comercio";
        input.addEventListener("input", () => { busqueda = input.value; dibujarLista(); });
        const lupa = p.lupa ? p.lupa(input, { etiqueta: "Buscar comercio" }) : null;

        function dibujarFiltros() {
            const fila = caja.querySelector("#filtrosComerciosLista");
            const cuenta = clave => clave === "todos" ? comercios.length : comercios.filter(comercio => grupo(comercio) === clave).length;
            fila.querySelectorAll(".filtroEtapa").forEach(boton => boton.remove());
            fila.insertAdjacentHTML("beforeend", [["todos", "Todos"], ["esta", "Con esta"], ["otra", "Otra lista"], ["sin", "Sin lista"]]
                .filter(([clave]) => clave === "todos" || cuenta(clave) > 0 || filtro === clave)
                .map(([clave, texto]) => `<button type="button" class="filtroEtapa${filtro === clave ? " activo" : ""}" data-filtro-comercios="${clave}" aria-pressed="${filtro === clave}"><span class="filtroEtapaNombre">${texto}</span><small class="filtroEtapaCantidad">${cuenta(clave)}</small></button>`).join(""));
            if (lupa) lupa.poner(fila);
        }

        function dibujarLista() {
            const lista = visibles();
            caja.querySelector("#comerciosLista").innerHTML = lista.map(comercio => {
                const si = elegidos.has(comercio.nombre);
                const sub = si ? "Usa " + nombre : comercio.listaPrecios ? "Ahora usa " + comercio.listaPrecios : "Precio general";
                return `<button type="button" class="lpCom" role="checkbox" aria-checked="${si}" data-comercio-lista="${p.esc(comercio.nombre)}">
                    <span class="lpComIni${si ? " si" : ""}">${si ? p.ico("check", 22) : p.esc(iniciales(comercio.nombre))}</span>
                    <span class="lpComTxt"><strong>${p.esc(comercio.nombre)}</strong><small class="${!si && comercio.listaPrecios && comercio.listaPrecios !== nombre ? "otra" : ""}">${p.esc(sub)}</small></span>
                </button>`;
            }).join("") || `<div class="pzVacio">${comercios.length ? "No hay comercios acá." : "Todavía no cargaste comercios."}</div>`;
            const todosVisiblesElegidos = lista.length > 0 && lista.every(comercio => elegidos.has(comercio.nombre));
            caja.querySelector("#elegidosLista").textContent = plural(elegidos.size, "elegido", "elegidos");
            const marcar = caja.querySelector("#marcarTodosLista");
            marcar.textContent = todosVisiblesElegidos ? "Desmarcar todos" : "Marcar todos";
            marcar.hidden = !lista.length;
            if (botonGuardar) botonGuardar.lastChild.textContent = "Guardar · " + plural(elegidos.size, "comercio", "comercios");
        }

        caja.addEventListener("click", evento => {
            const filtroBoton = evento.target.closest("[data-filtro-comercios]");
            if (filtroBoton) {
                filtro = filtroBoton.dataset.filtroComercios;
                dibujarFiltros();
                dibujarLista();
                return;
            }
            const fila = evento.target.closest("[data-comercio-lista]");
            if (fila) {
                const comercio = fila.dataset.comercioLista;
                if (elegidos.has(comercio)) elegidos.delete(comercio); else elegidos.add(comercio);
                dibujarLista();
                return;
            }
            if (evento.target.closest("#marcarTodosLista")) {
                const lista = visibles();
                const todos = lista.every(comercio => elegidos.has(comercio.nombre));
                lista.forEach(comercio => { if (todos) elegidos.delete(comercio.nombre); else elegidos.add(comercio.nombre); });
                dibujarLista();
            }
        });
        dibujarFiltros();
        dibujarLista();
    }

    function opcionesDe(nombre, boton) {
        const editar = puedeEditar();
        const cuantos = comerciosEn(nombre);
        p.menu(boton, {
            clase: "lpMenu",
            titulo: nombre,
            sub: plural(productosEn(nombre), "producto", "productos") + " · " + plural(cuantos, "comercio", "comercios"),
            items: [
                editar ? { icono: "etiqueta", color: "var(--acento)", texto: "Ver y cambiar precios", principal: true, alTocar: () => abrirLista(nombre, abrirPantalla) } : null,
                editar ? { icono: "tienda", color: "var(--info)", texto: "Comercios que la usan", cantidad: cuantos, alTocar: () => elegirComercios(nombre) } : null,
                { icono: "planilla", color: "var(--visitado)", texto: "Exportar a planilla", alTocar: () => exportarPlanilla(nombre) },
                { icono: "impresora", color: "var(--pendiente)", texto: "Folleto para imprimir", alTocar: () => abrirFolleto(nombre) },
                editar ? { icono: "lapiz", color: "var(--texto-sec)", texto: "Cambiar el nombre", alTocar: () => renombrar(nombre) } : null,
                editar ? "-" : null,
                editar ? { icono: "tacho", texto: "Borrar la lista", peligro: true, alTocar: () => borrar(nombre) } : null
            ]
        });
    }

    function renombrar(nombre) {
        pedirNombre({
            titulo: "Cambiar el nombre",
            boton: "Guardar nombre",
            actual: nombre,
            alGuardar: nuevo => {
                if (!cambiarLista(nombre, nuevo)) {
                    mostrarAviso("No se guardó", "Revisá el almacenamiento y probá de nuevo.");
                    return false;
                }
                mostrarToast("Ahora se llama «" + nuevo + "»");
                dibujarPantalla();
                return true;
            }
        });
    }

    async function borrar(nombre) {
        const cuantos = comerciosEn(nombre);
        const si = await p.preguntar({
            icono: "tacho",
            color: "peligro",
            titulo: "¿Borrar la lista «" + nombre + "»?",
            texto: (cuantos ? (cuantos === 1 ? "El comercio que la usa vuelve" : "Los " + cuantos + " comercios que la usan vuelven") + " a los precios generales. " : "") +
                "Los pedidos ya cargados no cambian.",
            si: "Borrar",
            claseSi: "pzBtnPeligro"
        });
        if (!si) return;
        if (!cambiarLista(nombre, "")) {
            mostrarAviso("No se borró", "Revisá el almacenamiento y probá de nuevo.");
            return;
        }
        mostrarToast("Lista «" + nombre + "» borrada");
        dibujarPantalla();
    }

    // ---------- Exportar una lista (T162) ----------
    // Los productos de la lista por marca, en el orden del catálogo. El precio
    // es el de la lista o, si no tiene, el general (lo que paga el comercio).
    function marcasDeLista(nombre) {
        const productos = typeof productosParaLeer === "function" ? productosParaLeer() : {};
        return Object.keys(productos).map(marca => ({
            marca,
            productos: (productos[marca] || []).filter(producto => producto && producto.archivado !== true).map(producto => {
                const general = Number(producto.precio) || 0;
                const deLista = Number(producto.precios && producto.precios[nombre]) || 0;
                return { nombre: String(producto.nombre || ""), general, precio: deLista > 0 ? deLista : general };
            })
        })).filter(grupo => grupo.productos.length);
    }

    function nombreDistribuidora() {
        return String(window.distribuidoraVendeFrio?.nombreActual?.() || "").trim() || "VendeFrío";
    }

    function hoyTexto() {
        return new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    }

    function exportarPlanilla(nombre) {
        const exportar = window.exportarVendeFrio;
        if (!exportar || typeof exportar.descargarFilas !== "function") return;
        const lineas = [["Marca", "Producto", "Precio " + nombre, "Precio general"]];
        let cuantos = 0;
        marcasDeLista(nombre).forEach(grupo => grupo.productos.forEach(producto => {
            lineas.push([grupo.marca, producto.nombre, producto.precio || "", producto.general || ""]);
            cuantos += 1;
        }));
        const fecha = new Date().toISOString().slice(0, 10);
        exportar.descargarFilas(lineas, "Lista " + nombre + " " + fecha);
        mostrarToast(cuantos === 1 ? "Planilla con 1 producto descargada" : "Planilla con " + cuantos + " productos descargada");
    }

    // La hoja del folleto: siempre en blanco y negro con un toque de color,
    // igual en modo claro y oscuro, para que salga bien impresa.
    function htmlFolleto(nombre) {
        const datos = window.distribuidoraVendeFrio?.datosTicket?.() || {};
        const contacto = [datos.direccion, datos.telefono ? "Tel.: " + datos.telefono : "", datos.cuit ? "CUIT: " + datos.cuit : ""]
            .filter(Boolean).map(p.esc).join(" · ");
        const marcas = marcasDeLista(nombre).map(grupo => `<div class="folletoMarca">
                <h2>${p.esc(grupo.marca)}</h2>
                <ul>${grupo.productos.map(producto => `<li><span>${p.esc(producto.nombre)}</span><i></i><b>${producto.precio ? p.plata(producto.precio) : "Consultar"}</b></li>`).join("")}</ul>
            </div>`).join("");
        return `<article class="folletoHoja" aria-label="Folleto de ${p.esc(nombre)}">
            <div class="folletoCab">
                <h1>${p.esc(nombreDistribuidora())}</h1>
                ${contacto ? `<p>${contacto}</p>` : ""}
            </div>
            <div class="folletoTitulo"><strong>Lista de precios · ${p.esc(nombre)}</strong><span>Precios al ${hoyTexto()}</span></div>
            <div class="folletoMarcas">${marcas || `<p class="folletoVacio">Todavía no hay productos en el catálogo.</p>`}</div>
            <div class="folletoPie">Precios sujetos a cambio sin previo aviso.</div>
        </article>`;
    }

    // Imprime solo el folleto: una copia directa en <body> y, al imprimir, se
    // esconde todo lo demás (ver tema.css, «Folleto»). Desde la ventana de
    // imprimir también se guarda como PDF para mandarlo.
    function imprimirFolleto(nombre) {
        let copia = document.getElementById("folletoImprimir");
        if (!copia) {
            copia = document.createElement("div");
            copia.id = "folletoImprimir";
            document.body.appendChild(copia);
        }
        copia.innerHTML = htmlFolleto(nombre);
        document.body.classList.add("imprimiendoFolleto");
        window.addEventListener("afterprint", () => document.body.classList.remove("imprimiendoFolleto"), { once: true });
        try {
            window.print();
        } catch (error) {
            mostrarAviso("No se pudo imprimir", "Este celular no deja imprimir desde la app. Probá desde Chrome.");
        }
    }

    function abrirFolleto(nombre) {
        const seccion = p.pantalla("pantallaFolleto", {
            titulo: "Folleto · " + nombre,
            volverA: () => abrirPantalla()
        });
        p.mostrar(seccion);
        seccion.querySelector("main").innerHTML = `<div class="pzNota">Así se ve la hoja. Para mandarla por WhatsApp, en la ventana de imprimir elegí «Guardar como PDF».</div>
            <div class="folletoVista">${htmlFolleto(nombre)}</div>
            <div class="pzBotonesFijos"><button type="button" class="pzBtn pzBtnPri" id="imprimirFolleto">${p.ico("impresora", 18)}Imprimir o guardar en PDF</button></div>`;
        seccion.querySelector("#imprimirFolleto").onclick = () => imprimirFolleto(nombre);
    }

    let seccionMas = null;

    function dibujarPantalla() {
        if (!seccionMas) return;
        const nombres = listas();
        const editar = puedeEditar();
        const todas = reglas();
        const tarjetas = nombres.map((nombre, i) => {
            const productos = productosEn(nombre);
            const comercios = comerciosEn(nombre);
            const regla = todas[nombre];
            const texto = regla
                ? `<b>${textoPorcentaje(regla.porcentaje)}</b> sobre el general · ${textoRedondeo(regla.redondeo)}${regla.sigue ? "" : " · no sube sola"}`
                : "Precios a mano";
            const chipComercios = comercios || !editar
                ? `<button type="button" class="lpChip" data-comercios-lista="${p.esc(nombre)}" aria-label="Comercios con ${p.esc(nombre)}">${p.ico("tienda", 15)} ${plural(comercios, "comercio", "comercios")}</button>`
                : `<button type="button" class="lpChip lpChipAgregar" data-comercios-lista="${p.esc(nombre)}">${p.ico("mas", 15)} Elegir comercios</button>`;
            return `<div class="lpCard filaListaMas">
                <div class="pzIni ${COLORES[i % COLORES.length]}">${p.ico(/zona/i.test(nombre) ? "ubicacion" : "etiqueta", 22)}</div>
                <button type="button" class="lpCardTxt" data-abrir-lista="${p.esc(nombre)}" aria-label="Precios de ${p.esc(nombre)}"><strong>${p.esc(nombre)}</strong><small>${texto}</small></button>
                <button type="button" class="lpMas" data-opciones-lista="${p.esc(nombre)}" aria-label="Opciones de ${p.esc(nombre)}">${p.ico("puntos", 20)}</button>
                <div class="lpChips">${chipComercios}<span class="lpChip lpChipQuieto">${p.ico("paquete", 15)} ${plural(productos, "producto", "productos")}</span></div>
            </div>`;
        }).join("");
        const sinLista = comerciosActivos().filter(comercio => !comercio.listaPrecios).length;
        const general = nombres.length ? `<div class="lpTit">Sin lista</div>
            <div class="lpCard lpCardGeneral">
                <div class="pzIni lpIniGris">${p.ico("etiqueta", 22)}</div>
                <div class="lpCardTxt"><strong>Precio general</strong><small>El del Catálogo</small></div>
                <span></span>
                ${sinLista ? `<div class="lpChips"><span class="lpChip lpChipAviso">${p.ico("tienda", 15)} ${plural(sinLista, "comercio sin lista", "comercios sin lista")}</span>${editar ? `<button type="button" class="lpChip lpChipAgregar" id="elegirListaSinLista">${p.ico("mas", 15)} Elegir su lista</button>` : ""}</div>` : ""}
            </div>` : "";
        seccionMas.querySelector("main").innerHTML = `
            <div id="filasListasPrecios">${tarjetas || `<div class="pzTarjeta"><div class="pzVacio">Todavía no hay listas. Tocá «Lista nueva» (por ejemplo, Kioscos o Supermercados).</div></div>`}</div>
            ${general}
            ${editar ? `<div class="pzBotonesFijos"><button type="button" class="pzBtn pzBtnPri" id="crearListaPrecios">${p.ico("mas", 18)}Lista nueva</button></div>` : ""}`;
    }

    function abrirPantalla() {
        seccionMas = p.pantalla("pantallaListasPrecios", {
            titulo: "Listas de precios",
            icono: "etiqueta",
            volverA: "mas"
        });
        p.mostrar(seccionMas);
        const main = seccionMas.querySelector("main");
        main.onclick = evento => {
            const abrirla = evento.target.closest("[data-abrir-lista]");
            if (abrirla) {
                if (puedeEditar()) abrirLista(abrirla.dataset.abrirLista, abrirPantalla);
                else mostrarToast("Los precios los cambia quien edita el catálogo");
                return;
            }
            const opciones = evento.target.closest("[data-opciones-lista]");
            if (opciones) {
                opcionesDe(opciones.dataset.opcionesLista, opciones);
                return;
            }
            const comercios = evento.target.closest("[data-comercios-lista]");
            if (comercios) {
                if (puedeEditar()) elegirComercios(comercios.dataset.comerciosLista);
                else mostrarToast("La lista de cada comercio la cambia quien edita el catálogo");
                return;
            }
            const sinLista = evento.target.closest("#elegirListaSinLista");
            if (sinLista) {
                p.menu(sinLista, {
                    titulo: "¿Qué lista les ponés?",
                    items: listas().map(nombre => ({ icono: "etiqueta", color: "var(--info)", texto: nombre, cantidad: comerciosEn(nombre), alTocar: () => elegirComercios(nombre, "sin") }))
                });
                return;
            }
            if (evento.target.closest("#crearListaPrecios")) nueva();
        };
        dibujarPantalla();
    }

    (window.accesosMasExtras = window.accesosMasExtras || []).push({
        destino: "listasPrecios", icono: "etiqueta", texto: "Listas de precios",
        mostrar: () => !window.verPlataVendeFrio || window.verPlataVendeFrio.puedoVer(),
        abrir: abrirPantalla
    });

    function volverAlCatalogo() {
        if (typeof mostrarPantalla === "function") mostrarPantalla("catalogo");
        if (typeof window.renderizarCatalogo === "function") window.renderizarCatalogo();
    }

    window.listasDePrecios = listas;
    // Desde «Lista nueva» y desde el menú "Crear" del +: pide el nombre y abre la lista nueva.
    function nueva() {
        pedirNombre({ titulo: "Lista nueva", boton: "Crear lista", alGuardar: nombre => { setTimeout(() => crearLista(nombre), 220); } });
    }

    window.listasPreciosVendeFrio = {
        listas, comerciosEn, abrir, abrirLista, abrirPantalla, cambiarLista, exportarPlanilla, abrirFolleto, nueva,
        puedeCrear: puedeEditar, reglas, aplicarReglas, elegirComercios, crearConRegla
    };
}());
