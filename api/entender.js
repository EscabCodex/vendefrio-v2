// VendeFrío - Función de Vercel: el Asistente con Claude (T54, T155)
//
// Es el único asistente de la app (T155). El celular contesta primero lo
// fácil (voz.js y asistente.js, sin internet y sin gastar) y lo que no
// entiende se lo manda acá:
//   POST /api/entender
//   Authorization: Bearer <credencial de Firebase de quien habla>
//   { tipo: "asistente", texto, comercios: [nombres], datos: "<resumen, guía y lo que está viendo>", charla: [{ quien, texto }],
//     productos: [{ marca, producto }], listas: [nombres] }
//   { tipo: "pedido", texto, comercios: [nombres], productos: [{ marca, producto }] }
//   { tipo: "comando", texto, comercios } (lo usaban las versiones viejas)
//
// "asistente" devuelve una orden para la app o una respuesta, y desde T160
// también "pasos": varias órdenes seguidas de una sola frase (anotar un
// pedido con sus productos, imprimir el ticket, ir primero a un comercio);
// "pedido", los
// productos de un pedido dictado o pegado. Siempre en JSON y solo con
// nombres de las listas que mandó la app: { ok: true, resultado }.
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
const MAXIMO_DATOS = 24000;
const POR_MINUTO = 20;

const PANTALLAS = ["pedido", "menu", "comercios", "catalogo", "rutas", "estadisticas", "cierre"];
const ACCIONES = ["nuevoPedido", "ir", "visitado", "ficha", "pantalla", "proximaParada", "llegue", "nada"];
// El Asistente (T155): una orden para la app, o "responder" con texto.
const ACCIONES_ASISTENTE = ["responder", "nuevoPedido", "ir", "visitado", "ficha", "pantalla", "proximaParada", "llegue"];
const CON_COMERCIO = ["ir", "visitado", "ficha"];
// T160: los pasos de una frase con varias cosas. Guardar un pedido o
// imprimir lo confirma la persona en el celular antes de hacerlo.
const ACCIONES_PASO = ["nuevoPedido", "anotarPedido", "imprimir", "primero", "ir", "visitado", "ficha", "pantalla", "proximaParada", "llegue"];
const PASO_CON_COMERCIO = ["anotarPedido", "primero", "ir", "visitado", "ficha"];
const MAXIMO_PASOS = 5;

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
    },
    asistente: {
        type: "object",
        properties: {
            accion: { type: "string", enum: ACCIONES_ASISTENTE },
            comercio: { type: "string" },
            pantalla: { type: "string", enum: [...PANTALLAS, ""] },
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
            },
            pasos: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        accion: { type: "string", enum: ACCIONES_PASO },
                        comercio: { type: "string" },
                        pantalla: { type: "string", enum: [...PANTALLAS, ""] },
                        lista: { type: "string" },
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
                        }
                    },
                    required: ["accion", "comercio", "pantalla", "lista", "productos"],
                    additionalProperties: false
                }
            }
        },
        required: ["accion", "comercio", "pantalla", "respuesta", "destacado", "barras", "pasos"],
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
    pedido: `Sos el asistente de VendeFrío, una app de una distribuidora que vende y reparte a comercios. Te llega un pedido dictado o pegado de un mensaje de WhatsApp, en español rioplatense. Sacá cada producto con su cantidad (unidades; una docena son 12). Usá solo productos de la lista del catálogo, con la marca y el producto escritos exactamente como en la lista. Si el texto nombra un comercio de la lista de comercios, ponelo exacto en "comercio"; si no, "". Lo que no esté en el catálogo va en "sinEntender", tal como lo dijeron. Los cambios o devoluciones (por ejemplo «tengo 2 cambio de ñoquis») no son productos pedidos: ponelos en "sinEntender" empezando con «cambio:». Si una palabra encabeza varios productos («Ravioles 3 ricota, 5 pollo»), vale para todos. Ignorá saludos y relleno.`,
    asistente: `Sos el Asistente de VendeFrío, una app de una distribuidora que vende y reparte a comercios (almacenes, kioscos, supermercados). Sos el único asistente de la app: te habla el dueño o un empleado, en español rioplatense, por escrito o por voz pasada a texto (puede tener errores de reconocimiento). Lo fácil ya lo resolvió el celular; a vos te llega lo que no entendió. Primero decidí si es una orden para la app o una pregunta.
Órdenes ("accion"):
- nuevoPedido: cargar un pedido (con el comercio si lo nombra).
- ir: que la app lo guíe hasta un comercio.
- visitado: marcar que ya pasó por un comercio.
- ficha: ver los datos de un comercio.
- pantalla: abrir una pantalla: pedido (lista de pedidos e historial), menu (inicio), comercios, catalogo (productos y precios), rutas (mapa y recorrido), estadisticas (ventas), cierre (cierre del día y caja).
- proximaParada: a qué comercio le toca ir ahora.
- llegue: avisa que llegó al comercio al que estaba yendo.
- responder: no es una orden; contestá en "respuesta".
En "comercio" poné el nombre exacto de la lista de comercios, o "" si no nombra ninguno o no está en la lista. Para ir, visitado y ficha hace falta un comercio de la lista; si no está, usá responder y decí que no lo encontrás. En "pantalla" poné la pantalla solo si la acción es pantalla; si no, "".
Para responder: corto y claro (2 o 3 oraciones), como un compañero que conoce los números y cómo se usa la app. Para los números usá SOLO los datos que vienen en el mensaje; si no alcanzan, decí qué falta en una oración y sugerí dónde mirarlo en la app (Estadísticas, A cobrar, Cierre del día, Catálogo). Si preguntan cómo hacer algo, explicalo con la guía de uso que viene en los datos. No inventes números, comercios ni botones. Si los datos dicen que no tiene permiso para ver la plata, no des montos. Escribí la plata como "$ 1.284.600" (punto de miles, sin decimales).
- "respuesta": la respuesta en texto (en una orden, una frase corta que diga lo que hacés). Si hay un número principal, no lo repitas al principio: va en "destacado" y la respuesta arranca con lo que lo explica (por ejemplo: "En septiembre vendiste" + destacado + "en helados: 306 unidades...").
- "destacado": el número principal de la respuesta (por ejemplo "$ 1.284.600" o "34 comercios"), o "" si no hay uno.
- "barras": hasta 6 valores para un gráfico chico cuando ayude (por ejemplo, los últimos meses o los 5 comercios que más compran), en orden; si no ayuda, [].
Lo que está viendo: los datos dicen en qué pantalla está y qué tiene abierto (la navegación con la parada actual y las que siguen, un pedido, un comercio, una lista). Si dice "este", "acá", "el ticket" o no nombra el comercio, se refiere a eso.
Varias cosas de una sola frase ("pasos"): si pide más de una cosa, o algo que no es una orden simple, poné cada cosa en "pasos", en el orden en que las dijo, y en "accion" la primera (o responder) con una frase corta en "respuesta" que diga lo que vas a hacer. Si es una sola orden simple o una pregunta, "pasos" va []. Cada paso:
- anotarPedido: guardar un pedido para "comercio" con sus "productos" (marca y producto exactos del catálogo, cantidad en unidades). Si nombra una lista de precios ("a precio especial", "con la lista mayorista"), poné en "lista" el nombre exacto de la lista de precios; si no, "". Si un producto no está en el catálogo, no lo pongas y decilo en "respuesta".
- imprimir: imprimir el ticket del pedido que se acaba de anotar en un paso anterior o, si no hay, del pedido que tiene abierto.
- primero: cambiar el orden del recorrido para ir primero a "comercio" ("vamos a lo de Pepe primero").
- nuevoPedido, ir, visitado, ficha, pantalla, proximaParada, llegue: como arriba.
En cada paso, lo que no use va "" o []. Usá solo comercios, productos y listas que estén en las listas que manda la app; nunca los inventes. Elegir una calle para el camino ("agarrá por tal calle") todavía no se puede: usá responder y decilo.`
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
    const cliente = new Anthropic({ apiKey: clave, timeout: 12000, maxRetries: 1 });
    const respuesta = await cliente.messages.create({
        model: MODELO,
        max_tokens: 4096,
        system: instrucciones,
        output_config: { effort: "low", format: { type: "json_schema", schema: esquema } },
        messages: [{ role: "user", content: mensaje }]
    });
    if (respuesta.stop_reason === "refusal" || respuesta.stop_reason === "max_tokens") {
        const error = new Error("La IA cortó la respuesta (" + respuesta.stop_reason + ").");
        error.status = 200;
        throw error;
    }
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

// La respuesta del Asistente: una orden con nombres de la lista, o texto.
function limpiarAsistente(resultado, comercio, catalogo = {}) {
    const respuesta = String(resultado?.respuesta || "").replace(/[ \t]+/g, " ").trim().slice(0, 900);
    const barras = (Array.isArray(resultado?.barras) ? resultado.barras : [])
        .map(barra => ({ etiqueta: texto(barra?.etiqueta, 30), valor: Number(barra?.valor) }))
        .filter(barra => barra.etiqueta && Number.isFinite(barra.valor) && barra.valor >= 0)
        .slice(0, 6);
    let accion = ACCIONES_ASISTENTE.includes(resultado?.accion) ? resultado.accion : "responder";
    const pantalla = accion === "pantalla" && PANTALLAS.includes(resultado.pantalla) ? resultado.pantalla : "";
    // Una orden que no se puede hacer (sin comercio de la lista o sin
    // pantalla) se contesta con texto, nunca con algo inventado.
    if ((accion === "pantalla" && !pantalla) || (CON_COMERCIO.includes(accion) && !comercio)) accion = "responder";
    return {
        accion,
        comercio: accion === "responder" ? "" : comercio,
        pantalla,
        respuesta: respuesta || (accion === "responder" ? "No te entendí. ¿Me lo decís de otra forma?" : ""),
        destacado: accion === "responder" ? texto(resultado?.destacado, 40) : "",
        barras: accion === "responder" ? barras : [],
        pasos: limpiarPasos(resultado?.pasos, catalogo)
    };
}

// T160: los pasos, solo con comercios, productos y listas que mandó la app.
// Un paso que no se puede hacer se saca, nunca se completa con algo inventado.
function limpiarPasos(pasos, { comercios = [], productos = [], listas = [] }) {
    const limpios = [];
    (Array.isArray(pasos) ? pasos : []).forEach(paso => {
        const accion = ACCIONES_PASO.includes(paso?.accion) ? paso.accion : "";
        if (!accion) return;
        const comercio = comercios.includes(paso.comercio) ? paso.comercio : "";
        if (PASO_CON_COMERCIO.includes(accion) && !comercio) return;
        const pantalla = accion === "pantalla" && PANTALLAS.includes(paso.pantalla) ? paso.pantalla : "";
        if (accion === "pantalla" && !pantalla) return;
        const lista = accion === "anotarPedido" && listas.includes(paso.lista) ? paso.lista : "";
        const elegidos = [];
        if (accion === "anotarPedido") {
            (Array.isArray(paso.productos) ? paso.productos : []).forEach(item => {
                const elegido = { marca: texto(item?.marca), producto: texto(item?.producto), cantidad: Math.round(Number(item?.cantidad)) };
                const existe = productos.some(otro => otro.marca === elegido.marca && otro.producto === elegido.producto);
                if (existe && elegido.cantidad > 0 && elegido.cantidad <= 999) elegidos.push(elegido);
            });
            if (!elegidos.length) return;
        }
        limpios.push({ accion, comercio: accion === "nuevoPedido" || PASO_CON_COMERCIO.includes(accion) ? comercio : "", pantalla, lista, productos: elegidos });
    });
    return limpios.slice(0, MAXIMO_PASOS);
}

// Lo que respondió la IA, con solo nombres de las listas que mandó la app.
function limpiarResultado(tipo, resultado, comercios, productos, listas = []) {
    const comercio = comercios.includes(resultado?.comercio) ? resultado.comercio : "";
    if (tipo === "asistente") return limpiarAsistente(resultado, comercio, { comercios, productos, listas });
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
        const listas = (Array.isArray(cuerpo.listas) ? cuerpo.listas : []).map(nombre => texto(nombre, 60)).filter(Boolean).slice(0, 50);

        let mensaje = "Comercios:\n" + (comercios.join("\n") || "(ninguno)")
            + (tipo === "pedido" || (tipo === "asistente" && productos.length) ? "\n\nCatálogo (marca | producto):\n" + (productos.map(item => item.marca + " | " + item.producto).join("\n") || "(vacío)") : "")
            + (tipo === "asistente" && listas.length ? "\n\nListas de precios:\n" + listas.join("\n") : "");
        if (tipo === "asistente") {
            // Los números y la guía que arma el celular de quien pregunta, y
            // lo último que se habló (la IA nunca ve la base entera).
            const datos = String(cuerpo.datos || "").slice(0, MAXIMO_DATOS);
            const charla = (Array.isArray(cuerpo.charla) ? cuerpo.charla : []).slice(-6)
                .map(item => (item?.quien === "app" ? "Asistente: " : "Usuario: ") + texto(item?.texto, 400)).join("\n");
            mensaje += "\n\nDatos de la distribuidora (los arma la app):\n" + (datos || "(sin datos)")
                + (charla ? "\n\nLo que se habló antes:\n" + charla : "");
        }
        mensaje += "\n\nLo que dijo:\n" + dicho;

        try {
            const resultado = await preguntar({ instrucciones: INSTRUCCIONES[tipo], esquema: ESQUEMAS[tipo], mensaje });
            if (!resultado) return responder(response, 200, { ok: true, resultado: null });
            return responder(response, 200, { ok: true, resultado: limpiarResultado(tipo, resultado, comercios, productos, listas) });
        } catch (error) {
            if (error.sinConfigurar) return responder(response, 503, { ok: false, codigo: "sinConfigurar", message: error.message });
            console.warn("La IA no respondió.", error?.status || "", error?.message || "");
            // El detalle ayuda a saber qué arreglar (clave mal copiada, sin saldo, etc.).
            const detalle = ((error?.status ? error.status + " " : "") + String(error?.message || "")).slice(0, 200);
            return responder(response, 502, { ok: false, message: "La IA no respondió.", detalle });
        }
    };
}

const handler = crearManejador({ obtenerApp: appDeVercel, preguntar: preguntarAClaude });

// Las pruebas automáticas usan crearManejador con los emuladores y una IA
// falsa, sin gastar nada.
handler.crearManejador = crearManejador;
module.exports = handler;
