// VendeFrío - Saldo por comercio y recordatorio (T74) y recibo de pago (T75).
// "A cobrar" agrupado por comercio, con tope de deuda (ficha > datos), pagos
// parciales, "Debe" en la ficha y al cargar un pedido, y recordatorio por
// WhatsApp. Un pago se aplica a los pedidos más viejos: los que cubre
// enteros quedan cobrados; lo que sobra queda como pago parcial del
// siguiente (`pagos/`). Al registrar un pago se ve el recibo para mandar por
// WhatsApp o imprimir.
(function () {
    "use strict";

    const p = window.piezas;
    const extras = window.extrasVendeFrio;

    extras.registrar("pagos", {
        dias: 400,
        describir: pago => ({ titulo: "Pago parcial", nombre: pago.comercio || "", detalle: p.plata(pago.monto) })
    });

    const normal = texto => String(texto || "").trim().toLocaleLowerCase("es");

    function pagadoDe(idPedido) {
        return extras.lista("pagos").filter(pago => String(pago.idPedido) === String(idPedido))
            .reduce((suma, pago) => suma + (Number(pago.monto) || 0), 0);
    }

    function nube() {
        return window.nubeVendeFrio;
    }

    function horaEntrega(pedido) {
        return Number(pedido && pedido.entrega && pedido.entrega.horaCelular) || Number(pedido && pedido.timestamp) || 0;
    }

    // Los pedidos entregados sin cobrar, agrupados por comercio.
    function cuentas() {
        if (!nube() || typeof obtenerHistorial !== "function") return [];
        const grupos = {};
        obtenerHistorial().forEach(pedido => {
            if (!nube().cobroPendiente(pedido)) return;
            const falta = Math.max(0, nube().montoACobrar(pedido));
            const nombre = String(pedido.comercio || "Sin comercio");
            const clave = normal(nombre);
            if (!grupos[clave]) grupos[clave] = { nombre, pedidos: [], total: 0 };
            grupos[clave].pedidos.push(pedido);
            grupos[clave].total += falta;
        });
        return Object.values(grupos).map(grupo => {
            grupo.pedidos.sort((a, b) => horaEntrega(a) - horaEntrega(b));
            grupo.comercio = typeof buscarComercioPorNombre === "function" ? buscarComercioPorNombre(grupo.nombre) : null;
            grupo.tope = Number(grupo.comercio && grupo.comercio.topeDeuda) || 0;
            grupo.pasoTope = grupo.tope > 0 && grupo.total > grupo.tope;
            grupo.desde = horaEntrega(grupo.pedidos[0]);
            return grupo;
        }).sort((a, b) => Number(b.pasoTope) - Number(a.pasoTope) || b.total - a.total);
    }

    function cuentaDe(nombre) {
        return cuentas().find(grupo => normal(grupo.nombre) === normal(nombre)) || null;
    }

    function textoAntiguedad(hora) {
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const dia = new Date(hora); dia.setHours(0, 0, 0, 0);
        const dias = Math.round((hoy - dia) / 86400000);
        if (dias <= 0) return "Hoy";
        if (dias === 1) return "Ayer";
        return "Hace " + dias + " días";
    }

    const textoPedidos = n => n + (n === 1 ? " pedido" : " pedidos");

    // ---------- "A cobrar" por comercio ----------
    function abrirPantalla() {
        const seccion = p.pantalla("pantallaACobrar", { titulo: "A cobrar", sub: "Lo que te deben, por comercio", icono: "moneda", volverA: "menu" });
        p.mostrar(seccion);
        dibujarPantalla();
    }

    // T113: filtro elegido en "A cobrar" (Todos, De mi ruta hoy, Más viejos).
    let filtroACobrar = "todos";
    const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    function diasDesde(hora) {
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const dia = new Date(hora); dia.setHours(0, 0, 0, 0);
        return Math.max(0, Math.round((hoy - dia) / 86400000));
    }

    // Comercios de la ruta de hoy: la ruta armada en Rutas o su día de visita.
    function esDeMiRutaHoy(grupo) {
        const enRuta = typeof rutaOrdenada !== "undefined" && Array.isArray(rutaOrdenada) &&
            rutaOrdenada.some(comercio => normal(comercio && comercio.nombre) === normal(grupo.nombre));
        const hoy = DIAS[new Date().getDay()];
        return enRuta || normal(grupo.comercio && grupo.comercio.diaVisita) === normal(hoy);
    }

    function chipAntiguedad(grupo) {
        if (grupo.pasoTope) return `<span class="pzChip pzChipPeligro">Pasó el tope</span>`;
        const dias = diasDesde(grupo.desde);
        const clase = dias > 15 ? "pzChipPeligro" : dias > 7 ? "pzChipAviso" : "pzChipGris";
        return `<span class="pzChip ${clase}">${textoAntiguedad(grupo.desde)}</span>`;
    }

    function cuentasFiltradas(lista) {
        if (filtroACobrar === "ruta") return lista.filter(esDeMiRutaHoy);
        if (filtroACobrar === "viejos") return lista.slice().sort((a, b) => a.desde - b.desde);
        return lista;
    }

    function dibujarPantalla() {
        const seccion = document.getElementById("pantallaACobrar");
        if (!seccion || seccion.classList.contains("oculto")) return;
        const todas = cuentas();
        const lista = cuentasFiltradas(todas);
        const total = todas.reduce((suma, grupo) => suma + grupo.total, 0);
        const pedidos = todas.reduce((suma, grupo) => suma + grupo.pedidos.length, 0);
        const conWhatsapp = todas.filter(grupo => enlaceRecordatorio(grupo));
        const filas = lista.map(grupo => {
            const dias = diasDesde(grupo.desde);
            const tono = grupo.pasoTope || dias > 15 ? "rojo" : dias > 7 ? "naranja" : "";
            const sub = textoPedidos(grupo.pedidos.length) + (grupo.tope ? " · tope " + p.plata(grupo.tope) : "");
            const wa = enlaceRecordatorio(grupo);
            return `<div class="filaACobrar" ${tono ? `data-tono="${tono}"` : ""}>
                <button type="button" class="pzFila" data-cuenta="${p.esc(grupo.nombre)}">
                    <div class="pzIni ${p.colorIni(grupo.nombre)}">${p.esc(p.iniciales(grupo.nombre))}</div>
                    <div class="pzFilaTxt"><strong>${p.esc(grupo.nombre)}</strong><small>${p.esc(sub)}</small></div>
                    <div class="pzFilaDer"><b class="${tono === "rojo" ? "pzMontoNegativo" : ""}">${p.plata(grupo.total)}</b>${chipAntiguedad(grupo)}</div>
                </button>
                ${wa ? `<button type="button" class="botonWaACobrar" data-recordar="${p.esc(grupo.nombre)}" aria-label="Mandar recordatorio a ${p.esc(grupo.nombre)}">${p.ico("whatsapp", 20)}</button>` : ""}
            </div>`;
        }).join("");
        const filtros = [["todos", "Todos"], ["ruta", "De mi ruta hoy"], ["viejos", "Más viejos"]]
            .map(([clave, texto]) => `<button type="button" data-filtro-cobrar="${clave}" aria-pressed="${filtroACobrar === clave}">${texto}</button>`).join("");
        const vacio = filtroACobrar === "ruta" && todas.length
            ? "Nadie de tu ruta de hoy te debe."
            : "No te deben nada. ¡Bien!";
        seccion.querySelector("main").innerHTML = `<div class="pzTarjeta pzRelleno pzTotalGrande">
                <small>Te deben en total</small>
                <strong>${p.plata(total)}</strong>
                <span>${textoPedidos(pedidos)} · ${todas.length} ${todas.length === 1 ? "comercio" : "comercios"}</span>
            </div>
            ${todas.length ? `<div class="pzSegmentos filtrosACobrar" role="group" aria-label="Filtrar">${filtros}</div>` : ""}
            <div class="pzTarjeta pzLista">${filas || `<div class="pzVacio">${vacio}</div>`}</div>
            ${conWhatsapp.length > 1 ? `<button type="button" class="pzBtn pzBtnSec recordarATodos" data-recordar-todos>${p.ico("whatsapp", 20)}Recordarles a todos (${conWhatsapp.length})</button>` : ""}`;
        seccion.querySelector("main").onclick = evento => {
            const filtro = evento.target.closest("[data-filtro-cobrar]");
            if (filtro) { filtroACobrar = filtro.dataset.filtroCobrar; dibujarPantalla(); return; }
            const wa = evento.target.closest("[data-recordar]");
            if (wa) { const grupo = cuentaDe(wa.dataset.recordar); if (grupo) recordar(grupo); return; }
            if (evento.target.closest("[data-recordar-todos]")) { recordarATodos(); return; }
            const fila = evento.target.closest("[data-cuenta]");
            if (fila) opcionesCuenta(fila.dataset.cuenta);
        };
    }

    // "Recordarles a todos": WhatsApp abre de a uno, así que se mandan en fila.
    function recordarATodos() {
        const lista = cuentas().filter(grupo => enlaceRecordatorio(grupo));
        const enviados = new Set();
        const filas = () => lista.map(grupo => `<div class="pzFila">
                <div class="pzFilaTxt"><strong>${p.esc(grupo.nombre)}</strong><small>Debe ${p.plata(grupo.total)} · ${textoAntiguedad(grupo.desde).toLowerCase()}</small></div>
                ${enviados.has(grupo.nombre)
                    ? `<span class="pzChip pzChipOk">Enviado</span>`
                    : `<button type="button" class="pzBtn pzBtnSec botonEnviarRecordatorio" data-enviar-recordatorio="${p.esc(grupo.nombre)}">Enviar</button>`}
            </div>`).join("");
        const caja = p.hoja({
            titulo: "Recordarles a todos",
            sub: "Tocá «Enviar» en cada uno. Se abre WhatsApp con el mensaje listo.",
            html: `<div class="pzTarjeta pzLista listaRecordatorios">${filas()}</div>`,
            botones: [{ texto: "Listo", clase: "pzBtnGris" }]
        });
        caja.addEventListener("click", evento => {
            const boton = evento.target.closest("[data-enviar-recordatorio]");
            if (!boton) return;
            const grupo = lista.find(item => item.nombre === boton.dataset.enviarRecordatorio);
            if (!grupo) return;
            recordar(grupo);
            enviados.add(grupo.nombre);
            caja.querySelector(".listaRecordatorios").innerHTML = filas();
        });
    }

    function opcionesCuenta(nombre) {
        const grupo = cuentaDe(nombre);
        if (!grupo) return;
        const sub = "Debe " + p.plata(grupo.total) + (grupo.pasoTope ? " · pasó el tope de " + p.plata(grupo.tope) : (grupo.tope ? " · tope " + p.plata(grupo.tope) : ""));
        const telefono = window.yaLlegoVendeFrio && grupo.comercio ? grupo.comercio.telefono : "";
        const puedeCobrar = nube().puedeCobrar();
        const caja = p.hoja({
            titulo: grupo.nombre,
            sub,
            html: `<div class="pzOpciones">
                ${telefono ? `<button type="button" class="pzOpcion pzOpcionWa" data-opcion="recordar">${p.ico("whatsapp", 22)}Mandar recordatorio por WhatsApp</button>` : ""}
                ${puedeCobrar ? `<button type="button" class="pzOpcion" data-opcion="pago">${p.ico("moneda", 22)}Registrar un pago</button>` : ""}
                ${puedeCobrar && window.cobrarQrVendeFrio?.hay() ? `<button type="button" class="pzOpcion" data-opcion="qr">${p.ico("qr", 22)}Cobrar con alias o QR</button>` : ""}
                <button type="button" class="pzOpcion" data-opcion="cuenta">${p.ico("recibo", 22)}Ver la cuenta completa</button>
            </div>`
        });
        caja.addEventListener("click", evento => {
            const opcion = evento.target.closest("[data-opcion]")?.dataset.opcion;
            if (!opcion) return;
            p.cerrar();
            if (opcion === "recordar") recordar(grupo);
            if (opcion === "pago") registrarPago(grupo.nombre);
            if (opcion === "cuenta") verCuenta(grupo.nombre);
            if (opcion === "qr") {
                window.cobrarQrVendeFrio.mostrar({
                    comercio: grupo.nombre,
                    monto: grupo.total,
                    alConfirmar: () => {
                        const recibo = aplicarPago(grupo, grupo.total, "transferencia");
                        if (recibo) setTimeout(() => mostrarRecibo(recibo), 200);
                    }
                });
            }
        });
    }

    // ---------- Recordatorio por WhatsApp ----------
    function textoRecordatorio(grupo) {
        const contacto = String(grupo.comercio && grupo.comercio.contacto || "").trim().split(/\s+/)[0];
        const fechas = grupo.pedidos.map(pedido => {
            const d = new Date(horaEntrega(pedido));
            return d.getDate() + "/" + (d.getMonth() + 1);
        });
        const unicas = [...new Set(fechas)];
        const listaFechas = unicas.length > 1 ? unicas.slice(0, -1).join(", ") + " y " + unicas[unicas.length - 1] : unicas[0];
        const distribuidora = window.distribuidoraVendeFrio?.nombreActual?.() || "";
        return "¡Hola" + (contacto ? " " + contacto : "") + "! " + (distribuidora ? "Te escribo de " + distribuidora + ". " : "") +
            "Te recuerdo que quedó pendiente " + p.plata(grupo.total) + " de " + (grupo.pedidos.length === 1 ? "el pedido del " : "los pedidos del ") + listaFechas + ". " +
            "Cuando puedas, avisame. ¡Gracias!";
    }

    function enlaceRecordatorio(grupo) {
        const base = window.yaLlegoVendeFrio ? window.yaLlegoVendeFrio.enlace(grupo.comercio || {}, 0) : "";
        if (!base) return "";
        return base.split("?")[0] + "?text=" + encodeURIComponent(textoRecordatorio(grupo));
    }

    function recordar(grupo) {
        const enlace = enlaceRecordatorio(grupo);
        if (enlace) window.open(enlace, "_blank", "noopener");
    }

    // ---------- Registrar un pago ----------
    function registrarPago(nombre) {
        const grupo = cuentaDe(nombre);
        if (!grupo) return;
        let forma = "efectivo";
        const caja = p.hoja({
            titulo: "Registrar un pago",
            sub: grupo.nombre + " · debe " + p.plata(grupo.total),
            etiqueta: "Registrar un pago",
            html: `<label class="pzCampo"><span>¿Cuánto pagó?</span><input id="montoPago" type="number" inputmode="decimal" min="1" step="1" value="${Math.round(grupo.total)}"></label>
                <div class="pzSegmentos pzEnHoja" role="group" aria-label="Cómo pagó">
                    <button type="button" data-forma="efectivo" aria-pressed="true">Efectivo</button>
                    <button type="button" data-forma="transferencia" aria-pressed="false">Transferencia</button>
                </div>
                <p class="pzHojaSub">Se aplica a los pedidos más viejos primero. Si no alcanza para uno, queda como pago parcial.</p>`,
            botones: [{
                texto: "Guardar pago",
                icono: "check",
                alTocar: caja => {
                    const monto = Math.round(Number(String(caja.querySelector("#montoPago").value).replace(",", ".")) * 100) / 100;
                    if (!Number.isFinite(monto) || monto <= 0) {
                        mostrarToast("Escribí cuánto pagó");
                        return false;
                    }
                    if (monto > grupo.total + 0.009) {
                        mostrarToast("Es más de lo que debe (" + p.plata(grupo.total) + ")");
                        return false;
                    }
                    const recibo = aplicarPago(grupo, monto, forma);
                    if (!recibo) return false;
                    setTimeout(() => mostrarRecibo(recibo), 200);
                    return true;
                }
            }]
        });
        caja.querySelectorAll("[data-forma]").forEach(boton => boton.addEventListener("click", () => {
            forma = boton.dataset.forma;
            caja.querySelectorAll("[data-forma]").forEach(otro => otro.setAttribute("aria-pressed", String(otro === boton)));
        }));
    }

    function aplicarPago(grupo, monto, forma) {
        let resto = monto;
        const aplicados = [];
        try {
            for (const pedido of grupo.pedidos) {
                if (resto <= 0.009) break;
                const falta = Math.round(Math.max(0, nube().montoACobrar(pedido)) * 100) / 100;
                if (falta <= 0) continue;
                if (resto + 0.009 >= falta) {
                    nube().registrarCobro(pedido.id, { forma, monto: falta });
                    aplicados.push({ pedido, monto: falta, completo: true });
                    resto = Math.round((resto - falta) * 100) / 100;
                } else {
                    extras.guardar("pagos", {
                        idPedido: String(pedido.id),
                        comercio: String(pedido.comercio || "").slice(0, 120),
                        monto: resto,
                        forma,
                        persona: p.persona(),
                        horaCelular: Date.now()
                    }, typeof generarId === "function" ? generarId("pago") : undefined);
                    aplicados.push({ pedido, monto: resto, completo: false });
                    resto = 0;
                }
            }
        } catch (error) {
            mostrarAviso("No se pudo registrar", error && error.message ? error.message : "Probá de nuevo.");
            return null;
        }
        if (navigator.vibrate) navigator.vibrate(30);
        refrescar();
        const persona = p.persona();
        return {
            comercio: grupo.comercio || { nombre: grupo.nombre },
            nombre: grupo.nombre,
            pedidos: aplicados.map(item => item.pedido),
            totalAntes: grupo.total,
            pago: monto,
            forma,
            queda: Math.max(0, Math.round((grupo.total - monto) * 100) / 100),
            cobro: persona && persona.nombre ? persona.nombre : "",
            hora: Date.now()
        };
    }

    // ---------- Ver la cuenta completa ----------
    function verCuenta(nombre) {
        const grupo = cuentaDe(nombre);
        if (!grupo) return;
        const filas = grupo.pedidos.map(pedido => {
            const total = nube().entregaDelPedido(pedido).total.total;
            const pagado = pagadoDe(pedido.id);
            const falta = Math.max(0, nube().montoACobrar(pedido));
            const d = new Date(horaEntrega(pedido));
            return `<div class="pzFila">
                <div class="pzFilaTxt"><strong>Pedido ${p.esc(typeof numeroCortoDelPedido === "function" ? numeroCortoDelPedido(pedido) : "")}</strong>
                <small>Entregado ${d.getDate()}/${d.getMonth() + 1} · ${p.plata(total)}${pagado ? " · pagó " + p.plata(pagado) : ""}</small></div>
                <b class="pzMonto">${p.plata(falta)}</b>
            </div>`;
        }).join("");
        p.hoja({
            titulo: "Cuenta de " + grupo.nombre,
            sub: "Debe " + p.plata(grupo.total) + " · " + textoPedidos(grupo.pedidos.length),
            html: `<div class="pzTarjeta pzLista pzEnHoja">${filas}</div>`,
            botones: nube().puedeCobrar()
                ? [{ texto: "Registrar un pago", icono: "moneda", alTocar: () => { setTimeout(() => registrarPago(grupo.nombre), 200); } }]
                : []
        });
    }

    // ---------- Recibo (T75) ----------
    function lineasRecibo(recibo) {
        const d = new Date(recibo.hora);
        const fecha = d.getDate() + "/" + (d.getMonth() + 1) + " · " + p.hora(d);
        const numeros = recibo.pedidos.map(pedido => typeof numeroCortoDelPedido === "function" ? numeroCortoDelPedido(pedido) : "");
        const textoNumeros = numeros.length > 1 ? numeros.slice(0, -1).join(", ") + " y " + numeros[numeros.length - 1] : numeros[0] || "";
        const telefono = String(window.distribuidoraVendeFrio?.datosTicket?.().telefono || "").trim();
        return {
            titulo: String(window.distribuidoraVendeFrio?.nombreActual?.() || "VendeFrío").toLocaleUpperCase("es"),
            telefono,
            filas: [
                ["Fecha", fecha],
                ["Comercio", recibo.nombre],
                [(recibo.pedidos.length === 1 ? "Pedido " : "Pedidos ") + textoNumeros, p.plata(recibo.totalAntes)],
                ["Pagó (" + (recibo.forma === "transferencia" ? "transferencia" : "efectivo") + ")", p.plata(recibo.pago), "pago"],
                ["Queda debiendo", p.plata(recibo.queda)],
                ["Cobró", recibo.cobro || "-"]
            ]
        };
    }

    function mostrarRecibo(recibo) {
        const datos = lineasRecibo(recibo);
        const seccion = p.pantalla("pantallaRecibo", { titulo: "Cobro registrado", sub: "Recibo de pago", volverA: () => abrirPantalla() });
        seccion.querySelector("main").innerHTML = `<div class="pzTarjeta pzRecibo">
                <h2>${p.esc(datos.titulo)}</h2>
                ${datos.telefono ? `<p>Tel. ${p.esc(datos.telefono)}</p>` : ""}
                <h3>RECIBO DE PAGO</h3>
                <p>No válido como factura</p>
                ${datos.filas.map(([izq, der, clase]) => `<div class="pzReciboFila"><span>${p.esc(izq)}</span><b class="${clase === "pago" ? "pzReciboPago" : ""}">${p.esc(der)}</b></div>`).join("")}
            </div>
            <div class="pzBotones pzBotonesFijos">
                <button type="button" class="pzBtn pzBtnWa" id="reciboWhatsapp">${p.ico("whatsapp", 18)}WhatsApp</button>
                <button type="button" class="pzBtn pzBtnPri" id="reciboImprimir">${p.ico("impresora", 18)}Imprimir</button>
            </div>`;
        p.mostrar(seccion);
        seccion.querySelector("#reciboWhatsapp").onclick = () => {
            const texto = [datos.titulo, "RECIBO DE PAGO (no válido como factura)", ""].concat(datos.filas.map(([izq, der]) => izq + ": " + der)).join("\n");
            const base = window.yaLlegoVendeFrio ? window.yaLlegoVendeFrio.enlace(recibo.comercio, 0) : "";
            const enlace = (base ? base.split("?")[0] : "https://wa.me/") + "?text=" + encodeURIComponent(texto);
            window.open(enlace, "_blank", "noopener");
        };
        seccion.querySelector("#reciboImprimir").onclick = () => {
            const impresion = window.impresionVendeFrio;
            if (!impresion || !impresion.disponible || !impresion.disponible()) {
                mostrarAviso("No se puede imprimir", "Este celular no puede conectarse a la impresora (hace falta Chrome en Android).");
                return;
            }
            const lineas = [
                { tipo: "titulo", texto: datos.titulo },
                datos.telefono ? { tipo: "centro", texto: "Tel. " + datos.telefono } : null,
                { tipo: "subtitulo", texto: "RECIBO DE PAGO" },
                { tipo: "centro", texto: "No valido como factura" },
                { tipo: "separador" }
            ].filter(Boolean).concat(datos.filas.map(([izq, der], i) => ({ tipo: i === 3 ? "total" : "dos", izquierda: izq, derecha: der })));
            impresion.imprimirLineas(lineas, { clave: "recibo" });
        };
    }

    // Recibo de un cobro ya registrado (⋯ en la ficha de un pedido cobrado).
    function reciboDelPedido(pedido) {
        const cobro = nube().cobroDelPedido(pedido);
        if (!cobro) return;
        const parciales = pagadoDe(pedido.id);
        const comercio = typeof buscarComercioPorNombre === "function" ? buscarComercioPorNombre(String(pedido.comercio || "")) : null;
        mostrarRecibo({
            comercio: comercio || { nombre: pedido.comercio },
            nombre: String(pedido.comercio || ""),
            pedidos: [pedido],
            totalAntes: (Number(cobro.monto) || 0) + parciales,
            pago: Number(cobro.monto) || 0,
            forma: cobro.forma,
            queda: 0,
            cobro: cobro.persona && cobro.persona.nombre ? cobro.persona.nombre : "",
            hora: Number(cobro.horaCelular) || Date.now()
        });
    }

    // ---------- "Debe" en la ficha y al cargar ----------
    function htmlDebe(nombre) {
        const grupo = cuentaDe(nombre);
        if (!grupo || grupo.total <= 0) return "";
        return `<div class="pzTarjeta pzDebe${grupo.pasoTope ? " pasoTope" : ""}">
            <div class="pzDebeCab"><div><small>Debe</small><strong>${p.plata(grupo.total)}</strong></div>
            <span class="pzChip ${grupo.pasoTope ? "pzChipPeligro" : "pzChipAviso"}">${grupo.pasoTope ? "Pasó el tope" : textoPedidos(grupo.pedidos.length)}</span></div>
            <button type="button" class="pzEnlace" data-ver-cuenta="${p.esc(grupo.nombre)}">Ver cuenta y registrar pago</button>
        </div>`;
    }

    function avisoParaPedido(comercio) {
        const grupo = comercio ? cuentaDe(comercio.nombre) : null;
        if (!grupo || grupo.total <= 0) return "";
        const texto = textoPedidos(grupo.pedidos.length) + " sin cobrar" + (grupo.tope ? " · tope " + p.plata(grupo.tope) : "");
        return `<div class="pzBanner ${grupo.pasoTope ? "pzBanPeligro" : "pzBanAviso"}" id="avisoDeudaPedido">
            ${p.ico("moneda", 22)}
            <div><strong>${grupo.pasoTope ? "Pasó el tope: debe " : "Debe "}${p.plata(grupo.total)}</strong><small>${p.esc(texto)}</small></div>
        </div>`;
    }

    document.addEventListener("click", evento => {
        const boton = evento.target.closest("[data-ver-cuenta]");
        if (!boton) return;
        window.cerrarFichaComercio?.();
        verCuenta(boton.dataset.verCuenta);
    });

    function refrescar() {
        dibujarPantalla();
        window.seguimientoVendeFrio?.redibujarFicha?.();
        if (typeof actualizarDashboard === "function") actualizarDashboard();
    }

    (window.accionesPedidoExtras = window.accionesPedidoExtras || []).push((pedido, estado) => {
        if (estado !== "entregado" || !nube().cobroDelPedido(pedido)) return [];
        return [{ texto: "Recibo de pago", icono: "recibo", alTocar: reciboDelPedido }];
    });
    // En Pedidos > "A cobrar": el total y "Ver por comercio".
    (window.listaPedidosExtras = window.listaPedidosExtras || []).push(etapa => {
        if (etapa !== "aCobrar") return null;
        const lista = cuentas();
        if (!lista.length) return null;
        const total = lista.reduce((suma, grupo) => suma + grupo.total, 0);
        const banner = document.createElement("button");
        banner.type = "button";
        banner.className = "pzBanner pzBanPri";
        banner.id = "verACobrarPorComercio";
        banner.innerHTML = `${p.ico("moneda", 22)}<div><strong>Te deben ${p.plata(total)}</strong><small>${lista.length} ${lista.length === 1 ? "comercio" : "comercios"} · tocá para ver por comercio</small></div>${p.ico("chevDerecha", 20)}`;
        banner.addEventListener("click", abrirPantalla);
        return banner;
    });
    extras.escuchar("pagos", refrescar);
    // Acceso en Más, para quien cobra.
    (window.accesosMasExtras = window.accesosMasExtras || []).push({
        destino: "aCobrar", icono: "moneda", texto: "A cobrar",
        mostrar: () => typeof usaNubeReal === "function" && usaNubeReal() && Boolean(nube()?.puedeCobrar?.()),
        abrir: abrirPantalla
    });

    window.saldosVendeFrio = { pagadoDe, cuentas, cuentaDe, abrirPantalla, registrarPago, verCuenta, htmlDebe, avisoParaPedido, mostrarRecibo, reciboDelPedido, textoRecordatorio, enlaceRecordatorio };
}());
