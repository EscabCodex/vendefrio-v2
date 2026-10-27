// =====================================================
// VendeFrío - lugar.js (repasada)
// 1) Si Android cierra la app de fondo para liberar memoria, al volver se
//    abre en la misma pantalla (con la ficha que estaba abierta y a la misma
//    altura), no en Inicio. "Dónde estabas" se anota al irte a otra app, en
//    la memoria de esa ventana (sessionStorage): Android la conserva cuando
//    cierra la app por memoria y la borra cuando la cerrás vos (deslizándola
//    de las apps abiertas), así que en ese caso arranca en Inicio como
//    siempre. Por las dudas dura 2 horas, y solo si es la misma cuenta.
// 2) El botón (o el gesto) "atrás" del celular cierra la hoja o ventana de
//    arriba, o vuelve a la pantalla anterior, igual que la flecha de arriba,
//    en vez de cerrar la app. En Inicio, sin nada abierto, la cierra como
//    siempre. En plena navegación no la corta, ni con la navegación
//    minimizada en la burbuja (el atrás la trae de vuelta).
// =====================================================
(function () {
    const CLAVE = "vendefrio_lugar";
    const DURA = 2 * 60 * 60 * 1000;
    const CAPAS = ".modal, .pzFondo, .modalCatalogo, .pzEscanear";
    // Ventanas que no se cierran tocando afuera: se usa su "X".
    const CERRAR = ".cerrarEscanear, .cerrarModalCatalogo, .fichaCerrar";
    // Las flechas de volver de cada pantalla (volver.js las junta arriba).
    const VOLVER = ".botonVolverPedidos, #cerrarCargaPedido, .configVolver, .botonVolverPantalla";
    // Pantallas que se abren directo con mostrarPantalla().
    const DIRECTAS = {
        pantallaPedido: "pedido", pantallaComercios: "comercios", pantallaProductos: "productos",
        pantallaHistorial: "historial", pantallaRutas: "rutas", pantallaCatalogo: "catalogo"
    };

    function seVe(elemento) {
        if (!elemento || elemento.hidden || elemento.closest(".oculto")) return false;
        return elemento.getClientRects().length > 0;
    }

    function pantallaVisible() {
        return [...document.querySelectorAll('body > section[id^="pantalla"]')]
            .find(seccion => !seccion.classList.contains("oculto")) || null;
    }

    function cuenta() {
        const modo = typeof obtenerModoNubeGuardado === "function" ? obtenerModoNubeGuardado() : null;
        return modo ? modo.uid + "|" + modo.distribuidora : "personal";
    }

    function capaAbierta(capa) {
        if (!capa.isConnected || capa.hidden || capa.classList.contains("oculto")) return false;
        // Las hojas nuevas se marcan "visible" al abrir y lo pierden al cerrar.
        if (capa.classList.contains("pzFondo") && !capa.classList.contains("visible")) return false;
        return getComputedStyle(capa).display !== "none";
    }

    // La hoja o ventana de más arriba (la última que se abrió).
    function capaDeArriba() {
        let arriba = null;
        let altura = -Infinity;
        for (const capa of document.body.children) {
            if (!capa.matches(CAPAS) || !capaAbierta(capa)) continue;
            const z = Number(getComputedStyle(capa).zIndex) || 0;
            if (z >= altura) {
                arriba = capa;
                altura = z;
            }
        }
        return arriba;
    }

    function tutorialAbierto() {
        try {
            return Boolean(window.tutorialVendeFrio?.abierto?.());
        } catch (error) {
            return false;
        }
    }

    // ---------- 1) Dónde estabas ----------
    function lugarActual() {
        const seccion = pantallaVisible();
        if (!seccion || seccion.id === "pantallaInicioSesion" || tutorialAbierto()) return null;
        const lugar = { pantalla: seccion.id, scroll: Math.round(window.scrollY || 0), hora: Date.now(), cuenta: cuenta() };
        if (seccion.id === "pantallaPedido") {
            const seguimiento = window.seguimientoVendeFrio;
            lugar.vista = seccion.dataset.vista || "nuevo";
            lugar.etapa = seguimiento?.etapa?.() || "";
            const abierto = seguimiento?.pedidoAbierto?.();
            if (abierto) lugar.pedido = String(abierto);
        }
        if (seccion.id === "pantallaConfiguracion") {
            const caja = document.getElementById("configDetalle");
            if (caja && !caja.classList.contains("oculto") && caja.dataset.seccion) lugar.seccionMas = caja.dataset.seccion;
        }
        const ficha = document.querySelector(".modalFichaComercio #tituloFichaComercio");
        if (ficha && ficha.textContent) lugar.ficha = ficha.textContent;
        if (seccion.id === "pantallaMenu" && !lugar.ficha) return null;
        return lugar;
    }

    function anotar() {
        try {
            const lugar = lugarActual();
            if (lugar) sessionStorage.setItem(CLAVE, JSON.stringify(lugar));
            else sessionStorage.removeItem(CLAVE);
        } catch (error) {
            // Sin lugar para guardar: al volver arranca en Inicio, como antes.
        }
    }

    function olvidar() {
        try {
            sessionStorage.removeItem(CLAVE);
        } catch (error) {
            // nada
        }
    }

    // Se anota al irse (a otra app, apagar la pantalla) y se borra al volver:
    // si Android no cerró la app, no hace falta.
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") anotar();
        else olvidar();
    });
    document.addEventListener("freeze", anotar);

    // La app se abrió con un enlace (una notificación, algo compartido): manda eso.
    function vieneConEnlace() {
        let direccion = window.location.href;
        try {
            const navegacion = performance.getEntriesByType("navigation")[0];
            if (navegacion && navegacion.name) direccion = navegacion.name;
        } catch (error) {
            // se usa la dirección de ahora
        }
        try {
            const parametros = new URL(direccion).searchParams;
            return ["aviso", "pedido", "tipo", "compartido"].some(clave => parametros.has(clave));
        } catch (error) {
            return false;
        }
    }

    function leerGuardado() {
        let lugar = null;
        try {
            lugar = JSON.parse(sessionStorage.getItem(CLAVE) || "null");
        } catch (error) {
            lugar = null;
        }
        olvidar();
        if (!lugar || typeof lugar !== "object" || typeof lugar.pantalla !== "string") return null;
        if (!(Date.now() - Number(lugar.hora) < DURA) || lugar.cuenta !== cuenta()) return null;
        return lugar;
    }

    function abrirPantalla(lugar) {
        const id = lugar.pantalla;
        if (id === "pantallaMenu") return true;
        if (id === "pantallaPedido") {
            const seguimiento = window.seguimientoVendeFrio;
            if (lugar.vista === "pedidos" && seguimiento) {
                if (lugar.etapa === "historial" && seguimiento.abrirHistorial?.({})) return true;
                if (seguimiento.abrirEtapa?.(lugar.etapa || "paraArmar")) return true;
            }
            mostrarPantalla("pedido");
            return true;
        }
        if (DIRECTAS[id]) {
            mostrarPantalla(DIRECTAS[id]);
            return true;
        }
        if (id === "pantallaConfiguracion") {
            if (lugar.seccionMas && typeof window.abrirConfiguracionEn === "function") window.abrirConfiguracionEn(lugar.seccionMas);
            else mostrarPantalla("mas");
            return true;
        }
        if (id === "pantallaEstadisticas" && typeof window.abrirEstadisticas === "function") {
            window.abrirEstadisticas();
            return true;
        }
        if (id === "pantallaCierre" && window.cierreVendeFrio?.disponible?.()) {
            window.cierreVendeFrio.abrir();
            return true;
        }
        const otras = {
            pantallaWhatsapp: window.whatsappVendeFrio?.abrir,
            pantallaProblemas: window.confianzaVendeFrio?.verProblemas,
            pantallaSinSubir: window.confianzaVendeFrio?.abrirSinSubir,
            pantallaRepartidores: window.repartidoresVendeFrio?.abrirPantalla
        };
        if (typeof otras[id] === "function") {
            otras[id]();
            return true;
        }
        // Los accesos de Más que suman otras partes (A cobrar, Listas de precios...).
        const acceso = (window.accesosMasExtras || []).find(item => {
            return item && item.destino && "pantalla" + item.destino.charAt(0).toUpperCase() + item.destino.slice(1) === id;
        });
        if (acceso && typeof acceso.abrir === "function") {
            let sePuede = true;
            try {
                sePuede = !acceso.mostrar || acceso.mostrar();
            } catch (error) {
                sePuede = false;
            }
            if (sePuede) {
                acceso.abrir();
                return true;
            }
        }
        // Las que dependen de otra (el folleto de una lista, la cámara, un
        // recibo, la navegación) no se rearman: queda Inicio.
        return false;
    }

    // Lo que necesita los datos (la ficha de un comercio, la de un pedido)
    // se reintenta cuando llegan de la nube, hasta 30 segundos.
    function cuandoHayaDatos(intentar) {
        if (intentar()) return;
        if (typeof escucharCambiosDatos !== "function") return;
        let listo = false;
        const dejar = escucharCambiosDatos(() => {
            if (listo || cortado) return;
            if (intentar()) terminar();
        });
        const reloj = setTimeout(terminar, 30000);
        function terminar() {
            listo = true;
            clearTimeout(reloj);
            if (typeof dejar === "function") dejar();
        }
        cortes.push(terminar);
    }

    // Si la persona toca algo mientras se vuelve al lugar, se deja de volver.
    let cortado = false;
    const cortes = [];
    function cortarVuelta() {
        cortado = true;
        cortes.splice(0).forEach(cortar => cortar());
    }

    function volverAlScroll(y) {
        if (!(y > 0)) return;
        let vueltas = 0;
        const probar = () => {
            if (cortado || vueltas++ > 30) return;
            window.scrollTo(0, y);
            // Las listas largas se dibujan a medida que se baja: se insiste
            // hasta llegar.
            if (Math.abs(window.scrollY - y) > 4) setTimeout(probar, 100);
        };
        setTimeout(probar, 60);
    }

    function volverAlLugar() {
        if (vieneConEnlace()) {
            olvidar();
            return;
        }
        const lugar = leerGuardado();
        if (!lugar) return;
        if (seVe(document.getElementById("pantallaInicioSesion")) || tutorialAbierto()) return;
        if (typeof mostrarPantalla !== "function") return;
        ["pointerdown", "keydown"].forEach(tipo => document.addEventListener(tipo, cortarVuelta, { once: true, capture: true }));
        let abrio = false;
        try {
            abrio = abrirPantalla(lugar);
        } catch (error) {
            console.warn("No se pudo volver a la pantalla de antes.", error);
        }
        if (!abrio) return;
        volverAlScroll(lugar.scroll);
        if (lugar.ficha && typeof window.abrirFichaComercio === "function") {
            cuandoHayaDatos(() => {
                if (cortado) return true;
                window.abrirFichaComercio(lugar.ficha);
                return Boolean(document.querySelector(".modalFichaComercio"));
            });
        }
        if (lugar.pedido && window.seguimientoVendeFrio?.abrirPedido) {
            cuandoHayaDatos(() => cortado || window.seguimientoVendeFrio.abrirPedido(lugar.pedido));
        }
    }

    // ---------- 2) El botón atrás del celular ----------
    // Mientras haya algo para cerrar o no se esté en Inicio, arriba de la
    // historia queda una entrada nuestra ("guardia"): el atrás la saca, y en
    // vez de cerrar la app se da un paso atrás adentro.
    // Chrome se saltea las entradas que una página agrega sin que la persona
    // haya tocado nada: si la guardia se volviera a agregar después de cada
    // atrás, el segundo atrás seguido cerraría la app. Por eso, después de
    // un atrás no se agrega otra: se vuelve "adelante" a la misma guardia,
    // que se agregó con un toque. Solo se agrega una nueva si no hay.
    let guardia = Boolean(window.history.state && window.history.state.vendefrio === "guardia");
    let ignorarVuelta = false;
    let relojIgnorar = null;
    // Se acaba de salir de la guardia con un atrás: está "adelante".
    let guardiaAdelante = false;
    let yendoAdelante = false;
    let relojAdelante = null;

    // "abierta" (en pantalla) o "minimizada" (en la burbuja).
    function navegacion(estado) {
        try {
            return Boolean(window.navegacionVendeFrio?.[estado]?.());
        } catch (error) {
            return false;
        }
    }

    function enLaBase() {
        if (tutorialAbierto() || capaDeArriba()) return false;
        // Navegando, aunque esté minimizada, el atrás no cierra la app.
        if (navegacion("abierta") || navegacion("minimizada")) return false;
        const seccion = pantallaVisible();
        return !seccion || seccion.id === "pantallaMenu" || seccion.id === "pantallaInicioSesion";
    }

    function agregarGuardia() {
        try {
            window.history.pushState({ vendefrio: "guardia" }, "");
            guardia = true;
            guardiaAdelante = false;
        } catch (error) {
            // Sin historia: el atrás sigue como antes.
        }
    }

    function revisarGuardia() {
        if (yendoAdelante) return;
        if (enLaBase()) {
            if (!guardia) return;
            guardia = false;
            if (window.history.length > 1 && window.history.state && window.history.state.vendefrio === "guardia") {
                // Se saca la entrada: así el próximo atrás cierra la app.
                ignorarVuelta = true;
                clearTimeout(relojIgnorar);
                relojIgnorar = setTimeout(() => { ignorarVuelta = false; }, 1000);
                window.history.back();
            } else {
                try {
                    window.history.replaceState(null, "");
                } catch (error) {
                    // nada
                }
            }
            return;
        }
        if (guardia) return;
        if (!guardiaAdelante) {
            agregarGuardia();
            return;
        }
        yendoAdelante = true;
        clearTimeout(relojAdelante);
        // Si en un ratito no llegó, se agrega una nueva como antes.
        relojAdelante = setTimeout(() => {
            if (!yendoAdelante) return;
            yendoAdelante = false;
            guardiaAdelante = false;
            revisarGuardia();
        }, 600);
        try {
            window.history.forward();
        } catch (error) {
            clearTimeout(relojAdelante);
            yendoAdelante = false;
            agregarGuardia();
        }
    }

    function botonVolverDe(seccion) {
        const barra = seccion.querySelector(":scope > .barraVolver");
        const botones = barra ? barra.querySelectorAll(VOLVER) : seccion.querySelectorAll(":scope > header " + VOLVER.split(", ").join(", :scope > header "));
        return [...botones].find(seVe) || null;
    }

    function cerrarCapa(capa) {
        const boton = [...capa.querySelectorAll(CERRAR)].find(seVe);
        if (boton) {
            boton.click();
            return;
        }
        // Igual que tocar afuera de la ventana.
        capa.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    }

    function unPasoAtras() {
        if (tutorialAbierto()) {
            window.tutorialVendeFrio.cerrar();
            return;
        }
        const capa = capaDeArriba();
        if (capa) {
            cerrarCapa(capa);
            return;
        }
        // En plena navegación, un atrás sin querer no la corta.
        if (navegacion("abierta")) return;
        const seccion = pantallaVisible();
        if (!seccion || seccion.id === "pantallaMenu" || seccion.id === "pantallaInicioSesion") {
            // En Inicio con la navegación en la burbuja: la trae de vuelta.
            if (navegacion("minimizada")) window.navegacionVendeFrio.restaurar();
            return;
        }
        if (seccion.id === "pantallaNavegacion") return;
        // Lo que se abrió desde Más (A cobrar, Historial, Rutas...) vuelve a
        // Más, aunque su flecha de arriba lleve a Inicio.
        if (vinoDe[seccion.id] === "pantallaConfiguracion" && typeof mostrarPantalla === "function") {
            mostrarPantalla("mas");
            return;
        }
        const boton = botonVolverDe(seccion);
        if (boton) boton.click();
        else if (typeof mostrarPantalla === "function") mostrarPantalla("menu");
    }

    window.addEventListener("popstate", evento => {
        if (evento.state && evento.state.vendefrio === "guardia") {
            guardia = true;
            guardiaAdelante = false;
            yendoAdelante = false;
            clearTimeout(relojAdelante);
            // Mientras se volvía adelante pudo haberse cerrado lo último.
            pedirRevisar();
            return;
        }
        // Se salió de la guardia: quedó adelante, para volver sin agregar otra.
        guardiaAdelante = true;
        if (ignorarVuelta) {
            ignorarVuelta = false;
            clearTimeout(relojIgnorar);
            return;
        }
        guardia = false;
        try {
            unPasoAtras();
        } catch (error) {
            console.warn("No se pudo volver atrás.", error);
        }
        // Si todavía queda algo para volver, la entrada se pone ya: así dos
        // "atrás" seguidos no cierran la app. Las hojas tardan un poquito en
        // irse: después se vuelve a ver si sigue haciendo falta.
        revisarGuardia();
        setTimeout(revisarGuardia, 260);
    });

    // De qué pantalla se llegó a cada una, para volver a esa.
    const vinoDe = {};
    let pantallaAntes = null;
    function anotarPantalla() {
        const id = pantallaVisible()?.id || null;
        if (!id || id === pantallaAntes) return;
        vinoDe[id] = pantallaAntes;
        pantallaAntes = id;
    }

    // Se mira solo lo que cambia arriba de todo: las pantallas y ventanas
    // que se agregan al cuerpo y su clase (no lo de adentro).
    let pedido = false;
    function pedirRevisar() {
        if (pedido) return;
        pedido = true;
        requestAnimationFrame(() => {
            pedido = false;
            anotarPantalla();
            revisarGuardia();
        });
    }
    const miradas = new WeakSet();
    const vigiaClases = new MutationObserver(pedirRevisar);
    function mirar(elemento) {
        if (elemento.nodeType !== 1 || miradas.has(elemento)) return;
        if (!elemento.matches('section[id^="pantalla"], .tutorialCapa, ' + CAPAS)) return;
        miradas.add(elemento);
        vigiaClases.observe(elemento, { attributes: true, attributeFilter: ["class", "hidden"] });
    }
    new MutationObserver(cambios => {
        cambios.forEach(cambio => cambio.addedNodes.forEach(mirar));
        pedirRevisar();
    }).observe(document.body, { childList: true });
    [...document.body.children].forEach(mirar);

    window.addEventListener("load", () => {
        volverAlLugar();
        pedirRevisar();
    });

    window.lugarVendeFrio = { anotar, olvidar, lugarActual, atras: unPasoAtras };
}());
