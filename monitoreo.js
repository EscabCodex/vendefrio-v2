// VendeFrío - Medir la fluidez y avisar errores (2026-11-05).
// Tres herramientas gratis que miran la app en los celulares reales:
// - Vercel Speed Insights: cuánto tarda en abrir y en responder cada toque.
// - Vercel Analytics: cuántas veces se abre la app (una visita por apertura).
// - Sentry: cuando algo se rompe en un celular, llega un aviso con el error.
// Todo arranca recién cuando la app ya abrió y el celular está libre, así no
// pesa en los celulares baratos. No corre en las pruebas ni en la compu
// (localhost), y cada parte se apaga desde Más (ajustes "avisarErrores" y
// "medirFluidez" de vendefrio_preferencias).
// Nunca se manda el nombre de un comercio, un mail, un teléfono ni un monto:
// los textos se limpian antes de salir del celular.
(function () {
    // La "dirección" del proyecto de Sentry (DSN). No es una clave secreta:
    // Sentry la pensó para ir dentro de la app. Vacía = Sentry apagado.
    const SENTRY_DSN = "";
    const SENTRY_VERSION = "8.55.0";
    const MAXIMO_AVISOS = 15; // por apertura, para no gastar el plan gratis

    const host = location.hostname;
    const enVercel = /\.vercel\.app$/.test(host) || host === "vendefrio.app";
    if (!enVercel) return;
    const entorno = host.includes("git-desarrollo") ? "desarrollo" : (host.includes("-git-") ? "vista-previa" : "produccion");

    function preferencia(campo) {
        try {
            const d = JSON.parse(localStorage.getItem("vendefrio_preferencias")) || {};
            return d[campo] !== false;
        } catch (e) {
            return true;
        }
    }

    // Saca de un texto lo que podría ser de un cliente.
    function limpiar(texto) {
        if (typeof texto !== "string") return texto;
        return texto
            .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[mail]")
            .replace(/\$\s?[\d.,]+/g, "$[monto]")
            .replace(/\+?\d[\d\s-]{5,}\d/g, "[número]")
            .replace(/"[^"]{3,}"/g, '"[texto]"')
            .replace(/«[^»]{2,}»/g, "«[texto]»");
    }

    function sinConsulta(direccion) {
        if (typeof direccion !== "string") return direccion;
        return direccion.split(/[?#]/)[0];
    }

    function agregarScript(src) {
        const s = document.createElement("script");
        s.src = src;
        s.defer = true;
        s.crossOrigin = "anonymous";
        s.onerror = () => s.remove(); // sin internet: no pasa nada
        document.head.appendChild(s);
        return s;
    }

    // --- Errores de antes de que cargue Sentry: se guardan unos pocos. ---
    const pendientes = [];
    function guardarPendiente(error) {
        if (pendientes.length < 5 && error) pendientes.push(error);
    }
    const alError = e => guardarPendiente(e.error || new Error(e.message || "Error"));
    const alRechazo = e => guardarPendiente(e.reason instanceof Error ? e.reason : new Error(String(e.reason)));
    if (SENTRY_DSN && preferencia("avisarErrores")) {
        window.addEventListener("error", alError);
        window.addEventListener("unhandledrejection", alRechazo);
    }

    function arrancarSentry() {
        if (!SENTRY_DSN || !preferencia("avisarErrores")) return;
        let mandados = 0;
        const s = agregarScript("https://browser.sentry-cdn.com/" + SENTRY_VERSION + "/bundle.min.js");
        s.onload = () => {
            const Sentry = window.Sentry;
            if (!Sentry) return;
            window.removeEventListener("error", alError);
            window.removeEventListener("unhandledrejection", alRechazo);
            Sentry.init({
                dsn: SENTRY_DSN,
                environment: entorno,
                release: "vendefrio@" + (window.novedadesVendeFrio?.version || "1"),
                sendDefaultPii: false,
                maxBreadcrumbs: 20,
                ignoreErrors: ["ResizeObserver loop", "Non-Error promise rejection captured"],
                denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i],
                // Solo pasos de navegación y llamadas a internet (sin datos):
                // nada de lo que se tocó ni de lo que se escribió.
                beforeBreadcrumb(miga) {
                    if (miga.category === "ui.click" || miga.category === "ui.input" || miga.category === "console") return null;
                    if (miga.data) {
                        if (miga.data.url) miga.data.url = sinConsulta(miga.data.url);
                        if (miga.data.from) miga.data.from = sinConsulta(miga.data.from);
                        if (miga.data.to) miga.data.to = sinConsulta(miga.data.to);
                    }
                    miga.message = limpiar(miga.message);
                    return miga;
                },
                beforeSend(evento) {
                    if (!preferencia("avisarErrores") || mandados >= MAXIMO_AVISOS) return null;
                    mandados += 1;
                    delete evento.user;
                    if (evento.request) {
                        evento.request = { url: sinConsulta(evento.request.url), headers: { "User-Agent": navigator.userAgent } };
                    }
                    evento.message = limpiar(evento.message);
                    (evento.exception?.values || []).forEach(valor => { valor.value = limpiar(valor.value); });
                    delete evento.extra;
                    return evento;
                }
            });
            Sentry.setTag("modo", window.nubeVendeFrio?.modoNube?.() ? "nube" : "celular");
            pendientes.splice(0).forEach(error => Sentry.captureException(error));
        };
    }

    function arrancarVercel() {
        if (!preferencia("medirFluidez")) return;
        // Cola de cada herramienta (así la piden en su ayuda) y un filtro que
        // saca lo que va después de "?" o "#" en la dirección.
        window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
        window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
        window.si("beforeSend", evento => preferencia("medirFluidez") ? { ...evento, url: sinConsulta(evento.url) } : null);
        // La app cambia la dirección para que funcione el botón atrás: eso no
        // es una visita nueva. Se cuenta una sola por apertura.
        let contada = false;
        window.va("beforeSend", evento => {
            if (!preferencia("medirFluidez")) return null;
            if (evento.type === "pageview") {
                if (contada) return null;
                contada = true;
            }
            return { ...evento, url: location.origin + "/" };
        });
        agregarScript("/_vercel/speed-insights/script.js");
        agregarScript("/_vercel/insights/script.js");
    }

    // Recién cuando la app ya abrió y el celular no está ocupado.
    function cuandoEsteLibre(hacer) {
        const despues = () => (window.requestIdleCallback ? requestIdleCallback(hacer, { timeout: 8000 }) : setTimeout(hacer, 1500));
        if (document.readyState === "complete") setTimeout(despues, 3000);
        else window.addEventListener("load", () => setTimeout(despues, 3000), { once: true });
    }

    cuandoEsteLibre(() => {
        arrancarVercel();
        arrancarSentry();
    });

    window.monitoreoVendeFrio = { limpiar, entorno };
})();
