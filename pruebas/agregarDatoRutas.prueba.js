// VendeFrío - "+ Agregar dirección" en Rutas y en la navegación, en un
// celular chico (360×640). Al comercio que le falta la dirección (o el
// teléfono) se le agrega ahí mismo, con la hoja "Datos del comercio", sin
// salir de Rutas ni de la navegación. El GPS y los caminos son falsos.
const { test, expect, capturar } = require("./ayudas");

test.use({ viewport: { width: 360, height: 640 } });

async function prepararRutas(page) {
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: -34.600, longitude: -58.380 });
    await page.route("https://routing.openstreetmap.de/**", ruta => {
        const url = new URL(ruta.request().url());
        const puntos = url.pathname.split("/").pop().split(";").map(par => par.split(",").map(Number));
        return ruta.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ code: "Ok", routes: [{
                distance: 5200,
                duration: 780,
                geometry: { type: "LineString", coordinates: puntos },
                legs: puntos.slice(1).map(() => ({ duration: 780 / (puntos.length - 1), steps: [] }))
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
        agregarComercio({ nombre: "Kiosco Sin Datos", lat: -34.602, lng: -58.374 });
        agregarComercio({ nombre: "Almacén Mitre", direccion: "Mitre 900", telefono: "11 4444-2222", lat: -34.604, lng: -58.368 });
    });
}

test("rutas: agregar la dirección que falta sin salir de Rutas", async ({ page }) => {
    await prepararRutas(page);
    await page.evaluate(() => mostrarPantalla("rutas"));
    const pantalla = page.locator("#pantallaRutas");
    await pantalla.getByRole("button", { name: "Elegir" }).click();
    await page.locator("#seleccionarTodosRuta").click();
    await pantalla.getByRole("button", { name: "Volver al mapa" }).click();
    await pantalla.getByRole("button", { name: "Optimizar" }).click();
    await page.locator("#modalAviso").getByRole("button", { name: "Entendido" }).click();

    // En la tarjeta de la parada, en vez de "Sin dirección".
    const carrusel = page.locator("#proximaParadaRuta");
    await expect(carrusel.locator(".agregarDatoRuta")).toHaveText("Agregar dirección");
    await capturar(page, "agregarDato-01-carrusel");

    // En la lista de Paradas, igual.
    await pantalla.locator(".hojaPlanRutas").getByRole("button", { name: "Paradas" }).click();
    const fila = page.locator(".paradaOrden", { hasText: "Kiosco Sin Datos" });
    await expect(fila.locator(".agregarDatoRuta")).toHaveText("Agregar dirección");
    await capturar(page, "agregarDato-02-paradas");
    await fila.locator(".agregarDatoRuta").click();
    const datos = page.getByRole("dialog", { name: "Datos del comercio" });
    await expect(datos).toBeVisible();
    await expect(datos.locator("#modalDireccion")).toBeFocused();
    await capturar(page, "agregarDato-03-hoja-datos");
    await datos.locator("#modalDireccion").fill("Belgrano 45");
    await datos.getByRole("button", { name: "Guardar" }).click();
    await expect(datos).toBeHidden();
    // Sigue en Rutas, con la dirección nueva en la parada.
    await expect(pantalla).toBeVisible();
    await expect(fila).toContainText("Belgrano 45");
    await expect(fila.locator(".agregarDatoRuta")).toHaveCount(0);
});

test("navegación: agregar dirección y teléfono sin salir de la navegación", async ({ page }) => {
    await prepararRutas(page);
    await page.evaluate(() => window.navegacionVendeFrio.abrir(["Kiosco Sin Datos"]));
    const navegacion = page.locator("#pantallaNavegacion");
    await expect(navegacion).toBeVisible();
    await navegacion.locator(".paradaActualNavegacion").click();
    const hoja = navegacion.locator(".hojaNavegacion");
    await expect(hoja.getByRole("button", { name: "Agregar dirección" })).toBeVisible();
    await expect(hoja.getByRole("button", { name: "Agregar teléfono" })).toBeVisible();
    await capturar(page, "agregarDato-04-navegacion");

    await hoja.getByRole("button", { name: "Agregar teléfono" }).click();
    const datos = page.getByRole("dialog", { name: "Datos del comercio" });
    await expect(datos).toBeVisible();
    await expect(datos.locator("#modalTelefono")).toBeFocused();
    await datos.locator("#modalTelefono").fill("11 5555-1234");
    await datos.getByRole("button", { name: "Guardar" }).click();
    await expect(datos).toBeHidden();
    // Sigue navegando, y ahora se puede llamar.
    await expect(navegacion).toBeVisible();
    await expect(hoja.getByRole("link", { name: "Llamar" })).toBeVisible();
    await expect(hoja.getByRole("button", { name: "Agregar teléfono" })).toHaveCount(0);

    await hoja.getByRole("button", { name: "Agregar dirección" }).click();
    await expect(datos.locator("#modalDireccion")).toBeFocused();
    await datos.locator("#modalDireccion").fill("Belgrano 45");
    await datos.getByRole("button", { name: "Guardar" }).click();
    await expect(navegacion).toBeVisible();
    await expect(hoja.locator(".direccionNavegacion")).toHaveText("Belgrano 45");
});
