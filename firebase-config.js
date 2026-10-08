// VendeFrío - Configuración de Firebase
// Estos datos son públicos por diseño: identifican el proyecto, no dan acceso.
// La protección de los datos está en las reglas de seguridad de Firestore (T8).
(function () {
    const configuracionFirebase = {
        apiKey: "AIzaSyDsgzVgt8skQ65CxadS1VdMFs5X3wvEdUw",
        authDomain: "vendefrio.firebaseapp.com",
        projectId: "vendefrio",
        storageBucket: "vendefrio.firebasestorage.app",
        messagingSenderId: "354508391827",
        appId: "1:354508391827:web:35640f9828b14b3eb71466"
    };

    if (typeof window.firebase === "undefined") {
        console.warn("No se cargó el SDK de Firebase. La app sigue funcionando sin cuenta.");
        return;
    }

    try {
        if (!window.firebase.apps.length) {
            window.firebase.initializeApp(configuracionFirebase);
        }
    } catch (error) {
        console.error("No se pudo iniciar Firebase.", error);
        return;
    }

    // Trabajo sin conexión de Firestore (T9): guarda una copia en el celular,
    // anota los cambios sin internet y los sube solo al volver la señal.
    // Tiene que activarse antes de cualquier otro uso de Firestore.
    try {
        if (window.firebase.firestore) {
            window.firebase.firestore()
                .enablePersistence({ synchronizeTabs: true })
                .catch(error => {
                    console.warn("Firestore sigue sin copia en el celular.", error);
                });
        }
    } catch (error) {
        console.warn("No se pudo activar el trabajo sin conexión de Firestore.", error);
    }
}());
