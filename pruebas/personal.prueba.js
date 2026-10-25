// VendeFrío - Recorrido principal en el modo personal ("Continuar sin
// iniciar sesión"): los datos quedan solo en el celular.
const { test, expect, capturar } = require("./ayudas");

test("modo personal: entrar, cargar un pedido y verlo en Historial", async ({ page }) => {
    await page.goto("/");

    // Pantalla de inicio.
    await expect(page.getByRole("button", { name: "Continuar sin iniciar sesión" })).toBeVisible();
    await capturar(page, "personal-01-pantalla-de-inicio");

    // "Usar sin cuenta": nombre y roles.
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Vendedor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await expect(page.getByText("Tus datos no están protegidos")).toBeVisible();
    await expect(page.locator("#dashTotalComercios")).not.toHaveText("0");
    await capturar(page, "personal-02-inicio");

    // Nuevo pedido: comercio, productos y observaciones.
    await page.locator(".bottom-nav").getByRole("button", { name: "Nuevo pedido" }).click();
    await expect(page.locator("#pantallaPedido")).toBeVisible();
    await page.locator("#cliente").fill("Anibal");
    await page.locator("#cliente").blur();
    // Con varias marcas, cada una se abre tocando su nombre (T97).
    await page.locator(".tituloMarca").first().click();
    await expect(page.locator(".tituloMarca").first()).toHaveAttribute("aria-expanded", "true");
    const fila = page.locator(".listaProdutos .fila").first();
    await fila.getByRole("button", { name: "Aumentar cantidad" }).click();
    await fila.getByRole("button", { name: "Aumentar cantidad" }).click();
    await page.locator("#obs").fill("Entregar a la mañana");
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("2");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "personal-03-nuevo-pedido");

    await page.locator("#generar").click();
    const ventana = page.locator("#modalPedido");
    await expect(ventana).toBeVisible();
    await expect(page.locator("#pedidoCliente")).toHaveText("Anibal");
    await capturar(page, "personal-04-pedido-generado");
    await ventana.click({ position: { x: 10, y: 10 } });
    await expect(ventana).toBeHidden();

    // Mientras se carga un pedido la barra se esconde; la X vuelve a Inicio.
    await expect(page.locator(".bottom-nav")).toBeHidden();
    await page.locator("#cerrarCargaPedido").click();
    await expect(page.locator("#pantallaMenu")).toBeVisible();

    // Historial: el pedido quedó guardado en el celular.
    // En el modo personal, "Pedidos" de la barra abre Historial.
    await page.locator(".bottom-nav").getByRole("button", { name: "Pedidos" }).click();
    await expect(page.locator("#pantallaHistorial")).toBeVisible();
    await expect(page.locator("#pantallaHistorial").getByText("Anibal").first()).toBeVisible();
    // Período con botones (T33): el de hoy aparece en "Hoy" y en "Mes".
    await page.locator("#pantallaHistorial").getByRole("radio", { name: "Hoy" }).click();
    await expect(page.locator("#pantallaHistorial").getByText("Anibal").first()).toBeVisible();
    await page.locator("#pantallaHistorial").getByRole("radio", { name: "Mes" }).click();
    await expect(page.locator("#pantallaHistorial").getByText("Anibal").first()).toBeVisible();
    await expect(page.locator("#pantallaHistorial .marcadorFechaHistorial").first()).toContainText(/^Hoy · /);
    await expect(page.locator("#resumenHistorial")).toHaveText(/^1 pedido · \d+ unidad/);
    await capturar(page, "personal-05-historial");

    // T167: "⋯" abre una hoja con Ver pedido y Eliminar pedido.
    await page.getByRole("button", { name: "Opciones del pedido de Anibal" }).click();
    const opciones = page.getByRole("dialog", { name: "Opciones del pedido" });
    await expect(opciones.getByRole("button", { name: "Eliminar pedido" })).toBeVisible();
    await capturar(page, "personal-06-opciones-del-pedido");
    await opciones.getByRole("button", { name: "Ver pedido" }).click();
    await expect(page.locator("#modalPedido")).toBeVisible();
    await expect(page.locator("#pedidoCliente")).toHaveText("Anibal");
    await page.locator("#modalPedido").click({ position: { x: 10, y: 10 } });
    await expect(page.locator("#modalPedido")).toBeHidden();

    // Sigue ahí después de cerrar y abrir la app.
    await page.reload();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await expect(page.locator("#dashPedidosDeHoy")).toContainText("Anibal");
});
