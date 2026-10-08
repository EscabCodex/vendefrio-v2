// VendeFrío - Adaptador nube (Firestore) y modo nube de prueba (T9)
// El adaptador nube cumple la misma interfaz que el adaptador local de
// database.js. Por ahora solo se usa con el modo nube de prueba: los datos
// salen de la distribuidora de prueba "prueba-{uid}", nunca de la real, y los
// datos reales de este celular (localStorage) no se leen ni se escriben.
(function () {
    const PREFIJO_DISTRIBUIDORA_PRUEBA = "prueba-";
    const MAX_ESCRITURAS_POR_TANDA = 400;

    // Colección de la app -> subcolección de la distribuidora en Firestore.
    // El orden de marcas y la lista de marcas van en config/marcas.
    const SUBCOLECCIONES = {
        comercios: "comercios",
        productos: "productos",
        historial: "pedidos",
        rutasGuardadas: "rutas"
    };

    const oyentes = [];
    let estado = "apagado";
    let db = null;
    let refDistribuidora = null;
    let alCambiarDatos = null;
    let desuscripciones = [];
    let avisoDeErrorMostrado = false;

    // Lo último que se sabe de la nube: id -> datos tal como están en Firestore.
    const documentos = {
        comercios: new Map(),
        productos: new Map(),
        pedidos: new Map(),
        rutas: new Map()
    };
    let configMarcas = {};

    // Texto de lo último entregado a la app por colección, para avisar
    // solo cuando algo cambió de verdad.
    const textos = {};

    // Estados: apagado, conectando, conectada, sinConexion, sinPermiso, error.
    function cambiarEstado(nuevoEstado) {
        if (estado === nuevoEstado) return;
        estado = nuevoEstado;

        oyentes.forEach(oyente => {
            try {
                oyente(estado);
            } catch (error) {
                console.error("Falló un aviso del modo nube.", error);
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

    // -------------------------------------------------
    // Conversión entre registros de la app y documentos
    // -------------------------------------------------

    // Mismo contenido, mismo texto, sin importar el orden de los campos.
    function ordenarCampos(valor) {
        if (Array.isArray(valor)) return valor.map(ordenarCampos);

        if (valor && typeof valor === "object") {
            const ordenado = {};
            Object.keys(valor).sort().forEach(clave => {
                ordenado[clave] = ordenarCampos(valor[clave]);
            });
            return ordenado;
        }

        return valor;
    }

    function textoComparable(valor) {
        return JSON.stringify(ordenarCampos(valor));
    }

    // Firestore no admite listas dentro de listas.
    function tieneListasAnidadas(valor, dentroDeLista) {
        if (Array.isArray(valor)) {
            return dentroDeLista || valor.some(item => tieneListasAnidadas(item, true));
        }

        if (valor && typeof valor === "object") {
            return Object.keys(valor).some(clave => tieneListasAnidadas(valor[clave], false));
        }

        return false;
    }

    function esIdValido(id) {
        return typeof id === "string" &&
            id.trim() !== "" &&
            id.length <= 500 &&
            id.indexOf("/") === -1 &&
            id !== "." &&
            id !== ".." &&
            !/^__.*__$/.test(id);
    }

    // Campos internos: "_orden" guarda la posición en la lista y "_marca" la
    // marca de cada producto. Si el registro tiene listas dentro de listas,
    // se guarda entero como texto en "_json".
    function aDocumento(registro, extras) {
        const limpio = JSON.parse(JSON.stringify(registro));

        if (tieneListasAnidadas(limpio, false)) {
            return { _json: JSON.stringify(limpio), ...extras };
        }

        return { ...limpio, ...extras };
    }

    function deDocumento(id, datos) {
        let registro = {};

        if (typeof datos._json === "string") {
            try {
                registro = JSON.parse(datos._json) || {};
            } catch (error) {
                console.error("Un registro de la nube estaba dañado: " + id, error);
            }
        } else {
            registro = { ...datos };
        }

        delete registro._orden;
        delete registro._marca;
        delete registro._json;
        registro.id = id;
        return registro;
    }

    function documentosOrdenados(mapa) {
        return Array.from(mapa.entries()).sort((a, b) => {
            const ordenA = Number(a[1]._orden);
            const ordenB = Number(b[1]._orden);
            const diferencia = (Number.isFinite(ordenA) ? ordenA : 0) - (Number.isFinite(ordenB) ? ordenB : 0);
            if (diferencia !== 0) return diferencia;
            return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
        });
    }

    // Recibe el "_orden" anterior de cada registro (o undefined si es nuevo) y
    // devuelve números crecientes. Conserva los que ya estaban en orden, así
    // agregar o borrar un registro escribe solo ese registro.
    function calcularOrdenes(anteriores) {
        const resultado = new Array(anteriores.length);
        let ultimo = -Infinity;
        let i = 0;

        const sirve = (valor, minimo) => typeof valor === "number" && Number.isFinite(valor) && valor > minimo;

        while (i < anteriores.length) {
            if (sirve(anteriores[i], ultimo)) {
                resultado[i] = anteriores[i];
                ultimo = anteriores[i];
                i++;
                continue;
            }

            let j = i + 1;
            while (j < anteriores.length && !sirve(anteriores[j], ultimo)) j++;

            const cantidad = j - i;
            let siguiente = j < anteriores.length ? anteriores[j] : undefined;
            let desde;
            let hasta;

            // Si no queda lugar entre dos números, se renumera lo que sigue.
            if (siguiente !== undefined && ultimo !== -Infinity &&
                (siguiente - ultimo) / (cantidad + 1) < 1e-6) {
                siguiente = undefined;
                j = anteriores.length;
            }

            const tramo = j - i;

            if (siguiente === undefined) {
                desde = ultimo === -Infinity ? 0 : ultimo;
                hasta = desde + tramo + 1;
            } else if (ultimo === -Infinity) {
                hasta = siguiente;
                desde = siguiente - tramo - 1;
            } else {
                desde = ultimo;
                hasta = siguiente;
            }

            for (let paso = 1; paso <= tramo; paso++) {
                resultado[i + paso - 1] = desde + (hasta - desde) * paso / (tramo + 1);
            }

            ultimo = resultado[j - 1];
            i = j;
        }

        return resultado;
    }

    // -------------------------------------------------
    // Adaptador nube
    // -------------------------------------------------

    function leerDatos(coleccion) {
        if (coleccion === "ordenMarcas") {
            return Array.isArray(configMarcas.orden) ? configMarcas.orden.slice() : [];
        }

        if (coleccion === "productos") {
            const productos = {};

            (Array.isArray(configMarcas.marcas) ? configMarcas.marcas : []).forEach(marca => {
                if (typeof marca === "string" && marca.trim()) productos[marca] = [];
            });

            documentosOrdenados(documentos.productos).forEach(([id, datos]) => {
                const marca = String(datos._marca || "").trim() || "Sin marca";
                if (!productos[marca]) productos[marca] = [];
                productos[marca].push(deDocumento(id, datos));
            });

            return productos;
        }

        const subcoleccion = SUBCOLECCIONES[coleccion];
        if (!subcoleccion) return undefined;

        return documentosOrdenados(documentos[subcoleccion])
            .map(([id, datos]) => deDocumento(id, datos));
    }

    // Devuelve true si lo que ve la app de esa colección cambió.
    function actualizarTexto(coleccion) {
        const texto = textoComparable(leerDatos(coleccion));
        const cambio = textos[coleccion] !== texto;
        textos[coleccion] = texto;
        return cambio;
    }

    function avisarSiCambio(colecciones) {
        colecciones.forEach(coleccion => {
            if (actualizarTexto(coleccion) && alCambiarDatos) {
                alCambiarDatos(coleccion);
            }
        });
    }

    // Compara con lo último conocido y anota en "escrituras" solo los
    // documentos nuevos, cambiados o borrados.
    function compararRegistros(subcoleccion, items, escrituras) {
        const anteriores = documentos[subcoleccion];
        const vistos = new Set();
        const validos = items.filter(item => {
            const id = item.registro.id;

            if (!esIdValido(id)) {
                console.error("Un registro no se subió a la nube: su id no es válido.", item.registro);
                return false;
            }

            if (vistos.has(id)) return false;
            vistos.add(id);
            return true;
        });

        const ordenes = calcularOrdenes(validos.map(item => {
            const anterior = anteriores.get(item.registro.id);
            return anterior ? anterior._orden : undefined;
        }));

        const nuevos = new Map();

        validos.forEach((item, posicion) => {
            const id = item.registro.id;
            const datos = aDocumento(item.registro, { ...item.extras, _orden: ordenes[posicion] });
            const anterior = anteriores.get(id);

            nuevos.set(id, datos);

            if (!anterior || textoComparable(anterior) !== textoComparable(datos)) {
                escrituras.push({ tipo: "guardar", ref: refDistribuidora.collection(subcoleccion).doc(id), datos });
            }
        });

        anteriores.forEach((datos, id) => {
            if (!nuevos.has(id)) {
                escrituras.push({ tipo: "borrar", ref: refDistribuidora.collection(subcoleccion).doc(id) });
            }
        });

        documentos[subcoleccion] = nuevos;
    }

    function errorAlEscribir(error) {
        console.error("La nube no aceptó un cambio.", error);
        cambiarEstado(estadoDeError(error));

        if (!avisoDeErrorMostrado && typeof mostrarAviso === "function") {
            avisoDeErrorMostrado = true;
            mostrarAviso(
                "La nube no guardó un cambio",
                error && error.code === "permission-denied"
                    ? "La nube de prueba rechazó el cambio. Revisá que las reglas de seguridad estén publicadas."
                    : "No se pudo guardar un cambio en la nube de prueba. Probá de nuevo."
            );
        }
    }

    // Las escrituras se mandan en tandas. Sin internet, Firestore las guarda
    // en el celular y las sube solo cuando vuelve la señal.
    function enviarEscrituras(escrituras) {
        for (let inicio = 0; inicio < escrituras.length; inicio += MAX_ESCRITURAS_POR_TANDA) {
            const tanda = db.batch();

            escrituras.slice(inicio, inicio + MAX_ESCRITURAS_POR_TANDA).forEach(escritura => {
                if (escritura.tipo === "borrar") {
                    tanda.delete(escritura.ref);
                } else if (escritura.combinar) {
                    tanda.set(escritura.ref, escritura.datos, { merge: true });
                } else {
                    tanda.set(escritura.ref, escritura.datos);
                }
            });

            tanda.commit().catch(errorAlEscribir);
        }
    }

    const adaptadorNube = {
        nombre: "nube",

        // Hasta que llega lo de la nube, las colecciones están vacías (no
        // undefined): así no se cargan las listas de ejemplo.
        leer(coleccion) {
            return leerDatos(coleccion);
        },

        guardar(coleccion, datos) {
            if (!db || !refDistribuidora) {
                throw new Error("La nube de prueba no está lista.");
            }

            const escrituras = [];
            const refMarcas = refDistribuidora.collection("config").doc("marcas");

            if (coleccion === "ordenMarcas") {
                const orden = (Array.isArray(datos) ? datos : []).map(marca => String(marca));

                if (textoComparable(orden) !== textoComparable(configMarcas.orden || [])) {
                    configMarcas = { ...configMarcas, orden };
                    escrituras.push({ tipo: "guardar", ref: refMarcas, datos: { orden }, combinar: true });
                }
            } else if (coleccion === "productos") {
                const productos = datos && typeof datos === "object" && !Array.isArray(datos) ? datos : {};
                const marcas = Object.keys(productos);
                const items = [];

                marcas.forEach(marca => {
                    (Array.isArray(productos[marca]) ? productos[marca] : []).forEach(producto => {
                        if (producto && typeof producto === "object") {
                            items.push({ registro: producto, extras: { _marca: marca } });
                        }
                    });
                });

                compararRegistros("productos", items, escrituras);

                if (textoComparable(marcas) !== textoComparable(configMarcas.marcas || [])) {
                    configMarcas = { ...configMarcas, marcas };
                    escrituras.push({ tipo: "guardar", ref: refMarcas, datos: { marcas }, combinar: true });
                }
            } else if (SUBCOLECCIONES[coleccion]) {
                const items = (Array.isArray(datos) ? datos : [])
                    .filter(registro => registro && typeof registro === "object")
                    .map(registro => ({ registro, extras: {} }));

                compararRegistros(SUBCOLECCIONES[coleccion], items, escrituras);
            } else {
                throw new Error("Colección desconocida: " + coleccion);
            }

            actualizarTexto(coleccion);
            if (escrituras.length) enviarEscrituras(escrituras);
        },

        // En la nube no se borran colecciones enteras (eso lo resuelve T10).
        borrar(coleccion) {
            throw new Error("En la nube no se borra la colección completa: " + coleccion);
        },

        escucharCambios(alCambiar) {
            alCambiarDatos = alCambiar;
            return () => {
                if (alCambiarDatos === alCambiar) alCambiarDatos = null;
            };
        }
    };

    // -------------------------------------------------
    // Escucha en tiempo real
    // -------------------------------------------------

    function dejarDeEscuchar() {
        desuscripciones.forEach(dejar => dejar());
        desuscripciones = [];
    }

    function alFallarEscucha(error) {
        console.error("Se cortó la escucha de la nube.", error);
        dejarDeEscuchar();
        cambiarEstado(estadoDeError(error));
    }

    function escucharNube() {
        if (!db || !refDistribuidora) return;

        dejarDeEscuchar();
        cambiarEstado("conectando");

        const pendientes = new Set(Object.keys(documentos).concat("config"));
        const llego = parte => {
            pendientes.delete(parte);
            if (pendientes.size === 0) cambiarEstado("conectada");
        };

        Object.keys(SUBCOLECCIONES).forEach(coleccion => {
            const subcoleccion = SUBCOLECCIONES[coleccion];

            desuscripciones.push(
                refDistribuidora.collection(subcoleccion).onSnapshot(foto => {
                    const mapa = new Map();
                    foto.forEach(documento => mapa.set(documento.id, documento.data()));
                    documentos[subcoleccion] = mapa;
                    avisarSiCambio([coleccion]);
                    llego(subcoleccion);
                }, alFallarEscucha)
            );
        });

        desuscripciones.push(
            refDistribuidora.collection("config").doc("marcas").onSnapshot(foto => {
                configMarcas = foto.exists ? (foto.data() || {}) : {};
                avisarSiCambio(["productos", "ordenMarcas"]);
                llego("config");
            }, alFallarEscucha)
        );
    }

    // -------------------------------------------------
    // Distribuidora de prueba
    // -------------------------------------------------

    function idDistribuidoraPrueba(uid) {
        return PREFIJO_DISTRIBUIDORA_PRUEBA + uid;
    }

    // Se fija si la distribuidora de prueba existe y, si no, la crea junto
    // con la ficha de miembro. Necesita internet.
    async function asegurarDistribuidoraPrueba(usuario) {
        const firestore = obtenerFirestore();
        if (!firestore) throw Object.assign(new Error("Firestore no está disponible."), { code: "no-disponible" });

        const ref = firestore.collection("distribuidoras").doc(idDistribuidoraPrueba(usuario.uid));

        try {
            const ficha = await ref.get({ source: "server" });
            if (ficha.exists) return;
        } catch (error) {
            // Si todavía no existe, las reglas no dejan leerla: se intenta crearla.
            if (!error || error.code !== "permission-denied") throw error;
        }

        const ahora = window.firebase.firestore.FieldValue.serverTimestamp();
        const tanda = firestore.batch();

        tanda.set(ref, {
            nombre: "Distribuidora de prueba",
            duenoUid: usuario.uid,
            prueba: true,
            creada: ahora
        });
        tanda.set(ref.collection("miembros").doc(usuario.uid), {
            email: usuario.email || "",
            rol: "dueno",
            alta: ahora
        });

        await tanda.commit();
    }

    function mensajeDeError(error) {
        const codigo = error && error.code;

        if (codigo === "permission-denied") {
            return "La nube no dejó crear la distribuidora de prueba. Falta publicar las reglas de seguridad nuevas en Firebase.";
        }
        if (!navigator.onLine || codigo === "unavailable" || codigo === "deadline-exceeded") {
            return "No hay conexión a internet. Para encender el modo prueba hace falta señal.";
        }
        return "No se pudo encender el modo prueba. Probá de nuevo.";
    }

    async function activarPrueba() {
        const usuario = window.cuentaVendeFrio?.usuarioActual();

        if (!usuario) {
            throw new Error("Primero ingresá a tu cuenta.");
        }
        if (!navigator.onLine) {
            throw new Error(mensajeDeError({ code: "unavailable" }));
        }

        try {
            await asegurarDistribuidoraPrueba(usuario);
        } catch (error) {
            console.error("No se pudo preparar la distribuidora de prueba.", error);
            throw new Error(mensajeDeError(error));
        }

        localStorage.setItem(DB_MODO_NUBE_PRUEBA, usuario.uid);
        window.location.reload();
    }

    function desactivarPrueba() {
        localStorage.removeItem(DB_MODO_NUBE_PRUEBA);
        window.location.reload();
    }

    // -------------------------------------------------
    // Pantallas: se redibujan cuando el cambio vino de otro celular
    // -------------------------------------------------

    function pantallaVisible(id) {
        const pantalla = document.getElementById(id);
        return Boolean(pantalla && !pantalla.classList.contains("oculto"));
    }

    function intentar(funcion) {
        try {
            funcion();
        } catch (error) {
            console.error("No se pudo redibujar una pantalla.", error);
        }
    }

    function redibujarPantallas(aviso) {
        if (!aviso.externo) return;

        const cambio = coleccion => aviso.colecciones.includes(coleccion);
        const cambioProductos = cambio("productos") || cambio("ordenMarcas");

        if (cambio("comercios")) {
            if (typeof actualizarDatalistPedido === "function") intentar(actualizarDatalistPedido);
            if (typeof actualizarDatalist === "function") intentar(actualizarDatalist);
            if (typeof renderizarComercios === "function") intentar(renderizarComercios);
            if (typeof cargarSelectComerciosRuta === "function") intentar(cargarSelectComerciosRuta);
        }

        if (cambioProductos) {
            // El borrador del pedido se guarda en cada cambio y se vuelve a cargar al redibujar.
            if (typeof renderizarPedido === "function") intentar(renderizarPedido);

            if (typeof renderizarProductosAdmin === "function") {
                const buscador = document.getElementById("buscarProducto");
                intentar(() => renderizarProductosAdmin(buscador ? buscador.value : ""));
            }

            if (pantallaVisible("pantallaCatalogo") && typeof window.abrirCatalogo === "function") {
                intentar(window.abrirCatalogo);
            }
        }

        if (cambio("historial") && typeof renderizarHistorial === "function") {
            intentar(renderizarHistorial);
        }

        if (cambio("rutasGuardadas") && typeof renderizarRutasGuardadas === "function") {
            intentar(renderizarRutasGuardadas);
        }

        if (pantallaVisible("pantallaEstadisticas") && typeof window.abrirEstadisticas === "function") {
            intentar(window.abrirEstadisticas);
        }

        if (typeof actualizarDashboard === "function") intentar(actualizarDashboard);
    }

    // -------------------------------------------------
    // Cartel fijo para saber siempre que estás en modo prueba
    // -------------------------------------------------

    function mostrarCartelPrueba() {
        if (document.getElementById("cartelModoPrueba")) return;

        const cartel = document.createElement("div");
        cartel.id = "cartelModoPrueba";
        cartel.className = "cartelModoPrueba";
        cartel.setAttribute("role", "status");
        cartel.textContent = "Modo prueba · distribuidora de prueba en la nube";
        document.body.appendChild(cartel);
        document.documentElement.classList.add("conModoPrueba");
    }

    // -------------------------------------------------
    // Arranque
    // -------------------------------------------------

    function escuchar(oyente) {
        if (typeof oyente !== "function") return () => {};

        oyentes.push(oyente);
        oyente(estado);

        return () => {
            const indice = oyentes.indexOf(oyente);
            if (indice >= 0) oyentes.splice(indice, 1);
        };
    }

    function iniciarModoPrueba(uidGuardado) {
        db = obtenerFirestore();

        // Sin Firebase no hay modo prueba: se vuelve a los datos de este celular.
        if (!db || !window.cuentaVendeFrio || !window.cuentaVendeFrio.disponible()) {
            console.warn("La nube no está disponible: se apaga el modo prueba.");
            localStorage.removeItem(DB_MODO_NUBE_PRUEBA);
            return;
        }

        refDistribuidora = db.collection("distribuidoras").doc(idDistribuidoraPrueba(uidGuardado));
        cambiarEstado("conectando");
        usarAdaptadorDatos(adaptadorNube);
        escucharCambiosDatos(redibujarPantallas);

        if (document.body) {
            mostrarCartelPrueba();
        } else {
            document.addEventListener("DOMContentLoaded", mostrarCartelPrueba, { once: true });
        }

        // Si se sale de la cuenta o entra otra, se apaga el modo prueba.
        window.cuentaVendeFrio.escuchar(usuario => {
            if (!usuario || usuario.uid !== uidGuardado) {
                dejarDeEscuchar();
                localStorage.removeItem(DB_MODO_NUBE_PRUEBA);
                window.location.reload();
                return;
            }

            if (!desuscripciones.length) escucharNube();
        });

        // Si la escucha se cortó por falta de señal, se reintenta al volver.
        window.addEventListener("online", () => {
            if (["sinConexion", "error"].includes(estado)) escucharNube();
        });
    }

    window.nubeVendeFrio = {
        modoPrueba: () => obtenerNombreAdaptadorDatos() === "nube",
        estado: () => estado,
        activarPrueba,
        desactivarPrueba,
        reintentar: escucharNube,
        escuchar
    };

    const uidGuardado = obtenerUidModoNubePrueba();
    if (uidGuardado) iniciarModoPrueba(uidGuardado);

    window.dispatchEvent(new Event("nubeVendeFrioLista"));
}());
