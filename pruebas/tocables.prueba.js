// VendeFrío - Números y tarjetas que llevan a su detalle (repasada).
// Lo que parecía solo información ahora se toca y lleva a lo concreto:
// "Vendido hoy" a Estadísticas de hoy, "23 de 80 comercios visitados" a los
// visitados, los números de Estadísticas a Terminados o a quién deja más plata,
// cada comercio o producto del ranking a sus pedidos o al Catálogo, y los
// números de la ficha de un comercio a sus pedidos. En reposo se ven igual.
const { test, expect, capturar } = require("./ayudas");
const { entrarSinCuenta } = require("./datosGrandes");

function cargarDatos() {
    const dia = 86400000;
    const ahora = Date.now();
    // Una hora antes, sin pasarse al día anterior (pasada la medianoche).
    const hora = haceDias => {
        const inicio = new Date(ahora - haceDias * dia);
        inicio.setHours(0, 0, 0, 0);
        return Math.max(inicio.getTime(), ahora - haceDias * dia - 3600000);
    };
    const hoy = new Date().toLocaleDateString("es-AR");
    guardarProductos({
        "Frío Sur": [{ nombre: "Helado 1 kg", precio: 4500 }, { nombre: "Palito bombón", precio: 800 }],
        "Polar": [{ nombre: "Cucurucho", precio: 1200 }]
    });
    guardarComercios(["Kiosco Luna", "Almacén Don Pepe", "Bar Aurora", "Súper Norte"].map((nombre, i) => ({
        nombre, direccion: "Calle " + (i + 1) + " 100", telefono: "", enlaceMaps: "", origenGps: "manual", lat: "", lng: "",
        pedidosRealizados: 0, ultimaVisita: i < 2 ? hoy : "", pendienteSemana: false
    })));
    const pedido = (comercio, haceDias, productos) => ({
        comercio, timestamp: hora(haceDias),
        productos: productos.map(([marca, producto, cantidad, precio]) => ({ marca, producto, cantidad, precio }))
    });
    guardarHistorial([
        pedido("Kiosco Luna", 0, [["Frío Sur", "Helado 1 kg", 2, 4500], ["Frío Sur", "Palito bombón", 6, 800]]),
        pedido("Almacén Don Pepe", 0, [["Frío Sur", "Helado 1 kg", 3, 4500]]),
        pedido("Kiosco Luna", 2, [["Polar", "Cucurucho", 4, 1200]]),
        pedido("Bar Aurora", 3, [["Frío Sur", "Palito bombón", 10, 800]]),
        pedido("Kiosco Luna", 9, [["Frío Sur", "Helado 1 kg", 2, 4500]])
    ]);
    mostrarPantalla("menu");
}

test("tocables: cada número lleva a su detalle", async ({ page }) => {
    await entrarSinCuenta(page);
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(cargarDatos);
    const inicio = page.locator("#pantallaMenu");
    const barra = page.locator(".bottom-nav");
    await expect(page.locator("#dashResumenHoy")).toHaveText("2 pedidos · 2 comercios");

    // En reposo se ven igual que antes: nada movido ni agrandado.
    const vendidoHoy = page.locator("#dashHoyVendido");
    expect(await vendidoHoy.evaluate(caja => getComputedStyle(caja).transform)).toBe("none");
    await expect(vendidoHoy).toHaveAttribute("role", "button");

    // "Vendido hoy" -> Estadísticas de hoy, desde arriba.
    await vendidoHoy.click();
    const estadisticas = page.locator("#pantallaEstadisticas");
    await expect(estadisticas).toBeVisible();
    await expect(estadisticas.locator('[data-periodo="hoy"]')).toHaveClass(/activo/);
    await expect(estadisticas.locator(".statsResumen")).toContainText("Hoy");
    await expect(estadisticas.locator(".statsNumeros > div").first().locator("strong")).toHaveText(/^2(\D|$)/);
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(0);
    await capturar(page, "tocables-01-estadisticas-de-hoy");

    // "comercios" y lo vendido -> quién te deja más plata, en Comercios.
    await estadisticas.locator(".statsNumeros > div").nth(1).click();
    const ranking = estadisticas.locator(".statsRanking");
    await expect(ranking.getByRole("tab", { name: "Comercios" })).toHaveAttribute("aria-selected", "true");
    await expect(ranking).toBeInViewport();
    await page.evaluate(() => window.scrollTo(0, 0));
    await estadisticas.locator(".statsVendido").click();
    await expect(ranking).toBeInViewport();

    // Un producto del ranking -> el Catálogo en su marca, con el producto a la vista.
    await ranking.getByRole("tab", { name: "Productos" }).click();
    await ranking.locator(".statsListaRanking:visible .statsFilaRanking", { hasText: "Helado 1 kg" }).click();
    const catalogo = page.locator("#pantallaCatalogo");
    await expect(catalogo).toBeVisible();
    await expect(page.locator("#filtroMarcaCatalogo")).toHaveValue("Frío Sur");
    await expect(catalogo.locator(".itemCatalogo", { hasText: "Helado 1 kg" })).toBeInViewport();
    await expect(catalogo.locator(".itemCatalogo", { hasText: "Cucurucho" })).toHaveCount(0);
    await expect(barra.locator('[data-pantalla="catalogo"]')).toHaveClass(/activo/);

    // Un comercio del ranking -> sus pedidos.
    await page.evaluate(() => window.abrirEstadisticas("semana"));
    await expect(estadisticas.locator('[data-periodo="semana"]')).toHaveClass(/activo/);
    await ranking.getByRole("tab", { name: "Comercios" }).click();
    await ranking.locator(".statsListaRanking:visible .statsFilaRanking", { hasText: "Kiosco Luna" }).click();
    await expect(page.locator("#vistaPedidos")).toBeVisible();
    await expect(page.locator(".pastillaComercioHistorial")).toContainText("Kiosco Luna");

    // Los pedidos de los últimos 7 días -> Pedidos > Terminados de la semana.
    await page.evaluate(() => window.abrirEstadisticas("semana"));
    await estadisticas.locator(".statsNumeros > div").first().click();
    await expect(page.locator("#vistaPedidos")).toBeVisible();
    await expect(page.locator('.filtrosHistorialPedidos [data-periodo="semana"]')).toHaveAttribute("aria-checked", "true");

    // Inicio: "Visitados esta semana 2 de 4" -> los visitados, y
    // "Visitados hoy" -> los visitados.
    await barra.getByRole("button", { name: "Inicio" }).click();
    await expect(inicio).toBeVisible();
    await expect(page.locator("#dashVisitas")).toContainText("Visitados esta semana2 de 4");
    await page.locator("#dashVisitas").click();
    await expect(page.locator("#pantallaComercios")).toBeVisible();
    await expect(page.locator("#filtroEstadoComercios")).toHaveValue("visitados");
    await expect(page.locator("#listaComerciosAdmin .comercioCard")).toHaveCount(2);
    await barra.getByRole("button", { name: "Inicio" }).click();
    // "Visitados hoy" -> solo los de hoy (2), con el cartel; el cartel vuelve
    // a los de toda la semana.
    await page.locator('#dashKpis [data-kpi="visitadosHoy"]').click();
    await expect(page.locator("#filtroEstadoComercios")).toHaveValue("visitadosHoy");
    await expect(page.locator("#filtrosEstadoComercios .activo")).toContainText("Visitados");
    await expect(page.locator("#listaComerciosAdmin .comercioCard")).toHaveCount(2);
    await page.locator(".cartelVisitadosHoy").click();
    await expect(page.locator("#filtroEstadoComercios")).toHaveValue("visitados");

    // "Pedidos" de la semana (sin cuenta) -> los pedidos de esta semana, y
    // "Productos distintos" -> Estadísticas de hoy.
    await barra.getByRole("button", { name: "Inicio" }).click();
    await page.locator('#dashKpis [data-kpi="semana"]').click();
    await expect(page.locator("#vistaPedidos")).toBeVisible();
    await expect(page.locator('.filtrosHistorialPedidos [data-periodo="semana"]')).toHaveAttribute("aria-checked", "true");
    await barra.getByRole("button", { name: "Inicio" }).click();
    await expect(page.locator("#dashDerechaHoy")).toContainText("Productos distintos");
    await page.locator("#dashDerechaHoy").click();
    await expect(estadisticas).toBeVisible();
    await expect(estadisticas.locator('[data-periodo="hoy"]')).toHaveClass(/activo/);
    // ...en "Lo más pedido" > Productos, que es lo que dice el cuadro.
    await expect(ranking.getByRole("tab", { name: "Productos" })).toHaveAttribute("aria-selected", "true");
    await expect(ranking).toBeInViewport();

    // "Ver todos" de "Pedidos de hoy" -> Historial en Hoy, aunque antes
    // quedara en otro período.
    await barra.getByRole("button", { name: "Inicio" }).click();
    await page.locator("#dashVerTodos").click();
    await expect(page.locator("#vistaPedidos")).toBeVisible();
    await expect(page.locator('.filtrosHistorialPedidos [data-periodo="hoy"]')).toHaveAttribute("aria-checked", "true");

    // "Sin visitar" muestra la lista entera aunque Historial haya dejado un
    // solo comercio a la vista.
    await page.evaluate(() => mostrarComercioIndividual("Kiosco Luna"));
    await expect(page.locator("#listaComerciosAdmin .comercioCard")).toHaveCount(1);
    await barra.getByRole("button", { name: "Inicio" }).click();
    await page.locator('#dashKpis [data-kpi="pendientes"]').click();
    await expect(page.locator("#filtroEstadoComercios")).toHaveValue("pendientes");
    await expect(page.locator("#listaComerciosAdmin .comercioCard")).toHaveCount(2);

    // Ficha de un comercio: sus números y productos llevan a sus pedidos.
    await barra.getByRole("button", { name: "Comercios" }).click();
    await page.locator("#filtroEstadoComercios").evaluate(filtro => { filtro.value = "todos"; filtro.dispatchEvent(new Event("change")); });
    await page.locator("#listaComerciosAdmin .comercioCard", { hasText: "Kiosco Luna" }).locator("h3").click();
    const ficha = page.locator(".modalFichaComercio");
    await expect(ficha.locator("#tituloFichaComercio")).toHaveText("Kiosco Luna");
    const numeros = ficha.locator(".fichaNumeros > div");
    await expect(numeros.first()).toHaveText(/3\s*pedidos/);
    await expect(numeros.first()).toHaveAttribute("role", "button");
    await capturar(page, "tocables-02-ficha-con-numeros");
    await numeros.first().click();
    await expect(ficha).toHaveCount(0);
    await expect(page.locator("#vistaPedidos")).toBeVisible();
    await expect(page.locator(".pastillaComercioHistorial")).toContainText("Kiosco Luna");
    await expect(page.locator('.filtrosHistorialPedidos [data-periodo="todos"]')).toHaveAttribute("aria-checked", "true");

    // "pedidos este mes" -> sus pedidos, en "Mes".
    await barra.getByRole("button", { name: "Comercios" }).click();
    await page.locator("#listaComerciosAdmin .comercioCard", { hasText: "Kiosco Luna" }).locator("h3").click();
    await numeros.filter({ hasText: "este mes" }).first().click();
    await expect(ficha).toHaveCount(0);
    await expect(page.locator("#vistaPedidos")).toBeVisible();
    await expect(page.locator(".pastillaComercioHistorial")).toContainText("Kiosco Luna");
    await expect(page.locator('.filtrosHistorialPedidos [data-periodo="mes"]')).toHaveAttribute("aria-checked", "true");
});

// Con cuenta: "Entregados" y "Entregados hoy" abren Terminados en su período
// (antes, Terminados de siempre).
test.describe("con cuenta", () => {
    test.use({ nube: true });

    test("tocables: entregados de Inicio abren Terminados en su período", async ({ page }, testInfo) => {
        const { registrarDistribuidora } = require("./recorridos");
        await registrarDistribuidora(page, testInfo);
        const barra = page.locator(".bottom-nav");
        const periodo = page.locator("#vistaPedidos select[aria-label=\"Filtrar historial por fecha\"]");
        for (const [kpi, valor] of [["entregados", "semana"], ["entregadosHoy", "hoy"]]) {
            await barra.getByRole("button", { name: "Inicio" }).click();
            await page.locator(`#dashKpis [data-kpi="${kpi}"]`).click();
            await expect(page.locator("#vistaPedidos")).toBeVisible();
            expect(await page.evaluate(() => window.seguimientoVendeFrio.etapa())).toBe("historial");
            await expect(periodo).toHaveValue(valor);
        }

        // "Cargados hoy" -> justo los pedidos que contó, con el cartel;
        // tocar el cartel vuelve a las pestañas.
        const { cargarPedido } = require("./recorridos");
        await cargarPedido(page, false);
        await barra.getByRole("button", { name: "Inicio" }).click();
        await expect(page.locator('#dashKpis [data-kpi="cargadosHoy"] strong')).toHaveText("1");
        await page.locator('#dashKpis [data-kpi="cargadosHoy"]').click();
        const cartel = page.locator(".cartelListaElegida");
        await expect(cartel).toContainText("Cargados hoy");
        await expect(page.locator("#listaVistaPedidos .tarjetaSeguimiento")).toHaveCount(1);
        await expect(page.locator("#filtrosEtapaPedidos .filtroEtapa.activo")).toHaveCount(0);
        await cartel.click();
        await expect(cartel).toHaveCount(0);
        await expect(page.locator("#filtrosEtapaPedidos .filtroEtapa.activo")).toHaveCount(1);
    });
});
