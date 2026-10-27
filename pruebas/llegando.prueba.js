// VendeFrío - Pantalla «Llegando» (T135), en un celular chico (360×640).
// Sin más giros y a menos de 150 m del comercio, la tarjeta de arriba dice
// de qué lado queda y la hoja se agranda sola (una vez por parada): lo que
// hay para entregar y cobrar, Llamar, WhatsApp, Ya llego y Cargar pedido,
// «Deslizá para marcar Llegué», Saltear parada y Salir. Tu posición se sigue
// viendo arriba de la hoja. El GPS y el camino son falsos.
const { test, expect, capturar, deslizar } = require("./ayudas");

test.use({ viewport: { width: 360, height: 640 } });

const SALIDA = { lat: -34.605, lng: -58.405 };
const ESQUINA = [-58.4, -34.605];
// Metros a grados de latitud.
const GRADOS_POR_METRO = 1 / 111320;
const PARADAS = [
    { nombre: "Almacén Don Tito", direccion: "Mitre 1220", lat: -34.6, lng: -58.4 },
    { nombre: "Súper El Sol", direccion: "Belgrano 300", lat: -34.598, lng: -58.398 },
    { nombre: "Kiosco Luna", direccion: "Sarmiento 80", lat: -34.596, lng: -58.396 }
];

// Camino falso: al este por Rivadavia, a la izquierda por Mitre y el
// comercio queda a la derecha.
function camino(destino) {
    return {
        code: "Ok",
        routes: [{
            distance: 1015,
            duration: 240,
            geometry: { type: "LineString", coordinates: [[SALIDA.lng, SALIDA.lat], ESQUINA, [destino[0], destino[1]]] },
            legs: [{
                steps: [
                    { name: "Rivadavia", maneuver: { type: "depart", modifier: "", location: [SALIDA.lng, SALIDA.lat] } },
                    { name: "Mitre", maneuver: { type: "turn", modifier: "left", location: ESQUINA } },
                    { name: "", maneuver: { type: "arrive", modifier: "right", location: destino } }
                ]
            }]
        }]
    };
}

test("llegando: a 150 m se agranda la hoja con todo para la parada", async ({ page }) => {
    await page.addInitScript(() => {
        window.__dichos = [];
        if (window.speechSynthesis) {
            window.speechSynthesis.speak = frase => {
                window.__dichos.push(frase.text);
                setTimeout(() => frase.onend && frase.onend(), 30);
            };
        }
        navigator.geolocation.watchPosition = exito => {
            window.__gps = (lat, lng) => exito({ coords: { latitude: lat, longitude: lng, speed: 6, accuracy: 5, heading: null }, timestamp: Date.now() });
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
        // Un pedido para entregar en la primera y un saldo que debe.
        guardarHistorial([{
            comercio: "Almacén Don Tito", timestamp: Date.now(),
            productos: [{ marca: "Pastas", producto: "Ravioles", cantidad: 10, precio: 3450 }],
            estados: { e1: { estado: "enReparto", horaCelular: Date.now() } }
        }]);
        window.saldosVendeFrio.cuentaDe = nombre => (nombre === "Almacén Don Tito" ? { total: 12000 } : null);
        window.navegacionVendeFrio.abrir(paradas.map(parada => parada.nombre));
    }, PARADAS);

    const navegacion = page.locator("#pantallaNavegacion");
    const hoja = navegacion.locator(".hojaNavegacion");
    const cartel = navegacion.locator(".cartelManiobra");
    const irA = metrosAntes => page.evaluate(({ lat, lng }) => window.__gps(lat, lng),
        { lat: PARADAS[0].lat - metrosAntes * GRADOS_POR_METRO, lng: PARADAS[0].lng });
    await expect(navegacion).toBeVisible();
    await page.evaluate(({ lat, lng }) => window.__gps(lat, lng), SALIDA);
    await expect(cartel.locator(".textoManiobra")).toHaveText("Doblá a la izquierda por Mitre");

    // Ya en Mitre, a 300 m: todavía «Manejando», la hoja cerrada.
    await irA(300);
    await expect(cartel.locator(".distanciaManiobra")).toHaveText(/^\d+ m$/);
    await expect(hoja).toBeHidden();

    // A 100 m: «Llegando», de qué lado queda, la voz lo dice y la hoja se agranda sola.
    await irA(100);
    await expect(cartel.locator(".distanciaManiobra")).toHaveText(/^Llegando · \d+ m$/);
    await expect(cartel.locator(".textoManiobra")).toHaveText("El comercio queda a tu derecha");
    await expect.poll(() => page.evaluate(() => window.__dichos)).toContain("Llegando a Almacén Don Tito. Queda a tu derecha");
    await expect(hoja).toBeVisible();
    await expect(hoja.locator(".nombreNavegacion")).toHaveText("Almacén Don Tito");
    await expect(hoja.locator(".direccionNavegacion")).toHaveText("Mitre 1220 · parada 1 de 3");
    await expect(hoja.locator(".chipPedido")).toHaveText("Pedido $ 34.500");
    await expect(hoja.locator(".chipSaldo")).toHaveText("Cobrar saldo $ 12.000");
    await expect(hoja.getByRole("link", { name: "Llamar" })).toBeVisible();
    await expect(hoja.getByRole("link", { name: "WhatsApp" })).toBeVisible();
    await expect(hoja.getByRole("link", { name: "Ya llego" })).toBeVisible();
    await expect(hoja.getByRole("button", { name: "Cargar pedido" })).toBeVisible();
    await expect(hoja.getByRole("button", { name: /Deslizá para marcar Llegué/ })).toBeVisible();
    await expect(hoja.getByRole("button", { name: "Saltear parada" })).toBeVisible();
    // Desde la hoja no se sale de la navegación (pedido del dueño): sin «Salir».
    await expect(hoja.getByRole("button", { name: "Salir" })).toHaveCount(0);

    // En la pantalla chica: lo de arriba no se pisa con la hoja, la hoja
    // entra hasta «Saltear parada» sin bajar y tu posición se ve en el medio de las dos.
    const cajaCartel = await cartel.boundingBox();
    const cajaHoja = await hoja.boundingBox();
    expect(cajaCartel.y + cajaCartel.height).toBeLessThanOrEqual(cajaHoja.y);
    const cajaSalir = await hoja.getByRole("button", { name: "Saltear parada" }).boundingBox();
    expect(cajaSalir.y + cajaSalir.height).toBeLessThanOrEqual(640);
    await expect.poll(async () => {
        const yo = await navegacion.locator(".marcadorYoNav").boundingBox();
        const centro = yo.y + yo.height / 2;
        return Math.abs(centro - (cajaCartel.y + cajaCartel.height + cajaHoja.y) / 2) < 24;
    }).toBe(true);
    await capturar(page, "llegando-01-hoja-grande");

    // Si la cerrás, no vuelve a abrirse sola en esta parada.
    await hoja.getByRole("button", { name: "Ver más datos del comercio" }).click();
    await expect(hoja).toBeHidden();
    await irA(80);
    await expect(cartel.locator(".distanciaManiobra")).toHaveText(/^Llegando · \d+ m$/);
    await page.waitForTimeout(300);
    await expect(hoja).toBeHidden();

    // Tocar la tarjeta la abre; deslizar «Llegué» marca la visita y pasa a la segunda.
    await navegacion.locator(".paradaActualNavegacion").click();
    await expect(hoja).toBeVisible();
    await deslizar(page, "Deslizá para marcar Llegué");
    await expect(navegacion.locator(".numeroTarjetaParada")).toHaveText("Parada 2 de 3");
    expect(await page.evaluate(() => estaVisitadoEstaSemana(buscarComercioPorNombre("Almacén Don Tito")))).toBe(true);
    await expect(hoja).toBeHidden();

    // Saltear parada: pasa a la tercera sin marcar la visita.
    await navegacion.locator(".paradaActualNavegacion").click();
    await expect(hoja.locator(".chipsHoja")).toBeHidden();
    await hoja.getByRole("button", { name: "Saltear parada" }).click();
    await expect(navegacion.locator(".numeroTarjetaParada")).toHaveText("Parada 3 de 3");
    expect(await page.evaluate(() => estaVisitadoEstaSemana(buscarComercioPorNombre("Súper El Sol")))).toBe(false);

    // La flechita achica la hoja; para salir queda la X flotante del mapa.
    await navegacion.locator(".paradaActualNavegacion").click();
    await hoja.getByRole("button", { name: "Achicar la tarjeta" }).click();
    await expect(hoja).toBeHidden();
    await expect(navegacion).toBeVisible();
    await navegacion.getByRole("button", { name: "Terminar navegación" }).click();
    await expect(navegacion).toBeHidden();
});
