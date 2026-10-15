// =====================================================
// VendeFrío - volver.js (T51)
// Botón volver en todas las pantallas menos Inicio. Arriba a la izquierda,
// en su lugar, y cuando la pantalla baja se "desprende" y queda flotando
// para tenerlo siempre a mano. El flotante solo toca el botón volver de la
// pantalla, así cada pantalla sigue volviendo a donde ya volvía.
// =====================================================
(function () {
    // Botones volver que ya tenía cada pantalla, del más adentro al más afuera.
    const PROPIOS = [
        ".configSubVolver",
        ".botonVolverPedidos",
        "#cerrarCargaPedido",
        ".extraVolver",
        ".botonVolverPantalla:not(.volverGenerico)",
        ".configHeader .configVolver"
    ];
    // Los que ya vuelven a Inicio no necesitan la casita al lado.
    const VAN_A_INICIO = ['.volverGenerico[data-volver="menu"]', "#cerrarCargaPedido", ".extraVolver", ".configHeader .configVolver"];
    const DESTINOS = { mas: "Más", menu: "Inicio" };

    function preferencia(campo) {
        try {
            return window.preferenciasVendeFrio?.valor?.(campo);
        } catch (error) {
            return undefined;
        }
    }

    function seVe(elemento) {
        if (!elemento || elemento.closest(".oculto")) return false;
        if (!elemento.getClientRects().length) return false;
        return getComputedStyle(elemento).visibility !== "hidden";
    }

    function pantallaVisible() {
        return [...document.querySelectorAll('body > section[id^="pantalla"]')].find(seVe) || null;
    }

    function irA(destino) {
        if (typeof window.mostrarPantalla !== "function") return;
        window.mostrarPantalla(destino);
    }

    // Las pantallas sin botón propio reciben uno igual al de Rutas: las de la
    // barra (Pedidos, Comercios, Catálogo, Historial) vuelven a Inicio, y
    // Estadísticas y Cierre del día, que se abren desde Más, vuelven a Más.
    const DESDE_MAS = ["pantallaEstadisticas", "pantallaCierre"];
    function ponerGenerico(pantalla) {
        if (!pantalla || pantalla.id === "pantallaMenu") return null;
        const encabezado = pantalla.querySelector(":scope > header");
        if (!encabezado) return null;
        let boton = encabezado.querySelector(":scope > .volverGenerico");
        if (!boton) {
            boton = document.createElement("button");
            boton.type = "button";
            boton.className = "botonVolverPantalla volverGenerico";
            boton.dataset.volver = DESDE_MAS.includes(pantalla.id) ? "mas" : "menu";
            boton.setAttribute("aria-label", "Volver a " + DESTINOS[boton.dataset.volver]);
            boton.title = boton.getAttribute("aria-label");
            boton.innerHTML = window.icono ? window.icono("flechaIzquierda", 22) : "←";
            encabezado.insertBefore(boton, encabezado.firstChild);
        }
        return boton;
    }

    function botonDeLaPantalla(pantalla) {
        if (!pantalla || pantalla.id === "pantallaMenu") return null;
        for (const selector of PROPIOS) {
            const propio = [...pantalla.querySelectorAll(selector)].find(seVe);
            if (propio) return propio;
        }
        return null;
    }

    function crearBoton(id, clase, icono, nombre) {
        const boton = document.createElement("button");
        boton.type = "button";
        if (id) boton.id = id;
        boton.className = clase;
        boton.setAttribute("aria-label", nombre);
        boton.title = nombre;
        boton.innerHTML = window.icono ? window.icono(icono, 22) : "";
        return boton;
    }

    // Casita para ir directo a Inicio, al lado del volver de la pantalla.
    function ponerInicio(pantalla, mostrar) {
        const encabezado = pantalla?.querySelector(":scope > header");
        let casita = encabezado?.querySelector(":scope > .botonInicioPantalla");
        if (!casita && encabezado && mostrar) {
            casita = crearBoton("", "botonInicioPantalla", "casa", "Ir a Inicio");
            const despues = [...encabezado.children].find(hijo => {
                return !hijo.matches("button.botonVolverPantalla, .botonVolverPedidos, #cerrarCargaPedido, .configVolver");
            });
            encabezado.insertBefore(casita, despues || null);
        }
        if (casita && casita.hidden !== !mostrar) casita.hidden = !mostrar;
    }

    const grupo = document.createElement("div");
    grupo.className = "volverFlotanteGrupo";
    const flotante = crearBoton("volverFlotante", "volverFlotante", "flechaIzquierda", "Volver atrás");
    const inicioFlotante = crearBoton("inicioFlotante", "volverFlotante inicioFlotante", "casa", "Ir a Inicio");
    [flotante, inicioFlotante].forEach(boton => {
        boton.tabIndex = -1;
        grupo.appendChild(boton);
    });
    document.body.appendChild(grupo);

    let objetivo = null;

    function mostrarFlotante(boton, mostrar) {
        boton.classList.toggle("visible", mostrar);
        boton.tabIndex = mostrar ? 0 : -1;
        boton.setAttribute("aria-hidden", mostrar ? "false" : "true");
    }

    function actualizar() {
        const pantalla = pantallaVisible();
        // Primero el botón propio de la pantalla; si no tiene, el genérico.
        const propio = botonDeLaPantalla(pantalla);
        const generico = ponerGenerico(pantalla);
        if (generico && generico.hidden !== Boolean(propio)) generico.hidden = Boolean(propio);
        objetivo = propio || generico;

        const activado = preferencia("volverFlotante") !== false;
        const caja = objetivo ? objetivo.getBoundingClientRect() : null;
        // Se desprende cuando el de arriba ya casi no se ve.
        const desprendido = Boolean(caja) && caja.bottom < caja.height * 0.4;
        const mostrar = activado && desprendido;
        const yaVaAInicio = Boolean(objetivo) && VAN_A_INICIO.some(selector => objetivo.matches(selector));
        const conCasita = Boolean(objetivo) && !yaVaAInicio;
        if (pantalla) ponerInicio(pantalla, conCasita);
        mostrarFlotante(flotante, mostrar);
        mostrarFlotante(inicioFlotante, mostrar && conCasita);
    }

    let pedido = false;
    function pedirActualizar() {
        if (pedido) return;
        pedido = true;
        requestAnimationFrame(() => {
            pedido = false;
            actualizar();
        });
    }

    flotante.addEventListener("click", () => {
        if (!objetivo) return;
        objetivo.click();
        setTimeout(pedirActualizar, 60);
    });

    inicioFlotante.addEventListener("click", () => irA("menu"));

    document.addEventListener("click", event => {
        if (event.target.closest?.(".botonInicioPantalla")) irA("menu");
        const boton = event.target.closest?.(".botonVolverPantalla");
        if (boton) {
            const destino = boton.dataset.volver || "menu";
            irA(destino in DESTINOS ? destino : "menu");
        }
        // Al cambiar de pantalla o de sección, se vuelve a mirar.
        setTimeout(pedirActualizar, 60);
        setTimeout(pedirActualizar, 400);
    }, true);

    window.addEventListener("scroll", pedirActualizar, { passive: true });
    window.addEventListener("resize", pedirActualizar);
    window.addEventListener("load", pedirActualizar);
    // Pantallas que se abren por código (avisos, voz, "Pantalla al abrir").
    new MutationObserver(pedirActualizar).observe(document.body, {
        attributes: true, attributeFilter: ["class"], subtree: true
    });

    window.volverVendeFrio = { actualizar };
    actualizar();
})();
