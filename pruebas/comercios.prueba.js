// VendeFrío - Repaso de diseño de Comercios (2026-10-28), en modo personal.
// 1. Lista: Todos / Pendientes / Visitados con el número adentro, buscador
//    abajo y "N comercios | + Agregar comercio".
// 2. Tarjeta: los datos abajo del nombre y "+ Agregar …" en el que falta,
//    que abre "Datos del comercio" en ese dato.
// 3. Una sola hoja "Datos del comercio" para agregar y editar, con el
//    horario por días y turnos.
// 4. Ficha centrada: 9 números, todos los datos tocables y el menú de los
//    tres puntitos (el atrás primero cierra el menú). Eliminar pregunta.
const { test, expect, capturar } = require("./ayudas");

async function entrar(page) {
    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Vendedor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
}

test("comercios: lista, tarjeta, datos del comercio y ficha", async ({ page }) => {
    await entrar(page);
    await page.evaluate(() => {
        agregarComercio({ nombre: "Almacén Don Pepe", direccion: "San Martín 123", telefono: "11 5555-1234" });
        agregarComercio({ nombre: "Kiosco Luna", direccion: "Mitre 900" });
        const luna = buscarComercioPorNombre("Kiosco Luna");
        actualizarComercioPorId(luna.id, { ultimaVisita: new Date().toLocaleDateString("es-AR") });
        mostrarPantalla("comercios");
    });

    // 1. Botones con número y buscador.
    const pantalla = page.locator("#pantallaComercios");
    const filtros = pantalla.locator("#filtrosEstadoComercios");
    await expect(filtros.getByRole("button", { name: /Todos/ })).toHaveText("Todos2");
    await expect(filtros.getByRole("button", { name: /Pendientes/ })).toHaveText("Pendientes1");
    await expect(filtros.getByRole("button", { name: /Visitados/ })).toHaveText("Visitados1");
    await expect(pantalla.locator("#cantidadComercios")).toHaveText("2 comercios");
    await filtros.getByRole("button", { name: /Pendientes/ }).click();
    await expect(filtros.getByRole("button", { name: /Pendientes/ })).toHaveAttribute("aria-pressed", "true");
    await expect(pantalla.locator(".comercioCard")).toHaveCount(1);
    await expect(pantalla.locator("#cantidadComercios")).toHaveText("1 comercio");
    await filtros.getByRole("button", { name: /Todos/ }).click();
    await pantalla.locator("#buscarComercio").fill("luna");
    await expect(pantalla.locator(".comercioCard")).toHaveCount(1);
    await pantalla.locator("#buscarComercio").fill("");

    // 2. La tarjeta: datos y chips; el teléfono que falta se agrega ahí.
    const luna = pantalla.locator(".comercioCard", { hasText: "Kiosco Luna" });
    await expect(luna.locator(".chipsComercio")).toContainText("Visitado");
    await expect(luna.locator(".chipsComercio")).toContainText("Nunca pidió");
    await expect(luna.locator(".chipsComercio")).toContainText("Visita hoy");
    await expect(luna.locator(".datosComercioGrid")).toContainText("Mitre 900");
    await capturar(page, "comercios-01-lista");
    await luna.getByRole("button", { name: "Agregar teléfono" }).click();
    const datos = page.getByRole("dialog", { name: "Datos del comercio" });
    await expect(datos).toBeVisible();
    await expect(page.locator(".modalFichaComercio")).toHaveCount(0);
    await expect(datos.locator("#modalTelefono")).toBeFocused();
    await datos.locator("#modalTelefono").fill("11 4444-2222");
    await datos.getByRole("button", { name: "Guardar" }).click();
    await expect(datos).toBeHidden();
    await expect(luna.locator(".datosComercioGrid")).toContainText("11 4444-2222");

    // 3. Horario por días y turnos: "Lun a sáb · 8 a 13 y 17 a 21".
    await luna.getByRole("button", { name: "Agregar horario" }).click();
    for (const dia of ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]) await datos.getByRole("button", { name: dia, exact: true }).click();
    await expect(datos.locator(".datosQueda")).toHaveText("Queda: Lun a sáb · 8 a 13 y 17 a 21");
    await datos.getByRole("switch", { name: "Turno tarde" }).uncheck();
    await datos.getByRole("combobox", { name: "Turno mañana: cierra" }).selectOption({ label: "14:00" });
    await expect(datos.locator(".datosQueda")).toHaveText("Queda: Lun a sáb · 8 a 14");
    await capturar(page, "comercios-02-datos-horario");
    await datos.getByRole("button", { name: "Guardar" }).click();
    await expect(luna.locator(".datosComercioGrid")).toContainText("Lun a sáb · 8 a 14");

    // La hoja vuelve a leer el horario guardado.
    const horario = await page.evaluate(() => window.datosComercioVendeFrio.leerHorario("Lun, mié y vie · 9:30 a 13"));
    expect(horario.dias).toEqual([true, false, true, false, true, false, false]);
    expect(horario.manana).toEqual({ desde: 570, hasta: 780, prendido: true });
    expect(horario.tarde.prendido).toBe(false);

    // Agregar comercio: la misma hoja, sin envases.
    await pantalla.getByRole("button", { name: "Agregar comercio" }).click();
    const nuevo = page.getByRole("dialog", { name: "Nuevo comercio" });
    await expect(nuevo.locator("#datoTiene")).toHaveCount(0);
    await expect(nuevo.getByRole("button", { name: "Usar dónde estoy ahora" })).toBeVisible();
    await nuevo.locator("#modalNombre").fill("Despensa Mary");
    await nuevo.locator("#datoContacto").fill("Mary");
    await nuevo.getByRole("button", { name: "Guardar" }).click();
    await expect(pantalla.locator(".comercioCard", { hasText: "Despensa Mary" })).toContainText("Agregar dirección");
    expect(await page.evaluate(() => buscarComercioPorNombre("Despensa Mary").contacto)).toBe("Mary");

    // 4. La ficha: centrada, 9 números y todos los datos.
    await luna.locator("h3").click();
    const ficha = page.locator(".modalFichaComercio");
    await expect(ficha.locator("#tituloFichaComercio")).toHaveText("Kiosco Luna");
    await expect(ficha.locator(".fichaNumeros > div")).toHaveCount(9);
    await expect(ficha.locator(".fichaDato")).toHaveCount(8);
    await expect(ficha.locator('.fichaDato[data-campo="nota"]')).toContainText("+ Agregar nota");
    await expect(ficha.getByRole("button", { name: "Actualizar con mi GPS" })).toBeVisible();
    const caja = await ficha.locator(".fichaComercioNueva").boundingBox();
    const barra = await page.locator(".bottom-nav").boundingBox();
    expect(caja.y).toBeGreaterThan(0);
    expect(caja.y + caja.height).toBeLessThanOrEqual(barra.y);
    await capturar(page, "comercios-03-ficha");

    // Tocar un dato abre la hoja arriba de la ficha; al guardar, se ve en la ficha.
    await ficha.getByRole("button", { name: "Agregar nota" }).click();
    await expect(datos.locator("#datoNota")).toBeFocused();
    await datos.locator("#datoNota").fill("Tocar timbre");
    await datos.getByRole("button", { name: "Guardar" }).click();
    await expect(ficha.locator('.fichaDato[data-campo="nota"]')).toContainText("Tocar timbre");

    // El menú de los tres puntitos: difumina más y el atrás lo cierra primero.
    await ficha.getByRole("button", { name: "Más opciones" }).click();
    const menu = ficha.getByRole("dialog", { name: "Más opciones de Kiosco Luna" });
    await expect(menu).toBeVisible();
    await expect(ficha).toHaveClass(/conMenu/);
    await expect(menu.locator(".fichaMenuItem").first()).toHaveText("Cargar pedido");
    await expect(menu.getByRole("link", { name: "WhatsApp" })).toBeVisible();
    await capturar(page, "comercios-04-ficha-menu");
    await page.evaluate(() => window.lugarVendeFrio.atrasDelCelular());
    await expect(menu).toBeHidden();
    await expect(ficha).toBeVisible();
    await expect(ficha).not.toHaveClass(/conMenu/);

    // Eliminar pregunta antes de borrar.
    await ficha.getByRole("button", { name: "Más opciones" }).click();
    await menu.getByRole("button", { name: "Eliminar comercio" }).click();
    const pregunta = page.getByRole("alertdialog", { name: "¿Eliminar Kiosco Luna?" });
    await pregunta.getByRole("button", { name: "Cancelar" }).click();
    await expect(ficha).toBeVisible();
    await ficha.getByRole("button", { name: "Más opciones" }).click();
    await menu.getByRole("button", { name: "Eliminar comercio" }).click();
    await pregunta.getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(ficha).toHaveCount(0);
    await expect(pantalla.locator(".comercioCard", { hasText: "Kiosco Luna" })).toHaveCount(0);

    // Desde otras pantallas: la misma hoja, con aviso al guardar.
    await page.evaluate(() => { window.__guardado = ""; window.abrirDatosComercio("Despensa Mary", "direccion", nombre => { window.__guardado = nombre; }); });
    await expect(datos.locator("#modalDireccion")).toBeFocused();
    await datos.locator("#modalDireccion").fill("Belgrano 45");
    await datos.getByRole("button", { name: "Guardar" }).click();
    expect(await page.evaluate(() => window.__guardado)).toBe("Despensa Mary");
    await expect(pantalla.locator(".comercioCard", { hasText: "Despensa Mary" })).toContainText("Belgrano 45");
});
