// VendeFrío - Recorrido principal en la nube, con los emuladores de Firebase:
// registrar la distribuidora, cargar un pedido, armarlo con la checklist,
// salir a repartir, entregarlo y cobrarlo. Las reglas de firestore.rules
// están activas en el emulador, así que cada paso pasa por ellas.
const { test, expect, capturar, deslizar } = require("./ayudas");

test.use({ nube: true });

test("nube: cargar, armar, entregar y cobrar un pedido", async ({ page }, testInfo) => {
    await page.goto("/");

    // Registrarse: cuenta y distribuidora nuevas (en el emulador).
    await page.getByRole("button", { name: /Distribuidora/ }).click();
    await page.getByRole("button", { name: /Registrarse/ }).click();
    await page.locator("#inicioRegistroNombre").fill("Distribuidora Prueba");
    await page.locator("#inicioRegistroEmail").fill(`dueno-${testInfo.project.name}-${Date.now()}@prueba.com`);
    await page.locator("#inicioRegistroContrasena").fill("clave-de-prueba");
    await page.locator("#inicioRegistroRepetir").fill("clave-de-prueba");
    await page.getByRole("button", { name: "Crear cuenta y distribuidora" }).click();

    // "Tu nombre" (se pide una sola vez al dueño).
    await expect(page.locator("#inicioNombreDueno")).toBeVisible({ timeout: 20000 });
    await page.locator("#inicioNombreDueno").fill("Jere");
    await page.locator("#inicioFormDatosDueno").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await expect(page.locator("#dashNombreDistribuidora")).toHaveText("Distribuidora Prueba");

    // Datos de prueba: un comercio y dos productos con precio, guardados
    // con las mismas funciones que usa la app (van a la nube del emulador).
    const guardado = await page.evaluate(() =>
        agregarComercio({ nombre: "Almacén Don Pepe", direccion: "San Martín 123", telefono: "11 5555-1234" }) &&
        agregarMarca("Frío Sur") &&
        agregarProducto("Frío Sur", { nombre: "Helado 1 kg", precio: 4500 }) &&
        agregarProducto("Frío Sur", { nombre: "Palito bombón", precio: 800 })
    );
    expect(guardado).toBeTruthy();
    await capturar(page, "nube-01-inicio");

    // Pedidos: la lista empieza vacía y el botón flotante abre "Nuevo pedido".
    await page.locator(".bottom-nav").getByRole("button", { name: "Pedido" }).click();
    await expect(page.locator("#vistaPedidos")).toBeVisible();
    await page.getByRole("button", { name: "Nuevo pedido" }).click();
    await page.locator("#cliente").fill("Almacén Don Pepe");
    await page.locator(".tituloMarca", { hasText: "Frío Sur" }).click();
    const helado = page.locator(".listaProdutos .fila", { hasText: "Helado 1 kg" });
    const palito = page.locator(".listaProdutos .fila", { hasText: "Palito bombón" });
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    await palito.getByRole("button", { name: "Aumentar cantidad" }).click();
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("3");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "nube-02-nuevo-pedido");

    await page.locator("#generar").click();
    const generado = page.locator("#modalPedido");
    await expect(generado).toBeVisible();
    await generado.click({ position: { x: 10, y: 10 } });
    await expect(generado).toBeHidden();

    // Vuelve sola a la lista, en "Cargados".
    const tarjeta = page.locator(".tarjetaSeguimiento", { hasText: "Almacén Don Pepe" });
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toContainText("Cargado");
    await capturar(page, "nube-03-pedidos-cargados");

    // Ficha del pedido: total con los precios del catálogo.
    await tarjeta.click();
    const ficha = page.locator(".fichaPedido");
    await expect(ficha).toBeVisible();
    await expect(ficha.locator(".datoFichaPedido", { hasText: "Cargado por" })).toContainText("Jere");
    await expect(ficha.locator(".totalFichaPedido")).toContainText("9.800");
    await capturar(page, "nube-04-ficha-cargado");

    // Armar: checklist con los dos productos.
    await ficha.getByRole("button", { name: "Empezar a preparar" }).click();
    await expect(ficha.locator(".lineaChecklist")).toHaveCount(2);
    await ficha.locator(".lineaChecklist", { hasText: "Helado 1 kg" }).click();
    await ficha.locator(".lineaChecklist", { hasText: "Palito bombón" }).click();
    await expect(ficha).toContainText("2 de 2 listos");
    await capturar(page, "nube-05-checklist");

    await ficha.getByRole("button", { name: "Marcar preparado" }).click();
    await expect(page.getByRole("button", { name: /Deslizá para marcar Preparado/ })).toBeVisible();
    await capturar(page, "nube-06-resumen-preparado");
    await deslizar(page, "Deslizá para marcar Preparado");

    // Con Web Bluetooth (Android con Chrome) pregunta si imprimir el ticket.
    const ahoraNo = page.getByRole("button", { name: "Ahora no" });
    if (await ahoraNo.isVisible({ timeout: 3000 }).catch(() => false)) await ahoraNo.click();

    // Reparto.
    await ficha.getByRole("button", { name: "Cargar en el vehículo" }).click();
    await ficha.getByRole("button", { name: "Salir a repartir" }).click();
    await expect(page.getByRole("button", { name: /Deslizá para marcar Entregado/ })).toBeVisible();
    await capturar(page, "nube-07-en-reparto");

    // Entregar deslizando y cobrar en efectivo.
    await deslizar(page, "Deslizá para marcar Entregado");
    await expect(page.getByText("¿Cómo pagó?")).toBeVisible();
    await page.getByRole("button", { name: "Efectivo" }).click();
    await expect(page.locator("#montoCobroPedido")).toHaveValue(/9\.?800/);
    await capturar(page, "nube-08-como-pago");
    await page.getByRole("button", { name: "Guardar cobro" }).click();

    await expect(ficha.locator(".datoFichaPedido", { hasText: "Cobro" }).first()).toContainText("Efectivo · $ 9.800");
    await expect(ficha.locator(".datoFichaPedido", { hasText: "Cobrado por" })).toContainText("Jere");
    await capturar(page, "nube-09-entregado-y-cobrado");

    // Sin cambios pendientes de subir: todo llegó a la nube del emulador.
    await expect(page.getByText("Pendiente de sincronizar")).toHaveCount(0);
});
