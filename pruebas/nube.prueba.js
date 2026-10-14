// VendeFrío - Recorridos en la nube, con los emuladores de Firebase. Las
// reglas de firestore.rules están activas en el emulador, así que cada paso
// pasa por ellas.
// 1. El principal: registrar la distribuidora, cargar un pedido, armarlo con
//    la checklist (el primer tilde lo pasa solo a "En preparación", T29b),
//    salir a repartir, entregarlo y cobrarlo.
// 2. Pasos más cortos (T29b): un pedido viejo en "Cargado en el vehículo" se
//    ve como "En reparto", vuelve un paso atrás a "Cargado" y se entrega
//    directo desde "Cargado".
const { test, expect, capturar, deslizar } = require("./ayudas");

test.use({ nube: true });

// Cuenta y distribuidora nuevas (en el emulador), con un comercio y dos
// productos con precio, guardados con las mismas funciones que usa la app.
async function registrarDistribuidora(page, testInfo) {
    await page.goto("/");

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

    const guardado = await page.evaluate(() =>
        agregarComercio({ nombre: "Almacén Don Pepe", direccion: "San Martín 123", telefono: "11 5555-1234" }) &&
        agregarMarca("Frío Sur") &&
        agregarProducto("Frío Sur", { nombre: "Helado 1 kg", precio: 4500 }) &&
        agregarProducto("Frío Sur", { nombre: "Palito bombón", precio: 800 })
    );
    expect(guardado).toBeTruthy();
}

// Carga un pedido de 2 helados y 1 palito (sin captura si no se pide).
async function cargarPedido(page, conCaptura) {
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
    if (conCaptura) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await capturar(page, "nube-02-nuevo-pedido");
    }

    await page.locator("#generar").click();
    const generado = page.locator("#modalPedido");
    await expect(generado).toBeVisible();
    await generado.click({ position: { x: 10, y: 10 } });
    await expect(generado).toBeHidden();
}

test("nube: cargar, armar, entregar y cobrar un pedido", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await capturar(page, "nube-01-inicio");

    // Pedidos: la lista empieza vacía y el botón flotante abre "Nuevo pedido".
    await cargarPedido(page, true);

    // Vuelve sola a la lista, en "Cargados".
    const tarjeta = page.locator(".tarjetaSeguimiento", { hasText: "Almacén Don Pepe" });
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toContainText("Cargado");
    await capturar(page, "nube-03-pedidos-cargados");

    // Ficha del pedido (T29b): en "Cargado" ya es la checklist, sin "Empezar
    // a preparar" ni "Cargado en el vehículo", y se puede entregar deslizando.
    await tarjeta.click();
    const ficha = page.locator(".fichaPedido");
    await expect(ficha).toBeVisible();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("Cargado");
    await expect(ficha.locator(".datoFichaPedido", { hasText: "Cargado por" })).toContainText("Jere");
    await expect(ficha.locator(".datoFichaPedido", { hasText: "Total" })).toContainText("9.800");
    await expect(ficha.locator(".lineaChecklist")).toHaveCount(2);
    await expect(ficha).toContainText("Al tildar el primer producto, el pedido pasa a «En preparación».");
    await expect(ficha.getByRole("button", { name: "Salir a repartir" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Deslizá para marcar Entregado/ })).toBeVisible();
    await expect(ficha.getByRole("button", { name: "Empezar a preparar" })).toHaveCount(0);
    await expect(ficha.getByRole("button", { name: "Entregar en el mostrador" })).toHaveCount(0);
    await expect(ficha).not.toContainText("vehículo");
    await capturar(page, "nube-04-ficha-cargado");

    // Armar: el primer tilde pasa el pedido solo a "En preparación", a
    // nombre de quien tildó.
    await ficha.locator(".lineaChecklist", { hasText: "Helado 1 kg" }).click();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("En preparación");
    await expect(ficha.locator(".pasoSeguimiento.actual")).toContainText("En preparación");
    await expect(ficha.locator(".pasoSeguimiento.actual")).toContainText("Jere");
    await ficha.locator(".lineaChecklist", { hasText: "Palito bombón" }).click();
    await expect(ficha).toContainText("2 de 2 listos");
    await expect(ficha.locator(".pasoSeguimiento", { hasText: "En preparación" })).toHaveCount(1);
    await capturar(page, "nube-05-checklist");

    // "Preparado" sigue igual, como paso opcional.
    await ficha.getByRole("button", { name: "Marcar preparado" }).click();
    await expect(page.getByRole("button", { name: /Deslizá para marcar Preparado/ })).toBeVisible();
    await capturar(page, "nube-06-resumen-preparado");
    await deslizar(page, "Deslizá para marcar Preparado");

    // Con Web Bluetooth (Android con Chrome) pregunta si imprimir el ticket.
    const ahoraNo = page.getByRole("button", { name: "Ahora no" });
    if (await ahoraNo.isVisible({ timeout: 3000 }).catch(() => false)) await ahoraNo.click();

    // Reparto: "Salir a repartir" lleva directo a "En reparto".
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("Preparado");
    await expect(ficha.getByRole("button", { name: "Cargar en el vehículo" })).toHaveCount(0);
    await ficha.getByRole("button", { name: "Salir a repartir" }).click();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("En reparto");
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
    await expect(ficha).not.toContainText("vehículo");
    await capturar(page, "nube-09-entregado-y-cobrado");

    // Sin cambios pendientes de subir: todo llegó a la nube del emulador.
    await expect(page.getByText("Pendiente de sincronizar")).toHaveCount(0);
});

test("nube: pedido viejo en el vehículo, volver atrás y entregar desde Cargado", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await cargarPedido(page, false);

    const tarjeta = page.locator(".tarjetaSeguimiento", { hasText: "Almacén Don Pepe" });
    await expect(tarjeta).toBeVisible();

    // Como lo deja un celular con la versión vieja de la app: el pedido pasa
    // a "Cargado en el vehículo" (las reglas lo siguen aceptando).
    await page.evaluate(() => {
        const pedido = obtenerHistorial().find(item => item.comercio === "Almacén Don Pepe");
        window.nubeVendeFrio.agregarEstadoAlPedido(pedido.id, "enVehiculo", "");
    });

    // Se ve y se maneja como "En reparto", en la lista y en la ficha.
    await page.locator("#filtrosEtapaPedidos").getByRole("tab", { name: /En reparto/ }).click();
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta.locator(".estadoSeguimiento")).toHaveText("En reparto");
    await expect(page.locator("#filtrosEtapaPedidos")).not.toContainText("vehículo");

    await tarjeta.click();
    const ficha = page.locator(".fichaPedido");
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("En reparto");
    await expect(page.getByRole("button", { name: /Deslizá para marcar Entregado/ })).toBeVisible();
    // El historial no cambia: el paso viejo sigue en el seguimiento.
    await expect(ficha.locator(".pasoSeguimiento.actual")).toContainText("Cargado en el vehículo");
    await capturar(page, "nube-10-pedido-viejo-en-reparto");

    // Volver un paso atrás: vuelve a "Cargado", el paso que tenía antes.
    await ficha.getByRole("button", { name: "Volver un paso atrás" }).click();
    const modal = page.locator("#modalTextoPedido");
    await expect(modal).toContainText("El pedido pasa de «En reparto» a «Cargado»");
    await modal.locator("#campoTextoPedido").fill("Lo bajamos del vehículo");
    await modal.getByRole("button", { name: "Volver a Cargado" }).click();
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("Cargado");
    await expect(ficha.locator(".pasoSeguimiento.actual")).toContainText("Lo bajamos del vehículo");

    // Entregar directo desde "Cargado", deslizando, sin cobrar todavía.
    await capturar(page, "nube-11-entregar-desde-cargado");
    await deslizar(page, "Deslizá para marcar Entregado");
    await expect(page.getByText("¿Cómo pagó?")).toBeVisible();
    await page.getByRole("button", { name: "Todavía no pagó" }).click();
    await page.getByRole("button", { name: "Dejar pendiente" }).click();

    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("Entregado");
    await expect(ficha.locator(".datoFichaPedido", { hasText: "Entregado por" })).toContainText("Jere");
    await expect(ficha.locator(".datoFichaPedido", { hasText: "Cobro" }).first()).toContainText("Pendiente");
    await capturar(page, "nube-12-entregado-desde-cargado");

    await expect(page.getByText("Pendiente de sincronizar")).toHaveCount(0);
});
