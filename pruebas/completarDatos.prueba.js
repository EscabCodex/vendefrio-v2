// VendeFrío - Completar los datos del comercio desde cualquier pantalla
// (T180), con los emuladores de Firebase.
// 1. Inicio: sin dirección ni teléfono, la próxima parada muestra
//    «Agregar dirección» y «Agregar tel.», y tocarlos abre para cargarlo.
// 2. Ficha del pedido: sin dirección, «Agregar dirección» bajo el nombre.
// 3. Con la dirección cargada, el botón se va y vuelve la dirección.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, cargarPedido } = require("./recorridos");

test.use({ nube: true });

test("sin un dato del comercio, se carga desde la misma pantalla", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(() => actualizarComercioPorNombre("Almacén Don Pepe", { direccion: "", telefono: "" }));
    await page.evaluate(() => actualizarDashboard());

    // 1. Inicio: la próxima parada.
    const parada = page.locator("#dashProximaParada");
    await expect(parada.locator(".paradaInfo strong")).toHaveText("Almacén Don Pepe");
    const agregarDireccion = parada.getByRole("button", { name: "Agregar dirección" });
    await expect(agregarDireccion).toBeVisible();
    await expect(parada.getByRole("button", { name: "Agregar teléfono de Almacén Don Pepe" })).toBeVisible();
    await expect(parada.locator(".paradaLlamar")).toHaveCount(0);
    await parada.evaluate(caja => caja.scrollIntoView({ block: "center" }));
    await capturar(page, "completar-01-inicio-sin-datos");

    await agregarDireccion.click();
    await expect(page.locator(".modalFichaComercio, .pzHoja").first()).toBeVisible();
    await page.keyboard.press("Escape");

    // 2. Ficha del pedido.
    await cargarPedido(page, false);
    const tarjeta = page.locator(".tarjetaSeguimiento", { hasText: "Almacén Don Pepe" }).first();
    await tarjeta.click();
    const ficha = page.locator(".fichaPedido");
    await expect(ficha).toBeVisible();
    await expect(ficha.locator(".direccionFichaPedido").getByRole("button", { name: "Agregar dirección" })).toBeVisible();
    await capturar(page, "completar-02-ficha-pedido-sin-direccion");

    // 3. Con los datos, vuelven la dirección y Llamar.
    await page.evaluate(() => actualizarComercioPorNombre("Almacén Don Pepe", { direccion: "San Martín 123", telefono: "11 5555-1234" }));
    await page.evaluate(() => window.seguimientoVendeFrio.redibujarFicha());
    await expect(ficha.locator(".direccionFichaPedido")).toHaveText("San Martín 123");
    await expect(ficha.locator(".agregarDato")).toHaveCount(0);
});
