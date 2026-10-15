// VendeFrío - Botón volver en toda la app (T51): cada pantalla menos Inicio
// tiene su botón volver arriba a la izquierda, y al bajar se desprende y
// queda flotando. "Más" también está en la barra de abajo, y en Rutas las
// tarjetas se pliegan.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, abrirMas } = require("./recorridos");

test.use({ nube: true });

const flotante = page => page.locator("#volverFlotante");
const barra = page => page.locator(".bottom-nav");

test("volver: en todas las pantallas y flotante al bajar", async ({ page }, testInfo) => {
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
    await page.locator("#pantallaRutas header").getByRole("button", { name: "Ir a Inicio" }).click();
    await expect(page.locator("#pantallaMenu")).toBeVisible();

    for (const acceso of ["Estadísticas", "Cierre del día"]) {
        await abrirMas(page);
        await page.locator(".masAccesos").getByRole("button", { name: acceso }).click();
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.locator("section:visible > header").getByRole("button", { name: "Volver a Más" }).click();
        await expect(page.locator("#pantallaConfiguracion")).toBeVisible();
    }

    // En una sección de Más, al bajar el botón se desprende y acompaña.
    await abrirMas(page);
    await page.locator('.configFila[data-config-seccion="apariencia"]').click();
    await expect(flotante(page)).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(flotante(page)).toBeVisible();
    await expect(page.locator("#inicioFlotante")).toBeVisible();
    const caja = await flotante(page).boundingBox();
    expect(caja.x).toBeLessThan(30);
    expect(caja.y).toBeLessThan(30);
    await capturar(page, "volver-03-flotante");
    // Hace lo mismo que el de arriba: vuelve a la lista de Más.
    await flotante(page).click();
    await expect(page.locator("#configDetalle")).toBeHidden();
    await expect(page.locator(".configMenuPrincipal")).toBeVisible();

    // En la lista de Comercios también acompaña al bajar.
    await page.evaluate(() => {
        for (let i = 1; i <= 12; i++) agregarComercio({ nombre: "Comercio " + i, direccion: "Calle " + i });
    });
    await barra(page).getByRole("button", { name: "Comercios" }).click();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(flotante(page)).toBeVisible();
    await expect(page.locator("#inicioFlotante")).toBeHidden();
    await flotante(page).click();
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    await expect(flotante(page)).toBeHidden();

    // En una sección de Más, la casita flotante va directo a Inicio.
    await abrirMas(page);
    await page.locator('.configFila[data-config-seccion="respaldo"]').click();
    await expect(page.locator(".configHeader").getByRole("button", { name: "Ir a Inicio" })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.locator("#inicioFlotante").click();
    await expect(page.locator("#pantallaMenu")).toBeVisible();

    // Se puede apagar el flotante y sacar "Más" de la barra.
    await abrirMas(page);
    await page.locator('.configFila[data-config-seccion="apariencia"]').click();
    const detalle = page.locator("#configDetalle");
    await detalle.getByRole("switch", { name: "Volver flotante" }).uncheck();
    await detalle.getByRole("switch", { name: "Más en la barra de abajo" }).uncheck();
    await expect(barra(page).getByRole("button", { name: "Más" })).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await expect(flotante(page)).toBeHidden();
    await detalle.getByRole("button", { name: "Restablecer apariencia" }).click();
    await expect(barra(page).getByRole("button", { name: "Más" })).toBeVisible();
});
