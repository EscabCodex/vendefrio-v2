// VendeFrío - Nuevo pedido que sugiere (T66) y "¿Seguro?" (T67).
// Con el comercio elegido: la tarjeta del comercio ("Suele pedir cada N
// días") y "Lo de siempre · Usar", que se despliega al tocarla y muestra
// cada producto con lo que suele llevar (T94). Los favoritos se marcan
// manteniendo apretado el producto (nuevoPedido.js). Al guardar, si una
// cantidad es mucho más de lo que suele llevar, pregunta antes.
(function () {
    "use strict";

    const pantalla = document.getElementById("pantallaPedido");
    const input = document.getElementById("cliente");
    const tarjetaCliente = pantalla && pantalla.querySelector(".clientePedido");
    if (!pantalla || !input || !tarjetaCliente) return;

    const p = window.piezas;
    const normal = texto => String(texto || "").trim().toLocaleLowerCase("es");
    const clave = (marca, producto) => normal(marca) + "|" + normal(producto);

    // ---------- Lo que se sabe del comercio ----------
    function pedidosDe(nombre) {
        const todos = typeof obtenerPedidosQueCuentan === "function" ? obtenerPedidosQueCuentan() : [];
        return todos.filter(pedido => typeof nombresComercioCompatibles === "function"
            ? nombresComercioCompatibles(nombre, pedido.comercio || pedido.cliente)
            : normal(pedido.comercio || pedido.cliente) === normal(nombre))
            .filter(pedido => Array.isArray(pedido.productos) && pedido.productos.length)
            .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
    }

    function mediana(valores) {
        const orden = valores.slice().sort((a, b) => a - b);
        if (!orden.length) return 0;
        const medio = Math.floor(orden.length / 2);
        return orden.length % 2 ? orden[medio] : Math.round((orden[medio - 1] + orden[medio]) / 2);
    }

    // El producto del catálogo que se puede vender hoy (no archivado).
    function productoDelCatalogo(catalogo, marca, nombre) {
        const marcaReal = Object.keys(catalogo).find(item => normal(item) === normal(marca));
        if (!marcaReal) return null;
        const producto = (catalogo[marcaReal] || []).find(item => item && normal(item.nombre) === normal(nombre));
        return producto ? { marca: marcaReal, producto } : null;
    }

    function analizar(comercio) {
        const pedidos = pedidosDe(comercio.nombre);
        const catalogo = typeof productosParaVender === "function" ? productosParaVender() : obtenerProductos();
        const recientes = pedidos.slice(0, 6);
        const datos = {};
        pedidos.slice(0, 12).forEach((pedido, indice) => {
            const vistos = new Set();
            pedido.productos.forEach(item => {
                const marca = item.marca, nombre = item.producto || item.nombre;
                const cantidad = Number(item.cantidad) || 0;
                if (!nombre || cantidad <= 0) return;
                const k = clave(marca, nombre);
                if (!datos[k]) datos[k] = { marca, nombre, veces: 0, enRecientes: 0, cantidades: [] };
                if (vistos.has(k)) return;
                vistos.add(k);
                datos[k].veces += 1;
                datos[k].cantidades.push(cantidad);
                if (indice < recientes.length) datos[k].enRecientes += 1;
            });
        });
        const enCatalogo = Object.values(datos).map(item => {
            const real = productoDelCatalogo(catalogo, item.marca, item.nombre);
            return real ? { ...item, marca: real.marca, nombre: real.producto.nombre, producto: real.producto, suele: Math.max(1, mediana(item.cantidades)) } : null;
        }).filter(Boolean);

        // "Lo de siempre": lo que está en al menos la mitad de los últimos pedidos.
        const minimo = Math.max(1, Math.ceil(recientes.length / 2));
        const siempre = enCatalogo.filter(item => item.enRecientes >= minimo)
            .sort((a, b) => b.enRecientes - a.enRecientes || a.nombre.localeCompare(b.nombre, "es"));
        const total = siempre.reduce((suma, item) => suma + (Number(precioVigente(item.producto, comercio)) || 0) * item.suele, 0);
        const unidades = siempre.reduce((suma, item) => suma + item.suele, 0);

        // Cada cuántos días pide: el promedio entre sus últimos pedidos.
        const fechas = recientes.map(pedido => Number(pedido.timestamp) || 0).filter(Boolean);
        let cadaDias = 0;
        if (fechas.length >= 2) cadaDias = Math.max(1, Math.round((fechas[0] - fechas[fechas.length - 1]) / 86400000 / (fechas.length - 1)));

        return { pedidos, siempre, total, unidades, cadaDias };
    }

    // ---------- Lo que se ve ----------
    const tarjetaComercio = document.createElement("div");
    tarjetaComercio.id = "comercioElegidoPedido";
    tarjetaComercio.className = "pzTarjeta pzComercioElegido pzOcultar";
    tarjetaCliente.before(tarjetaComercio);

    const contenedor = document.createElement("div");
    contenedor.id = "sugerenciasPedido";
    contenedor.className = "sugerenciasPedido";
    tarjetaCliente.after(contenedor);

    let usado = "";
    let abierto = false;
    const verPlata = () => !window.verPlataVendeFrio || window.verPlataVendeFrio.puedoVer();

    function selectDe(marca, nombre) {
        return Array.from(document.querySelectorAll("#productos .marca select"))
            .find(select => normal(select.dataset.marca) === normal(marca) && normal(select.dataset.producto) === normal(nombre)) || null;
    }

    function textoPrecio(producto, comercio) {
        const precio = precioVigente(producto, comercio);
        const oferta = typeof ofertaVigente === "function" ? ofertaVigente(producto) : null;
        const sinOferta = typeof precioDeLista === "function" ? precioDeLista(producto, comercio) : null;
        if (oferta && precio === oferta.precio && sinOferta && sinOferta > precio) {
            return `<s class="pzTachado">${p.plata(sinOferta)}</s> <b class="pzPrecioPromo">${p.plata(precio)}</b>`;
        }
        return precio ? p.plata(precio) : "";
    }

    function chipPromo(producto, comercio) {
        const oferta = typeof ofertaVigente === "function" ? ofertaVigente(producto) : null;
        if (!oferta || precioVigente(producto, comercio) !== oferta.precio) return "";
        return `<span class="pzChip pzChipPromo">${p.esc(window.ofertasVendeFrio ? window.ofertasVendeFrio.textoHasta(oferta.hasta) : "Promo")}</span>`;
    }


    function dibujarTarjetaComercio(comercio, analisis) {
        const foco = document.activeElement === input;
        const mostrar = Boolean(comercio) && !foco && !tarjetaComercio.dataset.cambiando;
        tarjetaComercio.classList.toggle("pzOcultar", !mostrar);
        tarjetaCliente.classList.toggle("pzOcultar", mostrar);
        if (!mostrar) return;
        const sub = analisis.cadaDias
            ? "Suele pedir cada " + analisis.cadaDias + (analisis.cadaDias === 1 ? " día" : " días") + (analisis.total ? " · " + p.plata(analisis.total) : "")
            : (comercio.direccion || (analisis.pedidos.length ? analisis.pedidos.length + (analisis.pedidos.length === 1 ? " pedido" : " pedidos") : "Primer pedido"));
        const html = `<div class="pzFila">
            <div class="pzIni ${p.colorIni(comercio.nombre)}">${p.esc(p.iniciales(comercio.nombre))}</div>
            <div class="pzFilaTxt"><strong>${p.esc(comercio.nombre)}</strong><small>${p.esc(sub)}</small></div>
            <button type="button" class="pzEnlace" id="cambiarComercioPedido">Cambiar</button>
        </div>`;
        if (tarjetaComercio.innerHTML !== html) tarjetaComercio.innerHTML = html;
    }

    function dibujar() {
        const comercio = typeof comercioDelPedidoActual === "function" ? comercioDelPedidoActual() : null;
        if (!comercio || (typeof comercioArchivado === "function" && comercioArchivado(comercio))) {
            dibujarTarjetaComercio(null);
            if (contenedor.innerHTML) contenedor.innerHTML = "";
            usado = "";
            return;
        }
        const analisis = analizar(comercio);
        dibujarTarjetaComercio(comercio, analisis);

        // "Debe" (T74): avisa si tiene pedidos sin cobrar o pasó el tope.
        let html = window.saldosVendeFrio ? window.saldosVendeFrio.avisoParaPedido(comercio) : "";
        // "Lo de siempre": se oculta si el pedido ya lo tiene.
        const yaEsta = analisis.siempre.length && analisis.siempre.every(item => {
            const select = selectDe(item.marca, item.nombre);
            return select && Number(select.value) >= item.suele;
        });
        if (analisis.siempre.length && !yaEsta && usado !== comercio.nombre) {
            const cantidad = analisis.siempre.length;
            // T94: se despliega al tocarla, con filas chicas (nombre y cantidad).
            const filas = analisis.siempre.map(item => `<div class="pzSiempreFila"><span>${p.esc(item.nombre)}</span><b>${item.suele}</b></div>`).join("");
            html += `<div class="pzBanner pzBanPri pzSiempre${abierto ? " abierto" : ""}" id="loDeSiempre">
                <button type="button" class="pzSiempreAbrir" aria-expanded="${abierto}" aria-controls="listaLoDeSiempre" aria-label="${abierto ? "Ocultar" : "Ver"} lo de siempre">
                    ${p.ico("chispa", 22)}
                    <div><strong>Lo de siempre ${p.ico("chevAbajo", 16)}</strong><small>${cantidad} ${cantidad === 1 ? "producto" : "productos"} · ${analisis.unidades} u${analisis.total && verPlata() ? " · " + p.plata(analisis.total) : ""}</small></div>
                </button>
                <button type="button" class="pzBtn pzBtnPri pzBtnChico" id="usarLoDeSiempre">Usar</button>
                <div class="pzSiempreLista" id="listaLoDeSiempre"${abierto ? "" : " hidden"}>${filas}</div>
            </div>`;
        }
        if (contenedor.innerHTML !== html) contenedor.innerHTML = html;
    }

    // ---------- Acciones ----------
    function usarLoDeSiempre() {
        const comercio = comercioDelPedidoActual();
        if (!comercio) return;
        const analisis = analizar(comercio);
        analisis.siempre.forEach(item => {
            const select = selectDe(item.marca, item.nombre);
            if (!select || Number(select.value) >= item.suele) return;
            select.value = String(Math.min(40, item.suele));
            actualizarEstadoCantidad(select);
        });
        usado = comercio.nombre;
        dibujar();
        mostrarToast("Listo: cargamos lo de siempre");
    }


    contenedor.addEventListener("click", evento => {
        if (evento.target.closest("#usarLoDeSiempre")) {
            usarLoDeSiempre();
            return;
        }
        if (evento.target.closest(".pzSiempreAbrir")) {
            abierto = !abierto;
            dibujar();
        }
    });

    tarjetaComercio.addEventListener("click", evento => {
        if (!evento.target.closest("#cambiarComercioPedido")) return;
        tarjetaComercio.dataset.cambiando = "1";
        dibujar();
        input.focus();
        input.select();
    });

    input.addEventListener("focus", () => dibujar());
    input.addEventListener("blur", () => {
        delete tarjetaComercio.dataset.cambiando;
        // Un instante, por si tocó una opción de la lista.
        setTimeout(dibujar, 150);
    });
    input.addEventListener("change", () => { usado = ""; dibujar(); });
    input.addEventListener("input", () => { usado = ""; dibujar(); });

    // Cada vez que cambia el pedido (cantidades, comercio, borrador) se redibuja.
    if (typeof window.actualizarResumenPedido === "function") {
        const original = window.actualizarResumenPedido;
        window.actualizarResumenPedido = function () {
            const resultado = original.apply(this, arguments);
            try {
                dibujar();
                actualizarPreciosDeLaLista();
            } catch (error) {
                console.error("No se pudieron dibujar las sugerencias.", error);
            }
            return resultado;
        };
    }

    // ---------- Precios de la lista (ofertas y listas de precios) ----------
    function actualizarPreciosDeLaLista() {
        const comercio = comercioDelPedidoActual();
        const catalogo = obtenerProductos();
        document.querySelectorAll("#productos .marca .fila").forEach(fila => {
            const select = fila.querySelector("select");
            const texto = fila.querySelector(".nombreProductoPedido");
            if (!select || !texto) return;
            const real = productoDelCatalogo(catalogo, select.dataset.marca, select.dataset.producto);
            if (!real) return;
            // T98: el precio cambiado solo para este pedido, y el lapicito
            // para cambiarlo (si esta persona ve la plata).
            const extra = window.nuevoPedidoVendeFrio;
            const cambiado = extra ? extra.precioCambiado(select.dataset.marca, select.dataset.producto) : null;
            const precio = cambiado !== null
                ? `<s class="pzTachado">${p.plata(precioVigente(real.producto, comercio))}</s> <b class="precioEspecial">${p.plata(cambiado)}</b>`
                : textoPrecio(real.producto, comercio);
            const editable = extra && extra.puedeCambiarPrecio();
            const contenido = (precio ? precio + " c/u" : "Poner precio") + (editable ? " " + p.ico("lapiz", 13) : "");
            const html = (editable
                ? `<button type="button" class="precioPedidoBoton${cambiado !== null ? " cambiado" : ""}" data-editar-precio aria-label="Cambiar el precio de ${p.esc(real.producto.nombre)} para este pedido">${contenido}</button>`
                : (precio ? `<small>${precio} c/u</small>` : "")) + chipPromo(real.producto, comercio);
            let lugar = texto.querySelector(".precioPedido");
            if (!lugar) {
                texto.querySelectorAll("small").forEach(viejo => viejo.remove());
                lugar = document.createElement("span");
                lugar.className = "precioPedido";
                texto.appendChild(lugar);
            }
            if (lugar.innerHTML !== html) lugar.innerHTML = html;
        });
    }

    // ---------- "¿Seguro?" (T67) ----------
    // Mucho más de lo que suele llevar: 4 veces o más, y al menos 8 de más.
    function cantidadesRaras() {
        const comercio = comercioDelPedidoActual();
        if (!comercio) return [];
        const pedidos = pedidosDe(comercio.nombre).slice(0, 6);
        if (!pedidos.length) return [];
        const raras = [];
        document.querySelectorAll("#productos .marca select").forEach(select => {
            const cantidad = Number(select.value) || 0;
            if (!cantidad) return;
            const anteriores = [];
            pedidos.forEach(pedido => {
                const item = pedido.productos.find(linea => normal(linea.marca) === normal(select.dataset.marca) && normal(linea.producto || linea.nombre) === normal(select.dataset.producto));
                if (item && Number(item.cantidad) > 0) anteriores.push(Number(item.cantidad));
            });
            if (!anteriores.length) return;
            const suele = Math.max(1, mediana(anteriores));
            if (cantidad >= suele * 4 && cantidad - suele >= 8) raras.push({ select, cantidad, suele, comercio: comercio.nombre });
        });
        return raras;
    }

    function preguntarSeguro(rara) {
        return new Promise(resolver => {
            const nombre = rara.select.dataset.producto;
            p.modal({
                icono: "alerta",
                color: "aviso",
                titulo: "¿Seguro que son " + rara.cantidad + "?",
                html: `<p>${p.esc(rara.comercio)} suele llevar <b>${rara.suele}</b> de ${p.esc(nombre)}. Fijate que no sobre un cero.</p>
                    <div class="pzComparar"><div><small>Suele llevar</small><strong>${rara.suele}</strong></div><div class="pzOjo"><small>Cargaste</small><strong>${rara.cantidad}</strong></div></div>`,
                botones: [
                    { texto: "Dejar " + rara.cantidad, clase: "pzBtnSec", alTocar: () => resolver(true) },
                    {
                        texto: "Cambiar a " + rara.suele,
                        clase: "pzBtnPri",
                        alTocar: () => {
                            rara.select.value = String(rara.suele);
                            actualizarEstadoCantidad(rara.select);
                            resolver(true);
                        }
                    }
                ]
            });
        });
    }

    let revisado = false;
    const botonGuardar = document.getElementById("generar");
    if (botonGuardar) {
        botonGuardar.addEventListener("click", async evento => {
            if (revisado) {
                revisado = false;
                return;
            }
            const raras = cantidadesRaras();
            if (!raras.length) return;
            evento.preventDefault();
            evento.stopImmediatePropagation();
            for (const rara of raras) await preguntarSeguro(rara);
            revisado = true;
            botonGuardar.click();
        }, true);
    }

    window.sugerenciasVendeFrio = { analizar, dibujar, cantidadesRaras };
}());
