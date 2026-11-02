// VendeFrío - Rutas como vista previa (T136 y repaso de Rutas), en un celular
// chico (360×640). El mapa ocupa toda la pantalla con el camino por calles;
// arriba «Rutas» con Ayuda y Asistente, «Auto ▾» y «Desde vos ▾»; hasta 2
// recorridos con sus minutos para elegir; abajo paradas, tiempo y km, la hora
// de terminar, e Iniciar, Paradas y ⋯. El GPS y los caminos son falsos.
const { test, expect, capturar } = require("./ayudas");

test.use({ viewport: { width: 360, height: 640 } });

// Las cajas no se pisan.
function noSePisan(a, b) {
    return a.y + a.height <= b.y || b.y + b.height <= a.y || a.x + a.width <= b.x || b.x + b.width <= a.x;
}

// Dos caminos falsos: el más rápido (13 min, 5,2 km) y, sin autopistas,
// otro un poco más largo (16 min, 6,1 km) que pasa más al norte. Entra como
// repartidor con 3 kioscos.
async function prepararRutas(page, pedidos = []) {
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: -34.600, longitude: -58.380 });
    await page.route("https://routing.openstreetmap.de/**", ruta => {
        const url = new URL(ruta.request().url());
        pedidos.push(url.pathname + url.search);
        const sinAutopistas = url.searchParams.get("exclude") === "motorway";
        const puntos = url.pathname.split("/").pop().split(";").map(par => par.split(",").map(Number));
        const camino = [];
        puntos.forEach((punto, indice) => {
            if (indice && sinAutopistas) camino.push([(punto[0] + puntos[indice - 1][0]) / 2, punto[1] + 0.004]);
            camino.push(punto);
        });
        return ruta.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ code: "Ok", routes: [{
                distance: sinAutopistas ? 6100 : 5200,
                duration: sinAutopistas ? 960 : 780,
                geometry: { type: "LineString", coordinates: camino },
                legs: puntos.slice(1).map(() => ({ duration: (sinAutopistas ? 960 : 780) / (puntos.length - 1) }))
            }] })
        });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Repartidor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(() => {
        [1, 2, 3].forEach(numero => agregarComercio({
            nombre: "Kiosco " + numero, direccion: "Calle " + numero, lat: -34.600 - numero * 0.002, lng: -58.380 + numero * 0.006
        }));
    });
}

test("planificar: vista previa con 2 recorridos, Iniciar y Paradas", async ({ page }) => {
    const pedidos = [];
    await prepararRutas(page, pedidos);

    await page.evaluate(() => mostrarPantalla("rutas"));
    const pantalla = page.locator("#pantallaRutas");
    await expect(page.locator("#mapaRuta.leaflet-container")).toBeVisible();
    // Pantalla entera: sin la barra de abajo de la app.
    await expect(page.locator("nav.bottom-nav")).toBeHidden();
    await expect(pantalla.locator(".cabezaRutas h1")).toHaveText("Rutas");
    await expect(page.locator("#textoVaciaRutas")).toHaveText("Todavía no armaste la ruta.");

    // Armar ruta > Elegir a mano: la lista para elegir; la X cierra sin cambiar.
    await page.locator("#btnArmarRuta").click();
    await page.locator(".hojaArmarRuta").getByRole("button", { name: /Elegir comercios a mano/ }).click();
    const elegir = page.getByRole("dialog", { name: "Elegir comercios para la ruta" });
    await elegir.getByRole("button", { name: "Cerrar sin cambiar nada" }).click();
    await expect(elegir).toBeHidden();
    await page.locator("#btnArmarRuta").click();
    await page.locator(".hojaArmarRuta").getByRole("button", { name: /Elegir comercios a mano/ }).click();
    // Con la lupa, solo los kioscos (la app trae comercios de ejemplo).
    await elegir.getByRole("button", { name: "Buscar comercio" }).click();
    await elegir.getByRole("searchbox").fill("kiosco");
    await expect(elegir.locator(".filaElegirRuta")).toHaveCount(3);
    await elegir.getByRole("button", { name: "Marcar todos" }).click();
    await expect(elegir.getByRole("button", { name: "Desmarcar todos" })).toBeVisible();

    // Armar: se ordena solo; abajo cuánto tarda por calles.
    await elegir.getByRole("button", { name: "Armar la ruta con 3" }).click();
    await expect(page.locator("#numerosPlanRutas .numeroPlanRutas")).toHaveText(["3paradas", "13 minmanejando", "5,2 kmde camino"]);
    await expect(page.locator("#detallePlanRutas")).toHaveText(/^Salís de donde estás · terminás \d\d:\d\d$/);
    // Dos recorridos con sus minutos; el elegido, más rápido, arriba.
    const rapida = pantalla.locator(".etiquetaCaminoPlan", { hasText: "Más rápida" });
    const sinAutopistas = pantalla.locator(".etiquetaCaminoPlan", { hasText: "Sin autopistas" });
    await expect(rapida).toContainText("13 min");
    await expect(rapida).toHaveClass(/elegida/);
    await expect(sinAutopistas).toContainText("16 min");
    await expect(pantalla.locator("path.caminoPlan.elegido")).toHaveCount(1);
    await expect(pantalla.locator("path.caminoPlan.otro")).toHaveCount(1);
    expect(pedidos.every(pedido => pedido.includes("/routed-car/"))).toBe(true);

    // En la pantalla chica nada se pisa: cabecera, chips, la parada y la hoja.
    const caja = selector => pantalla.locator(selector).first().boundingBox();
    const cajas = [await caja(".cabezaRutas"), await caja(".chipsRutas"), await caja("#proximaParadaRuta"), await caja(".hojaPlanRutas")];
    for (let i = 0; i < cajas.length; i++) {
        for (let j = i + 1; j < cajas.length; j++) expect(noSePisan(cajas[i], cajas[j])).toBe(true);
    }
    const hoja = cajas[3];
    expect(hoja.y + hoja.height).toBeLessThanOrEqual(640);
    for (const nombre of ["Iniciar", "Paradas", "Más opciones de la ruta"]) {
        const boton = await pantalla.locator(".hojaPlanRutas").getByRole("button", { name: nombre, exact: true }).boundingBox();
        expect(boton.y + boton.height).toBeLessThanOrEqual(640);
    }
    await capturar(page, "planificar-01-vista-previa");

    // Elegir el otro recorrido tocando su cartelito: cambian los minutos y
    // queda guardado para la navegación.
    await sinAutopistas.locator(".globoEtiquetaPlan").click();
    await expect(sinAutopistas).toHaveClass(/elegida/);
    await expect(page.locator("#numerosPlanRutas")).toContainText("16 min");
    await expect(page.locator("#numerosPlanRutas")).toContainText("6,1 km");
    await expect(page.locator("#pillVehiculoRutas")).toHaveText(/Auto, sin autopistas/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vendefrio_preferencias")).sinAutopistas)).toBe(true);
    // Y con «Auto ▾» se vuelve al más rápido.
    await page.locator("#pillVehiculoRutas").click();
    await page.locator(".menuVehiculoRutas").getByRole("button", { name: "Sin autopistas: sí" }).click();
    await expect(rapida).toHaveClass(/elegida/);
    await expect(page.locator("#numerosPlanRutas")).toContainText("13 min");

    // Auto o Moto: el mismo ajuste de Más > Cómo te movés.
    await page.locator("#pillVehiculoRutas").click();
    await page.locator(".menuVehiculoRutas").getByRole("button", { name: "Moto" }).click();
    await expect(page.locator("#pillVehiculoRutas")).toHaveText(/Moto/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vendefrio_preferencias")).vehiculo)).toBe("moto");
    await page.locator("#pillVehiculoRutas").click();
    await page.locator(".menuVehiculoRutas").getByRole("button", { name: "Auto", exact: true }).click();

    // Paradas: la lista con el orden, encima del mapa; se vuelve al mapa.
    await pantalla.locator(".hojaPlanRutas").getByRole("button", { name: "Paradas" }).click();
    await expect(page.locator(".paradaOrden")).toHaveCount(3);
    await expect(page.locator(".paradaOrden").first()).toBeVisible();
    await pantalla.getByRole("button", { name: "Volver al mapa" }).click();
    await expect(page.locator(".hojaPlanRutas")).toBeVisible();

    // Iniciar: arranca la navegación con las 3 paradas.
    await pantalla.getByRole("button", { name: "Iniciar" }).click();
    await expect(page.locator("#pantallaNavegacion")).toBeVisible();
    await expect(page.locator("#pantallaNavegacion .barraDiaNavegacion .rayaDia")).toHaveCount(3);
});

test("planificar: carrusel de paradas", async ({ page }) => {
    await prepararRutas(page);
    // Kiosco 1 tiene un pedido para entregar y debe un saldo.
    await page.evaluate(() => {
        guardarHistorial([{
            comercio: "Kiosco 1", timestamp: Date.now(),
            productos: [{ marca: "Pastas", producto: "Ravioles", cantidad: 4, precio: 3000 }],
            estados: { e1: { estado: "enReparto", horaCelular: Date.now() } }
        }]);
        window.saldosVendeFrio = { ...(window.saldosVendeFrio || {}), cuentas: () => [{ nombre: "Kiosco 1", total: 12000 }] };
        mostrarPantalla("rutas");
    });
    await expect(page.locator("#mapaRuta.leaflet-container")).toBeVisible();
    await page.evaluate(() => armarRutaCon(["Kiosco 1", "Kiosco 2", "Kiosco 3"]));
    await expect(page.locator("#numerosPlanRutas")).toContainText("13 min");

    // Una tarjeta por parada; la próxima primero, con su hora y lo que lleva y cobra.
    const carrusel = page.locator("#proximaParadaRuta");
    const tarjetas = carrusel.locator(".paradaCarrusel");
    await expect(tarjetas).toHaveCount(3);
    await expect(tarjetas.first()).toHaveClass(/actual/);
    await expect(tarjetas.first()).toHaveAttribute("aria-label", "Parada 1 de 3: Kiosco 1");
    await expect(tarjetas.first().locator("small")).toHaveText(/^Calle 1 · \d\d:\d\d · lleva 4 u · debe \$ 12\.000$/);
    await expect(page.locator('.pinRuta[title="Kiosco 1"]')).toHaveClass(/pinDestacado/);
    await capturar(page, "planificar-02-carrusel");

    // Deslizar a la segunda: el mapa va a Kiosco 2 y su pin se agranda.
    await carrusel.locator(".pistaCarrusel").evaluate(pista => { pista.scrollLeft = pista.querySelectorAll(".paradaCarrusel")[1].offsetLeft - 14; });
    await expect(page.locator('.pinRuta[title="Kiosco 2"]')).toHaveClass(/pinDestacado/);
    await expect(page.locator('.pinRuta[title="Kiosco 1"]')).not.toHaveClass(/pinDestacado/);
    await expect.poll(() => page.evaluate(() => {
        const centro = mapaLeaflet.getCenter();
        return Math.abs(centro.lat - (-34.604)) < 0.0005 && Math.abs(centro.lng - (-58.368)) < 0.0005;
    })).toBe(true);

    // ⋯ de la primera: el menú de la parada. Saltear la manda al final.
    await tarjetas.first().getByRole("button", { name: "Opciones de Kiosco 1" }).click();
    const menu = page.locator(".menuParadaRuta");
    await expect(menu.getByRole("button", { name: "Entregar" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Pasé, sin pedido" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Ir", exact: true })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Ver la ficha" })).toBeVisible();
    await capturar(page, "planificar-02b-menu-parada");
    await menu.getByRole("button", { name: "Saltear (queda para después)" }).click();
    await expect(tarjetas.first()).toHaveAttribute("aria-label", "Parada 1 de 3: Kiosco 2");
    await expect(page.locator(".paradaOrden").last()).toHaveAttribute("data-nombre", "Kiosco 1");

    // ⋯ de Kiosco 3: Sacar de la ruta. Recién reordenado, el carrusel se
    // redibuja y a veces el primer toque cae en la tarjeta vieja: se reintenta.
    await expect(async () => {
        await carrusel.getByRole("button", { name: "Opciones de Kiosco 3" }).click();
        await expect(page.locator(".menuParadaRuta")).toContainText("Kiosco 3", { timeout: 2000 });
    }).toPass({ timeout: 15000 });
    await page.locator(".menuParadaRuta").getByRole("button", { name: "Sacar de la ruta" }).click();
    await expect(tarjetas).toHaveCount(2);
    await expect(page.locator("#numerosPlanRutas")).toContainText("2paradas");
});

test("planificar: lista de paradas como línea de tiempo", async ({ page }) => {
    await prepararRutas(page);
    // Kiosco 2 debe un saldo; un cuarto comercio, elegido, no tiene ubicación.
    await page.evaluate(() => {
        agregarComercio({ nombre: "Almacén Sin Pin", direccion: "Calle 9" });
        window.saldosVendeFrio = { ...(window.saldosVendeFrio || {}), cuentas: () => [{ nombre: "Kiosco 2", total: 412000 }] };
        mostrarPantalla("rutas");
    });
    const pantalla = page.locator("#pantallaRutas");
    await expect(page.locator("#mapaRuta.leaflet-container")).toBeVisible();
    await page.evaluate(() => armarRutaCon(["Kiosco 1", "Kiosco 2", "Kiosco 3", "Almacén Sin Pin"]));
    await expect(page.locator("#numerosPlanRutas")).toContainText("3paradas");
    await pantalla.locator(".hojaPlanRutas").getByRole("button", { name: "Paradas" }).click();
    const panel = pantalla.locator(".panelParadasRutas");
    await expect(panel.getByRole("heading", { name: "Paradas de hoy" })).toBeVisible();
    // Sin ubicación: no entra a la ruta, se le pone el pin desde acá.
    await expect(panel.locator(".sinUbicacionParadas")).toContainText("Sin ubicación (1)");
    await expect(panel.locator(".sinUbicacionParadas")).toContainText("Almacén Sin Pin");

    // La línea de tiempo con la hora de cada parada.
    const numeros = panel.locator(".numeroParadas");
    await expect(numeros.nth(0)).toContainText("3");
    await expect(numeros.nth(1)).toContainText("5,2");
    await expect(numeros.nth(2)).toContainText("13 min");
    await expect(numeros.nth(3)).toContainText("412k");
    const paradas = panel.locator(".paradaOrden");
    await expect(paradas).toHaveCount(3);
    await expect(paradas.locator(".horaParada").first()).toHaveText(/^\d\d:\d\d$/);
    await expect(paradas.filter({ hasText: "Kiosco 2" })).toContainText("Debe $ 412.000");
    await expect(paradas.first()).toHaveClass(/proxima/);
    // En la pantalla chica, «Listo, ver mapa» queda abajo de todo a la vista.
    const listo = await panel.getByRole("button", { name: "Listo, ver mapa" }).boundingBox();
    expect(listo.y + listo.height).toBeLessThanOrEqual(640);
    await capturar(page, "planificar-03-paradas");

    // Arrastrar ≡ (con el teclado): cambia el orden.
    await paradas.nth(2).locator(".agarreParada").focus();
    await page.keyboard.press("ArrowUp");
    await expect(paradas.nth(1)).toHaveAttribute("data-nombre", "Kiosco 3");
    await expect(panel.locator(".encabezadoParadas")).toContainText("Orden a tu gusto");

    // El ⋯ de abajo: el mismo menú de la ruta (Guardar esta ruta).
    await panel.getByRole("button", { name: "Más opciones de la ruta" }).click();
    await page.locator(".menuRutaHoy").getByRole("button", { name: "Guardar esta ruta" }).click();
    await expect(page.locator("#nombreRutaGuardada")).toBeFocused();
    await page.keyboard.press("Escape");

    // Poner pin: se cierra la lista, se toca el mapa y se guarda.
    await panel.getByRole("button", { name: "Poner pin a Almacén Sin Pin" }).click();
    await expect(panel).toBeHidden();
    await expect(page.locator("#barraMoverPin")).toContainText("Tocá en el mapa dónde está Almacén Sin Pin");
    await page.locator("#mapaRuta").click({ position: { x: 40, y: 340 } });
    await expect(page.locator("#barraMoverPin")).toContainText("Arrastrá el pin de Almacén Sin Pin");
    await page.locator("#guardarMoverPin").click();
    await expect(page.locator("#barraMoverPin")).toBeHidden();
    expect(await page.evaluate(() => comercioTieneGps(buscarComercioPorNombre("Almacén Sin Pin")))).toBe(true);

    // Listo, ver mapa: vuelve al mapa.
    await pantalla.locator(".hojaPlanRutas").getByRole("button", { name: "Paradas" }).click();
    await expect(panel.locator(".sinUbicacionParadas")).toBeHidden();
    await panel.getByRole("button", { name: "Listo, ver mapa" }).click();
    await expect(panel).toBeHidden();
    await expect(pantalla.locator(".hojaPlanRutas")).toBeVisible();
});
