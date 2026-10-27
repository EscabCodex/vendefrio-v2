// VendeFrío - Volver al mismo lugar y el botón atrás del celular (repasada).
// 1. Si Android cierra la app de fondo (se fue a otra app y al volver se
//    recarga), abre en la misma pantalla, a la misma altura y con la ficha
//    que estaba abierta. Abierta de cero (otra ventana), arranca en Inicio.
// 2. El atrás del celular cierra la ficha, después vuelve a la pantalla
//    anterior, y en Inicio ya no queda nada que lo frene (cierra la app).
//    Varios atrás seguidos, sin tocar nada en el medio, siguen dando un paso
//    cada uno (Chrome se saltea lo que la app agrega a la historia sin un
//    toque: por eso después de un atrás la app no agrega nada).
// 3. En la nube: vuelve a Pedidos con la ficha del pedido, aunque los
//    pedidos tarden en llegar.
const { test, expect, capturar, prepararPagina } = require("./ayudas");
const { entrarSinCuenta, cargarDatosGrandes } = require("./datosGrandes");
const { registrarDistribuidora, cargarPedido, irAPedidos } = require("./recorridos");

// Anota si la app agrega algo a la historia después de un atrás, sin que se
// haya tocado nada: Chrome se saltea esas entradas y el próximo atrás
// cerraría la app.
async function vigilarHistoria(page) {
    await page.addInitScript(() => {
        window.__agregadasSinToque = 0;
        let trasAtras = false;
        window.addEventListener("popstate", () => { trasAtras = true; }, true);
        ["pointerdown", "pointerup", "click", "keydown", "touchend"].forEach(tipo => {
            window.addEventListener(tipo, evento => { if (evento.isTrusted) trasAtras = false; }, true);
        });
        const agregar = history.pushState.bind(history);
        history.pushState = (...datos) => {
            if (trasAtras) window.__agregadasSinToque++;
            return agregar(...datos);
        };
    });
}

const agregadasSinToque = page => page.evaluate(() => window.__agregadasSinToque);
const enInicioSinGuardia = async page => {
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    await expect.poll(() => page.evaluate(() => history.state && history.state.vendefrio)).toBeFalsy();
};

// Lo que pasa en el celular: la app queda de fondo (se anota dónde estaba)
// y Android la cierra para liberar memoria; al volver, se carga de nuevo.
async function androidLaCierraDeFondo(page) {
    await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.reload();
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
    await page.goBack();
    await expect(page.locator(".modalFichaComercio")).toHaveCount(0);
    await expect(page.locator("#pantallaComercios")).toBeVisible();
    // Después vuelve a Inicio, igual que la flecha de arriba.
    await page.goBack();
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    // En Inicio no queda nada nuestro en la historia: el próximo atrás cierra la app.
    await expect.poll(() => page.evaluate(() => history.state && history.state.vendefrio)).toBeFalsy();

    // En Más > Apariencia: el atrás vuelve a la lista de Más y después a Inicio.
    await page.locator("#pantallaMenu header").getByRole("button", { name: "Más", exact: true }).click();
    await page.locator('.configFila[data-config-seccion="apariencia"]').click();
    await expect(page.locator("#configDetalle")).toBeVisible();
    // Si Android la cierra ahí, vuelve a Apariencia.
    await androidLaCierraDeFondo(page);
    await expect(page.locator("#configDetalle")).toBeVisible();
    await expect(page.locator("#configDetalle .configSubVolver")).toContainText("Apariencia");
    await page.goBack();
    await expect(page.locator("#configDetalle")).toBeHidden();
    await expect(page.locator("#pantallaConfiguracion")).toBeVisible();
    await page.goBack();
    await expect(page.locator("#pantallaMenu")).toBeVisible();

    // Una hoja abierta en Inicio: el atrás la cierra y deja Inicio como estaba.
    await page.locator('.bottom-nav [data-pantalla="comercios"]').click();
    await page.locator('.bottom-nav [data-pantalla="menu"]').click();
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    await page.evaluate(() => window.piezas.hoja({ titulo: "Hoja de prueba", html: "<p>Hola</p>" }));
    await expect(page.locator(".pzFondo.visible")).toBeVisible();
    await page.goBack();
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

test("atrás: un paso atrás en toda la app, también con varios atrás seguidos", async ({ page }) => {
    await vigilarHistoria(page);
    await entrarSinCuenta(page);
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    const mas = () => page.locator("#pantallaMenu header").getByRole("button", { name: "Más", exact: true }).click();

    // Cada acceso de Más: atrás vuelve a Más y otro atrás, a Inicio.
    await mas();
    const accesos = await page.locator("#masAccesos button").evaluateAll(botones => botones.map(boton => boton.textContent.trim()));
    expect(accesos.length).toBeGreaterThan(4);
    await page.goBack();
    await enInicioSinGuardia(page);
    for (const acceso of accesos) {
        await mas();
        await expect(page.locator("#pantallaConfiguracion")).toBeVisible();
        await page.locator("#masAccesos button", { hasText: acceso }).first().click();
        await expect(page.locator("#pantallaConfiguracion")).toBeHidden();
        await page.goBack();
        await expect(page.locator("#pantallaConfiguracion"), "atrás desde " + acceso).toBeVisible();
        await expect(page.locator("#configDetalle")).toBeHidden();
        await page.goBack();
        await enInicioSinGuardia(page);
    }

    // Más > una sección > una hoja: tres atrás seguidos llegan a Inicio.
    await mas();
    await page.locator('.configFila[data-config-seccion="apariencia"]').click();
    await expect(page.locator("#configDetalle")).toBeVisible();
    await page.evaluate(() => window.piezas.hoja({ titulo: "Hoja de prueba", html: "<p>Hola</p>" }));
    await expect(page.locator(".pzFondo.visible")).toBeVisible();
    await page.goBack();
    await expect(page.locator(".pzFondo")).toHaveCount(0);
    await expect(page.locator("#configDetalle")).toBeVisible();
    await page.goBack();
    await expect(page.locator("#configDetalle")).toBeHidden();
    await expect(page.locator("#pantallaConfiguracion")).toBeVisible();
    await page.goBack();
    await enInicioSinGuardia(page);

    // La barra de abajo: Comercios > ficha, y Catálogo.
    await page.locator('.bottom-nav [data-pantalla="comercios"]').click();
    await page.locator("#listaComerciosAdmin .comercioCard").first().click();
    await expect(page.locator(".modalFichaComercio")).toBeVisible();
    await page.goBack();
    await expect(page.locator(".modalFichaComercio")).toHaveCount(0);
    await expect(page.locator("#pantallaComercios")).toBeVisible();
    await page.goBack();
    await enInicioSinGuardia(page);
    await page.locator('.bottom-nav [data-pantalla="catalogo"]').click();
    await expect(page.locator("#pantallaCatalogo")).toBeVisible();
    await page.goBack();
    await enInicioSinGuardia(page);

    // Nunca se agregó nada a la historia después de un atrás.
    expect(await agregadasSinToque(page)).toBe(0);
    // Y en Inicio el próximo atrás sale de la app.
    await page.goBack();
    await expect(page).toHaveURL("about:blank");
});

test.describe("en la nube", () => {
    test.use({ nube: true });

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
        await page.goBack();
        await expect(page.locator(".fichaPedido")).toBeHidden();
        await expect(page.locator("#vistaPedidos")).toBeVisible();
    });
    test("atrás: Más > A cobrar, Pedidos y la ficha del pedido, sin salir de la app", async ({ page }, testInfo) => {
        await vigilarHistoria(page);
        await registrarDistribuidora(page, testInfo);
        await cargarPedido(page, false);
        await page.locator('.bottom-nav [data-pantalla="menu"]').click();
        await enInicioSinGuardia(page);

        // Lo que contó el dueño: Más > A cobrar, atrás, atrás.
        await page.locator("#pantallaMenu header").getByRole("button", { name: "Más", exact: true }).click();
        await page.locator("#masAccesos button", { hasText: "A cobrar" }).click();
        await expect(page.locator("#pantallaConfiguracion")).toBeHidden();
        await page.goBack();
        await expect(page.locator("#pantallaConfiguracion")).toBeVisible();
        await page.goBack();
        await enInicioSinGuardia(page);

        // Pedidos > la ficha de un pedido: atrás la cierra y otro atrás va a Inicio.
        await irAPedidos(page);
        await page.locator(".tarjetaSeguimiento", { hasText: "Almacén Don Pepe" }).first().click();
        await expect(page.locator(".fichaPedido")).toBeVisible();
        await page.goBack();
        await expect(page.locator(".fichaPedido")).toBeHidden();
        await expect(page.locator("#vistaPedidos")).toBeVisible();
        await page.goBack();
        await enInicioSinGuardia(page);
        expect(await agregadasSinToque(page)).toBe(0);
    });
});
