// VendeFrío - Asistente (Etapa 8, pedido del dueño).
// Un solo botón arriba a la derecha de Inicio, en el lugar del micrófono.
// Se le habla o se le escribe y contesta ahí mismo, también en voz alta:
// 1. Las órdenes ("nuevo pedido para Don Pepe", "llegué") las hace al toque
//    (voz.js las entiende).
// 2. Las preguntas por los números ("¿cuánto vendí hoy?", "¿quién me debe?")
//    las contesta con los datos de este celular, sin esperar. La plata solo
//    para quien tiene permiso de verla (T93).
// 3. "¿Cómo hago…?" lo explica en pasos (ayuda.js).
// 4. Lo que no sabe se lo pregunta a Claude (api/entender.js) con los
//    números y la guía, en una sola pregunta: Claude devuelve una orden o la
//    respuesta. Hace falta internet y la cuenta de la distribuidora.
// Reemplaza al micrófono suelto y a la pantalla "Preguntale a VendeFrío".
// T155: es el único asistente de la app. Los comandos por voz (también
// navegando) abren esta misma charla; sin internet contesta lo fácil.
// T160: está en todas las pantallas (arriba a la derecha, en las fichas y
// navegando) y sabe lo que estás viendo: la parada actual, el pedido o el
// comercio abierto. De una sola frase hace varias cosas seguidas («anotá un
// pedido para Aníbal, 5 ravioles, e imprimí el ticket»); antes de guardar un
// pedido o imprimir muestra lo que va a hacer y espera un «sí» (un toque o
// dicho). Solo usa comercios, productos y listas que existen.
(function () {
    "use strict";

    const p = window.piezas;
    const SUGERENCIAS = ["¿Cuánto vendí hoy?", "¿Quién me debe?", "¿Cómo registro un cobro?", "¿A dónde voy ahora?"];
    const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

    let hoja = null;
    let charla = [];
    let esperando = false;
    let escuchando = false;
    // T160: lo que espera un «sí» ({ pasos }) y si lo último fue dicho.
    let plan = null;
    let porVoz = false;

    // ---------- Preferencias ----------
    function preferencias() {
        try {
            return JSON.parse(localStorage.getItem("vendefrio_preferencias") || "{}");
        } catch (error) {
            return {};
        }
    }

    function hablaEnVozAlta() {
        return preferencias().asistenteCalla !== true;
    }

    function cambiarVozAlta(prendida) {
        try {
            localStorage.setItem("vendefrio_preferencias", JSON.stringify({ ...preferencias(), asistenteCalla: !prendida }));
        } catch (error) { /* sin lugar: queda como estaba */ }
        if (!prendida) callar();
    }

    // ---------- Voz ----------
    // alTerminar (T160): para escuchar el «sí» cuando termina de hablar.
    function hablar(texto, alTerminar) {
        let avisado = false;
        const terminar = () => {
            if (avisado || typeof alTerminar !== "function") return;
            avisado = true;
            alTerminar();
        };
        if (!hablaEnVozAlta() || !texto) return void setTimeout(terminar, 0);
        try {
            const sintesis = window.speechSynthesis;
            if (!sintesis || typeof SpeechSynthesisUtterance !== "function") return void setTimeout(terminar, 0);
            sintesis.cancel();
            const frase = new SpeechSynthesisUtterance(String(texto));
            frase.lang = "es-AR";
            const voz = sintesis.getVoices().find(item => /^es[-_]AR/i.test(item.lang)) || sintesis.getVoices().find(item => /^es/i.test(item.lang));
            if (voz) frase.voice = voz;
            frase.onend = terminar;
            frase.onerror = terminar;
            sintesis.speak(frase);
            // Por si el celular nunca avisa que terminó.
            if (alTerminar) setTimeout(terminar, Math.min(15000, 1500 + String(texto).length * 70));
        } catch (error) {
            setTimeout(terminar, 0);
        }
    }

    function callar() {
        try { window.speechSynthesis?.cancel(); } catch (error) { /* nada */ }
    }

    // ---------- Respuestas con los datos del celular ----------
    const normalizar = texto => window.ayudaVendeFrio?.normalizar?.(texto) ?? String(texto || "").toLowerCase();
    const plata = numero => "$ " + Math.round(Number(numero) || 0).toLocaleString("es-AR");
    const vePlata = () => window.verPlataVendeFrio?.puedoVer?.() !== false;
    const enLaNube = () => typeof usaNubeReal === "function" && usaNubeReal();

    function pedidosQueCuentan() {
        if (typeof obtenerPedidosQueCuentan === "function") return obtenerPedidosQueCuentan();
        return typeof obtenerHistorial === "function" ? obtenerHistorial() : [];
    }

    function fechaDe(pedido) {
        if (typeof obtenerFechaPedidoDashboard === "function") return obtenerFechaPedidoDashboard(pedido);
        const hora = Number(pedido && pedido.timestamp);
        return hora ? new Date(hora) : null;
    }

    const totalDe = pedido => (typeof totalDelPedido === "function" ? Number(totalDelPedido(pedido)?.total || 0) : 0);
    const unidadesDe = pedido => (Array.isArray(pedido && pedido.productos) ? pedido.productos : []).reduce((suma, item) => suma + (Number(item && item.cantidad) || 0), 0);

    function periodoDe(dicho) {
        const ahora = new Date();
        const dia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        if (/\bayer\b/.test(dicho)) return { nombre: "ayer", desde: new Date(dia.getTime() - 86400000), hasta: dia };
        if (/\bsemana\b/.test(dicho)) {
            const lunes = new Date(dia);
            lunes.setDate(dia.getDate() - ((dia.getDay() + 6) % 7));
            return { nombre: "esta semana", desde: lunes, hasta: null };
        }
        if (/\bmes\b/.test(dicho)) return { nombre: "este mes", desde: new Date(ahora.getFullYear(), ahora.getMonth(), 1), hasta: null };
        const mes = MESES.findIndex(nombre => new RegExp("\\b" + nombre + "\\b").test(dicho));
        if (mes >= 0) {
            const anio = mes > ahora.getMonth() ? ahora.getFullYear() - 1 : ahora.getFullYear();
            return { nombre: "en " + MESES[mes], desde: new Date(anio, mes, 1), hasta: new Date(anio, mes + 1, 1) };
        }
        return { nombre: "hoy", desde: dia, hasta: null };
    }

    function delPeriodo(periodo) {
        return pedidosQueCuentan().filter(pedido => {
            if (!pedido || pedido.eliminado === true || pedido.estado === "cancelado") return false;
            const fecha = fechaDe(pedido);
            return fecha && fecha >= periodo.desde && (!periodo.hasta || fecha < periodo.hasta);
        });
    }

    function cuantosPedidos(n) {
        return n + (n === 1 ? " pedido" : " pedidos");
    }

    // Lo que se contesta sin esperar a nadie, o null.
    function respuestaLocal(texto) {
        const dicho = normalizar(texto);

        if (/\b(cuanto|que) (vendi|vendimos|vendio|se vendio|llevo vendido|facture|hice)\b|\b(ventas|vendido|facturado) (de )?(hoy|ayer|esta semana|la semana|este mes|el mes)\b/.test(dicho)) {
            const periodo = periodoDe(dicho);
            const pedidos = delPeriodo(periodo);
            const comercios = new Set(pedidos.map(pedido => String(pedido.comercio || ""))).size;
            if (!vePlata()) {
                const unidades = pedidos.reduce((suma, pedido) => suma + unidadesDe(pedido), 0);
                return { destacado: unidades + " unidades", texto: "Salieron " + unidades + " unidades " + periodo.nombre + ", en " + cuantosPedidos(pedidos.length) + ".", decir: periodo.nombre + " salieron " + unidades + " unidades en " + cuantosPedidos(pedidos.length) };
            }
            const total = pedidos.reduce((suma, pedido) => suma + totalDe(pedido), 0);
            return {
                destacado: plata(total),
                texto: "Vendiste " + plata(total) + " " + periodo.nombre + ", en " + cuantosPedidos(pedidos.length) + " a " + comercios + (comercios === 1 ? " comercio." : " comercios."),
                decir: "Vendiste " + Math.round(total).toLocaleString("es-AR") + " pesos " + periodo.nombre + ", en " + cuantosPedidos(pedidos.length)
            };
        }

        if (/\b(quien|quienes) (me )?deb|\bcuanto me deben\b|\bme deben\b|\ba cobrar\b|\bfiado\b/.test(dicho)) {
            if (!vePlata() || !window.saldosVendeFrio?.cuentas) return { texto: "Eso lo ve quien tiene permiso de ver la plata.", decir: "Eso lo ve quien tiene permiso de ver la plata" };
            const cuentas = window.saldosVendeFrio.cuentas().slice().sort((a, b) => b.total - a.total);
            if (!cuentas.length) return { texto: "Nadie te debe nada.", decir: "Nadie te debe nada" };
            const total = cuentas.reduce((suma, cuenta) => suma + cuenta.total, 0);
            const primeros = cuentas.slice(0, 3).map(cuenta => cuenta.nombre + " (" + plata(cuenta.total) + ")").join(", ");
            return {
                destacado: plata(total),
                texto: "Te deben " + plata(total) + " entre " + cuentas.length + (cuentas.length === 1 ? " comercio: " : " comercios. Los que más: ") + primeros + ".",
                decir: "Te deben " + Math.round(total).toLocaleString("es-AR") + " pesos. El que más, " + cuentas[0].nombre,
                barras: cuentas.slice(0, 5).map(cuenta => ({ etiqueta: cuenta.nombre.split(" ")[0], valor: cuenta.total }))
            };
        }

        if (/\b(cuantos|que|hay) pedidos\b|\bpedidos (para|por) (armar|preparar|entregar|repartir)\b|\bque (tengo que|me falta) (armar|entregar|repartir)\b/.test(dicho)) {
            const hoy = typeof pedidosDeHoyInicio === "function" ? pedidosDeHoyInicio(pedidosQueCuentan()) : delPeriodo(periodoDe("hoy"));
            const estado = pedido => (typeof estadoInicio === "function" ? estadoInicio(pedido) : "");
            if (!enLaNube()) return { destacado: cuantosPedidos(hoy.length), texto: "Hoy cargaste " + cuantosPedidos(hoy.length) + ".", decir: "Hoy cargaste " + cuantosPedidos(hoy.length) };
            const armar = hoy.filter(pedido => ["cargado", "enPreparacion"].includes(estado(pedido))).length;
            const entregar = hoy.filter(pedido => ["preparado", "enVehiculo", "enReparto"].includes(estado(pedido))).length;
            return {
                texto: "Hoy tenés " + armar + " para armar y " + entregar + " para entregar.",
                decir: "Hoy tenés " + armar + " para armar y " + entregar + " para entregar"
            };
        }

        if (/\b(stock|me quedan?|queda poco|que falta reponer|reponer)\b/.test(dicho) && window.stockVendeFrio?.todos) {
            const bajos = window.stockVendeFrio.todos().filter(item => item.estado && item.estado.nivel !== "ok");
            if (!bajos.length) return { texto: "No hay productos con poco stock.", decir: "No hay productos con poco stock" };
            const lista = bajos.slice(0, 5).map(item => item.producto.nombre + " (" + item.estado.hay + " u)").join(", ");
            return { texto: "Te queda poco de: " + lista + ".", decir: "Te queda poco de " + bajos.slice(0, 3).map(item => item.producto.nombre).join(", ") };
        }

        if (/\b(que|cuantos) comercios? (me )?(falta|faltan|quedan) (visitar|por visitar)\b|\bsin visitar\b/.test(dicho)) {
            const comercios = (typeof obtenerComercios === "function" ? obtenerComercios() : []).filter(comercio => comercio.archivado !== true);
            const faltan = typeof comercioVisitadoRecientemente === "function" ? comercios.filter(comercio => !comercioVisitadoRecientemente(comercio)) : [];
            if (!faltan.length) return { texto: "Ya visitaste todos tus comercios esta semana.", decir: "Ya visitaste todos tus comercios esta semana" };
            return { texto: "Te faltan visitar esta semana: " + faltan.slice(0, 6).map(comercio => comercio.nombre).join(", ") + ".", decir: "Te faltan " + faltan.length + " comercios por visitar esta semana" };
        }

        if (/\bque hora es\b/.test(dicho)) {
            const hora = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
            return { texto: "Son las " + hora + ".", decir: "Son las " + hora };
        }
        if (/\bque (dia|fecha) es\b|\ba que estamos\b/.test(dicho)) {
            const fecha = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
            return { texto: "Hoy es " + fecha + ".", decir: "Hoy es " + fecha };
        }
        return null;
    }

    // ---------- Órdenes ----------
    const PANTALLAS = { pedido: "Pedidos", menu: "Inicio", comercios: "Comercios", catalogo: "Catálogo", rutas: "Rutas", estadisticas: "Estadísticas", cierre: "Cierre del día", historial: "Historial", productos: "Catálogo" };

    function contarOrden(orden) {
        const nombre = orden.comercio && orden.comercio.nombre;
        switch (orden.accion) {
            case "nuevoPedido": return nombre ? "Abro un pedido para " + nombre + "." : "Abro un pedido nuevo.";
            case "ir": return "Te llevo a " + nombre + ".";
            case "visitado": return "Marco " + nombre + " como visitado.";
            case "ficha": return "Abro la ficha de " + nombre + ".";
            case "pantalla": return "Abro " + (PANTALLAS[orden.pantalla] || "esa pantalla") + ".";
            case "proximaParada": return "Te llevo a la próxima parada.";
            case "llegue": return "Listo, sigo con la próxima parada.";
            default: return "";
        }
    }

    // ---------- Lo que estás viendo (T160) ----------
    const seVe = elemento => Boolean(elemento && !elemento.classList.contains("oculto") && elemento.getClientRects().length);
    const comercioLlamado = nombre => (nombre && typeof buscarComercioPorNombre === "function" ? buscarComercioPorNombre(nombre) : null) || null;

    function pedidoPorId(id) {
        return id ? pedidosQueCuentan().find(pedido => String(pedido && pedido.id) === String(id)) || null : null;
    }

    // { pantalla, comercio, pedidoId, siguiente, lineas }: se arma al
    // preguntar, con lo que hay en pantalla (nada se guarda).
    function contexto() {
        const vista = { pantalla: "", comercio: null, pedidoId: "", siguiente: null, lineas: [] };
        const navegacion = window.navegacionVendeFrio;
        if (navegacion?.abierta?.()) {
            const parada = navegacion.paradaActual?.() || null;
            const siguen = navegacion.paradasQueSiguen?.() || [];
            vista.pantalla = "navegacion";
            vista.comercio = parada;
            vista.siguiente = siguen[0] || null;
            vista.lineas.push("Está navegando" + (parada ? " hacia " + parada.nombre + (parada.direccion ? " (" + parada.direccion + ")" : "") : "") + ".");
            const calle = navegacion.calle?.();
            if (calle) vista.lineas.push("Va por " + calle + ".");
            vista.lineas.push(siguen.length ? "Después siguen: " + siguen.map(comercio => comercio.nombre).join(", ") + "." : "Es la última parada del recorrido.");
        } else {
            const seccion = [...document.querySelectorAll('body > section[id^="pantalla"]')].find(seVe);
            if (seccion) {
                vista.pantalla = seccion.id.replace(/^pantalla/, "").toLowerCase();
                const titulo = (seccion.querySelector(":scope > header h1, .configHeader h1")?.textContent || "").trim();
                const cliente = document.getElementById("cliente");
                if (seccion.id === "pantallaPedido" && seVe(cliente)) {
                    const unidades = Number(document.getElementById("totalUnidadesPedido")?.textContent) || 0;
                    vista.pantalla = "nuevoPedido";
                    vista.comercio = comercioLlamado(cliente.value.trim());
                    vista.lineas.push("Está cargando un pedido nuevo" + (cliente.value.trim() ? " para " + cliente.value.trim() : "") + (unidades ? ", con " + unidades + " unidades" : "") + ".");
                } else if (seccion.id === "pantallaRutas") {
                    const ruta = typeof rutaOrdenada !== "undefined" && Array.isArray(rutaOrdenada) ? rutaOrdenada : [];
                    vista.lineas.push("Está en Rutas" + (ruta.length ? ", con el recorrido: " + ruta.map(comercio => comercio.nombre).join(", ") : "") + ".");
                } else if (seccion.id === "pantallaMenu") {
                    vista.lineas.push("Está en Inicio.");
                } else {
                    vista.lineas.push("Está en la pantalla " + (titulo || PANTALLAS[vista.pantalla] || vista.pantalla) + ".");
                }
            }
        }
        // Las fichas se abren encima de cualquier pantalla.
        const idPedido = window.seguimientoVendeFrio?.pedidoAbierto?.() || "";
        const pedido = seVe(document.getElementById("modalFichaPedido")) ? pedidoPorId(idPedido) : null;
        if (pedido) {
            vista.pedidoId = String(pedido.id);
            vista.comercio = comercioLlamado(pedido.comercio) || vista.comercio;
            const productos = (Array.isArray(pedido.productos) ? pedido.productos : []).map(item => (Number(item.cantidad) || 0) + " " + item.producto).join(", ");
            vista.lineas.push("Tiene abierto el pedido de " + pedido.comercio + (productos ? ": " + productos : "") + ".");
        }
        const fichaComercio = document.querySelector(".modalFichaComercio #tituloFichaComercio");
        if (fichaComercio && seVe(fichaComercio.closest(".modalFichaComercio"))) {
            const nombre = fichaComercio.textContent.trim();
            vista.comercio = comercioLlamado(nombre) || vista.comercio;
            vista.lineas.push("Tiene abierta la ficha del comercio " + nombre + ".");
        }
        return vista;
    }

    // ---------- Varias cosas de una sola frase (T160) ----------
    const NECESITAN_SI = ["anotarPedido", "imprimir"];
    // «… e imprimí el ticket», «y sacale el ticket».
    const IMPRIMIR = /[,.\s]*(?:\b(?:y|e)\s+)?(?:(?:despu[eé]s|luego)\s+)?\b(?:imprim[ií]\w*|sac[aá](?:le|me|lo)?|larg[aá](?:le|me)?)\s+(?:el\s+|un\s+|los\s+)?(?:ticket|comprobante|remito)s?\b/i;
    // «a precio especial», «con la lista Mayorista».
    const LISTA = /[,\s]*\b(?:a|al|con|en)\s+(?:el\s+|la\s+|los\s+)?(?:precios?|lista)(?:\s+de)?(?:\s+(?:la\s+)?lista)?\s+([\wáéíóúñü]+)/i;
    const SI = /^(si|sii+|dale|hacelo|ok|okey|listo|confirmo|confirmar|de una|bueno|va|perfecto|correcto|eso)\b/;
    const NO = /^(no|cancela|cancelar|deja|dejalo|para|nada|mejor no)\b/;

    function listasHechas() {
        return typeof window.listasDePrecios === "function" ? window.listasDePrecios() : [];
    }

    // La lista nombrada («especial» → «Especial»), o null y lo que dijo.
    function listaDicha(texto) {
        const dicho = normalizar(texto);
        const lista = listasHechas().slice().sort((a, b) => b.length - a.length).find(nombre => new RegExp("\\b" + normalizar(nombre).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(dicho));
        const partes = texto.match(LISTA);
        return { lista: lista || null, dicha: partes ? partes[1] : "", sinLista: partes ? texto.replace(LISTA, " ") : texto };
    }

    function ultimoPedidoGuardado() {
        return typeof idUltimoPedidoGenerado !== "undefined" ? String(idUltimoPedidoGenerado || "") : "";
    }

    // Lo que el celular entiende solo, sin Claude: el ticket, «primero» y
    // un pedido con sus productos. Devuelve { pasos, avisos }, o null.
    function planLocal(texto, vista, claude) {
        const voz = window.vozVendeFrio;
        if (!voz?.interpretar) return null;
        let resto = String(texto || "");
        const imprimir = IMPRIMIR.test(resto);
        if (imprimir) resto = resto.replace(IMPRIMIR, " ").trim();
        const dicho = normalizar(resto);

        // «Vamos a lo de Pepe primero», navegando.
        if (vista.pantalla === "navegacion" && /\b(primero|antes)\b/.test(dicho) && !imprimir) {
            const orden = voz.interpretar(resto.replace(/\b(primero|antes)\b/gi, " "));
            if (orden?.comercio) return { pasos: [{ accion: "primero", comercio: orden.comercio }], avisos: [] };
        }

        // Solo «imprimí el ticket»: el pedido abierto o el último guardado.
        if (imprimir && !dicho.replace(/\b(che|por favor|porfa|ahora|ya)\b/g, "").trim()) {
            return { pasos: [{ accion: "imprimir" }], avisos: [] };
        }

        // Un pedido con productos: se guarda (después del «sí»).
        const { lista, dicha, sinLista } = listaDicha(resto);
        const orden = voz.interpretar(sinLista);
        const pide = orden?.accion === "nuevoPedido" || /\b(anota|anotame|anotale|carga|cargale|cargame|pedido|pedi|pide|quiere)\b/.test(dicho);
        const lectura = pide && voz.leerPedido ? voz.leerPedido(sinLista) : null;
        if (lectura && lectura.productos.length) {
            const comercio = (orden?.accion === "nuevoPedido" && orden.comercio) || lectura.comercio || vista.comercio;
            const sinEntender = (lectura.sinEntender || []).filter(tramo => normalizar(tramo).replace(/\b(para|de|del|lo|la|el|los|las|un|una|y|e|a|al|le|che|anota|anotame|anotale|anotar|carga|cargale|cargame|cargar|pedido|ticket|porfa|por favor)\b/g, "").replace(/[^a-z0-9ñ]+/g, ""));
            // Si quedó algo sin entender y está Claude, que lo lea Claude.
            if (!comercio || (sinEntender.length && claude)) return null;
            const avisos = [];
            if (sinEntender.length) avisos.push("No entendí: " + sinEntender.map(tramo => "«" + tramo + "»").join(", ") + ".");
            if (dicha && !lista) avisos.push("No hay una lista «" + dicha + "»: va con la lista de " + comercio.nombre + ".");
            const pasos = [{ accion: "anotarPedido", comercio, productos: lectura.productos.map(({ marca, producto, cantidad }) => ({ marca, producto, cantidad })), lista }];
            if (imprimir) pasos.push({ accion: "imprimir" });
            return { pasos, avisos };
        }

        // Otra orden clara y después el ticket. Si no se entiende bien, que
        // lo lea Claude; sin Claude, solo el ticket y avisa qué no entendió.
        if (imprimir) {
            const otra = voz.interpretar(resto);
            if (otra && ["pantalla", "ir", "visitado", "proximaParada", "llegue"].includes(otra.accion)) return { pasos: [otra, { accion: "imprimir" }], avisos: [] };
            if (claude) return null;
            return { pasos: [{ accion: "imprimir" }], avisos: ["No entendí: «" + resto + "»."] };
        }
        return null;
    }

    function textoProductos(productos) {
        return productos.map(item => item.cantidad + " " + item.producto).join(", ");
    }

    function describir(paso, vista) {
        const nombre = paso.comercio && paso.comercio.nombre;
        switch (paso.accion) {
            case "anotarPedido": return "Guardar un pedido para " + nombre + ": " + textoProductos(paso.productos) + (paso.lista ? " (lista " + paso.lista + ")" : "") + ".";
            case "imprimir": {
                const pedido = pedidoPorId(vista.pedidoId || ultimoPedidoGuardado());
                return "Imprimir el ticket" + (vista.pasoPedido ? " de ese pedido." : pedido ? " del pedido de " + pedido.comercio + "." : ".");
            }
            case "primero": return "Ir primero a " + nombre + ".";
            default: return contarOrden(paso);
        }
    }

    // Lo que no guarda ni imprime se hace al toque; lo demás espera el «sí».
    function proponer(pasos, avisos = []) {
        const vista = contexto();
        if (!pasos.some(paso => NECESITAN_SI.includes(paso.accion))) return hacerPasos(pasos, vista);
        let conPedido = false;
        const lineas = pasos.map(paso => {
            const linea = describir(paso, { ...vista, pasoPedido: conPedido });
            if (paso.accion === "anotarPedido") conPedido = true;
            return linea;
        });
        plan = { pasos, vista };
        charla.push({ quien: "app", texto: "¿Hago esto?", pasos: lineas, avisos, plan: true });
        dibujar();
        const escucharDespues = porVoz && window.vozVendeFrio?.disponible;
        hablar("¿Hago esto? " + lineas.join(" ") + " Decí sí o no.", () => {
            if (escucharDespues && plan && hoja?.isConnected && !escuchando) escucharAhora();
        });
    }

    function confirmar() {
        if (!plan) return;
        const { pasos, vista } = plan;
        plan = null;
        charla.push({ quien: "yo", texto: "Sí" });
        hacerPasos(pasos, vista);
    }

    function cancelar(conTexto = true) {
        if (!plan) return;
        plan = null;
        if (conTexto) charla.push({ quien: "yo", texto: "No" });
        contestar({ texto: "Listo, no hago nada." });
    }

    function hayPedidoCargando() {
        const cliente = document.getElementById("cliente");
        return Boolean((cliente && cliente.value.trim()) || [...document.querySelectorAll(".marca select")].some(select => Number(select.value) > 0));
    }

    // Guarda el pedido con el mismo formulario de Nuevo pedido (los mismos
    // precios, listas y avisos). Si había otro a medio cargar, lo deja como
    // estaba; navegando, la navegación sigue abierta. Devuelve su id o "".
    function anotarPedido(paso) {
        if (typeof abrirPedidoNuevoParaComercio !== "function" || typeof generarPedido !== "function" || typeof window.agregarProductosAlPedido !== "function") return "";
        const navegacion = document.getElementById("pantallaNavegacion");
        const navegando = window.navegacionVendeFrio?.abierta?.();
        const debajo = [...document.querySelectorAll('body > section[id^="pantalla"]')].find(seccion => seccion !== navegacion && !seccion.classList.contains("oculto"));
        const devolver = hayPedidoCargando() && typeof recordarPedidoActual === "function" ? recordarPedidoActual() : null;
        abrirPedidoNuevoParaComercio(paso.comercio.nombre);
        if (paso.lista && window.nuevoPedidoVendeFrio?.leerBorrador) {
            const datos = window.nuevoPedidoVendeFrio.leerBorrador();
            datos.lista = { nombre: paso.lista, comercio: String(paso.comercio.id || paso.comercio.nombre) };
            window.nuevoPedidoVendeFrio.guardarBorrador(datos);
        }
        window.agregarProductosAlPedido(paso.productos, paso.comercio.nombre);
        const guardado = generarPedido() === true;
        if (guardado && devolver) devolver();
        if (navegando && navegacion) {
            document.getElementById("pantallaPedido")?.classList.add("oculto");
            debajo?.classList.remove("oculto");
            navegacion.classList.remove("oculto");
        }
        return guardado ? ultimoPedidoGuardado() : "";
    }

    async function imprimir(id) {
        const impresion = window.impresionVendeFrio;
        if (!id) return "No hay un pedido abierto para imprimir.";
        if (!impresion?.disponible?.()) return "Para imprimir hace falta la cuenta de la distribuidora y Chrome con Bluetooth.";
        const pedido = pedidoPorId(id);
        if (pedido && impresion.puedeImprimir && !impresion.puedeImprimir(pedido)) return "Ese pedido ya no se puede imprimir.";
        // La impresión avisa sola «Ticket impreso» o qué falló.
        await impresion.imprimirPedido(id, { copias: 2 });
        return "";
    }

    async function hacerPasos(pasos, vista) {
        const voz = window.vozVendeFrio;
        const dichos = pasos.filter(paso => paso.accion !== "imprimir" && paso.accion !== "anotarPedido").map(paso => describir(paso, vista));
        const resumen = dichos.join(" ");
        if (resumen) charla.push({ quien: "app", texto: resumen });
        hablar(resumen);
        cerrar();
        let idPedido = "";
        for (const paso of pasos) {
            if (paso.accion === "anotarPedido") {
                idPedido = anotarPedido(paso);
                // Si no se pudo guardar, el formulario dice por qué y no sigue.
                if (!idPedido) return;
                if (typeof mostrarToast === "function") mostrarToast("Pedido guardado para " + paso.comercio.nombre);
            } else if (paso.accion === "imprimir") {
                const problema = await imprimir(idPedido || vista.pedidoId || ultimoPedidoGuardado());
                if (problema && typeof mostrarToast === "function") mostrarToast(problema);
            } else if (paso.accion === "primero") {
                if (!window.navegacionVendeFrio?.irPrimero?.(paso.comercio.nombre)) voz?.ejecutarOrden?.({ accion: "ir", comercio: paso.comercio });
            } else {
                voz?.ejecutarOrden?.(paso);
            }
        }
        if (resumen && typeof mostrarToast === "function" && !pasos.some(paso => NECESITAN_SI.includes(paso.accion))) mostrarToast(resumen);
    }

    // ---------- Charla ----------
    function htmlBurbuja(item) {
        if (item.quien === "yo") return `<div class="burbuja burbujaYo">${p.esc(item.texto)}</div>`;
        if (item.error) return `<div class="burbuja burbujaApp burbujaError">${p.esc(item.texto)}</div>`;
        const maximo = Math.max(1, ...(item.barras || []).map(barra => barra.valor));
        const barras = (item.barras || []).length > 1 ? `<div class="miniBarras" role="img" aria-label="${p.esc(item.barras.map(barra => barra.etiqueta + ": " + barra.valor).join(", "))}">${item.barras.map((barra, indice) =>
            `<span class="${indice === item.barras.length - 1 ? "barraFinal" : ""}" style="height:${Math.max(6, Math.round(barra.valor / maximo * 100))}%"><small>${p.esc(barra.etiqueta)}</small></span>`).join("")}</div>` : "";
        const pasos = (item.pasos || []).length ? `<ol class="pasosAsistente">${item.pasos.map(paso => `<li>${p.esc(paso)}</li>`).join("")}</ol>` : "";
        const avisos = (item.avisos || []).map(aviso => `<p class="avisoPlanAsistente">${p.esc(aviso)}</p>`).join("");
        const botones = item.plan && plan && item === charla[charla.length - 1]
            ? `<div class="botonesPlanAsistente"><button type="button" class="pzBtn pzBtnGris" data-plan="no">No</button><button type="button" class="pzBtn pzBtnPri" data-plan="si">${p.ico("check", 18)} Sí, hacelo</button></div>`
            : "";
        const [antes, ...resto] = String(item.texto || "").split(item.destacado || "\u0000");
        const texto = item.destacado && resto.length
            ? p.esc(antes) + `<strong>${p.esc(item.destacado)}</strong>` + p.esc(resto.join(item.destacado))
            : (item.destacado ? `<strong>${p.esc(item.destacado)}</strong>` : "") + p.esc(item.texto);
        return `<div class="burbuja burbujaApp${item.plan ? " burbujaPlan" : ""}">${texto}${pasos}${avisos}${barras}${botones}</div>`;
    }

    function dibujar() {
        if (!hoja || !hoja.isConnected) return;
        const lugar = hoja.querySelector(".charla");
        lugar.innerHTML = (charla.length ? charla.map(htmlBurbuja).join("")
            : `<div class="burbuja burbujaApp">Hola. Decime qué necesitás: cargo pedidos, te digo cómo vas y te explico cómo se usa la app.</div>`)
            + (esperando ? `<div class="burbuja burbujaApp burbujaPensando" aria-label="Pensando"><span></span><span></span><span></span></div>` : "");
        lugar.scrollTop = lugar.scrollHeight;
        const estado = hoja.querySelector(".estadoAsistente");
        estado.textContent = escuchando ? "Te escucho…" : "";
        hoja.querySelector(".botonHablarAsistente")?.classList.toggle("escuchando", escuchando);
    }

    function contestar(item) {
        charla.push({ quien: "app", ...item });
        dibujar();
        hablar(item.decir || [item.destacado, item.texto].filter(Boolean).join(" "));
    }

    function dejarDeEscuchar() {
        if (!escuchando) return;
        escuchando = false;
        window.vozVendeFrio?.detener?.();
    }

    async function responder(texto, alternativas = []) {
        const pedido = String(texto || "").trim();
        if (!pedido || esperando) return;
        dejarDeEscuchar();
        const dicho = normalizar(pedido);
        // T160: lo que esperaba un «sí».
        if (plan) {
            if (SI.test(dicho)) return confirmar();
            if (NO.test(dicho)) {
                charla.push({ quien: "yo", texto: pedido });
                return cancelar(false);
            }
            plan = null;
        }
        charla.push({ quien: "yo", texto: pedido });
        dibujar();
        const voz = window.vozVendeFrio;
        const vista = contexto();

        // 1. Sus números, al toque.
        const numeros = respuestaLocal(pedido);
        if (numeros) return contestar(numeros);

        // 2. Varias cosas seguidas, un pedido con productos o el ticket (T160).
        const local = planLocal(pedido, vista, Boolean(voz?.claudeDisponible?.()));
        if (local) return proponer(local.pasos, local.avisos);

        // 3. Las órdenes ("¿cómo llego a…?" también es una orden).
        const comoHago = /^(como|que hago|para que|donde (se|esta|encuentro))\b/.test(dicho) && !/\bcomo (llego|voy|se llega)\b/.test(dicho);
        if (!comoHago && voz?.interpretar) {
            const frase = [pedido, ...alternativas].find(opcion => {
                const orden = voz.interpretar(opcion);
                return orden && orden.accion !== "noEncontrado";
            });
            if (frase) return hacer(voz.interpretar(frase));
        }

        // 4. Cómo se usa la app. T160: con Claude, solo si lo pregunta
        // («¿cómo…?»); si no, «sacale el ticket» sería una explicación.
        const tema = comoHago || !voz?.claudeDisponible?.() ? window.ayudaVendeFrio?.buscar(pedido) : null;
        if (tema) return contestar({ texto: tema.titulo + ":", pasos: tema.pasos, decir: tema.titulo + ". " + tema.pasos.join(" ") });

        const noEncontrado = voz?.interpretar?.(pedido);

        // 5. Claude, en una sola pregunta: una orden, varias o la respuesta.
        let motivo = "";
        if (voz?.claudeDisponible?.()) {
            esperando = true;
            dibujar();
            const abierta = hoja;
            const resultado = await voz.preguntarAlAsistente(pedido, datosParaLaIA(vista), charla.slice(0, -1));
            esperando = false;
            // Si cerraron la charla mientras pensaba, no hace nada.
            if (!hoja || hoja !== abierta) return;
            const pasos = resultado?.pasos || [];
            if (pasos.length > 1 || pasos.some(paso => NECESITAN_SI.includes(paso.accion) || paso.accion === "primero")) return proponer(pasos);
            if (resultado?.orden) return hacer(resultado.orden);
            if (resultado) return contestar({ texto: resultado.texto, destacado: resultado.destacado, barras: resultado.barras });
            // Claude no contestó: sigue con lo que sabe el celular, y dice por qué.
            motivo = voz.porQueFallo?.() || "";
        } else if (enLaNube() && preferencias().asistenteClaude === false) {
            motivo = "Con Claude prendido (Más › Preferencias de trabajo › Asistente) entiendo mucho más.";
        }

        if (noEncontrado && noEncontrado.accion === "noEncontrado") {
            return contestar({ texto: "No encontré el comercio «" + noEncontrado.texto + "». Fijate cómo está escrito en Comercios." + (motivo ? " " + motivo : "") });
        }
        contestar({
            texto: "No entendí «" + pedido + "». Probá con «nuevo pedido para…», «¿cuánto vendí hoy?» o «¿cómo registro un cobro?»." + (motivo ? " " + motivo : ""),
            decir: "No entendí. Probá de nuevo"
        });
    }

    function datosParaLaIA(vista = contexto()) {
        const guia = "## Cómo se usa la app\n" + (window.ayudaVendeFrio?.guiaEnTexto?.() || "");
        const numeros = vePlata() && window.preguntaleVendeFrio?.resumen ? window.preguntaleVendeFrio.resumen() : "Quien pregunta no tiene permiso para ver la plata: no des montos.";
        const viendo = vista.lineas.length ? "## Lo que está viendo ahora\n" + vista.lineas.join("\n") + "\n\n" : "";
        return viendo + numeros + "\n\n" + guia;
    }

    function hacer(orden) {
        const texto = contarOrden(orden);
        charla.push({ quien: "app", texto });
        hablar(texto);
        cerrar();
        if (typeof mostrarToast === "function" && texto) mostrarToast(texto);
        window.vozVendeFrio?.ejecutarOrden?.(orden);
    }

    // ---------- La ventana ----------
    function escucharAhora() {
        const voz = window.vozVendeFrio;
        if (!voz?.disponible || escuchando) return;
        callar();
        escuchando = true;
        dibujar();
        const campo = hoja?.querySelector("#textoAsistente");
        voz.escuchar({
            alParcial: parcial => { if (campo) campo.value = parcial; },
            alError: () => { escuchando = false; dibujar(); },
            alFinal: (final, alternativas = []) => {
                escuchando = false;
                // Si no escuchó nada, lo que se haya escrito mientras queda.
                if (campo && final) campo.value = "";
                dibujar();
                porVoz = true;
                if (final) responder(final, alternativas);
            }
        });
    }

    // Las sugerencias cambian con lo que estás viendo (T160).
    function sugerenciasPara(vista) {
        const propias = [];
        if (vista.pantalla === "navegacion") {
            propias.push("Llegué");
            if (vista.siguiente) propias.push("Vamos a lo de " + vista.siguiente.nombre + " primero");
        }
        if (vista.pedidoId) propias.push("Imprimí el ticket");
        else if (vista.comercio && vista.pantalla !== "navegacion") propias.push("Nuevo pedido para " + vista.comercio.nombre);
        return [...propias, ...SUGERENCIAS.filter(texto => !(vista.pantalla === "navegacion" && /cobro/.test(texto)))].slice(0, 4);
    }

    function abrir({ escuchar = true } = {}) {
        escuchando = false;
        esperando = false;
        plan = null;
        const sugerencias = sugerenciasPara(contexto());
        hoja = p.hoja({
            titulo: "Asistente",
            clase: "hojaAsistente",
            html: `<div class="charla" aria-live="polite"></div>
                <p class="estadoAsistente" role="status"></p>
                <div class="sugerencias">${sugerencias.map(texto => `<button type="button" class="pzFiltro" data-sugerencia="${p.esc(texto)}">${p.esc(texto)}</button>`).join("")}</div>
                <form class="entradaAsistente">
                    <input type="text" id="textoAsistente" placeholder="Hablá o escribí…" aria-label="Hablale o escribile al Asistente" autocomplete="off" maxlength="500">
                    ${window.vozVendeFrio?.disponible ? `<button type="button" class="botonRedondo botonHablarAsistente" aria-label="Hablar">${p.ico("microfono", 20)}</button>` : ""}
                    <button type="submit" class="botonRedondo" aria-label="Enviar">${p.ico("flechaDerecha", 20)}</button>
                </form>
                <label class="vozAltaAsistente"><input type="checkbox" id="vozAltaAsistente" ${hablaEnVozAlta() ? "checked" : ""}> Contestar en voz alta</label>`
        });
        hoja.addEventListener("submit", evento => {
            evento.preventDefault();
            const campo = hoja.querySelector("#textoAsistente");
            const texto = campo.value;
            campo.value = "";
            porVoz = false;
            responder(texto);
        });
        hoja.addEventListener("click", evento => {
            const sugerencia = evento.target.closest("[data-sugerencia]");
            if (sugerencia) {
                porVoz = false;
                responder(sugerencia.dataset.sugerencia);
            }
            const decision = evento.target.closest("[data-plan]");
            if (decision) {
                callar();
                dejarDeEscuchar();
                if (decision.dataset.plan === "si") confirmar();
                else cancelar();
            }
            if (evento.target.closest(".botonHablarAsistente")) escucharAhora();
        });
        hoja.querySelector("#vozAltaAsistente").addEventListener("change", evento => cambiarVozAlta(evento.target.checked));
        dibujar();
        if (escuchar) escucharAhora();
    }

    function cerrar() {
        escuchando = false;
        window.vozVendeFrio?.detener?.();
        if (hoja && hoja.isConnected) p.cerrar();
        hoja = null;
    }

    // ---------- El botón de Inicio ----------
    function agregarBoton() {
        if (document.getElementById("botonAsistente")) return;
        const avatar = document.getElementById("botonAvatar");
        if (!avatar) return;
        const boton = document.createElement("button");
        boton.type = "button";
        boton.id = "botonAsistente";
        boton.className = "botonVozInicio botonAsistente conNombre";
        boton.dataset.nombre = "Asistente";
        boton.setAttribute("aria-label", "Asistente");
        boton.title = "Asistente";
        boton.innerHTML = p.ico("chispa", 22);
        boton.addEventListener("click", () => abrir());
        avatar.before(boton);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", agregarBoton);
    else agregarBoton();

    // T160: el botón de cada pantalla y de las fichas (volver.js, Rutas,
    // la ficha del comercio y la del pedido) abre esta misma charla.
    document.addEventListener("click", evento => {
        if (evento.target.closest?.("[data-abrir-asistente]")) abrir();
    });

    window.asistenteVendeFrio = { abrir, cerrar, responder, respuestaLocal, contexto };
}());
