function limpiarTexto(texto) {
    return String(texto || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&#39;|&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .trim();
}

function extraerTitulo(html) {
    const coincidencia = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return coincidencia ? limpiarTexto(coincidencia[1]) : "";
}

function extraerDatosDeRuta(url) {
    try {
        const ruta = decodeURIComponent(new URL(url).pathname);
        const marcador = "/maps/place/";
        const inicio = ruta.indexOf(marcador);

        if (inicio === -1) return { nombre: "", direccion: "" };

        const texto = ruta
            .slice(inicio + marcador.length)
            .split("/data")[0]
            .replace(/\+/g, " ")
            .trim();

        const partes = texto.split(",").map(parte => parte.trim()).filter(Boolean);

        return {
            nombre: partes[0] || "",
            direccion: partes.slice(1).join(", ")
        };
    } catch (error) {
        return { nombre: "", direccion: "" };
    }
}

function extraerCoordenadas(texto) {
    const patrones = [
        /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
        /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
        /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/
    ];

    for (const patron of patrones) {
        const coincidencia = String(texto || "").match(patron);
        if (!coincidencia) continue;

        const lat = Number(coincidencia[1]);
        const lng = Number(coincidencia[2]);

        if (
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            lat >= -90 &&
            lat <= 90 &&
            lng >= -180 &&
            lng <= 180
        ) {
            return { lat, lng };
        }
    }

    return null;
}

async function geocodificarDireccion(direccion) {
    if (!direccion) return null;

    const consulta = direccion.includes("Argentina")
        ? direccion
        : direccion + ", Argentina";

    const respuesta = await fetch(
        "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ar&q=" +
            encodeURIComponent(consulta),
        {
            headers: {
                "User-Agent": "VendeFrio/1.0 ubicacion-comercios"
            }
        }
    );

    if (!respuesta.ok) return null;

    const resultados = await respuesta.json();
    if (!Array.isArray(resultados) || !resultados[0]) return null;

    const lat = Number(resultados[0].lat);
    const lng = Number(resultados[0].lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
}

module.exports = async function handler(request, response) {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (request.method === "OPTIONS") {
        response.status(204).end();
        return;
    }

    if (request.method !== "GET") {
        response.status(405).json({ ok: false, error: "M\u00e9todo no permitido" });
        return;
    }

    const urlSolicitud = new URL(
        request.url,
        "https://vendefrio.local"
    );
    const enlace = String(urlSolicitud.searchParams.get("url") || "").trim();

    if (!enlace || !/^https?:\\/\\//i.test(enlace)) {
        response.status(400).json({ ok: false, error: "Enlace inv\u00e1lido" });
        return;
    }

    try {
        const pagina = await fetch(enlace, {
            redirect: "follow",
            headers: {
                "User-Agent": "Mozilla/5.0 VendeFrio"
            }
        });

        if (!pagina.ok) {
            response.status(502).json({ ok: false, error: "No se pudo abrir el enlace" });
            return;
        }

        const html = await pagina.text();
        const datosRuta = extraerDatosDeRuta(pagina.url);
        const titulo = extraerTitulo(html);
        const coordenadas = extraerCoordenadas(pagina.url + " " + html);
        const direccion = datosRuta.direccion || "";
        const coordenadasFinales = coordenadas || await geocodificarDireccion(direccion);

        response.status(200).json({
            ok: true,
            nombre: datosRuta.nombre || titulo,
            direccion,
            lat: coordenadasFinales ? coordenadasFinales.lat : null,
            lng: coordenadasFinales ? coordenadasFinales.lng : null,
            coordenadasEncontradas: Boolean(coordenadasFinales)
        });
    } catch (error) {
        response.status(502).json({
            ok: false,
            error: "No se pudo resolver el enlace de Maps"
        });
    }
};
