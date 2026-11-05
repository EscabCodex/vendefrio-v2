// VendeFrío - Tanda 3: el Catálogo arranca en filas, con "Fotos" como vista
// limpia para mostrarle al cliente, y cada producto tiene su gramaje o
// unidades (ficha, fila, folleto).
const { test, expect, capturar, usarSinCuenta } = require("./ayudas");

test("catálogo: filas por defecto, modo foto y gramaje", async ({ page }) => {
    await page.goto("/");
    await usarSinCuenta(page, "vendedor");
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(() => {
        guardarProductos({});
        agregarMarca("Frío Sur");
        agregarMarca("Pastas Doña Rosa");
        [["Helado de dulce de leche", 4500], ["Palito bombón", 800], ["Cucurucho", 1200]].forEach(([nombre, precio]) => agregarProducto("Frío Sur", { nombre, precio }));
        [["Ravioles de verdura", 5600], ["Ñoquis de papa", 3900]].forEach(([nombre, precio]) => agregarProducto("Pastas Doña Rosa", { nombre, precio }));
        const contenidos = { "Helado de dulce de leche": "1 kg", "Palito bombón": "12 unidades", "Ravioles de verdura": "500 g" };
        Object.values(obtenerProductos()).forEach(lista => lista.forEach(p => { if (contenidos[p.nombre]) actualizarProductoPorId(p.id, { contenido: contenidos[p.nombre] }); }));
    });
    await page.locator(".bottom-nav").getByRole("button", { name: "Catálogo" }).click();
    const catalogo = page.locator("#pantallaCatalogo");
    const grilla = catalogo.locator("#grillaCatalogo");
    const tarjeta = nombre => catalogo.locator(".itemCatalogo", { hasText: nombre });

    // Arranca en filas, con el gramaje al lado de la marca.
    await expect(grilla).toHaveClass(/vistaLista/);
    await expect(catalogo.getByRole("button", { name: "Ver en filas" })).toHaveAttribute("aria-pressed", "true");
    await expect(tarjeta("Ravioles de verdura").locator("small")).toHaveText("Pastas Doña Rosa · 500 g");
    await expect(tarjeta("Cucurucho").locator("small")).toHaveText("Frío Sur");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "catalogo-filas-01-filas");

    // Modo foto: sin ⋯, sin + y sin "Agregar foto".
    await catalogo.getByRole("button", { name: "Modo foto, para mostrar al cliente" }).click();
    await expect(grilla).toHaveClass(/modoFoto/);
    await expect(tarjeta("Cucurucho").locator(".btnCatalogoEditar")).toBeHidden();
    await expect(tarjeta("Cucurucho").locator(".btnCatalogoPedido")).toBeHidden();
    await expect(tarjeta("Cucurucho").locator(".agregarFotoCatalogo")).toBeHidden();
    await capturar(page, "catalogo-filas-02-modo-foto");
    await catalogo.getByRole("button", { name: "Ver en filas" }).click();

    // La ficha del producto: números, filas para cambiar cada dato y
    // "Cómo viene" que se abre ahí mismo y se guarda solo.
    await page.evaluate(() => {
        const pedido = (comercio, cantidad) => ({ comercio, timestamp: Date.now(), productos: [{ marca: "Frío Sur", producto: "Cucurucho", cantidad, precio: 1200 }] });
        guardarHistorial(obtenerHistorial().concat([pedido("Almacén Don Pepe", 36), pedido("Kiosco La Esquina", 24)]));
    });
    await tarjeta("Cucurucho").locator("strong").click();
    const ficha = page.getByRole("dialog", { name: "Cucurucho" });
    await expect(ficha.locator(".fichaNumeros")).toContainText("60vendidos este mes");
    await expect(ficha.locator(".quienCompraFila").first()).toHaveText(/Almacén Don Pepe\s*36 u\./);
    await ficha.getByRole("button", { name: "Agregar cómo viene" }).click();
    const abierta = ficha.locator(".fichaComoVieneAbierta");
    await abierta.locator(".comoVieneRapido", { hasText: "24" }).click();
    await expect(abierta.locator(".comoVieneCantidad")).toHaveText("24");
    await abierta.getByRole("button", { name: "Más" }).click();
    await expect(abierta.locator(".comoVieneCantidad")).toHaveText("25");
    await abierta.getByRole("button", { name: "Menos" }).click();
    await capturar(page, "catalogo-filas-03-ficha");
    await ficha.locator(".fichaNumeros").click();
    await expect(ficha.getByRole("button", { name: "Cambiar cómo viene" })).toContainText("Caja de 24 unidades");
    await ficha.getByRole("button", { name: "Cambiar nombre" }).click();
    await page.getByRole("dialog", { name: "Nombre" }).locator(".datoProductoEntrada").fill("Cucurucho grande");
    await page.locator(".guardarDatoProducto").click();
    await expect(page.getByRole("dialog", { name: "Cucurucho grande" })).toBeVisible();
    await page.getByRole("button", { name: "Cerrar ficha" }).click();
    await expect(tarjeta("Cucurucho grande").locator("small")).toHaveText("Frío Sur · Caja de 24 unidades");

    // Nuevo producto con gramaje.
    await catalogo.getByRole("button", { name: "+ Agregar producto" }).click();
    await page.locator("#productoNombre").fill("Tallarines");
    await page.locator("#productoPrecio").fill("3000");
    await page.locator("#productoContenido").fill("1 kg");
    await page.locator("#guardarProducto").click();
    await expect(tarjeta("Tallarines").locator("small")).toContainText("1 kg");
});
