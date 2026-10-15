// =====================================================
// VendeFrío - notificaciones.js
// Notificaciones con la app cerrada (T29). Solo en la nube (con cuenta o con
// código): el modo personal no tiene avisos.
// - Configuración > Avisos, "Activar notificaciones en este celular": pide
//   el permiso y guarda la dirección del celular para Firebase Cloud
//   Messaging (el "token") en distribuidoras/{id}/celulares/{idCelular}.
//   Vale solo para este celular. En iPhone hace falta la app instalada en la
//   pantalla de inicio y iOS 16.4 o más nuevo.
// - Qué avisos suenan con la app cerrada: por persona, en
//   preferenciasNotificaciones/{idPersona} ({ silenciados }), así vale en
//   cualquier celular. Un aviso apagado en "Qué avisos recibís" tampoco suena.
// - Cuando avisos.js deja un aviso (y la nube lo guardó), le pide a la
//   función de Vercel (api/notificar.js) que mande la notificación. La
//   función revisa todo de nuevo en la nube antes de mandar.
// - Al tocar la notificación, sw.js abre la app (o la trae al frente) y acá
//   se abre el pedido del aviso.
// - Al salir de la cuenta, el celular borra su token y deja de recibirlas.
// =====================================================

(function () {
    // Clave pública para notificaciones web (M8). Es pública: identifica el
    // proyecto, no da acceso.
    const CLAVE_PUBLICA_WEB = "BLvD0Suwu-QRGQaHNRE6vKEiUgiIK8w64Ecea2f6Ie2KttEkywmDW6-3fH8uKfvL5kISEIcdggc54j0-hwIcs4w";
    const FUNCION = "/api/notificar";
    // { uid, idDistribuidora, idPersona, idCelular, token, actualizado }:
    // qué cuenta activó las notificaciones en este celular.
    const CLAVE_CELULAR = "vendefrio_notificaciones";
    const ESPERA = 10000;
    const ESPERA_AL_SALIR = 5000;
    // El token se vuelve a guardar en la nube una vez por semana, aunque no
    // cambie, para que la nube sepa que el celular sigue usándose.
    const RENOVAR_CADA = 7 * 24 * 60 * 60 * 1000;

    // Quién usa este celular: { idPersona, uid, idDistribuidora } o null.
    let yo = null;
    let activando = false;
    let ultimoError = "";
    let silenciados = new Set();
    let quitarEscucha = null;
    const oyentes = [];

    // -------------------------------------------------
    // Utilidades
    // -------------------------------------------------

    function obtenerFirestore() {
        try {
            if (window.firebase && window.firebase.apps.length && window.firebase.firestore) {
                return window.firebase.firestore();
            }
        } catch (error) {
            console.error("Firestore no está disponible.", error);
        }
        return null;
    }

    function conLimite(promesa, milisegundos, texto) {
        let temporizador;
        const limite = new Promise((resolver, rechazar) => {
            temporizador = setTimeout(() => rechazar(new Error(texto)), milisegundos);
        });
        return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
    }

    function leerGuardado() {
        try {
            const guardado = JSON.parse(localStorage.getItem(CLAVE_CELULAR) || "null");
            return guardado && typeof guardado === "object" ? guardado : null;
        } catch (error) {
            return null;
        }
    }

    function escribirGuardado(datos) {
        try {
            localStorage.setItem(CLAVE_CELULAR, JSON.stringify(datos));
        } catch (error) {
            console.warn("No se pudo guardar el estado de las notificaciones.", error);
        }
    }

    function esIphone() {
        const agente = navigator.userAgent || "";
        return /iPhone|iPad|iPod/i.test(agente) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    }

    function estaInstalada() {
        return window.navigator.standalone === true ||
            Boolean(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    }

    function sePuede() {
        try {
            return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window &&
                Boolean(window.firebase) && typeof window.firebase.messaging === "function" &&
                (typeof window.firebase.messaging.isSupported !== "function" || window.firebase.messaging.isSupported() === true);
        } catch (error) {
            return false;
        }
    }

    function plataforma() {
        if (esIphone()) return "iphone";
        if (/Android/i.test(navigator.userAgent || "")) return "android";
        return "otro";
    }

    function refDistribuidora(idDistribuidora) {
        const db = obtenerFirestore();
        return db && idDistribuidora ? db.collection("distribuidoras").doc(idDistribuidora) : null;
    }

    // Activado en este celular para esta cuenta.
    function guardadoDeEstaCuenta() {
        const guardado = leerGuardado();
        return yo && guardado && guardado.uid === yo.uid && guardado.idDistribuidora === yo.idDistribuidora ? guardado : null;
    }

    function avisarCambio() {
        oyentes.forEach(oyente => {
            try {
                oyente();
            } catch (error) {
                console.error("Falló un aviso de las notificaciones.", error);
            }
        });
    }

    function textoDeError(error) {
        const codigo = String(error && error.code || "");
        if (codigo === "permission-denied") {
            return "La nube no dejó guardar este celular. Si sos el dueño, revisá que las reglas nuevas estén publicadas en Firebase.";
        }
        if (codigo.includes("permission-blocked") || codigo.includes("permission-default")) {
            return "Hace falta permitir las notificaciones.";
        }
        return String(error && error.message || "Probá de nuevo en unos segundos.");
    }

    // -------------------------------------------------
    // Estado en este celular
    // -------------------------------------------------

    // "instalarIphone", "noSePuede", "bloqueadas", "activando", "activadas"
    // o "apagadas".
    function estado() {
        if (esIphone() && !estaInstalada()) return "instalarIphone";
        if (!sePuede()) return "noSePuede";
        if (Notification.permission === "denied") return "bloqueadas";
        if (activando) return "activando";

        const guardado = guardadoDeEstaCuenta();
        if (guardado && guardado.token && Notification.permission === "granted") return "activadas";
        return "apagadas";
    }

    async function registroDelServiceWorker() {
        let registro = await navigator.serviceWorker.getRegistration();
        if (!registro) registro = await navigator.serviceWorker.register("sw.js");
        // Firebase necesita el service worker ya activo.
        return conLimite(navigator.serviceWorker.ready, ESPERA, "La app todavía no está lista para recibirlas. Cerrala, volvé a abrirla y probá de nuevo.");
    }

    async function pedirToken() {
        const registro = await registroDelServiceWorker();
        const token = await conLimite(
            window.firebase.messaging().getToken({ vapidKey: CLAVE_PUBLICA_WEB, serviceWorkerRegistration: registro }),
            ESPERA,
            "No se pudo conectar con el servicio de notificaciones. Revisá la señal y probá de nuevo."
        );
        if (!token) throw new Error("No se pudo conectar con el servicio de notificaciones.");
        return String(token);
    }

    // Guarda el token en la nube, a nombre de quien usa el celular. Sin
    // señal queda en el celular y sube al volver.
    async function guardarCelular(token) {
        const ref = refDistribuidora(yo.idDistribuidora);
        if (!ref) throw new Error("La nube no está disponible en este momento.");

        const anterior = guardadoDeEstaCuenta();
        const idCelular = anterior && anterior.idCelular ? anterior.idCelular : generarId("cel");
        const datos = {
            idPersona: yo.idPersona,
            uid: yo.uid,
            token,
            plataforma: plataforma(),
            actualizado: Date.now()
        };

        try {
            await conLimite(ref.collection("celulares").doc(idCelular).set(datos), ESPERA, "sin señal");
        } catch (error) {
            if (error && error.message === "sin señal") {
                console.warn("El celular quedó para subir a la nube cuando vuelva la señal.");
            } else {
                throw error;
            }
        }

        escribirGuardado({
            uid: yo.uid,
            idDistribuidora: yo.idDistribuidora,
            idPersona: yo.idPersona,
            idCelular,
            token,
            actualizado: datos.actualizado
        });
    }

    async function activar() {
        if (!yo) throw new Error("Las notificaciones son para el equipo: entrá con tu cuenta o con el código de tu encargado.");
        if (activando || !sePuede()) return estado();

        activando = true;
        ultimoError = "";
        avisarCambio();

        try {
            const permiso = await Notification.requestPermission();
            if (permiso === "granted") {
                if (!navigator.onLine) throw new Error("Hace falta internet para activarlas.");
                const token = await pedirToken();
                await guardarCelular(token);
                if (typeof mostrarToast === "function") mostrarToast("Notificaciones activadas en este celular");
            } else if (permiso !== "denied") {
                ultimoError = "Hace falta tocar «Permitir» cuando el celular lo pregunta.";
            }
        } catch (error) {
            console.warn("No se pudieron activar las notificaciones.", error);
            ultimoError = textoDeError(error);
        } finally {
            activando = false;
            avisarCambio();
        }

        return estado();
    }

    // Borra el token de la nube y del servicio de notificaciones. Nunca
    // falla: sin señal, lo que no se pudo borrar queda (la función igual
    // revisa que la cuenta siga siendo del equipo antes de mandar).
    async function olvidarEsteCelular() {
        const guardado = leerGuardado();
        if (!guardado || !guardado.token) return;

        escribirGuardado({ ...guardado, token: "" });

        const tareas = [];
        const ref = refDistribuidora(guardado.idDistribuidora);
        const usuario = window.firebase?.auth?.().currentUser;
        if (ref && guardado.idCelular && usuario && usuario.uid === guardado.uid) {
            tareas.push(ref.collection("celulares").doc(guardado.idCelular).delete());
        }
        if (sePuede()) {
            try {
                tareas.push(window.firebase.messaging().deleteToken());
            } catch (error) {
                console.warn("No se pudo borrar el token de notificaciones.", error);
            }
        }

        try {
            await conLimite(Promise.allSettled(tareas), ESPERA_AL_SALIR, "tardó demasiado");
        } catch (error) {
            console.warn("No se terminó de borrar este celular de las notificaciones.", error);
        }
        avisarCambio();
    }

    async function desactivar() {
        await olvidarEsteCelular();
        if (typeof mostrarToast === "function") mostrarToast("Notificaciones desactivadas en este celular");
    }

    // Al abrir la app: si el token cambió (o pasó una semana), se vuelve a
    // guardar; si se quitó el permiso, se borra el celular de la nube.
    async function revisarAlAbrir() {
        const guardado = guardadoDeEstaCuenta();
        if (!guardado || !guardado.token || !sePuede()) return;

        if (Notification.permission !== "granted") {
            await olvidarEsteCelular();
            return;
        }
        if (!navigator.onLine) return;

        try {
            const token = await pedirToken();
            if (!yo) return;
            const vencido = Date.now() - (Number(guardado.actualizado) || 0) > RENOVAR_CADA;
            if (token !== guardado.token || guardado.idPersona !== yo.idPersona || vencido) {
                await guardarCelular(token);
            }
        } catch (error) {
            console.warn("No se pudo renovar el token de notificaciones.", error);
        }
        avisarCambio();
    }

    // -------------------------------------------------
    // Qué avisos suenan con la app cerrada (por persona)
    // -------------------------------------------------

    function suena(tipo) {
        return !silenciados.has(tipo);
    }

    function cambiarSuena(tipo, sonar) {
        if (!yo) return Promise.reject(new Error("Las notificaciones todavía no están listas."));
        const tipos = (window.avisosVendeFrio?.tipos?.() || []).map(item => item.id);
        if (!tipos.includes(tipo)) return Promise.reject(new Error("Ese aviso no existe."));

        const lista = new Set(silenciados);
        if (sonar) lista.delete(tipo);
        else lista.add(tipo);
        silenciados = lista;
        avisarCambio();

        refDistribuidora(yo.idDistribuidora).collection("preferenciasNotificaciones").doc(yo.idPersona)
            .set({ silenciados: Array.from(lista).slice(0, 20) })
            .catch(error => {
                console.warn("No se guardó qué avisos suenan.", error);
                if (typeof mostrarAviso === "function") {
                    mostrarAviso("No se guardó el cambio", "Probá de nuevo en unos segundos.");
                }
            });

        return Promise.resolve();
    }

    // -------------------------------------------------
    // Mandar: lo llama avisos.js cuando la nube guardó un aviso
    // -------------------------------------------------

    async function avisoDejado(idAviso, para) {
        if (!yo || !idAviso || !Array.isArray(para) || !para.length) return;

        try {
            const usuario = window.firebase?.auth?.().currentUser;
            if (!usuario || usuario.uid !== yo.uid) return;

            const credencial = await usuario.getIdToken();
            const respuesta = await fetch(FUNCION, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + credencial },
                body: JSON.stringify({ idDistribuidora: yo.idDistribuidora, idAviso: String(idAviso), para }),
                keepalive: true
            });
            if (!respuesta.ok) console.warn("La función de notificaciones respondió " + respuesta.status + ".");
        } catch (error) {
            console.warn("No se pudo pedir la notificación.", error);
        }
    }

    // -------------------------------------------------
    // Al tocar la notificación: abrir el pedido del aviso
    // -------------------------------------------------

    function abrirDesdeNotificacion(datos) {
        const idAviso = String(datos && datos.idAviso || "");
        const idPedido = String(datos && datos.idPedido || "");
        const tipo = String(datos && datos.tipo || "");
        if (!idAviso) return;

        // Al abrir la app desde cero, los avisos y los pedidos tardan un
        // poco en llegar de la nube.
        let intentos = 0;
        const probar = () => {
            intentos += 1;
            const avisos = window.avisosVendeFrio;
            const listo = Boolean(yo && avisos && avisos.disponible() && avisos.estado() === "listo");

            if (listo && tipo === "rolPendiente") {
                avisos.marcarLeido?.(idAviso);
                if (typeof window.abrirConfiguracionEn === "function") window.abrirConfiguracionEn("empleados");
                return;
            }
            if (listo && idPedido && window.seguimientoVendeFrio?.abrirPedido?.(idPedido)) {
                avisos.marcarLeido?.(idAviso);
                return;
            }
            if (intentos < 60) {
                setTimeout(probar, 250);
                return;
            }
            if (yo && typeof mostrarToast === "function") mostrarToast("Ese pedido ya no está en Pedidos");
        };
        probar();
    }

    // La app se abrió tocando una notificación: index.html?aviso=…&pedido=…
    function abrirLoDeLaDireccion() {
        let parametros;
        try {
            parametros = new URLSearchParams(window.location.search);
        } catch (error) {
            return;
        }
        if (!parametros.has("aviso")) return;

        const datos = { idAviso: parametros.get("aviso"), idPedido: parametros.get("pedido") || "", tipo: parametros.get("tipo") || "" };
        ["aviso", "pedido", "tipo"].forEach(clave => parametros.delete(clave));
        const resto = parametros.toString();
        try {
            window.history.replaceState(null, "", window.location.pathname + (resto ? "?" + resto : "") + window.location.hash);
        } catch (error) {
            console.warn("No se pudo limpiar la dirección.", error);
        }
        abrirDesdeNotificacion(datos);
    }

    // -------------------------------------------------
    // Arranque: cuando se sabe quién usa el celular
    // -------------------------------------------------

    function apagar() {
        if (quitarEscucha) quitarEscucha();
        quitarEscucha = null;
        yo = null;
        silenciados = new Set();
        ultimoError = "";
        avisarCambio();
    }

    function arrancar() {
        const quien = window.empleadosVendeFrio?.quienSoy?.();
        const guardado = typeof obtenerModoNubeGuardado === "function" ? obtenerModoNubeGuardado() : null;
        const db = obtenerFirestore();

        const valido = quien && (quien.tipo === "dueno" || quien.tipo === "empleado") && quien.idPersona && quien.uid &&
            guardado && guardado.distribuidora && db && typeof usaNubeReal === "function" && usaNubeReal();

        if (!valido) {
            if (yo) apagar();
            return;
        }
        if (yo && yo.idPersona === quien.idPersona && yo.uid === quien.uid && yo.idDistribuidora === guardado.distribuidora) return;
        if (yo) apagar();

        yo = { idPersona: String(quien.idPersona), uid: String(quien.uid), idDistribuidora: String(guardado.distribuidora) };

        quitarEscucha = refDistribuidora(yo.idDistribuidora).collection("preferenciasNotificaciones").doc(yo.idPersona)
            .onSnapshot(foto => {
                const datos = foto.exists ? foto.data() || {} : {};
                silenciados = new Set(Array.isArray(datos.silenciados) ? datos.silenciados : []);
                avisarCambio();
            }, error => console.warn("No se pudo leer qué avisos suenan.", error));

        avisarCambio();
        revisarAlAbrir();
    }

    // -------------------------------------------------
    // Conexión con el resto de la app
    // -------------------------------------------------

    window.notificacionesVendeFrio = {
        disponible: () => Boolean(yo),
        estado,
        error: () => ultimoError,
        activar,
        desactivar,
        suena,
        cambiarSuena,
        avisoDejado,
        olvidarEsteCelular,
        escuchar(oyente) {
            if (typeof oyente !== "function") return () => {};
            oyentes.push(oyente);
            return () => {
                const indice = oyentes.indexOf(oyente);
                if (indice >= 0) oyentes.splice(indice, 1);
            };
        }
    };

    // sw.js avisa cuando se toca una notificación con la app abierta.
    if ("serviceWorker" in navigator && typeof navigator.serviceWorker.addEventListener === "function") {
        navigator.serviceWorker.addEventListener("message", evento => {
            const datos = evento.data;
            if (datos && datos.accion === "abrirAviso") abrirDesdeNotificacion(datos.aviso);
        });
    }

    window.empleadosVendeFrio?.escucharQuienSoy?.(arrancar);
    window.addEventListener("load", arrancar);
    abrirLoDeLaDireccion();
})();
