// VendeFrío - El comercio pide solo (T88): link por WhatsApp, página del
// catálogo en otro celular (sin cuenta) y el pedido que llega a Inicio.
const { test, expect, capturar, prepararPagina } = require("./ayudas");
const { registrarDistribuidora } = require("./recorridos");

test.use({ nube: true });

test("pedir solo: link, pedido del comercio y cargarlo como Cargado", async ({ page, browser }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    // La primera bajada de la nube puede pisar un cambio hecho apenas
    // registrada la distribuidora: se repite hasta que quede.
    await expect.poll(() => page.evaluate(() => {
        actualizarComercioPorNombre("Almacén Don Pepe", { diaVisita: "Martes" });
        return buscarComercioPorNombre("Almacén Don Pepe").diaVisita;
    }), { intervals: [500, 1000, 1000] }).toBe("Martes");
    await page.waitForTimeout(1500);
    await expect.poll(() => page.evaluate(() => {
        actualizarComercioPorNombre("Almacén Don Pepe", { diaVisita: "Martes" });
        return buscarComercioPorNombre("Almacén Don Pepe").diaVisita;
    })).toBe("Martes");

    await page.evaluate(() => window.abrirFichaComercio("Almacén Don Pepe"));
    await page.locator(".modalFichaComercio").getByRole("button", { name: "Más opciones" }).click();
    await page.getByRole("dialog", { name: "Más opciones de Almacén Don Pepe" }).getByRole("button", { name: "Link para que pida solo" }).click();
    const hoja = page.getByRole("dialog", { name: "Link para que pida solo" });
    await expect(hoja.locator("#linkPedido")).toContainText("pedir.html?t=");
    await expect(hoja.getByRole("link", { name: "Mandar por WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/5491155551234\?text=Hola%20Almac/);
    await capturar(page, "pedir-01-link");
    const direccion = (await hoja.locator("#linkPedido").textContent()).trim();
    await page.keyboard.press("Escape");

    // El comercio, en su celular, sin cuenta.
    const contexto = await browser.newContext({ ...testInfo.project.use, baseURL: testInfo.project.use.baseURL, serviceWorkers: "block" });
    const comercio = await contexto.newPage();
    const errores = await prepararPagina(comercio, true);
    await comercio.goto(direccion.replace(/^https?:\/\/[^/]+/, ""));
    await expect(comercio.getByText("Hola, Almacén Don Pepe")).toBeVisible({ timeout: 20000 });
    await expect(comercio.getByText("Te lo llevamos el martes")).toBeVisible();
    const helado = comercio.locator(".tarjetaProducto", { hasText: "Helado 1 kg" });
    await expect(helado).toContainText("$ 4.500");
    await helado.getByRole("button", { name: "Agregar Helado 1 kg" }).click();
    await helado.getByRole("button", { name: "Uno más de Helado 1 kg" }).click();
    await comercio.locator(".tarjetaProducto", { hasText: "Palito bombón" }).getByRole("button", { name: "Agregar Palito bombón" }).click();
    await expect(comercio.locator("#totalPedir")).toHaveText("$ 9.800");
    await expect(comercio.locator("#cantidadPedir")).toHaveText("2 productos");
    await capturar(comercio, "pedir-02-catalogo-del-comercio");
    await comercio.locator("#notaPedir").fill("Traigan cambio");
    await comercio.getByRole("button", { name: "Enviar pedido" }).click();
    await expect(comercio.getByText("¡Pedido enviado!")).toBeVisible();
    await comercio.getByRole("button", { name: "Hacer otro pedido" }).click();
    await expect(comercio.getByRole("button", { name: "Repetir mi último pedido" })).toBeVisible();
    expect(errores).toEqual([]);
    await contexto.close();

    // Llega a Inicio y se carga con un toque.
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    const aviso = page.locator("#avisoPedidosWeb");
    await expect(aviso).toContainText("Almacén Don Pepe pidió por el link", { timeout: 20000 });
    await expect(aviso).toContainText("2 productos · 3 unidades");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "pedir-03-llego-a-inicio");
    await aviso.getByRole("button", { name: "Ver pedido del link" }).click();
    const pedido = page.getByRole("dialog", { name: "Pedido del link de Almacén Don Pepe" });
    await expect(pedido).toContainText("Traigan cambio");
    await pedido.getByRole("button", { name: "Cargar pedido" }).click();
    await expect(aviso).toHaveCount(0);
    const cargado = await page.evaluate(() => {
        const item = obtenerHistorial().find(registro => registro.comercio === "Almacén Don Pepe");
        return item && { productos: item.productos.map(linea => linea.producto + " x" + linea.cantidad).sort(), estado: item.estado };
    });
    expect(cargado).toEqual({ productos: ["Helado 1 kg x2", "Palito bombón x1"], estado: "cargado" });
    await expect.poll(() => page.evaluate(async () => {
        const foto = await firebase.firestore().collection("pedidosWeb").where("idDistribuidora", "==", window.distribuidoraVendeFrio.idActual()).get();
        return foto.docs.map(doc => doc.data().estado).join(",");
    })).toBe("cargado");
});
