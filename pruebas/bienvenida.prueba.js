// VendeFrío - Bienvenida nueva (T85, T86, T87): entrar con email o código,
// probar con datos de ejemplo y empezar de cero, presentación y términos.
const { test, expect, capturar } = require("./ayudas");
const { abrirMas } = require("./recorridos");

test("bienvenida: probar con datos de ejemplo y empezar de cero", async ({ page }) => {
    await page.goto("/");
    const bienvenida = page.locator("#pantallaInicioSesion");
    await expect(bienvenida.getByText("Tus pedidos, del comercio al camión.")).toBeVisible();
    await expect(bienvenida.getByRole("button", { name: "Entrar con email" })).toBeVisible();
    await expect(bienvenida.getByRole("button", { name: "Entrar con código" })).toBeVisible();
    // Google queda armado pero apagado hasta M17.
    await expect(bienvenida.getByRole("button", { name: "Entrar con Google" })).toBeHidden();
    await capturar(page, "bienvenida-01-inicio");

    await bienvenida.getByRole("button", { name: "Probar con datos de ejemplo" }).click();
    await expect(bienvenida).toBeHidden();
    const aviso = page.locator("#avisoDatosEjemplo");
    await expect(aviso).toContainText("Estás probando con datos de ejemplo");
    const datos = await page.evaluate(() => ({
        comercios: obtenerComercios().filter(comercio => ["Almacén Don Pepe", "Kiosco Luna", "Despensa Mary", "Maxikiosco 24", "Granja El Sol"].includes(comercio.nombre)).length,
        pedidos: obtenerHistorial().length,
        helado: obtenerProductos()["Frío Sur"].find(producto => producto.nombre === "Helado 1 kg").precio
    }));
    expect(datos.comercios).toBe(5);
    expect(datos.pedidos).toBeGreaterThan(15);
    expect(datos.helado).toBe(4500);
    await expect(page.locator("#pantallaMenu")).not.toContainText("0 pedidos · 0 comercios");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "bienvenida-02-datos-de-ejemplo");

    // Las estadísticas ya muestran algo.
    await page.evaluate(() => window.abrirEstadisticas());
    await expect(page.locator(".statsEnfriando")).toContainText("Despensa Mary");
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();

    // Algo propio queda al empezar de cero.
    await page.evaluate(() => agregarComercio({ nombre: "Mi kiosco", direccion: "Calle 1" }));
    await aviso.getByRole("button", { name: "Empezar de cero" }).click();
    const hoja = page.getByRole("dialog", { name: "Empezar de cero" });
    await hoja.getByRole("button", { name: "Borrar el ejemplo" }).click();
    await expect(aviso).toHaveCount(0);
    const despues = await page.evaluate(() => ({
        comercios: obtenerComercios().map(comercio => comercio.nombre).filter(nombre => ["Almacén Don Pepe", "Kiosco Luna", "Despensa Mary", "Maxikiosco 24", "Granja El Sol", "Mi kiosco"].includes(nombre)),
        pedidos: obtenerHistorial().length,
        marca: Boolean(obtenerProductos()["Frío Sur"])
    }));
    expect(despues).toEqual({ comercios: ["Mi kiosco"], pedidos: 0, marca: false });

    // Más > Seguridad: presentación y términos.
    await abrirMas(page);
    const seguridad = page.locator('.configFila[data-config-seccion="seguridad"]');
    await seguridad.evaluate(fila => fila.scrollIntoView({ block: "center" }));
    await seguridad.click();
    await expect(page.getByRole("button", { name: "Qué es VendeFrío" })).toBeVisible();
    const filaTerminos = page.getByRole("button", { name: "Términos y privacidad" });
    await filaTerminos.evaluate(fila => fila.scrollIntoView({ block: "center" }));
    const [terminos] = await Promise.all([page.waitForEvent("popup"), filaTerminos.click()]);
    await expect(terminos.getByRole("heading", { name: "Términos y privacidad" })).toBeVisible();
    await expect(terminos.getByText("No es asesoramiento legal.")).toBeVisible();
    await terminos.close();
});

test("bienvenida: la presentación", async ({ page }) => {
    await page.goto("/presentacion.html");
    await expect(page.getByRole("heading", { name: "Tus pedidos, del comercio al camión." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir la app" }).first()).toHaveAttribute("href", "./");
    await capturar(page, "bienvenida-03-presentacion");
    await page.goto("/terminos.html");
    await capturar(page, "bienvenida-04-terminos");
});
