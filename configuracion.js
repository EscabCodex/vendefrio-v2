// VendeFrío - Configuración móvil tipo menú
(function () {
    const CLAVE = "vendefrio_preferencias";

    const leer = () => {
        try {
            return JSON.parse(localStorage.getItem(CLAVE)) || {};
        } catch (e) {
            return {};
        }
    };

    const guardar = datos =>
        localStorage.setItem(CLAVE, JSON.stringify(datos));

    const pantalla = () =>
        document.getElementById("pantallaConfiguracion");

    // --- Piezas de las secciones de "Más" (T50): grupos con título, filas
    // con ícono, ajustes a la derecha o abajo y notas cortas. ---
    const ico = (nombre, tam = 20) => window.icono(nombre, tam);

    function grupo(titulo, filas, clase = "") {
        return `
            <section class="ajGrupo ${clase}">
                ${titulo ? `<h3 class="ajGrupoTitulo">${titulo}</h3>` : ""}
                <div class="ajTarjeta">${filas}</div>
            </section>`;
    }

    function cabezaFila(icono, tono, titulo, ayuda) {
        return `
            <span class="ajIcono" data-tono="${tono}">${ico(icono)}</span>
            <span class="ajTexto"><strong>${titulo}</strong>${ayuda ? `<small>${ayuda}</small>` : ""}</span>`;
    }

    // Lista desplegable a la derecha.
    function filaElegir(icono, tono, titulo, ayuda, campo, opciones) {
        return `
            <label class="ajFila">
                ${cabezaFila(icono, tono, titulo, ayuda)}
                <select data-campo="${campo}" aria-label="${titulo}">
                    ${opciones.map(([valor, texto]) => `<option value="${valor}">${texto}</option>`).join("")}
                </select>
            </label>`;
    }

    // Botones en fila (pocas opciones cortas), debajo del título.
    function filaSegmento(icono, tono, titulo, ayuda, campo, opciones) {
        return `
            <div class="ajFila ajApilada" role="radiogroup" aria-label="${titulo}">
                <div class="ajCabeza">${cabezaFila(icono, tono, titulo, ayuda)}</div>
                <div class="ajSegmento">
                    ${opciones.map(([valor, texto]) => `
                        <label><input type="radio" name="aj-${campo}" value="${valor}" data-campo="${campo}"><span>${texto}</span></label>`).join("")}
                </div>
            </div>`;
    }

    function filaLlave(icono, tono, titulo, ayuda, campo) {
        return `
            <label class="ajFila">
                ${cabezaFila(icono, tono, titulo, ayuda)}
                <input type="checkbox" class="ajLlave" data-campo="${campo}" role="switch" aria-label="${titulo}">
            </label>`;
    }

    // Botón con aspecto de fila. extra: atributos (data-accion, id, disabled).
    function filaAccion(icono, tono, titulo, ayuda, extra, clase = "") {
        return `
            <button type="button" class="ajFila ajAccion ${clase}" ${extra} aria-label="${titulo}">
                ${cabezaFila(icono, tono, titulo, ayuda)}
                <b aria-hidden="true">${ico("chevDerecha", 18)}</b>
            </button>`;
    }

    function filaDato(icono, tono, titulo, valorHtml, idValor = "") {
        return `
            <div class="ajFila ajDato">
                <span class="ajIcono" data-tono="${tono}">${ico(icono)}</span>
                <span class="ajTexto"><small>${titulo}</small><strong ${idValor ? `id="${idValor}"` : ""}>${valorHtml}</strong></span>
            </div>`;
    }

    // Valor de cada ajuste, o el de fábrica si nunca se tocó.
    const DEFECTOS = {
        tema: "sistema", acento: "original", texto: "normal", densidad: "compacto",
        movimiento: false, barraNombres: true, masEnBarra: true, volverFlotante: true, frecuenciaRespaldo: "semanal", recordarRespaldo: "semanal",
        orden: "pendientes", ordenProductos: "marca", inicio: "menu",
        vibrar: true, precios: true, iaCelular: false, iaNube: false,
        vehiculo: "bicicleta", navegador: "app", voz: "si", velocidadVoz: "normal",
        zoom: "17", seguimiento: true, pantallaEncendida: true, pruebaEntrega: false,
        resumenNoche: true, nombresArriba: true, hablarAlGuardar: false
    };
    const CAMPOS_VISUALES = ["tema", "acento", "texto", "densidad", "movimiento", "barraNombres", "nombresArriba", "masEnBarra", "volverFlotante"];

    function valorDe(d, campo) {
        return d[campo] === undefined || d[campo] === "" ? DEFECTOS[campo] : d[campo];
    }

    // --- Apariencia (T50): el tema con una vista de cómo se ve, el color
    // principal, el tamaño del texto, el espaciado y el movimiento. ---
    const TEMAS = [["sistema", "Como el teléfono"], ["claro", "Claro"], ["oscuro", "Oscuro"]];
    const ACENTOS = [
        ["original", "Hielo y lima"], ["verde", "Verde"], ["violeta", "Violeta"],
        ["naranja", "Naranja"], ["rosa", "Rosa"]
    ];

    // Una app en miniatura: barra de arriba, tarjeta principal, dos filas y la
    // barra de abajo con el "+".
    function miniApp(modo) {
        return `
            <span class="miniApp" data-modo="${modo}" aria-hidden="true">
                <i class="miniCabeza"><i></i><i></i></i>
                <i class="miniHero"><i></i><i></i></i>
                <i class="miniFila"><i></i><i></i></i>
                <i class="miniFila"><i></i><i></i></i>
                <i class="miniBarra"><i></i><i></i><i class="miniMas"></i><i></i><i></i></i>
            </span>`;
    }

    function htmlApariencia() {
        const temas = TEMAS.map(([valor, texto]) => `
            <label class="ajTema">
                <input type="radio" name="aj-tema" value="${valor}" data-campo="tema">
                <span class="vistaTema">
                    ${valor === "sistema"
                        ? `<span class="vistaPartida">${miniApp("claro")}${miniApp("oscuro")}</span>`
                        : miniApp(valor)}
                </span>
                <strong>${texto}</strong>
            </label>`).join("");

        const acentos = ACENTOS.map(([valor, texto]) => `
            <label class="ajColor" title="${texto}">
                <input type="radio" name="aj-acento" value="${valor}" data-campo="acento" aria-label="${texto}">
                <span class="muestraColor" data-acento-muestra="${valor}"><i></i><i></i></span>
                <small>${texto}</small>
            </label>`).join("");

        return grupo("Tema",
                `<div class="ajTemas" role="radiogroup" aria-label="Tema">${temas}</div>`, "ajGrupoTemas") +
            grupo("Color principal",
                `<div class="ajColores" role="radiogroup" aria-label="Color principal">${acentos}</div>
                <p class="ajPie">Cada color tiene un tono para el modo claro y otro para el oscuro.</p>`) +
            grupo("Texto y espacio",
                filaSegmento("texto", "azul", "Tamaño del texto", "", "texto", [
                    ["chico", "Chico"], ["normal", "Normal"], ["grande", "Grande"], ["enorme", "Muy grande"]
                ]) +
                filaSegmento("espaciado", "verde", "Espaciado", "Lugar entre filas y tarjetas", "densidad", [
                    ["compacto", "Compacto"], ["comodo", "Cómodo"], ["amplio", "Amplio"]
                ]) +
                `<div class="ajMuestraTexto" aria-live="polite">
                    <strong>Almacén Don Pepe</strong>
                    <small>San Martín 123 · Pidió 2 helados y 1 palito</small>
                </div>`) +
            grupo("Más opciones",
                filaLlave("barraAbajo", "violeta", "Nombres en la barra de abajo", "Si lo apagás, quedan solo los íconos", "barraNombres") +
                filaLlave("etiqueta", "azul", "Nombres en los íconos de arriba", "Asistente, Avisos, Ayuda y Más", "nombresArriba") +
                filaLlave("menu", "azul", "Más en la barra de abajo", "Para llegar a Más con el pulgar", "masEnBarra") +
                filaLlave("flechaIzquierda", "verde", "Volver siempre a mano", "La flecha y la casita quedan arriba al bajar", "volverFlotante") +
                filaLlave("chispa", "naranja", "Menos movimiento", "Saca las animaciones y transiciones", "movimiento") +
                filaAccion("refrescar", "rojo", "Restablecer apariencia", "Todo como al principio", 'data-accion="restablecer"', "ajPeligro"));
    }

    // La muestra se ve con el tamaño elegido, sin salir de la sección.
    function dibujarMuestraTexto(caja) {
        const muestra = caja.querySelector(".ajMuestraTexto");
        if (!muestra) return;
        muestra.dataset.texto = valorDe(leer(), "texto");
    }

    // Un dato con su lápiz para cambiarlo.
    function filaEditable(icono, tono, titulo, valorHtml, idValor, accion, textoBoton) {
        return `
            <div class="ajFila ajDato">
                <span class="ajIcono" data-tono="${tono}">${ico(icono)}</span>
                <span class="ajTexto"><small>${titulo}</small><strong ${idValor ? `id="${idValor}"` : ""}>${valorHtml}</strong></span>
                ${accion ? `<button type="button" class="ajEditar" data-accion="${accion}" aria-label="${textoBoton}">${ico("lapiz", 16)}<span>${textoBoton}</span></button>` : ""}
            </div>`;
    }

    function nota(texto, tono = "", extra = "") {
        return `<p class="ajNota" data-tono="${tono}" ${extra}>${ico(tono === "alerta" ? "alerta" : "info", 16)}<span>${texto}</span></p>`;
    }

    function crear() {
        if (pantalla()) return pantalla();

        const elemento = document.createElement("section");
        elemento.id = "pantallaConfiguracion";
        elemento.className = "oculto pantallaConfiguracion";

        // "Más" (T31): la persona y la conexión arriba, los accesos a otras
        // secciones y la configuración en grupos, con filas de una línea.
        const fila = (seccion, icono, titulo, extra = "") => `
                    <button class="configFila" data-config-seccion="${seccion}" ${extra}>
                        <span class="configIcono" data-color="${seccion}">${window.icono(icono, 20)}</span>
                        <strong>${titulo}</strong>
                        <small class="configValor" data-valor="${seccion}"></small>
                        <b aria-hidden="true">${window.icono("chevDerecha", 18)}</b>
                    </button>`;

        elemento.innerHTML = `
            <header class="configHeader">
                <button class="configVolver" type="button" aria-label="Volver">${window.icono("flechaIzquierda", 22)}</button>
                <div>
                    <h1>Más</h1>
                </div>
            </header>
            <main class="container">
                <input class="configBuscador oculto" id="buscarConfiguracion" type="search"
                    placeholder="Buscar en configuración">

                <div class="configMenuPrincipal">
                    <button class="configFila configPerfil" data-config-seccion="cuenta" aria-label="Cuenta">
                        <span class="configAvatar" id="configAvatar">${window.icono("persona", 24)}</span>
                        <span class="configPerfilTexto">
                            <strong id="configPerfilNombre">Cuenta</strong>
                            <small id="configCuentaResumen">Ingresá o salí de tu cuenta</small>
                            <small class="configPerfilConexion oculto" id="configPerfilConexion" data-conexion-texto></small>
                        </span>
                        <b aria-hidden="true">${window.icono("chevDerecha", 18)}</b>
                    </button>

                    <div class="masGruposAccesos" id="masAccesos"></div>

                    <h2 class="configGrupoTitulo">Trabajo diario</h2>
                    <div class="configLista">
                        ${fila("avisos", "campana", "Avisos", 'id="configFilaAvisos"').replace('class="configFila"', 'class="configFila oculto"')}
                        ${fila("impresora", "impresora", "Impresora de tickets", 'id="configFilaImpresora"').replace('class="configFila"', 'class="configFila oculto"')}
                        ${fila("navegacion", "bicicleta", "Recorrido")}
                        ${fila("trabajo", "maletin", "Preferencias de trabajo")}
                    </div>

                    <h2 class="configGrupoTitulo">Distribuidora</h2>
                    <div class="configLista">
                        ${fila("empleados", "usuarios", "Empleados y roles", 'id="configFilaEmpleados"').replace('class="configFila"', 'class="configFila oculto"')}
                        ${fila("respaldo", "nube", "Datos y respaldo")}
                    </div>

                    <h2 class="configGrupoTitulo">App</h2>
                    <div class="configLista">
                        ${fila("apariencia", "luna", "Apariencia")}
                        ${fila("seguridad", "escudo", "Seguridad y ayuda")}
                    </div>
                </div>

                <div class="configDetalle oculto" id="configDetalle"></div>
            </main>
        `;

        document.body.insertBefore(
            elemento,
            document.querySelector("nav.bottom-nav")
        );

        elemento.querySelectorAll("[data-config-seccion]").forEach(fila => {
            fila.addEventListener("click", () =>
                detalle(fila.dataset.configSeccion)
            );
        });

        return elemento;
    }

    function sistemaEsOscuro() {
        return !!(
            window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
        );
    }

    function aplicar() {
        const d = leer();
        const preferencia = d.tema || "sistema";

        const temaVisual =
            preferencia === "sistema"
                ? (sistemaEsOscuro() ? "oscuro" : "claro")
                : preferencia;

        document.documentElement.dataset.tema = temaVisual;
        document.documentElement.dataset.temaPreferido = preferencia;
        const raiz = document.documentElement;
        raiz.dataset.texto = valorDe(d, "texto");
        raiz.dataset.densidad = valorDe(d, "densidad");
        raiz.dataset.acento = valorDe(d, "acento");
        raiz.dataset.movimiento = valorDe(d, "movimiento") === true ? "reducido" : "normal";
        raiz.dataset.barra = valorDe(d, "barraNombres") === false ? "iconos" : "nombres";
        raiz.dataset.nombresArriba = valorDe(d, "nombresArriba") === false ? "no" : "si";
        raiz.dataset.masBarra = valorDe(d, "masEnBarra") === false ? "no" : "si";
        raiz.dataset.volverFlotante = valorDe(d, "volverFlotante") === false ? "no" : "si";
        raiz.dataset.precios = valorDe(d, "precios") === false ? "no" : "si";
    }

    function guardarCampo(campo, valor) {
        const d = leer();
        d[campo] = valor;
        guardar(d);
        aplicar();
        actualizarMas();
        const caja = document.getElementById("configDetalle");
        if (caja) dibujarMuestraTexto(caja);
    }

    function abrir() {
        crear();

        document.querySelectorAll('body > section[id^="pantalla"]')
            .forEach(s => s.classList.add("oculto"));

        pantalla().classList.remove("oculto");
        pantalla().querySelector(".configMenuPrincipal")
            .classList.remove("oculto");
        pantalla().querySelector(".configDetalle")
            .classList.add("oculto");
        pantalla().querySelector(".configBuscador").value = "";
        actualizarMas();
    }

    // --- "Más" (T31): persona, accesos y el valor de cada fila ---
    function inicialDe(nombre) {
        const limpio = String(nombre || "").trim();
        return limpio ? limpio.charAt(0).toLocaleUpperCase("es") : "";
    }

    function actualizarMas() {
        if (!pantalla()) return;

        const quien = window.empleadosVendeFrio?.quienSoy?.();
        const nombre = quien?.nombre || "";
        const titulo = document.getElementById("configPerfilNombre");
        if (titulo) titulo.textContent = nombre || "Cuenta";
        const avatar = document.getElementById("configAvatar");
        if (avatar) avatar.innerHTML = inicialDe(nombre) || window.icono("persona", 24);
        const conexion = document.getElementById("configPerfilConexion");
        const indicador = document.getElementById("indicadorNube");
        if (conexion) {
            conexion.classList.toggle("oculto", !usaNubeReal() || !indicador);
            if (indicador) {
                conexion.textContent = indicador.textContent;
                conexion.dataset.estado = indicador.dataset.estado || "";
            }
        }

        const accesos = document.getElementById("masAccesos");
        if (accesos) {
            const tarjeta = (destino, icono, texto) =>
                `<button type="button" class="masAcceso" data-mas="${destino}"><span data-color="${destino}">${window.icono(icono, 22)}</span><strong>${texto}</strong></button>`;
            const lista = [
                { destino: "rutas", icono: "mapa", texto: "Rutas" },
                { destino: "estadisticas", icono: "grafico", texto: "Estadísticas" },
                { destino: "whatsapp", icono: "whatsapp", texto: "WhatsApp" },
                window.cierreVendeFrio?.disponible?.() ? { destino: "cierre", icono: "recibo", texto: "Cierre del día" } : null,
                !usaNubeReal() ? { destino: "historial", icono: "historial", texto: "Historial" } : null,
                // Accesos que suman otras partes (Etapa 7: A cobrar, Registro de cambios...).
                ...(window.accesosMasExtras || []).filter(acceso => {
                    if (acceso.enMas === false) return false;
                    try { return !acceso.mostrar || acceso.mostrar(); } catch (error) { return false; }
                })
            ].filter(Boolean);
            // Etapa 8: en tres grupos con título. Lo que no está en la lista va a Herramientas.
            const GRUPOS = [
                ["Plata", ["aCobrar", "cierre"]],
                ["Ventas", ["estadisticas", "mapaVentas", "cambios", "historial"]],
                ["Herramientas", []]
            ];
            const conocidos = GRUPOS.flatMap(([, destinos]) => destinos);
            accesos.innerHTML = GRUPOS.map(([titulo, destinos]) => {
                const delGrupo = destinos.length
                    ? destinos.map(destino => lista.find(acceso => acceso.destino === destino)).filter(Boolean)
                    : lista.filter(acceso => !conocidos.includes(acceso.destino));
                if (!delGrupo.length) return "";
                return `<h2 class="configGrupoTitulo masGrupoTitulo">${titulo}</h2><div class="masAccesos">` +
                    delGrupo.map(acceso => tarjeta(acceso.destino, acceso.icono, acceso.texto)).join("") + "</div>";
            }).join("");
        }

        const valores = {
            apariencia: { sistema: "Automática", claro: "Clara", oscuro: "Oscura" }[leer().tema || "sistema"],
            impresora: window.impresionVendeFrio?.impresoraGuardada?.()?.nombre || "Sin elegir",
            navegacion: { bicicleta: "Bicicleta", moto: "Moto", auto: "Auto", pie: "A pie" }[leer().vehiculo || "bicicleta"] || "Bicicleta"
        };
        document.querySelectorAll(".configValor[data-valor]").forEach(valor => {
            valor.textContent = valores[valor.dataset.valor] || "";
        });
    }

    function escaparTexto(texto) {
        return String(texto || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    // --- Nombre de la distribuidora (T13) ---
    let editandoNombre = false;

    function htmlNombreDistribuidora() {
        const distribuidora = window.distribuidoraVendeFrio;
        const usuario = window.cuentaVendeFrio?.usuarioActual();
        if (!distribuidora || !distribuidora.nombreActual || !usuario || !distribuidora.idActual()) return "";

        const nombre = distribuidora.nombreActual();
        const esDueno = distribuidora.idActual() === usuario.uid;

        if (editandoNombre && esDueno) {
            return `
                <form class="configCuentaFormulario configNombreDistribuidora" id="formNombreDistribuidora" novalidate>
                    <label>${window.icono("tienda",15)} Nombre de tu distribuidora
                        <input type="text" id="nombreDistribuidoraNuevo" autocomplete="organization"
                            maxlength="${distribuidora.largoMaximoNombre}" value="${escaparTexto(nombre)}" required>
                    </label>
                    <p class="configCuentaError oculto" id="nombreDistribuidoraError" role="alert"></p>
                    <button type="submit" class="configCuentaIngresar">Guardar nombre</button>
                    <button type="button" data-accion="cancelarNombreDistribuidora">Cancelar</button>
                </form>
            `;
        }

        return `<div class="configNombreDistribuidora">${filaEditable("tienda", "azul", "Distribuidora",
            escaparTexto(nombre) || "…", "cuentaNombreDistribuidora",
            esDueno ? "editarNombreDistribuidora" : "", "Cambiar nombre")}</div>`;
    }

    // --- Datos de la distribuidora para el ticket (T28c) ---
    // Solo el dueño: teléfono y, si tiene, dirección y CUIT. En el ticket
    // sale cada dato solo si está cargado.
    let editandoDatosTicket = false;

    function htmlDatosTicket() {
        const distribuidora = window.distribuidoraVendeFrio;
        const usuario = window.cuentaVendeFrio?.usuarioActual();
        if (!distribuidora || !distribuidora.datosTicket || !usuario || usuario.isAnonymous) return "";
        if (!distribuidora.idActual() || distribuidora.idActual() !== usuario.uid) return "";

        const datos = distribuidora.datosTicket();
        const largos = distribuidora.largosDatosTicket;

        if (editandoDatosTicket) {
            return `
                <form class="configCuentaFormulario" id="formDatosTicket" novalidate>
                    <label>${window.icono("telefono",15)} Teléfono de la distribuidora
                        <input type="tel" id="datosTicketTelefono" autocomplete="tel"
                            maxlength="${largos.telefono}" value="${escaparTexto(datos.telefono)}">
                    </label>
                    <label>${window.icono("ubicacion",15)} Dirección (si tiene local a la calle)
                        <input type="text" id="datosTicketDireccion" autocomplete="street-address"
                            maxlength="${largos.direccion}" value="${escaparTexto(datos.direccion)}">
                    </label>
                    <label>${window.icono("documento",15)} CUIT (si tiene)
                        <input type="text" id="datosTicketCuit" inputmode="numeric"
                            maxlength="${largos.cuit}" value="${escaparTexto(datos.cuit)}">
                    </label>
                    <p class="configEstado">Los que dejes vacíos no salen en el ticket.</p>
                    <button type="submit" class="configCuentaIngresar">Guardar datos del ticket</button>
                    <button type="button" data-accion="cancelarDatosTicket">Cancelar</button>
                </form>
            `;
        }

        const filas = [
            datos.telefono ? "Teléfono: " + escaparTexto(datos.telefono) : "",
            datos.direccion ? "Dirección: " + escaparTexto(datos.direccion) : "",
            datos.cuit ? "CUIT: " + escaparTexto(datos.cuit) : ""
        ].filter(Boolean);

        return `<div id="cuentaDatosTicket">${filaEditable("recibo", "violeta", "Datos para el ticket",
            filas.length ? filas.join("<br>") : "Todavía sin cargar: el ticket sale solo con el nombre.", "",
            "editarDatosTicket", filas.length ? "Cambiar datos del ticket" : "Cargar datos del ticket")}</div>`;
    }

    // --- Alias y QR para cobrar (T77) ---
    // Solo el dueño (cobrarQr.js guarda y muestra los datos).
    function htmlCobroTransferencia() {
        const cobrar = window.cobrarQrVendeFrio;
        const usuario = window.cuentaVendeFrio?.usuarioActual();
        const distribuidora = window.distribuidoraVendeFrio;
        if (!cobrar || !usuario || usuario.isAnonymous || !distribuidora || distribuidora.idActual() !== usuario.uid) return "";
        const datos = cobrar.datos();
        const valor = datos.alias
            ? escaparTexto(datos.alias) + (datos.qr ? " · con QR" : " · sin QR")
            : "Todavía sin cargar: se muestran al cobrar.";
        return `<div id="cuentaCobroTransferencia">${filaEditable("qr", "verde", "Alias y QR para cobrar", valor, "",
            "editarCobroTransferencia", datos.alias ? "Cambiar alias y QR" : "Cargar alias y QR")}</div>`;
    }

    // --- Nombre del dueño (T18) ---
    // Solo para el dueño de la distribuidora: así figura en lo que hace,
    // en vez de su email.
    let editandoNombreDueno = false;

    function htmlNombreDueno() {
        const distribuidora = window.distribuidoraVendeFrio;
        const usuario = window.cuentaVendeFrio?.usuarioActual();
        if (!distribuidora || !distribuidora.nombreDuenoActual || !usuario || usuario.isAnonymous) return "";
        if (!distribuidora.idActual() || distribuidora.idActual() !== usuario.uid) return "";

        const nombre = distribuidora.nombreDuenoActual();

        if (editandoNombreDueno) {
            return `
                <form class="configCuentaFormulario" id="formNombreDueno" novalidate>
                    <label>${window.icono("persona",15)} Tu nombre
                        <input type="text" id="nombreDuenoNuevo" autocomplete="name"
                            maxlength="${distribuidora.largoMaximoNombreDueno}" value="${escaparTexto(nombre)}" required>
                    </label>
                    <p class="configCuentaError oculto" id="nombreDuenoError" role="alert"></p>
                    <button type="submit" class="configCuentaIngresar">Guardar mi nombre</button>
                    <button type="button" data-accion="cancelarNombreDueno">Cancelar</button>
                </form>
            `;
        }

        return filaEditable("persona", "verde", "Tu nombre (dueño)",
            escaparTexto(nombre) || "Todavía sin cargar", "cuentaNombreDueno", "editarNombreDueno", "Cambiar mi nombre");
    }

    function htmlDistribuidora() {
        const estado = window.distribuidoraVendeFrio?.estado() || "noDisponible";

        const textos = {
            verificando: "Revisando tu distribuidora en la nube…",
            lista: "Tu distribuidora está lista en la nube.",
            creada: "Se creó tu distribuidora en la nube.",
            sinConexion: "No se pudo revisar tu distribuidora: no hay conexión. Se reintenta sola cuando vuelva la señal.",
            sinPermiso: "La nube todavía no permite crear tu distribuidora. Falta publicar las reglas de seguridad en Firebase.",
            error: "No se pudo revisar tu distribuidora. Probá de nuevo.",
            noDisponible: "La nube no está disponible en este momento."
        };

        const texto = textos[estado];
        if (!texto) return "";

        const reintentar = ["sinConexion", "sinPermiso", "error"].includes(estado)
            ? `<button type="button" data-accion="reintentarDistribuidora">Reintentar</button>`
            : "";

        return `
            <p class="ajFila ajEstadoFila" id="cuentaDistribuidora" data-estado="${estado}">${ico(["lista", "creada"].includes(estado) ? "check" : "nube", 16)}<span>${texto}</span></p>
            ${reintentar}
        `;
    }

    // --- Subir mis datos a la nube (T11) ---
    // Estado de la migración mientras está abierta la app.
    const migracion = {
        respaldo: null,
        progreso: "",
        resultado: null,
        error: ""
    };

    function horaCorta(fecha) {
        return fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    }

    function htmlResultadoMigracion() {
        const resultado = migracion.resultado;
        if (!resultado) return "";

        const filas = resultado.totales.map(total => {
            const coincide = total.enLaNube === total.enEsteCelular;
            return `<li class="${coincide ? "migracionOk" : "migracionFalta"}">
                ${total.nombre}: ${total.enLaNube} de ${total.enEsteCelular} ${coincide ? "✓" : "✗"}
            </li>`;
        }).join("");

        const titulo = resultado.completo
            ? "Todo verificado: los totales coinciden."
            : "Faltan datos en la nube. Tocá Reintentar: lo que ya se subió no se repite.";

        return `
            <div class="configEstado migracionResumen" id="migracionResumen">
                <strong>${titulo}</strong>
                <ul>${filas}</ul>
            </div>
        `;
    }

    // Solo nube (T16c): se ofrece una sola vez por celular, solo al dueño con
    // datos propios y antes de entrar a la nube.
    function htmlMigracion() {
        const nube = window.nubeVendeFrio;
        const distribuidora = window.distribuidoraVendeFrio;
        if (!nube || !nube.subirDatos || nube.modoNube()) return "";
        if (!window.inicioVendeFrio?.ofrecerSubirDatos?.()) return "";

        if (!distribuidora || !distribuidora.idActual()) {
            return `
                <p class="configEstado">
                    <strong>Subir mis datos a la nube</strong><br>
                    Primero tiene que estar lista tu distribuidora en la nube.
                </p>
            `;
        }

        const enCurso = nube.migracionEnCurso();
        const verificada = nube.migracionVerificada() && migracion.resultado && migracion.resultado.completo;
        const respaldoListo = Boolean(migracion.respaldo);

        const textoRespaldo = respaldoListo
            ? `✓ Respaldo descargado a las ${horaCorta(migracion.respaldo)}`
            : "1. Exportar respaldo";

        const textoSubir = enCurso
            ? "Subiendo tus datos…"
            : migracion.resultado || migracion.error
                ? "Reintentar"
                : "2. Subir mis datos";

        return `
            <div class="configMigracion">
                <p class="configEstado">
                    <strong>Subir mis datos a la nube</strong><br>
                    Copia tus comercios, productos, pedidos y rutas de este celular
                    a tu distribuidora en la nube. Conviene hacerlo sin pedidos
                    pendientes, por ejemplo al final del día después de repartir.
                    Todos los pedidos del historial quedan como "histórico".
                    Los datos de este celular no se borran.
                </p>
                <button type="button" data-accion="migracionRespaldo" ${enCurso ? "disabled" : ""}>
                    ${textoRespaldo}
                </button>
                ${verificada ? "" : `
                <button type="button" data-accion="migracionSubir"
                    ${enCurso || !respaldoListo ? "disabled" : ""}>
                    ${textoSubir}
                </button>`}
                <p class="configEstado ${migracion.progreso ? "" : "oculto"}" id="migracionProgreso" role="status">
                    ${escaparTexto(migracion.progreso)}
                </p>
                ${migracion.error ? `<p class="configEstado migracionError" role="alert">${escaparTexto(migracion.error)}</p>` : ""}
                ${htmlResultadoMigracion()}
                ${verificada ? `
                <button type="button" data-accion="migracionUsarNube" class="configCuentaIngresar">
                    3. Usar la nube desde ahora
                </button>` : ""}
            </div>
            ${enCurso || verificada || !nube.usarNube ? "" : `
            <div class="configMigracion">
                <p class="configEstado">
                    <strong>¿No querés subirlos?</strong><br>
                    Usá la nube sin subir los datos de este celular. Quedan
                    guardados acá, sin cambios, pero la app ya no los muestra.
                    En este celular no se vuelve a ofrecer subirlos.
                </p>
                <button type="button" data-accion="noSubirDatos">
                    No subirlos y usar la nube
                </button>
            </div>`}
        `;
    }

    // --- Sincronización visible (T12) ---
    function textoSincronizacion() {
        const nube = window.nubeVendeFrio;
        if (!nube || !nube.sincronizacion) return "";

        const sinSubir = nube.sincronizacion().sinSubir;
        if (!sinSubir) return "✓ Todos los cambios de este celular están en la nube.";

        return (sinSubir === 1 ? "1 cambio espera" : sinSubir + " cambios esperan") +
            " para subir a la nube. Se suben solos cuando haya señal.";
    }

    function htmlSincronizacion() {
        return `<p class="configEstado" id="sincronizacionNube" role="status">${textoSincronizacion()}</p>`;
    }

    function htmlModoNube() {
        const nube = window.nubeVendeFrio;
        if (!nube || !nube.modoNube || !nube.modoNube()) return "";

        const textos = {
            conectando: "Conectando con la nube…",
            conectada: "Conectada: los cambios se ven en los otros celulares con esta cuenta.",
            sinConexion: "Sin señal: los cambios se guardan en el celular y se suben solos cuando vuelva internet.",
            sinPermiso: "La nube no deja leer tu distribuidora. Revisá que las reglas de seguridad estén publicadas.",
            error: "Hubo un problema con la nube. Probá de nuevo."
        };
        const estadoNube = nube.estado();
        const reintentar = ["sinConexion", "sinPermiso", "error"].includes(estadoNube)
            ? `<button type="button" data-accion="reintentarNube">Reintentar</button>`
            : "";

        return `
            <p class="configEstado">
                <strong>Usando la nube</strong><br>
                Tus datos salen de tu distribuidora en la nube.
            </p>
            <p class="configEstado" id="estadoNube">${textos[estadoNube] || ""}</p>
            ${htmlSincronizacion()}
            ${reintentar}
            <button type="button" data-accion="juntarRepetidos">
                Juntar comercios y productos repetidos
            </button>
        `;
    }

    // --- Respaldo de la nube (T16b) ---
    function textoUltimoRespaldoNube() {
        const fecha = obtenerFechaUltimoRespaldoNube();
        return fecha ? fecha.toLocaleString("es-AR") : "todavía ninguno";
    }

    function textoConexionRespaldo() {
        const nube = window.nubeVendeFrio;

        if (!nube?.modoNube?.()) {
            return "La nube no está disponible. Cerrá y volvé a abrir la app con internet.";
        }

        return nube.estado() === "conectada"
            ? "✓ Conectada: el archivo va a tener lo último de la nube."
            : "Para exportar, esperá a que abajo diga \"Conectada\". Hace falta internet.";
    }

    function htmlRespaldoNube() {
        return grupo("Respaldo de la nube",
                filaDato("historial", "gris", "Último respaldo descargado en este celular", textoUltimoRespaldoNube(), "configUltimoRespaldoNube") +
                `<p class="ajFila ajEstadoFila" id="configConexionRespaldo" role="status">${textoConexionRespaldo()}</p>` +
                filaAccion("descargar", "azul", "Exportar respaldo", "Un archivo con todo lo de la nube", 'data-accion="exportar"') +
                filaAccion("refrescar", "violeta", "Combinar respaldo", "Suma lo que falte de un archivo, sin borrar nada", 'data-accion="importar"') +
                // T61: cada cuánto avisa en Inicio.
                filaElegir("alarma", "naranja", "Recordarme el respaldo", "Aviso en Inicio si pasa este tiempo sin descargarlo", "recordarRespaldo", [
                    ["diario", "Cada día"], ["semanal", "Cada semana"], ["mensual", "Cada mes"], ["nunca", "Nunca"]
                ])) +
            nota("Descargá un respaldo una vez por semana y guardalo en un lugar seguro, como Google Drive. Al combinar, lo que ya está en la nube tiene prioridad.");
    }

    // --- Limpieza de los datos viejos del celular (T16e) ---
    // Solo el dueño en la nube y solo si el celular tiene datos viejos.
    // 1) descargar un archivo con todo; 2) revisar con internet qué está en
    // la nube; 3) borrar con confirmación. Si algo falta en la nube, se
    // muestra y se deja borrar igual: queda en el archivo (decidido con el
    // dueño el 2026-10-11).
    const MAX_FALTANTES_A_MOSTRAR = 10;
    const limpieza = {
        firma: null,
        descargado: null,
        revision: null,
        revisando: false,
        error: ""
    };

    function reiniciarLimpieza() {
        limpieza.firma = null;
        limpieza.descargado = null;
        limpieza.revision = null;
        limpieza.revisando = false;
        limpieza.error = "";
    }

    function htmlFaltantes(total) {
        if (!total.faltan.length) return "";

        const nombres = total.faltan.slice(0, MAX_FALTANTES_A_MOSTRAR).map(escaparTexto).join(", ");
        const resto = total.faltan.length - MAX_FALTANTES_A_MOSTRAR;

        return `<small class="limpiezaFaltan">Faltan: ${nombres}${resto > 0 ? ` y ${resto} más` : ""}.</small>`;
    }

    function htmlRevisionLimpieza() {
        const revision = limpieza.revision;
        if (!revision) return "";

        const filas = revision.totales.map(total => {
            const coincide = !total.faltan.length;
            return `<li class="${coincide ? "migracionOk" : "migracionFalta"}">
                ${total.nombre}: ${total.enLaNube} de ${total.enEsteCelular} ${coincide ? "✓" : "✗"}
                ${htmlFaltantes(total)}
            </li>`;
        }).join("");

        const titulo = revision.completo
            ? "Todo está en la nube."
            : "Faltan datos en la nube. Si borrás, quedan solo en el archivo que descargaste.";

        return `
            <div class="configEstado migracionResumen">
                <strong>${titulo}</strong>
                <ul>${filas}</ul>
            </div>
        `;
    }

    function htmlLimpiezaDatosViejos() {
        if (!puedeLimpiarDatosViejos() || !celularTieneDatosViejos()) return "";

        const descargado = Boolean(limpieza.descargado);
        const textoDescargar = descargado
            ? `✓ Archivo descargado a las ${horaCorta(limpieza.descargado)}`
            : "1. Descargar archivo";
        const textoRevisar = limpieza.revisando
            ? "Revisando la nube…"
            : limpieza.revision || limpieza.error
                ? "Revisar de nuevo"
                : "2. Revisar en la nube";
        const paso = (numero, hecho, boton) => `
            <div class="ajPaso${hecho ? " hecho" : ""}">
                <span class="ajNumeroPaso">${hecho ? ico("check", 16) : numero}</span>
                ${boton}
            </div>`;

        return `
            <section class="ajGrupo configMigracion" id="configLimpiezaDatosViejos">
                <h3 class="ajGrupoTitulo">Datos viejos de este celular</h3>
                <div class="ajTarjeta">
                    <div class="ajFila ajTextoLargo">
                        <span class="ajIcono" data-tono="naranja">${ico("celular")}</span>
                        <span class="ajTexto"><strong>La app ya no los usa</strong><small>Comercios, productos, pedidos, rutas y la copia interna de antes de la nube. Podés borrarlos en tres pasos. La nube no se toca.</small></span>
                    </div>
                    <div class="ajPasos">
                        ${paso(1, descargado, `<button type="button" data-accion="limpiezaDescargar" ${limpieza.revisando ? "disabled" : ""}>${textoDescargar}</button>`)}
                        ${paso(2, Boolean(limpieza.revision), `<button type="button" data-accion="limpiezaRevisar" ${limpieza.revisando || !descargado ? "disabled" : ""}>${textoRevisar}</button>`)}
                        ${limpieza.error ? `<p class="configEstado migracionError" role="alert">${escaparTexto(limpieza.error)}</p>` : ""}
                        ${htmlRevisionLimpieza()}
                        ${paso(3, false, `<button type="button" data-accion="limpiezaBorrar" class="configPeligro" ${limpieza.revisando || !descargado || !limpieza.revision ? "disabled" : ""}>${ico("tacho", 14)} 3. Borrar datos viejos</button>`)}
                    </div>
                </div>
            </section>
            ${nota("Quedan tus preferencias, el borrador del pedido y tu sesión.")}
        `;
    }

    // Se cambian solo los textos, sin redibujar la sección.
    function actualizarRespaldoNube() {
        const ultimo = document.getElementById("configUltimoRespaldoNube");
        const conexion = document.getElementById("configConexionRespaldo");

        if (ultimo) ultimo.textContent = textoUltimoRespaldoNube();
        if (conexion) conexion.textContent = textoConexionRespaldo();
    }

    // --- Empleados (T14) y panel del dueño (T15) ---
    // Último código generado mientras está abierta la app.
    let codigoGenerado = null;
    let generandoCodigo = false;
    let quitarOyenteEmpleados = null;
    let quitarOyenteCodigos = null;
    let quitarOyenteRoles = null;
    let ultimaListaEmpleados = [];
    // Empleado al que se le están cambiando los roles (T15).
    let editandoRolesDe = null;
    let editorRolesAbierto = false;

    function fechaYHora(fecha) {
        return fecha.toLocaleString("es-AR", {
            day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
        });
    }

    function textoParaCompartir(codigo) {
        const empleados = window.empleadosVendeFrio;
        const nombre = window.distribuidoraVendeFrio?.nombreActual?.() || "la distribuidora";

        return "Tu código para entrar a VendeFrío (" + nombre + "): " +
            empleados.formatearCodigo(codigo.codigo) + "\n" +
            "Abrí " + window.location.origin + "/ , elegí \"Empleado\" y escribilo. " +
            "Sirve una sola vez. Vence: " + fechaYHora(codigo.vence);
    }

    function htmlCodigoGenerado() {
        if (!codigoGenerado) return "";

        const empleados = window.empleadosVendeFrio;
        const titulo = codigoGenerado.tipo === "reingreso"
            ? "Código de reingreso para " + escaparTexto(codigoGenerado.nombre || "el empleado")
            : "Código para un empleado nuevo";

        return `
            <div class="empleadoCodigo" id="empleadoCodigoGenerado">
                <small>${titulo}</small>
                <strong>${escaparTexto(empleados.formatearCodigo(codigoGenerado.codigo))}</strong>
                <small>
                    Sirve una sola vez. Vence: ${fechaYHora(codigoGenerado.vence)}<br>
                    ${codigoGenerado.tipo === "reingreso"
                        ? "Cuando lo use en el celular nuevo, el celular viejo pierde el acceso."
                        : "El empleado elige \"Empleado\" en la pantalla de inicio y lo escribe."}
                </small>
            </div>
            <div class="configAcciones">
                <button type="button" data-accion="copiarCodigo">${ico("copiar", 16)} Copiar</button>
                <button type="button" data-accion="compartirCodigo">${ico("compartir", 16)} Compartir</button>
            </div>
        `;
    }

    function casillasDeRoles(marcados) {
        return window.empleadosVendeFrio.roles().map(rol => `
            <label class="inicioRol">
                <input type="checkbox" value="${escaparTexto(rol.id)}" ${marcados.has(rol.id) ? "checked" : ""}>
                <span>${escaparTexto(rol.nombre)}</span>
            </label>
        `).join("");
    }

    function htmlEmpleadoActivo(empleado, marcadosEnPantalla) {
        const empleados = window.empleadosVendeFrio;
        const roles = empleados.nombresDeRoles(empleado.roles);
        const datos = `
            data-empleado="${escaparTexto(empleado.id)}"
            data-nombre="${escaparTexto(empleado.nombre)}"
        `;

        if (editandoRolesDe === empleado.id) {
            const marcados = marcadosEnPantalla || new Set(empleado.roles);
            return `
                <li class="empleadoFila">
                    <strong>${escaparTexto(empleado.nombre) || "Sin nombre todavía"}</strong>
                    <div class="empleadoRoles" id="empleadoRolesEdicion">${casillasDeRoles(marcados)}</div>
                    <div class="configAcciones">
                        <button type="button" data-accion="cancelarRolesEmpleado">Cancelar</button>
                        <button type="button" data-accion="guardarRolesEmpleado" class="configCuentaIngresar" ${datos}>
                            Guardar roles
                        </button>
                    </div>
                </li>
            `;
        }

        // Roles con "Cobra" que eligió el empleado y esperan tu aprobación (T29d).
        const pendientes = empleados.rolesPendientesDe(empleado).map(idRol => `
            <div class="empleadoRolPendiente">
                <span><strong>${escaparTexto(empleados.nombresDeRoles([idRol])[0] || "Un rol")}</strong>
                    · Pendiente de aprobar<br>
                    <small>Tiene «Cobra»: hasta que lo apruebes, no registra cobros.</small></span>
                <div class="configAcciones">
                    <button type="button" data-accion="rechazarRol" data-rol="${escaparTexto(idRol)}" ${datos}>Rechazar</button>
                    <button type="button" data-accion="aprobarRol" data-rol="${escaparTexto(idRol)}" class="configCuentaIngresar" ${datos}>Aprobar</button>
                </div>
            </div>
        `).join("");

        return `
            <li class="empleadoFila empleadoTarjeta">
                <div class="empleadoCabeza">
                    <span class="empleadoAvatar">${escaparTexto(inicialDe(empleado.nombre) || "?")}</span>
                    <span class="empleadoTexto">
                        <strong>${escaparTexto(empleado.nombre) || "Sin nombre todavía"}</strong>
                        <small>Activo · ${roles.length ? escaparTexto(roles.join(", ")) : "Sin roles"}</small>
                    </span>
                </div>
                ${pendientes}
                <div class="empleadoBotones">
                    <button type="button" data-accion="cambiarRolesEmpleado" aria-label="Cambiar roles" ${datos}>${ico("lapiz", 16)}<span>Roles</span></button>
                    <button type="button" data-accion="codigoReingreso" aria-label="Código de reingreso" ${datos}
                        ${generandoCodigo ? "disabled" : ""}>${ico("llave", 16)}<span>Reingreso</span></button>
                    <button type="button" data-accion="darDeBaja" class="empleadoBaja" aria-label="Dar de baja" ${datos}>${ico("salir", 16)}<span>Baja</span></button>
                </div>
            </li>
        `;
    }

    function htmlListaEmpleados(lista) {
        const empleados = window.empleadosVendeFrio;

        if (!lista.length) {
            return `<p class="ajVacio">${ico("usuarios", 22)}<span>Todavía no entró ningún empleado.</span></p>`;
        }

        // Al redibujar se conservan las casillas que se están marcando.
        let marcadosEnPantalla = null;
        const caja = document.getElementById("empleadoRolesEdicion");
        if (caja && editandoRolesDe) {
            marcadosEnPantalla = new Set(
                Array.from(caja.querySelectorAll("input:checked")).map(casilla => casilla.value)
            );
        }

        const activos = lista.filter(empleado => empleado.activo);
        const deBaja = lista.filter(empleado => !empleado.activo);

        return `
            ${activos.length ? `
                <ul class="empleadoLista">
                    ${activos.map(empleado => htmlEmpleadoActivo(empleado, marcadosEnPantalla)).join("")}
                </ul>
            ` : `<p class="ajVacio">${ico("usuarios", 22)}<span>No hay empleados activos.</span></p>`}
            ${deBaja.length ? `
                <h4 class="ajSubtitulo">Dados de baja</h4>
                ${nota("Ya no tienen acceso. Su nombre sigue en el historial. Para que uno vuelva, generale un código nuevo.")}
                <ul class="empleadoLista">
                    ${deBaja.map(empleado => {
                        const roles = empleados.nombresDeRoles(empleado.roles);
                        return `
                            <li class="empleadoFila empleadoDeBaja">
                                <strong>${escaparTexto(empleado.nombre) || "Sin nombre"}</strong>
                                <small>Dado de baja${empleado.baja ? " el " + escaparTexto(fechaYHora(empleado.baja)) : ""}
                                    · ${roles.length ? escaparTexto(roles.join(", ")) : "Sin roles"}</small>
                            </li>
                        `;
                    }).join("")}
                </ul>
            ` : ""}
        `;
    }

    function htmlListaCodigos(lista) {
        const empleados = window.empleadosVendeFrio;

        if (!lista.length) {
            return `<p class="ajVacio">${ico("llave", 22)}<span>No hay códigos sin usar.</span></p>`;
        }

        const nombrePorId = new Map(ultimaListaEmpleados.map(empleado => [empleado.id, empleado.nombre]));

        return `
            <ul class="empleadoLista">
                ${lista.map(codigo => {
                    const para = codigo.tipo === "reingreso"
                        ? "Reingreso de " + (nombrePorId.get(codigo.idEmpleado) || "un empleado")
                        : "Empleado nuevo";
                    return `
                        <li class="empleadoFila">
                            <strong class="empleadoCodigoTexto">${escaparTexto(empleados.formatearCodigo(codigo.codigo))}</strong>
                            <small>${escaparTexto(para)} · vence ${escaparTexto(fechaYHora(codigo.vence))}</small>
                            <button type="button" data-accion="anularCodigo" class="empleadoBaja"
                                data-codigo="${escaparTexto(codigo.codigo)}">${ico("cerrarX", 15)} Anular</button>
                        </li>
                    `;
                }).join("")}
            </ul>
        `;
    }

    // Casillas de permiso de un rol (T19). Se guardan al tocarlas.
    function htmlPermisosDeRol(rol) {
        const marcados = new Set(rol.permisos || []);

        return `
            <fieldset class="rolPermisos">
                <legend>Permisos</legend>
                ${window.empleadosVendeFrio.permisos().map(permiso => `
                    <label class="inicioRol">
                        <input type="checkbox" class="rolPermiso" data-rol="${escaparTexto(rol.id)}"
                            value="${escaparTexto(permiso.id)}" ${marcados.has(permiso.id) ? "checked" : ""}>
                        <span>${escaparTexto(permiso.nombre)}</span>
                    </label>
                `).join("")}
            </fieldset>
        `;
    }

    function htmlEditorRoles() {
        const empleados = window.empleadosVendeFrio;

        if (!editorRolesAbierto) {
            return `<button type="button" data-accion="editarRoles">Editar roles</button>`;
        }

        return `
            <ul class="empleadoLista">
                ${empleados.roles().map(rol => `
                    <li class="empleadoFila">
                        <label>Nombre del rol
                            <input type="text" class="empleadoRolNombre" data-rol="${escaparTexto(rol.id)}"
                                value="${escaparTexto(rol.nombre)}" maxlength="${empleados.largoMaximoRol}">
                        </label>
                        <div class="configAcciones">
                            <button type="button" data-accion="renombrarRol" data-rol="${escaparTexto(rol.id)}">Guardar nombre</button>
                            <button type="button" data-accion="eliminarRol" data-rol="${escaparTexto(rol.id)}"
                                data-nombre="${escaparTexto(rol.nombre)}" class="empleadoBaja">Eliminar</button>
                        </div>
                        ${htmlPermisosDeRol(rol)}
                    </li>
                `).join("")}
            </ul>
            <label>Rol nuevo
                <input type="text" id="empleadoRolNuevo" maxlength="${empleados.largoMaximoRol}"
                    placeholder="Por ejemplo: Encargado de depósito">
            </label>
            <button type="button" data-accion="agregarRol" class="configCuentaIngresar">Agregar rol</button>
            <button type="button" data-accion="cerrarEditorRoles">Listo</button>
        `;
    }

    // "Todos pueden hacer todo" (T29d): solo la cambia el dueño.
    function htmlLlaveEquipo() {
        const prendida = window.empleadosVendeFrio.todosPuedenTodo();
        return `
            <div class="llaveEquipo">
                <label class="ajFila">
                    <span class="ajIcono" data-tono="verde">${ico("usuarios")}</span>
                    <span class="ajTexto"><strong>Todos pueden hacer todo</strong>
                    <small id="textoLlaveEquipo">${htmlTextoLlave(prendida)}</small></span>
                    <input type="checkbox" class="ajLlave" role="switch" id="llaveTodosPuedenTodo" aria-label="Todos pueden hacer todo" ${prendida ? "checked" : ""}>
                </label>
                <p class="ajFila ajEstadoFila">
                    ${ico("escudo", 16)}<span>Siempre, prendida o apagada: cobrar es solo tuyo y de quien tiene
                    un rol con «Cobra» aprobado por vos. Editar, eliminar y cancelar un
                    pedido, solo quien lo cargó y vos.</span>
                </p>
            </div>
        `;
    }

    // "Quién ve la plata" (T93): solo lo cambia el dueño.
    const TEXTOS_VER_PLATA = {
        dueno: "Solo vos ves cuánto se vendió. Los demás ven cantidades.",
        cobra: "Vos y quien tiene «Cobra» ven cuánto se vendió. Los demás ven cantidades.",
        todos: "Todo el equipo ve cuánto se vendió."
    };

    function htmlVerPlata() {
        const elegida = window.verPlataVendeFrio?.opcion?.() || "cobra";
        const opciones = [["dueno", "Solo yo"], ["cobra", "Yo y quien cobra"], ["todos", "Todos"]];
        return `
            <label class="ajFila">
                <span class="ajIcono" data-tono="verde">${ico("moneda")}</span>
                <span class="ajTexto"><strong>Quién ve la plata</strong>
                <small id="textoVerPlata">${TEXTOS_VER_PLATA[elegida]}</small></span>
                <select id="elegirVerPlata" aria-label="Quién ve la plata">
                    ${opciones.map(([valor, texto]) => `<option value="${valor}"${valor === elegida ? " selected" : ""}>${texto}</option>`).join("")}
                </select>
            </label>
            <p class="ajFila ajEstadoFila">
                ${ico("info", 16)}<span>Vale para Inicio, Estadísticas, las metas y el resumen de la noche.
                Cobrar, el Cierre del día y «A cobrar» siguen siendo de quien tiene «Cobra».</span>
            </p>
        `;
    }

    function htmlTextoLlave(prendida) {
        return prendida
            ? "Prendida: cualquiera del equipo hace cualquier paso de cualquier pedido, anota faltantes y resuelve incidencias. Los roles deciden solo a quién le llega cada aviso."
            : "Apagada: cada uno según los permisos de sus roles.";
    }

    function htmlEmpleados() {
        const empleados = window.empleadosVendeFrio;

        if (!empleados || !empleados.esDueno()) {
            return grupo("", `
                <div class="ajFila ajTextoLargo">
                    <span class="ajIcono" data-tono="gris">${ico("usuarios")}</span>
                    <span class="ajTexto"><strong>Solo para el dueño</strong><small>Solo el dueño de la distribuidora, con su cuenta iniciada, puede ver los empleados y generar códigos.</small></span>
                </div>`);
        }

        return `
            ${grupo("Equipo", htmlLlaveEquipo())}
            ${grupo("Plata", htmlVerPlata())}
            <section class="ajGrupo">
                <h3 class="ajGrupoTitulo">Sumar un empleado</h3>
                <div class="ajTarjeta ajTarjetaRelleno">
                    <div class="ajFila ajTextoLargo">
                        <span class="ajIcono" data-tono="azul">${ico("llave")}</span>
                        <span class="ajTexto"><strong>Código de ingreso</strong><small>Pasáselo al empleado en persona o por WhatsApp. Tiene ${empleados.largoCodigo} caracteres, sirve una sola vez y vence a las ${empleados.horasDeVigencia} horas. Hace falta internet.</small></span>
                    </div>
                    <button type="button" data-accion="generarCodigo" class="configCuentaIngresar ajBotonPrincipal"
                        ${generandoCodigo ? "disabled" : ""}>
                        ${ico("mas", 18)} ${generandoCodigo ? "Generando código…" : "Generar código para un empleado nuevo"}
                    </button>
                    ${htmlCodigoGenerado()}
                </div>
            </section>
            <section class="ajGrupo">
                <h3 class="ajGrupoTitulo">Códigos sin usar</h3>
                <div id="listaCodigos">${htmlListaCodigos([])}</div>
                ${nota("Si pasaste un código por error o a la persona equivocada, anulalo.")}
            </section>
            <section class="ajGrupo">
                <h3 class="ajGrupoTitulo">Tus empleados</h3>
                <div id="listaEmpleados">${htmlListaEmpleados([])}</div>
                ${nota("Si un empleado cambia de celular o se le borran los datos, tocá «Reingreso»: vuelve a ser el mismo empleado, con su nombre y sus roles.")}
            </section>
            <section class="ajGrupo">
                <h3 class="ajGrupoTitulo">Roles</h3>
                ${nota("Una persona puede lo que permite cualquiera de sus roles. Vos podés todo. Con «Todos pueden hacer todo» prendida, los permisos deciden solo a quién le llega cada aviso y quién cobra.")}
                <div id="editorRoles">${htmlEditorRoles()}</div>
            </section>
        `;
    }

    function dibujarListaEmpleados(lista) {
        ultimaListaEmpleados = lista;
        if (editandoRolesDe && !lista.some(empleado => empleado.id === editandoRolesDe && empleado.activo)) {
            editandoRolesDe = null;
        }
        const caja = document.getElementById("listaEmpleados");
        if (caja) caja.innerHTML = htmlListaEmpleados(lista);
    }

    function dibujarListaCodigos(lista) {
        // Si el código recién generado ya se usó o se anuló, deja de mostrarse.
        if (codigoGenerado && !lista.some(codigo => codigo.codigo === codigoGenerado.codigo) &&
            document.getElementById("empleadoCodigoGenerado")) {
            codigoGenerado = null;
            detalle("empleados");
            return;
        }
        const caja = document.getElementById("listaCodigos");
        if (caja) caja.innerHTML = htmlListaCodigos(lista);
    }

    // Al redibujar (por ejemplo, por un cambio que llega de otro celular)
    // no se pierde lo que se estaba escribiendo.
    function dibujarEditorRoles() {
        const caja = document.getElementById("editorRoles");
        if (!caja) return;

        const escritos = new Map();
        caja.querySelectorAll(".empleadoRolNombre").forEach(campo => {
            if (campo.value !== campo.defaultValue) escritos.set(campo.dataset.rol, campo.value);
        });
        const rolNuevo = document.getElementById("empleadoRolNuevo")?.value || "";
        const enfocado = document.activeElement && caja.contains(document.activeElement)
            ? (document.activeElement.id || document.activeElement.dataset.rol || "")
            : "";

        caja.innerHTML = htmlEditorRoles();

        caja.querySelectorAll(".empleadoRolNombre").forEach(campo => {
            if (escritos.has(campo.dataset.rol)) campo.value = escritos.get(campo.dataset.rol);
            if (enfocado && campo.dataset.rol === enfocado) campo.focus();
        });
        const campoNuevo = document.getElementById("empleadoRolNuevo");
        if (campoNuevo) {
            campoNuevo.value = rolNuevo;
            if (enfocado === "empleadoRolNuevo") campoNuevo.focus();
        }
    }

    function escucharListaEmpleados() {
        const empleados = window.empleadosVendeFrio;
        if (quitarOyenteEmpleados || !empleados?.esDueno()) return;
        quitarOyenteEmpleados = empleados.escucharEmpleados(dibujarListaEmpleados);
        quitarOyenteCodigos = empleados.escucharCodigos(dibujarListaCodigos);
        quitarOyenteRoles = empleados.escucharRoles(dibujarEditorRoles);
    }

    function dejarDeEscucharListaEmpleados() {
        [quitarOyenteEmpleados, quitarOyenteCodigos, quitarOyenteRoles].forEach(quitar => {
            if (quitar) quitar();
        });
        quitarOyenteEmpleados = null;
        quitarOyenteCodigos = null;
        quitarOyenteRoles = null;
    }

    function generarCodigo(idEmpleado, nombre) {
        generandoCodigo = true;
        if (seccionAbierta === "empleados") detalle("empleados");

        window.empleadosVendeFrio.generarCodigo(idEmpleado)
            .then(codigo => {
                codigoGenerado = { ...codigo, nombre };
            })
            .catch(error => mostrarAviso("No se pudo generar el código", error.message))
            .finally(() => {
                generandoCodigo = false;
                if (seccionAbierta === "empleados") {
                    detalle("empleados");
                    document.getElementById("empleadoCodigoGenerado")
                        ?.scrollIntoView({ block: "center", behavior: "smooth" });
                }
            });
    }

    // Filas del menú que dependen de quién usa el celular.
    function actualizarFilasSegunCuenta() {
        const empleados = window.empleadosVendeFrio;
        document.getElementById("configFilaEmpleados")
            ?.classList.toggle("oculto", !(empleados && empleados.esDueno()));
        // Avisos (T23): solo en la nube, con cuenta o con código.
        document.getElementById("configFilaAvisos")
            ?.classList.toggle("oculto", !window.avisosVendeFrio?.disponible?.());
        // Impresora (T28b): solo en la nube y con Web Bluetooth (no en iPhone).
        document.getElementById("configFilaImpresora")
            ?.classList.toggle("oculto", !window.impresionVendeFrio?.disponible?.());
    }

    // --- Impresora (T28b): la guardada en este celular y "Cambiar impresora" ---
    function htmlImpresora() {
        const impresion = window.impresionVendeFrio;

        if (!impresion || !impresion.disponible()) {
            return grupo("", `
                <div class="ajFila ajTextoLargo">
                    <span class="ajIcono" data-tono="gris">${ico("impresora")}</span>
                    <span class="ajTexto"><strong>Impresora no disponible</strong><small>Los tickets se imprimen por Bluetooth desde un celular Android con Chrome, con tu cuenta o con el código de tu encargado.</small></span>
                </div>`);
        }

        const guardada = impresion.impresoraGuardada();

        return grupo("Impresora de este celular",
                filaDato("impresora", guardada ? "verde" : "gris", "Impresora guardada",
                    guardada ? escaparTexto(guardada.nombre) : "Todavía no elegiste ninguna") +
                filaAccion("impresora", "azul", guardada ? "Cambiar impresora" : "Elegir impresora",
                    "Abre la lista de impresoras Bluetooth", 'data-accion="cambiarImpresora"')) +
            nota(guardada
                ? "Se conecta recién al imprimir, nunca al abrir la app. Vale solo para este celular."
                : "También se elige sola la primera vez que tocás «Imprimir ticket» en un pedido. Se conecta recién al imprimir y vale solo para este celular.");
    }

    // --- Avisos (T23): qué avisos recibe cada persona ---
    function htmlAvisos() {
        const avisos = window.avisosVendeFrio;

        if (!avisos || !avisos.disponible()) {
            return grupo("", `
                <div class="ajFila ajTextoLargo">
                    <span class="ajIcono" data-tono="gris">${ico("campana")}</span>
                    <span class="ajTexto"><strong>Avisos del equipo</strong><small>Son para el equipo de la distribuidora: hace falta entrar con tu cuenta o con el código de tu encargado.</small></span>
                </div>`);
        }

        const empleados = window.empleadosVendeFrio;
        const nombresPermisos = empleados?.permisos?.() || [];
        const ICONOS = { pedidoNuevo: "bolsa", preparado: "paquete", entregado: "check", faltante: "alerta", pedidoEditado: "lapiz", pedidoCancelado: "cerrarX", incidencia: "bandera", incidenciaResuelta: "check", rolPendiente: "usuarios", cobro: "moneda", cobroPendiente: "moneda" };
        const casillas = avisos.tipos().map((tipo, numero) => {
            const permiso = nombresPermisos.find(item => item.id === tipo.permiso);
            // Los avisos van por los roles, no por "Todos pueden hacer todo" (T29d).
            const sinPermiso = permiso && !empleados.tieneEnSusRoles(tipo.permiso)
                ? `<em>Hoy no te llega: no tenés el permiso "${escaparTexto(permiso.nombre)}".</em>`
                : "";
            const tonos = ["azul", "verde", "violeta", "naranja", "rojo"];

            return `
                <label class="ajFila configAviso">
                    <span class="ajIcono" data-tono="${tonos[numero % tonos.length]}">${ico(ICONOS[tipo.id] || "campana")}</span>
                    <span class="ajTexto"><strong>${escaparTexto(tipo.nombre)}</strong>
                    <small>${escaparTexto(tipo.quien)}</small>${sinPermiso}</span>
                    <input type="checkbox" class="casillaAviso ajLlave" role="switch" value="${escaparTexto(tipo.id)}"
                        aria-label="${escaparTexto(tipo.nombre)}" ${avisos.recibe(tipo.id) ? "checked" : ""}>
                </label>
            `;
        }).join("");

        const problema = ["sinPermiso", "error"].includes(avisos.estado())
            ? nota("No se pudieron leer tus avisos. " + (avisos.estado() === "sinPermiso"
                ? "Si sos el dueño, revisá que las reglas nuevas estén publicadas en Firebase."
                : "Revisá la señal y volvé a abrir la app."), "alerta", 'role="alert"')
            : "";

        return `
            ${problema}
            ${htmlNotificaciones()}
            <section class="ajGrupo">
                <h3 class="ajGrupoTitulo subtituloAvisos">Qué avisos recibís</h3>
                <div class="ajTarjeta">${casillas}</div>
            </section>
            ${nota("Nunca te llega aviso de lo que hacés vos. Lo que elegís se guarda en la nube: vale en cualquier celular donde entres.")}
            ${htmlQueSuena()}
            ${grupo("", filaAccion("campana", "azul", "Ver mis avisos", "La lista de la campanita", 'data-accion="verAvisos"'))}
        `;
    }

    // --- Notificaciones con la app cerrada (T29): en este celular ---
    function htmlNotificaciones() {
        const notificaciones = window.notificacionesVendeFrio;
        if (!notificaciones || !notificaciones.disponible()) return "";

        const estado = notificaciones.estado();
        const error = notificaciones.error();
        const textos = {
            instalarIphone: `En iPhone, las notificaciones llegan solo con la app instalada.
                En Safari, tocá <strong>Compartir</strong> (el cuadrado con la flecha) y después
                <strong>Agregar a inicio</strong>. Abrí VendeFrío desde ese ícono y volvé acá.
                Hace falta iOS 16.4 o más nuevo.`,
            noSePuede: `Este celular o este navegador no puede recibir notificaciones.
                En Android, usá Chrome. En iPhone, hace falta iOS 16.4 o más nuevo y la app
                instalada en la pantalla de inicio.`,
            bloqueadas: `Las notificaciones están bloqueadas para VendeFrío en este celular.
                Para permitirlas en Android: mantené apretado el ícono de VendeFrío, tocá
                <strong>Información de la app</strong> y después <strong>Notificaciones</strong>
                (o, en Chrome, los tres puntos > Configuración > Configuración de sitios >
                Notificaciones). Después volvé acá.`,
            apagadas: "Prendelas para que te suenen los avisos aunque tengas la app cerrada. Valen solo para este celular.",
            activando: "Activando… Si el celular pregunta, tocá «Permitir».",
            activadas: "<strong>Activadas en este celular.</strong> Te suenan los avisos aunque tengas la app cerrada."
        };

        let boton = "";
        if (estado === "apagadas") {
            boton = `<button type="button" data-accion="activarNotificaciones">Activar notificaciones en este celular</button>`;
        } else if (estado === "activando") {
            boton = `<button type="button" disabled>Activando…</button>`;
        } else if (estado === "activadas") {
            boton = `<button type="button" data-accion="desactivarNotificaciones">Desactivar en este celular</button>`;
        }

        return `
            <div class="bloqueNotificaciones" id="bloqueNotificaciones" data-estado="${escaparTexto(estado)}">
                <div class="cabezaNotificaciones">
                    <span class="ajIcono" data-tono="${estado === "activadas" ? "verde" : "rojo"}">${ico("campana")}</span>
                    <strong>Notificaciones con la app cerrada</strong>
                </div>
                <p class="configEstado">${textos[estado] || textos.apagadas}</p>
                ${error && estado === "apagadas" ? `<p class="configEstado configAvisoProblema">${escaparTexto(error)}</p>` : ""}
                ${boton}
            </div>
        `;
    }

    // Qué suena con la app cerrada: por persona, vale en cualquier celular.
    function htmlQueSuena() {
        const notificaciones = window.notificacionesVendeFrio;
        const avisos = window.avisosVendeFrio;
        if (!notificaciones || !notificaciones.disponible() || notificaciones.estado() !== "activadas") return "";

        const casillas = avisos.tipos().map(tipo => {
            const recibe = avisos.recibe(tipo.id);
            return `
                <label class="ajFila configAviso">
                    <span class="ajIcono" data-tono="${recibe ? "verde" : "gris"}">${ico(recibe ? "volumen" : "volumenNo")}</span>
                    <span class="ajTexto"><strong>${escaparTexto(tipo.nombre)}</strong>
                    ${recibe ? "" : "<small>No lo recibís: prendelo arriba, en «Qué avisos recibís».</small>"}</span>
                    <input type="checkbox" class="casillaSuena ajLlave" role="switch" value="${escaparTexto(tipo.id)}"
                        aria-label="${escaparTexto(tipo.nombre)}"
                        ${recibe && notificaciones.suena(tipo.id) ? "checked" : ""} ${recibe ? "" : "disabled"}>
                </label>
            `;
        }).join("");

        return `
            <section class="ajGrupo">
                <h3 class="ajGrupoTitulo subtituloAvisos">Qué suena con la app cerrada</h3>
                <div class="ajTarjeta">${casillas}</div>
            </section>
            ${nota("Lo que no suena igual te queda en la campanita. Vale en todos los celulares donde actives las notificaciones.")}
        `;
    }

    // Permisos del empleado (T19): salen de sus roles; los marca el dueño.
    // Con "Todos pueden hacer todo" prendida, cualquier paso; cobrar, solo
    // con un rol con "Cobra" aprobado (T29d).
    function htmlMisPermisos() {
        const empleados = window.empleadosVendeFrio;
        const ficha = empleados.miFicha();
        const pendientes = empleados.nombresDeRoles(empleados.rolesPendientesDe(ficha));
        const cobra = empleados.puede("cobra");

        let texto = "";
        if (empleados.todosPuedenTodo()) {
            texto = "Podés hacer cualquier paso de cualquier pedido: tu encargado dejó prendida «Todos pueden hacer todo».";
        } else {
            const nombres = empleados.nombresDePermisos(empleados.misPermisos().filter(id => id !== "cobra"));
            texto = nombres.length ? nombres.join(", ") : "Ninguno por ahora";
        }

        const textoCobro = cobra
            ? "Cobrar: sí, con «Cobra»."
            : pendientes.length
                ? "Cobrar: todavía no. " + pendientes.map(nombre => "«" + nombre + "»").join(", ") + " está pendiente de aprobar por tu encargado."
                : "Cobrar: no (hace falta un rol con «Cobra»).";

        return `
            <strong>Tus permisos</strong><br>
            ${escaparTexto(texto)}<br>
            ${escaparTexto(textoCobro)}<br>
            <small>Los da tu encargado según tus roles.</small>
        `;
    }

    // Cuenta de un empleado (T14): sin migración ni acciones delicadas.
    // Solo su nombre, sus roles, la conexión y salir.
    function htmlCuentaEmpleado() {
        const empleados = window.empleadosVendeFrio;
        const ficha = empleados.miFicha();
        const pendientes = new Set(empleados.rolesPendientesDe(ficha));
        const roles = ficha
            ? (ficha.roles || []).map(id => {
                const nombre = empleados.nombresDeRoles([id])[0];
                return nombre && pendientes.has(id) ? nombre + " (pendiente de aprobar)" : nombre;
            }).filter(Boolean)
            : [];
        const nube = window.nubeVendeFrio;

        const textos = {
            conectando: "Conectando con la nube…",
            conectada: "Conectada: tus cambios se ven en los otros celulares de la distribuidora.",
            sinConexion: "Sin señal: los cambios se guardan en el celular y se suben solos cuando vuelva internet.",
            sinPermiso: "La nube no deja leer la distribuidora. Pedile ayuda a tu encargado.",
            error: "Hubo un problema con la nube. Probá de nuevo."
        };
        const estadoNube = nube?.estado?.() || "";
        const reintentar = ["sinConexion", "error"].includes(estadoNube)
            ? `<button type="button" data-accion="reintentarNube">Reintentar</button>`
            : "";

        return `
            <section class="ajGrupo">
                <h3 class="ajGrupoTitulo">Vos</h3>
                <div class="ajTarjeta">
                    ${filaEditable("persona", "azul", "Empleado", escaparTexto(ficha?.nombre) || "…", "", "editarDatosEmpleado", "Cambiar mi nombre o mis roles")}
                    ${filaDato("usuarios", "verde", "Roles", roles.length ? escaparTexto(roles.join(", ")) : "ninguno")}
                    <div class="ajFila ajTextoLargo">
                        <span class="ajIcono" data-tono="violeta">${ico("escudo")}</span>
                        <span class="ajTexto" id="misPermisos">${htmlMisPermisos()}</span>
                    </div>
                </div>
            </section>
            <section class="ajGrupo">
                <h3 class="ajGrupoTitulo">Distribuidora</h3>
                <div class="ajTarjeta">
                    ${htmlNombreDistribuidora()}
                    <p class="ajFila ajEstadoFila" id="estadoNube">${ico("nube", 16)}<span>${textos[estadoNube] || ""}</span></p>
                    ${htmlSincronizacion()}
                    ${reintentar}
                </div>
            </section>
            ${nota("<strong>Recomendado:</strong> instalá la app en la pantalla de inicio del celular (Android: menú ⋮ &gt; «Instalar app»; iPhone: Compartir &gt; «Agregar a inicio»). Así el celular no borra los datos de la app.")}
            ${grupo("", filaAccion("salir", "rojo", "Salir", "Cerrar tu sesión en este celular", 'data-accion="salirEmpleado"', "ajPeligro"))}
        `;
    }

    // Modo personal (T16d): nombre y roles de quien usa la app sin cuenta.
    function htmlModoPersonal() {
        const inicio = window.inicioVendeFrio;
        const datos = inicio?.usaModoPersonal?.() ? inicio.datosPersonales() : null;
        if (!datos) return "";

        const roles = inicio.nombresDeRolesPersonales(datos.roles);

        return `
            <p class="configEstado">
                Modo personal: <strong>${escaparTexto(datos.nombre)}</strong><br>
                ${roles.length ? "Roles: " + escaparTexto(roles.join(", ")) : "Sin roles"}<br>
                Tus datos no están protegidos: están solo en este celular.
                Iniciá sesión para guardarlos en la nube.
            </p>
            <button type="button" data-accion="cambiarDatosPersonales">
                Cambiar mi nombre y mis roles
            </button>
        `;
    }

    function htmlCuenta() {
        const cuenta = window.cuentaVendeFrio;

        if (!cuenta || !cuenta.disponible()) {
            return `
                ${htmlModoPersonal()}
                <p class="configEstado">
                    La cuenta no está disponible en este momento.
                    ${usaNubeReal()
                        ? "Cerrá y volvé a abrir la app con internet."
                        : "Tus datos siguen guardados en este dispositivo."}
                </p>
            `;
        }

        const usuario = cuenta.usuarioActual();

        if (usuario && window.empleadosVendeFrio?.esEmpleado()) {
            return htmlCuentaEmpleado();
        }

        if (usuario) {
            // Con cuenta se usa siempre la nube (T16c). Antes de entrar, solo
            // queda elegir si se suben los datos propios de este celular.
            const enLaNube = Boolean(window.nubeVendeFrio?.modoNube?.());
            const eligiendo = !enLaNube && window.inicioVendeFrio?.ofrecerSubirDatos?.();

            return `
                <section class="ajGrupo">
                    <h3 class="ajGrupoTitulo">Tu cuenta</h3>
                    <div class="ajTarjeta">
                        ${filaDato("persona", "azul", "Sesión iniciada como", escaparTexto(usuario.email))}
                        ${htmlNombreDueno()}
                    </div>
                </section>
                <section class="ajGrupo">
                    <h3 class="ajGrupoTitulo">Tu distribuidora</h3>
                    <div class="ajTarjeta">
                        ${htmlNombreDistribuidora()}
                        ${htmlDatosTicket()}
                        ${htmlCobroTransferencia()}
                        ${htmlDistribuidora()}
                    </div>
                </section>
                ${enLaNube ? "" : `
                <p class="configEstado">
                    ${eligiendo
                        ? "Todavía no entraste a la nube: elegí si subís los datos de este celular o si usás la nube sin subirlos."
                        : "Entrando a la nube de tu distribuidora…"}
                </p>`}
                ${htmlModoNube()}
                ${htmlMigracion()}
                ${grupo("", filaAccion("salir", "rojo", "Salir de la cuenta", "Tus datos quedan en la nube", 'data-accion="salirCuenta"', "ajPeligro"))}
            `;
        }

        return `
            ${htmlModoPersonal()}
            <form class="configCuentaFormulario" id="formularioCuenta" novalidate>
                <label>${window.icono("persona",15)} Email
                    <input type="email" id="cuentaEmail" autocomplete="username"
                        inputmode="email" autocapitalize="off" spellcheck="false"
                        placeholder="tu@email.com" required>
                </label>

                <label>${window.icono("escudo",15)} Contraseña
                    <span class="configCuentaClave">
                        <input type="password" id="cuentaContrasena"
                            autocomplete="current-password" placeholder="Tu contraseña" required>
                        <button type="button" class="configCuentaVer"
                            data-accion="verContrasena" aria-label="Mostrar contraseña">
                            ${window.icono("ojo",18)}
                        </button>
                    </span>
                </label>

                <p class="configCuentaError oculto" id="cuentaError" role="alert"></p>

                <button type="submit" class="configCuentaIngresar" id="cuentaIngresar">
                    Ingresar
                </button>
            </form>
            <p class="configEstado">
                Al ingresar, la app usa los datos de tu distribuidora en la nube.
                Si este celular tiene datos propios, primero te pregunta si querés subirlos.
            </p>
            <button type="button" data-accion="entrarComoEmpleado">
                ¿Sos empleado? Entrá con el código de tu encargado
            </button>
        `;
    }

    function actualizarResumenCuenta() {
        const resumen = document.getElementById("configCuentaResumen");
        if (!resumen) return;

        const usuario = window.cuentaVendeFrio?.usuarioActual();
        const nombre = usuario ? window.distribuidoraVendeFrio?.nombreActual?.() : "";

        actualizarFilasSegunCuenta();

        if (usuario && window.empleadosVendeFrio?.esEmpleado()) {
            const ficha = window.empleadosVendeFrio.miFicha();
            resumen.textContent = "Empleado" + (ficha?.nombre ? ": " + ficha.nombre : "") +
                (nombre ? " · " + nombre : "");
            return;
        }

        const personal = !usuario && window.inicioVendeFrio?.usaModoPersonal?.()
            ? window.inicioVendeFrio.datosPersonales()
            : null;

        resumen.textContent = usuario
            ? (nombre ? nombre + " · " : "") + usuario.email + (window.nubeVendeFrio?.modoNube?.() ? " · nube" : "")
            : personal
                ? "Modo personal: " + personal.nombre + " · Iniciá sesión"
                : "Ingresá o salí de tu cuenta";
    }

    let seccionAbierta = null;

    function detalle(seccion) {
        seccionAbierta = seccion;
        const d = leer();
        const caja = document.getElementById("configDetalle");
        const menu = document.querySelector(".configMenuPrincipal");

        if (!caja || !menu) return;

        const titulos = {
            cuenta: ["Cuenta", window.empleadosVendeFrio?.esEmpleado()
                ? "Tu cuenta de empleado"
                : "Ingresá con tu email y contraseña"],
            empleados: ["Empleados", "Códigos, fichas, roles y bajas de tus empleados"],
            avisos: ["Avisos", "Elegí qué avisos recibir y activá las notificaciones"],
            impresora: ["Impresora", "Impresora Bluetooth para los tickets de los pedidos"],
            apariencia: ["Apariencia", "Personalizá cómo se ve la aplicación"],
            respaldo: ["Datos y respaldo", "Protegé y restaurá la información de VendeFrío"],
            trabajo: ["Preferencias de trabajo", "Elegí cómo organizar tu trabajo diario"],
            navegacion: ["Cómo hacés el recorrido", "Vehículo, navegación y voz"],
            seguridad: ["Seguridad y aplicación", "Información y permisos"]
        };

        caja.innerHTML = `
            <button class="configSubVolver" type="button">
                ‹ ${titulos[seccion][0]}
            </button>
            <p class="configDescripcion">${titulos[seccion][1]}</p>
        `;

        if (seccion === "cuenta") {
            caja.innerHTML += htmlCuenta();
        }

        if (seccion === "empleados") {
            caja.innerHTML += htmlEmpleados();
            dejarDeEscucharListaEmpleados();
            escucharListaEmpleados();
        } else {
            dejarDeEscucharListaEmpleados();
        }

        if (seccion === "avisos") {
            caja.innerHTML += htmlAvisos();
        }

        if (seccion === "impresora") {
            caja.innerHTML += htmlImpresora();
        }

        if (seccion === "apariencia") {
            caja.innerHTML += htmlApariencia();
        }

        // Con la nube real, el empleado no ve los respaldos (T14) y el dueño
        // descarga y combina la nube, sin copia interna (T16b).
        const empleadoEnLaNube = window.empleadosVendeFrio?.esEmpleado() ||
            (usaNubeReal() && !esDuenoEnLaNube());

        if (seccion === "respaldo" && empleadoEnLaNube) {
            caja.innerHTML += grupo("", nota("Tus datos están en la nube de la distribuidora. Los respaldos los maneja tu encargado."));
        } else if (seccion === "respaldo" && usaNubeReal()) {
            caja.innerHTML += htmlRespaldoNube() + htmlLimpiezaDatosViejos();
        } else if (seccion === "respaldo") {
            const ultima = localStorage.getItem(
                "vendefrio_ultimo_respaldo_automatico"
            );

            caja.innerHTML +=
                grupo("Copia en este celular",
                    filaDato("historial", "gris", "Última copia interna",
                        ultima ? new Date(Number(ultima)).toLocaleString("es-AR") : "Todavía no hay una copia",
                        "configUltimaCopia") +
                    filaElegir("refrescar", "verde", "Respaldo automático", "Cada cuánto se hace la copia", "frecuenciaRespaldo", [
                        ["desactivado", "Nunca"], ["diario", "Todos los días"], ["semanal", "Cada semana"], ["mensual", "Cada mes"]
                    ]) +
                    filaAccion("restaurarNube", "naranja", "Restaurar última copia interna", "Vuelve a los datos de la última copia", 'data-accion="restaurar"')) +
                grupo("Archivo de respaldo",
                    filaAccion("descargar", "azul", "Exportar", "Descargá un archivo con todos tus datos", 'data-accion="exportar"') +
                    filaAccion("documento", "violeta", "Importar archivo", "Cargá un respaldo que descargaste antes", 'data-accion="importar"') +
                    filaElegir("alarma", "naranja", "Recordarme el respaldo", "Aviso en Inicio si pasa este tiempo sin descargarlo", "recordarRespaldo", [
                    ["diario", "Cada día"], ["semanal", "Cada semana"], ["mensual", "Cada mes"], ["nunca", "Nunca"]
                ])) +
                nota("Guardá el archivo en un lugar seguro, como Google Drive.");
        }

        if (seccion === "trabajo") {
            caja.innerHTML +=
                grupo("Listas",
                    filaElegir("tienda", "verde", "Orden de comercios", "En la lista de Comercios", "orden", [
                        ["pendientes", "Pendientes"], ["frecuentes", "Más pedidos"], ["alfabetico", "A a Z"]
                    ]) +
                    filaElegir("paquete", "naranja", "Orden de productos", "En Nuevo pedido, dentro de cada marca", "ordenProductos", [
                        ["marca", "Catálogo"], ["alfabetico", "A a Z"], ["frecuencia", "Más pedidos"]
                    ])) +
                grupo("Al usar la app",
                    filaElegir("casa", "azul", "Pantalla al abrir", "Dónde arranca la app", "inicio", [
                        ["menu", "Inicio"], ["pedido", "Pedidos"], ["comercios", "Comercios"]
                    ]) +
                    filaLlave("vibrar", "violeta", "Vibrar al guardar", "Un toque corto al guardar un pedido", "vibrar") +
                    filaLlave("volumen", "verde", "Decirlo en voz alta al guardar", "Te confirma con la voz lo que se guardó", "hablarAlGuardar") +
                    filaLlave("etiqueta", "naranja", "Precios en Nuevo pedido", "Mostrar el precio de cada producto", "precios")) +
                // T70: prueba de entrega al deslizar "Entregado".
                grupo("Al entregar",
                    filaLlave("camara", "verde", "Pedir foto y firma al entregar", "Todo opcional; también se agrega después desde el pedido", "pruebaEntrega")) +
                // T79: el resumen del día a la noche (dueño y quien cobra).
                grupo("A la noche",
                    filaLlave("luna", "violeta", "Resumen de la noche", "A las 20:30: vendido, entregado, cobrado y lo que falta", "resumenNoche")) +
                // T54: IA para la voz. Se usa solo cuando la voz gratis no entiende.
                grupo("Voz con IA",
                    filaLlave("celular", "verde", "IA del celular", "Gratis y privada, si tu celular la tiene", "iaCelular") +
                    filaLlave("nube", "azul", "IA en la nube", "Entiende cualquier frase y pedidos largos", "iaNube") +
                    filaAccion("chispa", "violeta", "Probar la IA en la nube", "Dice si anda o qué le falta", 'data-accion="probarIA"')) +
                `<p class="ajNota" id="resultadoProbarIA" aria-live="polite" hidden>${ico("info", 16)}<span></span></p>` +
                nota("La IA se usa solo cuando la voz no entiende lo que dijiste. <span id=\"estadoIACelular\">Revisando si este celular tiene IA…</span> La de la nube necesita internet, la cuenta de la distribuidora y la clave de Anthropic (tarea M15); cada vez que se usa cuesta una fracción de centavo de dólar.");
            window.vozVendeFrio?.estadoIACelular?.().then(estado => {
                const texto = document.getElementById("estadoIACelular");
                if (!texto) return;
                texto.textContent = {
                    available: "Este celular tiene IA y está lista.",
                    downloadable: "Este celular tiene IA: se descarga la primera vez que la uses, con wifi.",
                    downloading: "Este celular está descargando su IA."
                }[estado] || "Este celular todavía no tiene IA propia para páginas.";
            });
        }

        if (seccion === "navegacion") {
            caja.innerHTML +=
                grupo("Recorrido",
                    filaSegmento("bicicleta", "naranja", "Cómo te movés", "", "vehiculo", [
                        ["bicicleta", "Bici"], ["moto", "Moto"], ["auto", "Auto"], ["pie", "A pie"]
                    ]) +
                    filaElegir("navegar", "azul", "Al tocar «Ir»", "", "navegador", [
                        ["app", "VendeFrío"], ["google", "Google Maps"]
                    ])) +
                grupo("Voz",
                    filaSegmento("volumen", "verde", "Indicaciones con voz", "Te dice cuándo y dónde doblar", "voz", [
                        ["si", "Sí"], ["no", "No"]
                    ]) +
                    filaSegmento("velocimetro", "violeta", "Velocidad de la voz", "", "velocidadVoz", [
                        ["lenta", "Lenta"], ["normal", "Normal"], ["rapida", "Rápida"]
                    ])) +
                grupo("Mapa",
                    filaSegmento("buscar", "azul", "Zoom al navegar", "", "zoom", [
                        ["15", "Lejos"], ["17", "Normal"], ["18", "Cerca"]
                    ]) +
                    filaLlave("mira", "verde", "Seguir mi ubicación", "El mapa se mueve con vos", "seguimiento") +
                    filaLlave("celular", "gris", "Pantalla siempre encendida", "Mientras navegás", "pantallaEncendida")) +
                grupo("",
                    filaAccion("mapa", "azul", "Abrir Rutas", "Elegí comercios y armá la ruta del día", 'data-accion="rutas"')) +
                nota("La navegación usa los mapas de OpenStreetMap y calcula el camino por calles con internet. Necesita el GPS del comercio (se guarda desde su ficha).");
        }

        if (seccion === "seguridad") {
            caja.innerHTML +=
                grupo("La app",
                    filaDato("chispa", "azul", "VendeFrío", "versión " + (window.novedadesVendeFrio?.version || "1.0")) +
                    filaDato(window.nubeVendeFrio?.modoNube?.() ? "nube" : "celular", "verde", "Tus datos",
                        window.nubeVendeFrio?.modoNube?.()
                            ? "En la nube de tu distribuidora"
                            : "En este dispositivo") +
                    filaAccion("lista", "violeta", "Ver qué hay de nuevo", "Lo último que se sumó a la app", "data-novedades") +
                    // T87: presentación y términos (borrador hasta que lo revise un abogado, M19).
                    filaAccion("info", "azul", "Qué es VendeFrío", "La presentación de la app, para mostrarla", 'data-accion="abrirPresentacion"') +
                    filaAccion("escudo", "gris", "Términos y privacidad", "Qué datos guarda la app y para qué", 'data-accion="abrirTerminos"')) +
                // T62: informar un problema (y, el dueño, ver los informados).
                grupo("Problemas",
                    filaAccion("bandera", "rojo", "Informar un problema", "Contalo con tus palabras: lo técnico se adjunta solo", 'data-accion="informarProblema"') +
                    (esDuenoEnLaNube() ? filaAccion("lista", "naranja", "Problemas informados", "Lo que mandaron vos y tus empleados", 'data-accion="verProblemas"') : "")) +
                grupo("Ayuda",
                    `<div class="ajFila ajTextoLargo ayudaVendeFrio">
                        <span class="ajIcono" data-tono="naranja">${ico("herramientas")}</span>
                        <span class="ajTexto"><strong>Si algo no anda</strong><small>Cerrá la app del todo y abrila de nuevo con internet (así se actualiza). Si sigue, sacale una captura a la pantalla y mandásela a quien administra VendeFrío en tu distribuidora.</small></span>
                    </div>
                    <div class="ajFila ajTextoLargo">
                        <span class="ajIcono" data-tono="azul">${ico("descargar")}</span>
                        <span class="ajTexto"><strong>Instalar la app</strong><small>En Android, desde Chrome: menú ⋮ › «Instalar app». En iPhone, desde Safari: Compartir › «Agregar a inicio». Tus datos de la nube no se pierden al reinstalar.</small></span>
                    </div>`) +
                grupo("",
                    filaAccion("refrescar", "rojo", "Restablecer preferencias visuales", "Tema, color, texto y espaciado como al principio", 'data-accion="restablecer"', "ajPeligro"));
        }

        caja.querySelectorAll("[data-campo]").forEach(control => {
            const campo = control.dataset.campo;
            const valor = valorDe(d, campo);

            if (control.type === "checkbox") control.checked = valor === true;
            else if (control.type === "radio") control.checked = control.value === String(valor);
            else control.value = valor;
        });
        dibujarMuestraTexto(caja);

        menu.classList.add("oculto");
        caja.classList.remove("oculto");
    }

    document.addEventListener("click", event => {
        const fila = event.target.closest("[data-config-seccion]");

        if (fila) {
            detalle(fila.dataset.configSeccion);
        }

        if (event.target.closest(".configVolver")) {
            document.getElementById("pantallaConfiguracion")
                ?.classList.add("oculto");
            mostrarPantalla("menu");
        }

        if (event.target.closest(".configSubVolver")) {
            document.getElementById("configDetalle")
                ?.classList.add("oculto");

            document.querySelector(".configMenuPrincipal")
                ?.classList.remove("oculto");
        }

        const accion = event.target.closest("[data-accion]")?.dataset.accion;

        if (accion === "exportar") {
            document.getElementById("exportarRespaldo")?.click();
            actualizarRespaldoNube();
        }

        // Limpieza de los datos viejos del celular (T16e).
        if (accion === "limpiezaDescargar") {
            const firma = descargarDatosViejosDelCelular();
            if (!firma) return;

            // Si los datos cambiaron desde la última revisión, se revisa de nuevo.
            if (limpieza.firma !== firma) limpieza.revision = null;
            limpieza.firma = firma;
            limpieza.descargado = new Date();
            detalle("respaldo");
            mostrarAviso(
                "Archivo descargado",
                "Guardalo en un lugar seguro, como Google Drive. Tiene todos los datos viejos de este celular, también los que no estén en la nube."
            );
        }

        if (accion === "limpiezaRevisar") {
            const nube = window.nubeVendeFrio;
            if (!nube?.revisarDatosViejos || limpieza.revisando || !limpieza.descargado) return;

            const viejos = leerDatosViejosDelCelular();
            limpieza.revisando = true;
            limpieza.revision = null;
            limpieza.error = "";
            detalle("respaldo");

            nube.revisarDatosViejos(viejos.datos)
                .then(revision => {
                    limpieza.revision = { ...revision, firma: viejos.firma };
                })
                .catch(error => {
                    limpieza.error = error.message;
                })
                .finally(() => {
                    limpieza.revisando = false;
                    const caja = document.getElementById("configDetalle");
                    if (seccionAbierta === "respaldo" && caja && !caja.classList.contains("oculto")) {
                        detalle("respaldo");
                    }
                });
        }

        if (accion === "limpiezaBorrar") {
            const revision = limpieza.revision;
            if (!limpieza.descargado || !revision || limpieza.revisando) return;

            // Sin el archivo de estos mismos datos no se borra.
            const firma = leerDatosViejosDelCelular().firma;
            if (firma !== limpieza.firma || firma !== revision.firma) {
                reiniciarLimpieza();
                detalle("respaldo");
                return mostrarAviso(
                    "Los datos cambiaron",
                    "Los datos viejos de este celular cambiaron desde que descargaste el archivo. Descargalo de nuevo y volvé a revisar."
                );
            }

            const unidades = { comercios: "comercio(s)", productos: "producto(s)", pedidos: "pedido(s)", rutas: "ruta(s)" };
            const faltan = revision.totales
                .filter(total => total.faltan.length)
                .map(total => total.faltan.length + " " + unidades[total.clave]);

            abrirConfirmacion(
                "Borrar datos viejos",
                (faltan.length
                    ? "Faltan en la nube: " + faltan.join(", ") + ". Después de borrar, quedan solo en el archivo que descargaste: si los necesitás, los recuperás con \"Combinar respaldo\". "
                    : "Todo está en la nube. ") +
                    "Se borran de este celular los comercios, productos, marcas, pedidos, rutas y la copia interna viejos. La nube no se toca.",
                () => {
                    if (!borrarDatosViejosDelCelular()) {
                        return mostrarAviso("No se pudo borrar", "Los datos viejos de este celular quedaron como estaban.");
                    }

                    reiniciarLimpieza();
                    detalle("respaldo");
                    mostrarAviso(
                        "Datos viejos borrados",
                        "Este celular ya no guarda los datos de antes. Tus datos siguen en la nube, como siempre."
                    );
                }
            );
        }

        if (accion === "importar") {
            // Con la nube real se frena antes de elegir el archivo (T16b).
            if (frenarRespaldoEnLaNube()) return;
            document.getElementById("importarRespaldo")?.click();
        }

        if (accion === "probarIA") {
            const resultado = document.getElementById("resultadoProbarIA");
            const texto = resultado?.querySelector("span");
            if (resultado) resultado.hidden = false;
            if (texto) texto.textContent = "Probando…";
            window.vozVendeFrio?.probarIANube?.().then(respuesta => {
                if (texto) texto.textContent = respuesta;
            });
        }

        if (accion === "rutas") {
            pantalla()?.classList.add("oculto");
            mostrarPantalla("rutas");
        }

        if (accion === "cambiarDatosPersonales") {
            window.inicioVendeFrio?.pedirDatosPersonales?.();
        }

        if (accion === "verContrasena") {
            const campo = document.getElementById("cuentaContrasena");
            const boton = event.target.closest("[data-accion]");

            if (campo && boton) {
                const mostrar = campo.type === "password";
                campo.type = mostrar ? "text" : "password";
                boton.setAttribute(
                    "aria-label",
                    mostrar ? "Ocultar contraseña" : "Mostrar contraseña"
                );
                boton.classList.toggle("activo", mostrar);
            }
        }

        // Salir lleva siempre a la pantalla de inicio (T16c). Como el
        // empleado, el dueño no sale con cambios sin subir.
        if (accion === "salirCuenta") {
            const boton = event.target.closest("[data-accion]");
            const nube = window.nubeVendeFrio;
            const sinSubir = nube?.sincronizacion?.().sinSubir || 0;

            if (sinSubir > 0) {
                // T60: muestra qué falta subir en vez de un aviso suelto.
                if (window.piezas && window.confianzaVendeFrio) {
                    window.piezas.modal({
                        icono: "nube",
                        color: "aviso",
                        titulo: "Todavía no",
                        texto: "Hay " + (sinSubir === 1 ? "1 cambio" : sinSubir + " cambios") + " sin subir a la nube. Si salís ahora se perderían: esperá a tener señal.",
                        botones: [
                            { texto: "Cerrar", clase: "pzBtnGris" },
                            { texto: "Ver qué falta", clase: "pzBtnPri", alTocar: () => window.confianzaVendeFrio.abrirSinSubir() }
                        ]
                    });
                    return;
                }
                return mostrarAviso(
                    "Todavía no",
                    "Hay " + sinSubir + " cambio(s) sin subir a la nube. Esperá a tener señal y que diga \"todo subido\" antes de salir."
                );
            }

            abrirConfirmacion(
                "Salir de la cuenta",
                nube?.modoNube?.()
                    ? "Vas a volver a la pantalla de inicio. Tus datos quedan guardados en la nube, pero este celular deja de tenerlos: para volver a verlos, ingresá con tu email y contraseña (hace falta internet)."
                    : "Vas a volver a la pantalla de inicio. Los datos de este celular no se borran.",
                () => {
                    if (boton) boton.disabled = true;

                    const salida = nube?.salirDeLaCuenta
                        ? nube.salirDeLaCuenta()
                        : Promise.reject(new Error("La cuenta no está disponible en este momento."));

                    salida.catch(error => {
                        if (boton) boton.disabled = false;
                        mostrarAviso("No se pudo salir", error.message);
                    });
                }
            );
        }

        if (accion === "generarCodigo") {
            generarCodigo(null, "");
        }

        if (accion === "codigoReingreso") {
            const boton = event.target.closest("[data-accion]");
            const nombre = boton?.dataset.nombre || "";

            abrirConfirmacion(
                "Código de reingreso",
                "Es para que " + (nombre || "este empleado") + " entre desde otro celular y siga siendo el mismo empleado, con su nombre y sus roles. " +
                    "Cuando use el código, el celular que usa ahora pierde el acceso.",
                () => generarCodigo(boton?.dataset.empleado, nombre)
            );
        }

        // --- Panel de empleados (T15) ---
        if (accion === "cambiarRolesEmpleado") {
            editandoRolesDe = event.target.closest("[data-accion]").dataset.empleado || null;
            dibujarListaEmpleados(ultimaListaEmpleados);
        }

        if (accion === "cancelarRolesEmpleado") {
            editandoRolesDe = null;
            dibujarListaEmpleados(ultimaListaEmpleados);
        }

        if (accion === "guardarRolesEmpleado") {
            const boton = event.target.closest("[data-accion]");
            const elegidos = Array.from(document.querySelectorAll("#empleadoRolesEdicion input:checked"))
                .map(casilla => casilla.value);

            window.empleadosVendeFrio.cambiarRolesDe(boton.dataset.empleado, elegidos)
                .then(() => {
                    editandoRolesDe = null;
                    dibujarListaEmpleados(ultimaListaEmpleados);
                    mostrarToast("Roles guardados");
                })
                .catch(error => mostrarAviso("No se guardaron los roles", error.message));
        }

        // Rol pendiente de aprobar (T29d).
        if (accion === "aprobarRol" || accion === "rechazarRol") {
            const boton = event.target.closest("[data-accion]");
            const empleados = window.empleadosVendeFrio;
            const nombreRol = empleados.nombresDeRoles([boton.dataset.rol])[0] || "el rol";
            const aprobar = accion === "aprobarRol";

            (aprobar ? empleados.aprobarRol : empleados.rechazarRol)(boton.dataset.empleado, boton.dataset.rol)
                .then(() => mostrarToast(aprobar
                    ? "Aprobado: " + (boton.dataset.nombre || "el empleado") + " ya puede cobrar"
                    : "Rechazado: se le quitó «" + nombreRol + "»"))
                .catch(error => mostrarAviso("No se guardó el cambio", error.message));
        }

        if (accion === "darDeBaja") {
            const boton = event.target.closest("[data-accion]");
            const nombre = boton.dataset.nombre || "este empleado";

            abrirConfirmacion(
                "Dar de baja a " + nombre,
                "Pierde el acceso enseguida, aunque tenga la app abierta: su celular borra la copia de la nube y vuelve a la pantalla de inicio. " +
                    "Su ficha queda como \"dado de baja\" para que su nombre siga en el historial. " +
                    "No se puede deshacer: para que vuelva, vas a tener que generarle un código nuevo. " +
                    "Los datos de la distribuidora no se tocan.",
                () => {
                    boton.disabled = true;
                    window.empleadosVendeFrio.darDeBaja(boton.dataset.empleado)
                        .then(() => mostrarToast(escaparTexto(nombre) + " quedó dado de baja"))
                        .catch(error => {
                            boton.disabled = false;
                            mostrarAviso("No se pudo dar de baja", error.message);
                        });
                }
            );
        }

        if (accion === "anularCodigo") {
            const boton = event.target.closest("[data-accion]");
            const codigo = boton.dataset.codigo;

            abrirConfirmacion(
                "Anular código",
                "El código " + window.empleadosVendeFrio.formatearCodigo(codigo) + " deja de servir. Si alguien lo escribe, no va a poder entrar.",
                () => {
                    boton.disabled = true;
                    window.empleadosVendeFrio.anularCodigo(codigo)
                        .then(() => mostrarToast("Código anulado"))
                        .catch(error => {
                            boton.disabled = false;
                            mostrarAviso("No se pudo anular", error.message);
                        });
                }
            );
        }

        if (accion === "editarRoles" || accion === "cerrarEditorRoles") {
            editorRolesAbierto = accion === "editarRoles";
            dibujarEditorRoles();
        }

        if (accion === "agregarRol") {
            const campo = document.getElementById("empleadoRolNuevo");

            window.empleadosVendeFrio.crearRol(campo?.value)
                .then(rol => mostrarToast("Rol \"" + escaparTexto(rol.nombre) + "\" creado"))
                .catch(error => mostrarAviso("No se creó el rol", error.message));
        }

        if (accion === "renombrarRol") {
            const id = event.target.closest("[data-accion]").dataset.rol;
            const campo = Array.from(document.querySelectorAll(".empleadoRolNombre"))
                .find(entrada => entrada.dataset.rol === id);

            window.empleadosVendeFrio.renombrarRol(id, campo?.value)
                .then(rol => mostrarToast("Ahora se llama \"" + escaparTexto(rol.nombre) + "\""))
                .catch(error => mostrarAviso("No se cambió el nombre", error.message));
        }

        if (accion === "eliminarRol") {
            const boton = event.target.closest("[data-accion]");
            const cantidad = window.empleadosVendeFrio.cantidadConRol(boton.dataset.rol);
            const nombre = boton.dataset.nombre || "este rol";

            abrirConfirmacion(
                "Eliminar el rol " + nombre,
                (cantidad
                    ? "Lo tiene" + (cantidad === 1 ? " 1 empleado" : "n " + cantidad + " empleados") +
                        ": se les quita el rol, pero no se borra ningún empleado."
                    : "Ningún empleado lo tiene.") +
                    " Deja de aparecer en la lista para elegir.",
                () => {
                    window.empleadosVendeFrio.eliminarRol(boton.dataset.rol)
                        .then(() => mostrarToast("Rol eliminado"))
                        .catch(error => mostrarAviso("No se eliminó el rol", error.message));
                }
            );
        }

        if (accion === "copiarCodigo" && codigoGenerado) {
            const texto = window.empleadosVendeFrio.formatearCodigo(codigoGenerado.codigo);

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(texto)
                    .then(() => mostrarToast("Código copiado"))
                    .catch(() => mostrarAviso("Código", texto));
            } else {
                mostrarAviso("Código", texto);
            }
        }

        if (accion === "compartirCodigo" && codigoGenerado) {
            const texto = textoParaCompartir(codigoGenerado);

            if (navigator.share) {
                navigator.share({ text: texto }).catch(() => {});
            } else {
                window.open("https://wa.me/?text=" + encodeURIComponent(texto), "_blank", "noopener");
            }
        }

        if (accion === "entrarComoEmpleado") {
            if (window.inicioVendeFrio?.abrirEmpleado) {
                window.inicioVendeFrio.abrirEmpleado();
            }
        }

        if (accion === "editarDatosEmpleado") {
            window.inicioVendeFrio?.pedirDatosEmpleado();
        }

        if (accion === "salirEmpleado") {
            abrirConfirmacion(
                "Salir",
                "Si salís, este celular pierde el acceso a la distribuidora. Para volver a entrar vas a necesitar un código de reingreso de tu encargado. Los cambios que ya se subieron quedan guardados en la nube.",
                () => {
                    window.empleadosVendeFrio.salir()
                        .catch(error => mostrarAviso("Todavía no", error.message));
                }
            );
        }

        if (accion === "migracionRespaldo") {
            const antes = Date.now();
            exportarRespaldo();
            const fecha = obtenerFechaUltimoRespaldo();

            if (fecha && fecha.getTime() >= antes) {
                migracion.respaldo = fecha;
                detalle("cuenta");
            }
        }

        if (accion === "migracionSubir") {
            if (!migracion.respaldo) {
                return mostrarAviso("Primero el respaldo", "Tocá \"Exportar respaldo\" y guardá el archivo antes de subir tus datos.");
            }

            abrirConfirmacion(
                "Subir mis datos a la nube",
                "Conviene hacerlo sin pedidos pendientes, por ejemplo al final del día después de repartir: todos los pedidos del historial van a quedar como \"histórico\". Si alguno quedara pendiente, cargalo de nuevo como pedido nuevo. Hace falta internet. Los datos de este celular no se borran.",
                () => {
                    migracion.progreso = "Preparando…";
                    migracion.resultado = null;
                    migracion.error = "";

                    const subida = window.nubeVendeFrio.subirDatos(texto => {
                        migracion.progreso = texto;
                        const progreso = document.getElementById("migracionProgreso");
                        if (progreso) {
                            progreso.textContent = texto;
                            progreso.classList.remove("oculto");
                        }
                    });

                    detalle("cuenta");

                    subida
                        .then(resultado => {
                            migracion.resultado = resultado;
                            migracion.progreso = resultado.subidos
                                ? "Se subieron " + resultado.subidos + " registro(s)."
                                : "No hizo falta subir nada: ya estaba todo en la nube.";
                        })
                        .catch(error => {
                            migracion.progreso = "";
                            migracion.error = error.message;
                        })
                        .finally(() => {
                            if (seccionAbierta === "cuenta") detalle("cuenta");
                        });
                }
            );
        }

        if (accion === "migracionUsarNube") {
            abrirConfirmacion(
                "Usar la nube desde ahora",
                "La app se va a recargar y tus datos van a salir de la nube, compartidos con los otros celulares de tu cuenta. Los datos de este celular quedan guardados sin cambios.",
                () => {
                    window.nubeVendeFrio.activarNube().catch(error => {
                        mostrarAviso("Todavía no", error.message);
                    });
                }
            );
        }

        // "No subirlos y usar la nube" (T16c): una sola vez por celular.
        if (accion === "noSubirDatos") {
            const boton = event.target.closest("[data-accion]");

            abrirConfirmacion(
                "No subirlos y usar la nube",
                "Los datos de este celular no se suben ni se borran: quedan guardados acá, pero la app ya no los muestra. La app se va a recargar con los datos de la nube de tu distribuidora. En este celular no se vuelve a ofrecer subirlos.",
                () => {
                    if (boton) {
                        boton.disabled = true;
                        boton.textContent = "Abriendo la nube…";
                    }

                    window.nubeVendeFrio.usarNube().catch(error => {
                        if (boton) {
                            boton.disabled = false;
                            boton.textContent = "No subirlos y usar la nube";
                        }
                        mostrarAviso("Todavía no", error.message);
                    });
                }
            );
        }

        if (accion === "juntarRepetidos") {
            const nube = window.nubeVendeFrio;
            if (!nube || !nube.contarRepetidos) return;

            if (nube.estado() !== "conectada" || !navigator.onLine) {
                return mostrarAviso(
                    "Todavía no",
                    "Esperá a que diga \"Conectada\" y probá de nuevo. Hace falta internet."
                );
            }

            const cantidad = nube.contarRepetidos();

            if (!cantidad.comercios && !cantidad.productos) {
                return mostrarAviso("No hay repetidos", "No hay comercios ni productos repetidos en la nube.");
            }

            abrirConfirmacion(
                "Juntar repetidos",
                "Hay " + cantidad.comercios + " comercio(s) y " + cantidad.productos + " producto(s) de más. " +
                    "De cada uno queda una sola copia, la que tiene más datos, y se le pasan los datos que le falten (teléfono, dirección, precio, foto). " +
                    "Las rutas pasan a usar esa copia y los pedidos no se tocan. " +
                    "Antes se descarga un archivo con todos tus datos de la nube, por las dudas.",
                () => {
                    nube.juntarRepetidos()
                        .then(resultado => {
                            mostrarAviso(
                                "Repetidos juntados",
                                "Se sacaron " + resultado.comercios + " comercio(s) y " + resultado.productos +
                                    " producto(s) de más" +
                                    (resultado.rutas ? " y se actualizaron " + resultado.rutas + " ruta(s)" : "") +
                                    ". Los otros celulares lo ven solos."
                            );
                        })
                        .catch(error => mostrarAviso("No se pudo terminar", error.message));
                }
            );
        }

        if (accion === "editarNombreDistribuidora") {
            editandoNombre = true;
            detalle("cuenta");
            const campo = document.getElementById("nombreDistribuidoraNuevo");
            if (campo) {
                campo.focus();
                campo.select();
            }
        }

        if (accion === "cancelarNombreDistribuidora") {
            editandoNombre = false;
            detalle("cuenta");
        }

        if (accion === "editarDatosTicket") {
            editandoDatosTicket = true;
            detalle("cuenta");
            document.getElementById("datosTicketTelefono")?.focus();
        }

        if (accion === "editarCobroTransferencia") {
            window.cobrarQrVendeFrio?.editar(() => {
                if (seccionAbierta === "cuenta") detalle("cuenta");
            });
        }

        if (accion === "cancelarDatosTicket") {
            editandoDatosTicket = false;
            detalle("cuenta");
        }

        if (accion === "editarNombreDueno") {
            editandoNombreDueno = true;
            detalle("cuenta");
            const campo = document.getElementById("nombreDuenoNuevo");
            if (campo) {
                campo.focus();
                campo.select();
            }
        }

        if (accion === "cancelarNombreDueno") {
            editandoNombreDueno = false;
            detalle("cuenta");
        }

        if (accion === "reintentarDistribuidora") {
            window.distribuidoraVendeFrio?.reintentar();
        }

        if (accion === "reintentarNube") {
            window.nubeVendeFrio?.reintentar();
        }

        if (accion === "informarProblema") window.confianzaVendeFrio?.informarProblema();
        if (accion === "abrirPresentacion") window.open("presentacion.html", "_blank", "noopener");
        if (accion === "abrirTerminos") window.open("terminos.html", "_blank", "noopener");
        if (accion === "verProblemas") window.confianzaVendeFrio?.verProblemas();

        if (accion === "restablecer") {
            const d = leer();
            CAMPOS_VISUALES.forEach(campo => delete d[campo]);
            guardar(d);
            aplicar();
            actualizarMas();
            detalle("apariencia");
            mostrarToast("Apariencia como al principio");
        }

        if (accion === "restaurar") {
            // Con la nube real no se ofrece la copia interna: es de los datos
            // viejos de este celular (T16b).
            if (usaNubeReal()) {
                return mostrarAviso(
                    "No disponible en la nube",
                    "Para recuperar datos de la nube, usá \"Combinar respaldo\" con un archivo que hayas descargado."
                );
            }

            const copia = localStorage.getItem(
                "vendefrio_respaldo_automatico"
            );

            if (!copia) {
                return mostrarAviso(
                    "Sin copia interna",
                    "Todavía no existe una copia automática para restaurar."
                );
            }

            // En modo nube restaurar no reemplaza: solo combina, sin borrar nada (T10).
            if (estaEnModoNube()) {
                let respaldo = null;

                try {
                    respaldo = JSON.parse(copia);
                } catch (e) {
                    respaldo = null;
                }

                if (!validarRespaldo(respaldo)) {
                    return mostrarAviso(
                        "No se pudo restaurar",
                        "La copia interna no es válida."
                    );
                }

                abrirConfirmacion(
                    "Combinar copia interna",
                    "En la nube no se reemplazan datos: la copia interna de este celular se combina con lo que ya hay, sin borrar nada. Los datos de la nube tienen prioridad.",
                    () => {
                        const resultado = combinarRespaldoSinBorrar(respaldo);

                        if (!resultado.guardado) {
                            return mostrarAviso(
                                "No se pudo combinar",
                                "Los datos no se pudieron guardar completos."
                            );
                        }

                        mostrarAviso(
                            "Copia combinada",
                            "Se agregaron:\n" +
                                "- " + resultado.pedidosAgregados + " pedido(s)\n" +
                                "- " + resultado.comerciosAgregados + " comercio(s)\n" +
                                "- " + resultado.rutasAgregadas + " ruta(s)\n\n" +
                                "No se borró nada."
                        );
                        // Sin recargar: las escrituras de la nube siguen su curso y
                        // las pantallas se redibujan con los datos combinados.
                        avisarCambioDatos(COLECCIONES_COMPARTIDAS, true);
                    }
                );
                return;
            }

            try {
                if (restaurarRespaldo(JSON.parse(copia))) {
                    mostrarAviso(
                        "Copia restaurada",
                        "Se recuperaron tus datos correctamente."
                    );
                }
            } catch (e) {
                mostrarAviso(
                    "No se pudo restaurar",
                    "La copia interna no es válida."
                );
            }
        }
    });

    document.addEventListener("submit", event => {
        if (event.target.id !== "formNombreDistribuidora") return;

        event.preventDefault();

        const nombre = (document.getElementById("nombreDistribuidoraNuevo")?.value || "").trim();
        const error = document.getElementById("nombreDistribuidoraError");

        if (!nombre) {
            if (error) {
                error.textContent = "Escribí el nombre de tu distribuidora.";
                error.classList.remove("oculto");
            }
            return;
        }

        window.distribuidoraVendeFrio.cambiarNombre(nombre)
            .then(() => {
                editandoNombre = false;
                if (seccionAbierta === "cuenta") detalle("cuenta");
                mostrarToast(navigator.onLine ? "Nombre guardado" : "Nombre guardado. Se sube cuando vuelva la señal");
            })
            .catch(fallo => {
                if (error) {
                    error.textContent = fallo.message;
                    error.classList.remove("oculto");
                }
            });
    });

    // Datos del ticket (T28c).
    document.addEventListener("submit", event => {
        if (event.target.id !== "formDatosTicket") return;

        event.preventDefault();

        const valor = id => (document.getElementById(id)?.value || "").trim();
        window.distribuidoraVendeFrio.cambiarDatosTicket({
            telefono: valor("datosTicketTelefono"),
            direccion: valor("datosTicketDireccion"),
            cuit: valor("datosTicketCuit")
        })
            .then(() => {
                editandoDatosTicket = false;
                if (seccionAbierta === "cuenta") detalle("cuenta");
                mostrarToast(navigator.onLine ? "Datos del ticket guardados" : "Datos guardados. Se suben cuando vuelva la señal");
            })
            .catch(fallo => mostrarAviso("No se guardaron los datos", fallo.message));
    });

    // Nombre del dueño (T18).
    document.addEventListener("submit", event => {
        if (event.target.id !== "formNombreDueno") return;

        event.preventDefault();

        const nombre = (document.getElementById("nombreDuenoNuevo")?.value || "").trim();
        const error = document.getElementById("nombreDuenoError");

        if (!nombre) {
            if (error) {
                error.textContent = "Escribí tu nombre.";
                error.classList.remove("oculto");
            }
            return;
        }

        window.distribuidoraVendeFrio.cambiarNombreDueno(nombre)
            .then(() => {
                editandoNombreDueno = false;
                if (seccionAbierta === "cuenta") detalle("cuenta");
                mostrarToast(navigator.onLine ? "Nombre guardado" : "Nombre guardado. Se sube cuando vuelva la señal");
            })
            .catch(fallo => {
                if (error) {
                    error.textContent = fallo.message;
                    error.classList.remove("oculto");
                }
            });
    });

    document.addEventListener("submit", event => {
        if (event.target.id !== "formularioCuenta") return;

        event.preventDefault();

        const email = document.getElementById("cuentaEmail")?.value || "";
        const contrasena = document.getElementById("cuentaContrasena")?.value || "";
        const error = document.getElementById("cuentaError");
        const boton = document.getElementById("cuentaIngresar");

        const mostrarError = texto => {
            if (!error) return;
            error.textContent = texto;
            error.classList.toggle("oculto", !texto);
        };

        if (!email.trim() || !contrasena) {
            mostrarError("Completá el email y la contraseña.");
            return;
        }

        mostrarError("");

        if (boton) {
            boton.disabled = true;
            boton.textContent = "Ingresando…";
        }

        // Con cuenta se entra a la nube (T16c): la pantalla de inicio sigue.
        window.cuentaVendeFrio.ingresar(email, contrasena)
            .then(usuario => window.inicioVendeFrio?.entrarConCuenta?.(usuario))
            .catch(fallo => {
                mostrarError(fallo.message);

                if (boton) {
                    boton.disabled = false;
                    boton.textContent = "Ingresar";
                }
            });
    });

    document.addEventListener("change", event => {
        const campo = event.target.dataset?.campo;

        if (!campo) return;

        const valor =
            event.target.type === "checkbox"
                ? event.target.checked
                : event.target.value;

        guardarCampo(campo, valor);
    });

    // "Todos pueden hacer todo" (T29d): se guarda al tocar la llave.
    document.addEventListener("change", event => {
        if (event.target.id !== "llaveTodosPuedenTodo") return;

        const llave = event.target;
        window.empleadosVendeFrio.cambiarTodosPuedenTodo(llave.checked)
            .then(prendida => {
                const texto = document.getElementById("textoLlaveEquipo");
                if (texto) texto.textContent = htmlTextoLlave(prendida);
                mostrarToast(prendida ? "Listo: todos pueden hacer todo" : "Listo: cada uno según sus permisos");
            })
            .catch(error => {
                llave.checked = !llave.checked;
                mostrarAviso("No se guardó el cambio", error.message);
            });
    });

    // "Quién ve la plata" (T93): se guarda al elegir.
    document.addEventListener("change", event => {
        if (event.target.id !== "elegirVerPlata") return;

        const selector = event.target;
        window.verPlataVendeFrio.cambiar(selector.value)
            .then(valor => {
                const texto = document.getElementById("textoVerPlata");
                if (texto) texto.textContent = TEXTOS_VER_PLATA[valor];
                mostrarToast("Listo: guardado");
            })
            .catch(error => mostrarAviso("No se guardó el cambio", error.message));
    });

    // Permisos de un rol (T19): se guardan al tocar la casilla.
    document.addEventListener("change", event => {
        const casilla = event.target.closest?.(".rolPermiso");
        if (!casilla) return;

        window.empleadosVendeFrio.cambiarPermisoDeRol(casilla.dataset.rol, casilla.value, casilla.checked)
            .catch(error => {
                casilla.checked = !casilla.checked;
                mostrarAviso("No se guardó el permiso", error.message);
            });
    });

    document.addEventListener("input", event => {
        if (event.target.id !== "buscarConfiguracion") return;

        const texto =
            event.target.value.toLocaleLowerCase("es");

        document.querySelectorAll(".configFila").forEach(fila => {
            fila.classList.toggle(
                "oculto",
                !fila.textContent
                    .toLocaleLowerCase("es")
                    .includes(texto)
            );
        });
    });

    const mediaTema = window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    if (mediaTema) {
        const actualizarPorSistema = () => {
            if (leer().tema === "sistema") {
                aplicar();
            }
        };

        if (mediaTema.addEventListener) {
            mediaTema.addEventListener("change", actualizarPorSistema);
        } else if (mediaTema.addListener) {
            mediaTema.addListener(actualizarPorSistema);
        }
    }

    const respaldoEnInicio =
        document.getElementById("exportarRespaldo")?.closest("section");

    if (respaldoEnInicio) {
        respaldoEnInicio.classList.add("respaldoDashboardOculto");
    }

    // "Pantalla al abrir" (T50): una sola vez, al abrir la app en Inicio.
    window.addEventListener("load", () => {
        setTimeout(() => {
            const destino = valorDe(leer(), "inicio");
            const menuVisible = !document.getElementById("pantallaMenu")?.classList.contains("oculto");
            if (destino !== "menu" && menuVisible && typeof mostrarPantalla === "function") mostrarPantalla(destino);
        }, 300);
    });

    window.abrirConfiguracion = abrir;
    // Para que las otras pantallas lean los ajustes de "Más" (T50).
    window.preferenciasVendeFrio = { valor: campo => valorDe(leer(), campo) };
    window.actualizarMasVendeFrio = actualizarMas;
    // Avisos (T23): "Elegir qué avisos recibir" abre directo esa sección.
    window.abrirConfiguracionEn = seccion => {
        abrir();
        detalle(seccion);
    };

    document.addEventListener("change", event => {
        const casilla = event.target.closest?.(".casillaAviso");
        if (!casilla || !window.avisosVendeFrio) return;

        window.avisosVendeFrio.cambiarPreferencia(casilla.value, casilla.checked)
            .catch(error => {
                casilla.checked = !casilla.checked;
                mostrarAviso("No se guardó el cambio", error.message);
            });
    });

    document.addEventListener("click", event => {
        if (!event.target.closest?.('[data-accion="verAvisos"]')) return;
        window.avisosVendeFrio?.abrirLista?.();
    });

    // Notificaciones con la app cerrada (T29).
    document.addEventListener("change", event => {
        const casilla = event.target.closest?.(".casillaSuena");
        if (!casilla || !window.notificacionesVendeFrio) return;

        window.notificacionesVendeFrio.cambiarSuena(casilla.value, casilla.checked)
            .catch(error => {
                casilla.checked = !casilla.checked;
                mostrarAviso("No se guardó el cambio", error.message);
            });
    });

    document.addEventListener("click", event => {
        const notificaciones = window.notificacionesVendeFrio;
        if (!notificaciones) return;

        if (event.target.closest?.('[data-accion="activarNotificaciones"]')) {
            notificaciones.activar().catch(error => mostrarAviso("No se pudieron activar", error.message));
        } else if (event.target.closest?.('[data-accion="desactivarNotificaciones"]')) {
            notificaciones.desactivar();
        }
    });

    // Impresora (T28b): abre la lista de Chrome y guarda la elegida.
    document.addEventListener("click", event => {
        if (!event.target.closest?.('[data-accion="cambiarImpresora"]')) return;
        window.impresionVendeFrio?.cambiarImpresora?.().then(cambio => {
            if (!cambio) return;
            mostrarToast("Impresora guardada");
            const caja = document.getElementById("configDetalle");
            if (seccionAbierta === "impresora" && caja && !caja.classList.contains("oculto")) detalle("impresora");
        });
    });

    aplicar();
    crear();

    // configuracion.js se carga aparte desde menu.js y puede llegar antes que cuenta.js.
    function conectarCuenta() {
        window.empleadosVendeFrio?.escucharQuienSoy?.(actualizarMas);
        window.cuentaVendeFrio.escuchar(() => {
            actualizarResumenCuenta();
            actualizarMas();

            const caja = document.getElementById("configDetalle");
            if (seccionAbierta === "cuenta" && caja && !caja.classList.contains("oculto")) {
                detalle("cuenta");
            }
        });
    }

    if (window.cuentaVendeFrio) {
        conectarCuenta();
    } else {
        window.addEventListener("cuentaVendeFrioLista", conectarCuenta, { once: true });
    }

    // Modo personal (T16d): al guardar nombre y roles se actualiza Cuenta.
    window.addEventListener("modoPersonalVendeFrio", () => {
        actualizarResumenCuenta();

        const caja = document.getElementById("configDetalle");
        if (seccionAbierta === "cuenta" && caja && !caja.classList.contains("oculto")) {
            detalle("cuenta");
        }
    });

    // Igual que la cuenta: distribuidora.js puede llegar después.
    function conectarDistribuidora() {
        window.distribuidoraVendeFrio.escuchar(() => {
            actualizarFilasSegunCuenta();
            const caja = document.getElementById("configDetalle");
            if (seccionAbierta === "cuenta" && caja && !caja.classList.contains("oculto")) {
                detalle("cuenta");
            }
        });
    }

    // Nombre de la distribuidora: se cambia solo el texto, sin redibujar
    // (así no se borra lo que se está escribiendo).
    function conectarNombreDistribuidora() {
        if (!window.distribuidoraVendeFrio.escucharNombre) return;

        window.distribuidoraVendeFrio.escucharNombre(nombre => {
            actualizarResumenCuenta();

            const texto = document.getElementById("cuentaNombreDistribuidora");
            if (texto) texto.textContent = nombre || "…";
        });

        // Nombre del dueño (T18): también solo el texto.
        window.distribuidoraVendeFrio.escucharNombreDueno?.(nombreDueno => {
            const texto = document.getElementById("cuentaNombreDueno");
            if (texto) texto.textContent = nombreDueno || "Todavía sin cargar";
        });

        // Datos del ticket (T28c): si los cambian en otro celular, se
        // redibuja Cuenta, salvo que se esté escribiendo algo.
        window.distribuidoraVendeFrio.escucharDatosTicket?.(() => {
            const caja = document.getElementById("configDetalle");
            if (seccionAbierta !== "cuenta" || !caja || caja.classList.contains("oculto")) return;
            if (editandoNombre || editandoNombreDueno || editandoDatosTicket) return;
            if (document.getElementById("cuentaDatosTicket")) detalle("cuenta");
        });
    }

    if (window.distribuidoraVendeFrio) {
        conectarNombreDistribuidora();
        conectarDistribuidora();
    } else {
        window.addEventListener("distribuidoraVendeFrioLista", conectarNombreDistribuidora, { once: true });
        window.addEventListener("distribuidoraVendeFrioLista", conectarDistribuidora, { once: true });
    }

    // Estado de la nube (T9).
    function conectarNube() {
        window.nubeVendeFrio.escuchar(() => {
            actualizarResumenCuenta();
            actualizarRespaldoNube();

            const caja = document.getElementById("configDetalle");
            if (seccionAbierta === "cuenta" && caja && !caja.classList.contains("oculto")) {
                detalle("cuenta");
            }
        });
    }

    // Cambios que esperan subir (T12): se actualiza solo ese texto.
    function conectarSincronizacion() {
        if (!window.nubeVendeFrio.escucharSincronizacion) return;

        window.nubeVendeFrio.escucharSincronizacion(() => {
            const texto = document.getElementById("sincronizacionNube");
            if (texto) texto.textContent = textoSincronizacion();
        });
    }

    // Empleados (T14): el nombre y los roles del empleado se ven en Cuenta.
    function conectarEmpleados() {
        window.empleadosVendeFrio.escucharMiFicha(() => {
            actualizarResumenCuenta();

            const caja = document.getElementById("configDetalle");
            if (seccionAbierta === "cuenta" && caja && !caja.classList.contains("oculto")) {
                detalle("cuenta");
            }
        });

        // Permisos (T19): si el dueño los cambia, Cuenta se actualiza sola.
        window.empleadosVendeFrio.escucharPermisos?.(() => {
            const texto = document.getElementById("misPermisos");
            if (!texto || !window.empleadosVendeFrio.esEmpleado()) return;
            texto.innerHTML = htmlMisPermisos();
        });

        // "Todos pueden hacer todo" (T29d): si cambia en otro celular, se
        // actualizan la llave del dueño y los permisos del empleado.
        window.empleadosVendeFrio.escucharTodosPuedenTodo?.(prendida => {
            const llave = document.getElementById("llaveTodosPuedenTodo");
            if (llave) llave.checked = prendida;
            const textoLlave = document.getElementById("textoLlaveEquipo");
            if (textoLlave) textoLlave.textContent = htmlTextoLlave(prendida);
            const texto = document.getElementById("misPermisos");
            if (texto && window.empleadosVendeFrio.esEmpleado()) texto.innerHTML = htmlMisPermisos();
        });
    }

    if (window.empleadosVendeFrio) {
        conectarEmpleados();
    } else {
        window.addEventListener("empleadosVendeFrioLista", conectarEmpleados, { once: true });
    }

    // Avisos (T23): la fila aparece cuando se sabe quién usa el celular y la
    // sección se actualiza si cambian las preferencias en otro celular.
    function conectarAvisos() {
        let ultimo = "";
        window.avisosVendeFrio.escuchar(() => {
            actualizarFilasSegunCuenta();

            const avisos = window.avisosVendeFrio;
            const texto = JSON.stringify([avisos.disponible(), avisos.estado(), avisos.tipos().map(tipo => avisos.recibe(tipo.id))]);
            if (texto === ultimo) return;
            ultimo = texto;

            const caja = document.getElementById("configDetalle");
            if (seccionAbierta === "avisos" && caja && !caja.classList.contains("oculto")) {
                detalle("avisos");
            }
        });
        actualizarFilasSegunCuenta();
    }

    // Notificaciones (T29): la sección se actualiza al activarlas o al
    // cambiar qué suena (también desde otro celular).
    function conectarNotificaciones() {
        let ultimo = "";
        window.notificacionesVendeFrio.escuchar(() => {
            const notificaciones = window.notificacionesVendeFrio;
            const tipos = window.avisosVendeFrio?.tipos?.() || [];
            const texto = JSON.stringify([notificaciones.disponible(), notificaciones.estado(), notificaciones.error(),
                tipos.map(tipo => notificaciones.suena(tipo.id))]);
            if (texto === ultimo) return;
            ultimo = texto;

            const caja = document.getElementById("configDetalle");
            if (seccionAbierta === "avisos" && caja && !caja.classList.contains("oculto")) {
                detalle("avisos");
            }
        });
    }

    if (window.notificacionesVendeFrio) {
        conectarNotificaciones();
    } else {
        window.addEventListener("load", () => {
            if (window.notificacionesVendeFrio) conectarNotificaciones();
        }, { once: true });
    }

    if (window.avisosVendeFrio) {
        conectarAvisos();
    } else {
        window.addEventListener("load", () => {
            if (window.avisosVendeFrio) conectarAvisos();
        }, { once: true });
    }

    if (window.nubeVendeFrio) {
        conectarNube();
        conectarSincronizacion();
    } else {
        window.addEventListener("nubeVendeFrioLista", conectarSincronizacion, { once: true });
        window.addEventListener("nubeVendeFrioLista", conectarNube, { once: true });
    }
}());
