// VendeFrío - Lo que comparten las funciones de WhatsApp (T58, T59).
// Vercel no publica como función los archivos de "api" que empiezan con "_".
//
// Variables de entorno (se cargan en Vercel, nunca en el repo; tarea M16):
//   WHATSAPP_TOKEN               clave de la API de WhatsApp de Meta
//   WHATSAPP_ID_NUMERO           el "Phone number ID" del número de la distribuidora
//   WHATSAPP_SECRETO_APP         el "App secret" de la app de Meta (firma los avisos)
//   WHATSAPP_TOKEN_VERIFICACION  una palabra que elige el dueño, para conectar el webhook
//   WHATSAPP_DISTRIBUIDORA       el código de la distribuidora (se ve en Más > WhatsApp)
//   AUDIO_A_TEXTO_CLAVE          clave del servicio de audio a texto (opcional, M14)
//   FIREBASE_CUENTA_DE_SERVICIO  la misma de las notificaciones (M8)
const { initializeApp, getApps, cert } = require("firebase-admin/app");

const VERSION_GRAPH = "v21.0";
const ID_VALIDO = /^[A-Za-z0-9_-]{1,128}$/;

function appDeVercel(nombre) {
    const existente = getApps().find(app => app.name === nombre);
    if (existente) return existente;

    const texto = process.env.FIREBASE_CUENTA_DE_SERVICIO || "";
    if (!texto) {
        const error = new Error("Falta configurar FIREBASE_CUENTA_DE_SERVICIO en Vercel.");
        error.sinConfigurar = true;
        throw error;
    }
    let cuenta;
    try {
        cuenta = JSON.parse(texto);
    } catch (error) {
        const aviso = new Error("FIREBASE_CUENTA_DE_SERVICIO no es un JSON válido.");
        aviso.sinConfigurar = true;
        throw aviso;
    }
    return initializeApp({ credential: cert(cuenta), projectId: cuenta.project_id }, nombre);
}

function responder(response, estado, datos) {
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.status(estado).json(datos);
}

function leerCuerpo(request) {
    if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) return request.body;
    const texto = Buffer.isBuffer(request.body) ? request.body.toString("utf8") : request.body;
    if (typeof texto === "string" && texto) {
        try {
            return JSON.parse(texto);
        } catch (error) {
            return null;
        }
    }
    return null;
}

function credencialDe(request) {
    const encabezado = String(request.headers && request.headers.authorization || "");
    return encabezado.startsWith("Bearer ") ? encabezado.slice(7).trim() : "";
}

// Solo los dígitos, como los usa WhatsApp: Argentina con 549 adelante y sin
// el 0 ni el 15 (igual que el botón WhatsApp de la ficha del comercio).
function numeroWhatsapp(telefono) {
    let digitos = String(telefono || "").replace(/\D/g, "");
    if (digitos.length < 8) return "";
    if (!digitos.startsWith("54")) digitos = "549" + digitos.replace(/^0/, "").replace(/^(\d{2,4})15(\d{6,8})$/, "$1$2");
    return digitos;
}

// Dos números son el mismo si coinciden los últimos 10 dígitos (en
// Argentina, característica y número, con o sin 9 y 15).
function mismoNumero(a, b) {
    const x = numeroWhatsapp(a);
    const y = numeroWhatsapp(b);
    return Boolean(x && y && x.slice(-10) === y.slice(-10));
}

function configWhatsapp(datos) {
    const config = datos && typeof datos === "object" ? datos : {};
    return {
        activo: config.activo === true,
        audios: config.audios === true,
        plantilla: /^[a-z0-9_]{1,512}$/.test(String(config.plantilla || "")) ? String(config.plantilla) : "pedido_semana",
        idioma: /^[a-z]{2}(_[A-Z]{2})?$/.test(String(config.idioma || "")) ? String(config.idioma) : "es_AR"
    };
}

function configurado() {
    return {
        whatsapp: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_ID_NUMERO),
        webhook: Boolean(process.env.WHATSAPP_SECRETO_APP && process.env.WHATSAPP_TOKEN_VERIFICACION && process.env.WHATSAPP_DISTRIBUIDORA),
        audios: Boolean(process.env.AUDIO_A_TEXTO_CLAVE),
        firebase: Boolean(process.env.FIREBASE_CUENTA_DE_SERVICIO)
    };
}

// Pasa un audio a texto con el servicio de audio a texto (OpenAI, modelo
// gpt-4o-mini-transcribe). Las palabras del catálogo ayudan a que escriba
// bien los nombres de los productos.
async function audioATexto({ audio, tipo, palabras, fetchFn = fetch }) {
    const clave = process.env.AUDIO_A_TEXTO_CLAVE || "";
    if (!clave) {
        const error = new Error("Falta la clave de audio a texto.");
        error.sinConfigurar = true;
        throw error;
    }
    const formulario = new FormData();
    const extension = /mpeg|mp3/.test(tipo) ? "mp3" : /mp4|m4a|aac/.test(tipo) ? "m4a" : /wav/.test(tipo) ? "wav" : /webm/.test(tipo) ? "webm" : "ogg";
    formulario.append("file", new Blob([audio], { type: tipo || "audio/ogg" }), "audio." + extension);
    formulario.append("model", "gpt-4o-mini-transcribe");
    formulario.append("language", "es");
    if (palabras) formulario.append("prompt", "Pedido a una distribuidora. Productos: " + String(palabras).slice(0, 800));
    const respuesta = await fetchFn("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: "Bearer " + clave },
        body: formulario
    });
    if (!respuesta.ok) throw new Error("El servicio de audio a texto respondió " + respuesta.status + ".");
    const datos = await respuesta.json();
    return String(datos && datos.text || "").trim();
}

module.exports = {
    VERSION_GRAPH,
    ID_VALIDO,
    appDeVercel,
    responder,
    leerCuerpo,
    credencialDe,
    numeroWhatsapp,
    mismoNumero,
    configWhatsapp,
    configurado,
    audioATexto
};
