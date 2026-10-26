// VendeFrío - Repasada y optimización profunda, con los emuladores de Firebase.
// 1. Lo último que se abre queda arriba: la hoja de "una o dos copias" del
//    ticket sale encima de "Pedido generado" y de la ficha del pedido, aunque
//    se haya creado antes, y el aviso corto ("Ticket impreso") se ve encima
//    de las hojas abiertas.
const { test, expect, capturar } = require("./ayudas");
const {
    registrarDistribuidora,
    elegirComercio,
    irAPedidos,
    usarImpresoraFalsa
} = require("./recorridos");

test.use({ nube: true });

// ¿Lo que se ve en el centro del botón es el botón? (si otra hoja lo tapa,
// el dedo tocaría la de arriba).
async function seTocaArriba(boton) {
    return boton.evaluate(elemento => {
        const caja = elemento.getBoundingClientRect();
        const tocado = document.elementFromPoint(caja.left + caja.width / 2, caja.top + caja.height / 2);
        return Boolean(tocado && elemento.contains(tocado));
    });
}

// La altura (z-index) de la hoja abierta más alta, para comparar con la del
// aviso corto.
async function alturaHojaMasAlta(page) {
    return page.evaluate(() => Math.max(0, ...[...document.body.children]
        .filter(capa => capa.matches(".modal, .pzFondo") && !capa.classList.contains("oculto"))
        .map(capa => Number(getComputedStyle(capa).zIndex) || 0)));
}

test("repasada: la hoja de copias del ticket queda arriba de la ficha", async ({ page }, testInfo) => {
    await usarImpresoraFalsa(page);
    await registrarDistribuidora(page, testInfo);

    // Al terminar un pedido, "Imprimir ticket" desde "Pedido generado": la
    // hoja de copias se crea ahora (antes que la ficha del pedido).
    await irAPedidos(page);
    await page.getByRole("button", { name: "Nuevo pedido" }).click();
    await elegirComercio(page, "Almacén Don Pepe");
    const helado = page.locator(".listaProdutos .fila", { hasText: "Helado 1 kg" });
    if (!(await helado.isVisible())) await page.locator(".tituloMarca", { hasText: "Frío Sur" }).click();
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    await page.locator("#generar").click();
    const generado = page.locator("#modalPedido");
    await expect(generado).toBeVisible();
    await generado.getByRole("button", { name: "Imprimir ticket" }).click();
    const copias = page.locator("#modalCopiasTicket");
    await expect(copias).toBeVisible();
    expect(await seTocaArriba(copias.getByRole("button", { name: /Una copia/ }))).toBe(true);
    await copias.getByRole("button", { name: "Cancelar" }).click();
    await expect(copias).toBeHidden();
    await generado.click({ position: { x: 10, y: 10 } });
    await expect(generado).toBeHidden();

    // Después, desde la ficha del pedido: Más opciones > Imprimir ticket.
    await irAPedidos(page);
    await page.locator(".tarjetaSeguimiento", { hasText: "Almacén Don Pepe" }).first().click();
    const ficha = page.locator(".fichaPedido");
    await expect(ficha).toBeVisible();
    await ficha.getByRole("button", { name: "Más opciones" }).click();
    await ficha.getByRole("menuitem", { name: "Imprimir ticket" }).click();
    await expect(copias).toBeVisible();
    const dos = copias.getByRole("button", { name: /Dos copias/ });
    expect(await seTocaArriba(dos)).toBe(true);
    await capturar(page, "repasada-01-copias-arriba-de-la-ficha");

    // El aviso "Ticket impreso" se ve encima de la ficha, que sigue abierta.
    await dos.click();
    await expect(page.locator("#contenedorToasts")).toContainText("Ticket impreso");
    const alturaAviso = await page.locator("#contenedorToasts").evaluate(caja => Number(getComputedStyle(caja).zIndex));
    expect(alturaAviso).toBeGreaterThan(await alturaHojaMasAlta(page));
    await expect(ficha).toBeVisible();
});
