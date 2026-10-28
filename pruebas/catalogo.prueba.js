// VendeFrío - Catálogo nuevo (T166, opción A que eligió el dueño): cuadros
// con el color de cada marca, aviso de productos sin precio, Editar marcas
// en tarjetas (tocar el producto para editarlo, opciones de la marca en una
// hoja), "Editar precio o foto" en una hoja y "Pedido generado" y Nuevo
// comercio con el estilo nuevo.
const { test, expect, capturar } = require("./ayudas");

test("catálogo: cuadros de color, editar marcas y ventanas nuevas", async ({ page }) => {
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
        agregarMarca("Pastas Doña Rosa");
        [["Helado 1 kg", 4500], ["Palito bombón", 800], ["Cucurucho", 1200]].forEach(([nombre, precio]) => agregarProducto("Frío Sur", { nombre, precio }));
        [["Ravioles de verdura x 1 kg", 5600], ["Ñoquis de papa", 0]].forEach(([nombre, precio]) => agregarProducto("Pastas Doña Rosa", { nombre, precio }));
    });

    // Productos: cada marca con su color, el precio con punto y el aviso.
    await page.locator(".bottom-nav").getByRole("button", { name: "Catálogo" }).click();
    const catalogo = page.locator("#pantallaCatalogo");
    const tarjeta = nombre => catalogo.locator(".itemCatalogo", { hasText: nombre });
    await expect(tarjeta("Helado 1 kg")).toHaveClass(/tono0/);
    await expect(tarjeta("Ravioles de verdura")).toHaveClass(/tono1/);
    await expect(tarjeta("Helado 1 kg").locator("b")).toHaveText("$ 4.500");
    await expect(tarjeta("Ñoquis de papa").locator("b.sinPrecioCatalogo")).toHaveText("+ Agregar precio");
    // Repaso de Catálogo: filtros con el número adentro arriba del buscador,
    // las marcas primero y "Sin precio" al final.
    const filtros = catalogo.locator("#chipsMarcasCatalogo .filtroEtapa");
    await expect(filtros).toHaveText([/Todas\s*5/, /Frío Sur\s*3/, /Pastas Doña Rosa\s*2/, /Sin precio\s*1/]);
    await expect(catalogo.locator("#vistaCatalogo")).toContainText("+ Agregar producto");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "catalogo-01-productos");
    const sinPrecio = catalogo.locator("#chipsMarcasCatalogo .filtroEtapa", { hasText: "Sin precio" });
    await sinPrecio.click();
    await expect(catalogo.locator(".itemCatalogo")).toHaveCount(1);
    await expect(sinPrecio).toHaveAttribute("aria-pressed", "true");
    await sinPrecio.click();
    await expect(catalogo.locator(".itemCatalogo")).toHaveCount(5);

    // Editar precio o foto: hoja nueva, con el "$" adelante.
    // El ⋯ abre el menú flotante, con "Editar datos" resaltado arriba.
    await page.getByRole("button", { name: "Opciones de Helado 1 kg" }).click();
    const menu = page.getByRole("menu", { name: "Helado 1 kg" });
    await expect(menu.locator(".menuFlotanteItem").first()).toHaveText("Editar datos");
    await expect(menu.getByRole("button", { name: "Agregar al pedido" })).toHaveCount(0);
    await capturar(page, "catalogo-01b-menu-producto");
    await menu.getByRole("button", { name: "Editar datos" }).click();
    const hoja = page.getByRole("dialog", { name: "Editar producto" });
    await expect(hoja.getByText("Poner foto")).toBeVisible();
    await hoja.locator(".precioCatalogoEdicion").fill("4800");
    await capturar(page, "catalogo-02-editar-precio-o-foto");
    await hoja.locator(".guardarEdicionCatalogo").click();
    await expect(hoja).toBeHidden();
    await expect(tarjeta("Helado 1 kg").locator("b")).toHaveText("$ 4.800");

    // Editar marcas: tarjetas con las iniciales, filas que se tocan.
    await page.getByRole("tab", { name: "Editar marcas" }).click();
    const marcas = page.locator("#listaProductosAdmin");
    const friosur = marcas.locator(".tarjetaMarca", { hasText: "Frío Sur" });
    await expect(friosur.locator(".inicialesMarca")).toHaveText("FS");
    await expect(marcas.locator(".tarjetaMarca", { hasText: "Pastas Doña Rosa" })).toContainText("2 productos · 1 sin precio");
    await expect(friosur.getByRole("button", { name: "Editar Palito bombón" })).toContainText("$ 800");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "catalogo-03-editar-marcas");

    // Tocar el producto: nombre, precio y "Archivar producto".
    await friosur.getByRole("button", { name: "Editar Palito bombón" }).click();
    await expect(page.locator("#modalProducto")).toBeVisible();
    await expect(page.locator("#productoNombre")).toHaveValue("Palito bombón");
    await capturar(page, "catalogo-04-editar-producto");
    await page.locator("#archivarDesdeModal").click();
    await expect(page.locator("#modalProducto")).toBeHidden();
    await expect(page.locator(".pzDeshacer")).toContainText("“Palito bombón” archivado");
    await expect(marcas.locator(".tarjetaArchivados")).toContainText("Palito bombón");

    // "Agregar producto a Frío Sur" ya elige la marca.
    await friosur.getByRole("button", { name: "Agregar producto a Frío Sur" }).click();
    await expect(page.locator("#productoMarca")).toHaveValue("Frío Sur");
    await expect(page.locator("#archivarDesdeModal")).toBeHidden();
    await page.locator("#cancelarProducto").click();

    // Opciones de la marca: cambiar el nombre.
    await page.getByRole("button", { name: "Opciones de Pastas Doña Rosa" }).click();
    const opciones = page.getByRole("dialog", { name: "Pastas Doña Rosa" });
    await expect(opciones.getByRole("button", { name: "Eliminar marca" })).toBeVisible();
    await capturar(page, "catalogo-05-opciones-de-la-marca");
    await opciones.getByRole("button", { name: "Cambiar el nombre" }).click();
    await page.locator("#productoNombre").fill("Pastas Rosa");
    await page.locator("#guardarProducto").click();
    await expect(marcas.locator(".tarjetaMarca", { hasText: "Pastas Rosa" }).locator(".inicialesMarca")).toHaveText("PR");

    // Nuevo comercio: hoja nueva (antes se espera que se vaya el "Deshacer").
    await expect(page.locator(".pzDeshacer.visible")).toHaveCount(0, { timeout: 10000 });
    await page.locator(".bottom-nav").getByRole("button", { name: "Comercios" }).click();
    await page.locator("#agregarComercio").click();
    await expect(page.getByRole("dialog", { name: "Nuevo comercio" })).toBeVisible();
    await capturar(page, "catalogo-06-nuevo-comercio");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Nuevo comercio" })).toHaveCount(0);

    // Pedido generado: sin emojis en la ventana (el mensaje copiado los tiene).
    await page.evaluate(() => mostrarPantalla("pedido"));
    await page.locator("#cliente").fill("Almacén Don Pepe");
    const helado = page.locator(".listaProdutos .fila", { hasText: "Helado 1 kg" });
    if (!(await helado.isVisible())) await page.locator(".tituloMarca", { hasText: "Frío Sur" }).click();
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    await page.locator("#generar").click();
    const generado = page.locator("#modalPedido");
    await expect(generado).toBeVisible();
    await expect(generado).toContainText("Almacén Don Pepe · 1 producto");
    const detalle = await page.locator("#pedidoDetalle").innerText();
    expect(detalle).toContain("Frío Sur");
    expect(detalle).not.toMatch(/\p{Extended_Pictographic}/u);
    await capturar(page, "catalogo-07-pedido-generado");
    await generado.click({ position: { x: 10, y: 10 } });
    await expect(generado).toBeHidden();
});
