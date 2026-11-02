// VendeFrío - Recorrido principal en el modo personal (sin cuenta): los
// datos quedan solo en el celular. Lo siguen usando los celulares que ya
// lo habían elegido.
const { test, expect, capturar } = require("./ayudas");

test("modo personal: entrar, cargar un pedido y verlo en Historial", async ({ page }) => {
    await page.goto("/");

    // Pantalla de inicio: desde 2026-11-02 ya no ofrece "Continuar sin
    // iniciar sesión" (crear cuenta, ingresar, código o ejemplo).
    await expect(page.getByRole("button", { name: "Crear cuenta gratis" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar sin iniciar sesión" })).toHaveCount(0);
    await capturar(page, "personal-01-pantalla-de-inicio");

    // Un celular que ya usaba la app sin cuenta, de antes de pedir el
    // nombre, sigue en ese modo: se le pide nombre y roles una sola vez.
    await page.evaluate(() => localStorage.setItem("vendefrio_inicio_sin_sesion", "1"));
    await page.reload();
    await expect(page.locator("#inicioFormPersonal")).toBeVisible();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Vendedor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await expect(page.getByText("Tus datos no están protegidos")).toBeVisible();
    // Arranca vacío, sin la lista de fábrica de antes (informe del desconocido).
    await expect(page.locator("#dashTotalComercios")).toHaveText("0");
    expect(await page.evaluate(() => [obtenerComercios().length, Object.keys(obtenerProductos()).length])).toEqual([0, 0]);
    await capturar(page, "personal-02-inicio");
    await page.evaluate(() =>
        agregarComercio({ nombre: "Anibal", direccion: "Calle 1" }) &&
        agregarMarca("Frío Sur") && agregarProducto("Frío Sur", { nombre: "Helado 1 kg", precio: 4500 }) &&
        agregarMarca("Pastas Sur") && agregarProducto("Pastas Sur", { nombre: "Ravioles", precio: 2500 }));

    // Nuevo pedido: comercio, productos y observaciones.
    await page.locator(".bottom-nav .nav-nuevo").click();
    await page.locator(".menuCrear").getByRole("button", { name: "Nuevo pedido" }).click();
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

    // Terminados: el pedido quedó guardado en el celular. Sin cuenta,
    // "Pedidos" de la barra abre Pedidos > Terminados (el historial son los
    // Terminados, con o sin cuenta: pedido del dueño, 2026-11-01).
    await page.locator(".bottom-nav").getByRole("button", { name: "Pedidos" }).click();
    const vista = page.locator("#vistaPedidos");
    await expect(vista).toBeVisible();
    await expect(page.locator("#filtrosEtapaPedidos").getByRole("tab")).toHaveCount(1);
    await expect(page.locator("#filtrosEtapaPedidos").getByRole("tab", { name: /Terminados/ })).toBeVisible();
    const tarjeta = vista.locator(".tarjetaSeguimiento", { hasText: "Anibal" });
    await expect(tarjeta).toBeVisible();
    // Período con botones: el de hoy aparece en "Hoy" y en "Mes".
    const periodo = page.locator(".filtrosHistorialPedidos");
    await periodo.getByRole("radio", { name: "Hoy" }).click();
    await expect(tarjeta).toBeVisible();
    await periodo.getByRole("radio", { name: "Mes" }).click();
    await expect(tarjeta).toBeVisible();
    await expect(vista.locator(".marcadorFechaHistorial").first()).toContainText(/^Hoy · /);
    await expect(page.locator("#resumenVistaPedidos")).toHaveText(/^1 pedido · 2 u/);
    await capturar(page, "personal-05-historial");

    // La ficha: el ⋯ tiene Ver mensaje y Eliminar pedido.
    await tarjeta.click();
    const ficha = page.locator(".fichaPedido");
    await ficha.getByRole("button", { name: "Más opciones" }).click();
    await expect(ficha.getByRole("menuitem", { name: "Eliminar pedido" })).toBeVisible();
    await capturar(page, "personal-06-opciones-del-pedido");
    await ficha.getByRole("menuitem", { name: "Ver mensaje del pedido" }).click();
    await expect(page.locator("#modalPedido")).toBeVisible();
    await expect(page.locator("#pedidoCliente")).toHaveText("Anibal");
    await page.locator("#modalPedido").click({ position: { x: 10, y: 10 } });
    await expect(page.locator("#modalPedido")).toBeHidden();

    // Sigue ahí después de cerrar y abrir la app.
    await page.reload();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await expect(page.locator("#dashPedidosDeHoy")).toContainText("Anibal");
});
