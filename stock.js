// VendeFrío - Stock simple (T90).
// Cada producto puede tener cuánto había al contarlo (stock) y cuándo
// (stockHora). Lo que hay ahora = stock − lo entregado después de esa hora.
// "Reservadas" = lo que está en pedidos sin entregar. En el Catálogo se ve
// en cada producto, con un aviso si hay poco, y "Cargar lo que llegó de
// fábrica" suma lo que entra. Los productos sin stock cargado no cambian.
(function () {
    "use strict";

    const p = window.piezas;
    const POCO = 15;
    const SIN_ENTREGAR = ["cargado", "armado", "preparado", "enReparto", "enVehiculo"];

    function clave(marca, nombre) {
        return String(marca || "").toLocaleLowerCase("es") + "|" + String(nombre || "").toLocaleLowerCase("es");
    }

    function tieneStock(producto) {
        return producto && typeof producto.stock === "number" && Number.isFinite(producto.stock);
    }

    function horaDeEntrega(pedido) {
        const estados = pedido && pedido.estados && typeof pedido.estados === "object" ? Object.values(pedido.estados) : [];
        const entregas = estados.filter(entrada => entrada && entrada.estado === "entregado").map(entrada => Number(entrada.horaCelular) || 0);
        return entregas.length ? Math.max(...entregas) : 0;
    }

    // Una sola pasada por el historial: lo entregado (con su hora) y lo
    // reservado de cada producto.
    function movimientos() {
        // Sin ningún producto con stock cargado no hace falta recorrer el
        // historial (T151): con muchos pedidos trababa el Catálogo.
        const productos = typeof productosParaLeer === "function" ? productosParaLeer() : {};
        if (!Object.values(productos).some(lista => (lista || []).some(tieneStock))) return { entregas: new Map(), reservas: new Map() };
        const historial = typeof historialParaLeer === "function" ? historialParaLeer() : [];
        const entregas = new Map();
        const reservas = new Map();
        historial.forEach(pedido => {
            if (!pedido || pedido.eliminado === true || pedido.estado === "cancelado") return;
            const conEstados = typeof pedidoTieneEstados === "function" ? pedidoTieneEstados(pedido) : Boolean(pedido.estados);
            const estado = conEstados && typeof estadoActualDelPedido === "function" ? estadoActualDelPedido(pedido) : "";
            if (estado === "cancelado") return;
            const entregado = !conEstados || estado === "entregado" || estado === "historico";
            const hora = conEstados ? (horaDeEntrega(pedido) || Number(pedido.timestamp) || 0) : Number(pedido.timestamp) || 0;
            (pedido.productos || []).forEach(linea => {
                const llave = clave(linea.marca, linea.producto);
                const pedida = Number(linea.cantidad) || 0;
                if (entregado) {
                    const cantidad = typeof linea.entregada === "number" ? linea.entregada : pedida;
                    if (!entregas.has(llave)) entregas.set(llave, []);
                    entregas.get(llave).push([hora, cantidad]);
                } else if (SIN_ENTREGAR.includes(estado)) {
                    reservas.set(llave, (reservas.get(llave) || 0) + pedida);
                }
            });
        });
        return { entregas, reservas };
    }

    function estadoDe(producto, marca, datos = movimientos()) {
        if (!tieneStock(producto)) return null;
        const llave = clave(marca || producto.marca, producto.nombre);
        const desde = Number(producto.stockHora) || 0;
        const salieron = (datos.entregas.get(llave) || []).filter(([hora]) => hora > desde).reduce((suma, [, cantidad]) => suma + cantidad, 0);
        const hay = Math.max(0, Math.round(producto.stock - salieron));
        const reservadas = datos.reservas.get(llave) || 0;
        const libres = hay - reservadas;
        return { hay, reservadas, libres, nivel: hay <= 0 ? "no" : (libres < POCO ? "bajo" : "ok") };
    }

    function todos(datos = movimientos()) {
        const productos = typeof productosParaLeer === "function" ? productosParaLeer() : {};
        const lista = [];
        Object.keys(productos).forEach(marca => (productos[marca] || []).forEach(producto => {
            if (!producto || producto.archivado === true) return;
            lista.push({ producto: { ...producto, marca }, estado: estadoDe(producto, marca, datos) });
        }));
        return lista;
    }

    function htmlEstado(estado) {
        const detalle = estado.nivel === "no" ? "Sin stock" : estado.nivel === "bajo" ? "Poco" : (estado.reservadas ? estado.reservadas + " reservadas" : "Disponible");
        return `<span class="stockNumero stock-${estado.nivel}">${estado.hay} u</span><small class="stockDetalle stock-${estado.nivel}">${detalle}</small>`;
    }

    // ---------- Catálogo ----------
    function dibujarEnCatalogo(grilla, visibles) {
        const datos = movimientos();
        const conStock = [];
        grilla.querySelectorAll(".itemCatalogo").forEach(card => {
            const producto = visibles.find(item => item.id && item.id === card.dataset.idProducto);
            const estado = producto ? estadoDe(producto, producto.marca, datos) : null;
            card.querySelector(".stockCatalogo")?.remove();
            if (!estado) return;
            conStock.push({ producto, estado });
            const caja = document.createElement("div");
            caja.className = "stockCatalogo";
            caja.setAttribute("aria-label", "Stock de " + producto.nombre + ": " + estado.hay + " unidades");
            caja.innerHTML = htmlEstado(estado);
            card.querySelector("strong")?.after(caja);
        });

        const bajos = todos(datos).filter(item => item.estado && item.estado.nivel !== "ok");
        let aviso = document.getElementById("avisoStockBajo");
        if (bajos.length) {
            if (!aviso) {
                aviso = document.createElement("button");
                aviso.type = "button";
                aviso.id = "avisoStockBajo";
                aviso.className = "pzBanner pzBanAviso";
                aviso.addEventListener("click", verBajos);
            }
            const sinNada = bajos.filter(item => item.estado.nivel === "no").length;
            aviso.innerHTML = `${p.ico("alerta", 22)}<div><strong>${bajos.length === 1 ? "1 producto con poco stock" : bajos.length + " productos con poco stock"}</strong><small>${sinNada ? (sinNada === 1 ? "1 sin stock. " : sinNada + " sin stock. ") : ""}Conviene pedir a fábrica</small></div>${p.ico("chevDerecha", 20)}`;
            const chips = document.getElementById("chipsMarcasCatalogo");
            (chips || grilla).before(aviso);
            if (chips) chips.before(aviso);
        } else {
            aviso?.remove();
        }

        let boton = document.getElementById("cargarFabrica");
        if (!boton) {
            boton = document.createElement("button");
            boton.type = "button";
            boton.id = "cargarFabrica";
            boton.className = "pzBtn pzBtnSec pzBtnBloque";
            boton.innerHTML = p.ico("camion", 20) + "Cargar lo que llegó de fábrica";
            boton.addEventListener("click", cargarFabrica);
        }
        boton.classList.toggle("oculto", !visibles.length);
        grilla.after(boton);
    }

    function verBajos() {
        const bajos = todos().filter(item => item.estado && item.estado.nivel !== "ok")
            .sort((a, b) => a.estado.libres - b.estado.libres);
        p.hoja({
            titulo: "Poco stock",
            sub: "Lo que queda libre, sin contar lo reservado",
            html: `<div class="pzTarjeta pzLista">${bajos.map(({ producto, estado }) => `<div class="pzFila filaStock">
                <span class="pzFilaTxt"><strong>${p.esc(producto.nombre)}</strong><small>${p.esc(producto.marca)}${estado.reservadas ? " · " + estado.reservadas + " reservadas" : ""}</small></span>
                <span class="stockDerecha">${htmlEstado(estado)}</span></div>`).join("")}</div>`,
            botones: [{ texto: "Cargar lo que llegó de fábrica", icono: "camion", alTocar: () => { setTimeout(cargarFabrica, 0); } }]
        });
    }

    function cargarFabrica() {
        const lista = todos().sort((a, b) => a.producto.marca.localeCompare(b.producto.marca, "es") || a.producto.nombre.localeCompare(b.producto.nombre, "es"));
        p.hoja({
            titulo: "Llegó de fábrica",
            sub: "Escribí cuántas unidades entraron de cada uno. Se suman a lo que hay.",
            etiqueta: "Cargar lo que llegó de fábrica",
            clase: "hojaFabrica",
            html: `<div class="pzTarjeta pzLista">${lista.map(({ producto, estado }) => `<label class="pzFila filaFabrica">
                <span class="pzFilaTxt"><strong>${p.esc(producto.nombre)}</strong><small>${p.esc(producto.marca)} · ${estado ? "hay " + estado.hay + " u" : "sin contar"}</small></span>
                <input type="number" inputmode="numeric" min="0" step="1" data-id="${p.esc(producto.id || "")}" aria-label="Llegaron de ${p.esc(producto.nombre)}" placeholder="0">
            </label>`).join("")}</div>`,
            botones: [{ texto: "Guardar", icono: "check", alTocar: caja => guardarFabrica(caja) }]
        });
    }

    function guardarFabrica(caja) {
        const ahora = Date.now();
        const datos = movimientos();
        let sumados = 0;
        caja.querySelectorAll("input[data-id]").forEach(campo => {
            const llegaron = Math.round(Number(campo.value) || 0);
            if (llegaron <= 0 || !campo.dataset.id) return;
            const encontrado = obtenerProductoPorId(campo.dataset.id);
            if (!encontrado) return;
            const producto = { ...encontrado.producto, marca: encontrado.marca };
            const estado = estadoDe(producto, producto.marca, datos);
            if (actualizarProductoPorId(producto.id, { stock: (estado ? estado.hay : 0) + llegaron, stockHora: ahora })) sumados += 1;
        });
        if (!sumados) {
            window.mostrarToast?.("Escribí cuántas llegaron de al menos un producto.");
            return false;
        }
        window.renderizarCatalogo?.();
        window.mostrarToast?.(sumados === 1 ? "Stock de 1 producto actualizado" : "Stock de " + sumados + " productos actualizado");
        return true;
    }

    function contar(producto) {
        const estado = estadoDe(producto, producto.marca);
        p.hoja({
            titulo: "Contar stock",
            sub: producto.nombre + " · " + producto.marca,
            html: `<label class="pzCampo">¿Cuántas unidades hay ahora?<input type="number" inputmode="numeric" min="0" step="1" id="stockContado" value="${estado ? estado.hay : ""}"></label>
                <p class="pzHojaSub">Desde ahora se descuenta solo lo que se entrega.${estado && estado.reservadas ? " Hay " + estado.reservadas + " reservadas en pedidos sin entregar." : ""}</p>`,
            botones: [
                { texto: "No llevar stock", clase: "pzBtnGris", par: true, alTocar: () => guardarConteo(producto, null) },
                { texto: "Guardar", par: true, alTocar: caja => guardarConteo(producto, caja.querySelector("#stockContado").value) }
            ]
        });
    }

    function guardarConteo(producto, valor) {
        const cambios = valor === null ? { stock: null, stockHora: null } : { stock: Math.max(0, Math.round(Number(valor) || 0)), stockHora: Date.now() };
        if (valor !== null && String(valor).trim() === "") {
            window.mostrarToast?.("Escribí cuántas hay.");
            return false;
        }
        if (!actualizarProductoPorId(producto.id, cambios)) {
            window.mostrarToast?.("No se pudo guardar.", "error");
            return false;
        }
        window.renderizarCatalogo?.();
        return true;
    }

    (window.catalogoExtras = window.catalogoExtras || []).push(dibujarEnCatalogo);
    (window.opcionesProductoExtras = window.opcionesProductoExtras || []).push({
        opcion: "stock", icono: "paquete",
        texto: producto => tieneStock(producto) ? "Contar stock (" + (estadoDe(producto, producto.marca)?.hay ?? 0) + " u)" : "Llevar stock",
        abrir: contar
    });

    window.stockVendeFrio = { estadoDe, todos, cargarFabrica, contar };
}());
