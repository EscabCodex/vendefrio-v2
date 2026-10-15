// =====================================================
// VendeFrío - cierre.js
// Cierre del día (T28f): una sección nueva, como Rutas o Estadísticas, con el
// resumen de caja de un día y el botón "Imprimir" abajo de todo. Solo en la
// nube y solo para el dueño y quien tiene "Cobra" (aprobado). El día se
// cuenta por la hora de la entrega y del cobro, no de la carga: un pedido de
// otro día que se cobra hoy entra en la caja de hoy. Solo lee los pedidos
// (sin reglas nuevas).
// =====================================================

(function () {
    const DIA = 24 * 60 * 60 * 1000;
    let diaElegido = inicioDelDia(Date.now());

    function inicioDelDia(hora) {
        const fecha = new Date(hora);
        fecha.setHours(0, 0, 0, 0);
        return fecha.getTime();
    }

    function enElDia(hora, inicio) {
        const numero = Number(hora) || 0;
        // Un día puede tener 23 o 25 horas (cambio de hora): se usa el
        // comienzo del día siguiente, no inicio + 24 horas.
        return numero >= inicio && numero < inicioDelDia(inicio + DIA + 2 * 60 * 60 * 1000);
    }

    function disponible() {
        return typeof usaNubeReal === "function" && usaNubeReal() &&
            Boolean(window.nubeVendeFrio?.puedeCobrar?.());
    }

    function escapar(texto) {
        return String(texto ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function precio(valor) {
        return "$ " + (Math.round((Number(valor) || 0) * 100) / 100).toLocaleString("es-AR", { maximumFractionDigits: 2 });
    }

    function dosDigitos(numero) {
        return String(numero).padStart(2, "0");
    }

    function textoFecha(hora) {
        const fecha = new Date(hora);
        return dosDigitos(fecha.getDate()) + "/" + dosDigitos(fecha.getMonth() + 1) + "/" + fecha.getFullYear();
    }

    function textoHora(hora) {
        const fecha = new Date(hora);
        return dosDigitos(fecha.getHours()) + ":" + dosDigitos(fecha.getMinutes());
    }

    function nombreDelDia(inicio) {
        const hoy = inicioDelDia(Date.now());
        if (inicio === hoy) return "Hoy";
        if (inicio === inicioDelDia(hoy - DIA / 2)) return "Ayer";
        const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        return dias[new Date(inicio).getDay()];
    }

    function nombrePersona(persona) {
        const nombre = String(persona && persona.nombre || "").trim();
        if (nombre) return nombre;
        return persona && persona.idPersona === "dueno" ? "El dueño" : "Un empleado";
    }

    // La hora de las entradas del historial con ese estado, la más nueva.
    function horasDelEstado(pedido, estado) {
        const estados = pedido && pedido.estados && typeof pedido.estados === "object" ? pedido.estados : {};
        return Object.keys(estados)
            .map(id => estados[id])
            .filter(entrada => entrada && entrada.estado === estado)
            .map(entrada => Number(entrada.horaCelular) || 0);
    }

    // -------------------------------------------------
    // Los números del día
    // -------------------------------------------------

    function calcular(inicio) {
        const nube = window.nubeVendeFrio;
        const pedidos = obtenerHistorial().filter(pedido =>
            pedido && pedido.eliminado !== true && pedido.estados && typeof pedido.estados === "object"
        );

        const resultado = {
            inicio,
            cargados: 0,
            entregados: [],
            noEntregados: [],
            conCambios: [],
            bajoPorCambios: 0,
            cancelados: [],
            cobros: [],
            porForma: { efectivo: 0, transferencia: 0 },
            aCobrar: 0,
            porPersona: [],
            diferencias: [],
            totalRecaudado: 0
        };

        pedidos.forEach(pedido => {
            const estado = estadoActualDelPedido(pedido);
            const numero = numeroCortoDelPedido(pedido);
            const comercio = String(pedido.comercio || "SIN NOMBRE").trim();

            if (horasDelEstado(pedido, "cargado").some(hora => enElDia(hora, inicio)) ||
                (!horasDelEstado(pedido, "cargado").length && enElDia(pedido.timestamp, inicio))) {
                resultado.cargados += 1;
            }

            const entregadoEseDia = estado === "entregado" &&
                horasDelEstado(pedido, "entregado").some(hora => enElDia(hora, inicio));
            const cobro = nube.cobroDelPedido(pedido);

            if (entregadoEseDia) {
                const entrega = nube.entregaDelPedido(pedido);
                const total = nube.montoACobrar(pedido);
                resultado.entregados.push({ numero, comercio, total, cobro, pedido });

                if (entrega.cambios) {
                    const preparado = Math.round(nube.entregaDelPedido(pedido, {}).total.total * 100) / 100;
                    const bajo = Math.max(0, Math.round((preparado - total) * 100) / 100);
                    resultado.conCambios.push({ numero, comercio, cambios: entrega.cambios, bajo });
                    resultado.bajoPorCambios += bajo;
                }

                if (!cobro) resultado.aCobrar += total;
            }

            // Salieron a repartir ese día y no se entregaron ese día.
            const salioEseDia = horasDelEstado(pedido, "enReparto").some(hora => enElDia(hora, inicio)) ||
                horasDelEstado(pedido, "enVehiculo").some(hora => enElDia(hora, inicio));
            if (salioEseDia && !entregadoEseDia && estado !== "cancelado") {
                resultado.noEntregados.push({
                    numero,
                    comercio,
                    estado: nombreDeEstadoPedido(estado) || estado,
                    total: nube.montoACobrar(pedido)
                });
            }

            if (estado === "cancelado" && horasDelEstado(pedido, "cancelado").some(hora => enElDia(hora, inicio))) {
                resultado.cancelados.push({ numero, comercio });
            }

            // La caja: los cobros registrados ese día, de cualquier pedido.
            if (cobro && enElDia(cobro.horaCelular, inicio)) {
                const total = nube.montoACobrar(pedido);
                const entregas = horasDelEstado(pedido, "entregado");
                const entregadoEl = entregas.length ? Math.max(...entregas) : 0;
                resultado.cobros.push({
                    numero,
                    comercio,
                    total,
                    cobro,
                    deOtroDia: entregadoEl > 0 && !enElDia(entregadoEl, inicio),
                    entregadoEl
                });
                resultado.porForma[cobro.forma] = (resultado.porForma[cobro.forma] || 0) + cobro.monto;
                resultado.totalRecaudado += cobro.monto;

                const idPersona = cobro.persona && cobro.persona.idPersona || "";
                let persona = resultado.porPersona.find(item => item.idPersona === idPersona);
                if (!persona) {
                    persona = { idPersona, nombre: nombrePersona(cobro.persona), total: 0, cantidad: 0 };
                    resultado.porPersona.push(persona);
                }
                persona.total += cobro.monto;
                persona.cantidad += 1;

                const diferencia = Math.round((cobro.monto - total) * 100) / 100;
                if (diferencia !== 0) {
                    resultado.diferencias.push({ numero, comercio, total, cobrado: cobro.monto, diferencia });
                }
            }
        });

        const porNumero = (a, b) => a.comercio.localeCompare(b.comercio, "es") || a.numero.localeCompare(b.numero);
        resultado.entregados.sort(porNumero);
        resultado.cobros.sort(porNumero);
        resultado.porPersona.sort((a, b) => b.total - a.total);
        return resultado;
    }

    // -------------------------------------------------
    // Pantalla
    // -------------------------------------------------

    function crearPantalla() {
        const seccion = document.createElement("section");
        seccion.id = "pantallaCierre";
        seccion.className = "oculto pantallaExtra pantallaCierre";
        seccion.innerHTML = `
            <header>
                <div class="logo">${window.icono("recibo", 22)}</div>
                <div><h1>Cierre del día</h1><p>La caja del día: entregas y cobros</p></div>
            </header>
            <main class="container">
                <button class="extraVolver" type="button">‹ Volver</button>
                <div class="selectorDiaCierre">
                    <button type="button" data-dia="anterior" aria-label="Día anterior">‹</button>
                    <label>
                        <span id="nombreDiaCierre"></span>
                        <input type="date" id="fechaCierre" aria-label="Elegir el día">
                    </label>
                    <button type="button" data-dia="siguiente" aria-label="Día siguiente">›</button>
                </div>
                <div id="contenidoCierre" class="contenidoCierre"></div>
            </main>
        `;
        document.body.insertBefore(seccion, document.querySelector("nav.bottom-nav"));

        seccion.querySelector(".extraVolver").addEventListener("click", () => {
            seccion.classList.add("oculto");
            mostrarPantalla("menu");
        });
        seccion.querySelector("#fechaCierre").addEventListener("change", evento => {
            const partes = String(evento.target.value || "").split("-").map(Number);
            if (partes.length !== 3 || partes.some(Number.isNaN)) return;
            diaElegido = new Date(partes[0], partes[1] - 1, partes[2]).getTime();
            dibujar();
        });
        seccion.addEventListener("click", evento => {
            const boton = evento.target.closest("button");
            if (!boton) return;
            if (boton.dataset.dia === "anterior") {
                diaElegido = inicioDelDia(diaElegido - DIA / 2);
                dibujar();
            } else if (boton.dataset.dia === "siguiente") {
                const siguiente = inicioDelDia(diaElegido + DIA + 2 * 60 * 60 * 1000);
                if (siguiente <= inicioDelDia(Date.now())) {
                    diaElegido = siguiente;
                    dibujar();
                }
            } else if (boton.id === "imprimirCierre") {
                window.impresionVendeFrio?.imprimirLineas?.(lineasParaImprimir(calcular(diaElegido)), {
                    clave: "cierre",
                    aviso: "Cierre del día impreso"
                });
            }
        });

        window.impresionVendeFrio?.escuchar?.(() => {
            if (!seccion.classList.contains("oculto")) dibujar();
        });

        return seccion;
    }

    function filaDoble(izquierda, derecha, clase) {
        return `<div class="filaCierre${clase ? " " + clase : ""}"><span>${izquierda}</span><strong>${derecha}</strong></div>`;
    }

    function tarjeta(titulo, contenido, clase) {
        return `<section class="tarjetaCierre${clase ? " " + clase : ""}"><h2>${titulo}</h2>${contenido}</section>`;
    }

    function textoCobro(cobro) {
        if (!cobro) return "A cobrar";
        return window.nubeVendeFrio.nombreDeFormaDeCobro(cobro.forma);
    }

    function dibujar() {
        const seccion = document.getElementById("pantallaCierre");
        const caja = document.getElementById("contenidoCierre");
        if (!seccion || !caja) return;

        const hoy = inicioDelDia(Date.now());
        if (diaElegido > hoy) diaElegido = hoy;
        const fecha = new Date(diaElegido);
        document.getElementById("nombreDiaCierre").textContent = nombreDelDia(diaElegido) + " · " + textoFecha(diaElegido);
        document.getElementById("fechaCierre").value =
            fecha.getFullYear() + "-" + dosDigitos(fecha.getMonth() + 1) + "-" + dosDigitos(fecha.getDate());
        document.getElementById("fechaCierre").max =
            new Date(hoy).getFullYear() + "-" + dosDigitos(new Date(hoy).getMonth() + 1) + "-" + dosDigitos(new Date(hoy).getDate());
        seccion.querySelector('[data-dia="siguiente"]').disabled = diaElegido >= hoy;

        if (!disponible()) {
            caja.innerHTML = `<p class="vacioCierre">El cierre del día lo ven solo el dueño y quien tiene el permiso «Cobra».</p>`;
            return;
        }

        const datos = calcular(diaElegido);

        const resumen = `
            <div class="kpisCierre">
                <div><strong>${datos.cargados}</strong><span>cargados</span></div>
                <div><strong>${datos.entregados.length}</strong><span>entregados</span></div>
                <div><strong>${datos.noEntregados.length}</strong><span>sin entregar</span></div>
                <div><strong>${datos.conCambios.length}</strong><span>con cambios</span></div>
                <div><strong>${datos.cancelados.length}</strong><span>cancelados</span></div>
            </div>
        `;

        const caja1 = `
            <div class="heroCierre">
                <small>TOTAL RECAUDADO</small>
                <strong id="totalRecaudadoCierre">${precio(datos.totalRecaudado)}</strong>
                <span>${datos.cobros.length} ${datos.cobros.length === 1 ? "cobro" : "cobros"}</span>
            </div>
            ${filaDoble("Efectivo", precio(datos.porForma.efectivo))}
            ${filaDoble("Transferencia", precio(datos.porForma.transferencia))}
            ${filaDoble("A cobrar (entregados sin cobrar)", precio(datos.aCobrar), "aCobrarCierre")}
        `;

        const personas = datos.porPersona.length
            ? datos.porPersona.map(persona => filaDoble(
                escapar(persona.nombre) + ` <small>(${persona.cantidad} ${persona.cantidad === 1 ? "cobro" : "cobros"})</small>`,
                precio(persona.total)
            )).join("") + filaDoble("Total general", precio(datos.totalRecaudado), "totalCierre")
            : `<p class="vacioCierre">Nadie registró cobros este día.</p>`;

        const entregados = datos.entregados.length
            ? datos.entregados.map(item => `
                <div class="pedidoCierre">
                    <div><strong>${escapar(item.comercio)}</strong><small>N° ${escapar(item.numero)}</small></div>
                    <div><strong>${precio(item.total)}</strong><small class="${item.cobro ? "" : "pendienteCierre"}">${escapar(textoCobro(item.cobro))}</small></div>
                </div>`).join("")
            : `<p class="vacioCierre">No se entregaron pedidos este día.</p>`;

        const deOtroDia = datos.cobros.filter(item => item.deOtroDia);
        const cobrosViejos = deOtroDia.length
            ? tarjeta("Cobros de pedidos de otro día", deOtroDia.map(item => filaDoble(
                escapar(item.comercio) + ` <small>N° ${escapar(item.numero)} · entregado el ${textoFecha(item.entregadoEl)}</small>`,
                precio(item.cobro.monto)
            )).join(""))
            : "";

        const diferencias = datos.diferencias.length
            ? tarjeta("Diferencias con el total", datos.diferencias.map(item => filaDoble(
                escapar(item.comercio) + ` <small>N° ${escapar(item.numero)} · cobró ${precio(item.cobrado)} de ${precio(item.total)}</small>`,
                (item.diferencia > 0 ? "+" : "−") + precio(Math.abs(item.diferencia)),
                item.diferencia < 0 ? "faltaCierre" : ""
            )).join(""))
            : "";

        const sinEntregar = datos.noEntregados.length
            ? tarjeta("Salieron y no se entregaron", datos.noEntregados.map(item => filaDoble(
                escapar(item.comercio) + ` <small>N° ${escapar(item.numero)} · ${escapar(item.estado)}</small>`,
                precio(item.total)
            )).join(""))
            : "";

        const cambios = datos.conCambios.length
            ? tarjeta("Entregados con cambios", datos.conCambios.map(item => filaDoble(
                escapar(item.comercio) + ` <small>N° ${escapar(item.numero)} · ${item.cambios} ${item.cambios === 1 ? "producto" : "productos"}</small>`,
                "−" + precio(item.bajo)
            )).join("") + filaDoble("Bajó el total", "−" + precio(datos.bajoPorCambios), "totalCierre"))
            : "";

        const cancelados = datos.cancelados.length
            ? tarjeta("Cancelados", datos.cancelados.map(item => filaDoble(escapar(item.comercio), "N° " + escapar(item.numero))).join(""))
            : "";

        const impresion = window.impresionVendeFrio;
        const imprimir = impresion?.disponible?.()
            ? `<button type="button" class="btnAccion agregar imprimirCierre" id="imprimirCierre" ${impresion.imprimiendo() ? "disabled" : ""}>
                    ${window.icono("impresora", 16)} ${impresion.imprimiendo() === "cierre" ? "Imprimiendo…" : "Imprimir"}
               </button>`
            : `<p class="vacioCierre">Para imprimirlo, abrí la app en un celular Android con Chrome.</p>`;

        caja.innerHTML =
            resumen +
            tarjeta("Caja", caja1, "cajaCierre") +
            tarjeta("Por persona que cobró", personas) +
            tarjeta("Entregados", entregados) +
            cobrosViejos +
            diferencias +
            cambios +
            sinEntregar +
            cancelados +
            imprimir;
    }

    // Lo mismo, para la impresora (impresion.js arma los bytes).
    function lineasParaImprimir(datos) {
        const lineas = [];
        const distribuidora = String(window.distribuidoraVendeFrio?.nombreActual?.() || "").trim() || "VendeFrío";
        const titulo = texto => lineas.push({ tipo: "subtitulo", texto });
        const dos = (izquierda, derecha) => lineas.push({ tipo: "dos", izquierda, derecha });

        lineas.push({ tipo: "titulo", texto: distribuidora });
        lineas.push({ tipo: "centro", texto: "CIERRE DEL DÍA" });
        lineas.push({ tipo: "centro", texto: nombreDelDia(datos.inicio) + " " + textoFecha(datos.inicio) });
        lineas.push({ tipo: "separador" });

        dos("Cargados", String(datos.cargados));
        dos("Entregados", String(datos.entregados.length));
        dos("Salieron sin entregar", String(datos.noEntregados.length));
        dos("Con cambios", String(datos.conCambios.length) + (datos.bajoPorCambios ? " (-" + precio(datos.bajoPorCambios) + ")" : ""));
        dos("Cancelados", String(datos.cancelados.length));
        lineas.push({ tipo: "separador" });

        titulo("ENTREGADOS");
        if (!datos.entregados.length) lineas.push({ tipo: "texto", texto: "Ninguno" });
        datos.entregados.forEach(item => {
            lineas.push({ tipo: "texto", texto: "N° " + item.numero + " " + item.comercio });
            dos("   " + textoCobro(item.cobro), precio(item.total));
        });

        const deOtroDia = datos.cobros.filter(item => item.deOtroDia);
        if (deOtroDia.length) {
            lineas.push({ tipo: "separador" });
            titulo("COBROS DE OTRO DÍA");
            deOtroDia.forEach(item => {
                lineas.push({ tipo: "texto", texto: "N° " + item.numero + " " + item.comercio + " (" + textoFecha(item.entregadoEl) + ")" });
                dos("   " + textoCobro(item.cobro), precio(item.cobro.monto));
            });
        }

        if (datos.diferencias.length) {
            lineas.push({ tipo: "separador" });
            titulo("DIFERENCIAS CON EL TOTAL");
            datos.diferencias.forEach(item => {
                lineas.push({ tipo: "texto", texto: "N° " + item.numero + " " + item.comercio });
                dos("   Cobró " + precio(item.cobrado) + " de " + precio(item.total),
                    (item.diferencia > 0 ? "+" : "-") + precio(Math.abs(item.diferencia)));
            });
        }

        if (datos.noEntregados.length) {
            lineas.push({ tipo: "separador" });
            titulo("SALIERON Y NO SE ENTREGARON");
            datos.noEntregados.forEach(item => dos("N° " + item.numero + " " + item.comercio, precio(item.total)));
        }

        lineas.push({ tipo: "separador" });
        titulo("CAJA");
        dos("Efectivo", precio(datos.porForma.efectivo));
        dos("Transferencia", precio(datos.porForma.transferencia));
        dos("A cobrar", precio(datos.aCobrar));
        lineas.push({ tipo: "separador" });
        titulo("POR PERSONA QUE COBRÓ");
        if (!datos.porPersona.length) lineas.push({ tipo: "texto", texto: "Nadie registró cobros" });
        datos.porPersona.forEach(persona => dos(persona.nombre + " (" + persona.cantidad + ")", precio(persona.total)));
        lineas.push({ tipo: "separador" });
        lineas.push({ tipo: "total", izquierda: "RECAUDADO", derecha: precio(datos.totalRecaudado) });
        lineas.push({ tipo: "centro", texto: "Impreso: " + textoFecha(Date.now()) + " " + textoHora(Date.now()) });

        return lineas;
    }

    function abrirCierre() {
        const seccion = document.getElementById("pantallaCierre") || crearPantalla();
        document.querySelectorAll('body > section[id^="pantalla"]').forEach(pantalla => pantalla.classList.add("oculto"));
        diaElegido = inicioDelDia(Date.now());
        seccion.classList.remove("oculto");
        document.querySelectorAll(".nav-item").forEach(boton => boton.classList.remove("activo"));
        dibujar();
        window.scrollTo(0, 0);
    }

    // Si cambian los pedidos (otro celular cobró o entregó), se redibuja.
    function redibujarSiEstaAbierta() {
        const seccion = document.getElementById("pantallaCierre");
        if (seccion && !seccion.classList.contains("oculto")) dibujar();
    }

    window.cierreVendeFrio = { disponible, abrir: abrirCierre, calcular, redibujar: redibujarSiEstaAbierta };
})();
