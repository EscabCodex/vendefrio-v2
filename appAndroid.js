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
                await Notificaciones.registerActionTypes({
                    types: [
                        { id: "pedido", actions: [{ id: "ver", title: "Ver pedido" }, { id: "leido", title: "Marcar leído" }] },
                        { id: "cobro", actions: [{ id: "ver", title: "Registrar cobro" }, { id: "leido", title: "Más tarde" }] },
                        { id: "varios", actions: [{ id: "lista", title: "Ver avisos" }, { id: "leidos", title: "Marcar leídos" }] }
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
                group: "vendefrio",
                smallIcon: "ic_stat_copo",
                iconColor: COLOR,
                actionTypeId: esCobro(aviso) ? "cobro" : (aviso.tipo === "rolPendiente" ? "" : "pedido"),
                autoCancel: true,
                extra: { idAviso: String(aviso.id || ""), idPedido: String(aviso.idPedido || ""), tipo: String(aviso.tipo || "") }
            };
        });
        if (lista.length > 1) {
            notificaciones.push({
                id: 7,
                channelId: CANAL,
                title: lista.length + " avisos nuevos",
                body: "Tocá para verlos",
                group: "vendefrio",
                groupSummary: true,
                smallIcon: "ic_stat_copo",
                iconColor: COLOR,
                actionTypeId: "varios",
                extra: { lista: "1" }
            });
        }
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

        if (datos.lista) {
            if (accion === "leidos") {
                // Marca leídos solo los que avisó esta notificación agrupada.
                Notificaciones.getDeliveredNotifications?.().then(r => {
                    (r && r.notifications || []).forEach(n => n.extra && n.extra.idAviso && avisos?.marcarLeido?.(n.extra.idAviso));
                    Notificaciones.removeAllDeliveredNotifications?.();
                }).catch(() => {});
                return;
            }
            avisos?.abrirLista?.();
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
            Notificaciones.removeAllDeliveredNotifications?.().catch?.(() => {});
        }
    });

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
            backgroundMessage: "Compartiendo tu ubicación con el dueño. Tocá para volver a VendeFrío.",
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
        dejarDeVigilar
    };

    // Se prepara al rato de abrir (pide el permiso de notificaciones en Android 13 o más nuevo).
    setTimeout(preparar, 4000);
})();
