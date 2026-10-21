// VendeFrío - La voz de la navegación dice cada frase entera (T131).
// Las frases van en fila: la nueva espera a que termine la que se está
// diciendo, y si mientras tanto dejó de servir (llegó una más nueva para la
// misma maniobra) se descarta. Lo que dice se ve escrito en la tarjeta de la
// maniobra. La voz, el GPS y el camino son falsos: la prueba decide cuándo
// termina cada frase y dónde está el celular.
const { test, expect, capturar } = require("./ayudas");

const COMERCIO = { lat: -34.6, lng: -58.4 };
const SALIDA = { lat: -34.605, lng: -58.405 };
const ESQUINA = [-58.4, -34.605];
// Metros a grados de longitud, a esta latitud.
const GRADOS_POR_METRO = 1 / 91620;

const CAMINO = {
    code: "Ok",
    routes: [{
        distance: 1015,
        duration: 240,
        geometry: { type: "LineString", coordinates: [[SALIDA.lng, SALIDA.lat], ESQUINA, [COMERCIO.lng, COMERCIO.lat]] },
        legs: [{
            steps: [
                { name: "Rivadavia", maneuver: { type: "depart", modifier: "", location: [SALIDA.lng, SALIDA.lat] } },
                { name: "Belgrano", maneuver: { type: "turn", modifier: "left", location: ESQUINA } },
                { name: "", maneuver: { type: "arrive", modifier: "", location: [COMERCIO.lng, COMERCIO.lat] } }
            ]
        }]
    }]
};

test("voz de la navegación: frases enteras, en fila y escritas", async ({ page }) => {
    await page.addInitScript(() => {
        // Voz falsa: anota lo que dice y no termina hasta que la prueba lo pide.
        const voz = {
            speaking: false, pending: false, paused: false, dichos: [], cortes: 0, actual: null,
            getVoices: () => [],
            speak(frase) { this.speaking = true; this.actual = frase; this.dichos.push(frase.text); },
            cancel() { this.cortes++; this.speaking = false; this.actual = null; },
            resume() {}, pause() {}
        };
        Object.defineProperty(window, "speechSynthesis", { value: voz, configurable: true });
        if (typeof window.SpeechSynthesisUtterance !== "function") {
            window.SpeechSynthesisUtterance = function (texto) { this.text = texto; };
        }
        window.__voz = voz;
        window.__terminarFrase = () => {
            const frase = voz.actual;
            voz.actual = null;
            voz.speaking = false;
            if (frase && frase.onend) frase.onend();
        };
        // GPS falso que maneja la prueba (a 8 m/s, unos 30 km/h).
        navigator.geolocation.watchPosition = exito => {
            window.__gps = (lat, lng) => exito({ coords: { latitude: lat, longitude: lng, speed: 8, accuracy: 5 }, timestamp: Date.now() });
            return 1;
        };
        navigator.geolocation.clearWatch = () => {};
    });
    await page.route("https://routing.openstreetmap.de/**", ruta =>
        ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CAMINO) })
    );

    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Repartidor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(({ lat, lng }) => {
        agregarComercio({ nombre: "Kiosco La Esquina", direccion: "Belgrano 450", lat, lng, origenGps: "gps" });
        window.navegacionVendeFrio.abrir("Kiosco La Esquina");
    }, COMERCIO);

    const navegacion = page.locator("#pantallaNavegacion");
    const frase = navegacion.locator(".fraseManiobra");
    const dichos = () => page.evaluate(() => window.__voz.dichos.slice());
    const irA = metrosAntesDeLaEsquina => page.evaluate(({ lat, lng }) => window.__gps(lat, lng),
        { lat: SALIDA.lat, lng: ESQUINA[0] - metrosAntesDeLaEsquina * GRADOS_POR_METRO });

    // Al salir: dice la primera maniobra y se ve escrita en la tarjeta.
    await expect(navegacion).toBeVisible();
    await page.evaluate(({ lat, lng }) => window.__gps(lat, lng), SALIDA);
    await expect.poll(dichos).toEqual(["En 450 metros, doblá a la izquierda por Belgrano"]);
    await expect(frase).toHaveText("En 450 metros, doblá a la izquierda por Belgrano");
    await expect(navegacion.locator(".textoManiobra")).toHaveText("Doblá a la izquierda por Belgrano");
    await capturar(page, "vozNavegacion-01-frase-escrita");

    // A 150 m llega otra frase, pero la primera todavía se está diciendo:
    // no se corta, la nueva espera.
    await irA(150);
    await expect(navegacion.locator(".distanciaManiobra")).toHaveText("150 m");
    expect(await dichos()).toHaveLength(1);
    expect(await page.evaluate(() => window.__voz.cortes)).toBe(0);

    // A 30 m, la de "justo antes" reemplaza a la de 150 m, que ya no sirve.
    // (La app adelanta lo que avanzás mientras llega el GPS: marca 20 m.)
    await irA(30);
    await expect(navegacion.locator(".distanciaManiobra")).toHaveText("20 m");
    expect(await dichos()).toHaveLength(1);

    // Termina la primera: sigue la más nueva, entera, y se ve escrita.
    await page.evaluate(() => window.__terminarFrase());
    await expect.poll(dichos).toEqual([
        "En 450 metros, doblá a la izquierda por Belgrano",
        "Doblá a la izquierda por Belgrano"
    ]);
    await expect(frase).toHaveText("Doblá a la izquierda por Belgrano");

    // Cuando no dice nada, la tarjeta no muestra la frase.
    await page.evaluate(() => window.__terminarFrase());
    await expect(frase).toBeHidden();

    // Llegar al comercio.
    await page.evaluate(({ lat, lng }) => window.__gps(lat, lng), COMERCIO);
    await expect(navegacion.locator(".tiempoNavegacion")).toHaveText("Llegaste");
    await expect.poll(dichos).toContain("Llegaste a Kiosco La Esquina");
    await expect(frase).toHaveText("Llegaste a Kiosco La Esquina");
    expect(await page.evaluate(() => window.__voz.cortes)).toBe(0);

    // Silenciar corta la frase y la borra de la tarjeta.
    await navegacion.getByRole("button", { name: "Silenciar la voz" }).click();
    expect(await page.evaluate(() => window.__voz.cortes)).toBe(1);
    await expect(frase).toBeHidden();
    await navegacion.getByRole("button", { name: "Prender la voz" }).click();
});
