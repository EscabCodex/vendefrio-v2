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

                    <button class="configFila" data-config-seccion="apariencia">
                        <span class="configIcono">${window.icono("paleta",20)}</span>
                        <span><strong>Apariencia</strong>
                        <small>Elegí tema, texto y densidad</small></span><b>›</b>
                    </button>

                    <button class="configFila" data-config-seccion="respaldo">
                        <span class="configIcono">${window.icono("disquete",20)}</span>
                        <span><strong>Datos y respaldo</strong>
                        <small>Copias, restauración y frecuencia automática</small></span><b>›</b>
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

    function htmlMigracion() {
        const nube = window.nubeVendeFrio;
        const distribuidora = window.distribuidoraVendeFrio;
        if (!nube || !nube.subirDatos || nube.modoPrueba() || nube.modoNube()) return "";

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
            ${enCurso || verificada || !nube.usarNubeSinSubir ? "" : `
            <div class="configMigracion">
                <p class="configEstado">
                    <strong>¿Ya subiste los datos desde otro celular?</strong><br>
                    Usá la nube en este celular sin subir nada desde acá.
                    Los datos de este celular no se suben ni se borran.
                </p>
                <button type="button" data-accion="usarNubeSinSubir">
                    Usar la nube sin subir datos
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
                Tus datos salen de tu distribuidora en la nube. Los datos de
                antes siguen guardados en este celular, sin cambios.
            </p>
            <p class="configEstado" id="estadoNube">${textos[estadoNube] || ""}</p>
            ${htmlSincronizacion()}
            ${reintentar}
            <button type="button" data-accion="juntarRepetidos">
                Juntar comercios y productos repetidos
            </button>
            <button type="button" data-accion="volverDatosCelular">
                Volver a los datos de este celular
            </button>
        `;
    }

    function htmlModoPrueba() {
        const nube = window.nubeVendeFrio;
        if (!nube || (nube.modoNube && nube.modoNube())) return "";

        if (!nube.modoPrueba()) {
            return `
                <p class="configEstado">
                    <strong>Modo prueba de la nube</strong><br>
                    Usa una distribuidora de prueba, aparte de tus datos reales,
                    para probar la nube con datos inventados. Tus datos de este
                    celular no se suben ni se borran.
                </p>
                <button type="button" data-accion="encenderModoPrueba">
                    Encender modo prueba
                </button>
            `;
        }

        const textos = {
            conectando: "Conectando con la nube de prueba…",
            conectada: "Conectada: los cambios se ven en los otros celulares con esta cuenta.",
            sinConexion: "Sin señal: los cambios se guardan en el celular y se suben solos cuando vuelva internet.",
            sinPermiso: "La nube no deja leer la distribuidora de prueba. Revisá que las reglas de seguridad estén publicadas.",
            error: "Hubo un problema con la nube de prueba. Probá de nuevo."
        };
        const estadoNube = nube.estado();
        const reintentar = ["sinConexion", "sinPermiso", "error"].includes(estadoNube)
            ? `<button type="button" data-accion="reintentarNube">Reintentar</button>`
            : "";

        return `
            <p class="configEstado">
                <strong>Modo prueba encendido</strong><br>
                Estás viendo la distribuidora de prueba en la nube.
                Tus datos reales siguen guardados en este celular, sin cambios.
            </p>
            <p class="configEstado" id="estadoNubePrueba">${textos[estadoNube] || ""}</p>
            ${htmlSincronizacion()}
            ${reintentar}
            <button type="button" data-accion="apagarModoPrueba">
                Apagar modo prueba
            </button>
        `;
    }

    function htmlCuenta() {
        const cuenta = window.cuentaVendeFrio;

        if (!cuenta || !cuenta.disponible()) {
            return `
                <p class="configEstado">
                    La cuenta no está disponible en este momento.
                    Tus datos siguen guardados en este dispositivo.
                </p>
            `;
        }

        const usuario = cuenta.usuarioActual();

        if (usuario) {
            return `
                <p class="configEstado">
                    Sesión iniciada como<br>
                    <strong>${escaparTexto(usuario.email)}</strong>
                </p>
                ${htmlNombreDistribuidora()}
                ${htmlDistribuidora()}
                ${window.nubeVendeFrio?.modoPrueba() || window.nubeVendeFrio?.modoNube?.() ? "" : `
                <p class="configEstado">
                    Por ahora tus datos siguen guardados en este dispositivo.
                </p>`}
                ${htmlModoNube()}
                ${htmlMigracion()}
                ${htmlModoPrueba()}
                <button type="button" data-accion="salirCuenta">
                    Salir de la cuenta
                </button>
            `;
        }

        return `
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
                Iniciar sesión no cambia tus datos: siguen guardados en este dispositivo.
            </p>
        `;
    }

    function actualizarResumenCuenta() {
        const resumen = document.getElementById("configCuentaResumen");
        if (!resumen) return;

        const usuario = window.cuentaVendeFrio?.usuarioActual();
        const nombre = usuario ? window.distribuidoraVendeFrio?.nombreActual?.() : "";
        resumen.textContent = usuario
            ? (nombre ? nombre + " · " : "") + usuario.email + (window.nubeVendeFrio?.modoPrueba()
                ? " · modo prueba"
                : window.nubeVendeFrio?.modoNube?.() ? " · nube" : "")
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
            cuenta: ["Cuenta", "Ingresá con tu email y contraseña"],
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

        if (seccion === "respaldo") {
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
        }

        if (accion === "importar") {
            document.getElementById("importarRespaldo")?.click();
        }

        if (accion === "rutas") {
            pantalla()?.classList.add("oculto");
            mostrarPantalla("rutas");
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

        if (accion === "salirCuenta") {
            const boton = event.target.closest("[data-accion]");
            const salir = () => {
                if (boton) boton.disabled = true;

                window.cuentaVendeFrio?.salir()
                    .then(() => mostrarToast("Saliste de tu cuenta"))
                    .catch(error => {
                        if (boton) boton.disabled = false;
                        mostrarAviso("No se pudo salir", error.message);
                    });
            };

            // En modo nube, salir vuelve a los datos de este celular (T11).
            if (window.nubeVendeFrio?.modoNube?.()) {
                abrirConfirmacion(
                    "Salir de la cuenta",
                    "Al salir, la app se recarga y vuelve a los datos guardados en este celular, que son los de antes de pasar a la nube. Lo que cargaste en la nube queda guardado allá.",
                    salir
                );
            } else {
                salir();
            }
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

        if (accion === "usarNubeSinSubir") {
            const boton = event.target.closest("[data-accion]");

            abrirConfirmacion(
                "Usar la nube sin subir datos",
                "Es para los demás celulares, cuando los datos ya se subieron desde el celular principal. La app se va a recargar y tus datos van a salir de la nube, compartidos con los otros celulares de tu cuenta. Los datos de este celular no se suben ni se borran. Hace falta internet.",
                () => {
                    if (boton) {
                        boton.disabled = true;
                        boton.textContent = "Revisando la nube…";
                    }

                    window.nubeVendeFrio.usarNubeSinSubir().catch(error => {
                        if (boton) {
                            boton.disabled = false;
                            boton.textContent = "Usar la nube sin subir datos";
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

        if (accion === "volverDatosCelular") {
            abrirConfirmacion(
                "Volver a los datos de este celular",
                "La app se va a recargar y vuelve a mostrar los datos guardados en este celular, que son los de antes de pasar a la nube. Lo que cargaste en la nube no va a aparecer acá, pero queda guardado allá. Para volver a la nube, subí tus datos otra vez.",
                () => window.nubeVendeFrio?.desactivarNube()
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

        if (accion === "reintentarDistribuidora") {
            window.distribuidoraVendeFrio?.reintentar();
        }

        if (accion === "encenderModoPrueba") {
            const boton = event.target.closest("[data-accion]");
            const encender = () => {
                if (boton) {
                    boton.disabled = true;
                    boton.textContent = "Preparando la nube de prueba…";
                }

                window.nubeVendeFrio?.activarPrueba().catch(error => {
                    if (boton) {
                        boton.disabled = false;
                        boton.textContent = "Encender modo prueba";
                    }
                    mostrarAviso("No se pudo encender el modo prueba", error.message);
                });
            };

            abrirConfirmacion(
                "Encender modo prueba",
                "La app se va a recargar y va a mostrar la distribuidora de prueba, que arranca vacía. Tus datos reales quedan guardados en este celular y vuelven al apagar el modo prueba.",
                encender
            );
        }

        if (accion === "apagarModoPrueba") {
            abrirConfirmacion(
                "Apagar modo prueba",
                "La app se va a recargar y vuelve a mostrar tus datos reales de este celular. Lo que cargaste en la prueba queda guardado en la nube de prueba.",
                () => window.nubeVendeFrio?.desactivarPrueba()
            );
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

        window.cuentaVendeFrio.ingresar(email, contrasena)
            .then(() => mostrarToast("Ingresaste a tu cuenta"))
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

    // Igual que la cuenta: distribuidora.js puede llegar después.
    function conectarDistribuidora() {
        window.distribuidoraVendeFrio.escuchar(() => {
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
    }

    if (window.distribuidoraVendeFrio) {
        conectarNombreDistribuidora();
        conectarDistribuidora();
    } else {
        window.addEventListener("distribuidoraVendeFrioLista", conectarNombreDistribuidora, { once: true });
        window.addEventListener("distribuidoraVendeFrioLista", conectarDistribuidora, { once: true });
    }

    // Estado del modo nube de prueba (T9).
    function conectarNube() {
        window.nubeVendeFrio.escuchar(() => {
            actualizarResumenCuenta();

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

    if (window.nubeVendeFrio) {
        conectarNube();
        conectarSincronizacion();
    } else {
        window.addEventListener("nubeVendeFrioLista", conectarSincronizacion, { once: true });
        window.addEventListener("nubeVendeFrioLista", conectarNube, { once: true });
    }
}());
