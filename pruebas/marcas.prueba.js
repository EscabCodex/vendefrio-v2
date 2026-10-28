// VendeFrío - Repaso de Catálogo: el orden de las marcas se cambia en
// Ajustes › Preferencias de trabajo (antes, flechitas en cada marca) y el
// color de una marca se elige desde el ⋯ de su ficha.
const { test, expect, capturar } = require("./ayudas");

test("marcas: orden en Ajustes y color desde la ficha de la marca", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Vendedor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(() => {
        guardarProductos({});
        ["Frío Sur", "Dulce Polar", "Hielo Austral"].forEach(marca => agregarMarca(marca));
        agregarProducto("Frío Sur", { nombre: "Helado 1 kg", precio: 4500 });
        agregarProducto("Dulce Polar", { nombre: "Torta helada", precio: 0 });
    });

    // Ajustes › Preferencias de trabajo › Orden de las marcas.
    await page.evaluate(() => window.abrirConfiguracionEn("trabajo"));
    await page.getByRole("button", { name: "Orden de las marcas" }).click();
    const hoja = page.getByRole("dialog", { name: "Orden de las marcas" });
    await expect(hoja.locator(".filaOrdenMarca strong")).toHaveText(["Frío Sur", "Dulce Polar", "Hielo Austral"]);
    await expect(hoja.getByRole("button", { name: "Subir Frío Sur" })).toBeDisabled();
    await hoja.getByRole("button", { name: "Subir Dulce Polar" }).click();
    await expect(hoja.locator(".filaOrdenMarca strong")).toHaveText(["Dulce Polar", "Frío Sur", "Hielo Austral"]);
    await capturar(page, "marcas-01-orden-en-ajustes");
    await hoja.getByRole("button", { name: "Listo" }).click();
    await expect(hoja).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => obtenerMarcasOrdenadas().join(", "))).toBe("Dulce Polar, Frío Sur, Hielo Austral");

    // En Editar marcas, ya en el orden nuevo y todas cerradas.
    await page.evaluate(() => mostrarPantalla("productos"));
    const lista = page.locator("#listaProductosAdmin");
    await expect(lista.locator(".tarjetaMarca .nombreMarca")).toHaveText(["Dulce Polar", "Frío Sur", "Hielo Austral"]);
    await expect(lista.locator(".tarjetaMarca.marcaCerrada")).toHaveCount(3);

    // Al buscar, se abren solas las que coinciden.
    await page.locator("#buscarProducto").fill("torta");
    await expect(lista.locator(".tarjetaMarca")).toHaveCount(1);
    await expect(lista.getByRole("button", { name: "Editar Torta helada" })).toContainText("+ Agregar precio");
    await page.locator("#buscarProducto").fill("");

    // Color desde el ⋯ de la ficha.
    await page.getByRole("button", { name: "Ficha de Hielo Austral" }).click();
    await page.locator(".modalFichaMarca").getByRole("button", { name: "Más opciones" }).click();
    await page.getByRole("dialog", { name: "Opciones de Hielo Austral" }).getByRole("button", { name: "Cambiar el color" }).click();
    const colores = page.getByRole("dialog", { name: "Color de Hielo Austral" });
    await expect(colores.locator(".colorMarca")).toHaveCount(6);
    await colores.getByRole("button", { name: "Color 5" }).click();
    await expect(page.locator(".modalFichaMarca")).toHaveClass(/tono4/);
    await expect(lista.locator(".tarjetaMarca", { hasText: "Hielo Austral" })).toHaveClass(/tono4/);
    await expect.poll(() => page.evaluate(() => window.colorElegidoDeMarca("Hielo Austral"))).toBe("tono4");
});
