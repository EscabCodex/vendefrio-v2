// VendeFrío - Ideas para la 1.0, tanda 5 "Para el dueño" (T79 a T83).
// 1. Estadísticas contra el período anterior, "Se están enfriando" y el
//    mapa de ventas (modo personal, con pedidos de prueba).
// 2. Registro de cambios, metas del mes y resumen de la noche (nube).
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, cargarPedido, abrirMas } = require("./recorridos");

test.describe("personal", () => {
    test("dueño: comparativas, clientes que se enfrían y mapa de ventas", async ({ page }) => {
        await page.goto("/");
        await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
        await page.locator("#inicioNombrePersonal").fill("Jere");
        await page.locator("#inicioRolesPersonales").getByText("Vendedor").click();
        await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
        await expect(page.locator("#pantallaInicioSesion")).toBeHidden();

        await page.evaluate(() => {
            const dia = 86400000;
            const ahora = Date.now();
            agregarComercio({ nombre: "Kiosco Luna", direccion: "Belgrano 45", telefono: "11 4000-1111", lat: -34.6010, lng: -58.3810 });
            agregarComercio({ nombre: "Almacén Don Pepe", direccion: "San Martín 123", telefono: "11 5555-1234", lat: -34.6045, lng: -58.3790 });
            agregarComercio({ nombre: "Despensa Mary", direccion: "Mitre 900", telefono: "11 4444-2222", lat: -34.6080, lng: -58.3860 });
            const pedido = (comercio, haceDias, productos) => ({
                comercio, timestamp: ahora - haceDias * dia - 3600000,
                productos: productos.map(([marca, producto, cantidad, precio]) => ({ marca, producto, cantidad, precio }))
            });
            guardarHistorial([
                pedido("Kiosco Luna", 0, [["Frío Sur", "Helado 1 kg", 20, 4500]]),
                pedido("Almacén Don Pepe", 1, [["Frío Sur", "Helado 1 kg", 3, 4500]]),
                pedido("Kiosco Luna", 2, [["Frío Sur", "Palito bombón", 10, 800]]),
                pedido("Almacén Don Pepe", 9, [["Frío Sur", "Helado 1 kg", 2, 4500]]),
                pedido("Kiosco Luna", 10, [["Frío Sur", "Helado 1 kg", 2, 4500]]),
                pedido("Despensa Mary", 16, [["Frío Sur", "Helado 1 kg", 2, 4500]]),
                pedido("Despensa Mary", 23, [["Frío Sur", "Helado 1 kg", 2, 4500]]),
                pedido("Despensa Mary", 30, [["Frío Sur", "Helado 1 kg", 2, 4500]]),
                pedido("Despensa Mary", 37, [["Frío Sur", "Helado 1 kg", 2, 4500]])
            ]);
            window.abrirEstadisticas();
        });

        // Semana contra la anterior: 3 pedidos contra 2.
        const pantalla = page.locator("#pantallaEstadisticas");
        await pantalla.locator('[data-periodo="semana"]').click();
        const resumen = pantalla.locator(".statsResumen");
        await expect(resumen.locator(".statsResumenTop .statsDelta")).toHaveText("+1");
        await expect(resumen.locator(".statsVendido .statsCambio")).toBeVisible();

        // Se están enfriando: Despensa Mary pedía cada semana.
        const enfriando = pantalla.locator(".statsEnfriando");
        await expect(enfriando).toContainText("Despensa Mary");
        await expect(enfriando).toContainText("Pedía cada semana · hace 16 días que no");
        await expect(enfriando.getByRole("link", { name: "WhatsApp a Despensa Mary" })).toHaveAttribute("href", /^https:\/\/wa\.me\/5491144442222\?text=/);
        await page.evaluate(() => window.scrollTo(0, 0));
        await capturar(page, "dueno-01-estadisticas");

        // Mapa de ventas (Más): Kiosco Luna bien, los otros flojos este mes.
        await abrirMas(page);
        await page.locator("#masAccesos").getByRole("button", { name: /Mapa de ventas/ }).click();
        const mapa = page.locator("#pantallaMapaVentas");
        await expect(mapa).toBeVisible();
        await expect(mapa.locator(".leaflet-interactive")).toHaveCount(3);
        const flojos = mapa.locator("#verFlojos");
        await expect(flojos).toContainText(/comercios? flojos? este mes/);
        await capturar(page, "dueno-02-mapa-de-ventas");
        await flojos.click();
        await expect(page.getByRole("dialog", { name: "Comercios flojos" })).toContainText("Despensa Mary");
    });
});

test.describe("nube", () => {
    test.use({ nube: true });

    test("dueño: registro de cambios, metas y resumen de la noche", async ({ page }, testInfo) => {
        await registrarDistribuidora(page, testInfo);

        // Cambios: un precio (desde el catálogo), un producto archivado y un tope.
        await page.locator(".bottom-nav").getByRole("button", { name: "Catálogo" }).click();
        await page.getByRole("button", { name: "Opciones de Helado 1 kg" }).click();
        await page.getByRole("button", { name: "Editar datos" }).click();
        await page.locator(".precioCatalogoEdicion").fill("4800");
        await page.locator(".guardarEdicionCatalogo").click();
        await page.evaluate(() => {
            const palito = Object.values(obtenerProductos()).flat().find(producto => producto.nombre === "Palito bombón");
            archivarProductoPorId(palito.id, true);
            actualizarComercioPorNombre("Almacén Don Pepe", { topeDeuda: 20000 });
        });

        // Más > Registro de cambios.
        await abrirMas(page);
        await page.locator("#masAccesos").getByRole("button", { name: /Registro de cambios/ }).click();
        const registro = page.locator("#pantallaCambios");
        await expect(registro).toBeVisible();
        await expect(registro.locator(".grupoCambios h2").first()).toHaveText("Hoy");
        const filas = registro.locator(".filaCambio");
        await expect(filas).toHaveCount(3);
        await expect(filas.filter({ hasText: "Jere cambió un precio" })).toContainText("Helado 1 kg: de $ 4.500 a $ 4.800");
        await expect(filas.filter({ hasText: "Jere archivó un producto" })).toContainText("Palito bombón");
        await expect(filas.filter({ hasText: "Jere cambió el tope de deuda" })).toContainText("Almacén Don Pepe: de sin tope a $ 20.000");
        await capturar(page, "dueno-03-registro-de-cambios");
        await registro.getByRole("button", { name: "Comercios" }).click();
        await expect(filas).toHaveCount(1);

        // Metas: Jere vende $ 10.400 de $ 20.000 este mes.
        await page.evaluate(() => {
            const palito = Object.values(obtenerProductos()).flat().find(producto => producto.nombre === "Palito bombón");
            archivarProductoPorId(palito.id, false);
        });
        await cargarPedido(page, false);
        await page.evaluate(() => {
            const pedido = obtenerHistorial().find(item => item.comercio === "Almacén Don Pepe");
            window.nubeVendeFrio.entregarPedido(pedido.id, {});
        });
        await expect.poll(() => page.evaluate(() => obtenerHistorial().find(item => item.comercio === "Almacén Don Pepe").estado)).toBe("entregado");
        await page.evaluate(() => window.abrirEstadisticas());
        const metas = page.locator(".statsMetas");
        await metas.getByRole("button", { name: "Poner metas" }).click();
        const hoja = page.getByRole("dialog", { name: "Metas del mes" });
        await hoja.getByRole("spinbutton", { name: "Meta de Jere" }).fill("20000");
        await hoja.getByRole("button", { name: "Guardar metas" }).click();
        const fila = metas.locator(".filaMeta", { hasText: "Jere" });
        await expect(fila).toContainText("52 %");
        await expect(fila).toContainText("$ 10 mil de $ 20 mil");
        await expect(async () => { await metas.scrollIntoViewIfNeeded({ timeout: 1000 }); }).toPass();
        await capturar(page, "dueno-04-metas");

        // Resumen de la noche (acá se fuerza; solo sale a las 20:30).
        await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
        await page.evaluate(() => window.resumenNocheVendeFrio.revisar(true));
        const aviso = page.locator("#avisoResumenNoche");
        await expect(aviso).toContainText("Cerró el día: $ 10.400 vendidos");
        await expect(aviso).toContainText("1 pedido · 1 entregado · cobraste $ 0. Quedan $ 10.400 a cobrar.");
        await page.evaluate(() => window.scrollTo(0, 0));
        await capturar(page, "dueno-05-resumen-de-la-noche");
        await aviso.getByRole("button", { name: "Ver cierre del día" }).click();
        await expect(page.locator("#pantallaCierre")).toBeVisible();
    });
});
