// VendeFrío - Empleados: ingreso con código (T14)
// - El dueño genera códigos en Configuración > Empleados: uno de alta para un
//   empleado nuevo, o uno de reingreso para pasar a un empleado a otro celular.
//   8 caracteres sin letras que se confundan, sirven una vez y vencen a las 24 h.
// - El empleado elige "Empleado" en la pantalla de inicio, escribe el código y
//   la app le crea una cuenta anónima (sin email ni contraseña, guardada en el
//   celular). En una sola tanda se marca el código como usado, se lo suma como
//   miembro y se crea (o, en el reingreso, se pasa a su cuenta) su ficha de
//   empleado. firestore.rules revisa que el código sea válido.
// - El empleado siempre usa la nube de la distribuidora. Si otro celular entra
//   con un código de reingreso, este pierde el acceso y vuelve al inicio.
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
    const ESPERA_MAXIMA_NUBE = 30 * 1000;

    // Cada distribuidora arranca con estos roles (el id no cambia nunca).
    const ROLES_PRECARGADOS = [
        { id: "vendedor", nombre: "Vendedor" },
        { id: "deposito", nombre: "Depósito" },
        { id: "repartidor", nombre: "Repartidor" },
        { id: "cobranza", nombre: "Cobranza" },
        { id: "administracion", nombre: "Administración" }
    ];

    let miFicha = null;
    let roles = null;
    let empleados = [];
    const oyentesMiFicha = [];
    const oyentesRoles = [];
    const oyentesEmpleados = [];
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
    // de la nube y sin sesión. Vuelve a la pantalla de inicio.
    async function dejarCelularSinEmpleado(avisoParaElInicio) {
        if (saliendo) return;
        saliendo = true;

        try {
            localStorage.removeItem(CLAVE_EMPLEADO);
            localStorage.removeItem(DB_MODO_NUBE);
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
        return roles && roles.length ? roles : ROLES_PRECARGADOS;
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

        const guardar = db.collection("distribuidoras").doc(guardado.distribuidora)
            .collection("empleados").doc(guardado.idEmpleado)
            .update({ nombre: limpio, roles: elegidos });

        guardar.catch(error => {
            console.error("No se pudieron guardar tus datos.", error);
            if (typeof mostrarAviso === "function") {
                mostrarAviso("No se guardaron tus datos", "Probá de nuevo desde Configuración > Cuenta.");
            }
        });

        // Sin señal queda en el celular y se sube solo al volver.
        miFicha = { ...(miFicha || {}), nombre: limpio, roles: elegidos };
        avisarA(oyentesMiFicha, miFicha);
        return Promise.resolve(miFicha);
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

        const perdioElAcceso = () => dejarCelularSinEmpleado(
            "Este celular ya no tiene acceso a la distribuidora. " +
            "Si sos el mismo empleado, pedile a tu encargado un código de reingreso."
        );

        const siNoHayPermiso = error => {
            console.warn("La nube no deja leer los datos del empleado.", error);
            if (error && error.code === "permission-denied") perdioElAcceso();
        };

        refDistribuidora.collection("miembros").doc(guardado.uid).onSnapshot(foto => {
            if (!foto.exists && !foto.metadata.fromCache) perdioElAcceso();
        }, siNoHayPermiso);

        refDistribuidora.collection("empleados").doc(guardado.idEmpleado).onSnapshot(foto => {
            if (!foto.exists) return;

            const datos = foto.data() || {};
            miFicha = {
                nombre: typeof datos.nombre === "string" ? datos.nombre : "",
                roles: Array.isArray(datos.roles) ? datos.roles : []
            };
            avisarA(oyentesMiFicha, miFicha);

            // Sin nombre no se avanza: se pide antes de usar la app.
            if (!miFicha.nombre && window.inicioVendeFrio?.pedirDatosEmpleado) {
                window.inicioVendeFrio.pedirDatosEmpleado();
            }
        }, siNoHayPermiso);

        refDistribuidora.collection("config").doc("roles").onSnapshot(foto => {
            const lista = foto.exists && Array.isArray(foto.data()?.lista) ? foto.data().lista : null;
            roles = lista;
            avisarA(oyentesRoles, listaDeRoles());
        }, error => console.warn("No se pudo leer la lista de roles.", error));
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
                if (!fotoRoles.exists) tanda.set(refRoles, { lista: ROLES_PRECARGADOS });

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
                    activo: datos.activo !== false
                };
            }).sort((a, b) => (a.nombre || "~").localeCompare(b.nombre || "~", "es"));
            avisarA(oyentesEmpleados, empleados);
        }, error => {
            console.warn("No se pudo leer la lista de empleados.", error);
            dejarDeEscucharEmpleados = null;
        });

        const quitarRoles = refDistribuidora.collection("config").doc("roles").onSnapshot(foto => {
            roles = foto.exists && Array.isArray(foto.data()?.lista) ? foto.data().lista : null;
            avisarA(oyentesRoles, listaDeRoles());
            avisarA(oyentesEmpleados, empleados);
        }, error => console.warn("No se pudo leer la lista de roles.", error));

        dejarDeEscucharEmpleados = () => {
            quitarEmpleados();
            quitarRoles();
        };
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
        escucharEmpleados
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
            }
        });
    }

    window.dispatchEvent(new Event("empleadosVendeFrioLista"));
}());
