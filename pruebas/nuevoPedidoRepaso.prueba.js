// VendeFrío - Repaso de diseño de Nuevo pedido (aprobado por el dueño el
// 2026-11-01), con los emuladores de Firebase.
// 1. Sin comercio: la tarjeta "Elegí un comercio" abre una hoja con la lupa
//    y Para hoy · Todos · Cerca; buscar y tocar un comercio lo elige.
// 2. La tarjeta del comercio como la ficha: dirección, teléfono y
//    "+ Agregar horario" (abre "Datos del comercio" ahí mismo).
// 3. Un nombre que no está guardado: la hoja ofrece crearlo o seguir sin
//    guardarlo; la tarjeta avisa "Este comercio no existe" y lo crea.
// 4. Un precio y una lista de precios "para siempre" para ese comercio.
// 5. Lupa primera en la fila de marcas, la nota en una línea y el ⋯ al lado
//    de "Guardar pedido" con su menú de íconos de colores.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, irAPedidos } = require("./recorridos");

test.use({ nube: true });

async function abrirNuevoPedido(page) {
    await irAPedidos(page);
    await page.locator(".bottom-nav .nav-nuevo").click();
    await page.locator(".menuCrear").getByRole("button", { name: "Nuevo pedido" }).click();
    await expect(page.locator("#pantallaPedido")).toBeVisible();
}

test("nuevo pedido: elegir comercio, comercio nuevo y precios para siempre", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(() => {
        agregarComercio({ nombre: "Kiosco Luna", direccion: "Belgrano 45", telefono: "" });
        agregarMarca("Dulce Polar");
        agregarProducto("Dulce Polar", { nombre: "Alfajor", precio: 600 });
    });
    await abrirNuevoPedido(page);

    // 1. La tarjeta "Elegí un comercio" y su hoja.
    const tarjetaVacia = page.locator(".elegirComercioPedido");
    await expect(tarjetaVacia).toBeVisible();
    await expect(tarjetaVacia).toContainText("Elegí un comercio");
    await expect(tarjetaVacia).toContainText("Tocá para buscar entre tus 2 comercios");
    await page.locator("#cliente").dispatchEvent("pointerdown", { button: 0 });
    const hoja = page.getByRole("dialog", { name: "Elegí un comercio" });
    await expect(hoja).toBeVisible();
    await expect(hoja.getByRole("button", { name: /^Todos/ })).toContainText("2");
    await expect(hoja.locator(".filaElegirComercio")).toHaveCount(2);
    await expect(hoja.locator(".filaElegirComercio").first()).toContainText("San Martín 123");
    // La lupa es el primer botón de la fila y filtra mientras escribís.
    await expect(hoja.locator(".filtrosElegirComercio > .pzLupa")).toBeVisible();
    await hoja.getByRole("button", { name: "Buscar comercio" }).click();
    await hoja.getByRole("searchbox", { name: "Buscar comercio" }).fill("belgr");
    await expect(hoja.locator(".filaElegirComercio")).toHaveCount(1);
    await expect(hoja.locator(".filaElegirComercio")).toContainText("Kiosco Luna");
    await capturar(page, "nuevoPedido-01-elegir-comercio");
    await hoja.getByRole("searchbox", { name: "Buscar comercio" }).fill("pepe");
    await hoja.getByRole("button", { name: "Elegir Almacén Don Pepe" }).click();
    await expect(hoja).toBeHidden();
    await expect(page.locator("#cliente")).toHaveValue("Almacén Don Pepe");

    // 2. La tarjeta del comercio, con "+ Agregar horario".
    const tarjeta = page.locator("#comercioElegidoPedido");
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toContainText("San Martín 123");
    await expect(tarjeta).toContainText("11 5555-1234");
    await tarjeta.getByRole("button", { name: "Agregar horario" }).click();
    const datos = page.getByRole("dialog", { name: "Datos del comercio" });
    await expect(datos).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(datos).toBeHidden();

    // 5. Lupa en la fila de marcas, nota en una línea, ⋯ abajo.
    const marcas = page.locator("#chipsMarcasPedido");
    await expect(marcas.locator(":scope > .pzLupa")).toBeVisible();
    await expect(marcas.getByRole("button", { name: /^Todas/ })).toContainText("3");
    await expect(page.locator(".accionesBusquedaPedido")).toHaveCount(0);
    await expect(page.locator("#obs")).toHaveAttribute("placeholder", "Agregar una nota para este pedido");
    await page.locator(".tituloMarca", { hasText: "Frío Sur" }).click();
    const helado = page.locator(".listaProdutos .fila", { hasText: "Helado 1 kg" });
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    const masOpciones = page.getByRole("button", { name: "Más opciones del pedido" });
    await expect(page.locator(".piePedido")).toContainText("Guardar pedido");
    expect(await masOpciones.evaluate(boton => Boolean(boton.closest(".piePedido")))).toBe(true);
    await masOpciones.click();
    const menu = page.getByRole("menu", { name: "Opciones del pedido" });
    await expect(menu).toBeVisible();
    await expect(menu.locator(".menuFlotanteItem.conColor").first()).toBeVisible();
    await expect(menu.locator(".menuFlotanteItem").last()).toHaveText("Vaciar pedido");
    await capturar(page, "nuevoPedido-02-menu-opciones");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    // 4a. Un precio para siempre para Almacén Don Pepe.
    await helado.getByRole("button", { name: "Cambiar el precio de Helado 1 kg para este pedido" }).click();
    const hojaPrecio = page.getByRole("dialog", { name: "Precio para este pedido" });
    await hojaPrecio.getByLabel("Precio por unidad").fill("5000");
    await hojaPrecio.getByRole("button", { name: "Guardar precio" }).click();
    const siempre = page.getByRole("alertdialog", { name: "¿Guardar este precio para siempre?" });
    await expect(siempre).toContainText("Helado 1 kg a $ 5.000 en todos los próximos pedidos de Almacén Don Pepe");
    await expect(siempre).toContainText("($ 4.500)");
    await capturar(page, "nuevoPedido-03-precio-para-siempre");
    await siempre.getByRole("button", { name: "Para siempre" }).click();
    await expect(page.locator("#totalPlataPedido")).toHaveText("$ 5.000");
    // Queda guardado en el comercio; los demás siguen con el del catálogo.
    expect(await page.evaluate(() => {
        const producto = productosParaLeer()["Frío Sur"].find(item => item.nombre === "Helado 1 kg");
        return [precioVigente(producto, buscarComercioPorNombre("Almacén Don Pepe")), precioVigente(producto, buscarComercioPorNombre("Kiosco Luna"))];
    })).toEqual([5000, 4500]);

    // 3. Un comercio que no está guardado.
    await tarjeta.getByRole("button", { name: "Cambiar" }).click();
    await expect(hoja).toBeVisible();
    await hoja.getByRole("button", { name: "Buscar comercio" }).click();
    await hoja.getByRole("searchbox", { name: "Buscar comercio" }).fill("Almacén Coco");
    await expect(hoja).toContainText("No tenés «Almacén Coco» guardado");
    await capturar(page, "nuevoPedido-04-comercio-que-no-existe");
    await hoja.getByRole("button", { name: "Hacer el pedido sin guardarlo" }).click();
    await expect(page.locator("#cliente")).toHaveValue("Almacén Coco");
    await expect(tarjeta).toContainText("Este comercio no existe");
    await expect(tarjeta).toContainText("No está en tus comercios");
    // Con otro comercio vuelve el precio del catálogo.
    await expect(page.locator("#totalPlataPedido")).toHaveText("$ 4.500");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "nuevoPedido-05-tarjeta-sin-guardar");
    await tarjeta.getByRole("button", { name: "Crear «Almacén Coco»" }).click();
    const nuevo = page.getByRole("dialog", { name: "Nuevo comercio" });
    await expect(nuevo.locator("#modalNombre")).toHaveValue("Almacén Coco");
    await nuevo.getByRole("button", { name: /Guardar/ }).click();
    await expect(nuevo).toBeHidden();
    await expect(tarjeta).not.toContainText("Este comercio no existe");
    expect(await page.evaluate(() => Boolean(buscarComercioPorNombre("Almacén Coco")))).toBe(true);
});
