// VendeFrío - Notificaciones con la app cerrada (T29), con los emuladores de
// Firebase.
// Una máquina no puede recibir notificaciones de verdad: el servicio de
// Firebase Cloud Messaging se reemplaza por uno falso (da un token de
// prueba) y la función de Vercel (api/notificar.js) corre acá mismo, con
// los emuladores y con un "envío" que solo anota lo que se mandaría.
// 1. El dueño y un empleado activan las notificaciones; el empleado carga un
//    pedido y la función le manda la notificación al celular del dueño. La
//    misma no se manda dos veces y nadie de afuera puede usar la función.
//    Silenciar un aviso lo deja de mandar; al tocar la notificación se abre
//    el pedido; un empleado dado de baja no recibe más; al salir de la
//    cuenta, el celular se borra.
// 2. En un iPhone sin la app instalada, explica cómo instalarla.
// 3. El service worker (sw.js) muestra la notificación con la app cerrada y,
//    al tocarla, abre la app en ese pedido.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { test, expect, capturar, prepararPagina } = require("./ayudas");
const { abrirMas, abrirAjustes, elegirComercio } = require("./recorridos");

test.use({ nube: true });

// La función de Vercel, con los emuladores (los prende "npm test").
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { crearManejador } = require("../api/notificar.js");

const appAdmin = getApps().find(app => app.name === "pruebas") || initializeApp({ projectId: "demo-vendefrio" }, "pruebas");
const nube = getFirestore(appAdmin);
const enviados = [];
let llamadas = 0;
const manejador = crearManejador({
    obtenerApp: () => appAdmin,
    enviar: async (app, mensajes) => {
        enviados.push(...mensajes);
        return { responses: mensajes.map(() => ({ success: true })) };
    }
});

async function llamarFuncion({ cuerpo, credencial, metodo = "POST" }) {
    let estado = 0;
    let datos = null;
    const respuesta = {
        setHeader() {},
        status(numero) {
            estado = numero;
            return this;
        },
        json(objeto) {
            datos = objeto;
            return this;
        }
    };
    await manejador({ method: metodo, headers: credencial ? { authorization: "Bearer " + credencial } : {}, body: cuerpo }, respuesta);
    return { estado, datos };
}

// Servicio de notificaciones falso: el token queda guardado en el celular,
// como con el de verdad.
const MENSAJERIA_FALSA = `
(function () {
    if (!window.firebase) return;
    window.firebase.messaging = function () {
        return {
            async getToken(opciones) {
                if (!opciones || !opciones.vapidKey || !opciones.serviceWorkerRegistration) throw new Error("Faltan datos para el token");
                let token = localStorage.getItem("prueba_token");
                if (!token) {
                    token = "token-prueba-" + Math.random().toString(36).slice(2);
                    localStorage.setItem("prueba_token", token);
                }
                return token;
            },
            async deleteToken() {
                localStorage.removeItem("prueba_token");
                return true;
            }
        };
    };
    window.firebase.messaging.isSupported = () => true;
})();`;

// Celular que puede recibir notificaciones: permiso dado, un service worker
// falso (en las pruebas el de verdad está apagado) y la función de Vercel
// corriendo acá.
async function prepararNotificaciones(pagina) {
    await pagina.context().grantPermissions(["notifications"]);
    await pagina.addInitScript(() => {
        const registro = { scope: location.origin + "/", active: {}, pushManager: {} };
        const trabajador = new EventTarget();
        trabajador.register = async () => registro;
        trabajador.getRegistration = async () => registro;
        trabajador.ready = Promise.resolve(registro);
        Object.defineProperty(navigator, "serviceWorker", { value: trabajador, configurable: true });
        if (!("PushManager" in window)) window.PushManager = function PushManager() {};
        // Algunos Chromium de prueba (por ejemplo, el "headless shell")
        // dicen "denied" aunque el permiso esté dado: se respeta el permiso
        // dado arriba.
        if (window.Notification && Notification.permission === "denied") {
            Object.defineProperty(Notification, "permission", { get: () => "granted", configurable: true });
            Notification.requestPermission = async () => "granted";
        }
    });
    await pagina.route("**/firebase/firebase-messaging-compat.js", ruta =>
        ruta.fulfill({ status: 200, contentType: "text/javascript", body: MENSAJERIA_FALSA })
    );
    await pagina.route("**/api/notificar", async ruta => {
        const pedido = ruta.request();
        const credencial = String(pedido.headers().authorization || "").replace(/^Bearer /, "");
        const { estado, datos } = await llamarFuncion({ cuerpo: pedido.postDataJSON(), credencial, metodo: pedido.method() });
        llamadas += 1;
        await ruta.fulfill({ status: estado, contentType: "application/json", body: JSON.stringify(datos) });
    });
}

async function registrarDistribuidora(page, testInfo) {
    await page.goto("/");
    await page.getByRole("button", { name: "Entrar con email" }).click();
    await page.getByRole("button", { name: /Registrarse/ }).click();
    await page.locator("#inicioRegistroNombre").fill("Distribuidora Prueba");
    await page.locator("#inicioRegistroEmail").fill(`notif-${testInfo.project.name}-${Date.now()}@prueba.com`);
    await page.locator("#inicioRegistroContrasena").fill("clave-de-prueba");
    await page.locator("#inicioRegistroRepetir").fill("clave-de-prueba");
    await page.getByRole("button", { name: "Crear cuenta y distribuidora" }).click();
    await expect(page.locator("#inicioNombreDueno")).toBeVisible({ timeout: 20000 });
    await page.locator("#inicioNombreDueno").fill("Jere");
    await page.locator("#inicioFormDatosDueno").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();

    const guardado = await page.evaluate(() =>
        agregarComercio({ nombre: "Almacén Don Pepe", direccion: "San Martín 123", telefono: "" }) &&
        agregarComercio({ nombre: "Kiosco Luna", direccion: "Belgrano 45", telefono: "" }) &&
        agregarMarca("Frío Sur") &&
        agregarProducto("Frío Sur", { nombre: "Helado 1 kg", precio: 4500 })
    );
    expect(guardado).toBeTruthy();
}

async function cargarPedido(page, comercio) {
    await page.locator(".bottom-nav").getByRole("button", { name: "Pedidos" }).click();
    await expect(page.locator("#vistaPedidos")).toBeVisible();
    await page.getByRole("button", { name: "Nuevo pedido" }).click();
    await elegirComercio(page, comercio);
    await page.locator(".tituloMarca", { hasText: "Frío Sur" }).click();
    await page.locator(".listaProdutos .fila", { hasText: "Helado 1 kg" }).getByRole("button", { name: "Aumentar cantidad" }).click();
    await page.locator("#generar").click();
    const generado = page.locator("#modalPedido");
    await expect(generado).toBeVisible();
    await generado.click({ position: { x: 10, y: 10 } });
    await expect(generado).toBeHidden();
}

async function abrirConfiguracionEn(page, seccion) {
    await abrirAjustes(page);
    await page.locator(`.configFila[data-config-seccion="${seccion}"]`).click();
}

async function activarNotificaciones(page) {
    const bloque = page.locator("#bloqueNotificaciones");
    await expect(bloque).toContainText("Prendelas para que te suenen los avisos aunque tengas la app cerrada");
    await bloque.getByRole("button", { name: "Activar notificaciones en este celular" }).click();
    await expect(bloque).toContainText("Activadas en este celular");
    return page.evaluate(() => localStorage.getItem("prueba_token"));
}

function celularesDe(idDistribuidora, idPersona) {
    return nube.collection("distribuidoras").doc(idDistribuidora).collection("celulares").where("idPersona", "==", idPersona).get();
}

// Una cuenta nueva del emulador que no es de ninguna distribuidora.
async function credencialDeAfuera() {
    const respuesta = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=prueba", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `afuera-${Date.now()}@prueba.com`, password: "clave-de-prueba", returnSecureToken: true })
    });
    return (await respuesta.json()).idToken;
}

test("notificaciones: activar, sonar con la app cerrada y abrir el pedido", async ({ page, browser }, testInfo) => {
    await prepararNotificaciones(page);
    await registrarDistribuidora(page, testInfo);
    const { distribuidora: idDistribuidora } = await page.evaluate(() => obtenerModoNubeGuardado());

    // El dueño activa las notificaciones en Configuración > Avisos.
    await abrirConfiguracionEn(page, "avisos");
    await expect(page.locator("#bloqueNotificaciones")).toContainText("Notificaciones con la app cerrada");
    await capturar(page, "nube-23-activar-notificaciones");
    const tokenDueno = await activarNotificaciones(page);
    expect(tokenDueno).toMatch(/^token-prueba-/);
    await expect(page.locator(".configDetalle")).toContainText("Qué suena con la app cerrada");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "nube-24-notificaciones-activadas");
    await expect.poll(async () => (await celularesDe(idDistribuidora, "dueno")).docs.map(doc => doc.data().token)).toEqual([tokenDueno]);

    // Segundo celular: un empleado entra con un código y también las activa.
    await page.locator("#pantallaConfiguracion").getByRole("button", { name: "Volver", exact: true }).click();
    await page.locator('.configFila[data-config-seccion="empleados"]').click();
    await page.getByRole("button", { name: "Generar código para un empleado nuevo" }).click();
    const codigo = (await page.locator("#empleadoCodigoGenerado strong").textContent()).trim();

    const contexto = await browser.newContext({
        ...testInfo.project.use,
        baseURL: testInfo.project.use.baseURL,
        serviceWorkers: "block"
    });
    const empleado = await contexto.newPage();
    const erroresEmpleado = await prepararPagina(empleado, true);
    await prepararNotificaciones(empleado);
    await empleado.goto("/");
    await empleado.getByRole("button", { name: "Entrar con código" }).click();
    await empleado.locator("#inicioCodigo").fill(codigo);
    await empleado.locator("#inicioFormEmpleado").getByRole("button", { name: "Entrar" }).click();
    await expect(empleado.locator("#inicioNombreEmpleado")).toBeVisible({ timeout: 20000 });
    await empleado.locator("#inicioNombreEmpleado").fill("Maxi");
    await empleado.locator("#inicioFormDatosEmpleado").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(empleado.locator("#pantallaInicioSesion")).toBeHidden();
    const { idEmpleado } = await empleado.evaluate(() => JSON.parse(localStorage.getItem("vendefrio_empleado")));
    await abrirConfiguracionEn(empleado, "avisos");
    const tokenEmpleado = await activarNotificaciones(empleado);
    expect(tokenEmpleado).not.toBe(tokenDueno);

    // El empleado carga un pedido: al dueño le llega la notificación.
    await cargarPedido(empleado, "Almacén Don Pepe");
    await expect.poll(() => enviados.filter(mensaje => mensaje.token === tokenDueno).length).toBe(1);
    const mensaje = enviados.find(item => item.token === tokenDueno);
    expect(mensaje.webpush.notification.title).toBe("Pedido nuevo · Almacén Don Pepe");
    expect(mensaje.webpush.notification.body).toBe("Cargado por Maxi");
    expect(mensaje.data.tipo).toBe("pedidoNuevo");
    expect(mensaje.data.idPedido).toBeTruthy();
    // Nunca a quien hizo el cambio.
    expect(enviados.filter(item => item.token === tokenEmpleado)).toHaveLength(0);

    // La misma no se manda dos veces, un aviso que no existe no se manda y
    // nadie de afuera puede usar la función.
    const credencialEmpleado = await empleado.evaluate(() => firebase.auth().currentUser.getIdToken());
    const otraVez = await llamarFuncion({ cuerpo: { idDistribuidora, idAviso: mensaje.data.idAviso, para: ["dueno"] }, credencial: credencialEmpleado });
    expect(otraVez).toEqual({ estado: 200, datos: { ok: true, enviadas: 0 } });
    const inventado = await llamarFuncion({ cuerpo: { idDistribuidora, idAviso: "avi_inventado", para: ["dueno"] }, credencial: credencialEmpleado });
    expect(inventado.datos.enviadas).toBe(0);
    expect((await llamarFuncion({ cuerpo: { idDistribuidora, idAviso: mensaje.data.idAviso, para: ["dueno"] } })).estado).toBe(401);
    expect((await llamarFuncion({ cuerpo: { idDistribuidora, idAviso: mensaje.data.idAviso, para: ["dueno"] }, credencial: "inventada" })).estado).toBe(401);
    const deAfuera = await llamarFuncion({ cuerpo: { idDistribuidora, idAviso: mensaje.data.idAviso, para: ["dueno"] }, credencial: await credencialDeAfuera() });
    expect(deAfuera.estado).toBe(403);
    expect((await llamarFuncion({ cuerpo: {}, credencial: credencialEmpleado, metodo: "GET" })).estado).toBe(405);
    expect(enviados.filter(item => item.token === tokenDueno)).toHaveLength(1);

    // El dueño silencia "Pedido nuevo": el siguiente le llega a la
    // campanita, pero no suena.
    await page.locator("#pantallaConfiguracion").getByRole("button", { name: "Volver", exact: true }).click();
    await page.locator('.configFila[data-config-seccion="avisos"]').click();
    const suenaPedidoNuevo = page.locator('.casillaSuena[value="pedidoNuevo"]');
    await expect(suenaPedidoNuevo).toBeChecked();
    await suenaPedidoNuevo.uncheck();
    await expect.poll(async () => {
        const foto = await nube.collection("distribuidoras").doc(idDistribuidora).collection("preferenciasNotificaciones").doc("dueno").get();
        return foto.exists ? foto.data().silenciados : [];
    }).toEqual(["pedidoNuevo"]);
    await suenaPedidoNuevo.scrollIntoViewIfNeeded();
    await capturar(page, "nube-25-que-suena");

    const antes = llamadas;
    await cargarPedido(empleado, "Kiosco Luna");
    await expect.poll(() => llamadas).toBe(antes + 1);
    expect(enviados.filter(item => item.token === tokenDueno)).toHaveLength(1);

    // Al tocar la notificación, la app se abre en ese pedido y el aviso
    // queda leído.
    await page.goto(`/index.html?aviso=${encodeURIComponent(mensaje.data.idAviso)}&pedido=${encodeURIComponent(mensaje.data.idPedido)}&tipo=pedidoNuevo`);
    const ficha = page.locator(".fichaPedido");
    await expect(ficha).toBeVisible({ timeout: 20000 });
    await expect(ficha).toContainText("Almacén Don Pepe");
    expect(await page.evaluate(() => location.search)).toBe("");
    await expect.poll(async () => {
        const foto = await nube.collection("distribuidoras").doc(idDistribuidora).collection("avisos").doc("dueno")
            .collection("recibidos").doc(mensaje.data.idAviso).get();
        return typeof foto.data().leido;
    }).toBe("number");
    await capturar(page, "nube-26-abre-desde-notificacion");
    await ficha.getByRole("button", { name: "Cerrar" }).click();

    // Con la app abierta, sw.js le pasa la notificación tocada a la app.
    await page.evaluate(datos => navigator.serviceWorker.dispatchEvent(new MessageEvent("message", { data: { accion: "abrirAviso", aviso: datos } })),
        { idAviso: mensaje.data.idAviso, idPedido: mensaje.data.idPedido, tipo: "pedidoNuevo" });
    await expect(ficha).toBeVisible();
    await expect(ficha).toContainText("Almacén Don Pepe");
    await ficha.getByRole("button", { name: "Cerrar" }).click();

    // Un aviso del dueño para el empleado le llega a su celular; después de
    // darlo de baja, ya no (aunque su celular siga guardado).
    const credencialDueno = await page.evaluate(() => firebase.auth().currentUser.getIdToken());
    const uidDueno = await page.evaluate(() => firebase.auth().currentUser.uid);
    const dejarAvisoAlEmpleado = async idAviso => {
        await nube.collection("distribuidoras").doc(idDistribuidora).collection("avisos").doc(idEmpleado).collection("recibidos").doc(idAviso).set({
            tipo: "incidencia", idPedido: mensaje.data.idPedido, comercio: "Almacén Don Pepe", detalle: "Falta un helado",
            persona: { idPersona: "dueno", nombre: "Jere", uid: uidDueno }, horaCelular: Date.now(), leido: null
        });
        return llamarFuncion({ cuerpo: { idDistribuidora, idAviso, para: [idEmpleado] }, credencial: credencialDueno });
    };
    expect((await dejarAvisoAlEmpleado("avi_antesDeLaBaja")).datos.enviadas).toBe(1);
    const alEmpleado = enviados.find(item => item.token === tokenEmpleado);
    expect(alEmpleado.webpush.notification.title).toBe("Incidencia · Almacén Don Pepe");
    expect(alEmpleado.webpush.notification.body).toBe("Marcada por Jere: Falta un helado");

    await page.evaluate(id => window.empleadosVendeFrio.darDeBaja(id), idEmpleado);
    expect((await celularesDe(idDistribuidora, idEmpleado)).size).toBe(1);
    expect((await dejarAvisoAlEmpleado("avi_despuesDeLaBaja")).datos.enviadas).toBe(0);
    expect(enviados.filter(item => item.token === tokenEmpleado)).toHaveLength(1);
    await contexto.close();
    expect(erroresEmpleado, "La página del empleado tuvo errores de JavaScript").toEqual([]);

    // Al salir de la cuenta, el celular del dueño deja de recibirlas.
    await page.evaluate(() => {
        window.nubeVendeFrio.salirDeLaCuenta();
    });
    await expect(page.locator("#pantallaInicioSesion")).toBeVisible({ timeout: 20000 });
    expect((await celularesDe(idDistribuidora, "dueno")).size).toBe(0);
});

test("notificaciones: en iPhone explica que hay que instalar la app", async ({ page }, testInfo) => {
    // Un iPad o iPhone sin la app instalada (Chromium con el agente de
    // Safari no arranca Firebase, así que se imita lo que la app mira para
    // reconocer un iPad: "MacIntel" con pantalla táctil).
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "platform", { get: () => "MacIntel", configurable: true });
        Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5, configurable: true });
    });
    await registrarDistribuidora(page, testInfo);
    await abrirConfiguracionEn(page, "avisos");

    const bloque = page.locator("#bloqueNotificaciones");
    await expect(bloque).toContainText("En iPhone, las notificaciones llegan solo con la app instalada");
    await expect(bloque).toContainText("Agregar a inicio");
    await expect(bloque).toContainText("iOS 16.4");
    await expect(bloque.getByRole("button", { name: "Activar notificaciones en este celular" })).toHaveCount(0);
    await capturar(page, "nube-27-iphone-instalar");
});

// sw.js en una caja aparte de Node, con un "celular" falso alrededor.
function cargarServiceWorker(agente) {
    const oyentes = {};
    const celular = { mostradas: [], abiertas: [], mensajes: [], ventanas: [] };
    const self = {
        location: new URL("https://vendefrio.test/"),
        navigator: { userAgent: agente },
        registration: {
            scope: "https://vendefrio.test/",
            showNotification: async (titulo, opciones) => celular.mostradas.push({ titulo, opciones })
        },
        clients: {
            matchAll: async () => celular.ventanas,
            openWindow: async direccion => celular.abiertas.push(direccion),
            claim() {}
        },
        addEventListener: (tipo, oyente) => {
            oyentes[tipo] = oyente;
        },
        skipWaiting() {}
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8"), { self, URL, URLSearchParams, console });

    celular.disparar = async (tipo, evento) => {
        let espera = Promise.resolve();
        evento.waitUntil = promesa => {
            espera = promesa;
        };
        oyentes[tipo](evento);
        await espera;
    };
    return celular;
}

test("notificaciones: el service worker la muestra y al tocarla abre el pedido", async () => {
    const empuje = {
        data: {
            json: () => ({
                data: { idAviso: "avi_1", idPedido: "ped_1", tipo: "pedidoNuevo", titulo: "Pedido nuevo · Almacén Don Pepe", texto: "Cargado por Maxi" },
                notification: { title: "Pedido nuevo · Almacén Don Pepe", body: "Cargado por Maxi", tag: "avi_1" }
            })
        }
    };

    // Android con la app cerrada: se muestra.
    const android = cargarServiceWorker("Mozilla/5.0 (Linux; Android 14) Chrome/140 Mobile");
    await android.disparar("push", empuje);
    expect(android.mostradas).toHaveLength(1);
    expect(android.mostradas[0].titulo).toBe("Pedido nuevo · Almacén Don Pepe");
    expect(android.mostradas[0].opciones.body).toBe("Cargado por Maxi");
    expect(android.mostradas[0].opciones.data).toEqual({ idAviso: "avi_1", idPedido: "ped_1", tipo: "pedidoNuevo" });
    // Con el logo de VendeFrío (en PNG, que Android sí muestra) y el copo
    // chico arriba, en vez del ícono de Chrome.
    expect(android.mostradas[0].opciones.icon).toBe("icon-192.png");
    expect(android.mostradas[0].opciones.badge).toBe("badge.png");
    for (const archivo of [android.mostradas[0].opciones.icon, android.mostradas[0].opciones.badge]) {
        expect(fs.existsSync(path.join(__dirname, "..", archivo))).toBe(true);
    }

    // El manifiesto trae los PNG del tamaño que dice: con ellos Android
    // instala la app con su nombre y la notificación dice "VendeFrío".
    const manifiesto = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
    const pngs = manifiesto.icons.filter(icono => icono.type === "image/png");
    expect(pngs.map(icono => icono.sizes + " " + icono.purpose)).toEqual(["192x192 any", "512x512 any", "512x512 maskable"]);
    for (const icono of pngs) {
        const imagen = fs.readFileSync(path.join(__dirname, "..", icono.src));
        expect(imagen.readUInt32BE(16) + "x" + imagen.readUInt32BE(20)).toBe(icono.sizes);
    }

    // Con la app a la vista ya sale el aviso de la app; en iPhone, igual se
    // muestra.
    android.ventanas = [{ url: "https://vendefrio.test/", visibilityState: "visible" }];
    await android.disparar("push", empuje);
    expect(android.mostradas).toHaveLength(1);
    const iphone = cargarServiceWorker("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)");
    iphone.ventanas = [{ url: "https://vendefrio.test/", visibilityState: "visible" }];
    await iphone.disparar("push", empuje);
    expect(iphone.mostradas).toHaveLength(1);

    // Al tocarla con la app cerrada, abre la app en ese pedido.
    const tocar = celular => ({ notification: { data: { idAviso: "avi_1", idPedido: "ped_1", tipo: "pedidoNuevo" }, close() { celular.cerrada = true; } } });
    android.ventanas = [];
    await android.disparar("notificationclick", tocar(android));
    expect(android.cerrada).toBe(true);
    expect(android.abiertas).toEqual(["https://vendefrio.test/index.html?aviso=avi_1&pedido=ped_1&tipo=pedidoNuevo"]);

    // Con la app abierta, la trae al frente y le pasa el aviso.
    let alFrente = false;
    android.ventanas = [{
        url: "https://vendefrio.test/",
        visibilityState: "hidden",
        postMessage: mensaje => android.mensajes.push(mensaje),
        focus: async () => {
            alFrente = true;
        }
    }];
    await android.disparar("notificationclick", tocar(android));
    expect(alFrente).toBe(true);
    expect(android.mensajes).toEqual([{ accion: "abrirAviso", aviso: { idAviso: "avi_1", idPedido: "ped_1", tipo: "pedidoNuevo" } }]);
    expect(android.abiertas).toHaveLength(1);
});
