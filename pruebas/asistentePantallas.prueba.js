// VendeFrío - El Asistente en todas las pantallas (T160), con los
// emuladores de Firebase, una IA falsa (no gasta la clave), un GPS falso y
// una impresora Bluetooth falsa.
// 1. Cada pantalla tiene el botón del Asistente arriba a la derecha (también
//    Rutas, las fichas y la navegación), y Claude recibe lo que se está viendo.
// 2. De una sola frase, sin Claude: «anotá un pedido para…, 5 helados… a
//    precio de la lista…, e imprimí el ticket». Antes de guardar o imprimir
//    muestra lo que va a hacer: con «No» no hace nada, con «Sí» lo guarda y
//    lo imprime.
// 3. Navegando: «vamos a lo de … primero» cambia el orden del recorrido, y
//    una frase rara la lee Claude como varios pasos, que se confirman con un
//    «sí» dicho. El producto inventado no se agrega y la navegación sigue.
// 4. En la ficha de un pedido, «imprimí el ticket» imprime ese pedido.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, irAPedidos, usarImpresoraFalsa, textoImpreso } = require("./recorridos");

test.use({ nube: true, claude: true });

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const { initializeApp, getApps } = require("firebase-admin/app");
const { crearManejador } = require("../api/entender.js");

const KIOSCO = { lat: -34.6, lng: -58.4 };
const SUPER = { lat: -34.61, lng: -58.41 };
const SALIDA = { lat: -34.605, lng: -58.405 };
const CAMINO = {
    code: "Ok",
    routes: [{
        distance: 1015,
        duration: 240,
        geometry: { type: "LineString", coordinates: [[SALIDA.lng, SALIDA.lat], [-58.4, -34.605], [KIOSCO.lng, KIOSCO.lat]] },
        legs: [{
            steps: [
                { name: "Rivadavia", maneuver: { type: "depart", modifier: "", location: [SALIDA.lng, SALIDA.lat] } },
                { name: "Belgrano", maneuver: { type: "turn", modifier: "left", location: [-58.4, -34.605] } },
                { name: "", maneuver: { type: "arrive", modifier: "", location: [KIOSCO.lng, KIOSCO.lat] } }
            ]
        }]
    }]
};

const appAdmin = getApps().find(app => app.name === "pruebasAsistente") || initializeApp({ projectId: "demo-vendefrio" }, "pruebasAsistente");
const preguntas = [];
const vacio = { comercio: "", pantalla: "", lista: "", productos: [] };
const manejador = crearManejador({
    obtenerApp: () => appAdmin,
    preguntar: async ({ mensaje }) => {
        preguntas.push(mensaje);
        const dijo = mensaje.split("Lo que dijo:\n").pop();
        // Varios pasos de una frase rara; de yapa, un producto inventado.
        if (/lo de siempre/.test(dijo)) {
            return {
                accion: "responder", comercio: "", pantalla: "", respuesta: "Anoto lo de siempre y saco el ticket.", destacado: "", barras: [],
                pasos: [
                    { ...vacio, accion: "anotarPedido", comercio: "Almacén Don Pepe", productos: [
                        { marca: "Frío Sur", producto: "Helado 1 kg", cantidad: 2 },
                        { marca: "Inventada", producto: "Torta helada", cantidad: 3 }
                    ] },
                    { ...vacio, accion: "imprimir" }
                ]
            };
        }
        return { accion: "responder", comercio: "", pantalla: "", respuesta: "Ofrecele los palitos, que salen mucho.", destacado: "", barras: [], pasos: [] };
    }
});

async function llamarFuncion({ cuerpo, credencial }) {
    let estado = 0;
    let datos = null;
    const respuesta = {
        setHeader() {},
        status(numero) { estado = numero; return this; },
        json(objeto) { datos = objeto; return this; }
    };
    await manejador({ method: "POST", headers: credencial ? { authorization: "Bearer " + credencial } : {}, body: cuerpo }, respuesta);
    return { estado, datos };
}

test.beforeEach(async ({ page }) => {
    await usarImpresoraFalsa(page);
    await page.addInitScript(() => {
        // Lo que "dice" la persona, una frase por vez que se escucha.
        window.__frasesVoz = [];
        class ReconocimientoFalso {
            start() {
                setTimeout(() => {
                    const frase = window.__frasesVoz.shift() || "";
                    const resultado = [{ transcript: frase }];
                    resultado.isFinal = true;
                    if (frase) this.onresult?.({ resultIndex: 0, results: [resultado] });
                    this.onend?.();
                }, 150);
            }
            stop() {}
        }
        window.SpeechRecognition = ReconocimientoFalso;
        window.webkitSpeechRecognition = ReconocimientoFalso;
    });
    await page.route("**/api/entender", async ruta => {
        const pedido = ruta.request();
        const credencial = String(pedido.headers().authorization || "").replace(/^Bearer /, "");
        const { estado, datos } = await llamarFuncion({ cuerpo: pedido.postDataJSON(), credencial });
        await ruta.fulfill({ status: estado, contentType: "application/json", body: JSON.stringify(datos) });
    });
    await page.route("https://routing.openstreetmap.de/**", ruta =>
        ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CAMINO) }));
});

const delPedido = (page, comercio) => page.evaluate(nombre => {
    const pedido = obtenerHistorial().filter(item => item.comercio === nombre).sort((a, b) => b.timestamp - a.timestamp)[0];
    return pedido ? pedido.productos.map(item => item.cantidad + " " + item.producto).join(", ") : "";
}, comercio);

test("asistente: en todas las pantallas, con lo que estás viendo y varias cosas seguidas", async ({ page }, testInfo) => {
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: SALIDA.lat, longitude: SALIDA.lng });
    await registrarDistribuidora(page, testInfo);
    await expect.poll(() => page.evaluate(({ kiosco, superNorte }) => {
        agregarComercio({ nombre: "Kiosco La Esquina", direccion: "Belgrano 450", lat: kiosco.lat, lng: kiosco.lng, origenGps: "gps" });
        agregarComercio({ nombre: "Super Norte", direccion: "Mitre 900", lat: superNorte.lat, lng: superNorte.lng, origenGps: "gps" });
        return ["Kiosco La Esquina", "Super Norte"].every(nombre => obtenerComercios().some(comercio => comercio.nombre === nombre));
    }, { kiosco: KIOSCO, superNorte: SUPER }), { timeout: 15000 }).toBe(true);
    await page.evaluate(() => {
        localStorage.setItem("vendefrio_listas_creadas", JSON.stringify(["Mayorista"]));
        const preferencias = JSON.parse(localStorage.getItem("vendefrio_preferencias") || "{}");
        // Sin voz alta (la máquina no tiene parlante) y con la navegación propia.
        localStorage.setItem("vendefrio_preferencias", JSON.stringify({ ...preferencias, asistenteCalla: true, navegador: "app" }));
    });
    const ventana = page.getByRole("dialog", { name: "Asistente" });
    const campo = ventana.getByRole("textbox", { name: "Hablale o escribile al Asistente" });
    const escribir = async texto => {
        // Se abre escuchando: primero que termine de escuchar.
        await expect(ventana.locator(".botonHablarAsistente")).not.toHaveClass(/escuchando/);
        await campo.fill(texto);
        await ventana.getByRole("button", { name: "Enviar" }).click();
    };

    // 1. En Comercios, el botón de arriba a la derecha; Claude sabe dónde está.
    await page.evaluate(() => mostrarPantalla("comercios"));
    const boton = page.locator("#pantallaComercios > .barraVolver").getByRole("button", { name: "Asistente" });
    await expect(boton).toBeVisible();
    await capturar(page, "asistentePantallas-01-boton");
    await boton.click();
    await expect(ventana).toBeVisible();
    await escribir("¿qué me conviene ofrecerle a la gente de este barrio?");
    await expect(ventana.locator(".burbujaApp:not(.burbujaPensando)").last()).toContainText("Ofrecele los palitos");
    expect(preguntas.at(-1)).toContain("## Lo que está viendo ahora");
    expect(preguntas.at(-1)).toContain("Está en la pantalla Comercios");
    expect(preguntas.at(-1)).toContain("Frío Sur | Helado 1 kg");
    expect(preguntas.at(-1)).toContain("Listas de precios:\nMayorista");

    // 2. Varias cosas de una frase, sin Claude. Primero dice qué va a hacer.
    const cuantas = preguntas.length;
    const frase = "Anotá un pedido para Kiosco La Esquina, 5 helados de un kilo y 3 palitos bombón a precio de la lista Mayorista, e imprimí el ticket";
    await escribir(frase);
    const plan = ventana.locator(".burbujaPlan").last();
    await expect(plan).toContainText("Guardar un pedido para Kiosco La Esquina: 5 Helado 1 kg, 3 Palito bombón (lista Mayorista).");
    await expect(plan).toContainText("Imprimir el ticket de ese pedido.");
    expect(preguntas.length).toBe(cuantas);
    // Con «No» no hace nada.
    await plan.getByRole("button", { name: "No" }).click();
    await expect(ventana.locator(".burbujaApp").last()).toHaveText("Listo, no hago nada.");
    expect(await delPedido(page, "Kiosco La Esquina")).toBe("");
    await escribir(frase);
    await expect(ventana.locator(".burbujaPlan").last().getByRole("button", { name: "Sí, hacelo" })).toBeVisible();
    await capturar(page, "asistentePantallas-02-confirmar");
    await page.evaluate(() => { window.__bytesImpresos = []; });
    await ventana.locator(".burbujaPlan").last().getByRole("button", { name: "Sí, hacelo" }).click();
    await expect(ventana).toBeHidden();
    await expect(page.locator("#contenedorToasts")).toContainText("Ticket impreso");
    await expect.poll(() => delPedido(page, "Kiosco La Esquina")).toBe("5 Helado 1 kg, 3 Palito bombón");
    expect(await textoImpreso(page)).toContain("Kiosco La Esquina");
    await expect(page.locator("#modalPedido")).toBeVisible();
    await capturar(page, "asistentePantallas-03-guardado");
    await page.evaluate(() => document.getElementById("modalPedido").classList.add("oculto"));

    // 3. Navegando: las sugerencias son de la ruta y «primero» cambia el orden.
    await page.evaluate(() => {
        mostrarPantalla("menu");
        window.navegacionVendeFrio.abrir(["Kiosco La Esquina", "Super Norte"]);
    });
    const navegacion = page.locator("#pantallaNavegacion");
    await expect(navegacion).toBeVisible();
    await navegacion.getByRole("button", { name: "Asistente" }).click();
    await expect(ventana).toBeVisible();
    const primero = ventana.getByRole("button", { name: "Vamos a lo de Super Norte primero" });
    await expect(primero).toBeVisible();
    await capturar(page, "asistentePantallas-04-navegando");
    await primero.click();
    await expect(ventana).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.navegacionVendeFrio.paradaActual()?.nombre)).toBe("Super Norte");
    expect(await page.evaluate(() => window.navegacionVendeFrio.paradasQueSiguen().map(comercio => comercio.nombre))).toEqual(["Kiosco La Esquina"]);

    // Una frase rara, dicha: Claude la lee como dos pasos y se confirma con
    // un «sí» dicho. El producto inventado no llega y la navegación sigue.
    await page.evaluate(() => { window.__bytesImpresos = []; window.__frasesVoz = ["dale, cargale lo de siempre a don pepe y sacale el ticket", "sí"]; });
    await navegacion.getByRole("button", { name: "Asistente" }).click();
    await expect(page.locator("#contenedorToasts")).toContainText("Ticket impreso", { timeout: 15000 });
    expect(preguntas.at(-1)).toContain("Está navegando hacia Super Norte");
    expect(preguntas.at(-1)).toContain("Después siguen: Kiosco La Esquina.");
    await expect.poll(() => delPedido(page, "Almacén Don Pepe")).toBe("2 Helado 1 kg");
    expect(await textoImpreso(page)).toContain("Almac");
    await expect(navegacion).toBeVisible();
    expect(await page.evaluate(() => window.navegacionVendeFrio.paradaActual()?.nombre)).toBe("Super Norte");
    await page.evaluate(() => {
        document.getElementById("modalPedido").classList.add("oculto");
        window.navegacionVendeFrio.cerrar();
    });

    // 4. En la ficha del pedido, el Asistente sabe qué pedido está abierto.
    await irAPedidos(page);
    await page.locator(".tarjetaSeguimiento", { hasText: "Kiosco La Esquina" }).first().click();
    const ficha = page.locator(".fichaPedido");
    await expect(ficha).toBeVisible();
    await ficha.getByRole("button", { name: "Asistente" }).click();
    await expect(ventana).toBeVisible();
    await page.evaluate(() => { window.__bytesImpresos = []; });
    await escribir("imprimí el ticket");
    await expect(ventana.locator(".burbujaPlan").last()).toContainText("Imprimir el ticket del pedido de Kiosco La Esquina.");
    await capturar(page, "asistentePantallas-05-ficha-pedido");
    await ventana.locator(".burbujaPlan").last().getByRole("button", { name: "Sí, hacelo" }).click();
    await expect(page.locator("#contenedorToasts")).toContainText("Ticket impreso");
    expect(await textoImpreso(page)).toContain("Kiosco La Esquina");
    await ficha.getByRole("button", { name: "Cerrar" }).click();

    // Rutas y la ficha del comercio también tienen el botón.
    await page.evaluate(() => mostrarPantalla("rutas"));
    await expect(page.locator(".cabezaRutas").getByRole("button", { name: "Asistente" })).toBeVisible();
    await page.evaluate(() => { mostrarPantalla("menu"); window.abrirFichaComercio("Super Norte"); });
    await page.locator(".fichaComercioNueva").getByRole("button", { name: "Asistente" }).click();
    await expect(ventana.getByRole("button", { name: "Nuevo pedido para Super Norte" })).toBeVisible();
    await capturar(page, "asistentePantallas-06-ficha-comercio");

    // La función solo devuelve pasos con comercios y productos de las listas.
    const credencial = await page.evaluate(() => firebase.auth().currentUser.getIdToken());
    const limpio = await llamarFuncion({
        cuerpo: { tipo: "asistente", texto: "cargale lo de siempre", comercios: ["Kiosco La Esquina"], productos: [{ marca: "Frío Sur", producto: "Helado 1 kg" }] },
        credencial
    });
    expect(limpio.estado).toBe(200);
    // Don Pepe no estaba en la lista que mandó la app: ese pedido no va; el ticket sí.
    expect(limpio.datos.resultado.pasos).toEqual([{ accion: "imprimir", comercio: "", pantalla: "", lista: "", productos: [] }]);
});
