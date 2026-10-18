// VendeFrío - Quién ve la plata (T93).
// El dueño elige en Más > Configuración > Empleados quién ve los montos de
// los resúmenes de venta (Inicio, Estadísticas, metas y el resumen de la
// noche): "Solo yo", "Yo y quien cobra" (así arranca) o "Todos". Donde no
// se ve la plata, se muestran cantidades. Va en config/plata ({ quienVe }),
// que solo escribe el dueño. El Cierre del día y "A cobrar" siguen con el
// permiso "Cobra" (son herramientas de trabajo de quien cobra). En el modo
// personal no cambia nada.
(function () {
    "use strict";

    const p = window.piezas;
    const OPCIONES = ["dueno", "cobra", "todos"];
    const INICIAL = "cobra";

    let quienVe = INICIAL;
    let dejarDeEscuchar = null;
    let idEscuchando = null;

    function enLaNube() {
        return typeof usaNubeReal === "function" && usaNubeReal();
    }

    function redibujar() {
        if (typeof actualizarDashboard === "function") {
            try { actualizarDashboard(); } catch (error) { console.warn("No se redibujó Inicio.", error); }
        }
        window.estadisticasVendeFrio?.redibujar?.();
    }

    function recibir(valor) {
        const nuevo = OPCIONES.includes(valor) ? valor : INICIAL;
        if (nuevo === quienVe) return;
        quienVe = nuevo;
        redibujar();
    }

    // Escucha config/plata de la distribuidora actual; arranca la primera
    // vez que alguien pregunta y cambia sola si cambia la distribuidora.
    function escuchar() {
        const ref = p.refNube();
        const id = ref ? ref.id : null;
        if (id === idEscuchando && (dejarDeEscuchar || !id)) return;

        if (dejarDeEscuchar) dejarDeEscuchar();
        dejarDeEscuchar = null;
        idEscuchando = id;
        quienVe = INICIAL;
        if (!ref) return;

        dejarDeEscuchar = ref.collection("config").doc("plata").onSnapshot(
            foto => recibir(foto.exists ? (foto.data() || {}).quienVe : null),
            error => {
                console.warn("No se pudo leer «Quién ve la plata».", error);
                dejarDeEscuchar = null;
                idEscuchando = null;
            });
    }

    function opcion() {
        escuchar();
        return quienVe;
    }

    // ¿La persona de este celular ve los montos de los resúmenes?
    function puedoVer() {
        if (!enLaNube()) return true;
        if (p.esDueno()) return true;
        const elegida = opcion();
        if (elegida === "todos") return true;
        if (elegida === "cobra") return Boolean(window.nubeVendeFrio?.puedeCobrar?.());
        return false;
    }

    // Solo el dueño. Sin señal queda en el celular y se sube solo al volver.
    function cambiar(valor) {
        if (!OPCIONES.includes(valor)) return Promise.reject(new Error("Opción desconocida."));
        const ref = p.refNube();
        if (!ref || !p.esDueno()) return Promise.reject(new Error("Solo el dueño lo cambia."));
        ref.collection("config").doc("plata").set({ quienVe: valor })
            .catch(error => {
                console.error("No se guardó «Quién ve la plata».", error);
                if (typeof mostrarAviso === "function") mostrarAviso("No se guardó el cambio", "Revisá la conexión y probá de nuevo.");
            });
        recibir(valor);
        return Promise.resolve(valor);
    }

    // Si cambian los permisos (por ejemplo, el dueño aprueba "Cobra"), se
    // redibuja lo que muestra plata.
    window.empleadosVendeFrio?.escucharPermisos?.(() => redibujar());

    window.verPlataVendeFrio = { puedoVer, opcion, cambiar, OPCIONES };
}());
