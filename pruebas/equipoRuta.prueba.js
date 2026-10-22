// VendeFrío - El equipo en los mapas (T139 y T140), en un celular chico
// (360×640).
// 1. «Avisar» navegando: la hoja con los 6 avisos, el aviso en el mapa y la
//    voz («avisar calle cortada»).
// 2. Lucas avisó una calle cortada en tu camino: la navegación va por otro
//    recorrido y la tarjeta lo cuenta.
// 3. En la vista previa de Rutas, el aviso más nuevo del equipo arriba de
//    Iniciar y en el mapa.
// 4. (Nube) El dueño ve en Rutas a los repartidores que comparten su
//    ubicación.
// El GPS y los caminos son falsos.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora } = require("./recorridos");

test.use({ viewport: { width: 360, height: 640 } });

const SALIDA = { lat: -34.605, lng: -58.405 };
const ESQUINA = [-58.4, -34.605];
const PARADAS = [
    { nombre: "Almacén Don Tito", direccion: "Mitre 1220", lat: -34.6, lng: -58.4 },
    { nombre: "Súper El Sol", direccion: "Belgrano 300", lat: -34.598, lng: -58.398 }
];
const CINCO_MINUTOS = 5 * 60000;

// Las cajas no se pisan.
function noSePisan(a, b) {
    return a.y + a.height <= b.y || b.y + b.height <= a.y || a.x + a.width <= b.x || b.x + b.width <= a.x;
}

// El camino de siempre: al este por Rivadavia y a la izquierda por Belgrano
// (pasa por la esquina). El otro: al norte por Pringles y a la derecha por
// Mitre, 2 minutos más.
function directo(destino) {
    return {
        distance: 1015, duration: 240,
        geometry: { type: "LineString", coordinates: [[SALIDA.lng, SALIDA.lat], ESQUINA, destino] },
        legs: [{ steps: [
            { name: "Rivadavia", maneuver: { type: "depart", modifier: "", location: [SALIDA.lng, SALIDA.lat] } },
            { name: "Belgrano", maneuver: { type: "turn", modifier: "left", location: ESQUINA } },
            { name: "", maneuver: { type: "arrive", modifier: "", location: destino } }
        ] }]
    };
}

function porMitre(destino) {
    const esquina = [SALIDA.lng, destino[1]];
    return {
        distance: 1110, duration: 360,
        geometry: { type: "LineString", coordinates: [[SALIDA.lng, SALIDA.lat], esquina, destino] },
        legs: [{ steps: [
            { name: "Pringles", maneuver: { type: "depart", modifier: "", location: [SALIDA.lng, SALIDA.lat] } },
            { name: "Mitre", maneuver: { type: "turn", modifier: "right", location: esquina } },
            { name: "", maneuver: { type: "arrive", modifier: "", location: destino } }
        ] }]
    };
}

// Responde los caminos y anota si se pidieron otros recorridos.
async function caminosFalsos(page, pedidos) {
    await page.route("https://routing.openstreetmap.de/**", ruta => {
        const url = new URL(ruta.request().url());
        pedidos.push(url.search);
        const puntos = url.pathname.split("/").pop().split(";").map(par => par.split(",").map(Number));
        const destino = puntos[puntos.length - 1];
        const routes = url.searchParams.get("alternatives") ? [directo(destino), porMitre(destino)] : [directo(destino)];
        return ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ code: "Ok", routes }) });
    });
}

// GPS falso y voz que termina enseguida; los avisos de Lucas ya guardados.
async function prepararCelular(page, avisos = {}) {
    await page.addInitScript(guardados => {
        if (window.speechSynthesis) window.speechSynthesis.speak = frase => setTimeout(() => frase.onend && frase.onend(), 30);
        navigator.geolocation.watchPosition = exito => {
            window.__gps = (lat, lng) => exito({ coords: { latitude: lat, longitude: lng, speed: 8, accuracy: 5, heading: null }, timestamp: Date.now() });
            return 1;
        };
        navigator.geolocation.clearWatch = () => {};
        if (!localStorage.getItem("vendefrio_extra_avisosCalle")) {
            const ahora = Date.now();
            Object.values(guardados).forEach(aviso => { aviso.horaCelular = ahora - aviso.hace; delete aviso.hace; });
            localStorage.setItem("vendefrio_extra_avisosCalle", JSON.stringify(guardados));
        }
    }, avisos);
}

async function entrarComoRepartidor(page) {
    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Repartidor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(paradas => {
        paradas.forEach(parada => agregarComercio({ ...parada, telefono: "11 4444-0000", origenGps: "gps" }));
    }, PARADAS);
}

async function abrirNavegacion(page) {
    await page.evaluate(paradas => window.navegacionVendeFrio.abrir(paradas.map(parada => parada.nombre)), PARADAS);
    const navegacion = page.locator("#pantallaNavegacion");
    await expect(navegacion).toBeVisible();
    await page.evaluate(({ lat, lng }) => window.__gps(lat, lng), SALIDA);
    await page.evaluate(({ lat, lng }) => window.__gps(lat, lng + 0.0003), SALIDA);
    return navegacion;
}

test("avisar: la hoja, el aviso en el mapa y la voz", async ({ page }) => {
    const pedidos = [];
    await caminosFalsos(page, pedidos);
    await prepararCelular(page);
    await entrarComoRepartidor(page);
    const navegacion = await abrirNavegacion(page);
    await expect(navegacion.locator(".textoManiobra")).toHaveText("Doblá a la izquierda por Belgrano");
    // Sin avisos no se piden otros recorridos.
    expect(pedidos.every(pedido => !pedido.includes("alternatives"))).toBe(true);

    // El botón grande, abajo a la derecha, sin tapar la maniobra ni la parada.
    const avisar = navegacion.getByRole("button", { name: "Avisar al equipo" });
    await expect(avisar).toBeVisible();
    const cajaAvisar = await avisar.boundingBox();
    const cajaCartel = await navegacion.locator(".cartelManiobra").boundingBox();
    expect(cajaAvisar.width).toBeGreaterThanOrEqual(72);
    expect(cajaAvisar.y).toBeGreaterThan(cajaCartel.y + cajaCartel.height);
    expect(cajaAvisar.y + cajaAvisar.height).toBeLessThanOrEqual(640);
    for (const otra of [".paradaActualNavegacion", ".velocimetroNavegacion", ".botonesNavegacion"]) {
        const caja = await navegacion.locator(otra).boundingBox();
        expect(noSePisan(cajaAvisar, caja), "Avisar pisa " + otra).toBe(true);
    }

    await avisar.click();
    const hoja = page.getByRole("dialog", { name: "¿Qué querés avisar?" });
    await expect(hoja).toBeVisible();
    await expect(hoja).toContainText("Lo ven los repartidores de tu equipo durante 2 horas.");
    for (const tipo of ["Calle cortada", "Control", "Tránsito lento", "Pozo o calle rota", "Choque", "Comercio cerrado"]) {
        await expect(hoja.getByRole("button", { name: tipo })).toBeVisible();
    }
    await expect(hoja).toContainText("«avisar calle cortada»");
    await page.waitForTimeout(300);
    await capturar(page, "equipo-01-avisar");

    // Calle cortada: queda en el mapa, a tu nombre, con la calle por donde vas.
    await hoja.getByRole("button", { name: "Calle cortada" }).click();
    await expect(hoja).toBeHidden();
    const pin = navegacion.locator(".pinAvisoCalle");
    await expect(pin).toHaveCount(1);
    await expect(pin).toHaveAttribute("title", "Calle cortada · avisó Vos");
    const guardado = await page.evaluate(() => window.avisosCalleVendeFrio.vigentes()[0]);
    expect(guardado).toMatchObject({ tipo: "cortada", nombre: "Jere", calle: "Rivadavia", comercio: "" });
    // Un aviso propio no te desvía ni te lo cuenta.
    await expect(navegacion.locator(".tarjetaEquipoNav:not(.oculto)")).toHaveCount(0);

    // Por voz: «avisar …», «hay un …» y las frases claras sin «avisar».
    const dichos = await page.evaluate(() => [
        "avisar calle cortada", "hay un control", "avisale que hay un pozo", "reportá un choque",
        "tránsito lento", "el comercio está cerrado", "control", "nuevo pedido"
    ].map(frase => {
        const orden = window.vozVendeFrio.interpretar(frase);
        return orden && orden.accion === "avisar" ? orden.tipo : "";
    }));
    expect(dichos).toEqual(["cortada", "control", "pozo", "choque", "lento", "cerrado", "", ""]);
    await page.evaluate(() => window.vozVendeFrio.ejecutar("hay un pozo"));
    await expect(pin).toHaveCount(2);

    // Tocar el aviso: quién y cuándo, y sacarlo si ya no está.
    await navegacion.locator('.pinAvisoCalle[title="Pozo o calle rota · avisó Vos"]').click();
    const detalle = page.getByRole("dialog", { name: "Aviso: Pozo o calle rota" });
    await expect(detalle).toContainText("Avisaste vos · recién · en Rivadavia");
    await detalle.getByRole("button", { name: "Ya no está: sacar el aviso" }).click();
    await expect(pin).toHaveCount(1);
});

test("avisar: una calle cortada en el camino te desvía", async ({ page }) => {
    const pedidos = [];
    await caminosFalsos(page, pedidos);
    await prepararCelular(page, {
        aviso_lucas: { tipo: "cortada", lat: ESQUINA[1], lng: ESQUINA[0], nombre: "Lucas Díaz", idPersona: "p_lucas", calle: "Belgrano", comercio: "", hace: CINCO_MINUTOS }
    });
    await entrarComoRepartidor(page);
    const navegacion = await abrirNavegacion(page);

    // Pide otros recorridos y va por el que no pasa por la esquina.
    await expect.poll(() => pedidos.some(pedido => pedido.includes("alternatives=3"))).toBe(true);
    await expect(navegacion.locator(".textoManiobra")).toHaveText("Doblá a la derecha por Mitre");
    const tarjeta = navegacion.locator(".tarjetaEquipoNav");
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toHaveText(/Lucas avisó:\s*calle cortada en Belgrano\. Te desvié, \+2 min\./);
    await expect(tarjeta.locator(".inicialEquipoNav")).toHaveText("LU");
    await expect(navegacion.locator(".pinAvisoCalle")).toHaveAttribute("title", "Calle cortada · avisó Lucas");

    // La tarjeta no tapa la maniobra ni los créditos del mapa.
    const cajaTarjeta = await tarjeta.boundingBox();
    const cajaCartel = await navegacion.locator(".cartelManiobra").boundingBox();
    const cajaCreditos = await navegacion.locator(".leaflet-control-attribution").boundingBox();
    expect(cajaTarjeta.y).toBeGreaterThanOrEqual(cajaCartel.y + cajaCartel.height);
    expect(cajaTarjeta.y).toBeGreaterThanOrEqual(cajaCreditos.y + cajaCreditos.height);
    await page.waitForTimeout(300);
    await capturar(page, "equipo-02-desvio");

    // Tocarla la cierra.
    await tarjeta.click();
    await expect(tarjeta).toBeHidden();
});

test("avisar: el aviso del equipo en la vista previa de Rutas", async ({ page }) => {
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: SALIDA.lat, longitude: SALIDA.lng });
    await caminosFalsos(page, []);
    await prepararCelular(page, {
        viejo: { tipo: "choque", lat: -34.601, lng: -58.401, nombre: "Ana", idPersona: "p_ana", calle: "", comercio: "", hace: 3 * 3600000 },
        aviso_lucas: { tipo: "control", lat: -34.599, lng: -58.3992, nombre: "Lucas Díaz", idPersona: "p_lucas", calle: "San Martín", comercio: "", hace: CINCO_MINUTOS }
    });
    await entrarComoRepartidor(page);
    await page.evaluate(() => mostrarPantalla("rutas"));
    const rutas = page.locator("#pantallaRutas");
    await expect(rutas.locator(".hojaPlanRutas")).toBeVisible();

    // El de hace 3 horas ya venció: solo el de Lucas.
    const cartel = rutas.locator(".avisoEquipoRutas");
    await expect(cartel).toBeVisible();
    await expect(cartel).toHaveText("Lucas avisó: control en San Martín");
    await expect(rutas.locator(".pinAvisoCalle")).toHaveCount(1);
    await expect(rutas.locator(".pinAvisoCalle")).toHaveAttribute("title", "Control · avisó Lucas");
    // Va arriba de Iniciar, dentro de la hoja.
    const cajaCartel = await cartel.boundingBox();
    const cajaIniciar = await rutas.locator("#btnNavegarRuta").boundingBox();
    expect(cajaCartel.y + cajaCartel.height).toBeLessThanOrEqual(cajaIniciar.y);
    await page.waitForTimeout(300);
    await capturar(page, "equipo-03-rutas");

    // Tocarlo: quién y cuándo; no es tuyo, así que no lo podés sacar.
    await cartel.click();
    const detalle = page.getByRole("dialog", { name: "Aviso: Control" });
    await expect(detalle).toContainText("Lucas avisó · hace 5 min · en San Martín");
    await expect(detalle.getByRole("button", { name: "Ya no está: sacar el aviso" })).toHaveCount(0);
    await detalle.getByRole("button", { name: "Cerrar" }).click();
    await expect(detalle).toBeHidden();
});

test.describe("nube", () => {
    test.use({ nube: true });

    test("compañeros: el dueño ve en Rutas a quien comparte su ubicación", async ({ page }, testInfo) => {
        await registrarDistribuidora(page, testInfo);
        const id = await page.evaluate(() => window.piezas.refNube().id);
        // Lucas comparte su ubicación desde su celular (se escribe directo en
        // el emulador, sin reglas).
        const ahora = Date.now();
        const respuesta = await page.request.patch(
            `http://127.0.0.1:8080/v1/projects/demo-vendefrio/databases/(default)/documents/distribuidoras/${id}/ubicaciones/p_lucas`,
            {
                headers: { Authorization: "Bearer owner" },
                data: { fields: {
                    nombre: { stringValue: "Lucas Díaz" }, lat: { doubleValue: -34.6025 }, lng: { doubleValue: -58.3825 },
                    precision: { integerValue: "8" }, destino: { stringValue: "Almacén Don Pepe" }, paso: { stringValue: "enCamino" },
                    hechas: { integerValue: "1" }, total: { integerValue: "4" }, horaCelular: { integerValue: String(ahora) }
                } }
            });
        expect(respuesta.ok()).toBe(true);

        await page.evaluate(() => mostrarPantalla("rutas"));
        const pin = page.locator("#pantallaRutas .pinCompanero");
        await expect(pin).toHaveCount(1, { timeout: 20000 });
        await expect(pin).toHaveAttribute("title", "Lucas Díaz, repartidor del equipo");
        await expect(pin.locator(".cabezaCompanero")).toHaveText("LU");
    });
});
