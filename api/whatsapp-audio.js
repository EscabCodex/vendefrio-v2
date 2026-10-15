// VendeFrío - Función de Vercel: audio compartido a texto (T59)
//
// Cuando alguien comparte un audio de WhatsApp a VendeFrío, la app lo manda
// acá para pasarlo a texto:
//   POST /api/whatsapp-audio
//   Authorization: Bearer <credencial de Firebase de alguien del equipo>
//   { idDistribuidora, audio: "<base64>", tipo: "audio/ogg" }
//
// Solo si quien llama es del equipo y "Pasar audios a texto" está prendido
// en Más > WhatsApp. El audio no se guarda en ningún lado.
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const comun = require("./_whatsapp-comun.js");

const NOMBRE_APP = "whatsapp-audio";
// Vercel acepta hasta 4,5 MB por pedido: unos 3 MB de audio (varios minutos).
const LARGO_MAXIMO_BASE64 = 4 * 1024 * 1024;

function crearManejador({ obtenerApp, pasarATexto = comun.audioATexto }) {
    return async function whatsappAudio(request, response) {
        if (request.method !== "POST") {
            response.setHeader("Allow", "POST");
            return comun.responder(response, 405, { ok: false, message: "Usá POST." });
        }

        let app;
        try {
            app = obtenerApp();
        } catch (error) {
            return comun.responder(response, 503, { ok: false, codigo: "sinFirebase", message: "Falta configurar la nube en Vercel." });
        }

        const credencial = comun.credencialDe(request);
        if (!credencial) return comun.responder(response, 401, { ok: false, message: "Falta iniciar sesión." });
        let uid;
        try {
            uid = (await getAuth(app).verifyIdToken(credencial)).uid;
        } catch (error) {
            return comun.responder(response, 401, { ok: false, message: "La sesión no es válida." });
        }

        const cuerpo = comun.leerCuerpo(request) || {};
        const idDistribuidora = String(cuerpo.idDistribuidora || "");
        const base64 = String(cuerpo.audio || "");
        const tipo = /^audio\/[a-z0-9.+-]{1,40}(;.{0,60})?$/i.test(String(cuerpo.tipo || "")) ? String(cuerpo.tipo) : "audio/ogg";
        if (!comun.ID_VALIDO.test(idDistribuidora) || !base64) return comun.responder(response, 400, { ok: false, message: "Datos incompletos." });
        if (base64.length > LARGO_MAXIMO_BASE64) return comun.responder(response, 413, { ok: false, codigo: "muyLargo", message: "El audio es muy largo." });

        const db = getFirestore(app);
        const ref = db.collection("distribuidoras").doc(idDistribuidora);
        if (!(await ref.collection("miembros").doc(uid).get()).exists) {
            return comun.responder(response, 403, { ok: false, message: "No sos parte de esta distribuidora." });
        }
        const config = comun.configWhatsapp((await ref.collection("config").doc("whatsapp").get()).data());
        if (!config.audios) return comun.responder(response, 409, { ok: false, codigo: "apagado", message: "«Pasar audios a texto» está apagado." });
        if (!comun.configurado().audios) return comun.responder(response, 503, { ok: false, codigo: "sinClave", message: "Falta la clave de audio a texto en Vercel." });

        try {
            const productos = (await ref.collection("productos").get()).docs.map(doc => doc.data());
            const palabras = productos.map(item => item && item.nombre).filter(Boolean).slice(0, 120).join(", ");
            const texto = await pasarATexto({ audio: Buffer.from(base64, "base64"), tipo, palabras });
            return comun.responder(response, 200, { ok: true, texto });
        } catch (error) {
            console.error("No se pudo pasar el audio a texto.", error && error.message);
            return comun.responder(response, 502, { ok: false, codigo: "error", message: "No se pudo pasar el audio a texto." });
        }
    };
}

module.exports = crearManejador({ obtenerApp: () => comun.appDeVercel(NOMBRE_APP) });
module.exports.crearManejador = crearManejador;
