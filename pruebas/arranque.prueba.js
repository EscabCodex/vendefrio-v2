// VendeFrío - Que la app abra rápido (T150): con los datos de un reparto
// grande no se traba al abrir, y con poca señal abre desde el celular y avisa
// cuando hay una versión nueva.
const { test, expect, capturar } = require("./ayudas");
const { entrarSinCuenta, cargarDatosGrandes, anotarTrabas, bajarHastaElFinal } = require("./datosGrandes");

test("arranque: con 200 comercios y 600 pedidos abre sin trabarse", async ({ page }) => {
    await page.addInitScript(anotarTrabas);
    await entrarSinCuenta(page);

    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(cargarDatosGrandes);

    // Un celular común: el procesador 4 veces más lento.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.reload();
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    await expect(page.locator("#dashTotalComercios")).toHaveText("199");
    await page.waitForTimeout(3000);
    // Antes de T150 quedaba trabado unos 6 segundos dibujando pantallas ocultas.
    const trabado = await page.evaluate(() => window.trabasDePrueba.reduce((total, duracion) => total + Math.max(0, duracion - 50), 0));
    expect(trabado, "Tiempo trabado al abrir (ms)").toBeLessThan(1500);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await capturar(page, "arranque-01-inicio-con-muchos-datos");

    // Las pantallas que ya no se dibujan al abrir se dibujan al entrar.
    await page.locator(".bottom-nav").getByRole("button", { name: "Comercios" }).click();
    await expect(page.locator("#listaComerciosAdmin .comercioCard").first()).toBeVisible();
    await bajarHastaElFinal(page.locator("#listaComerciosAdmin"), ".comercioCard", 199);
    await page.locator(".bottom-nav").getByRole("button", { name: "Nuevo pedido" }).click();
    await expect(page.locator("#productos .tituloMarca").first()).toBeVisible();
});

test("arranque: con poca señal abre desde el celular y avisa la versión nueva", async ({ browser }, testInfo) => {
    // Esta prueba necesita el service worker, que las demás apagan.
    const contexto = await browser.newContext({ ...testInfo.project.use, baseURL: testInfo.project.use.baseURL, serviceWorkers: "allow" });
    const page = await contexto.newPage();
    const errores = [];
    page.on("pageerror", error => errores.push(error.message));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, ruta => ruta.fulfill({ status: 200, body: "" }));
    const servidor = testInfo.project.use.baseURL;
    try {
        await entrarSinCuenta(page);
        await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
        await page.evaluate(() => navigator.serviceWorker.ready);
        await page.reload();
        await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
        await expect(page.locator("#pantallaMenu")).toBeVisible();

        // Señal pésima: cada archivo tarda 8 segundos en llegar del servidor.
        await page.request.get(servidor + "/__pruebas/lento?ms=8000");
        const inicio = Date.now();
        await page.reload();
        await expect(page.locator("#pantallaMenu")).toBeVisible({ timeout: 5000 });
        expect(Date.now() - inicio, "Con poca señal abre desde el celular (ms)").toBeLessThan(5000);

        // Se publica una versión nueva: la app la baja por detrás y avisa.
        await page.request.get(servidor + "/__pruebas/normal");
        await page.request.get(servidor + "/__pruebas/cambiar?archivo=menu.js&texto=" + encodeURIComponent("window.versionNuevaDePrueba = true;"));
        await page.evaluate(() => navigator.serviceWorker.controller.postMessage({ accion: "revisarVersion" }));
        const aviso = page.locator("#avisoVersionNueva");
        await expect(aviso).toBeVisible({ timeout: 30000 });
        await expect(aviso).toContainText("Hay una versión nueva");
        expect(await page.evaluate(() => window.versionNuevaDePrueba)).toBeUndefined();
        await capturar(page, "arranque-02-version-nueva");

        await aviso.getByRole("button", { name: "Actualizar" }).click();
        await page.waitForFunction(() => window.versionNuevaDePrueba === true);
        await expect(page.locator("#pantallaMenu")).toBeVisible();
        await expect(page.locator("#avisoVersionNueva")).toBeHidden();
    } finally {
        await page.request.get(servidor + "/__pruebas/normal");
        await contexto.close();
    }
    expect(errores, "La página tuvo errores de JavaScript").toEqual([]);
});
