// VendeFrío - Etapa 8 «Más simple para todos» (T95 a T98), con los
// emuladores de Firebase.
// 1. Marcas desplegables: cerradas, se abren tocándolas, se recuerdan y se
//    abren solas al buscar (T97).
// 2. El botón flotante ⋯ junta repetir, dictar, escanear y lo demás (T95).
// 3. Un cambio de mercadería con motivo, la fecha de entrega y un precio
//    solo para este pedido; se ven en el mensaje, la ficha y la nube
//    (T96, T98).
// 4. Un empleado que no ve la plata no puede cambiar precios.
// 5. Pedidos con tres pestañas y "Otros".
// 6. La ficha del comercio con un solo botón "Más opciones".
// 7. Inicio con "¿Qué querés hacer?", Más en tres grupos y el Catálogo con
//    "Productos" y "Editar marcas".
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, cargarPedido, irAPedidos, elegirComercio, entrarComoEmpleado, abrirMas, abrirAjustes, abrirConfiguracionEn } = require("./recorridos");

test.use({ nube: true });

test("simple: marcas, botón ⋯, cambios, fecha y precio del pedido", async ({ page, browser }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await cargarPedido(page, false);
    await page.evaluate(() => {
        agregarMarca("Los Aromos");
        agregarProducto("Los Aromos", { nombre: "Tapas de hojaldre", precio: 1400 });
        agregarProducto("Los Aromos", { nombre: "Tapas criolla", precio: 1400 });
    });

    await irAPedidos(page);
    await page.getByRole("button", { name: "Nuevo pedido" }).click();

    // 1. Marcas desplegables (T97).
    const frioSur = page.locator('.marca[data-marca="Frío Sur"]');
    const aromos = page.locator('.marca[data-marca="Los Aromos"]');
    await expect(frioSur).toHaveClass(/cerrada/);
    await expect(aromos).toHaveClass(/cerrada/);
    await expect(aromos.locator(".fila").first()).toBeHidden();
    await aromos.locator(".tituloMarca").click();
    await expect(aromos.locator(".tituloMarca")).toHaveAttribute("aria-expanded", "true");
    await expect(aromos.locator(".fila", { hasText: "Tapas criolla" })).toBeVisible();
    // Se recuerda al volver a dibujar la lista.
    await page.evaluate(() => renderizarPedido());
    await expect(aromos.locator(".fila", { hasText: "Tapas criolla" })).toBeVisible();
    await expect(frioSur.locator(".fila").first()).toBeHidden();
    // Al buscar, la marca se abre sola.
    await page.locator(".buscadorPedido").fill("palito");
    await expect(frioSur.locator(".fila", { hasText: "Palito bombón" })).toBeVisible();
    await page.locator(".buscadorPedido").fill("");
    await expect(frioSur.locator(".fila").first()).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "simple-01-marcas-desplegables");

    // 2. El botón ⋯: ya no están los botones sueltos de arriba (T95).
    await expect(page.locator("#pantallaPedido").getByRole("button", { name: "Repetir último pedido" })).toHaveCount(0);
    await expect(page.locator("#pantallaPedido").getByRole("button", { name: "Dictar o pegar pedido" })).toHaveCount(0);
    await expect(page.locator("#reset")).toBeHidden();
    const masOpciones = page.getByRole("button", { name: "Más opciones del pedido" });
    await expect(masOpciones).toBeVisible();
    // No tapa "Guardar pedido".
    const fab = await masOpciones.boundingBox();
    const guardar = await page.locator("#generar").boundingBox();
    expect(fab.y + fab.height).toBeLessThanOrEqual(guardar.y);
    await elegirComercio(page, "Almacén Don Pepe");
    await page.locator("#cliente").blur();
    await masOpciones.click();
    const opciones = page.getByRole("dialog", { name: "Opciones del pedido" });
    for (const nombre of ["Repetir último pedido", "Dictar o pegar pedido", "Escanear código de barras", "Anotar un cambio", "Elegir fecha de entrega", "Vaciar pedido"]) {
        await expect(opciones.getByRole("button", { name: nombre })).toBeVisible();
    }
    await capturar(page, "simple-02-boton-mas-opciones");

    // 3. Un cambio con motivo, sin escribir (T96).
    await opciones.getByRole("button", { name: "Anotar un cambio" }).click();
    const hojaCambio = page.getByRole("dialog", { name: "Anotar un cambio" });
    await hojaCambio.getByLabel("Producto").selectOption({ label: "Helado 1 kg" });
    await hojaCambio.getByRole("button", { name: "Uno más" }).click();
    await hojaCambio.getByRole("button", { name: "Roto" }).click();
    await expect(hojaCambio.getByRole("button", { name: "Roto" })).toHaveAttribute("aria-pressed", "true");
    await capturar(page, "simple-03-anotar-cambio");
    await hojaCambio.getByRole("button", { name: "Guardar cambio" }).click();
    const cambios = page.locator("#cambiosPedido");
    await expect(cambios).toContainText("2 × Helado 1 kg");
    await expect(cambios).toContainText("Roto");
    await expect(page.locator("#obs")).toHaveValue("");

    // Fecha de entrega.
    await masOpciones.click();
    await opciones.getByRole("button", { name: "Elegir fecha de entrega" }).click();
    const hojaFecha = page.getByRole("dialog", { name: "Fecha de entrega" });
    await hojaFecha.getByRole("button", { name: "Mañana", exact: true }).click();
    await hojaFecha.getByRole("button", { name: "Guardar fecha" }).click();
    await expect(page.locator("#fechaEntregaPedido")).toContainText("Entregar mañana");

    // Precio solo para este pedido, tocando el precio (T98).
    await frioSur.locator(".tituloMarca").click();
    const helado = frioSur.locator(".fila", { hasText: "Helado 1 kg" });
    await helado.getByRole("button", { name: "Cambiar el precio de Helado 1 kg para este pedido" }).click();
    const hojaPrecio = page.getByRole("dialog", { name: "Precio para este pedido" });
    await expect(hojaPrecio).toContainText("de lista $ 4.500");
    await hojaPrecio.getByLabel("Precio por unidad").fill("4000");
    await hojaPrecio.getByRole("button", { name: "Guardar precio" }).click();
    await expect(helado.locator(".precioEspecial")).toHaveText("$ 4.000");
    await expect(helado.locator(".pzTachado")).toHaveText("$ 4.500");
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    await expect(page.locator("#totalPlataPedido")).toHaveText("$ 8.000");
    await helado.evaluate(fila => fila.scrollIntoView({ block: "center" }));
    await capturar(page, "simple-04-precio-y-cambios");

    // Al guardar: el mensaje lo dice todo y la ficha lo muestra.
    await page.locator("#generar").click();
    const generado = page.locator("#modalPedido");
    await expect(generado).toBeVisible();
    await expect(generado).toContainText("Helado 1 kg x2 (precio especial $ 4.000)");
    await expect(generado).toContainText("CAMBIOS");
    await expect(generado).toContainText("Helado 1 kg x2 (roto)");
    await expect(generado).toContainText("ENTREGAR MAÑANA");
    await generado.click({ position: { x: 10, y: 10 } });
    await expect(generado).toBeHidden();

    // Lo de este pedido no queda para el siguiente.
    await irAPedidos(page);
    await page.getByRole("button", { name: "Nuevo pedido" }).click();
    await expect(page.locator("#cambiosPedido")).toHaveCount(0);
    await expect(page.locator("#fechaEntregaPedido")).toHaveCount(0);
    await expect(frioSur.locator(".precioEspecial")).toHaveCount(0);

    await page.getByRole("button", { name: "Volver a Pedidos" }).click();
    await expect(page.locator("#vistaPedidos")).toBeVisible();
    await page.locator(".tarjetaSeguimiento", { hasText: "Almacén Don Pepe" }).first().click();
    const ficha = page.locator(".fichaPedido");
    await expect(ficha.locator(".seccionDetallesPedido")).toContainText("Entregar mañana");
    await expect(ficha.locator(".seccionDetallesPedido")).toContainText("2 × Helado 1 kg");
    await expect(ficha.locator(".seccionDetallesPedido")).toContainText("Roto");
    await expect(ficha.locator(".datosFichaPedido")).toContainText("$ 8.000");
    await ficha.locator(".seccionDetallesPedido").scrollIntoViewIfNeeded();
    await capturar(page, "simple-05-ficha-con-cambios");
    // Los cuatro pasos del pedido, cada uno con su botón (pedido del dueño).
    const pasos = ficha.locator(".pasoFicha");
    await expect(pasos).toHaveCount(4);
    await expect(pasos.nth(0)).toContainText("Paso 1: Armá el pedido");
    await expect(pasos.nth(1)).toContainText("Paso 2: Salí a repartir");
    await expect(pasos.nth(1).getByRole("button", { name: "Salir a repartir" })).toBeVisible();
    await expect(pasos.nth(2)).toContainText("Paso 3: Entregalo");
    await expect(pasos.nth(2).locator(".deslizador")).toBeVisible();
    await expect(pasos.nth(3)).toContainText("Paso 4: Registrá el cobro");
    await expect(pasos.nth(3)).toContainText("Se registra después de entregar.");
    await pasos.nth(1).evaluate(paso => paso.scrollIntoView({ block: "center" }));
    await capturar(page, "simple-05b-pasos-del-pedido");

    // En la nube: el pedido con su precio y los detalles aparte.
    await expect.poll(() => page.evaluate(async () => {
        const foto = await window.piezas.refNube().collection("detallesPedido").get();
        return foto.docs.map(doc => doc.data().cambios.length + "|" + doc.data().fechaEntrega.length);
    })).toEqual(["1|10"]);
    const linea = await page.evaluate(async () => {
        const foto = await window.piezas.refNube().collection("pedidos").get();
        const pedido = foto.docs.map(doc => doc.data()).find(datos => datos.productos.some(item => item.precioCambiado));
        const item = pedido.productos.find(actual => actual.precioCambiado);
        return [item.producto, item.precio, item.precioLista].join("|");
    });
    expect(linea).toBe("Helado 1 kg|4000|4500");
    await ficha.getByRole("button", { name: "Cerrar", exact: true }).last().click();
    await expect(ficha).toBeHidden();

    // 5. Pedidos: tres pestañas y "Otros" con las demás.
    const etapas = page.locator("#filtrosEtapaPedidos");
    await expect(etapas.getByRole("tab")).toHaveText([/Para armar/, /Para entregar/, /Terminados/, /Otros/]);
    await etapas.getByRole("tab", { name: /Otros/ }).click();
    const otros = page.getByRole("dialog", { name: "Otros pedidos" });
    await expect(otros.getByRole("button")).toHaveText([/A cobrar/, /Incidencias/, /Cancelados/]);
    await capturar(page, "simple-06-otros-pedidos");
    await otros.getByRole("button", { name: /Cancelados/ }).click();
    await expect(otros).toBeHidden();
    await expect(etapas.getByRole("tab", { name: /Cancelados/ })).toHaveAttribute("aria-selected", "true");
    await etapas.getByRole("tab", { name: /Para armar/ }).click();
    await expect(page.locator(".tarjetaSeguimiento", { hasText: "Almacén Don Pepe" }).first()).toBeVisible();
    await capturar(page, "simple-07-pestanas-pedidos");

    // 6. Ficha del comercio: un solo botón de tres puntitos con todo adentro
    // (Cargar pedido primero y resaltado; Eliminar al final, en rojo).
    await page.evaluate(() => window.abrirFichaComercio("Almacén Don Pepe"));
    const fichaComercio = page.locator(".modalFichaComercio");
    await expect(fichaComercio.locator(".fichaMenu")).toBeHidden();
    await fichaComercio.getByRole("button", { name: "Más opciones" }).click();
    await expect(fichaComercio).toHaveClass(/conMenu/);
    const masOpcionesComercio = page.getByRole("dialog", { name: "Más opciones de Almacén Don Pepe" });
    await expect(masOpcionesComercio.getByRole("button").first()).toHaveText(/Cargar pedido/);
    await expect(masOpcionesComercio.getByRole("button").first()).toHaveClass(/fichaMenuPrincipal/);
    await expect(masOpcionesComercio.getByRole("button").last()).toHaveText(/Eliminar comercio/);
    await capturar(page, "simple-08-ficha-comercio-opciones");
    await masOpcionesComercio.getByRole("button", { name: "Ver sus pedidos" }).click();
    await expect(masOpcionesComercio).toBeHidden();
    await expect(fichaComercio).toBeHidden();

    // 4. Un empleado sin permiso de ver la plata no cambia precios.
    const { empleado, contexto, errores } = await entrarComoEmpleado(page, browser, testInfo);
    await empleado.locator(".bottom-nav").getByRole("button", { name: "Pedidos" }).click();
    await empleado.getByRole("button", { name: "Nuevo pedido" }).click();
    const frioSurEmpleado = empleado.locator('.marca[data-marca="Frío Sur"]');
    await frioSurEmpleado.locator(".tituloMarca").click();
    await expect(frioSurEmpleado.locator(".fila", { hasText: "Helado 1 kg" })).toBeVisible();
    await expect(frioSurEmpleado.locator("[data-editar-precio]")).toHaveCount(0);
    expect(errores).toEqual([]);
    await contexto.close();
});

test("simple: Inicio, Más en grupos y nombres del Catálogo", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await cargarPedido(page, false);
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    const inicio = page.locator("#pantallaMenu");

    // T178: "¿Qué querés hacer?" arranca apagada; se prende en Apariencia.
    const queHacer = inicio.locator("#queHacerInicio");
    await expect(queHacer).toBeHidden();
    // El logo y el nombre llevan a Tu cuenta (ya no está el botón "Más" de arriba).
    await expect(inicio.locator("#botonAvatar")).toBeHidden();
    await inicio.locator(".dashboardMarca").click();
    await expect(page.locator('.configDetalle, #configDetalle').first()).toBeVisible();
    await abrirConfiguracionEn(page, "apariencia");
    await page.locator("#configDetalle").getByRole("switch", { name: "¿Qué querés hacer?" }).check();
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();

    // El resumen sigue arriba de todo y debajo va "¿Qué querés hacer?".
    await expect(queHacer.getByRole("heading", { name: "¿Qué querés hacer?" })).toBeVisible();
    const resumen = await inicio.locator("#resumenHoy").boundingBox();
    expect((await queHacer.boundingBox()).y).toBeGreaterThan(resumen.y);
    await expect(queHacer.getByRole("button", { name: /Pedidos de hoy/ })).toContainText("1 para armar");
    await expect(queHacer.getByRole("button", { name: /Cobrar/ })).toBeVisible();
    // El Asistente arriba a la derecha, en el lugar del micrófono.
    await expect(inicio.locator("header").getByRole("button", { name: "Asistente" })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "simple-09-inicio-que-hacer");

    await queHacer.getByRole("button", { name: /Pedidos de hoy/ }).click();
    await expect(page.locator("#filtrosEtapaPedidos").getByRole("tab", { name: /Para armar/ })).toHaveAttribute("aria-selected", "true");
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    await queHacer.getByRole("button", { name: /Cargar un pedido/ }).click();
    await expect(page.locator("#generar")).toBeVisible();
    await page.evaluate(() => mostrarPantalla("menu"));

    // Más (informe del desconocido, opción A): lo de todos los días en
    // cuadros, el resto de las herramientas en lista y una sola fila
    // "Ajustes" con todo lo demás. Preguntale ya no está ahí.
    await abrirMas(page);
    const grupos = page.locator("#masAccesos");
    await expect(grupos.locator(".masGrupoTitulo")).toHaveText(["Lo de todos los días", "De vez en cuando"]);
    await expect(grupos.locator(".masAccesos .masAcceso strong")).toHaveText(["A cobrar", "Cierre del día", "Estadísticas", "Rutas", "WhatsApp", "Listas de precios"]);
    await expect(grupos.locator(".masHerramientas .masFila strong")).toHaveText(["Mapa de ventas", "Registro de cambios", "Importar planilla"]);
    await expect(grupos).not.toContainText("Preguntale");
    await expect(page.locator(".configMenuPrincipal > .configLista .configFila")).toHaveCount(1);
    await expect(page.locator("#configFilaAjustes")).toContainText("Ajustes");
    await capturar(page, "simple-10-mas-en-grupos");
    await page.locator("#configFilaAjustes").click();
    await expect(page.locator(".configHeader h1")).toHaveText("Ajustes");
    await expect(page.locator("#configDetalle .configGrupoTitulo")).toHaveText(["Trabajo diario", "Distribuidora", "App"]);
    await page.locator('#configDetalle [data-config-seccion="trabajo"]').click();
    await expect(page.locator(".configHeader h1")).toHaveText("Preferencias de trabajo");
    // La flecha vuelve a Ajustes y, desde ahí, a Más.
    await page.locator("#pantallaConfiguracion").getByRole("button", { name: "Volver", exact: true }).click();
    await expect(page.locator(".configHeader h1")).toHaveText("Ajustes");
    await page.locator("#pantallaConfiguracion").getByRole("button", { name: "Volver", exact: true }).click();
    await expect(page.locator(".configHeader h1")).toHaveText("Más");
    await expect(page.locator("#masAccesos")).toBeVisible();

    // Catálogo: "Productos" y "Editar marcas".
    await page.locator(".bottom-nav").getByRole("button", { name: "Catálogo" }).click();
    await expect(page.getByRole("tab", { name: "Productos", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Editar marcas" }).click();
    await expect(page.locator("#pantallaProductos")).toBeVisible();
});

test("simple: ayuda en cada pantalla, deshacer y opciones de arriba y de voz", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await cargarPedido(page, false);
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    const inicio = page.locator("#pantallaMenu");
    const nombreAbajo = selector => page.locator(selector).first().evaluate(el => getComputedStyle(el, "::after").content);

    // 1. Los íconos de arriba con su nombre abajo (se puede apagar).
    expect(await nombreAbajo("#botonAsistente")).toBe('"Asistente"');
    expect(await nombreAbajo(".campanaAvisos")).toBe('"Avisos"');
    // Inicio no lleva "?": ahí está el Asistente.
    await expect(inicio.locator(".botonAyudaPantalla")).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "simple-11-nombres-arriba");

    // 2. "?" en Pedidos: "¿Qué hago acá?" con pasos y "Escuchar en voz alta".
    await irAPedidos(page);
    await page.locator("#pantallaPedido header").getByRole("button", { name: "Ayuda de esta pantalla" }).click();
    const ayuda = page.getByRole("dialog", { name: "Ayuda de Pedidos" });
    await expect(ayuda.getByRole("heading", { name: "¿Qué hago acá?" })).toBeVisible();
    await expect(ayuda.locator(".pasosAyuda li")).toHaveCount(3);
    await expect(ayuda).toContainText("Acá están los pedidos de hoy");
    await expect(ayuda.getByRole("button", { name: "Escuchar en voz alta" })).toBeVisible();
    await capturar(page, "simple-12-ayuda-pedidos");
    await ayuda.getByRole("button", { name: "Entendido" }).click();
    await expect(ayuda).toBeHidden();

    // También en Comercios y en Nuevo pedido, cada una con lo suyo.
    await page.locator(".bottom-nav").getByRole("button", { name: "Comercios" }).click();
    await page.locator("#pantallaComercios header").getByRole("button", { name: "Ayuda de esta pantalla" }).click();
    await expect(page.getByRole("dialog", { name: "Ayuda de Comercios" })).toContainText("Agregar comercio");
    await page.getByRole("dialog", { name: "Ayuda de Comercios" }).getByRole("button", { name: "Entendido" }).click();

    // 3. "Vaciar pedido" sin "¿Seguro?": se vacía y "Deshacer" lo devuelve.
    await irAPedidos(page);
    await page.getByRole("button", { name: "Nuevo pedido" }).click();
    await elegirComercio(page, "Almacén Don Pepe");
    await page.locator("#cliente").blur();
    const helado = page.locator(".listaProdutos .fila", { hasText: "Helado 1 kg" });
    if (!(await helado.isVisible())) await page.locator(".tituloMarca", { hasText: "Frío Sur" }).click();
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("1");
    await page.getByRole("button", { name: "Más opciones del pedido" }).click();
    await page.getByRole("dialog", { name: "Opciones del pedido" }).getByRole("button", { name: "Vaciar pedido" }).click();
    await expect(page.getByRole("heading", { name: "Vaciar pedido" })).toBeHidden();
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("0");
    const aviso = page.locator(".pzDeshacer");
    await expect(aviso).toContainText("Pedido vaciado");
    await capturar(page, "simple-13-deshacer");
    await aviso.getByRole("button", { name: "Deshacer" }).click();
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("1");
    await expect(page.locator("#cliente")).toHaveValue("Almacén Don Pepe");

    // 4. Apariencia: apagar los nombres de arriba.
    await page.evaluate(() => mostrarPantalla("menu"));
    await abrirAjustes(page);
    await page.locator('.configFila[data-config-seccion="apariencia"]').click();
    await page.locator("#configDetalle").getByRole("switch", { name: "Nombres en los íconos de arriba" }).uncheck();
    await expect(page.locator("html")).toHaveAttribute("data-nombres-arriba", "no");
    expect(await nombreAbajo("#botonAsistente")).toBe("none");

    // 5. Trabajo: decir en voz alta lo que se guardó (apagado de fábrica).
    await page.evaluate(() => {
        window.dichos = [];
        window.speechSynthesis.speak = dicho => window.dichos.push(dicho.text);
    });
    await page.evaluate(() => mostrarToast("Pedido guardado"));
    expect(await page.evaluate(() => window.dichos)).toEqual([]);
    await abrirAjustes(page);
    await page.locator('.configFila[data-config-seccion="trabajo"]').click();
    const llave = page.locator("#configDetalle").getByRole("switch", { name: "Decirlo en voz alta al guardar" });
    await expect(llave).not.toBeChecked();
    await llave.check();
    await page.evaluate(() => mostrarToast("Pedido guardado"));
    expect(await page.evaluate(() => window.dichos)).toEqual(["Pedido guardado"]);
});
