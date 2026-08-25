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
                    <button class="configFila" data-config-seccion="apariencia">
                        <span class="configIcono">🎨</span>
                        <span><strong>Apariencia</strong>
                        <small>Elegí tema, texto y densidad</small></span><b>›</b>
                    </button>

                    <button class="configFila" data-config-seccion="respaldo">
                        <span class="configIcono">💾</span>
                        <span><strong>Datos y respaldo</strong>
                        <small>Copias, restauración y frecuencia automática</small></span><b>›</b>
                    </button>

                    <button class="configFila" data-config-seccion="trabajo">
                        <span class="configIcono">🧑‍💼</span>
                        <span><strong>Preferencias de trabajo</strong>
                        <small>Ordená comercios, productos y pedidos</small></span><b>›</b>
                    </button>

                    <button class="configFila" data-config-seccion="navegacion">
                        <span class="configIcono">🚲</span>
                        <span><strong>Navegación</strong>
                        <small>Bicicleta, mapa y seguimiento GPS</small></span><b>›</b>
                    </button>

                    <button class="configFila" data-config-seccion="seguridad">
                        <span class="configIcono">🛡️</span>
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

    function detalle(seccion) {
        const d = leer();
        const caja = document.getElementById("configDetalle");
        const menu = document.querySelector(".configMenuPrincipal");

        if (!caja || !menu) return;

        const titulos = {
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

        if (seccion === "apariencia") {
            caja.innerHTML += `
                <label>🎨 Tema
                    <select data-campo="tema">
                        <option value="sistema">Usar tema del teléfono</option>
                        <option value="claro">Modo claro</option>
                        <option value="oscuro">Modo oscuro</option>
                    </select>
                </label>

                <label>🔤 Tamaño de texto
                    <select data-campo="texto">
                        <option value="normal">Estándar</option>
                        <option value="grande">Grande</option>
                    </select>
                </label>

                <label>📐 Espaciado
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

                <label>🔄 Respaldo automático
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
                    ♻️ Restaurar última copia interna
                </button>
            `;
        }

        if (seccion === "trabajo") {
            caja.innerHTML += `
                <label>🏪 Mostrar primero
                    <select data-campo="orden">
                        <option value="pendientes">Comercios pendientes</option>
                        <option value="frecuentes">Más visitados</option>
                        <option value="alfabetico">Orden alfabético</option>
                    </select>
                </label>

                <label>📦 Orden de productos
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
                <p class="configEstado">🚲 Vehículo: bicicleta</p>

                <label>🔍 Nivel de zoom
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
}());
