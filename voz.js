// =====================================================
// VendeFrío - voz.js
// Etapa 5: comandos por voz (T43) y pedido dictado o pegado (T44).
//
// El reconocimiento de voz es el del navegador (Web Speech API): gratis y
// sin claves, en Chrome de Android con internet. Si el celular no lo tiene,
// el micrófono no aparece; pegar el texto de un mensaje funciona siempre.
// =====================================================

(function () {
    const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition || null;

    // -------------------------------------------------
    // Texto: normalizar, números y parecidos
    // -------------------------------------------------

    function normalizar(texto) {
        return String(texto || "")
            .toLocaleLowerCase("es")
            .normalize("NFD").replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z0-9ñ\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    const NUMEROS = {
        un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
        diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
        dieciocho: 18, diecinueve: 19, veinte: 20, veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50
    };

    // Palabras de un producto escritas como se dicen ("un kilo" = "1 kg").
    function normalizarProducto(texto) {
        return normalizar(texto)
            .replace(/\b(un|1) (kilo|kg|k)\b/g, "1kg")
            .replace(/\b(medio|1 2) (kilo|kg)\b/g, "12kg")
            .replace(/\b(\d+) ?(kilos|kilo|kg|k)\b/g, "$1kg")
            .replace(/\b(\d+) ?(litros|litro|lts|lt|l)\b/g, "$1l")
            .replace(/\b(de|del|la|el|los|las|con)\b/g, " ")
            .split(" ")
            .filter(Boolean)
            .map(palabra => palabra.length > 4 ? palabra.replace(/(es|s)$/, "") : palabra)
            .join(" ");
    }

    function bigramas(texto) {
        const limpio = " " + texto.replace(/\s+/g, " ") + " ";
        const lista = [];
        for (let i = 0; i < limpio.length - 1; i++) lista.push(limpio.slice(i, i + 2));
        return lista;
    }

    // Qué tan parecidos son dos textos (0 a 1).
    function parecido(a, b) {
        if (!a || !b) return 0;
        if (a === b) return 1;
        const A = bigramas(a);
        const B = bigramas(b);
        const cuenta = new Map();
        B.forEach(par => cuenta.set(par, (cuenta.get(par) || 0) + 1));
        let comunes = 0;
        A.forEach(par => {
            const quedan = cuenta.get(par) || 0;
            if (quedan > 0) {
                comunes++;
                cuenta.set(par, quedan - 1);
            }
        });
        let puntaje = (2 * comunes) / (A.length + B.length);
        // Si todas las palabras de uno están en el otro, suma.
        const palabrasA = a.split(" ");
        const palabrasB = b.split(" ");
        if (palabrasB.every(p => palabrasA.includes(p)) || palabrasA.every(p => palabrasB.includes(p))) puntaje += 0.25;
        return Math.min(1, puntaje);
    }

    function buscarComercio(texto) {
        const buscado = normalizar(texto);
        if (!buscado || typeof obtenerComercios !== "function") return null;
        let mejor = null;
        let puntaje = 0;
        comerciosActivos().forEach(comercio => {
            const nombre = normalizar(comercio.nombre);
            const valor = nombre === buscado ? 1 : parecido(nombre, buscado);
            if (valor > puntaje) {
                puntaje = valor;
                mejor = comercio;
            }
        });
        return puntaje >= 0.5 ? mejor : null;
    }

    // -------------------------------------------------
    // Comandos (T43, más humanos desde T53)
    //
    // No hace falta decir la frase exacta: se busca la intención en
    // cualquier parte de lo dicho («che, llevame a lo de Don Pepe»,
    // «haceme un pedido para el kiosco de la esquina», «¿cuánto vendí?»)
    // y el comercio se encuentra aunque se nombre a medias.
    // -------------------------------------------------

    // Palabras que no cambian lo que se pide.
    const SIN_PESO = new Set(["a", "al", "de", "del", "la", "el", "lo", "los", "las", "un", "una", "unos", "unas", "para", "en",
        "que", "por", "favor", "porfa", "porfavor", "dale", "che", "bueno", "eh", "este", "ahi", "alla", "aca", "ahora", "ya",
        "mismo", "hasta", "hacia", "con", "me", "le", "les", "nos", "y", "o", "gracias", "rapido", "vos", "sr", "senor", "senora"]);
    // Palabras de rubro: «lo de Don Pepe» es «Almacén Don Pepe».
    const RUBROS = new Set(["almacen", "kiosco", "kiosko", "maxikiosco", "super", "supermercado", "autoservicio", "despensa",
        "polirrubro", "minimercado", "mercado", "drugstore", "comercio", "negocio", "local", "carniceria", "verduleria", "panaderia"]);

    function palabrasConPeso(texto) {
        return normalizar(texto).split(" ").filter(palabra => palabra && !SIN_PESO.has(palabra));
    }

    // El comercio nombrado en cualquier parte del texto (o null).
    function buscarComercioEn(texto, minimo = 0.6) {
        const palabras = palabrasConPeso(texto);
        if (!palabras.length || typeof obtenerComercios !== "function") return null;
        let mejor = null;
        let puntaje = 0;
        comerciosActivos().forEach(comercio => {
            const nombre = palabrasConPeso(comercio.nombre);
            if (!nombre.length) return;
            const claves = [nombre.join(" ")];
            const sinRubro = nombre.filter(palabra => !RUBROS.has(palabra));
            if (sinRubro.length && sinRubro.length < nombre.length) claves.push(sinRubro.join(" "));
            const largo = nombre.length + 1;
            for (let i = 0; i < palabras.length; i++) {
                for (let j = i + 1; j <= Math.min(palabras.length, i + largo); j++) {
                    const tramo = palabras.slice(i, j).join(" ");
                    claves.forEach(clave => {
                        const valor = parecido(clave, tramo);
                        if (valor > puntaje) {
                            puntaje = valor;
                            mejor = comercio;
                        }
                    });
                }
            }
        });
        return puntaje >= minimo ? mejor : null;
    }

    // Lo que queda después de la frase que dispara la orden.
    function despues(dicho, coincidencia) {
        return dicho.slice(coincidencia.index + coincidencia[0].length).trim();
    }

    const PANTALLAS = [
        [/\b(pedidos|historial|ordenes)\b/, "pedido"],
        [/\b(inicio|principal|home|menu)\b/, "menu"],
        [/\b(comercios|clientes|negocios|locales)\b/, "comercios"],
        [/\b(catalogo|productos|precios|mercaderia)\b/, "catalogo"],
        [/\b(rutas?|mapa|recorridos?)\b/, "rutas"],
        [/\b(estadisticas?|numeros|graficos|cuanto (vendi|vendimos|llevo vendido|se vendio)|como vengo|como venimos|ventas)\b/, "estadisticas"],
        [/\b(cierre|cerrar (el )?dia|cerrar (la )?caja|caja del dia|rendicion|rendir)\b/, "cierre"]
    ];

    // Avisos de la calle para el equipo (T139): «avisar calle cortada», «hay
    // un control», «reportá un choque». Sin «avisar» solo valen los claros.
    const AVISAR = /\b(avisa|avisar|avisale|avisales|avisemos|reporta|reportar|hay|ojo)\b/;
    const AVISOS_DICHOS = [
        [/\b((calle|esquina|paso) cortad[ao]|cortad[ao] (la calle|el paso)|corte de calle)\b/, "cortada", true],
        [/\b(choque|accidente|chocaron)\b/, "choque", false],
        [/\b(control|controles|operativo|reten|alcoholemia|zorros|policia)\b/, "control", false],
        [/\b((transito|trafico) (lento|pesado|parado)|mucho (transito|trafico)|embotellamiento|atasco)\b/, "lento", true],
        [/\b(pozo|bache|calle rota)\b/, "pozo", false],
        [/\b((comercio|negocio|local|kiosco|almacen) cerrado|esta cerrado|estaba cerrado)\b/, "cerrado", true]
    ];

    const DICE = {
        llegue: /\b(llegue|llegamos|(ya )?(estoy|estamos) (aca|ahi|en la puerta)|marca(r|me)? (la )?llegada)\b/,
        visitado: /\b(marca(r|me|lo|la|le)? (como )?visitad[oa]|visitad[oa]|ya (pase|fui|estuve|visite)( por| en| a| al)?|visite|pase por)\b/,
        nuevoPedido: /(\b(nuevo pedido|pedido nuevo|otro pedido)\b|\b(cargar|carga|cargame|cargale|hacer|hace|haceme|hacele|armar|arma|armame|armale|tomar|toma|tomame|tomale|anotar|anota|anotame|anotale|empezar|empeza|arrancar|arranca|iniciar|inicia|crear|crea|levantar|levanta|abrir|abri|abrime)( (un|el|otro|nuevo))? pedido\b|\bquiere(n)? (pedir|encargar|hacer (un )?pedido)\b|\b(le )?(vendo|venderle|vendemos)\b|^pedido\b)/,
        ir: /\b(ir|irme|vamos|vamo|voy|vayamos|llevame|lleva|llevarme|navegar|navega|naveguemos|guiame|guia|como (llego|voy|hago para ir|se llega)|donde (queda|esta)|indicaciones|camino|ruta)\b/,
        proximaParada: /\b((la )?(proxima|siguiente) (parada|visita|cliente|comercio|entrega)|(a )?donde (voy|sigo|tengo que ir|vamos|me toca)|adonde (voy|sigo|vamos)|(que|quien|cual) sigue|a quien (le )?toca|que me toca)\b/,
        ver: /\b(abri|abrir|abrime|abre|ver|veo|mira|mirar|mostra|mostrame|mostrar|muestra|muestrame|pasame|ficha|datos|info|informacion|telefono|direccion|busca|buscar|buscame)\b/
    };

    // Qué pidió: { accion, comercio?, pantalla? } o null.
    function interpretar(texto) {
        const dicho = normalizar(texto);
        if (!dicho) return null;
        let noEncontrado = null;
        const conComercio = (accion, resto) => {
            const comercio = buscarComercioEn(resto);
            if (comercio) return { accion, comercio };
            if (palabrasConPeso(resto).length && !noEncontrado) noEncontrado = { accion: "noEncontrado", texto: palabrasConPeso(resto).join(" ") };
            return null;
        };
        let partes;

        if (DICE.llegue.test(dicho)) return { accion: "llegue" };

        const conAvisar = AVISAR.test(dicho);
        for (const [patron, tipo, soloAlcanza] of AVISOS_DICHOS) {
            if (patron.test(dicho) && (conAvisar || soloAlcanza)) return { accion: "avisar", tipo };
        }

        partes = dicho.match(DICE.visitado);
        if (partes) {
            const orden = conComercio("visitado", despues(dicho, partes)) || conComercio("visitado", dicho.slice(0, partes.index));
            if (orden) return orden;
        }

        partes = dicho.match(DICE.nuevoPedido);
        if (partes) {
            const resto = despues(dicho, partes);
            const orden = conComercio("nuevoPedido", resto);
            if (orden) return orden;
            if (!palabrasConPeso(resto).length) return { accion: "nuevoPedido" };
        }

        partes = dicho.match(DICE.ir);
        if (partes) {
            const orden = conComercio("ir", despues(dicho, partes));
            if (orden) return orden;
        }

        if (DICE.proximaParada.test(dicho)) return { accion: "proximaParada" };

        for (const [patron, pantalla] of PANTALLAS) {
            if (patron.test(dicho)) return { accion: "pantalla", pantalla };
        }

        partes = dicho.match(DICE.ver);
        if (partes) {
            const orden = conComercio("ficha", despues(dicho, partes));
            if (orden) return orden;
        }

        // Solo el nombre del comercio: su ficha.
        if (palabrasConPeso(dicho).length <= 5) {
            const comercio = buscarComercioEn(dicho, 0.75);
            if (comercio) return { accion: "ficha", comercio };
        }
        return noEncontrado;
    }

    function decir(texto) {
        if (typeof mostrarToast === "function") mostrarToast(texto);
    }

    function ejecutar(texto) {
        const orden = interpretar(texto);
        if (!orden) {
            decir("No entendí «" + texto + "». Probá de nuevo.");
            return false;
        }
        return ejecutarOrden(orden);
    }

    function ejecutarOrden(orden) {
        const navegacion = window.navegacionVendeFrio;
        switch (orden.accion) {
            case "proximaParada": {
                const ir = document.querySelector("#dashProximaParada [data-navegar-a], #dashProximaParada .botonIr");
                if (ir) ir.click();
                else decir("No hay próxima parada: ya visitaste todos los comercios.");
                return Boolean(ir);
            }
            case "llegue":
                if (navegacion?.abierta?.()) {
                    navegacion.siguiente();
                    return true;
                }
                decir("Decí «llegué» mientras navegás hacia un comercio.");
                return false;
            case "nuevoPedido":
                navegacion?.abierta?.() && navegacion.cerrar();
                if (orden.comercio && typeof irAPedidoRapido === "function") irAPedidoRapido(orden.comercio.nombre);
                else if (typeof window.abrirNuevoPedido === "function") window.abrirNuevoPedido();
                return true;
            case "ir":
                if (navegacion?.abrir?.(orden.comercio.nombre)) return true;
                if (typeof window.abrirFichaComercio === "function") window.abrirFichaComercio(orden.comercio.nombre);
                return true;
            case "visitado":
                if (typeof marcarVisitaManual === "function") marcarVisitaManual(orden.comercio.nombre);
                return true;
            case "ficha":
                if (typeof window.abrirFichaComercio === "function") window.abrirFichaComercio(orden.comercio.nombre);
                return true;
            case "pantalla":
                navegacion?.abierta?.() && navegacion.cerrar();
                if (orden.pantalla === "estadisticas" && typeof window.abrirEstadisticas === "function") window.abrirEstadisticas();
                else if (orden.pantalla === "cierre" && window.cierreVendeFrio?.abrir) window.cierreVendeFrio.abrir();
                else if (orden.pantalla === "pedido") document.querySelector('.bottom-nav [data-pantalla="pedido"]')?.click();
                else if (typeof mostrarPantalla === "function") mostrarPantalla(orden.pantalla);
                return true;
            case "avisar":
                if (!window.avisosCalleVendeFrio) return false;
                window.avisosCalleVendeFrio.crear(orden.tipo);
                return true;
            case "noEncontrado":
                decir("No encontré el comercio «" + orden.texto + "».");
                return false;
            default:
                return false;
        }
    }

    // -------------------------------------------------
    // IA (T54): solo si la voz gratis no entendió y el dueño la prendió en
    // Más > Trabajo. Primero la del celular (gratis y privada, Chrome con
    // Gemini Nano), después la de la nube (api/entender.js, con Claude).
    // -------------------------------------------------

    const PANTALLAS_IA = ["pedido", "menu", "comercios", "catalogo", "rutas", "estadisticas", "cierre"];
    const ESQUEMAS_IA = {
        comando: {
            type: "object",
            properties: {
                accion: { type: "string", enum: ["nuevoPedido", "ir", "visitado", "ficha", "pantalla", "proximaParada", "llegue", "nada"] },
                comercio: { type: "string" },
                pantalla: { type: "string", enum: [...PANTALLAS_IA, ""] }
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
                        properties: { marca: { type: "string" }, producto: { type: "string" }, cantidad: { type: "integer" } },
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
    const INSTRUCCIONES_IA = {
        comando: "Sos el asistente de voz de VendeFrío, una app de una distribuidora que vende y reparte a comercios. Te llega lo que dijo un vendedor, en español rioplatense. Elegí una acción: nuevoPedido (cargar un pedido), ir (que lo guíe hasta un comercio), visitado (ya pasó por un comercio), ficha (ver datos de un comercio), pantalla (abrir: pedido, menu, comercios, catalogo, rutas, estadisticas o cierre), proximaParada (a dónde ir ahora), llegue (llegó al comercio) o nada (no es para la app). En comercio poné el nombre exacto de la lista, o \"\". En pantalla poné la pantalla solo si la acción es pantalla; si no, \"\".",
        pedido: "Sos el asistente de VendeFrío. Te llega un pedido dictado o pegado de WhatsApp, en español rioplatense. Sacá cada producto con su cantidad en unidades (una docena son 12), usando solo productos del catálogo, con marca y producto escritos exactamente como en la lista. Si nombra un comercio de la lista, ponelo exacto en comercio; si no, \"\". Lo que no esté en el catálogo va en sinEntender. Los cambios o devoluciones (por ejemplo «tengo 2 cambio de ñoquis») no son productos pedidos: ponelos en sinEntender empezando con «cambio:». Si una palabra encabeza varios productos («Ravioles 3 ricota, 5 pollo»), vale para todos. Ignorá saludos y relleno."
    };

    function preferenciaIA(campo) {
        try {
            return JSON.parse(localStorage.getItem("vendefrio_preferencias") || "{}")[campo] === true;
        } catch (error) {
            return false;
        }
    }

    function iaPrendida() {
        return preferenciaIA("iaCelular") || preferenciaIA("iaNube");
    }

    // "available", "downloadable", "downloading" o "unavailable".
    async function estadoIACelular() {
        const Modelo = window.LanguageModel;
        if (!Modelo?.availability) return "unavailable";
        try {
            return await Modelo.availability({ expectedInputs: [{ type: "text", languages: ["es"] }], expectedOutputs: [{ type: "text", languages: ["es"] }] });
        } catch (error) {
            return "unavailable";
        }
    }

    function conTiempo(promesa, milisegundos) {
        return Promise.race([promesa, new Promise((resolver, rechazar) => setTimeout(() => rechazar(new Error("tiempo")), milisegundos))]);
    }

    async function preguntarAlCelular(tipo, mensaje) {
        if (!preferenciaIA("iaCelular") || (await estadoIACelular()) === "unavailable") return null;
        let sesion = null;
        try {
            sesion = await conTiempo(window.LanguageModel.create({
                initialPrompts: [{ role: "system", content: INSTRUCCIONES_IA[tipo] }],
                expectedInputs: [{ type: "text", languages: ["es"] }],
                expectedOutputs: [{ type: "text", languages: ["es"] }]
            }), 20000);
            const respuesta = await conTiempo(sesion.prompt(mensaje, { responseConstraint: ESQUEMAS_IA[tipo] }), 20000);
            return JSON.parse(respuesta);
        } catch (error) {
            console.warn("La IA del celular no respondió.", error?.message || "");
            return null;
        } finally {
            try { sesion?.destroy?.(); } catch (error) { /* ya cerrada */ }
        }
    }

    // Por qué falló la última pregunta a la IA, en palabras simples.
    let porQueFallo = "";

    async function preguntarALaNube(tipo, datos, forzar = false) {
        if (!forzar && !preferenciaIA("iaNube")) return null;
        const usuario = window.firebase?.auth?.().currentUser;
        if (!usuario) {
            porQueFallo = "La IA en la nube necesita que entres con la cuenta de la distribuidora.";
            return null;
        }
        try {
            const respuesta = await conTiempo(fetch("/api/entender", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + await usuario.getIdToken() },
                body: JSON.stringify({ tipo, ...datos })
            }), 30000);
            const cuerpo = await respuesta.json().catch(() => ({}));
            if (!respuesta.ok) {
                console.warn("La IA en la nube respondió " + respuesta.status + ".", cuerpo.codigo || "", cuerpo.message || "", cuerpo.detalle || "");
                porQueFallo = cuerpo.codigo === "sinConfigurar" ? "Falta configurar Vercel: " + (cuerpo.message || "")
                    : respuesta.status === 401 ? "Tu sesión venció: salí de la cuenta y volvé a entrar."
                        : respuesta.status === 429 ? "Muchos pedidos seguidos a la IA. Esperá un minuto."
                            : "La IA en la nube falló (error " + respuesta.status + (cuerpo.detalle ? ": " + cuerpo.detalle : "") + ").";
                return null;
            }
            if (!cuerpo.resultado) porQueFallo = "La IA en la nube no pudo leerlo" + (cuerpo.detalle ? " (" + cuerpo.detalle + ")" : "") + ".";
            return cuerpo.resultado || null;
        } catch (error) {
            console.warn("No se pudo usar la IA en la nube.", error?.message || "");
            porQueFallo = error?.message === "tiempo" ? "La IA en la nube tardó demasiado. Probá de nuevo." : "No hay conexión con la IA en la nube.";
            return null;
        }
    }

    // Botón «Probar la IA en la nube» (Más > Trabajo): una pregunta corta
    // que dice si anda o qué falta, aunque la llave esté apagada.
    async function probarIANube() {
        porQueFallo = "";
        const resultado = await preguntarALaNube("comando", { texto: "abrir los pedidos", comercios: [], productos: [] }, true);
        if (resultado?.accion === "pantalla") return "Anda bien: la IA en la nube respondió.";
        if (resultado) return "La IA respondió, pero algo raro: " + JSON.stringify(resultado);
        return porQueFallo || "La IA en la nube no respondió.";
    }

    function nombresDeComercios() {
        return typeof obtenerComercios === "function" ? obtenerComercios().map(comercio => comercio.nombre) : [];
    }

    // Pregunta primero al celular y después a la nube.
    async function preguntarIA(tipo, texto) {
        const comercios = nombresDeComercios();
        const productos = tipo === "pedido" ? productosDelCatalogo().map(({ marca, producto }) => ({ marca, producto })) : [];
        const mensaje = "Comercios:\n" + (comercios.join("\n") || "(ninguno)")
            + (tipo === "pedido" ? "\n\nCatálogo (marca | producto):\n" + productos.map(item => item.marca + " | " + item.producto).join("\n") : "")
            + "\n\nLo que dijo:\n" + texto;
        porQueFallo = preferenciaIA("iaNube") ? "" : "La IA del celular no pudo leerlo. Probá prender «IA en la nube» en Más > Trabajo.";
        return (await preguntarAlCelular(tipo, mensaje)) || (await preguntarALaNube(tipo, { texto, comercios, productos }));
    }

    function comercioPorNombre(nombre) {
        if (!nombre || typeof obtenerComercios !== "function") return null;
        return obtenerComercios().find(comercio => comercio.nombre === nombre) || buscarComercioEn(nombre, 0.75);
    }

    // Lo que dijo, entendido por la IA: una orden como las de interpretar().
    async function interpretarConIA(texto) {
        const resultado = await preguntarIA("comando", texto);
        if (!resultado || !resultado.accion || resultado.accion === "nada") return null;
        const comercio = comercioPorNombre(resultado.comercio);
        if (resultado.accion === "pantalla") return PANTALLAS_IA.includes(resultado.pantalla) ? { accion: "pantalla", pantalla: resultado.pantalla } : null;
        if (resultado.accion === "proximaParada" || resultado.accion === "llegue") return { accion: resultado.accion };
        if (resultado.accion === "nuevoPedido") return comercio ? { accion: "nuevoPedido", comercio } : { accion: "nuevoPedido" };
        if (["ir", "visitado", "ficha"].includes(resultado.accion) && comercio) return { accion: resultado.accion, comercio };
        return null;
    }

    // Un pedido entendido por la IA, con los productos del catálogo.
    async function leerPedidoConIA(texto) {
        const resultado = await preguntarIA("pedido", texto);
        if (!resultado) return null;
        const catalogo = productosDelCatalogo();
        const productos = [];
        (resultado.productos || []).forEach(item => {
            const cantidad = Math.round(Number(item.cantidad));
            const delCatalogo = catalogo.find(otro => otro.marca === item.marca && otro.producto === item.producto);
            if (!delCatalogo || !(cantidad > 0)) return;
            const existente = productos.find(otro => otro.marca === delCatalogo.marca && otro.producto === delCatalogo.producto);
            if (existente) existente.cantidad += cantidad;
            else productos.push({ marca: delCatalogo.marca, producto: delCatalogo.producto, cantidad, dicho: "" });
        });
        return {
            comercio: comercioPorNombre(resultado.comercio),
            productos,
            sinEntender: (resultado.sinEntender || []).map(item => String(item)).filter(item => item && !/^cambio:/i.test(item)),
            cambios: (resultado.sinEntender || []).map(item => String(item)).filter(item => /^cambio:/i.test(item)).map(item => item.replace(/^cambio:\s*/i, ""))
        };
    }

    // -------------------------------------------------
    // Escuchar (el micrófono)
    // -------------------------------------------------

    let escuchando = null;

    function escuchar({ alParcial, alFinal, alError }) {
        if (!Reconocimiento) {
            alError?.("sinVoz");
            return null;
        }
        detener();
        const reconocimiento = new Reconocimiento();
        reconocimiento.lang = "es-AR";
        reconocimiento.interimResults = true;
        reconocimiento.continuous = false;
        reconocimiento.maxAlternatives = 3;
        let final = "";
        let alternativas = [];
        reconocimiento.onresult = evento => {
            let parcial = "";
            for (let i = evento.resultIndex; i < evento.results.length; i++) {
                const resultado = evento.results[i];
                if (resultado.isFinal) {
                    final += resultado[0].transcript;
                    alternativas = Array.from(resultado).slice(1).map(item => item.transcript);
                }
                else parcial += resultado[0].transcript;
            }
            alParcial?.((final + " " + parcial).trim());
        };
        reconocimiento.onerror = evento => alError?.(evento.error || "error");
        reconocimiento.onend = () => {
            if (escuchando === reconocimiento) escuchando = null;
            alFinal?.(final.trim(), alternativas.map(item => item.trim()).filter(Boolean));
        };
        try {
            reconocimiento.start();
        } catch (error) {
            alError?.("error");
            return null;
        }
        escuchando = reconocimiento;
        return reconocimiento;
    }

    function detener() {
        if (escuchando) {
            try { escuchando.stop(); } catch (error) { /* ya paró */ }
        }
        escuchando = null;
    }

    function textoDeError(codigo) {
        if (codigo === "not-allowed" || codigo === "service-not-allowed") return "Dale permiso al micrófono para usar la voz.";
        if (codigo === "network") return "La voz necesita internet.";
        if (codigo === "no-speech") return "No escuché nada. Probá de nuevo.";
        if (codigo === "sinVoz") return "Este celular no tiene reconocimiento de voz.";
        return "";
    }

    // -------------------------------------------------
    // Ventana "Te escucho" (comandos)
    // -------------------------------------------------

    let ventana = null;

    function crearVentana() {
        if (ventana) return ventana;
        ventana = document.createElement("div");
        ventana.className = "modal oculto ventanaVoz";
        ventana.innerHTML = `
            <div class="modalContenido contenidoVoz" role="dialog" aria-modal="true" aria-labelledby="tituloVoz">
                <button type="button" class="botonMicrofonoGrande" aria-label="Escuchar de nuevo">${window.icono("microfono", 34)}</button>
                <h2 id="tituloVoz">Te escucho</h2>
                <p class="textoVoz" aria-live="polite"></p>
                <div class="ejemplosVoz">
                    <small>Hablá normal. Por ejemplo:</small>
                    <span>«¿A dónde voy ahora?»</span>
                    <span>«Haceme un pedido para lo de Don Pepe»</span>
                    <span>«Llevame al kiosco de la esquina»</span>
                    <span>«Mostrame los pedidos»</span>
                    <span>«Ya pasé por Super Norte»</span>
                    <span>«¿Cuánto vendí?»</span>
                </div>
                <div class="modalBotones"><button type="button" class="btnModalSecundario cerrarVoz">Cerrar</button></div>
            </div>`;
        document.body.appendChild(ventana);
        ventana.querySelector(".cerrarVoz").addEventListener("click", cerrarVentana);
        ventana.querySelector(".botonMicrofonoGrande").addEventListener("click", empezarComando);
        ventana.addEventListener("click", evento => { if (evento.target === ventana) cerrarVentana(); });
        return ventana;
    }

    function cerrarVentana() {
        detener();
        ventana?.classList.add("oculto");
    }

    function empezarComando() {
        crearVentana();
        ventana.classList.remove("oculto");
        ventana.classList.add("escuchando");
        const texto = ventana.querySelector(".textoVoz");
        texto.textContent = "Hablá ahora…";
        escuchar({
            alParcial: parcial => { texto.textContent = "«" + parcial + "»"; },
            alError: codigo => {
                const mensaje = textoDeError(codigo);
                if (mensaje) texto.textContent = mensaje;
            },
            alFinal: (final, alternativas = []) => {
                ventana.classList.remove("escuchando");
                if (!final) return;
                texto.textContent = "«" + final + "»";
                // Si el celular escuchó otra cosa parecida, prueba también esa.
                const entendido = [final, ...alternativas].find(frase => interpretar(frase)?.accion && interpretar(frase).accion !== "noEncontrado");
                if (entendido) {
                    cerrarVentana();
                    ejecutar(entendido);
                    return;
                }
                const sinIA = () => {
                    if (interpretar(final)) {
                        cerrarVentana();
                        ejecutar(final);
                    } else {
                        texto.textContent = "No entendí «" + final + "». Tocá el micrófono y probá de nuevo.";
                    }
                };
                if (!iaPrendida()) return sinIA();
                // T54: la IA lo intenta antes de rendirse.
                texto.textContent = "«" + final + "» · Pensando…";
                ventana.classList.add("pensando");
                interpretarConIA(final).then(orden => {
                    ventana.classList.remove("pensando");
                    if (ventana.classList.contains("oculto")) return;
                    if (orden) {
                        cerrarVentana();
                        ejecutarOrden(orden);
                    } else {
                        sinIA();
                    }
                });
            }
        });
    }

    // -------------------------------------------------
    // Pedido dictado o pegado (T44)
    // -------------------------------------------------

    function productosDelCatalogo() {
        const lista = [];
        const productos = typeof productosParaVender === "function" ? productosParaVender() : (typeof obtenerProductos === "function" ? obtenerProductos() : {});
        Object.entries(productos).forEach(([marca, items]) => (items || []).forEach(item => {
            const nombre = typeof item === "string" ? item : item && item.nombre;
            if (nombre) lista.push({ marca, producto: nombre, clave: normalizarProducto(nombre), claveMarca: normalizarProducto(marca + " " + nombre) });
        }));
        return lista;
    }

    function cantidadDe(palabra) {
        if (/^\d+$/.test(palabra)) return Number(palabra);
        return NUMEROS[palabra] || 0;
    }

    const UNIDADES_MEDIDA = new Set(["kg", "kilo", "kilos", "k", "l", "lt", "lts", "litro", "litros", "gr", "grs", "g", "gramos", "cc", "ml"]);
    // Cambios o devoluciones: se muestran aparte y no se suman al pedido.
    const ES_CAMBIO = /\b(cambio|cambios|cambiar|cambiame|devolucion|devoluciones|devuelvo|devolver|vencido|vencidos|vencida|vencidas)\b/;

    // De un texto ("tres helados de un kilo y dos palitos") saca los
    // productos del catálogo con su cantidad, y el comercio si lo nombra.
    // Entiende también mensajes de WhatsApp como «Ravioles 3 ricota, 5 pollo
    // y verduras, 4 ñoquis»: el «Ravioles» del principio vale para lo que
    // sigue, y una «y» sin cantidad después es parte del nombre.
    function leerPedido(texto) {
        const catalogo = productosDelCatalogo();
        // Las comas y los renglones separan productos.
        let limpio = normalizar(String(texto || "").replace(/[,;\n]+/g, " qqsep "));
        let comercio = null;

        // "Pedido para X: ..." o "para X ..." al principio.
        const conComercio = limpio.match(/^(?:(?:nuevo )?pedido )?(?:para|de) (.+?)(?: dos puntos| :| qqsep| que | quiero | mandame | manda | necesito |$)/);
        if (conComercio) {
            const posible = buscarComercio(conComercio[1]);
            if (posible) {
                comercio = posible;
                limpio = limpio.slice(conComercio[0].length);
            }
        }
        if (!comercio && typeof obtenerComercios === "function") {
            const nombre = obtenerComercios().find(item => limpio.includes(normalizar(item.nombre)));
            if (nombre) {
                comercio = nombre;
                limpio = limpio.replace(normalizar(nombre.nombre), " ");
            }
        }

        // Media docena / docena.
        limpio = limpio
            .replace(/\bmedia docena\b/g, "6")
            .replace(/\b(una )?docena\b/g, "12")
            .replace(/\b(\d+|un|una|dos|tres|cuatro|cinco|seis) docenas?\b/g, (todo, n) => String(cantidadDe(n) * 12));

        const RELLENO = new Set(["hola", "buenas", "buen", "buenos", "dia", "dias", "tardes", "noches", "gracias", "porfa", "favor", "che",
            "saludos", "quiero", "queria", "mandame", "manda", "mandar", "necesito", "traeme", "trae", "me", "nos", "hoy", "manana", "pedido", "nuevo", "son", "seria", "tengo"]);
        const sinRelleno = tramo => tramo.split(" ").filter(palabra => palabra && !RELLENO.has(palabra)).join(" ").replace(/^por /, "").trim();
        const empiezaConCantidad = tramo => cantidadDe(tramo.split(" ")[0]) > 0;

        function mejorDelCatalogo(buscado) {
            let mejor = null;
            let puntaje = 0;
            if (!buscado) return { mejor, puntaje };
            catalogo.forEach(item => {
                const valor = Math.max(parecido(item.clave, buscado), parecido(item.claveMarca, buscado));
                if (valor > puntaje) {
                    puntaje = valor;
                    mejor = item;
                }
            });
            return { mejor, puntaje };
        }

        const encontrados = [];
        const sinEntender = [];
        const cambios = [];
        let contexto = "";

        // Cantidad y lo que queda de un tramo. Cambia el contexto si el tramo
        // empieza con una palabra suelta antes del número («ravioles 3 ricota»).
        function partir(tramo) {
            const palabras = tramo.split(" ");
            const esNumero = (palabra, i) => cantidadDe(palabra) && palabras[i - 1] !== "de" && !UNIDADES_MEDIDA.has(palabras[i + 1] || "");
            let cantidad = 0;
            let resto = palabras;
            let delante = "";
            if (cantidadDe(palabras[0]) && palabras.length > 1) {
                cantidad = cantidadDe(palabras[0]);
                resto = palabras.slice(1);
            } else {
                const indice = palabras.findIndex((palabra, i) => i > 0 && i < palabras.length - 1 && esNumero(palabra, i));
                if (indice > 0) {
                    delante = palabras.slice(0, indice).join(" ");
                    cantidad = cantidadDe(palabras[indice]);
                    resto = palabras.slice(indice + 1);
                }
            }
            // O al final ("helado x 3", "helados por tres").
            const alFinal = tramo.match(/(?:x|por) ?(\d+|[a-z]+)$/);
            if (!cantidad && alFinal && cantidadDe(alFinal[1])) {
                cantidad = cantidadDe(alFinal[1]);
                resto = tramo.slice(0, alFinal.index).trim().split(" ");
            }
            resto = resto.filter(palabra => !["unidad", "unidades", "caja", "cajas", "de"].includes(palabra));
            return { cantidad, resto: resto.join(" "), delante };
        }

        // Busca un tramo en el catálogo. Con anotar, lo suma al pedido y
        // devuelve si lo encontró; sin anotar, solo qué tan parecido es.
        function leerTramo(tramo, anotar) {
            const { cantidad, resto, delante } = partir(tramo);
            const propio = normalizarProducto((delante ? delante + " " : "") + resto);
            // Un título sin cantidad («Ravioles:») que empieza el nombre de
            // varios productos no es un producto: vale para lo que sigue.
            if (!cantidad && !delante && propio && catalogo.filter(item => item.clave.startsWith(propio + " ")).length >= 2) {
                if (anotar) contexto = tramo;
                return anotar ? true : null;
            }
            let { mejor, puntaje } = mejorDelCatalogo(propio);
            if (!delante && contexto) {
                const conContexto = mejorDelCatalogo(normalizarProducto(contexto + " " + resto));
                if (conContexto.puntaje > puntaje) ({ mejor, puntaje } = conContexto);
            }
            if (!anotar) return mejor && puntaje >= 0.45 ? mejor : null;
            if (!mejor || puntaje < 0.45) return false;
            if (delante) contexto = delante;
            const total = cantidad || 1;
            const existente = encontrados.find(item => item.marca === mejor.marca && item.producto === mejor.producto);
            if (existente) existente.cantidad += total;
            else encontrados.push({ marca: mejor.marca, producto: mejor.producto, cantidad: total, dicho: tramo });
            return true;
        }

        limpio.split(/ ?qqsep ?/).forEach(segmento => {
            segmento = segmento.trim();
            if (!segmento) return;
            if (ES_CAMBIO.test(segmento)) {
                const dicho = sinRelleno(segmento);
                if (dicho) cambios.push(dicho);
                return;
            }
            // «y», «más», «también» separan solo si después viene una
            // cantidad; si no, son parte del nombre («pollo y verduras»).
            const piezas = (" " + segmento + " ").split(/ (?:y|mas|tambien|ademas|e) /).map(pieza => pieza.trim()).filter(Boolean);
            const tramos = [];
            piezas.forEach(pieza => {
                if (!tramos.length || empiezaConCantidad(pieza)) tramos.push([pieza]);
                else tramos[tramos.length - 1].push(pieza);
            });
            tramos.forEach(grupo => {
                const junto = sinRelleno(grupo.join(" y "));
                if (!junto) return;
                // Va cada parte por separado solo si cada una es un producto
                // distinto («helado y palito»); si no, junto («pollo y verduras»).
                const partes = grupo.map(sinRelleno).filter(Boolean);
                const deCadaParte = partes.map(parte => leerTramo(parte, false));
                const juntoVale = grupo.length === 1 || deCadaParte.some(item => !item)
                    || new Set(deCadaParte.map(item => item.marca + "|" + item.producto)).size < deCadaParte.length;
                if (juntoVale) {
                    if (!leerTramo(junto, true)) sinEntender.push(junto);
                    return;
                }
                partes.forEach(parte => {
                    if (!leerTramo(parte, true)) sinEntender.push(parte);
                });
            });
        });
        return { comercio, productos: encontrados, sinEntender, cambios };
    }

    // Lo que no se entendió (T118): cantidad, nombre y hasta 3 productos
    // parecidos del catálogo para preguntar «¿cuál es?».
    function sugerencias(tramo, cuantas = 3) {
        const palabras = normalizar(tramo).split(" ").filter(Boolean);
        let cantidad = 0;
        if (palabras.length > 1 && cantidadDe(palabras[0])) cantidad = cantidadDe(palabras.shift());
        else if (palabras.length > 1 && cantidadDe(palabras[palabras.length - 1])) cantidad = cantidadDe(palabras.pop());
        const nombre = normalizarProducto(palabras.filter(palabra => !["x", "por", "unidad", "unidades", "caja", "cajas"].includes(palabra)).join(" "));
        const productos = productosDelCatalogo()
            .map(item => ({ marca: item.marca, producto: item.producto, puntaje: Math.max(parecido(item.clave, nombre), parecido(item.claveMarca, nombre)) }))
            .filter(item => item.puntaje >= 0.15)
            .sort((a, b) => b.puntaje - a.puntaje)
            .slice(0, cuantas);
        return { cantidad: cantidad || 1, productos };
    }

    // Busca en el catálogo por texto, para «Buscar otro».
    function buscarEnCatalogo(texto, cuantos = 6) {
        const buscado = normalizarProducto(texto);
        if (!buscado) return [];
        return productosDelCatalogo()
            .map(item => ({ marca: item.marca, producto: item.producto, puntaje: item.claveMarca.includes(buscado) ? 2 : Math.max(parecido(item.clave, buscado), parecido(item.claveMarca, buscado)) }))
            .filter(item => item.puntaje >= 0.2)
            .sort((a, b) => b.puntaje - a.puntaje)
            .slice(0, cuantos);
    }

    // Lo que el usuario eligió para cada cosa no entendida: { tramo: {marca, producto, cantidad} | "no" }.
    let respuestasDictado = {};

    function conRespuestas(lectura) {
        const extra = [];
        const sinEntender = [];
        lectura.sinEntender.forEach(tramo => {
            const respuesta = respuestasDictado[tramo];
            if (respuesta === "no") return;
            if (respuesta) extra.push({ marca: respuesta.marca, producto: respuesta.producto, cantidad: respuesta.cantidad, dicho: tramo });
            else sinEntender.push(tramo);
        });
        return { ...lectura, productos: [...lectura.productos, ...extra], sinEntender };
    }

    function htmlPregunta(tramo, buscando) {
        const esc = texto => String(texto).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        const { cantidad, productos } = sugerencias(tramo);
        const chips = productos.map(item => `<button type="button" class="chipSugerencia" data-sugerencia="${esc(item.marca + "|" + item.producto)}" data-cantidad="${cantidad}">${esc(item.producto)}<small>${esc(item.marca)}</small></button>`).join("");
        return `<div class="preguntaDictado" data-tramo="${esc(tramo)}">
                <p>No entendí «${esc(tramo)}». ${productos.length ? "¿Cuál es?" : "No encontré nada parecido."}</p>
                <div class="chipsSugerencia">
                    ${chips}
                    <button type="button" class="chipSugerencia chipBuscarOtro" data-buscar-otro>${window.icono ? window.icono("buscar", 14) : ""} Buscar otro</button>
                    <button type="button" class="chipSugerencia chipNoTenemos" data-no-tenemos>No lo tenemos</button>
                </div>
                ${buscando ? `<div class="buscarOtroDictado"><input type="search" class="campoBuscarOtro" placeholder="Escribí el producto…" aria-label="Buscar producto para «${esc(tramo)}»" data-cantidad="${cantidad}"><div class="resultadosBuscarOtro"></div></div>` : ""}
            </div>`;
    }

    // Conecta las preguntas de una caja: alElegir(tramo, respuesta) se llama
    // con {marca, producto, cantidad} o "no".
    function conectarPreguntas(caja, alElegir) {
        if (caja.dataset.preguntasConectadas) return;
        caja.dataset.preguntasConectadas = "1";
        caja.addEventListener("click", evento => {
            const pregunta = evento.target.closest(".preguntaDictado");
            if (!pregunta) return;
            const tramo = pregunta.dataset.tramo;
            const sugerencia = evento.target.closest("[data-sugerencia]");
            if (sugerencia) {
                const [marca, ...resto] = sugerencia.dataset.sugerencia.split("|");
                alElegir(tramo, { marca, producto: resto.join("|"), cantidad: Number(sugerencia.dataset.cantidad) || 1 }, pregunta);
                return;
            }
            if (evento.target.closest("[data-no-tenemos]")) {
                alElegir(tramo, "no", pregunta);
                return;
            }
            if (evento.target.closest("[data-buscar-otro]")) {
                const nueva = document.createElement("div");
                nueva.innerHTML = htmlPregunta(tramo, true);
                const reemplazo = nueva.firstElementChild;
                pregunta.replaceWith(reemplazo);
                reemplazo.querySelector(".campoBuscarOtro")?.focus();
            }
        });
        caja.addEventListener("input", evento => {
            const campo = evento.target.closest(".campoBuscarOtro");
            if (!campo) return;
            const esc = texto => String(texto).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
            const lista = buscarEnCatalogo(campo.value);
            campo.parentElement.querySelector(".resultadosBuscarOtro").innerHTML = lista.length
                ? lista.map(item => `<button type="button" class="chipSugerencia" data-sugerencia="${esc(item.marca + "|" + item.producto)}" data-cantidad="${campo.dataset.cantidad}">${esc(item.producto)}<small>${esc(item.marca)}</small></button>`).join("")
                : (campo.value.trim() ? `<small class="sinResultadosBuscar">No hay productos con ese nombre.</small>` : "");
        });
    }

    let hojaDictado = null;
    // Lo que entendió la IA para un texto (T54); vale mientras el texto no cambie.
    let lecturaIA = null;

    function lecturaDe(texto) {
        return conRespuestas(lecturaIA && lecturaIA.texto === texto ? lecturaIA.lectura : leerPedido(texto));
    }

    function crearHojaDictado() {
        if (hojaDictado) return hojaDictado;
        hojaDictado = document.createElement("div");
        hojaDictado.className = "modal oculto ventanaDictado";
        hojaDictado.innerHTML = `
            <div class="modalContenido contenidoDictado" role="dialog" aria-modal="true" aria-labelledby="tituloDictado">
                <h2 id="tituloDictado">Pedido por voz o mensaje</h2>
                <p class="subtitulo">Dictalo o pegá el mensaje de WhatsApp. Por ejemplo: «3 helados de un kilo y 2 palitos bombón».</p>
                <div class="filaDictado">
                    <textarea id="textoDictado" rows="4" placeholder="Escribí, pegá o dictá el pedido…" aria-label="Texto del pedido"></textarea>
                    <button type="button" class="botonDictar" aria-label="Dictar">${window.icono("microfono", 22)}</button>
                </div>
                <p class="estadoDictado" aria-live="polite"></p>
                <div class="resultadoDictado"></div>
                <div class="modalBotones">
                    <button type="button" class="btnModalSecundario cancelarDictado">Cancelar</button>
                    <button type="button" class="btnModalConfirmar agregarDictado" disabled>Agregar al pedido</button>
                </div>
            </div>`;
        document.body.appendChild(hojaDictado);
        const campo = hojaDictado.querySelector("#textoDictado");
        const botonDictar = hojaDictado.querySelector(".botonDictar");
        if (!Reconocimiento) botonDictar.classList.add("oculto");
        campo.addEventListener("input", () => mostrarLectura(campo.value));
        conectarPreguntas(hojaDictado.querySelector(".resultadoDictado"), (tramo, respuesta) => {
            respuestasDictado[tramo] = respuesta;
            mostrarLectura(campo.value);
        });
        botonDictar.addEventListener("click", () => {
            const estado = hojaDictado.querySelector(".estadoDictado");
            const antes = campo.value.trim();
            hojaDictado.classList.add("escuchando");
            estado.textContent = "Te escucho…";
            escuchar({
                alParcial: parcial => {
                    campo.value = (antes ? antes + ", " : "") + parcial;
                    mostrarLectura(campo.value);
                },
                alError: codigo => { estado.textContent = textoDeError(codigo); },
                alFinal: final => {
                    hojaDictado.classList.remove("escuchando");
                    if (final) campo.value = (antes ? antes + ", " : "") + final;
                    if (estado.textContent === "Te escucho…") estado.textContent = "";
                    mostrarLectura(campo.value);
                }
            });
        });
        hojaDictado.querySelector(".cancelarDictado").addEventListener("click", cerrarDictado);
        hojaDictado.addEventListener("click", evento => { if (evento.target === hojaDictado) cerrarDictado(); });
        hojaDictado.querySelector(".agregarDictado").addEventListener("click", () => {
            const lectura = lecturaDe(campo.value);
            const elegidos = lectura.productos.filter((item, indice) =>
                hojaDictado.querySelector('.resultadoDictado input[data-indice="' + indice + '"]')?.checked !== false);
            const unidades = typeof window.agregarProductosAlPedido === "function"
                ? window.agregarProductosAlPedido(elegidos, lectura.comercio ? lectura.comercio.nombre : "")
                : 0;
            cerrarDictado();
            if (typeof mostrarToast === "function") mostrarToast(unidades === 1 ? "Se agregó 1 unidad al pedido" : "Se agregaron " + unidades + " unidades al pedido");
        });
        return hojaDictado;
    }

    function mostrarLectura(texto) {
        const caja = hojaDictado.querySelector(".resultadoDictado");
        const boton = hojaDictado.querySelector(".agregarDictado");
        caja.innerHTML = "";
        const lectura = lecturaDe(texto);
        boton.disabled = lectura.productos.length === 0;
        if (!String(texto || "").trim()) return;
        if (lectura.comercio) {
            const comercio = document.createElement("p");
            comercio.className = "comercioDictado";
            comercio.innerHTML = window.icono("tienda", 16) + " <span></span>";
            comercio.querySelector("span").textContent = lectura.comercio.nombre;
            caja.appendChild(comercio);
        }
        lectura.productos.forEach((item, indice) => {
            const fila = document.createElement("label");
            fila.className = "filaDictado productoDictado";
            fila.innerHTML = '<input type="checkbox" checked><b></b><span></span><small></small>';
            fila.querySelector("input").dataset.indice = String(indice);
            fila.querySelector("b").textContent = item.cantidad + " ×";
            fila.querySelector("span").textContent = item.producto;
            fila.querySelector("small").textContent = item.marca;
            caja.appendChild(fila);
        });
        if (lectura.cambios?.length) {
            const cambios = document.createElement("p");
            cambios.className = "cambiosDictado";
            cambios.textContent = "Cambios (no se suman): " + lectura.cambios.map(tramo => "«" + tramo + "»").join(", ");
            caja.appendChild(cambios);
        }
        if (lectura.sinEntender.length) {
            const aviso = document.createElement("div");
            aviso.className = "sinEntenderDictado";
            aviso.innerHTML = lectura.sinEntender.map(tramo => htmlPregunta(tramo, false)).join("");
            caja.appendChild(aviso);
            if (iaPrendida() && !(lecturaIA && lecturaIA.texto === texto)) {
                const boton = document.createElement("button");
                boton.type = "button";
                boton.className = "botonRepetirPedido botonEntenderIA";
                boton.innerHTML = window.icono("chispa", 15) + " Entender con IA";
                boton.addEventListener("click", async () => {
                    boton.disabled = true;
                    boton.lastChild.textContent = " Pensando…";
                    const leida = await leerPedidoConIA(texto);
                    if (!hojaDictado || hojaDictado.querySelector("#textoDictado").value !== texto) return;
                    if (leida) {
                        lecturaIA = { texto, lectura: leida };
                        mostrarLectura(texto);
                    } else {
                        boton.disabled = false;
                        boton.lastChild.textContent = " Entender con IA";
                        hojaDictado.querySelector(".estadoDictado").textContent = porQueFallo || "La IA no pudo leerlo. Revisá la conexión o probá de nuevo.";
                    }
                });
                caja.appendChild(boton);
            }
        }
    }

    function abrirDictado() {
        crearHojaDictado();
        hojaDictado.querySelector("#textoDictado").value = "";
        hojaDictado.querySelector(".estadoDictado").textContent = "";
        respuestasDictado = {};
        mostrarLectura("");
        hojaDictado.classList.remove("oculto");
    }

    function cerrarDictado() {
        detener();
        hojaDictado?.classList.add("oculto");
        hojaDictado?.classList.remove("escuchando");
    }

    // Etapa 8: el micrófono de Inicio ahora es el Asistente (asistente.js).
    window.vozVendeFrio = { disponible: Boolean(Reconocimiento), interpretar, ejecutar, ejecutarOrden, detener, interpretarConIA, leerPedidoConIA, estadoIACelular, probarIANube, leerPedido, sugerencias, buscarEnCatalogo, htmlPregunta, conectarPreguntas, escuchar, abrirDictado, comando: empezarComando };
}());
