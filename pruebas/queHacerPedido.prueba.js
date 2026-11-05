// VendeFrío - Al guardar un pedido: "¿Qué hacemos con este pedido?"
// (Entregar ahora, Pasarlo a En reparto o Dejarlo cargado).
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, irAPedidos, elegirComercio } = require("./recorridos");

test.use({ nube: true });

async function guardarUno(page) {
    await irAPedidos(page);
    await page.locator(".bottom-nav .nav-nuevo").click();
    await page.locator(".menuCrear").getByRole("button", { name: "Nuevo pedido" }).click();
    await elegirComercio(page, "Almacén Don Pepe");
    const helado = page.locator(".listaProdutos .fila", { hasText: "Helado 1 kg" });
    if (!(await helado.isVisible())) await page.locator(".tituloMarca", { hasText: "Frío Sur" }).click();
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    await page.locator("#generar").click();
    const generado = page.locator("#modalPedido");
    await expect(generado).toBeVisible();
    return generado;
}

test("al guardar: entregar ahora o pasarlo a En reparto", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);

    let generado = await guardarUno(page);
    const queHacer = generado.locator(".queHacerPedido");
    await expect(queHacer).toContainText("¿Qué hacemos con este pedido?");
    await expect(queHacer.locator(".qhpOpcion")).toHaveCount(3);
    await expect(generado.getByRole("button", { name: "Imprimir ticket" })).toBeVisible();
    await expect(generado.getByRole("button", { name: "Volver a editar" })).toBeVisible();
    await queHacer.scrollIntoViewIfNeeded();
    await capturar(page, "que-hacer-pedido");
    await queHacer.getByRole("button", { name: /A repartir/ }).click();
    await expect(generado).toBeHidden();
    await expect.poll(() => page.evaluate(() => {
        const p = obtenerHistorial().find(x => x.comercio === "Almacén Don Pepe");
        return p ? estadoActualDelPedido(p) : "";
    })).toBe("enReparto");

    generado = await guardarUno(page);
    await generado.locator(".queHacerPedido").getByRole("button", { name: /Entregar ahora/ }).click();
    await expect(page.getByText("¿Cómo pagó?")).toBeVisible();
});
