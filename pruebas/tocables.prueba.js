// VendeFrío - Números y tarjetas que llevan a su detalle (repasada).
// Lo que parecía solo información ahora se toca y lleva a lo concreto:
// "Vendido hoy" a Estadísticas de hoy, "23 de 80 comercios visitados" a los
// visitados, los números de Estadísticas a su gráfico o a "Lo más pedido",
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
    await expect(estadisticas.locator(".statsResumen strong").first()).toHaveText("2");
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(0);
    await capturar(page, "tocables-01-estadisticas-de-hoy");

    // "unidades" -> "Lo más pedido" en Productos; "Vendido" -> el gráfico en plata.
    await estadisticas.locator(".statsNumeros > div").nth(1).click();
    const ranking = estadisticas.locator(".statsRanking");
    await expect(ranking.getByRole("tab", { name: "Productos" })).toHaveAttribute("aria-selected", "true");
    await expect(ranking).toBeInViewport();
    await estadisticas.locator(".statsVendido").click();
    await expect(estadisticas.locator('.statsGrafico [data-medida="plata"]')).toHaveAttribute("aria-pressed", "true");
    await expect(estadisticas.locator(".statsGrafico")).toBeInViewport();

    // Un producto del ranking -> el Catálogo en su marca, con el producto a la vista.
    await estadisticas.locator(".statsNumeros > div").nth(1).click();
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
    await expect(page.locator("#pantallaHistorial")).toBeVisible();
    await expect(page.locator("#textoFiltroHistorial")).toHaveText("Mostrando solamente pedidos de: Kiosco Luna");

    // "Esta semana" (comparada con la anterior) -> los pedidos de esta semana.
    await page.evaluate(() => window.abrirEstadisticas());
    await estadisticas.locator(".statsComparativa .statsFila").first().click();
    await expect(page.locator("#pantallaHistorial")).toBeVisible();
    await expect(page.locator("#filtroFechaHistorial")).toHaveValue("semana");

    // Inicio: "2 de 4 comercios visitados" -> Comercios en "Visitados".
    await barra.getByRole("button", { name: "Inicio" }).click();
    await expect(inicio).toBeVisible();
    await expect(page.locator("#dashSemanaVisitados")).toContainText("2 de 4 comercios visitados");
    await page.locator("#dashSemanaVisitados").click();
    await expect(page.locator("#pantallaComercios")).toBeVisible();
    await expect(page.locator("#filtroEstadoComercios")).toHaveValue("visitados");
    await expect(page.locator("#listaComerciosAdmin .comercioCard")).toHaveCount(2);

    // "vendido" de la semana -> Estadísticas de la semana.
    await barra.getByRole("button", { name: "Inicio" }).click();
    await page.locator('[data-dashboard-accion="vendidoSemana"]').click();
    await expect(estadisticas).toBeVisible();
    await expect(estadisticas.locator('[data-periodo="semana"]')).toHaveClass(/activo/);

    // Ficha de un comercio: sus números y productos llevan a sus pedidos.
    await barra.getByRole("button", { name: "Comercios" }).click();
    await page.locator("#filtroEstadoComercios").evaluate(filtro => { filtro.value = "todos"; filtro.dispatchEvent(new Event("change")); });
    await page.locator("#listaComerciosAdmin .comercioCard", { hasText: "Kiosco Luna" }).click();
    const ficha = page.locator(".modalFichaComercio");
    await expect(ficha.locator("#tituloFichaComercio")).toHaveText("Kiosco Luna");
    const numeros = ficha.locator(".fichaNumeros > div");
    await expect(numeros.first()).toHaveText(/3\s*pedidos/);
    await expect(numeros.first()).toHaveAttribute("role", "button");
    await capturar(page, "tocables-02-ficha-con-numeros");
    await numeros.first().click();
    await expect(ficha).toHaveCount(0);
    await expect(page.locator("#pantallaHistorial")).toBeVisible();
    await expect(page.locator("#textoFiltroHistorial")).toHaveText("Mostrando solamente pedidos de: Kiosco Luna");
});
