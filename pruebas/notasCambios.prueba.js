// VendeFrío - Notas de cambios, como las de los juegos.
// 1. "Hay una versión nueva" dice cuántos cambios trae y "Tocá para ver qué
//    cambió": tocar la tarjeta abre la hoja con lo nuevo desde la última
//    versión que vio este celular; el botón "Actualizar" sigue actualizando.
// 2. Si actualizó sin mirarlas, Inicio muestra "La app se actualizó" hasta
//    que las mira.
// 3. notas.json está bien escrito y viaja con la app (sw.js).
const fs = require("fs");
const path = require("path");
const { test, expect, capturar } = require("./ayudas");
const { entrarSinCuenta } = require("./datosGrandes");

const RAIZ = path.resolve(__dirname, "..");
const NOTAS = JSON.parse(fs.readFileSync(path.join(RAIZ, "notas.json"), "utf8")).notas;
const MAS_NUEVA = NOTAS[0].version;
const nuevasDesde = vista => NOTAS.filter(nota => nota.version > vista).length;

test("notas de cambios: la tarjeta de versión nueva se toca y muestra lo nuevo", async ({ page }) => {
    await entrarSinCuenta(page);
    await expect(page.locator("#pantallaMenu")).toBeVisible();

    // Este celular vio las notas hasta la 233.
    await page.evaluate(() => localStorage.setItem("vendefrio_notas_vistas", "233"));
    await page.evaluate(() => window.confianzaVendeFrio.avisarVersionNueva());
    const tarjeta = page.locator("#avisoVersionNueva");
    await expect(tarjeta).toContainText("Trae " + nuevasDesde(233) + " cambios.");
    await expect(tarjeta).toContainText("Tocá para ver qué cambió");
    await capturar(page, "notas-tarjeta");

    // Tocar la tarjeta (no el botón) abre las notas.
    await tarjeta.locator("strong").click();
    const hoja = page.locator(".ventanaNotas");
    await expect(hoja).toBeVisible();
    await expect(hoja.locator(".notaFila")).toHaveCount(nuevasDesde(233));
    await expect(hoja).toContainText(NOTAS[0].titulo);
    await expect(hoja).not.toContainText("La navegación se achica");
    await expect(hoja.getByRole("button", { name: "Actualizar ahora" })).toBeVisible();
    await capturar(page, "notas-hoja");

    // "Después" la cierra; ya quedaron vistas.
    await hoja.getByRole("button", { name: "Después" }).click();
    await expect(hoja).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("vendefrio_notas_vistas"))).toBe(String(MAS_NUEVA));

    // Otra versión sin notas nuevas: arreglos chicos.
    await page.evaluate(() => window.confianzaVendeFrio.avisarVersionNueva());
    await expect(tarjeta).toContainText("Trae arreglos.");
    await tarjeta.locator("strong").click();
    await expect(hoja).toContainText("arreglos chicos");
    // Tocar afuera la cierra; deslizarla para abajo también.
    await page.mouse.click(195, 20);
    await expect(hoja).toBeHidden();
    await tarjeta.locator("strong").click();
    await expect(hoja).toBeVisible();
    await page.evaluate(() => {
        const caja = document.querySelector(".ventanaNotas .notasCaja");
        const r = caja.getBoundingClientRect();
        const toque = y => new Touch({ identifier: 1, target: caja, clientX: r.left + 100, clientY: y });
        const y0 = r.top + 40;
        caja.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [toque(y0)] }));
        [30, 120, 260].forEach(dy => caja.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, touches: [toque(y0 + dy)] })));
        caja.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [] }));
    });
    await expect(hoja).toBeHidden();
    await tarjeta.locator("strong").click();

    // "Actualizar ahora" recarga la app.
    await Promise.all([
        page.waitForEvent("framenavigated"),
        hoja.getByRole("button", { name: "Actualizar ahora" }).click()
    ]);
});

test("notas de cambios: «La app se actualizó» si actualizó sin mirarlas", async ({ page }) => {
    await entrarSinCuenta(page);
    await expect(page.locator("#pantallaMenu")).toBeVisible();

    await page.evaluate(() => localStorage.setItem("vendefrio_notas_vistas", "0"));
    await page.evaluate(() => window.notasDeCambiosVendeFrio.revisarAlAbrir());
    const tarjeta = page.locator("#avisoNotasCambios");
    await expect(tarjeta).toContainText("La app se actualizó");
    await expect(tarjeta).toContainText("Tocá para ver qué cambió");

    await tarjeta.click();
    const hoja = page.locator(".ventanaNotas");
    // Quien viene de una versión vieja (la de main) ve todo lo acumulado.
    await expect(hoja.locator(".notaFila")).toHaveCount(NOTAS.length);
    // Con tantas notas van en páginas que se pasan deslizando,
    // y el botón queda siempre a la vista.
    const entendido = hoja.getByRole("button", { name: "Entendido" });
    await expect(entendido).toBeInViewport({ ratio: 1 });
    const paginas = hoja.locator(".notasPagina");
    const total = await paginas.count();
    expect(total).toBeGreaterThan(1);
    await expect(hoja.locator(".notasNumero")).toHaveText("1 de " + total);
    await capturar(page, "notas-actualizada");
    await hoja.locator(".notasLista").evaluate(el => { el.scrollLeft = el.clientWidth; });
    await expect(hoja.locator(".notasNumero")).toHaveText("2 de " + total);
    await expect(paginas.nth(1)).toBeInViewport({ ratio: 0.9 });
    await capturar(page, "notas-pagina-2");
    // Deslizar hasta la última: está la nota más vieja y el botón sigue ahí.
    await hoja.locator(".notasLista").evaluate(el => { el.scrollLeft = el.scrollWidth; });
    await expect(hoja.locator(".notasNumero")).toHaveText(total + " de " + total);
    await expect(hoja.locator(".notaFila").last()).toBeInViewport();
    await expect(entendido).toBeInViewport({ ratio: 1 });
    // Ya está actualizada: no ofrece actualizar, solo "Entendido".
    await expect(hoja.getByRole("button", { name: "Actualizar ahora" })).toBeHidden();
    await expect(tarjeta).toHaveCount(0);
    await hoja.getByRole("button", { name: "Entendido" }).click();
    await expect(hoja).toBeHidden();

    // Al volver a abrir la app ya no aparece.
    await page.evaluate(() => window.notasDeCambiosVendeFrio.revisarAlAbrir());
    await page.waitForTimeout(300);
    await expect(tarjeta).toHaveCount(0);
});

test("notas de cambios: notas.json bien escrito y guardado con la app", async () => {
    const sw = fs.readFileSync(path.join(RAIZ, "sw.js"), "utf8");
    const iconos = fs.readFileSync(path.join(RAIZ, "iconos.js"), "utf8");
    const cache = Number(/vendefrio-v(\d+)"/.exec(sw)[1]);
    expect(sw).toContain('"./notas.json"');
    expect(NOTAS.length).toBeGreaterThan(0);
    NOTAS.forEach((nota, indice) => {
        const nombre = "Nota «" + nota.titulo + "»";
        expect(Number.isInteger(nota.version), nombre + ": version es la caché de sw.js").toBe(true);
        expect(nota.version, nombre + ": no puede ser más nueva que la caché").toBeLessThanOrEqual(cache);
        if (indice > 0) expect(nota.version, nombre + ": las más nuevas van arriba").toBeLessThanOrEqual(NOTAS[indice - 1].version);
        expect(nota.fecha, nombre).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(["nuevo", "mejor", "arreglado"], nombre + ": tipo").toContain(nota.tipo);
        expect(iconos, nombre + ": el ícono existe").toMatch(new RegExp("\\b" + nota.icono + ":"));
        expect(nota.titulo.length, nombre + ": título corto").toBeLessThanOrEqual(40);
        expect(nota.texto.length, nombre + ": texto corto").toBeLessThanOrEqual(110);
    });
});
