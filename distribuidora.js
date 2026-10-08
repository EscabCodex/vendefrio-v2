// VendeFrío - Alta de la distribuidora en Firestore (T8)
// Al primer ingreso del dueño se crean, juntas, su distribuidora, su ficha de miembro
// y su ficha de usuario. Los datos de la app todavía NO pasan por la nube.
(function () {
    const oyentes = [];
    let estado = "sinCuenta";
    let idDistribuidora = null;
    let uidEnCurso = null;

    // Estados: sinCuenta, verificando, lista, creada, sinConexion, sinPermiso, error, noDisponible.
    function cambiarEstado(nuevoEstado, nuevoId) {
        estado = nuevoEstado;
        idDistribuidora = nuevoId || null;

        oyentes.forEach(oyente => {
            try {
                oyente(estado, idDistribuidora);
            } catch (error) {
                console.error("Falló un aviso de la distribuidora.", error);
            }
        });
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

            // Primer ingreso: el id de la distribuidora es el uid del dueño.
            // Las tres fichas se crean juntas: o se guardan todas o ninguna.
            const ahora = window.firebase.firestore.FieldValue.serverTimestamp();
            const refDistribuidora = db.collection("distribuidoras").doc(uid);
            const tanda = db.batch();

            tanda.set(refDistribuidora, {
                nombre: "Mi distribuidora",
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

    window.distribuidoraVendeFrio = {
        estado: () => estado,
        idActual: () => idDistribuidora,
        reintentar: revisar,
        escuchar
    };

    window.dispatchEvent(new Event("distribuidoraVendeFrioLista"));
}());
