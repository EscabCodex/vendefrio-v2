// VendeFrío - Importar planilla (T84): productos desde un CSV, con vista
// previa, y comercios desde otra planilla.
const { test, expect, capturar } = require("./ayudas");
const { abrirMas } = require("./recorridos");

async function entrarPersonal(page) {
    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Vendedor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
}

test("importar: productos y comercios desde una planilla", async ({ page }) => {
    await entrarPersonal(page);
    await page.evaluate(() => {
        agregarMarca("Frío Sur");
        agregarProducto("Frío Sur", { nombre: "Helado 1 kg", precio: 4500 });
    });

    await abrirMas(page);
    await page.locator(".masAccesos").getByRole("button", { name: /Importar planilla/ }).click();
    const pantalla = page.locator("#pantallaImportar");
    await expect(pantalla).toBeVisible();
    await expect(pantalla.locator(".pasoImportar")).toHaveCount(3);

    const csv = [
        "Producto;Marca;Precio",
        "Helado 1 kg;Frío Sur;$ 4.800",
        "Palito bombón x 20;Frío Sur;1.400",
        "Tapas de hojaldre;La Salteña;1100,50",
        "Tubo La sequita;Frío Sur;"
    ].join("\n");
    await pantalla.locator("#archivoPlanilla").setInputFiles({ name: "productos-octubre.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

    await expect(pantalla.locator(".pasoImportar").first()).toContainText("productos-octubre.csv · 4 filas");
    await expect(pantalla.locator(".pasoImportar").nth(1)).toContainText("Nombre · Marca · Precio");
    const filas = pantalla.locator(".tablaImportar .filaTabla:not(.cabTabla)");
    await expect(filas).toHaveCount(4);
    await expect(filas.filter({ hasText: "Helado 1 kg" })).toContainText("Precio nuevo");
    await expect(filas.filter({ hasText: "Helado 1 kg" })).toContainText("$ 4.800");
    await expect(filas.filter({ hasText: "Palito bombón x 20" })).toContainText("Nuevo");
    await expect(filas.filter({ hasText: "Tubo La sequita" })).toContainText("Sin precio");
    await expect(pantalla.locator("#resumenImportar")).toContainText("4 productos listos");
    const confirmar = pantalla.getByRole("button", { name: "Importar 4 productos" });
    await expect(confirmar).toBeVisible();
    await capturar(page, "importar-01-vista-previa");

    await confirmar.click();
    await expect(page.getByText("Listo: 4 productos")).toBeVisible();
    const precios = await page.evaluate(() => {
        const productos = obtenerProductos();
        const de = (marca, nombre) => (productos[marca] || []).find(producto => producto.nombre === nombre)?.precio;
        return [de("Frío Sur", "Helado 1 kg"), de("Frío Sur", "Palito bombón x 20"), de("La Salteña", "Tapas de hojaldre"), de("Frío Sur", "Tubo La sequita")];
    });
    expect(precios).toEqual([4800, 1400, 1100.5, 0]);
    await page.getByRole("button", { name: "Ver el catálogo" }).click();
    await expect(page.locator("#pantallaImportar")).toBeHidden();

    // Comercios: con dirección y teléfono la reconoce sola.
    await abrirMas(page);
    await page.locator(".masAccesos").getByRole("button", { name: /Importar planilla/ }).click();
    const comercios = "Nombre,Dirección,Teléfono\nKiosco Luna,Belgrano 45,11 4000-1111\nDespensa Mary,Mitre 900,11 4444-2222\n";
    await pantalla.locator("#archivoPlanilla").setInputFiles({ name: "clientes.csv", mimeType: "text/csv", buffer: Buffer.from(comercios) });
    await expect(pantalla.locator(".cabTabla")).toContainText("Comercio");
    await pantalla.getByRole("button", { name: "Importar 2 comercios" }).click();
    await expect(page.getByText("Listo: 2 comercios")).toBeVisible();
    expect(await page.evaluate(() => obtenerComercios().map(comercio => comercio.nombre).sort())).toEqual(expect.arrayContaining(["Despensa Mary", "Kiosco Luna"]));
});
