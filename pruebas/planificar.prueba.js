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

test("planificar: vista previa con 2 recorridos, Iniciar y Paradas", async ({ page }) => {
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: -34.600, longitude: -58.380 });
    // Dos caminos: el más rápido (13 min, 5,2 km) y, sin autopistas, otro
    // un poco más largo (16 min, 6,1 km) que pasa más al norte.
    const pedidos = [];
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
                legs: []
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
    await sinAutopistas.click();
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
