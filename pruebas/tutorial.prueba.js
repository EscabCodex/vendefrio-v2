// VendeFrío - Tutorial interactivo (T157): al crear la cuenta, con todo en
// cero, el tutorial señala cada botón real y espera a que la persona lo
// haga: un comercio, una marca, un producto con precio, el primer pedido,
// la ruta y la entrega. Después, la primera vez que se entra a otra
// pantalla (Estadísticas), un tutorial corto de esa pantalla. Se vuelve a
// ver y se apaga desde Más > Seguridad y ayuda.
const { test, expect, capturar, deslizar } = require("./ayudas");
const { abrirConfiguracionEn } = require("./recorridos");

test.use({ nube: true });

// En las demás pruebas el tutorial no sale solo: acá sí.
test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { window.vendefrioPruebas.tutorial = true; });
});

// El recuadro tiene que estar encima del botón que explica.
async function esperarFocoSobre(page, selector) {
    await expect.poll(() => page.evaluate(selector => {
        const foco = document.querySelector(".tutorialFoco");
        const elemento = document.querySelector(selector);
        if (!foco || !elemento || foco.hidden) return false;
        const a = foco.getBoundingClientRect();
        const b = elemento.getBoundingClientRect();
        return a.left <= b.left && a.top <= b.top && a.right >= b.right && a.bottom >= b.bottom;
    }, selector)).toBe(true);
}

// Cuenta y distribuidora nuevas, sin cargar nada.
async function registrarVacia(page, testInfo) {
    await page.goto("/");
    await page.getByRole("button", { name: "Entrar con email" }).click();
    await page.getByRole("button", { name: /Registrarse/ }).click();
    await page.locator("#inicioRegistroNombre").fill("Pastas Prueba");
    await page.locator("#inicioRegistroEmail").fill(`tutorial-${testInfo.project.name}-${Date.now()}@prueba.com`);
    await page.locator("#inicioRegistroContrasena").fill("clave-de-prueba");
    await page.locator("#inicioRegistroRepetir").fill("clave-de-prueba");
    await page.getByRole("button", { name: "Crear cuenta y distribuidora" }).click();
    await expect(page.locator("#inicioNombreDueno")).toBeVisible({ timeout: 20000 });
    await page.locator("#inicioNombreDueno").fill("Jere");
    await page.locator("#inicioFormDatosDueno").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
}

test("tutorial: lo básico de verdad al crear la cuenta y uno chico por pantalla", async ({ page }, testInfo) => {
    await registrarVacia(page, testInfo);

    // Arranca solo, con todo en cero.
    const globo = page.getByRole("dialog", { name: "Tutorial" });
    await expect(globo).toContainText("Hagamos lo básico juntos");
    expect(await page.evaluate(() => obtenerComercios().length)).toBe(0);
    await capturar(page, "tutorial-01-bienvenida");
    await globo.getByRole("button", { name: "Empezar" }).click();

    // 1. El comercio: solo se puede tocar "Agregar comercio".
    await expect(globo).toContainText("1. Tu primer comercio");
    await esperarFocoSobre(page, "#agregarComercio");
    await capturar(page, "tutorial-02-comercio");
    await page.locator("#agregarComercio").click();
    await expect(globo).toContainText("Escribí el nombre, la dirección y el teléfono");
    await page.locator("#modalNombre").fill("Almacén Don Pepe");
    await page.locator("#modalDireccion").fill("San Martín 123");
    await page.locator("#modalTelefono").fill("11 5555-1234");
    await capturar(page, "tutorial-03-comercio-datos");
    await page.locator("#guardarModal").click();

    // 2. La marca.
    await expect(globo).toContainText("2. Una marca");
    await expect(page.locator("#pantallaProductos")).toBeVisible();
    await esperarFocoSobre(page, "#agregarMarca");
    await page.locator("#agregarMarca").click();
    await page.locator("#productoNombre").fill("Pastas La Nonna");
    await page.locator("#guardarProducto").click();

    // 3. El producto con su precio.
    await expect(globo).toContainText("3. Un producto con su precio");
    await esperarFocoSobre(page, "#agregarProducto");
    await capturar(page, "tutorial-04-producto");
    await page.locator("#agregarProducto").click();
    await page.locator("#productoMarca").selectOption("Pastas La Nonna");
    await page.locator("#productoNombre").fill("Ravioles x 1 kg");
    await page.locator("#productoPrecio").fill("5200");
    await page.locator("#guardarProducto").click();

    // 4. El primer pedido, con el + de abajo.
    await expect(globo).toContainText("4. El primer pedido");
    await esperarFocoSobre(page, ".bottom-nav .nav-nuevo");
    await page.locator(".bottom-nav .nav-nuevo").click();
    await expect(globo).toContainText("Elegí el comercio que creaste");
    await page.locator("#cliente").fill("Almacén Don Pepe");
    const ravioles = page.locator(".listaProdutos .fila", { hasText: "Ravioles x 1 kg" });
    if (!(await ravioles.isVisible())) await page.locator(".tituloMarca", { hasText: "Pastas La Nonna" }).click();
    await ravioles.getByRole("button", { name: "Aumentar cantidad" }).click();
    await ravioles.getByRole("button", { name: "Aumentar cantidad" }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "tutorial-05-pedido");
    await page.locator("#generar").click();
    const generado = page.locator("#modalPedido");
    await expect(generado).toBeVisible();
    await expect(globo).toContainText("Cerrá la ventana para seguir");
    await generado.click({ position: { x: 10, y: 10 } });

    // 5. La ruta: se mira en la pantalla de Rutas.
    await expect(globo).toContainText("5. La ruta del día");
    await expect(page.locator("#pantallaRutas")).toBeVisible();
    await esperarFocoSobre(page, "#btnElegirRutas");
    await globo.getByRole("button", { name: "Siguiente" }).click();
    await esperarFocoSobre(page, "#btnOptimizarRuta");
    await globo.getByRole("button", { name: "Siguiente" }).click();
    await esperarFocoSobre(page, "#btnNavegarRuta");
    await capturar(page, "tutorial-06-ruta");
    await globo.getByRole("button", { name: "Siguiente" }).click();

    // 6. La entrega: Pedidos, el pedido y deslizar "Entregado".
    await expect(globo).toContainText("Tocá «Pedidos».");
    await page.locator('.bottom-nav [data-pantalla="pedido"]').click();
    await expect(globo).toContainText("Tocá tu pedido para abrirlo.");
    await page.locator("#listaVistaPedidos .tarjetaSeguimiento").first().click();
    await expect(globo).toContainText("Deslizá el botón hacia la derecha");
    await capturar(page, "tutorial-07-entregar");
    await deslizar(page, "Deslizá para marcar Entregado");
    await expect(page.getByText("¿Cómo pagó?")).toBeVisible();
    await page.locator("#modalCobroPedido").getByRole("button", { name: "Volver" }).click();
    await expect(globo).toContainText("Cerrá la ventana para seguir");
    await page.locator(".fichaPedido").getByRole("button", { name: "Cerrar", exact: true }).click();

    await expect(globo).toContainText("¡Ya sabés lo básico!");
    await capturar(page, "tutorial-08-listo");
    await globo.getByRole("button", { name: "Terminar" }).click();
    await expect(globo).toHaveCount(0);
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("vendefrio_tutorial"))).toBe("visto");

    // Tutorial chico la primera vez que se entra a Estadísticas.
    await page.evaluate(() => window.abrirEstadisticas());
    const dePantalla = page.getByRole("dialog", { name: "Cómo se usa esta pantalla" });
    await expect(dePantalla).toBeVisible();
    await capturar(page, "tutorial-09-estadisticas");
    for (let vuelta = 0; vuelta < 6 && await dePantalla.count(); vuelta++) {
        const boton = dePantalla.getByRole("button", { name: /Siguiente|Terminar/ });
        if (await boton.isVisible()) await boton.click();
    }
    await expect(dePantalla).toHaveCount(0);
    // La segunda vez ya no sale.
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    await page.evaluate(() => window.abrirEstadisticas());
    await page.waitForTimeout(1200);
    await expect(dePantalla).toHaveCount(0);

    // Más > Seguridad y ayuda: volver a verlo y apagar el de cada pantalla.
    await abrirConfiguracionEn(page, "seguridad");
    const llave = page.getByRole("switch", { name: "Explicar cada pantalla nueva" });
    await llave.evaluate(elemento => elemento.scrollIntoView({ block: "center" }));
    await expect(llave).toBeChecked();
    await capturar(page, "tutorial-10-seguridad");
    await llave.uncheck();
    expect(await page.evaluate(() => localStorage.getItem("vendefrio_tutoriales_pantallas"))).toBe("no");
    await page.getByRole("button", { name: "Ver el tutorial" }).click();
    await expect(globo).toContainText("Hagamos lo básico juntos");
    await globo.getByRole("button", { name: "Empezar" }).click();
    // Quien ya sabe, salta el paso sin cargar nada.
    await expect(globo).toContainText("1. Tu primer comercio");
    await globo.getByRole("button", { name: "Saltar este paso" }).click();
    await expect(globo).toContainText("2. Una marca");
    await globo.getByRole("button", { name: "Saltear" }).click();
    await expect(globo).toHaveCount(0);
    await expect(page.locator("#pantallaMenu")).toBeVisible();

    // Para quien entra con código: dónde está cada cosa, sin cargar nada.
    await page.evaluate(() => window.tutorialVendeFrio.abrir("mirar"));
    await expect(globo).toContainText("Te muestro la app");
    const capa = page.locator(".tutorialCapa");
    for (let vuelta = 0; vuelta < 10 && await capa.getAttribute("data-paso") !== "8"; vuelta++) {
        const paso = await capa.getAttribute("data-paso");
        await globo.getByRole("button", { name: /Empezar|Siguiente/ }).click();
        await expect(capa).not.toHaveAttribute("data-paso", paso);
    }
    await expect(globo).toContainText("¡Listo!");
    await globo.getByRole("button", { name: "Terminar" }).click();
    await expect(globo).toHaveCount(0);
});
