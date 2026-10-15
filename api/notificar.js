// VendeFrío - Función de Vercel: notificaciones con la app cerrada (T29)
//
// La app la llama cuando deja un aviso en el buzón de otra persona (T23):
//   POST /api/notificar
//   Authorization: Bearer <credencial de Firebase de quien dejó el aviso>
//   { idDistribuidora, idAviso, para: ["dueno", "<idEmpleado>", ...] }
//
// Antes de mandar nada revisa, en la nube y con la cuenta de servicio:
// 1. Que la credencial sea válida y que esa cuenta sea miembro de la
//    distribuidora (si no, 401 o 403).
// 2. Para cada destinatario: que el aviso exista en su buzón, que lo haya
//    dejado esa misma cuenta y que no se haya notificado antes (queda
//    anotado en el aviso, en "notificado", así nunca suena dos veces).
// 3. Que el destinatario siga en el equipo (un empleado dado de baja no
//    recibe nada) y que no haya apagado ese aviso ni lo haya silenciado.
// 4. Que cada celular guardado siga siendo de una cuenta del equipo de esa
//    persona (por ejemplo, después de un reingreso en otro celular, el viejo
//    ya no recibe).
// Después manda la notificación por Firebase Cloud Messaging y borra los
// celulares que ya no existen.
//
// La clave de la cuenta de servicio da acceso total a la nube: vive solo en
// Vercel, en la variable de entorno FIREBASE_CUENTA_DE_SERVICIO (M8). Nunca
// va en el repo.
const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

const NOMBRE_APP = "notificar";
const ID_VALIDO = /^[A-Za-z0-9_-]{1,128}$/;
const MAXIMO_DESTINATARIOS = 30;

// Los mismos nombres que en avisos.js (TIPOS): título y "hecho por".
const TIPOS = {
    pedidoNuevo: ["Pedido nuevo", "Cargado por"],
    preparado: ["Pedido preparado", "Preparado por"],
    entregado: ["Pedido entregado", "Entregado por"],
    faltante: ["Faltante", "Anotado por"],
    pedidoEditado: ["Pedido editado", "Editado por"],
    pedidoCancelado: ["Pedido cancelado", "Cancelado por"],
    incidencia: ["Incidencia", "Marcada por"],
    incidenciaResuelta: ["Incidencia resuelta", "Resuelta por"],
    rolPendiente: ["Rol pendiente de aprobar", "Lo eligió"]
};

// Errores de Firebase Cloud Messaging que dicen que el celular ya no existe.
const TOKEN_QUE_NO_SIRVE = ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"];

function appDeVercel() {
    const existente = getApps().find(app => app.name === NOMBRE_APP);
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

    return initializeApp({ credential: cert(cuenta), projectId: cuenta.project_id }, NOMBRE_APP);
}

function responder(response, estado, datos) {
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.status(estado).json(datos);
}

function leerCuerpo(request) {
    if (request.body && typeof request.body === "object") return request.body;
    if (typeof request.body === "string" && request.body) {
        try {
            return JSON.parse(request.body);
        } catch (error) {
            return null;
        }
    }
    return null;
}

function textoCorto(texto, largo) {
    const limpio = String(texto || "").replace(/\s+/g, " ").trim();
    return limpio.length > largo ? limpio.slice(0, largo - 1) + "…" : limpio;
}

function nombrePersona(persona) {
    const nombre = String(persona && persona.nombre || "").trim();
    if (nombre) return nombre;
    return persona && persona.idPersona === "dueno" ? "el dueño" : "un empleado";
}

// "Pedido nuevo · Almacén Don Pepe" / "Cargado por Jere: …".
function textosDelAviso(aviso) {
    const [nombre, hecho] = TIPOS[aviso.tipo] || ["Aviso", "Por"];
    const comercio = textoCorto(aviso.comercio, 80);
    const detalle = textoCorto(aviso.detalle, 160);
    return {
        titulo: comercio ? nombre + " · " + comercio : nombre,
        texto: hecho + " " + nombrePersona(aviso.persona) + (detalle ? ": " + detalle : "")
    };
}

// La cuenta sigue siendo de esa persona del equipo.
function miembroEsDe(miembro, idPersona) {
    if (!miembro) return false;
    if (idPersona === "dueno") return miembro.rol === "dueno";
    return miembro.rol === "empleado" && miembro.idEmpleado === idPersona;
}

function crearManejador({ obtenerApp, enviar }) {
    async function notificar(request, response) {
        if (request.method !== "POST") {
            response.setHeader("Allow", "POST");
            return responder(response, 405, { ok: false, message: "Usá POST." });
        }

        let app;
        try {
            app = obtenerApp();
        } catch (error) {
            console.error("No se pudo iniciar Firebase en la función.", error.sinConfigurar ? error.message : error);
            return responder(response, 503, { ok: false, message: "Las notificaciones no están configuradas." });
        }

        // 1. Quién llama.
        const encabezado = String(request.headers && request.headers.authorization || "");
        const credencial = encabezado.startsWith("Bearer ") ? encabezado.slice(7).trim() : "";
        if (!credencial) return responder(response, 401, { ok: false, message: "Falta iniciar sesión." });

        let uid;
        try {
            uid = (await getAuth(app).verifyIdToken(credencial)).uid;
        } catch (error) {
            return responder(response, 401, { ok: false, message: "La sesión no es válida." });
        }

        const cuerpo = leerCuerpo(request);
        const idDistribuidora = String(cuerpo && cuerpo.idDistribuidora || "");
        const idAviso = String(cuerpo && cuerpo.idAviso || "");
        const para = Array.isArray(cuerpo && cuerpo.para) ? cuerpo.para.map(String) : [];
        if (!ID_VALIDO.test(idDistribuidora) || !ID_VALIDO.test(idAviso) ||
            !para.length || para.length > MAXIMO_DESTINATARIOS || !para.every(id => ID_VALIDO.test(id))) {
            return responder(response, 400, { ok: false, message: "Datos incompletos." });
        }

        const db = getFirestore(app);
        const ref = db.collection("distribuidoras").doc(idDistribuidora);

        const fotoMiembro = await ref.collection("miembros").doc(uid).get();
        const yo = fotoMiembro.exists ? fotoMiembro.data() || {} : null;
        const miIdPersona = yo && yo.rol === "dueno" ? "dueno" : yo && yo.rol === "empleado" ? String(yo.idEmpleado || "") : "";
        if (!miIdPersona) return responder(response, 403, { ok: false, message: "No sos del equipo de esta distribuidora." });

        // Las cuentas de los celulares se revisan una sola vez.
        const miembros = new Map();
        async function miembro(uidCelular) {
            if (!miembros.has(uidCelular)) {
                const foto = await ref.collection("miembros").doc(uidCelular).get();
                miembros.set(uidCelular, foto.exists ? foto.data() || {} : null);
            }
            return miembros.get(uidCelular);
        }

        const mensajes = [];
        const celularesDeCadaMensaje = [];

        for (const idPersona of Array.from(new Set(para))) {
            if (idPersona === miIdPersona) continue;

            // 2. El aviso existe, es de quien llama y no se notificó antes.
            const refAviso = ref.collection("avisos").doc(idPersona).collection("recibidos").doc(idAviso);
            const aviso = await db.runTransaction(async transaccion => {
                const foto = await transaccion.get(refAviso);
                if (!foto.exists) return null;
                const datos = foto.data() || {};
                const persona = datos.persona || {};
                if (persona.uid !== uid || persona.idPersona !== miIdPersona || !TIPOS[datos.tipo] || datos.notificado) return null;
                transaccion.update(refAviso, { notificado: Date.now() });
                return datos;
            });
            if (!aviso) continue;

            // 3. Sigue en el equipo y quiere que le suene.
            if (idPersona !== "dueno") {
                const ficha = await ref.collection("empleados").doc(idPersona).get();
                if (!ficha.exists || (ficha.data() || {}).activo === false) continue;
            }
            const [preferencias, notificaciones] = await Promise.all([
                ref.collection("preferenciasAvisos").doc(idPersona).get(),
                ref.collection("preferenciasNotificaciones").doc(idPersona).get()
            ]);
            const apagados = (preferencias.exists && preferencias.data().apagados) || [];
            const silenciados = (notificaciones.exists && notificaciones.data().silenciados) || [];
            if ((Array.isArray(apagados) && apagados.includes(aviso.tipo)) ||
                (Array.isArray(silenciados) && silenciados.includes(aviso.tipo))) continue;

            // 4. Sus celulares, si siguen siendo de su cuenta.
            const celulares = await ref.collection("celulares").where("idPersona", "==", idPersona).get();
            const { titulo, texto } = textosDelAviso(aviso);
            const datos = { idAviso, idPedido: String(aviso.idPedido || ""), tipo: String(aviso.tipo), titulo, texto };

            for (const celular of celulares.docs) {
                const info = celular.data() || {};
                if (!info.token || !miembroEsDe(await miembro(String(info.uid || "")), idPersona)) continue;

                mensajes.push({
                    token: String(info.token),
                    data: datos,
                    webpush: {
                        headers: { Urgency: "high", TTL: String(24 * 60 * 60) },
                        notification: { title: titulo, body: texto, tag: idAviso }
                    }
                });
                celularesDeCadaMensaje.push(celular.ref);
            }
        }

        if (!mensajes.length) return responder(response, 200, { ok: true, enviadas: 0 });

        let resultado;
        try {
            resultado = await enviar(app, mensajes);
        } catch (error) {
            console.error("Firebase Cloud Messaging no mandó las notificaciones.", error);
            const codigo = textoCorto(error && (error.code || error.name) || "", 80);
            return responder(response, 502, { ok: false, message: "No se pudieron mandar las notificaciones.", codigo });
        }

        // Los celulares que ya no existen se borran.
        const respuestas = (resultado && resultado.responses) || [];
        await Promise.all(respuestas.map((respuesta, indice) => {
            const codigo = respuesta && respuesta.error && respuesta.error.code;
            return TOKEN_QUE_NO_SIRVE.includes(codigo) ? celularesDeCadaMensaje[indice].delete().catch(() => null) : null;
        }));

        const enviadas = respuestas.filter(respuesta => respuesta && respuesta.success).length;
        return responder(response, 200, { ok: true, enviadas });
    }

    return async function handler(request, response) {
        try {
            return await notificar(request, response);
        } catch (error) {
            console.error("Falló la función de notificaciones.", error);
            // El código del error ayuda a saber qué pasó (nunca lleva claves).
            const codigo = textoCorto(error && (error.code || error.name) || "", 80);
            return responder(response, 500, { ok: false, message: "No se pudieron mandar las notificaciones.", codigo });
        }
    };
}

const handler = crearManejador({
    obtenerApp: appDeVercel,
    enviar: (app, mensajes) => getMessaging(app).sendEach(mensajes)
});

// Las pruebas automáticas usan crearManejador con los emuladores y sin
// mandar nada de verdad.
handler.crearManejador = crearManejador;
module.exports = handler;
