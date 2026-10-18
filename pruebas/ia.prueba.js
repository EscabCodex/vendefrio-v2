// VendeFrío - IA para la voz (T54): la del celular y la de la nube, con
// los emuladores de Firebase.
// Una máquina no tiene la IA de Chrome ni gasta la clave de Anthropic: la
// del celular es una falsa (window.LanguageModel) y la función de Vercel
// (api/entender.js) corre acá mismo, con una IA falsa que anota qué le
// preguntaron.
// 1. Más > Trabajo tiene "Voz con IA", apagada de fábrica.
// 2. Con la IA del celular prendida, una frase que la voz gratis no
//    entiende se resuelve con la IA.
// 3. Con la IA en la nube prendida, «Entender con IA» lee un pedido pegado
//    que la voz gratis no entiende entero. La función no atiende sin sesión
//    y nunca devuelve productos o comercios que no estén en las listas.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, abrirMas } = require("./recorridos");

test.use({ nube: true });

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const { initializeApp, getApps } = require("firebase-admin/app");
const { crearManejador } = require("../api/entender.js");

const appAdmin = getApps().find(app => app.name === "pruebasIA") || initializeApp({ projectId: "demo-vendefrio" }, "pruebasIA");
const preguntas = [];
// Si tiene un error, la IA falsa falla como lo haría la de verdad.
let errorDeLaIA = null;
const manejador = crearManejador({
    obtenerApp: () => appAdmin,
    // La IA falsa: entiende el pedido de la prueba y, de yapa, inventa un
    // producto y un comercio que no existen (la función los tiene que sacar).
    preguntar: async ({ mensaje, esquema }) => {
        preguntas.push(mensaje);
        if (errorDeLaIA) throw errorDeLaIA;
        if (esquema.properties.accion) return { accion: "pantalla", comercio: "", pantalla: "pedido" };
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
        window.__preguntasCelular = [];
        window.LanguageModel = {
            availability: async () => "available",
            create: async () => ({
                prompt: async mensaje => {
                    window.__preguntasCelular.push(mensaje);
                    return JSON.stringify(/tengo que reponerle/.test(mensaje)
                        ? { accion: "nuevoPedido", comercio: "Kiosco La Esquina", pantalla: "" }
                        : { accion: "nada", comercio: "", pantalla: "" });
                },
                destroy() {}
            })
        };
        window.__fraseVoz = "";
        class ReconocimientoFalso {
            start() {
                setTimeout(() => {
                    const resultado = [{ transcript: window.__fraseVoz }];
                    resultado.isFinal = true;
                    this.onresult?.({ resultIndex: 0, results: [resultado] });
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
});

async function abrirTrabajo(page) {
    await abrirMas(page);
    await page.locator('.configFila[data-config-seccion="trabajo"]').click();
    await expect(page.locator("#configDetalle")).toBeVisible();
}

test("ia: la del celular y la de la nube entienden lo que la voz gratis no", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await expect.poll(() => page.evaluate(() => {
        agregarComercio({ nombre: "Kiosco La Esquina", direccion: "Belgrano 450" });
        return obtenerComercios().some(comercio => comercio.nombre === "Kiosco La Esquina");
    }), { timeout: 15000 }).toBe(true);

    // 1. "Voz con IA", apagada de fábrica.
    await abrirTrabajo(page);
    const detalle = page.locator("#configDetalle");
    const celular = detalle.getByRole("switch", { name: "IA del celular" });
    const nube = detalle.getByRole("switch", { name: "IA en la nube" });
    await expect(celular).not.toBeChecked();
    await expect(nube).not.toBeChecked();
    await expect(detalle.locator("#estadoIACelular")).toHaveText("Este celular tiene IA y está lista.");

    // Apagada, la frase rara no se entiende y no se le pregunta a nadie.
    const frase = "che, mañana temprano tengo que reponerle todo al pibe de la esquina";
    expect(await page.evaluate(texto => vozVendeFrio.interpretar(texto), frase)).toBeNull();
    expect(await page.evaluate(texto => vozVendeFrio.interpretarConIA(texto), frase)).toBeNull();
    expect(await page.evaluate(() => window.__preguntasCelular.length)).toBe(0);

    // El botón de prueba dice qué pasa con la IA en la nube.
    errorDeLaIA = Object.assign(new Error("invalid x-api-key"), { status: 401 });
    await detalle.getByRole("button", { name: "Probar la IA en la nube" }).click();
    await expect(detalle.locator("#resultadoProbarIA")).toHaveText("La IA en la nube falló (error 502: 401 invalid x-api-key).");
    errorDeLaIA = null;
    await detalle.getByRole("button", { name: "Probar la IA en la nube" }).click();
    await expect(detalle.locator("#resultadoProbarIA")).toHaveText("Anda bien: la IA en la nube respondió.");
    preguntas.length = 0;

    await celular.check();
    await nube.check();
    await detalle.locator(".ajGrupo", { hasText: "Voz con IA" }).scrollIntoViewIfNeeded();
    await capturar(page, "ia-01-ajustes");

    // 2. La IA del celular entiende la frase y abre el pedido.
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    await page.evaluate(texto => { window.__fraseVoz = texto; }, frase);
    await page.getByRole("button", { name: "Comando por voz" }).click();
    await expect(page.locator(".ventanaVoz")).toBeHidden();
    await expect(page.locator("#pantallaPedido")).toBeVisible();
    await expect(page.locator("#cliente")).toHaveValue("Kiosco La Esquina");
    expect(await page.evaluate(() => window.__preguntasCelular.length)).toBe(1);

    // 3. La IA en la nube lee un pedido pegado. Sin la del celular, para
    // que conteste la nube.
    await page.evaluate(() => {
        const preferencias = JSON.parse(localStorage.getItem("vendefrio_preferencias") || "{}");
        localStorage.setItem("vendefrio_preferencias", JSON.stringify({ ...preferencias, iaCelular: false }));
    });
    await page.getByRole("button", { name: "Más opciones del pedido" }).click();
    await page.getByRole("button", { name: "Dictar o pegar pedido" }).click();
    const dictado = page.locator(".ventanaDictado");
    await dictado.getByLabel("Texto del pedido").fill("Buenas! Para el de la esquina: media docena de los de kilo, una docena de bombones, 2 tortas heladas y un sorbete de mango");
    await expect(dictado.locator(".sinEntenderDictado")).toBeVisible();

    // Si la IA falla (por ejemplo, una clave mal copiada), dice por qué.
    errorDeLaIA = Object.assign(new Error("invalid x-api-key"), { status: 401 });
    await dictado.getByRole("button", { name: "Entender con IA" }).click();
    await expect(dictado.locator(".estadoDictado")).toHaveText("La IA en la nube falló (error 502: 401 invalid x-api-key).");
    errorDeLaIA = null;
    preguntas.length = 0;

    await dictado.getByRole("button", { name: "Entender con IA" }).click();
    await expect(dictado.locator(".productoDictado")).toHaveCount(2);
    await expect(dictado.locator(".productoDictado").nth(0)).toContainText("6 ×Helado 1 kg");
    await expect(dictado.locator(".productoDictado").nth(1)).toContainText("12 ×Palito bombón");
    await expect(dictado.locator(".comercioDictado")).toContainText("Kiosco La Esquina");
    await expect(dictado.locator(".sinEntenderDictado")).toContainText("sorbete de mango");
    await expect(dictado.locator(".sinEntenderDictado")).toContainText("Torta helada");
    await expect(dictado.getByRole("button", { name: "Entender con IA" })).toHaveCount(0);
    expect(preguntas.length).toBe(1);
    expect(preguntas[0]).toContain("Frío Sur | Helado 1 kg");
    await capturar(page, "ia-02-pedido-con-ia");
    await dictado.getByRole("button", { name: "Agregar al pedido" }).click();
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("18");

    // La función no atiende sin sesión ni con una sesión inventada.
    expect((await llamarFuncion({ cuerpo: { tipo: "comando", texto: "hola" } })).estado).toBe(401);
    expect((await llamarFuncion({ cuerpo: { tipo: "comando", texto: "hola" }, credencial: "inventada" })).estado).toBe(401);
    expect(preguntas.length).toBe(1);
});
