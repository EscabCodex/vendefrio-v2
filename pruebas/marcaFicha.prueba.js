// VendeFrío - Ficha de la marca para estudiar el mercado: números del mes,
// lectura armada con los datos, productos por ventas, quién la compra,
// a quién ofrecérsela y contra las otras marcas.
const { test, expect, capturar, usarSinCuenta } = require("./ayudas");

test("ficha de la marca: estudiar el mercado", async ({ page }) => {
    await page.goto("/");
    await usarSinCuenta(page, "vendedor");
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(() => {
        guardarProductos({});
        agregarMarca("Frío Sur");
        agregarMarca("Pastas Doña Rosa");
        [["Helado 1 kg", 4500], ["Palito bombón", 800], ["Cucurucho", 1200]].forEach(([nombre, precio]) => agregarProducto("Frío Sur", { nombre, precio }));
        [["Ravioles de ricota", 5600], ["Ñoquis de papa", 3900]].forEach(([nombre, precio]) => agregarProducto("Pastas Doña Rosa", { nombre, precio }));
        const ahora = Date.now();
        const item = (marca, producto, cantidad, precio) => ({ marca, producto, cantidad, precio });
        const pedido = (comercio, productos) => ({ comercio, timestamp: ahora, productos });
        guardarHistorial(obtenerHistorial().concat([
            pedido("Almacén Don Pepe", [item("Frío Sur", "Helado 1 kg", 20, 4500), item("Frío Sur", "Palito bombón", 30, 800)]),
            pedido("Kiosco La Esquina", [item("Frío Sur", "Helado 1 kg", 8, 4500), item("Pastas Doña Rosa", "Ravioles de ricota", 6, 5600)]),
            pedido("Súper El Sol", [item("Pastas Doña Rosa", "Ravioles de ricota", 12, 5600)]),
            pedido("Despensa Mari", [item("Pastas Doña Rosa", "Ñoquis de papa", 5, 3900)])
        ]));
    });
    await page.locator(".bottom-nav").getByRole("button", { name: "Catálogo" }).click();
    const catalogo = page.locator("#pantallaCatalogo");
    await catalogo.locator("#chipsMarcasCatalogo .filtroEtapa", { hasText: "Frío Sur" }).click();
    await catalogo.getByRole("button", { name: "Ver ficha de Frío Sur" }).click();
    const ficha = page.getByRole("dialog", { name: "Frío Sur" });
    await expect(ficha.locator(".fichaNumeros > div")).toHaveCount(6);
    await expect(ficha.locator(".fichaNumeros")).toContainText("2 de 4comercios la compran");
    await expect(ficha.locator(".fichaMarcaLectura")).toContainText("Palito bombón es el 52%");
    await expect(ficha.locator(".fichaMarcaLectura")).toContainText("2 comercios que te compran otras cosas nunca le compraron");
    await expect(ficha.locator(".filaFichaMarca").first()).toContainText("Palito bombón");
    await expect(ficha.locator(".filaFichaMarca", { hasText: "Cucurucho" })).toContainText("Sin ventas en 30 días");
    await expect(ficha.locator(".fichaMarcaComercios .filaBarraMarca").first()).toContainText("Almacén Don Pepe");
    await expect(ficha.locator(".fichaMarcaOportunidades .filaBarraMarca")).toHaveCount(2);
    await expect(ficha.locator(".fichaMarcaRanking .filaBarraMarca.resaltada")).toContainText("Frío Sur");
    await capturar(page, "marca-01-ficha-arriba");
    await ficha.locator(".fichaMarcaRanking").scrollIntoViewIfNeeded();
    await capturar(page, "marca-02-ficha-abajo");
});
