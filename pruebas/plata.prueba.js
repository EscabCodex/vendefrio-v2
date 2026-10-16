// VendeFrío - Ideas para la 1.0, tanda 4 "Plata" (T74 a T78), con los
// emuladores de Firebase.
// 1. Saldo por comercio con tope, recordatorio, pago parcial y recibo.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, cargarPedido, irAPedidos, elegirComercio } = require("./recorridos");

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

    // Pedidos > A cobrar: "Te deben" y "ver por comercio".
    await irAPedidos(page);
    await page.locator("#filtrosEtapaPedidos").getByRole("tab", { name: /A cobrar/ }).click();
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
    const hoy = new Date();
    const fecha = hoy.getDate() + "/" + (hoy.getMonth() + 1);
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
