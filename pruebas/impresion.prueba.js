// VendeFrío - Más impresión (Bloque G), con los emuladores de Firebase y una
// impresora Bluetooth falsa (lo que se imprime queda anotado en la página).
// 1. Datos de la distribuidora en el ticket (T28c): el dueño carga teléfono,
//    dirección y CUIT en Configuración > Cuenta; el ticket los muestra, cada
//    uno solo si está cargado. Un empleado no los ve para cambiar y la nube
//    no lo deja cambiarlos saltándose la app.
// 2. "Ticket impreso por" en el seguimiento (T28d): cada impresión queda en el
//    pedido (quién, cuándo y cuántas copias) y se ve en los dos celulares. La
//    nube solo deja agregar impresiones a nombre propio.
// 3. Hoja de reparto impresa (T28e): en Rutas, después de "Optimizar ruta",
//    se imprime la hoja con los comercios en el orden de la ruta, sus
//    pedidos sin entregar, lo que deben de antes y el total a cobrar.
const { test, expect, capturar } = require("./ayudas");
const {
    registrarDistribuidora,
    cargarPedido,
    abrirConfiguracionEn,
    irAPedidos,
    entrarComoEmpleado,
    usarImpresoraFalsa,
    textoImpreso
} = require("./recorridos");

test.use({ nube: true });

// Abre la ficha del pedido e imprime las copias pedidas ("Dos copias" o
// "Una copia"). Espera el aviso "Ticket impreso".
async function imprimirTicket(page, comercio, copias = "Dos copias") {
    await page.evaluate(() => { window.__bytesImpresos = []; });
    const ficha = page.locator(".fichaPedido");
    if (!(await ficha.isVisible())) {
        await page.locator(".tarjetaSeguimiento", { hasText: comercio }).first().click();
    }
    await ficha.getByRole("button", { name: "Imprimir ticket" }).click();
    await page.locator("#modalCopiasTicket").getByRole("button", { name: new RegExp(copias) }).click();
    await expect(page.locator("#contenedorToasts")).toContainText("Ticket impreso");
    return textoImpreso(page);
}

test("impresión: datos de la distribuidora en el ticket", async ({ page, browser }, testInfo) => {
    await usarImpresoraFalsa(page);
    await registrarDistribuidora(page, testInfo);

    // Sin datos cargados, el ticket sale solo con el nombre.
    await irAPedidos(page);
    await cargarPedido(page, false);
    let ticket = await imprimirTicket(page, "Almacén Don Pepe");
    expect(ticket).toContain("Distribuidora Prueba");
    expect(ticket).not.toContain("Tel.:");
    expect(ticket).not.toContain("CUIT");
    await page.locator(".fichaPedido").getByRole("button", { name: "Cerrar" }).click();

    // El dueño carga los tres datos en Configuración > Cuenta.
    await abrirConfiguracionEn(page, "cuenta");
    await expect(page.locator("#cuentaDatosTicket")).toContainText("Todavía sin cargar");
    await page.getByRole("button", { name: "Cargar datos del ticket" }).click();
    await page.locator("#datosTicketTelefono").fill("11 4444-5555");
    await page.locator("#datosTicketDireccion").fill("Belgrano 456, Quilmes");
    await page.locator("#datosTicketCuit").fill("20-12345678-9");
    await page.locator("#formDatosTicket").evaluate(form => form.scrollIntoView({ block: "center" }));
    await capturar(page, "impresion-01-cargar-datos-ticket");
    await page.getByRole("button", { name: "Guardar datos del ticket" }).click();
    const datos = page.locator("#cuentaDatosTicket");
    await expect(datos).toContainText("Teléfono: 11 4444-5555");
    await expect(datos).toContainText("Dirección: Belgrano 456, Quilmes");
    await expect(datos).toContainText("CUIT: 20-12345678-9");
    await datos.scrollIntoViewIfNeeded();
    await capturar(page, "impresion-02-datos-ticket-guardados");

    // El ticket los muestra debajo del nombre, en las dos copias.
    await irAPedidos(page);
    ticket = await imprimirTicket(page, "Almacén Don Pepe");
    expect(ticket).toContain("Distribuidora Prueba\nBelgrano 456, Quilmes\nTel.: 11 4444-5555\nCUIT: 20-12345678-9\nCOPIA COMERCIO");
    expect(ticket).toContain("CUIT: 20-12345678-9\nCOPIA DISTRIBUIDORA");
    await page.locator(".fichaPedido").getByRole("button", { name: "Cerrar" }).click();

    // Si borra la dirección y el CUIT, salen solo el nombre y el teléfono.
    await abrirConfiguracionEn(page, "cuenta");
    await page.getByRole("button", { name: "Cambiar datos del ticket" }).click();
    await page.locator("#datosTicketDireccion").fill("");
    await page.locator("#datosTicketCuit").fill("");
    await page.getByRole("button", { name: "Guardar datos del ticket" }).click();
    await expect(page.locator("#cuentaDatosTicket")).not.toContainText("CUIT");
    await irAPedidos(page);
    ticket = await imprimirTicket(page, "Almacén Don Pepe", "Una copia");
    expect(ticket).toContain("Distribuidora Prueba\nTel.: 11 4444-5555\nCOPIA COMERCIO");
    expect(ticket).not.toContain("CUIT");
    expect(ticket).not.toContain("Quilmes");
    await page.locator(".fichaPedido").getByRole("button", { name: "Cerrar" }).click();

    // Un empleado no los puede cambiar: no ve el botón y la nube lo rechaza.
    const { empleado, contexto, errores } = await entrarComoEmpleado(page, browser, testInfo);
    await abrirConfiguracionEn(empleado, "cuenta");
    await expect(empleado.getByRole("button", { name: /datos del ticket/ })).toHaveCount(0);
    const resultado = await empleado.evaluate(async () => {
        const guardado = JSON.parse(localStorage.getItem("vendefrio_empleado"));
        try {
            await window.firebase.firestore().collection("distribuidoras").doc(guardado.distribuidora)
                .update({ telefono: "0800-trucho" });
            return "ok";
        } catch (error) {
            return error.code || String(error);
        }
    });
    expect(resultado).toBe("permission-denied");
    // Y el dueño no puede guardar un dato demasiado largo, ni otra cosa.
    const delDueno = await page.evaluate(async () => {
        const ref = window.firebase.firestore().collection("distribuidoras").doc(window.distribuidoraVendeFrio.idActual());
        const resultados = [];
        for (const cambio of [{ cuit: "1".repeat(21) }, { telefono: 1234 }, { duenoUid: "otro" }]) {
            try {
                await ref.update(cambio);
                resultados.push("ok");
            } catch (error) {
                resultados.push(error.code || String(error));
            }
        }
        return resultados;
    });
    expect(delDueno).toEqual(["permission-denied", "permission-denied", "permission-denied"]);

    await expect(page.getByText("Pendiente de sincronizar")).toHaveCount(0);
    await contexto.close();
    expect(errores, "La página del empleado tuvo errores de JavaScript").toEqual([]);
});

test("impresión: ticket impreso por, en el seguimiento", async ({ page, browser }, testInfo) => {
    await usarImpresoraFalsa(page);
    await registrarDistribuidora(page, testInfo);
    const { empleado, contexto, errores } = await entrarComoEmpleado(page, browser, testInfo, "Maxi", { impresora: true });

    // El dueño imprime las dos copias: queda en el seguimiento, a su nombre.
    await irAPedidos(page);
    await cargarPedido(page, false);
    await imprimirTicket(page, "Almacén Don Pepe");
    const ficha = page.locator(".fichaPedido");
    const impresionDueno = ficha.locator(".pasoSeguimiento.impresion", { hasText: "Jere" });
    await expect(impresionDueno).toContainText("Ticket impreso");
    await expect(impresionDueno).toContainText("Dos copias (comercio y distribuidora)");

    // El empleado lo ve en su celular e imprime una copia.
    await irAPedidos(empleado);
    await empleado.locator(".tarjetaSeguimiento", { hasText: "Almacén Don Pepe" }).click();
    const fichaEmpleado = empleado.locator(".fichaPedido");
    await expect(fichaEmpleado.locator(".pasoSeguimiento.impresion", { hasText: "Jere" })).toBeVisible();
    await imprimirTicket(empleado, "Almacén Don Pepe", "Una copia");
    await expect(fichaEmpleado.locator(".pasoSeguimiento.impresion").first()).toContainText("Maxi");

    // Y el dueño ve la impresión del empleado arriba de todo, en vivo.
    const ultima = ficha.locator(".pasoSeguimiento").first();
    await expect(ultima).toContainText("Ticket impreso");
    await expect(ultima).toContainText("Maxi");
    await expect(ultima).toContainText("Una copia (comercio)");
    await ultima.scrollIntoViewIfNeeded();
    await capturar(page, "impresion-03-ticket-impreso-por");

    // Saltándose la app: ni a nombre de otro, ni cambiar una que ya está.
    const resultados = await empleado.evaluate(async () => {
        const guardado = JSON.parse(localStorage.getItem("vendefrio_empleado"));
        const pedido = obtenerHistorial().find(item => item.comercio === "Almacén Don Pepe");
        const ref = window.firebase.firestore().collection("distribuidoras").doc(guardado.distribuidora)
            .collection("pedidos").doc(pedido.id);
        const yo = { idPersona: guardado.idEmpleado, nombre: "Maxi", uid: guardado.uid };
        const otro = { idPersona: "dueno", nombre: "Jere", uid: guardado.uid };
        const existente = Object.keys(pedido.impresiones)[0];
        const intentos = [
            () => ref.update({ ["impresiones.imp_trucha" + Date.now()]: { copias: 2, persona: otro, horaCelular: Date.now() } }),
            () => ref.update({ ["impresiones." + existente + ".copias"]: 1 }),
            () => ref.update({ ["impresiones.imp_mal" + Date.now()]: { copias: 5, persona: yo, horaCelular: Date.now() } }),
            () => ref.update({ ["impresiones.imp_bien" + Date.now()]: { copias: 1, persona: yo, horaCelular: Date.now() } })
        ];
        const salida = [];
        for (const intento of intentos) {
            try {
                await intento();
                salida.push("ok");
            } catch (error) {
                salida.push(error.code || String(error));
            }
        }
        return salida;
    });
    expect(resultados).toEqual(["permission-denied", "permission-denied", "permission-denied", "ok"]);

    await expect(page.getByText("Pendiente de sincronizar")).toHaveCount(0);
    await contexto.close();
    expect(errores, "La página del empleado tuvo errores de JavaScript").toEqual([]);
});

test("impresión: hoja de reparto desde Rutas", async ({ page }, testInfo) => {
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: -34.600, longitude: -58.380 });
    await usarImpresoraFalsa(page);
    await registrarDistribuidora(page, testInfo);

    // Dos comercios con GPS (uno cerca y otro lejos) y Don Pepe sin GPS.
    await page.evaluate(() =>
        agregarComercio({ nombre: "Kiosco Luna", direccion: "Belgrano 45", telefono: "11 4000-1111", lat: -34.601, lng: -58.381 }) &&
        agregarComercio({ nombre: "Super Norte", direccion: "Ruta 8 km 50", telefono: "", lat: -34.450, lng: -58.700 })
    );
    await irAPedidos(page);
    await cargarPedido(page, false, "Super Norte");
    await cargarPedido(page, false, "Kiosco Luna");
    await cargarPedido(page, false, "Super Norte");
    // Uno de Super Norte ya se entregó y quedó sin cobrar.
    await page.evaluate(() => {
        const pedido = obtenerHistorial().find(item => item.comercio === "Super Norte");
        window.nubeVendeFrio.entregarPedido(pedido.id, {});
    });
    await expect(page.locator("#filtrosEtapaPedidos")).toContainText("A cobrar");

    // Rutas: todos los comercios y "Optimizar ruta".
    await page.locator(".bottom-nav").getByRole("button", { name: "Más" }).click();
    await page.locator(".menuMasContenido").getByRole("button", { name: /Rutas/ }).click();
    // Sin internet en la prueba, el mapa no carga: la ruta se arma igual.
    const aviso = page.locator("#modalAviso");
    await expect(aviso).toContainText("Mapa no disponible");
    await aviso.getByRole("button", { name: "Entendido" }).click();
    await page.locator("#seleccionarTodosRuta").click();
    await page.locator("#btnOptimizarRuta").click();
    await expect(aviso).toContainText("1. Kiosco Luna");
    await aviso.getByRole("button", { name: "Entendido" }).click();

    const boton = page.getByRole("button", { name: "Imprimir hoja de reparto" });
    await expect(boton).toBeVisible();
    await page.locator("#listaRutaOrdenada").evaluate(lista => lista.scrollIntoView({ block: "start" }));
    await capturar(page, "impresion-04-hoja-de-reparto");
    await boton.click();
    await expect(page.locator("#contenedorToasts")).toContainText("Hoja de reparto impresa");

    const hoja = await textoImpreso(page);
    expect(hoja).toContain("Distribuidora Prueba\nHOJA DE REPARTO");
    expect(hoja).toContain("2 paradas");
    expect(hoja.indexOf("1. [ ] Kiosco Luna")).toBeGreaterThan(-1);
    expect(hoja.indexOf("2. [ ] Super Norte")).toBeGreaterThan(hoja.indexOf("1. [ ] Kiosco Luna"));
    expect(hoja).toContain("Belgrano 45\n   Tel.: 11 4000-1111");
    expect(hoja).toContain("Ruta 8 km 50");
    expect(hoja).toContain("A cobrar (ya entregado) N? ");
    expect(hoja).toContain("Pedidos: 3");
    expect(hoja).toMatch(/A COBRAR\s+\$ 29\.400/);
    expect(hoja).toContain("Sin GPS (no entran en la ruta):\n- Almac?n Don Pepe");
    // Super Norte: el pedido sin entregar y el que debe de antes.
    const superNorte = hoja.slice(hoja.indexOf("2. [ ] Super Norte"));
    expect(superNorte).toMatch(/Pedido N\? [A-Z0-9_]{6} · Cargado|Pedido N\? [A-Z0-9_]{6} \? Cargado/);
});
