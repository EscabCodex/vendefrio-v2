// VendeFrío - Pantalla «Manejando» (T134), en un celular chico (360×640).
// Arriba, la barra del día y la tarjeta grande de la maniobra (distancia,
// calle, carriles y «Luego …»), que nada tapa; abajo, la tarjeta chica de la
// parada con minutos y hora de llegada y la siguiente asomando; a los
// costados, el velocímetro, la voz y salir. Tocar la tarjeta abre la hoja.
// El GPS y el camino son falsos.
const { test, expect, capturar } = require("./ayudas");

test.use({ viewport: { width: 360, height: 640 } });

const SALIDA = { lat: -34.605, lng: -58.405 };
const ESQUINA = [-58.4, -34.605];
const PARADAS = [
    { nombre: "Almacén Don Tito", direccion: "Mitre 1220", lat: -34.6, lng: -58.4 },
    { nombre: "Súper El Sol", direccion: "Belgrano 300", lat: -34.598, lng: -58.398 },
    { nombre: "Kiosco Luna", direccion: "Sarmiento 80", lat: -34.596, lng: -58.396 }
];

// Camino falso: al este por Rivadavia, a la izquierda por Belgrano (con
// carriles: sirve el de la izquierda) y llegada.
function camino(destino) {
    return {
        code: "Ok",
        routes: [{
            distance: 1015,
            duration: 240,
            geometry: { type: "LineString", coordinates: [[SALIDA.lng, SALIDA.lat], ESQUINA, [destino[0], destino[1]]] },
            legs: [{
                steps: [
                    { name: "Rivadavia", maneuver: { type: "depart", modifier: "", location: [SALIDA.lng, SALIDA.lat] }, intersections: [{}] },
                    {
                        name: "Belgrano", maneuver: { type: "turn", modifier: "left", location: ESQUINA },
                        intersections: [{ lanes: [
                            { valid: true, indications: ["left"] },
                            { valid: false, indications: ["straight"] },
                            { valid: false, indications: ["straight", "right"] }
                        ] }]
                    },
                    { name: "", maneuver: { type: "arrive", modifier: "", location: destino } }
                ]
            }]
        }]
    };
}

// Las cajas no se pisan.
function noSePisan(a, b) {
    return a.y + a.height <= b.y || b.y + b.height <= a.y || a.x + a.width <= b.x || b.x + b.width <= a.x;
}

test("manejando: maniobra grande, barra del día y tarjeta de la parada", async ({ page }) => {
    await page.addInitScript(() => {
        if (window.speechSynthesis) window.speechSynthesis.speak = frase => setTimeout(() => frase.onend && frase.onend(), 30);
        navigator.geolocation.watchPosition = exito => {
            window.__gps = (lat, lng) => exito({ coords: { latitude: lat, longitude: lng, speed: 8, accuracy: 5, heading: null }, timestamp: Date.now() });
            return 1;
        };
        navigator.geolocation.clearWatch = () => {};
    });
    await page.route("https://routing.openstreetmap.de/**", ruta => {
        const puntos = new URL(ruta.request().url()).pathname.split("/").pop().split(";").map(par => par.split(",").map(Number));
        return ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(camino(puntos[puntos.length - 1])) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Repartidor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(paradas => {
        paradas.forEach(parada => agregarComercio({ ...parada, telefono: "11 4444-0000", origenGps: "gps" }));
        window.navegacionVendeFrio.abrir(paradas.map(parada => parada.nombre));
    }, PARADAS);

    const navegacion = page.locator("#pantallaNavegacion");
    await expect(navegacion).toBeVisible();
    await page.evaluate(({ lat, lng }) => window.__gps(lat, lng), SALIDA);
    await page.evaluate(({ lat, lng }) => window.__gps(lat, lng + 0.0005), SALIDA);

    // Barra del día: una rayita por parada, la primera es la que sigue.
    const barra = navegacion.locator(".barraDiaNavegacion");
    await expect(barra.locator(".rayaDia")).toHaveCount(3);
    await expect(barra.locator(".rayaDia.actual")).toHaveCount(1);
    await expect(barra).toHaveAttribute("aria-label", "Parada 1 de 3");

    // Tarjeta grande de la maniobra, con carriles y lo que viene después.
    const cartel = navegacion.locator(".cartelManiobra");
    await expect(cartel.locator(".textoManiobra")).toHaveText("Doblá a la izquierda por Belgrano");
    await expect(cartel.locator(".distanciaManiobra")).toHaveText(/^\d+ m$/);
    await expect(cartel.getByRole("img", { name: "Usá el carril 1 de 3" })).toBeVisible();
    await expect(cartel.locator(".luegoManiobra")).toHaveText("Luego llegás");

    // Abajo: la parada, con minutos y hora de llegada, y la siguiente asomando.
    const tarjeta = navegacion.locator(".paradaActualNavegacion");
    await expect(tarjeta.locator(".numeroTarjetaParada")).toHaveText("Parada 1 de 3");
    await expect(tarjeta.locator(".nombreTarjetaParada")).toHaveText("Almacén Don Tito");
    await expect(tarjeta.locator(".direccionTarjetaParada")).toHaveText("Mitre 1220");
    await expect(tarjeta.locator(".minutosTarjetaParada")).toHaveText(/min$/);
    await expect(tarjeta.locator(".detalleTarjetaParada")).toHaveText(/m · \d\d:\d\d$/);
    await expect(navegacion.locator(".siguienteParadaNavegacion strong")).toHaveText("Súper El Sol");

    // Velocímetro (8 m/s son 29 km/h), voz y salir.
    await expect(navegacion.locator(".velocimetroNavegacion strong")).toHaveText("29");
    await expect(navegacion.getByRole("button", { name: "Silenciar la voz" })).toBeVisible();
    await expect(navegacion.getByRole("button", { name: "Terminar navegación" })).toBeVisible();

    // En la pantalla chica nada tapa la maniobra y todo entra.
    const caja = async selector => navegacion.locator(selector).first().boundingBox();
    const cajaCartel = await caja(".cartelManiobra");
    const otras = [
        await caja(".paradaActualNavegacion"), await caja(".velocimetroNavegacion"),
        await caja(".botonesNavegacion"), await caja(".barraDiaNavegacion")
    ];
    otras.forEach(otra => expect(noSePisan(cajaCartel, otra)).toBe(true));
    expect(noSePisan(otras[0], otras[1])).toBe(true);
    expect(noSePisan(otras[0], otras[2])).toBe(true);
    [cajaCartel, ...otras].forEach(c => {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.y + c.height).toBeLessThanOrEqual(640);
    });
    await capturar(page, "manejando-01-maniobra-y-parada");

    // Tocar la tarjeta abre la hoja con todo (Llamar, WhatsApp, Cargar pedido, Llegué).
    await tarjeta.click();
    const hoja = navegacion.locator(".hojaNavegacion");
    await expect(hoja).toBeVisible();
    await expect(hoja.getByRole("link", { name: "Llamar" })).toBeVisible();
    await expect(hoja.getByRole("button", { name: "Llegué" })).toBeVisible();
    await expect(tarjeta).toBeHidden();
    await expect(hoja.getByRole("button", { name: "Silenciar la voz" })).toBeVisible();
    await capturar(page, "manejando-02-hoja-abierta");
    await hoja.getByRole("button", { name: "Ver más datos del comercio" }).click();
    await expect(hoja).toBeHidden();
    await expect(tarjeta).toBeVisible();

    // Llegué en la primera: pasa a la segunda y la barra avanza.
    await page.evaluate(() => window.navegacionVendeFrio.siguiente());
    await expect(tarjeta.locator(".numeroTarjetaParada")).toHaveText("Parada 2 de 3");
    await expect(barra.locator(".rayaDia.hecha")).toHaveCount(1);
    await expect(navegacion.locator(".siguienteParadaNavegacion strong")).toHaveText("Kiosco Luna");
});
