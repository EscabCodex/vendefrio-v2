// VendeFrío - Cobrar varios pedidos seguidos (T130), con los emuladores de
// Firebase.
// 1. "Entregado" en tanda con 3 pedidos: la hoja "¿Cómo pagó?" sale uno
//    tras otro con "Cobro 1 de 3". Uno en efectivo, uno se salta y otro por
//    transferencia; el saltado queda en «A cobrar».
// 2. En «A cobrar», el botón grande es "Cobrar": "Terminar" corta la tanda
//    sin cobrar y después se cobra el que quedaba.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, cargarPedido } = require("./recorridos");

test.use({ nube: true });

test("nube: cobrar varios pedidos seguidos", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(() =>
        agregarComercio({ nombre: "Kiosco Luna", direccion: "Belgrano 45", telefono: "" }) &&
        agregarComercio({ nombre: "Super Norte", direccion: "Mitre 900", telefono: "" })
    );
    for (const comercio of ["Almacén Don Pepe", "Kiosco Luna", "Super Norte"]) {
        await cargarPedido(page, false, comercio);
    }

    const tarjetas = page.locator(".tarjetaSeguimiento");
    const pie = page.locator(".pieTandaPedidos");
    const confirmar = page.locator("#modalRepartoTanda");
    const hoja = page.locator(".cobroPedido");
    const contador = page.locator("#contadorCobroTanda");
    const guardar = page.locator("#guardarCobroPedido");
    await expect(tarjetas).toHaveCount(3);

    // Elegir todos y entregarlos en tanda.
    await mantenerApretada(page, tarjetas.first());
    await page.getByRole("button", { name: "Marcar todos" }).click();
    await pie.getByRole("button", { name: /Mover a otro paso/ }).click();
    await page.getByRole("dialog", { name: "Mover a otro paso" }).getByRole("button", { name: "Entregado (3)" }).click();
    await confirmar.getByRole("button", { name: "Entregado (3)" }).click();

    // Cobro 1 de 3: efectivo, con el total escrito.
    await expect(contador).toHaveText("Cobro 1 de 3");
    await expect(hoja.getByText("¿Cómo pagó?")).toBeVisible();
    const primero = await hoja.locator(".explicacionTextoPedido").textContent();
    await hoja.getByRole("button", { name: "Efectivo" }).click();
    await expect(page.locator("#montoCobroPedido")).toHaveValue(/9\.?800/);
    await expect(guardar).toHaveText("Guardar y seguir");
    await expect(hoja.getByRole("button", { name: "Saltar" })).toBeVisible();
    await capturar(page, "cobroTanda-01-cobro-1-de-3");
    await guardar.click();

    // Cobro 2 de 3: otro comercio. Se salta.
    await expect(contador).toHaveText("Cobro 2 de 3");
    await expect(hoja.locator(".explicacionTextoPedido")).not.toHaveText(primero);
    await capturar(page, "cobroTanda-02-cobro-2-de-3");
    await hoja.getByRole("button", { name: "Saltar" }).click();

    // Cobro 3 de 3: transferencia, el último ya no dice "y seguir".
    await expect(contador).toHaveText("Cobro 3 de 3");
    await hoja.getByRole("button", { name: "Transferencia" }).click();
    await expect(guardar).toHaveText("Guardar cobro");
    await guardar.click();
    await expect(hoja).toBeHidden();
    await expect(page.locator("#contenedorToasts")).toContainText("2 cobrados de 3. 1 queda en «A cobrar»");
    await capturar(page, "cobroTanda-03-resumen");

    // En Terminados, con todos elegidos, el botón grande es "Cobrar" y
    // cuenta solo el que falta cobrar.
    const etapas = page.locator("#filtrosEtapaPedidos");
    await etapas.getByRole("tab", { name: /Terminados/ }).click();
    await expect(tarjetas).toHaveCount(3);
    // T167: Terminados agrupado por día, con cuánto suma.
    const dia = page.locator("#listaVistaPedidos .marcadorFechaHistorial");
    await expect(dia).toHaveCount(1);
    await expect(dia).toContainText(/^Hoy · .*3 pedidos · \$ 29\.400$/);
    await expect(page.locator("#resumenVistaPedidos")).toContainText("3 pedidos  ·  9 unidades  ·  $ 29.400");
    await capturar(page, "cobroTanda-04a-terminados-por-dia");
    await mantenerApretada(page, tarjetas.first());
    await page.getByRole("button", { name: "Marcar todos" }).click();
    await expect(pie.getByRole("button", { name: "Cobrar (1)" })).toBeVisible();
    await capturar(page, "cobroTanda-04-terminados");

    // "Terminar" corta la tanda sin cobrar: sigue en «A cobrar».
    await pie.getByRole("button", { name: "Cobrar (1)" }).click();
    await expect(contador).toHaveText("Cobro 1 de 1");
    await page.locator("#terminarCobroTanda").click();
    await expect(hoja).toBeHidden();
    await expect(page.locator("#contenedorToasts")).toContainText("0 cobrados de 1. 1 queda en «A cobrar»");

    // En «A cobrar» (en "Otros") queda el saltado, y se cobra.
    await etapas.getByRole("tab", { name: /Otros/ }).click();
    await page.getByRole("dialog", { name: "Otros pedidos" }).getByRole("button", { name: /A cobrar/ }).click();
    await expect(tarjetas).toHaveCount(1);
    await mantenerApretada(page, tarjetas.first());
    await pie.getByRole("button", { name: "Cobrar (1)" }).click();
    await hoja.getByRole("button", { name: "Efectivo" }).click();
    await guardar.click();
    await expect(hoja).toBeHidden();
    await expect(tarjetas).toHaveCount(0);

    await expect(page.getByText("Pendiente de sincronizar")).toHaveCount(0);
});

// Mantiene apretada una tarjeta (como el dedo en el celular).
async function mantenerApretada(page, tarjeta) {
    await expect(async () => {
        await tarjeta.scrollIntoViewIfNeeded({ timeout: 2000 });
        const caja = await tarjeta.boundingBox();
        await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(700);
        await page.mouse.up();
        await expect(page.locator(".pieTandaPedidos")).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
}
