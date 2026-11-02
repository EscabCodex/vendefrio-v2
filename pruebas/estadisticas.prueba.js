// VendeFrío - Estadísticas para estudiar el mercado (repaso de diseño,
// 2026-11-01): períodos corridos con su cantidad, "Cómo vengo", "Qué hacer
// hoy" (Llamalos y Ofreceles), "Qué se mueve" (quién deja más plata y qué
// día se vende más) y "Para crecer" (tus clientes, comercios sin guardar).
const { test, expect, capturar } = require("./ayudas");

test("estadísticas: cómo vengo, qué hacer hoy, qué se mueve y para crecer", async ({ page }) => {
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
            pedido("Bar Aurora", 50, [["Frío Sur", "Palito bombón", 5, 800]]),
            pedido("Almacén Don Pepe", 12, [["Frío Sur", "Palito bombón", 4, 800]]),
            pedido("Kiosco Nuevo", 1, [["Frío Sur", "Helado 1 kg", 1, 4500]])
        ]);
        agregarComercio({ nombre: "Kiosco Luna", direccion: "Belgrano 45", telefono: "11 4000-1111" });
        agregarComercio({ nombre: "Almacén Don Pepe", direccion: "San Martín 123" });
        agregarComercio({ nombre: "Bar Aurora", direccion: "Mitre 10" });
        agregarComercio({ nombre: "Despensa Sin Pedidos", direccion: "Moreno 5" });
        window.abrirEstadisticas();
    });

    const pantalla = page.locator("#pantallaEstadisticas");
    await expect(pantalla).toBeVisible();
    // Arriba: la flecha vuelve a Más y no hay casita (el título entra entero).
    await expect(pantalla.getByRole("button", { name: "Volver a Más" })).toBeVisible();
    await expect(pantalla.getByRole("button", { name: "Ir a Inicio" })).toBeHidden();
    await expect(pantalla.locator(".extraVolver")).toHaveCount(0);

    // Períodos corridos con su cantidad; arranca en 30 días.
    await expect(pantalla.locator('[data-periodo="mes"]')).toHaveClass(/activo/);
    await expect(pantalla.locator('[data-periodo="hoy"] .filtroEtapaCantidad')).toHaveText("1");
    await expect(pantalla.locator('[data-periodo="semana"] .filtroEtapaCantidad')).toHaveText("6");
    await expect(pantalla.locator('[data-periodo="mes"] .filtroEtapaCantidad')).toHaveText("9");
    await expect(pantalla.locator('[data-periodo="anio"] .filtroEtapaCantidad')).toHaveText("12");

    // Las cuatro partes, en orden.
    await expect(pantalla.locator(".statsSeccion h2")).toHaveText(["Cómo vengo", "Qué hacer hoy", "Qué se mueve", "Para crecer"]);
    // Cómo vengo: lo vendido y los pedidos de los últimos 30 días.
    const resumen = pantalla.locator(".statsResumen");
    await expect(resumen).toContainText("Últimos 30 días");
    await expect(resumen).toContainText("vendido");
    await expect(resumen.locator(".statsNumeros > div").first()).toContainText("9");
    for (const titulo of ["Llamalos", "Ofreceles", "Quién te deja más plata", "Qué día se vende más", "Tus clientes"]) {
        const tarjeta = pantalla.locator(".statsTarjeta", { has: page.getByRole("heading", { name: titulo }) });
        await expect(tarjeta.locator(".statsCabeza .ajIcono svg")).toBeVisible();
    }
    // Lo que se sacó.
    for (const titulo of ["Esta semana", "Pedido habitual", "Mes por mes", "Pedidos por día", "Se están enfriando"]) {
        await expect(pantalla.getByRole("heading", { name: titulo })).toHaveCount(0);
    }
    await capturar(page, "estadisticas-01-como-vengo");

    // Qué hacer hoy: Bar Aurora compra menos que antes (sin teléfono: en vez
    // de WhatsApp, "+ Tel."); a Bar Aurora le ofrece Helado 1 kg.
    const llamar = pantalla.locator(".statsLlamar");
    await expect(llamar.locator(".statsFila", { hasText: "Bar Aurora" })).toBeVisible();
    await expect(llamar.locator(".statsFila", { hasText: "Bar Aurora" }).locator(".statsAgregarTel")).toBeVisible();
    const ofrecer = pantalla.locator(".statsOfrecer");
    await expect(ofrecer.locator(".statsFila", { hasText: "Bar Aurora" })).toContainText("No lleva Helado 1 kg");
    await llamar.evaluate(caja => window.scrollTo(0, caja.getBoundingClientRect().top + window.scrollY - 140));
    await capturar(page, "estadisticas-02-que-hacer-hoy");

    // Qué se mueve: por plata, Kiosco Luna primero; pestañas de productos y marcas.
    const ranking = pantalla.locator(".statsRanking");
    await expect(ranking.locator(".statsListaRanking:visible .statsFilaRanking").first()).toContainText("Kiosco Luna");
    await expect(ranking.locator(".statsListaRanking:visible .statsFilaRanking").first()).toContainText("$");
    await ranking.getByRole("tab", { name: "Productos" }).click();
    await expect(ranking.locator(".statsListaRanking:visible .statsFilaRanking").first()).toContainText("Helado 1 kg");
    await ranking.getByRole("tab", { name: "Marcas" }).click();
    await expect(ranking.locator(".statsListaRanking:visible .statsFilaRanking").first()).toContainText("Frío Sur");
    await expect(pantalla.locator(".statsDiasBarras > div")).toHaveCount(7);
    await ranking.evaluate(caja => window.scrollTo(0, caja.getBoundingClientRect().top + window.scrollY - 140));
    await capturar(page, "estadisticas-03-que-se-mueve");

    // Para crecer: Kiosco Nuevo es nuevo y no está guardado ("Crear" abre
    // Datos del comercio con el nombre); Despensa Sin Pedidos nunca compró.
    const clientes = pantalla.locator(".statsClientes");
    await expect(clientes.locator(".statsClientesNumeros")).toContainText("+3");
    await expect(clientes.locator(".statsAvisoSinGuardar")).toContainText("1 pedido de comercios sin guardar");
    await expect(clientes).toContainText("Despensa Sin Pedidos");
    await clientes.evaluate(caja => window.scrollTo(0, caja.getBoundingClientRect().top + window.scrollY - 140));
    await capturar(page, "estadisticas-04-para-crecer");
    await clientes.getByRole("button", { name: "Crear Kiosco Nuevo" }).click();
    const hoja = page.getByRole("dialog", { name: "Nuevo comercio" });
    await expect(hoja.locator("#modalNombre")).toHaveValue("Kiosco Nuevo");
    await page.keyboard.press("Escape");
    await expect(hoja).toBeHidden();

    // Con "Hoy" queda solo el pedido de hoy.
    await pantalla.locator('[data-periodo="hoy"]').click();
    await expect(pantalla.locator('[data-periodo="hoy"]')).toHaveClass(/activo/);
    await expect(resumen.locator(".statsNumeros > div").first()).toContainText("1");
    await expect(resumen).toContainText("Hoy");
});
