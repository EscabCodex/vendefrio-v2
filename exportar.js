// =====================================================
// VendeFrío - exportar.js
// Planilla para el contador (Etapa 6, T47): los pedidos de un período en un
// archivo CSV que abre Excel o Google Sheets. Separado por ";" y con BOM,
// como lo espera Excel en castellano.
// =====================================================

(function () {
    const FORMAS = { efectivo: "Efectivo", transferencia: "Transferencia" };
    const ESTADOS = {
        cargado: "Cargado", enPreparacion: "En preparación", preparado: "Preparado",
        enVehiculo: "En reparto", enReparto: "En reparto", entregado: "Entregado", cancelado: "Cancelado"
    };

    function celda(valor) {
        const texto = String(valor === null || valor === undefined ? "" : valor);
        return /[";\n\r]/.test(texto) ? '"' + texto.replace(/"/g, '""') + '"' : texto;
    }

    function fechaDe(pedido) {
        const hora = Number(pedido && pedido.timestamp);
        if (Number.isFinite(hora) && hora > 0) return new Date(hora);
        const partes = String(pedido && pedido.fecha || "").split("/");
        if (partes.length === 3) return new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
        return null;
    }

    function dosCifras(numero) {
        return String(numero).padStart(2, "0");
    }

    function persona(dato) {
        const nombre = String(dato && dato.nombre || "").trim();
        if (nombre) return nombre;
        return dato && dato.idPersona === "dueno" ? "Dueño" : "";
    }

    function filas(pedidos) {
        const encabezado = ["Fecha", "Hora", "N° de pedido", "Comercio", "Estado", "Productos", "Unidades", "Total", "Cobro", "Monto cobrado", "Cargado por"];
        const lineas = [encabezado];
        pedidos
            .slice()
            .sort((a, b) => (fechaDe(a)?.getTime() || 0) - (fechaDe(b)?.getTime() || 0))
            .forEach(pedido => {
                const fecha = fechaDe(pedido);
                const productos = Array.isArray(pedido.productos) ? pedido.productos : [];
                const unidades = productos.reduce((total, item) => total + (Number(item && item.cantidad) || 0), 0);
                const total = typeof totalDelPedido === "function" ? totalDelPedido(pedido).total : 0;
                const estado = typeof estadoActualDelPedido === "function" ? estadoActualDelPedido(pedido) : "";
                const cobro = window.nubeVendeFrio?.cobroDelPedido?.(pedido) || null;
                lineas.push([
                    fecha ? dosCifras(fecha.getDate()) + "/" + dosCifras(fecha.getMonth() + 1) + "/" + fecha.getFullYear() : String(pedido.fecha || ""),
                    fecha && Number(pedido.timestamp) ? dosCifras(fecha.getHours()) + ":" + dosCifras(fecha.getMinutes()) : "",
                    typeof numeroCortoDelPedido === "function" ? numeroCortoDelPedido(pedido) : "",
                    String(pedido.comercio || pedido.cliente || ""),
                    ESTADOS[estado] || (estado ? estado : "Histórico"),
                    productos.map(item => String(item.nombre || item.producto || "") + " x" + (Number(item.cantidad) || 0)).join(", "),
                    unidades,
                    Math.round(total),
                    cobro ? FORMAS[cobro.forma] || cobro.forma : (estado === "entregado" ? "Pendiente" : ""),
                    cobro ? Math.round(cobro.monto) : "",
                    persona(pedido.autor)
                ]);
            });
        return lineas;
    }

    function textoCsv(pedidos) {
        return "﻿" + filas(pedidos).map(linea => linea.map(celda).join(";")).join("\r\n") + "\r\n";
    }

    // Descarga el archivo. nombre: sin extensión.
    function descargar(pedidos, nombre) {
        const archivo = new Blob([textoCsv(pedidos)], { type: "text/csv;charset=utf-8" });
        const enlace = document.createElement("a");
        enlace.href = URL.createObjectURL(archivo);
        // Sin tildes: algunos navegadores descartan el nombre si las tiene.
        enlace.download = String(nombre || "pedidos").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\- ]/g, "") + ".csv";
        document.body.appendChild(enlace);
        enlace.click();
        setTimeout(() => {
            URL.revokeObjectURL(enlace.href);
            enlace.remove();
        }, 1000);
        if (typeof mostrarToast === "function") {
            mostrarToast(pedidos.length === 1 ? "Planilla con 1 pedido descargada" : "Planilla con " + pedidos.length + " pedidos descargada");
        }
    }

    window.exportarVendeFrio = { textoCsv, descargar };
}());
