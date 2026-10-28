// VendeFrío - Repaso de Catálogo: el "+" de un producto abre el Nuevo pedido
// como hoja encima del Catálogo; al bajarla queda la barrita "Pedido nuevo ·
// Ver pedido" en todas las pantallas (menos Más) y cada "+" suma uno. Si se
// empieza un pedido para un comercio con otro a medio hacer, se pregunta.
const { test, expect, capturar } = require("./ayudas");

test("pedido en hoja desde el Catálogo y barrita del pedido a medio hacer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Vendedor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(() => {
        guardarProductos({});
        agregarComercio({ nombre: "Almacén Don Pepe", direccion: "San Martín 123", telefono: "11 5555-1234" });
        agregarMarca("Frío Sur");
        [["Helado 1 kg", 4500], ["Palito bombón", 800]].forEach(([nombre, precio]) => agregarProducto("Frío Sur", { nombre, precio }));
    });

    await page.locator(".bottom-nav").getByRole("button", { name: "Catálogo" }).click();
    const catalogo = page.locator("#pantallaCatalogo");
    const mas = nombre => catalogo.locator(".itemCatalogo", { hasText: nombre }).locator(".btnCatalogoPedido");
    const barra = page.locator("#barraPedidoMedio");

    // El primer "+" abre el pedido encima, con el producto ya puesto.
    await mas("Helado 1 kg").click();
    const hoja = page.locator("#pantallaPedido.pedidoEnHoja");
    await expect(hoja).toBeVisible();
    await expect(catalogo).toBeVisible();
    await expect(page.locator("#totalPlataPedido")).toHaveText("$ 4.500");
    await capturar(page, "pedido-hoja-01-encima-del-catalogo");

    // Se baja con la X: queda el Catálogo y la barrita.
    await hoja.locator(".cerrarPedidoEncima").click();
    await expect(page.locator("#pantallaPedido")).toBeHidden();
    await expect(barra).toBeVisible();
    await expect(barra).toContainText("1 producto · $ 4.500");
    await expect(mas("Helado 1 kg")).toHaveText("1");

    // Con el pedido empezado, cada "+" suma uno sin abrir la hoja.
    await mas("Helado 1 kg").click();
    await mas("Palito bombón").click();
    await expect(page.locator("#pantallaPedido")).toBeHidden();
    await expect(mas("Helado 1 kg")).toHaveText("2");
    await expect(barra).toContainText("2 productos · $ 9.800");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "pedido-hoja-02-barrita-en-catalogo");

    // La barrita acompaña en las demás pantallas, menos en Más.
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    await expect(barra).toBeVisible();
    await page.locator(".bottom-nav").getByRole("button", { name: "Más" }).click();
    await expect(barra).toBeHidden();
    await page.locator(".bottom-nav").getByRole("button", { name: "Comercios" }).click();
    await expect(barra).toBeVisible();

    // "Ver pedido" lo vuelve a abrir con todo lo sumado.
    await barra.getByRole("button", { name: "Ver pedido" }).click();
    await expect(hoja).toBeVisible();
    await expect(page.locator("#pantallaComercios")).toBeVisible();
    await expect.poll(() => page.evaluate(() => obtenerDatosBorradorPedido().cantidades.map(i => i.producto + " " + i.cantidad).join(", ")))
        .toBe("Helado 1 kg 2, Palito bombón 1");
    await hoja.locator(".cerrarPedidoEncima").click();
    await expect(hoja).toBeHidden();

    // Empezar uno para un comercio con este a medio hacer: pregunta.
    await page.evaluate(() => irAPedidoRapido("Almacén Don Pepe"));
    const pregunta = page.locator(".preguntaPedidoMedio");
    await expect(pregunta).toContainText("Tenés un pedido a medio hacer");
    await capturar(page, "pedido-hoja-03-pregunta");
    await pregunta.getByRole("button", { name: "Seguir con ese" }).click();
    await expect(page.locator("#pantallaPedido")).toBeVisible();
    await expect(page.locator("#cliente")).toHaveValue("Almacén Don Pepe");
    await expect.poll(() => page.evaluate(() => obtenerDatosBorradorPedido().cantidades.length)).toBe(2);
});
