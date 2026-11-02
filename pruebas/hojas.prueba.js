// VendeFrío - Ventanas que suben desde abajo y se cierran deslizándolas
// hacia abajo (T169, opción A que eligió el dueño), y el aviso "Tus datos no
// están protegidos" como tarjeta arriba de Inicio (opción B).
const { test, expect, capturar } = require("./ayudas");

// Arrastra con el dedo (eventos táctiles de verdad) desde la rayita de arriba
// de la hoja hacia abajo.
async function arrastrarHacia(page, hoja, distancia) {
    const caja = await hoja.boundingBox();
    const x = caja.x + caja.width / 2;
    const y = caja.y + 14;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let paso = 1; paso <= 8; paso++) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + (distancia * paso) / 8 }] });
        await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
}

test("hojas: suben desde abajo, se cierran deslizando y el aviso sin cuenta va en Inicio", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Vendedor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();

    // Sin cuenta: tarjeta arriba de Inicio, ya no el cartel flotante.
    const aviso = page.locator("#pantallaMenu #avisoModoPersonal");
    await expect(aviso).toContainText("Tus datos no están protegidos");
    await expect(page.locator("#cartelModoPersonal")).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "hojas-01-aviso-sin-cuenta");
    await aviso.getByRole("button", { name: "Guardar tus datos en la nube" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeVisible();
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    const formulario = page.locator("#inicioFormPersonal");
    await page.waitForTimeout(300);
    if (await formulario.isVisible()) await formulario.getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();

    // "¿Seguro?": ventana del medio con el tacho, encima de todo. Tocar
    // afuera la cierra sin hacer nada.
    await page.evaluate(() => { window.__borrado = false; abrirConfirmacion("¿Eliminar «Kiosco Luna» para siempre?", "Sus pedidos viejos quedan en Terminados.", () => { window.__borrado = true; }); });
    const confirmar = page.locator("#modalConfirmacion");
    await expect(confirmar).toBeVisible();
    await expect(confirmar.getByRole("button", { name: "Eliminar" })).toBeVisible();
    const caja = await confirmar.boundingBox();
    expect(caja.y).toBeGreaterThan(150);
    expect(caja.y + caja.height).toBeLessThan(700);
    await capturar(page, "hojas-02-seguro");
    await page.mouse.click(20, 20);
    await expect(confirmar).toBeHidden();
    expect(await page.evaluate(() => window.__borrado)).toBe(false);
    await page.evaluate(() => abrirConfirmacion("¿Eliminar «Kiosco Luna» para siempre?", "", () => { window.__borrado = true; }));
    await confirmar.getByRole("button", { name: "Eliminar" }).click();
    await expect(confirmar).toBeHidden();
    expect(await page.evaluate(() => window.__borrado)).toBe(true);

    // Un aviso también va al medio y un aviso nuevo reemplaza al anterior.
    await page.evaluate(() => mostrarAviso("No se guardaron los datos", "Revisá la señal y probá de nuevo."));
    const avisoVentana = page.locator("#modalAviso");
    await expect(avisoVentana).toBeVisible();
    await page.evaluate(() => mostrarAviso("Otra vez", "Se vuelve a abrir en su lugar."));
    await expect(avisoVentana).toHaveCount(1);
    await expect(avisoVentana).toContainText("Otra vez");
    await page.locator("#modalAviso").getByRole("button", { name: "Entendido" }).click();
    await expect(avisoVentana).toBeHidden();

    // Las hojas nuevas (Catálogo > tres puntitos > Editar datos) también.
    await page.evaluate(() => {
        agregarMarca("Frío Sur");
        agregarProducto("Frío Sur", { nombre: "Helado 1 kg", precio: 4500 });
    });
    await page.locator(".bottom-nav").getByRole("button", { name: "Catálogo" }).click();
    await page.getByRole("button", { name: "Opciones de Helado 1 kg" }).click();
    await page.getByRole("button", { name: "Editar datos" }).click();
    const opciones = page.locator(".pzHoja");
    await expect(opciones).toBeVisible();
    await arrastrarHacia(page, opciones, 260);
    await expect(page.locator(".pzFondo")).toHaveCount(0);
});
