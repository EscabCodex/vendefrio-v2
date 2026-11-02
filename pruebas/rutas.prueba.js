// VendeFrío - Rutas con muchas paradas (T129), en modo personal y con un GPS
// falso: se eligen 12 comercios, la app ordena los 12 y Google Maps, que acepta
// hasta 9 paradas, recibe la ruta en dos partes. Con el repaso de Rutas
// (2026-11-02): «Armar ruta» y elegir a mano, el ⋯ de la ruta, los pines,
// salir del depósito y volver, y guardar la ruta.
const { test, expect, capturar } = require("./ayudas");

// «Armar ruta» > «Elegir comercios a mano» > Marcar todos > Armar la ruta con N.
async function armarConTodos(page, cuantos) {
    await page.locator("#btnArmarRuta").click();
    await page.locator(".hojaArmarRuta").getByRole("button", { name: /Elegir comercios a mano/ }).click();
    const elegir = page.getByRole("dialog", { name: "Elegir comercios para la ruta" });
    await elegir.getByRole("button", { name: "Marcar todos" }).click();
    await expect(elegir.locator(".cuantosElegidosRuta")).toHaveText(cuantos + " elegidos");
    await elegir.getByRole("button", { name: "Armar la ruta con " + cuantos }).click();
    await expect(elegir).toBeHidden();
}

test("rutas: más de 9 paradas y Google Maps en partes", async ({ page }) => {
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: -34.600, longitude: -58.380 });
    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Repartidor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();

    // 12 comercios en fila hacia el este, cargados desordenados.
    await page.evaluate(() => {
        [7, 2, 11, 4, 9, 1, 12, 5, 3, 10, 6, 8].forEach(numero => agregarComercio({
            nombre: "Kiosco " + String(numero).padStart(2, "0"),
            direccion: "Calle " + numero,
            lat: -34.600,
            lng: -58.380 + numero * 0.003
        }));
        window.__abiertas = [];
        window.open = url => { window.__abiertas.push(String(url)); return null; };
    });

    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    await page.locator(".bottom-nav").getByRole("button", { name: "Más", exact: true }).click();
    await page.locator("#masAccesos").getByRole("button", { name: /Rutas/ }).click();
    await expect(page.locator("#mapaRuta.leaflet-container")).toBeVisible();
    // La app ordena las 12 paradas sola al armar la ruta, sin tope.
    await armarConTodos(page, 12);
    await expect(page.locator("#numerosPlanRutas")).toContainText("12paradas");
    const paradas = page.locator(".paradaOrden");
    await expect(paradas).toHaveCount(12);
    const orden = await paradas.evaluateAll(lista => lista.map(parada => parada.dataset.nombre));
    expect(orden).toEqual(Array.from({ length: 12 }, (_, i) => "Kiosco " + String(i + 1).padStart(2, "0")));

    // Google Maps: avisa el límite y pasa la ruta en dos partes.
    await page.locator("#btnMasRutas").click();
    await page.locator(".menuRutaHoy").getByRole("button", { name: "Abrir en Google Maps" }).click();
    const hoja = page.getByRole("dialog", { name: "Google Maps acepta hasta 9 paradas" });
    await expect(hoja).toContainText("Tu ruta tiene 12 paradas. Te la paso en 2 partes");
    await expect(hoja.getByRole("button", { name: "Parte 1 · paradas 1 a 9" })).toHaveClass(/pzBtnPri/);
    await expect(hoja.getByRole("button", { name: "Parte 2 · paradas 10 a 12" })).toBeVisible();
    await capturar(page, "rutas-01-google-maps-en-partes");
    await hoja.getByRole("button", { name: /Parte 1/ }).click();
    await expect(hoja).toBeHidden();

    // Al volver, la Parte 2 queda resaltada.
    await page.locator("#btnMasRutas").click();
    await page.locator(".menuRutaHoy").getByRole("button", { name: "Abrir en Google Maps" }).click();
    await expect(hoja.getByRole("button", { name: /Parte 2/ })).toHaveClass(/pzBtnPri/);
    await hoja.getByRole("button", { name: /Parte 2/ }).click();

    const abiertas = await page.evaluate(() => window.__abiertas);
    expect(abiertas).toHaveLength(2);
    const puntos = abiertas.map(url => url.replace("https://www.google.com/maps/dir//", "").split("/"));
    expect(puntos[0]).toHaveLength(9);
    expect(puntos[1]).toHaveLength(3);
    expect(puntos[0][0]).toBe("-34.6," + (-58.380 + 0.003));
});

// Revisor de T141: al volver a optimizar, un pedido hecho después de la
// primera ruta pasa a ser de la ruta nueva; esa parada no queda hecha.
test("rutas: reoptimizar con un pedido nuevo no saltea la parada", async ({ page }) => {
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: -34.600, longitude: -58.380 });
    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Repartidor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(() => {
        [1, 2, 3].forEach(numero => agregarComercio({
            nombre: "Kiosco " + numero, direccion: "Calle " + numero, lat: -34.600, lng: -58.380 + numero * 0.003
        }));
    });

    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    await page.locator(".bottom-nav").getByRole("button", { name: "Más", exact: true }).click();
    await page.locator("#masAccesos").getByRole("button", { name: /Rutas/ }).click();
    await expect(page.locator("#mapaRuta.leaflet-container")).toBeVisible();
    await armarConTodos(page, 3);
    const optimizar = async () => {
        await page.locator("#btnMasRutas").click();
        await page.locator(".menuRutaHoy").getByRole("button", { name: "Optimizar el orden" }).click();
        await expect(page.locator(".menuRutaHoy")).toBeHidden();
    };
    // La próxima es la primera tarjeta del carrusel (T137).
    const proxima = page.locator("#proximaParadaRuta .paradaCarrusel.actual");
    await expect(proxima).toHaveAttribute("aria-label", "Parada 1 de 3: Kiosco 1");

    // Un pedido nuevo para Kiosco 1 y se vuelve a optimizar.
    await page.evaluate(() => guardarHistorial(obtenerHistorial().concat([{
        comercio: "Kiosco 1", timestamp: Date.now(), productos: [{ marca: "Pastas", producto: "Ravioles", cantidad: 2, precio: 3000 }]
    }])));
    await optimizar();
    await expect(proxima).toHaveAttribute("aria-label", "Parada 1 de 3: Kiosco 1");
    await expect(page.locator(".paradaOrden.hecha")).toHaveCount(0);
});

// Repaso de Rutas (2026-11-02): los pines arrancan destildados; el menú del pin
// los marca; «Armar ruta» ofrece los pines marcados; se sale del depósito y se
// vuelve a él; la ruta se guarda con su día y se vuelve a armar desde
// «Rutas guardadas»; Paradas tiene la lupa y los filtros.
test("rutas: pines marcados, depósito, guardar la ruta y filtros de paradas", async ({ page }) => {
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: -34.600, longitude: -58.380 });
    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Repartidor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(() => {
        [1, 2, 3, 4].forEach(numero => agregarComercio({
            nombre: "Kiosco " + numero, direccion: "Calle " + numero, lat: -34.600, lng: -58.380 + numero * 0.003
        }));
        // El depósito, guardado antes en este celular, al oeste de todo.
        localStorage.setItem("vendefrio_preferencias", JSON.stringify({ lugares: { deposito: { direccion: "Galpón 1", lat: -34.600, lng: -58.390 } } }));
    });
    await page.evaluate(() => mostrarPantalla("rutas"));
    await expect(page.locator("#mapaRuta.leaflet-container")).toBeVisible();
    const pantalla = page.locator("#pantallaRutas");
    await expect(pantalla.locator(".cabezaRutas h1")).toHaveText("Rutas");
    await expect(pantalla.locator(".cabezaRutas").getByRole("button", { name: "Ayuda de esta pantalla" })).toBeVisible();
    await expect(page.locator("#textoVaciaRutas")).toHaveText("Todavía no armaste la ruta.");
    await expect(page.locator(".globoPinRuta.enRuta")).toHaveCount(0);

    // El menú del pin marca dos comercios.
    for (const nombre of ["Kiosco 4", "Kiosco 2"]) {
        await page.locator(`.pinRuta[title="${nombre}"]`).click();
        const menu = page.locator(".menuPinRuta");
        await expect(menu).toContainText(nombre);
        await expect(menu.getByRole("button", { name: "Hacer pedido" })).toBeVisible();
        await menu.getByRole("button", { name: "Marcar para la ruta" }).click();
    }
    await expect(page.locator(".globoPinRuta.enRuta")).toHaveCount(2);
    await expect(page.locator("#textoVaciaRutas")).toHaveText("Marcaste 2 comercios en el mapa.");

    // Salir del depósito con «Desde vos ▾».
    await page.locator("#pillDesdeRutas").click();
    await page.locator(".menuLugaresRutas").getByRole("button", { name: /El depósito · Galpón 1/ }).click();
    await expect(page.locator("#pillDesdeRutas")).toHaveText(/Desde el depósito/);

    // «Armar ruta»: los pines marcados vienen elegidos; se vuelve al depósito.
    await page.locator("#btnArmarRuta").click();
    const armar = page.locator(".hojaArmarRuta");
    await expect(armar.getByRole("button", { name: /Pines marcados/ })).toHaveAttribute("aria-pressed", "true");
    await expect(armar.locator('[data-lugar="salida"]')).toContainText("El depósito");
    await armar.locator('[data-lugar="vuelta"]').click();
    await page.locator(".menuLugaresRutas").getByRole("button", { name: /El depósito/ }).click();
    await expect(armar.locator('[data-lugar="vuelta"]')).toContainText("El depósito");
    await capturar(page, "rutas-02-armar-la-ruta");
    await armar.getByRole("button", { name: "Armar la ruta" }).click();
    await expect(page.locator(".paradaOrden")).toHaveCount(2);
    expect(await page.locator(".paradaOrden").evaluateAll(lista => lista.map(parada => parada.dataset.nombre))).toEqual(["Kiosco 2", "Kiosco 4"]);
    await expect(page.locator("#detallePlanRutas")).toHaveText(/^Salís del depósito · volvés \d\d:\d\d$/);
    // Del último (Kiosco 4) vuelve al depósito, al oeste.
    expect(await page.evaluate(() => Math.round(distanciaVueltaRuta))).toBe(await page.evaluate(() => Math.round(calcularDistancia(-34.6, -58.368, -34.6, -58.39))));
    await capturar(page, "rutas-03-ruta-armada");

    // Con la ruta armada, un pin se suma de paso, donde menos se desvía.
    await page.locator('.pinRuta[title="Kiosco 3"]').click();
    await page.locator(".menuPinRuta").getByRole("button", { name: "Sumar a la ruta" }).click();
    expect(await page.locator(".paradaOrden").evaluateAll(lista => lista.map(parada => parada.dataset.nombre))).toEqual(["Kiosco 2", "Kiosco 3", "Kiosco 4"]);

    // Guardar la ruta con su día y volver a armarla desde «Rutas guardadas».
    await page.locator("#btnMasRutas").click();
    await page.locator(".menuRutaHoy").getByRole("button", { name: "Guardar esta ruta" }).click();
    const guardar = page.locator(".hojaGuardarRuta");
    await guardar.locator("#nombreRutaGuardada").fill("Zona Este");
    await guardar.locator("#diaRutaGuardada").selectOption("lunes");
    await guardar.getByRole("button", { name: "Guardar" }).click();
    await expect(guardar).toBeHidden();
    expect(await page.evaluate(() => obtenerRutasGuardadas().map(ruta => [ruta.nombre, ruta.dia, ruta.comercios.length]))).toEqual([["Zona Este", "lunes", 3]]);

    await page.locator("#btnMasRutas").click();
    await page.locator(".menuRutaHoy").getByRole("button", { name: "Vaciar la ruta" }).click();
    await expect(page.locator("#textoVaciaRutas")).toHaveText("Todavía no armaste la ruta.");
    await page.locator("#btnArmarRuta").click();
    await page.locator(".hojaArmarRuta").getByRole("button", { name: /Zona Este|Una ruta guardada|Otra ruta guardada/ }).first().click();
    const guardadas = page.locator(".hojaRutasGuardadas");
    if (await guardadas.isVisible()) {
        await expect(guardadas).toContainText("3 comercios · los lunes");
        await guardadas.getByRole("button", { name: /Zona Este/ }).first().click();
    } else {
        await page.locator(".hojaArmarRuta").getByRole("button", { name: "Armar la ruta" }).click();
    }
    await expect(page.locator(".paradaOrden")).toHaveCount(3);

    // Paradas: la lupa va primera en la fila de filtros y busca.
    await page.locator("#btnParadasRutas").click();
    const filtros = page.locator("#filtrosParadas");
    await expect(filtros.locator(".pzLupa")).toBeVisible();
    await expect(filtros.getByRole("button", { name: /Todas/ })).toContainText("3");
    await filtros.getByRole("button", { name: "Buscar parada" }).click();
    await page.locator("#buscarParadas").fill("kiosco 3");
    await expect(page.locator("#listaRutaOrdenada .paradaOrden")).toHaveCount(1);
    await expect(page.locator("#listaRutaOrdenada .agarreParada")).toHaveCount(0);
    await filtros.getByRole("button", { name: "Cerrar el buscador" }).click();
    await expect(page.locator("#listaRutaOrdenada .paradaOrden")).toHaveCount(3);
    // El atrás del celular cierra Paradas y vuelve al mapa.
    await page.evaluate(() => window.rutasVendeFrio.atras());
    await expect(pantalla).not.toHaveClass(/conParadasAbiertas/);
});

test("rutas: horarios de las paradas y completar los datos", async ({ page }) => {
    // Lunes 10:00, para que los horarios den siempre lo mismo.
    await page.clock.setFixedTime(new Date("2026-11-02T10:00:00-03:00"));
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: -34.600, longitude: -58.380 });
    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Repartidor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();

    await page.evaluate(() => {
        [
            { nombre: "Almacén Uno", horario: "Todos los días · 8 a 20", diaVisita: "Lunes", minutosEnComercio: 30 },
            { nombre: "Bar Dos", minutosEnComercio: 30 },
            { nombre: "Kiosco Tres", horario: "Lun a vie · 8 a 10:30" },
            { nombre: "Despensa Cuatro", horario: "Sáb · 9 a 13" }
        ].forEach(({ nombre, ...datos }, i) => {
            agregarComercio({ nombre, direccion: "Calle " + (i + 1), lat: -34.600, lng: -58.380 + (i + 1) * 0.003 });
            actualizarComercioPorNombre(nombre, datos);
        });
    });
    await page.locator(".bottom-nav").getByRole("button", { name: "Más", exact: true }).click();
    await page.locator("#masAccesos").getByRole("button", { name: /Rutas/ }).click();
    await expect(page.locator("#mapaRuta.leaflet-container")).toBeVisible();
    const nombres = ["Almacén Uno", "Bar Dos", "Kiosco Tres", "Despensa Cuatro"];
    await page.evaluate(nombres => armarRutaCon(nombres, { guardada: { id: "r1", nombre: "Zona Este", dia: "lunes", comercios: nombres } }), nombres);
    const paradas = page.locator(".paradaOrden");
    await expect(paradas).toHaveCount(4);
    expect(await paradas.evaluateAll(lista => lista.map(parada => parada.dataset.nombre))).toEqual(nombres);

    // Kiosco Tres cierra 10:30 y llegás pasadas las 11; Despensa Cuatro hoy no abre.
    const cierran = page.locator("#cierranAntesRutas");
    await expect(cierran).toHaveText("2 cierran antes de que lleguesOrdenar");
    // Bar Dos sin horario y tres sin el día de la ruta (lunes).
    await expect(page.locator("#faltanDatosRutas")).toHaveText("Faltan datos de 3 comerciosCompletar");
    await capturar(page, "rutas-04-horarios");

    await page.locator("#btnParadasRutas").click();
    await expect(paradas.nth(0).locator(".chipHorarioParada")).toHaveText("Abierto hasta 20:00");
    await expect(paradas.nth(1).locator("[data-agregar-dato='horario']")).toContainText("Agregar horario");
    await expect(paradas.nth(2).locator(".chipHorarioParada")).toHaveText(/^Cerró 10:30$/);
    await expect(paradas.nth(3).locator(".chipHorarioParada")).toHaveText("Hoy no abre");
    await capturar(page, "rutas-05-paradas-con-horario");
    await page.getByRole("button", { name: "Volver al mapa" }).click();

    // «Ordenar»: primero el que cierra antes; el que hoy no abre sigue avisado.
    await cierran.click();
    await expect(paradas.first()).toHaveAttribute("data-nombre", "Kiosco Tres");
    await expect(cierran).toHaveText("1 cierra antes de que lleguesOrdenar");

    // «Completar»: guardar el lunes de uno y el horario de otro desde ahí.
    await page.locator("#faltanDatosRutas").click();
    const completar = page.getByRole("dialog", { name: "Completar los datos" });
    await expect(completar.locator(".filaCompletarRuta")).toHaveCount(3);
    await capturar(page, "rutas-06-completar-datos");
    await completar.locator(".filaCompletarRuta", { hasText: "Kiosco Tres" }).getByRole("button", { name: "Guardar los lunes" }).click();
    await expect(completar.locator(".filaCompletarRuta")).toHaveCount(2);
    expect(await page.evaluate(() => buscarComercioPorNombre("Kiosco Tres").diaVisita)).toBe("Lunes");
    // Agregar horario: se va esta hoja, sube la de los datos y, al guardar,
    // vuelve «Completar los datos» (a Bar Dos le queda solo el día).
    await completar.locator(".filaCompletarRuta", { hasText: "Bar Dos" }).getByRole("button", { name: "Agregar horario" }).click();
    const datos = page.getByRole("dialog", { name: "Datos del comercio" });
    await expect(datos.locator(".datosHorario")).toBeVisible();
    await datos.locator('[data-dia="0"]').click();
    await datos.getByRole("button", { name: "Guardar" }).click();
    await expect(completar).toBeVisible();
    await expect(completar.locator(".filaCompletarRuta", { hasText: "Bar Dos" }).getByRole("button")).toHaveText(["Guardar los lunes"]);
    expect(await page.evaluate(() => buscarComercioPorNombre("Bar Dos").horario)).toBe("Lun · 8 a 13 y 17 a 21");
});

test("rutas: el depósito también desde Más > Cuenta", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Repartidor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.locator(".bottom-nav").getByRole("button", { name: "Más", exact: true }).click();
    await page.locator('[data-config-seccion="cuenta"]').click();
    const fila = page.getByRole("button", { name: "Depósito" });
    await expect(fila).toContainText("+ Agregar dirección del depósito");
    await fila.click();
    await expect(page.locator("#pantallaRutas")).toBeVisible();
    const hoja = page.getByRole("dialog", { name: "Dónde está el depósito" });
    await expect(hoja).toBeVisible();
    await hoja.locator("#direccionLugarRutas").fill("Av. Rivadavia 1234");
    await hoja.getByRole("button", { name: "Marcarlo en el mapa" }).click();
    await expect(page.locator("#barraMoverPin")).toContainText("Tocá en el mapa");
    const mapa = await page.locator("#mapaRuta").boundingBox();
    await page.mouse.click(mapa.x + mapa.width / 2, mapa.y + mapa.height / 2);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("vendefrio_preferencias") || "{}").lugares?.deposito?.direccion)).toBe("Av. Rivadavia 1234");
    await page.evaluate(() => mostrarPantalla("mas"));
    await page.locator('[data-config-seccion="cuenta"]').click();
    await expect(page.getByRole("button", { name: "Depósito" })).toContainText("Av. Rivadavia 1234");
});
