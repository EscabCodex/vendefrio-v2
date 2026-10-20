// VendeFrío - Los números para el Asistente (T91, Etapa 8).
// Arma un resumen corto de ventas por mes, por producto, por comercio y por
// vendedor, lo que deben y el stock bajo, y se lo pasa a la IA en la nube
// (api/preguntar.js) cuando el Asistente (asistente.js) no sabe contestar
// solo. Antes era la pantalla "Preguntale a VendeFrío".
(function () {
    "use strict";

    const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

    function plataTexto(numero) {
        return "$ " + Math.round(Number(numero) || 0).toLocaleString("es-AR");
    }

    function sumar(mapa, clave, monto, unidades) {
        const fila = mapa.get(clave) || { monto: 0, unidades: 0, pedidos: 0 };
        fila.monto += monto;
        fila.unidades += unidades;
        fila.pedidos += 1;
        mapa.set(clave, fila);
    }

    function top(mapa, cuantos) {
        return [...mapa.entries()].sort((a, b) => b[1].monto - a[1].monto).slice(0, cuantos)
            .map(([nombre, fila]) => "- " + nombre + ": " + plataTexto(fila.monto) + ", " + fila.unidades + " u, " + fila.pedidos + " pedidos");
    }

    // El resumen que ve la IA: corto, en texto y solo con números.
    function resumen() {
        const ahora = new Date();
        const lineas = ["Hoy es " + ahora.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + "."];
        const historial = (typeof obtenerHistorial === "function" ? obtenerHistorial() : [])
            .filter(pedido => pedido && pedido.eliminado !== true && pedido.estado !== "cancelado");
        const meses = [];
        for (let atras = 0; atras < 4; atras++) {
            const desde = new Date(ahora.getFullYear(), ahora.getMonth() - atras, 1).getTime();
            const hasta = new Date(ahora.getFullYear(), ahora.getMonth() - atras + 1, 1).getTime();
            meses.push({ nombre: MESES[new Date(desde).getMonth()] + " " + new Date(desde).getFullYear(), desde, hasta });
        }
        const marcasPorProducto = new Map();
        meses.forEach((mes, indice) => {
            const pedidos = historial.filter(pedido => Number(pedido.timestamp) >= mes.desde && Number(pedido.timestamp) < mes.hasta);
            const productos = new Map();
            const marcas = new Map();
            const comercios = new Map();
            const vendedores = new Map();
            let total = 0;
            let unidades = 0;
            pedidos.forEach(pedido => {
                const monto = typeof totalDelPedido === "function" ? Number(totalDelPedido(pedido)?.total || 0) : 0;
                const cantidad = (pedido.productos || []).reduce((suma, linea) => suma + (Number(linea.cantidad) || 0), 0);
                total += monto;
                unidades += cantidad;
                sumar(comercios, String(pedido.comercio || "Sin comercio"), monto, cantidad);
                const vendedor = pedido.autor && pedido.autor.nombre;
                if (vendedor) sumar(vendedores, vendedor, monto, cantidad);
                (pedido.productos || []).forEach(linea => {
                    const cantidadLinea = Number(linea.cantidad) || 0;
                    const montoLinea = cantidadLinea * (Number(linea.precio) || 0);
                    sumar(productos, linea.producto + " (" + linea.marca + ")", montoLinea, cantidadLinea);
                    sumar(marcas, String(linea.marca || ""), montoLinea, cantidadLinea);
                    marcasPorProducto.set(linea.producto, linea.marca);
                });
            });
            lineas.push("", "## " + (indice === 0 ? "Este mes, " : "") + mes.nombre + (indice === 0 ? " (hasta hoy)" : ""),
                "Vendido: " + plataTexto(total) + " en " + pedidos.length + " pedidos, " + unidades + " unidades, " + comercios.size + " comercios.");
            if (!pedidos.length) return;
            lineas.push("Por marca:", ...top(marcas, 10));
            lineas.push("Productos:", ...top(productos, indice === 0 ? 25 : 12));
            lineas.push("Comercios:", ...top(comercios, indice === 0 ? 40 : 15));
            if (vendedores.size) lineas.push("Por vendedor:", ...top(vendedores, 10));
        });

        // Comercios que este mes no compraron.
        const delMes = new Set(historial.filter(pedido => Number(pedido.timestamp) >= meses[0].desde).map(pedido => String(pedido.comercio || "")));
        const sinComprar = (typeof obtenerComercios === "function" ? obtenerComercios() : [])
            .filter(comercio => comercio.archivado !== true && !delMes.has(comercio.nombre)).map(comercio => comercio.nombre);
        if (sinComprar.length) lineas.push("", "Comercios que este mes no compraron: " + sinComprar.slice(0, 40).join(", ") + ".");

        const cuentas = window.saldosVendeFrio?.cuentas?.() || [];
        lineas.push("", "## Lo que deben (a cobrar)");
        if (cuentas.length) {
            cuentas.slice(0, 30).forEach(cuenta => lineas.push("- " + cuenta.nombre + ": " + plataTexto(cuenta.total) + " en " + cuenta.pedidos.length + " pedidos"
                + (cuenta.tope ? ", tope " + plataTexto(cuenta.tope) + (cuenta.pasoTope ? " (pasó el tope)" : "") : "")
                + ", desde el " + new Date(cuenta.desde || Date.now()).toLocaleDateString("es-AR")));
        } else {
            lineas.push("Nadie debe nada.");
        }

        const stock = (window.stockVendeFrio?.todos?.() || []).filter(item => item.estado);
        if (stock.length) {
            lineas.push("", "## Stock");
            stock.slice(0, 40).forEach(({ producto, estado }) => lineas.push("- " + producto.nombre + " (" + producto.marca + "): hay " + estado.hay + " u, " + estado.reservadas + " reservadas" + (estado.nivel !== "ok" ? " (poco)" : "")));
        }
        return lineas.join("\n");
    }

    async function preguntarALaNube(pregunta, datos = resumen(), charla = []) {
        const usuario = window.firebase?.auth?.().currentUser;
        if (!usuario) throw new Error("Entrá con la cuenta de la distribuidora para preguntar.");
        const respuesta = await fetch("/api/preguntar", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + await usuario.getIdToken() },
            body: JSON.stringify({ pregunta, datos, charla: charla.slice(-6).map(({ quien, texto }) => ({ quien, texto })) })
        });
        const cuerpo = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok || !cuerpo.resultado) {
            throw new Error(cuerpo.codigo === "sinConfigurar" ? "Falta configurar la IA en Vercel."
                : respuesta.status === 429 ? "Muchas preguntas seguidas. Esperá un minuto."
                    : respuesta.status === 401 ? "Tu sesión venció: salí de la cuenta y volvé a entrar."
                        : "La IA no pudo contestar. Probá de nuevo.");
        }
        return cuerpo.resultado;
    }

    window.preguntaleVendeFrio = { resumen, preguntarALaNube };
}());
