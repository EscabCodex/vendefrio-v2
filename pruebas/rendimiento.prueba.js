// VendeFrío - Rutas fluida en un celular barato (T141).
// Simula un celular de gama baja, como el que queda en la camioneta: el
// procesador frenado 6 veces y pantalla de 360×640, con un día cargado de
// verdad (80 comercios y 600 pedidos). Mide cuánto tarda en verse cada cosa
// de Rutas y de la navegación, y si la pantalla se traba al mover el mapa,
// bajar la lista o con cada posición del GPS. Falla si algo pasa su tope.
// El GPS y el camino son falsos (sin internet).
const { test, expect, capturar } = require("./ayudas");

// Sin grabar la prueba: la grabación copia la pantalla a cada rato y frena todo.
test.use({ viewport: { width: 360, height: 640 }, trace: "off" });

const SALIDA = { latitude: -34.600, longitude: -58.400 };
const COMERCIOS = 80;
const PEDIDOS = 600;

// Topes en milisegundos, con el procesador 6 veces más lento. Un toque tiene
// que responder antes de unos 300 ms para sentirse inmediato y una pantalla
// abrirse antes de un segundo. Antes de T141, optimizar tardaba 4,4 s y
// "Ya pasé" 3,4 s con estos datos.
const TOPES = {
    abrirRutas: 1000,
    elegirTodos: 600,
    tildarUno: 300,
    optimizar: 1500,
    saltearParada: 400,
    abrirNavegacion: 1000,
    posicionGps: 50
};
// Cuadros: el 95 % tiene que salir en menos de 120 ms (8 por segundo) y
// ninguno puede congelar la pantalla medio segundo.
const CUADRO_LENTO = 120;
const CUADRO_TRABADO = 500;

// Camino falso largo (como uno real de varios km): 1500 puntos.
function caminoFalso(desde, hasta) {
    const puntos = [];
    for (let i = 0; i <= 1500; i++) {
        const t = i / 1500;
        puntos.push([desde[0] + (hasta[0] - desde[0]) * t + Math.sin(i / 7) * 0.00005, desde[1] + (hasta[1] - desde[1]) * t]);
    }
    const pasos = [{ name: "Rivadavia", maneuver: { type: "depart", modifier: "", location: puntos[0] } }];
    for (let i = 100; i < 1500; i += 100) {
        pasos.push({ name: "Calle " + i, maneuver: { type: "turn", modifier: i % 200 ? "left" : "right", location: puntos[i] } });
    }
    pasos.push({ name: "", maneuver: { type: "arrive", modifier: "", location: puntos[1500] } });
    return { code: "Ok", routes: [{ distance: 4000, duration: 600, geometry: { type: "LineString", coordinates: puntos }, legs: [{ steps: pasos }] }] };
}

test("rendimiento: Rutas y la navegación en un celular lento y chico", async ({ page }, testInfo) => {
    test.setTimeout(240000);
    await page.addInitScript(() => {
        // Cuánto tarda la app en atender cada posición del GPS.
        window.__tiemposGps = [];
        const original = navigator.geolocation.watchPosition.bind(navigator.geolocation);
        navigator.geolocation.watchPosition = (exito, error, opciones) => original(posicion => {
            const inicio = performance.now();
            exito(posicion);
            window.__tiemposGps.push(performance.now() - inicio);
        }, error, opciones);
        if (window.speechSynthesis) window.speechSynthesis.speak = () => {};
        // Cuadros de la pantalla: cuánto pasa entre uno y otro.
        window.__cuadros = null;
        window.__empezarCuadros = () => {
            window.__cuadros = [];
            let antes = null;
            const contar = ahora => {
                if (!window.__cuadros) return;
                if (antes !== null) window.__cuadros.push(ahora - antes);
                antes = ahora;
                requestAnimationFrame(contar);
            };
            requestAnimationFrame(contar);
        };
        window.__terminarCuadros = () => {
            const cuadros = (window.__cuadros || []).slice().sort((a, b) => a - b);
            window.__cuadros = null;
            return {
                cuantos: cuadros.length,
                p95: Math.round(cuadros[Math.floor(cuadros.length * 0.95)] || 0),
                peor: Math.round(cuadros[cuadros.length - 1] || 0)
            };
        };
    });
    await page.route("https://routing.openstreetmap.de/**", ruta => {
        const partes = new URL(ruta.request().url()).pathname.split("/").pop().split(";").map(par => par.split(",").map(Number));
        return ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(caminoFalso(partes[0], partes[partes.length - 1])) });
    });
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation(SALIDA);

    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Repartidor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();

    // Un día cargado: 80 comercios con GPS y 600 pedidos (1 de cada 4 para entregar).
    await page.evaluate(({ comercios, pedidos }) => {
        const lista = Array.from({ length: comercios }, (_, i) => ({
            nombre: "Comercio " + String(i + 1).padStart(2, "0"),
            direccion: "Calle " + (i + 1) + " " + (100 + i * 7),
            telefono: "11 4000-" + String(1000 + i),
            lat: -34.600 + Math.sin(i * 1.7) * 0.03,
            lng: -58.400 + Math.cos(i * 2.3) * 0.03,
            origenGps: "gps"
        }));
        guardarComercios(lista);
        const ahora = Date.now();
        guardarHistorial(Array.from({ length: pedidos }, (_, i) => ({
            id: "p" + i,
            comercio: lista[i % comercios].nombre,
            fecha: new Date(ahora - i * 3600000).toLocaleDateString("es-AR"),
            timestamp: ahora - i * 3600000,
            productos: Array.from({ length: 10 }, (__, j) => ({ marca: "Marca " + (j % 3), nombre: "Producto " + j, cantidad: 1 + (i + j) % 6, precio: 1000 + j * 150 })),
            estados: { ["e" + i]: { estado: i % 4 === 0 ? "cargado" : "entregado", horaCelular: ahora - i * 3600000 } }
        })));
    }, { comercios: COMERCIOS, pedidos: PEDIDOS });

    // Celular de gama baja: el procesador 6 veces más lento.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });

    // Cuánto tarda una acción hasta que el cambio se ve (el cuadro siguiente).
    const medir = accion => page.evaluate(async accion => {
        const inicio = performance.now();
        new Function(accion)();
        await new Promise(listo => requestAnimationFrame(() => setTimeout(listo, 0)));
        return Math.round(performance.now() - inicio);
    }, accion);
    const cuadros = {};
    const medirCuadros = async (nombre, accion) => {
        await page.evaluate(() => window.__empezarCuadros());
        await accion();
        cuadros[nombre] = await page.evaluate(() => window.__terminarCuadros());
    };

    const tiempos = {};
    tiempos.abrirRutas = await medir("mostrarPantalla('rutas')");
    await expect(page.locator("#mapaRuta.leaflet-container")).toBeVisible();
    await page.locator(".tarjetaSeleccionRuta > summary").click();
    tiempos.elegirTodos = await medir("document.getElementById('seleccionarTodosRuta').click()");
    await expect(page.locator("#resumenPinesMapa")).toContainText(COMERCIOS + " en la ruta");
    tiempos.tildarUno = await medir("document.querySelector('#listaSeleccionRuta input').click()");
    await expect(page.locator("#resumenPinesMapa")).toContainText((COMERCIOS - 1) + " en la ruta");
    await page.locator("#listaSeleccionRuta input").first().check();
    await expect(page.locator("#resumenPinesMapa")).toContainText(COMERCIOS + " en la ruta");

    // Optimizar: la respuesta del GPS llega aparte, así que se espera la lista.
    tiempos.optimizar = await page.evaluate(async () => {
        const inicio = performance.now();
        document.getElementById("btnOptimizarRuta").click();
        while (!document.querySelector(".paradaOrden")) await new Promise(listo => setTimeout(listo, 5));
        await new Promise(listo => requestAnimationFrame(() => setTimeout(listo, 0)));
        return Math.round(performance.now() - inicio);
    });
    await page.locator("#modalAviso").getByRole("button", { name: "Entendido" }).click();
    await expect(page.locator(".paradaOrden")).toHaveCount(COMERCIOS);
    // Los pines muestran el número de cada parada.
    await expect(page.locator(".globoPinRuta b", { hasText: /^80$/ })).toHaveCount(1);
    const primera = await page.locator(".paradaOrden").first().getAttribute("data-nombre");
    tiempos.saltearParada = await medir("document.querySelector('#proximaParadaRuta [data-parada=\"saltear\"]').click()");
    await expect(page.locator(".paradaOrden").first()).toHaveClass(/hecha/);
    await expect(page.locator("#proximaParadaRuta")).not.toContainText(primera);

    // Mover el mapa con el dedo y bajar por la lista de paradas.
    await page.evaluate(() => window.scrollTo(0, 0));
    const mapa = await page.locator("#mapaRuta").boundingBox();
    await medirCuadros("moverMapa", async () => {
        const x = mapa.x + mapa.width / 2;
        const y = mapa.y + mapa.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        for (let i = 1; i <= 15; i++) await page.mouse.move(x - i * 8, y - i * 5);
        await page.mouse.up();
    });
    await medirCuadros("bajarLista", async () => {
        // Con el puntero debajo del mapa: sobre el mapa, la ruedita lo acerca.
        await page.mouse.move(mapa.x + mapa.width / 2, mapa.y + mapa.height + 60);
        for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 250);
        await page.waitForTimeout(300);
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "rendimiento-01-rutas-lento");

    // Navegar la ruta: abrir y después 40 posiciones del GPS por el camino.
    tiempos.abrirNavegacion = await medir("document.getElementById('btnNavegarRuta').click()");
    const navegacion = page.locator("#pantallaNavegacion");
    await expect(navegacion).toBeVisible();
    await expect(navegacion.locator("path.lineaCamino")).toHaveCount(1);
    await expect(navegacion.locator(".textoManiobra")).not.toHaveText("Buscando el camino…");
    const destino = await page.evaluate(() => window.navegacionVendeFrio.paradaActual());
    await page.evaluate(() => { window.__tiemposGps = []; });
    const textos = new Set();
    await medirCuadros("navegando", async () => {
        for (let i = 1; i <= 40; i++) {
            const t = i / 60;
            await page.context().setGeolocation({
                latitude: SALIDA.latitude + (destino.lat - SALIDA.latitude) * t,
                longitude: SALIDA.longitude + (destino.lng - SALIDA.longitude) * t
            });
            await page.waitForTimeout(60);
            textos.add(await navegacion.locator(".distanciaManiobra").textContent());
        }
        await expect.poll(() => page.evaluate(() => window.__tiemposGps.length)).toBeGreaterThan(20);
    });
    // La maniobra se va actualizando mientras avanzás.
    expect(textos.size).toBeGreaterThan(3);
    const gps = await page.evaluate(() => window.__tiemposGps.slice().sort((a, b) => a - b));
    // El 90 % de las posiciones (la peor 1 de cada 10 puede ser un recálculo).
    tiempos.posicionGps = Math.round(gps[Math.floor(gps.length * 0.9) - 1]);
    await capturar(page, "rendimiento-02-navegacion-lento");

    const resultado = { tiempos, cuadros };
    await testInfo.attach("tiempos", { body: JSON.stringify(resultado, null, 2), contentType: "application/json" });
    console.log("Rendimiento (ms, procesador 6x más lento):", JSON.stringify(resultado));
    for (const [cosa, tope] of Object.entries(TOPES)) {
        expect(tiempos[cosa], cosa + " tardó de más").toBeLessThanOrEqual(tope);
    }
    for (const [cosa, medida] of Object.entries(cuadros)) {
        expect(medida.cuantos, cosa + ": no se dibujó la pantalla").toBeGreaterThan(3);
        expect(medida.p95, cosa + ": la pantalla va a los saltos").toBeLessThanOrEqual(CUADRO_LENTO);
        expect(medida.peor, cosa + ": la pantalla se trabó").toBeLessThanOrEqual(CUADRO_TRABADO);
    }
});
