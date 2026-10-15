// VendeFrío - Pantalla de inicio y registro de la distribuidora (T13)
// Al abrir la app sin sesión aparece una pantalla con tres caminos:
// - "Distribuidora": ingresar con email y contraseña, o "Registrarse"
//   (crea la cuenta y la distribuidora vacía).
// - "Empleado" (T14): entra con el código que le da el encargado y después
//   carga su nombre (obligatorio) y sus roles (opcionales). Ver empleados.js.
// - "Continuar sin iniciar sesión": el modo personal (T16d), con los datos
//   solo en este celular. Pide nombre (obligatorio) y roles (opcionales) y
//   los guarda en el celular, que recuerda la elección y no vuelve a
//   preguntar. Mientras se usa, un cartel fijo avisa que los datos no están
//   protegidos.
// Solo nube (T16c): con cuenta se entra siempre a la nube de la
// distribuidora, al ingresar, al registrarse y al abrir la app con sesión.
// Antes, si el celular tiene datos propios, se pregunta una sola vez si se
// suben (T11) o no. Quien ya usa la nube no ve la pantalla: la sesión queda
// guardada en el celular y la app abre sin internet.
// Nombre del dueño (T18): ya en la nube, si la nube confirma que el dueño
// todavía no cargó su nombre, se le pide una sola vez (obligatorio). Sin
// internet no se pide: la app abre igual y se pide al volver la señal.
(function () {
    const CLAVE_SIN_SESION = DB_INICIO_SIN_SESION;
    const LARGO_MINIMO_CONTRASENA = 6;
    // Igual que el límite de firestore.rules.
    const LARGO_MAXIMO_NOMBRE = 80;
    // Modo personal (T16d): { nombre, roles } de quien usa la app sin cuenta.
    // Vive solo en este celular y no se sube a la nube.
    const CLAVE_MODO_PERSONAL = "vendefrio_modo_personal";
    const LARGO_MAXIMO_NOMBRE_PERSONAL = 60;
    // Los 5 roles precargados, con los mismos ids que ROLES_PRECARGADOS de
    // empleados.js (acá no hay distribuidora de donde leerlos).
    const ROLES_PERSONALES = [
        { id: "vendedor", nombre: "Vendedor" },
        { id: "deposito", nombre: "Depósito" },
        { id: "repartidor", nombre: "Repartidor" },
        { id: "cobranza", nombre: "Cobranza" },
        { id: "administracion", nombre: "Administración" }
    ];
    const TEXTO_CARTEL_PERSONAL = "Tus datos no están protegidos: están solo en este celular. Iniciá sesión para guardarlos en la nube";

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

    // --- Modo personal (T16d) ---

    function datosPersonales() {
        try {
            const datos = JSON.parse(localStorage.getItem(CLAVE_MODO_PERSONAL) || "null");
            if (!datos || typeof datos !== "object") return null;

            const nombre = String(datos.nombre || "").trim();
            if (!nombre) return null;

            const ids = ROLES_PERSONALES.map(rol => rol.id);
            const roles = Array.isArray(datos.roles) ? datos.roles.filter(id => ids.includes(id)) : [];
            return { nombre, roles };
        } catch (error) {
            return null;
        }
    }

    function guardarDatosPersonales(nombre, roles) {
        localStorage.setItem(CLAVE_MODO_PERSONAL, JSON.stringify({ nombre, roles }));
    }

    function nombresDeRolesPersonales(roles) {
        return ROLES_PERSONALES
            .filter(rol => (roles || []).includes(rol.id))
            .map(rol => rol.nombre);
    }

    // Se usa la app sin cuenta: ni nube, ni sesión con email, ni empleado.
    function usaModoPersonal() {
        if (!eligioSinSesion() || usaNubeReal()) return false;

        const usuario = window.cuentaVendeFrio?.usuarioActual?.();
        if (usuario && !usuario.isAnonymous) return false;
        if (usuario && window.empleadosVendeFrio?.esEmpleado?.()) return false;
        return true;
    }

    // Cartel fijo, arriba de la barra de abajo. Al tocarlo abre la pantalla
    // de inicio, para ingresar o registrarse (o entrar como empleado).
    function mostrarCartelPersonal() {
        if (!document.body || document.getElementById("cartelModoPersonal")) return;

        const cartel = document.createElement("button");
        cartel.type = "button";
        cartel.id = "cartelModoPersonal";
        cartel.className = "cartelModoPersonal";
        cartel.textContent = TEXTO_CARTEL_PERSONAL;
        cartel.addEventListener("click", () => {
            crear();
            mostrarPaso("elegir");
        });

        document.body.appendChild(cartel);
        document.documentElement.classList.add("conCartelPersonal");
    }

    function quitarCartelPersonal() {
        document.getElementById("cartelModoPersonal")?.remove();
        document.documentElement.classList.remove("conCartelPersonal");
    }

    function horasCodigo() {
        return window.empleadosVendeFrio?.horasDeVigencia || 24;
    }

    function largoNombreEmpleado() {
        return window.empleadosVendeFrio?.largoMaximoNombre || 60;
    }

    function largoNombreDueno() {
        return window.distribuidoraVendeFrio?.largoMaximoNombreDueno || 60;
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

                <form data-paso="personal" class="inicioFormulario oculto" id="inicioFormPersonal" novalidate>
                    <h2>Usar sin cuenta</h2>
                    <p class="inicioNota">
                        Tus datos no están protegidos: quedan solo en este celular
                        y no se comparten. Si se pierde o se borra el celular, se pierden.
                        Podés iniciar sesión después para guardarlos en la nube.
                    </p>
                    <label>Tu nombre
                        <input type="text" id="inicioNombrePersonal" autocomplete="name"
                            maxlength="${LARGO_MAXIMO_NOMBRE_PERSONAL}" placeholder="Por ejemplo: Juan Pérez" required>
                    </label>
                    <fieldset class="inicioRoles">
                        <legend>Tus roles (podés marcar varios o ninguno)</legend>
                        <div id="inicioRolesPersonales">
                            ${ROLES_PERSONALES.map(rol => `
                                <label class="inicioRol">
                                    <input type="checkbox" value="${escapar(rol.id)}">
                                    <span>${escapar(rol.nombre)}</span>
                                </label>
                            `).join("")}
                        </div>
                    </fieldset>
                    <p class="inicioError oculto" role="alert"></p>
                    <button type="submit" class="inicioPrincipal">Guardar y entrar</button>
                    <button type="button" class="inicioVolver" data-inicio="volverPersonal">${icono("flechaIzquierda", 18)} Volver</button>
                </form>

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
                    <button type="button" class="inicioVolver" data-inicio="volver">${icono("flechaIzquierda", 18)} Volver</button>
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
                    <button type="button" class="inicioVolver" data-inicio="volver">${icono("flechaIzquierda", 18)} Volver</button>
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
                    <button type="button" class="inicioVolver" data-inicio="volver">${icono("flechaIzquierda", 18)} Volver</button>
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
                    <p class="inicioAclaracion oculto" id="inicioNotaCobra">
                        Los roles con «Cobra» quedan pendientes hasta que tu encargado
                        los apruebe: mientras tanto no registrás cobros. Los demás valen al instante.
                    </p>
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

                <form data-paso="duenoDatos" class="inicioFormulario oculto" id="inicioFormDatosDueno" novalidate>
                    <h2>Tu nombre</h2>
                    <p class="inicioAclaracion">
                        Así te ven tus empleados y así va a figurar quién hizo cada
                        cosa en los pedidos. Se pide una sola vez: después lo cambiás
                        en Configuración &gt; Cuenta.
                    </p>
                    <label>Tu nombre
                        <input type="text" id="inicioNombreDueno" autocomplete="name"
                            maxlength="${largoNombreDueno()}" placeholder="Por ejemplo: Juan Pérez" required>
                    </label>
                    <p class="inicioError oculto" role="alert"></p>
                    <button type="submit" class="inicioPrincipal">Guardar y entrar</button>
                </form>

                <div data-paso="creando" class="oculto">
                    <h2>Tu distribuidora</h2>
                    <p class="inicioNota" id="inicioEstadoCreando" role="status"></p>
                    <button type="button" class="inicioPrincipal oculto" id="inicioReintentar"
                        data-inicio="reintentar">Reintentar</button>
                    <button type="button" class="inicioVolver oculto" id="inicioSalirCuenta"
                        data-inicio="salirCuenta">${icono("salir", 18)} Salir de la cuenta</button>
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
                    <button type="button" class="inicioSinSesion" data-inicio="noSubir">
                        No subirlos y usar la nube
                    </button>
                    <button type="button" class="inicioVolver" data-inicio="salirCuenta">${icono("salir", 18)} Salir de la cuenta</button>
                </div>

                <div data-paso="confirmarNoSubir" class="oculto">
                    <h2>¿Usar la nube sin subir tus datos?</h2>
                    <p class="inicioNota">
                        Los datos de este celular no se suben ni se borran: quedan
                        guardados acá, pero la app ya no los muestra. Vas a ver lo que
                        está en la nube de tu distribuidora. En este celular no se
                        vuelve a ofrecer subirlos.
                    </p>
                    <p class="inicioError oculto" id="inicioErrorNoSubir" role="alert"></p>
                    <button type="button" class="inicioPrincipal" data-inicio="usarNubeSinSubir">
                        Sí, usar la nube
                    </button>
                    <button type="button" class="inicioVolver" data-inicio="volverDatosPropios">${icono("flechaIzquierda", 18)} Volver</button>
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

    // --- Entrar a la nube con cuenta (T13 y T16c) ---
    // Con cuenta se entra siempre a la nube: al ingresar, al registrarse y al
    // abrir la app con sesión. Mientras tanto esta pantalla tapa la app, así
    // no se usan los datos de este celular.

    let uidEntrando = null;
    // Eligió "Subir mis datos a la nube": sigue con los pasos de T11 en
    // Configuración > Cuenta, todavía con los datos de este celular.
    let eligioSubirDatos = false;
    let registrando = false;

    // La migración de T11 se ofrece una sola vez por celular y solo si tiene
    // datos propios (no cuentan las listas de ejemplo). La ve solo el dueño:
    // el empleado entra con su código, sin pasar por acá.
    function ofrecerSubirDatos() {
        return !usaNubeReal() && !migracionResuelta() && celularTieneDatosPropios();
    }

    function mostrarEstadoCreando(texto, conError) {
        const estado = document.getElementById("inicioEstadoCreando");
        if (estado) estado.textContent = texto;

        document.getElementById("inicioReintentar")?.classList.toggle("oculto", !conError);
        document.getElementById("inicioSalirCuenta")?.classList.toggle("oculto", !conError);
    }

    function usarLaNube(alFallar) {
        const nube = window.nubeVendeFrio;
        if (!nube || !nube.usarNube) {
            alFallar("La nube no está disponible en este momento.");
            return;
        }

        nube.usarNube().catch(error => {
            alFallar(error.message || "No se pudo abrir la nube. Probá de nuevo.");
        });
    }

    function seguirConLaDistribuidora() {
        mostrarPaso("creando");

        // Sin datos propios (o ya resueltos): la nube directamente.
        if (!ofrecerSubirDatos()) {
            mostrarEstadoCreando("Tu distribuidora está lista. Abriendo la nube…", false);
            usarLaNube(texto => mostrarEstadoCreando(texto, true));
            return;
        }

        // Si una subida empezó en este celular y quedó a medias, se pregunta
        // otra vez para poder terminarla.
        const nube = window.nubeVendeFrio;
        if (subidaDeDatosEmpezada() || !nube || !nube.datosDelCelularEnLaNube) {
            mostrarPaso("datosPropios");
            return;
        }

        // Si este celular ya subió sus datos antes, no se pregunta (T16c).
        mostrarEstadoCreando("Revisando si los datos de este celular ya están en la nube…", false);

        nube.datosDelCelularEnLaNube()
            .then(yaEstan => {
                if (!yaEstan) {
                    mostrarPaso("datosPropios");
                    return;
                }

                mostrarEstadoCreando("Los datos de este celular ya estaban en la nube. Abriendo la nube…", false);
                usarLaNube(texto => mostrarEstadoCreando(texto, true));
            })
            .catch(error => mostrarEstadoCreando(error.message, true));
    }

    // distribuidora.js crea la distribuidora al primer ingreso, como siempre.
    function esperarDistribuidora(uid) {
        const distribuidora = window.distribuidoraVendeFrio;
        const textoEspera = registrando
            ? "Creando tu distribuidora en la nube…"
            : "Preparando tu distribuidora en la nube…";

        mostrarPaso("creando");
        mostrarEstadoCreando(textoEspera, false);

        if (!distribuidora) {
            mostrarEstadoCreando("La nube no está disponible en este momento.", true);
            return;
        }

        if (quitarOyenteDistribuidora) quitarOyenteDistribuidora();

        const textosDeError = {
            sinConexion: "No hay conexión. Tocá Reintentar cuando vuelva la señal.",
            sinPermiso: "La nube no dejó preparar tu distribuidora. Revisá que las reglas de seguridad estén publicadas en Firebase.",
            error: "No se pudo preparar tu distribuidora. Probá de nuevo.",
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

            if ((estado === "creada" || estado === "lista") && id) {
                mostrarEstadoCreando("Esta cuenta no es dueña de una distribuidora. Salí y entrá con la cuenta del dueño.", true);
            } else if (textosDeError[estado]) {
                mostrarEstadoCreando(textosDeError[estado], true);
            } else {
                mostrarEstadoCreando(textoEspera, false);
            }
        });

        quitarOyenteDistribuidora = quitar;
    }

    function entrarConCuenta(usuario) {
        if (!usuario || usuario.isAnonymous) return;
        // Ya usa la nube (si es otra cuenta, nube.js sale y recarga).
        if (usaNubeReal()) return;
        if (eligioSubirDatos || uidEntrando === usuario.uid) return;

        uidEntrando = usuario.uid;
        quitarCartelPersonal();
        crear();
        esperarDistribuidora(usuario.uid);
    }

    // "Salir de la cuenta" desde esta pantalla: vuelve al inicio (T16c).
    function salirDeLaCuenta() {
        const nube = window.nubeVendeFrio;

        if (quitarOyenteDistribuidora) {
            quitarOyenteDistribuidora();
            quitarOyenteDistribuidora = null;
        }

        mostrarPaso("creando");
        mostrarEstadoCreando("Saliendo de tu cuenta…", false);

        if (!nube || !nube.salirDeLaCuenta) {
            mostrarEstadoCreando("La cuenta no está disponible en este momento.", true);
            return;
        }

        nube.salirDeLaCuenta().catch(error => mostrarEstadoCreando(error.message, true));
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

        // T29d: un rol con "Cobra" que todavía no tiene queda pendiente de
        // aprobar por el dueño; se avisa antes de elegirlo.
        const ficha = empleados.miFicha();
        const tiene = new Set(ficha?.roles || []);
        const pendientes = new Set(empleados.rolesPendientesDe?.(ficha) || []);
        const conCobra = new Set(empleados.rolesConPermiso?.("cobra") || []);
        const aclaracion = rol => {
            if (pendientes.has(rol.id)) return "Pendiente de aprobar";
            if (conCobra.has(rol.id) && !tiene.has(rol.id)) return "Con «Cobra»: lo aprueba tu encargado";
            return "";
        };

        caja.innerHTML = empleados.roles().map(rol => `
            <label class="inicioRol">
                <input type="checkbox" value="${escapar(rol.id)}" ${marcados.has(rol.id) ? "checked" : ""}>
                <span>${escapar(rol.nombre)}${aclaracion(rol)
                    ? `<small class="inicioRolAclaracion">${escapar(aclaracion(rol))}</small>`
                    : ""}</span>
            </label>
        `).join("");

        document.getElementById("inicioNotaCobra")?.classList.toggle(
            "oculto",
            !empleados.roles().some(rol => aclaracion(rol))
        );
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
                const pendientes = empleados.nombresDeRoles(ficha.nuevosPendientes || []);
                if (pendientes.length) {
                    mostrarAviso(
                        "Rol pendiente de aprobar",
                        pendientes.map(rol => "«" + rol + "»").join(", ") + " tiene «Cobra»: le avisamos a tu encargado para que lo apruebe. " +
                            "Mientras tanto no registrás cobros. Los demás roles ya valen."
                    );
                } else {
                    mostrarToast("¡Hola, " + escapar(ficha.nombre) + "!");
                }
            })
            .catch(error => {
                liberar();
                mostrarError(formulario, error.message);
            });
    }

    // --- Nombre del dueño (T18) ---

    function pasoAbierto(nombre) {
        return Boolean(pantalla && !pantalla.querySelector(`[data-paso="${nombre}"]`)?.classList.contains("oculto"));
    }

    // Se revisa cada vez que cambia lo que se sabe del nombre del dueño. Solo
    // con la nube: antes de entrar (migración, registro) no se pide. Si ya lo
    // cargó en otro celular mientras la pantalla estaba abierta, se cierra.
    function revisarNombreDueno() {
        const distribuidora = window.distribuidoraVendeFrio;
        if (!distribuidora || !distribuidora.faltaNombreDueno) return;

        const falta = usaNubeReal() && distribuidora.faltaNombreDueno();
        const abierta = pasoAbierto("duenoDatos");

        if (!falta) {
            if (abierta && distribuidora.nombreDuenoActual()) cerrar();
            return;
        }

        if (abierta) return;
        // Otra pantalla de inicio en curso (por ejemplo, entrando a la nube).
        if (pantalla) return;

        crear();
        mostrarPaso("duenoDatos");
    }

    function enviarDatosDueno(formulario, boton) {
        const distribuidora = window.distribuidoraVendeFrio;
        const nombre = (document.getElementById("inicioNombreDueno")?.value || "").trim();

        if (!nombre) {
            mostrarError(formulario, "Escribí tu nombre.");
            return;
        }
        if (!distribuidora || !distribuidora.cambiarNombreDueno) {
            mostrarError(formulario, "La nube no está disponible en este momento.");
            return;
        }

        mostrarError(formulario, "");
        const liberar = ocupar(boton, "Guardando…");

        distribuidora.cambiarNombreDueno(nombre)
            .then(guardado => {
                cerrar();
                mostrarToast("¡Hola, " + escapar(guardado) + "!");
            })
            .catch(error => {
                liberar();
                mostrarError(formulario, error.message);
            });
    }

    // --- Modo personal (T16d) ---

    let personalDesdeConfiguracion = false;

    // Pide nombre y roles. Lo ve quien toca "Continuar sin iniciar sesión" y,
    // una sola vez, quien ya lo había elegido antes de T16d.
    function pedirDatosPersonales(desdeConfiguracion) {
        personalDesdeConfiguracion = Boolean(desdeConfiguracion);
        crear();
        mostrarPaso("personal");

        const formulario = document.getElementById("inicioFormPersonal");
        if (formulario) mostrarError(formulario, "");

        const datos = datosPersonales();
        const campo = document.getElementById("inicioNombrePersonal");
        if (campo) campo.value = datos ? datos.nombre : "";

        document.querySelectorAll("#inicioRolesPersonales input").forEach(casilla => {
            casilla.checked = Boolean(datos && datos.roles.includes(casilla.value));
        });
    }

    function enviarDatosPersonales(formulario, boton) {
        const nombre = (document.getElementById("inicioNombrePersonal")?.value || "").trim();
        const roles = Array.from(document.querySelectorAll("#inicioRolesPersonales input:checked"))
            .map(casilla => casilla.value);

        if (!nombre) {
            mostrarError(formulario, "Escribí tu nombre.");
            return;
        }

        try {
            guardarDatosPersonales(nombre.slice(0, LARGO_MAXIMO_NOMBRE_PERSONAL), roles);
        } catch (error) {
            mostrarError(formulario, "No se pudo guardar en este celular. Probá de nuevo.");
            return;
        }

        const desdeConfiguracion = personalDesdeConfiguracion;
        mostrarError(formulario, "");
        recordarSinSesion();
        cerrar();
        mostrarCartelPersonal();
        window.dispatchEvent(new CustomEvent("modoPersonalVendeFrio"));
        mostrarToast(desdeConfiguracion ? "Datos guardados" : "¡Hola, " + escapar(nombre) + "!");
        if (boton) boton.blur();
    }

    // Al abrir la app en modo personal: el nombre se pide una sola vez.
    function seguirEnModoPersonal() {
        if (usaNubeReal()) return;

        if (datosPersonales()) {
            mostrarCartelPersonal();
            return;
        }

        pedirDatosPersonales(false);
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
            // Abierta desde el cartel: ya tiene nombre, sigue como estaba.
            if (usaModoPersonal() && datosPersonales()) {
                cerrar();
                return;
            }

            pedirDatosPersonales(false);
            document.getElementById("inicioNombrePersonal")?.focus();
            return;
        }

        if (accion === "volverPersonal") {
            // Desde Configuración se cierra sin cambiar nada.
            if (personalDesdeConfiguracion && datosPersonales()) {
                cerrar();
                return;
            }

            mostrarPaso("elegir");
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

        if (accion === "salirCuenta") {
            salirDeLaCuenta();
            return;
        }

        if (accion === "subirDatos") {
            eligioSubirDatos = true;
            cerrar();
            if (!abrirCuentaEnConfiguracion()) {
                mostrarAviso("Subir mis datos", "Entrá a Configuración > Cuenta y seguí los pasos de \"Subir mis datos a la nube\".");
            }
            return;
        }

        if (accion === "noSubir") {
            document.getElementById("inicioErrorNoSubir")?.classList.add("oculto");
            mostrarPaso("confirmarNoSubir");
            return;
        }

        if (accion === "volverDatosPropios") {
            mostrarPaso("datosPropios");
            return;
        }

        if (accion === "usarNubeSinSubir") {
            const error = document.getElementById("inicioErrorNoSubir");
            const liberar = ocupar(boton, "Abriendo la nube…");

            error?.classList.add("oculto");
            usarLaNube(texto => {
                liberar();
                if (!error) return;
                error.textContent = texto;
                error.classList.remove("oculto");
            });
        }
    }

    function alEnviar(event) {
        const formulario = event.target;
        event.preventDefault();

        const cuenta = window.cuentaVendeFrio;
        const boton = formulario.querySelector('button[type="submit"]');

        // El modo personal no usa la cuenta (T16d).
        if (formulario.id === "inicioFormPersonal") {
            enviarDatosPersonales(formulario, boton);
            return;
        }

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

        if (formulario.id === "inicioFormDatosDueno") {
            enviarDatosDueno(formulario, boton);
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

            // Con cuenta se entra a la nube (T16c).
            cuenta.ingresar(email, contrasena)
                .then(usuario => {
                    liberar();
                    entrarConCuenta(usuario);
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
            registrando = true;

            cuenta.registrarse(email, contrasena)
                .then(usuario => {
                    liberar();
                    entrarConCuenta(usuario);
                })
                .catch(error => {
                    registrando = false;
                    window.distribuidoraVendeFrio?.prepararNombre(null);
                    liberar();
                    mostrarError(formulario, error.message);
                });
        }
    }

    // --- Arranque ---
    // Se espera a saber si hay sesión guardada (también sin internet). Con
    // cuenta se entra a la nube, también si la cuenta se inicia después
    // (por ejemplo, desde Configuración > Cuenta) (T16c).
    function decidir() {
        // Un empleado que perdió el acceso vuelve a ver la pantalla con el aviso.
        const aviso = window.empleadosVendeFrio?.hayAvisoParaElInicio?.()
            ? window.empleadosVendeFrio.avisoParaElInicio()
            : "";

        const cuenta = window.cuentaVendeFrio;
        if (!cuenta || !cuenta.disponible()) {
            // Sin cuenta disponible, quien eligió el modo personal sigue en él.
            if (eligioSinSesion() && !usaNubeReal()) seguirEnModoPersonal();
            return;
        }

        let primera = true;

        cuenta.escuchar(usuario => {
            const esPrimera = primera;
            primera = false;

            if (usuario && !usuario.isAnonymous) {
                entrarConCuenta(usuario);
                return;
            }

            if (!esPrimera) return;
            // El empleado ya entró con su código: lo maneja empleados.js.
            if (usuario && window.empleadosVendeFrio?.esEmpleado()) return;
            if (eligioSinSesion() && !aviso) {
                seguirEnModoPersonal();
                return;
            }

            crear();
            mostrarPaso("elegir");

            const nota = document.getElementById("inicioAviso");
            if (nota && aviso) {
                nota.textContent = aviso;
                nota.classList.remove("oculto");
            }
        });
    }

    window.inicioVendeFrio = {
        tieneDatosPropios: celularTieneDatosPropios,
        ofrecerSubirDatos,
        entrarConCuenta,
        pedirDatosEmpleado,
        abrirEmpleado,
        // Modo personal (T16d)
        usaModoPersonal,
        datosPersonales,
        nombresDeRolesPersonales,
        pedirDatosPersonales: () => pedirDatosPersonales(true)
    };

    decidir();

    // Nombre del dueño (T18): distribuidora.js avisa cuando la nube confirma
    // si ya lo tiene.
    if (window.distribuidoraVendeFrio?.escucharNombreDueno) {
        window.distribuidoraVendeFrio.escucharNombreDueno(revisarNombreDueno);
        window.distribuidoraVendeFrio.escuchar(revisarNombreDueno);
    }
}());
