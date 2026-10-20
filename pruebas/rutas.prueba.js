// VendeFrío - Rutas con muchas paradas (T129), en modo personal y con un GPS
// falso: se eligen 12 comercios, la app ordena los 12 y Google Maps, que acepta
// hasta 9 paradas, recibe la ruta en dos partes.
const { test, expect, capturar } = require("./ayudas");

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
    await page.locator("#pantallaMenu header").getByRole("button", { name: "Más", exact: true }).click();
    await page.locator("#masAccesos").getByRole("button", { name: /Rutas/ }).click();
    await expect(page.locator("#mapaRuta.leaflet-container")).toBeVisible();
    await page.locator(".tarjetaSeleccionRuta > summary").click();
    await page.locator("#seleccionarTodosRuta").click();
    await expect(page.locator("#resumenPinesMapa")).toContainText("12 en la ruta");

    // La app ordena las 12 paradas, sin tope.
    await page.locator("#btnOptimizarRuta").click();
    const aviso = page.locator("#modalAviso");
    await expect(aviso).toContainText("Ruta optimizada");
    await expect(aviso).toContainText("12 paradas");
    await aviso.getByRole("button", { name: "Entendido" }).click();
    const paradas = page.locator(".paradaOrden");
    await expect(paradas).toHaveCount(12);
    const orden = await paradas.evaluateAll(lista => lista.map(parada => parada.dataset.nombre));
    expect(orden).toEqual(Array.from({ length: 12 }, (_, i) => "Kiosco " + String(i + 1).padStart(2, "0")));

    // Google Maps: avisa el límite y pasa la ruta en dos partes.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator("#btnGoogleMaps").click();
    const hoja = page.getByRole("dialog", { name: "Google Maps acepta hasta 9 paradas" });
    await expect(hoja).toContainText("Tu ruta tiene 12 paradas. Te la paso en 2 partes");
    await expect(hoja.getByRole("button", { name: "Parte 1 · paradas 1 a 9" })).toHaveClass(/pzBtnPri/);
    await expect(hoja.getByRole("button", { name: "Parte 2 · paradas 10 a 12" })).toBeVisible();
    await capturar(page, "rutas-01-google-maps-en-partes");
    await hoja.getByRole("button", { name: /Parte 1/ }).click();
    await expect(hoja).toBeHidden();

    // Al volver, la Parte 2 queda resaltada.
    await page.locator("#btnGoogleMaps").click();
    await expect(hoja.getByRole("button", { name: /Parte 2/ })).toHaveClass(/pzBtnPri/);
    await hoja.getByRole("button", { name: /Parte 2/ }).click();

    const abiertas = await page.evaluate(() => window.__abiertas);
    expect(abiertas).toHaveLength(2);
    const puntos = abiertas.map(url => url.replace("https://www.google.com/maps/dir//", "").split("/"));
    expect(puntos[0]).toHaveLength(9);
    expect(puntos[1]).toHaveLength(3);
    expect(puntos[0][0]).toBe("-34.6," + (-58.380 + 0.003));
});
