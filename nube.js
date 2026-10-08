// VendeFrío - Adaptador nube (Firestore), modo nube de prueba (T9),
// migración "Subir mis datos a la nube" y modo nube real (T11).
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

    // Ids que la nube ya confirmó, por grupo. Lo que todavía espera subir
    // desde este celular no cuenta como subido.
    async function leerIdsEnNube(ref) {
        const ids = {};

        for (const grupo of GRUPOS_MIGRACION) {
            const foto = await esperarNube(ref.collection(grupo.subcoleccion).get({ source: "server" }));
            ids[grupo.clave] = new Set();

            foto.forEach(documento => {
                if (!documento.metadata.hasPendingWrites) ids[grupo.clave].add(documento.id);
            });
        }

        return ids;
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
                const peso = JSON.stringify(escritura.datos).length;

                if (cantidad > 0 && bytes + peso > MAX_BYTES_POR_TANDA) break;

                if (escritura.combinar) {
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
                    if (enNube[grupo.clave].has(item.registro.id)) return;

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
                const ids = local.grupos[grupo.clave].map(item => item.registro.id);

                return {
                    clave: grupo.clave,
                    nombre: grupo.nombre,
                    enEsteCelular: ids.length,
                    enLaNube: ids.filter(id => verificados[grupo.clave].has(id)).length
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

    // Recién con los totales verificados se puede pasar a la nube.
    // Antes se vacía la copia de Firestore en el celular (no localStorage):
    // la que quedó de la migración dejaba trabada la escucha en tiempo real.
    // No se pierde nada: todo lo subido ya está confirmado en la nube.
    async function activarNube() {
        const usuario = window.cuentaVendeFrio?.usuarioActual();

        if (!usuario || !migracionVerificada || migracionVerificada.uid !== usuario.uid) {
            throw new Error("Primero subí tus datos y esperá que coincidan los totales.");
        }

        try {
            const firestore = obtenerFirestore();

            if (firestore) {
                await firestore.terminate();
                await firestore.clearPersistence();
            }
        } catch (error) {
            console.warn("No se pudo vaciar la copia de la nube en el celular.", error);
        }

        localStorage.setItem(DB_MODO_NUBE, JSON.stringify(migracionVerificada));
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

        if (tipo === "prueba") alCargarPagina(mostrarCartelPrueba);

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
        desactivarNube,
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
