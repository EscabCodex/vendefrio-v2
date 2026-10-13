// =====================================================
// VendeFrío - impresion.js
// Imprimir ticket (T28b): desde la ficha del pedido, cualquiera del equipo
// imprime dos copias ("Copia comercio" y "Copia distribuidora", con una
// línea para cortar) en una impresora térmica Bluetooth de 80 mm (GOOJPRT
// MTP-3, BLE sin emparejar). Solo en la nube y solo con Web Bluetooth
// (Android con Chrome): en iPhone el botón no aparece. La impresora se
// conecta recién al tocar el botón, nunca al abrir la app; la elegida queda
// guardada en este celular (Configuración > Impresora). El ticket es un
// remito, no una factura. Antes de imprimir se eligen las copias (las dos o
// solo la del comercio); al terminar de armar el pedido y al cargarlo, la
// app ofrece imprimirlo.
// =====================================================

(function () {
    // Impresora guardada en este celular: { id, nombre }.
    const CLAVE_IMPRESORA = "vendefrio_impresora";

    // Servicios que puede tener la impresora (probados por el dueño con nRF
    // Connect). Se busca en este orden una característica para escribir.
    const SERVICIOS = [
        0x18f0,
        "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
        "49535343-fe7d-4ae5-8fa9-9fafd205e455",
        0xff00,
        0xfee7
    ];

    // Papel de 80 mm: 48 letras por línea. Se manda de a 20 bytes.
    const ANCHO = 48;
    const TROZO = 20;
    const ESPERA_CONEXION = 10000;

    // Estados en los que se imprime el ticket (no en Cancelado ni Histórico).
    const ESTADOS_QUE_SE_IMPRIMEN = ["cargado", "enPreparacion", "preparado", "enVehiculo", "enReparto", "entregado"];
    const ESTADOS_PREPARADOS = ["preparado", "enVehiculo", "enReparto"];

    // ESC/POS
    const INICIAR = [0x1b, 0x40];
    const SALIR_MODO_CHINO = [0x1c, 0x2e];
    const TABLA_850 = [0x1b, 0x74, 0x02];
    const NEGRITA = [0x1b, 0x45, 0x01];
    const SIN_NEGRITA = [0x1b, 0x45, 0x00];
    const DOBLE_ALTO = [0x1d, 0x21, 0x01];
    const TAMANO_NORMAL = [0x1d, 0x21, 0x00];
    const CENTRO = [0x1b, 0x61, 0x01];
    const IZQUIERDA = [0x1b, 0x61, 0x00];
    const SALTO = 0x0a;

    // Letras que no son ASCII, en la tabla 850.
    const TABLA = {
        "á": 0xa0, "é": 0x82, "í": 0xa1, "ó": 0xa2, "ú": 0xa3,
        "Á": 0xb5, "É": 0x90, "Í": 0xd6, "Ó": 0xe0, "Ú": 0xe9,
        "ñ": 0xa4, "Ñ": 0xa5, "ü": 0x81, "Ü": 0x9a,
        "à": 0x85, "è": 0x8a, "ì": 0x8d, "ò": 0x95, "ù": 0x97,
        "ç": 0x87, "Ç": 0x80,
        "¿": 0xa8, "¡": 0xad, "°": 0xf8, "º": 0xa7, "ª": 0xa6,
        "·": 0xfa, "«": 0xae, "»": 0xaf
    };
    const REEMPLAZOS = {
        "—": "-", "–": "-", "“": "\"", "”": "\"", "‘": "'", "’": "'",
        "…": "...", " ": " ", " ": " ", "€": "EUR", "\t": " "
    };

    let dispositivo = null;
    let caracteristica = null;
    let imprimiendo = "";
    const oyentes = [];

    // -------------------------------------------------
    // Cuándo se puede imprimir
    // -------------------------------------------------

    function enLaNube() {
        return typeof usaNubeReal === "function" && usaNubeReal();
    }

    function hayBluetooth() {
        return Boolean(navigator.bluetooth && typeof navigator.bluetooth.requestDevice === "function");
    }

    function disponible() {
        return enLaNube() && hayBluetooth();
    }

    function puedeImprimir(pedido) {
        if (!disponible() || !pedido || pedido.eliminado === true || pedido.estado === "historico") return false;
        return ESTADOS_QUE_SE_IMPRIMEN.includes(estadoActualDelPedido(pedido));
    }

    function avisar() {
        oyentes.forEach(oyente => {
            try {
                oyente();
            } catch (error) {
                console.error("Falló un aviso de la impresión.", error);
            }
        });
    }

    // -------------------------------------------------
    // Impresora guardada
    // -------------------------------------------------

    function impresoraGuardada() {
        try {
            const datos = JSON.parse(localStorage.getItem(CLAVE_IMPRESORA));
            return datos && typeof datos.id === "string" && datos.id ? datos : null;
        } catch (error) {
            return null;
        }
    }

    function guardarImpresora(nuevo) {
        try {
            localStorage.setItem(CLAVE_IMPRESORA, JSON.stringify({
                id: nuevo.id,
                nombre: String(nuevo.name || "Impresora")
            }));
        } catch (error) {
            console.error("No se pudo guardar la impresora.", error);
        }
    }

    function usarDispositivo(nuevo) {
        if (dispositivo === nuevo) return;
        if (dispositivo && dispositivo.gatt && dispositivo.gatt.connected) dispositivo.gatt.disconnect();

        dispositivo = nuevo;
        caracteristica = null;
        nuevo.addEventListener("gattserverdisconnected", () => {
            if (dispositivo === nuevo) caracteristica = null;
        });
    }

    // La impresora guardada, si Chrome deja usarla sin elegirla de nuevo.
    async function buscarGuardada() {
        if (dispositivo) return dispositivo;

        const datos = impresoraGuardada();
        if (!datos || typeof navigator.bluetooth.getDevices !== "function") return null;

        try {
            const conocidos = await navigator.bluetooth.getDevices();
            return conocidos.find(item => item.id === datos.id) || null;
        } catch (error) {
            return null;
        }
    }

    // Lista de Chrome para elegir la impresora.
    function elegirDeLaLista() {
        return navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: "MTP" }].concat(SERVICIOS.map(servicio => ({ services: [servicio] }))),
            optionalServices: SERVICIOS
        });
    }

    function conTiempo(promesa, milisegundos) {
        let espera = 0;
        return Promise.race([
            promesa,
            new Promise((_, rechazar) => {
                espera = setTimeout(() => rechazar(errorDeImpresion("noEncontrada", "La impresora no respondió.")), milisegundos);
            })
        ]).finally(() => clearTimeout(espera));
    }

    function errorDeImpresion(codigo, mensaje) {
        const error = new Error(mensaje);
        error.codigo = codigo;
        return error;
    }

    // Conecta y busca dónde escribir.
    async function conectar(objetivo) {
        usarDispositivo(objetivo);
        if (caracteristica && objetivo.gatt.connected) return caracteristica;

        let servidor;
        try {
            servidor = await conTiempo(objetivo.gatt.connect(), ESPERA_CONEXION);
        } catch (error) {
            if (objetivo.gatt.connected) objetivo.gatt.disconnect();
            throw errorDeImpresion("noEncontrada", "No se pudo conectar con la impresora.");
        }

        for (const uuid of SERVICIOS) {
            let servicio;
            try {
                servicio = await servidor.getPrimaryService(uuid);
            } catch (error) {
                continue;
            }

            const lista = await servicio.getCharacteristics();
            const elegida = lista.find(item => item.properties.write) ||
                lista.find(item => item.properties.writeWithoutResponse);
            if (elegida) {
                caracteristica = elegida;
                return elegida;
            }
        }

        objetivo.gatt.disconnect();
        throw errorDeImpresion("sinServicio", "Esa impresora no tiene dónde recibir el ticket.");
    }

    function esperar(milisegundos) {
        return new Promise(resolver => setTimeout(resolver, milisegundos));
    }

    // Manda el ticket de a 20 bytes. Con respuesta si la impresora la da
    // (no se pierde nada); si no, con una pausa corta entre trozos.
    async function escribir(destino, bytes) {
        try {
            for (let inicio = 0; inicio < bytes.length; inicio += TROZO) {
                const trozo = bytes.slice(inicio, inicio + TROZO);
                if (destino.properties.write) {
                    if (typeof destino.writeValueWithResponse === "function") await destino.writeValueWithResponse(trozo);
                    else await destino.writeValue(trozo);
                } else {
                    await destino.writeValueWithoutResponse(trozo);
                    await esperar(20);
                }
            }
        } catch (error) {
            console.error("Se cortó la impresión.", error);
            throw errorDeImpresion("corte", "Se cortó la conexión con la impresora.");
        }
    }

    // -------------------------------------------------
    // Texto del ticket
    // -------------------------------------------------

    function codificar(texto) {
        const bytes = [];
        for (const letra of String(texto)) {
            const cambio = REEMPLAZOS[letra];
            if (cambio !== undefined) {
                for (const otra of cambio) bytes.push(otra.charCodeAt(0));
                continue;
            }

            const codigo = letra.codePointAt(0);
            if (codigo >= 0x20 && codigo < 0x7f) bytes.push(codigo);
            else if (TABLA[letra]) bytes.push(TABLA[letra]);
            else {
                // Otras letras con tilde: sin la tilde. Lo demás, "?".
                const simple = letra.normalize("NFD").replace(/[̀-ͯ]/g, "");
                const base = simple.codePointAt(0);
                bytes.push(simple.length === 1 && base >= 0x20 && base < 0x7f ? base : 0x3f);
            }
        }
        return bytes;
    }

    // Parte un texto en líneas de hasta "ancho" letras, por palabras.
    function partir(texto, ancho) {
        const lineas = [];
        String(texto || "").split(/\r?\n/).forEach(parrafo => {
            let actual = "";
            parrafo.split(/\s+/).filter(Boolean).forEach(palabra => {
                while (palabra.length > ancho) {
                    if (actual) {
                        lineas.push(actual);
                        actual = "";
                    }
                    lineas.push(palabra.slice(0, ancho));
                    palabra = palabra.slice(ancho);
                }
                if (!palabra) return;

                if (!actual) actual = palabra;
                else if (actual.length + 1 + palabra.length <= ancho) actual += " " + palabra;
                else {
                    lineas.push(actual);
                    actual = palabra;
                }
            });
            lineas.push(actual);
        });
        return lineas;
    }

    // Texto a la izquierda (con sangría, si se pide) y monto a la derecha;
    // si no entran juntos, el monto va en la línea siguiente.
    function dosColumnas(izquierda, derecha, sangria) {
        const margen = sangria || "";
        const lineas = partir(izquierda, ANCHO - margen.length).map(texto => margen + texto);
        const ultima = lineas[lineas.length - 1] || "";
        if (ultima.length + 1 + derecha.length <= ANCHO) {
            lineas[lineas.length - 1] = ultima + " ".repeat(ANCHO - ultima.length - derecha.length) + derecha;
        } else {
            lineas.push(" ".repeat(Math.max(0, ANCHO - derecha.length)) + derecha);
        }
        return lineas;
    }

    function dosDigitos(numero) {
        return String(numero).padStart(2, "0");
    }

    function textoFechaHora(hora) {
        const fecha = new Date(hora);
        if (!hora || Number.isNaN(fecha.getTime())) return "";
        return dosDigitos(fecha.getDate()) + "/" + dosDigitos(fecha.getMonth() + 1) + "/" + fecha.getFullYear() +
            " " + dosDigitos(fecha.getHours()) + ":" + dosDigitos(fecha.getMinutes());
    }

    function textoPrecio(valor) {
        return "$ " + Number(valor || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
    }

    function nombrePersona(persona) {
        const nombre = String(persona && persona.nombre || "").trim();
        if (nombre) return nombre;
        return persona && persona.idPersona === "dueno" ? "El dueño" : "Un empleado";
    }

    // Lo que va en el ticket: cantidades según el estado (lo pedido; desde
    // "Preparado", lo preparado; desde "Entregado", lo entregado) y el cobro.
    function datosDelTicket(pedido) {
        const nube = window.nubeVendeFrio;
        const estado = estadoActualDelPedido(pedido);
        const campo = estado === "entregado" ? "entregada" : ESTADOS_PREPARADOS.includes(estado) ? "preparada" : "pedida";
        const entrega = nube.entregaDelPedido(pedido);
        const total = { total: 0, conPrecio: 0, sinPrecio: 0 };
        const marcas = [];

        entrega.lineas.forEach(linea => {
            const item = linea.item;
            const cantidad = linea[campo];
            const precio = item.precio === null || item.precio === undefined ? NaN : Number(item.precio);

            if (Number.isFinite(precio)) {
                total.total += precio * cantidad;
                total.conPrecio += 1;
            } else {
                total.sinPrecio += 1;
            }

            const marca = String(item.marca || "Sin marca").trim() || "Sin marca";
            let grupo = marcas.find(actual => actual.marca === marca);
            if (!grupo) {
                grupo = { marca, items: [] };
                marcas.push(grupo);
            }
            grupo.items.push({
                nombre: String(item.producto || "Sin producto"),
                cantidad,
                pedida: linea.pedida,
                precio
            });
        });

        const comercio = typeof buscarComercioPorNombre === "function" ? buscarComercioPorNombre(pedido.comercio) : null;

        return {
            estado,
            direccion: String(comercio && comercio.direccion || "").trim(),
            telefono: String(comercio && comercio.telefono || "").trim(),
            marcas,
            total,
            unidades: entrega.lineas.reduce((suma, linea) => suma + linea[campo], 0),
            productos: entrega.lineas.length,
            cobro: estado === "entregado" ? nube.textoDelCobro(nube.cobroDelPedido(pedido)) : ""
        };
    }

    // Una copia del ticket, en bytes ESC/POS.
    function copiaDelTicket(pedido, datos, titulo, impreso) {
        const bytes = [];
        const agregar = comandos => comandos.forEach(byte => bytes.push(byte));
        const linea = texto => {
            agregar(codificar(texto));
            bytes.push(SALTO);
        };
        const separador = () => linea("-".repeat(ANCHO));

        const distribuidora = String(window.distribuidoraVendeFrio?.nombreActual?.() || "").trim() || "VendeFrío";
        const numero = numeroCortoDelPedido(pedido);
        const hora = Number(pedido.timestamp) || 0;

        agregar(CENTRO);
        agregar(NEGRITA);
        agregar(DOBLE_ALTO);
        partir(distribuidora, ANCHO).forEach(linea);
        agregar(TAMANO_NORMAL);
        linea(titulo);
        agregar(SIN_NEGRITA);
        agregar(IZQUIERDA);
        separador();

        agregar(NEGRITA);
        linea("Pedido N° " + numero);
        agregar(SIN_NEGRITA);
        partir("Comercio: " + String(pedido.comercio || "SIN NOMBRE").trim(), ANCHO).forEach(linea);
        // Dirección y teléfono del comercio, solo si están cargados.
        if (datos.direccion) partir("Dirección: " + datos.direccion, ANCHO).forEach(linea);
        if (datos.telefono) partir("Teléfono: " + datos.telefono, ANCHO).forEach(linea);
        linea("Fecha: " + (textoFechaHora(hora) || String(pedido.fecha || "Sin fecha")));
        partir("Cargado por: " + nombrePersona(pedido.autor), ANCHO).forEach(linea);
        linea("Estado: " + (nombreDeEstadoPedido(datos.estado) || datos.estado));
        separador();

        // La marca en negrita y de doble alto, para agrupar los productos. La
        // cantidad, de doble alto (sin negrita). El doble alto no cambia el
        // ancho de las letras, así que las columnas siguen alineadas.
        datos.marcas.forEach(grupo => {
            agregar(NEGRITA);
            agregar(DOBLE_ALTO);
            partir(grupo.marca, ANCHO).forEach(linea);
            agregar(TAMANO_NORMAL);
            agregar(SIN_NEGRITA);

            grupo.items.forEach(item => {
                partir(item.nombre, ANCHO).forEach(linea);
                const cantidad = String(item.cantidad);
                const detalle = cantidad + " x " + (Number.isFinite(item.precio) ? textoPrecio(item.precio) : "Sin precio") +
                    (item.cantidad !== item.pedida ? " (pedido " + item.pedida + ")" : "");
                const subtotal = Number.isFinite(item.precio) ? textoPrecio(item.precio * item.cantidad) : "-";
                dosColumnas(detalle, subtotal, "  ").forEach((texto, posicion) => {
                    const inicio = "  " + cantidad;
                    if (posicion > 0 || !texto.startsWith(inicio)) {
                        linea(texto);
                        return;
                    }
                    agregar(codificar("  "));
                    agregar(DOBLE_ALTO);
                    agregar(codificar(cantidad));
                    agregar(TAMANO_NORMAL);
                    linea(texto.slice(inicio.length));
                });
            });
        });
        separador();

        linea("Unidades: " + datos.unidades + " · " + datos.productos + (datos.productos === 1 ? " producto" : " productos"));
        agregar(NEGRITA);
        agregar(DOBLE_ALTO);
        dosColumnas("TOTAL", datos.total.conPrecio ? textoPrecio(datos.total.total) : "Sin precio").forEach(linea);
        agregar(TAMANO_NORMAL);
        agregar(SIN_NEGRITA);
        if (datos.total.conPrecio && datos.total.sinPrecio) {
            linea("(" + datos.total.sinPrecio + " sin precio)");
        }

        if (datos.cobro) partir("Cobro: " + datos.cobro, ANCHO).forEach(linea);

        const observaciones = String(pedido.observaciones || "").trim();
        if (observaciones) {
            separador();
            agregar(NEGRITA);
            linea("Observaciones:");
            agregar(SIN_NEGRITA);
            partir(observaciones, ANCHO).forEach(linea);
        }

        separador();
        agregar(CENTRO);
        linea("Documento no válido como factura");
        linea("Impreso: " + impreso);
        agregar(IZQUIERDA);

        return bytes;
    }

    // Las dos copias con la línea para cortar entre las dos, o solo la del
    // comercio (copias = 1).
    function armarTicket(pedido, copias) {
        const datos = datosDelTicket(pedido);
        const impreso = textoFechaHora(Date.now());
        const bytes = [].concat(INICIAR, SALIR_MODO_CHINO, TABLA_850);

        bytes.push(...copiaDelTicket(pedido, datos, "COPIA COMERCIO", impreso));
        if (copias !== 1) {
            bytes.push(SALTO, SALTO, SALTO);
            bytes.push(...codificar("- ".repeat(ANCHO / 2)), SALTO);
            bytes.push(SALTO, SALTO);
            bytes.push(...copiaDelTicket(pedido, datos, "COPIA DISTRIBUIDORA", impreso));
        }
        bytes.push(SALTO, SALTO, SALTO, SALTO, SALTO);

        return new Uint8Array(bytes);
    }

    // -------------------------------------------------
    // Ventana de error, con "Reintentar" o "Elegir de la lista"
    // -------------------------------------------------

    let alReintentar = null;

    function crearModal() {
        let modal = document.getElementById("modalImpresion");
        if (modal) return modal;

        modal = document.createElement("div");
        modal.id = "modalImpresion";
        modal.className = "modal oculto";
        modal.innerHTML = `
            <div class="modalContenido impresionPedido" role="dialog" aria-modal="true" aria-labelledby="tituloImpresion">
                <h2 id="tituloImpresion"></h2>
                <p id="mensajeImpresion" class="explicacionTextoPedido"></p>
                <div class="modalBotones">
                    <button type="button" class="btnModalSecundario" id="cerrarImpresion">Cerrar</button>
                    <button type="button" class="btnModalConfirmar" id="reintentarImpresion">Reintentar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const cerrar = () => {
            alReintentar = null;
            modal.classList.add("oculto");
        };
        document.getElementById("cerrarImpresion").addEventListener("click", cerrar);
        modal.addEventListener("click", evento => {
            if (evento.target === modal) cerrar();
        });
        document.getElementById("reintentarImpresion").addEventListener("click", () => {
            const accion = alReintentar;
            cerrar();
            if (accion) accion();
        });

        return modal;
    }

    function abrirModal({ titulo, mensaje, boton, accion }) {
        const modal = crearModal();
        document.getElementById("tituloImpresion").textContent = titulo;
        document.getElementById("mensajeImpresion").textContent = mensaje;
        document.getElementById("reintentarImpresion").textContent = boton;
        alReintentar = accion;
        modal.classList.remove("oculto");
    }

    function esCancelacion(error) {
        return error && error.name === "NotFoundError" && /cancel/i.test(String(error.message || ""));
    }

    function mostrarError(error, idPedido, copias) {
        if (esCancelacion(error)) return;

        const nombre = impresoraGuardada()?.nombre || "la impresora";

        if (error && error.codigo === "noEncontrada") {
            abrirModal({
                titulo: "No se encontró la impresora",
                mensaje: "No se pudo conectar con " + nombre + ". Revisá que esté prendida, con papel y cerca del celular. También podés elegirla de la lista.",
                boton: "Elegir de la lista",
                accion: () => imprimirPedido(idPedido, { elegir: true, copias })
            });
            return;
        }

        if (error && error.codigo === "corte") {
            abrirModal({
                titulo: "Se cortó la impresión",
                mensaje: "Se perdió la conexión con " + nombre + " y puede haber salido solo una parte del ticket. Revisá que esté prendida y cerca, y volvé a intentar.",
                boton: "Reintentar",
                accion: () => imprimirPedido(idPedido, { copias })
            });
            return;
        }

        if (error && error.codigo === "sinServicio") {
            abrirModal({
                titulo: "No se pudo imprimir",
                mensaje: "Esa impresora no recibe tickets de VendeFrío. Elegí la impresora térmica (por ejemplo, MTP-3).",
                boton: "Elegir de la lista",
                accion: () => imprimirPedido(idPedido, { elegir: true, copias })
            });
            return;
        }

        if (error && error.codigo === "pedido") {
            mostrarAviso("No se pudo imprimir", error.message);
            return;
        }

        // Sin Bluetooth prendido, o la lista no se pudo abrir (por ejemplo,
        // pasó mucho tiempo desde que se tocó el botón).
        console.error("No se pudo imprimir el ticket.", error);
        abrirModal({
            titulo: "No se pudo imprimir",
            mensaje: "Revisá que el Bluetooth del celular esté prendido y que la impresora esté cerca, y volvé a intentar.",
            boton: "Reintentar",
            accion: () => imprimirPedido(idPedido, { elegir: !impresoraGuardada(), copias })
        });
    }

    // -------------------------------------------------
    // Cuántas copias: las dos o solo la del comercio
    // -------------------------------------------------
    // Se abre al tocar "Imprimir ticket" y, como pregunta ("¿Imprimir el
    // ticket?" con "Ahora no"), al terminar de armar el pedido. Tocar una
    // opción imprime enseguida: Chrome deja abrir su lista de impresoras
    // solo justo después de tocar un botón.

    let idCopias = "";

    function crearModalCopias() {
        let modal = document.getElementById("modalCopiasTicket");
        if (modal) return modal;

        modal = document.createElement("div");
        modal.id = "modalCopiasTicket";
        modal.className = "modal oculto";
        modal.innerHTML = `
            <div class="modalContenido copiasTicket" role="dialog" aria-modal="true" aria-labelledby="tituloCopiasTicket">
                <h2 id="tituloCopiasTicket"></h2>
                <p id="mensajeCopiasTicket" class="explicacionTextoPedido"></p>
                <div class="opcionesCopias">
                    <button type="button" class="opcionCopias" data-copias="2">
                        <strong>Dos copias</strong><small>Comercio y distribuidora</small>
                    </button>
                    <button type="button" class="opcionCopias" data-copias="1">
                        <strong>Una copia</strong><small>Solo la del comercio</small>
                    </button>
                </div>
                <div class="modalBotones">
                    <button type="button" class="btnModalSecundario" id="cerrarCopiasTicket">Cancelar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById("cerrarCopiasTicket").addEventListener("click", cerrarCopias);
        modal.addEventListener("click", evento => {
            if (evento.target === modal) {
                cerrarCopias();
                return;
            }

            const opcion = evento.target.closest(".opcionCopias");
            if (!opcion) return;

            const id = idCopias;
            cerrarCopias();
            if (id) imprimirPedido(id, { copias: Number(opcion.dataset.copias) === 1 ? 1 : 2 });
        });

        return modal;
    }

    function cerrarCopias() {
        idCopias = "";
        const modal = document.getElementById("modalCopiasTicket");
        if (modal) modal.classList.add("oculto");
    }

    function buscarPedido(id) {
        return obtenerHistorial().find(item => String(item.id || "") === String(id || "")) || null;
    }

    function elegirCopias(idPedido, opciones) {
        const pedido = buscarPedido(idPedido);
        if (imprimiendo || !puedeImprimir(pedido)) return false;

        const pregunta = Boolean(opciones && opciones.pregunta);
        const modal = crearModalCopias();
        idCopias = String(pedido.id);
        document.getElementById("tituloCopiasTicket").textContent = pregunta ? "¿Imprimir el ticket?" : "Imprimir ticket";
        document.getElementById("mensajeCopiasTicket").textContent =
            String(pedido.comercio || "SIN NOMBRE").trim() + "  ·  Pedido N° " + numeroCortoDelPedido(pedido);
        document.getElementById("cerrarCopiasTicket").textContent = pregunta ? "Ahora no" : "Cancelar";
        modal.classList.remove("oculto");
        return true;
    }

    // Al terminar de armar el pedido: pregunta solo si se puede imprimir
    // (nube y Web Bluetooth).
    function preguntarSiImprimir(idPedido) {
        return elegirCopias(idPedido, { pregunta: true });
    }

    // -------------------------------------------------
    // Imprimir
    // -------------------------------------------------

    // Imprime el ticket del pedido: las dos copias o, con copias: 1, solo
    // la del comercio. Con elegir, abre la lista de Chrome aunque haya una
    // impresora guardada.
    async function imprimirPedido(idPedido, opciones) {
        const id = String(idPedido || "");
        const copias = opciones && opciones.copias === 1 ? 1 : 2;
        if (imprimiendo || !hayBluetooth()) return;

        const pedido = buscarPedido(id);
        if (!puedeImprimir(pedido)) {
            mostrarError(errorDeImpresion("pedido", "Este pedido ya no se puede imprimir."), id, copias);
            return;
        }

        // El ticket se arma con lo que se ve ahora (antes de conectar).
        const bytes = armarTicket(pedido, copias);
        const elegir = Boolean(opciones && opciones.elegir);

        imprimiendo = id;
        avisar();

        try {
            let objetivo = elegir ? null : await buscarGuardada();
            let destino = null;

            if (objetivo) {
                destino = await conectar(objetivo);
            } else {
                // La lista de Chrome solo se abre justo después de tocar un
                // botón: va antes de cualquier espera larga.
                objetivo = await elegirDeLaLista();
                guardarImpresora(objetivo);
                destino = await conectar(objetivo);
            }

            await escribir(destino, bytes);
            mostrarToast("Ticket impreso");
        } catch (error) {
            mostrarError(error, id, copias);
        } finally {
            imprimiendo = "";
            avisar();
        }
    }

    // Configuración > Impresora: elegir otra de la lista (no imprime).
    async function cambiarImpresora() {
        if (!hayBluetooth()) return false;

        try {
            const nuevo = await elegirDeLaLista();
            guardarImpresora(nuevo);
            usarDispositivo(nuevo);
            avisar();
            return true;
        } catch (error) {
            if (!esCancelacion(error)) {
                console.error("No se pudo elegir la impresora.", error);
                mostrarAviso("No se pudo elegir la impresora", "Revisá que el Bluetooth del celular esté prendido y volvé a intentar.");
            }
            return false;
        }
    }

    window.impresionVendeFrio = {
        disponible,
        puedeImprimir,
        imprimirPedido,
        elegirCopias,
        preguntarSiImprimir,
        imprimiendo: () => imprimiendo,
        impresoraGuardada,
        cambiarImpresora,
        escuchar(oyente) {
            if (typeof oyente !== "function") return () => {};
            oyentes.push(oyente);
            return () => {
                const indice = oyentes.indexOf(oyente);
                if (indice >= 0) oyentes.splice(indice, 1);
            };
        },
        // Para probar sin impresora: los bytes del ticket.
        armarTicket(idPedido, copias) {
            const pedido = buscarPedido(idPedido);
            return pedido && puedeImprimir(pedido) ? armarTicket(pedido, copias === 1 ? 1 : 2) : null;
        }
    };
})();
