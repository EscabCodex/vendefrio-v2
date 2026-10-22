// VendeFrío - Apariencia a gusto (T158) y qué se ve en Inicio (T156):
// la vista previa, los tonos del tema, el color a elección, la forma de los
// botones, el estilo de las tarjetas, el tamaño de los íconos, el fondo de
// Inicio y las llaves de cada tarjeta de Inicio ("Suelen pedir los…"
// arranca apagada). Todo se guarda en el celular y sigue al volver a abrir.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, abrirConfiguracionEn } = require("./recorridos");

test.use({ nube: true });

const raiz = (page, dato) => page.evaluate(nombre => document.documentElement.dataset[nombre], dato);
const variable = (page, nombre) => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), nombre);

async function irAInicio(page) {
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    await expect(page.locator("#pantallaMenu")).toBeVisible();
}

test("apariencia: más personalización y qué se ve en Inicio", async ({ page }, testInfo) => {
    const oscuro = testInfo.project.name === "oscuro";
    await registrarDistribuidora(page, testInfo);

    // De fábrica: "Suelen pedir los…" apagada, lo demás prendido.
    await expect(page.locator("#dashVisitarHoy")).toBeHidden();
    await expect(page.locator("#dashProximaParada")).toBeVisible();
    expect(await raiz(page, "inicioSin")).toBe("suelenPedir");

    await abrirConfiguracionEn(page, "apariencia");
    const detalle = page.locator("#configDetalle");
    await expect(detalle.locator(".ajVistaPrevia")).toBeVisible();
    await expect(detalle.getByRole("switch", { name: "Suelen pedir los…" })).not.toBeChecked();
    await expect(detalle.getByRole("switch", { name: "Próxima parada" })).toBeChecked();
    await expect(detalle.locator(".ajColor")).toHaveCount(11);
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "apariencia-01-de-fabrica");

    // Tonos: cambian el fondo del tema que se está viendo.
    const fondoAntes = await variable(page, "--fondo");
    await detalle.getByRole("radio", { name: oscuro ? "Negro puro" : "Cálido" }).check();
    await expect.poll(() => variable(page, "--fondo")).toBe(oscuro ? "#000000" : "#F6F0E6");
    expect(fondoAntes).not.toBe(await variable(page, "--fondo"));

    // Color a elección: se arma con contraste (amarillo: texto oscuro de día).
    await detalle.getByLabel("Color a elección").fill("#ffd400");
    expect(await raiz(page, "acento")).toBe("propio");
    await expect.poll(() => variable(page, "--acento-claro")).toBe("#FFD400");
    expect(await variable(page, "--acento-txt")).toBe(oscuro ? "#0C0F13" : "#0F1B2D");
    await expect(detalle.locator(".ajColorPropio .muestraColor")).toHaveAttribute("data-elegido", "");

    // Forma, tarjetas, íconos y fondo de Inicio.
    const botonVista = detalle.locator(".ajVistaBoton");
    await detalle.locator(".ajSegmento label", { hasText: "Rectos" }).click();
    expect(await raiz(page, "forma")).toBe("rectos");
    expect(await botonVista.evaluate(el => getComputedStyle(el).borderTopLeftRadius)).toBe("6px");
    await detalle.locator(".ajSegmento label", { hasText: "Borde" }).click();
    expect(await raiz(page, "tarjetas")).toBe("borde");
    expect(await detalle.locator(".ajVistaTarjeta").evaluate(el => getComputedStyle(el).borderTopWidth)).toBe("1px");
    const iconoAntes = await detalle.locator(".ajVistaIcono svg").evaluate(el => el.getBoundingClientRect().width);
    await detalle.locator(".ajSegmento label", { hasText: "Grandes" }).click();
    const iconoDespues = await detalle.locator(".ajVistaIcono svg").evaluate(el => el.getBoundingClientRect().width);
    expect(iconoDespues).toBeGreaterThan(iconoAntes * 1.1);
    await detalle.locator(".ajSegmento label", { hasText: "Puntos" }).click();
    expect(await detalle.locator(".ajVistaFondo").evaluate(el => getComputedStyle(el).backgroundImage)).toContain("radial-gradient");

    // La vista previa queda arriba al bajar.
    await detalle.getByRole("switch", { name: "Esta semana" }).scrollIntoViewIfNeeded();
    const vista = await detalle.locator(".ajVistaPrevia").boundingBox();
    expect(vista.y).toBeLessThan(90);
    await capturar(page, "apariencia-02-cambiada");

    // Qué se ve en Inicio: apagar dos y prender "Suelen pedir los…".
    await detalle.getByRole("switch", { name: "Próxima parada" }).uncheck();
    await detalle.getByRole("switch", { name: "Esta semana" }).uncheck();
    await detalle.getByRole("switch", { name: "Suelen pedir los…" }).check();
    await irAInicio(page);
    await expect(page.locator("#dashProximaParada")).toBeHidden();
    await expect(page.locator("#tituloProximaParada")).toBeHidden();
    await expect(page.locator("#dashSemana")).toBeHidden();
    await expect(page.locator("#resumenHoy")).toBeVisible();
    expect(await page.locator("#pantallaMenu").evaluate(el => getComputedStyle(el).backgroundImage)).toContain("radial-gradient");
    await capturar(page, "apariencia-03-inicio");

    // Al volver a abrir la app sigue todo igual, desde el primer cuadro.
    await page.reload();
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    expect(await raiz(page, "forma")).toBe("rectos");
    expect(await raiz(page, "iconos")).toBe("grandes");
    expect(await raiz(page, "inicioSin")).toBe("proxima semana");
    expect(await variable(page, "--acento-claro")).toBe("#FFD400");
    await expect(page.locator("#dashSemana")).toBeHidden();

    // Todo apagado: Inicio avisa y lleva a elegir.
    await abrirConfiguracionEn(page, "apariencia");
    for (const nombre of ["Resumen de hoy", "¿Qué querés hacer?", "Pedidos de hoy"]) {
        await detalle.getByRole("switch", { name: nombre }).uncheck();
    }
    await irAInicio(page);
    await expect(page.locator("#inicioVacio")).toBeVisible();
    await capturar(page, "apariencia-04-inicio-vacio");
    await page.getByRole("button", { name: "Elegir qué ver" }).click();
    await expect(detalle.locator(".ajVistaPrevia")).toBeVisible();

    // "Restablecer apariencia": todo como al principio.
    await detalle.getByRole("button", { name: "Restablecer apariencia" }).click();
    expect(await raiz(page, "acento")).toBe("original");
    expect(await raiz(page, "forma")).toBe("redondos");
    expect(await raiz(page, "inicioSin")).toBe("suelenPedir");
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue("--acento"))).toBe("");
    await irAInicio(page);
    await expect(page.locator("#inicioVacio")).toBeHidden();
    await expect(page.locator("#dashProximaParada")).toBeVisible();
});
