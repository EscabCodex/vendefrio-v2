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
// 3) Navegación en la notificación: con la navegación abierta, la
//    notificación fija muestra la indicación, la parada, la hora de llegada,
//    una barra por paradas hechas y los botones "Cargar pedido" y "Sin pedido".
// 4) "Estoy repartiendo" (el switch de Inicio): una notificación fija con el
//    día de un vistazo (cobrado, te deben, cargado, horas) y "Cargar pedido"
//    para el comercio más cerca. Al navegar pasa a ser la de la navegación.
// El color es el de Apariencia.
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
    // Propio de la app (MainActivity): la notificación con barra y botones.
    const Reparto = plugins.NotificacionReparto;
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
                        { id: "parada", actions: [{ id: "cargar", title: "Cargar pedido" }, { id: "sinPedido", title: "Sin pedido" }] }
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
        if (!Notificaciones || navegando || enReparto) return;
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
            if (navegacion?.abierta?.()) {
                if (navegacion.minimizada?.()) navegacion.restaurar?.();
                if (navegacion.cargarPedido && !navegacion.pedidoEncima?.()) {
                    navegacion.cargarPedido(nombre);
                    return;
                }
            }
            if (typeof window.abrirPedidoEnHoja === "function") window.abrirPedidoEnHoja(nombre);
            else if (typeof window.irAPedidoRapido === "function") window.irAPedidoRapido(nombre);
            return;
        }
        if (accion === "sinPedido" && nombre) {
            // Visitado sin pedido: con la navegación abierta pasa a la que
            // sigue; si no, queda marcado y la notificación sigue con la próxima.
            if (navegacion?.abierta?.()) (navegacion.sinPedido || navegacion.siguiente)?.();
            else if (typeof window.marcarVisitaManual === "function") window.marcarVisitaManual(nombre);
            return;
        }
        // Tocar la notificación: vuelve a la navegación si estaba abierta.
        if (navegacion?.abierta?.() && navegacion.minimizada?.()) navegacion.restaurar?.();
    }

    // ---------- 3) Navegación en la notificación ----------
    // navegacion.js la llama con cada indicación nueva:
    // { distancia, texto, tipo, grados, parada, total, comercio, llegada }.
    // Con null (al terminar) se saca.
    let navegando = false;
    let ultimaNavegacion = "";
    let ultimaComercio = "";

    function colorDeLaApp() {
        try {
            const color = getComputedStyle(document.documentElement).getPropertyValue("--acento").trim();
            return /^#[0-9a-f]{6}$/i.test(color) ? color : COLOR;
        } catch (error) {
            return COLOR;
        }
    }

    function partirIndicacion(texto) {
        const corte = texto.lastIndexOf(" por ");
        if (corte <= 0) return [texto, ""];
        return [texto.slice(0, corte), texto.slice(corte + 1)];
    }

    async function navegacion(datos) {
        if (!datos) {
            if (!navegando) return;
            navegando = false;
            ultimaNavegacion = "";
            ultimaParada = "";
            if (enReparto) {
                ultimoPanel = "";
                panel();
                return;
            }
            if (Reparto) Reparto.quitar().catch(() => {});
            else if (Notificaciones) Notificaciones.cancel({ notifications: [{ id: ID_REPARTO }] }).catch(() => {});
            return;
        }
        navegando = true;
        const total = Math.max(1, Number(datos.total) || 1);
        const parada = Math.min(total, Math.max(1, Number(datos.parada) || 1));
        const [accion, calle] = partirIndicacion(String(datos.texto || ""));
        const titulo = [datos.distancia, accion].filter(Boolean).join(" · ") || "Navegando";
        const detalle = [total > 1 ? "Parada " + parada + " de " + total : "", datos.comercio, datos.llegada ? "llegás " + datos.llegada : ""].filter(Boolean).join(" · ");
        const flecha = datos.tipo === "arrive" ? "llegada" : String(datos.tipo || "").includes("round") ? "rotonda" : "giro";
        const clave = [titulo, calle, detalle, flecha, datos.grados].join("|");
        if (clave === ultimaNavegacion) return;
        ultimaNavegacion = clave;
        ultimaComercio = String(datos.comercio || "");
        try {
            if (Reparto) {
                await Reparto.mostrar({ titulo, texto: calle, detalle, hechas: parada - 1, total, flecha, grados: Math.round(Number(datos.grados) || 0), botones: Boolean(datos.comercio), sinPedido: true, color: colorDeLaApp() });
                return;
            }
            // APK viejo, sin la notificación propia: sin barra.
            if (!Notificaciones || !(await preparar())) return;
            await Notificaciones.schedule({
                notifications: [{
                    id: ID_REPARTO, channelId: CANAL_REPARTO, title: titulo, body: [calle, detalle].filter(Boolean).join(" · "),
                    smallIcon: "ic_stat_copo", iconColor: COLOR, ongoing: true, autoCancel: false,
                    actionTypeId: datos.comercio ? "parada" : "", extra: { parada: "1", comercio: ultimaComercio }
                }]
            });
        } catch (error) {
            console.warn("No se pudo mostrar la navegación.", error);
        }
    }

    // Los botones de la notificación propia (Cargar pedido, Sin pedido) y tocarla.
    if (Reparto && typeof Reparto.addListener === "function") {
        Reparto.addListener("accion", evento => {
            const accion = evento && evento.accion;
            const nombre = window.navegacionVendeFrio?.paradaActual?.()?.nombre || ultimaComercio;
            tocarParada(accion === "abrir" ? "" : accion, { comercio: nombre });
        });
    }

    // ---------- 4) "Estoy repartiendo" ----------
    let enReparto = null;   // { desde, vigia, lugar, reloj }
    let ultimoPanel = "";

    function plataCorta(valor) {
        const numero = Math.round(Number(valor) || 0);
        if (numero >= 1000000) return "$ " + (numero / 1000000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " M";
        if (numero >= 10000) return "$ " + Math.round(numero / 1000).toLocaleString("es-AR") + " mil";
        return "$ " + numero.toLocaleString("es-AR");
    }

    function horasDesde(desde) {
        const minutos = Math.max(0, Math.round((Date.now() - desde) / 60000));
        return minutos < 60 ? minutos + " min" : Math.floor(minutos / 60) + " h " + (minutos % 60) + " min";
    }

    // Lo del día, con las mismas cuentas que Inicio. Lo que no se puede
    // saber (sin permiso para ver la plata, por ejemplo) no se muestra.
    function datosDelDia() {
        const datos = { cobrado: null, deben: null, cargado: null, pedidos: 0 };
        try {
            if (typeof window.cobradoHoyInicio === "function" && window.cierreVendeFrio?.disponible?.()) datos.cobrado = window.cobradoHoyInicio();
        } catch (error) { /* sin dato */ }
        try {
            const deudas = window.saldosVendeFrio?.resumenDeudas?.();
            if (deudas) datos.deben = deudas.total;
        } catch (error) { /* sin dato */ }
        try {
            if (typeof window.historialParaLeer === "function" && typeof window.esDeHoyInicio === "function") {
                const deHoy = window.historialParaLeer().filter(window.esDeHoyInicio);
                datos.pedidos = deHoy.length;
                if (typeof window.totalInicio === "function") datos.cargado = deHoy.reduce((suma, pedido) => suma + window.totalInicio(pedido), 0);
            }
        } catch (error) { /* sin dato */ }
        return datos;
    }

    // El comercio con ubicación más cerca de donde estás (hasta 300 m).
    function comercioCercano(lugar) {
        if (!lugar || typeof window.obtenerComercios !== "function" || !window.pruebaEntregaVendeFrio) return "";
        let mejor = null;
        try {
            for (const comercio of window.obtenerComercios() || []) {
                const lat = Number(comercio && comercio.lat);
                const lng = Number(comercio && comercio.lng);
                if (!comercio || comercio.lat === "" || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
                const metros = window.pruebaEntregaVendeFrio.distanciaMetros(lugar[0], lugar[1], lat, lng);
                if (metros <= 300 && (!mejor || metros < mejor.metros)) mejor = { nombre: comercio.nombre, metros };
            }
        } catch (error) {
            return "";
        }
        return mejor ? String(mejor.nombre || "") : "";
    }

    async function panel() {
        if (!enReparto || navegando) return;
        const dia = datosDelDia();
        const cercano = comercioCercano(enReparto.lugar);
        const plata = [
            dia.cobrado !== null ? "Cobrado " + plataCorta(dia.cobrado) : "",
            dia.deben !== null ? "Te deben " + plataCorta(dia.deben) : ""
        ].filter(Boolean).join(" · ");
        const titulo = plata || "Repartiendo";
        const cargado = dia.pedidos ? dia.pedidos + (dia.pedidos === 1 ? " pedido" : " pedidos") + (dia.cargado !== null ? " cargados por " + plataCorta(dia.cargado) : " cargados") : "Sin pedidos cargados hoy";
        const texto = cercano ? "Estás en " + cercano : cargado;
        const hora = new Date(enReparto.desde).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
        const detalle = (cercano ? cargado + " · " : "") + "Repartiendo desde las " + hora + " (" + horasDesde(enReparto.desde) + ")";
        const clave = [titulo, texto, detalle, cercano].join("|");
        if (clave === ultimoPanel) return;
        ultimoPanel = clave;
        ultimaComercio = cercano;
        try {
            if (Reparto) {
                await Reparto.mostrar({ titulo, texto, detalle, hechas: 0, total: 0, flecha: "ninguna", grados: 0, botones: Boolean(cercano), sinPedido: false, color: colorDeLaApp() });
                return;
            }
            if (!Notificaciones || !(await preparar())) return;
            await Notificaciones.schedule({
                notifications: [{
                    id: ID_REPARTO, channelId: CANAL_REPARTO, title: titulo, body: texto + " · " + detalle,
                    smallIcon: "ic_stat_copo", iconColor: COLOR, ongoing: true, autoCancel: false,
                    actionTypeId: cercano ? "parada" : "", extra: { parada: "1", comercio: cercano }
                }]
            });
        } catch (error) {
            console.warn("No se pudo mostrar el resumen del reparto.", error);
        }
    }

    // Inicio la llama al prender (true) o apagar (false) "Estoy repartiendo".
    function repartiendo(prendido, desde) {
        if (!prendido) {
            if (!enReparto) return;
            clearInterval(enReparto.reloj);
            if (enReparto.vigia !== null) dejarDeVigilar(enReparto.vigia);
            enReparto = null;
            ultimoPanel = "";
            if (navegando) return;
            if (Reparto) Reparto.quitar().catch(() => {});
            else if (Notificaciones) Notificaciones.cancel({ notifications: [{ id: ID_REPARTO }] }).catch(() => {});
            return;
        }
        if (enReparto) {
            panel();
            return;
        }
        enReparto = { desde: Number(desde) || Date.now(), vigia: null, lugar: null, reloj: null };
        // El GPS de Android deja la notificación fija (no se saca deslizando)
        // y dice qué comercio tenés al lado.
        if (Gps) {
            enReparto.vigia = vigilarUbicacion(lugar => {
                if (!enReparto) return;
                enReparto.lugar = [lugar.coords.latitude, lugar.coords.longitude];
                panel();
            }, null, { titulo: "Repartiendo", texto: "Tu día de un vistazo", cadaMetros: 30 });
        }
        enReparto.reloj = setInterval(panel, 60000);
        panel();
    }

    // ---------- 2) GPS en segundo plano ----------
    // Devuelve un número para dejar de vigilar con dejarDeVigilar().
    const vigilancias = new Map();
    let siguiente = 1;

    function vigilarUbicacion(alMoverse, alFallar, opciones) {
        const elegidas = opciones || {};
        if (!Gps) return null;
        const clave = siguiente++;
        vigilancias.set(clave, null);
        Gps.addWatcher({
            backgroundTitle: elegidas.titulo || "Repartiendo",
            backgroundMessage: elegidas.texto || "Buscando por qué parada vas…",
            requestPermissions: true,
            stale: false,
            distanceFilter: Number.isFinite(elegidas.cadaMetros) ? elegidas.cadaMetros : 15
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
        navegacion,
        repartiendo,
        dejarDeVigilar
    };

    // Se prepara al rato de abrir (pide el permiso de notificaciones en Android 13 o más nuevo).
    setTimeout(preparar, 4000);
})();
