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
    }
}());
