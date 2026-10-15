// VendeFrío - Función de Vercel: IA en la nube para la voz (T54)
//
// La app la llama solo si el dueño prendió "IA en la nube" en Más > Trabajo
// y la voz gratis (voz.js) no entendió lo dicho:
//   POST /api/entender
//   Authorization: Bearer <credencial de Firebase de quien habla>
//   { tipo: "comando" | "pedido", texto, comercios: [nombres], productos: [{ marca, producto }] }
//
// Devuelve lo que entendió, en JSON y solo con nombres de las listas que
// mandó la app: { ok: true, resultado }.
//
// Usa Claude (de Anthropic). La clave vive solo en Vercel, en la variable
// de entorno ANTHROPIC_API_KEY (M15); nunca va en el repo. Solo la pueden
// usar cuentas de la app (la credencial de Firebase se revisa con la
// cuenta de servicio de M8), con un tope de pedidos por minuto.
const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const NOMBRE_APP = "entender";
const MODELO = "claude-haiku-5-5";
const MAXIMO_TEXTO = 1500;
const MAXIMO_LISTA = 800;
const POR_MINUTO = 20;

const PANTALLAS = ["pedido", "menu", "comercios", "catalogo", "rutas", "estadisticas", "cierre"];
const ACCIONES = ["nuevoPedido", "ir", "visitado", "ficha", "pantalla", "proximaParada", "llegue", "nada"];

const ESQUEMAS = {
    comando: {
        type: "object",
        properties: {
            accion: { type: "string", enum: ACCIONES },
            comercio: { type: "string" },
            pantalla: { type: "string", enum: [...PANTALLAS, ""] }
        },
        required: ["accion", "comercio", "pantalla"],
        additionalProperties: false
    },
    pedido: {
        type: "object",
        properties: {
            comercio: { type: "string" },
            productos: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        marca: { type: "string" },
                        producto: { type: "string" },
                        cantidad: { type: "integer" }
                    },
                    required: ["marca", "producto", "cantidad"],
                    additionalProperties: false
                }
            },
            sinEntender: { type: "array", items: { type: "string" } }
        },
        required: ["comercio", "productos", "sinEntender"],
        additionalProperties: false
    }
};

const INSTRUCCIONES = {
    comando: `Sos el asistente de voz de VendeFrío, una app de una distribuidora que vende y reparte a comercios (almacenes, kioscos, supermercados). Te llega lo que dijo un vendedor o repartidor, en español rioplatense, pasado a texto por el celular (puede tener errores de reconocimiento). Elegí una sola acción:
- nuevoPedido: cargar un pedido (con el comercio si lo nombra).
- ir: que la app lo guíe hasta un comercio.
- visitado: marcar que ya pasó por un comercio.
- ficha: ver los datos de un comercio.
- pantalla: abrir una pantalla: pedido (lista de pedidos e historial), menu (inicio), comercios, catalogo (productos y precios), rutas (mapa y recorrido), estadisticas (ventas), cierre (cierre del día y caja).
- proximaParada: a qué comercio le toca ir ahora.
- llegue: avisa que llegó al comercio al que estaba yendo.
- nada: no es un pedido para la app.
En "comercio" poné el nombre exacto de la lista de comercios, o "" si no nombra ninguno o no está en la lista. En "pantalla" poné la pantalla solo si la acción es pantalla; si no, "".`,
    pedido: `Sos el asistente de VendeFrío, una app de una distribuidora que vende y reparte a comercios. Te llega un pedido dictado o pegado de un mensaje de WhatsApp, en español rioplatense. Sacá cada producto con su cantidad (unidades; una docena son 12). Usá solo productos de la lista del catálogo, con la marca y el producto escritos exactamente como en la lista. Si el texto nombra un comercio de la lista de comercios, ponelo exacto en "comercio"; si no, "". Lo que no esté en el catálogo va en "sinEntender", tal como lo dijeron. Ignorá saludos y relleno.`
};

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

// Pregunta a Claude y devuelve el JSON que respondió.
async function preguntarAClaude({ instrucciones, esquema, mensaje }) {
    const clave = process.env.ANTHROPIC_API_KEY || "";
    if (!clave) {
        const error = new Error("Falta configurar ANTHROPIC_API_KEY en Vercel.");
        error.sinConfigurar = true;
        throw error;
    }
    const Anthropic = require("@anthropic-ai/sdk");
    const cliente = new Anthropic({ apiKey: clave, timeout: 15000, maxRetries: 1 });
    const respuesta = await cliente.messages.create({
        model: MODELO,
        max_tokens: 2048,
        system: instrucciones,
        output_config: { effort: "low", format: { type: "json_schema", schema: esquema } },
        messages: [{ role: "user", content: mensaje }]
    });
    if (respuesta.stop_reason === "refusal" || respuesta.stop_reason === "max_tokens") return null;
    const texto = respuesta.content.filter(bloque => bloque.type === "text").map(bloque => bloque.text).join("");
    return JSON.parse(texto);
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

const texto = (valor, maximo = 120) => String(valor || "").replace(/\s+/g, " ").trim().slice(0, maximo);

// Lo que respondió la IA, con solo nombres de las listas que mandó la app.
function limpiarResultado(tipo, resultado, comercios, productos) {
    const comercio = comercios.includes(resultado?.comercio) ? resultado.comercio : "";
    if (tipo === "comando") {
        const accion = ACCIONES.includes(resultado?.accion) ? resultado.accion : "nada";
        const pantalla = accion === "pantalla" && PANTALLAS.includes(resultado.pantalla) ? resultado.pantalla : "";
        if (accion === "pantalla" && !pantalla) return { accion: "nada", comercio: "", pantalla: "" };
        return { accion, comercio, pantalla };
    }
    const sinEntender = (Array.isArray(resultado?.sinEntender) ? resultado.sinEntender : []).map(item => texto(item)).filter(Boolean);
    const lista = [];
    (Array.isArray(resultado?.productos) ? resultado.productos : []).forEach(item => {
        const elegido = { marca: texto(item?.marca), producto: texto(item?.producto), cantidad: Math.round(Number(item?.cantidad)) };
        const existe = productos.some(otro => otro.marca === elegido.marca && otro.producto === elegido.producto);
        if (existe && elegido.cantidad > 0 && elegido.cantidad <= 9999) lista.push(elegido);
        // Un producto que no está en el catálogo se avisa, no se agrega.
        else if (elegido.producto) sinEntender.push(elegido.producto);
    });
    return { comercio, productos: lista, sinEntender: sinEntender.slice(0, 20) };
}


function crearManejador({ obtenerApp, preguntar }) {
    const usos = new Map();

    return async function entender(request, response) {
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

        // Tope por cuenta, para que nadie gaste la clave de más.
        const ahora = Date.now();
        const recientes = (usos.get(uid) || []).filter(momento => ahora - momento < 60000);
        if (recientes.length >= POR_MINUTO) return responder(response, 429, { ok: false, message: "Demasiados pedidos seguidos." });
        recientes.push(ahora);
        usos.set(uid, recientes);

        const cuerpo = leerCuerpo(request);
        const tipo = cuerpo?.tipo;
        const dicho = texto(cuerpo?.texto, MAXIMO_TEXTO);
        if (!ESQUEMAS[tipo] || !dicho) return responder(response, 400, { ok: false, message: "Falta qué entender." });
        const comercios = (Array.isArray(cuerpo.comercios) ? cuerpo.comercios : []).map(nombre => texto(nombre)).filter(Boolean).slice(0, MAXIMO_LISTA);
        const productos = (Array.isArray(cuerpo.productos) ? cuerpo.productos : [])
            .map(item => ({ marca: texto(item?.marca), producto: texto(item?.producto) }))
            .filter(item => item.producto)
            .slice(0, MAXIMO_LISTA);

        const mensaje = "Comercios:\n" + (comercios.join("\n") || "(ninguno)")
            + (tipo === "pedido" ? "\n\nCatálogo (marca | producto):\n" + (productos.map(item => item.marca + " | " + item.producto).join("\n") || "(vacío)") : "")
            + "\n\nLo que dijo:\n" + dicho;

        try {
            const resultado = await preguntar({ instrucciones: INSTRUCCIONES[tipo], esquema: ESQUEMAS[tipo], mensaje });
            if (!resultado) return responder(response, 200, { ok: true, resultado: null });
            return responder(response, 200, { ok: true, resultado: limpiarResultado(tipo, resultado, comercios, productos) });
        } catch (error) {
            if (error.sinConfigurar) return responder(response, 503, { ok: false, codigo: "sinConfigurar", message: error.message });
            console.warn("La IA no respondió.", error?.status || "", error?.message || "");
            return responder(response, 502, { ok: false, message: "La IA no respondió." });
        }
    };
}

const handler = crearManejador({ obtenerApp: appDeVercel, preguntar: preguntarAClaude });

// Las pruebas automáticas usan crearManejador con los emuladores y una IA
// falsa, sin gastar nada.
handler.crearManejador = crearManejador;
module.exports = handler;
