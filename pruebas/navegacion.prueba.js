// VendeFrío - Navegación propia (Etapa 5, T41 y T42): desde la ficha del
// comercio, "Ir" abre el mapa con la línea del camino, la próxima maniobra y
// la hoja con los datos del comercio; al llegar, deslizar "Llegué" lo marca
// visitado.
// El GPS es falso y el camino (que en la app calcula el OSRM público) lo
// contesta la prueba, así no hace falta internet.
const { test, expect, capturar, deslizar } = require("./ayudas");
const { registrarDistribuidora } = require("./recorridos");

test.use({ nube: true });

const COMERCIO = { lat: -34.6, lng: -58.4 };
const SALIDA = { latitude: -34.605, longitude: -58.405 };
const ESQUINA = [-58.4, -34.605];

// Camino falso: al este por Rivadavia, a la izquierda por Belgrano y llegada.
const CAMINO = {
    code: "Ok",
    routes: [{
        distance: 1015,
        duration: 240,
        geometry: { type: "LineString", coordinates: [[SALIDA.longitude, SALIDA.latitude], ESQUINA, [COMERCIO.lng, COMERCIO.lat]] },
        legs: [{
            steps: [
                { name: "Rivadavia", maneuver: { type: "depart", modifier: "", location: [SALIDA.longitude, SALIDA.latitude] } },
                { name: "Belgrano", maneuver: { type: "turn", modifier: "left", location: ESQUINA } },
                { name: "", maneuver: { type: "arrive", modifier: "", location: [COMERCIO.lng, COMERCIO.lat] } }
            ]
        }]
    }]
};

test("navegación: ir al comercio con indicaciones y marcar la llegada", async ({ page }, testInfo) => {
    // Lo que dice la voz queda anotado para revisarlo.
    await page.addInitScript(() => {
        window.__dichos = [];
        if (window.speechSynthesis) {
            // Cada frase "termina" enseguida, así pasa la que sigue en la fila (T131).
            window.speechSynthesis.speak = frase => {
                window.__dichos.push(frase.text);
                setTimeout(() => frase.onend && frase.onend(), 30);
            };
        }
    });
    // T133: el camino se pide siempre con el perfil de auto (sin pasos peatonales).
    const pedidosDeCamino = [];
    await page.route("https://routing.openstreetmap.de/**", ruta => {
        pedidosDeCamino.push(ruta.request().url());
        return ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CAMINO) });
    });
    page.on("request", pedido => {
        if (pedido.url().includes("router.project-osrm.org")) pedidosDeCamino.push(pedido.url());
    });
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation(SALIDA);

    await registrarDistribuidora(page, testInfo);
    await page.evaluate(({ lat, lng }) =>
        agregarComercio({ nombre: "Kiosco La Esquina", direccion: "Belgrano 450", telefono: "11 4444-0000", lat, lng, origenGps: "gps" }),
    COMERCIO);

    // Comercios > ficha > "Ir".
    await page.locator(".bottom-nav").getByRole("button", { name: "Comercios" }).click();
    await page.locator(".comercioCard", { hasText: "Kiosco La Esquina" }).click();
    await page.locator(".fichaComercioNueva").getByRole("link", { name: "Ir" }).click();

    // T154: la primera vez, una hoja pregunta cómo ir.
    const eleccion = page.getByRole("dialog", { name: "¿Cómo querés ir?" });
    await expect(eleccion).toBeVisible();
    await expect(eleccion.getByRole("button", { name: "Google Maps" })).toBeVisible();
    await expect(eleccion).toContainText("Lo podés cambiar cuando quieras en Más > Recorrido.");
    await capturar(page, "navegacion-00-como-queres-ir");
    await eleccion.getByRole("button", { name: "Navegación de VendeFrío" }).click();
    await expect(eleccion).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vendefrio_preferencias")).navegador)).toBe("app");

    const navegacion = page.locator("#pantallaNavegacion");
    await expect(navegacion).toBeVisible();
    await expect(page.locator(".bottom-nav")).toBeHidden();
    await expect(navegacion.locator(".nombreNavegacion")).toHaveText("Kiosco La Esquina");
    await expect(navegacion.locator(".textoManiobra")).toHaveText("Doblá a la izquierda por Belgrano");
    await expect(navegacion.locator(".distanciaManiobra")).toHaveText(/m$/);
    await expect(navegacion.locator(".tiempoNavegacion")).toHaveText(/min/);
    await expect(navegacion.locator("path.lineaCamino")).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => window.__dichos.join(" | "))).toContain("doblá a la izquierda por Belgrano");
    await capturar(page, "navegacion-01-camino");

    // La hoja se abre hacia arriba con más datos.
    await navegacion.getByRole("button", { name: "Ver más datos del comercio" }).click();
    await expect(navegacion.locator(".hojaMas")).toBeVisible();
    await expect(navegacion.getByRole("link", { name: "Abrir en Google Maps" })).toBeVisible();
    await capturar(page, "navegacion-02-hoja-abierta");
    await navegacion.getByRole("button", { name: "Ver más datos del comercio" }).click();

    // Silenciar la voz.
    await navegacion.getByRole("button", { name: "Silenciar la voz" }).click();
    await expect(navegacion.getByRole("button", { name: "Prender la voz" })).toBeVisible();
    await navegacion.getByRole("button", { name: "Prender la voz" }).click();

    // T132: al avanzar por Rivadavia, la línea se borra detrás y arranca donde estás.
    const largoDeLaLinea = () => page.evaluate(() => document.querySelector("#pantallaNavegacion path.lineaCamino").getTotalLength());
    const largoAlSalir = await largoDeLaLinea();
    await page.context().setGeolocation({ latitude: SALIDA.latitude, longitude: -58.4015 });
    await expect.poll(largoDeLaLinea).toBeLessThan(largoAlSalir * 0.8);
    await expect(navegacion.locator("path.lineaHecha")).toHaveCount(1);
    await expect(navegacion.locator(".textoManiobra")).toHaveText("Doblá a la izquierda por Belgrano");
    await capturar(page, "navegacion-02b-linea-recortada");

    expect(pedidosDeCamino.length).toBeGreaterThan(0);
    pedidosDeCamino.forEach(url => expect(url).toMatch(/^https:\/\/routing\.openstreetmap\.de\/routed-car\/route\/v1\/driving\//));

    // Llegada.
    await page.context().setGeolocation({ latitude: COMERCIO.lat, longitude: COMERCIO.lng });
    await expect(navegacion.locator(".tiempoNavegacion")).toHaveText("Llegaste");
    await expect.poll(() => page.evaluate(() => window.__dichos.join(" | "))).toContain("Llegaste a Kiosco La Esquina");
    await capturar(page, "navegacion-03-llegaste");

    await deslizar(page, "Deslizá para marcar Llegué");
    await expect(navegacion).toBeHidden();
    await expect(page.locator(".bottom-nav")).toBeVisible();
    const visitado = await page.evaluate(() => estaVisitadoEstaSemana(buscarComercioPorNombre("Kiosco La Esquina")));
    expect(visitado).toBe(true);
});

// T154: si se elige Google Maps, se abre Google Maps y la hoja no vuelve a
// salir; quien ya había elegido en Más > Recorrido tampoco la ve.
test("navegación: elegir Google Maps la primera vez que se toca Ir", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(({ lat, lng }) =>
        agregarComercio({ nombre: "Kiosco La Esquina", direccion: "Belgrano 450", lat, lng, origenGps: "gps" }),
    COMERCIO);
    // Google Maps de mentira: no hace falta internet.
    await page.context().route("https://www.google.com/**", ruta => ruta.fulfill({ status: 200, contentType: "text/html", body: "Google Maps" }));

    const tocarIr = async () => {
        await page.locator(".bottom-nav").getByRole("button", { name: "Comercios" }).click();
        await page.locator(".comercioCard", { hasText: "Kiosco La Esquina" }).click();
        await page.locator(".fichaComercioNueva").getByRole("link", { name: "Ir" }).click();
    };
    const eleccion = page.getByRole("dialog", { name: "¿Cómo querés ir?" });

    await tocarIr();
    await expect(eleccion).toBeVisible();
    const [googleMaps] = await Promise.all([
        page.waitForEvent("popup"),
        eleccion.getByRole("button", { name: "Google Maps" }).click()
    ]);
    expect(googleMaps.url()).toContain("google.com/maps/dir/");
    await googleMaps.close();
    await expect(eleccion).toBeHidden();
    await expect(page.locator("#pantallaNavegacion")).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vendefrio_preferencias")).navegador)).toBe("google");

    // La segunda vez va derecho a Google Maps.
    await page.evaluate(() => window.cerrarFichaComercio());
    const [otraVez] = await Promise.all([page.waitForEvent("popup"), tocarIr()]);
    await otraVez.close();
    await expect(eleccion).toHaveCount(0);

    // Quien ya eligió en Más > Recorrido no ve la hoja.
    await page.evaluate(() => {
        const datos = JSON.parse(localStorage.getItem("vendefrio_preferencias"));
        localStorage.setItem("vendefrio_preferencias", JSON.stringify({ ...datos, navegador: "app" }));
        window.cerrarFichaComercio();
    });
    await tocarIr();
    await expect(page.locator("#pantallaNavegacion")).toBeVisible();
    await expect(eleccion).toHaveCount(0);
});
