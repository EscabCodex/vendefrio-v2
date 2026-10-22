// VendeFrío - Más > Listas de precios (T161), con los emuladores de Firebase.
// 1. Crear listas (rápida y con nombre), cargar sus precios con "% sobre el
//    general" y redondeo, cambiarle el nombre y borrarla.
// 2. Al armar el pedido se elige otra lista y el pedido guarda esos precios.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, irAPedidos, elegirComercio, abrirMas } = require("./recorridos");

test.use({ nube: true });

test("listas de precios: crear, renombrar, borrar y elegir al armar el pedido", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);

    // Más > Listas de precios, todavía vacía.
    await abrirMas(page);
    await page.locator('.masAcceso[data-mas="listasPrecios"]').click();
    const pantalla = page.locator("#pantallaListasPrecios");
    await expect(pantalla).toBeVisible();
    await expect(pantalla).toContainText("Todavía no hay listas");
    await capturar(page, "listas-01-vacia");

    // "Almacenes" con el botón rápido: −10% del general, redondeado a $ 100.
    await pantalla.locator('[data-sugerida="Almacenes"]').click();
    const toda = page.locator("#pantallaTodaLista");
    await expect(toda).toBeVisible();
    await toda.locator("#porcentajeLista").fill("-10");
    await toda.locator('[data-redondeo="100"]').click();
    await toda.locator("#aplicarPorcentajeLista").click();
    await expect(toda.getByRole("spinbutton", { name: "Precio Helado 1 kg en Almacenes" })).toHaveValue("4100");
    await toda.locator("#guardarTodaLista").click();
    await expect(pantalla).toBeVisible();

    // "Supermercados" con «Lista nueva» y un precio a mano.
    await pantalla.locator("#crearListaPrecios").click();
    const nueva = page.getByRole("dialog", { name: "Lista nueva" });
    await nueva.locator("#nombreListaPrecios").fill("Supermercados");
    await nueva.getByRole("button", { name: "Crear lista" }).click();
    await expect(toda).toBeVisible();
    await toda.getByRole("spinbutton", { name: "Precio Helado 1 kg en Supermercados" }).fill("3900");
    await toda.locator("#guardarTodaLista").click();
    await expect(pantalla).toBeVisible();
    await expect(pantalla.locator(".filaListaMas")).toHaveCount(2);

    // Cambiarle el nombre: los precios y los comercios la siguen.
    // (La primera bajada de la nube puede pisar lo recién agregado: se insiste.)
    await expect.poll(() => page.evaluate(() => {
        if (!buscarComercioPorNombre("Kiosco La Esquina")) agregarComercio({ nombre: "Kiosco La Esquina", direccion: "Mitre 50" });
        actualizarComercioPorNombre("Kiosco La Esquina", { listaPrecios: "Supermercados" });
        return buscarComercioPorNombre("Kiosco La Esquina")?.listaPrecios;
    })).toBe("Supermercados");
    await page.evaluate(() => window.listasPreciosVendeFrio.abrirPantalla());
    await pantalla.getByRole("button", { name: "Opciones de Supermercados" }).click();
    await page.getByRole("dialog", { name: "Opciones de Supermercados" }).getByRole("button", { name: "Cambiar el nombre" }).click();
    const nombre = page.getByRole("dialog", { name: "Cambiar el nombre" });
    await nombre.locator("#nombreListaPrecios").fill("Súper");
    await nombre.getByRole("button", { name: "Guardar nombre" }).click();
    await expect(pantalla.locator(".filaListaMas", { hasText: "Súper" })).toContainText("1 producto con precio · 1 comercio");
    expect(await page.evaluate(() => {
        const helado = obtenerProductos()["Frío Sur"].find(producto => producto.nombre === "Helado 1 kg");
        return [helado.precios["Súper"], helado.precios.Supermercados, buscarComercioPorNombre("Kiosco La Esquina").listaPrecios];
    })).toEqual([3900, undefined, "Súper"]);
    await capturar(page, "listas-02-listas");

    // Don Pepe usa "Almacenes"; en este pedido se elige "Súper".
    await page.evaluate(() => actualizarComercioPorNombre("Almacén Don Pepe", { listaPrecios: "Almacenes" }));
    await irAPedidos(page);
    await page.getByRole("button", { name: "Nuevo pedido" }).click();
    await elegirComercio(page, "Almacén Don Pepe");
    await page.locator(".tituloMarca", { hasText: "Frío Sur" }).click();
    const helado = page.locator(".listaProdutos .fila", { hasText: "Helado 1 kg" });
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    const lista = page.locator("#listaDelPedido");
    await expect(lista).toContainText("Precios: Almacenes");
    await expect(page.locator("#totalPlataPedido")).toHaveText("$ 8.200");
    await lista.click();
    const elegir = page.getByRole("dialog", { name: "Lista de precios" });
    await expect(elegir.locator('[data-lista-pedido="Almacenes"]')).toContainText("la de Almacén Don Pepe");
    await elegir.locator('[data-lista-pedido="Súper"]').click();
    await expect(lista).toContainText("Precios: Súper · solo este pedido");
    await expect(page.locator("#totalPlataPedido")).toHaveText("$ 7.800");
    await expect(helado).toContainText("$ 3.900");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "listas-03-pedido-otra-lista");

    // El pedido guarda el precio de "Súper"; la ficha del comercio no cambia.
    await page.locator("#generar").click();
    const generado = page.locator("#modalPedido");
    await expect(generado).toBeVisible();
    await generado.click({ position: { x: 10, y: 10 } });
    expect(await page.evaluate(() => {
        const pedido = obtenerHistorial().find(item => item.comercio === "Almacén Don Pepe");
        return [pedido.productos.find(linea => linea.producto === "Helado 1 kg").precio, buscarComercioPorNombre("Almacén Don Pepe").listaPrecios];
    })).toEqual([3900, "Almacenes"]);

    // El pedido siguiente vuelve a arrancar con la lista del comercio.
    await irAPedidos(page);
    await page.getByRole("button", { name: "Nuevo pedido" }).click();
    await elegirComercio(page, "Almacén Don Pepe");
    await page.locator(".tituloMarca", { hasText: "Frío Sur" }).click();
    await expect(page.locator("#listaDelPedido")).toContainText("Precios: Almacenes");

    // Borrar "Súper": el kiosco vuelve a la General.
    await page.evaluate(() => window.listasPreciosVendeFrio.abrirPantalla());
    await pantalla.getByRole("button", { name: "Opciones de Súper" }).click();
    await page.getByRole("dialog", { name: "Opciones de Súper" }).getByRole("button", { name: "Borrar la lista" }).click();
    const confirmar = page.getByRole("alertdialog", { name: "¿Borrar la lista «Súper»?" });
    await expect(confirmar).toContainText("El comercio que la usa vuelve a los precios generales");
    await confirmar.getByRole("button", { name: "Borrar" }).click();
    await expect(pantalla.locator(".filaListaMas")).toHaveCount(1);
    expect(await page.evaluate(() => {
        const helado = obtenerProductos()["Frío Sur"].find(producto => producto.nombre === "Helado 1 kg");
        return [helado.precios["Súper"], buscarComercioPorNombre("Kiosco La Esquina").listaPrecios, obtenerHistorial().find(item => item.comercio === "Almacén Don Pepe").productos.find(linea => linea.producto === "Helado 1 kg").precio];
    })).toEqual([undefined, "", 3900]);
});

// T162: exportar una lista a planilla (CSV) y como folleto para imprimir.
test("listas de precios: exportar a planilla y folleto para imprimir", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    // (La primera bajada de la nube puede pisar lo recién agregado: se insiste.)
    await expect.poll(() => page.evaluate(() => {
        const marca = obtenerProductos()["Pastas Doña Rosa"];
        if (!marca) agregarMarca("Pastas Doña Rosa");
        [["Ravioles de verdura x 1 kg", 6200], ["Tapas de pascualina", 1900]].forEach(([nombre, precio]) => {
            if (!(obtenerProductos()["Pastas Doña Rosa"] || []).some(producto => producto.nombre === nombre)) agregarProducto("Pastas Doña Rosa", { nombre, precio });
        });
        return (obtenerProductos()["Pastas Doña Rosa"] || []).length;
    })).toBe(2);
    await page.evaluate(() => window.distribuidoraVendeFrio.cambiarDatosTicket({ direccion: "Av. Siempreviva 742", telefono: "11 4444-5555" }));

    // "Almacenes": −10% del general, redondeado a $ 100.
    await abrirMas(page);
    await page.locator('.masAcceso[data-mas="listasPrecios"]').click();
    const pantalla = page.locator("#pantallaListasPrecios");
    await pantalla.locator('[data-sugerida="Almacenes"]').click();
    const toda = page.locator("#pantallaTodaLista");
    await toda.locator("#porcentajeLista").fill("-10");
    await toda.locator('[data-redondeo="100"]').click();
    await toda.locator("#aplicarPorcentajeLista").click();
    await expect(toda.getByRole("spinbutton", { name: "Precio Tapas de pascualina en Almacenes" })).toHaveValue("1700");
    await toda.locator("#guardarTodaLista").click();
    await expect(pantalla).toBeVisible();
    await expect(pantalla.locator(".filaListaMas", { hasText: "Almacenes" })).toContainText("4 productos con precio");

    // Planilla: marca, producto, precio de la lista y el general.
    await pantalla.getByRole("button", { name: "Opciones de Almacenes" }).click();
    const opciones = page.getByRole("dialog", { name: "Opciones de Almacenes" });
    const descarga = page.waitForEvent("download");
    await opciones.getByRole("button", { name: "Exportar a planilla" }).click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toMatch(/^Lista Almacenes \d{4}-\d{2}-\d{2}\.csv$/);
    const texto = require("fs").readFileSync(await archivo.path(), "utf8");
    expect(texto.replace(/^﻿/, "").split("\r\n").slice(0, 3)).toEqual([
        "Marca;Producto;Precio Almacenes;Precio general",
        "Frío Sur;Helado 1 kg;4100;4500",
        "Frío Sur;Palito bombón;700;800"
    ]);
    expect(texto).toContain("Pastas Doña Rosa;Tapas de pascualina;1700;1900");

    // Folleto: datos de la distribuidora y los precios por marca.
    await pantalla.getByRole("button", { name: "Opciones de Almacenes" }).click();
    await page.getByRole("dialog", { name: "Opciones de Almacenes" }).getByRole("button", { name: "Folleto para imprimir" }).click();
    const folleto = page.locator("#pantallaFolleto");
    await expect(folleto).toBeVisible();
    const hoja = folleto.locator(".folletoHoja");
    await expect(hoja.locator("h1")).toHaveText("Distribuidora Prueba");
    await expect(hoja.locator(".folletoCab")).toContainText("Av. Siempreviva 742 · Tel.: 11 4444-5555");
    await expect(hoja).toContainText("Lista de precios · Almacenes");
    await expect(hoja.locator(".folletoMarca h2")).toHaveText(["Frío Sur", "Pastas Doña Rosa"]);
    await expect(hoja.locator("li", { hasText: "Ravioles de verdura" })).toContainText("$ 5.600");
    await capturar(page, "listas-04-folleto");

    // Imprimir: se llama a la impresión y en papel queda solo el folleto.
    await page.evaluate(() => { window.impresiones = 0; window.print = () => { window.impresiones += 1; }; });
    await folleto.locator("#imprimirFolleto").click();
    expect(await page.evaluate(() => window.impresiones)).toBe(1);
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("#folletoImprimir .folletoHoja")).toBeVisible();
    await expect(folleto).toBeHidden();
    await capturar(page, "listas-05-folleto-impreso");
    await page.emulateMedia({ media: "screen" });
    await expect(page.locator("#folletoImprimir")).toBeHidden();
});
