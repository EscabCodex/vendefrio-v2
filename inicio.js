// VendeFrío - Pantalla de inicio y registro de la distribuidora (T13)
// Al abrir la app sin sesión aparece una pantalla con tres caminos:
// - "Distribuidora": ingresar con email y contraseña, o "Registrarse"
//   (crea la cuenta y la distribuidora vacía).
// - "Empleado" (T14): entra con el código que le da el encargado y después
//   carga su nombre (obligatorio) y sus roles (opcionales). Ver empleados.js.
// - "Continuar sin iniciar sesión": la app como antes, con los datos de este
//   celular. El celular recuerda la elección y no vuelve a preguntar.
// Quien ya tiene sesión no ve la pantalla: la sesión queda guardada en el
// celular y la app abre sin internet.
(function () {
    const CLAVE_SIN_SESION = "vendefrio_inicio_sin_sesion";
    const LARGO_MINIMO_CONTRASENA = 6;
    // Igual que el límite de firestore.rules.
    const LARGO_MAXIMO_NOMBRE = 80;

    let pantalla = null;
    let quitarOyenteDistribuidora = null;
    let quitarOyenteRoles = null;

    function eligioSinSesion() {
        try {
            return localStorage.getItem(CLAVE_SIN_SESION) === "1";
        } catch (error) {
            return false;
        }
    }

    function recordarSinSesion() {
        try {
            localStorage.setItem(CLAVE_SIN_SESION, "1");
        } catch (error) {
            console.warn("No se pudo recordar la elección de seguir sin sesión.", error);
        }
    }

    function horasCodigo() {
        return window.empleadosVendeFrio?.horasDeVigencia || 24;
    }

    function largoNombreEmpleado() {
        return window.empleadosVendeFrio?.largoMaximoNombre || 60;
    }

    function escapar(texto) {
        return String(texto || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function icono(nombre, tamano) {
        return typeof window.icono === "function" ? window.icono(nombre, tamano) : "";
    }

    // --- ¿Este celular tiene datos propios? ---
    // Datos propios = cualquier cosa distinta de las listas de ejemplo que la
    // app carga sola la primera vez. Ante la duda (datos dañados) se toma como
    // que sí tiene, así se ofrece la migración y no se deja nada atrás.

    function leerLocal(clave) {
        try {
            const texto = localStorage.getItem(clave);
            return texto === null ? undefined : JSON.parse(texto);
        } catch (error) {
            return null;
        }
    }

    function normalizar(texto) {
        return String(texto || "")
            .trim()
            .toLocaleLowerCase("es")
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "");
    }

    function tieneValor(valor) {
        if (valor === undefined || valor === null || valor === "" || valor === false || valor === 0) return false;
        if (Array.isArray(valor)) return valor.length > 0;
        if (typeof valor === "object") return Object.keys(valor).length > 0;
        return true;
    }

    // true si el registro solo tiene id y nombre (el resto vacío), como los de ejemplo.
    function esComoEjemplo(registro) {
        return Boolean(registro) && typeof registro === "object" &&
            Object.keys(registro).every(campo =>
                campo === "id" || campo === "nombre" || !tieneValor(registro[campo])
            );
    }

    function nombresDeComercios(lista) {
        return lista.map(comercio => normalizar(comercio && comercio.nombre)).sort().join("|");
    }

    function nombresDeProductos(productos) {
        return Object.keys(productos)
            .flatMap(marca => [normalizar(marca) + "/"].concat(
                (Array.isArray(productos[marca]) ? productos[marca] : [])
                    .map(producto => normalizar(marca) + "/" + normalizar(producto && producto.nombre))
            ))
            .sort()
            .join("|");
    }

    function celularTieneDatosPropios() {
        if (typeof COMERCIOS === "undefined" || typeof PRODUCTOS === "undefined") return true;

        const historial = leerLocal(DB_HISTORIAL);
        if (historial === null || (Array.isArray(historial) && historial.length)) return true;

        const rutas = leerLocal(DB_RUTAS_GUARDADAS);
        if (rutas === null || (Array.isArray(rutas) && rutas.length)) return true;

        const comercios = leerLocal(DB_COMERCIOS);
        if (comercios !== undefined) {
            if (!Array.isArray(comercios)) return true;
            if (nombresDeComercios(comercios) !== nombresDeComercios(COMERCIOS)) return true;
            if (!comercios.every(esComoEjemplo)) return true;
        }

        const productos = leerLocal(DB_PRODUCTOS);
        if (productos !== undefined) {
            if (!productos || typeof productos !== "object" || Array.isArray(productos)) return true;
            if (nombresDeProductos(productos) !== nombresDeProductos(PRODUCTOS)) return true;

            const todosComoEjemplo = Object.keys(productos).every(marca =>
                Array.isArray(productos[marca]) && productos[marca].every(esComoEjemplo)
            );
            if (!todosComoEjemplo) return true;
        }

        return false;
    }

    // --- Pantalla ---

    function htmlClave(id, autocompletar, texto) {
        return `
            <span class="inicioClave">
                <input type="password" id="${id}" autocomplete="${autocompletar}"
                    placeholder="${texto}" required>
                <button type="button" class="inicioVer" data-inicio="verContrasena"
                    data-campo="${id}" aria-label="Mostrar contraseña">
                    ${icono("ojo", 18)}
                </button>
            </span>
        `;
    }

    function crear() {
        if (pantalla) return pantalla;

        pantalla = document.createElement("div");
        pantalla.id = "pantallaInicioSesion";
        pantalla.className = "inicioSesion";
        pantalla.setAttribute("role", "dialog");
        pantalla.setAttribute("aria-modal", "true");
        pantalla.setAttribute("aria-labelledby", "inicioTitulo");

        pantalla.innerHTML = `
            <div class="inicioContenido">
                <div class="inicioMarca">
                    <img src="icon.svg" alt="" width="56" height="56">
                    <h1 id="inicioTitulo">VendeFrío</h1>
                    <p>Pedidos y reparto desde el celular</p>
                </div>

                <div data-paso="elegir">
                    <p class="inicioNota oculto" id="inicioAviso" role="alert"></p>

                    <button type="button" class="inicioOpcion" data-inicio="distribuidora">
                        <span class="inicioOpcionIcono">${icono("tienda", 22)}</span>
                        <span><strong>Distribuidora</strong>
                        <small>Dueño, encargado o persona a cargo</small></span>
                        <b aria-hidden="true">›</b>
                    </button>

                    <button type="button" class="inicioOpcion" data-inicio="empleado">
                        <span class="inicioOpcionIcono">${icono("persona", 22)}</span>
                        <span><strong>Empleado</strong>
                        <small>Ingresá con el código que te dará tu encargado</small></span>
                        <b aria-hidden="true">›</b>
                    </button>


                    <button type="button" class="inicioSinSesion" data-inicio="sinSesion">
                        Continuar sin iniciar sesión
                    </button>
                    <p class="inicioAclaracion">
                        Los datos quedan solo en este celular y no se comparten.
                        Podés ingresar después desde Configuración &gt; Cuenta.
                    </p>
                </div>

                <form data-paso="ingresar" class="inicioFormulario oculto" id="inicioFormIngresar" novalidate>
                    <h2>Ingresar</h2>
                    <label>Email
                        <input type="email" id="inicioEmail" autocomplete="username"
                            inputmode="email" autocapitalize="off" spellcheck="false"
                            placeholder="tu@email.com" required>
                    </label>
                    <label>Contraseña
                        ${htmlClave("inicioContrasena", "current-password", "Tu contraseña")}
                    </label>
                    <p class="inicioError oculto" role="alert"></p>
                    <button type="submit" class="inicioPrincipal">Ingresar</button>
                    <button type="button" class="inicioEnlace" data-inicio="irRegistrarse">
                        ¿Es tu primera vez? <strong>Registrarse</strong>
                    </button>
                    <button type="button" class="inicioVolver" data-inicio="volver">‹ Volver</button>
                </form>

                <form data-paso="registrarse" class="inicioFormulario oculto" id="inicioFormRegistrarse" novalidate>
                    <h2>Registrarse</h2>
                    <p class="inicioAclaracion">
                        Se crea tu cuenta y tu distribuidora en la nube, vacía.
                        Hace falta internet.
                    </p>
                    <label>Nombre de tu distribuidora
                        <input type="text" id="inicioRegistroNombre" autocomplete="organization"
                            maxlength="${LARGO_MAXIMO_NOMBRE}" placeholder="Por ejemplo: Distribuidora Frío Sur" required>
                    </label>
                    <label>Email
                        <input type="email" id="inicioRegistroEmail" autocomplete="username"
                            inputmode="email" autocapitalize="off" spellcheck="false"
                            placeholder="tu@email.com" required>
                    </label>
                    <label>Contraseña (al menos ${LARGO_MINIMO_CONTRASENA} caracteres)
                        ${htmlClave("inicioRegistroContrasena", "new-password", "Elegí una contraseña")}
                    </label>
                    <label>Repetí la contraseña
                        ${htmlClave("inicioRegistroRepetir", "new-password", "La misma contraseña")}
                    </label>
                    <p class="inicioError oculto" role="alert"></p>
                    <button type="submit" class="inicioPrincipal">Crear cuenta y distribuidora</button>
                    <button type="button" class="inicioEnlace" data-inicio="irIngresar">
                        ¿Ya tenés cuenta? <strong>Ingresar</strong>
                    </button>
                    <button type="button" class="inicioVolver" data-inicio="volver">‹ Volver</button>
                </form>

                <form data-paso="empleadoCodigo" class="inicioFormulario oculto" id="inicioFormEmpleado" novalidate>
                    <h2>Entrar como empleado</h2>
                    <p class="inicioAclaracion">
                        Escribí el código que te dio tu encargado. Sirve una sola vez
                        y vence a las ${horasCodigo()} horas. Hace falta internet.
                    </p>
                    <label>Código
                        <input type="text" id="inicioCodigo" class="inicioCodigo" autocomplete="one-time-code"
                            autocapitalize="characters" autocorrect="off" spellcheck="false"
                            maxlength="12" placeholder="ABCD-2345" required>
                    </label>
                    <p class="inicioError oculto" role="alert"></p>
                    <button type="submit" class="inicioPrincipal">Entrar</button>
                    <button type="button" class="inicioVolver" data-inicio="volver">‹ Volver</button>
                </form>

                <form data-paso="empleadoDatos" class="inicioFormulario oculto" id="inicioFormDatosEmpleado" novalidate>
                    <h2>Tus datos</h2>
                    <p class="inicioAclaracion">
                        Así te ven tu encargado y tus compañeros.
                    </p>
                    <label>Tu nombre
                        <input type="text" id="inicioNombreEmpleado" autocomplete="name"
                            maxlength="${largoNombreEmpleado()}" placeholder="Por ejemplo: Juan Pérez" required>
                    </label>
                    <fieldset class="inicioRoles">
                        <legend>Tus roles (podés marcar varios o ninguno)</legend>
                        <div id="inicioListaRoles"></div>
                    </fieldset>
                    <p class="inicioNota">
                        <strong>Recomendado:</strong> instalá la app en la pantalla de inicio
                        del celular. En Android: menú ⋮ del navegador &gt; "Agregar a la
                        pantalla principal" o "Instalar app". En iPhone: botón Compartir
                        de Safari &gt; "Agregar a inicio". Si no la instalás, el celular
                        puede borrar los datos de la app y vas a necesitar un código nuevo.
                    </p>
                    <p class="inicioError oculto" role="alert"></p>
                    <button type="submit" class="inicioPrincipal">Guardar y entrar</button>
                </form>

                <div data-paso="creando" class="oculto">
                    <h2>Tu distribuidora</h2>
                    <p class="inicioNota" id="inicioEstadoCreando" role="status"></p>
                    <button type="button" class="inicioPrincipal oculto" id="inicioReintentar"
                        data-inicio="reintentar">Reintentar</button>
                    <button type="button" class="inicioSinSesion oculto" id="inicioSeguirCelular"
                        data-inicio="seguirCelular">Seguir con los datos de este celular</button>
                </div>

                <div data-paso="datosPropios" class="oculto">
                    <h2>Tu distribuidora está lista</h2>
                    <p class="inicioNota">
                        Este celular tiene datos guardados (comercios, productos,
                        pedidos o rutas). ¿Querés subirlos a tu distribuidora en la nube?
                        Primero se exporta un respaldo y los datos de este celular no se borran.
                    </p>
                    <button type="button" class="inicioPrincipal" data-inicio="subirDatos">
                        Subir mis datos a la nube
                    </button>
                    <button type="button" class="inicioSinSesion" data-inicio="ahoraNo">
                        Ahora no, seguir con los datos de este celular
                    </button>
                </div>
            </div>
        `;

        pantalla.addEventListener("click", alTocar);
        pantalla.addEventListener("submit", alEnviar);

        document.body.appendChild(pantalla);
        document.documentElement.classList.add("inicioAbierto");

        return pantalla;
    }

    function mostrarPaso(nombre) {
        if (!pantalla) return;

        pantalla.querySelectorAll("[data-paso]").forEach(paso => {
            paso.classList.toggle("oculto", paso.dataset.paso !== nombre);
        });
        pantalla.scrollTop = 0;
    }

    function cerrar() {
        if (quitarOyenteRoles) {
            quitarOyenteRoles();
            quitarOyenteRoles = null;
        }

        if (quitarOyenteDistribuidora) {
            quitarOyenteDistribuidora();
            quitarOyenteDistribuidora = null;
        }

        if (pantalla) {
            pantalla.remove();
            pantalla = null;
        }

        document.documentElement.classList.remove("inicioAbierto");
    }

    function mostrarError(formulario, texto) {
        const error = formulario.querySelector(".inicioError");
        if (!error) return;

        error.textContent = texto;
        error.classList.toggle("oculto", !texto);
    }

    function ocupar(boton, texto) {
        if (!boton) return () => {};

        const original = boton.textContent;
        boton.disabled = true;
        boton.textContent = texto;

        return () => {
            boton.disabled = false;
            boton.textContent = original;
        };
    }

    function abrirCuentaEnConfiguracion() {
        if (typeof window.abrirConfiguracion !== "function") return false;

        window.abrirConfiguracion();
        document.querySelector('#pantallaConfiguracion [data-config-seccion="cuenta"]')?.click();
        return true;
    }

    // --- Después de registrarse ---

    function mostrarEstadoCreando(texto, conError) {
        const estado = document.getElementById("inicioEstadoCreando");
        if (estado) estado.textContent = texto;

        document.getElementById("inicioReintentar")?.classList.toggle("oculto", !conError);
        document.getElementById("inicioSeguirCelular")?.classList.toggle("oculto", !conError);
    }

    function seguirConLaDistribuidora() {
        if (celularTieneDatosPropios()) {
            mostrarPaso("datosPropios");
            return;
        }

        // Sin datos propios: la nube directamente.
        mostrarEstadoCreando("Tu distribuidora está lista. Abriendo la nube…", false);

        const nube = window.nubeVendeFrio;
        if (!nube || !nube.usarNubeNueva) {
            mostrarEstadoCreando("La nube no está disponible en este momento.", true);
            return;
        }

        nube.usarNubeNueva().catch(error => {
            mostrarEstadoCreando(error.message || "No se pudo abrir la nube. Probá de nuevo.", true);
        });
    }

    // distribuidora.js crea la distribuidora al primer ingreso, como siempre.
    function esperarDistribuidora(uid) {
        const distribuidora = window.distribuidoraVendeFrio;

        mostrarPaso("creando");
        mostrarEstadoCreando("Creando tu distribuidora en la nube…", false);

        if (!distribuidora) {
            mostrarEstadoCreando("La nube no está disponible en este momento.", true);
            return;
        }

        if (quitarOyenteDistribuidora) quitarOyenteDistribuidora();

        const textosDeError = {
            sinConexion: "No hay conexión. Tu cuenta ya está creada: tocá Reintentar cuando vuelva la señal.",
            sinPermiso: "La nube no dejó crear tu distribuidora. Revisá que las reglas de seguridad estén publicadas en Firebase.",
            error: "No se pudo crear tu distribuidora. Probá de nuevo.",
            noDisponible: "La nube no está disponible en este momento."
        };

        let listo = false;

        const quitar = distribuidora.escuchar((estado, id) => {
            if (listo || window.cuentaVendeFrio?.usuarioActual()?.uid !== uid) return;

            if ((estado === "creada" || estado === "lista") && id === uid) {
                listo = true;
                setTimeout(() => {
                    quitar();
                    if (quitarOyenteDistribuidora === quitar) quitarOyenteDistribuidora = null;
                    seguirConLaDistribuidora();
                }, 0);
                return;
            }

            if (textosDeError[estado]) {
                mostrarEstadoCreando(textosDeError[estado], true);
            } else {
                mostrarEstadoCreando("Creando tu distribuidora en la nube…", false);
            }
        });

        quitarOyenteDistribuidora = quitar;
    }

    // --- Empleado (T14) ---

    function enviarCodigo(formulario, boton) {
        const empleados = window.empleadosVendeFrio;
        const codigo = document.getElementById("inicioCodigo")?.value || "";

        if (!empleados) {
            mostrarError(formulario, "La nube no está disponible en este momento.");
            return;
        }

        mostrarError(formulario, "");
        const liberar = ocupar(boton, "Revisando el código…");

        empleados.canjearCodigo(codigo)
            .then(resultado => {
                boton.textContent = resultado.tipo === "reingreso"
                    ? "¡Listo! Volviste a entrar…"
                    : "¡Listo! Entrando…";
                return empleados.entrarALaNube();
            })
            .catch(error => {
                liberar();
                mostrarError(formulario, error.message);
            });
    }

    function dibujarRoles() {
        const caja = document.getElementById("inicioListaRoles");
        const empleados = window.empleadosVendeFrio;
        if (!caja || !empleados) return;

        // Se conservan las casillas ya marcadas al redibujar.
        const marcados = new Set(
            Array.from(caja.querySelectorAll("input:checked")).map(casilla => casilla.value)
        );
        if (!caja.dataset.dibujado) {
            (empleados.miFicha()?.roles || []).forEach(id => marcados.add(id));
            caja.dataset.dibujado = "1";
        }

        caja.innerHTML = empleados.roles().map(rol => `
            <label class="inicioRol">
                <input type="checkbox" value="${escapar(rol.id)}" ${marcados.has(rol.id) ? "checked" : ""}>
                <span>${escapar(rol.nombre)}</span>
            </label>
        `).join("");
    }

    // La pide empleados.js mientras la ficha no tenga nombre.
    function pedirDatosEmpleado() {
        const empleados = window.empleadosVendeFrio;
        if (!empleados) return;

        const yaAbierta = pantalla && !pantalla.querySelector('[data-paso="empleadoDatos"]').classList.contains("oculto");
        if (yaAbierta) return;

        crear();
        mostrarPaso("empleadoDatos");

        const campo = document.getElementById("inicioNombreEmpleado");
        if (campo && !campo.value) campo.value = empleados.miFicha()?.nombre || "";

        if (quitarOyenteRoles) quitarOyenteRoles();
        quitarOyenteRoles = empleados.escucharRoles(dibujarRoles);
    }

    function enviarDatosEmpleado(formulario, boton) {
        const empleados = window.empleadosVendeFrio;
        const nombre = (document.getElementById("inicioNombreEmpleado")?.value || "").trim();
        const roles = Array.from(document.querySelectorAll("#inicioListaRoles input:checked"))
            .map(casilla => casilla.value);

        if (!nombre) {
            mostrarError(formulario, "Escribí tu nombre.");
            return;
        }

        mostrarError(formulario, "");
        const liberar = ocupar(boton, "Guardando…");

        empleados.guardarMisDatos(nombre, roles)
            .then(ficha => {
                cerrar();
                mostrarToast("¡Hola, " + escapar(ficha.nombre) + "!");
            })
            .catch(error => {
                liberar();
                mostrarError(formulario, error.message);
            });
    }

    // Desde Configuración > Cuenta, sin sesión.
    function abrirEmpleado() {
        crear();
        mostrarPaso("empleadoCodigo");
        document.getElementById("inicioCodigo")?.focus();
    }

    // --- Acciones ---

    function alTocar(event) {
        const boton = event.target.closest("[data-inicio]");
        if (!boton) return;

        const accion = boton.dataset.inicio;

        if (accion === "distribuidora") {
            mostrarPaso("ingresar");
            return;
        }

        if (accion === "empleado") {
            mostrarPaso("empleadoCodigo");
            document.getElementById("inicioCodigo")?.focus();
            return;
        }

        if (accion === "sinSesion") {
            recordarSinSesion();
            cerrar();
            return;
        }

        if (accion === "irRegistrarse") {
            mostrarPaso("registrarse");
            return;
        }

        if (accion === "irIngresar") {
            mostrarPaso("ingresar");
            return;
        }

        if (accion === "volver") {
            mostrarPaso("elegir");
            return;
        }

        if (accion === "verContrasena") {
            const campo = document.getElementById(boton.dataset.campo);
            if (!campo) return;

            const mostrar = campo.type === "password";
            campo.type = mostrar ? "text" : "password";
            boton.setAttribute("aria-label", mostrar ? "Ocultar contraseña" : "Mostrar contraseña");
            boton.classList.toggle("activo", mostrar);
            return;
        }

        if (accion === "reintentar") {
            const usuario = window.cuentaVendeFrio?.usuarioActual();
            if (!usuario) {
                mostrarPaso("ingresar");
                return;
            }

            // Si la distribuidora ya estaba lista, falló la nube: se vuelve a probar.
            if (window.distribuidoraVendeFrio?.idActual() === usuario.uid) {
                seguirConLaDistribuidora();
                return;
            }

            esperarDistribuidora(usuario.uid);
            window.distribuidoraVendeFrio?.reintentar();
            return;
        }

        if (accion === "seguirCelular") {
            cerrar();
            mostrarAviso(
                "Seguís con los datos de este celular",
                "Tu cuenta quedó iniciada. Cuando tu distribuidora esté lista, podés pasar a la nube desde Configuración > Cuenta."
            );
            return;
        }

        if (accion === "subirDatos") {
            cerrar();
            if (!abrirCuentaEnConfiguracion()) {
                mostrarAviso("Subir mis datos", "Entrá a Configuración > Cuenta y seguí los pasos de \"Subir mis datos a la nube\".");
            }
            return;
        }

        if (accion === "ahoraNo") {
            cerrar();
            mostrarAviso(
                "Tus datos siguen en este celular",
                "Tu cuenta y tu distribuidora quedaron listas. Cuando quieras, subí tus datos desde Configuración > Cuenta > \"Subir mis datos a la nube\"."
            );
        }
    }

    function alEnviar(event) {
        const formulario = event.target;
        event.preventDefault();

        const cuenta = window.cuentaVendeFrio;
        const boton = formulario.querySelector('button[type="submit"]');

        if (!cuenta) {
            mostrarError(formulario, "La cuenta no está disponible en este momento.");
            return;
        }

        if (formulario.id === "inicioFormEmpleado") {
            enviarCodigo(formulario, boton);
            return;
        }

        if (formulario.id === "inicioFormDatosEmpleado") {
            enviarDatosEmpleado(formulario, boton);
            return;
        }

        if (formulario.id === "inicioFormIngresar") {
            const email = document.getElementById("inicioEmail")?.value || "";
            const contrasena = document.getElementById("inicioContrasena")?.value || "";

            if (!email.trim() || !contrasena) {
                mostrarError(formulario, "Completá el email y la contraseña.");
                return;
            }

            mostrarError(formulario, "");
            const liberar = ocupar(boton, "Ingresando…");

            cuenta.ingresar(email, contrasena)
                .then(() => {
                    cerrar();
                    mostrarToast("Ingresaste a tu cuenta");
                })
                .catch(error => {
                    liberar();
                    mostrarError(formulario, error.message);
                });
            return;
        }

        if (formulario.id === "inicioFormRegistrarse") {
            const nombre = (document.getElementById("inicioRegistroNombre")?.value || "").trim();
            const email = document.getElementById("inicioRegistroEmail")?.value || "";
            const contrasena = document.getElementById("inicioRegistroContrasena")?.value || "";
            const repetir = document.getElementById("inicioRegistroRepetir")?.value || "";

            if (!nombre) {
                mostrarError(formulario, "Escribí el nombre de tu distribuidora.");
                return;
            }

            if (!email.trim() || !contrasena || !repetir) {
                mostrarError(formulario, "Completá el email y las dos contraseñas.");
                return;
            }

            if (contrasena.length < LARGO_MINIMO_CONTRASENA) {
                mostrarError(formulario, "La contraseña tiene que tener al menos " + LARGO_MINIMO_CONTRASENA + " caracteres.");
                return;
            }

            if (contrasena !== repetir) {
                mostrarError(formulario, "Las dos contraseñas no coinciden.");
                return;
            }

            mostrarError(formulario, "");
            const liberar = ocupar(boton, "Creando tu cuenta…");

            // La distribuidora se crea con este nombre apenas existe la cuenta.
            window.distribuidoraVendeFrio?.prepararNombre(nombre);

            cuenta.registrarse(email, contrasena)
                .then(usuario => esperarDistribuidora(usuario.uid))
                .catch(error => {
                    window.distribuidoraVendeFrio?.prepararNombre(null);
                    liberar();
                    mostrarError(formulario, error.message);
                });
        }
    }

    // --- Arranque ---
    // Se espera a saber si hay sesión guardada (también sin internet).
    function decidir() {
        // Un empleado que perdió el acceso vuelve a ver la pantalla con el aviso.
        const aviso = window.empleadosVendeFrio?.hayAvisoParaElInicio?.()
            ? window.empleadosVendeFrio.avisoParaElInicio()
            : "";

        if (eligioSinSesion() && !aviso) return;

        const cuenta = window.cuentaVendeFrio;
        if (!cuenta || !cuenta.disponible()) return;

        let decidido = false;

        const quitar = cuenta.escuchar(usuario => {
            if (decidido) return;
            decidido = true;
            setTimeout(() => quitar(), 0);

            if (!usuario) {
                crear();
                mostrarPaso("elegir");

                const nota = document.getElementById("inicioAviso");
                if (nota && aviso) {
                    nota.textContent = aviso;
                    nota.classList.remove("oculto");
                }
            }
        });
    }

    window.inicioVendeFrio = {
        tieneDatosPropios: celularTieneDatosPropios,
        pedirDatosEmpleado,
        abrirEmpleado
    };

    decidir();
}());
