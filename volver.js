// =====================================================
// VendeFrío - volver.js (T51, T52)
// Botón volver en todas las pantallas menos Inicio, arriba a la izquierda,
// y al lado una casita para ir a Inicio cuando el volver no lleva ahí.
// Los dos van en una barrita pegajosa (sticky) al principio de la pantalla:
// son los mismos botones, que se quedan quietos mientras la pantalla baja
// por debajo. Sin copias ni saltos.
// =====================================================
(function () {
    // Botones volver que ya tenía cada pantalla en su encabezado.
    const PROPIOS = [".botonVolverPedidos", "#cerrarCargaPedido", ".configVolver", ".botonVolverPantalla"];
    // Los que llevan a Inicio no necesitan la casita al lado.
    const VAN_A_INICIO = ['.volverGenerico[data-volver="menu"]', "#cerrarCargaPedido"];
    const DESDE_MAS = ["pantallaEstadisticas", "pantallaCierre", "pantallaWhatsapp"];
    const DESTINOS = { mas: "Más", menu: "Inicio" };

    function preferencia(campo) {
        try {
            return window.preferenciasVendeFrio?.valor?.(campo);
        } catch (error) {
            return undefined;
        }
    }

    function seVe(elemento) {
        if (!elemento || elemento.hidden || elemento.closest(".oculto")) return false;
        return elemento.getClientRects().length > 0;
    }

    function pantallaVisible() {
        return [...document.querySelectorAll('body > section[id^="pantalla"]')].find(seVe) || null;
    }

    function irA(destino) {
        if (typeof window.mostrarPantalla === "function") window.mostrarPantalla(destino);
    }

    function crearBoton(clase, icono, nombre) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = clase;
        boton.setAttribute("aria-label", nombre);
        boton.title = nombre;
        boton.innerHTML = window.icono ? window.icono(icono, 22) : "";
        return boton;
    }

    // Arma la barrita de la pantalla: mueve ahí los botones volver de su
    // encabezado (con sus mismos eventos), y suma el genérico y la casita.
    function prepararBarra(pantalla) {
        const encabezado = pantalla.querySelector(":scope > header");
        let barra = pantalla.querySelector(":scope > .barraVolver");
        if (!barra) {
            if (!encabezado) return null;
            barra = document.createElement("div");
            barra.className = "barraVolver";
            pantalla.insertBefore(barra, pantalla.firstChild);
            // Las pantallas nuevas (piezas.js) dicen a dónde vuelven.
            const destino = pantalla.dataset.volverA || (DESDE_MAS.includes(pantalla.id) ? "mas" : "menu");
            const generico = crearBoton("botonVolverPantalla volverGenerico", "flechaIzquierda", DESTINOS[destino] ? "Volver a " + DESTINOS[destino] : "Volver");
            generico.dataset.volver = destino;
            // T160: el Asistente, arriba a la derecha de cada pantalla.
            const asistente = crearBoton("botonAsistentePantalla", "chispa", "Asistente");
            asistente.dataset.abrirAsistente = "";
            barra.append(generico, crearBoton("botonInicioPantalla", "casa", "Ir a Inicio"), asistente);
        }
        // Los que llegan tarde al encabezado (Pedidos agrega su flecha
        // después) también pasan a la barra, antes del genérico.
        if (encabezado) {
            [...encabezado.children].filter(hijo => PROPIOS.some(selector => hijo.matches(selector))).forEach(boton => {
                barra.insertBefore(boton, barra.querySelector(".volverGenerico"));
            });
        }
        return barra;
    }

    function enSeccionDeMas() {
        return seVe(document.getElementById("configDetalle"));
    }

    function actualizar() {
        const pantalla = pantallaVisible();
        if (!pantalla || pantalla.id === "pantallaMenu") return;
        const barra = prepararBarra(pantalla);
        if (!barra) return;

        const generico = barra.querySelector(".volverGenerico");
        if (pantalla.dataset.volverA && generico.dataset.volver !== pantalla.dataset.volverA) {
            generico.dataset.volver = pantalla.dataset.volverA;
            const nombre = DESTINOS[pantalla.dataset.volverA] ? "Volver a " + DESTINOS[pantalla.dataset.volverA] : "Volver";
            generico.setAttribute("aria-label", nombre);
            generico.title = nombre;
        }
        const casita = barra.querySelector(".botonInicioPantalla");
        const propio = [...barra.children].find(boton => {
            return boton !== generico && boton !== casita && !boton.matches(".botonAsistentePantalla") && !boton.hidden && !boton.classList.contains("oculto");
        });
        if (generico.hidden !== Boolean(propio)) generico.hidden = Boolean(propio);
        const volver = propio || generico;

        // En una sección de Más, la flecha de arriba vuelve a la lista de
        // Más y el título dice en qué sección estás.
        const titulo = pantalla.querySelector(".configHeader h1");
        if (titulo) {
            const seccion = enSeccionDeMas()
                ? (document.querySelector("#configDetalle .configSubVolver")?.textContent || "").replace("‹", "").trim()
                : "";
            const texto = seccion || "Más";
            if (titulo.textContent !== texto) titulo.textContent = texto;
        }

        const vaAInicio = VAN_A_INICIO.some(selector => volver.matches(selector))
            || (volver.matches(".configVolver") && !enSeccionDeMas());
        if (casita.hidden !== vaAInicio) casita.hidden = vaAInicio;
        const botones = vaAInicio ? "1" : "2";
        if (pantalla.dataset.botonesVolver !== botones) pantalla.dataset.botonesVolver = botones;

        // Al bajar, una barrita con el nombre de la pantalla queda detrás de
        // los botones, así no tapan los títulos (T122).
        const nombrePantalla = (pantalla.querySelector(":scope > header h1, .configHeader h1")?.textContent || "").trim();
        if (barra.dataset.titulo !== nombrePantalla) barra.dataset.titulo = nombrePantalla;
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

    // Al bajar, los botones se marcan como "despegados" (con más sombra).
    function marcarDespegado() {
        const despegado = window.scrollY > 6 && preferencia("volverFlotante") !== false;
        if (document.documentElement.classList.contains("volverDespegado") !== despegado) {
            document.documentElement.classList.toggle("volverDespegado", despegado);
        }
        const conBarra = despegado && window.scrollY > 56;
        if (document.documentElement.classList.contains("volverConBarra") !== conBarra) {
            document.documentElement.classList.toggle("volverConBarra", conBarra);
        }
    }

    document.addEventListener("click", event => {
        if (event.target.closest?.(".configHeader .configVolver, .barraVolver .configVolver") && enSeccionDeMas()) {
            // En una sección de Más, la flecha vuelve a la lista de Más.
            event.stopPropagation();
            event.preventDefault();
            document.querySelector("#configDetalle .configSubVolver")?.click();
            window.scrollTo(0, 0);
        } else if (event.target.closest?.(".botonInicioPantalla")) {
            irA("menu");
        } else {
            const boton = event.target.closest?.(".botonVolverPantalla");
            if (boton && boton.dataset.volver === "propio" && window.piezas?.volverDesde(boton.closest("section"))) {
                // La pantalla sabe a dónde volver (por ejemplo, a la ficha).
            } else if (boton) {
                irA(DESTINOS[boton.dataset.volver] ? boton.dataset.volver : "menu");
            }
        }
        setTimeout(pedirActualizar, 60);
    }, true);

    window.addEventListener("scroll", marcarDespegado, { passive: true });
    window.addEventListener("load", pedirActualizar);
    // Pantallas que se abren o cambian por código.
    // Lo que cambia dentro de un mapa o de la navegación (cuadraditos del
    // mapa, cada posición del GPS) no cambia de pantalla: se ignora (T141).
    new MutationObserver(cambios => {
        if (cambios.every(cambio => cambio.target.closest?.(".leaflet-container, #pantallaNavegacion > *"))) return;
        pedirActualizar();
    }).observe(document.body, {
        attributes: true, attributeFilter: ["class", "data-vista"], subtree: true
    });

    window.volverVendeFrio = { actualizar };
    actualizar();
})();
