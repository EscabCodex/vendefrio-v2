// =====================================================
// VendeFrío - appAndroid.js
// Lo que hace solo la app de Android (carpeta app-android, con Capacitor).
// En Chrome y en iPhone no hace nada.
// 1) Notificaciones del celular: si llega un aviso con la app en segundo
//    plano (por ejemplo, con la pantalla apagada mientras reparte), sale
//    como notificación de Android, con botones "Ver pedido" y "Marcar leído".
//    Con la app a la vista ya está el aviso emergente de avisos.js.
// 2) GPS en segundo plano: al compartir la ubicación (repartidores.js) se
//    usa el GPS de Android, que sigue andando con la pantalla apagada y
//    muestra la notificación fija "Repartiendo".
// =====================================================
(function () {
    "use strict";

    const cap = window.Capacitor;
    const plugins = (cap && cap.Plugins) || {};
    const esApp = Boolean(cap && typeof cap.getPlatform === "function" && cap.getPlatform() === "android");

    if (!esApp) {
        window.appAndroidVendeFrio = { esApp: false };
        return;
    }
    document.documentElement.classList.add("enAppAndroid");

    const Notificaciones = plugins.LocalNotifications;
    const Gps = plugins.BackgroundGeolocation;
    const CANAL = "avisos";
    const CANAL_REPARTO = "reparto";
    // Mismo número que la notificación fija del GPS: así se reemplaza su
    // texto por el de la parada y queda una sola notificación de reparto.
    const ID_REPARTO = 28351;
    const COLOR = "#0B8A82";
    let preparado = null;

    // ---------- 1) Notificaciones ----------
    function preparar() {
        if (!Notificaciones) return Promise.resolve(false);
        if (preparado) return preparado;
        preparado = (async () => {
            try {
                await Notificaciones.createChannel({
                    id: CANAL, name: "Avisos de pedidos", description: "Pedidos nuevos, faltantes, entregas y cobros",
                    importance: 4, visibility: 1, vibration: true, lights: true, lightColor: COLOR
                });
                await Notificaciones.createChannel({
                    id: CANAL_REPARTO, name: "Reparto en curso", description: "Por qué parada vas", importance: 2, visibility: 1, vibration: false
                });
                await Notificaciones.registerActionTypes({
                    types: [
                        { id: "pedido", actions: [{ id: "ver", title: "Ver pedido" }, { id: "leido", title: "Marcar leído" }] },
                        { id: "cobro", actions: [{ id: "ver", title: "Registrar cobro" }, { id: "leido", title: "Más tarde" }] },
                        { id: "parada", actions: [{ id: "cargar", title: "Cargar pedido" }, { id: "ir", title: "Ir" }] }
                    ]
                });
                Notificaciones.addListener("localNotificationActionPerformed", alTocar);
                const permiso = await Notificaciones.checkPermissions();
                if (permiso.display === "prompt" || permiso.display === "prompt-with-rationale") await Notificaciones.requestPermissions();
                return true;
            } catch (error) {
                console.warn("No se pudieron preparar las notificaciones.", error);
                return false;
            }
        })();
        return preparado;
    }

    // Número corto y estable para cada aviso (Android usa números).
    function numero(texto) {
        let suma = 0;
        for (const letra of String(texto)) suma = (suma * 31 + letra.charCodeAt(0)) | 0;
        return Math.abs(suma) % 2000000000 || 1;
    }

    function esCobro(aviso) {
        return aviso.tipo === "entregado" && /cobro pendiente/i.test(String(aviso.detalle || ""));
    }

    // avisos.js la llama con los avisos que llegaron recién.
    async function avisosNuevos(lista, datosDelTipo, nombrePersona) {
        if (!Notificaciones || !Array.isArray(lista) || !lista.length) return;
        if (document.visibilityState !== "hidden") return;
        if (!(await preparar())) return;

        const nombre = typeof nombrePersona === "function" ? nombrePersona : persona => (persona && persona.nombre) || "";
        const notificaciones = lista.slice(0, 6).map(aviso => {
            const tipo = typeof datosDelTipo === "function" ? datosDelTipo(aviso.tipo) : { nombre: "Aviso", hecho: "Por" };
            const quien = nombre(aviso.persona);
            const texto = (tipo.hecho || "Por") + (quien ? " " + quien : "") + (aviso.detalle ? ": " + aviso.detalle : "");
            return {
                id: numero(aviso.id),
                channelId: CANAL,
                title: tipo.nombre + (aviso.comercio ? " · " + aviso.comercio : ""),
                body: texto,
                largeBody: texto,
                smallIcon: "ic_stat_copo",
                iconColor: COLOR,
                actionTypeId: esCobro(aviso) ? "cobro" : (aviso.tipo === "rolPendiente" ? "" : "pedido"),
                autoCancel: true,
                extra: { idAviso: String(aviso.id || ""), idPedido: String(aviso.idPedido || ""), tipo: String(aviso.tipo || "") }
            };
        });
        try {
            await Notificaciones.schedule({ notifications: notificaciones });
        } catch (error) {
            console.warn("No se pudo mostrar la notificación.", error);
        }
    }

    // Espera a que los avisos y los pedidos lleguen de la nube y abre el pedido.
    function abrirPedido(idAviso, idPedido, tipo) {
        let intentos = 0;
        const probar = () => {
            intentos += 1;
            const avisos = window.avisosVendeFrio;
            const listo = Boolean(avisos && avisos.disponible && avisos.disponible() && avisos.estado() === "listo");
            if (listo && tipo === "rolPendiente") {
                avisos.marcarLeido?.(idAviso);
                window.abrirConfiguracionEn?.("empleados");
                return;
            }
            if (listo && idPedido && window.seguimientoVendeFrio?.abrirPedido?.(idPedido)) {
                avisos.marcarLeido?.(idAviso);
                return;
            }
            if (intentos < 60) setTimeout(probar, 250);
            else if (typeof mostrarToast === "function") mostrarToast("Ese pedido ya no está en Pedidos");
        };
        probar();
    }

    function alTocar(evento) {
        const notificacion = (evento && evento.notification) || {};
        const datos = notificacion.extra || {};
        const accion = evento && evento.actionId;
        const avisos = window.avisosVendeFrio;

        if (datos.parada) {
            tocarParada(accion, datos);
            return;
        }
        if (accion === "leido") {
            avisos?.marcarLeido?.(datos.idAviso);
            return;
        }
        abrirPedido(datos.idAviso, datos.idPedido, datos.tipo);
    }

    // Al volver a la app, se sacan las notificaciones que ya se ven adentro.
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && Notificaciones) {
            Notificaciones.getDeliveredNotifications?.().then(r => {
                const viejas = (r && r.notifications || []).filter(n => Number(n.id) !== ID_REPARTO);
                if (viejas.length) return Notificaciones.removeDeliveredNotifications({ notifications: viejas });
            }).catch(() => {});
        }
    });

    // ---------- Notificación de reparto: por qué parada vas ----------
    let ultimaParada = "";

    function distanciaTexto(metros) {
        if (!Number.isFinite(metros)) return "";
        return metros < 1000 ? Math.max(10, Math.round(metros / 10) * 10) + " m" : (metros / 1000).toFixed(1).replace(".", ",") + " km";
    }

    // repartidores.js la llama con cada posición: { hechas, total, destino, lat, lng }.
    async function reparto(datos) {
        if (!Notificaciones) return;
        if (!datos) {
            ultimaParada = "";
            Notificaciones.cancel({ notifications: [{ id: ID_REPARTO }] }).catch(() => {});
            return;
        }
        if (!(await preparar())) return;
        const total = Math.max(0, Number(datos.total) || 0);
        const numeroParada = Math.min(total, (Number(datos.hechas) || 0) + 1);
        const destino = datos.destino || null;
        const nombre = destino && destino.nombre ? String(destino.nombre) : "";
        let metros = NaN;
        if (destino && destino.lat !== "" && Number.isFinite(Number(destino.lat)) && window.pruebaEntregaVendeFrio) {
            metros = window.pruebaEntregaVendeFrio.distanciaMetros(datos.lat, datos.lng, Number(destino.lat), Number(destino.lng));
        }
        const titulo = total ? "Parada " + numeroParada + " de " + total + (nombre ? " · " + nombre : "") : "Repartiendo";
        const texto = [destino && destino.direccion ? String(destino.direccion) : "", metros <= 80 ? "Llegaste" : distanciaTexto(metros)].filter(Boolean).join(" · ") || "En camino";
        const clave = titulo + "|" + texto;
        if (clave === ultimaParada) return;
        ultimaParada = clave;
        try {
            await Notificaciones.schedule({
                notifications: [{
                    id: ID_REPARTO,
                    channelId: CANAL_REPARTO,
                    title: titulo,
                    body: texto,
                    smallIcon: "ic_stat_copo",
                    iconColor: COLOR,
                    ongoing: true,
                    autoCancel: false,
                    actionTypeId: nombre ? "parada" : "",
                    extra: { parada: "1", comercio: nombre }
                }]
            });
        } catch (error) {
            console.warn("No se pudo mostrar la parada.", error);
        }
    }

    function tocarParada(accion, datos) {
        const nombre = String(datos.comercio || "");
        const navegacion = window.navegacionVendeFrio;
        if (accion === "cargar" && nombre) {
            // El pedido se carga con ese comercio elegido; al guardarlo queda
            // a mano "Deslizá para Entregado".
            if (navegacion?.abierta?.() && navegacion.minimizada?.()) navegacion.restaurar?.();
            if (typeof window.abrirPedidoEnHoja === "function") window.abrirPedidoEnHoja(nombre);
            else if (typeof window.irAPedidoRapido === "function") window.irAPedidoRapido(nombre);
            return;
        }
        if (accion === "ir" && nombre) {
            if (navegacion?.abierta?.()) navegacion.restaurar?.();
            else navegacion?.abrir?.([nombre]);
            return;
        }
        // Tocar la notificación: vuelve a la navegación si estaba abierta.
        if (navegacion?.abierta?.() && navegacion.minimizada?.()) navegacion.restaurar?.();
    }

    // ---------- 2) GPS en segundo plano ----------
    // Devuelve un número para dejar de vigilar con dejarDeVigilar().
    const vigilancias = new Map();
    let siguiente = 1;

    function vigilarUbicacion(alMoverse, alFallar) {
        if (!Gps) return null;
        const clave = siguiente++;
        vigilancias.set(clave, null);
        Gps.addWatcher({
            backgroundTitle: "Repartiendo",
            backgroundMessage: "Buscando por qué parada vas…",
            requestPermissions: true,
            stale: false,
            distanceFilter: 15
        }, (lugar, error) => {
            if (error) {
                if (error.code === "NOT_AUTHORIZED" && typeof mostrarToast === "function") {
                    mostrarToast("Falta el permiso de ubicación: activalo en Ajustes");
                }
                if (typeof alFallar === "function") alFallar(error);
                return;
            }
            if (!lugar || typeof alMoverse !== "function") return;
            alMoverse({
                coords: {
                    latitude: lugar.latitude,
                    longitude: lugar.longitude,
                    accuracy: lugar.accuracy,
                    speed: lugar.speed,
                    heading: lugar.bearing
                },
                timestamp: lugar.time || Date.now()
            });
        }).then(id => {
            if (vigilancias.has(clave)) vigilancias.set(clave, id);
            else Gps.removeWatcher({ id }).catch(() => {});
        }).catch(error => {
            vigilancias.delete(clave);
            if (typeof alFallar === "function") alFallar(error);
        });
        return clave;
    }

    function dejarDeVigilar(clave) {
        if (!vigilancias.has(clave)) return;
        const id = vigilancias.get(clave);
        vigilancias.delete(clave);
        if (id && Gps) Gps.removeWatcher({ id }).catch(() => {});
    }

    window.appAndroidVendeFrio = {
        esApp: true,
        avisosNuevos,
        vigilarUbicacion: Gps ? vigilarUbicacion : null,
        reparto,
        dejarDeVigilar
    };

    // Se prepara al rato de abrir (pide el permiso de notificaciones en Android 13 o más nuevo).
    setTimeout(preparar, 4000);
})();
