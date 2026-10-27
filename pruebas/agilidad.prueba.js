// VendeFrío - Retomar rápido lo que se estaba haciendo.
// Un pedido a medio cargar (te llamaron, fuiste a otra pantalla) queda
// esperando en Inicio: "Seguir" lo abre como estaba. Al guardarlo, el
// aviso se va.
const { test, expect, capturar } = require("./ayudas");
const { entrarSinCuenta } = require("./datosGrandes");

test("agilidad: el pedido a medio cargar se retoma desde Inicio", async ({ page }) => {
    await entrarSinCuenta(page);
    // Un celular nuevo arranca vacío: se carga la lista de fábrica de antes.
    await page.evaluate(() => { guardarComercios(COMERCIOS); guardarProductos(PRODUCTOS); });
    const aviso = page.locator("#avisoPedidoMedioCargado");
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    await expect(aviso).toHaveCount(0);

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

    // Se va a Inicio sin guardar: el aviso lo espera arriba.
    await page.locator("#cerrarCargaPedido").click();
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText("Seguí el pedido de Anibal");
    await expect(aviso).toContainText("2 unidades cargadas");
    await capturar(page, "agilidad-01-pedido-a-medio-cargar");

    // "Seguir" lo abre como estaba.
    await aviso.getByRole("button", { name: "Seguir el pedido a medio cargar" }).click();
    await expect(page.locator("#pantallaPedido")).toBeVisible();
    await expect(page.locator("#cliente")).toHaveValue("Anibal");
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("2");

    // Guardado, el aviso ya no está.
    await page.locator("#generar").click();
    const ventana = page.locator("#modalPedido");
    await expect(ventana).toBeVisible();
    await ventana.click({ position: { x: 10, y: 10 } });
    await expect(ventana).toBeHidden();
    await page.locator("#cerrarCargaPedido").click();
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    await expect(aviso).toHaveCount(0);
});
