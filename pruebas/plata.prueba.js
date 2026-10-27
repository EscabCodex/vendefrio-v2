// VendeFrío - Ideas para la 1.0, tanda 4 "Plata" (T74 a T78), con los
// emuladores de Firebase.
// 1. Saldo por comercio con tope, recordatorio, pago parcial y recibo.
// 2. Alias y QR al cobrar, gastos del día y "Queda en caja", y listas de
//    precios.
const path = require("path");
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, cargarPedido, irAPedidos, elegirComercio, abrirConfiguracionEn } = require("./recorridos");

test.use({ nube: true });

// Guarda las direcciones que la app abre (WhatsApp) en vez de abrirlas.
async function anotarVentanas(page) {
    await page.evaluate(() => {
        window.__abiertas = [];
        window.open = url => { window.__abiertas.push(String(url)); return null; };
    });
}

test("plata: saldo por comercio, pago parcial y recibo", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(async () => {
        actualizarComercioPorNombre("Almacén Don Pepe", { contacto: "Pepe Gómez", topeDeuda: 15000 });
        await window.distribuidoraVendeFrio.cambiarDatosTicket({ telefono: "11 5555-0000", direccion: "", cuit: "" });
    });

    // Dos pedidos entregados y sin cobrar: $ 19.600, pasó el tope.
    await cargarPedido(page, false);
    await cargarPedido(page, false);
    await page.evaluate(() => obtenerHistorial()
        .filter(pedido => pedido.comercio === "Almacén Don Pepe")
        .forEach(pedido => window.nubeVendeFrio.entregarPedido(pedido.id, {})));

    // Informe del desconocido: "Te deben" en Inicio, debajo del resumen de
    // hoy, y "Debe" abajo de Pendiente/Visitado en Comercios.
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    const teDeben = page.locator("#pantallaMenu #avisoTeDeben");
    await expect(teDeben).toContainText("Te deben $ 19.600");
    await expect(teDeben).toContainText("1 comercio · el más viejo, hoy");
    expect(await page.evaluate(() => document.getElementById("resumenHoy").nextElementSibling.id)).toBe("avisoTeDeben");
    await teDeben.scrollIntoViewIfNeeded();
    await capturar(page, "plata-00-te-deben-en-inicio");
    await page.locator(".bottom-nav").getByRole("button", { name: "Comercios" }).click();
    const tarjetaComercio = page.locator(".comercioCard", { hasText: "Almacén Don Pepe" });
    await expect(tarjetaComercio.locator(".chipsComercio .estadoComercio")).toBeVisible();
    await expect(tarjetaComercio.locator(".chipsComercio .chipDebe")).toHaveText("Debe $ 19.600");
    await capturar(page, "plata-00-debe-en-comercios");
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    await teDeben.click();
    await expect(page.locator("#pantallaACobrar")).toBeVisible();

    // Pedidos > A cobrar: "Te deben" y "ver por comercio".
    await irAPedidos(page);
    await page.locator("#filtrosEtapaPedidos").getByRole("tab", { name: /Otros/ }).click();
    await page.getByRole("dialog", { name: "Otros pedidos" }).getByRole("button", { name: /A cobrar/ }).click();
    const banner = page.locator("#verACobrarPorComercio");
    await expect(banner).toContainText("Te deben $ 19.600");
    await banner.click();

    const pantalla = page.locator("#pantallaACobrar");
    await expect(pantalla).toBeVisible();
    await expect(pantalla.locator(".pzTotalGrande")).toContainText("$ 19.600");
    await expect(pantalla.locator(".pzTotalGrande")).toContainText("2 pedidos · 1 comercio");
    const fila = pantalla.locator("[data-cuenta]", { hasText: "Almacén Don Pepe" });
    await expect(fila).toContainText("2 pedidos · tope $ 15.000");
    await expect(fila.locator(".pzChip")).toHaveText("Pasó el tope");
    await capturar(page, "plata-01-a-cobrar");

    // Opciones: recordatorio por WhatsApp.
    await anotarVentanas(page);
    await fila.click();
    const opciones = page.getByRole("dialog", { name: "Almacén Don Pepe" });
    await expect(opciones).toContainText("Debe $ 19.600 · pasó el tope de $ 15.000");
    await capturar(page, "plata-02-opciones");
    await opciones.getByRole("button", { name: "Mandar recordatorio por WhatsApp" }).click();
    const enlace = await page.evaluate(() => window.__abiertas[0]);
    expect(enlace).toMatch(/^https:\/\/wa\.me\/5491155551234\?text=/);
    // La fecha del celular (hora de Argentina), no la de la computadora.
    const fecha = await page.evaluate(() => new Date().getDate() + "/" + (new Date().getMonth() + 1));
    expect(decodeURIComponent(enlace.split("text=")[1])).toBe(
        "¡Hola Pepe! Te escribo de Distribuidora Prueba. Te recuerdo que quedó pendiente $ 19.600 de los pedidos del " + fecha + ". Cuando puedas, avisame. ¡Gracias!"
    );

    // Pago parcial: $ 12.000 cubre el primero ($ 9.800) y deja $ 2.200 a cuenta del segundo.
    await fila.click();
    await page.getByRole("dialog", { name: "Almacén Don Pepe" }).getByRole("button", { name: "Registrar un pago" }).click();
    const pago = page.getByRole("dialog", { name: "Registrar un pago" });
    await expect(pago).toContainText("Almacén Don Pepe · debe $ 19.600");
    await pago.locator("#montoPago").fill("12000");
    await pago.getByRole("button", { name: "Efectivo" }).click();
    await pago.getByRole("button", { name: "Guardar pago" }).click();

    const recibo = page.locator("#pantallaRecibo");
    await expect(recibo).toBeVisible();
    const tarjeta = recibo.locator(".pzRecibo");
    await expect(tarjeta).toContainText("DISTRIBUIDORA PRUEBA");
    await expect(tarjeta).toContainText("Tel. 11 5555-0000");
    await expect(tarjeta.locator(".pzReciboFila", { hasText: "Comercio" })).toContainText("Almacén Don Pepe");
    await expect(tarjeta.locator(".pzReciboFila", { hasText: "Pedidos" })).toContainText("$ 19.600");
    await expect(tarjeta.locator(".pzReciboPago")).toHaveText("$ 12.000");
    await expect(tarjeta.locator(".pzReciboFila", { hasText: "Queda debiendo" })).toContainText("$ 7.600");
    await expect(tarjeta.locator(".pzReciboFila", { hasText: "Cobró" })).toContainText("Jere");
    await capturar(page, "plata-03-recibo");
    await recibo.getByRole("button", { name: "WhatsApp" }).click();
    const textoRecibo = await page.evaluate(() => decodeURIComponent(window.__abiertas[window.__abiertas.length - 1].split("text=")[1]));
    expect(textoRecibo).toContain("RECIBO DE PAGO (no válido como factura)");
    expect(textoRecibo).toContain("Queda debiendo: $ 7.600");

    // Quedó un pedido cobrado y el otro debe $ 7.600 (con el pago parcial).
    const montos = await page.evaluate(() => obtenerHistorial()
        .filter(pedido => pedido.comercio === "Almacén Don Pepe")
        .map(pedido => window.nubeVendeFrio.cobroPendiente(pedido) ? window.nubeVendeFrio.montoACobrar(pedido) : 0)
        .sort((a, b) => a - b));
    expect(montos).toEqual([0, 7600]);

    // "Debe" en la ficha del comercio y al cargar un pedido nuevo.
    await page.evaluate(() => window.abrirFichaComercio("Almacén Don Pepe"));
    const debe = page.locator(".modalFichaComercio .pzDebe");
    await expect(debe).toContainText("$ 7.600");
    await expect(debe.locator(".pzChip")).toHaveText("1 pedido");
    await page.locator(".modalFichaComercio .modalContenido").evaluate(el => { el.scrollTop = 0; });
    await capturar(page, "plata-04-ficha-debe");
    await page.keyboard.press("Escape");

    await irAPedidos(page);
    await page.getByRole("button", { name: "Nuevo pedido" }).click();
    await elegirComercio(page, "Almacén Don Pepe");
    await expect(page.locator("#avisoDeudaPedido")).toContainText("Debe $ 7.600");
    await expect(page.locator("#avisoDeudaPedido")).toContainText("1 pedido sin cobrar · tope $ 15.000");
});

test("plata: alias y QR, gastos del día y listas de precios", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);

    // Más > Cuenta: el dueño carga el alias y el QR.
    await abrirConfiguracionEn(page, "cuenta");
    await page.getByRole("button", { name: "Cargar alias y QR" }).click();
    const ajuste = page.getByRole("dialog", { name: "Alias y QR para cobrar" });
    await ajuste.locator("#aliasCobro").fill("distri.prueba.mp");
    await ajuste.locator("#archivoQr").setInputFiles(path.join(__dirname, "qr-prueba.png"));
    await expect(ajuste.locator(".pzFotoVista")).toHaveCount(1);
    await ajuste.getByRole("button", { name: "Guardar" }).click();
    await expect(page.locator("#cuentaCobroTransferencia")).toContainText("distri.prueba.mp · con QR");

    // Un pedido cobrado en efectivo y otro por transferencia con el QR.
    await cargarPedido(page, false);
    await cargarPedido(page, false);
    const ids = await page.evaluate(() => {
        const pedidos = obtenerHistorial().filter(pedido => pedido.comercio === "Almacén Don Pepe");
        pedidos.forEach(pedido => window.nubeVendeFrio.entregarPedido(pedido.id, {}));
        return pedidos.map(pedido => pedido.id);
    });
    await expect.poll(() => page.evaluate(ids => ids
        .map(id => obtenerHistorial().find(item => item.id === id).estado).join(","), ids)).toBe("entregado,entregado");
    await page.evaluate(id => window.nubeVendeFrio.registrarCobro(id, { forma: "efectivo", monto: 9800 }), ids[0]);
    await irAPedidos(page);
    await page.locator("#filtrosEtapaPedidos").getByRole("tab", { name: /Otros/ }).click();
    await page.getByRole("dialog", { name: "Otros pedidos" }).getByRole("button", { name: /A cobrar/ }).click();
    await page.locator(".tarjetaSeguimiento", { hasText: "Almacén Don Pepe" }).first().click();
    const ficha = page.locator(".fichaPedido");
    await ficha.getByRole("button", { name: "Registrar cobro" }).click();
    await page.locator("#modalCobroPedido").getByRole("button", { name: "Transferencia" }).click();
    await page.getByRole("button", { name: "Mostrar alias y QR" }).click();
    const qr = page.getByRole("dialog", { name: "Cobrar por transferencia" });
    await expect(qr).toContainText("Almacén Don Pepe paga $ 9.800");
    await expect(qr).toContainText("Mostrale esta pantalla");
    await expect(qr.locator(".pzQrCobro img")).toBeVisible();
    await expect(qr.locator("#copiarAlias")).toContainText("distri.prueba.mp");
    await capturar(page, "plata-05-cobrar-qr");
    await qr.getByRole("button", { name: "Ya me transfirió" }).click();
    await expect(ficha.locator(".datoFichaPedido", { hasText: "Cobro" })).toContainText("Transferencia");
    expect(await page.evaluate(id => window.nubeVendeFrio.cobroDelPedido(obtenerHistorial().find(p => p.id === id)).forma, ids[1])).toBe("transferencia");
    await ficha.getByRole("button", { name: "Cerrar", exact: true }).click();

    // Cierre del día: dos gastos y "Queda en caja".
    await page.evaluate(() => window.cierreVendeFrio.abrir());
    const cierre = page.locator("#pantallaCierre");
    await expect(cierre.locator("#quedaEnCaja")).toContainText("$ 19.600");
    for (const [categoria, monto, detalle, foto] of [["Nafta", "12000", "YPF Ruta 3", true], ["Peaje", "1500", "", false]]) {
        await cierre.getByRole("button", { name: "Agregar" }).click();
        const hoja = page.getByRole("dialog", { name: "Agregar gasto" });
        await hoja.getByRole("button", { name: categoria }).click();
        await hoja.locator("#montoGasto").fill(monto);
        if (detalle) await hoja.locator("#detalleGasto").fill(detalle);
        if (foto) {
            await hoja.locator("#archivoFotoGasto").setInputFiles(path.join(__dirname, "..", "icon-512.png"));
            await expect(hoja.locator(".pzFotoVista")).toHaveCount(1);
        }
        await hoja.getByRole("button", { name: "Guardar gasto" }).click();
        await expect(hoja).toBeHidden();
    }
    const queda = cierre.locator("#quedaEnCaja");
    await expect(queda.locator("> strong")).toHaveText("$ 6.100");
    await expect(queda).toContainText("$ 19.600cobrado");
    await expect(queda).toContainText("− $ 13.500gastos");
    const gastos = cierre.locator("#gastosCierre .filaGasto");
    await expect(gastos).toHaveCount(2);
    await expect(gastos.first()).toContainText("Nafta · YPF Ruta 3");
    await expect(gastos.first()).toContainText("Jere · con foto del ticket");
    await expect(gastos.nth(1)).toContainText("$ 1.500");
    await capturar(page, "plata-06-cierre-gastos");

    // Listas de precios: Helado a $ 4.200 en "Mayorista".
    await page.locator(".bottom-nav").getByRole("button", { name: "Catálogo" }).click();
    await page.getByRole("button", { name: "Opciones de Helado 1 kg" }).click();
    await page.getByRole("button", { name: "Precios por lista" }).click();
    const listas = page.locator("#pantallaPreciosLista");
    await expect(listas).toBeVisible();
    await listas.getByRole("button", { name: "Lista nueva" }).click();
    for (const [nombre, precio] of [["Mayorista", "4200"], ["Minorista", "4650"]]) {
        if (nombre !== "Mayorista") await listas.getByRole("button", { name: "Lista nueva" }).click();
        const nueva = page.getByRole("dialog", { name: "Lista nueva" });
        await nueva.locator("#nombreListaNueva").fill(nombre);
        await nueva.getByRole("button", { name: "Crear lista" }).click();
        await listas.getByRole("spinbutton", { name: "Precio " + nombre }).fill(precio);
    }
    await expect(listas.locator(".pzProductoCab")).toContainText("General: $ 4.500");
    await capturar(page, "plata-07-listas-de-precios");
    await listas.getByRole("button", { name: "Guardar" }).click();
    await expect(page.locator("#pantallaCatalogo")).toBeVisible();

    // Don Pepe pasa a "Mayorista" (ficha > datos) y el pedido usa ese precio.
    await page.evaluate(() => window.abrirFichaComercio("Almacén Don Pepe"));
    await page.locator(".modalFichaComercio").getByRole("button", { name: /^Editar horario, nota y envases/ }).click();
    const datos = page.getByRole("dialog", { name: "Datos del comercio" });
    await datos.locator("#datoLista").selectOption("Mayorista");
    await datos.getByRole("button", { name: "Guardar" }).click();
    await expect(page.locator(".modalFichaComercio .fichaDatos")).toContainText("Mayorista");
    await page.keyboard.press("Escape");

    await irAPedidos(page);
    await page.getByRole("button", { name: "Nuevo pedido" }).click();
    await elegirComercio(page, "Almacén Don Pepe");
    await page.locator(".tituloMarca", { hasText: "Frío Sur" }).click();
    const helado = page.locator(".listaProdutos .fila", { hasText: "Helado 1 kg" });
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    await expect(page.locator("#totalPlataPedido")).toHaveText("$ 8.400");
});
