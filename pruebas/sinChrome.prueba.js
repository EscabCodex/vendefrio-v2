// VendeFrío - Sin ventanas de Chrome (pedido del dueño, 2026-11-05): las
// listas para elegir (<select>) y los campos de fecha abren el menú y el
// calendario propios de la app, no los de Chrome. El valor se guarda igual
// que antes (avisan con change).
const { test, expect, capturar, usarSinCuenta } = require("./ayudas");

test("sin Chrome: listas y fechas con el estilo de la app", async ({ page }) => {
    await page.goto("/");
    await usarSinCuenta(page, "vendedor");
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(() => agregarComercio({ nombre: "Almacén Don Pepe", direccion: "Mitre 120" }));

    // 1. Una lista: el día de visita en "Datos del comercio".
    await page.evaluate(() => window.abrirDatosComercio("Almacén Don Pepe"));
    const dia = page.locator("#datoDia");
    await dia.scrollIntoViewIfNeeded();
    await dia.tap();
    const lista = page.locator(".menuElegir .menuFlotanteCaja");
    await expect(lista).toBeVisible();
    await expect(lista.getByRole("button", { name: "Sin día fijo" })).toHaveAttribute("aria-current", "true");
    await capturar(page, "sinchrome-01-lista-propia");
    await lista.getByRole("button", { name: "Martes" }).click();
    await expect(lista).toHaveCount(0);
    await expect(dia).toHaveValue("Martes");
    // La hoja de atrás sigue abierta (el menú solo cerró lo suyo).
    await expect(dia).toBeVisible();

    // El atrás del celular cierra solo el menú, un paso.
    await dia.tap();
    await expect(lista).toBeVisible();
    await page.evaluate(() => window.lugarVendeFrio.atrasDelCelular());
    await expect(lista).toHaveCount(0);
    await expect(dia).toBeVisible();

    // 2. Una fecha: la fecha de entrega de Nuevo pedido.
    await page.keyboard.press("Escape");
    await page.evaluate(() => window.piezas.cerrar());
    await page.evaluate(() => mostrarPantalla("pedido"));
    await page.getByRole("button", { name: "Más opciones del pedido" }).click();
    await page.getByRole("menu", { name: "Opciones del pedido" }).getByRole("button", { name: "Elegir fecha de entrega" }).click();
    const hojaFecha = page.getByRole("dialog", { name: "Fecha de entrega" });
    await hojaFecha.locator("#fechaEntregaElegida").tap();
    const calendario = page.locator(".calendarioPropio .menuFlotanteCaja");
    await expect(calendario).toBeVisible();
    await expect(calendario.locator(".calDia.hoy")).toHaveCount(1);
    // Los días de antes de hoy no se pueden elegir (min).
    const hoy = Number(await calendario.locator(".calDia.hoy").textContent());
    if (hoy > 1) await expect(calendario.locator(".calDia").first()).toBeDisabled();
    await capturar(page, "sinchrome-02-calendario-propio");
    await calendario.getByRole("button", { name: "Mes siguiente" }).click();
    await calendario.locator(".calDia", { hasText: /^10$/ }).click();
    await expect(calendario).toHaveCount(0);
    const esperado = await page.evaluate(() => {
        const d = new Date();
        const f = new Date(d.getFullYear(), d.getMonth() + 1, 10);
        return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-10`;
    });
    await expect(hojaFecha.locator("#fechaEntregaElegida")).toHaveValue(esperado);

    // 3. El color a elección de Apariencia: paleta propia.
    await page.evaluate(() => window.piezas.cerrar());
    await page.evaluate(() => mostrarPantalla("menu"));
    await page.locator(".bottom-nav").getByRole("button", { name: "Más", exact: true }).click();
    await page.locator('.configFila[data-config-seccion="ajustes"]').click();
    await page.locator('.configFila[data-config-seccion="apariencia"]').click();
    await page.locator(".muestraPropia").tap();
    const paleta = page.locator(".paletaPropia .paletaColor");
    await expect(paleta).toHaveCount(48);
    await paleta.nth(20).click();
    await expect(paleta).toHaveCount(0);
    await expect(page.locator('input[data-campo="acentoPropio"]')).toHaveValue("#7cb342");

    // 4. Editar pedido: sugerencias de comercios propias, sin la lista de Chrome.
    await page.evaluate(() => { agregarComercio({ nombre: "Almacén La Esquina", direccion: "Roca 5" }); mostrarPantalla("menu"); crearModalEdicionPedido().classList.remove("oculto"); });
    const comercio = page.locator("#comercioEditarPedido");
    await expect(comercio).not.toHaveAttribute("list", /.+/);
    await comercio.tap();
    await comercio.fill("alma");
    const sugerencias = page.locator("#sugerenciasComercioEditar");
    await expect(sugerencias.getByRole("option")).toHaveCount(2);
    await capturar(page, "sinchrome-03-comercios-editar-pedido");
    await sugerencias.getByRole("option", { name: "Almacén La Esquina" }).click();
    await expect(comercio).toHaveValue("Almacén La Esquina");
    await expect(sugerencias).toBeHidden();
});
