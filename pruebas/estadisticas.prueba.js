// VendeFrío - Estadísticas con el estilo nuevo (T52): resumen, pedidos por
// día en barras, lo más pedido con pestañas, la semana contra la anterior,
// los comercios para visitar, el pedido habitual y mes por mes.
const { test, expect, capturar } = require("./ayudas");

test("estadísticas: tarjetas con íconos y barras por día", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Vendedor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();

    // Pedidos de prueba de las últimas semanas, en tres comercios.
    await page.evaluate(() => {
        const dia = 86400000;
        const ahora = Date.now();
        // Una hora antes, pero sin pasarse al día anterior (pasada la
        // medianoche, "hace una hora" ya es ayer).
        const hora = haceDias => {
            const inicio = new Date(ahora - haceDias * dia);
            inicio.setHours(0, 0, 0, 0);
            return Math.max(inicio.getTime(), ahora - haceDias * dia - 3600000);
        };
        const pedido = (comercio, haceDias, productos) => ({
            comercio, timestamp: hora(haceDias),
            productos: productos.map(([marca, producto, cantidad, precio]) => ({ marca, producto, cantidad, precio }))
        });
        guardarHistorial([
            pedido("Kiosco Luna", 0, [["Frío Sur", "Helado 1 kg", 2, 4500], ["Frío Sur", "Palito bombón", 6, 800]]),
            pedido("Almacén Don Pepe", 1, [["Frío Sur", "Helado 1 kg", 3, 4500]]),
            pedido("Kiosco Luna", 2, [["Polar", "Cucurucho", 4, 1200]]),
            pedido("Bar Aurora", 3, [["Frío Sur", "Palito bombón", 10, 800]]),
            pedido("Kiosco Luna", 4, [["Frío Sur", "Helado 1 kg", 1, 4500]]),
            pedido("Almacén Don Pepe", 8, [["Polar", "Cucurucho", 2, 1200]]),
            pedido("Kiosco Luna", 9, [["Frío Sur", "Helado 1 kg", 2, 4500]]),
            pedido("Bar Aurora", 30, [["Frío Sur", "Palito bombón", 5, 800]]),
            pedido("Bar Aurora", 40, [["Frío Sur", "Palito bombón", 5, 800]]),
            pedido("Bar Aurora", 50, [["Frío Sur", "Palito bombón", 5, 800]])
        ]);
        window.abrirEstadisticas();
    });

    const pantalla = page.locator("#pantallaEstadisticas");
    await expect(pantalla).toBeVisible();
    // Arriba: la flecha vuelve a Más y la casita va a Inicio; sin "‹ Volver".
    await expect(pantalla.getByRole("button", { name: "Volver a Más" })).toBeVisible();
    await expect(pantalla.getByRole("button", { name: "Ir a Inicio" })).toBeVisible();
    await expect(pantalla.locator(".extraVolver")).toHaveCount(0);

    // Resumen del período con lo vendido.
    await expect(pantalla.locator(".statsResumen")).toContainText("10");
    await expect(pantalla.locator(".statsResumen")).toContainText("Vendido");
    // Cada tarjeta con su ícono.
    for (const titulo of ["Pedidos por día", "Lo más pedido", "Esta semana", "Para visitar", "Pedido habitual", "Mes por mes"]) {
        const tarjeta = pantalla.locator(".statsTarjeta", { has: page.getByRole("heading", { name: titulo }) });
        await expect(tarjeta.locator(".statsCabeza .ajIcono svg")).toBeVisible();
    }
    // Barras por día, con el de hoy marcado.
    await expect(pantalla.locator(".statsColumna")).toHaveCount(14);
    await expect(pantalla.locator(".statsColumna.hoy .statsValor")).toHaveText("1");
    await capturar(page, "estadisticas-01-resumen");

    // Lo más pedido: pestañas Comercios, Productos y Marcas.
    const ranking = pantalla.locator(".statsRanking");
    await expect(ranking.locator(".statsListaRanking:visible .statsFilaRanking").first()).toContainText("Kiosco Luna");
    await ranking.getByRole("tab", { name: "Productos" }).click();
    await expect(ranking.locator(".statsListaRanking:visible .statsFilaRanking").first()).toContainText("Palito bombón");
    await ranking.getByRole("tab", { name: "Marcas" }).click();
    await expect(ranking.locator(".statsListaRanking:visible .statsFilaRanking").first()).toContainText("Frío Sur");
    await ranking.scrollIntoViewIfNeeded();
    await capturar(page, "estadisticas-02-lo-mas-pedido");

    // Para visitar y pedido habitual; con "Hoy" queda solo el pedido de hoy.
    await pantalla.locator(".statsVisitar").scrollIntoViewIfNeeded();
    await capturar(page, "estadisticas-03-visitar-y-habitual");
    await pantalla.locator('[data-periodo="hoy"]').click();
    await expect(pantalla.locator(".statsResumen strong").first()).toHaveText("1");
    await expect(pantalla.locator(".statsColumna")).toHaveCount(7);
});
