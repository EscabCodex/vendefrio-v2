// VendeFrío - Volver al mismo lugar y el botón atrás del celular (repasada).
// 1. Si Android cierra la app de fondo (se fue a otra app y al volver se
//    recarga), abre en la misma pantalla, a la misma altura y con la ficha
//    que estaba abierta. Abierta de cero (otra ventana), arranca en Inicio.
// 2. El atrás del celular cierra la ficha, después vuelve a la pantalla
//    anterior, y en Inicio ya no queda nada que lo frene (cierra la app).
// 3. En la nube: vuelve a Pedidos con la ficha del pedido, aunque los
//    pedidos tarden en llegar.
const { test, expect, capturar, prepararPagina } = require("./ayudas");
const { entrarSinCuenta, cargarDatosGrandes } = require("./datosGrandes");
const { registrarDistribuidora, cargarPedido, irAPedidos } = require("./recorridos");

// Lo que pasa en el celular: la app queda de fondo (se anota dónde estaba)
// y Android la cierra para liberar memoria; al volver, se carga de nuevo.
async function androidLaCierraDeFondo(page) {
    await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.reload();
}

// El atrás del celular (Android): con CloseWatcher es lo mismo que pide el
// sistema; sin él, un paso atrás en la historia.
async function atrasDelCelular(page) {
    await expect.poll(() => page.evaluate(() => window.lugarVendeFrio.frenaElAtras())).toBe(true);
    await page.evaluate(() => window.lugarVendeFrio.atrasDelCelular());
}

test("lugar: vuelve a la misma pantalla y ficha, y el atrás cierra lo de arriba", async ({ page, context }) => {
    await entrarSinCuenta(page);
    await page.evaluate(cargarDatosGrandes);
    await page.reload();
    await expect(page.locator("#pantallaMenu")).toBeVisible();

    // Comercios, un poco más abajo.
    await page.locator('.bottom-nav [data-pantalla="comercios"]').click();
    const tarjetas = page.locator("#listaComerciosAdmin .comercioCard");
    await expect(tarjetas.first()).toBeVisible();
    // La lista se dibuja a medida que se baja: se baja hasta que esté la 26.
    await expect(async () => {
        await tarjetas.last().scrollIntoViewIfNeeded();
        expect(await tarjetas.count()).toBeGreaterThan(25);
    }).toPass({ timeout: 30000, intervals: [100, 250, 500] });
    await tarjetas.nth(25).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 120));
    const altura = await page.evaluate(() => Math.round(window.scrollY));
    expect(altura).toBeGreaterThan(600);

    await androidLaCierraDeFondo(page);
    await expect(page.locator("#pantallaComercios")).toBeVisible();
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY)), { timeout: 5000 }).toBeGreaterThan(altura - 40);
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBeLessThan(altura + 40);

    // Con la ficha de un comercio abierta: vuelve con la ficha.
    const tarjeta = tarjetas.nth(3);
    const nombre = (await tarjeta.locator("h3").textContent()).trim();
    await tarjeta.click();
    await expect(page.locator(".modalFichaComercio #tituloFichaComercio")).toHaveText(nombre);
    await androidLaCierraDeFondo(page);
    await expect(page.locator("#pantallaComercios")).toBeVisible();
    await expect(page.locator(".modalFichaComercio #tituloFichaComercio")).toHaveText(nombre);
    await capturar(page, "lugar-01-vuelve-con-la-ficha");

    // El atrás del celular: primero cierra la ficha y sigue en Comercios.
    await atrasDelCelular(page);
    await expect(page.locator(".modalFichaComercio")).toHaveCount(0);
    await expect(page.locator("#pantallaComercios")).toBeVisible();
    // Después vuelve a Inicio, igual que la flecha de arriba.
    await atrasDelCelular(page);
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    // En Inicio ya no se frena el atrás: el próximo cierra la app.
    await expect.poll(() => page.evaluate(() => window.lugarVendeFrio.frenaElAtras())).toBe(false);

    // En Más > Ajustes > Apariencia: si Android la cierra ahí, vuelve a
    // Apariencia; el atrás vuelve a la lista de Más y después a Inicio.
    await page.locator(".bottom-nav").getByRole("button", { name: "Más", exact: true }).click();
    await page.locator('.configFila[data-config-seccion="ajustes"]').click();
    await page.locator('.configFila[data-config-seccion="apariencia"]').click();
    await expect(page.locator("#configDetalle")).toBeVisible();
    // Si Android la cierra ahí, vuelve a Apariencia.
    await androidLaCierraDeFondo(page);
    await expect(page.locator("#configDetalle")).toBeVisible();
    await expect(page.locator("#configDetalle .configSubVolver")).toContainText("Apariencia");
    await atrasDelCelular(page);
    await expect(page.locator("#configDetalle")).toBeHidden();
    await expect(page.locator("#pantallaConfiguracion")).toBeVisible();
    await atrasDelCelular(page);
    await expect(page.locator("#pantallaMenu")).toBeVisible();

    // Una hoja abierta en Inicio: el atrás la cierra y deja Inicio como estaba.
    await page.locator('.bottom-nav [data-pantalla="comercios"]').click();
    await page.locator('.bottom-nav [data-pantalla="menu"]').click();
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    await page.evaluate(() => window.piezas.hoja({ titulo: "Hoja de prueba", html: "<p>Hola</p>" }));
    await expect(page.locator(".pzFondo.visible")).toBeVisible();
    await atrasDelCelular(page);
    await expect(page.locator(".pzFondo")).toHaveCount(0);
    await expect(page.locator("#pantallaMenu")).toBeVisible();

    // Si la cerrás vos y la abrís de nuevo (otra ventana), arranca en Inicio.
    await page.locator('.bottom-nav [data-pantalla="comercios"]').click();
    await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
    });
    const nueva = await context.newPage();
    const errores = await prepararPagina(nueva, false);
    await nueva.goto("/");
    await expect(nueva.locator("#pantallaMenu")).toBeVisible();
    await nueva.waitForTimeout(800);
    await expect(nueva.locator("#pantallaComercios")).toBeHidden();
    expect(errores).toEqual([]);
    await nueva.close();
});

// Lo que le pasaba a Jere: Más > una pantalla > atrás > atrás cerraba la app
// en vez de ir a Inicio. Varios atrás seguidos, sin tocar nada en el medio.
async function variosAtrasSeguidos(page) {
    await entrarSinCuenta(page);
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    await page.locator(".bottom-nav").getByRole("button", { name: "Más", exact: true }).click();
    await expect(page.locator("#pantallaConfiguracion")).toBeVisible();

    // Una pantalla de Más cuya flecha de arriba va a Inicio: el atrás vuelve a Más.
    await page.locator('.masAcceso[data-mas="listasPrecios"]').click();
    await expect(page.locator("#pantallaListasPrecios")).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.lugarVendeFrio.frenaElAtras())).toBe(true);
    await atrasDelCelular(page);
    await expect(page.locator("#pantallaConfiguracion")).toBeVisible();
    await expect(page.locator("#pantallaListasPrecios")).toBeHidden();
    // Enseguida otro atrás, sin tocar nada: Inicio, no se cierra la app.
    await expect.poll(() => page.evaluate(() => window.lugarVendeFrio.frenaElAtras())).toBe(true);
    await atrasDelCelular(page);
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.lugarVendeFrio.frenaElAtras())).toBe(false);

    // Más > Ajustes > Apariencia > una hoja: cuatro atrás seguidos, un paso cada uno.
    await page.locator(".bottom-nav").getByRole("button", { name: "Más", exact: true }).click();
    await page.locator('.configFila[data-config-seccion="ajustes"]').click();
    await page.locator('.configFila[data-config-seccion="apariencia"]').click();
    await expect(page.locator("#configDetalle")).toBeVisible();
    await page.evaluate(() => window.piezas.hoja({ titulo: "Hoja de prueba", html: "<p>Hola</p>" }));
    await expect(page.locator(".pzFondo.visible")).toBeVisible();
    await atrasDelCelular(page);
    await expect(page.locator(".pzFondo")).toHaveCount(0);
    await expect(page.locator("#configDetalle")).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.lugarVendeFrio.frenaElAtras())).toBe(true);
    await atrasDelCelular(page);
    await expect(page.locator(".configHeader h1")).toHaveText("Ajustes");
    await expect.poll(() => page.evaluate(() => window.lugarVendeFrio.frenaElAtras())).toBe(true);
    await atrasDelCelular(page);
    await expect(page.locator("#configDetalle")).toBeHidden();
    await expect(page.locator("#pantallaConfiguracion")).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.lugarVendeFrio.frenaElAtras())).toBe(true);
    await atrasDelCelular(page);
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.lugarVendeFrio.frenaElAtras())).toBe(false);
}

test("lugar: cada acceso de Más vuelve a Más con el atrás, y otro atrás va a Inicio", async ({ page }) => {
    await entrarSinCuenta(page);
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    const mas = () => page.locator(".bottom-nav").getByRole("button", { name: "Más", exact: true }).click();
    await mas();
    const accesos = await page.locator("#masAccesos button").evaluateAll(botones => botones.map(boton => boton.textContent.trim()));
    expect(accesos.length).toBeGreaterThan(4);
    await atrasDelCelular(page);
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    for (const acceso of accesos) {
        await mas();
        await expect(page.locator("#pantallaConfiguracion")).toBeVisible();
        await page.locator("#masAccesos button", { hasText: acceso }).first().click();
        await expect(page.locator("#pantallaConfiguracion")).toBeHidden();
        await atrasDelCelular(page);
        await expect(page.locator("#pantallaConfiguracion"), "atrás desde " + acceso).toBeVisible();
        await atrasDelCelular(page);
        await expect(page.locator("#pantallaMenu"), "otro atrás desde " + acceso).toBeVisible();
        await expect.poll(() => page.evaluate(() => window.lugarVendeFrio.frenaElAtras())).toBe(false);
    }
});

test("lugar: varios atrás seguidos dan un paso cada uno y terminan en Inicio", async ({ page }) => {
    expect(await page.evaluate(() => typeof CloseWatcher)).toBe("function");
    await variosAtrasSeguidos(page);
});

test("lugar: sin CloseWatcher (celulares viejos), lo mismo con la historia", async ({ page }) => {
    await page.addInitScript(() => { delete window.CloseWatcher; });
    await variosAtrasSeguidos(page);
});

test("lugar: el atrás vuelve a la pantalla de la que se vino, no siempre a Inicio", async ({ page }) => {
    await entrarSinCuenta(page);
    // Un celular nuevo arranca vacío: se carga la lista de fábrica de antes.
    await page.evaluate(() => { guardarComercios(COMERCIOS); guardarProductos(PRODUCTOS); window.actualizarDashboard?.(); });
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    const nav = destino => page.locator(`.bottom-nav [data-pantalla="${destino}"]`).click();
    const enInicio = async () => {
        await expect(page.locator("#pantallaMenu")).toBeVisible();
        await expect.poll(() => page.evaluate(() => window.lugarVendeFrio.frenaElAtras())).toBe(false);
    };

    // Catálogo > "+": el pedido sube como hoja encima del Catálogo; el atrás
    // la baja y queda el Catálogo con la barrita del pedido a medio hacer.
    await nav("catalogo");
    await page.locator("#grillaCatalogo .btnCatalogoPedido").first().click();
    await expect(page.locator("#pantallaPedido.pedidoEnHoja")).toBeVisible();
    await atrasDelCelular(page);
    await expect(page.locator("#pantallaPedido")).toBeHidden();
    await expect(page.locator("#pantallaCatalogo")).toBeVisible();
    await expect(page.locator("#barraPedidoMedio")).toBeVisible();
    await page.evaluate(() => window.limpiarPedido());
    await atrasDelCelular(page);
    await enInicio();

    // Comercios > Más (barra de abajo): vuelve a Comercios.
    await nav("comercios");
    await nav("mas");
    await expect(page.locator("#pantallaConfiguracion")).toBeVisible();
    await atrasDelCelular(page);
    await expect(page.locator("#pantallaComercios")).toBeVisible();
    await atrasDelCelular(page);
    await enInicio();

    // Más > Cuenta > Comercios: vuelve a Cuenta, después a la lista de Más
    // y después a Inicio.
    await nav("mas");
    await page.locator('.configFila[data-config-seccion="cuenta"]').click();
    await expect(page.locator("#configDetalle")).toBeVisible();
    await nav("comercios");
    await expect(page.locator("#pantallaComercios")).toBeVisible();
    await atrasDelCelular(page);
    await expect(page.locator("#configDetalle")).toBeVisible();
    await expect(page.locator("#configDetalle")).toHaveAttribute("data-seccion", "cuenta");
    await atrasDelCelular(page);
    await expect(page.locator("#configDetalle")).toBeHidden();
    await expect(page.locator("#pantallaConfiguracion")).toBeVisible();
    await atrasDelCelular(page);
    await enInicio();

    // Inicio > Estadísticas (su flecha lleva a Más): el atrás vuelve a Inicio.
    await page.evaluate(() => window.abrirEstadisticas());
    await expect(page.locator("#pantallaEstadisticas")).toBeVisible();
    await atrasDelCelular(page);
    await enInicio();

    // Ida y vuelta entre pantallas: el atrás no da vueltas, desanda el camino.
    await nav("comercios");
    await nav("catalogo");
    await nav("comercios");
    await atrasDelCelular(page);
    await enInicio();
});

test.describe("en la nube", () => {
    test.use({ nube: true });

    test("lugar: Nuevo pedido vuelve a donde estabas antes de empezarlo", async ({ page }, testInfo) => {
        await registrarDistribuidora(page, testInfo);
        await page.locator('.bottom-nav [data-pantalla="menu"]').click();
        await expect(page.locator("#pantallaMenu")).toBeVisible();
        // Desde Inicio: el atrás vuelve a Inicio, no a la lista de Pedidos.
        await page.locator(".bottom-nav").getByRole("button", { name: "Nuevo pedido" }).click();
        await expect(page.locator("#pantallaPedido")).toHaveAttribute("data-vista", "nuevo");
        await atrasDelCelular(page);
        await expect(page.locator("#pantallaMenu")).toBeVisible();
        // Desde la lista de Pedidos: vuelve a la lista y después a Inicio.
        await irAPedidos(page);
        await page.locator(".bottom-nav").getByRole("button", { name: "Nuevo pedido" }).click();
        await expect(page.locator("#pantallaPedido")).toHaveAttribute("data-vista", "nuevo");
        await atrasDelCelular(page);
        await expect(page.locator("#vistaPedidos")).toBeVisible();
        await atrasDelCelular(page);
        await expect(page.locator("#pantallaMenu")).toBeVisible();
        await expect.poll(() => page.evaluate(() => window.lugarVendeFrio.frenaElAtras())).toBe(false);
    });

    test("lugar: Más > A cobrar, atrás vuelve a Más y otro atrás a Inicio", async ({ page }, testInfo) => {
        await registrarDistribuidora(page, testInfo);
        await page.locator('.bottom-nav [data-pantalla="menu"]').click();
        await page.locator(".bottom-nav").getByRole("button", { name: "Más", exact: true }).click();
        await page.locator("#masAccesos button", { hasText: "A cobrar" }).click();
        await expect(page.locator("#pantallaConfiguracion")).toBeHidden();
        await atrasDelCelular(page);
        await expect(page.locator("#pantallaConfiguracion")).toBeVisible();
        await atrasDelCelular(page);
        await expect(page.locator("#pantallaMenu")).toBeVisible();
    });

    test("lugar: vuelve a Pedidos con la ficha del pedido abierta", async ({ page }, testInfo) => {
        await registrarDistribuidora(page, testInfo);
        await cargarPedido(page, false);
        await irAPedidos(page);
        const tarjeta = page.locator(".tarjetaSeguimiento", { hasText: "Almacén Don Pepe" }).first();
        await tarjeta.click();
        const ficha = page.locator(".fichaPedido");
        await expect(ficha).toBeVisible();
        await expect(ficha).toContainText("Almacén Don Pepe");

        await androidLaCierraDeFondo(page);
        await expect(page.locator("#vistaPedidos")).toBeVisible();
        await expect(page.locator(".fichaPedido")).toBeVisible({ timeout: 20000 });
        await expect(page.locator(".fichaPedido")).toContainText("Almacén Don Pepe");
        await capturar(page, "lugar-02-vuelve-con-el-pedido");

        // Atrás: se cierra la ficha y queda la lista de Pedidos.
        await atrasDelCelular(page);
        await expect(page.locator(".fichaPedido")).toBeHidden();
        await expect(page.locator("#vistaPedidos")).toBeVisible();
    });
});
