// VendeFrío - Función de Vercel: mensajes que llegan por WhatsApp (T56, T57)
//
// Es el "webhook" (la dirección a la que Meta avisa cada mensaje nuevo):
//   GET  /api/whatsapp   Meta lo llama una vez al conectarlo, con la palabra
//                        de WHATSAPP_TOKEN_VERIFICACION.
//   POST /api/whatsapp   cada mensaje que le escriben a la distribuidora.
//
// Con cada mensaje:
// 1. Revisa la firma de Meta (WHATSAPP_SECRETO_APP): si no coincide, no lo
//    acepta. Así nadie de afuera puede meter mensajes falsos.
// 2. Si "WhatsApp automático" está apagado, no guarda nada.
// 3. Busca el comercio por su teléfono.
// 4. Si es un audio y "Pasar audios a texto" está prendido (y hay clave), lo
//    descarga de Meta y lo pasa a texto. El audio no se guarda.
// 5. Lo guarda en distribuidoras/{id}/whatsapp/{idMensaje} con estado
//    "nuevo". La app lo lee, arma el pedido con lo que entiende y lo deja
//    "Para revisar" en Más > WhatsApp. Cada mensaje se guarda una sola vez,
//    aunque Meta lo mande de nuevo.
const crypto = require("crypto");
const { getFirestore } = require("firebase-admin/firestore");
const comun = require("./_whatsapp-comun.js");

const NOMBRE_APP = "whatsapp";
const LARGO_MAXIMO_TEXTO = 2000;
const LARGO_MAXIMO_CUERPO = 1024 * 1024;

async function leerCrudo(request) {
    if (Buffer.isBuffer(request.body)) return request.body;
    if (typeof request.body === "string") return Buffer.from(request.body, "utf8");
    const partes = [];
    let largo = 0;
    for await (const parte of request) {
        largo += parte.length;
        if (largo > LARGO_MAXIMO_CUERPO) throw new Error("Mensaje demasiado grande.");
        partes.push(Buffer.from(parte));
    }
    return Buffer.concat(partes);
}

function firmaValida(crudo, encabezado, secreto) {
    if (!secreto || !encabezado || !String(encabezado).startsWith("sha256=")) return false;
    const esperada = Buffer.from("sha256=" + crypto.createHmac("sha256", secreto).update(crudo).digest("hex"));
    const recibida = Buffer.from(String(encabezado));
    return esperada.length === recibida.length && crypto.timingSafeEqual(esperada, recibida);
}

function idDeDocumento(idMensaje) {
    return String(idMensaje || "").replace(/[^A-Za-z0-9_-]/g, "_").slice(-120);
}

// Descarga el audio de Meta: primero pide la dirección y después el archivo.
async function descargarAudio(idMedio, fetchFn = fetch) {
    const autorizacion = { Authorization: "Bearer " + process.env.WHATSAPP_TOKEN };
    const datos = await (await fetchFn(`https://graph.facebook.com/${comun.VERSION_GRAPH}/${encodeURIComponent(idMedio)}`, { headers: autorizacion })).json();
    if (!datos || !datos.url) throw new Error("Meta no dio la dirección del audio.");
    const archivo = await fetchFn(datos.url, { headers: autorizacion });
    if (!archivo.ok) throw new Error("No se pudo descargar el audio.");
    return { audio: Buffer.from(await archivo.arrayBuffer()), tipo: String(datos.mime_type || "audio/ogg") };
}

function textoDelMensaje(mensaje) {
    if (mensaje.type === "text") return String(mensaje.text && mensaje.text.body || "");
    if (mensaje.type === "button") return String(mensaje.button && mensaje.button.text || "");
    if (mensaje.type === "interactive") {
        const respuesta = mensaje.interactive && (mensaje.interactive.button_reply || mensaje.interactive.list_reply);
        return String(respuesta && respuesta.title || "");
    }
    return "";
}

function crearManejador({ obtenerApp, bajarAudio = descargarAudio, pasarATexto = comun.audioATexto }) {
    return async function whatsapp(request, response) {
        // 1. Conectar el webhook (Meta lo llama una sola vez).
        if (request.method === "GET") {
            const consulta = request.query || {};
            const palabra = process.env.WHATSAPP_TOKEN_VERIFICACION || "";
            if (consulta["hub.mode"] === "subscribe" && palabra && consulta["hub.verify_token"] === palabra) {
                response.setHeader("Content-Type", "text/plain; charset=utf-8");
                return response.status(200).send(String(consulta["hub.challenge"] || ""));
            }
            return comun.responder(response, 403, { ok: false });
        }
        if (request.method !== "POST") {
            response.setHeader("Allow", "GET, POST");
            return comun.responder(response, 405, { ok: false });
        }

        let crudo;
        try {
            crudo = await leerCrudo(request);
        } catch (error) {
            return comun.responder(response, 413, { ok: false });
        }
        const firma = request.headers && (request.headers["x-hub-signature-256"] || request.headers["X-Hub-Signature-256"]);
        if (!firmaValida(crudo, firma, process.env.WHATSAPP_SECRETO_APP || "")) {
            return comun.responder(response, 401, { ok: false });
        }

        let aviso;
        try {
            aviso = JSON.parse(crudo.toString("utf8"));
        } catch (error) {
            return comun.responder(response, 400, { ok: false });
        }

        const idDistribuidora = process.env.WHATSAPP_DISTRIBUIDORA || "";
        if (!comun.ID_VALIDO.test(idDistribuidora)) return comun.responder(response, 200, { ok: true, guardados: 0 });

        const mensajes = [];
        (Array.isArray(aviso && aviso.entry) ? aviso.entry : []).forEach(entrada => {
            (Array.isArray(entrada && entrada.changes) ? entrada.changes : []).forEach(cambio => {
                const valor = cambio && cambio.value || {};
                const contactos = Array.isArray(valor.contacts) ? valor.contacts : [];
                (Array.isArray(valor.messages) ? valor.messages : []).forEach(mensaje => {
                    if (!mensaje || !mensaje.id || !mensaje.from) return;
                    const contacto = contactos.find(item => item && item.wa_id === mensaje.from);
                    mensajes.push({ mensaje, nombrePerfil: String(contacto && contacto.profile && contacto.profile.name || "").slice(0, 80) });
                });
            });
        });
        if (!mensajes.length) return comun.responder(response, 200, { ok: true, guardados: 0 });

        let app;
        try {
            app = obtenerApp();
        } catch (error) {
            console.error("No se pudo iniciar Firebase en la función.", error.sinConfigurar ? error.message : error);
            return comun.responder(response, 503, { ok: false });
        }
        const db = getFirestore(app);
        const ref = db.collection("distribuidoras").doc(idDistribuidora);
        const config = comun.configWhatsapp((await ref.collection("config").doc("whatsapp").get()).data());
        if (!config.activo) return comun.responder(response, 200, { ok: true, guardados: 0 });

        const comercios = (await ref.collection("comercios").get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));
        let palabras = null;
        let guardados = 0;

        for (const { mensaje, nombrePerfil } of mensajes) {
            const documento = ref.collection("whatsapp").doc(idDeDocumento(mensaje.id));
            if ((await documento.get()).exists) continue;

            const comercio = comercios.find(item => comun.mismoNumero(item.telefono, mensaje.from)) || null;
            const tipo = mensaje.type === "audio" ? "audio" : textoDelMensaje(mensaje) ? "texto" : "otro";
            let texto = textoDelMensaje(mensaje);
            let sinTexto = "";
            if (tipo === "audio") {
                if (!config.audios) sinTexto = "apagado";
                else if (!comun.configurado().audios) sinTexto = "sinClave";
                else {
                    try {
                        if (palabras === null) {
                            const productos = (await ref.collection("productos").get()).docs.map(doc => doc.data());
                            palabras = productos.map(item => item && item.nombre).filter(Boolean).slice(0, 120).join(", ");
                        }
                        const { audio, tipo: tipoAudio } = await bajarAudio(mensaje.audio && mensaje.audio.id);
                        texto = await pasarATexto({ audio, tipo: tipoAudio, palabras });
                    } catch (error) {
                        console.error("No se pudo pasar el audio a texto.", error && error.message);
                        sinTexto = "error";
                    }
                }
            }

            try {
                await documento.create({
                    tipo,
                    texto: String(texto || "").slice(0, LARGO_MAXIMO_TEXTO),
                    sinTexto,
                    de: String(mensaje.from).replace(/\D/g, "").slice(0, 20),
                    nombrePerfil,
                    idComercio: comercio ? String(comercio.id) : "",
                    comercio: comercio ? String(comercio.nombre || "").slice(0, 80) : "",
                    hora: (Number(mensaje.timestamp) || Math.floor(Date.now() / 1000)) * 1000,
                    estado: "nuevo"
                });
                guardados++;
            } catch (error) {
                // Ya existía (Meta lo mandó dos veces a la vez): no pasa nada.
                if (error && error.code !== 6) console.error("No se pudo guardar el mensaje.", error);
            }
        }
        return comun.responder(response, 200, { ok: true, guardados });
    };
}

module.exports = crearManejador({ obtenerApp: () => comun.appDeVercel(NOMBRE_APP) });
module.exports.crearManejador = crearManejador;
module.exports.firmaValida = firmaValida;
// La firma se revisa sobre el mensaje tal cual llegó: Vercel no lo tiene que leer antes.
module.exports.config = { api: { bodyParser: false } };
