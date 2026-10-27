// VendeFrío - Bienvenida nueva (T85, T86, T87): entrar con email o código,
// probar con datos de ejemplo y empezar de cero, presentación y términos.
const { test, expect, capturar } = require("./ayudas");
const { abrirAjustes } = require("./recorridos");

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
    // Informe del desconocido: una distribuidora inventada, completa y sin
    // repetidos (ni la lista de fábrica de antes mezclada).
    const completo = await page.evaluate(() => {
        const comercios = obtenerComercios();
        const productos = obtenerProductos();
        const todos = Object.values(productos).flat();
        const distintos = lista => new Set(lista.map(texto => String(texto).toLocaleLowerCase("es"))).size === lista.length;
        return {
            comercios: comercios.length,
            marcas: Object.keys(productos),
            productos: todos.length,
            sinRepetir: distintos(comercios.map(c => c.nombre)) && distintos(comercios.map(c => c.direccion)) &&
                distintos(comercios.map(c => c.telefono)) && distintos(comercios.map(c => c.contacto)) &&
                distintos(todos.map(p => p.nombre)) && distintos(todos.map(p => p.codigo)) && distintos(Object.keys(productos)),
            comerciosCompletos: comercios.every(c => c.direccion && c.telefono && c.horario && c.diaVisita && c.contacto && c.nota &&
                Number.isFinite(c.lat) && Number.isFinite(c.lng) && c.envases && c.envases.tiene > 0 && c.topeDeuda > 0 && (c.favoritos || []).length),
            productosCompletos: todos.every(p => p.precio > 0 && p.stock > 0 && p.codigo && p.precios && p.precios.Kioscos > 0 && p.precios.Supermercados > 0),
            oferta: todos.filter(p => p.oferta).length,
            listas: window.listasDePrecios(),
            rutas: obtenerRutasGuardadas().map(ruta => [ruta.nombre, ruta.dia, ruta.comercios.length])
        };
    });
    expect(completo).toEqual({
        comercios: 12, marcas: ["Frío Sur", "Dulce Polar", "Hielo Austral"], productos: 12,
        sinRepetir: true, comerciosCompletos: true, productosCompletos: true, oferta: 1,
        listas: ["Kioscos", "Supermercados"],
        rutas: [["Centro · lunes", "lunes", 6], ["Once · jueves", "jueves", 6]]
    });
    // Un solo cartel arriba: el del ejemplo, no "Tus datos no están protegidos".
    await expect(page.locator("#avisoModoPersonal")).toHaveCount(0);
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
    expect(await page.evaluate(() => [obtenerRutasGuardadas().length, Object.keys(obtenerProductos()).length])).toEqual([0, 0]);
    await expect(page.locator("#avisoModoPersonal")).toContainText("Tus datos no están protegidos");

    // Más > Seguridad: presentación y términos.
    await abrirAjustes(page);
    const seguridad = page.locator('.configFila[data-config-seccion="seguridad"]');
    await seguridad.evaluate(fila => fila.scrollIntoView({ block: "center" }));
    await seguridad.click();
    await expect(page.getByRole("button", { name: "Qué es VendeFrío" })).toBeVisible();
    const filaTerminos = page.getByRole("button", { name: "Términos y privacidad" });
    await filaTerminos.evaluate(fila => fila.scrollIntoView({ block: "center" }));
    const [terminos] = await Promise.all([page.waitForEvent("popup"), filaTerminos.click()]);
    await expect(terminos.getByRole("heading", { name: "Términos y privacidad" })).toBeVisible();
    await expect(terminos.getByText("No es asesoramiento legal.")).toBeVisible();
    await expect(terminos.getByRole("link", { name: "vendefrio.app@gmail.com" }).first()).toHaveAttribute("href", "mailto:vendefrio.app@gmail.com");
    await terminos.close();

    // Escribinos: el mail de la app.
    const filaMail = page.getByRole("button", { name: "Escribinos" });
    await filaMail.evaluate(fila => fila.scrollIntoView({ block: "center" }));
    await expect(filaMail).toContainText("vendefrio.app@gmail.com");
    await capturar(page, "bienvenida-05-escribinos");
    await filaMail.click();
    await expect(filaMail).toBeVisible();
});

test("bienvenida: la presentación", async ({ page }) => {
    await page.goto("/presentacion.html");
    await expect(page.getByRole("heading", { name: "Tus pedidos, del comercio al camión." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir la app" }).first()).toHaveAttribute("href", "./");
    await capturar(page, "bienvenida-03-presentacion");
    await page.goto("/terminos.html");
    await capturar(page, "bienvenida-04-terminos");
});
