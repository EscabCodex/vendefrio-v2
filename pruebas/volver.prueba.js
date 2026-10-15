// VendeFrío - Botón volver en toda la app (T51, T52): cada pantalla menos
// Inicio tiene su flecha arriba a la izquierda (y la casita de Inicio), y al
// bajar son los mismos botones los que se quedan quietos arriba. "Más"
// también está en la barra de abajo, y en Rutas las tarjetas se pliegan.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, abrirMas } = require("./recorridos");

test.use({ nube: true });

// La flecha y la casita de la pantalla que se ve.
const arriba = page => page.locator("section:visible > .barraVolver");
const flecha = page => arriba(page).getByRole("button", { name: /^Volver/ });
const casita = page => arriba(page).getByRole("button", { name: "Ir a Inicio" });
// Bajar del todo y ver que el mismo botón siga en el mismo lugar.
async function bajarYMirar(page, boton) {
    // Que termine la animación de entrada de la pantalla.
    await page.waitForTimeout(450);
    const antes = await boton.boundingBox();
    const id = await boton.evaluate(el => { el.dataset.marca = "este"; return el.dataset.marca; });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
    const despues = await boton.boundingBox();
    expect(Math.abs(despues.y - antes.y)).toBeLessThan(1);
    expect(Math.abs(despues.x - antes.x)).toBeLessThan(1);
    expect(await boton.evaluate(el => el.dataset.marca)).toBe(id);
    await expect(boton).toBeVisible();
}
const barra = page => page.locator(".bottom-nav");

test("volver: en todas las pantallas y siempre a mano al bajar", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(() => {
        agregarComercio({ nombre: "Kiosco Luna", direccion: "Sarmiento 20", lat: -34.6, lng: -58.4 });
        agregarComercio({ nombre: "Bar Aurora", direccion: "Mitre 900" });
    });

    // Inicio no tiene botón volver; "Más" está abajo, cerca del pulgar.
    await barra(page).getByRole("button", { name: "Inicio" }).click();
    await expect(page.locator("#pantallaMenu header").getByRole("button", { name: /^Volver/ })).toHaveCount(0);
    await expect(barra(page).getByRole("button", { name: "Más" })).toBeVisible();
    await capturar(page, "volver-01-barra-con-mas");
    await barra(page).getByRole("button", { name: "Más" }).click();
    await expect(page.locator("#pantallaConfiguracion")).toBeVisible();
    await expect(barra(page).locator(".nav-item.activo")).toHaveText(/Más/);

    // Las pantallas de la barra vuelven a Inicio.
    for (const [boton, pantalla] of [["Pedidos", "#pantallaPedido"], ["Comercios", "#pantallaComercios"], ["Catálogo", "#pantallaCatalogo"]]) {
        await barra(page).getByRole("button", { name: boton }).click();
        await expect(page.locator(pantalla)).toBeVisible();
        await page.locator(pantalla).getByRole("button", { name: "Volver a Inicio" }).click();
        await expect(page.locator("#pantallaMenu")).toBeVisible();
    }

    // Rutas, Estadísticas y Cierre del día también tienen su botón.
    await abrirMas(page);
    await page.locator(".masAccesos").getByRole("button", { name: "Rutas" }).click();
    await expect(page.locator("#pantallaRutas")).toBeVisible();
    // Las tarjetas de Rutas arrancan plegadas, con el resumen a la vista.
    await expect(page.locator(".tarjetaSeleccionRuta")).not.toHaveAttribute("open", "");
    await expect(page.locator(".tarjetaSeleccionRuta .chipResumenRuta").first()).toBeVisible();
    await page.locator(".tarjetaRutasGuardadas").scrollIntoViewIfNeeded();
    await capturar(page, "volver-02-rutas-plegada");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator("#pantallaRutas").getByRole("button", { name: "Volver a Más" }).click();
    await expect(page.locator("#pantallaConfiguracion")).toBeVisible();
    // Al lado, la casita lleva directo a Inicio.
    await page.locator(".masAccesos").getByRole("button", { name: "Rutas" }).click();
    await casita(page).click();
    await expect(page.locator("#pantallaMenu")).toBeVisible();

    for (const acceso of ["Estadísticas", "Cierre del día"]) {
        await abrirMas(page);
        await page.locator(".masAccesos").getByRole("button", { name: acceso }).click();
        await page.evaluate(() => window.scrollTo(0, 0));
        await arriba(page).getByRole("button", { name: "Volver a Más" }).click();
        await expect(page.locator("#pantallaConfiguracion")).toBeVisible();
    }

    // En una sección de Más, la flecha y la casita quedan arriba al bajar:
    // son los mismos botones, en el mismo lugar.
    await abrirMas(page);
    await page.locator('.configFila[data-config-seccion="apariencia"]').click();
    await expect(page.locator(".configHeader h1")).toHaveText("Apariencia");
    await expect(casita(page)).toBeVisible();
    const flechaMas = arriba(page).getByRole("button", { name: "Volver", exact: true });
    await bajarYMirar(page, flechaMas);
    await bajarYMirar(page, casita(page));
    await capturar(page, "volver-03-flotante");
    // La flecha vuelve a la lista de Más; ahí ya no hace falta la casita.
    await flechaMas.click();
    await expect(page.locator("#configDetalle")).toBeHidden();
    await expect(page.locator(".configMenuPrincipal")).toBeVisible();
    await expect(page.locator(".configHeader h1")).toHaveText("Más");
    await expect(casita(page)).toBeHidden();

    // En la lista de Comercios también se queda arriba al bajar.
    await page.evaluate(() => {
        for (let i = 1; i <= 12; i++) agregarComercio({ nombre: "Comercio " + i, direccion: "Calle " + i });
    });
    await barra(page).getByRole("button", { name: "Comercios" }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await bajarYMirar(page, flecha(page));
    await expect(casita(page)).toBeHidden();
    await flecha(page).click();
    await expect(page.locator("#pantallaMenu")).toBeVisible();

    // La casita, después de bajar, va directo a Inicio.
    await abrirMas(page);
    await page.locator('.configFila[data-config-seccion="respaldo"]').click();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await casita(page).click();
    await expect(page.locator("#pantallaMenu")).toBeVisible();

    // Se puede hacer que la flecha suba con la pantalla y sacar "Más" de la barra.
    await abrirMas(page);
    await page.locator('.configFila[data-config-seccion="apariencia"]').click();
    const detalle = page.locator("#configDetalle");
    await detalle.getByRole("switch", { name: "Volver siempre a mano" }).uncheck();
    await detalle.getByRole("switch", { name: "Más en la barra de abajo" }).uncheck();
    await expect(barra(page).getByRole("button", { name: "Más" })).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(150);
    expect((await flechaMas.boundingBox()).y).toBeLessThan(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await detalle.getByRole("button", { name: "Restablecer apariencia" }).click();
    await expect(barra(page).getByRole("button", { name: "Más" })).toBeVisible();
});
