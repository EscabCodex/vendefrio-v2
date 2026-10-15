// VendeFrío - Recorrido visual del rework (Etapa 4): abre cada pantalla
// principal en la nube, con datos de prueba, y saca una captura de cada una
// en claro y oscuro. Sirve para revisar el estilo nuevo pantalla por pantalla.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, cargarPedido, irAPedidos, abrirMas } = require("./recorridos");

test.use({ nube: true });

test("diseño: cada pantalla principal con el estilo nuevo", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(() =>
        agregarComercio({ nombre: "Kiosco La Esquina", direccion: "Belgrano 450", telefono: "11 4444-0000" })
    );
    await cargarPedido(page, false);
    await cargarPedido(page, false, "Kiosco La Esquina");
    // Otra marca, después de cargar (si llega mientras se carga, la lista
    // de productos se vuelve a dibujar y se cierra la marca abierta).
    await page.evaluate(() => agregarMarca("Polar") && agregarProducto("Polar", { nombre: "Cucurucho", precio: 1200 }));

    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "diseno-01-inicio");

    await irAPedidos(page);
    await capturar(page, "diseno-02-pedidos");

    await page.locator(".tarjetaSeguimiento", { hasText: "Almacén Don Pepe" }).first().click();
    await expect(page.locator(".fichaPedido")).toBeVisible();
    await capturar(page, "diseno-03-ficha-pedido");
    await page.locator("#modalFichaPedido").click({ position: { x: 10, y: 10 } });
    await expect(page.locator(".fichaPedido")).toBeHidden();

    await page.getByRole("button", { name: "Nuevo pedido" }).click();
    await page.locator("#cliente").fill("Almacén Don Pepe");
    const helado = page.locator(".listaProdutos .fila", { hasText: "Helado 1 kg" });
    await expect(async () => {
        if (!(await helado.isVisible())) await page.locator(".tituloMarca", { hasText: "Frío Sur" }).click();
        await expect(helado).toBeVisible({ timeout: 1000 });
    }).toPass();
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "diseno-04-nuevo-pedido");

    // Mientras se carga, la barra de abajo se esconde; la flecha vuelve a
    // Pedidos. Historial va adentro de Pedidos, con Hoy / Semana / Mes / Todo.
    await expect(page.locator(".bottom-nav")).toBeHidden();
    await page.getByRole("button", { name: "Volver a Pedidos" }).click();
    await expect(page.locator(".bottom-nav")).toBeVisible();
    await page.locator(".filtroEtapa[data-etapa='historial']").click();
    await page.locator(".filtrosHistorialPedidos").getByRole("radio", { name: "Mes" }).click();
    await expect(page.locator(".filtrosHistorialPedidos").getByRole("radio", { name: "Mes" })).toHaveAttribute("aria-checked", "true");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "diseno-04b-historial");

    await page.locator(".bottom-nav").getByRole("button", { name: "Comercios" }).click();
    await expect(page.locator("#pantallaComercios")).toBeVisible();
    await capturar(page, "diseno-05-comercios");

    await page.locator(".bottom-nav").getByRole("button", { name: "Catálogo" }).click();
    await capturar(page, "diseno-06-catalogo");

    await abrirMas(page);
    await capturar(page, "diseno-07-mas");
});
