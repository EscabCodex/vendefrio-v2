// VendeFrío - Errores chicos (T152): lo que encontró el barrido de todas las
// pantallas, en claro y en oscuro y en un celular chico.
const { test, expect, capturar } = require("./ayudas");
const { abrirMas } = require("./recorridos");

// Contraste entre el texto y el fondo de un elemento (1 a 21). Se lee aunque
// el elemento esté oculto.
function contraste(selector) {
    const elemento = document.querySelector(selector);
    const numeros = color => color.match(/[\d.]+/g).map(Number);
    const luz = ([r, g, b]) => [r, g, b]
        .map(v => (v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
        .reduce((total, v, i) => total + v * [0.2126, 0.7152, 0.0722][i], 0);
    let fondo = elemento;
    while (fondo && numeros(getComputedStyle(fondo).backgroundColor)[3] === 0) fondo = fondo.parentElement;
    const a = luz(numeros(getComputedStyle(elemento).color));
    const b = luz(numeros(getComputedStyle(fondo).backgroundColor));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("errores: datos de ejemplo completos y textos que se leen sobre el color principal", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Probar con datos de ejemplo" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();

    // "Cargar un pedido" y los botones de varios pedidos, también en oscuro.
    for (const selector of [".queHacerOpcion.principal strong", ".queHacerOpcion.principal small", ".botonTanda:not(.botonTandaPeligro)"]) {
        expect(await page.evaluate(contraste, selector), selector).toBeGreaterThan(4.5);
    }
    await page.locator(".queHacerOpcion.principal").scrollIntoViewIfNeeded();
    await capturar(page, "errores-01-cargar-un-pedido");

    // Los pedidos de ejemplo tienen fecha, unidades y mensaje, como los de
    // verdad: antes salían "Sin fecha · 0 unidades".
    await page.locator(".bottom-nav").getByRole("button", { name: "Pedidos" }).click();
    const tarjeta = page.locator("#contenedorHistorial .historialCard").first();
    await expect(tarjeta).toBeVisible();
    await expect(page.locator("#contenedorHistorial")).not.toContainText("Sin fecha");
    await expect(tarjeta).not.toContainText(" 0 unidades");
    await expect(tarjeta).toContainText(" unidades");
    await tarjeta.getByRole("button", { name: "Ver pedido" }).click();
    await expect(page.locator("#pedidoDetalle")).toContainText("Unidades totales");
    await expect(page.locator("#pedidoDetalle")).toContainText("Frío Sur");
    await capturar(page, "errores-02-pedido-de-ejemplo");

    // T153: los comercios de ejemplo tienen su última visita (la ficha decía
    // "Nunca" con 6 pedidos) y en Más no hay dos botones "Avisos": el de los
    // ajustes dice "Qué avisos recibir".
    const kiosco = await page.evaluate(() => obtenerComercios().find(comercio => comercio.nombre === "Kiosco Luna"));
    expect(kiosco.ultimaVisita).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
    await expect(page.locator("#configFilaAvisos strong")).toHaveText("Qué avisos recibir");
});

test("errores: en un celular chico los botones de arriba no se salen de la pantalla", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/");
    await page.getByRole("button", { name: "Probar con datos de ejemplo" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();

    await abrirMas(page);
    await page.locator('.configFila[data-config-seccion="trabajo"]').click();
    const cabecera = page.locator("#pantallaConfiguracion > header");
    await expect(cabecera.locator("h1")).toHaveText("Preferencias de trabajo");
    // El título largo pasa a su renglón y "?" queda entero a la vista.
    await expect(cabecera).toHaveClass(/cabeceraDosFilas/);
    const ayuda = await cabecera.getByRole("button", { name: "Ayuda de esta pantalla" }).boundingBox();
    expect(ayuda.x + ayuda.width).toBeLessThanOrEqual(360);
    const titulo = await cabecera.locator("h1").boundingBox();
    expect(titulo.y).toBeGreaterThanOrEqual(ayuda.y + ayuda.height - 1);
    await capturar(page, "errores-03-titulo-largo-celular-chico");

    // Un título corto sigue al lado de los botones.
    await page.locator(".bottom-nav").getByRole("button", { name: "Comercios" }).click();
    await expect(page.locator("#pantallaComercios > header")).not.toHaveClass(/cabeceraDosFilas/);
});
