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

    function htmlModoPrueba() {
        const nube = window.nubeVendeFrio;
        if (!nube) return "";

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
                ${htmlDistribuidora()}
                ${window.nubeVendeFrio?.modoPrueba() ? "" : `
                <p class="configEstado">
                    Por ahora tus datos siguen guardados en este dispositivo.
                </p>`}
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
        resumen.textContent = usuario
            ? usuario.email + (window.nubeVendeFrio?.modoPrueba() ? " · modo prueba" : "")
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
                    Los datos se guardan en este dispositivo.
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
            if (boton) boton.disabled = true;

            window.cuentaVendeFrio?.salir()
                .then(() => mostrarToast("Saliste de tu cuenta"))
                .catch(error => {
                    if (boton) boton.disabled = false;
                    mostrarAviso("No se pudo salir", error.message);
                });
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
            if (frenarSiDatosNoSonLocales()) return;

            const copia = localStorage.getItem(
                "vendefrio_respaldo_automatico"
            );

            if (!copia) {
                return mostrarAviso(
                    "Sin copia interna",
                    "Todavía no existe una copia automática para restaurar."
                );
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

    if (window.distribuidoraVendeFrio) {
        conectarDistribuidora();
    } else {
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

    if (window.nubeVendeFrio) {
        conectarNube();
    } else {
        window.addEventListener("nubeVendeFrioLista", conectarNube, { once: true });
    }
}());
