// VendeFrío - Nuevo pedido más simple (Etapa 8).
// - T95: un botón flotante ⋯ abajo a la derecha junta lo que antes eran
//   botones sueltos (repetir, dictar, escanear) y otras cosas útiles al
//   cargar: vaciar, anotar un cambio, ver el saldo, duplicar para otro
//   comercio y elegir la fecha de entrega.
// - T96: cambios de mercadería (producto, cantidad y motivo con botones),
//   aparte de las observaciones. Se ven al preparar y al entregar.
// - T98: el precio de un producto se cambia solo para este pedido, tocando
//   el precio (lapicito). Queda marcado en el pedido y en el ticket.
// - T94: manteniendo apretado un producto se marca como favorito (va
//   primero en su marca, con estrellita).
// Los cambios y la fecha viajan en `detallesPedido/` (uno por pedido, con el
// mismo id), así el pedido no cambia de forma. Mientras se carga, todo esto
// queda en el borrador de este celular.
(function () {
    "use strict";

    const pantalla = document.getElementById("pantallaPedido");
    const contenedorProductos = document.getElementById("productos");
    const input = document.getElementById("cliente");
    if (!pantalla || !contenedorProductos || !input) return;

    const p = window.piezas;
    const extras = window.extrasVendeFrio;
    const DB_BORRADOR = "vendefrio_borrador_pedido_extra";
    const MOTIVOS = [
        { clave: "vencido", texto: "Vencido" },
        { clave: "roto", texto: "Roto" },
        { clave: "noSeVendio", texto: "No se vendió" }
    ];
    const textoMotivo = clave => (MOTIVOS.find(motivo => motivo.clave === clave) || MOTIVOS[0]).texto;
    const normal = texto => String(texto || "").trim().toLocaleLowerCase("es");
    const clave = (marca, producto) => normal(marca) + "|" + normal(producto);

    extras.registrar("detallesPedido", {
        dias: 120,
        describir: detalle => ({
            titulo: "Cambios y fecha del pedido",
            nombre: detalle.comercio || "",
            detalle: [detalle.fechaEntrega ? "Entrega " + textoFecha(detalle.fechaEntrega) : "",
                (detalle.cambios || []).length ? (detalle.cambios.length === 1 ? "1 cambio" : detalle.cambios.length + " cambios") : ""]
                .filter(Boolean).join(" · ")
        })
    });

    // ---------- Borrador (cambios, fecha y precios de este pedido) ----------
    function leer() {
        const datos = p.lsLeer(DB_BORRADOR, {});
        return {
            cambios: Array.isArray(datos && datos.cambios) ? datos.cambios : [],
            fechaEntrega: String(datos && datos.fechaEntrega || ""),
            precios: datos && datos.precios && typeof datos.precios === "object" ? datos.precios : {}
        };
    }

    function guardar(datos) {
        if (!datos.cambios.length && !datos.fechaEntrega && !Object.keys(datos.precios).length) {
            localStorage.removeItem(DB_BORRADOR);
        } else {
            p.lsGuardar(DB_BORRADOR, datos);
        }
        dibujarExtras();
        if (typeof actualizarResumenPedido === "function") actualizarResumenPedido();
    }

    function vaciarBorrador() {
        localStorage.removeItem(DB_BORRADOR);
        dibujarExtras();
    }

    // ---------- Fechas ----------
    function hoyMas(dias) {
        const d = new Date();
        d.setDate(d.getDate() + dias);
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }

    function textoFecha(valor) {
        const [anio, mes, dia] = String(valor || "").split("-").map(Number);
        if (!anio || !mes || !dia) return "";
        if (valor === hoyMas(0)) return "hoy";
        if (valor === hoyMas(1)) return "mañana";
        const fecha = new Date(anio, mes - 1, dia);
        return fecha.toLocaleDateString("es-AR", { weekday: "long" }) + " " + dia + "/" + mes;
    }

    // ---------- Precio solo para este pedido (T98) ----------
    function puedeCambiarPrecio() {
        return !window.verPlataVendeFrio || window.verPlataVendeFrio.puedoVer();
    }

    function precioCambiado(marca, producto) {
        const precio = leer().precios[clave(marca, producto)];
        return precio === undefined || precio === null || !Number.isFinite(Number(precio)) ? null : Number(precio);
    }

    function productoDelCatalogo(marca, nombre) {
        const catalogo = typeof obtenerProductos === "function" ? obtenerProductos() : {};
        const marcaReal = Object.keys(catalogo).find(item => normal(item) === normal(marca));
        const producto = marcaReal ? (catalogo[marcaReal] || []).find(item => item && normal(item.nombre) === normal(nombre)) : null;
        return producto ? { marca: marcaReal, producto } : null;
    }

    function precioDeLista(marca, nombre) {
        const real = productoDelCatalogo(marca, nombre);
        if (!real || typeof precioVigente !== "function") return null;
        const precio = precioVigente(real.producto, typeof comercioDelPedidoActual === "function" ? comercioDelPedidoActual() : null);
        return precio === null || precio === undefined || !Number.isFinite(Number(precio)) ? null : Number(precio);
    }

    function editarPrecio(marca, nombre) {
        if (!puedeCambiarPrecio()) return;
        const lista = precioDeLista(marca, nombre);
        const actual = precioCambiado(marca, nombre);
        p.hoja({
            titulo: "Precio para este pedido",
            sub: nombre + (lista !== null ? " · de lista " + p.plata(lista) : ""),
            html: `<label class="pzCampo">Precio por unidad<input type="number" inputmode="decimal" min="0" step="any" id="precioEstePedido" value="${actual !== null ? actual : (lista !== null ? lista : "")}"></label>
                <p class="pzHojaSub">Cambia solo en este pedido. El catálogo queda igual.</p>`,
            botones: [
                actual !== null ? { texto: "Volver al de lista", clase: "pzBtnSec", par: true, alTocar: () => ponerPrecio(marca, nombre, null) } : null,
                {
                    texto: "Guardar precio",
                    par: actual !== null,
                    alTocar: caja => {
                        const valor = Number(String(caja.querySelector("#precioEstePedido").value).replace(",", "."));
                        if (!Number.isFinite(valor) || valor < 0) {
                            mostrarToast("Escribí un precio");
                            return false;
                        }
                        ponerPrecio(marca, nombre, lista !== null && valor === lista ? null : Math.round(valor * 100) / 100);
                        return true;
                    }
                }
            ].filter(Boolean)
        });
        setTimeout(() => document.getElementById("precioEstePedido")?.select(), 50);
    }

    function ponerPrecio(marca, nombre, precio) {
        const datos = leer();
        const k = clave(marca, nombre);
        if (precio === null) delete datos.precios[k];
        else datos.precios[k] = precio;
        guardar(datos);
        mostrarToast(precio === null ? "Vuelve al precio de lista" : "Precio cambiado solo para este pedido");
    }

    // Al guardar el pedido: el precio cambiado va en la línea, marcado.
    // Cambia las mismas líneas, así el mensaje del pedido también lo muestra.
    function ajustarProductos(productos) {
        const precios = leer().precios;
        productos.forEach(item => {
            const precio = precios[clave(item.marca, item.producto)];
            if (precio === undefined || precio === null || !Number.isFinite(Number(precio))) return;
            const lista = precioDeLista(item.marca, item.producto);
            Object.assign(item, { precio: Number(precio), precioCambiado: true }, lista !== null ? { precioLista: lista } : {});
        });
        return productos;
    }

    // ---------- Cambios de mercadería (T96) ----------
    function opcionesProductos(elegido) {
        const catalogo = typeof productosParaVender === "function" ? productosParaVender() : obtenerProductos();
        return Object.keys(catalogo).sort((a, b) => a.localeCompare(b, "es")).map(marca => {
            const opciones = (catalogo[marca] || []).filter(Boolean).map(producto => {
                const valor = marca + "|" + producto.nombre;
                return `<option value="${p.esc(valor)}"${elegido === valor ? " selected" : ""}>${p.esc(producto.nombre)}</option>`;
            }).join("");
            return opciones ? `<optgroup label="${p.esc(marca)}">${opciones}</optgroup>` : "";
        }).join("");
    }

    function anotarCambio(marca, nombre) {
        let cantidad = 1;
        let motivo = "vencido";
        const fijo = marca && nombre;
        const caja = p.hoja({
            titulo: "Anotar un cambio",
            sub: fijo ? nombre : "Lo que el comercio te devuelve para cambiar",
            clase: "hojaCambio",
            html: `${fijo ? "" : `<label class="pzCampo">Producto<select id="productoCambio"><option value="">Elegí el producto</option>${opcionesProductos("")}</select></label>`}
                <p class="pzEtiquetaCampo">Cantidad</p>
                <div class="pzStepper pzStepperCambio"><button type="button" data-cantidad="-1" aria-label="Uno menos">${p.ico("menos", 18)}</button><b class="numeroCambio">1</b><button type="button" data-cantidad="1" aria-label="Uno más">${p.ico("mas", 18)}</button></div>
                <p class="pzEtiquetaCampo">Motivo</p>
                <div class="pzFiltros pzEnHoja" role="group" aria-label="Motivo">${MOTIVOS.map(item => `<button type="button" class="pzFiltro" data-motivo="${item.clave}" aria-pressed="${item.clave === motivo}">${item.texto}</button>`).join("")}</div>`,
            botones: [{
                texto: "Guardar cambio",
                icono: "check",
                id: "guardarCambio",
                alTocar: caja => {
                    const valor = fijo ? marca + "|" + nombre : caja.querySelector("#productoCambio").value;
                    if (!valor) {
                        mostrarToast("Elegí el producto");
                        return false;
                    }
                    const separador = valor.indexOf("|");
                    const datos = leer();
                    datos.cambios.push({ marca: valor.slice(0, separador), producto: valor.slice(separador + 1), cantidad, motivo });
                    guardar(datos);
                    mostrarToast("Cambio anotado");
                    return true;
                }
            }]
        });
        caja.addEventListener("click", evento => {
            const paso = evento.target.closest("[data-cantidad]");
            if (paso) {
                cantidad = Math.max(1, Math.min(99, cantidad + Number(paso.dataset.cantidad)));
                caja.querySelector(".numeroCambio").textContent = String(cantidad);
                return;
            }
            const boton = evento.target.closest("[data-motivo]");
            if (boton) {
                motivo = boton.dataset.motivo;
                caja.querySelectorAll("[data-motivo]").forEach(item => item.setAttribute("aria-pressed", String(item === boton)));
            }
        });
    }

    function quitarCambio(indice) {
        const datos = leer();
        datos.cambios.splice(indice, 1);
        guardar(datos);
    }

    // ---------- Fecha de entrega ----------
    function elegirFecha() {
        const actual = leer().fechaEntrega;
        const rapida = (dias, texto) => `<button type="button" class="pzFiltro" data-fecha="${hoyMas(dias)}" aria-pressed="${actual === hoyMas(dias)}">${texto}</button>`;
        const caja = p.hoja({
            titulo: "Fecha de entrega",
            sub: "Cuándo hay que llevar este pedido",
            html: `<div class="pzFiltros pzEnHoja" role="group" aria-label="Fechas rápidas">${rapida(0, "Hoy")}${rapida(1, "Mañana")}${rapida(2, "Pasado mañana")}</div>
                <label class="pzCampo">Otra fecha<input type="date" id="fechaEntregaElegida" min="${hoyMas(0)}" value="${p.esc(actual)}"></label>`,
            botones: [
                actual ? { texto: "Quitar fecha", clase: "pzBtnSec", par: true, alTocar: () => ponerFecha("") } : null,
                {
                    texto: "Guardar fecha",
                    par: Boolean(actual),
                    alTocar: caja => {
                        const valor = caja.querySelector("#fechaEntregaElegida").value;
                        if (!valor) {
                            mostrarToast("Elegí una fecha");
                            return false;
                        }
                        ponerFecha(valor);
                        return true;
                    }
                }
            ].filter(Boolean)
        });
        caja.addEventListener("click", evento => {
            const boton = evento.target.closest("[data-fecha]");
            if (!boton) return;
            caja.querySelector("#fechaEntregaElegida").value = boton.dataset.fecha;
            caja.querySelectorAll("[data-fecha]").forEach(item => item.setAttribute("aria-pressed", String(item === boton)));
        });
    }

    function ponerFecha(valor) {
        const datos = leer();
        datos.fechaEntrega = valor;
        guardar(datos);
    }

    // ---------- Lo que se ve en Nuevo pedido ----------
    const caja = document.createElement("div");
    caja.id = "extrasPedido";
    caja.className = "extrasPedido";
    const observaciones = pantalla.querySelector(".observacionesPedido");
    if (observaciones) observaciones.before(caja);
    else contenedorProductos.after(caja);

    function dibujarExtras() {
        const datos = leer();
        let html = "";
        if (datos.fechaEntrega) {
            html += `<div class="pzBanner pzBanPri" id="fechaEntregaPedido">
                ${p.ico("calendario", 22)}
                <div><strong>Entregar ${p.esc(textoFecha(datos.fechaEntrega))}</strong><small>Fecha de entrega</small></div>
                <button type="button" class="pzEnlace" data-extra="fecha">Cambiar</button>
            </div>`;
        }
        if (datos.cambios.length) {
            const filas = datos.cambios.map((cambio, indice) => `<div class="pzFila">
                    <div class="pzFilaTxt"><strong>${Number(cambio.cantidad) || 1} × ${p.esc(cambio.producto)}</strong><small>${p.esc(textoMotivo(cambio.motivo))}</small></div>
                    <button type="button" class="quitarCambio" data-quitar-cambio="${indice}" aria-label="Quitar el cambio de ${p.esc(cambio.producto)}">${p.ico("cerrarX", 18)}</button>
                </div>`).join("");
            html += `<section class="pzBloque" id="cambiosPedido">
                <div class="pzBloqueCab"><span class="pzEtiqueta">Cambios</span><button type="button" class="pzEnlace" data-extra="cambio">Anotar otro</button></div>
                <div class="pzTarjeta pzLista">${filas}</div>
            </section>`;
        }
        if (caja.innerHTML !== html) caja.innerHTML = html;
    }

    caja.addEventListener("click", evento => {
        const quitar = evento.target.closest("[data-quitar-cambio]");
        if (quitar) {
            quitarCambio(Number(quitar.dataset.quitarCambio));
            return;
        }
        const extra = evento.target.closest("[data-extra]")?.dataset.extra;
        if (extra === "fecha") elegirFecha();
        if (extra === "cambio") anotarCambio();
    });

    // Tocar el precio de un producto (T98).
    contenedorProductos.addEventListener("click", evento => {
        const boton = evento.target.closest("[data-editar-precio]");
        if (!boton) return;
        const select = boton.closest(".fila")?.querySelector("select");
        if (select) editarPrecio(select.dataset.marca, select.dataset.producto);
    });

    // ---------- Favoritos (T94) y mantener apretado un producto ----------
    function favoritosDelComercio() {
        const comercio = typeof comercioDelPedidoActual === "function" ? comercioDelPedidoActual() : null;
        return comercio && Array.isArray(comercio.favoritos) ? comercio.favoritos.map(normal) : [];
    }

    function cambiarFavorito(marca, nombre) {
        const comercio = comercioDelPedidoActual();
        if (!comercio) return;
        const actuales = Array.isArray(comercio.favoritos) ? comercio.favoritos.slice() : [];
        const indice = actuales.findIndex(item => normal(item) === clave(marca, nombre));
        if (indice >= 0) actuales.splice(indice, 1);
        else actuales.push(marca + "|" + nombre);
        actualizarComercioPorId(comercio.id, { favoritos: actuales });
        mostrarToast(indice >= 0 ? "Ya no es favorito" : "Marcado como favorito");
        marcarFavoritos();
    }

    // Los favoritos del comercio van primero en su marca, con estrellita.
    function marcarFavoritos() {
        const favoritos = favoritosDelComercio();
        contenedorProductos.querySelectorAll(".marca").forEach(marca => {
            const lista = marca.querySelector(".listaProdutos");
            if (!lista) return;
            const filas = Array.from(lista.querySelectorAll(".fila"));
            filas.forEach((fila, orden) => {
                if (!fila.dataset.orden) fila.dataset.orden = String(orden);
                const select = fila.querySelector("select");
                const favorito = Boolean(select) && favoritos.includes(clave(select.dataset.marca, select.dataset.producto));
                fila.classList.toggle("favorita", favorito);
                const texto = fila.querySelector(".nombreProductoPedido");
                // El nombre va en su propio renglón, con la estrellita adelante.
                let nombre = texto && texto.querySelector(".nombreTexto");
                if (texto && !nombre && texto.firstChild && texto.firstChild.nodeType === Node.TEXT_NODE) {
                    nombre = document.createElement("span");
                    nombre.className = "nombreTexto";
                    texto.insertBefore(nombre, texto.firstChild);
                    nombre.appendChild(texto.firstChild.nextSibling);
                }
                let estrella = nombre && nombre.querySelector(".estrellaFavorito");
                if (favorito && nombre && !estrella) {
                    estrella = document.createElement("i");
                    estrella.className = "estrellaFavorito";
                    estrella.setAttribute("aria-label", "Favorito");
                    estrella.innerHTML = p.ico("estrella", 14);
                    nombre.prepend(estrella);
                } else if (!favorito && estrella) {
                    estrella.remove();
                }
            });
            const ordenadas = filas.slice().sort((a, b) =>
                Number(b.classList.contains("favorita")) - Number(a.classList.contains("favorita")) ||
                Number(a.dataset.orden) - Number(b.dataset.orden));
            if (ordenadas.some((fila, i) => fila !== filas[i])) ordenadas.forEach(fila => lista.appendChild(fila));
        });
    }

    function opcionesProducto(marca, nombre) {
        const favorito = favoritosDelComercio().includes(clave(marca, nombre));
        const hayComercio = Boolean(comercioDelPedidoActual());
        const caja = p.hoja({
            titulo: nombre,
            sub: marca,
            html: `<div class="pzOpciones">
                <button type="button" class="pzOpcion" data-opcion="cambio">${p.ico("deshacer", 22)}Anotar un cambio</button>
                ${puedeCambiarPrecio() ? `<button type="button" class="pzOpcion" data-opcion="precio">${p.ico("lapiz", 22)}Cambiar el precio en este pedido</button>` : ""}
                ${hayComercio ? `<button type="button" class="pzOpcion" data-opcion="favorito">${p.ico("estrella", 22)}${favorito ? "Quitar de favoritos" : "Marcar como favorito"}</button>` : ""}
            </div>`
        });
        caja.addEventListener("click", evento => {
            const opcion = evento.target.closest("[data-opcion]")?.dataset.opcion;
            if (!opcion) return;
            p.cerrar();
            setTimeout(() => {
                if (opcion === "cambio") anotarCambio(marca, nombre);
                if (opcion === "precio") editarPrecio(marca, nombre);
                if (opcion === "favorito") cambiarFavorito(marca, nombre);
            }, 0);
        });
    }

    const ESPERA_MANTENER = 500;
    let temporizador = null;
    let inicio = null;
    let ignorarClick = false;

    function cortar() {
        clearTimeout(temporizador);
        temporizador = null;
        inicio = null;
    }

    contenedorProductos.addEventListener("pointerdown", evento => {
        ignorarClick = false;
        if (evento.button !== undefined && evento.button !== 0) return;
        const fila = evento.target.closest(".fila");
        const select = fila && fila.querySelector("select");
        if (!select || evento.target.closest("button, select")) return;
        cortar();
        inicio = { x: evento.clientX, y: evento.clientY };
        temporizador = setTimeout(() => {
            cortar();
            ignorarClick = true;
            navigator.vibrate?.(30);
            opcionesProducto(select.dataset.marca, select.dataset.producto);
        }, ESPERA_MANTENER);
    });
    contenedorProductos.addEventListener("pointermove", evento => {
        if (!inicio) return;
        if (Math.abs(evento.clientX - inicio.x) > 10 || Math.abs(evento.clientY - inicio.y) > 10) cortar();
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(tipo => contenedorProductos.addEventListener(tipo, cortar));
    contenedorProductos.addEventListener("click", evento => {
        if (!ignorarClick) return;
        ignorarClick = false;
        evento.preventDefault();
        evento.stopPropagation();
    }, true);
    contenedorProductos.addEventListener("contextmenu", evento => {
        if (evento.target.closest(".fila")) evento.preventDefault();
    });

    // Cada vez que se dibuja la lista de productos o cambia el comercio.
    new MutationObserver(() => marcarFavoritos()).observe(contenedorProductos, { childList: true });
    input.addEventListener("change", marcarFavoritos);
    input.addEventListener("blur", () => setTimeout(marcarFavoritos, 160));

    // ---------- Botón flotante ⋯ (T95) ----------
    const fab = document.createElement("button");
    fab.type = "button";
    fab.id = "masOpcionesPedido";
    fab.className = "fabPedido";
    fab.setAttribute("aria-label", "Más opciones del pedido");
    fab.setAttribute("aria-haspopup", "dialog");
    fab.innerHTML = p.ico("puntos", 26);
    pantalla.appendChild(fab);

    function hayProductosCargados() {
        return Array.from(document.querySelectorAll("#productos .marca select")).some(select => Number(select.value) > 0);
    }

    function abrirOpciones() {
        const comercio = comercioDelPedidoActual();
        const hayPedidos = typeof obtenerPedidosQueCuentan === "function" && obtenerPedidosQueCuentan().length > 0;
        const voz = window.vozVendeFrio;
        const opcion = (clave, icono, texto) => `<button type="button" class="pzOpcion" data-opcion="${clave}">${p.ico(icono, 22)}${texto}</button>`;
        const verSaldo = comercio && window.saldosVendeFrio && puedeCambiarPrecio() && window.saldosVendeFrio.cuentaDe(comercio.nombre);
        const caja = p.hoja({
            titulo: "Opciones del pedido",
            etiqueta: "Opciones del pedido",
            html: `<div class="pzOpciones">
                ${hayPedidos ? opcion("repetir", "refrescar", "Repetir último pedido") : ""}
                ${voz ? opcion("dictar", voz.disponible ? "microfono" : "copiar", voz.disponible ? "Dictar o pegar pedido" : "Pegar pedido de un mensaje") : ""}
                ${window.codigoBarrasVendeFrio ? opcion("escanear", "codigo", "Escanear código de barras") : ""}
                ${opcion("cambio", "deshacer", "Anotar un cambio")}
                ${opcion("fecha", "calendario", leer().fechaEntrega ? "Cambiar fecha de entrega" : "Elegir fecha de entrega")}
                ${verSaldo ? opcion("saldo", "moneda", "Ver saldo del comercio") : ""}
                ${hayProductosCargados() ? opcion("duplicar", "copiar", "Duplicar para otro comercio") : ""}
                ${opcion("vaciar", "tacho", "Vaciar pedido")}
            </div>`
        });
        caja.addEventListener("click", evento => {
            const elegida = evento.target.closest("[data-opcion]")?.dataset.opcion;
            if (!elegida) return;
            p.cerrar();
            setTimeout(() => {
                if (elegida === "repetir") repetirUltimoPedido();
                if (elegida === "dictar") voz.abrirDictado();
                if (elegida === "escanear") window.codigoBarrasVendeFrio.abrir();
                if (elegida === "cambio") anotarCambio();
                if (elegida === "fecha") elegirFecha();
                if (elegida === "saldo") window.saldosVendeFrio.verCuenta(comercio.nombre);
                if (elegida === "duplicar") duplicar();
                if (elegida === "vaciar") document.getElementById("reset")?.click();
            }, 0);
        });
    }

    // Deja los productos y pide el otro comercio.
    function duplicar() {
        const cambiar = document.getElementById("cambiarComercioPedido");
        if (cambiar && cambiar.offsetParent) cambiar.click();
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
        mostrarToast("Elegí el otro comercio: los productos quedan");
    }

    fab.addEventListener("click", abrirOpciones);

    // ---------- Al vaciar o guardar el pedido ----------
    if (typeof window.limpiarPedido === "function") {
        const original = window.limpiarPedido;
        window.limpiarPedido = function () {
            const resultado = original.apply(this, arguments);
            vaciarBorrador();
            return resultado;
        };
    }

    // Texto para el mensaje del pedido (WhatsApp).
    function textoParaMensaje() {
        const datos = leer();
        const partes = [];
        if (datos.fechaEntrega) partes.push(String.fromCodePoint(0x1F4C5) + " *ENTREGAR " + textoFecha(datos.fechaEntrega).toLocaleUpperCase("es") + "*");
        if (datos.cambios.length) {
            partes.push(String.fromCodePoint(0x1F504) + " *CAMBIOS*\n" + datos.cambios
                .map(cambio => "- " + cambio.producto + " x" + (Number(cambio.cantidad) || 1) + " (" + textoMotivo(cambio.motivo).toLocaleLowerCase("es") + ")")
                .join("\n"));
        }
        return partes.join("\n\n");
    }

    // Lo llama generarPedido con el id del pedido guardado.
    function alGuardar(idPedido, comercio) {
        const datos = leer();
        if (idPedido && (datos.cambios.length || datos.fechaEntrega)) {
            extras.guardar("detallesPedido", {
                idPedido: String(idPedido),
                comercio: String(comercio || "").slice(0, 120),
                cambios: datos.cambios.slice(0, 40).map(cambio => ({
                    marca: String(cambio.marca || "").slice(0, 120),
                    producto: String(cambio.producto || "").slice(0, 120),
                    cantidad: Math.max(1, Math.min(99, Number(cambio.cantidad) || 1)),
                    motivo: MOTIVOS.some(motivo => motivo.clave === cambio.motivo) ? cambio.motivo : "vencido"
                })),
                fechaEntrega: datos.fechaEntrega,
                persona: p.persona(),
                horaCelular: Date.now()
            }, String(idPedido));
        }
        vaciarBorrador();
    }

    // ---------- En la ficha del pedido (preparar y entregar) ----------
    function detalleDe(idPedido) {
        return extras.obtener("detallesPedido", String(idPedido)) ||
            extras.lista("detallesPedido").find(detalle => String(detalle.idPedido) === String(idPedido)) || null;
    }

    function seccionFicha(pedido) {
        const detalle = detalleDe(pedido.id);
        if (!detalle || (!detalle.fechaEntrega && !(detalle.cambios || []).length)) return null;
        const seccion = document.createElement("section");
        seccion.className = "seccionFichaPedido seccionDetallesPedido";
        let html = "";
        if (detalle.fechaEntrega) {
            html += `<div class="pzBanner pzBanPri">${p.ico("calendario", 22)}<div><strong>Entregar ${p.esc(textoFecha(detalle.fechaEntrega))}</strong><small>Fecha de entrega</small></div></div>`;
        }
        if ((detalle.cambios || []).length) {
            html += `<h3>Cambios</h3><div class="pzTarjeta pzLista">${detalle.cambios.map(cambio => `<div class="pzFila">
                    <div class="pzFilaTxt"><strong>${Number(cambio.cantidad) || 1} × ${p.esc(cambio.producto)}</strong><small>${p.esc(cambio.marca)} · ${p.esc(textoMotivo(cambio.motivo))}</small></div>
                </div>`).join("")}</div>`;
        }
        seccion.innerHTML = html;
        return seccion;
    }

    (window.fichaPedidoExtras = window.fichaPedidoExtras || []).push(seccionFicha);
    extras.escuchar("detallesPedido", () => window.seguimientoVendeFrio?.redibujarFicha?.());

    dibujarExtras();
    marcarFavoritos();

    window.nuevoPedidoVendeFrio = {
        precioCambiado, puedeCambiarPrecio, ajustarProductos, textoParaMensaje, alGuardar,
        anotarCambio, elegirFecha, editarPrecio, abrirOpciones, detalleDe, textoFecha,
        leerBorrador: leer, guardarBorrador: guardar
    };
}());
