// VendeFrío - Pantallas sin trabas (T151): con los datos de un reparto
// grande, en un celular común, ninguna pantalla deja trabado el celular y las
// listas largas terminan de dibujarse completas.
const { test, expect, capturar } = require("./ayudas");
const { entrarSinCuenta, cargarDatosGrandes, anotarTrabas } = require("./datosGrandes");

// La traba más larga que se acepta al tocar algo. Antes de T151 Comercios
// dejaba el celular trabado unos 7 segundos e Historial unos 4.
const TRABA_MAXIMA = 800;

test("pantallas: con 200 comercios y 600 pedidos ninguna se traba", async ({ page }) => {
    await page.addInitScript(anotarTrabas);
    await entrarSinCuenta(page);
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(cargarDatosGrandes);
    await page.reload();
    await expect(page.locator("#pantallaMenu")).toBeVisible();

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    // Botones de la barra por su pantalla: buscarlos por rol recorre toda la
    // página y la prueba misma trabaría el celular.
    const botones = { "Comercios": "comercios", "Pedidos": "pedido", "Catálogo": "catalogo", "Más": "mas" };
    const barra = nombre => page.locator(nombre === "Nuevo pedido"
        ? '.bottom-nav [data-accion="nuevoPedido"]'
        : `.bottom-nav [data-pantalla="${botones[nombre]}"]`);

    async function peorTraba(tocar) {
        await page.evaluate(() => { window.trabasDePrueba = []; });
        await tocar();
        await page.waitForTimeout(1500);
        return page.evaluate(() => Math.max(0, ...window.trabasDePrueba));
    }

    // Comercios: aparece enseguida y se completa de a tandas, con
    // "Archivados (1)" al final.
    expect(await peorTraba(() => barra("Comercios").click()), "Comercios (ms)").toBeLessThan(TRABA_MAXIMA);
    const lista = page.locator("#listaComerciosAdmin");
    await expect(lista.locator(".comercioCard")).toHaveCount(199, { timeout: 30000 });
    await expect(lista.locator(":scope > :last-child")).toHaveClass(/filaComerciosArchivados/);

    // Buscar mientras se dibuja: solo quedan los que coinciden.
    await page.locator("#buscarComercio").fill("Comercio 12");
    await expect(lista.locator(".comercioCard")).toHaveCount(11);
    await page.waitForTimeout(1000);
    await expect(lista.locator(".comercioCard")).toHaveCount(11);
    await page.locator("#buscarComercio").fill("");
    await expect(lista.locator(".comercioCard")).toHaveCount(199, { timeout: 30000 });

    // Historial (en el modo personal, "Pedidos" de la barra).
    expect(await peorTraba(() => barra("Pedidos").click()), "Historial (ms)").toBeLessThan(TRABA_MAXIMA);
    await expect(page.locator("#contenedorHistorial .historialCard")).toHaveCount(600, { timeout: 30000 });

    expect(await peorTraba(() => barra("Catálogo").click()), "Catálogo (ms)").toBeLessThan(TRABA_MAXIMA);
    expect(await peorTraba(() => barra("Más").click()), "Más (ms)").toBeLessThan(TRABA_MAXIMA);

    // Nuevo pedido y los "+".
    expect(await peorTraba(() => barra("Nuevo pedido").click()), "Nuevo pedido (ms)").toBeLessThan(TRABA_MAXIMA);
    await page.locator("#cliente").fill("Comercio 5");
    await page.locator("#cliente").blur();
    await page.locator(".tituloMarca").first().click();
    const fila = page.locator(".listaProdutos .fila").first();
    expect(await peorTraba(async () => {
        for (let i = 0; i < 3; i++) await fila.getByRole("button", { name: "Aumentar cantidad" }).click();
    }), "Sumar con + (ms)").toBeLessThan(TRABA_MAXIMA);
    await expect(fila.locator("select")).toHaveValue("3");
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("3");
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await capturar(page, "pantallas-01-nuevo-pedido-con-muchos-datos");
});
