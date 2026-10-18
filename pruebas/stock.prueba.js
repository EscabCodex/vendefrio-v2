// VendeFrío - Código de barras (T89) y stock simple (T90), en modo personal.
const { test, expect, capturar } = require("./ayudas");

async function entrarPersonal(page) {
    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Vendedor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
}

test("stock y código de barras: contar, llegó de fábrica, poco stock y escanear", async ({ page }) => {
    await entrarPersonal(page);
    await page.evaluate(() => {
        agregarComercio({ nombre: "Kiosco Luna", direccion: "Belgrano 45" });
        agregarMarca("Frío Sur");
        agregarProducto("Frío Sur", { nombre: "Helado 1 kg", precio: 4500 });
        agregarProducto("Frío Sur", { nombre: "Palito bombón", precio: 800 });
        agregarProducto("Frío Sur", { nombre: "Cucurucho", precio: 1200 });
    });
    await page.locator(".bottom-nav").getByRole("button", { name: "Catálogo" }).click();
    const catalogo = page.locator("#pantallaCatalogo");
    await catalogo.locator(".chipMarca", { hasText: "Frío Sur" }).click();

    // Código de barras del helado.
    await page.getByRole("button", { name: "Opciones de Helado 1 kg" }).click();
    await page.getByRole("button", { name: "Código de barras" }).click();
    const codigo = page.getByRole("dialog", { name: "Código de barras" });
    await codigo.locator("#codigoProducto").fill("7790001234567");
    await codigo.getByRole("button", { name: "Guardar" }).click();

    // Contar el stock del helado: hay 20.
    await page.getByRole("button", { name: "Opciones de Helado 1 kg" }).click();
    await page.getByRole("button", { name: "Llevar stock" }).click();
    const contar = page.getByRole("dialog", { name: "Contar stock" });
    await contar.locator("#stockContado").fill("20");
    await contar.getByRole("button", { name: "Guardar" }).click();

    // Llegó de fábrica: 100 cucuruchos y 10 palitos.
    // Abajo de todo: se centra para que no lo tape el cartel del modo personal.
    const llego = catalogo.getByRole("button", { name: "Cargar lo que llegó de fábrica" });
    await llego.evaluate(boton => boton.scrollIntoView({ block: "center" }));
    await llego.click();
    const fabrica = page.getByRole("dialog", { name: "Cargar lo que llegó de fábrica" });
    await fabrica.getByRole("spinbutton", { name: "Llegaron de Cucurucho" }).fill("100");
    await fabrica.getByRole("spinbutton", { name: "Llegaron de Palito bombón" }).fill("10");
    await fabrica.getByRole("button", { name: "Guardar" }).click();

    // Se vendieron 8 helados.
    await page.evaluate(() => {
        guardarHistorial([{ comercio: "Kiosco Luna", timestamp: Date.now() + 1000, productos: [{ marca: "Frío Sur", producto: "Helado 1 kg", cantidad: 8, precio: 4500 }] }]);
        window.renderizarCatalogo();
    });
    const tarjeta = nombre => catalogo.locator(".itemCatalogo", { hasText: nombre });
    await expect(tarjeta("Helado 1 kg").locator(".stockCatalogo")).toHaveText(/12 u\s*Poco/);
    await expect(tarjeta("Palito bombón").locator(".stockCatalogo")).toHaveText(/10 u\s*Poco/);
    await expect(tarjeta("Cucurucho").locator(".stockCatalogo")).toHaveText(/100 u\s*Disponible/);
    await expect(catalogo.locator("#avisoStockBajo")).toContainText("2 productos con poco stock");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "stock-01-catalogo");
    await catalogo.locator("#avisoStockBajo").click();
    await expect(page.getByRole("dialog", { name: "Poco stock" })).toContainText("Helado 1 kg");
    await page.keyboard.press("Escape");

    // Escanear en Nuevo pedido (sin cámara: se escribe el número).
    await page.evaluate(() => mostrarPantalla("pedido"));
    await page.getByRole("button", { name: "Más opciones del pedido" }).click();
    await page.getByRole("button", { name: "Escanear código de barras" }).click();
    const escaner = page.getByRole("dialog", { name: "Escanear producto" });
    await escaner.getByRole("textbox", { name: "Número del código de barras" }).fill("7790001234567");
    await escaner.getByRole("button", { name: "Buscar" }).click();
    await expect(escaner.locator(".productoEscaneado")).toContainText("Helado 1 kg");
    await expect(escaner.locator(".productoEscaneado")).toContainText("Frío Sur · $ 4.500 · 7790001234567");
    await escaner.getByRole("button", { name: "Uno más" }).click();
    await capturar(page, "stock-02-escanear");
    await escaner.getByRole("button", { name: "Sumar al pedido" }).click();
    await escaner.getByRole("button", { name: "Cerrar" }).click();
    await expect(page.locator('.marca select[data-producto="Helado 1 kg"]')).toHaveValue("2");
});
