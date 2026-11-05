// =====================================================
// VendeFrío - equipoRuta.js
// El equipo en el mapa de Rutas y de la navegación (Bloque O, etapa 3).
// - T140 Compañeros: quienes comparten su ubicación (repartidores.js, T73)
//   aparecen con su inicial en los dos mapas. Por ahora solo en el celular
//   del dueño, el único que puede leerlas.
// (Los avisos de la calle de T139 se sacaron en el repaso de Rutas.)
// =====================================================

(function () {
    "use strict";

    const p = window.piezas;
    const extras = window.extrasVendeFrio;
    if (!p || !extras) return;

    const VIGENTE_UBICACION = 20 * 60000;

    function yo() {
        return p.persona();
    }

    // -------------------------------------------------
    // Compañeros (T140)
    // -------------------------------------------------

    // Por ahora solo el dueño lee las ubicaciones (reglas de T73, y quien
    // comparte acepta «con el dueño»). Que las vean también los compañeros
    // necesita reglas nuevas y otro texto al activar: lo decide el dueño.
    function companerosVigentes() {
        const persona = yo();
        if (!p.refNube() || !p.esDueno()) return [];
        return extras.lista("ubicaciones").filter(item => (!persona || item.id !== persona.idPersona) &&
            Date.now() - (Number(item.horaCelular) || 0) < VIGENTE_UBICACION &&
            Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)));
    }

    // -------------------------------------------------
    // Los mapas
    // -------------------------------------------------

    // Una capa por mapa; los marcadores se reusan (un celular barato no
    // redibuja todo con cada posición nueva).
    const capas = new Map();   // mapa -> { capa, marcadores: Map(clave -> marcador) }

    function capaDe(mapa) {
        if (!capas.has(mapa)) capas.set(mapa, { capa: L.layerGroup().addTo(mapa), marcadores: new Map() });
        return capas.get(mapa);
    }

    function iconoCompanero(item) {
        return L.divIcon({
            className: "pinCompanero",
            html: `<span class="cabezaCompanero">${p.esc(p.iniciales(item.nombre))}</span>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19]
        });
    }

    function dibujarEn(mapa) {
        if (!mapa || typeof L === "undefined") return;
        const { capa, marcadores } = capaDe(mapa);
        const quedan = new Set();
        companerosVigentes().forEach(item => {
            const clave = "companero:" + item.id;
            quedan.add(clave);
            const lugar = [Number(item.lat), Number(item.lng)];
            if (marcadores.has(clave)) {
                marcadores.get(clave).setLatLng(lugar);
                return;
            }
            marcadores.set(clave, L.marker(lugar, {
                icon: iconoCompanero(item), keyboard: false, interactive: false, zIndexOffset: 400,
                title: item.nombre + ", repartidor del equipo"
            }).addTo(capa));
        });
        marcadores.forEach((marcador, clave) => {
            if (quedan.has(clave)) return;
            marcador.remove();
            marcadores.delete(clave);
        });
    }

    // -------------------------------------------------
    // Cuándo se dibuja
    // -------------------------------------------------

    function mapaRutas() {
        const pantalla = document.getElementById("pantallaRutas");
        if (!pantalla || pantalla.classList.contains("oculto")) return null;
        return typeof mapaLeaflet !== "undefined" ? mapaLeaflet : null;
    }

    let mapaNav = null;
    let pantallaNav = null;

    function dibujarTodo() {
        const enRutas = mapaRutas();
        if (enRutas) dibujarEn(enRutas);
        if (mapaNav && pantallaNav && !pantallaNav.classList.contains("oculto")) dibujarEn(mapaNav);
    }

    function alAbrirNavegacion(mapa, pantalla) {
        mapaNav = mapa;
        pantallaNav = pantalla;
        setTimeout(dibujarTodo, 0);
    }

    function alCerrarNavegacion() {
        pantallaNav = null;
    }

    if (typeof window.inicializarPantallaRutas === "function") {
        const original = window.inicializarPantallaRutas;
        window.inicializarPantallaRutas = function () {
            const resultado = original.apply(this, arguments);
            try { dibujarTodo(); } catch (error) { console.error("Falló el equipo en Rutas.", error); }
            return resultado;
        };
    }
    extras.escuchar("ubicaciones", () => {
        try { dibujarTodo(); } catch (error) { console.error(error); }
    });
    // Los compañeros que dejan de compartir se van.
    setInterval(() => {
        try { dibujarTodo(); } catch (error) { /* nada */ }
    }, 60000);

    window.equipoRutaVendeFrio = { alAbrirNavegacion, alCerrarNavegacion, companeros: companerosVigentes, dibujar: dibujarTodo };
}());
