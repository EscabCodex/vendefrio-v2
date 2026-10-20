// VendeFrío - Función de Vercel: el Asistente (T91, Etapa 8)
//
// El dueño pregunta con sus palabras ("¿cuánto vendí de helados en
// septiembre?") y la IA contesta con los números que manda la app:
//   POST /api/preguntar
//   Authorization: Bearer <credencial de Firebase>
//   { pregunta, datos: "<resumen en texto que arma la app>", charla: [{ quien, texto }] }
//
// Devuelve { ok: true, resultado: { respuesta, destacado, barras } }.
// Usa la misma IA, clave (ANTHROPIC_API_KEY, M15) y cuenta de servicio que
// api/entender.js. La IA solo ve el resumen que arma el celular de quien
// pregunta, nunca la base entera.
const { getAuth } = require("firebase-admin/auth");
const entender = require("./entender.js");

const MAXIMO_PREGUNTA = 500;
const MAXIMO_DATOS = 24000;
const POR_MINUTO = 10;

const ESQUEMA = {
    type: "object",
    properties: {
        respuesta: { type: "string" },
        destacado: { type: "string" },
        barras: {
            type: "array",
            items: {
                type: "object",
                properties: { etiqueta: { type: "string" }, valor: { type: "number" } },
                required: ["etiqueta", "valor"],
                additionalProperties: false
            }
        }
    },
    required: ["respuesta", "destacado", "barras"],
    additionalProperties: false
};

const INSTRUCCIONES = `Sos el Asistente de VendeFrío, una app de una distribuidora que vende y reparte a comercios. Le contestás a quien usa la app (el dueño o un empleado), en español rioplatense, corto y claro (2 o 3 oraciones), como un compañero que conoce los números y cómo se usa la app. Para los números usá SOLO los datos que vienen en el mensaje; si no alcanzan, decí qué falta en una oración y sugerí dónde mirarlo en la app (Estadísticas, A cobrar, Cierre del día, Catálogo). Si preguntan cómo hacer algo, explicalo con la guía de uso que viene en los datos. No inventes números ni botones. Si los datos dicen que no tiene permiso para ver la plata, no des montos. Escribí la plata como "$ 1.284.600" (punto de miles, sin decimales).
- "respuesta": la respuesta en texto. Si hay un número principal, no lo repitas al principio: va en "destacado" y la respuesta arranca con lo que lo explica (por ejemplo: "En septiembre vendiste" + destacado + "en helados: 306 unidades...").
- "destacado": el número principal de la respuesta (por ejemplo "$ 1.284.600" o "34 comercios"), o "" si no hay uno.
- "barras": hasta 6 valores para un gráfico chico cuando ayude (por ejemplo, los últimos meses o los 5 comercios que más compran), en orden; si no ayuda, [].`;

function responder(response, estado, datos) {
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.status(estado).json(datos);
}

const texto = (valor, maximo) => String(valor || "").replace(/[ \t]+/g, " ").trim().slice(0, maximo);

function limpiar(resultado) {
    const barras = (Array.isArray(resultado?.barras) ? resultado.barras : [])
        .map(barra => ({ etiqueta: texto(barra?.etiqueta, 30), valor: Number(barra?.valor) }))
        .filter(barra => barra.etiqueta && Number.isFinite(barra.valor) && barra.valor >= 0)
        .slice(0, 6);
    return {
        respuesta: texto(resultado?.respuesta, 900),
        destacado: texto(resultado?.destacado, 40),
        barras
    };
}

function crearManejador({ obtenerApp, preguntar }) {
    const usos = new Map();

    return async function preguntarle(request, response) {
        if (request.method !== "POST") {
            response.setHeader("Allow", "POST");
            return responder(response, 405, { ok: false, message: "Solo POST." });
        }
        const credencial = String(request.headers?.authorization || "").replace(/^Bearer /, "").trim();
        if (!credencial) return responder(response, 401, { ok: false, message: "Falta la sesión." });
        let uid;
        try {
            uid = (await getAuth(obtenerApp()).verifyIdToken(credencial)).uid;
        } catch (error) {
            if (error.sinConfigurar) return responder(response, 503, { ok: false, codigo: "sinConfigurar", message: error.message });
            return responder(response, 401, { ok: false, message: "La sesión no es válida." });
        }

        const ahora = Date.now();
        const recientes = (usos.get(uid) || []).filter(momento => ahora - momento < 60000);
        if (recientes.length >= POR_MINUTO) return responder(response, 429, { ok: false, message: "Demasiadas preguntas seguidas." });
        recientes.push(ahora);
        usos.set(uid, recientes);

        let cuerpo = request.body;
        if (typeof cuerpo === "string") {
            try { cuerpo = JSON.parse(cuerpo); } catch (error) { cuerpo = null; }
        }
        const pregunta = texto(cuerpo?.pregunta, MAXIMO_PREGUNTA);
        if (!pregunta) return responder(response, 400, { ok: false, message: "Falta la pregunta." });
        const datos = String(cuerpo?.datos || "").slice(0, MAXIMO_DATOS);
        const charla = (Array.isArray(cuerpo?.charla) ? cuerpo.charla : []).slice(-6)
            .map(item => (item?.quien === "app" ? "Asistente: " : "Usuario: ") + texto(item?.texto, 400)).join("\n");

        const mensaje = "Datos de la distribuidora (los arma la app):\n" + (datos || "(sin datos)")
            + (charla ? "\n\nLo que se habló antes:\n" + charla : "")
            + "\n\nPregunta:\n" + pregunta;
        try {
            const resultado = await preguntar({ instrucciones: INSTRUCCIONES, esquema: ESQUEMA, mensaje });
            return responder(response, 200, { ok: true, resultado: resultado ? limpiar(resultado) : null });
        } catch (error) {
            if (error.sinConfigurar) return responder(response, 503, { ok: false, codigo: "sinConfigurar", message: error.message });
            console.warn("La IA no respondió.", error?.status || "", error?.message || "");
            const detalle = ((error?.status ? error.status + " " : "") + String(error?.message || "")).slice(0, 200);
            return responder(response, 502, { ok: false, message: "La IA no respondió.", detalle });
        }
    };
}

const handler = crearManejador({ obtenerApp: entender.appDeVercel, preguntar: entender.preguntarAClaude });
handler.crearManejador = crearManejador;
module.exports = handler;
