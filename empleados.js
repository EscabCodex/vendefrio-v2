// VendeFrío - Empleados: ingreso con código (T14) y panel del dueño (T15)
// - El dueño genera códigos en Configuración > Empleados: uno de alta para un
//   empleado nuevo, o uno de reingreso para pasar a un empleado a otro celular.
//   8 caracteres sin letras que se confundan, sirven una vez y vencen a las 24 h.
// - El empleado elige "Empleado" en la pantalla de inicio, escribe el código y
//   la app le crea una cuenta anónima (sin email ni contraseña, guardada en el
//   celular). En una sola tanda se marca el código como usado, se lo suma como
//   miembro y se crea (o, en el reingreso, se pasa a su cuenta) su ficha de
//   empleado. firestore.rules revisa que el código sea válido.
// - El empleado siempre usa la nube de la distribuidora. Si otro celular entra
//   con un código de reingreso, o si el dueño lo da de baja, este pierde el
//   acceso y vuelve al inicio.
// - Panel del dueño (T15): cambiar roles, anular códigos sin usar, dar de baja
//   y editar la lista de roles.
// - "Quién soy" (T18): quién usa este celular (dueño, empleado o modo
//   personal), para registrar quién hace cada cosa en la Etapa 3.
// - Permisos por rol (T19): cada rol tiene sus casillas de permiso, que solo
//   marca el dueño. puede(permiso) dice si la persona de este celular lo tiene.
// - "Todos pueden hacer todo" (T29d): una llave en config/equipo que solo
//   cambia el dueño. Prendida (así arranca), cualquiera hace cualquier paso;
//   los roles deciden solo los avisos. Cobrar es siempre de "Cobra" y del
//   dueño. Un rol con "Cobra" que elige el empleado queda en
//   "rolesPendientes" hasta que el dueño lo aprueba.
// Los datos de este celular (localStorage) no se leen ni se borran.
(function () {
    // Este celular es de un empleado: { uid, distribuidora, idEmpleado }.
    const CLAVE_EMPLEADO = "vendefrio_empleado";
    // Aviso para mostrar en la pantalla de inicio después de recargar.
    const CLAVE_AVISO_INICIO = "vendefrio_aviso_inicio";
    const LETRAS_CODIGO = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    const LARGO_CODIGO = 8;
    const HORAS_DE_VIGENCIA = 24;
    const LARGO_MAXIMO_NOMBRE = 60;
    const LARGO_MAXIMO_ROL = 30;
    const MAXIMO_DE_ROLES = 50;
    const ESPERA_MAXIMA_NUBE = 30 * 1000;

    // Cada distribuidora arranca con estos roles (el id no cambia nunca).
    const ROLES_PRECARGADOS = [
        { id: "vendedor", nombre: "Vendedor" },
        { id: "deposito", nombre: "Depósito" },
        { id: "repartidor", nombre: "Repartidor" },
        { id: "cobranza", nombre: "Cobranza" },
        { id: "administracion", nombre: "Administración" }
    ];

    // Permisos de la Etapa 3 (T19). El id no cambia nunca: lo usan las reglas.
    const PERMISOS = [
        { id: "prepara", nombre: "Prepara pedidos" },
        { id: "reparte", nombre: "Reparte" },
        { id: "cobra", nombre: "Cobra" },
        { id: "avisoFaltantes", nombre: "Recibe aviso de faltantes" },
        { id: "controla", nombre: "Controla pedidos" }
    ];
    const IDS_PERMISOS = PERMISOS.map(permiso => permiso.id);
    // Los que da "Todos pueden hacer todo" (T29d): los pasos del pedido,
    // los faltantes y las incidencias. Nunca "Cobra".
    const PERMISOS_DE_LA_LLAVE = ["prepara", "reparte", "controla"];

    // Los permisos acordados para los roles precargados (por su id, así vale
    // aunque el dueño los haya renombrado). Vendedor y los roles nuevos
    // arrancan sin permisos.
    const PERMISOS_PRECARGADOS = {
        deposito: ["prepara", "reparte"],
        repartidor: ["reparte"],
        cobranza: ["cobra"],
        administracion: ["avisoFaltantes", "controla"]
    };

    let miFicha = null;
    let roles = null;
    // "Todos pueden hacer todo" (T29d): prendida mientras la nube no diga
    // otra cosa (sin config/equipo también está prendida).
    let todosPuedenTodo = true;
    let dejarDeEscucharLlave = null;
    const oyentesLlave = [];
    // La lista de roles de la nube ya recibió los permisos de los
    // precargados (T19): se hace una sola vez.
    let permisosIniciales = false;
    let ultimosRoles = "";
    let dejarDeEscucharRoles = null;
    let completandoPermisos = false;
    let empleados = [];
    let codigosSinUsar = [];
    const oyentesMiFicha = [];
    const oyentesRoles = [];
    const oyentesEmpleados = [];
    const oyentesCodigos = [];
    const oyentesQuienSoy = [];
    const oyentesPermisos = [];
    let ultimoQuienSoy = "null";
    let ultimosPermisos = "";
    let dejarDeEscucharEmpleados = null;
    let saliendo = false;

    function obtenerFirestore() {
        try {
            if (window.firebase && window.firebase.apps.length && window.firebase.firestore) {
                return window.firebase.firestore();
            }
        } catch (error) {
            console.error("Firestore no está disponible.", error);
        }
        return null;
    }

    function obtenerAuth() {
        try {
            if (window.firebase && window.firebase.apps.length && window.firebase.auth) {
                return window.firebase.auth();
            }
        } catch (error) {
            console.error("Firebase Auth no está disponible.", error);
        }
        return null;
    }

    function ahora() {
        return window.firebase.firestore.FieldValue.serverTimestamp();
    }

    function avisarA(oyentes, valor) {
        oyentes.forEach(oyente => {
            try {
                oyente(valor);
            } catch (error) {
                console.error("Falló un aviso de empleados.", error);
            }
        });
    }

    function sumarOyente(oyentes, oyente, valorActual) {
        if (typeof oyente !== "function") return () => {};

        oyentes.push(oyente);
        oyente(valorActual);

        return () => {
            const indice = oyentes.indexOf(oyente);
            if (indice >= 0) oyentes.splice(indice, 1);
        };
    }

    // Espera a la nube, pero no para siempre (sin señal, Firestore espera).
    function esperarNube(promesa) {
        return Promise.race([
            promesa,
            new Promise((resolver, rechazar) => setTimeout(() => {
                const error = new Error("La nube tardó demasiado en responder.");
                error.code = "deadline-exceeded";
                rechazar(error);
            }, ESPERA_MAXIMA_NUBE))
        ]);
    }

    function errorConTexto(texto, codigo) {
        const error = new Error(texto);
        error.code = codigo || "empleados";
        return error;
    }

    // -------------------------------------------------
    // Códigos
    // -------------------------------------------------

    // Sin espacios ni guiones y en mayúsculas: "abcd-2345" -> "ABCD2345".
    function limpiarCodigo(texto) {
        return String(texto || "").toUpperCase().replace(/[\s-]/g, "");
    }

    function codigoValido(codigo) {
        return new RegExp("^[" + LETRAS_CODIGO + "]{" + LARGO_CODIGO + "}$").test(codigo);
    }

    // "ABCD2345" -> "ABCD-2345", más fácil de leer y dictar.
    function formatearCodigo(codigo) {
        const limpio = limpiarCodigo(codigo);
        return limpio.length === LARGO_CODIGO ? limpio.slice(0, 4) + "-" + limpio.slice(4) : limpio;
    }

    function codigoAlAzar() {
        const valores = new Uint8Array(LARGO_CODIGO);
        window.crypto.getRandomValues(valores);
        // 32 letras posibles: cada valor de 0 a 255 cae parejo en una.
        return Array.from(valores, valor => LETRAS_CODIGO[valor % LETRAS_CODIGO.length]).join("");
    }

    function venceEl(creado) {
        const inicio = creado && typeof creado.toDate === "function" ? creado.toDate() : new Date();
        return new Date(inicio.getTime() + HORAS_DE_VIGENCIA * 60 * 60 * 1000);
    }

    // -------------------------------------------------
    // Este celular: ¿es de un empleado?
    // -------------------------------------------------

    function leerGuardado() {
        try {
            const guardado = JSON.parse(localStorage.getItem(CLAVE_EMPLEADO) || "null");

            if (guardado && typeof guardado.uid === "string" && guardado.uid &&
                typeof guardado.distribuidora === "string" && guardado.distribuidora &&
                typeof guardado.idEmpleado === "string" && guardado.idEmpleado) {
                return guardado;
            }
        } catch (error) {
            console.warn("Los datos de empleado guardados no son válidos.", error);
        }
        return null;
    }

    function esEmpleado() {
        const usuario = window.cuentaVendeFrio?.usuarioActual();
        const guardado = leerGuardado();
        return Boolean(usuario && usuario.isAnonymous && guardado && guardado.uid === usuario.uid);
    }

    function esDueno() {
        const usuario = window.cuentaVendeFrio?.usuarioActual();
        const idDistribuidora = window.distribuidoraVendeFrio?.idActual();
        return Boolean(usuario && !usuario.isAnonymous && idDistribuidora && idDistribuidora === usuario.uid);
    }

    // Vacía la copia de la nube en el celular (no localStorage), como al
    // cambiar de modo en nube.js.
    async function vaciarCopiaDeLaNube() {
        try {
            const firestore = obtenerFirestore();

            if (firestore) {
                await firestore.terminate();
                await firestore.clearPersistence();
            }
        } catch (error) {
            console.warn("No se pudo vaciar la copia de la nube en el celular.", error);
        }
    }

    // Deja este celular sin cuenta de empleado: sin modo nube, sin la copia
    // de la nube y sin sesión. Vuelve a la pantalla de inicio, también si
    // antes se había elegido "Continuar sin iniciar sesión" (T16c).
    async function dejarCelularSinEmpleado(avisoParaElInicio) {
        if (saliendo) return;
        saliendo = true;

        try {
            localStorage.removeItem(CLAVE_EMPLEADO);
            localStorage.removeItem(DB_MODO_NUBE);
            localStorage.removeItem(DB_INICIO_SIN_SESION);
            // El aviso hace que aparezca la pantalla de inicio al recargar.
            if (avisoParaElInicio) sessionStorage.setItem(CLAVE_AVISO_INICIO, avisoParaElInicio);
        } catch (error) {
            console.warn("No se pudo limpiar el modo empleado.", error);
        }

        await vaciarCopiaDeLaNube();

        try {
            await obtenerAuth()?.signOut();
        } catch (error) {
            console.warn("No se pudo cerrar la cuenta anónima.", error);
        }

        window.location.reload();
    }

    function hayAvisoParaElInicio() {
        try {
            return Boolean(sessionStorage.getItem(CLAVE_AVISO_INICIO));
        } catch (error) {
            return false;
        }
    }

    function avisoParaElInicio() {
        try {
            const texto = sessionStorage.getItem(CLAVE_AVISO_INICIO) || "";
            sessionStorage.removeItem(CLAVE_AVISO_INICIO);
            return texto;
        } catch (error) {
            return "";
        }
    }

    // -------------------------------------------------
    // Ingreso del empleado con código
    // -------------------------------------------------

    function mensajeDeError(error) {
        const codigo = error && error.code;

        if (codigo === "empleados") return error.message;
        if (!navigator.onLine || codigo === "unavailable" || codigo === "deadline-exceeded" ||
            codigo === "auth/network-request-failed") {
            return "No hay conexión a internet. Para entrar con el código hace falta señal.";
        }
        if (codigo === "auth/operation-not-allowed" || codigo === "auth/admin-restricted-operation") {
            return "El ingreso de empleados no está activado en Firebase. Avisale a tu encargado.";
        }
        if (codigo === "permission-denied") {
            return "Este código no sirve: puede estar vencido, ya usado o mal escrito. Pedile uno nuevo a tu encargado.";
        }
        return "No se pudo entrar con el código. Probá de nuevo.";
    }

    // Revisa el código, crea la cuenta anónima y suma al empleado a la
    // distribuidora en una sola tanda. Devuelve { tipo, distribuidora, idEmpleado }.
    async function canjearCodigo(texto) {
        const codigo = limpiarCodigo(texto);
        const db = obtenerFirestore();
        const auth = obtenerAuth();

        if (!codigo) throw errorConTexto("Escribí el código que te dio tu encargado.");
        if (!codigoValido(codigo)) {
            throw errorConTexto("El código tiene " + LARGO_CODIGO + " letras y números. Revisá que esté bien escrito.");
        }
        if (!db || !auth) throw errorConTexto("La nube no está disponible en este momento.");
        if (!navigator.onLine) throw errorConTexto(mensajeDeError({ code: "unavailable" }));

        const actual = auth.currentUser;
        if (actual && !actual.isAnonymous) {
            throw errorConTexto("Ya hay una cuenta iniciada en este celular. Salí de la cuenta para entrar como empleado.");
        }

        let creoCuenta = false;

        try {
            let usuario = actual;
            if (!usuario) {
                usuario = (await esperarNube(auth.signInAnonymously())).user;
                creoCuenta = true;
            }
            const uid = usuario.uid;

            const refCodigo = db.collection("codigosAcceso").doc(codigo);
            const foto = await esperarNube(refCodigo.get({ source: "server" }));

            if (!foto.exists) {
                throw errorConTexto("Ese código no existe. Revisá que esté bien escrito o pedile uno nuevo a tu encargado.");
            }

            const datos = foto.data();

            if (datos.usado) {
                throw errorConTexto("Ese código ya se usó. Cada código sirve una sola vez: pedile uno nuevo a tu encargado.");
            }
            if (venceEl(datos.creado).getTime() <= Date.now()) {
                throw errorConTexto("Ese código venció (duran " + HORAS_DE_VIGENCIA + " horas). Pedile uno nuevo a tu encargado.");
            }

            const idDistribuidora = datos.idDistribuidora;
            const idEmpleado = datos.idEmpleado;
            const refDistribuidora = db.collection("distribuidoras").doc(idDistribuidora);
            const refEmpleado = refDistribuidora.collection("empleados").doc(idEmpleado);
            const tanda = db.batch();

            tanda.update(refCodigo, { usado: true, usadoPor: uid, usadoEn: ahora() });
            tanda.set(refDistribuidora.collection("miembros").doc(uid), {
                rol: "empleado",
                idEmpleado,
                codigo,
                alta: ahora()
            });

            if (datos.tipo === "reingreso") {
                // La ficha pasa a esta cuenta y el celular viejo pierde el acceso.
                tanda.update(refEmpleado, { uidActual: uid });
                if (datos.uidAnterior && datos.uidAnterior !== uid) {
                    tanda.delete(refDistribuidora.collection("miembros").doc(datos.uidAnterior));
                }
            } else {
                tanda.set(refEmpleado, {
                    nombre: "",
                    roles: [],
                    activo: true,
                    uidActual: uid,
                    alta: ahora()
                });
            }

            tanda.set(db.collection("usuarios").doc(uid), {
                idDistribuidora,
                idEmpleado,
                alta: ahora()
            });

            await esperarNube(tanda.commit());

            localStorage.setItem(CLAVE_EMPLEADO, JSON.stringify({ uid, distribuidora: idDistribuidora, idEmpleado }));

            return { tipo: datos.tipo === "reingreso" ? "reingreso" : "alta", distribuidora: idDistribuidora, idEmpleado };
        } catch (error) {
            console.error("No se pudo entrar con el código.", error);

            // Si no se pudo entrar, la cuenta anónima recién creada no sirve.
            if (creoCuenta) {
                try {
                    await auth.signOut();
                } catch (errorAlSalir) {
                    console.warn("No se pudo cerrar la cuenta anónima.", errorAlSalir);
                }
            }

            throw errorConTexto(mensajeDeError(error));
        }
    }

    // Después de canjear: la app se recarga usando la nube de la distribuidora.
    async function entrarALaNube() {
        const guardado = leerGuardado();
        if (!guardado) throw errorConTexto("Primero entrá con el código.");

        await vaciarCopiaDeLaNube();
        localStorage.setItem(DB_MODO_NUBE, JSON.stringify({ uid: guardado.uid, distribuidora: guardado.distribuidora }));
        window.location.reload();
    }

    // -------------------------------------------------
    // Ficha del empleado (en su celular)
    // -------------------------------------------------

    function listaDeRoles() {
        return roles && roles.length ? roles : rolesIniciales();
    }

    function guardarMisDatos(nombre, idsRoles) {
        const guardado = leerGuardado();
        const db = obtenerFirestore();
        const limpio = String(nombre || "").trim().replace(/\s+/g, " ").slice(0, LARGO_MAXIMO_NOMBRE);

        if (!guardado || !db || !esEmpleado()) {
            return Promise.reject(errorConTexto("Tu cuenta de empleado no está lista."));
        }
        if (!limpio) return Promise.reject(errorConTexto("Escribí tu nombre."));

        const validos = new Set(listaDeRoles().map(rol => rol.id));
        const elegidos = Array.from(new Set(idsRoles || [])).filter(id => validos.has(id));

        // T29d: cada rol nuevo con "Cobra" queda pendiente hasta que lo
        // aprueba el dueño; los que ya estaban pendientes siguen así.
        const antes = new Set(miFicha?.roles || []);
        const conCobra = new Set(rolesConPermiso("cobra"));
        const nuevosConCobra = elegidos.filter(id => !antes.has(id) && conCobra.has(id));
        const rolesPendientes = Array.from(new Set([
            ...(miFicha?.rolesPendientes || []).filter(id => elegidos.includes(id)),
            ...nuevosConCobra
        ]));

        const guardar = db.collection("distribuidoras").doc(guardado.distribuidora)
            .collection("empleados").doc(guardado.idEmpleado)
            .update({ nombre: limpio, roles: elegidos, rolesPendientes });

        guardar.catch(error => {
            console.error("No se pudieron guardar tus datos.", error);
            if (typeof mostrarAviso === "function") {
                mostrarAviso("No se guardaron tus datos", "Probá de nuevo desde Configuración > Cuenta.");
            }
        });

        // Sin señal queda en el celular y se sube solo al volver.
        miFicha = { ...(miFicha || {}), nombre: limpio, roles: elegidos, rolesPendientes };
        avisarA(oyentesMiFicha, miFicha);

        // Al dueño le llega "Rol pendiente de aprobar" (después de la ficha:
        // la nube revisa que el rol ya esté pendiente).
        if (nuevosConCobra.length) {
            window.avisosVendeFrio?.avisarRolPendiente?.(nombresDeRoles(nuevosConCobra));
        }

        return Promise.resolve({ ...miFicha, nuevosPendientes: nuevosConCobra });
    }

    function nombresDeRoles(ids) {
        const porId = new Map(listaDeRoles().map(rol => [rol.id, rol.nombre]));
        return (ids || []).map(id => porId.get(id)).filter(Boolean);
    }

    // El celular de un empleado escucha su ficha, la lista de roles y si
    // sigue siendo miembro. Si otro celular entró con su código de
    // reingreso, la nube le niega el acceso y vuelve al inicio.
    function iniciarCelularDeEmpleado() {
        const guardado = leerGuardado();
        const db = obtenerFirestore();
        if (!guardado || !db) return;

        const refDistribuidora = db.collection("distribuidoras").doc(guardado.distribuidora);

        const refEmpleado = refDistribuidora.collection("empleados").doc(guardado.idEmpleado);

        const loDieronDeBaja = () => dejarCelularSinEmpleado(
            "Tu encargado te dio de baja en la distribuidora: este celular ya no tiene acceso. " +
            "Para volver a entrar hace falta un código nuevo de tu encargado."
        );

        // Puede ser un reingreso desde otro celular o una baja (T15). Después
        // de una baja la ficha sigue siendo de esta cuenta y el empleado
        // todavía puede leerla; después de un reingreso pasó a otra cuenta.
        // Se espera un momento: el cambio de la ficha puede llegar un poco
        // después de que la nube avisa que ya no es miembro.
        const perdioElAcceso = async () => {
            if (saliendo) return;
            await new Promise(resolver => setTimeout(resolver, 1500));
            if (saliendo) return;

            try {
                const ficha = await esperarNube(refEmpleado.get({ source: "server" }));
                const datos = ficha.exists ? ficha.data() || {} : {};
                if (datos.activo === false || datos.uidActual === guardado.uid) {
                    loDieronDeBaja();
                    return;
                }
            } catch (error) {
                // Sin permiso para leerla: la ficha pasó a otro celular.
            }

            dejarCelularSinEmpleado(
                "Este celular ya no tiene acceso a la distribuidora. " +
                "Si sos el mismo empleado, pedile a tu encargado un código de reingreso."
            );
        };

        const siNoHayPermiso = error => {
            console.warn("La nube no deja leer los datos del empleado.", error);
            if (error && error.code === "permission-denied") perdioElAcceso();
        };

        refDistribuidora.collection("miembros").doc(guardado.uid).onSnapshot(foto => {
            if (!foto.exists && !foto.metadata.fromCache) perdioElAcceso();
        }, siNoHayPermiso);

        refEmpleado.onSnapshot(foto => {
            if (!foto.exists) return;

            const datos = foto.data() || {};

            // Baja (T15): la nube ya le niega el acceso; se sale enseguida.
            if (datos.activo === false) {
                loDieronDeBaja();
                return;
            }

            miFicha = {
                nombre: typeof datos.nombre === "string" ? datos.nombre : "",
                roles: Array.isArray(datos.roles) ? datos.roles : [],
                rolesPendientes: Array.isArray(datos.rolesPendientes) ? datos.rolesPendientes : []
            };
            avisarA(oyentesMiFicha, miFicha);

            // Sin nombre no se avanza: se pide antes de usar la app.
            if (!miFicha.nombre && window.inicioVendeFrio?.pedirDatosEmpleado) {
                window.inicioVendeFrio.pedirDatosEmpleado();
            }
        }, siNoHayPermiso);

        refDistribuidora.collection("config").doc("roles")
            .onSnapshot(recibirRoles, error => console.warn("No se pudo leer la lista de roles.", error));

        arrancarEscuchaDeLlave(guardado.distribuidora);
    }

    // "Salir" del empleado: la cuenta anónima no se puede recuperar, así que
    // para volver hace falta un código de reingreso. No deja salir con
    // cambios sin subir, para no perderlos.
    function salir() {
        const sinSubir = window.nubeVendeFrio?.sincronizacion?.().sinSubir || 0;

        if (sinSubir > 0) {
            return Promise.reject(errorConTexto(
                "Hay " + sinSubir + " cambio(s) sin subir a la nube. Esperá a tener señal y que diga \"todo subido\" antes de salir."
            ));
        }

        return dejarCelularSinEmpleado("");
    }

    // -------------------------------------------------
    // Dueño: generar códigos y ver los empleados
    // -------------------------------------------------

    // Crea un código en la nube (hace falta internet). Si es el primero, crea
    // también la lista de roles con los 5 precargados.
    async function generarCodigo(idEmpleadoReingreso) {
        const db = obtenerFirestore();
        const usuario = window.cuentaVendeFrio?.usuarioActual();

        if (!db || !usuario || !esDueno()) {
            throw errorConTexto("Solo el dueño de la distribuidora puede generar códigos.");
        }
        if (!navigator.onLine) throw errorConTexto("Hace falta internet para generar un código.");

        const refDistribuidora = db.collection("distribuidoras").doc(usuario.uid);

        try {
            let uidAnterior = null;

            if (idEmpleadoReingreso) {
                const ficha = await esperarNube(
                    refDistribuidora.collection("empleados").doc(idEmpleadoReingreso).get({ source: "server" })
                );
                if (!ficha.exists) throw errorConTexto("No se encontró la ficha de ese empleado.");
                uidAnterior = ficha.data().uidActual;
            }

            const refRoles = refDistribuidora.collection("config").doc("roles");
            const fotoRoles = await esperarNube(refRoles.get({ source: "server" }));

            // Un código repetido (muy raro) no pisa al otro: se prueba con otro.
            for (let intento = 0; intento < 3; intento++) {
                const codigo = codigoAlAzar();
                const idEmpleado = idEmpleadoReingreso || refDistribuidora.collection("empleados").doc().id;
                const tanda = db.batch();

                const datos = {
                    idDistribuidora: usuario.uid,
                    idEmpleado,
                    tipo: idEmpleadoReingreso ? "reingreso" : "alta",
                    creado: ahora(),
                    usado: false
                };
                if (idEmpleadoReingreso) datos.uidAnterior = uidAnterior;

                tanda.set(db.collection("codigosAcceso").doc(codigo), datos);
                if (!fotoRoles.exists) tanda.set(refRoles, datosDeRoles(rolesIniciales()));

                try {
                    await esperarNube(tanda.commit());
                } catch (error) {
                    if (error && error.code === "permission-denied" && intento < 2) continue;
                    throw error;
                }

                const guardado = await db.collection("codigosAcceso").doc(codigo).get({ source: "cache" })
                    .catch(() => null);

                return {
                    codigo,
                    tipo: datos.tipo,
                    vence: venceEl(guardado && guardado.exists ? guardado.data().creado : null)
                };
            }

            throw errorConTexto("No se pudo generar el código. Probá de nuevo.");
        } catch (error) {
            console.error("No se pudo generar el código.", error);
            if (error && error.code === "empleados") throw error;
            if (error && error.code === "permission-denied") {
                throw errorConTexto("La nube no dejó generar el código. Revisá que las reglas nuevas estén publicadas en Firebase (M5).");
            }
            throw errorConTexto("No se pudo generar el código. Revisá la señal y probá de nuevo.");
        }
    }

    function escucharEmpleados(oyente) {
        const quitar = sumarOyente(oyentesEmpleados, oyente, empleados);
        arrancarEscuchaDeEmpleados();
        return quitar;
    }

    function arrancarEscuchaDeEmpleados() {
        if (dejarDeEscucharEmpleados || !esDueno()) return;

        const db = obtenerFirestore();
        const uid = window.cuentaVendeFrio.usuarioActual().uid;
        if (!db) return;

        const refDistribuidora = db.collection("distribuidoras").doc(uid);

        const quitarEmpleados = refDistribuidora.collection("empleados").onSnapshot(foto => {
            empleados = foto.docs.map(documento => {
                const datos = documento.data() || {};
                return {
                    id: documento.id,
                    nombre: typeof datos.nombre === "string" ? datos.nombre : "",
                    roles: Array.isArray(datos.roles) ? datos.roles : [],
                    rolesPendientes: Array.isArray(datos.rolesPendientes) ? datos.rolesPendientes : [],
                    activo: datos.activo !== false,
                    baja: datos.baja && typeof datos.baja.toDate === "function" ? datos.baja.toDate() : null
                };
            }).sort((a, b) => (a.nombre || "~").localeCompare(b.nombre || "~", "es"));
            avisarA(oyentesEmpleados, empleados);
        }, error => {
            console.warn("No se pudo leer la lista de empleados.", error);
            dejarDeEscucharEmpleados = null;
        });

        // La lista de roles ya la escucha el dueño desde que entra (T19).
        arrancarEscuchaDeRoles();

        // Códigos sin usar (T15): desaparecen solos cuando un empleado los usa.
        const quitarCodigos = db.collection("codigosAcceso")
            .where("idDistribuidora", "==", uid)
            .where("usado", "==", false)
            .onSnapshot(foto => {
                codigosSinUsar = foto.docs.map(documento => {
                    const datos = documento.data() || {};
                    return {
                        codigo: documento.id,
                        tipo: datos.tipo === "reingreso" ? "reingreso" : "alta",
                        idEmpleado: datos.idEmpleado || "",
                        vence: venceEl(datos.creado)
                    };
                }).sort((a, b) => b.vence - a.vence);
                avisarA(oyentesCodigos, codigosVigentes());
            }, error => console.warn("No se pudo leer la lista de códigos.", error));

        dejarDeEscucharEmpleados = () => {
            quitarEmpleados();
            quitarCodigos();
        };
    }

    // Los vencidos ya no sirven: no se muestran.
    function codigosVigentes() {
        const ahoraMismo = Date.now();
        return codigosSinUsar.filter(codigo => codigo.vence.getTime() > ahoraMismo);
    }

    function escucharCodigos(oyente) {
        const quitar = sumarOyente(oyentesCodigos, oyente, codigosVigentes());
        arrancarEscuchaDeEmpleados();
        return quitar;
    }

    // -------------------------------------------------
    // Dueño: panel de empleados (T15)
    // -------------------------------------------------

    function refDeMiDistribuidora() {
        const db = obtenerFirestore();
        const usuario = window.cuentaVendeFrio?.usuarioActual();

        if (!db || !usuario || !esDueno()) {
            throw errorConTexto("Solo el dueño de la distribuidora puede hacer esto.");
        }
        return { db, refDistribuidora: db.collection("distribuidoras").doc(usuario.uid), uid: usuario.uid };
    }

    function errorDelPanel(error, texto) {
        console.error(texto, error);
        if (error && error.code === "empleados") return error;
        if (error && error.code === "permission-denied") {
            return errorConTexto("La nube no lo permitió. Revisá que las reglas nuevas estén publicadas en Firebase (M6).");
        }
        return errorConTexto(texto + " Revisá la señal y probá de nuevo.");
    }

    // Cambia los roles de un empleado. Lo que marca el dueño vale sin
    // aprobar; un rol que seguía pendiente sigue pendiente (se aprueba con
    // "Aprobar", T29d). Sin señal queda en el celular y se sube solo al
    // volver.
    function cambiarRolesDe(idEmpleado, idsRoles) {
        try {
            const { refDistribuidora } = refDeMiDistribuidora();
            const validos = new Set(listaDeRoles().map(rol => rol.id));
            const elegidos = Array.from(new Set(idsRoles || [])).filter(id => validos.has(id));
            const ficha = empleados.find(empleado => empleado.id === idEmpleado);
            const rolesPendientes = (ficha?.rolesPendientes || []).filter(id => elegidos.includes(id));

            refDistribuidora.collection("empleados").doc(idEmpleado)
                .update({ roles: elegidos, rolesPendientes })
                .catch(error => {
                    console.error("No se pudieron guardar los roles.", error);
                    if (typeof mostrarAviso === "function") {
                        mostrarAviso("No se guardaron los roles", errorDelPanel(error, "No se guardaron los roles.").message);
                    }
                });

            return Promise.resolve(elegidos);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    // Rol pendiente de aprobar (T29d): "Aprobar" lo saca de pendientes (el
    // empleado ya cobra); "Rechazar" se lo quita al empleado. Sin señal
    // queda en el celular y se sube solo al volver.
    function resolverRolPendiente(idEmpleado, idRol, aprobar) {
        try {
            const { refDistribuidora } = refDeMiDistribuidora();
            const quitar = window.firebase.firestore.FieldValue.arrayRemove(idRol);
            const cambios = aprobar ? { rolesPendientes: quitar } : { roles: quitar, rolesPendientes: quitar };

            refDistribuidora.collection("empleados").doc(idEmpleado)
                .update(cambios)
                .catch(error => {
                    console.error("No se guardó la aprobación del rol.", error);
                    if (typeof mostrarAviso === "function") {
                        mostrarAviso("No se guardó el cambio", errorDelPanel(error, "No se guardó el cambio.").message);
                    }
                });

            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    }

    // Anula un código sin usar (hace falta internet).
    async function anularCodigo(codigo) {
        if (!navigator.onLine) throw errorConTexto("Hace falta internet para anular un código.");

        try {
            const { db } = refDeMiDistribuidora();
            await esperarNube(db.collection("codigosAcceso").doc(codigo).delete());
        } catch (error) {
            throw errorDelPanel(error, "No se pudo anular el código.");
        }
    }

    // Baja (T15): en una sola tanda la ficha queda como "dado de baja", la
    // cuenta del empleado deja de ser miembro (la nube le niega el acceso al
    // instante) y se anulan sus códigos sin usar. La ficha no se borra, para
    // que su nombre siga en el historial. Hace falta internet.
    async function darDeBaja(idEmpleado) {
        if (!navigator.onLine) throw errorConTexto("Hace falta internet para dar de baja a un empleado.");

        try {
            const { db, refDistribuidora, uid } = refDeMiDistribuidora();
            const refEmpleado = refDistribuidora.collection("empleados").doc(idEmpleado);
            const ficha = await esperarNube(refEmpleado.get({ source: "server" }));

            if (!ficha.exists) throw errorConTexto("No se encontró la ficha de ese empleado.");

            const datos = ficha.data() || {};
            if (datos.activo === false) throw errorConTexto("Ese empleado ya estaba dado de baja.");

            const tanda = db.batch();
            tanda.update(refEmpleado, { activo: false, baja: ahora() });

            if (datos.uidActual) {
                const refMiembro = refDistribuidora.collection("miembros").doc(datos.uidActual);
                const miembro = await esperarNube(refMiembro.get({ source: "server" }));
                if (miembro.exists && miembro.data().rol === "empleado") tanda.delete(refMiembro);
            }

            const codigos = await esperarNube(db.collection("codigosAcceso")
                .where("idDistribuidora", "==", uid)
                .where("usado", "==", false)
                .get({ source: "server" }));
            codigos.docs
                .filter(documento => documento.data().idEmpleado === idEmpleado)
                .forEach(documento => tanda.delete(documento.ref));

            await esperarNube(tanda.commit());
        } catch (error) {
            throw errorDelPanel(error, "No se pudo dar de baja.");
        }
    }

    // --- Editar roles (T15) ---

    // Para comparar nombres sin importar mayúsculas ni tildes.
    function nombreComparable(nombre) {
        return String(nombre || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .toLowerCase().trim().replace(/\s+/g, " ");
    }

    function limpiarNombreRol(nombre) {
        return String(nombre || "").trim().replace(/\s+/g, " ").slice(0, LARGO_MAXIMO_ROL);
    }

    function revisarNombreRol(nombre, idQueSeRenombra) {
        if (!nombre) throw errorConTexto("Escribí el nombre del rol.");

        const repetido = listaDeRoles().some(rol =>
            rol.id !== idQueSeRenombra && nombreComparable(rol.nombre) === nombreComparable(nombre));
        if (repetido) throw errorConTexto("Ya hay un rol que se llama \"" + nombre + "\".");
    }

    // Guarda la lista entera de roles, con sus permisos y la copia por
    // permiso en el mismo documento (solo el dueño, ver firestore.rules).
    // Sin señal queda en el celular y se sube solo al volver.
    function guardarListaDeRoles(lista, tanda) {
        const { db, refDistribuidora } = refDeMiDistribuidora();
        const lote = tanda || db.batch();

        // La lista ya trae los permisos de los precargados (ver
        // recibirRoles): si la nube todavía no los tenía, van en esta misma
        // escritura.
        const datos = datosDeRoles(lista);
        lista = datos.lista;

        lote.set(refDistribuidora.collection("config").doc("roles"), datos);

        lote.commit().catch(error => {
            console.error("No se pudo guardar la lista de roles.", error);
            if (typeof mostrarAviso === "function") {
                mostrarAviso("No se guardaron los roles", errorDelPanel(error, "No se guardaron los roles.").message);
            }
        });

        // Se ve enseguida en este celular.
        roles = lista;
        permisosIniciales = true;
        ultimosRoles = JSON.stringify([lista, true]);
        avisarCambioDeRoles();
    }

    function crearRol(nombre) {
        try {
            const limpio = limpiarNombreRol(nombre);
            revisarNombreRol(limpio, null);

            const actual = listaDeRoles();
            if (actual.length >= MAXIMO_DE_ROLES) {
                throw errorConTexto("Llegaste al máximo de " + MAXIMO_DE_ROLES + " roles.");
            }

            const usados = new Set(actual.map(rol => rol.id));
            let id = "";
            do {
                id = "rol" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            } while (usados.has(id));

            guardarListaDeRoles([...actual, { id, nombre: limpio, permisos: [] }]);
            return Promise.resolve({ id, nombre: limpio });
        } catch (error) {
            return Promise.reject(error);
        }
    }

    // El id no cambia: los empleados que lo tienen ven el nombre nuevo.
    function renombrarRol(id, nombre) {
        try {
            const limpio = limpiarNombreRol(nombre);
            revisarNombreRol(limpio, id);

            const actual = listaDeRoles();
            if (!actual.some(rol => rol.id === id)) throw errorConTexto("Ese rol ya no existe.");

            guardarListaDeRoles(actual.map(rol => rol.id === id ? { ...rol, nombre: limpio } : rol));
            return Promise.resolve({ id, nombre: limpio });
        } catch (error) {
            return Promise.reject(error);
        }
    }

    // Cuántos empleados tienen ese rol (activos o dados de baja).
    function empleadosConRol(id) {
        return empleados.filter(empleado => empleado.roles.includes(id));
    }

    // Saca el rol de la lista y, en la misma tanda, se lo quita a los
    // empleados que lo tienen. No se borra ningún empleado.
    function eliminarRol(id) {
        try {
            const { db, refDistribuidora } = refDeMiDistribuidora();
            const actual = listaDeRoles();
            if (!actual.some(rol => rol.id === id)) throw errorConTexto("Ese rol ya no existe.");

            const tanda = db.batch();
            empleadosConRol(id).forEach(empleado => {
                tanda.update(refDistribuidora.collection("empleados").doc(empleado.id), {
                    roles: window.firebase.firestore.FieldValue.arrayRemove(id),
                    rolesPendientes: window.firebase.firestore.FieldValue.arrayRemove(id)
                });
            });

            guardarListaDeRoles(actual.filter(rol => rol.id !== id), tanda);
            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    }

    // -------------------------------------------------
    // Permisos por rol (T19)
    // -------------------------------------------------

    // Solo permisos conocidos, sin repetir y en el orden de PERMISOS.
    function limpiarPermisos(lista) {
        const marcados = new Set(Array.isArray(lista) ? lista : []);
        return IDS_PERMISOS.filter(id => marcados.has(id));
    }

    function normalizarRol(rol) {
        if (!rol || typeof rol.id !== "string" || !rol.id) return null;
        return {
            id: rol.id,
            nombre: typeof rol.nombre === "string" ? rol.nombre : "",
            permisos: limpiarPermisos(rol.permisos)
        };
    }

    // Los 5 precargados con sus permisos acordados.
    function rolesIniciales() {
        return completarPermisosIniciales(ROLES_PRECARGADOS);
    }

    // Suma los permisos acordados a los precargados que sigan en la lista
    // (por su id). No quita ningún permiso ni agrega roles borrados.
    function completarPermisosIniciales(lista) {
        return lista.map(rol => {
            const normal = normalizarRol(rol);
            if (!normal) return null;
            const acordados = PERMISOS_PRECARGADOS[normal.id] || [];
            return { ...normal, permisos: limpiarPermisos([...normal.permisos, ...acordados]) };
        }).filter(Boolean);
    }

    // Copia por permiso con los ids de rol que lo tienen, para que las
    // reglas de la nube puedan revisar los permisos sin recorrer la lista.
    function copiaPorPermiso(lista) {
        const copia = {};
        IDS_PERMISOS.forEach(permiso => {
            copia[permiso] = lista.filter(rol => rol.permisos.includes(permiso)).map(rol => rol.id);
        });
        return copia;
    }

    // El documento config/roles entero: la lista y la copia van siempre
    // juntas, así nunca quedan distintas.
    function datosDeRoles(lista) {
        const limpia = lista.map(normalizarRol).filter(Boolean);
        return {
            lista: limpia,
            porPermiso: copiaPorPermiso(limpia),
            permisosIniciales: true
        };
    }

    function avisarCambioDeRoles() {
        avisarA(oyentesRoles, listaDeRoles());
        if (esDueno()) avisarA(oyentesEmpleados, empleados);
        avisarPermisos();
    }

    // Lo que llega de la nube (dueño y empleado). Avisa solo si cambió algo.
    // Mientras la nube no tiene los permisos de los precargados, el dueño ya
    // los ve marcados (se guardan con su próximo cambio o al completarlos);
    // el empleado ve lo que dice la nube, que es lo que van a revisar las
    // reglas.
    function recibirRoles(foto) {
        const datos = foto.exists ? foto.data() || {} : {};
        let lista = Array.isArray(datos.lista) ? datos.lista.map(normalizarRol).filter(Boolean) : null;
        permisosIniciales = datos.permisosIniciales === true;
        if (lista && !permisosIniciales && esDueno()) lista = completarPermisosIniciales(lista);

        const texto = JSON.stringify([lista, permisosIniciales]);
        roles = lista;
        if (texto === ultimosRoles) return;

        ultimosRoles = texto;
        avisarCambioDeRoles();
    }

    // Una sola vez por distribuidora: los precargados que quedan reciben sus
    // permisos. Se hace en el celular del dueño, con internet, leyendo la
    // nube en el momento (así dos celulares del dueño no lo hacen dos veces
    // ni pisan lo que ya se marcó).
    function completarPermisosEnLaNube(refRoles) {
        const db = obtenerFirestore();
        if (completandoPermisos || !db || !navigator.onLine || !esDueno()) return;

        completandoPermisos = true;
        db.runTransaction(async transaccion => {
            const foto = await transaccion.get(refRoles);
            const datos = foto.exists ? foto.data() || {} : {};
            if (!foto.exists || datos.permisosIniciales === true) return;

            const lista = Array.isArray(datos.lista) ? datos.lista : [];
            transaccion.set(refRoles, datosDeRoles(completarPermisosIniciales(lista)));
        }).catch(error => {
            console.warn("No se pudieron completar los permisos de los roles precargados.", error);
        }).finally(() => {
            completandoPermisos = false;
        });
    }

    // El dueño escucha la lista de roles desde que entra a la nube.
    function arrancarEscuchaDeRoles() {
        if (dejarDeEscucharRoles || !esDueno()) return;

        const db = obtenerFirestore();
        if (!db) return;

        const uid = window.cuentaVendeFrio.usuarioActual().uid;
        const refRoles = db.collection("distribuidoras").doc(uid).collection("config").doc("roles");

        dejarDeEscucharRoles = refRoles.onSnapshot({ includeMetadataChanges: true }, foto => {
            recibirRoles(foto);

            // Solo con lo que confirma la nube, no con la copia del celular.
            if (foto.exists && !foto.metadata.fromCache && !permisosIniciales) {
                completarPermisosEnLaNube(refRoles);
            }
        }, error => {
            console.warn("No se pudo leer la lista de roles.", error);
            dejarDeEscucharRoles = null;
        });
    }

    // Marca o desmarca un permiso de un rol (solo el dueño).
    function cambiarPermisoDeRol(idRol, permiso, marcado) {
        try {
            if (!IDS_PERMISOS.includes(permiso)) throw errorConTexto("Ese permiso no existe.");

            const actual = listaDeRoles();
            if (!actual.some(rol => rol.id === idRol)) throw errorConTexto("Ese rol ya no existe.");

            guardarListaDeRoles(actual.map(rol => {
                if (rol.id !== idRol) return rol;
                const sin = rol.permisos.filter(id => id !== permiso);
                return { ...rol, permisos: marcado ? [...sin, permiso] : sin };
            }));
            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    }

    function rolesConPermiso(permiso) {
        return listaDeRoles().filter(rol => rol.permisos.includes(permiso)).map(rol => rol.id);
    }

    // Los roles de una ficha que esperan la aprobación del dueño (T29d):
    // solo los que todavía tiene y que hoy tienen "Cobra".
    function rolesPendientesDe(ficha) {
        const conCobra = new Set(rolesConPermiso("cobra"));
        const tiene = new Set(ficha?.roles || []);
        return (ficha?.rolesPendientes || []).filter(id => tiene.has(id) && conCobra.has(id));
    }

    // Los permisos que dan los roles de la persona de este celular, como
    // los revisan las reglas: un rol pendiente no cuenta para "Cobra"
    // (T29d). El dueño, todos. Son los que deciden los avisos.
    function permisosDeMisRoles() {
        if (esDueno()) return IDS_PERMISOS.slice();
        if (!esEmpleado()) return [];

        const misRoles = new Set(miFicha?.roles || []);
        const pendientes = new Set(rolesPendientesDe(miFicha));
        const tengo = new Set();
        listaDeRoles().forEach(rol => {
            if (!misRoles.has(rol.id)) return;
            rol.permisos.forEach(permiso => {
                if (permiso !== "cobra" || !pendientes.has(rol.id)) tengo.add(permiso);
            });
        });
        return IDS_PERMISOS.filter(permiso => tengo.has(permiso));
    }

    // Ids de los permisos que tiene la persona de este celular: el dueño,
    // todos; el empleado, los de cualquiera de sus roles y, con "Todos
    // pueden hacer todo" prendida, todos los pasos (no "Cobra", que es de
    // plata, ni "Recibe aviso de faltantes", que es un aviso; T29d). En el
    // modo personal no hay permisos (la Etapa 3 es solo para la nube).
    function misPermisos() {
        const tengo = new Set(permisosDeMisRoles());
        if (esEmpleado() && todosPuedenTodo) PERMISOS_DE_LA_LLAVE.forEach(permiso => tengo.add(permiso));
        return IDS_PERMISOS.filter(permiso => tengo.has(permiso));
    }

    function puede(permiso) {
        return misPermisos().includes(permiso);
    }

    function nombresDePermisos(ids) {
        const porId = new Map(PERMISOS.map(permiso => [permiso.id, permiso.nombre]));
        return (ids || []).map(id => porId.get(id)).filter(Boolean);
    }

    // Avisa solo si cambió algo.
    function avisarPermisos() {
        const texto = JSON.stringify(misPermisos());
        if (texto === ultimosPermisos) return;

        ultimosPermisos = texto;
        avisarA(oyentesPermisos, misPermisos());
    }

    // -------------------------------------------------
    // "Todos pueden hacer todo" (T29d)
    // -------------------------------------------------

    function recibirLlave(foto) {
        const datos = foto.exists ? foto.data() || {} : {};
        const valor = datos.todosPuedenTodo !== false;
        if (valor === todosPuedenTodo) return;

        todosPuedenTodo = valor;
        avisarA(oyentesLlave, todosPuedenTodo);
        avisarPermisos();
    }

    // El dueño y el empleado escuchan la llave de su distribuidora.
    function arrancarEscuchaDeLlave(idDistribuidora) {
        const db = obtenerFirestore();
        if (dejarDeEscucharLlave || !db || !idDistribuidora) return;

        dejarDeEscucharLlave = db.collection("distribuidoras").doc(idDistribuidora)
            .collection("config").doc("equipo")
            .onSnapshot(recibirLlave, error => {
                console.warn("No se pudo leer «Todos pueden hacer todo».", error);
                dejarDeEscucharLlave = null;
            });
    }

    function dejarLaLlave() {
        if (dejarDeEscucharLlave) dejarDeEscucharLlave();
        dejarDeEscucharLlave = null;
        if (!todosPuedenTodo) {
            todosPuedenTodo = true;
            avisarA(oyentesLlave, todosPuedenTodo);
        }
    }

    // Solo el dueño. Sin señal queda en el celular y se sube solo al volver.
    function cambiarTodosPuedenTodo(valor) {
        try {
            const { refDistribuidora } = refDeMiDistribuidora();
            const prendida = valor !== false;

            refDistribuidora.collection("config").doc("equipo")
                .set({ todosPuedenTodo: prendida })
                .catch(error => {
                    console.error("No se guardó «Todos pueden hacer todo».", error);
                    if (typeof mostrarAviso === "function") {
                        mostrarAviso("No se guardó el cambio", errorDelPanel(error, "No se guardó el cambio.").message);
                    }
                });

            // Se ve enseguida en este celular.
            recibirLlave({ exists: true, data: () => ({ todosPuedenTodo: prendida }) });
            return Promise.resolve(prendida);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    // -------------------------------------------------
    // Quién usa este celular (T18)
    // -------------------------------------------------

    // Devuelve { tipo, idPersona, nombre, roles, uid } o null si todavía no
    // se sabe (por ejemplo, en la pantalla de inicio):
    // - "dueno": idPersona "dueno", su nombre (puede estar vacío mientras no
    //   lo cargó) y sin roles: el dueño siempre puede todo.
    // - "empleado": idPersona es el id de su ficha (no cambia con un
    //   reingreso), con su nombre y sus roles.
    // - "personal": modo personal (sin cuenta), sin idPersona ni uid. La
    //   Etapa 3 no lo usa: queda como está.
    function quienSoy() {
        const usuario = window.cuentaVendeFrio?.usuarioActual();

        if (esEmpleado()) {
            const guardado = leerGuardado();
            return {
                tipo: "empleado",
                idPersona: guardado.idEmpleado,
                nombre: miFicha?.nombre || "",
                roles: (miFicha?.roles || []).slice(),
                uid: usuario.uid
            };
        }

        if (esDueno()) {
            return {
                tipo: "dueno",
                idPersona: "dueno",
                nombre: window.distribuidoraVendeFrio?.nombreDuenoActual?.() || "",
                roles: [],
                uid: usuario.uid
            };
        }

        const inicio = window.inicioVendeFrio;
        const personal = inicio?.usaModoPersonal?.() ? inicio.datosPersonales() : null;
        if (personal) {
            return {
                tipo: "personal",
                idPersona: null,
                nombre: personal.nombre,
                roles: personal.roles.slice(),
                uid: null
            };
        }

        return null;
    }

    // Avisa solo si cambió algo.
    function avisarQuienSoy() {
        const actual = quienSoy();
        const texto = JSON.stringify(actual);
        if (texto === ultimoQuienSoy) return;

        ultimoQuienSoy = texto;
        avisarA(oyentesQuienSoy, actual);
    }

    function escucharQuienSoy(oyente) {
        return sumarOyente(oyentesQuienSoy, oyente, quienSoy());
    }

    // -------------------------------------------------
    // Arranque
    // -------------------------------------------------

    window.empleadosVendeFrio = {
        largoCodigo: LARGO_CODIGO,
        horasDeVigencia: HORAS_DE_VIGENCIA,
        largoMaximoNombre: LARGO_MAXIMO_NOMBRE,
        esEmpleado,
        esDueno,
        formatearCodigo,
        canjearCodigo,
        entrarALaNube,
        guardarMisDatos,
        miFicha: () => miFicha,
        escucharMiFicha: oyente => sumarOyente(oyentesMiFicha, oyente, miFicha),
        roles: listaDeRoles,
        nombresDeRoles,
        escucharRoles: oyente => sumarOyente(oyentesRoles, oyente, listaDeRoles()),
        salir,
        avisoParaElInicio,
        hayAvisoParaElInicio,
        generarCodigo,
        escucharEmpleados,
        escucharCodigos,
        cambiarRolesDe,
        // Rol pendiente de aprobar (T29d)
        aprobarRol: (idEmpleado, idRol) => resolverRolPendiente(idEmpleado, idRol, true),
        rechazarRol: (idEmpleado, idRol) => resolverRolPendiente(idEmpleado, idRol, false),
        rolesPendientesDe,
        rolesConPermiso,
        anularCodigo,
        darDeBaja,
        largoMaximoRol: LARGO_MAXIMO_ROL,
        crearRol,
        renombrarRol,
        eliminarRol,
        cantidadConRol: id => empleadosConRol(id).length,
        // Quién usa este celular (T18)
        quienSoy,
        escucharQuienSoy,
        // Permisos por rol (T19)
        permisos: () => PERMISOS.map(permiso => ({ ...permiso })),
        cambiarPermisoDeRol,
        puede,
        misPermisos,
        nombresDePermisos,
        escucharPermisos: oyente => sumarOyente(oyentesPermisos, oyente, misPermisos()),
        // "Todos pueden hacer todo" (T29d)
        todosPuedenTodo: () => todosPuedenTodo,
        cambiarTodosPuedenTodo,
        escucharTodosPuedenTodo: oyente => sumarOyente(oyentesLlave, oyente, todosPuedenTodo),
        // Lo que dan los roles (sin la llave): deciden los avisos.
        permisosDeMisRoles,
        tieneEnSusRoles: permiso => permisosDeMisRoles().includes(permiso)
    };

    // El celular de un empleado arranca a escuchar apenas se sabe la cuenta.
    // Si la sesión se perdió (por ejemplo, se borraron los datos del
    // navegador), se olvidan los datos de empleado de este celular.
    if (window.cuentaVendeFrio && leerGuardado()) {
        let decidido = false;

        const quitar = window.cuentaVendeFrio.escuchar(usuario => {
            if (decidido) return;
            decidido = true;
            setTimeout(() => quitar(), 0);

            const guardado = leerGuardado();

            if (usuario && usuario.isAnonymous && guardado && usuario.uid === guardado.uid) {
                // Con código se entra siempre a la nube (T16c): si la app se
                // cerró antes de pasar a la nube, se pasa ahora.
                if (!usaNubeReal()) {
                    entrarALaNube().catch(error => console.warn("No se pudo entrar a la nube.", error));
                    return;
                }

                iniciarCelularDeEmpleado();
            } else {
                try {
                    localStorage.removeItem(CLAVE_EMPLEADO);
                } catch (error) {
                    console.warn("No se pudo limpiar el modo empleado.", error);
                }
            }
        });
    }

    // Si el dueño está en la nube, la lista de empleados se mantiene al día.
    if (window.distribuidoraVendeFrio) {
        window.distribuidoraVendeFrio.escuchar(() => {
            if (!esDueno() && dejarDeEscucharEmpleados) {
                dejarDeEscucharEmpleados();
                dejarDeEscucharEmpleados = null;
                empleados = [];
                codigosSinUsar = [];
            }
            // Permisos (T19): el dueño escucha la lista de roles desde que
            // entra, para completar una sola vez los de los precargados.
            if (esDueno()) {
                arrancarEscuchaDeRoles();
                arrancarEscuchaDeLlave(window.cuentaVendeFrio.usuarioActual().uid);
            } else {
                if (dejarDeEscucharRoles) {
                    dejarDeEscucharRoles();
                    dejarDeEscucharRoles = null;
                    if (!esEmpleado()) roles = null;
                }
                if (!esEmpleado()) dejarLaLlave();
            }
            avisarQuienSoy();
            avisarPermisos();
        });

        window.distribuidoraVendeFrio.escucharNombreDueno?.(avisarQuienSoy);
    }

    // "Quién soy" cambia también con la ficha del empleado, la cuenta y el
    // modo personal (T18).
    oyentesMiFicha.push(avisarQuienSoy);
    window.cuentaVendeFrio?.escuchar(avisarQuienSoy);
    // Los permisos cambian con los roles del empleado y con la cuenta (T19).
    oyentesMiFicha.push(avisarPermisos);
    window.cuentaVendeFrio?.escuchar(avisarPermisos);
    window.addEventListener("modoPersonalVendeFrio", avisarQuienSoy);
    // inicio.js (modo personal) carga después que este archivo.
    window.addEventListener("load", avisarQuienSoy);

    window.dispatchEvent(new Event("empleadosVendeFrioLista"));
}());
