// VendeFrío - Rutas como vista previa (T136), en un celular chico (360×640).
// El mapa ocupa toda la pantalla con el camino por calles; arriba «Tu
// ubicación → N paradas», Auto / Moto / Sin autopistas; hasta 2 recorridos
// con sus minutos para elegir; abajo minutos, km y hora de terminar, Iniciar
// y Paradas, y Optimizar, Elegir, Guardadas y Google Maps. El GPS y los
// caminos son falsos.
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
    await expect(pantalla.locator(".cabezaRutas")).toContainText("Tu ubicación");
    await expect(page.locator("#detallePlanRutas")).toHaveText("Elegí los comercios y tocá Optimizar.");

    // Elegir: se abren las paradas en «Comercios para esta ruta».
    await pantalla.getByRole("button", { name: "Elegir" }).click();
    await expect(page.locator(".tarjetaSeleccionRuta")).toHaveAttribute("open", "");
    await page.locator("#limpiarSeleccionRuta").click();
    await pantalla.getByRole("button", { name: "Volver al mapa" }).click();
    await expect(page.locator("#destinoRutas")).toHaveText("Elegí los comercios de la ruta");
    await pantalla.getByRole("button", { name: "Elegir" }).click();
    await page.locator("#seleccionarTodosRuta").click();
    await pantalla.getByRole("button", { name: "Volver al mapa" }).click();
    await expect(page.locator("#destinoRutas")).toHaveText("3 paradas elegidas");

    // Optimizar: arriba hasta dónde va, abajo cuánto tarda por calles.
    await pantalla.getByRole("button", { name: "Optimizar" }).click();
    await page.locator("#modalAviso").getByRole("button", { name: "Entendido" }).click();
    await expect(page.locator("#destinoRutas")).toHaveText("3 paradas · última: Kiosco 3");
    await expect(page.locator("#minutosPlanRutas")).toHaveText("13 min");
    await expect(page.locator("#detallePlanRutas")).toHaveText(/^\(5,2 km\) · terminás \d\d:\d\d$/);
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
    for (const nombre of ["Iniciar", "Paradas", "Optimizar", "Elegir", "Guardadas", "Google Maps"]) {
        const boton = await pantalla.locator(".hojaPlanRutas").getByRole("button", { name: nombre, exact: true }).boundingBox();
        expect(boton.y + boton.height).toBeLessThanOrEqual(640);
    }
    await capturar(page, "planificar-01-vista-previa");

    // Elegir el otro recorrido tocando su cartelito: cambian los minutos y
    // queda guardado para la navegación.
    await sinAutopistas.locator(".globoEtiquetaPlan").click();
    await expect(sinAutopistas).toHaveClass(/elegida/);
    await expect(page.locator("#minutosPlanRutas")).toHaveText("16 min");
    await expect(page.locator("#detallePlanRutas")).toHaveText(/^\(6,1 km\)/);
    await expect(pantalla.getByRole("button", { name: "Sin autopistas", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vendefrio_preferencias")).sinAutopistas)).toBe(true);
    // Y con el chip se vuelve al más rápido.
    await pantalla.getByRole("button", { name: "Sin autopistas", exact: true }).click();
    await expect(rapida).toHaveClass(/elegida/);
    await expect(page.locator("#minutosPlanRutas")).toHaveText("13 min");

    // Auto o Moto: el mismo ajuste de Más > Cómo te movés.
    await pantalla.getByRole("button", { name: "Moto", exact: true }).click();
    await expect(pantalla.getByRole("button", { name: "Moto", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(pantalla.getByRole("button", { name: "Auto", exact: true })).toHaveAttribute("aria-pressed", "false");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vendefrio_preferencias")).vehiculo)).toBe("moto");
    await pantalla.getByRole("button", { name: "Auto", exact: true }).click();

    // Paradas: la lista con el orden, encima del mapa; se vuelve al mapa.
    await pantalla.locator(".hojaPlanRutas").getByRole("button", { name: "Paradas" }).click();
    await expect(page.locator(".paradaOrden")).toHaveCount(3);
    await expect(page.locator(".paradaOrden").first()).toBeVisible();
    await pantalla.getByRole("button", { name: "Volver al mapa" }).click();
    await expect(page.locator(".hojaPlanRutas")).toBeVisible();

    // Guardadas: se abren las paradas en «Rutas guardadas».
    await pantalla.getByRole("button", { name: "Guardadas" }).click();
    await expect(page.locator(".tarjetaRutasGuardadas")).toHaveAttribute("open", "");
    await expect(page.locator("#nombreRutaGuardada")).toBeVisible();
    await pantalla.getByRole("button", { name: "Volver al mapa" }).click();

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
    const pantalla = page.locator("#pantallaRutas");
    await expect(page.locator("#mapaRuta.leaflet-container")).toBeVisible();
    await pantalla.getByRole("button", { name: "Optimizar" }).click();
    await page.locator("#modalAviso").getByRole("button", { name: "Entendido" }).click();
    await expect(page.locator("#minutosPlanRutas")).toHaveText("13 min");

    // Una tarjeta por parada; la próxima primero, con su hora y lo que lleva y cobra.
    const carrusel = page.locator("#proximaParadaRuta");
    const tarjetas = carrusel.locator(".paradaCarrusel");
    await expect(tarjetas).toHaveCount(3);
    await expect(tarjetas.first()).toHaveClass(/actual/);
    await expect(tarjetas.first()).toHaveAttribute("aria-label", "Parada 1 de 3: Kiosco 1");
    await expect(tarjetas.first().locator("small")).toHaveText(/^Calle 1 · \d\d:\d\d · lleva 4 u · cobrar \$ 12\.000$/);
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

    // ⋯ de la tercera: Ir primero. Pasa adelante de la próxima.
    await tarjetas.nth(2).getByRole("button", { name: "Opciones de Kiosco 3" }).click();
    const opciones = page.getByRole("dialog", { name: "Opciones de la parada Kiosco 3" });
    await expect(opciones.getByRole("button", { name: "Hacer pedido" })).toBeVisible();
    await expect(opciones.getByRole("button", { name: "Ir con Google Maps" })).toBeVisible();
    await opciones.getByRole("button", { name: "Ir primero" }).click();
    await expect(tarjetas.first()).toHaveAttribute("aria-label", "Parada 1 de 3: Kiosco 3");
    await expect(page.locator(".paradaOrden").first()).toHaveAttribute("data-nombre", "Kiosco 3");

    // ⋯ de Kiosco 2: Sacar de la ruta. Recién reordenado, el carrusel se
    // redibuja y a veces el primer toque cae en la tarjeta vieja: se reintenta.
    const opcionesKiosco2 = page.getByRole("dialog", { name: "Opciones de la parada Kiosco 2" });
    await expect(async () => {
        await carrusel.getByRole("button", { name: "Opciones de Kiosco 2" }).click();
        await expect(opcionesKiosco2).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
    await opcionesKiosco2.getByRole("button", { name: "Sacar de la ruta" }).click();
    await expect(tarjetas).toHaveCount(2);
    await expect(page.locator("#destinoRutas")).toHaveText("2 paradas · última: Kiosco 1");

    // ⋯ de la próxima: Ya pasé. La siguiente queda primera.
    // Como arriba: si el carrusel se redibuja justo, el toque se reintenta.
    const opcionesKiosco3 = page.getByRole("dialog", { name: "Opciones de la parada Kiosco 3" });
    await expect(async () => {
        await tarjetas.first().getByRole("button", { name: "Opciones de Kiosco 3" }).click();
        await expect(opcionesKiosco3).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
    await opcionesKiosco3.getByRole("button", { name: "Ya pasé" }).click();
    await expect(tarjetas).toHaveCount(1);
    await expect(tarjetas.first()).toHaveAttribute("aria-label", "Parada 2 de 2: Kiosco 1");
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
    await pantalla.locator(".hojaPlanRutas").getByRole("button", { name: "Paradas" }).click();
    const panel = pantalla.locator(".panelParadasRutas");
    await expect(panel.getByRole("heading", { name: "Paradas de hoy" })).toBeVisible();
    // Solo los 3 kioscos y el almacén (la app trae comercios de ejemplo).
    await panel.locator(".filtrosParadas").getByRole("button", { name: "Ninguno" }).click();
    await panel.getByRole("button", { name: "Buscar comercio", exact: true }).click();
    for (const nombre of ["Kiosco 1", "Kiosco 2", "Kiosco 3", "Almacén Sin Pin"]) {
        await page.locator(`#listaSeleccionRuta input[data-nombre="${nombre}"]`).check();
    }
    await page.locator(".tarjetaSeleccionRuta > summary").click();
    await panel.evaluate(caja => { caja.scrollTop = 0; });
    // Sin ubicación: no entra a la ruta, se le pone el pin desde acá.
    await expect(panel.locator(".sinUbicacionParadas")).toContainText("Sin ubicación (1)");
    await expect(panel.locator(".sinUbicacionParadas")).toContainText("Almacén Sin Pin");

    // Optimizar orden: la línea de tiempo con la hora de cada parada.
    await panel.getByRole("button", { name: "Optimizar orden" }).click();
    await page.locator("#modalAviso").getByRole("button", { name: "Entendido" }).click();
    const numeros = panel.locator(".numeroParadas");
    await expect(numeros.nth(0)).toContainText("3");
    await expect(numeros.nth(1)).toContainText("5,2");
    await expect(numeros.nth(2)).toContainText("0:13");
    await expect(numeros.nth(3)).toContainText("412k");
    const paradas = panel.locator(".paradaOrden");
    await expect(paradas).toHaveCount(3);
    await expect(paradas.locator(".horaParada").first()).toHaveText(/^\d\d:\d\d$/);
    await expect(paradas.filter({ hasText: "Kiosco 2" })).toContainText("Cobrar $ 412.000");
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

    // Buscar: abre «Comercios para esta ruta» con el buscador listo.
    await panel.getByRole("button", { name: "Buscar comercio", exact: true }).click();
    await expect(page.getByLabel("Buscar comercio para la ruta")).toBeFocused();
    await expect(page.locator(".tarjetaSeleccionRuta")).toHaveAttribute("open", "");
    // Guardar ruta: abre «Rutas guardadas» con el nombre listo.
    await panel.getByRole("button", { name: "Guardar ruta", exact: true }).first().click();
    await expect(page.locator("#nombreRutaGuardada")).toBeFocused();

    // Poner pin: se cierra la lista, se toca el mapa y se guarda.
    await panel.getByRole("button", { name: "Poner pin a Almacén Sin Pin" }).click();
    await page.locator("#modalAviso").getByRole("button", { name: "Entendido" }).click();
    await expect(panel).toBeHidden();
    await page.locator("#mapaRuta").click({ position: { x: 40, y: 340 } });
    await page.locator("#modalAviso").getByRole("button", { name: "Entendido" }).click();
    await expect(page.locator("#barraMoverPin")).toContainText("Almacén Sin Pin");
    await page.locator("#guardarMoverPin").click();
    await page.locator("#modalAviso").getByRole("button", { name: "Entendido" }).click();
    expect(await page.evaluate(() => comercioTieneGps(buscarComercioPorNombre("Almacén Sin Pin")))).toBe(true);

    // Listo, ver mapa: vuelve al mapa.
    await pantalla.locator(".hojaPlanRutas").getByRole("button", { name: "Paradas" }).click();
    await expect(panel.locator(".sinUbicacionParadas")).toBeHidden();
    await panel.getByRole("button", { name: "Listo, ver mapa" }).click();
    await expect(panel).toBeHidden();
    await expect(pantalla.locator(".hojaPlanRutas")).toBeVisible();
});
