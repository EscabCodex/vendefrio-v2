// VendeFrío - Adaptador nube (Firestore), modo nube de prueba (T9),
// migración "Subir mis datos a la nube" y modo nube real (T11),
// sincronización visible e indicador de conexión (T12) y nube directa
// al registrarse (T13).
// El adaptador nube cumple la misma interfaz que el adaptador local de
// database.js. Se usa en dos modos:
// - Modo prueba: los datos salen de la distribuidora de prueba "prueba-{uid}".
// - Modo nube: los datos salen de la distribuidora real, después de subirlos.
// En los dos, los datos de este celular (localStorage) no se leen ni se
// escriben: quedan guardados tal cual y vuelven al apagar el modo.
(function () {
    const PREFIJO_DISTRIBUIDORA_PRUEBA = "prueba-";
    const MAX_ESCRITURAS_POR_TANDA = 400;
    // La migración corta las tandas también por tamaño (las fotos pesan).
    const MAX_BYTES_POR_TANDA = 4 * 1024 * 1024;
    const ESPERA_MAXIMA_NUBE = 60 * 1000;

    // Colección de la app -> subcolección de la distribuidora en Firestore.
    // El orden de marcas y la lista de marcas van en config/marcas.
    const SUBCOLECCIONES = {
        comercios: "comercios",
        productos: "productos",
        historial: "pedidos",
        rutasGuardadas: "rutas"
    };

    const oyentes = [];
    // "prueba", "nube" o null (datos de este celular).
    let modo = null;
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

    // Sincronización visible (T12). Por cada parte que se escucha
    // (comercios, productos, pedidos, rutas, config): ids con cambios que
    // todavía no confirmó la nube y si lo último llegó de la copia del celular.
    const idsSinSubir = {};
    const partesDesdeCache = new Set();
    // Borrados mandados que la nube todavía no confirmó (no aparecen en la escucha).
    let borradosSinSubir = 0;
    const oyentesSincronizacion = [];
    let textoSincronizacion = "";
    let textoPedidosSinSubir = "";

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

    // Red de seguridad (T10): un solo guardado no puede borrar varios
    // registros de la nube a la vez. En la app se borra de a uno; la única
    // excepción es borrar una marca, que se lleva solo sus productos.
    function esBorradoPermitido(subcoleccion, borrados) {
        if (borrados.length <= 1) return true;
        if (subcoleccion !== "productos") return false;

        const marcas = new Set(borrados.map(([, datos]) => String(datos._marca || "")));
        return marcas.size === 1;
    }

    function errorBorradoMasivo(subcoleccion, cantidad) {
        const error = new Error(
            "Se frenó un cambio que iba a borrar " + cantidad + " registros de " + subcoleccion + " en la nube."
        );
        error.code = "borrado-masivo";
        return error;
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

        const borrados = Array.from(anteriores.entries()).filter(([id]) => !vistos.has(id));

        // Se frena antes de tocar nada: no se escribe ni se olvida ningún registro.
        if (!esBorradoPermitido(subcoleccion, borrados)) {
            throw errorBorradoMasivo(subcoleccion, borrados.length);
        }

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

    function nombreNube() {
        return modo === "prueba" ? "nube de prueba" : "nube";
    }

    function errorAlEscribir(error) {
        console.error("La nube no aceptó un cambio.", error);
        cambiarEstado(estadoDeError(error));

        if (!avisoDeErrorMostrado && typeof mostrarAviso === "function") {
            avisoDeErrorMostrado = true;
            mostrarAviso(
                "La nube no guardó un cambio",
                error && error.code === "permission-denied"
                    ? "La " + nombreNube() + " rechazó el cambio. Revisá que las reglas de seguridad estén publicadas."
                    : "No se pudo guardar un cambio en la " + nombreNube() + ". Probá de nuevo."
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

            const borrados = escrituras
                .slice(inicio, inicio + MAX_ESCRITURAS_POR_TANDA)
                .filter(escritura => escritura.tipo === "borrar").length;

            borradosSinSubir += borrados;
            if (borrados) avisarSincronizacion();

            tanda.commit()
                .catch(errorAlEscribir)
                .finally(() => {
                    if (!borrados) return;
                    borradosSinSubir = Math.max(0, borradosSinSubir - borrados);
                    avisarSincronizacion();
                });
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
                throw new Error("La " + nombreNube() + " no está lista.");
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

        // En la nube nunca se borran colecciones enteras (T10).
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

    // -------------------------------------------------
    // Sincronización visible (T12)
    // -------------------------------------------------

    function cantidadSinSubir() {
        const enDocumentos = Object.values(idsSinSubir)
            .reduce((total, ids) => total + ids.size, 0);
        return enDocumentos + borradosSinSubir;
    }

    function sincronizacion() {
        return { estado, sinSubir: cantidadSinSubir() };
    }

    function avisarSincronizacion() {
        const actual = sincronizacion();
        const texto = actual.estado + "|" + actual.sinSubir;

        if (texto !== textoSincronizacion) {
            textoSincronizacion = texto;
            actualizarIndicador();

            oyentesSincronizacion.forEach(oyente => {
                try {
                    oyente(actual);
                } catch (error) {
                    console.error("Falló un aviso de sincronización.", error);
                }
            });
        }

        // Cada pedido muestra si está pendiente de sincronizar.
        const pedidos = Array.from(idsSinSubir.pedidos || []).sort().join(",");
        if (pedidos !== textoPedidosSinSubir) {
            textoPedidosSinSubir = pedidos;
            if (typeof renderizarHistorial === "function") intentar(renderizarHistorial);
        }
    }

    // Anota qué documentos de una parte esperan subir y si la foto vino de
    // la copia del celular (sin confirmar con la nube).
    function anotarSincronizacion(parte, foto, documentosDeLaFoto) {
        const ids = new Set();

        documentosDeLaFoto.forEach(documento => {
            if (documento.metadata.hasPendingWrites) ids.add(documento.id);
        });

        idsSinSubir[parte] = ids;

        if (foto.metadata.fromCache) {
            partesDesdeCache.add(parte);
        } else {
            partesDesdeCache.delete(parte);
        }
    }

    // Conectada solo cuando la nube confirmó lo que se ve; si los datos salen
    // de la copia del celular, es "sin señal" o todavía "conectando".
    function actualizarConexion(faltanPartes) {
        if (faltanPartes) return;

        if (!navigator.onLine) {
            cambiarEstado("sinConexion");
        } else if (partesDesdeCache.size) {
            cambiarEstado("conectando");
        } else {
            cambiarEstado("conectada");
        }
    }

    function escucharNube() {
        if (!db || !refDistribuidora) return;

        dejarDeEscuchar();
        partesDesdeCache.clear();
        Object.keys(idsSinSubir).forEach(parte => delete idsSinSubir[parte]);
        cambiarEstado("conectando");

        const pendientes = new Set(Object.keys(documentos).concat("config"));
        const llego = parte => {
            pendientes.delete(parte);
            actualizarConexion(pendientes.size > 0);
            avisarSincronizacion();
        };

        // includeMetadataChanges: también avisa cuando la nube confirma un
        // cambio o cuando se pasa de la copia del celular a la nube.
        const opciones = { includeMetadataChanges: true };

        Object.keys(SUBCOLECCIONES).forEach(coleccion => {
            const subcoleccion = SUBCOLECCIONES[coleccion];
            let primera = true;

            desuscripciones.push(
                refDistribuidora.collection(subcoleccion).onSnapshot(opciones, foto => {
                    // Si solo cambió el estado de sincronización, los datos son los mismos.
                    if (primera || foto.docChanges().length) {
                        const mapa = new Map();
                        foto.forEach(documento => mapa.set(documento.id, documento.data()));
                        documentos[subcoleccion] = mapa;
                        avisarSiCambio([coleccion]);
                        primera = false;
                    }

                    anotarSincronizacion(subcoleccion, foto, foto.docs);
                    llego(subcoleccion);
                }, alFallarEscucha)
            );
        });

        desuscripciones.push(
            refDistribuidora.collection("config").doc("marcas").onSnapshot(opciones, foto => {
                configMarcas = foto.exists ? (foto.data() || {}) : {};
                avisarSiCambio(["productos", "ordenMarcas"]);
                anotarSincronizacion("config", foto, foto.exists ? [foto] : []);
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
        if (modo === "nube") {
            throw new Error("Estás usando la nube. Para encender el modo prueba, primero volvé a los datos de este celular.");
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
        actualizarIndicador();
    }

    // -------------------------------------------------
    // Indicador general de conexión (T12)
    // -------------------------------------------------
    // En modo nube es un cartel fijo abajo; en modo prueba se suma al cartel
    // de modo prueba. Muestra la conexión y cuántos cambios faltan subir.

    function textoCambios(cantidad) {
        return cantidad === 1 ? "1 cambio" : cantidad + " cambios";
    }

    function textoIndicador() {
        const sinSubir = cantidadSinSubir();

        if (estado === "sinConexion") {
            return sinSubir ? "Sin señal · " + textoCambios(sinSubir) + " sin subir" : "Sin señal · todo guardado";
        }
        if (estado === "conectada") {
            return sinSubir ? "Subiendo " + textoCambios(sinSubir) + "…" : "Conectada · todo subido";
        }
        if (estado === "sinPermiso") return "La nube no da permiso";
        if (estado === "error") return "Problema con la nube";
        return sinSubir ? "Conectando · " + textoCambios(sinSubir) + " sin subir" : "Conectando…";
    }

    function estadoIndicador() {
        if (["sinPermiso", "error"].includes(estado)) return "error";
        if (estado === "conectada" && !cantidadSinSubir()) return "ok";
        return "espera";
    }

    function mostrarIndicadorNube() {
        if (document.getElementById("indicadorNube")) return;

        const indicador = document.createElement("div");
        indicador.id = "indicadorNube";
        indicador.className = "indicadorNube";
        indicador.setAttribute("role", "status");
        document.body.appendChild(indicador);
        document.documentElement.classList.add("conIndicadorNube");
        actualizarIndicador();
    }

    function actualizarIndicador() {
        if (!modo || !document.body) return;

        const texto = textoIndicador();
        const tipo = estadoIndicador();
        const indicador = modo === "prueba"
            ? document.getElementById("cartelModoPrueba")
            : document.getElementById("indicadorNube");

        if (!indicador) return;

        indicador.dataset.estado = tipo;
        indicador.textContent = (modo === "prueba" ? "Modo prueba · " : "") + texto;
    }

    // -------------------------------------------------
    // Migración "Subir mis datos a la nube" (T11)
    // -------------------------------------------------
    // Copia los datos de este celular a la distribuidora real. Cada registro
    // va con su id como nombre del documento y, si ya está en la nube, se
    // saltea: volver a correrla no duplica ni pisa nada. Todos los pedidos del
    // historial suben marcados como "histórico", sin entradas en el historial
    // de estados (no se inventan fechas ni usuarios). localStorage no se toca.

    const ESTADO_PEDIDO_HISTORICO = "historico";

    const GRUPOS_MIGRACION = [
        { clave: "comercios", nombre: "Comercios", subcoleccion: "comercios" },
        { clave: "productos", nombre: "Productos", subcoleccion: "productos" },
        { clave: "pedidos", nombre: "Pedidos", subcoleccion: "pedidos" },
        { clave: "rutas", nombre: "Rutas", subcoleccion: "rutas" }
    ];

    let migracionEnCurso = false;
    // Resultado de la última migración verificada en esta sesión.
    let migracionVerificada = null;

    function errorMigracion(mensaje, codigo) {
        const error = new Error(mensaje);
        if (codigo) error.code = codigo;
        return error;
    }

    // Sin señal, Firestore deja las escrituras en espera en el celular: se
    // corta la espera para avisar. Lo que quedó en espera se sube solo después.
    function esperarNube(promesa) {
        let temporizador;
        const limite = new Promise((resolver, rechazar) => {
            temporizador = setTimeout(() => {
                rechazar(errorMigracion("La nube no respondió a tiempo.", "sin-respuesta"));
            }, ESPERA_MAXIMA_NUBE);
        });

        return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
    }

    function mensajeErrorMigracion(error) {
        const codigo = error && error.code;

        if (codigo === "datos-locales") return error.message;
        if (codigo === "permission-denied") {
            return "La nube no dejó guardar los datos. Revisá que las reglas de seguridad estén publicadas.";
        }
        if (!navigator.onLine || ["unavailable", "deadline-exceeded", "sin-respuesta"].includes(codigo)) {
            return "Se cortó la conexión con la nube. Revisá la señal y tocá Reintentar: lo que ya se subió no se repite.";
        }
        return "No se pudieron subir los datos. Tocá Reintentar: lo que ya se subió no se repite.";
    }

    // Los datos de este celular, tal como los ve la app. Los documentos quedan
    // iguales a los que escribiría el adaptador nube, así el primer guardado
    // en modo nube no vuelve a escribir todo.
    function prepararDatosLocales() {
        const productos = obtenerProductos();
        const marcas = Object.keys(productos);
        const grupos = {
            comercios: obtenerComercios().map(registro => ({ registro, extras: {} })),
            productos: [],
            pedidos: obtenerHistorial().map(pedido => ({
                registro: { ...pedido, estado: ESTADO_PEDIDO_HISTORICO },
                extras: {}
            })),
            rutas: obtenerRutasGuardadas().map(registro => ({ registro, extras: {} }))
        };

        marcas.forEach(marca => {
            productos[marca].forEach(producto => {
                grupos.productos.push({ registro: producto, extras: { _marca: marca } });
            });
        });

        const conProblemas = [];

        GRUPOS_MIGRACION.forEach(grupo => {
            const vistos = new Set();

            grupos[grupo.clave].forEach((item, posicion) => {
                const id = item.registro.id;

                if (!esIdValido(id) || vistos.has(id)) {
                    if (!conProblemas.includes(grupo.nombre)) conProblemas.push(grupo.nombre);
                }

                vistos.add(id);
                item.datos = aDocumento(item.registro, { ...item.extras, _orden: posicion });
            });
        });

        if (conProblemas.length) {
            throw errorMigracion(
                "Hay registros sin identificador válido en: " + conProblemas.join(", ").toLocaleLowerCase("es-AR") +
                ". Cerrá y volvé a abrir la app para que se completen, y probá de nuevo. No se subió nada.",
                "datos-locales"
            );
        }

        return { grupos, marcas, orden: obtenerMarcasOrdenadas(productos) };
    }

    // Clave para reconocer el mismo registro aunque tenga otro id (por
    // ejemplo, si se subió desde otro celular): comercios y rutas por nombre,
    // productos por marca y nombre. La app no deja repetir esos nombres.
    // Los pedidos no tienen clave: dos pedidos iguales pueden ser reales.
    function claveRegistro(clave, registro, marca) {
        const nombre = normalizarTexto(registro && registro.nombre);
        if (!nombre) return "";

        if (clave === "comercios" || clave === "rutas") return nombre;
        if (clave === "productos") return normalizarTexto(marca) + "|" + nombre;
        return "";
    }

    // Ids y claves que la nube ya confirmó, por grupo. Lo que todavía espera
    // subir desde este celular no cuenta como subido.
    async function leerIdsEnNube(ref) {
        const enNube = {};

        for (const grupo of GRUPOS_MIGRACION) {
            const foto = await esperarNube(ref.collection(grupo.subcoleccion).get({ source: "server" }));
            enNube[grupo.clave] = { ids: new Set(), claves: new Set() };

            foto.forEach(documento => {
                if (documento.metadata.hasPendingWrites) return;

                const datos = documento.data() || {};
                const clave = claveRegistro(grupo.clave, deDocumento(documento.id, datos), datos._marca);

                enNube[grupo.clave].ids.add(documento.id);
                if (clave) enNube[grupo.clave].claves.add(clave);
            });
        }

        return enNube;
    }

    function estaEnNube(enGrupo, clave, item) {
        if (enGrupo.ids.has(item.registro.id)) return true;

        const claveItem = claveRegistro(clave, item.registro, item.extras._marca);
        return Boolean(claveItem && enGrupo.claves.has(claveItem));
    }

    function unirListas(lista, nuevas) {
        const resultado = Array.isArray(lista) ? lista.map(item => String(item)) : [];

        nuevas.forEach(item => {
            if (!resultado.includes(item)) resultado.push(item);
        });

        return resultado;
    }

    // Manda las escrituras en tandas y espera que la nube confirme cada una.
    async function enviarEnTandas(firestore, escrituras, alSubir) {
        let indice = 0;

        while (indice < escrituras.length) {
            const tanda = firestore.batch();
            let cantidad = 0;
            let registros = 0;
            let bytes = 0;

            while (indice < escrituras.length && cantidad < MAX_ESCRITURAS_POR_TANDA) {
                const escritura = escrituras[indice];
                const peso = escritura.tipo === "borrar" ? 0 : JSON.stringify(escritura.datos).length;

                if (cantidad > 0 && bytes + peso > MAX_BYTES_POR_TANDA) break;

                if (escritura.tipo === "borrar") {
                    tanda.delete(escritura.ref);
                } else if (escritura.combinar) {
                    tanda.set(escritura.ref, escritura.datos, { merge: true });
                } else {
                    tanda.set(escritura.ref, escritura.datos);
                    registros++;
                }

                cantidad++;
                bytes += peso;
                indice++;
            }

            await esperarNube(tanda.commit());
            alSubir(registros);
        }
    }

    // alAvanzar(texto) recibe cómo va la subida. Devuelve
    // { completo, subidos, totales: [{ clave, nombre, enEsteCelular, enLaNube }] }.
    async function subirDatosLocales(alAvanzar) {
        const avisar = typeof alAvanzar === "function" ? alAvanzar : () => {};

        if (migracionEnCurso) {
            throw errorMigracion("La subida ya está en curso.", "datos-locales");
        }
        if (modo) {
            throw errorMigracion(
                modo === "prueba"
                    ? "Para subir tus datos, primero apagá el modo prueba."
                    : "Tus datos ya salen de la nube.",
                "datos-locales"
            );
        }

        const usuario = window.cuentaVendeFrio?.usuarioActual();
        const idDistribuidora = window.distribuidoraVendeFrio?.idActual();
        const firestore = obtenerFirestore();

        if (!usuario) throw errorMigracion("Primero ingresá a tu cuenta.", "datos-locales");
        if (!idDistribuidora) {
            throw errorMigracion("Tu distribuidora en la nube todavía no está lista.", "datos-locales");
        }
        if (!firestore) throw errorMigracion("La nube no está disponible en este momento.", "datos-locales");
        if (!navigator.onLine) throw errorMigracion(mensajeErrorMigracion({ code: "unavailable" }), "datos-locales");

        migracionEnCurso = true;
        migracionVerificada = null;

        try {
            const ref = firestore.collection("distribuidoras").doc(idDistribuidora);
            const local = prepararDatosLocales();

            avisar("Revisando qué hay en la nube…");
            const enNube = await leerIdsEnNube(ref);
            const refMarcas = ref.collection("config").doc("marcas");
            const fichaMarcas = await esperarNube(refMarcas.get({ source: "server" }));

            const escrituras = [];

            GRUPOS_MIGRACION.forEach(grupo => {
                local.grupos[grupo.clave].forEach(item => {
                    // Ya está (por id, o por nombre si vino de otro celular): no se repite.
                    if (estaEnNube(enNube[grupo.clave], grupo.clave, item)) return;

                    escrituras.push({
                        ref: ref.collection(grupo.subcoleccion).doc(item.registro.id),
                        datos: item.datos
                    });
                });
            });

            const totalASubir = escrituras.length;

            // Marcas: se suman las que falten, sin sacar ninguna de la nube.
            const actuales = fichaMarcas.exists ? (fichaMarcas.data() || {}) : {};
            const marcas = unirListas(actuales.marcas, local.marcas);
            const orden = unirListas(actuales.orden, local.orden);

            if (textoComparable(marcas) !== textoComparable(actuales.marcas || []) ||
                textoComparable(orden) !== textoComparable(actuales.orden || [])) {
                escrituras.push({ ref: refMarcas, datos: { marcas, orden }, combinar: true });
            }

            let subidos = 0;
            avisar(totalASubir ? "Subiendo… 0 de " + totalASubir : "Todo ya estaba en la nube.");

            await enviarEnTandas(firestore, escrituras, registros => {
                subidos += registros;
                if (totalASubir) avisar("Subiendo… " + subidos + " de " + totalASubir);
            });

            avisar("Comparando los totales…");
            const verificados = await leerIdsEnNube(ref);

            const totales = GRUPOS_MIGRACION.map(grupo => {
                const items = local.grupos[grupo.clave];

                return {
                    clave: grupo.clave,
                    nombre: grupo.nombre,
                    enEsteCelular: items.length,
                    enLaNube: items.filter(item => estaEnNube(verificados[grupo.clave], grupo.clave, item)).length
                };
            });

            const completo = totales.every(total => total.enLaNube === total.enEsteCelular);

            if (completo) {
                migracionVerificada = { uid: usuario.uid, distribuidora: idDistribuidora };
            }

            return { completo, subidos: totalASubir, totales };
        } catch (error) {
            console.error("No se pudieron subir los datos a la nube.", error);
            throw errorMigracion(mensajeErrorMigracion(error), "migracion");
        } finally {
            migracionEnCurso = false;
        }
    }

    // -------------------------------------------------
    // Juntar comercios y productos repetidos (arreglo de T11)
    // -------------------------------------------------
    // Si la migración se corrió desde dos lugares (por ejemplo la vista previa
    // de Vercel, que guarda sus propios datos, y la app principal), el mismo
    // comercio o producto quedó dos veces con distinto id. Se deja uno por
    // nombre (el que usan las rutas o, si no, el que tiene más datos), se le
    // pasan los datos que le falten y las rutas pasan a apuntar a ese. Los
    // pedidos no se tocan. Antes se descarga un respaldo de toda la nube.

    function estaVacio(valor) {
        if (valor === undefined || valor === null || valor === "" || valor === false || valor === 0) return true;
        if (Array.isArray(valor)) return valor.length === 0;
        if (typeof valor === "object") return Object.keys(valor).length === 0;
        return false;
    }

    function cantidadDeDatos(registro) {
        return Object.keys(registro).filter(campo => {
            return campo !== "id" && campo !== "nombre" && !estaVacio(registro[campo]);
        }).length;
    }

    function combinarRegistros(base, otros) {
        const resultado = { ...base };

        otros.forEach(otro => {
            Object.keys(otro).forEach(campo => {
                if (campo === "id") return;

                if (campo === "pedidosRealizados") {
                    resultado[campo] = Math.max(Number(resultado[campo]) || 0, Number(otro[campo]) || 0);
                    return;
                }

                if (campo === "ultimaVisita" && !estaVacio(resultado[campo]) && !estaVacio(otro[campo])) {
                    if (Date.parse(otro[campo]) > Date.parse(resultado[campo])) resultado[campo] = otro[campo];
                    return;
                }

                if (estaVacio(resultado[campo]) && !estaVacio(otro[campo])) {
                    resultado[campo] = otro[campo];
                }
            });
        });

        return resultado;
    }

    function idsUsadosEnRutas() {
        const usados = new Set();

        documentos.rutas.forEach((datos, id) => {
            const ruta = deDocumento(id, datos);
            (Array.isArray(ruta.idsComercios) ? ruta.idsComercios : []).forEach(idComercio => usados.add(idComercio));
        });

        return usados;
    }

    function agruparRepetidos(clave, usadosEnRutas) {
        const grupos = new Map();

        documentosOrdenados(documentos[clave]).forEach(([id, datos]) => {
            const registro = deDocumento(id, datos);
            const claveItem = claveRegistro(clave, registro, datos._marca);
            if (!claveItem) return;

            if (!grupos.has(claveItem)) grupos.set(claveItem, []);
            grupos.get(claveItem).push({ id, datos, registro });
        });

        return Array.from(grupos.values())
            .filter(copias => copias.length > 1)
            .map(copias => {
                // Queda el que usan las rutas, después el que tiene más datos
                // y, si empatan, el primero de la lista.
                const ordenadas = copias.slice().sort((a, b) => {
                    const enRutas = Number(usadosEnRutas.has(b.id)) - Number(usadosEnRutas.has(a.id));
                    if (enRutas !== 0) return enRutas;
                    return cantidadDeDatos(b.registro) - cantidadDeDatos(a.registro);
                });

                return { queda: ordenadas[0], sobran: ordenadas.slice(1) };
            });
    }

    function buscarRepetidos() {
        const usadosEnRutas = idsUsadosEnRutas();

        return {
            comercios: agruparRepetidos("comercios", usadosEnRutas),
            productos: agruparRepetidos("productos", usadosEnRutas)
        };
    }

    function contarRepetidos() {
        const repetidos = buscarRepetidos();
        const sobran = grupos => grupos.reduce((total, grupo) => total + grupo.sobran.length, 0);

        return { comercios: sobran(repetidos.comercios), productos: sobran(repetidos.productos) };
    }

    function descargarArchivo(nombre, datos) {
        const archivo = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
        const enlace = document.createElement("a");
        const url = URL.createObjectURL(archivo);

        enlace.href = url;
        enlace.download = nombre;
        enlace.style.display = "none";
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        URL.revokeObjectURL(url);
    }

    let juntandoRepetidos = false;

    async function juntarRepetidos() {
        if (modo !== "nube" || !db || !refDistribuidora) {
            throw new Error("Esta opción funciona solo usando la nube.");
        }
        if (estado !== "conectada" || !navigator.onLine) {
            throw new Error("Esperá a que diga \"Conectada\" y probá de nuevo. Hace falta internet.");
        }
        if (juntandoRepetidos) throw new Error("Ya se están juntando los repetidos.");

        const repetidos = buscarRepetidos();
        const escrituras = [];
        const reemplazos = new Map();
        const borrados = { comercios: 0, productos: 0 };

        ["comercios", "productos"].forEach(clave => {
            repetidos[clave].forEach(({ queda, sobran }) => {
                const combinado = combinarRegistros(queda.registro, sobran.map(copia => copia.registro));
                const extras = { _orden: queda.datos._orden };
                if (queda.datos._marca !== undefined) extras._marca = queda.datos._marca;

                const datos = aDocumento(combinado, extras);
                if (textoComparable(datos) !== textoComparable(queda.datos)) {
                    escrituras.push({ ref: refDistribuidora.collection(clave).doc(queda.id), datos });
                }

                sobran.forEach(copia => {
                    escrituras.push({ tipo: "borrar", ref: refDistribuidora.collection(clave).doc(copia.id) });
                    borrados[clave]++;
                    if (clave === "comercios") reemplazos.set(copia.id, queda);
                });
            });
        });

        if (!escrituras.length) return { ...borrados, rutas: 0 };

        // Las rutas pasan a apuntar al comercio que queda.
        let rutasCambiadas = 0;

        documentos.rutas.forEach((datos, id) => {
            const ruta = deDocumento(id, datos);
            if (!Array.isArray(ruta.idsComercios) || !Array.isArray(ruta.comercios)) return;
            if (!ruta.idsComercios.some(idComercio => reemplazos.has(idComercio))) return;

            const vistos = new Set();
            const ids = [];
            const nombres = [];

            ruta.comercios.forEach((nombre, posicion) => {
                let idComercio = ruta.idsComercios[posicion] || "";
                let nombreComercio = nombre;

                if (reemplazos.has(idComercio)) {
                    const queda = reemplazos.get(idComercio);
                    idComercio = queda.id;
                    nombreComercio = queda.registro.nombre;
                }

                // Si la ruta ya tenía el que queda, no se repite la parada.
                if (idComercio && vistos.has(idComercio)) return;
                if (idComercio) vistos.add(idComercio);

                ids.push(idComercio);
                nombres.push(nombreComercio);
            });

            escrituras.push({
                ref: refDistribuidora.collection("rutas").doc(id),
                datos: aDocumento({ ...ruta, comercios: nombres, idsComercios: ids }, { _orden: datos._orden })
            });
            rutasCambiadas++;
        });

        // Marcas que quedaron vacías y están repetidas con otra escrita parecido.
        const productosQueSalen = new Set();
        repetidos.productos.forEach(({ sobran }) => sobran.forEach(copia => productosQueSalen.add(copia.id)));

        const productosPorMarca = new Map();
        documentos.productos.forEach((datos, id) => {
            if (productosQueSalen.has(id)) return;
            const marca = String(datos._marca || "");
            productosPorMarca.set(marca, (productosPorMarca.get(marca) || 0) + 1);
        });

        const marcas = Array.isArray(configMarcas.marcas) ? configMarcas.marcas.map(String) : [];
        const orden = Array.isArray(configMarcas.orden) ? configMarcas.orden.map(String) : [];
        const sacar = new Set(marcas.filter(marca => {
            if (productosPorMarca.get(marca)) return false;

            return marcas.some(otra => {
                return otra !== marca &&
                    normalizarTexto(otra) === normalizarTexto(marca) &&
                    productosPorMarca.get(otra);
            });
        }));

        if (sacar.size) {
            escrituras.push({
                ref: refDistribuidora.collection("config").doc("marcas"),
                datos: {
                    marcas: marcas.filter(marca => !sacar.has(marca)),
                    orden: orden.filter(marca => !sacar.has(marca))
                },
                combinar: true
            });
        }

        juntandoRepetidos = true;

        try {
            // Respaldo de cómo estaba todo antes de tocar nada.
            const fecha = new Date().toISOString().slice(0, 10);
            descargarArchivo("vendefrio-antes-de-juntar-repetidos-" + fecha + ".json", crearDatosRespaldo());

            await enviarEnTandas(db, escrituras, () => {});
        } catch (error) {
            console.error("No se pudieron juntar los repetidos.", error);
            throw new Error("No se pudo terminar. Revisá la señal y tocá de nuevo \"Juntar repetidos\": sigue desde donde quedó.");
        } finally {
            juntandoRepetidos = false;
        }

        return { ...borrados, rutas: rutasCambiadas };
    }

    // Recién con los totales verificados se puede pasar a la nube.
    // Antes se vacía la copia de Firestore en el celular (no localStorage):
    // la que quedó de la migración dejaba trabada la escucha en tiempo real.
    // No se pierde nada: todo lo subido ya está confirmado en la nube.
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

    async function activarNube() {
        const usuario = window.cuentaVendeFrio?.usuarioActual();

        if (!usuario || !migracionVerificada || migracionVerificada.uid !== usuario.uid) {
            throw new Error("Primero subí tus datos y esperá que coincidan los totales.");
        }

        await vaciarCopiaDeLaNube();

        localStorage.setItem(DB_MODO_NUBE, JSON.stringify(migracionVerificada));
        window.location.reload();
    }

    // Para los demás celulares (T12): pasan a la nube sin subir sus propios
    // datos (por ejemplo, las listas de ejemplo). Solo se permite si la nube
    // ya tiene datos subidos desde el celular principal. localStorage no se toca.
    async function usarNubeSinSubir() {
        if (migracionEnCurso) throw errorMigracion("Esperá a que termine la subida.", "datos-locales");
        if (modo) {
            throw errorMigracion(
                modo === "prueba" ? "Primero apagá el modo prueba." : "Tus datos ya salen de la nube.",
                "datos-locales"
            );
        }

        const usuario = window.cuentaVendeFrio?.usuarioActual();
        const idDistribuidora = window.distribuidoraVendeFrio?.idActual();
        const firestore = obtenerFirestore();

        if (!usuario) throw errorMigracion("Primero ingresá a tu cuenta.", "datos-locales");
        if (!idDistribuidora) {
            throw errorMigracion("Tu distribuidora en la nube todavía no está lista.", "datos-locales");
        }
        if (!firestore) throw errorMigracion("La nube no está disponible en este momento.", "datos-locales");
        if (!navigator.onLine) throw errorMigracion("Hace falta internet para revisar la nube.", "datos-locales");

        let tieneDatos = false;

        try {
            const ref = firestore.collection("distribuidoras").doc(idDistribuidora);

            for (const grupo of GRUPOS_MIGRACION) {
                const foto = await esperarNube(ref.collection(grupo.subcoleccion).limit(1).get({ source: "server" }));
                if (!foto.empty) {
                    tieneDatos = true;
                    break;
                }
            }
        } catch (error) {
            console.error("No se pudo revisar la nube.", error);
            throw errorMigracion(
                error && error.code === "permission-denied"
                    ? "La nube no deja leer tu distribuidora. Revisá que las reglas de seguridad estén publicadas."
                    : "No se pudo revisar la nube. Revisá la señal y probá de nuevo.",
                "datos-locales"
            );
        }

        if (!tieneDatos) {
            throw errorMigracion(
                "Tu distribuidora en la nube está vacía. Primero subí los datos desde el celular principal con \"Subir mis datos\".",
                "datos-locales"
            );
        }

        await vaciarCopiaDeLaNube();

        localStorage.setItem(DB_MODO_NUBE, JSON.stringify({ uid: usuario.uid, distribuidora: idDistribuidora }));
        window.location.reload();
    }

    // Registro (T13): la distribuidora recién creada arranca vacía y este
    // celular no tiene datos propios, así que se usa la nube directamente,
    // sin subir nada. localStorage no se toca.
    async function usarNubeNueva() {
        if (migracionEnCurso) throw errorMigracion("Esperá a que termine la subida.", "datos-locales");
        if (modo) {
            throw errorMigracion(
                modo === "prueba" ? "Primero apagá el modo prueba." : "Tus datos ya salen de la nube.",
                "datos-locales"
            );
        }

        const usuario = window.cuentaVendeFrio?.usuarioActual();
        const idDistribuidora = window.distribuidoraVendeFrio?.idActual();

        if (!usuario) throw errorMigracion("Primero ingresá a tu cuenta.", "datos-locales");
        if (!idDistribuidora || idDistribuidora !== usuario.uid) {
            throw errorMigracion("Tu distribuidora en la nube todavía no está lista.", "datos-locales");
        }

        await vaciarCopiaDeLaNube();

        localStorage.setItem(DB_MODO_NUBE, JSON.stringify({ uid: usuario.uid, distribuidora: idDistribuidora }));
        window.location.reload();
    }

    // Vuelve a los datos de este celular. Lo de la nube queda guardado allá.
    function desactivarNube() {
        localStorage.removeItem(DB_MODO_NUBE);
        window.location.reload();
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

    function alCargarPagina(funcion) {
        if (document.body) {
            funcion();
        } else {
            document.addEventListener("DOMContentLoaded", funcion, { once: true });
        }
    }

    // tipo: "prueba" (distribuidora de prueba) o "nube" (distribuidora real).
    function iniciarModo(tipo, uidGuardado, idDistribuidora) {
        const claveModo = tipo === "prueba" ? DB_MODO_NUBE_PRUEBA : DB_MODO_NUBE;
        db = obtenerFirestore();

        if (!db || !window.cuentaVendeFrio || !window.cuentaVendeFrio.disponible()) {
            // Sin Firebase no hay modo prueba: se vuelve a los datos de este celular.
            if (tipo === "prueba") {
                console.warn("La nube no está disponible: se apaga el modo prueba.");
                localStorage.removeItem(claveModo);
                return;
            }

            // El modo nube no se apaga solo: se avisa y se reintenta al volver a abrir.
            console.warn("La nube no está disponible: se muestran los datos de este celular.");
            alCargarPagina(() => mostrarAviso(
                "La nube no está disponible",
                "Por ahora estás viendo los datos guardados en este celular, que no son los de la nube. Lo que cargues acá no se sube. Cerrá y volvé a abrir la app."
            ));
            return;
        }

        modo = tipo;
        refDistribuidora = db.collection("distribuidoras").doc(idDistribuidora);
        cambiarEstado("conectando");
        usarAdaptadorDatos(adaptadorNube);
        escucharCambiosDatos(redibujarPantallas);

        if (tipo === "prueba") {
            alCargarPagina(mostrarCartelPrueba);
        } else {
            alCargarPagina(mostrarIndicadorNube);
        }

        // El indicador sigue el estado de la conexión (T12).
        oyentes.push(() => avisarSincronizacion());

        // Si se sale de la cuenta o entra otra, se vuelve a los datos de este celular.
        window.cuentaVendeFrio.escuchar(usuario => {
            if (!usuario || usuario.uid !== uidGuardado) {
                dejarDeEscuchar();
                localStorage.removeItem(claveModo);
                window.location.reload();
                return;
            }

            if (!desuscripciones.length) escucharNube();
        });

        // Si la escucha se cortó por falta de señal, se reintenta al volver.
        window.addEventListener("online", () => {
            if (["sinConexion", "error"].includes(estado)) escucharNube();
        });

        // Sin señal se avisa enseguida, sin esperar a que Firestore lo note.
        window.addEventListener("offline", () => {
            if (["conectada", "conectando"].includes(estado)) cambiarEstado("sinConexion");
        });
    }

    window.nubeVendeFrio = {
        modoPrueba: () => modo === "prueba",
        modoNube: () => modo === "nube",
        estado: () => estado,
        activarPrueba,
        desactivarPrueba,
        subirDatos: subirDatosLocales,
        migracionEnCurso: () => migracionEnCurso,
        migracionVerificada: () => Boolean(migracionVerificada),
        activarNube,
        usarNubeSinSubir,
        usarNubeNueva,
        desactivarNube,
        // Sincronización visible (T12).
        sincronizacion,
        pedidoSinSubir: id => Boolean(id && idsSinSubir.pedidos && idsSinSubir.pedidos.has(String(id))),
        escucharSincronizacion(oyente) {
            if (typeof oyente !== "function") return () => {};

            oyentesSincronizacion.push(oyente);
            oyente(sincronizacion());

            return () => {
                const indice = oyentesSincronizacion.indexOf(oyente);
                if (indice >= 0) oyentesSincronizacion.splice(indice, 1);
            };
        },
        contarRepetidos,
        juntarRepetidos,
        reintentar: escucharNube,
        escuchar
    };

    const uidPrueba = obtenerUidModoNubePrueba();
    const modoNubeGuardado = obtenerModoNubeGuardado();

    if (uidPrueba) {
        iniciarModo("prueba", uidPrueba, idDistribuidoraPrueba(uidPrueba));
    } else if (modoNubeGuardado) {
        iniciarModo("nube", modoNubeGuardado.uid, modoNubeGuardado.distribuidora);
    }

    window.dispatchEvent(new Event("nubeVendeFrioLista"));
}());
