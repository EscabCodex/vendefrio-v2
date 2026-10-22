// VendeFrío - Ideas para la 1.0, tanda 1 "Confianza" (T60 a T64), con los
// emuladores de Firebase.
// 1. Versión nueva y cambios sin subir: el aviso de Inicio, la pantalla
//    "Sin subir" sin señal y cómo sube todo al volver la señal.
// 2. Recordatorio de respaldo: el aviso de Inicio y "Guardar".
// 3. Informar un problema: la hoja con lo técnico adjunto y la lista del dueño.
// 4. Archivar en vez de borrar: productos y comercios, con "Deshacer".
const path = require("path");
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, cargarPedido, abrirConfiguracionEn, irAPedidos } = require("./recorridos");

test.use({ nube: true });

async function irAInicio(page) {
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    await expect(page.locator("#pantallaMenu")).toBeVisible();
}

test("confianza: versión nueva y cambios sin subir", async ({ page, context }, testInfo) => {
    await registrarDistribuidora(page, testInfo);

    // Versión nueva: el aviso arriba de Inicio.
    await page.evaluate(() => window.confianzaVendeFrio.avisarVersionNueva());
    const version = page.locator("#avisoVersionNueva");
    await expect(version).toContainText("Hay una versión nueva");
    await expect(version.getByRole("button", { name: "Actualizar" })).toBeVisible();

    // Sin señal: el pedido (y la visita al comercio) quedan en el celular.
    await expect(page.locator("#indicadorNube")).toHaveAttribute("data-estado", "ok", { timeout: 20000 });
    // Con la máquina cargada, lo del registro puede tardar en subir: se
    // espera a que no quede nada pendiente antes de cortar la señal.
    // Lo guardado al registrar sale un instante después: tiene que quedar en
    // cero un par de segundos seguidos, no solo un momento.
    const pendientes = () => page.evaluate(() => window.nubeVendeFrio?.sincronizacion?.().sinSubir ?? 0);
    await expect(async () => {
        expect(await pendientes()).toBe(0);
        await page.waitForTimeout(2000);
        expect(await pendientes()).toBe(0);
    }).toPass({ timeout: 30000 });
    await context.setOffline(true);
    await page.evaluate(() => window.firebase.firestore().disableNetwork());
    await cargarPedido(page, false);
    await irAInicio(page);
    const sinSubir = page.locator("#avisoSinSubir");
    await expect(sinSubir).toContainText("2 cambios sin subir");
    await expect(sinSubir).toContainText("Se suben solos cuando vuelva la señal");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "confianza-01-inicio-avisos");

    await sinSubir.click();
    const pantalla = page.locator("#pantallaSinSubir");
    await expect(pantalla).toBeVisible();
    await expect(pantalla).toContainText(/Sin señal desde las \d\d:\d\d/);
    const fila = pantalla.locator(".pzFila", { hasText: "Pedido nuevo · Almacén Don Pepe" });
    await expect(fila).toContainText("3 u · $ 9.800");
    await expect(fila.locator(".pzChip")).toHaveText("Esperando");
    await expect(pantalla.locator(".pzFila", { hasText: "Comercio · Almacén Don Pepe" })).toBeVisible();
    await expect(pantalla.getByRole("button", { name: "Reintentar ahora" }).first()).toBeVisible();
    await capturar(page, "confianza-02-sin-subir");

    // Salir de la cuenta no deja: muestra qué falta.
    await abrirConfiguracionEn(page, "cuenta");
    await page.locator('[data-accion="salirCuenta"]').click();
    const todaviaNo = page.getByRole("alertdialog", { name: "Todavía no" });
    await expect(todaviaNo).toContainText("2 cambios sin subir");
    await todaviaNo.getByRole("button", { name: "Ver qué falta" }).click();
    await expect(pantalla).toBeVisible();

    // Vuelve la señal: "Reintentar ahora" y queda subido.
    await context.setOffline(false);
    await page.evaluate(() => window.firebase.firestore().enableNetwork());
    // La pantalla se redibuja sola al volver la señal: si el toque cae justo
    // en ese momento se pierde, así que se repite hasta que suba todo.
    await expect(async () => {
        await pantalla.locator("main").getByRole("button", { name: "Reintentar ahora" }).click({ timeout: 2000 }).catch(() => {});
        await expect(fila.locator(".pzChip")).toHaveText("Subido", { timeout: 3000 });
    }).toPass({ timeout: 40000 });
    await expect(pantalla).toContainText("Todo subido");
    await capturar(page, "confianza-03-todo-subido");

    await irAInicio(page);
    await expect(page.locator("#avisoSinSubir")).toHaveCount(0, { timeout: 15000 });
});

test("confianza: recordatorio de respaldo en Inicio", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await expect(page.locator("#indicadorNube")).toHaveAttribute("data-estado", "ok", { timeout: 20000 });

    const aviso = page.locator("#avisoRespaldo");
    await expect(aviso).toContainText("Todavía no guardaste un respaldo");
    await expect(aviso).toContainText("Descargalo en un toque, por si algo falla");

    // Hace 9 días: dice cuántos.
    await page.evaluate(() => {
        localStorage.setItem("vendefrio_ultimo_respaldo_nube", String(Date.now() - 9 * 86400000));
        actualizarDashboard();
    });
    await expect(aviso).toContainText("Hace 9 días que no guardás un respaldo");
    await aviso.scrollIntoViewIfNeeded();
    await capturar(page, "confianza-04-recordatorio-respaldo");

    const descarga = page.waitForEvent("download");
    await aviso.getByRole("button", { name: "Guardar" }).click();
    expect((await descarga).suggestedFilename()).toMatch(/^vendefrio-respaldo-nube-.*\.json$/);
    await page.getByRole("button", { name: "Entendido" }).click();
    await expect(page.locator("#avisoRespaldo")).toHaveCount(0);
});

test("confianza: informar un problema y verlo como dueño", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(() => console.error("Prueba: un error de ejemplo"));

    await abrirConfiguracionEn(page, "seguridad");
    await page.getByRole("button", { name: "Informar un problema" }).click();
    const hoja = page.getByRole("dialog", { name: "Informar un problema" });
    await expect(hoja).toContainText("¿Qué pasó?");
    await hoja.getByRole("textbox", { name: "Qué pasó" }).fill("No me deja marcar entregado el pedido de Súper Ruta 3, dice “La nube no lo permitió”.");
    await hoja.locator("#capturaProblema").setInputFiles(path.join(__dirname, "..", "icon-192.png"));
    await expect(hoja.locator("#vistaCapturaProblema")).toBeVisible();
    await expect(hoja).toContainText(/Versión .* · .* · 1 error de hoy · /);
    await capturar(page, "confianza-05-informar-problema");

    await hoja.getByRole("button", { name: "Enviar" }).click();
    const gracias = page.getByRole("alertdialog", { name: "¡Gracias! Ya lo mandaste" });
    await expect(gracias).toBeVisible();
    await gracias.getByRole("button", { name: "Listo" }).click();

    // El dueño lo ve en "Problemas informados".
    await page.getByRole("button", { name: "Problemas informados" }).click();
    const lista = page.locator("#pantallaProblemas");
    const fila = lista.locator(".pzFila", { hasText: "No me deja marcar entregado" });
    await expect(fila).toContainText("Jere");
    await expect(fila.locator(".pzChip")).toHaveText("Nuevo");
    await fila.click();
    const detalle = page.getByRole("dialog", { name: "Informó Jere" });
    await expect(detalle.locator(".pzCapturaGrande")).toBeVisible();
    await expect(detalle.getByRole("button", { name: "Copiar el informe" })).toBeVisible();
    await capturar(page, "confianza-06-problema-informado");
});

test("confianza: archivar productos y comercios con deshacer", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(() => agregarComercio({ nombre: "Kiosco La Esquina", direccion: "Belgrano 450" }));
    await cargarPedido(page, false);

    // Catálogo: tres puntos > Archivar, y "Deshacer".
    await page.locator(".bottom-nav").getByRole("button", { name: "Catálogo" }).click();
    await page.getByRole("button", { name: "Opciones de Palito bombón" }).click();
    await page.getByRole("button", { name: "Archivar" }).click();
    const deshacer = page.locator(".pzDeshacer");
    await expect(deshacer).toContainText("“Palito bombón” archivado");
    await expect(page.locator("#grillaCatalogo")).not.toContainText("Palito bombón");
    await capturar(page, "confianza-07-archivar");
    await deshacer.getByRole("button", { name: "Deshacer" }).click();
    await expect(page.locator("#grillaCatalogo")).toContainText("Palito bombón");

    // Archivado de verdad: se ve en "Archivados" y no en Nuevo pedido.
    await page.getByRole("button", { name: "Opciones de Palito bombón" }).click();
    await page.getByRole("button", { name: "Archivar" }).click();
    await page.getByRole("button", { name: /Archivados 1/ }).click();
    await expect(page.locator("#grillaCatalogo .itemCatalogo")).toHaveCount(1);
    await expect(page.locator("#grillaCatalogo")).toContainText("Archivado");
    await capturar(page, "confianza-08-archivados");
    await irAPedidos(page);
    await page.getByRole("button", { name: "Nuevo pedido" }).click();
    await page.locator(".tituloMarca", { hasText: "Frío Sur" }).click();
    await expect(page.locator(".listaProdutos .fila", { hasText: "Helado 1 kg" })).toBeVisible();
    await expect(page.locator(".listaProdutos .fila", { hasText: "Palito bombón" })).toHaveCount(0);

    // Comercios: "Archivar" con deshacer y la fila "Archivados".
    await page.evaluate(() => mostrarPantalla("comercios"));
    await page.locator("#listaComerciosAdmin .comercioCard", { hasText: "Kiosco La Esquina" }).click();
    await page.locator(".modalFichaComercio").getByRole("button", { name: "Más opciones" }).click();
    await page.getByRole("dialog", { name: "Más opciones de Kiosco La Esquina" }).getByRole("button", { name: "Archivar comercio" }).click();
    await expect(page.locator(".pzDeshacer.visible")).toContainText("“Kiosco La Esquina” archivado");
    await expect(page.locator("#listaComerciosAdmin .comercioCard", { hasText: "Kiosco La Esquina" })).toHaveCount(0);
    const filaArchivados = page.getByRole("button", { name: /Archivados \(1\)/ });
    await filaArchivados.click();
    const tarjeta = page.locator("#listaComerciosAdmin .comercioCard", { hasText: "Kiosco La Esquina" });
    await expect(tarjeta).toContainText("Archivado");
    await capturar(page, "confianza-09-comercios-archivados");
    await tarjeta.click();
    await page.locator(".modalFichaComercio").getByRole("button", { name: "Más opciones" }).click();
    await page.getByRole("button", { name: "Recuperar comercio" }).click();
    await expect(page.locator("#listaComerciosAdmin .comercioCard", { hasText: "Kiosco La Esquina" })).toContainText(/Pendiente|Visitado/);
});
