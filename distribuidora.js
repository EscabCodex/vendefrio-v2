// VendeFrío - Alta de la distribuidora en Firestore (T8)
// Al primer ingreso del dueño se crean, juntas, su distribuidora, su ficha de miembro
// y su ficha de usuario. Los datos de la app todavía NO pasan por la nube.
// Nombre del dueño (T18): se guarda en la distribuidora (nombreDueno), para que
// lo que haga quede a su nombre y no a su email.
(function () {
    const oyentes = [];
    let estado = "sinCuenta";
    let idDistribuidora = null;
    let uidEnCurso = null;
    // Registro (T13): nombre que eligió el dueño al registrarse.
    let nombrePendiente = null;
    const LARGO_MAXIMO_NOMBRE = 80;
    // Nombre de la distribuidora, para mostrarlo en el inicio y en Cuenta.
    // Se escucha en tiempo real (sin internet sale de la copia del celular).
    let nombre = "";
    let idNombre = null;
    let dejarDeEscucharNombre = null;
    const oyentesNombre = [];
    // Nombre del dueño (T18). "Confirmado" quiere decir que la última lectura
    // vino de la nube y no solo de la copia del celular: sin internet no se
    // sabe si ya lo cargó en otro celular, así que no se le pide.
    const LARGO_MAXIMO_NOMBRE_DUENO = 60;
    let nombreDueno = "";
    let nombreDuenoConfirmado = false;
    // La nube rechazó guardarlo (reglas sin publicar): no se vuelve a pedir
    // hasta abrir la app de nuevo, para no trabar la entrada.
    let nombreDuenoRechazado = false;
    const oyentesNombreDueno = [];

    // Datos de la distribuidora para el ticket (T28c): teléfono, dirección y
    // CUIT, los tres opcionales. Los carga solo el dueño y cada uno sale en
    // el ticket solo si está cargado.
    const LARGOS_DATOS_TICKET = { telefono: 40, direccion: 120, cuit: 20 };
    let datosTicket = { telefono: "", direccion: "", cuit: "" };
    const oyentesDatosTicket = [];

    // Estados: sinCuenta, verificando, lista, creada, sinConexion, sinPermiso, error, noDisponible
    // y sinAcceso (cuenta de empleado todavía sin distribuidora, T14).
    function cambiarEstado(nuevoEstado, nuevoId) {
        estado = nuevoEstado;
        idDistribuidora = nuevoId || null;
        escucharNombreEnLaNube(idDistribuidora);

        oyentes.forEach(oyente => {
            try {
                oyente(estado, idDistribuidora);
            } catch (error) {
                console.error("Falló un aviso de la distribuidora.", error);
            }
        });
    }

    function avisarNombre() {
        oyentesNombre.forEach(oyente => {
            try {
                oyente(nombre);
            } catch (error) {
                console.error("Falló un aviso del nombre de la distribuidora.", error);
            }
        });
    }

    function cambiarNombreConocido(nuevoNombre) {
        if (nuevoNombre === nombre) return;
        nombre = nuevoNombre;
        avisarNombre();
    }

    function avisarNombreDueno() {
        oyentesNombreDueno.forEach(oyente => {
            try {
                oyente(nombreDueno, nombreDuenoConfirmado);
            } catch (error) {
                console.error("Falló un aviso del nombre del dueño.", error);
            }
        });
    }

    function cambiarNombreDuenoConocido(nuevoNombre, confirmado) {
        if (nuevoNombre === nombreDueno && confirmado === nombreDuenoConfirmado) return;
        nombreDueno = nuevoNombre;
        nombreDuenoConfirmado = confirmado;
        avisarNombreDueno();
    }

    function cambiarDatosTicketConocidos(nuevos) {
        const iguales = Object.keys(LARGOS_DATOS_TICKET).every(clave => nuevos[clave] === datosTicket[clave]);
        if (iguales) return;
        datosTicket = nuevos;
        oyentesDatosTicket.forEach(oyente => {
            try {
                oyente({ ...datosTicket });
            } catch (error) {
                console.error("Falló un aviso de los datos del ticket.", error);
            }
        });
    }

    function datosTicketDe(datos) {
        const leido = {};
        Object.keys(LARGOS_DATOS_TICKET).forEach(clave => {
            leido[clave] = datos && typeof datos[clave] === "string" ? datos[clave].trim() : "";
        });
        return leido;
    }

    function escucharNombreEnLaNube(id) {
        if (id === idNombre) return;

        if (dejarDeEscucharNombre) {
            dejarDeEscucharNombre();
            dejarDeEscucharNombre = null;
        }

        idNombre = id || null;

        if (!idNombre) {
            cambiarNombreConocido("");
            cambiarNombreDuenoConocido("", false);
            cambiarDatosTicketConocidos(datosTicketDe(null));
            return;
        }

        const db = obtenerFirestore();
        if (!db) return;

        // includeMetadataChanges: también avisa cuando la nube confirma lo
        // que ya estaba en la copia del celular (para saber si falta el
        // nombre del dueño de verdad).
        dejarDeEscucharNombre = db.collection("distribuidoras").doc(idNombre).onSnapshot(
            { includeMetadataChanges: true },
            foto => {
                const datos = foto.exists ? foto.data() : null;
                cambiarNombreConocido(datos && typeof datos.nombre === "string" ? datos.nombre : "");
                cambiarNombreDuenoConocido(
                    datos && typeof datos.nombreDueno === "string" ? datos.nombreDueno : "",
                    Boolean(datos) && !foto.metadata.fromCache
                );
                cambiarDatosTicketConocidos(datosTicketDe(datos));
            },
            error => {
                console.warn("No se pudo leer el nombre de la distribuidora.", error);
                // Se vuelve a intentar la próxima vez que cambie la distribuidora.
                dejarDeEscucharNombre = null;
                idNombre = null;
            }
        );
    }

    // Solo el dueño puede cambiar el nombre (lo controla firestore.rules).
    // No espera a la nube: sin internet se sube solo cuando vuelve la señal.
    function cambiarNombre(nuevoNombre) {
        const db = obtenerFirestore();
        const usuario = window.cuentaVendeFrio?.usuarioActual();
        const limpio = String(nuevoNombre || "").trim().slice(0, LARGO_MAXIMO_NOMBRE);

        if (!db || !usuario || !idDistribuidora) {
            return Promise.reject(new Error("Tu distribuidora en la nube todavía no está lista."));
        }
        if (idDistribuidora !== usuario.uid) {
            return Promise.reject(new Error("Solo el dueño de la distribuidora puede cambiar el nombre."));
        }
        if (!limpio) {
            return Promise.reject(new Error("Escribí el nombre de tu distribuidora."));
        }

        const guardado = db.collection("distribuidoras").doc(idDistribuidora).update({ nombre: limpio });
        guardado.catch(error => {
            console.error("No se pudo cambiar el nombre de la distribuidora.", error);
            if (typeof mostrarAviso === "function") {
                mostrarAviso(
                    "No se pudo cambiar el nombre",
                    error && error.code === "permission-denied"
                        ? "La nube no dejó cambiar el nombre. Revisá que las reglas de seguridad estén publicadas."
                        : "Probá de nuevo en un rato."
                );
            }
        });
        return Promise.resolve(limpio);
    }

    function soyElDueno() {
        const usuario = window.cuentaVendeFrio?.usuarioActual();
        return Boolean(usuario && !usuario.isAnonymous && idDistribuidora && idDistribuidora === usuario.uid);
    }

    // Nombre del dueño (T18): obligatorio, se pide una sola vez. Solo hay que
    // pedirlo si la nube confirmó que todavía no lo tiene.
    function faltaNombreDueno() {
        return soyElDueno() && nombreDuenoConfirmado && !nombreDueno && !nombreDuenoRechazado;
    }

    // Solo el dueño escribe su nombre (lo controla firestore.rules). Como el
    // nombre de la distribuidora, no espera a la nube: sin internet se sube
    // cuando vuelve la señal.
    function cambiarNombreDueno(nuevoNombre) {
        const db = obtenerFirestore();
        const limpio = String(nuevoNombre || "").trim().replace(/\s+/g, " ").slice(0, LARGO_MAXIMO_NOMBRE_DUENO);

        if (!db || !idDistribuidora) {
            return Promise.reject(new Error("Tu distribuidora en la nube todavía no está lista."));
        }
        if (!soyElDueno()) {
            return Promise.reject(new Error("Solo el dueño de la distribuidora puede cambiar su nombre acá."));
        }
        if (!limpio) {
            return Promise.reject(new Error("Escribí tu nombre."));
        }

        const guardado = db.collection("distribuidoras").doc(idDistribuidora).update({ nombreDueno: limpio });
        guardado.catch(error => {
            console.error("No se pudo guardar el nombre del dueño.", error);
            const rechazado = error && error.code === "permission-denied";
            if (rechazado) {
                nombreDuenoRechazado = true;
                avisarNombreDueno();
            }
            if (typeof mostrarAviso === "function") {
                mostrarAviso(
                    "No se pudo guardar tu nombre",
                    rechazado
                        ? "La nube no dejó guardar tu nombre. Revisá que las reglas de seguridad estén publicadas. Mientras tanto podés seguir usando la app."
                        : "Probá de nuevo desde Configuración > Cuenta."
                );
            }
        });

        cambiarNombreDuenoConocido(limpio, nombreDuenoConfirmado);
        return Promise.resolve(limpio);
    }

    // Datos para el ticket (T28c): solo el dueño los cambia (lo controla
    // firestore.rules). Un dato vacío se borra de la nube. Como el nombre, no
    // espera a la nube: sin internet se sube cuando vuelve la señal.
    function cambiarDatosTicket(nuevos) {
        const db = obtenerFirestore();
        const limpios = {};

        if (!db || !idDistribuidora) {
            return Promise.reject(new Error("Tu distribuidora en la nube todavía no está lista."));
        }
        if (!soyElDueno()) {
            return Promise.reject(new Error("Solo el dueño de la distribuidora puede cambiar estos datos."));
        }

        Object.keys(LARGOS_DATOS_TICKET).forEach(clave => {
            limpios[clave] = String((nuevos && nuevos[clave]) || "").trim().replace(/\s+/g, " ").slice(0, LARGOS_DATOS_TICKET[clave]);
        });

        const borrar = window.firebase.firestore.FieldValue.delete();
        const cambios = {};
        Object.keys(limpios).forEach(clave => {
            cambios[clave] = limpios[clave] ? limpios[clave] : borrar;
        });

        const guardado = db.collection("distribuidoras").doc(idDistribuidora).update(cambios);
        guardado.catch(error => {
            console.error("No se pudieron guardar los datos del ticket.", error);
            if (typeof mostrarAviso === "function") {
                mostrarAviso(
                    "No se pudieron guardar los datos del ticket",
                    error && error.code === "permission-denied"
                        ? "La nube no dejó guardar los datos. Revisá que las reglas de seguridad estén publicadas."
                        : "Probá de nuevo en un rato."
                );
            }
        });

        cambiarDatosTicketConocidos(limpios);
        return Promise.resolve({ ...limpios });
    }

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

    function estadoDeError(error) {
        const codigo = error && error.code;

        if (codigo === "permission-denied") return "sinPermiso";
        if (!navigator.onLine || codigo === "unavailable" || codigo === "deadline-exceeded") {
            return "sinConexion";
        }
        return "error";
    }

    async function asegurarDistribuidora(usuario) {
        const db = obtenerFirestore();

        if (!db) {
            cambiarEstado("noDisponible");
            return;
        }

        const uid = usuario.uid;
        if (uidEnCurso === uid) return;
        uidEnCurso = uid;
        cambiarEstado("verificando");

        try {
            const refUsuario = db.collection("usuarios").doc(uid);
            const fichaUsuario = await refUsuario.get();

            if (fichaUsuario.exists) {
                if (window.cuentaVendeFrio?.usuarioActual()?.uid === uid) {
                    cambiarEstado("lista", fichaUsuario.data().idDistribuidora);
                }
                return;
            }

            // Un empleado (cuenta anónima, T14) nunca crea una distribuidora:
            // su ficha de usuario se crea al entrar con el código.
            if (usuario.isAnonymous) {
                if (window.cuentaVendeFrio?.usuarioActual()?.uid === uid) {
                    cambiarEstado("sinAcceso");
                }
                return;
            }

            // Primer ingreso: el id de la distribuidora es el uid del dueño.
            // Las tres fichas se crean juntas: o se guardan todas o ninguna.
            const ahora = window.firebase.firestore.FieldValue.serverTimestamp();
            const refDistribuidora = db.collection("distribuidoras").doc(uid);
            const tanda = db.batch();

            tanda.set(refDistribuidora, {
                nombre: nombrePendiente || "Mi distribuidora",
                duenoUid: uid,
                creada: ahora
            });
            tanda.set(refDistribuidora.collection("miembros").doc(uid), {
                email: usuario.email || "",
                rol: "dueno",
                alta: ahora
            });
            tanda.set(refUsuario, {
                idDistribuidora: uid,
                alta: ahora
            });

            await tanda.commit();
            nombrePendiente = null;

            if (window.cuentaVendeFrio?.usuarioActual()?.uid === uid) {
                cambiarEstado("creada", uid);
            }
        } catch (error) {
            console.error("No se pudo preparar la distribuidora.", error);
            if (window.cuentaVendeFrio?.usuarioActual()?.uid === uid) {
                cambiarEstado(estadoDeError(error));
            }
        } finally {
            if (uidEnCurso === uid) uidEnCurso = null;
        }
    }

    function revisar() {
        const usuario = window.cuentaVendeFrio?.usuarioActual();

        if (!usuario) {
            uidEnCurso = null;
            cambiarEstado("sinCuenta");
            return;
        }

        asegurarDistribuidora(usuario);
    }

    function escuchar(oyente) {
        if (typeof oyente !== "function") return () => {};

        oyentes.push(oyente);
        oyente(estado, idDistribuidora);

        return () => {
            const indice = oyentes.indexOf(oyente);
            if (indice >= 0) oyentes.splice(indice, 1);
        };
    }

    // Si quedó pendiente por falta de señal, se reintenta al volver internet.
    window.addEventListener("online", () => {
        if (estado === "sinConexion" || estado === "error") revisar();
    });

    if (window.cuentaVendeFrio) {
        window.cuentaVendeFrio.escuchar(revisar);
    }

    // Se llama antes de registrarse; null lo descarta si el registro falla.
    function prepararNombre(nombre) {
        const limpio = String(nombre || "").trim().slice(0, LARGO_MAXIMO_NOMBRE);
        nombrePendiente = limpio || null;
    }

    window.distribuidoraVendeFrio = {
        estado: () => estado,
        prepararNombre,
        nombreActual: () => nombre,
        cambiarNombre,
        largoMaximoNombre: LARGO_MAXIMO_NOMBRE,
        escucharNombre(oyente) {
            if (typeof oyente !== "function") return () => {};

            oyentesNombre.push(oyente);
            oyente(nombre);

            return () => {
                const indice = oyentesNombre.indexOf(oyente);
                if (indice >= 0) oyentesNombre.splice(indice, 1);
            };
        },
        idActual: () => idDistribuidora,
        // Nombre del dueño (T18)
        largoMaximoNombreDueno: LARGO_MAXIMO_NOMBRE_DUENO,
        nombreDuenoActual: () => nombreDueno,
        faltaNombreDueno,
        cambiarNombreDueno,
        escucharNombreDueno(oyente) {
            if (typeof oyente !== "function") return () => {};

            oyentesNombreDueno.push(oyente);
            oyente(nombreDueno, nombreDuenoConfirmado);

            return () => {
                const indice = oyentesNombreDueno.indexOf(oyente);
                if (indice >= 0) oyentesNombreDueno.splice(indice, 1);
            };
        },
        // Datos para el ticket (T28c)
        largosDatosTicket: LARGOS_DATOS_TICKET,
        datosTicketActuales: () => ({ ...datosTicket }),
        cambiarDatosTicket,
        escucharDatosTicket(oyente) {
            if (typeof oyente !== "function") return () => {};

            oyentesDatosTicket.push(oyente);
            oyente({ ...datosTicket });

            return () => {
                const indice = oyentesDatosTicket.indexOf(oyente);
                if (indice >= 0) oyentesDatosTicket.splice(indice, 1);
            };
        },
        reintentar: revisar,
        escuchar
    };

    window.dispatchEvent(new Event("distribuidoraVendeFrioLista"));
}());
