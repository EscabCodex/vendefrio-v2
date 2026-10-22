// VendeFrío - Bloque N "Mejorar lo que ya existe" (T110 a T123), con los
// emuladores de Firebase.
// 1. Faltante con motivo, "¿Con cuánto paga?" con vuelto, avisos por tarea
//    y "1 unidad".
// 2. Elegir varios con "Mover a otro paso", catálogo en lista, ronda de
//    WhatsApp con "Saltear" y la barra con el título al bajar.
// 3. A cobrar con filtros, cierre con "Contá la plata", estadísticas por
//    unidades, toda una lista de precios y el dictado que pregunta.
// 4. Rutas: paradas con lo que llevan, próxima parada y pines del mapa.
const { test, expect, capturar, deslizar } = require("./ayudas");
const { registrarDistribuidora, cargarPedido, irAPedidos, elegirComercio, abrirMas, abrirConfiguracionEn } = require("./recorridos");

test.use({ nube: true });

// La primera bajada de la nube puede pisar lo cargado justo después de
// registrarse: se vuelve a agregar lo que falte hasta que quede.
async function comercios(page, conGps) {
    await page.waitForTimeout(1500);
    await expect.poll(() => page.evaluate(gps => {
        const lugares = { "Kiosco Luna": [-34.601, -58.381], "Super Norte": [-34.606, -58.392], "Despensa Mary": [-34.596, -58.372] };
        Object.entries(lugares).forEach(([nombre, [lat, lng]], indice) => {
            if (buscarComercioPorNombre(nombre)) return;
            agregarComercio({
                nombre, direccion: ["Belgrano 45", "Mitre 900", "Moreno 550"][indice], telefono: "11 4000-111" + indice,
                ...(gps ? { lat, lng } : {})
            });
        });
        const nombres = (obtenerProductos()["Frío Sur"] || []).map(producto => producto.nombre);
        ["Cucurucho", "Torta helada", "Palito de agua"].forEach((nombre, i) => {
            if (!nombres.includes(nombre)) agregarProducto("Frío Sur", { nombre, precio: 500 + i * 900 });
        });
        return Object.keys(lugares).every(nombre => buscarComercioPorNombre(nombre)) &&
            ["Cucurucho", "Torta helada", "Palito de agua"].every(nombre => (obtenerProductos()["Frío Sur"] || []).some(producto => producto.nombre === nombre));
    }, conGps), { intervals: [500, 1000, 1000, 2000], timeout: 20000 }).toBe(true);
}

async function anotarVentanas(page) {
    await page.evaluate(() => {
        window.__abiertas = [];
        window.open = url => { window.__abiertas.push(String(url)); return null; };
    });
}

test("mejoras: faltante, vuelto, avisos por tarea y 1 unidad", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await comercios(page, false);
    await irAPedidos(page);

    // "1 unidad", no "1 unidades".
    await page.getByRole("button", { name: "Nuevo pedido" }).click();
    await elegirComercio(page, "Kiosco Luna");
    await page.locator(".listaProdutos .fila", { hasText: "Helado 1 kg" }).getByRole("button", { name: "Aumentar cantidad" }).click();
    await expect(page.locator("#palabraUnidadesPedido")).toHaveText("unidad");
    await page.locator("#generar").click();
    await page.locator("#modalPedido").click({ position: { x: 10, y: 10 } });

    for (const comercio of ["Almacén Don Pepe", "Super Norte"]) await cargarPedido(page, false, comercio);
    const tarjetas = page.locator(".tarjetaSeguimiento");

    // Faltante: motivo con botones.
    await tarjetas.filter({ hasText: "Almacén Don Pepe" }).click();
    const ficha = page.locator(".fichaPedido");
    await ficha.locator(".lineaChecklist", { hasText: "Helado" }).locator(".botonFaltante").click();
    const faltante = page.locator("#modalFaltantePedido");
    await expect(faltante).toContainText("Falta 1");
    await faltante.getByRole("button", { name: "Guardar faltante" }).click();
    await expect(faltante).toContainText("Tocá por qué falta");
    await faltante.getByRole("button", { name: "Vencido" }).click();
    await capturar(page, "mejoras-01-faltante");
    await faltante.getByRole("button", { name: "Guardar faltante" }).click();
    await expect(faltante).toBeHidden();
    await expect(ficha).toContainText("Vencido");
    await page.locator("#modalFichaPedido").click({ position: { x: 10, y: 10 } });
    await expect(ficha).toBeHidden();

    // ¿Con cuánto paga? y el vuelto.
    await tarjetas.filter({ hasText: "Super Norte" }).click();
    await expect(page.getByRole("button", { name: /Deslizá para marcar Entregado/ })).toBeVisible();
    await deslizar(page, "Deslizá para marcar Entregado");
    await page.getByRole("button", { name: "Efectivo" }).click();
    await expect(page.locator("#montoCobroPedido")).toHaveValue("$ 9.800");
    await page.getByRole("button", { name: "$ 10.000" }).click();
    await expect(page.locator("#vueltoCobroPedido")).toContainText("Le das de vuelto");
    await expect(page.locator("#vueltoCobroPedido")).toContainText("$ 200");
    await capturar(page, "mejoras-02-vuelto");
    await page.locator("#pagaConCobroPedido").fill("5000");
    await expect(page.locator("#vueltoCobroPedido")).toContainText("No alcanza");
    await page.getByRole("button", { name: "Justo" }).click();
    await expect(page.locator("#vueltoCobroPedido")).toContainText("Da justo");
    await page.getByRole("button", { name: "Guardar cobro" }).click();
    await expect(page.locator("#modalCobroPedido")).toBeHidden();
    await page.locator("#modalFichaPedido").click({ position: { x: 10, y: 10 }, timeout: 2000 }).catch(() => {});

    // Avisos: "¿Qué hacés vos?".
    await abrirConfiguracionEn(page, "avisos");
    const cobro = page.locator('[data-tarea-aviso="cobro"]');
    await expect(page.locator('[data-tarea-aviso="dueno"]')).toHaveAttribute("aria-pressed", "true");
    await cobro.click();
    await expect(cobro).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('.casillaAviso[value="entregado"]')).toBeChecked();
    await expect(page.locator('.casillaAviso[value="pedidoNuevo"]')).not.toBeChecked();
    await page.locator('[data-tarea-aviso="reparto"]').click();
    await expect(page.locator('.casillaAviso[value="preparado"]')).toBeChecked();
    await cobro.evaluate(boton => boton.scrollIntoView({ block: "center" }));
    await capturar(page, "mejoras-03-avisos-por-tarea");
});

test("mejoras: elegir varios, catálogo en lista y ronda de WhatsApp", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await comercios(page, false);
    await irAPedidos(page);
    for (const comercio of ["Almacén Don Pepe", "Kiosco Luna"]) await cargarPedido(page, false, comercio);

    // Elegir varios: una acción principal y "Mover a otro paso".
    const tarjeta = page.locator(".tarjetaSeguimiento", { hasText: "Kiosco Luna" });
    await expect(async () => {
        await tarjeta.scrollIntoViewIfNeeded({ timeout: 2000 });
        const caja = await tarjeta.boundingBox();
        await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(700);
        await page.mouse.up();
        await expect(page.locator(".pieTandaPedidos")).toBeVisible({ timeout: 1000 });
    }).toPass();
    await page.getByRole("checkbox", { name: /Almacén Don Pepe/ }).click();
    await page.getByRole("button", { name: /Mover a otro paso/ }).click();
    const mover = page.getByRole("dialog", { name: "Mover a otro paso" });
    await expect(mover).toContainText("Preparado (2)");
    await capturar(page, "mejoras-04-mover-a-otro-paso");
    await page.evaluate(() => window.piezas.cerrar());
    await page.getByRole("button", { name: "Cancelar" }).click();

    // Catálogo en lista.
    await page.locator(".bottom-nav").getByRole("button", { name: "Catálogo" }).click();
    await page.getByRole("button", { name: "Ver en lista" }).click();
    await expect(page.locator("#grillaCatalogo")).toHaveClass(/vistaLista/);
    await expect(page.locator("#vistaCatalogo")).toContainText("5 productos");
    await capturar(page, "mejoras-05-catalogo-en-lista");
    await page.getByRole("button", { name: "Ver en cuadros" }).click();
    await expect(page.locator("#grillaCatalogo")).not.toHaveClass(/vistaLista/);

    // Ronda de WhatsApp: "Enviar a…" fijo abajo y "Saltear".
    await abrirMas(page);
    await page.locator('.masAcceso[data-mas="whatsapp"]').click();
    await page.getByRole("button", { name: "Todos", exact: true }).click();
    await page.locator("#waEmpezar").click();
    await expect(page.locator(".waPieRonda")).toContainText("Siguiente: 1 de 4");
    await page.getByRole("button", { name: "Saltear" }).click();
    await expect(page.locator(".waPieRonda")).toContainText("Siguiente: 2 de 4");
    await expect(page.locator(".waSalteado")).toHaveCount(1);
    await capturar(page, "mejoras-06-ronda-saltear");
});

test("mejoras: a cobrar, cierre, estadísticas, lista de precios y dictado", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await comercios(page, false);
    await irAPedidos(page);
    for (const comercio of ["Kiosco Luna", "Super Norte"]) await cargarPedido(page, false, comercio);
    await page.evaluate(() => obtenerHistorial().forEach(pedido => window.nubeVendeFrio.entregarPedido(pedido.id, {})));
    await expect.poll(() => page.evaluate(() => window.saldosVendeFrio.cuentas().length)).toBe(2);

    // A cobrar: filtros, WhatsApp por fila y "Recordarles a todos".
    await anotarVentanas(page);
    await page.evaluate(() => window.saldosVendeFrio.abrirPantalla());
    const aCobrar = page.locator("#pantallaACobrar");
    await expect(aCobrar.locator(".filaACobrar")).toHaveCount(2);
    await aCobrar.getByRole("button", { name: "Mandar recordatorio a Kiosco Luna" }).click();
    expect(await page.evaluate(() => window.__abiertas[0])).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    // "De mi ruta hoy": la ruta armada en Rutas (o el día de visita).
    await page.evaluate(() => { rutaOrdenada = [buscarComercioPorNombre("Super Norte")]; });
    await aCobrar.getByRole("button", { name: "De mi ruta hoy" }).click();
    await expect(aCobrar.locator(".filaACobrar")).toHaveCount(1);
    await expect(aCobrar.locator(".filaACobrar")).toContainText("Super Norte");
    await capturar(page, "mejoras-07-a-cobrar");
    await aCobrar.getByRole("button", { name: "Todos", exact: true }).click();
    await aCobrar.getByRole("button", { name: /Recordarles a todos \(2\)/ }).click();
    const todos = page.getByRole("dialog", { name: "Recordarles a todos" });
    await todos.getByRole("button", { name: "Enviar" }).first().click();
    await expect(todos.locator(".pzChipOk")).toHaveText("Enviado");
    await todos.getByRole("button", { name: "Listo" }).click();

    // Cierre: "Contá la plata".
    await page.evaluate(() => window.cierreVendeFrio.abrir());
    await expect(page.locator("#esperadoCierre")).toHaveText("$ 0");
    await page.locator("#contadoCierre").fill("100");
    await expect(page.locator("#resultadoContadoCierre")).toHaveText("Te sobran $ 100");
    await page.locator("#contadoCierre").fill("0");
    await expect(page.locator("#resultadoContadoCierre")).toHaveText("Da justo. ¡Bien!");
    await capturar(page, "mejoras-08-cierre-conta-la-plata");
    await page.locator("#cerrarYMandarCierre").click();
    const mensaje = decodeURIComponent((await page.evaluate(() => window.__abiertas.at(-1))).split("text=")[1]);
    expect(mensaje).toContain("Entregados: 2 de 2 cargados");
    expect(mensaje).toContain("A cobrar: $ 19.600");

    // Estadísticas: Unidades y tocar una barra.
    await page.evaluate(() => window.abrirEstadisticas());
    await page.locator('[data-periodo="semana"]').click();
    await page.locator('[data-medida="unidades"]').click();
    await expect(page.locator(".statsGrafico h2")).toHaveText("Unidades por día");
    await expect(page.locator(".statsColumna.hoy .statsValor")).toHaveText("6");
    await page.locator(".statsColumna.hoy").click();
    await expect(page.locator("#detalleDiaEstadisticas")).toContainText("2 pedidos · 6 u");
    await page.locator(".statsGrafico").scrollIntoViewIfNeeded();
    await capturar(page, "mejoras-09-estadisticas");

    // Toda la lista de precios: −10% redondeado a $ 100.
    await page.evaluate(() => window.listasPreciosVendeFrio.abrirLista("Mayorista"));
    await page.locator("#porcentajeLista").fill("-10");
    await page.locator('[data-redondeo="100"]').click();
    await page.locator("#aplicarPorcentajeLista").click();
    await expect(page.getByRole("spinbutton", { name: "Precio Helado 1 kg en Mayorista" })).toHaveValue("4100");
    await capturar(page, "mejoras-10-toda-la-lista");
    await page.locator("#guardarTodaLista").click();
    expect(await page.evaluate(() => obtenerProductos()["Frío Sur"].find(producto => producto.nombre === "Helado 1 kg").precios.Mayorista)).toBe(4100);

    // Dictado: lo no entendido pregunta «¿cuál es?».
    await irAPedidos(page);
    await page.getByRole("button", { name: "Nuevo pedido" }).click();
    await page.getByRole("button", { name: "Más opciones del pedido" }).click();
    await page.getByRole("button", { name: "Dictar o pegar pedido" }).click();
    const dictado = page.locator(".ventanaDictado");
    await dictado.getByLabel("Texto del pedido").fill("3 helados de un kilo, 4 tortones, 1 sorbete");
    const pregunta = dictado.locator(".preguntaDictado", { hasText: "tortones" });
    await expect(pregunta).toContainText("¿Cuál es?");
    await capturar(page, "mejoras-11-dictado-pregunta");
    await pregunta.getByRole("button", { name: /Torta helada/ }).click();
    await expect(dictado.locator(".productoDictado")).toHaveCount(2);
    await expect(dictado.locator(".productoDictado").nth(1)).toContainText("4 ×Torta helada");
    await dictado.locator(".preguntaDictado", { hasText: "sorbete" }).getByRole("button", { name: "No lo tenemos" }).click();
    await expect(dictado.locator(".preguntaDictado")).toHaveCount(0);
    await dictado.getByRole("button", { name: "Agregar al pedido" }).click();
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("7");
});

test("mejoras: rutas con paradas y pines del mapa", async ({ page }, testInfo) => {
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: -34.600, longitude: -58.380 });
    await registrarDistribuidora(page, testInfo);
    await comercios(page, true);
    await irAPedidos(page);
    await cargarPedido(page, false, "Kiosco Luna");

    await abrirMas(page);
    await page.locator("#masAccesos").getByRole("button", { name: /Rutas/ }).click();
    await expect(page.locator("#mapaRuta.leaflet-container")).toBeVisible();
    await expect(page.locator(".pinRuta")).toHaveCount(3);
    // «Elegir» abre las paradas en «Comercios para esta ruta» (T136).
    await page.locator("#btnElegirRutas").click();
    await page.locator("#seleccionarTodosRuta").click();
    await expect(page.locator("#resumenPinesMapa")).toContainText("3 en la ruta");
    await page.getByRole("button", { name: "Volver al mapa" }).click();
    await page.locator("#btnOptimizarRuta").click();
    await page.locator("#modalAviso").getByRole("button", { name: "Entendido" }).click();

    // Paradas con distancia, minutos y lo que lleva; la próxima abajo.
    const paradas = page.locator(".paradaOrden");
    await expect(paradas).toHaveCount(3);
    // La ruta más corta empieza por Despensa Mary, aunque Kiosco Luna esté más cerca.
    await expect(paradas.first()).toHaveAttribute("data-nombre", "Despensa Mary");
    await expect(paradas.first()).toContainText("min");
    await expect(paradas.first()).toContainText("Sin pedido para entregar");
    await expect(paradas.filter({ hasText: "Kiosco Luna" })).toContainText("Lleva 3 u · $ 9.800");
    const proxima = page.locator("#proximaParadaRuta");
    await expect(proxima).toContainText("Próxima parada · 1 de 3");
    await expect(proxima).toContainText("Despensa Mary");
    await expect(proxima.getByRole("button", { name: "Hacer pedido" })).toBeVisible();
    await proxima.getByRole("button", { name: /Ya pasé/ }).click();
    await expect(proxima).toContainText("Próxima parada · 2 de 3");
    // La lista se abre con «Paradas» (T136).
    await page.locator("#btnParadasRutas").click();
    await expect(page.locator("#listaRutaOrdenada")).toBeVisible();
    await capturar(page, "mejoras-12-paradas-de-la-ruta");

    // T126: tocando la parada se carga su pedido y, al volver, queda tildada sola.
    const conPedido = await paradas.nth(1).getAttribute("data-nombre");
    await paradas.nth(1).locator(".pedidoParadaRuta").click();
    await expect(page.locator("#cliente")).toHaveValue(conPedido);
    const helado = page.locator(".listaProdutos .fila", { hasText: "Helado 1 kg" });
    if (!(await helado.isVisible())) await page.locator(".tituloMarca", { hasText: "Frío Sur" }).click();
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    await page.locator("#generar").click();
    const generado = page.locator("#modalPedido");
    await expect(generado).toBeVisible();
    await generado.click({ position: { x: 10, y: 10 } });
    await expect(generado).toBeHidden();
    await abrirMas(page);
    await page.locator("#masAccesos").getByRole("button", { name: /Rutas/ }).click();
    await expect(paradas.filter({ hasText: conPedido })).toHaveClass(/hecha/);
    await expect(proxima).toContainText("Próxima parada · 3 de 3");

    // Cambiar el orden con el teclado (con el dedo es arrastrar ≡).
    await page.locator("#btnParadasRutas").click();
    const segunda = await paradas.nth(1).getAttribute("data-nombre");
    await paradas.nth(1).locator(".agarreParada").focus();
    await page.keyboard.press("ArrowUp");
    await expect(paradas.first()).toHaveAttribute("data-nombre", segunda);
    await expect(page.locator(".encabezadoParadas")).toContainText("Orden a tu gusto");

    // Tocar un pin: sacarlo de la ruta y moverlo.
    await page.getByRole("button", { name: "Volver al mapa" }).click();
    await page.locator('.pinRuta[title="Despensa Mary"]').click();
    const opciones = page.getByRole("dialog", { name: "Opciones de Despensa Mary" });
    await expect(opciones).toContainText("Parada");
    await capturar(page, "mejoras-13-pin-opciones");
    await opciones.getByRole("button", { name: "Sacar de la ruta" }).click();
    await expect(paradas).toHaveCount(2);
    await expect(page.locator("#resumenPinesMapa")).toContainText("2 en la ruta");
    await page.locator('.pinRuta[title="Despensa Mary"]').click();
    await page.getByRole("dialog", { name: "Opciones de Despensa Mary" }).getByRole("button", { name: "Sumar a la ruta" }).click();
    await expect(paradas).toHaveCount(3);
    await expect(paradas.last()).toHaveAttribute("data-nombre", "Despensa Mary");

    await page.locator('.pinRuta[title="Super Norte"]').click();
    await page.getByRole("dialog", { name: "Opciones de Super Norte" }).getByRole("button", { name: "Mover el pin" }).click();
    await expect(page.locator("#barraMoverPin")).toBeVisible();
    await expect(page.locator("#barraMoverPin")).toContainText("Super Norte");
    await capturar(page, "mejoras-14-mover-pin");
    await page.locator("#cancelarMoverPin").click();
    await expect(page.locator("#barraMoverPin")).toBeHidden();
});

test("mejoras: nuevo pedido con «Quiere» o «Tiene» y el cartelito en Pedidos", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await comercios(page, false);
    await irAPedidos(page);
    await cargarPedido(page, false, "Super Norte");

    await page.getByRole("button", { name: "Nuevo pedido" }).click();
    await elegirComercio(page, "Kiosco Luna");
    const modo = page.locator("#modoPedido");
    await expect(modo.getByRole("button", { name: "Quiere" })).toHaveAttribute("aria-pressed", "true");
    await modo.getByRole("button", { name: "Tiene" }).click();
    await expect(modo.getByRole("button", { name: "Tiene" })).toHaveAttribute("aria-pressed", "true");
    await expect(modo).toContainText("Anotás lo que hay en la heladera");
    await page.locator(".listaProdutos .fila", { hasText: "Helado 1 kg" }).getByRole("button", { name: "Aumentar cantidad" }).click();
    await capturar(page, "mejoras-15-nuevo-pedido-tiene");
    await page.locator("#generar").click();
    await page.locator("#modalPedido").click({ position: { x: 10, y: 10 } });

    const tarjetas = page.locator(".tarjetaSeguimiento");
    await expect(tarjetas.filter({ hasText: "Kiosco Luna" }).locator(".badge.tipoTiene")).toHaveText("Tiene");
    await expect(tarjetas.filter({ hasText: "Super Norte" }).locator(".badge.tipoQuiere")).toHaveText("Quiere");
    await capturar(page, "mejoras-16-pedidos-tiene-y-quiere");
});
