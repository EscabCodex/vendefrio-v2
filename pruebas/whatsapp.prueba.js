// VendeFrío - Pedidos por WhatsApp (T55 a T59), con los emuladores de
// Firebase. Nunca se manda un mensaje de verdad: WhatsApp (Meta) y el
// servicio de audio a texto se reemplazan por unos falsos, y las funciones de
// Vercel (api/whatsapp*.js) corren acá mismo.
// 1. Ronda de pedidos uno por uno: el mensaje con el nombre de cada comercio
//    y el enlace de WhatsApp con el texto listo.
// 2. Compartir a VendeFrío: un mensaje compartido abre "Dictar o pegar
//    pedido" con los productos; un audio se puede escuchar.
// 3. WhatsApp automático: el dueño lo prende, manda la ronda con un toque,
//    llegan las respuestas (texto y audio) y se cargan los pedidos.
// 4. El service worker recibe lo compartido y abre la app.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");
const { Readable } = require("stream");
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, abrirMas } = require("./recorridos");

test.use({ nube: true, claude: true });

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const appAdmin = getApps().find(app => app.name === "pruebas") || initializeApp({ projectId: "demo-vendefrio" }, "pruebas");
const nube = getFirestore(appAdmin);

const SECRETO = "secreto-de-prueba";
const PALABRA = "palabra-de-prueba";

// Variables de Vercel falsas: solo viven mientras corre esta prueba.
function prepararVercel(idDistribuidora) {
    Object.assign(process.env, {
        WHATSAPP_TOKEN: "token-falso",
        WHATSAPP_ID_NUMERO: "123456",
        WHATSAPP_SECRETO_APP: SECRETO,
        WHATSAPP_TOKEN_VERIFICACION: PALABRA,
        WHATSAPP_DISTRIBUIDORA: idDistribuidora,
        AUDIO_A_TEXTO_CLAVE: "clave-falsa"
    });
}

function respuestaFalsa() {
    const salida = { estado: 0, datos: null, texto: "" };
    salida.respuesta = {
        setHeader() {},
        status(numero) {
            salida.estado = numero;
            return this;
        },
        json(objeto) {
            salida.datos = objeto;
            return this;
        },
        send(texto) {
            salida.texto = texto;
            return this;
        }
    };
    return salida;
}

async function llamar(manejador, { metodo = "POST", cuerpo, credencial, encabezados = {}, consulta }) {
    const salida = respuestaFalsa();
    const pedido = { method: metodo, headers: { ...encabezados }, query: consulta, body: cuerpo };
    if (credencial) pedido.headers.authorization = "Bearer " + credencial;
    await manejador(pedido, salida.respuesta);
    return salida;
}

// Lo que Meta le manda al webhook, firmado (o no) con el secreto de la app.
async function avisarMensaje(manejador, mensajes, { firma } = {}) {
    const cuerpo = Buffer.from(JSON.stringify({
        object: "whatsapp_business_account",
        entry: [{ changes: [{ field: "messages", value: {
            contacts: mensajes.map(mensaje => ({ wa_id: mensaje.from, profile: { name: mensaje.perfil || "Cliente" } })),
            messages: mensajes.map(({ perfil, ...mensaje }) => mensaje)
        } }] }]
    }));
    const pedido = Readable.from([cuerpo]);
    pedido.method = "POST";
    pedido.headers = { "x-hub-signature-256": firma || "sha256=" + crypto.createHmac("sha256", SECRETO).update(cuerpo).digest("hex") };
    const salida = respuestaFalsa();
    await manejador(pedido, salida.respuesta);
    return salida;
}

async function credencialDe(page) {
    return page.evaluate(() => firebase.auth().currentUser.getIdToken());
}

async function abrirWhatsapp(page) {
    await abrirMas(page);
    await page.locator('.masAcceso[data-mas="whatsapp"]').click();
    await expect(page.locator("#pantallaWhatsapp")).toBeVisible();
}

test("whatsapp: ronda de pedidos uno por uno y compartir a VendeFrío", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(() => {
        agregarComercio({ nombre: "Kiosco La Esquina", direccion: "Belgrano 450", telefono: "011 15 4444-0000" });
        agregarComercio({ nombre: "Super Norte", direccion: "Mitre 900" });
    });

    await abrirWhatsapp(page);
    await expect(page.locator("#waEjemplo")).toContainText("Hola Almacén Don Pepe, ¿cómo estás? Quería saber si tenías pedido");
    await expect(page.locator(".waComercio.sinTelefono")).toContainText("Super Norte");
    // Sin la cuenta de Meta no aparece el envío automático.
    await expect(page.locator("#waEnviarTodos")).toHaveCount(0);

    await page.getByRole("button", { name: "Todos", exact: true }).click();
    await expect(page.locator("#waEmpezar")).toHaveText(/Empezar ronda \(2\)/);
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "whatsapp-01-ronda");

    await page.locator("#waEmpezar").click();
    const enviar = page.locator(".waBotonGrande", { hasText: "Enviar a Almacén Don Pepe" });
    const enlace = await enviar.getAttribute("href");
    expect(enlace).toContain("https://wa.me/5491155551234?text=");
    expect(decodeURIComponent(enlace.split("text=")[1])).toContain("Hola Almacén Don Pepe,");
    // El 0 y el 15 se sacan, como pide WhatsApp.
    expect(await page.locator(".waFilaRonda", { hasText: "Kiosco La Esquina" }).locator("a").getAttribute("href")).toContain("https://wa.me/5491144440000?text=");

    const [ventana] = await Promise.all([page.waitForEvent("popup"), enviar.click()]);
    await ventana.close();
    await expect(page.locator(".waProgreso")).toHaveText("1 de 2 enviados");
    await expect(page.locator(".waBotonGrande", { hasText: "Enviar a Kiosco La Esquina" })).toBeVisible();
    await expect(page.locator(".waFilaRonda.hecho")).toContainText("Almacén Don Pepe");
    await capturar(page, "whatsapp-02-ronda-en-curso");
    await page.getByRole("button", { name: "Terminar ronda" }).click();
    await expect(page.locator("#waEmpezar")).toBeVisible();

    // Compartir a VendeFrío: el service worker deja lo compartido y abre
    // la app con ?compartido=1 (acá se deja a mano, sin service worker).
    await page.evaluate(async () => {
        const cache = await caches.open("vendefrio-compartido");
        await cache.put("./compartido/datos", new Response(JSON.stringify({ texto: "Almacén Don Pepe: 2 helados de 1 kg, 3 palitos bombón", audio: { tipo: "audio/ogg" } })));
        await cache.put("./compartido/audio", new Response(new Uint8Array([79, 103, 103, 83, 0, 2]), { headers: { "Content-Type": "audio/ogg" } }));
    });
    await page.goto("/?compartido=1");
    const dictado = page.locator(".ventanaDictado");
    await expect(dictado).toBeVisible();
    await expect(dictado.locator(".productoDictado")).toHaveCount(2);
    await expect(dictado.locator(".productoDictado", { hasText: "Helado 1 kg" })).toContainText("2 ×");
    await expect(dictado.locator(".productoDictado", { hasText: "Palito bombón" })).toContainText("3 ×");
    // El audio se puede escuchar; sin "Pasar audios a texto", se dicta.
    await expect(dictado.locator(".waAudioCompartido audio")).toHaveCount(1);
    await expect(dictado.locator(".waAudioCompartido")).toContainText("Escuchalo y dictalo");
    await expect(page).toHaveURL(/\/(index\.html)?$/);
    await capturar(page, "whatsapp-03-compartido");
    await dictado.getByRole("button", { name: "Agregar al pedido" }).click();
    await expect(page.locator("#cliente")).toHaveValue("Almacén Don Pepe");
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("5");
    // Lo compartido se lee una sola vez.
    expect(await page.evaluate(async () => Boolean(await (await caches.open("vendefrio-compartido")).match("./compartido/datos")))).toBe(false);
});

test("whatsapp: automático, con la ronda y las respuestas que llegan solas", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(() => {
        agregarComercio({ nombre: "Kiosco La Esquina", direccion: "Belgrano 450", telefono: "11 4444-0000" });
        agregarComercio({ nombre: "Super Norte", direccion: "Mitre 900" });
    });
    const idDistribuidora = await page.evaluate(() => distribuidoraVendeFrio.idActual());
    prepararVercel(idDistribuidora);
    const { crearManejador: crearEnviar } = require("../api/whatsapp-enviar.js");
    const { crearManejador: crearWebhook } = require("../api/whatsapp.js");
    const { crearManejador: crearAudio } = require("../api/whatsapp-audio.js");

    const mandados = [];
    const enviar = crearEnviar({ obtenerApp: () => appAdmin, enviar: async destino => mandados.push(destino) });
    const audiosPasados = [];
    const pasarATexto = async ({ audio, palabras }) => {
        audiosPasados.push({ largo: audio.length, palabras });
        return "Hola, soy del kiosco, mandame 4 palitos bombón";
    };
    const webhook = crearWebhook({ obtenerApp: () => appAdmin, bajarAudio: async () => ({ audio: Buffer.from("ogg"), tipo: "audio/ogg" }), pasarATexto });
    const audio = crearAudio({ obtenerApp: () => appAdmin, pasarATexto });
    await page.route("**/api/whatsapp-enviar", async ruta => {
        const pedido = ruta.request();
        const credencial = String(pedido.headers().authorization || "").replace(/^Bearer /, "");
        const salida = await llamar(enviar, { cuerpo: pedido.postDataJSON(), credencial });
        await ruta.fulfill({ status: salida.estado, contentType: "application/json", body: JSON.stringify(salida.datos) });
    });

    // Antes de prenderlo, la función no manda nada.
    const credencial = await credencialDe(page);
    const ids = await page.evaluate(() => obtenerComercios().map(comercio => comercio.id));
    expect((await llamar(enviar, { cuerpo: { idDistribuidora, accion: "enviar", idsComercios: ids }, credencial })).datos.codigo).toBe("apagado");
    expect((await llamar(enviar, { cuerpo: { idDistribuidora, accion: "estado" } })).estado).toBe(401);

    // El dueño lo prende en Más > WhatsApp.
    await abrirWhatsapp(page);
    await page.getByRole("switch", { name: "Usar WhatsApp automático" }).check();
    await page.getByRole("switch", { name: "Pasar audios a texto" }).check();
    await expect.poll(async () => (await nube.doc(`distribuidoras/${idDistribuidora}/config/whatsapp`).get()).data()).toEqual({
        activo: true, audios: true, plantilla: "pedido_semana", idioma: "es_AR"
    });
    await page.getByRole("button", { name: "Revisar la conexión" }).click();
    await expect(page.locator(".waEstado li.ok")).toHaveCount(3);
    // El título queda debajo de la flecha y la casita, que se quedan arriba.
    await page.evaluate(() => window.scrollBy(0, document.getElementById("waTituloAutomatico").getBoundingClientRect().top - 110));
    await capturar(page, "whatsapp-04-automatico");

    // La ronda automática: a los que tienen teléfono, con su nombre.
    await page.getByRole("button", { name: "Todos", exact: true }).click();
    await page.locator("#waEnviarTodos").click();
    await page.locator(".waConfirmar").getByRole("button", { name: "Mandar" }).click();
    await expect(page.locator("#modalAviso")).toContainText("Se mandaron 2 mensajes");
    await page.locator("#cerrarAviso").click();
    expect(mandados.map(item => [item.numero, item.nombre, item.plantilla])).toEqual(expect.arrayContaining([
        ["5491155551234", "Almacén Don Pepe", "pedido_semana"],
        ["5491144440000", "Kiosco La Esquina", "pedido_semana"]
    ]));
    expect(mandados).toHaveLength(2);
    // Super Norte no tiene teléfono: la función tampoco le manda.
    const conSuper = await llamar(enviar, { cuerpo: { idDistribuidora, accion: "enviar", idsComercios: ids }, credencial });
    expect(conSuper.datos.resultados.find(item => item.nombre === "Super Norte")).toMatchObject({ ok: false, motivo: "Sin teléfono" });

    // Conectar el webhook: solo con la palabra elegida.
    expect((await llamar(webhook, { metodo: "GET", consulta: { "hub.mode": "subscribe", "hub.verify_token": PALABRA, "hub.challenge": "1234" } })).texto).toBe("1234");
    expect((await llamar(webhook, { metodo: "GET", consulta: { "hub.mode": "subscribe", "hub.verify_token": "otra", "hub.challenge": "1234" } })).estado).toBe(403);

    // Un mensaje sin la firma de Meta no entra.
    const falso = await avisarMensaje(webhook, [{ id: "wamid.falso", from: "5491155551234", timestamp: "1760000000", type: "text", text: { body: "10 helados" } }], { firma: "sha256=0000" });
    expect(falso.estado).toBe(401);

    // Llegan las respuestas: un pedido claro, un audio y un mensaje que no se entiende.
    const ahora = Math.floor(Date.now() / 1000);
    const llegada = await avisarMensaje(webhook, [
        { id: "wamid.pepe", from: "5491155551234", timestamp: String(ahora - 120), type: "text", text: { body: "Hola! Sí, mandame 3 helados de 1 kg y 2 palitos bombón. Tengo 1 cambio de palito bombón. Gracias!" }, perfil: "Pepe" },
        { id: "wamid.kiosco", from: "5491144440000", timestamp: String(ahora - 60), type: "audio", audio: { id: "medio-1", mime_type: "audio/ogg" } },
        { id: "wamid.nuevo", from: "5493415550000", timestamp: String(ahora), type: "text", text: { body: "Hola, quiero 2 cajas de alfajores" }, perfil: "Carla" }
    ]);
    expect(llegada.datos).toEqual({ ok: true, guardados: 3 });
    expect(audiosPasados[0].palabras).toContain("Palito bombón");
    // Meta a veces manda el mismo mensaje dos veces: se guarda una sola.
    const repetido = await avisarMensaje(webhook, [{ id: "wamid.pepe", from: "5491155551234", timestamp: String(ahora), type: "text", text: { body: "Hola!" } }]);
    expect(repetido.datos.guardados).toBe(0);

    // Inicio avisa y Más > WhatsApp los muestra con el pedido armado.
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    await expect(page.locator("#dashWhatsapp")).toContainText("3 mensajes de WhatsApp");
    await page.locator("#dashWhatsapp").click();
    const tarjetas = page.locator(".waMensaje");
    await expect(tarjetas).toHaveCount(3);
    const pepe = tarjetas.filter({ hasText: "Almacén Don Pepe" });
    await expect(pepe.locator(".waEtiqueta")).toHaveText("Se entendió todo");
    await expect(pepe.locator(".waProductos")).toContainText("3 × Helado 1 kg");
    await expect(pepe).toContainText("Cambios (no se suman)");
    const kiosco = tarjetas.filter({ hasText: "Kiosco La Esquina" });
    await expect(kiosco).toContainText("mandame 4 palitos bombón");
    await expect(kiosco.locator(".waEtiqueta")).toHaveText("Se entendió todo");
    const carla = tarjetas.filter({ hasText: "Carla" });
    await expect(carla.locator(".waEtiqueta")).toHaveText("Para revisar");
    await expect(carla).toContainText("No sé de qué comercio es");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "whatsapp-05-mensajes");

    // Los dos que se entendieron se cargan juntos, como "Cargado".
    await page.getByRole("button", { name: "Cargar los 2 que se entendieron" }).click();
    await page.locator(".waConfirmar").getByRole("button", { name: "Cargar" }).click();
    await expect(tarjetas).toHaveCount(1);
    await expect.poll(async () => {
        const pedidos = (await nube.collection(`distribuidoras/${idDistribuidora}/pedidos`).get()).docs.map(doc => doc.data());
        return pedidos.map(pedido => [pedido.comercio, pedido.estado, pedido.cantidad, pedido.observaciones.slice(0, 9)]).sort();
    }).toEqual([
        ["Almacén Don Pepe", "cargado", 5, "Cambios: "],
        ["Kiosco La Esquina", "cargado", 4, "Audio de "]
    ]);
    const marcado = (await nube.doc(`distribuidoras/${idDistribuidora}/whatsapp/wamid_pepe`).get()).data();
    expect(marcado.estado).toBe("cargado");
    expect(marcado.atendido.nombre).toBe("Jere");

    // El que no se entendió: «Que lo lea el Asistente» (Claude, acá uno
    // falso) y después se carga a mano, revisándolo en "Nuevo pedido".
    await page.evaluate(() => {
        window.vozVendeFrio.leerPedidoConIA = async texto => ({
            comercio: obtenerComercios().find(comercio => comercio.nombre === "Super Norte"),
            productos: texto.includes("alfajores") ? [{ marca: "Frío Sur", producto: "Palito bombón", cantidad: 2 }] : [],
            sinEntender: []
        });
        window.whatsappVendeFrio.abrir();
    });
    await carla.getByRole("button", { name: "Que lo lea el Asistente" }).click();
    await expect(carla.locator(".waEtiqueta")).toHaveText("Se entendió todo");
    await expect(carla.locator(".waProductos")).toContainText("2 × Palito bombón");
    await carla.getByRole("button", { name: "Cargar pedido" }).click();
    await expect(page.locator("#obs")).toHaveValue("WhatsApp: «Hola, quiero 2 cajas de alfajores»");
    await expect(page.locator("#cliente")).toHaveValue("Super Norte");
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("2");
    await page.locator("#generar").click();
    await expect(page.locator("#modalPedido")).toBeVisible();
    await expect.poll(async () => (await nube.doc(`distribuidoras/${idDistribuidora}/whatsapp/wamid_nuevo`).get()).data().estado).toBe("cargado");

    // Un audio compartido se pasa a texto con la función.
    const pasado = await llamar(audio, { cuerpo: { idDistribuidora, audio: Buffer.from("ogg").toString("base64"), tipo: "audio/ogg" }, credencial });
    expect(pasado.datos).toEqual({ ok: true, texto: "Hola, soy del kiosco, mandame 4 palitos bombón" });
    expect((await llamar(audio, { cuerpo: { idDistribuidora, audio: "AAAA", tipo: "audio/ogg" } })).estado).toBe(401);

    // Nadie del equipo puede inventar ni borrar mensajes desde la app.
    const bloqueado = await page.evaluate(async id => {
        const ref = firebase.firestore().collection("distribuidoras").doc(id).collection("whatsapp");
        const resultados = [];
        for (const intento of [() => ref.doc("inventado").set({ estado: "nuevo" }), () => ref.doc("wamid_pepe").delete(), () => ref.doc("wamid_pepe").update({ texto: "otro" })]) {
            try {
                await intento();
                resultados.push("pasó");
            } catch (error) {
                resultados.push(error.code);
            }
        }
        return resultados;
    }, idDistribuidora);
    expect(bloqueado).toEqual(["permission-denied", "permission-denied", "permission-denied"]);
});

// sw.js en una caja aparte de Node: recibe lo compartido y abre la app.
test("whatsapp: el service worker recibe lo compartido", async () => {
    const guardado = new Map();
    const cache = {
        put: async (clave, respuesta) => guardado.set(clave, respuesta),
        delete: async clave => guardado.delete(clave),
        match: async clave => guardado.get(clave)
    };
    const oyentes = {};
    const self = {
        location: new URL("https://vendefrio.test/"),
        registration: { scope: "https://vendefrio.test/" },
        clients: { claim() {} },
        addEventListener: (tipo, oyente) => {
            oyentes[tipo] = oyente;
        },
        skipWaiting() {}
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8"), {
        self, URL, URLSearchParams, Response, console, caches: { open: async () => cache }
    });

    const formulario = new FormData();
    formulario.append("text", "3 helados de 1 kg");
    formulario.append("audio", new Blob([new Uint8Array([1, 2, 3])], { type: "audio/ogg" }), "PTT-0001.opus");
    let respuesta = null;
    oyentes.fetch({
        request: { method: "POST", url: "https://vendefrio.test/compartir", formData: async () => formulario },
        respondWith: promesa => {
            respuesta = promesa;
        }
    });
    const final = await respuesta;
    expect(final.status).toBe(303);
    expect(final.headers.get("location")).toBe("https://vendefrio.test/index.html?compartido=1");
    const datos = await guardado.get("./compartido/datos").json();
    expect(datos).toMatchObject({ texto: "3 helados de 1 kg", audio: { nombre: "PTT-0001.opus", tipo: "audio/ogg" } });
    expect((await guardado.get("./compartido/audio").arrayBuffer()).byteLength).toBe(3);

    const manifiesto = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
    expect(manifiesto.share_target).toMatchObject({ action: "./compartir", method: "POST", enctype: "multipart/form-data" });
});
