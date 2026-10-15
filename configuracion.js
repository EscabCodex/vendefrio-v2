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

    function crear() {
        if (pantalla()) return pantalla();

        const elemento = document.createElement("section");
        elemento.id = "pantallaConfiguracion";
        elemento.className = "oculto pantallaConfiguracion";

        elemento.innerHTML = `
            <header class="configHeader">
                <button class="configVolver" type="button">‹</button>
                <div>
                    <h1>Configuración</h1>
                    <p>Personalizá VendeFrío</p>
                </div>
            </header>
            <main class="container">
                <input class="configBuscador" id="buscarConfiguracion" type="search"
                    placeholder="Buscar en configuración">

                <div class="configMenuPrincipal">
                    <button class="configFila" data-config-seccion="cuenta">
                        <span class="configIcono">${window.icono("persona",20)}</span>
                        <span><strong>Cuenta</strong>
                        <small id="configCuentaResumen">Ingresá o salí de tu cuenta</small></span><b>›</b>
                    </button>

                    <button class="configFila oculto" data-config-seccion="empleados" id="configFilaEmpleados">
                        <span class="configIcono">${window.icono("persona",20)}</span>
                        <span><strong>Empleados</strong>
                        <small>Códigos de ingreso para tus empleados</small></span><b>›</b>
                    </button>

                    <button class="configFila oculto" data-config-seccion="avisos" id="configFilaAvisos">
                        <span class="configIcono">${window.icono("campana",20)}</span>
                        <span><strong>Avisos</strong>
                        <small>Qué avisos recibir y notificaciones</small></span><b>›</b>
                    </button>

                    <button class="configFila oculto" data-config-seccion="impresora" id="configFilaImpresora">
                        <span class="configIcono">${window.icono("impresora",20)}</span>
                        <span><strong>Impresora</strong>
                        <small>Impresora Bluetooth para los tickets</small></span><b>›</b>
                    </button>

                    <button class="configFila" data-config-seccion="apariencia">
                        <span class="configIcono">${window.icono("paleta",20)}</span>
                        <span><strong>Apariencia</strong>
                        <small>Elegí tema, texto y densidad</small></span><b>›</b>
                    </button>

                    <button class="configFila" data-config-seccion="respaldo">
                        <span class="configIcono">${window.icono("disquete",20)}</span>
                        <span><strong>Datos y respaldo</strong>
                        <small>${usaNubeReal()
                            ? "Respaldo de los datos de la nube"
                            : "Copias, restauración y frecuencia automática"}</small></span><b>›</b>
                    </button>

                    <button class="configFila" data-config-seccion="trabajo">
                        <span class="configIcono">${window.icono("maletin",20)}</span>
                        <span><strong>Preferencias de trabajo</strong>
                        <small>Ordená comercios, productos y pedidos</small></span><b>›</b>
                    </button>

                    <button class="configFila" data-config-seccion="navegacion">
                        <span class="configIcono">${window.icono("bicicleta",20)}</span>
                        <span><strong>Navegación</strong>
                        <small>Bicicleta, mapa y seguimiento GPS</small></span><b>›</b>
                    </button>

                    <button class="configFila" data-config-seccion="seguridad">
                        <span class="configIcono">${window.icono("escudo",20)}</span>
                        <span><strong>Seguridad y aplicación</strong>
                        <small>Permisos, ayuda e información de VendeFrío</small></span><b>›</b>
                    </button>
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
        document.documentElement.dataset.texto = d.texto || "normal";
        document.documentElement.dataset.densidad = d.densidad || "compacto";
    }

    function guardarCampo(campo, valor) {
        const d = leer();
        d[campo] = valor;
        guardar(d);
        aplicar();
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

        return `
            <p class="configEstado configNombreDistribuidora">
                Distribuidora<br>
                <strong id="cuentaNombreDistribuidora">${escaparTexto(nombre) || "…"}</strong>
            </p>
            ${esDueno ? `<button type="button" data-accion="editarNombreDistribuidora">Cambiar nombre</button>` : ""}
        `;
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

        return `
            <p class="configEstado" id="cuentaDatosTicket">
                Datos para el ticket<br>
                ${filas.length ? `<strong>${filas.join("<br>")}</strong>` : "Todavía sin cargar: el ticket sale solo con el nombre."}
            </p>
            <button type="button" data-accion="editarDatosTicket">${filas.length ? "Cambiar datos del ticket" : "Cargar datos del ticket"}</button>
        `;
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

        return `
            <p class="configEstado">
                Tu nombre (dueño)<br>
                <strong id="cuentaNombreDueno">${escaparTexto(nombre) || "Todavía sin cargar"}</strong>
            </p>
            <button type="button" data-accion="editarNombreDueno">Cambiar mi nombre</button>
        `;
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
            <p class="configEstado" id="cuentaDistribuidora">${texto}</p>
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
        return `
            <p class="configEstado">
                <strong>Respaldo de la nube</strong><br>
                Tus datos están en la nube de tu distribuidora. Descargá un
                respaldo una vez por semana y guardalo en un lugar seguro,
                como Google Drive.
            </p>
            <p class="configEstado">
                Último respaldo descargado en este celular:
                <strong id="configUltimoRespaldoNube">${textoUltimoRespaldoNube()}</strong>
            </p>
            <p class="configEstado" id="configConexionRespaldo" role="status">${textoConexionRespaldo()}</p>
            <div class="configAcciones">
                <button type="button" data-accion="exportar">Exportar respaldo</button>
                <button type="button" data-accion="importar">Combinar respaldo</button>
            </div>
            <p class="configEstado">
                "Combinar respaldo" agrega a la nube lo que falte de un archivo,
                sin borrar nada: lo que ya está en la nube tiene prioridad.
            </p>
        `;
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

        return `
            <div class="configMigracion" id="configLimpiezaDatosViejos">
                <p class="configEstado">
                    <strong>Datos viejos de este celular</strong><br>
                    Este celular todavía guarda los datos de antes de usar la
                    nube: comercios, productos, pedidos, rutas y la copia
                    interna. La app ya no los usa. Podés borrarlos en tres
                    pasos. La nube no se toca.
                </p>
                <button type="button" data-accion="limpiezaDescargar" ${limpieza.revisando ? "disabled" : ""}>
                    ${textoDescargar}
                </button>
                <button type="button" data-accion="limpiezaRevisar"
                    ${limpieza.revisando || !descargado ? "disabled" : ""}>
                    ${textoRevisar}
                </button>
                ${limpieza.error ? `<p class="configEstado migracionError" role="alert">${escaparTexto(limpieza.error)}</p>` : ""}
                ${htmlRevisionLimpieza()}
                <button type="button" data-accion="limpiezaBorrar" class="configPeligro"
                    ${limpieza.revisando || !descargado || !limpieza.revision ? "disabled" : ""}>
                    ${window.icono("tacho",14)} 3. Borrar datos viejos
                </button>
                <p class="configEstado">
                    Quedan tus preferencias, el borrador del pedido y tu sesión.
                </p>
            </div>
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
                <button type="button" data-accion="copiarCodigo">Copiar</button>
                <button type="button" data-accion="compartirCodigo">Compartir</button>
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
            <li class="empleadoFila">
                <strong>${escaparTexto(empleado.nombre) || "Sin nombre todavía"}</strong>
                <small>Activo · ${roles.length ? escaparTexto(roles.join(", ")) : "Sin roles"}</small>
                ${pendientes}
                <div class="configAcciones">
                    <button type="button" data-accion="cambiarRolesEmpleado" ${datos}>Cambiar roles</button>
                    <button type="button" data-accion="codigoReingreso" ${datos}
                        ${generandoCodigo ? "disabled" : ""}>
                        Código de reingreso
                    </button>
                </div>
                <button type="button" data-accion="darDeBaja" class="empleadoBaja" ${datos}>Dar de baja</button>
            </li>
        `;
    }

    function htmlListaEmpleados(lista) {
        const empleados = window.empleadosVendeFrio;

        if (!lista.length) {
            return `<p class="configEstado">Todavía no entró ningún empleado.</p>`;
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
            ` : `<p class="configEstado">No hay empleados activos.</p>`}
            ${deBaja.length ? `
                <p class="configEstado"><strong>Dados de baja</strong><br>
                    Ya no tienen acceso. Su nombre sigue en el historial.
                    Para que uno vuelva, generale un código nuevo.</p>
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
            return `<p class="configEstado">No hay códigos sin usar.</p>`;
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
                            <button type="button" data-accion="anularCodigo"
                                data-codigo="${escaparTexto(codigo.codigo)}">Anular</button>
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
                <label class="configSwitch">
                    <input type="checkbox" id="llaveTodosPuedenTodo" ${prendida ? "checked" : ""}>
                    <span><strong>Todos pueden hacer todo</strong><br>
                    <small id="textoLlaveEquipo">${htmlTextoLlave(prendida)}</small></span>
                </label>
                <p class="configEstado">
                    <small>Siempre, prendida o apagada: cobrar es solo tuyo y de quien tiene
                    un rol con «Cobra» aprobado por vos. Editar, eliminar y cancelar un
                    pedido, solo quien lo cargó y vos.</small>
                </p>
            </div>
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
            return `
                <p class="configEstado">
                    Solo el dueño de la distribuidora, con su cuenta iniciada,
                    puede ver los empleados y generar códigos.
                </p>
            `;
        }

        return `
            ${htmlLlaveEquipo()}
            <p class="configEstado">
                Generá un código y pasáselo al empleado (en persona o por WhatsApp).
                Tiene ${empleados.largoCodigo} caracteres, sirve una sola vez y vence a las
                ${empleados.horasDeVigencia} horas. Hace falta internet.
            </p>
            <button type="button" data-accion="generarCodigo" class="configCuentaIngresar"
                ${generandoCodigo ? "disabled" : ""}>
                ${generandoCodigo ? "Generando código…" : "Generar código para un empleado nuevo"}
            </button>
            ${htmlCodigoGenerado()}
            <p class="configEstado">
                <strong>Códigos sin usar</strong><br>
                Si pasaste un código por error o a la persona equivocada, anulalo.
            </p>
            <div id="listaCodigos">${htmlListaCodigos([])}</div>
            <p class="configEstado">
                <strong>Tus empleados</strong><br>
                Si un empleado cambia de celular o se le borran los datos, tocá
                "Código de reingreso": vuelve a ser el mismo empleado, con su
                nombre y sus roles.
            </p>
            <div id="listaEmpleados">${htmlListaEmpleados([])}</div>
            <p class="configEstado">
                <strong>Roles</strong><br>
                Creá, renombrá o eliminá los roles que pueden elegir tus empleados,
                y marcá qué permite cada uno. Una persona puede lo que permite
                cualquiera de sus roles. Vos podés todo. Con «Todos pueden hacer
                todo» prendida, los permisos deciden solo a quién le llega cada
                aviso y quién cobra.
            </p>
            <div id="editorRoles">${htmlEditorRoles()}</div>
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
            return `
                <p class="configEstado">
                    Los tickets se imprimen por Bluetooth desde un celular Android con Chrome,
                    con tu cuenta o con el código de tu encargado.
                </p>
            `;
        }

        const guardada = impresion.impresoraGuardada();

        return `
            <p class="configEstado">
                ${guardada
                    ? `Impresora guardada: <strong>${escaparTexto(guardada.nombre)}</strong>`
                    : "Todavía no elegiste una impresora: se elige la primera vez que tocás «Imprimir ticket» en un pedido."}
            </p>
            <p class="configEstado">
                Se conecta recién al imprimir, nunca al abrir la app. Vale solo para este celular.
            </p>
            <button type="button" data-accion="cambiarImpresora">${guardada ? "Cambiar impresora" : "Elegir impresora"}</button>
        `;
    }

    // --- Avisos (T23): qué avisos recibe cada persona ---
    function htmlAvisos() {
        const avisos = window.avisosVendeFrio;

        if (!avisos || !avisos.disponible()) {
            return `
                <p class="configEstado">
                    Los avisos son para el equipo de la distribuidora:
                    hace falta entrar con tu cuenta o con el código de tu encargado.
                </p>
            `;
        }

        const empleados = window.empleadosVendeFrio;
        const nombresPermisos = empleados?.permisos?.() || [];
        const casillas = avisos.tipos().map(tipo => {
            const permiso = nombresPermisos.find(item => item.id === tipo.permiso);
            // Los avisos van por los roles, no por "Todos pueden hacer todo" (T29d).
            const sinPermiso = permiso && !empleados.tieneEnSusRoles(tipo.permiso)
                ? `<br><em>Hoy no te llega: no tenés el permiso "${escaparTexto(permiso.nombre)}".</em>`
                : "";

            return `
                <label class="configSwitch configAviso">
                    <input type="checkbox" class="casillaAviso" value="${escaparTexto(tipo.id)}"
                        ${avisos.recibe(tipo.id) ? "checked" : ""}>
                    <span><strong>${escaparTexto(tipo.nombre)}</strong><br>
                    <small>${escaparTexto(tipo.quien)}${sinPermiso}</small></span>
                </label>
            `;
        }).join("");

        const problema = ["sinPermiso", "error"].includes(avisos.estado())
            ? `<p class="configEstado configAvisoProblema">
                No se pudieron leer tus avisos.
                ${avisos.estado() === "sinPermiso"
                    ? "Si sos el dueño, revisá que las reglas nuevas estén publicadas en Firebase."
                    : "Revisá la señal y volvé a abrir la app."}
            </p>`
            : "";

        return `
            ${problema}
            ${htmlNotificaciones()}
            <h3 class="subtituloAvisos">Qué avisos recibís</h3>
            ${casillas}
            <p class="configEstado">
                Nunca te llega aviso de lo que hacés vos. Lo que elegís se guarda
                en la nube: vale en cualquier celular donde entres.
            </p>
            ${htmlQueSuena()}
            <button type="button" data-accion="verAvisos">Ver mis avisos</button>
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
                <strong>Notificaciones con la app cerrada</strong>
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
                <label class="configSwitch configAviso">
                    <input type="checkbox" class="casillaSuena" value="${escaparTexto(tipo.id)}"
                        ${recibe && notificaciones.suena(tipo.id) ? "checked" : ""} ${recibe ? "" : "disabled"}>
                    <span><strong>${escaparTexto(tipo.nombre)}</strong>
                    ${recibe ? "" : "<br><small>No lo recibís: prendelo arriba, en «Qué avisos recibís».</small>"}</span>
                </label>
            `;
        }).join("");

        return `
            <h3 class="subtituloAvisos">Qué suena con la app cerrada</h3>
            ${casillas}
            <p class="configEstado">
                Lo que no suena igual te queda en la campanita. Vale en todos los
                celulares donde actives las notificaciones.
            </p>
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
            <p class="configEstado">
                Empleado<br>
                <strong>${escaparTexto(ficha?.nombre) || "…"}</strong><br>
                Roles: ${roles.length ? escaparTexto(roles.join(", ")) : "ninguno"}
            </p>
            <p class="configEstado" id="misPermisos">${htmlMisPermisos()}</p>
            <button type="button" data-accion="editarDatosEmpleado">Cambiar mi nombre o mis roles</button>
            ${htmlNombreDistribuidora()}
            <p class="configEstado" id="estadoNube">${textos[estadoNube] || ""}</p>
            ${htmlSincronizacion()}
            ${reintentar}
            <p class="configEstado">
                <strong>Recomendado:</strong> instalá la app en la pantalla de inicio del
                celular (Android: menú ⋮ &gt; "Instalar app"; iPhone: Compartir &gt;
                "Agregar a inicio"). Así el celular no borra los datos de la app.
            </p>
            <button type="button" data-accion="salirEmpleado">Salir</button>
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
                <p class="configEstado">
                    Sesión iniciada como<br>
                    <strong>${escaparTexto(usuario.email)}</strong>
                </p>
                ${htmlNombreDueno()}
                ${htmlNombreDistribuidora()}
                ${htmlDatosTicket()}
                ${htmlDistribuidora()}
                ${enLaNube ? "" : `
                <p class="configEstado">
                    ${eligiendo
                        ? "Todavía no entraste a la nube: elegí si subís los datos de este celular o si usás la nube sin subirlos."
                        : "Entrando a la nube de tu distribuidora…"}
                </p>`}
                ${htmlModoNube()}
                ${htmlMigracion()}
                <button type="button" data-accion="salirCuenta">
                    Salir de la cuenta
                </button>
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
            navegacion: ["Navegación", "Configurá el recorrido en bicicleta"],
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
            caja.innerHTML += `
                <label>${window.icono("paleta",15)} Tema
                    <select data-campo="tema">
                        <option value="sistema">Usar tema del teléfono</option>
                        <option value="claro">Modo claro</option>
                        <option value="oscuro">Modo oscuro</option>
                    </select>
                </label>

                <label>${window.icono("texto",15)} Tamaño de texto
                    <select data-campo="texto">
                        <option value="normal">Estándar</option>
                        <option value="grande">Grande</option>
                    </select>
                </label>

                <label>${window.icono("espaciado",15)} Espaciado
                    <select data-campo="densidad">
                        <option value="compacto">Compacto</option>
                        <option value="comodo">Cómodo</option>
                    </select>
                </label>
            `;
        }

        // Con la nube real, el empleado no ve los respaldos (T14) y el dueño
        // descarga y combina la nube, sin copia interna (T16b).
        const empleadoEnLaNube = window.empleadosVendeFrio?.esEmpleado() ||
            (usaNubeReal() && !esDuenoEnLaNube());

        if (seccion === "respaldo" && empleadoEnLaNube) {
            caja.innerHTML += `
                <p class="configEstado">
                    Tus datos están en la nube de la distribuidora.
                    Los respaldos los maneja tu encargado.
                </p>
            `;
        } else if (seccion === "respaldo" && usaNubeReal()) {
            caja.innerHTML += htmlRespaldoNube() + htmlLimpiezaDatosViejos();
        } else if (seccion === "respaldo") {
            const ultima = localStorage.getItem(
                "vendefrio_ultimo_respaldo_automatico"
            );

            caja.innerHTML += `
                <p class="configEstado">
                    Última copia interna:
                    <strong id="configUltimaCopia">
                        ${ultima
                            ? new Date(Number(ultima)).toLocaleString("es-AR")
                            : "Todavía no hay una copia"}
                    </strong>
                </p>

                <label>${window.icono("refrescar",15)} Respaldo automático
                    <select data-campo="frecuenciaRespaldo">
                        <option value="desactivado">Desactivado</option>
                        <option value="diario">Todos los días</option>
                        <option value="semanal">Una vez por semana</option>
                        <option value="mensual">Una vez por mes</option>
                    </select>
                </label>

                <div class="configAcciones">
                    <button type="button" data-accion="exportar">Exportar</button>
                    <button type="button" data-accion="importar">Importar archivo</button>
                </div>

                <button type="button" data-accion="restaurar"
                    class="configRestaurar">
                    ${window.icono("restaurarNube",14)} Restaurar última copia interna
                </button>
            `;
        }

        if (seccion === "trabajo") {
            caja.innerHTML += `
                <label>${window.icono("tienda",15)} Mostrar primero
                    <select data-campo="orden">
                        <option value="pendientes">Comercios pendientes</option>
                        <option value="frecuentes">Más visitados</option>
                        <option value="alfabetico">Orden alfabético</option>
                    </select>
                </label>

                <label>${window.icono("paquete",15)} Orden de productos
                    <select data-campo="ordenProductos">
                        <option value="marca">Por marca</option>
                        <option value="alfabetico">Alfabético</option>
                        <option value="frecuencia">Más pedidos</option>
                    </select>
                </label>
            `;
        }

        if (seccion === "navegacion") {
            caja.innerHTML += `
                <p class="configEstado">${window.icono("bicicleta",14)} Vehículo: bicicleta</p>

                <label>${window.icono("buscar",15)} Nivel de zoom
                    <select data-campo="zoom">
                        <option value="15">Amplio</option>
                        <option value="17">Normal</option>
                        <option value="18">Cercano</option>
                    </select>
                </label>

                <label class="configSwitch">
                    <input type="checkbox" data-campo="seguimiento">
                    <span>Seguimiento automático</span>
                </label>

                <label class="configSwitch">
                    <input type="checkbox" data-campo="instrucciones">
                    <span>Mostrar instrucciones</span>
                </label>

                <button type="button" data-accion="rutas">
                    Abrir Rutas
                </button>
            `;
        }

        if (seccion === "seguridad") {
            caja.innerHTML += `
                <p class="configEstado">
                    VendeFrío Lite<br>
                    ${window.nubeVendeFrio?.modoNube?.()
                        ? "Los datos se guardan en la nube de tu distribuidora."
                        : "Los datos se guardan en este dispositivo."}
                </p>

                <button type="button" data-accion="restablecer">
                    Restablecer preferencias visuales
                </button>
            `;
        }

        caja.querySelectorAll("[data-campo]").forEach(control => {
            const campo = control.dataset.campo;

            if (control.type === "checkbox") {
                control.checked = d[campo] === true;
                return;
            }

            const defecto =
                campo === "tema" ? "sistema" :
                campo === "texto" ? "normal" :
                campo === "densidad" ? "compacto" :
                campo === "frecuenciaRespaldo" ? "semanal" :
                campo === "zoom" ? "17" :
                "pendientes";

            control.value = d[campo] || defecto;
        });

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

        if (accion === "restablecer") {
            localStorage.removeItem(CLAVE);
            aplicar();
            detalle("apariencia");
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

    window.abrirConfiguracion = abrir;
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
        window.cuentaVendeFrio.escuchar(() => {
            actualizarResumenCuenta();

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
