// =====================================================
// VendeFrío - pedidosStore.js
// Capa central para leer, crear, buscar y actualizar pedidos
// =====================================================

(function (global) {
    const DB_HISTORIAL = "vendefrio_historial";
    const ESTADO_INICIAL = "Pedido ingresado";

    function leerJSON(clave, valorInicial) {
        const texto = localStorage.getItem(clave);
        if (!texto) return Array.isArray(valorInicial) ? [...valorInicial] : { ...valorInicial };
        try {
            return JSON.parse(texto);
        } catch (error) {
            console.warn(`Error al leer ${clave} de localStorage`, error);
            return Array.isArray(valorInicial) ? [...valorInicial] : { ...valorInicial };
        }
    }

    function guardarJSON(clave, datos) {
        try {
            localStorage.setItem(clave, JSON.stringify(datos));
            return true;
        } catch (error) {
            console.error(`Error al guardar ${clave} en localStorage`, error);
            return false;
        }
    }

    function generarIdUnico() {
        const timestamp = Date.now();
        const aleatorio = Math.random().toString(36).substring(2, 9);
        return `ped_${timestamp}_${aleatorio}`;
    }

    function obtenerAnioActual() {
        return new Date().getFullYear();
    }

    function obtenerClaveContadorAnio(anio) {
        return `vendefrio_contador_pedidos_${anio}`;
    }

    function obtenerSiguienteNumeroVisible(anio = obtenerAnioActual()) {
        const pedidos = obtenerPedidos();
        const claveContador = obtenerClaveContadorAnio(anio);
        let contadorActual = Number(localStorage.getItem(claveContador)) || 0;

        const numerosExistentes = new Set(
            pedidos
                .map(p => p && p.numeroVisible)
                .filter(Boolean)
        );

        let numeroFormateado;

        do {
            contadorActual += 1;
            const pad = String(contadorActual).padStart(4, "0");
            numeroFormateado = `PED-${anio}-${pad}`;
        } while (numerosExistentes.has(numeroFormateado));

        localStorage.setItem(claveContador, String(contadorActual));
        return numeroFormateado;
    }

    function obtenerPedidos() {
        const lista = leerJSON(DB_HISTORIAL, []);
        if (!Array.isArray(lista)) return [];

        // Devuelve los pedidos intactos.
        // No borra ni migra automáticamente los pedidos viejos.
        // No les asigna estado falso ni ID nuevo al leerlos.
        return lista.filter(item => item && typeof item === "object");
    }

    function guardarPedidos(pedidos) {
        if (!Array.isArray(pedidos)) return false;
        return guardarJSON(DB_HISTORIAL, pedidos);
    }

    function crearPedido(datosPedido) {
        if (!datosPedido || typeof datosPedido !== "object") return null;

        const anio = obtenerAnioActual();
        const id = generarIdUnico();
        const numeroVisible = obtenerSiguienteNumeroVisible(anio);
        const fechaHoraIso = new Date().toISOString();

        const nuevoPedido = {
            ...datosPedido,
            id,
            numeroVisible,
            estado: ESTADO_INICIAL,
            historialEstados: [
                {
                    estado: ESTADO_INICIAL,
                    fechaHora: fechaHoraIso
                }
            ],
            fecha: datosPedido.fecha || new Date().toLocaleDateString("es-AR"),
            timestamp: datosPedido.timestamp || Date.now(),
            comercio: String(datosPedido.comercio || "").trim(),
            cantidad: Number(datosPedido.cantidad) || 0,
            pedido: datosPedido.pedido || "",
            productos: Array.isArray(datosPedido.productos) ? datosPedido.productos : [],
            observaciones: datosPedido.observaciones || ""
        };

        const pedidos = obtenerPedidos();
        pedidos.unshift(nuevoPedido);
        const guardado = guardarPedidos(pedidos);

        return guardado ? nuevoPedido : null;
    }

    function buscarPedidoPorId(id) {
        if (!id) return null;
        const pedidos = obtenerPedidos();
        return pedidos.find(p => p.id === id) || null;
    }

    function actualizarEstadoPedido(id, nuevoEstado) {
        if (!id || !nuevoEstado) return false;
        const pedidos = obtenerPedidos();
        const pedido = pedidos.find(p => p.id === id);

        if (!pedido || !pedido.id) return false;

        const fechaHoraIso = new Date().toISOString();
        pedido.estado = nuevoEstado;

        if (!Array.isArray(pedido.historialEstados)) {
            pedido.historialEstados = [];
        }

        pedido.historialEstados.push({
            estado: nuevoEstado,
            fechaHora: fechaHoraIso
        });

        return guardarPedidos(pedidos);
    }

    function eliminarPedido(indice) {
        const pedidos = obtenerPedidos();
        const pos = Number(indice);
        if (!Number.isInteger(pos) || !pedidos[pos]) return false;

        pedidos.splice(pos, 1);
        return guardarPedidos(pedidos);
    }

    const pedidosStore = {
        obtenerPedidos,
        guardarPedidos,
        crearPedido,
        buscarPedidoPorId,
        actualizarEstadoPedido,
        eliminarPedido,
        obtenerSiguienteNumeroVisible
    };

    global.pedidosStore = pedidosStore;
})(typeof window !== "undefined" ? window : this);
