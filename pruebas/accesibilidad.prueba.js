// VendeFrío - Accesibilidad (Etapa 6, T48): en cada pantalla principal,
// todo botón o enlace visible tiene un nombre que lee el lector de
// pantalla, y los de la barra de abajo son fáciles de tocar (44 px o más).
const { test, expect } = require("./ayudas");
const { registrarDistribuidora, abrirMas } = require("./recorridos");

test.use({ nube: true });

function sinNombre(page) {
    return page.evaluate(() => {
        const visible = elemento => {
            const caja = elemento.getBoundingClientRect();
            if (caja.width === 0 || caja.height === 0) return false;
            const estilo = getComputedStyle(elemento);
            return estilo.visibility !== "hidden" && estilo.display !== "none" && !elemento.closest("[aria-hidden='true']");
        };
        const nombre = elemento => {
            const etiqueta = elemento.getAttribute("aria-label") || elemento.getAttribute("title") || "";
            if (etiqueta.trim()) return etiqueta.trim();
            const ids = (elemento.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
            const porId = ids.map(id => document.getElementById(id)?.textContent || "").join(" ").trim();
            if (porId) return porId;
            return (elemento.innerText || elemento.textContent || "").trim();
        };
        return [...document.querySelectorAll("button, a[href], [role='button']")]
            .filter(visible)
            .filter(elemento => !nombre(elemento))
            .map(elemento => elemento.outerHTML.slice(0, 140));
    });
}

test("accesibilidad: botones con nombre y barra fácil de tocar", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    const barra = page.locator(".bottom-nav");

    // Barra de abajo: 44 px o más para el dedo.
    const tamanos = await barra.locator("button").evaluateAll(botones => botones.map(boton => {
        const caja = boton.getBoundingClientRect();
        return Math.min(caja.width, caja.height);
    }));
    expect(tamanos.length).toBeGreaterThanOrEqual(5);
    tamanos.forEach(tamano => expect(tamano).toBeGreaterThanOrEqual(44));

    expect(await sinNombre(page), "Inicio").toEqual([]);
    for (const pantalla of ["Pedidos", "Comercios", "Catálogo"]) {
        await barra.getByRole("button", { name: pantalla }).click();
        await page.waitForTimeout(300);
        expect(await sinNombre(page), pantalla).toEqual([]);
    }
    await barra.getByRole("button", { name: "Nuevo pedido" }).click();
    await page.waitForTimeout(300);
    expect(await sinNombre(page), "Nuevo pedido").toEqual([]);
    await page.getByRole("button", { name: "Volver a Pedidos" }).click();
    await abrirMas(page);
    expect(await sinNombre(page), "Más").toEqual([]);
});
