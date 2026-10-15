// VendeFrío - Secciones de "Más" (T50): cada una con grupos, íconos y
// filas, y los ajustes de Apariencia, Trabajo y Recorrido que cambian algo
// de verdad. También "Comercios para esta ruta" en Rutas.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, abrirMas } = require("./recorridos");

test.use({ nube: true });

async function abrirSeccion(page, seccion) {
    await abrirMas(page);
    await page.locator(`.configFila[data-config-seccion="${seccion}"]`).click();
    await expect(page.locator("#configDetalle")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
}

const raiz = (page, dato) => page.evaluate(nombre => document.documentElement.dataset[nombre], dato);

test("ajustes: secciones de Más con el estilo nuevo y ajustes que andan", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(() => {
        agregarComercio({ nombre: "Kiosco Luna", direccion: "Sarmiento 20", lat: -34.6, lng: -58.4 });
        agregarComercio({ nombre: "Bar Aurora", direccion: "Mitre 900" });
    });

    // Apariencia: la vista de cada tema y el color principal.
    await abrirSeccion(page, "apariencia");
    const detalle = page.locator("#configDetalle");
    await expect(detalle.locator(".ajTema")).toHaveCount(3);
    await expect(detalle.locator(".ajTema .miniApp")).toHaveCount(4);
    await expect(detalle.getByRole("radio", { name: "Como el teléfono" })).toBeChecked();
    await capturar(page, "ajustes-01-apariencia");

    // El color cambia el acento de toda la app.
    const acentoAntes = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--acento").trim());
    await detalle.locator(".ajColor", { hasText: "Violeta" }).click();
    expect(await raiz(page, "acento")).toBe("violeta");
    const acentoDespues = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--acento").trim());
    expect(acentoDespues).not.toBe(acentoAntes);

    // El tamaño del texto agranda la pantalla de verdad.
    const altoAntes = await page.locator(".configHeader h1").evaluate(el => el.getBoundingClientRect().height);
    await detalle.locator(".ajSegmento label", { hasText: "Muy grande" }).click();
    expect(await raiz(page, "texto")).toBe("enorme");
    const altoDespues = await page.locator(".configHeader h1").evaluate(el => el.getBoundingClientRect().height);
    expect(altoDespues).toBeGreaterThan(altoAntes * 1.15);

    // El espaciado separa más las filas.
    const filaAntes = await detalle.locator(".ajFila").first().evaluate(el => parseFloat(getComputedStyle(el).paddingTop));
    await detalle.locator(".ajSegmento label", { hasText: "Amplio" }).click();
    expect(await raiz(page, "densidad")).toBe("amplio");
    const filaDespues = await detalle.locator(".ajFila").first().evaluate(el => parseFloat(getComputedStyle(el).paddingTop));
    expect(filaDespues).toBeGreaterThan(filaAntes);

    // Barra solo con íconos.
    await detalle.getByRole("switch", { name: "Nombres en la barra de abajo" }).uncheck();
    expect(await raiz(page, "barra")).toBe("iconos");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "ajustes-02-apariencia-cambiada");

    // "Restablecer apariencia" vuelve todo como al principio, sin tocar el resto.
    await page.evaluate(() => {
        const datos = JSON.parse(localStorage.getItem("vendefrio_preferencias"));
        localStorage.setItem("vendefrio_preferencias", JSON.stringify({ ...datos, vehiculo: "moto" }));
    });
    await detalle.getByRole("button", { name: "Restablecer apariencia" }).click();
    expect(await raiz(page, "acento")).toBe("original");
    expect(await raiz(page, "texto")).toBe("normal");
    expect(await raiz(page, "barra")).toBe("nombres");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vendefrio_preferencias")).vehiculo)).toBe("moto");

    // Preferencias de trabajo: "Comercios: mostrar primero" de la A a la Z.
    await abrirSeccion(page, "trabajo");
    await capturar(page, "ajustes-03-trabajo");
    await detalle.getByLabel("Orden de comercios").selectOption("alfabetico");
    await page.locator(".bottom-nav").getByRole("button", { name: "Comercios" }).click();
    const nombres = await page.locator("#listaComerciosAdmin .filaTituloComercio > :first-child").allTextContents();
    expect(nombres.slice(0, 3).map(texto => texto.trim())).toEqual(["Almacén Don Pepe", "Bar Aurora", "Kiosco Luna"]);

    // Cómo hacés el recorrido.
    await abrirSeccion(page, "navegacion");
    await expect(detalle.getByRole("radio", { name: "Moto" })).toBeChecked();
    await expect(detalle.getByRole("switch", { name: "Seguir mi ubicación" })).toBeChecked();
    await capturar(page, "ajustes-04-recorrido");

    // Las demás secciones, con su estilo nuevo.
    for (const [seccion, captura] of [["respaldo", "05-respaldo"], ["seguridad", "06-seguridad"], ["empleados", "07-empleados"], ["avisos", "08-avisos"], ["cuenta", "09-cuenta"]]) {
        await abrirSeccion(page, seccion);
        await expect(detalle.locator(".ajGrupo").first()).toBeVisible();
        await capturar(page, "ajustes-" + captura);
    }

    // Rutas: comercios para esta ruta, con buscador y resumen.
    await page.evaluate(() => mostrarPantalla("rutas"));
    const tarjeta = page.locator(".tarjetaSeleccionRuta");
    // Desplegable (T51): cerrada muestra el resumen; se abre al tocarla.
    await expect(tarjeta.locator(".chipResumenRuta").first()).toBeVisible();
    await expect(page.getByLabel("Buscar comercio para la ruta")).toBeHidden();
    await tarjeta.locator("summary").click();
    await expect(tarjeta.locator(".opcionSeleccionRuta")).toHaveCount(3);
    await expect(tarjeta.locator(".chipResumenRuta").first()).toContainText("1 elegido");
    await tarjeta.getByRole("button", { name: "Todos" }).click();
    await expect(tarjeta.locator(".chipResumenRuta").first()).toContainText("3 elegidos");
    await page.getByLabel("Buscar comercio para la ruta").fill("luna");
    await expect(tarjeta.locator(".opcionSeleccionRuta")).toHaveCount(1);
    await page.getByLabel("Buscar comercio para la ruta").fill("");
    await tarjeta.scrollIntoViewIfNeeded();
    await capturar(page, "ajustes-10-comercios-para-la-ruta");
});
