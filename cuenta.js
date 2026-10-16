// VendeFrío - Cuenta (inicio de sesión con Firebase Auth)
// Con cuenta, los datos salen de la nube de la distribuidora (Solo nube, T16c):
// eso lo deciden inicio.js y nube.js.
// Opciones que se prenden cuando el dueño termina su parte:
// entrarConGoogle, cuando Google está activado en Firebase (M17).
window.opcionesVendeFrio = Object.assign({ entrarConGoogle: false }, window.opcionesVendeFrio);

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
            "auth/email-already-in-use": "Ya hay una cuenta con ese email. Tocá \"Ingresar\".",
            "auth/weak-password": "La contraseña tiene que tener al menos 6 caracteres.",
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

    // Registro (T13): crea la cuenta. La distribuidora la crea distribuidora.js
    // al primer ingreso, como siempre.
    async function registrarse(email, contrasena) {
        const auth = obtenerAuth();

        if (!auth) {
            throw new Error("La cuenta no está disponible en este momento.");
        }

        try {
            const resultado = await auth.createUserWithEmailAndPassword(
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

    // Entrar con Google (T86). Si es la primera vez, la distribuidora se crea
    // con el nombre de la persona (se cambia después en Más > Cuenta).
    async function entrarConGoogle() {
        const auth = obtenerAuth();

        if (!auth || !window.firebase.auth.GoogleAuthProvider) {
            throw new Error("La cuenta no está disponible en este momento.");
        }

        try {
            const proveedor = new window.firebase.auth.GoogleAuthProvider();
            proveedor.setCustomParameters({ prompt: "select_account" });
            const resultado = await auth.signInWithPopup(proveedor);
            if (resultado.additionalUserInfo && resultado.additionalUserInfo.isNewUser) {
                window.distribuidoraVendeFrio?.prepararNombre?.(resultado.user.displayName || "Mi distribuidora");
            }
            return resultado.user;
        } catch (error) {
            if (error && (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request")) {
                const aviso = new Error("Se cerró la ventana de Google antes de terminar.");
                aviso.code = error.code;
                throw aviso;
            }
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
        registrarse,
        entrarConGoogle,
        salir,
        escuchar
    };

    window.dispatchEvent(new Event("cuentaVendeFrioLista"));
}());
