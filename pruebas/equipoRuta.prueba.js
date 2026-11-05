// VendeFrío - El equipo en los mapas (T140), en un celular chico (360×640).
// (Nube) El dueño ve en Rutas a los repartidores que comparten su ubicación.
// Los avisos de la calle (T139) se sacaron en el repaso de Rutas.
const { test, expect } = require("./ayudas");
const { registrarDistribuidora } = require("./recorridos");

test.use({ viewport: { width: 360, height: 640 } });

test.describe("nube", () => {
    test.use({ nube: true });

    test("compañeros: el dueño ve en Rutas a quien comparte su ubicación", async ({ page }, testInfo) => {
        await registrarDistribuidora(page, testInfo);
        const id = await page.evaluate(() => window.piezas.refNube().id);
        // Lucas comparte su ubicación desde su celular (se escribe directo en
        // el emulador, sin reglas).
        const ahora = Date.now();
        const respuesta = await page.request.patch(
            `http://127.0.0.1:8080/v1/projects/demo-vendefrio/databases/(default)/documents/distribuidoras/${id}/ubicaciones/p_lucas`,
            {
                headers: { Authorization: "Bearer owner" },
                data: { fields: {
                    nombre: { stringValue: "Lucas Díaz" }, lat: { doubleValue: -34.6025 }, lng: { doubleValue: -58.3825 },
                    precision: { integerValue: "8" }, destino: { stringValue: "Almacén Don Pepe" }, paso: { stringValue: "enCamino" },
                    hechas: { integerValue: "1" }, total: { integerValue: "4" }, horaCelular: { integerValue: String(ahora) }
                } }
            });
        expect(respuesta.ok()).toBe(true);

        await page.evaluate(() => mostrarPantalla("rutas"));
        const pin = page.locator("#pantallaRutas .pinCompanero");
        await expect(pin).toHaveCount(1, { timeout: 20000 });
        await expect(pin).toHaveAttribute("title", "Lucas Díaz, repartidor del equipo");
        await expect(pin.locator(".cabezaCompanero")).toHaveText("LU");
    });
});
