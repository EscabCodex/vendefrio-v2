// VendeFrío - Resumen de la noche (T79).
// A las 20:30, si la app está abierta (o se abre después), el dueño y quien
// cobra reciben "Cerró el día: $ X vendidos" con lo entregado, cobrado y lo
// que falta. Si las notificaciones están permitidas sale como notificación;
// si no, como aviso en Inicio. También avisa una vez cuando un comercio pasa
// su tope de deuda (T74). Se apaga en Más > Trabajo > "Resumen de la noche".
(function () {
    "use strict";

    const p = window.piezas;
    const HORA = 20;
    const MINUTO = 30;
    const CLAVE_DIA = "vendefrio_resumen_noche_dia";
    const CLAVE_TOPES = "vendefrio_topes_avisados";

    function hoy() {
        const fecha = new Date(); fecha.setHours(0, 0, 0, 0);
        return fecha.getTime();
    }

    function puedeVer() {
        return typeof usaNubeReal === "function" && usaNubeReal() && Boolean(window.cierreVendeFrio?.disponible?.()) &&
            window.verPlataVendeFrio?.puedoVer?.() !== false;
    }

    function prendido() {
        return window.preferenciasVendeFrio?.valor?.("resumenNoche") !== false;
    }

    // En las pruebas automáticas no sale solo (taparía las capturas).
    function esLaHora(ahora = new Date()) {
        if (window.vendefrioPruebas && window.vendefrioPruebas.resumenNoche === false) return false;
        return ahora.getHours() > HORA || (ahora.getHours() === HORA && ahora.getMinutes() >= MINUTO);
    }

    // Los números del día, con el Cierre.
    function datos() {
        const cierre = window.cierreVendeFrio.calcular(hoy());
        const vendidos = (typeof historialParaLeer === "function" ? historialParaLeer() : []).filter(pedido => {
            if (!pedido || pedido.eliminado === true || pedido.estado === "cancelado") return false;
            const hora = Number(pedido.timestamp) || 0;
            return hora >= hoy();
        });
        const vendido = vendidos.reduce((suma, pedido) => suma + (typeof totalDelPedido === "function" ? Number(totalDelPedido(pedido)?.total || 0) : 0), 0);
        const pendientesEntrega = vendidos.filter(pedido => !["entregado", "historico", "cancelado"].includes(
            typeof estadoActualDelPedido === "function" ? estadoActualDelPedido(pedido) : pedido.estado)).length;
        return {
            pedidos: vendidos.length,
            vendido: Math.round(vendido),
            entregados: cierre.entregados.length,
            cobrado: cierre.totalRecaudado,
            sinEntregar: pendientesEntrega,
            aCobrar: cierre.aCobrar
        };
    }

    function texto(d = datos()) {
        const partes = [
            d.pedidos + (d.pedidos === 1 ? " pedido" : " pedidos"),
            d.entregados + (d.entregados === 1 ? " entregado" : " entregados"),
            "cobraste " + p.plata(d.cobrado)
        ];
        const falta = [];
        if (d.sinEntregar) falta.push(d.sinEntregar + " sin entregar");
        if (d.aCobrar) falta.push(p.plata(d.aCobrar) + " a cobrar");
        return {
            titulo: "Cerró el día: " + p.plata(d.vendido) + " vendidos",
            cuerpo: partes.join(" · ") + "." + (falta.length ? " Quedan " + falta.join(" y ") + "." : " No queda nada pendiente.")
        };
    }

    async function notificar(titulo, cuerpo, tag, tipo) {
        if (!("Notification" in window) || Notification.permission !== "granted" || !navigator.serviceWorker) return false;
        try {
            const registro = await navigator.serviceWorker.ready;
            await registro.showNotification(titulo, {
                body: cuerpo,
                tag,
                icon: "icon-192.png",
                badge: "icon-192.png",
                data: { tipo }
            });
            return true;
        } catch (error) {
            console.warn("No se pudo mostrar la notificación.", error);
            return false;
        }
    }

    let mostrandoAviso = false;
    let forzadoHoy = 0;

    async function revisar(forzar) {
        if (!puedeVer() || !prendido()) {
            if (mostrandoAviso) { p.avisoInicio("avisoResumenNoche", null); mostrandoAviso = false; }
            return;
        }
        const ya = p.lsLeer(CLAVE_DIA, 0);
        if (forzar === true || (esLaHora() && ya < hoy())) {
            const { titulo, cuerpo } = texto();
            p.lsGuardar(CLAVE_DIA, hoy());
            if (forzar === true) forzadoHoy = hoy();
            await notificar(titulo, cuerpo, "resumen-noche", "cierre");
            mostrandoAviso = true;
        }
        // El aviso en Inicio queda hasta medianoche (se ve aunque no haya
        // notificaciones) y siempre con los números al día.
        if (p.lsLeer(CLAVE_DIA, 0) >= hoy() && (esLaHora() || forzadoHoy >= hoy())) {
            const { titulo, cuerpo } = texto();
            p.avisoInicio("avisoResumenNoche", {
                color: "Info",
                icono: "luna",
                titulo,
                texto: cuerpo,
                boton: "Ver cierre",
                claseBoton: "pzBtnSec",
                etiqueta: "Ver cierre del día",
                alTocar: () => window.cierreVendeFrio.abrir()
            }, "arriba");
            mostrandoAviso = true;
        } else if (mostrandoAviso) {
            p.avisoInicio("avisoResumenNoche", null);
            mostrandoAviso = false;
        }
        revisarTopes();
    }

    // Un comercio pasó su tope de deuda: un aviso por comercio y por día.
    function revisarTopes() {
        const saldos = window.saldosVendeFrio;
        if (!saldos || !puedeVer()) return;
        const avisados = p.lsLeer(CLAVE_TOPES, {});
        let cambio = false;
        saldos.cuentas().filter(cuenta => cuenta.pasoTope).forEach(cuenta => {
            const clave = cuenta.nombre.toLocaleLowerCase("es");
            if (Number(avisados[clave]) >= hoy()) return;
            avisados[clave] = Date.now();
            cambio = true;
            notificar("VendeFrío", cuenta.nombre + " pasó su tope de deuda.", "tope-" + clave, "aCobrar");
        });
        if (cambio) p.lsGuardar(CLAVE_TOPES, avisados);
    }

    function abrirSegunTipo(tipo) {
        if (tipo === "cierre") window.cierreVendeFrio?.abrir();
        if (tipo === "aCobrar") window.saldosVendeFrio?.abrirPantalla();
    }

    // Al tocar la notificación.
    navigator.serviceWorker?.addEventListener?.("message", evento => {
        const datos = evento.data;
        if (datos && datos.accion === "abrirAviso" && datos.aviso && !datos.aviso.idAviso) abrirSegunTipo(datos.aviso.tipo);
    });
    try {
        const parametros = new URLSearchParams(window.location.search);
        const tipo = parametros.get("tipo");
        if (tipo && !parametros.has("aviso") && ["cierre", "aCobrar"].includes(tipo)) {
            setTimeout(() => abrirSegunTipo(tipo), 2500);
        }
    } catch (error) { /* nada */ }

    if (typeof window.actualizarDashboard === "function") {
        const original = window.actualizarDashboard;
        window.actualizarDashboard = function () {
            const resultado = original.apply(this, arguments);
            try { revisar(); } catch (error) { console.error("Falló el resumen de la noche.", error); }
            return resultado;
        };
    }
    setInterval(() => { try { revisar(); } catch (error) { /* nada */ } }, 60000);

    window.resumenNocheVendeFrio = { datos, texto, revisar, esLaHora };
}());
