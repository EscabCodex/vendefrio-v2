// VendeFrío - Cuenta (inicio de sesión con Firebase Auth)
// Iniciar sesión todavía NO cambia de dónde salen los datos: siguen en localStorage.
(function () {
    const oyentes = [];
    let usuario = null;
    let listo = false;

    function obtenerAuth() {
        try {
            if (window.firebase && window.firebase.apps.length) {
                return window.firebase.auth();
            }
        } catch (error) {
            console.error("Firebase Auth no está disponible.", error);
        }
        return null;
    }

    function avisar() {
        oyentes.forEach(oyente => {
            try {
                oyente(usuario);
            } catch (error) {
                console.error("Falló un aviso de cambio de cuenta.", error);
            }
        });
    }

    function mensajeDeError(error) {
        const codigo = error && error.code;

        if (!navigator.onLine || codigo === "auth/network-request-failed") {
            return "No hay conexión a internet. Probá de nuevo cuando vuelva la señal.";
        }

        const mensajes = {
            "auth/invalid-email": "El email no es válido.",
            "auth/missing-email": "Escribí tu email.",
            "auth/missing-password": "Escribí tu contraseña.",
            "auth/invalid-credential": "El email o la contraseña no son correctos.",
            "auth/invalid-login-credentials": "El email o la contraseña no son correctos.",
            "auth/wrong-password": "El email o la contraseña no son correctos.",
            "auth/user-not-found": "El email o la contraseña no son correctos.",
            "auth/user-disabled": "Esta cuenta está desactivada.",
            "auth/too-many-requests": "Hubo demasiados intentos. Esperá unos minutos y probá de nuevo.",
            "auth/operation-not-allowed": "El ingreso con email y contraseña no está activado en Firebase.",
            "auth/unauthorized-domain": "Esta dirección de la app no está autorizada en Firebase."
        };

        return mensajes[codigo] || "No se pudo completar la operación. Probá de nuevo.";
    }

    async function ingresar(email, contrasena) {
        const auth = obtenerAuth();

        if (!auth) {
            throw new Error("La cuenta no está disponible en este momento.");
        }

        try {
            const resultado = await auth.signInWithEmailAndPassword(
                String(email || "").trim(),
                String(contrasena || "")
            );
            return resultado.user;
        } catch (error) {
            const aviso = new Error(mensajeDeError(error));
            aviso.code = error && error.code;
            throw aviso;
        }
    }

    async function salir() {
        const auth = obtenerAuth();
        if (!auth) return;

        try {
            await auth.signOut();
        } catch (error) {
            const aviso = new Error(mensajeDeError(error));
            aviso.code = error && error.code;
            throw aviso;
        }
    }

    function escuchar(oyente) {
        if (typeof oyente !== "function") return () => {};

        oyentes.push(oyente);
        if (listo) oyente(usuario);

        return () => {
            const indice = oyentes.indexOf(oyente);
            if (indice >= 0) oyentes.splice(indice, 1);
        };
    }

    const auth = obtenerAuth();

    if (auth) {
        auth.onAuthStateChanged(nuevoUsuario => {
            usuario = nuevoUsuario || null;
            listo = true;
            avisar();
        });
    } else {
        listo = true;
    }

    window.cuentaVendeFrio = {
        disponible: () => !!obtenerAuth(),
        listo: () => listo,
        usuarioActual: () => usuario,
        ingresar,
        salir,
        escuchar
    };

    window.dispatchEvent(new Event("cuentaVendeFrioLista"));
}());
