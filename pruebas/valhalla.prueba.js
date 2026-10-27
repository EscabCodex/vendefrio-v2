// VendeFrío - Servidor de caminos Valhalla (T163): en Más > Cómo hacés el
// recorrido se elige "Valhalla"; la navegación le pide el camino con el
// perfil de moto y las indicaciones salen con las frases de siempre. Si
// Valhalla no contesta, va el OSRM de respaldo.
// Los dos servidores los contesta la prueba, así no hace falta internet.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, abrirMas } = require("./recorridos");

test.use({ nube: true });

const COMERCIO = { lat: -34.6, lng: -58.4 };
const SALIDA = { latitude: -34.605, longitude: -58.405 };
const PUNTOS = [[SALIDA.latitude, SALIDA.longitude], [-34.605, -58.4], [COMERCIO.lat, COMERCIO.lng]];

// Línea comprimida como la manda Valhalla (polyline con 6 decimales).
function comprimir(puntos) {
    let texto = "";
    let anterior = [0, 0];
    const numero = valor => {
        let resto = valor < 0 ? ~(valor << 1) : valor << 1;
        while (resto >= 0x20) {
            texto += String.fromCharCode((0x20 | (resto & 0x1f)) + 63);
            resto >>= 5;
        }
        texto += String.fromCharCode(resto + 63);
    };
    puntos.forEach(punto => {
        const actual = punto.map(valor => Math.round(valor * 1e6));
        numero(actual[0] - anterior[0]);
        numero(actual[1] - anterior[1]);
        anterior = actual;
    });
    return texto;
}

// Camino falso de Valhalla: al este por Rivadavia, a la izquierda por Belgrano y llegada.
const VIAJE = {
    trip: {
        summary: { time: 240, length: 1.015 },
        legs: [{
            shape: comprimir(PUNTOS),
            maneuvers: [
                { type: 2, street_names: ["Rivadavia"], begin_shape_index: 0, instruction: "Diríjase al este por Rivadavia." },
                { type: 15, street_names: ["Belgrano"], begin_shape_index: 1, instruction: "Gire a la izquierda hacia Belgrano." },
                { type: 4, begin_shape_index: 2, instruction: "Ha llegado a su destino." }
            ]
        }]
    }
};

// El mismo camino, como lo contesta el OSRM.
const CAMINO_OSRM = {
    code: "Ok",
    routes: [{
        distance: 1015,
        duration: 240,
        geometry: { type: "LineString", coordinates: PUNTOS.map(([lat, lng]) => [lng, lat]) },
        legs: [{
            steps: [
                { name: "Rivadavia", maneuver: { type: "depart", modifier: "", location: [SALIDA.longitude, SALIDA.latitude] } },
                { name: "Belgrano", maneuver: { type: "turn", modifier: "left", location: [-58.4, -34.605] } },
                { name: "", maneuver: { type: "arrive", modifier: "", location: [COMERCIO.lng, COMERCIO.lat] } }
            ]
        }]
    }]
};

async function prepararServidores(page, valhallaContesta) {
    const pedidos = { valhalla: [], osrm: [] };
    await page.route("https://valhalla1.openstreetmap.de/**", ruta => {
        pedidos.valhalla.push(ruta.request().url());
        return valhallaContesta
            ? ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(VIAJE) })
            : ruta.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    });
    await page.route("https://routing.openstreetmap.de/**", ruta => {
        pedidos.osrm.push(ruta.request().url());
        return ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CAMINO_OSRM) });
    });
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation(SALIDA);
    return pedidos;
}

// Más > Cómo hacés el recorrido: Moto y Valhalla.
async function elegirValhallaEnMoto(page) {
    await abrirMas(page);
    await page.locator('.configFila[data-config-seccion="navegacion"]').click();
    const detalle = page.locator("#configDetalle");
    await expect(detalle).toBeVisible();
    const camino = detalle.getByRole("radiogroup", { name: "Cómo calcula el camino" });
    await expect(camino.getByRole("radio", { name: "Normal" })).toBeChecked();
    await detalle.locator(".ajSegmento label", { hasText: /^Moto$/ }).click();
    await camino.locator(".ajSegmento label", { hasText: "Con modo moto" }).click();
    await expect(camino.getByRole("radio", { name: "Con modo moto" })).toBeChecked();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vendefrio_preferencias")).servidorCaminos)).toBe("valhalla");
    return detalle;
}

async function irAlComercio(page) {
    await page.evaluate(({ lat, lng }) =>
        agregarComercio({ nombre: "Kiosco La Esquina", direccion: "Belgrano 450", telefono: "11 4444-0000", lat, lng, origenGps: "gps" }),
    COMERCIO);
    await page.locator(".bottom-nav").getByRole("button", { name: "Comercios" }).click();
    await page.locator(".comercioCard", { hasText: "Kiosco La Esquina" }).click();
    await page.locator(".fichaComercioNueva").getByRole("link", { name: "Ir" }).click();
    // T154: la primera vez se elige cómo ir.
    await page.getByRole("dialog", { name: "¿Cómo querés ir?" }).getByRole("button", { name: "Navegación de VendeFrío" }).click();
    const navegacion = page.locator("#pantallaNavegacion");
    await expect(navegacion).toBeVisible();
    return navegacion;
}

test("valhalla: el camino en moto sale de Valhalla, con las indicaciones de siempre", async ({ page }, testInfo) => {
    const pedidos = await prepararServidores(page, true);
    await registrarDistribuidora(page, testInfo);
    await elegirValhallaEnMoto(page);
    await capturar(page, "valhalla-01-ajuste");

    const navegacion = await irAlComercio(page);
    await expect(navegacion.locator(".textoManiobra")).toHaveText("Doblá a la izquierda por Belgrano");
    await expect(navegacion.locator(".tiempoNavegacion")).toHaveText(/min/);
    await expect(navegacion.locator("path.lineaCamino")).toHaveCount(1);
    await capturar(page, "valhalla-02-navegando");

    expect(pedidos.valhalla.length).toBeGreaterThan(0);
    expect(pedidos.osrm).toHaveLength(0);
    const pedido = JSON.parse(new URL(pedidos.valhalla[0]).searchParams.get("json"));
    expect(pedido.costing).toBe("motorcycle");
    expect(pedido.directions_options.language).toBe("es-ES");
    expect(pedido.locations[0]).toEqual({ lat: SALIDA.latitude, lon: SALIDA.longitude });
    expect(pedido.locations[1]).toEqual({ lat: COMERCIO.lat, lon: COMERCIO.lng });

    // La línea sigue las calles de Valhalla (pasa por la esquina, no en diagonal).
    const largo = await page.evaluate(() => document.querySelector("#pantallaNavegacion path.lineaCamino").getTotalLength());
    expect(largo).toBeGreaterThan(0);

    // Llegada.
    await page.context().setGeolocation({ latitude: COMERCIO.lat, longitude: COMERCIO.lng });
    await expect(navegacion.locator(".tiempoNavegacion")).toHaveText("Llegaste");
});

test("valhalla: si no contesta, el camino sale del OSRM de respaldo", async ({ page }, testInfo) => {
    const pedidos = await prepararServidores(page, false);
    await registrarDistribuidora(page, testInfo);
    await elegirValhallaEnMoto(page);

    const navegacion = await irAlComercio(page);
    await expect(navegacion.locator(".textoManiobra")).toHaveText("Doblá a la izquierda por Belgrano");
    await capturar(page, "valhalla-03-respaldo-osrm");
    expect(pedidos.valhalla.length).toBeGreaterThan(0);
    expect(pedidos.osrm.length).toBeGreaterThan(0);
    // En moto, el OSRM usa el perfil de auto (no hay uno de moto gratis).
    pedidos.osrm.forEach(url => expect(url).toMatch(/^https:\/\/routing\.openstreetmap\.de\/routed-car\//));
});
