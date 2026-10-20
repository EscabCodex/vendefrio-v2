// VendeFrío - Colecciones extra de la nube (Etapa 7).
// Visitas sin pedido, gastos, devoluciones, etc. no pasan por la
// sincronización grande de nube.js: cada una se escucha acá, con su copia en
// el celular. Sin cuenta (modo personal) se guardan en localStorage.
// Si la nube todavía no tiene las reglas nuevas publicadas, la colección
// sigue andando en este celular (se guarda en localStorage) hasta que estén.
(function () {
    "use strict";

    const registradas = {};
    let idEscuchando = "";

    function claveLocal(nombre) {
        return "vendefrio_extra_" + nombre;
    }

    function leerLocal(nombre) {
        try {
            const datos = JSON.parse(localStorage.getItem(claveLocal(nombre)) || "{}");
            return datos && typeof datos === "object" && !Array.isArray(datos) ? datos : {};
        } catch (error) {
            return {};
        }
    }

    function guardarLocal(nombre, datos) {
        try {
            localStorage.setItem(claveLocal(nombre), JSON.stringify(datos));
        } catch (error) {
            console.warn("No se pudo guardar en el celular.", error);
        }
    }

    function idDistribuidora() {
        const ref = window.piezas && window.piezas.refNube();
        return ref ? ref.id : "";
    }

    // Hay nube y la sesión ya entró (antes, Firestore no deja leer).
    function sesionLista() {
        try {
            return Boolean(window.firebase.auth().currentUser);
        } catch (error) {
            return false;
        }
    }

    // Algunas colecciones solo las lee el dueño: el resto escribe sin escuchar.
    function puedeLeer(coleccion) {
        const puede = coleccion.opciones.puedeLeer;
        return typeof puede === "function" ? Boolean(puede()) : true;
    }

    // ---------- Registro ----------
    // opciones: { dias: cuántos días hacia atrás traer (null = todo),
    //             describir(doc) -> {titulo, nombre, detalle} para "Sin subir",
    //             puedeLeer() -> false si esta persona solo escribe }
    function registrar(nombre, opciones) {
        if (registradas[nombre]) return registradas[nombre];
        registradas[nombre] = {
            nombre,
            opciones: opciones || {},
            docs: new Map(),
            pendientes: new Set(),
            oyentes: [],
            desuscribir: null,
            sinPermiso: false,
            cargada: false
        };
        conectar();
        return registradas[nombre];
    }

    function avisar(coleccion) {
        coleccion.oyentes.slice().forEach(oyente => {
            try {
                oyente(lista(coleccion.nombre));
            } catch (error) {
                console.error("Falló un aviso de " + coleccion.nombre + ".", error);
            }
        });
    }

    function avisarNube() {
        try {
            window.nubeVendeFrio?.avisarSincronizacion?.();
        } catch (error) {
            console.warn("No se pudo avisar a la nube.", error);
        }
    }

    function usaLocal(coleccion) {
        return !idDistribuidora() || coleccion.sinPermiso;
    }

    function escucharColeccion(coleccion) {
        const ref = window.piezas.refNube();
        if (!ref || coleccion.sinPermiso) return;
        let consulta = ref.collection(coleccion.nombre);
        const dias = coleccion.opciones.dias;
        if (dias) consulta = consulta.where("horaCelular", ">=", Date.now() - dias * 86400000);
        coleccion.desuscribir = consulta.onSnapshot({ includeMetadataChanges: true }, foto => {
            const docs = new Map();
            const pendientes = new Set();
            foto.forEach(doc => {
                docs.set(doc.id, { ...doc.data(), id: doc.id });
                if (doc.metadata.hasPendingWrites) pendientes.add(doc.id);
            });
            coleccion.docs = docs;
            coleccion.pendientes = pendientes;
            coleccion.cargada = true;
            avisar(coleccion);
            avisarNube();
        }, error => {
            if (error && error.code === "permission-denied") {
                // Las reglas nuevas todavía no se publicaron: sigue en el celular.
                console.warn("La nube todavía no deja usar " + coleccion.nombre + "; se guarda en el celular.");
                coleccion.sinPermiso = true;
            } else {
                console.error("Se cortó la escucha de " + coleccion.nombre + ".", error);
            }
            coleccion.desuscribir = null;
            coleccion.pendientes = new Set();
            avisar(coleccion);
            avisarNube();
        });
    }

    // Engancha (o suelta) las escuchas cuando cambia la distribuidora.
    function conectar() {
        const id = idDistribuidora();
        if (id !== idEscuchando) {
            Object.values(registradas).forEach(coleccion => {
                if (coleccion.desuscribir) coleccion.desuscribir();
                coleccion.desuscribir = null;
                coleccion.docs = new Map();
                coleccion.pendientes = new Set();
                coleccion.sinPermiso = false;
                coleccion.cargada = false;
            });
            idEscuchando = id;
        }
        if (!id || !sesionLista()) return;
        Object.values(registradas).forEach(coleccion => {
            if (!coleccion.desuscribir && puedeLeer(coleccion)) escucharColeccion(coleccion);
        });
    }

    // ---------- Lectura ----------
    function lista(nombre) {
        const coleccion = registradas[nombre];
        if (!coleccion) return [];
        conectar();
        let items;
        if (usaLocal(coleccion)) {
            const locales = leerLocal(nombre);
            const desde = coleccion.opciones.dias ? Date.now() - coleccion.opciones.dias * 86400000 : 0;
            items = Object.keys(locales).map(id => ({ ...locales[id], id }))
                .filter(item => !desde || (Number(item.horaCelular) || 0) >= desde);
        } else {
            items = Array.from(coleccion.docs.values());
        }
        return items.sort((a, b) => (Number(b.horaCelular) || 0) - (Number(a.horaCelular) || 0));
    }

    function obtener(nombre, id) {
        return lista(nombre).find(item => item.id === id) || null;
    }

    // Lee un documento de la nube sin escucharlo (fotos pesadas, por ejemplo).
    // Primero lo que ya está en el celular; si no está, lo pide a la nube.
    async function leer(nombre, id) {
        const coleccion = registradas[nombre] || registrar(nombre, {});
        if (usaLocal(coleccion)) {
            const locales = leerLocal(nombre);
            return locales[id] ? { ...locales[id], id } : null;
        }
        const ref = window.piezas.refNube().collection(nombre).doc(id);
        try {
            const doc = await ref.get({ source: "cache" });
            if (doc.exists) return { ...doc.data(), id };
        } catch (error) {
            // No estaba en el celular: se pide a la nube.
        }
        try {
            const doc = await ref.get();
            return doc.exists ? { ...doc.data(), id } : null;
        } catch (error) {
            if (error && error.code === "permission-denied") {
                const locales = leerLocal(nombre);
                return locales[id] ? { ...locales[id], id } : null;
            }
            console.warn("No se pudo leer " + nombre + ".", error);
            return null;
        }
    }

    function escuchar(nombre, oyente) {
        const coleccion = registradas[nombre];
        if (!coleccion || typeof oyente !== "function") return () => {};
        coleccion.oyentes.push(oyente);
        conectar();
        return () => {
            const indice = coleccion.oyentes.indexOf(oyente);
            if (indice >= 0) coleccion.oyentes.splice(indice, 1);
        };
    }

    // ---------- Escritura ----------
    function alFallar(coleccion, id, datos, error) {
        if (error && error.code === "permission-denied") {
            // Sin las reglas nuevas, queda guardado en el celular.
            coleccion.sinPermiso = true;
            if (coleccion.desuscribir) coleccion.desuscribir();
            coleccion.desuscribir = null;
            const locales = leerLocal(coleccion.nombre);
            if (datos) locales[id] = { ...(locales[id] || {}), ...datos };
            guardarLocal(coleccion.nombre, locales);
        } else {
            console.error("No se pudo guardar en " + coleccion.nombre + ".", error);
            if (typeof mostrarToast === "function") mostrarToast("No se pudo guardar. Probá de nuevo.");
        }
        avisar(coleccion);
        avisarNube();
    }

    // Guarda un documento nuevo (o lo reemplaza). Devuelve el id.
    function guardar(nombre, datos, idElegido) {
        const coleccion = registradas[nombre] || registrar(nombre, {});
        const id = idElegido || (typeof generarId === "function" ? generarId(nombre.slice(0, 4)) : nombre + "_" + Date.now());
        const limpio = { ...datos };
        delete limpio.id;
        if (usaLocal(coleccion)) {
            const locales = leerLocal(nombre);
            locales[id] = limpio;
            guardarLocal(nombre, locales);
            avisar(coleccion);
            return id;
        }
        window.piezas.refNube().collection(nombre).doc(id).set(limpio)
            .catch(error => alFallar(coleccion, id, limpio, error));
        return id;
    }

    // Cambia algunos campos de un documento que ya existe.
    function actualizar(nombre, id, campos) {
        const coleccion = registradas[nombre] || registrar(nombre, {});
        if (usaLocal(coleccion)) {
            const locales = leerLocal(nombre);
            locales[id] = { ...(locales[id] || {}), ...campos };
            guardarLocal(nombre, locales);
            avisar(coleccion);
            return;
        }
        window.piezas.refNube().collection(nombre).doc(id).update(campos)
            .catch(error => alFallar(coleccion, id, { ...(obtener(nombre, id) || {}), ...campos }, error));
    }

    function borrar(nombre, id) {
        const coleccion = registradas[nombre] || registrar(nombre, {});
        if (usaLocal(coleccion)) {
            const locales = leerLocal(nombre);
            delete locales[id];
            guardarLocal(nombre, locales);
            avisar(coleccion);
            return;
        }
        window.piezas.refNube().collection(nombre).doc(id).delete()
            .catch(error => alFallar(coleccion, id, null, error));
    }

    // ---------- "Sin subir" ----------
    function pendientes() {
        const items = [];
        Object.values(registradas).forEach(coleccion => {
            if (usaLocal(coleccion)) return;
            coleccion.pendientes.forEach(id => {
                const doc = coleccion.docs.get(id) || { id };
                const describir = coleccion.opciones.describir;
                const texto = typeof describir === "function" ? describir(doc) : {};
                items.push({
                    parte: coleccion.nombre,
                    id,
                    titulo: texto.titulo || "Cambio",
                    nombre: texto.nombre || "",
                    detalle: texto.detalle || "",
                    hora: Number(doc.horaCelular) || Date.now()
                });
            });
        });
        return items;
    }

    function enganchar() {
        if (!window.nubeVendeFrio || enganchar.listo) return;
        enganchar.listo = true;
        window.nubeVendeFrio.sumarParteExtra?.(pendientes);
        // Cada cambio de estado de la nube (entrar, salir, conectar) revisa
        // si hay que escuchar otra distribuidora.
        window.nubeVendeFrio.escucharSincronizacion?.(() => conectar());
    }

    enganchar();
    window.addEventListener("nubeVendeFrioLista", enganchar);

    window.extrasVendeFrio = { registrar, lista, obtener, leer, escuchar, guardar, actualizar, borrar, conectar };
}());
