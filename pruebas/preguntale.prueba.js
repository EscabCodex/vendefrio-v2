// VendeFrío - Preguntale a VendeFrío (T91). La función de Vercel
// (api/preguntar.js) corre acá mismo con una IA falsa que anota qué le
// mandaron: la pregunta y el resumen de números que arma el celular.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, cargarPedido, abrirMas } = require("./recorridos");

test.use({ nube: true });

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const { initializeApp, getApps } = require("firebase-admin/app");
const { crearManejador } = require("../api/preguntar.js");

const appAdmin = getApps().find(app => app.name === "pruebasPreguntar") || initializeApp({ projectId: "demo-vendefrio" }, "pruebasPreguntar");
const mensajes = [];
const manejador = crearManejador({
    obtenerApp: () => appAdmin,
    preguntar: async ({ mensaje }) => {
        mensajes.push(mensaje);
        return {
            respuesta: "Este mes vendiste $ 9.800 en 1 pedido. El que más compró fue Almacén Don Pepe.",
            destacado: "$ 9.800",
            barras: [{ etiqueta: "jul", valor: 0 }, { etiqueta: "ago", valor: 4000 }, { etiqueta: "sep", valor: 6000 }, { etiqueta: "oct", valor: 9800 }, { etiqueta: "x", valor: -5 }]
        };
    }
});

async function llamar(cuerpo, credencial) {
    let estado = 0;
    let datos = null;
    const respuesta = { setHeader() {}, status(numero) { estado = numero; return this; }, json(objeto) { datos = objeto; return this; } };
    await manejador({ method: "POST", headers: credencial ? { authorization: "Bearer " + credencial } : {}, body: cuerpo }, respuesta);
    return { estado, datos };
}

test("preguntale: pregunta con tus palabras y responde con tus números", async ({ page }, testInfo) => {
    await page.route("**/api/preguntar", async ruta => {
        const pedido = ruta.request();
        const { estado, datos } = await llamar(pedido.postDataJSON(), String(pedido.headers().authorization || "").replace(/^Bearer /, ""));
        await ruta.fulfill({ status: estado, contentType: "application/json", body: JSON.stringify(datos) });
    });
    await registrarDistribuidora(page, testInfo);
    await cargarPedido(page, false);

    // Sin sesión, la función no atiende.
    expect((await llamar({ pregunta: "hola" }, "")).estado).toBe(401);

    await abrirMas(page);
    await page.locator(".masAccesos").getByRole("button", { name: /Preguntale a VendeFrío/ }).click();
    const pantalla = page.locator("#pantallaPreguntale");
    // Con la IA en la nube apagada, avisa cómo prenderla.
    await expect(pantalla.locator("#avisoIaApagada")).toContainText("Prendé la IA en la nube");
    await page.evaluate(() => {
        const preferencias = JSON.parse(localStorage.getItem("vendefrio_preferencias") || "{}");
        localStorage.setItem("vendefrio_preferencias", JSON.stringify({ ...preferencias, iaNube: true }));
    });
    await pantalla.getByRole("button", { name: "¿Cuánto vendí este mes?" }).click();
    const respuesta = pantalla.locator(".burbujaApp").last();
    await expect(respuesta).toContainText("Este mes vendiste");
    await expect(respuesta.locator("strong")).toHaveText("$ 9.800");
    await expect(respuesta.locator(".miniBarras span")).toHaveCount(4);
    await pantalla.getByRole("textbox", { name: "Tu pregunta" }).fill("¿Y quién me debe más?");
    await pantalla.getByRole("button", { name: "Preguntar", exact: true }).click();
    await expect(pantalla.locator(".burbujaYo")).toHaveCount(2);
    await expect(pantalla.locator(".burbujaApp:not(.burbujaPensando)")).toHaveCount(2);
    await capturar(page, "preguntale-01-charla");

    // La IA recibió los números del celular y lo charlado antes.
    expect(mensajes[0]).toContain("¿Cuánto vendí este mes?");
    expect(mensajes[0]).toMatch(/Vendido: \$ 9\.800 en 1 pedidos/);
    expect(mensajes[0]).toContain("Almacén Don Pepe: $ 9.800");
    expect(mensajes[1]).toContain("Lo que se habló antes:");
});
