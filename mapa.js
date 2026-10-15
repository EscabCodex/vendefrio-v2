// =====================================================
// VendeFrío - mapa.js
// Mapa base compartido (T40): Leaflet viene dentro de la app
// (vendor/leaflet) y los mapas son de OpenStreetMap. El service worker
// guarda un tiempo los cuadraditos del mapa ya vistos, así un recorrido
// conocido se ve aunque la señal esté floja.
// =====================================================

(function () {
    const URL_MAPAS = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

    function mapaDisponible() {
        return typeof window.L !== "undefined";
    }

    // Capa de calles con el aviso de OpenStreetMap (lo pide su licencia).
    function capaDeCalles() {
        return L.tileLayer(URL_MAPAS, {
            maxZoom: 19,
            crossOrigin: "anonymous",
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
        });
    }

    function crearMapa(elemento, opciones = {}) {
        if (!mapaDisponible() || !elemento) return null;
        const mapa = L.map(elemento, { zoomControl: opciones.zoomControl !== false, attributionControl: true });
        capaDeCalles().addTo(mapa);
        if (mapa.attributionControl) mapa.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
        if (opciones.centro) mapa.setView(opciones.centro, opciones.zoom || 15);
        return mapa;
    }

    window.mapaVendeFrio = { disponible: mapaDisponible, capaDeCalles, crearMapa };
}());
