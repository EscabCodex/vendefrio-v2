// VendeFrío - Botones de arriba alineados y secciones que abren desde arriba
// (pedido del dueño, 2026-10-26). En cada pantalla, volver, casita, Avisos,
// "?" y Asistente quedan a la misma altura, también en un celular chico. Y al
// entrar a una sección de Más con la lista bajada, se ve el título arriba.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, cargarPedido } = require("./recorridos");

test.use({ nube: true });

// Centro vertical de cada botón redondo de arriba de la pantalla que se ve.
function centrosDeArriba(page) {
    return page.evaluate(() => {
        const seVe = e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
        const pantalla = [...document.querySelectorAll('body > section[id^="pantalla"]')].find(s => !s.classList.contains("oculto") && seVe(s));
        const botones = [...pantalla.querySelectorAll(":scope > .barraVolver > button, :scope > header > button")].filter(seVe);
        return botones.map(boton => {
            const caja = boton.getBoundingClientRect();
            return { nombre: boton.getAttribute("aria-label") || boton.textContent.trim(), centro: Math.round(caja.top + caja.height / 2) };
        });
    });
}

async function revisarAlineados(page, donde) {
    await page.waitForTimeout(450);
    const centros = await centrosDeArriba(page);
    expect(centros.length, donde).toBeGreaterThanOrEqual(3);
    const alturas = [...new Set(centros.map(c => c.centro))];
    expect(alturas, donde + ": " + JSON.stringify(centros)).toHaveLength(1);
}

async function abrirMas(page) {
    await page.evaluate(() => mostrarPantalla("mas"));
    await expect(page.locator("#pantallaConfiguracion")).toBeVisible();
}

async function abrirAjustes(page) {
    await abrirMas(page);
    await page.locator('.configFila[data-config-seccion="ajustes"]').click();
    await expect(page.locator("#configDetalle .configMenuAjustes")).toBeVisible();
}

for (const ancho of [390, 320]) {
    test(`botones de arriba alineados (${ancho} px)`, async ({ page }, testInfo) => {
        test.setTimeout(150000);
        if (ancho !== 390) await page.setViewportSize({ width: ancho, height: 640 });
        await registrarDistribuidora(page, testInfo);
        const barra = page.locator(".bottom-nav");

        for (const boton of ["Pedidos", "Comercios", "Catálogo"]) {
            await barra.getByRole("button", { name: boton }).click();
            await revisarAlineados(page, boton);
        }
        if (ancho === 390) await capturar(page, "alineados-01-catalogo");

        await abrirMas(page);
        await revisarAlineados(page, "Más");
        const accesos = await page.locator("#masAccesos button").evaluateAll(botones =>
            botones.map(boton => boton.getAttribute("aria-label") || boton.textContent.trim()));
        for (const acceso of accesos) {
            // Rutas ocupa toda la pantalla, con sus botones dentro de la tarjeta.
            if (acceso === "Rutas") continue;
            await abrirMas(page);
            await page.locator("#masAccesos button").filter({ hasText: acceso }).first().click();
            await revisarAlineados(page, acceso);
        }

        // Cada sección de Más, entrando con la lista bajada del todo.
        await abrirMas(page);
        const secciones = await page.locator(".configFila[data-config-seccion]").evaluateAll(filas =>
            filas.filter(fila => fila.getClientRects().length).map(fila => fila.dataset.configSeccion));
        expect(secciones).toContain("cuenta");
        // Más quedó corta (informe del desconocido): sus secciones y las de
        // Más > Ajustes, cada una entrando con la lista bajada.
        await abrirAjustes(page);
        const deAjustes = await page.locator("#configDetalle .configFila[data-config-seccion]").evaluateAll(filas =>
            filas.filter(fila => fila.getClientRects().length).map(fila => fila.dataset.configSeccion));
        expect(deAjustes).toContain("apariencia");
        for (const seccion of [...secciones, ...deAjustes.map(nombre => "ajustes/" + nombre)]) {
            const enAjustes = seccion.startsWith("ajustes/");
            if (enAjustes) await abrirAjustes(page);
            else await abrirMas(page);
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            if (!enAjustes) expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
            await page.locator(`.configFila[data-config-seccion="${seccion.replace("ajustes/", "")}"]`).first().click();
            await expect(page.locator("#configDetalle")).toBeVisible();
            expect(await page.evaluate(() => window.scrollY), seccion).toBe(0);
            await revisarAlineados(page, "Más > " + seccion);
            if (ancho === 390 && seccion === "cuenta") await capturar(page, "alineados-02-cuenta-desde-arriba");
        }

        if (ancho === 390) {
            await abrirMas(page);
            await page.locator("#masAccesos button").filter({ hasText: "Estadísticas" }).first().click();
            await page.waitForTimeout(450);
            await capturar(page, "alineados-03-estadisticas");
            await cargarPedido(page, false);
            await page.evaluate(() => mostrarPantalla("menu"));
            await page.waitForTimeout(450);
            await capturar(page, "alineados-04-inicio");
        } else {
            await capturar(page, "alineados-05-celular-chico");
        }
    });
}
