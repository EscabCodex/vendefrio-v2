// VendeFrío - Ideas para la 1.0, tanda 2 "Vender mejor" (T65 a T69), con
// los emuladores de Firebase.
// 1. Visita sin pedido: desde la próxima parada y desde la ficha, con motivo,
//    y la tarjeta de Estadísticas.
// 2. Nuevo pedido que sugiere: "Lo de siempre" desplegable, favoritos
//    (manteniendo apretado el producto) y "¿Seguro?" ante una cantidad rara.
// 3. Ofertas con fecha y la ficha del comercio completa.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, cargarPedido, irAPedidos, elegirComercio } = require("./recorridos");

test.use({ nube: true });

async function irAInicio(page) {
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    await expect(page.locator("#pantallaMenu")).toBeVisible();
}

async function abrirFicha(page, nombre) {
    await page.evaluate(() => mostrarPantalla("comercios"));
    await page.locator("#listaComerciosAdmin .comercioCard", { hasText: nombre }).locator("h3").click();
    await expect(page.locator(".modalFichaComercio")).toBeVisible();
}

test("vender: visita sin pedido con motivo", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(() => agregarComercio({ nombre: "Kiosco La Esquina", direccion: "Belgrano 450" }));
    await irAInicio(page);

    // Próxima parada: "Visité, sin pedido".
    const parada = page.locator("#dashProximaParada");
    await expect(parada).toContainText("Almacén Don Pepe");
    await parada.getByRole("button", { name: "Visité, sin pedido" }).click();
    const hoja = page.getByRole("dialog", { name: "¿Por qué no hubo pedido?" });
    await expect(hoja).toContainText(/Almacén Don Pepe · hoy \d\d:\d\d/);
    const guardar = hoja.getByRole("button", { name: "Guardar visita" });
    await expect(guardar).toBeDisabled();
    await hoja.getByRole("button", { name: "Tenía mercadería" }).click();
    await expect(hoja.getByRole("button", { name: "Tenía mercadería" })).toHaveAttribute("aria-pressed", "true");
    await capturar(page, "vender-01-visita-sin-pedido");
    await guardar.click();
    await expect(hoja).toBeHidden();
    await expect(parada).toContainText("Kiosco La Esquina");

    // Desde la ficha: "Sin pedido" con otro motivo escrito.
    await abrirFicha(page, "Kiosco La Esquina");
    await page.locator(".modalFichaComercio").getByRole("button", { name: "Más opciones" }).click();
    await page.locator(".modalFichaComercio").getByRole("button", { name: "Sin pedido" }).click();
    await hoja.getByRole("button", { name: "Otro motivo (escribir)" }).click();
    await hoja.locator("#textoOtroMotivo").fill("Pidió que vuelva el jueves");
    await hoja.getByRole("button", { name: "Guardar visita" }).click();
    await expect(page.locator("#listaComerciosAdmin .comercioCard", { hasText: "Kiosco La Esquina" })).toContainText("Visitado");

    // Estadísticas: por qué no hubo pedido.
    await page.evaluate(() => abrirEstadisticas());
    const tarjeta = page.locator(".statsSinPedido");
    await expect(tarjeta).toContainText("2 en total");
    await expect(tarjeta).toContainText("Tenía mercadería");
    await expect(tarjeta).toContainText("Pidió que vuelva el jueves");
    // Las estadísticas se vuelven a dibujar cuando llega algo de la nube.
    await expect(async () => { await tarjeta.scrollIntoViewIfNeeded({ timeout: 1000 }); }).toPass();
    await capturar(page, "vender-02-estadisticas-sin-pedido");

    // Queda en la nube.
    await expect.poll(() => page.evaluate(async () => {
        const foto = await window.piezas.refNube().collection("visitas").get();
        return foto.size;
    })).toBe(2);
});

test("vender: lo de siempre, favoritos y ¿seguro?", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await cargarPedido(page, false);
    await cargarPedido(page, false);

    await irAPedidos(page);
    await page.getByRole("button", { name: "Nuevo pedido" }).click();
    await elegirComercio(page, "Almacén Don Pepe");
    await page.locator("#cliente").blur();

    const elegido = page.locator("#comercioElegidoPedido");
    await expect(elegido).toContainText("Almacén Don Pepe");
    await expect(elegido).toContainText(/Suele pedir cada \d+ días? · \$ 9\.800/);
    const siempre = page.locator("#loDeSiempre");
    await expect(siempre).toContainText("2 productos · 3 u · $ 9.800");
    // T94: ya no está "Lo que más compra"; "Lo de siempre" se despliega.
    await expect(page.locator("#loQueMasCompra")).toHaveCount(0);
    await expect(siempre.locator("#listaLoDeSiempre")).toBeHidden();
    await siempre.getByRole("button", { name: "Ver lo de siempre" }).click();
    const filas = siempre.locator(".pzSiempreFila");
    await expect(filas).toHaveCount(2);
    await expect(filas.filter({ hasText: "Helado 1 kg" })).toContainText("2");
    await expect(filas.filter({ hasText: "Palito bombón" })).toContainText("1");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "vender-03-nuevo-pedido-sugerido");
    await siempre.getByRole("button", { name: "Usar" }).click();
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("3");
    await expect(siempre).toHaveCount(0);

    // Favorito: manteniendo apretado el producto (T94).
    const palitoLista = page.locator(".listaProdutos .fila", { hasText: "Palito bombón" });
    await palitoLista.locator(".nombreTexto").dispatchEvent("pointerdown", { button: 0, clientX: 40, clientY: 40 });
    const opciones = page.getByRole("dialog", { name: "Palito bombón" });
    await expect(opciones).toBeVisible();
    await opciones.getByRole("button", { name: "Marcar como favorito" }).click();
    await expect(page.locator(".listaProdutos .fila").first()).toContainText("Palito bombón");
    await expect(palitoLista.locator(".estrellaFavorito")).toBeVisible();

    // Una cantidad rara: pregunta antes de guardar.
    const helado = page.locator(".listaProdutos .fila", { hasText: "Helado 1 kg" });
    for (let i = 0; i < 10; i++) await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    await expect(helado.locator("select")).toHaveValue("12");
    await page.locator("#generar").click();
    const seguro = page.getByRole("alertdialog", { name: "¿Seguro que son 12?" });
    await expect(seguro).toContainText("Almacén Don Pepe suele llevar 2 de Helado 1 kg");
    await expect(seguro.locator(".pzOjo")).toContainText("12");
    await capturar(page, "vender-04-seguro");
    await seguro.getByRole("button", { name: "Cambiar a 2" }).click();
    await expect(page.locator("#modalPedido")).toBeVisible();
    await expect(page.locator("#modalPedido")).toContainText("Helado 1 kg");
});

test("vender: ofertas con fecha y ficha del comercio completa", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);

    // Catálogo: tres puntos > Poner en oferta.
    await page.locator(".bottom-nav").getByRole("button", { name: "Catálogo" }).click();
    await page.getByRole("button", { name: "Opciones de Palito bombón" }).click();
    await page.getByRole("button", { name: "Poner en oferta" }).click();
    const hoja = page.getByRole("dialog", { name: "Oferta de Palito bombón" });
    await hoja.locator("#precioOferta").fill("680");
    await hoja.getByRole("button", { name: "Poner en oferta" }).click();
    const tarjeta = page.locator("#grillaCatalogo .itemCatalogo", { hasText: "Palito bombón" });
    await expect(tarjeta.locator(".pzTachado")).toHaveText("$ 800");
    await expect(tarjeta.locator(".pzPrecioPromo")).toHaveText("$ 680");
    await expect(tarjeta.locator(".pzChipPromo")).toHaveText(/^Promo hasta el (lunes|martes|miércoles|jueves|viernes|sábado|domingo)$/);
    await capturar(page, "vender-05-catalogo-oferta");

    // Nuevo pedido: el precio de oferta y el total.
    await irAPedidos(page);
    await page.getByRole("button", { name: "Nuevo pedido" }).click();
    await page.locator("#cliente").fill("Almacén Don Pepe");
    await page.locator(".tituloMarca", { hasText: "Frío Sur" }).click();
    const palito = page.locator(".listaProdutos .fila", { hasText: "Palito bombón" });
    await expect(palito.locator(".pzChipPromo")).toBeVisible();
    await palito.getByRole("button", { name: "Aumentar cantidad" }).click();
    await expect(page.locator("#totalPlataPedido")).toHaveText("$ 680");

    // Ficha del comercio: horario, día, contacto, nota y envases.
    await abrirFicha(page, "Almacén Don Pepe");
    const ficha = page.locator(".modalFichaComercio");
    // Los botones van en el menú de los tres puntitos.
    await ficha.getByRole("button", { name: "Más opciones" }).click();
    await expect(ficha.getByRole("dialog", { name: "Más opciones de Almacén Don Pepe" }).getByRole("button", { name: "Sin pedido" })).toBeVisible();
    await ficha.getByRole("button", { name: "Cerrar opciones" }).click();
    // Cada dato que falta se agrega tocándolo: abre "Datos del comercio" en ese dato.
    await ficha.getByRole("button", { name: "Agregar horario" }).click();
    const datos = page.getByRole("dialog", { name: "Datos del comercio" });
    for (const dia of ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]) await datos.getByRole("button", { name: dia, exact: true }).click();
    await expect(datos.locator(".datosQueda")).toHaveText("Queda: Lun a sáb · 8 a 13 y 17 a 21");
    await datos.locator("#datoDia").selectOption("Martes");
    await datos.locator("#datoContacto").fill("Pepe Gómez");
    await datos.locator("#datoNota").fill("Tocar timbre. Descargar por el costado.");
    await datos.locator("#datoTiene").fill("6");
    await datos.locator("#datoDevolvio").fill("4");
    await datos.getByRole("button", { name: "Guardar" }).click();
    await expect(ficha.locator(".fichaDatos")).toContainText("San Martín 123");
    await expect(ficha.locator(".fichaDatos")).toContainText("Pepe Gómez");
    await expect(ficha.locator(".fichaDatos")).toContainText("Lun a sáb · 8 a 13 y 17 a 21");
    await expect(ficha.locator(".fichaDatos")).toContainText("Martes");
    await expect(ficha.locator(".fichaDatos")).toContainText("Tiene 6 cajones · devolvió 4");
    await ficha.evaluate(el => { el.scrollTop = 0; el.querySelector(".fichaContenido").scrollTop = 0; });
    await capturar(page, "vender-06-ficha-completa");
    await page.keyboard.press("Escape");

    // Inicio: el horario en la próxima parada.
    await irAInicio(page);
    const parada = page.locator("#dashProximaParada");
    await expect(parada.locator(".chipHorario")).toHaveText("Lun a sáb · 8 a 13 y 17 a 21");
    await expect(parada.getByRole("button", { name: "Visité, sin pedido" })).toBeVisible();
    await parada.evaluate(el => el.scrollIntoView({ block: "center" }));
    await capturar(page, "vender-07-inicio-parada");
});

// Próxima parada: "Actualizar mi ubicación" vuelve a buscar dónde estás y
// elige otra vez la parada más cercana.
test("vender: próxima parada se actualiza con mi ubicación", async ({ page }, testInfo) => {
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: -34.6, longitude: -58.4 });
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(() => {
        agregarComercio({ nombre: "Kiosco Norte", direccion: "Norte 100", lat: -34.6, lng: -58.4, origenGps: "gps" });
        agregarComercio({ nombre: "Kiosco Sur", direccion: "Sur 200", lat: -34.65, lng: -58.4, origenGps: "gps" });
    });
    await irAInicio(page);

    const parada = page.locator("#dashProximaParada");
    await expect(parada).toContainText("Kiosco Norte");
    const ubicar = parada.getByRole("button", { name: "Actualizar mi ubicación" });
    await expect(ubicar).toBeVisible();

    // Me muevo cerca del otro comercio y toco el botón.
    await page.context().setGeolocation({ latitude: -34.6495, longitude: -58.4 });
    await ubicar.click();
    await expect(parada).toContainText("Kiosco Sur");
    await expect(parada).toContainText("a 60 m");
    await expect(parada.getByRole("button", { name: "Actualizar mi ubicación" })).toBeVisible();
    await capturar(page, "vender-08-actualizar-ubicacion");
});
