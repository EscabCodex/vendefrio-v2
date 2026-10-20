// VendeFrío - Quién ve la plata (T93), con los emuladores de Firebase.
// El dueño ve lo vendido; un empleado sin "Cobra" ve unidades hasta que el
// dueño elige "Todos". El empleado no puede cambiar el ajuste en la nube.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, cargarPedido, abrirConfiguracionEn, entrarComoEmpleado } = require("./recorridos");

test.use({ nube: true });

async function irAInicio(page) {
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    await expect(page.locator("#pantallaMenu")).toBeVisible();
}

test("plata: el dueño decide quién ve cuánto se vendió", async ({ page, browser }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await cargarPedido(page, false);

    // El dueño ve la plata.
    await irAInicio(page);
    await expect(page.locator("#dashTituloHoy")).toHaveText("Vendido hoy");
    await expect(page.locator("#dashVendidoHoy")).toContainText("$");

    // Un empleado sin "Cobra": unidades, sin pesos.
    const { empleado, contexto, errores } = await entrarComoEmpleado(page, browser, testInfo);
    await irAInicio(empleado);
    await expect(empleado.locator("#dashTituloHoy")).toHaveText("Unidades hoy", { timeout: 20000 });
    await expect(empleado.locator("#dashVendidoHoy")).not.toContainText("$");
    await expect(empleado.locator("#dashEtiquetaVendidoSemana")).toHaveText("unidades");
    await capturar(empleado, "verPlata-01-empleado-sin-plata");

    // Las reglas no lo dejan cambiar el ajuste.
    const resultado = await empleado.evaluate(async () => {
        const guardado = JSON.parse(localStorage.getItem("vendefrio_empleado"));
        try {
            await window.firebase.firestore().collection("distribuidoras").doc(guardado.distribuidora)
                .collection("config").doc("plata").set({ quienVe: "todos" });
            return "ok";
        } catch (error) {
            return error.code;
        }
    });
    expect(resultado).toBe("permission-denied");

    // El dueño elige "Todos" en Empleados.
    await abrirConfiguracionEn(page, "empleados");
    const selector = page.locator("#elegirVerPlata");
    await expect(selector).toHaveValue("cobra");
    await selector.selectOption("todos");
    await expect(page.locator("#textoVerPlata")).toHaveText("Todo el equipo ve cuánto se vendió.");
    await capturar(page, "verPlata-02-ajuste-del-dueno");

    // El empleado ve la plata sin volver a entrar.
    await expect(empleado.locator("#dashTituloHoy")).toHaveText("Vendido hoy", { timeout: 20000 });
    await expect(empleado.locator("#dashVendidoHoy")).toContainText("$");

    expect(errores).toEqual([]);
    await contexto.close();
});
