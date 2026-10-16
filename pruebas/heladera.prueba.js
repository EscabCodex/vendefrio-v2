// VendeFrío - Foto de la heladera (T92), en modo personal: dos visitas con
// foto, la última grande y la anterior abajo para comparar.
const path = require("path");
const { test, expect, capturar } = require("./ayudas");

test("heladera: foto con comentario y las anteriores para comparar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Vendedor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(() => agregarComercio({ nombre: "Almacén Don Pepe", direccion: "San Martín 123" }));

    await page.evaluate(() => window.abrirFichaComercio("Almacén Don Pepe"));
    await page.locator(".modalFichaComercio").getByRole("button", { name: "Exhibición" }).click();
    const pantalla = page.locator("#pantallaHeladera");
    await expect(pantalla).toContainText("Todavía no hay fotos");

    for (const [estado, comentario] of [["Para mejorar", "Faltan palitos en la segunda fila"], ["Bien puesta", "Quedó ordenada"]]) {
        await pantalla.getByRole("button", { name: "Sacar foto", exact: true }).click();
        const hoja = page.getByRole("dialog", { name: "Foto de la heladera" });
        await hoja.locator("#archivoHeladera").setInputFiles(path.join(__dirname, "qr-prueba.png"));
        await expect(hoja.locator(".textoFotoHeladera")).toHaveText("Cambiar foto");
        await hoja.getByRole("button", { name: estado }).click();
        await hoja.locator("#notaHeladera").fill(comentario);
        await hoja.getByRole("button", { name: "Guardar foto" }).click();
        await expect(hoja).toBeHidden();
    }

    await expect(pantalla.locator(".pieFotoHeladera")).toContainText("Quedó ordenada");
    await expect(pantalla.locator(".pieFotoHeladera")).toContainText("Bien puesta");
    await expect(pantalla.locator(".fotoAnterior")).toHaveCount(1);
    await capturar(page, "heladera-01-exhibicion");
    await pantalla.locator(".fotoAnterior").click();
    await expect(page.getByRole("dialog").last()).toContainText("Faltan palitos en la segunda fila");
});
