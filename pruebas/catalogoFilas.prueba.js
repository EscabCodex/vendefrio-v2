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

    // La ficha guarda el gramaje.
    await page.getByRole("button", { name: "Opciones de Cucurucho" }).click();
    await page.getByRole("menu", { name: "Cucurucho" }).getByRole("button", { name: "Editar datos" }).click();
    const hoja = page.getByRole("dialog", { name: "Editar producto" });
    await hoja.locator(".contenidoCatalogoEdicion").fill("24 unidades");
    await capturar(page, "catalogo-filas-03-ficha");
    await hoja.locator(".guardarEdicionCatalogo").click();
    await expect(hoja).toBeHidden();
    await expect(tarjeta("Cucurucho").locator("small")).toHaveText("Frío Sur · 24 unidades");

    // Nuevo producto con gramaje.
    await catalogo.getByRole("button", { name: "+ Agregar producto" }).click();
    await page.locator("#productoNombre").fill("Tallarines");
    await page.locator("#productoPrecio").fill("3000");
    await page.locator("#productoContenido").fill("1 kg");
    await page.locator("#guardarProducto").click();
    await expect(tarjeta("Tallarines").locator("small")).toContainText("1 kg");
});
