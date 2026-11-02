// VendeFrío - Navegando, «Sumar parada» desde el ⋯ (repaso de Rutas, 2026-11-02):
// tocar un comercio pregunta «¿Cuándo vamos?» (de paso o ahora) y, manteniendo
// apretado, se eligen varios y se suman de paso. El GPS es falso y el camino,
// sin internet, va en línea recta.
const { test, expect, capturar } = require("./ayudas");

const SALIDA = { latitude: -34.605, longitude: -58.405 };
const COMERCIOS = [
    { nombre: "Almacén Uno", lat: -34.6, lng: -58.4 },
    { nombre: "Bar Dos", lat: -34.6, lng: -58.39 },
    { nombre: "Kiosco De Paso", lat: -34.6, lng: -58.395 },
    { nombre: "Super Lejos", lat: -34.65, lng: -58.5 },
    { nombre: "Despensa Ahora", lat: -34.603, lng: -58.403 }
];

test("sumar parada: de paso, ahora y varios manteniendo apretado", async ({ page }) => {
    await page.route("https://routing.openstreetmap.de/**", ruta => ruta.abort());
    await page.route("https://valhalla1.openstreetmap.de/**", ruta => ruta.abort());
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation(SALIDA);
    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Repartidor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(comercios => comercios.forEach((comercio, i) =>
        agregarComercio({ ...comercio, direccion: "Calle " + (i + 1), origenGps: "gps" })), COMERCIOS);

    await page.evaluate(() => window.navegacionVendeFrio.abrir(["Almacén Uno", "Bar Dos"]));
    const navegacion = page.locator("#pantallaNavegacion");
    await expect(navegacion).toBeVisible();
    // Sin «Avisar»: un solo ⋯ con todo.
    await expect(navegacion.getByRole("button", { name: "Avisar al equipo" })).toHaveCount(0);
    await navegacion.getByRole("button", { name: "Opciones de la navegación" }).click();
    const menu = page.locator(".menuNavegacion");
    await expect(menu.getByRole("button", { name: /Ver todas las paradas/ })).toContainText("2");
    await capturar(page, "sumarParada-01-menu");
    await menu.getByRole("button", { name: "Sumar parada" }).click();

    // Los que quedan cerca del camino, con lo que suman.
    const hoja = page.getByRole("dialog", { name: "Sumar parada" });
    await expect(hoja.getByRole("button", { name: /Cerca del camino/ })).toHaveAttribute("aria-pressed", "true");
    const filas = hoja.locator(".filaSumarParada");
    await expect(filas.first()).toContainText("Kiosco De Paso");
    await expect(filas.filter({ hasText: "Super Lejos" })).toHaveCount(0);
    await expect(filas.first().locator(".minutosSumarParada")).toHaveText(/^\+\d+ min$/);
    await capturar(page, "sumarParada-02-hoja");

    // De paso: entre la 1 y la 2.
    await filas.filter({ hasText: "Kiosco De Paso" }).click();
    const cuando = page.getByRole("dialog", { name: "Cuándo vamos a Kiosco De Paso" });
    await expect(cuando.locator('[data-cuando="paso"]')).toContainText("entre la 1 y la 2");
    await capturar(page, "sumarParada-03-cuando");
    await cuando.getByRole("button", { name: "Sumar a la ruta" }).click();
    await expect.poll(() => page.evaluate(() => window.navegacionVendeFrio.paradasQueSiguen().map(comercio => comercio.nombre)))
        .toEqual(["Kiosco De Paso", "Bar Dos"]);

    // Ahora: pasa a ser la parada de ahora.
    await navegacion.getByRole("button", { name: "Opciones de la navegación" }).click();
    await menu.getByRole("button", { name: "Sumar parada" }).click();
    await hoja.locator(".filaSumarParada", { hasText: "Despensa Ahora" }).click();
    const ahora = page.getByRole("dialog", { name: "Cuándo vamos a Despensa Ahora" });
    await ahora.locator('[data-cuando="ahora"]').click();
    await expect(ahora.locator('[data-cuando="ahora"]')).toHaveAttribute("aria-pressed", "true");
    await ahora.getByRole("button", { name: "Sumar a la ruta" }).click();
    await expect.poll(() => page.evaluate(() => window.navegacionVendeFrio.paradaActual()?.nombre)).toBe("Despensa Ahora");

    // Varios: mantener apretado uno, marcar todos y sumarlos de paso.
    await navegacion.getByRole("button", { name: "Opciones de la navegación" }).click();
    await menu.getByRole("button", { name: "Sumar parada" }).click();
    await hoja.getByRole("button", { name: /^Todos/ }).click();
    const lejos = hoja.locator(".filaSumarParada", { hasText: "Super Lejos" });
    const caja = await lejos.boundingBox();
    await page.mouse.move(caja.x + 40, caja.y + caja.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await expect(hoja.locator(".cuantosSumarParada")).toHaveText("1 elegido");
    await expect(lejos).toHaveAttribute("aria-checked", "true");
    await capturar(page, "sumarParada-04-varios");
    await hoja.getByRole("button", { name: "Sumar 1 de paso" }).click();
    await expect(hoja).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.navegacionVendeFrio.paradasQueSiguen().map(comercio => comercio.nombre)))
        .toContain("Super Lejos");
});

test("reloj del comercio: arranca al llegar y guarda el promedio en la ficha", async ({ page }) => {
    await page.clock.install();
    await page.route("https://routing.openstreetmap.de/**", ruta => ruta.abort());
    await page.route("https://valhalla1.openstreetmap.de/**", ruta => ruta.abort());
    await page.addInitScript(() => {
        if (window.speechSynthesis) window.speechSynthesis.speak = frase => setTimeout(() => frase.onend && frase.onend(), 30);
        navigator.geolocation.watchPosition = exito => {
            window.__gps = (lat, lng) => exito({ coords: { latitude: lat, longitude: lng, speed: 0, accuracy: 5, heading: null }, timestamp: Date.now() });
            return 1;
        };
        navigator.geolocation.clearWatch = () => {};
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Repartidor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(comercios => comercios.slice(0, 2).forEach((comercio, i) =>
        agregarComercio({ ...comercio, direccion: "Calle " + (i + 1), origenGps: "gps" })), COMERCIOS);

    await page.evaluate(() => window.navegacionVendeFrio.abrir(["Almacén Uno", "Bar Dos"]));
    const navegacion = page.locator("#pantallaNavegacion");
    await expect(navegacion).toBeVisible();
    await page.evaluate(({ latitude, longitude }) => window.__gps(latitude, longitude), SALIDA);
    // Llegás: arranca el reloj.
    await page.evaluate(({ lat, lng }) => window.__gps(lat, lng), COMERCIOS[0]);
    const reloj = navegacion.locator(".relojComercioNav");
    await expect(reloj).toHaveText("0' en Almacén Uno");
    await page.clock.fastForward("12:00");
    await expect(reloj).toHaveText("12' en Almacén Uno");
    await navegacion.getByRole("button", { name: "Achicar la tarjeta" }).click();
    await capturar(page, "sumarParada-05-reloj");
    // Te alejás: se para y queda el promedio en el comercio.
    await page.evaluate(({ lat, lng }) => window.__gps(lat, lng + 0.003), COMERCIOS[0]);
    await expect(reloj).toBeHidden();
    expect(await page.evaluate(() => buscarComercioPorNombre("Almacén Uno").minutosEnComercio)).toBe(12);
    await page.evaluate(() => window.navegacionVendeFrio.cerrar());
    await page.evaluate(() => window.abrirFichaComercio("Almacén Uno"));
    await expect(page.locator(".fichaTiempo")).toContainText("Tiempo promedio en este comercio12 min");
});

test("cierre de ruta: al terminar la última parada y desde el ⋯", async ({ page }) => {
    await page.route("https://routing.openstreetmap.de/**", ruta => ruta.abort());
    await page.route("https://valhalla1.openstreetmap.de/**", ruta => ruta.abort());
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation(SALIDA);
    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Repartidor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(comercios => comercios.slice(0, 2).forEach((comercio, i) => {
        agregarComercio({ ...comercio, direccion: "Calle " + (i + 1), origenGps: "gps" });
        if (i === 0) actualizarComercioPorNombre(comercio.nombre, { minutosEnComercio: 12, tiemposEnComercio: [10, 14] });
    }), COMERCIOS);
    await page.locator(".bottom-nav").getByRole("button", { name: "Más", exact: true }).click();
    await page.locator("#masAccesos").getByRole("button", { name: /Rutas/ }).click();
    await page.evaluate(() => armarRutaCon(["Almacén Uno", "Bar Dos"]));
    await expect(page.locator(".paradaOrden")).toHaveCount(2);

    // Iniciar y marcar las dos llegadas: al terminar, el cierre.
    await page.locator("#btnNavegarRuta").click();
    await expect(page.locator("#pantallaNavegacion")).toBeVisible();
    await page.evaluate(() => window.navegacionVendeFrio.siguiente());
    await page.evaluate(() => window.navegacionVendeFrio.siguiente());
    const cierre = page.getByRole("dialog", { name: "Cierre de ruta" });
    await expect(cierre).toBeVisible();
    await expect(cierre.locator(".numeroPlanRutas").first()).toHaveText("2 de 2paradas");
    await expect(cierre.locator(".numeroPlanRutas").nth(1)).toContainText("tardaste · la app decía");
    await expect(cierre.locator(".aprendidoCierreRuta")).toHaveText("En Almacén Uno tardás unos 12 min");
    await capturar(page, "sumarParada-06-cierre");
    await cierre.getByRole("button", { name: "Listo" }).click();
    await expect(cierre).toBeHidden();
    const guardado = await page.evaluate(() => ({
        hechas: JSON.parse(localStorage.getItem("vendefrio_rutasHechas") || "[]"),
        enCurso: localStorage.getItem("vendefrio_rutaEnCurso")
    }));
    expect(guardado.hechas).toHaveLength(1);
    expect(guardado.hechas[0]).toMatchObject({ paradas: 2, hechas: 2 });
    expect(guardado.enCurso).toBeNull();

    // También desde el ⋯ de la ruta.
    await page.evaluate(() => mostrarPantalla("rutas"));
    await page.locator("#btnMasRutas").click();
    await page.locator(".menuRutaHoy").getByRole("button", { name: "Cerrar la ruta" }).click();
    await expect(cierre).toBeVisible();
    await expect(cierre.locator(".numeroPlanRutas").nth(1)).toContainText("sin navegar");
});
