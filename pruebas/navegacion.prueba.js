// VendeFrío - Navegación propia (Etapa 5, T41 y T42): desde la ficha del
// comercio, "Ir" abre el mapa con la línea del camino, la próxima maniobra y
// la hoja con los datos del comercio; al llegar, deslizar "Llegué" lo marca
// visitado.
// El GPS es falso y el camino (que en la app calcula el OSRM público) lo
// contesta la prueba, así no hace falta internet.
const { test, expect, capturar, deslizar } = require("./ayudas");
const { registrarDistribuidora } = require("./recorridos");

test.use({ nube: true });

const COMERCIO = { lat: -34.6, lng: -58.4 };
const SALIDA = { latitude: -34.605, longitude: -58.405 };
const ESQUINA = [-58.4, -34.605];

// Camino falso: al este por Rivadavia, a la izquierda por Belgrano y llegada.
const CAMINO = {
    code: "Ok",
    routes: [{
        distance: 1015,
        duration: 240,
        geometry: { type: "LineString", coordinates: [[SALIDA.longitude, SALIDA.latitude], ESQUINA, [COMERCIO.lng, COMERCIO.lat]] },
        legs: [{
            steps: [
                { name: "Rivadavia", maneuver: { type: "depart", modifier: "", location: [SALIDA.longitude, SALIDA.latitude] } },
                { name: "Belgrano", maneuver: { type: "turn", modifier: "left", location: ESQUINA } },
                { name: "", maneuver: { type: "arrive", modifier: "", location: [COMERCIO.lng, COMERCIO.lat] } }
            ]
        }]
    }]
};

test("navegación: ir al comercio con indicaciones y marcar la llegada", async ({ page }, testInfo) => {
    // Lo que dice la voz queda anotado para revisarlo.
    await page.addInitScript(() => {
        window.__dichos = [];
        if (window.speechSynthesis) {
            // Cada frase "termina" enseguida, así pasa la que sigue en la fila (T131).
            window.speechSynthesis.speak = frase => {
                window.__dichos.push(frase.text);
                setTimeout(() => frase.onend && frase.onend(), 30);
            };
        }
    });
    // T133: el camino se pide siempre con el perfil de auto (sin pasos peatonales).
    const pedidosDeCamino = [];
    await page.route("https://routing.openstreetmap.de/**", ruta => {
        pedidosDeCamino.push(ruta.request().url());
        return ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CAMINO) });
    });
    page.on("request", pedido => {
        if (pedido.url().includes("router.project-osrm.org")) pedidosDeCamino.push(pedido.url());
    });
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation(SALIDA);

    await registrarDistribuidora(page, testInfo);
    await page.evaluate(({ lat, lng }) =>
        agregarComercio({ nombre: "Kiosco La Esquina", direccion: "Belgrano 450", telefono: "11 4444-0000", lat, lng, origenGps: "gps" }),
    COMERCIO);

    // Comercios > ficha > "Ir".
    await page.locator(".bottom-nav").getByRole("button", { name: "Comercios" }).click();
    await page.locator(".comercioCard", { hasText: "Kiosco La Esquina" }).locator("h3").click();
    await page.locator(".modalFichaComercio").getByRole("button", { name: "Más opciones" }).click();
    await page.locator(".modalFichaComercio").getByRole("link", { name: "Ir", exact: true }).click();

    // T154: la primera vez, una hoja pregunta cómo ir.
    const eleccion = page.getByRole("dialog", { name: "¿Cómo querés ir?" });
    await expect(eleccion).toBeVisible();
    await expect(eleccion.getByRole("button", { name: "Google Maps" })).toBeVisible();
    await expect(eleccion).toContainText("Lo podés cambiar cuando quieras en Más > Recorrido.");
    await capturar(page, "navegacion-00-como-queres-ir");
    await eleccion.getByRole("button", { name: "Navegación de VendeFrío" }).click();
    await expect(eleccion).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vendefrio_preferencias")).navegador)).toBe("app");

    const navegacion = page.locator("#pantallaNavegacion");
    await expect(navegacion).toBeVisible();
    await expect(page.locator(".bottom-nav")).toBeHidden();
    await expect(navegacion.locator(".nombreNavegacion")).toHaveText("Kiosco La Esquina");
    await expect(navegacion.locator(".textoManiobra")).toHaveText("Doblá a la izquierda por Belgrano");
    await expect(navegacion.locator(".distanciaManiobra")).toHaveText(/m$/);
    await expect(navegacion.locator(".tiempoNavegacion")).toHaveText(/min/);
    await expect(navegacion.locator("path.lineaCamino")).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => window.__dichos.join(" | "))).toContain("doblá a la izquierda por Belgrano");
    await capturar(page, "navegacion-01-camino");

    // La hoja se abre hacia arriba con más datos.
    await navegacion.getByRole("button", { name: "Ver más datos del comercio" }).click();
    await expect(navegacion.locator(".hojaMas")).toBeVisible();
    await expect(navegacion.getByRole("link", { name: "Abrir en Google Maps" })).toBeVisible();
    await capturar(page, "navegacion-02-hoja-abierta");
    await navegacion.getByRole("button", { name: "Ver más datos del comercio" }).click();

    // Silenciar la voz.
    await navegacion.getByRole("button", { name: "Silenciar la voz" }).click();
    await expect(navegacion.getByRole("button", { name: "Prender la voz" })).toBeVisible();
    await navegacion.getByRole("button", { name: "Prender la voz" }).click();

    // T132: al avanzar por Rivadavia, la línea se borra detrás y arranca donde estás.
    const largoDeLaLinea = () => page.evaluate(() => document.querySelector("#pantallaNavegacion path.lineaCamino").getTotalLength());
    const largoAlSalir = await largoDeLaLinea();
    await page.context().setGeolocation({ latitude: SALIDA.latitude, longitude: -58.4015 });
    await expect.poll(largoDeLaLinea).toBeLessThan(largoAlSalir * 0.8);
    await expect(navegacion.locator("path.lineaHecha")).toHaveCount(1);
    await expect(navegacion.locator(".textoManiobra")).toHaveText("Doblá a la izquierda por Belgrano");
    await capturar(page, "navegacion-02b-linea-recortada");

    // T170: minimizar, usar otra pantalla y volver con la burbuja, donde estaba.
    await navegacion.getByRole("button", { name: "Minimizar la navegación" }).click();
    await expect(navegacion).toBeHidden();
    const burbuja = page.getByRole("button", { name: "Volver a la navegación" });
    await expect(burbuja).toBeVisible();
    await expect(burbuja).toContainText("min");
    await expect(page.locator(".bottom-nav")).toBeVisible();
    await page.locator(".bottom-nav").getByRole("button", { name: "Pedidos" }).click();
    await capturar(page, "navegacion-02c-minimizada");
    // Sigue andando: el GPS avanza y la línea se sigue recortando.
    const largoAntes = await largoDeLaLinea();
    await page.context().setGeolocation({ latitude: SALIDA.latitude, longitude: -58.4008 });
    await expect.poll(largoDeLaLinea).toBeLessThan(largoAntes);
    // Arrastrarla al otro lado la deja pegada al borde izquierdo.
    const caja = await burbuja.boundingBox();
    await page.mouse.move(caja.x + 30, caja.y + 30);
    await page.mouse.down();
    await page.mouse.move(60, caja.y - 40, { steps: 6 });
    await page.mouse.up();
    await expect(burbuja).toHaveCSS("left", "12px");
    await expect(navegacion).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vendefrio_burbujaNavegacion")).lado)).toBe("izq");
    await burbuja.click();
    await expect(navegacion).toBeVisible();
    await expect(burbuja).toBeHidden();
    await expect(page.locator(".bottom-nav")).toBeHidden();
    await expect(navegacion.locator(".nombreNavegacion")).toHaveText("Kiosco La Esquina");
    await expect(navegacion.locator(".textoManiobra")).toHaveText("Doblá a la izquierda por Belgrano");
    // El atrás del celular no corta la navegación: la minimiza, igual que el botón.
    await expect.poll(() => page.evaluate(() => window.lugarVendeFrio.frenaElAtras())).toBe(true);
    await page.evaluate(() => window.lugarVendeFrio.atrasDelCelular());
    await expect(navegacion).toBeHidden();
    await expect(burbuja).toBeVisible();
    await burbuja.click();
    await expect(navegacion).toBeVisible();
    // «Ir» al mismo comercio con la navegación minimizada también la trae, sin empezar de nuevo.
    await navegacion.getByRole("button", { name: "Minimizar la navegación" }).click();
    await page.locator(".bottom-nav").getByRole("button", { name: "Comercios" }).click();
    await page.locator(".comercioCard", { hasText: "Kiosco La Esquina" }).locator("h3").click();
    await page.locator(".modalFichaComercio").getByRole("button", { name: "Más opciones" }).click();
    await page.locator(".modalFichaComercio").getByRole("link", { name: "Ir", exact: true }).click();
    await expect(navegacion).toBeVisible();
    await expect(navegacion.locator("path.lineaHecha")).toHaveCount(1);
    await expect.poll(largoDeLaLinea).toBeLessThan(largoAntes);

    expect(pedidosDeCamino.length).toBeGreaterThan(0);
    pedidosDeCamino.forEach(url => expect(url).toMatch(/^https:\/\/routing\.openstreetmap\.de\/routed-car\/route\/v1\/driving\//));

    // Llegada.
    await page.context().setGeolocation({ latitude: COMERCIO.lat, longitude: COMERCIO.lng });
    await expect(navegacion.locator(".tiempoNavegacion")).toHaveText("Llegaste");
    await expect.poll(() => page.evaluate(() => window.__dichos.join(" | "))).toContain("Llegaste a Kiosco La Esquina");
    await capturar(page, "navegacion-03-llegaste");

    // En ruta (T179): «Cargar pedido» abre el Nuevo pedido como bandeja
    // encima de la navegación. El atrás del celular, tocar el mapa de arriba
    // o su X la cierran y se sigue navegando; al guardarlo también.
    const cargarPedido = navegacion.getByRole("button", { name: "Cargar pedido" });
    const bandeja = page.locator("#pantallaPedido.pedidoEnHoja");
    const abrirBandeja = async () => {
        if (!(await cargarPedido.isVisible())) await navegacion.locator(".tarjetaParada, .cartelParada").first().click();
        await cargarPedido.click();
        await expect(bandeja).toBeVisible();
        await expect(navegacion).toBeVisible();
        await expect(page.locator("#cliente")).toHaveValue("Kiosco La Esquina");
    };
    await abrirBandeja();
    await page.evaluate(() => window.lugarVendeFrio.atrasDelCelular());
    await expect(bandeja).toBeHidden();
    await expect(navegacion).toBeVisible();
    await expect(burbuja).toBeHidden();
    await abrirBandeja();
    await page.locator("#fondoPedidoNavegacion").click({ position: { x: 20, y: 20 } });
    await expect(bandeja).toBeHidden();
    await expect(navegacion).toBeVisible();
    await abrirBandeja();
    // Solo su X arriba: ni flechas ni casita que lleven a otra pantalla.
    await expect(bandeja.getByRole("button", { name: /^(Volver|Ir a Inicio)/ })).toHaveCount(0);
    await bandeja.getByRole("button", { name: "Cerrar el pedido" }).click();
    await expect(bandeja).toBeHidden();
    await expect(navegacion).toBeVisible();
    await abrirBandeja();
    if (await page.locator(".tituloMarca").first().getAttribute("aria-expanded") === "false") {
        await page.locator(".tituloMarca").first().click();
    }
    await page.locator(".listaProdutos .fila").first().getByRole("button", { name: "Aumentar cantidad" }).click();
    await capturar(page, "navegacion-03b-pedido-encima");
    await page.locator("#generar").click();
    await expect(bandeja).toBeHidden();
    const ventanaPedido = page.locator("#modalPedido");
    await expect(ventanaPedido).toBeVisible();
    await expect(navegacion).toBeVisible();
    await ventanaPedido.click({ position: { x: 10, y: 10 } });
    await expect(navegacion).toBeVisible();
    await expect(page.getByRole("button", { name: "Volver a la navegación" })).toBeHidden();

    await deslizar(page, "Deslizá para marcar Llegué");
    await expect(navegacion).toBeHidden();
    await expect(page.locator(".bottom-nav")).toBeVisible();
    const visitado = await page.evaluate(() => estaVisitadoEstaSemana(buscarComercioPorNombre("Kiosco La Esquina")));
    expect(visitado).toBe(true);
});

// T154: si se elige Google Maps, se abre Google Maps y la hoja no vuelve a
// salir; quien ya había elegido en Más > Recorrido tampoco la ve.
test("navegación: elegir Google Maps la primera vez que se toca Ir", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(({ lat, lng }) =>
        agregarComercio({ nombre: "Kiosco La Esquina", direccion: "Belgrano 450", lat, lng, origenGps: "gps" }),
    COMERCIO);
    // Google Maps de mentira: no hace falta internet.
    await page.context().route("https://www.google.com/**", ruta => ruta.fulfill({ status: 200, contentType: "text/html", body: "Google Maps" }));

    const tocarIr = async () => {
        await page.locator(".bottom-nav").getByRole("button", { name: "Comercios" }).click();
        await page.locator(".comercioCard", { hasText: "Kiosco La Esquina" }).locator("h3").click();
        await page.locator(".modalFichaComercio").getByRole("button", { name: "Más opciones" }).click();
        await page.locator(".modalFichaComercio").getByRole("link", { name: "Ir", exact: true }).click();
    };
    const eleccion = page.getByRole("dialog", { name: "¿Cómo querés ir?" });

    await tocarIr();
    await expect(eleccion).toBeVisible();
    const [googleMaps] = await Promise.all([
        page.waitForEvent("popup"),
        eleccion.getByRole("button", { name: "Google Maps" }).click()
    ]);
    // La ventana nueva abre en blanco y recién después va a Google Maps.
    await googleMaps.waitForURL(/google\.com\/maps\/dir\//);
    await googleMaps.close();
    await expect(eleccion).toBeHidden();
    await expect(page.locator("#pantallaNavegacion")).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vendefrio_preferencias")).navegador)).toBe("google");

    // La segunda vez va derecho a Google Maps.
    await page.evaluate(() => window.cerrarFichaComercio());
    const [otraVez] = await Promise.all([page.waitForEvent("popup"), tocarIr()]);
    await otraVez.close();
    await expect(eleccion).toHaveCount(0);

    // Quien ya eligió en Más > Recorrido no ve la hoja.
    await page.evaluate(() => {
        const datos = JSON.parse(localStorage.getItem("vendefrio_preferencias"));
        localStorage.setItem("vendefrio_preferencias", JSON.stringify({ ...datos, navegador: "app" }));
        window.cerrarFichaComercio();
    });
    await tocarIr();
    await expect(page.locator("#pantallaNavegacion")).toBeVisible();
    await expect(eleccion).toHaveCount(0);
});

// "Visité, sin pedido" también navegando: pide el motivo, deja la parada
// visitada y sigue con la próxima.
test("navegación: visité sin pedido pasa a la parada que sigue", async ({ page }, testInfo) => {
    await page.route("https://routing.openstreetmap.de/**", ruta =>
        ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CAMINO) }));
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation(SALIDA);
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(({ lat, lng }) => {
        agregarComercio({ nombre: "Kiosco La Esquina", direccion: "Belgrano 450", lat, lng, origenGps: "gps" });
        agregarComercio({ nombre: "Almacén Rivadavia", direccion: "Rivadavia 900", lat: lat - 0.002, lng, origenGps: "gps" });
        return window.navegacionVendeFrio.abrir(["Kiosco La Esquina", "Almacén Rivadavia"]);
    }, COMERCIO);

    const navegacion = page.locator("#pantallaNavegacion");
    await expect(navegacion.locator(".nombreNavegacion")).toHaveText("Kiosco La Esquina");
    // La hoja de la parada se abre tocando la tarjeta de abajo.
    await navegacion.locator(".paradaActualNavegacion").click();
    // La flechita de la hoja solo la achica: la navegación sigue.
    await navegacion.getByRole("button", { name: "Achicar la tarjeta" }).click();
    await expect(navegacion.locator(".hojaNavegacion")).toBeHidden();
    await expect(navegacion).toBeVisible();
    await expect(navegacion.locator(".paradaActualNavegacion")).toBeVisible();
    await navegacion.locator(".paradaActualNavegacion").click();
    const sinPedido = navegacion.getByRole("button", { name: "Visité, sin pedido" });
    await expect(sinPedido).toBeVisible();
    await expect(navegacion.locator(".hojaAcciones").getByRole("button", { name: "Cargar pedido" })).toBeVisible();
    await capturar(page, "navegacion-04-visite-sin-pedido");
    await sinPedido.click();

    const hoja = page.getByRole("dialog", { name: "¿Por qué no hubo pedido?" });
    await expect(hoja).toContainText("Kiosco La Esquina");
    await hoja.getByRole("button", { name: "Estaba cerrado" }).click();
    await hoja.getByRole("button", { name: "Guardar visita" }).click();
    await expect(hoja).toBeHidden();

    await expect(navegacion).toBeVisible();
    await expect(navegacion.locator(".nombreNavegacion")).toHaveText("Almacén Rivadavia");
    expect(await page.evaluate(() => estaVisitadoEstaSemana(buscarComercioPorNombre("Kiosco La Esquina")))).toBe(true);
    expect(await page.evaluate(() => window.visitasVendeFrio.visitasDelComercio("Kiosco La Esquina").length)).toBe(1);
});
