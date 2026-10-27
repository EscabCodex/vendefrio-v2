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

    // "¿Seguro?": sube desde abajo, pegada al borde de la pantalla.
    await page.evaluate(() => abrirConfirmacion("Eliminar comercio", "¿Seguro que querés eliminar «Kiosco Luna»?", () => {}));
    const confirmar = page.locator("#modalConfirmacion");
    const hojaConfirmar = confirmar.locator(".modalContenido");
    await expect(confirmar).toBeVisible();
    await expect(confirmar).toHaveClass(/modalHoja/);
    const caja = await hojaConfirmar.boundingBox();
    expect(Math.round(caja.y + caja.height)).toBeGreaterThanOrEqual(843);
    await capturar(page, "hojas-02-seguro");

    // Un arrastre cortito no la cierra; uno largo sí.
    await arrastrarHacia(page, hojaConfirmar, 40);
    await page.waitForTimeout(400);
    await expect(confirmar).toBeVisible();
    await arrastrarHacia(page, hojaConfirmar, 260);
    await expect(confirmar).toBeHidden();

    // Un aviso también, y se puede volver a abrir bien puesto.
    await page.evaluate(() => mostrarAviso("No se guardaron los datos", "Revisá la señal y probá de nuevo."));
    const avisoVentana = page.locator("#modalAviso");
    await expect(avisoVentana).toBeVisible();
    await arrastrarHacia(page, avisoVentana.locator(".modalContenido"), 260);
    await expect(avisoVentana).toBeHidden();
    await page.evaluate(() => mostrarAviso("Otra vez", "Se vuelve a abrir en su lugar."));
    await expect(avisoVentana.locator(".modalContenido")).toHaveCSS("transform", "none");
    await page.locator("#modalAviso").getByRole("button").first().click();
    await expect(avisoVentana).toBeHidden();

    // Las hojas nuevas (Catálogo > tres puntitos) también.
    await page.evaluate(() => {
        agregarMarca("Frío Sur");
        agregarProducto("Frío Sur", { nombre: "Helado 1 kg", precio: 4500 });
    });
    await page.locator(".bottom-nav").getByRole("button", { name: "Catálogo" }).click();
    await page.getByRole("button", { name: "Opciones de Helado 1 kg" }).click();
    const opciones = page.locator(".pzHoja");
    await expect(opciones).toBeVisible();
    await arrastrarHacia(page, opciones, 260);
    await expect(page.locator(".pzFondo")).toHaveCount(0);
});
