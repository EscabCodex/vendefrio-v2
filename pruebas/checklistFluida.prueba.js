// VendeFrío - La checklist del pedido, fluida (repaso de Pedidos). Cada
// tilde se ve al instante, no se destilda solo un momento después y la
// ficha no se mueve: "Pendiente de sincronizar" ya no aparece y desaparece
// arriba con cada tilde (empujaba los productos y el dedo tocaba otro).
const { test, expect } = require("./ayudas");
const { registrarDistribuidora, cargarPedido } = require("./recorridos");

test.use({ nube: true });

test("checklist: tildar es inmediato y la ficha no se mueve", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await cargarPedido(page, true);

    await page.locator(".tarjetaSeguimiento", { hasText: "Almacén Don Pepe" }).click();
    const ficha = page.locator(".fichaPedido");
    await expect(ficha.locator(".lineaChecklist")).toHaveCount(2);

    // Con la ficha ya abierta y los productos a la vista (el clic de la
    // prueba no tiene que mover nada).
    const helado = ficha.locator(".lineaChecklist", { hasText: "Helado 1 kg" });
    await ficha.locator(".checklistPedido").evaluate(seccion => seccion.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(600);

    // Anota cada cambio de la checklist y de la fila de arriba, cuadro a cuadro.
    await page.evaluate(() => {
        window.registroChecklist = [];
        const anotar = () => {
            const filas = [...document.querySelectorAll("#modalFichaPedido .lineaChecklist")];
            const etiquetas = document.querySelector("#modalFichaPedido .etiquetasFichaPedido");
            window.registroChecklist.push({
                estados: filas.map(fila => fila.dataset.estado).join(","),
                arriba: filas[0] ? Math.round(filas[0].getBoundingClientRect().top) : 0,
                etiquetas: etiquetas ? etiquetas.textContent : ""
            });
            requestAnimationFrame(anotar);
        };
        requestAnimationFrame(anotar);
    });

    await helado.click();
    // Se ve tildado enseguida, antes de que la nube conteste.
    await expect(helado).toHaveAttribute("data-estado", "lista", { timeout: 500 });
    await expect(ficha.locator(".etiquetasFichaPedido")).toContainText("En preparación");
    await ficha.locator(".lineaChecklist", { hasText: "Palito bombón" }).click();
    await expect(ficha).toContainText("2 de 2 listos");
    await page.waitForTimeout(1500);

    const registro = await page.evaluate(() => window.registroChecklist);
    // Una vez tildado, Helado no vuelve a verse sin tildar.
    const primero = registro.findIndex(item => item.estados.startsWith("lista"));
    expect(primero).toBeGreaterThanOrEqual(0);
    expect(registro.slice(primero).filter(item => !item.estados.startsWith("lista"))).toHaveLength(0);
    // La fila de arriba no cambia de lugar y no aparece "Pendiente de sincronizar".
    expect(new Set(registro.map(item => item.arriba)).size).toBe(1);
    expect(registro.filter(item => item.etiquetas.includes("Pendiente de sincronizar"))).toHaveLength(0);

    // Destildar también es inmediato y queda así.
    await helado.click();
    await expect(helado).toHaveAttribute("data-estado", "pendiente", { timeout: 500 });
    await page.waitForTimeout(1500);
    await expect(helado).toHaveAttribute("data-estado", "pendiente");
    await expect(ficha).toContainText("1 de 2 listos");
});
