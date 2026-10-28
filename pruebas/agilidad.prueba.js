// VendeFrío - Retomar rápido lo que se estaba haciendo.
// Un pedido a medio cargar (te llamaron, fuiste a otra pantalla) queda
// esperando en Inicio en la barrita "Pedido nuevo · Ver pedido" (repaso de
// Catálogo; antes era una tarjeta). Al guardarlo, la barrita se va.
const { test, expect, capturar } = require("./ayudas");
const { entrarSinCuenta } = require("./datosGrandes");

test("agilidad: el pedido a medio cargar se retoma desde Inicio", async ({ page }) => {
    await entrarSinCuenta(page);
    // Un celular nuevo arranca vacío: se carga la lista de fábrica de antes.
    await page.evaluate(() => { guardarComercios(COMERCIOS); guardarProductos(PRODUCTOS); });
    const barra = page.locator("#barraPedidoMedio");
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    await expect(barra).toBeHidden();

    await page.locator(".bottom-nav").getByRole("button", { name: "Nuevo pedido" }).click();
    await expect(page.locator("#pantallaPedido")).toBeVisible();
    await page.locator("#cliente").fill("Anibal");
    await page.locator("#cliente").blur();
    if (await page.locator(".tituloMarca").first().getAttribute("aria-expanded") === "false") {
        await page.locator(".tituloMarca").first().click();
    }
    const fila = page.locator(".listaProdutos .fila").first();
    await fila.getByRole("button", { name: "Aumentar cantidad" }).click();
    await fila.getByRole("button", { name: "Aumentar cantidad" }).click();
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("2");

    // Se va a Inicio sin guardar: la barrita lo espera (y la tarjeta vieja ya no está).
    await page.locator("#cerrarCargaPedido").click();
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    await expect(barra).toBeVisible();
    await expect(barra).toContainText("Pedido nuevo");
    await expect(page.locator("#avisoPedidoMedioCargado")).toHaveCount(0);
    await capturar(page, "agilidad-01-pedido-a-medio-cargar");

    // "Ver pedido" lo abre como estaba.
    await barra.getByRole("button", { name: "Ver pedido" }).click();
    await expect(page.locator("#pantallaPedido")).toBeVisible();
    await expect(page.locator("#cliente")).toHaveValue("Anibal");
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("2");

    // Guardado, la barrita ya no está.
    await page.locator("#generar").click();
    const ventana = page.locator("#modalPedido");
    await expect(ventana).toBeVisible();
    await ventana.click({ position: { x: 10, y: 10 } });
    await expect(ventana).toBeHidden();
    await page.evaluate(() => mostrarPantalla("menu"));
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    await expect(barra).toBeHidden();
});

// Mantener apretado el + abre el menú rápido (hoja desde abajo); el toque
// corto sigue abriendo Nuevo pedido.
async function mantenerApretado(page, localizador) {
    const caja = await localizador.boundingBox();
    await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
}

test("agilidad: mantener apretado el + abre el menú rápido", async ({ page }) => {
    await entrarSinCuenta(page);
    // Un celular nuevo arranca vacío: se carga la lista de fábrica de antes.
    await page.evaluate(() => { guardarComercios(COMERCIOS); guardarProductos(PRODUCTOS); window.actualizarDashboard?.(); });
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    const mas = page.locator(".bottom-nav .nav-nuevo");

    // Sin pedidos guardados: no ofrece repetir.
    await mantenerApretado(page, mas);
    const hoja = page.locator(".hojaMenuRapido");
    await expect(hoja).toBeVisible();
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    await expect(hoja.getByRole("button", { name: /Repetir el último pedido/ })).toHaveCount(0);
    const proxima = (await page.locator("#dashProximaParada .paradaInfo strong").textContent()).trim();
    await expect(hoja.getByRole("button", { name: /Pedido para / })).toContainText(proxima);
    await capturar(page, "agilidad-02-menu-rapido");

    // Pedido para la próxima parada: Nuevo pedido con ese comercio.
    await hoja.getByRole("button", { name: /Pedido para / }).click();
    await expect(page.locator("#pantallaPedido")).toBeVisible();
    await expect(page.locator("#cliente")).toHaveValue(proxima);
    if (await page.locator(".tituloMarca").first().getAttribute("aria-expanded") === "false") {
        await page.locator(".tituloMarca").first().click();
    }
    await page.locator(".listaProdutos .fila").first().getByRole("button", { name: "Aumentar cantidad" }).click();
    await page.locator("#generar").click();
    const ventana = page.locator("#modalPedido");
    await expect(ventana).toBeVisible();
    await ventana.click({ position: { x: 10, y: 10 } });
    await page.locator("#cerrarCargaPedido").click();
    await expect(page.locator("#pantallaMenu")).toBeVisible();

    // Repetir el último pedido: lo carga igual en Nuevo pedido.
    await mantenerApretado(page, mas);
    await expect(hoja.getByRole("button", { name: /Repetir el último pedido/ })).toContainText(proxima);
    await hoja.getByRole("button", { name: /Repetir el último pedido/ }).click();
    await expect(page.locator("#pantallaPedido")).toBeVisible();
    await expect(page.locator("#cliente")).toHaveValue(proxima);
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("1");
    await page.getByRole("button", { name: "Entendido" }).click();
    await page.locator("#cerrarCargaPedido").click();

    // El toque corto abre Nuevo pedido, como siempre.
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    await mas.click();
    await expect(page.locator("#pantallaPedido")).toBeVisible();
    await expect(page.locator(".hojaMenuRapido")).toHaveCount(0);
});
