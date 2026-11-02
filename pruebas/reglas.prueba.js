// VendeFrío - Pasada de reglas por las pantallas ya repasadas (2026-11-02).
// - La hoja "¿Qué hago acá?" muestra los números de cada paso (una llave de
//   más en piezas.css borraba su margen y el 1, 2, 3 quedaban afuera).
// - Con la ficha de un pedido abierta (y su menú ⋯), tocar otra sección de
//   la barra de abajo cierra la ficha: antes quedaba flotando encima.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, cargarPedido, irAPedidos } = require("./recorridos");

test.use({ nube: true });

test("reglas: números de la Ayuda y la ficha se cierra al cambiar de sección", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await cargarPedido(page, false);
    await irAPedidos(page);

    // Ayuda: los números de los pasos se ven dentro de la hoja.
    await page.locator("#pantallaPedido > header .botonAyudaPantalla").click();
    const pasos = page.locator(".hojaAyuda .pasosAyuda");
    await expect(pasos).toBeVisible();
    const margen = await pasos.evaluate(lista => parseFloat(getComputedStyle(lista).paddingLeft));
    expect(margen).toBeGreaterThanOrEqual(24);
    await capturar(page, "reglas-01-ayuda-con-numeros");
    await page.locator(".hojaAyuda").getByRole("button", { name: "Entendido" }).click();
    await expect(pasos).toBeHidden();

    // Ficha del pedido con el ⋯ abierto y, abajo, "Comercios".
    await page.locator("#pantallaPedido .tarjetaSeguimiento", { hasText: "Almacén Don Pepe" }).first().click();
    const ficha = page.locator("#modalFichaPedido");
    await expect(ficha).toBeVisible();
    await ficha.locator(".fichaMenuBoton").click();
    await expect(ficha.locator(".fichaMenu")).toBeVisible();
    await page.locator(".bottom-nav").getByRole("button", { name: "Comercios" }).click();
    await expect(ficha).toBeHidden();
    await expect(page.locator("#pantallaComercios")).toBeVisible();
    await capturar(page, "reglas-02-ficha-cerrada-al-cambiar");
});
