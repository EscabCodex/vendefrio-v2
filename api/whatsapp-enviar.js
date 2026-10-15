// VendeFrío - Función de Vercel: "Ronda de pedidos" automática (T56)
//
// La app la llama desde Más > WhatsApp, solo el dueño:
//   POST /api/whatsapp-enviar
//   Authorization: Bearer <credencial de Firebase del dueño>
//   { idDistribuidora, accion: "estado" }                 qué está configurado
//   { idDistribuidora, accion: "enviar", idsComercios }   manda la plantilla
//
// Para mandar revisa, en la nube y con la cuenta de servicio:
// 1. Que la credencial sea válida y que esa cuenta sea la del dueño.
// 2. Que "WhatsApp automático" esté prendido (config/whatsapp.activo).
// 3. Que cada comercio exista en la distribuidora y tenga teléfono: el
//    número sale de la nube, nunca de lo que manda el celular.
// Después manda a cada uno la plantilla aprobada por Meta, con el nombre del
// comercio en {{1}}. WhatsApp exige plantilla para escribir primero.
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const comun = require("./_whatsapp-comun.js");

const NOMBRE_APP = "whatsapp-enviar";
const MAXIMO_COMERCIOS = 300;
const A_LA_VEZ = 5;

async function enviarPlantilla({ numero, nombre, plantilla, idioma, fetchFn = fetch }) {
    const respuesta = await fetchFn(`https://graph.facebook.com/${comun.VERSION_GRAPH}/${process.env.WHATSAPP_ID_NUMERO}/messages`, {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.WHATSAPP_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            to: numero,
            type: "template",
            template: {
                name: plantilla,
                language: { code: idioma },
                components: [{ type: "body", parameters: [{ type: "text", text: nombre }] }]
            }
        })
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
        const mensaje = datos && datos.error && (datos.error.error_user_msg || datos.error.message);
        throw new Error(mensaje || "WhatsApp respondió " + respuesta.status + ".");
    }
    return datos && datos.messages && datos.messages[0] && datos.messages[0].id || "";
}

function crearManejador({ obtenerApp, enviar = enviarPlantilla }) {
    return async function whatsappEnviar(request, response) {
        if (request.method !== "POST") {
            response.setHeader("Allow", "POST");
            return comun.responder(response, 405, { ok: false, message: "Usá POST." });
        }

        let app;
        try {
            app = obtenerApp();
        } catch (error) {
            console.error("No se pudo iniciar Firebase en la función.", error.sinConfigurar ? error.message : error);
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
        if (!comun.ID_VALIDO.test(idDistribuidora)) return comun.responder(response, 400, { ok: false, message: "Datos incompletos." });

        const db = getFirestore(app);
        const ref = db.collection("distribuidoras").doc(idDistribuidora);
        const distribuidora = await ref.get();
        if (!distribuidora.exists || distribuidora.get("duenoUid") !== uid) {
            return comun.responder(response, 403, { ok: false, message: "Solo el dueño puede usar WhatsApp automático." });
        }

        const configurado = comun.configurado();
        if (cuerpo.accion === "estado") {
            return comun.responder(response, 200, {
                ok: true,
                ...configurado,
                estaDistribuidora: process.env.WHATSAPP_DISTRIBUIDORA === idDistribuidora
            });
        }
        if (cuerpo.accion !== "enviar") return comun.responder(response, 400, { ok: false, message: "Acción desconocida." });

        if (!configurado.whatsapp) {
            return comun.responder(response, 503, { ok: false, codigo: "sinWhatsapp", message: "Falta conectar WhatsApp en Vercel." });
        }
        const config = comun.configWhatsapp((await ref.collection("config").doc("whatsapp").get()).data());
        if (!config.activo) {
            return comun.responder(response, 409, { ok: false, codigo: "apagado", message: "WhatsApp automático está apagado." });
        }

        const ids = Array.isArray(cuerpo.idsComercios) ? [...new Set(cuerpo.idsComercios.map(String))] : [];
        if (!ids.length || ids.length > MAXIMO_COMERCIOS || !ids.every(id => comun.ID_VALIDO.test(id))) {
            return comun.responder(response, 400, { ok: false, message: "Elegí entre 1 y " + MAXIMO_COMERCIOS + " comercios." });
        }

        const fichas = await db.getAll(...ids.map(id => ref.collection("comercios").doc(id)));
        const resultados = [];
        const pendientes = [];
        fichas.forEach((ficha, indice) => {
            const nombre = String(ficha.exists && ficha.get("nombre") || "").trim();
            const numero = ficha.exists ? comun.numeroWhatsapp(ficha.get("telefono")) : "";
            if (!ficha.exists) resultados.push({ id: ids[indice], ok: false, motivo: "No existe" });
            else if (!numero) resultados.push({ id: ids[indice], nombre, ok: false, motivo: "Sin teléfono" });
            else pendientes.push({ id: ids[indice], nombre: nombre.slice(0, 60) || "¿cómo estás?", numero });
        });

        for (let inicio = 0; inicio < pendientes.length; inicio += A_LA_VEZ) {
            const tanda = pendientes.slice(inicio, inicio + A_LA_VEZ);
            const hechos = await Promise.all(tanda.map(async destino => {
                try {
                    await enviar({ numero: destino.numero, nombre: destino.nombre, plantilla: config.plantilla, idioma: config.idioma });
                    return { id: destino.id, nombre: destino.nombre, ok: true };
                } catch (error) {
                    return { id: destino.id, nombre: destino.nombre, ok: false, motivo: String(error && error.message || error).slice(0, 200) };
                }
            }));
            resultados.push(...hechos);
        }

        const enviados = resultados.filter(item => item.ok).length;
        return comun.responder(response, 200, { ok: true, enviados, resultados });
    };
}

module.exports = crearManejador({ obtenerApp: () => comun.appDeVercel(NOMBRE_APP) });
module.exports.crearManejador = crearManejador;
module.exports.enviarPlantilla = enviarPlantilla;
