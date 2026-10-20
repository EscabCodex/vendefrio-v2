// VendeFrío - Ideas para la 1.0, tanda 3 "Reparto" (T70 a T73), con los
// emuladores de Firebase.
// 1. Prueba de entrega (foto, firma y ubicación) y devolución con motivo.
// 2. "Ya llego" por WhatsApp en la próxima parada.
// 3. Repartidores en el mapa: el repartidor comparte y el dueño lo ve.
const path = require("path");
const { test, expect, capturar, deslizar } = require("./ayudas");
const { registrarDistribuidora, cargarPedido, abrirConfiguracionEn } = require("./recorridos");

test.use({ nube: true });

const COMERCIO = { lat: -34.6037, lng: -58.3816 };

async function abrirPedido(page) {
    const tarjeta = page.locator(".tarjetaSeguimiento", { hasText: "Almacén Don Pepe" }).first();
    await tarjeta.click();
    const ficha = page.locator(".fichaPedido");
    await expect(ficha).toBeVisible();
    return ficha;
}

async function firmar(page) {
    const lienzo = page.locator("#lienzoFirma");
    const caja = await lienzo.boundingBox();
    await page.mouse.move(caja.x + 30, caja.y + 80);
    await page.mouse.down();
    const puntos = [[70, 25], [110, 85], [150, 30], [190, 80], [230, 40], [290, 60], [330, 50]];
    for (const [x, y] of puntos) await page.mouse.move(caja.x + x, caja.y + y, { steps: 4 });
    await page.mouse.up();
}

test("reparto: prueba de entrega y devolución", async ({ page }, testInfo) => {
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: COMERCIO.lat + 0.0001, longitude: COMERCIO.lng });
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(c => actualizarComercioPorNombre("Almacén Don Pepe", { lat: c.lat, lng: c.lng, origenGps: "gps" }), COMERCIO);

    // Pedir foto y firma al entregar (Más > Trabajo).
    await abrirConfiguracionEn(page, "trabajo");
    await page.getByRole("switch", { name: "Pedir foto y firma al entregar" }).check();

    await cargarPedido(page, false);
    const ficha = await abrirPedido(page);
    await deslizar(page, "Deslizá para marcar Entregado");
    const hoja = page.getByRole("dialog", { name: "Prueba de entrega" });
    await expect(hoja).toContainText("Entregar a Almacén Don Pepe");
    await expect(hoja).toContainText("3 u · $ 9.800 · todo opcional");
    await hoja.locator("#archivoFotoEntrega").setInputFiles(path.join(__dirname, "..", "icon-512.png"));
    await expect(hoja.locator(".pzFotoVista")).toHaveCount(1);
    await firmar(page);
    await hoja.locator("#recibioEntrega").fill("Marta · encargada");
    await expect(hoja.locator("#ubicacionEntrega")).toContainText(/Ubicación guardada · a \d+ m del comercio/);
    await capturar(page, "reparto-01-prueba-de-entrega");
    await hoja.getByRole("button", { name: "Entregado" }).click();

    // Cobro: después de la entrega, como siempre.
    await expect(page.getByText("¿Cómo pagó?")).toBeVisible();
    await page.locator("#modalCobroPedido").getByRole("button", { name: "Volver" }).click();

    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("Entregado");
    const prueba = ficha.locator(".seccionPruebaEntrega");
    await expect(prueba).toBeVisible();
    await expect(prueba.locator(".pzFotoVista")).toHaveCount(1);
    await expect(prueba).toContainText("Marta · encargada");
    await expect(prueba).toContainText("Ubicación guardada");
    await prueba.scrollIntoViewIfNeeded();
    await capturar(page, "reparto-02-ficha-con-prueba");

    // Devolución: 1 helado vencido.
    await ficha.getByRole("button", { name: "Más opciones" }).click();
    await page.getByRole("menuitem", { name: "Registrar devolución" }).click();
    const devolucion = page.getByRole("dialog", { name: "Registrar devolución" });
    await devolucion.getByRole("button", { name: "Devolver uno más de Helado 1 kg" }).click();
    await expect(devolucion).toContainText("Vencido · $ 4.500 c/u");
    await expect(devolucion.locator("#descuentoDevolucion")).toContainText("Se descuentan $ 4.500");
    await expect(devolucion.locator("#descuentoDevolucion")).toContainText("Total nuevo: $ 5.300");
    await capturar(page, "reparto-03-devolucion");
    await devolucion.getByRole("button", { name: "Guardar devolución" }).click();
    const seccion = ficha.locator(".seccionDevoluciones");
    await expect(seccion).toContainText("1 Helado 1 kg");
    await expect(seccion).toContainText("− $ 4.500");
    await expect.poll(() => page.evaluate(() => window.nubeVendeFrio.montoACobrar(obtenerHistorial().find(p => p.comercio === "Almacén Don Pepe")))).toBe(5300);
});

test("reparto: ya llego por WhatsApp y repartidores en el mapa", async ({ page }, testInfo) => {
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: COMERCIO.lat - 0.004, longitude: COMERCIO.lng });
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(c => actualizarComercioPorNombre("Almacén Don Pepe", { lat: c.lat, lng: c.lng, origenGps: "gps", contacto: "Pepe Gómez" }), COMERCIO);

    // "Ya llego" en la próxima parada.
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    const parada = page.locator("#dashProximaParada");
    const yaLlego = parada.getByRole("link", { name: "Ya llego" });
    await expect(yaLlego).toHaveAttribute("href", /^https:\/\/wa\.me\/5491155551234\?text=/);
    // (La primera bajada de la nube puede pisar el cambio: se repite.)
    await expect.poll(async () => {
        await page.evaluate(c => {
            if (!buscarComercioPorNombre("Almacén Don Pepe").contacto) {
                actualizarComercioPorNombre("Almacén Don Pepe", { lat: c.lat, lng: c.lng, origenGps: "gps", contacto: "Pepe Gómez" });
                actualizarDashboard();
            }
        }, COMERCIO);
        return decodeURIComponent(String(await yaLlego.getAttribute("href")).split("text=")[1]);
    })
        .toBe("¡Hola Pepe! Soy Jere de Distribuidora Prueba. Ya estoy llegando con tu pedido.");
    await expect(parada.getByRole("link", { name: "Ir" })).toBeVisible();
    await parada.evaluate(el => el.scrollIntoView({ block: "center" }));
    await capturar(page, "reparto-04-ya-llego");

    // Un pedido En reparto: el aviso para compartir la ubicación.
    await cargarPedido(page, false);
    const ficha = await abrirPedido(page);
    await ficha.getByRole("button", { name: "Salir a repartir" }).click();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("En reparto");
    await ficha.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(ficha).toBeHidden();
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    const compartir = page.locator("#avisoCompartirUbicacion");
    await expect(compartir).toContainText("¿Compartís tu ubicación?");
    await compartir.getByRole("button", { name: "Activar: compartir mi ubicación" }).click();
    await expect(compartir).toContainText("Compartiendo tu ubicación");

    // El dueño (acá, el mismo) ve "Repartiendo ahora".
    const aviso = page.locator("#avisoRepartiendo");
    await expect(aviso).toContainText("Jere está repartiendo", { timeout: 20000 });
    await aviso.getByRole("button", { name: "Ver mapa" }).click();
    const pantalla = page.locator("#pantallaRepartidores");
    await expect(pantalla).toBeVisible();
    const fila = pantalla.locator(".pzFila", { hasText: "Jere" });
    await expect(fila).toContainText("Va a Almacén Don Pepe · 1 de 1");
    await expect(fila.locator(".pzChip")).toHaveText("En camino");
    await expect(pantalla.locator(".pinRepartidorCabeza")).toHaveCount(1);
    await capturar(page, "reparto-05-repartiendo-ahora");

    // Al entregar el último, se apaga sola.
    await page.evaluate(() => {
        const pedido = obtenerHistorial().find(p => p.comercio === "Almacén Don Pepe");
        window.nubeVendeFrio.entregarPedido(pedido.id, {});
        actualizarDashboard();
    });
    await expect(page.locator("#avisoCompartirUbicacion")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.repartidoresVendeFrio.compartiendo())).toBe(false);
});
