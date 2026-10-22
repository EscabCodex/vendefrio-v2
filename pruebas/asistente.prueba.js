// VendeFrío - El Asistente (T91, Etapa 8; un solo asistente desde T155).
// La función de Vercel (api/entender.js) corre acá mismo con una IA falsa
// que anota qué le mandaron: la pregunta y el resumen de números que arma
// el celular.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, cargarPedido } = require("./recorridos");

test.use({ nube: true });

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const { initializeApp, getApps } = require("firebase-admin/app");
const { crearManejador } = require("../api/entender.js");

const appAdmin = getApps().find(app => app.name === "pruebasPreguntar") || initializeApp({ projectId: "demo-vendefrio" }, "pruebasPreguntar");
const mensajes = [];
const manejador = crearManejador({
    obtenerApp: () => appAdmin,
    preguntar: async ({ mensaje }) => {
        mensajes.push(mensaje);
        return {
            accion: "responder",
            comercio: "",
            pantalla: "",
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

test("asistente: tus números al toque, cómo se usa, la IA y las órdenes", async ({ page }, testInfo) => {
    await page.route("**/api/entender", async ruta => {
        const pedido = ruta.request();
        const { estado, datos } = await llamar(pedido.postDataJSON(), String(pedido.headers().authorization || "").replace(/^Bearer /, ""));
        await ruta.fulfill({ status: estado, contentType: "application/json", body: JSON.stringify(datos) });
    });
    await registrarDistribuidora(page, testInfo);
    await cargarPedido(page, false);

    // Sin sesión, la función no atiende.
    expect((await llamar({ tipo: "asistente", texto: "hola" }, "")).estado).toBe(401);

    // Un solo botón arriba a la derecha de Inicio; ya no está en Más.
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    await page.locator("#pantallaMenu header").getByRole("button", { name: "Asistente" }).click();
    const ventana = page.getByRole("dialog", { name: "Asistente" });
    await expect(ventana).toBeVisible();

    // 1. Sus números, al toque y sin preguntarle a Claude.
    await ventana.getByRole("button", { name: "¿Cuánto vendí hoy?" }).click();
    let respuesta = ventana.locator(".burbujaApp").last();
    await expect(respuesta.locator("strong")).toHaveText("$ 9.800");
    await expect(respuesta).toContainText("hoy, en 1 pedido a 1 comercio.");

    // 2. Cómo se usa la app, en pasos.
    const campo = ventana.getByRole("textbox", { name: "Hablale o escribile al Asistente" });
    await campo.fill("¿Cómo registro un cobro?");
    await ventana.getByRole("button", { name: "Enviar" }).click();
    respuesta = ventana.locator(".burbujaApp").last();
    await expect(respuesta).toContainText("Registrar un cobro");
    await expect(respuesta.locator("li")).toHaveCount(4);
    await capturar(page, "asistente-01-charla");
    expect(mensajes).toHaveLength(0);

    // 3. Lo que no sabe solo se lo pregunta a Claude (prendido de fábrica).
    await campo.fill("¿Qué producto se vende más?");
    await ventana.getByRole("button", { name: "Enviar" }).click();
    respuesta = ventana.locator(".burbujaApp:not(.burbujaPensando)").last();
    await expect(respuesta).toContainText("Este mes vendiste");
    await expect(respuesta.locator("strong")).toHaveText("$ 9.800");
    await expect(respuesta.locator(".miniBarras span")).toHaveCount(4);
    await capturar(page, "asistente-02-con-ia");

    // Claude recibió los números del celular, la guía de uso y lo charlado antes.
    expect(mensajes[0]).toContain("¿Qué producto se vende más?");
    expect(mensajes[0]).toMatch(/Vendido: \$ 9\.800 en 1 pedidos/);
    expect(mensajes[0]).toContain("Almacén Don Pepe: $ 9.800");
    expect(mensajes[0]).toContain("Cómo se usa la app");
    expect(mensajes[0]).toContain("Lo que se habló antes:");

    // 4. Una orden: la hace al toque y se cierra.
    await campo.fill("abrir pedidos");
    await ventana.getByRole("button", { name: "Enviar" }).click();
    await expect(ventana).toBeHidden();
    await expect(page.locator("#pantallaPedido")).toBeVisible();
});
