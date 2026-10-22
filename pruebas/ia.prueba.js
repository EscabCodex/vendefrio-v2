// VendeFrío - Un solo asistente, el de Claude (T155), con los emuladores de
// Firebase. Antes había dos IA (la del celular, de Chrome, y la de la nube);
// ahora hay un solo Asistente: lo fácil lo contesta el celular y lo demás
// se lo pregunta a Claude.
// Una máquina no gasta la clave de Anthropic: la función de Vercel
// (api/entender.js) corre acá mismo, con una IA falsa que anota qué le
// preguntaron.
// 1. Más > Preferencias de trabajo tiene "Asistente con Claude", prendido
//    de fábrica, y ya no están la IA del celular ni su ajuste.
// 2. El Asistente contesta lo fácil sin preguntarle a Claude; lo que no
//    entiende va a Claude en una sola pregunta, que puede volver una orden.
// 3. En "Dictar o pegar pedido", lo que el celular no entendió lo lee
//    Claude solo, sin tocar nada; si falla, dice por qué y se reintenta.
// 4. Navegando, el micrófono abre el mismo Asistente.
// 5. Con Claude apagado no se le pregunta nada.
// 6. La función no atiende sin sesión y nunca devuelve comercios o
//    productos que no estén en las listas.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, abrirMas } = require("./recorridos");

test.use({ nube: true, claude: true });

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const { initializeApp, getApps } = require("firebase-admin/app");
const { crearManejador } = require("../api/entender.js");

const COMERCIO = { lat: -34.6, lng: -58.4 };
const SALIDA = { lat: -34.605, lng: -58.405 };
const CAMINO = {
    code: "Ok",
    routes: [{
        distance: 1015,
        duration: 240,
        geometry: { type: "LineString", coordinates: [[SALIDA.lng, SALIDA.lat], [-58.4, -34.605], [COMERCIO.lng, COMERCIO.lat]] },
        legs: [{
            steps: [
                { name: "Rivadavia", maneuver: { type: "depart", modifier: "", location: [SALIDA.lng, SALIDA.lat] } },
                { name: "Belgrano", maneuver: { type: "turn", modifier: "left", location: [-58.4, -34.605] } },
                { name: "", maneuver: { type: "arrive", modifier: "", location: [COMERCIO.lng, COMERCIO.lat] } }
            ]
        }]
    }]
};

const appAdmin = getApps().find(app => app.name === "pruebasIA") || initializeApp({ projectId: "demo-vendefrio" }, "pruebasIA");
const preguntas = [];
// Si tiene un error, la IA falsa falla como lo haría la de verdad.
let errorDeLaIA = null;
const manejador = crearManejador({
    obtenerApp: () => appAdmin,
    preguntar: async ({ mensaje, esquema }) => {
        preguntas.push(mensaje);
        if (errorDeLaIA) throw errorDeLaIA;
        const dijo = mensaje.split("Lo que dijo:\n").pop();
        // El Asistente: una orden o una respuesta. De yapa, una orden con
        // un comercio inventado (la función la tiene que pasar a texto).
        if (esquema.properties.respuesta) {
            if (/abrir los pedidos/.test(dijo)) return { accion: "pantalla", comercio: "", pantalla: "pedido", respuesta: "Abro los pedidos.", destacado: "", barras: [] };
            if (/reponerle todo/.test(dijo)) return { accion: "nuevoPedido", comercio: "Kiosco La Esquina", pantalla: "", respuesta: "Abro un pedido para Kiosco La Esquina.", destacado: "", barras: [] };
            if (/Ramón/.test(dijo)) return { accion: "ir", comercio: "Ramón Inventado", pantalla: "", respuesta: "", destacado: "", barras: [] };
            return { accion: "responder", comercio: "", pantalla: "", respuesta: "Canto mal, pero te ayudo con los pedidos, la ruta y tus números.", destacado: "", barras: [] };
        }
        // El pedido: lo entiende y, de yapa, inventa un producto que no existe.
        return {
            comercio: "Kiosco La Esquina",
            productos: [
                { marca: "Frío Sur", producto: "Helado 1 kg", cantidad: 6 },
                { marca: "Frío Sur", producto: "Palito bombón", cantidad: 12 },
                { marca: "Inventada", producto: "Torta helada", cantidad: 2 }
            ],
            sinEntender: ["sorbete de mango"]
        };
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
    await page.addInitScript(() => {
        // Si la app todavía buscara la IA de Chrome, la prueba se entera.
        window.__usoIACelular = 0;
        window.LanguageModel = {
            availability: async () => { window.__usoIACelular++; return "available"; },
            create: async () => { window.__usoIACelular++; throw new Error("no se usa"); }
        };
        window.__fraseVoz = "";
        class ReconocimientoFalso {
            start() {
                setTimeout(() => {
                    const resultado = [{ transcript: window.__fraseVoz }];
                    resultado.isFinal = true;
                    if (window.__fraseVoz) this.onresult?.({ resultIndex: 0, results: [resultado] });
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

async function abrirTrabajo(page) {
    await abrirMas(page);
    await page.locator('.configFila[data-config-seccion="trabajo"]').click();
    await expect(page.locator("#configDetalle")).toBeVisible();
}

test("ia: un solo asistente, el de Claude, en Inicio, el dictado y navegando", async ({ page }, testInfo) => {
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: SALIDA.lat, longitude: SALIDA.lng });
    await registrarDistribuidora(page, testInfo);
    await expect.poll(() => page.evaluate(({ lat, lng }) => {
        agregarComercio({ nombre: "Kiosco La Esquina", direccion: "Belgrano 450", lat, lng, origenGps: "gps" });
        return obtenerComercios().some(comercio => comercio.nombre === "Kiosco La Esquina");
    }, COMERCIO), { timeout: 15000 }).toBe(true);

    // 1. Un solo ajuste, prendido de fábrica. La IA del celular ya no está.
    await abrirTrabajo(page);
    const detalle = page.locator("#configDetalle");
    await expect(detalle.getByRole("switch", { name: "Asistente con Claude" })).toBeChecked();
    await expect(detalle.getByRole("switch", { name: "IA del celular" })).toHaveCount(0);
    await expect(detalle.getByRole("switch", { name: "IA en la nube" })).toHaveCount(0);
    await expect(detalle).not.toContainText("Voz con IA");

    // El botón de prueba dice qué pasa con Claude.
    errorDeLaIA = Object.assign(new Error("invalid x-api-key"), { status: 401 });
    await detalle.getByRole("button", { name: "Probar el asistente" }).click();
    await expect(detalle.locator("#resultadoProbarIA")).toHaveText("Claude falló (error 502: 401 invalid x-api-key).");
    errorDeLaIA = null;
    await detalle.getByRole("button", { name: "Probar el asistente" }).click();
    await expect(detalle.locator("#resultadoProbarIA")).toHaveText("Anda bien: Claude respondió.");
    await detalle.locator(".ajNota", { hasText: "El asistente es uno solo" }).scrollIntoViewIfNeeded();
    await capturar(page, "ia-01-ajustes");
    preguntas.length = 0;

    // 2. El Asistente de Inicio. Lo fácil, al toque y sin Claude.
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    await page.evaluate(() => { window.__fraseVoz = "¿Cuánto vendí hoy?"; });
    await page.locator("#pantallaMenu header").getByRole("button", { name: "Asistente" }).click();
    const ventana = page.getByRole("dialog", { name: "Asistente" });
    await expect(ventana.locator(".burbujaApp").last()).toContainText("Vendiste");
    const campo = ventana.getByRole("textbox", { name: "Hablale o escribile al Asistente" });

    // Lo que el celular no entiende va a Claude, con la charla de antes.
    await campo.fill("che, mañana temprano tengo que cantarle algo al pibe");
    await ventana.getByRole("button", { name: "Enviar" }).click();
    await expect(ventana.locator(".burbujaApp:not(.burbujaPensando)").last()).toContainText("Canto mal, pero te ayudo");
    expect(preguntas).toHaveLength(1);
    expect(preguntas[0]).toContain("Kiosco La Esquina");
    expect(preguntas[0]).toContain("Cómo se usa la app");
    expect(preguntas[0]).toContain("Lo que se habló antes:");
    expect(preguntas[0]).toContain("Usuario: ¿Cuánto vendí hoy?");
    await capturar(page, "ia-02-asistente");

    // Si Claude vuelve una orden, la hace: un pedido para el comercio.
    await campo.fill("che, mañana temprano tengo que reponerle todo al pibe de la esquina");
    await ventana.getByRole("button", { name: "Enviar" }).click();
    await expect(ventana).toBeHidden();
    await expect(page.locator("#pantallaPedido")).toBeVisible();
    await expect(page.locator("#cliente")).toHaveValue("Kiosco La Esquina");
    expect(preguntas).toHaveLength(2);

    // 3. "Dictar o pegar pedido": lo que faltó lo lee Claude solo.
    await page.getByRole("button", { name: "Más opciones del pedido" }).click();
    await page.getByRole("button", { name: "Dictar o pegar pedido" }).click();
    const dictado = page.locator(".ventanaDictado");
    const texto = dictado.getByLabel("Texto del pedido");
    const mensaje = "Buenas! Para el de la esquina: media docena de los de kilo, una docena de bombones, 2 tortas heladas y un sorbete de mango";

    // Si Claude falla (por ejemplo, una clave mal copiada), dice por qué.
    errorDeLaIA = Object.assign(new Error("invalid x-api-key"), { status: 401 });
    await texto.fill(mensaje);
    await expect(dictado.locator(".estadoDictado")).toHaveText("Claude falló (error 502: 401 invalid x-api-key).");
    await expect(dictado.getByRole("button", { name: "Entender con IA" })).toHaveCount(0);
    errorDeLaIA = null;
    preguntas.length = 0;
    await dictado.getByRole("button", { name: "Probar de nuevo" }).click();
    await expect(dictado.locator(".productoDictado")).toHaveCount(2);
    expect(preguntas).toHaveLength(1);

    // Otro mensaje: sin tocar nada, Claude lo lee y solo trae lo del catálogo.
    preguntas.length = 0;
    await texto.fill(mensaje + ". Gracias!");
    await expect(dictado.locator(".productoDictado")).toHaveCount(2);
    await expect(dictado.locator(".productoDictado").nth(0)).toContainText("6 ×Helado 1 kg");
    await expect(dictado.locator(".productoDictado").nth(1)).toContainText("12 ×Palito bombón");
    await expect(dictado.locator(".comercioDictado")).toContainText("Kiosco La Esquina");
    await expect(dictado.locator(".sinEntenderDictado")).toContainText("sorbete de mango");
    await expect(dictado.locator(".sinEntenderDictado")).toContainText("Torta helada");
    await expect(dictado.locator(".estadoDictado")).toBeHidden();
    expect(preguntas).toHaveLength(1);
    expect(preguntas[0]).toContain("Frío Sur | Helado 1 kg");
    await capturar(page, "ia-03-pedido-con-claude");
    await dictado.getByRole("button", { name: "Agregar al pedido" }).click();
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("18");

    // 4. Navegando, el micrófono abre el mismo Asistente, escuchando.
    await page.evaluate(() => {
        const preferencias = JSON.parse(localStorage.getItem("vendefrio_preferencias") || "{}");
        localStorage.setItem("vendefrio_preferencias", JSON.stringify({ ...preferencias, navegador: "app" }));
        window.__fraseVoz = "cantame una canción";
    });
    await page.evaluate(() => window.abrirFichaComercio("Kiosco La Esquina"));
    await page.locator(".fichaComercioNueva").getByRole("link", { name: "Ir" }).click();
    const navegacion = page.locator("#pantallaNavegacion");
    await expect(navegacion).toBeVisible();
    await navegacion.getByRole("button", { name: "Asistente" }).click();
    await expect(ventana).toBeVisible();
    await expect(ventana.locator(".burbujaApp:not(.burbujaPensando)").last()).toContainText("Canto mal, pero te ayudo");
    await expect(page.locator(".ventanaVoz")).toHaveCount(0);
    await capturar(page, "ia-04-navegando");
    await page.evaluate(() => window.asistenteVendeFrio.cerrar());
    await expect(ventana).toBeHidden();
    await expect(navegacion).toBeVisible();
    await page.evaluate(() => {
        window.navegacionVendeFrio.cerrar();
        window.cerrarFichaComercio();
        mostrarPantalla("menu");
    });

    // 6. La función no atiende sin sesión ni con una sesión inventada, y
    // una orden con un comercio que no está en la lista vuelve como texto.
    const cuantas = preguntas.length;
    expect((await llamarFuncion({ cuerpo: { tipo: "asistente", texto: "hola" } })).estado).toBe(401);
    expect((await llamarFuncion({ cuerpo: { tipo: "asistente", texto: "hola" }, credencial: "inventada" })).estado).toBe(401);
    expect(preguntas.length).toBe(cuantas);
    const credencial = await page.evaluate(() => firebase.auth().currentUser.getIdToken());
    const inventado = await llamarFuncion({ cuerpo: { tipo: "asistente", texto: "llevame a lo de Ramón", comercios: ["Kiosco La Esquina"] }, credencial });
    expect(inventado.estado).toBe(200);
    expect(inventado.datos.resultado.accion).toBe("responder");
    expect(inventado.datos.resultado.comercio).toBe("");

    // 5. Con Claude apagado, el Asistente contesta lo que sabe y no le
    // pregunta nada a Claude.
    await abrirTrabajo(page);
    await detalle.getByRole("switch", { name: "Asistente con Claude" }).uncheck();
    preguntas.length = 0;
    await page.evaluate(() => { window.__fraseVoz = ""; window.asistenteVendeFrio.abrir({ escuchar: false }); });
    await campo.fill("cantame una canción");
    await ventana.getByRole("button", { name: "Enviar" }).click();
    await expect(ventana.locator(".burbujaApp").last()).toContainText("No entendí «cantame una canción»");
    await expect(ventana.locator(".burbujaApp").last()).toContainText("Con Claude prendido (Más › Preferencias de trabajo › Asistente) entiendo mucho más.");
    expect(preguntas).toHaveLength(0);

    // La IA de Chrome nunca se usó.
    expect(await page.evaluate(() => window.__usoIACelular)).toBe(0);
});
