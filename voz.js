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
        obtenerComercios().forEach(comercio => {
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
        obtenerComercios().forEach(comercio => {
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
            case "noEncontrado":
                decir("No encontré el comercio «" + orden.texto + "».");
                return false;
            default:
                return false;
        }
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
                const entendido = [final, ...alternativas].find(frase => interpretar(frase)?.accion && interpretar(frase).accion !== "noEncontrado")
                    || (interpretar(final) ? final : null);
                if (entendido) {
                    cerrarVentana();
                    ejecutar(entendido);
                } else {
                    texto.textContent = "No entendí «" + final + "». Tocá el micrófono y probá de nuevo.";
                }
            }
        });
    }

    function agregarBotonMicrofono() {
        if (!Reconocimiento || document.getElementById("botonVozInicio")) return;
        const avatar = document.getElementById("botonAvatar");
        if (!avatar) return;
        const boton = document.createElement("button");
        boton.type = "button";
        boton.id = "botonVozInicio";
        boton.className = "botonVozInicio";
        boton.setAttribute("aria-label", "Comando por voz");
        boton.title = "Comando por voz";
        boton.innerHTML = window.icono("microfono", 22);
        boton.addEventListener("click", empezarComando);
        avatar.before(boton);
    }

    // -------------------------------------------------
    // Pedido dictado o pegado (T44)
    // -------------------------------------------------

    function productosDelCatalogo() {
        const lista = [];
        const productos = typeof obtenerProductos === "function" ? obtenerProductos() : {};
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

    // De un texto ("tres helados de un kilo y dos palitos") saca los
    // productos del catálogo con su cantidad, y el comercio si lo nombra.
    function leerPedido(texto) {
        const catalogo = productosDelCatalogo();
        // Las comas y los renglones separan productos: quedan como " y ".
        let limpio = normalizar(String(texto || "").replace(/[,;\n]+/g, " y "));
        let comercio = null;

        // "Pedido para X: ..." o "para X ..." al principio.
        const conComercio = limpio.match(/^(?:(?:nuevo )?pedido )?(?:para|de) (.+?)(?: dos puntos| :|,| que | quiero | mandame | manda | necesito |$)/);
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
            "saludos", "quiero", "queria", "mandame", "manda", "mandar", "necesito", "traeme", "trae", "me", "nos", "hoy", "manana", "pedido", "nuevo", "son", "seria"]);
        const tramos = (" " + limpio + " ")
            .split(/ (?:y|mas|tambien|ademas|e) /)
            .map(tramo => tramo.split(" ").filter(palabra => palabra && !RELLENO.has(palabra)).join(" ").replace(/^por /, "").trim())
            .filter(Boolean);

        const encontrados = [];
        const sinEntender = [];
        tramos.forEach(tramo => {
            const palabras = tramo.split(" ");
            let cantidad = 0;
            let resto = palabras;
            // Cantidad adelante ("3 helados", "tres helados"); un número
            // después de "de" es del producto ("helado de un kilo").
            const indice = palabras.findIndex((palabra, i) => cantidadDe(palabra) && palabras[i - 1] !== "de" && i < palabras.length - 1);
            if (indice === 0) {
                cantidad = cantidadDe(palabras[0]);
                resto = palabras.slice(1);
            }
            // O al final ("helado x 3", "helados por tres").
            const alFinal = tramo.match(/(?:x|por) ?(\d+|[a-z]+)$/);
            if (!cantidad && alFinal && cantidadDe(alFinal[1])) {
                cantidad = cantidadDe(alFinal[1]);
                resto = tramo.slice(0, alFinal.index).trim().split(" ");
            }
            if (!cantidad) cantidad = 1;
            resto = resto.filter(palabra => !["unidad", "unidades", "caja", "cajas", "de"].includes(palabra));
            const buscado = normalizarProducto(resto.join(" "));
            if (!buscado) return;

            let mejor = null;
            let puntaje = 0;
            catalogo.forEach(item => {
                const valor = Math.max(parecido(item.clave, buscado), parecido(item.claveMarca, buscado));
                if (valor > puntaje) {
                    puntaje = valor;
                    mejor = item;
                }
            });
            if (mejor && puntaje >= 0.45) {
                const existente = encontrados.find(item => item.marca === mejor.marca && item.producto === mejor.producto);
                if (existente) existente.cantidad += cantidad;
                else encontrados.push({ marca: mejor.marca, producto: mejor.producto, cantidad, dicho: tramo });
            } else {
                sinEntender.push(tramo);
            }
        });
        return { comercio, productos: encontrados, sinEntender };
    }

    let hojaDictado = null;

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
            const lectura = leerPedido(campo.value);
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
        const lectura = leerPedido(texto);
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
        if (lectura.sinEntender.length) {
            const aviso = document.createElement("p");
            aviso.className = "sinEntenderDictado";
            aviso.textContent = "No encontré: " + lectura.sinEntender.map(tramo => "«" + tramo + "»").join(", ");
            caja.appendChild(aviso);
        }
    }

    function abrirDictado() {
        crearHojaDictado();
        hojaDictado.querySelector("#textoDictado").value = "";
        hojaDictado.querySelector(".estadoDictado").textContent = "";
        mostrarLectura("");
        hojaDictado.classList.remove("oculto");
    }

    function cerrarDictado() {
        detener();
        hojaDictado?.classList.add("oculto");
        hojaDictado?.classList.remove("escuchando");
    }

    function agregarBotonDictado() {
        const repetir = document.querySelector(".botonRepetirPedido");
        if (!repetir || document.querySelector(".botonDictarPedido")) return;
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "botonRepetirPedido botonDictarPedido";
        boton.innerHTML = window.icono(Reconocimiento ? "microfono" : "copiar", 15) + (Reconocimiento ? " Dictar o pegar pedido" : " Pegar pedido de un mensaje");
        boton.addEventListener("click", abrirDictado);
        const fila = document.createElement("div");
        fila.className = "filaAccionesRapidasPedido";
        repetir.before(fila);
        fila.append(repetir, boton);
    }

    function iniciar() {
        agregarBotonMicrofono();
        agregarBotonDictado();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();
    // El botón "Repetir último pedido" se arma al dibujar la pantalla.
    const pantallaPedido = document.getElementById("pantallaPedido");
    if (pantallaPedido) new MutationObserver(() => agregarBotonDictado()).observe(pantallaPedido, { childList: true, subtree: true });

    window.vozVendeFrio = { disponible: Boolean(Reconocimiento), interpretar, ejecutar, leerPedido, escuchar, abrirDictado, comando: empezarComando };
}());
