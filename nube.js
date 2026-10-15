// VendeFrío - Adaptador nube (Firestore) (T9), migración "Subir mis datos
// a la nube" y modo nube (T11), sincronización visible e indicador de
// conexión (T12), nube directa al registrarse (T13), Solo nube (T16c),
// pedidos campo por campo (T20), lo que necesitan los avisos (T23), la
// checklist de preparación con sus faltantes (T24), editar el pedido (T25),
// eliminar y cancelar (T26), la entrega (T27) y el cobro (T28).
// El adaptador nube cumple la misma interfaz que el adaptador local de
// database.js. Con cuenta o con código los datos salen siempre de la
// distribuidora en la nube (T16c): los datos de este celular (localStorage)
// no se leen ni se escriben y quedan guardados tal cual. El modo prueba
// (T9) se sacó en T16c: para probar se usa una cuenta de prueba.
(function () {
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
    // "nube" o null (datos de este celular, solo sin sesión).
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

    function esMapa(valor) {
        return Boolean(valor) && typeof valor === "object" && !Array.isArray(valor);
    }

    // Pedidos (T20): lo que cambió entre dos versiones de un pedido, campo
    // por campo. Entra en los mapas (por ejemplo, en cada entrada del
    // historial de estados); las listas y los demás valores van enteros.
    // Devuelve [{ ruta: ["estados", "est_x"], valor }] y { ruta, borrar: true }.
    function camposCambiados(antes, despues, ruta, cambios) {
        const camino = ruta || [];
        const resultado = cambios || [];
        const tiene = (objeto, clave) => Object.prototype.hasOwnProperty.call(objeto, clave);
        const claves = new Set(Object.keys(antes).concat(Object.keys(despues)));

        claves.forEach(clave => {
            const rutaCampo = camino.concat(clave);

            if (!tiene(despues, clave)) {
                resultado.push({ ruta: rutaCampo, borrar: true });
            } else if (tiene(antes, clave) && esMapa(antes[clave]) && esMapa(despues[clave])) {
                camposCambiados(antes[clave], despues[clave], rutaCampo, resultado);
            } else if (!tiene(antes, clave) || textoComparable(antes[clave]) !== textoComparable(despues[clave])) {
                resultado.push({ ruta: rutaCampo, valor: despues[clave] });
            }
        });

        return resultado;
    }

    // Lo que recibe update() de Firestore: ruta, valor, ruta, valor...
    // Cada ruta va como FieldPath, así sirve con cualquier nombre de campo.
    function argumentosDeActualizacion(campos) {
        const FieldPath = window.firebase.firestore.FieldPath;
        const borrar = window.firebase.firestore.FieldValue.delete();
        const argumentos = [];

        campos.forEach(campo => {
            argumentos.push(new FieldPath(...campo.ruta), campo.borrar ? borrar : campo.valor);
        });

        return argumentos;
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
            const ref = refDistribuidora.collection(subcoleccion).doc(id);

            nuevos.set(id, datos);

            if (!anterior) {
                escrituras.push({ tipo: "guardar", ref, datos });
            } else if (textoComparable(anterior) !== textoComparable(datos)) {
                // Un pedido que ya está en la nube nunca se reescribe entero
                // (T20): se mandan solo los campos que cambiaron.
                if (subcoleccion === "pedidos") {
                    const campos = camposCambiados(anterior, datos);
                    if (campos.length) escrituras.push({ tipo: "actualizar", ref, campos });
                } else {
                    escrituras.push({ tipo: "guardar", ref, datos });
                }
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
                    ? "La nube rechazó el cambio. Revisá que las reglas de seguridad estén publicadas."
                    : "No se pudo guardar un cambio en la nube. Probá de nuevo."
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
                } else if (escritura.tipo === "actualizar") {
                    tanda.update(escritura.ref, ...argumentosDeActualizacion(escritura.campos));
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

    // Avisos (T23): lo que este celular hace sobre los pedidos (pedido
    // nuevo, incidencia y su resolución; desde T24, faltante y preparado;
    // desde T25, pedido editado; desde T26, pedido cancelado; desde T27,
    // pedido entregado, y desde T28, cobro pendiente), para que avisos.js
    // les deje un
    // aviso a quienes corresponde. Se avisa después de mandar el cambio: un
    // aviso que falla nunca frena el pedido.
    const oyentesAccionesDePedidos = [];

    function avisarAccionDePedido(accion) {
        oyentesAccionesDePedidos.forEach(oyente => {
            try {
                oyente(accion);
            } catch (error) {
                console.error("Falló un aviso de pedidos.", error);
            }
        });
    }

    function escucharAccionesDePedidos(oyente) {
        if (typeof oyente !== "function") return () => {};

        oyentesAccionesDePedidos.push(oyente);
        return () => {
            const indice = oyentesAccionesDePedidos.indexOf(oyente);
            if (indice >= 0) oyentesAccionesDePedidos.splice(indice, 1);
        };
    }

    const adaptadorNube = {
        nombre: "nube",

        // Hasta que llega lo de la nube, las colecciones están vacías (no
        // undefined): así no se cargan las listas de ejemplo.
        leer(coleccion) {
            return leerDatos(coleccion);
        },

        guardar(coleccion, datos) {
            // Si Firebase no cargó, no se guarda en ningún lado (T16c).
            if (!db || !refDistribuidora) {
                const error = new Error("La nube no está disponible.");
                error.code = "nube-no-disponible";
                throw error;
            }

            const escrituras = [];
            const refMarcas = refDistribuidora.collection("config").doc("marcas");
            let pedidosCreados = [];

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

                // Avisos (T23): los pedidos que este guardado crea en la nube.
                if (coleccion === "historial") {
                    const conocidos = new Set(documentos.pedidos.keys());
                    compararRegistros("pedidos", items, escrituras);
                    pedidosCreados = items
                        .map(item => item.registro)
                        .filter(registro => !conocidos.has(registro.id) && documentos.pedidos.has(registro.id));
                } else {
                    compararRegistros(SUBCOLECCIONES[coleccion], items, escrituras);
                }
            } else {
                throw new Error("Colección desconocida: " + coleccion);
            }

            actualizarTexto(coleccion);
            if (escrituras.length) enviarEscrituras(escrituras);

            pedidosCreados.forEach(pedido => avisarAccionDePedido({ accion: "pedidoNuevo", pedido: JSON.parse(JSON.stringify(pedido)) }));
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
    // Pedidos campo por campo (T20)
    // -------------------------------------------------
    // Los cambios de un pedido que ya está en la nube se guardan campo por
    // campo (update), nunca el pedido entero: dos personas que cambian cosas
    // distintas del mismo pedido no se pisan. Sin señal quedan en el celular
    // y suben solos al volver. Los usan las tareas que siguen (preparación,
    // entrega, cobro y ediciones); firestore.rules revisa quién puede qué.

    // Campos que se cambian con cambiarCamposDelPedido. El autor, la fecha y
    // el id no cambian nunca; el historial de estados tiene su propia función.
    const CAMPOS_QUE_CAMBIAN_EN_UN_PEDIDO = [
        "preparacion", "faltantes", "entrega", "cobro", "ediciones",
        "productos", "comercio", "observaciones", "pedido", "cantidad"
    ];

    function errorDelPedido(mensaje) {
        const error = new Error(mensaje);
        error.code = "pedido";
        return error;
    }

    function pedidoEnLaNube(idPedido) {
        if (!db || !refDistribuidora) throw errorDelPedido("La nube no está disponible en este momento.");

        const id = String(idPedido || "");
        const datos = documentos.pedidos.get(id);

        if (!datos) throw errorDelPedido("No se encontró ese pedido.");
        if (typeof datos._json === "string") throw errorDelPedido("Ese pedido no se puede cambiar por partes.");

        return { ref: refDistribuidora.collection("pedidos").doc(id), pedido: deDocumento(id, datos) };
    }

    // No espera a la nube: la escucha muestra el cambio enseguida, también
    // sin señal. Si la nube lo rechaza, avisa como cualquier otro cambio.
    function enviarCambiosDelPedido(ref, campos) {
        ref.update(...argumentosDeActualizacion(campos)).catch(errorAlEscribir);
    }

    // cambios: { "preparacion.lin_x": valor, "entrega": valor }. La ruta va
    // con puntos y undefined borra el campo. Devuelve true si mandó algo.
    function cambiarCamposDelPedido(idPedido, cambios) {
        const { ref } = pedidoEnLaNube(idPedido);

        const campos = Object.keys(cambios || {}).map(texto => {
            const ruta = texto.split(".");

            if (!ruta.every(parte => /^[A-Za-z0-9_]{1,100}$/.test(parte))) {
                throw errorDelPedido("Ese campo no es válido: " + texto);
            }
            if (!CAMPOS_QUE_CAMBIAN_EN_UN_PEDIDO.includes(ruta[0])) {
                throw errorDelPedido("Ese campo del pedido no se cambia así: " + texto);
            }

            if (cambios[texto] === undefined) return { ruta, borrar: true };

            const valor = JSON.parse(JSON.stringify(cambios[texto]));
            if (tieneListasAnidadas(valor, false)) {
                throw errorDelPedido("La nube no admite listas dentro de listas: " + texto);
            }

            return { ruta, valor };
        });

        if (!campos.length) return false;

        enviarCambiosDelPedido(ref, campos);
        return true;
    }

    // Suma una entrada al historial de estados (solo se agrega) a nombre de
    // quien usa este celular, y actualiza la copia del estado actual (el de
    // la entrada más nueva según la hora en que se hizo). Devuelve el id de
    // la entrada. Un pedido "Histórico" no cambia de estado.
    function agregarEstadoAlPedido(idPedido, estado, nota) {
        const { ref, pedido } = pedidoEnLaNube(idPedido);

        if (!ESTADOS_PEDIDO.some(item => item.id === estado)) throw errorDelPedido("Ese estado no existe: " + estado);
        if (!pedidoTieneEstados(pedido)) throw errorDelPedido("Un pedido Histórico no cambia de estado.");

        const persona = personaDeEsteCelular();
        if (!persona) {
            throw errorDelPedido("La app todavía está reconociendo quién usa este celular. Probá de nuevo en unos segundos.");
        }

        const [idEntrada, entrada] = nuevaEntradaDeEstado(estado, nota, persona, Date.now());
        const actual = estadoActualDelPedido({ estados: { ...pedido.estados, [idEntrada]: entrada } });

        enviarCambiosDelPedido(ref, [
            { ruta: ["estados", idEntrada], valor: entrada },
            { ruta: ["estado"], valor: actual }
        ]);

        return idEntrada;
    }

    // -------------------------------------------------
    // Incidencias (T22)
    // -------------------------------------------------
    // Se marcan encima del estado, sin reemplazarlo. Cada una es una entrada
    // del mapa "incidencias" del pedido: { motivo, persona, horaCelular }. Al
    // resolverla se suma, con el mismo id, una entrada en
    // "incidenciasResueltas": { nota, persona, horaCelular }. Las dos solo se
    // agregan (nunca se cambian ni se borran) y cada cambio va campo por
    // campo, así dos personas no se pisan.

    const LARGO_MAXIMO_TEXTO_INCIDENCIA = 300;

    function textoDeIncidencia(texto, queFalta) {
        const limpio = String(texto || "").trim().slice(0, LARGO_MAXIMO_TEXTO_INCIDENCIA);
        if (!limpio) throw errorDelPedido("Escribí " + queFalta + ".");
        return limpio;
    }

    function pedidoConEstadosYPersona(idPedido, siEsHistorico) {
        const { ref, pedido } = pedidoEnLaNube(idPedido);

        if (!pedidoTieneEstados(pedido)) throw errorDelPedido(siEsHistorico || "Un pedido Histórico no tiene incidencias.");

        const persona = personaDeEsteCelular();
        if (!persona) {
            throw errorDelPedido("La app todavía está reconociendo quién usa este celular. Probá de nuevo en unos segundos.");
        }

        return { ref, pedido, persona: { idPersona: persona.idPersona, nombre: persona.nombre, uid: persona.uid } };
    }

    // Las incidencias sin resolver: [{ id, motivo, persona, horaCelular }].
    function incidenciasAbiertas(pedido) {
        const incidencias = esMapa(pedido && pedido.incidencias) ? pedido.incidencias : {};
        const resueltas = esMapa(pedido && pedido.incidenciasResueltas) ? pedido.incidenciasResueltas : {};

        return Object.keys(incidencias)
            .filter(id => esMapa(incidencias[id]) && !resueltas[id])
            .map(id => ({ id, ...incidencias[id] }));
    }

    // Devuelve el id de la incidencia nueva.
    function marcarIncidencia(idPedido, motivo) {
        const texto = textoDeIncidencia(motivo, "el motivo");
        const { ref, pedido, persona } = pedidoConEstadosYPersona(idPedido);
        const id = generarId("inc");

        enviarCambiosDelPedido(ref, [
            { ruta: ["incidencias", id], valor: { motivo: texto, persona, horaCelular: Date.now() } }
        ]);

        avisarAccionDePedido({ accion: "incidencia", pedido, motivo: texto, persona });
        return id;
    }

    // Resuelve todas las incidencias abiertas del pedido con la misma nota
    // (de a una escritura por incidencia, como piden las reglas). Devuelve
    // cuántas resolvió.
    function resolverIncidencias(idPedido, nota) {
        const texto = textoDeIncidencia(nota, "una nota");
        const { ref, pedido, persona } = pedidoConEstadosYPersona(idPedido);
        const abiertas = incidenciasAbiertas(pedido);
        const hora = Date.now();

        abiertas.forEach(incidencia => {
            enviarCambiosDelPedido(ref, [
                { ruta: ["incidenciasResueltas", incidencia.id], valor: { nota: texto, persona, horaCelular: hora } }
            ]);
        });

        if (abiertas.length) avisarAccionDePedido({ accion: "incidenciaResuelta", pedido, nota: texto, persona, incidencias: abiertas });
        return abiertas.length;
    }

    // -------------------------------------------------
    // Checklist de preparación y faltantes (T24)
    // -------------------------------------------------
    // Cada tilde o destilde es una entrada nueva del mapa "preparacion" del
    // pedido: { linea, tildado, persona, horaCelular }. Cada faltante (o su
    // corrección) es una entrada nueva de "faltantes": { linea, preparada,
    // observacion, persona, horaCelular }; preparada null quita el faltante.
    // Los dos solo se agregan, de a una entrada por escritura (campo por
    // campo): dos personas que arman el mismo pedido no se pisan, también sin
    // señal. Lo que vale de cada producto es su entrada más nueva según la
    // hora en que se hizo (como el estado), y siempre se ve quién la puso.
    // Lo pedido (cantidad de cada producto) no se toca: se conserva.
    //
    // Pasos más cortos (T29b): la checklist se usa desde "Cargado". El
    // primer tilde (o el primer faltante) pasa el pedido solo a "En
    // preparación", a nombre de quien tildó, en una escritura aparte (las
    // reglas revisan cada cosa por separado). Lo pasa solo quien tiene
    // "Prepara pedidos" (o "Controla pedidos", o el dueño): si no, el tilde
    // queda anotado y el pedido sigue "Cargado" hasta que tilde alguien con
    // ese permiso.

    const LARGO_MAXIMO_OBSERVACION_FALTANTE = 300;
    const ESTADOS_CON_CHECKLIST = ["cargado", "enPreparacion"];

    // Id de cada producto del pedido: el de su línea (T20) o, si no tiene,
    // su posición en el pedido.
    function claveDeLinea(item, posicion) {
        const id = String(item && item.id || "");
        return /^[A-Za-z0-9_]{1,100}$/.test(id) ? id : "pos_" + posicion;
    }

    // La entrada más nueva de una lista [{ id, ...entrada }] (si empatan, la
    // de id mayor, así da igual en todos los celulares).
    function entradaMasNueva(entradas) {
        let elegida = null;

        entradas.forEach(entrada => {
            const hora = Number(entrada.horaCelular) || 0;
            const horaElegida = elegida ? Number(elegida.horaCelular) || 0 : -Infinity;
            if (hora > horaElegida || (hora === horaElegida && entrada.id > elegida.id)) elegida = entrada;
        });

        return elegida;
    }

    function entradasPorLinea(mapa) {
        const porLinea = new Map();
        if (!esMapa(mapa)) return porLinea;

        Object.keys(mapa).forEach(id => {
            const entrada = mapa[id];
            if (!esMapa(entrada) || typeof entrada.linea !== "string") return;

            if (!porLinea.has(entrada.linea)) porLinea.set(entrada.linea, []);
            porLinea.get(entrada.linea).push({ id, ...entrada });
        });

        return porLinea;
    }

    // Cómo va la checklist de un pedido:
    // { lineas: [{ clave, item, cantidad, tilde, faltante, lista, preparada }],
    //   productos, listos, pendientes, faltantes, unidadesPedidas,
    //   unidadesPreparadas, completa }.
    // tilde: la entrada más nueva de ese producto (tildado o destildado), o
    // null. faltante: el faltante vigente, o null. Un producto está listo si
    // está tildado o tiene faltante; preparada es lo que se puso en el cajón.
    function preparacionDelPedido(pedido) {
        const tildes = entradasPorLinea(pedido && pedido.preparacion);
        const faltantes = entradasPorLinea(pedido && pedido.faltantes);
        const productos = Array.isArray(pedido && pedido.productos) ? pedido.productos : [];
        const lineas = [];

        productos.forEach((item, posicion) => {
            const cantidad = Number(item && item.cantidad) || 0;
            if (!esMapa(item) || cantidad <= 0) return;

            const clave = claveDeLinea(item, posicion);
            const tilde = entradaMasNueva(tildes.get(clave) || []);
            const ultimoFaltante = entradaMasNueva(faltantes.get(clave) || []);
            const preparadaFaltante = ultimoFaltante && ultimoFaltante.preparada !== null && ultimoFaltante.preparada !== undefined
                ? Number(ultimoFaltante.preparada)
                : NaN;
            const faltante = Number.isFinite(preparadaFaltante) ? { ...ultimoFaltante, preparada: preparadaFaltante } : null;
            const tildado = Boolean(tilde && tilde.tildado === true);
            const lista = Boolean(faltante) || tildado;

            lineas.push({
                clave,
                item,
                cantidad,
                tilde,
                faltante,
                lista,
                preparada: faltante ? faltante.preparada : tildado ? cantidad : null
            });
        });

        const listos = lineas.filter(linea => linea.lista).length;

        return {
            lineas,
            productos: lineas.length,
            listos,
            pendientes: lineas.length - listos,
            faltantes: lineas.filter(linea => linea.faltante).length,
            unidadesPedidas: lineas.reduce((total, linea) => total + linea.cantidad, 0),
            unidadesPreparadas: lineas.reduce((total, linea) => total + (linea.preparada || 0), 0),
            completa: listos === lineas.length
        };
    }

    // El pedido, quién usa el celular y el producto, solo mientras el pedido
    // está "Cargado" o "En preparación" (T29b).
    function lineaParaPreparar(idPedido, clave) {
        const datos = pedidoConEstadosYPersona(idPedido, "Un pedido Histórico no se prepara con la checklist.");

        if (!ESTADOS_CON_CHECKLIST.includes(estadoActualDelPedido(datos.pedido))) {
            throw errorDelPedido("El pedido ya no está en preparación.");
        }

        const linea = preparacionDelPedido(datos.pedido).lineas.find(item => item.clave === String(clave || ""));
        if (!linea) throw errorDelPedido("Ese producto ya no está en el pedido.");

        return { ...datos, linea };
    }

    // Hora de una entrada nueva: la del celular, pero siempre después de la
    // última de ese producto que se ve acá. Si otro celular tiene la hora
    // adelantada, lo que se toca ahora igual queda como lo más nuevo.
    function horaParaNuevaEntrada(anterior) {
        return Math.max(Date.now(), anterior ? (Number(anterior.horaCelular) || 0) + 1 : 0);
    }

    function ultimaEntradaDeLinea(mapa, clave) {
        return entradaMasNueva(entradasPorLinea(mapa).get(clave) || []);
    }

    function puedePreparar() {
        const empleados = window.empleadosVendeFrio;
        return Boolean(empleados && (empleados.puede("prepara") || empleados.puede("controla")));
    }

    // Pedidos que este celular ya pasó a "En preparación" y todavía no se
    // ven así (la nube confirma enseguida): evita dos entradas seguidas si
    // se tildan dos productos muy rápido.
    const preparacionEmpezada = new Map();
    const ESPERA_PREPARACION_EMPEZADA = 10000;

    // El primer tilde o faltante de un pedido "Cargado" lo pasa a "En
    // preparación" (T29b). La entrada queda como la más nueva del historial,
    // aunque otro celular tenga la hora adelantada. Devuelve true si lo pasó.
    function empezarPreparacionSiHaceFalta(ref, pedido, persona) {
        if (estadoActualDelPedido(pedido) !== "cargado" || !puedePreparar()) return false;

        const id = String(pedido.id || "");
        if (Date.now() - (preparacionEmpezada.get(id) || 0) < ESPERA_PREPARACION_EMPEZADA) return false;
        preparacionEmpezada.set(id, Date.now());

        const [idEntrada, entrada] = nuevaEntradaDeEstado("enPreparacion", "", persona, horaDespuesDeLaUltima(pedido));
        enviarCambiosDelPedido(ref, [
            { ruta: ["estados", idEntrada], valor: entrada },
            { ruta: ["estado"], valor: "enPreparacion" }
        ]);
        return true;
    }

    // Tilda o destilda un producto. Puede cualquiera. Devuelve el id de la
    // entrada nueva.
    function tildarProducto(idPedido, clave, tildado) {
        const { ref, pedido, persona, linea } = lineaParaPreparar(idPedido, clave);
        const id = generarId("prep");
        const entrada = {
            linea: linea.clave,
            tildado: Boolean(tildado),
            persona,
            horaCelular: horaParaNuevaEntrada(ultimaEntradaDeLinea(pedido.preparacion, linea.clave))
        };

        enviarCambiosDelPedido(ref, [{ ruta: ["preparacion", id], valor: entrada }]);
        if (entrada.tildado) empezarPreparacionSiHaceFalta(ref, pedido, persona);
        return id;
    }

    // Anota (o corrige) un faltante: cuánto se preparó (menos de lo pedido) y
    // por qué. Solo "Prepara pedidos" (las reglas lo revisan). Avisa a quien
    // cargó el pedido y a "Recibe aviso de faltantes".
    function marcarFaltante(idPedido, clave, preparada, observacion) {
        const texto = String(observacion || "").trim().slice(0, LARGO_MAXIMO_OBSERVACION_FALTANTE);
        if (!texto) throw errorDelPedido("Escribí una observación.");

        const cantidad = Number(preparada);
        const { ref, pedido, persona, linea } = lineaParaPreparar(idPedido, clave);

        if (!Number.isInteger(cantidad) || cantidad < 0 || cantidad >= linea.cantidad) {
            throw errorDelPedido("La cantidad preparada tiene que ser de 0 a " + (linea.cantidad - 1) + ".");
        }

        const id = generarId("fal");
        const entrada = {
            linea: linea.clave,
            preparada: cantidad,
            observacion: texto,
            persona,
            horaCelular: horaParaNuevaEntrada(ultimaEntradaDeLinea(pedido.faltantes, linea.clave))
        };

        enviarCambiosDelPedido(ref, [{ ruta: ["faltantes", id], valor: entrada }]);
        empezarPreparacionSiHaceFalta(ref, pedido, persona);

        avisarAccionDePedido({
            accion: "faltante",
            pedido,
            producto: String(linea.item.producto || "").trim(),
            pedida: linea.cantidad,
            preparada: cantidad,
            observacion: texto,
            persona
        });
        return id;
    }

    // Quita el faltante de un producto (por ejemplo, apareció lo que
    // faltaba). Vuelve a valer su tilde. Devuelve false si no tenía.
    function quitarFaltante(idPedido, clave) {
        const { ref, pedido, persona, linea } = lineaParaPreparar(idPedido, clave);
        if (!linea.faltante) return false;

        enviarCambiosDelPedido(ref, [{
            ruta: ["faltantes", generarId("fal")],
            valor: {
                linea: linea.clave,
                preparada: null,
                observacion: "",
                persona,
                horaCelular: horaParaNuevaEntrada(ultimaEntradaDeLinea(pedido.faltantes, linea.clave))
            }
        }]);
        return true;
    }

    function textoUnidades(cantidad) {
        return cantidad === 1 ? "1 unidad" : cantidad + " unidades";
    }

    // "12 productos · 32 unidades · 1 faltante" (y lo pedido, si cambia).
    function textoResumenDePreparacion(resumen) {
        const partes = [
            resumen.productos === 1 ? "1 producto" : resumen.productos + " productos",
            resumen.unidadesPreparadas === resumen.unidadesPedidas
                ? textoUnidades(resumen.unidadesPreparadas)
                : resumen.unidadesPreparadas + " de " + textoUnidades(resumen.unidadesPedidas)
        ];

        if (resumen.faltantes) partes.push(resumen.faltantes === 1 ? "1 faltante" : resumen.faltantes + " faltantes");
        return partes.join(" · ");
    }

    // "Preparado": solo con todos los productos tildados o con faltante. El
    // resumen queda como nota en el seguimiento. Avisa a "Reparte" y a quien
    // cargó el pedido.
    function marcarPreparado(idPedido) {
        const { pedido, persona } = pedidoConEstadosYPersona(idPedido, "Un pedido Histórico no se prepara con la checklist.");

        if (estadoActualDelPedido(pedido) !== "enPreparacion") throw errorDelPedido("El pedido ya no está en preparación.");

        const resumen = preparacionDelPedido(pedido);
        if (!resumen.completa) {
            throw errorDelPedido(resumen.pendientes === 1
                ? "Falta 1 producto: tildalo o marcalo como faltante."
                : "Faltan " + resumen.pendientes + " productos: tildalos o marcalos como faltante.");
        }

        const texto = textoResumenDePreparacion(resumen);
        const idEntrada = agregarEstadoAlPedido(idPedido, "preparado", texto);

        avisarAccionDePedido({ accion: "preparado", pedido, resumen: texto, persona });
        return idEntrada;
    }

    // -------------------------------------------------
    // Editar el pedido (T25)
    // -------------------------------------------------
    // Solo quien cargó el pedido y el dueño lo editan, en cualquier estado
    // menos "Cancelado". Lo pedido (productos, comercio, observaciones, texto
    // para WhatsApp y unidades) cambia en una sola escritura campo por campo,
    // junto con una entrada nueva de "ediciones": { texto, revisar, estado,
    // persona, horaCelular }. La checklist no se toca: los tildes van por id
    // de línea, así que los productos que no cambiaron los conservan; un
    // producto nuevo o con otra cantidad lleva un id de línea nuevo y vuelve
    // a quedar sin tildar ("revisar" lo marca). Cada persona cierra la franja
    // amarilla de las ediciones de otro con "Entendido": una entrada nueva de
    // "edicionesVistas" { edicion, persona, horaCelular }. Las dos solo se
    // agregan.

    const LARGO_MAXIMO_TEXTO_EDICION = 1000;
    const MAXIMO_PRODUCTOS_A_REVISAR = 200;
    const CAMPOS_DE_LO_PEDIDO = ["productos", "comercio", "observaciones", "pedido", "cantidad"];

    function esAutorODueno(pedido, persona) {
        return Boolean(persona) && (persona.idPersona === "dueno" ||
            Boolean(pedido && pedido.autor && pedido.autor.idPersona === persona.idPersona));
    }

    // Si la persona de este celular puede editar el pedido.
    function puedeEditarElPedido(pedido) {
        return pedidoTieneEstados(pedido) &&
            estadoActualDelPedido(pedido) !== "cancelado" &&
            esAutorODueno(pedido, personaDeEsteCelular());
    }

    // datos: { productos, comercio, observaciones, pedido, cantidad, texto,
    // revisar }. "texto" es lo que cambió ("Agregó 2 Coca 2L · Quitó
    // Sprite") y "revisar", { idLinea: "Nuevo" o "Antes x3" }. Avisa a quien
    // corresponde según el estado. Devuelve el id de la edición.
    function editarPedido(idPedido, datos) {
        const { ref, pedido, persona } = pedidoConEstadosYPersona(idPedido, "Un pedido Histórico no se edita.");
        const estado = estadoActualDelPedido(pedido);

        if (estado === "cancelado") throw errorDelPedido("Un pedido cancelado no se edita.");
        if (!esAutorODueno(pedido, persona)) throw errorDelPedido("Solo quien cargó el pedido o el dueño lo edita.");

        const productos = (Array.isArray(datos && datos.productos) ? datos.productos : [])
            .filter(item => esMapa(item) && (Number(item.cantidad) || 0) > 0);
        if (!productos.length) throw errorDelPedido("Dejá al menos un producto en el pedido.");

        const comercio = String(datos.comercio || "").trim();
        if (!comercio) throw errorDelPedido("Escribí el comercio.");

        const texto = String(datos.texto || "").trim().slice(0, LARGO_MAXIMO_TEXTO_EDICION);
        if (!texto) throw errorDelPedido("No cambiaste nada.");

        const revisar = {};
        Object.keys(esMapa(datos.revisar) ? datos.revisar : {})
            .filter(linea => /^[A-Za-z0-9_]{1,100}$/.test(linea))
            .slice(0, MAXIMO_PRODUCTOS_A_REVISAR)
            .forEach(linea => {
                revisar[linea] = String(datos.revisar[linea] || "").slice(0, 40);
            });

        const nuevo = JSON.parse(JSON.stringify({
            productos,
            comercio,
            observaciones: String(datos.observaciones || "").trim(),
            pedido: String(datos.pedido || ""),
            cantidad: Number(datos.cantidad) || 0
        }));
        if (tieneListasAnidadas(nuevo, false)) throw errorDelPedido("La nube no admite listas dentro de listas.");

        const campos = CAMPOS_DE_LO_PEDIDO
            .filter(campo => textoComparable(pedido[campo]) !== textoComparable(nuevo[campo]))
            .map(campo => ({ ruta: [campo], valor: nuevo[campo] }));
        if (!campos.length) throw errorDelPedido("No cambiaste nada.");

        const id = generarId("ed");
        campos.push({ ruta: ["ediciones", id], valor: { texto, revisar, estado, persona, horaCelular: Date.now() } });
        enviarCambiosDelPedido(ref, campos);

        avisarAccionDePedido({ accion: "pedidoEditado", pedido: { ...pedido, comercio }, estado, texto, persona });
        return id;
    }

    // Quién vio cada edición: idEdicion -> [persona].
    function quienesVieronLasEdiciones(pedido) {
        const vistas = esMapa(pedido && pedido.edicionesVistas) ? pedido.edicionesVistas : {};
        const resultado = new Map();

        Object.keys(vistas).forEach(id => {
            const vista = vistas[id];
            if (!esMapa(vista) || typeof vista.edicion !== "string" || !esMapa(vista.persona)) return;

            const lista = resultado.get(vista.edicion) || [];
            if (!lista.some(persona => persona.idPersona === vista.persona.idPersona)) lista.push(vista.persona);
            resultado.set(vista.edicion, lista);
        });

        return resultado;
    }

    // Las ediciones de otro que esta persona todavía no cerró con
    // "Entendido", la más nueva primero: [{ id, texto, revisar, estado,
    // persona, horaCelular }].
    function edicionesSinVer(pedido) {
        const persona = personaDeEsteCelular();
        const ediciones = esMapa(pedido && pedido.ediciones) ? pedido.ediciones : {};
        if (!persona) return [];

        const vistas = quienesVieronLasEdiciones(pedido);

        return Object.keys(ediciones)
            .filter(id => esMapa(ediciones[id]))
            .filter(id => !(ediciones[id].persona && ediciones[id].persona.idPersona === persona.idPersona))
            .filter(id => !(vistas.get(id) || []).some(vio => vio.idPersona === persona.idPersona))
            .map(id => ({ id, ...ediciones[id] }))
            .sort((a, b) => {
                const diferencia = (Number(b.horaCelular) || 0) - (Number(a.horaCelular) || 0);
                if (diferencia !== 0) return diferencia;
                return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
            });
    }

    // "Entendido": cierra para esta persona las ediciones sin ver (de a una
    // escritura por edición, como piden las reglas). Devuelve cuántas.
    function marcarEdicionesVistas(idPedido) {
        const { ref, pedido, persona } = pedidoConEstadosYPersona(idPedido);
        const sinVer = edicionesSinVer(pedido);
        const hora = Date.now();

        sinVer.forEach(edicion => {
            enviarCambiosDelPedido(ref, [{
                ruta: ["edicionesVistas", generarId("vis")],
                valor: { edicion: edicion.id, persona, horaCelular: hora }
            }]);
        });

        return sinVer.length;
    }

    // -------------------------------------------------
    // Eliminar y cancelar (T26)
    // -------------------------------------------------
    // Solo quien cargó el pedido y el dueño. Un pedido nunca se borra de la
    // nube:
    // - Eliminar es para errores (un pedido cargado dos veces), solo
    //   mientras está "Cargado": queda guardado por dentro con eliminado:
    //   true y "eliminacion": { persona, horaCelular }, y desaparece de la
    //   app. Un "Histórico" no tiene autor: solo lo elimina el dueño.
    // - Cancelar es para cuando el comercio ya no lo quiere, en cualquier
    //   estado antes de "Entregado", con motivo: una entrada nueva
    //   "Cancelado" del historial de estados (el motivo es su nota). Queda a
    //   la vista en "Cancelados" y avisa a quien ya trabajaba en el pedido.
    // Las reglas revisan "Cargado" y "Entregado" con la copia del estado
    // (campo "estado"): acá se piden las dos cosas, la copia y el estado
    // según el historial, para no mandar algo que la nube va a rechazar.

    const LARGO_MAXIMO_MOTIVO_CANCELACION = 300;

    // -------------------------------------------------
    // "Ticket impreso por" (T28d)
    // -------------------------------------------------
    // Cada impresión queda en el mapa "impresiones" del pedido: { copias,
    // persona, horaCelular }. Solo se agrega, a nombre propio, de a una.

    function anotarImpresion(idPedido, copias) {
        const { ref, persona } = pedidoConEstadosYPersona(idPedido, "Un pedido Histórico no se imprime.");
        const idImpresion = generarId("imp");

        enviarCambiosDelPedido(ref, [{
            ruta: ["impresiones", idImpresion],
            valor: { copias: copias === 1 ? 1 : 2, persona, horaCelular: Date.now() }
        }]);

        return idImpresion;
    }

    // Las impresiones del pedido, la más nueva primero: [{ id, copias,
    // persona, horaCelular }].
    function impresionesDelPedido(pedido) {
        const impresiones = esMapa(pedido && pedido.impresiones) ? pedido.impresiones : {};

        return Object.keys(impresiones)
            .filter(id => esMapa(impresiones[id]))
            .map(id => ({ id, ...impresiones[id] }))
            .sort((a, b) => (Number(b.horaCelular) || 0) - (Number(a.horaCelular) || 0) || (a.id < b.id ? 1 : -1));
    }

    function esPedidoEliminado(pedido) {
        return Boolean(pedido) && pedido.eliminado === true;
    }

    // Si la persona de este celular puede eliminar el pedido.
    function puedeEliminarElPedido(pedido) {
        if (!pedido || esPedidoEliminado(pedido)) return false;

        const persona = personaDeEsteCelular();
        if (!persona) return false;

        if (!pedidoTieneEstados(pedido)) return persona.idPersona === "dueno";

        return estadoActualDelPedido(pedido) === "cargado" &&
            pedido.estado === "cargado" &&
            esAutorODueno(pedido, persona);
    }

    // Si la persona de este celular puede cancelar el pedido.
    function puedeCancelarElPedido(pedido) {
        if (!pedidoTieneEstados(pedido) || esPedidoEliminado(pedido)) return false;

        const estado = estadoActualDelPedido(pedido);
        return estado !== "entregado" && estado !== "cancelado" &&
            pedido.estado !== "entregado" &&
            esAutorODueno(pedido, personaDeEsteCelular());
    }

    // Marca el pedido como eliminado (una sola escritura, campo por campo).
    // Devuelve true.
    function eliminarPedido(idPedido) {
        const { ref, pedido } = pedidoEnLaNube(idPedido);
        const persona = personaDeEsteCelular();

        if (!persona) {
            throw errorDelPedido("La app todavía está reconociendo quién usa este celular. Probá de nuevo en unos segundos.");
        }
        if (esPedidoEliminado(pedido)) throw errorDelPedido("Ese pedido ya estaba eliminado.");

        if (!pedidoTieneEstados(pedido)) {
            if (persona.idPersona !== "dueno") throw errorDelPedido("Un pedido Histórico solo lo elimina el dueño.");
        } else {
            if (!esAutorODueno(pedido, persona)) throw errorDelPedido("Solo quien cargó el pedido o el dueño lo elimina.");
            if (estadoActualDelPedido(pedido) !== "cargado" || pedido.estado !== "cargado") {
                throw errorDelPedido("Solo se elimina un pedido «Cargado». Si el comercio ya no lo quiere, cancelalo.");
            }
        }

        enviarCambiosDelPedido(ref, [
            { ruta: ["eliminado"], valor: true },
            {
                ruta: ["eliminacion"],
                valor: {
                    persona: { idPersona: persona.idPersona, nombre: persona.nombre, uid: persona.uid },
                    horaCelular: Date.now()
                }
            }
        ]);

        return true;
    }

    // Cancela el pedido con un motivo (obligatorio). La entrada nueva queda
    // siempre como la más nueva del historial, aunque otro celular tenga la
    // hora adelantada. Avisa a quien ya trabajaba en el pedido. Devuelve el
    // id de la entrada.
    function cancelarPedido(idPedido, motivo) {
        const texto = String(motivo || "").trim().slice(0, LARGO_MAXIMO_MOTIVO_CANCELACION);
        if (!texto) throw errorDelPedido("Escribí el motivo.");

        const { ref, pedido, persona } = pedidoConEstadosYPersona(idPedido, "Un pedido Histórico no se cancela.");
        const estado = estadoActualDelPedido(pedido);

        if (esPedidoEliminado(pedido)) throw errorDelPedido("Ese pedido fue eliminado.");
        if (!esAutorODueno(pedido, persona)) throw errorDelPedido("Solo quien cargó el pedido o el dueño lo cancela.");
        if (estado === "cancelado") throw errorDelPedido("El pedido ya estaba cancelado.");
        if (estado === "entregado" || pedido.estado === "entregado") throw errorDelPedido("Un pedido entregado no se cancela.");

        const ultima = Object.values(pedido.estados || {})
            .reduce((maxima, entrada) => Math.max(maxima, Number(entrada && entrada.horaCelular) || 0), 0);
        const [idEntrada, entrada] = nuevaEntradaDeEstado("cancelado", texto, persona, Math.max(Date.now(), ultima + 1));

        enviarCambiosDelPedido(ref, [
            { ruta: ["estados", idEntrada], valor: entrada },
            { ruta: ["estado"], valor: "cancelado" }
        ]);

        avisarAccionDePedido({ accion: "pedidoCancelado", pedido, estado, motivo: texto, persona });
        return idEntrada;
    }

    // -------------------------------------------------
    // Entrega (T27)
    // -------------------------------------------------
    // "Entregado" lo marca cualquiera, deslizando, desde cualquier paso
    // anterior: Cargado, En preparación, Preparado o En reparto (T29b). Es una entrada nueva del historial de
    // estados y, en la misma escritura, el campo "entrega": { cambios,
    // persona, horaCelular }. Por defecto se entrega todo lo preparado: lo
    // pedido o, si el producto tuvo faltante, lo que se preparó. "Entregar con
    // cambios" anota en "cambios" lo entregado de cada producto que cambia,
    // con motivo: { idLinea: { entregada, motivo } }. Lo pedido y lo
    // preparado se conservan. El total a cobrar sale de lo entregado.
    // Si se entregó por error, cualquiera lo vuelve un paso atrás (al estado
    // que tenía antes de la entrega), con motivo; al entregarlo de nuevo,
    // "entrega" se reemplaza. Las reglas revisan "Cancelado" y "Entregado"
    // con la copia del estado, como al cancelar (T26). El cobro queda
    // "Pendiente" hasta T28.

    const ESTADOS_QUE_SE_ENTREGAN = ["cargado", "enPreparacion", "preparado", "enVehiculo", "enReparto"];
    const LARGO_MAXIMO_MOTIVO_ENTREGA = 300;
    const MAXIMO_CAMBIOS_DE_ENTREGA = 200;

    function textoPrecioEntrega(valor) {
        return "$ " + Number(valor || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
    }

    // Hora para una entrada que tiene que quedar como el estado actual: la
    // del celular, pero siempre después de la última del historial (aunque
    // otro celular tenga la hora adelantada).
    function horaDespuesDeLaUltima(pedido) {
        const ultima = Object.values(pedido.estados || {})
            .reduce((maxima, entrada) => Math.max(maxima, Number(entrada && entrada.horaCelular) || 0), 0);
        return Math.max(Date.now(), ultima + 1);
    }

    // Cómo queda (o quedó) la entrega de un pedido:
    // { lineas: [{ clave, item, pedida, preparada, entregada, motivo, cambio }],
    //   unidadesPedidas, unidadesPreparadas, unidadesEntregadas, cambios,
    //   total: { total, conPrecio, sinPrecio }, persona, horaCelular }.
    // Solo un pedido "Entregado" usa los cambios guardados; antes de
    // entregarlo, todo va por defecto (lo preparado), salvo los cambios que
    // se pasan (los de una entrega que se está por hacer).
    function entregaDelPedido(pedido, cambiosPorHacer) {
        const entregado = estadoActualDelPedido(pedido) === "entregado";
        const entrega = entregado && esMapa(pedido && pedido.entrega) ? pedido.entrega : {};
        const cambios = esMapa(cambiosPorHacer) ? cambiosPorHacer : esMapa(entrega.cambios) ? entrega.cambios : {};
        const total = { total: 0, conPrecio: 0, sinPrecio: 0 };

        const lineas = preparacionDelPedido(pedido).lineas.map(linea => {
            const preparada = linea.faltante ? linea.faltante.preparada : linea.cantidad;
            const anotado = esMapa(cambios[linea.clave]) ? cambios[linea.clave] : null;
            const numero = anotado ? Number(anotado.entregada) : NaN;
            const entregada = Number.isInteger(numero) && numero >= 0 ? numero : preparada;
            const cambio = entregada !== preparada;
            const precio = linea.item.precio === null || linea.item.precio === undefined ? NaN : Number(linea.item.precio);

            if (Number.isFinite(precio)) {
                total.total += precio * entregada;
                total.conPrecio += 1;
            } else {
                total.sinPrecio += 1;
            }

            return {
                clave: linea.clave,
                item: linea.item,
                pedida: linea.cantidad,
                preparada,
                entregada,
                motivo: cambio && anotado ? String(anotado.motivo || "") : "",
                cambio
            };
        });

        return {
            lineas,
            unidadesPedidas: lineas.reduce((suma, linea) => suma + linea.pedida, 0),
            unidadesPreparadas: lineas.reduce((suma, linea) => suma + linea.preparada, 0),
            unidadesEntregadas: lineas.reduce((suma, linea) => suma + linea.entregada, 0),
            cambios: lineas.filter(linea => linea.cambio).length,
            total,
            persona: esMapa(entrega.persona) ? entrega.persona : null,
            horaCelular: Number(entrega.horaCelular) || 0
        };
    }

    // Si la persona de este celular puede entregar el pedido (cualquiera).
    function puedeEntregarElPedido(pedido) {
        if (!pedidoTieneEstados(pedido) || esPedidoEliminado(pedido)) return false;

        return ESTADOS_QUE_SE_ENTREGAN.includes(estadoActualDelPedido(pedido)) &&
            pedido.estado !== "cancelado" &&
            Boolean(personaDeEsteCelular());
    }

    // "Coca 2L: 8 de 10 (rechazó 2) · Sprite: 0 de 3 (cerrado)".
    function textoCambiosDeEntrega(lineas) {
        return lineas
            .filter(linea => linea.cambio)
            .map(linea => String(linea.item.producto || "Sin producto").trim() + ": " + linea.entregada + " de " +
                linea.preparada + (linea.motivo ? " (" + linea.motivo + ")" : ""))
            .join(" · ");
    }

    // "15 unidades · $ 12.500" (y lo que cambió, si cambió algo).
    function textoResumenDeEntrega(resumen) {
        const { total, conPrecio, sinPrecio } = resumen.total;
        let precio = "Sin precio";
        if (conPrecio && sinPrecio) precio = textoPrecioEntrega(total) + " (" + sinPrecio + " sin precio)";
        else if (conPrecio) precio = textoPrecioEntrega(total);

        const partes = [textoUnidades(resumen.unidadesEntregadas), precio];
        if (resumen.cambios) partes.push("Con cambios: " + textoCambiosDeEntrega(resumen.lineas));
        return partes.join(" · ");
    }

    // Marca el pedido como entregado. cambios: { idLinea: { entregada, motivo } }
    // solo de los productos que se entregan distinto de lo preparado (vacío
    // para entregar todo). Avisa a quien cargó el pedido. Devuelve el id de
    // la entrada.
    function entregarPedido(idPedido, cambiosPedidos) {
        const { ref, pedido, persona } = pedidoConEstadosYPersona(idPedido, "Un pedido Histórico no se entrega.");
        const estado = estadoActualDelPedido(pedido);

        if (esPedidoEliminado(pedido)) throw errorDelPedido("Ese pedido fue eliminado.");
        if (estado === "entregado") throw errorDelPedido("El pedido ya estaba entregado.");
        if (estado === "cancelado" || pedido.estado === "cancelado") throw errorDelPedido("Un pedido cancelado no se entrega.");
        if (!ESTADOS_QUE_SE_ENTREGAN.includes(estado)) throw errorDelPedido("Ese pedido no se puede entregar.");

        const porDefecto = entregaDelPedido(pedido);
        const pedidos = esMapa(cambiosPedidos) ? cambiosPedidos : {};
        const cambios = {};

        Object.keys(pedidos).forEach(clave => {
            const linea = porDefecto.lineas.find(item => item.clave === clave);
            if (!linea) throw errorDelPedido("Un producto ya no está en el pedido. Revisá la entrega.");

            const nombre = String(linea.item.producto || "un producto").trim();
            const entregada = Number(pedidos[clave] && pedidos[clave].entregada);
            if (!Number.isInteger(entregada) || entregada < 0 || entregada > linea.pedida) {
                throw errorDelPedido("Lo entregado de " + nombre + " tiene que ser de 0 a " + linea.pedida + ".");
            }
            if (entregada === linea.preparada) return;

            const motivo = String(pedidos[clave].motivo || "").trim().slice(0, LARGO_MAXIMO_MOTIVO_ENTREGA);
            if (!motivo) throw errorDelPedido("Escribí por qué cambia lo entregado de " + nombre + ".");

            cambios[clave] = { entregada, motivo };
        });

        if (Object.keys(cambios).length > MAXIMO_CAMBIOS_DE_ENTREGA) {
            throw errorDelPedido("Son demasiados cambios para una sola entrega.");
        }

        const resumen = entregaDelPedido(pedido, cambios);
        const hora = horaDespuesDeLaUltima(pedido);
        const [idEntrada, entrada] = nuevaEntradaDeEstado(
            "entregado",
            resumen.cambios ? "Con cambios: " + textoCambiosDeEntrega(resumen.lineas) : "",
            persona,
            hora
        );

        enviarCambiosDelPedido(ref, [
            { ruta: ["estados", idEntrada], valor: entrada },
            { ruta: ["estado"], valor: "entregado" },
            { ruta: ["entrega"], valor: { cambios, persona, horaCelular: hora } }
        ]);

        // Cobro (T28): si quien entrega tiene "Cobra", la app le pregunta
        // "¿Cómo pagó?" y, si queda pendiente, avisa a "Cobra" después
        // (avisarCobroPendiente). Si no lo tiene, el cobro queda pendiente y
        // el aviso le llega también a "Cobra".
        avisarAccionDePedido({
            accion: "entregado",
            pedido,
            resumen: textoResumenDeEntrega(resumen),
            persona,
            cobroPendiente: !puedeCobrar()
        });
        return idEntrada;
    }

    // El estado que tenía el pedido antes de entregarlo (al que vuelve si se
    // entregó por error), o "" si no está entregado.
    function estadoAntesDeLaEntrega(pedido) {
        if (estadoActualDelPedido(pedido) !== "entregado") return "";

        const entradas = Object.keys(pedido.estados || {})
            .filter(id => esMapa(pedido.estados[id]))
            .map(id => ({ id, ...pedido.estados[id] }))
            .sort((a, b) => {
                const diferencia = (Number(b.horaCelular) || 0) - (Number(a.horaCelular) || 0);
                if (diferencia !== 0) return diferencia;
                return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
            });

        const anterior = entradas.find(entrada => ESTADOS_QUE_SE_ENTREGAN.includes(entrada.estado));
        // "Cargado en el vehículo" ya no existe (T29b): vuelve a "En reparto".
        return anterior && anterior.estado !== "enVehiculo" ? anterior.estado : "enReparto";
    }

    // Volver atrás desde "En reparto" (T29b): al paso que tenía antes de
    // salir a repartir (Cargado, En preparación o Preparado). Un pedido que
    // pasó por "Cargado en el vehículo" vuelve a "Preparado", como antes.
    function estadoAntesDelReparto(pedido) {
        if (estadoActualDelPedido(pedido) !== "enReparto") return "";

        const entradas = Object.keys(pedido.estados || {})
            .filter(id => esMapa(pedido.estados[id]))
            .map(id => ({ id, ...pedido.estados[id] }))
            .sort((a, b) => {
                const diferencia = (Number(b.horaCelular) || 0) - (Number(a.horaCelular) || 0);
                if (diferencia !== 0) return diferencia;
                return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
            });

        const anterior = entradas.find(entrada => ["cargado", "enPreparacion", "preparado"].includes(entrada.estado));
        return anterior ? anterior.estado : "preparado";
    }

    // Si la persona de este celular puede volver atrás un pedido entregado
    // (cualquiera, como al entregarlo). Con el cobro registrado, no (T28).
    function puedeVolverDeEntregado(pedido) {
        if (!pedidoTieneEstados(pedido) || esPedidoEliminado(pedido)) return false;

        return estadoActualDelPedido(pedido) === "entregado" &&
            pedido.estado === "entregado" &&
            !cobroDelPedido(pedido) &&
            Boolean(personaDeEsteCelular());
    }

    // Vuelve un pedido entregado (por error) al estado que tenía antes, con
    // motivo (obligatorio). Vuelve a "Pedidos" y sale de Historial. Devuelve
    // el estado al que volvió.
    function volverDeEntregado(idPedido, motivo) {
        const texto = String(motivo || "").trim().slice(0, LARGO_MAXIMO_MOTIVO_ENTREGA);
        if (!texto) throw errorDelPedido("Escribí el motivo.");

        const { ref, pedido, persona } = pedidoConEstadosYPersona(idPedido, "Un pedido Histórico no cambia de estado.");

        if (esPedidoEliminado(pedido)) throw errorDelPedido("Ese pedido fue eliminado.");
        if (estadoActualDelPedido(pedido) !== "entregado" || pedido.estado !== "entregado") {
            throw errorDelPedido("El pedido ya no está entregado.");
        }
        if (cobroDelPedido(pedido)) throw errorDelPedido("El pedido tiene el cobro registrado: ya no vuelve atrás.");

        const hacia = estadoAntesDeLaEntrega(pedido);
        const [idEntrada, entrada] = nuevaEntradaDeEstado(hacia, texto, persona, horaDespuesDeLaUltima(pedido));

        enviarCambiosDelPedido(ref, [
            { ruta: ["estados", idEntrada], valor: entrada },
            { ruta: ["estado"], valor: hacia }
        ]);

        return hacia;
    }

    // -------------------------------------------------
    // Cobro (T28)
    // -------------------------------------------------
    // Entregar y cobrar son cosas distintas (opción A, T17). El cobro es un
    // campo aparte del pedido entregado: "cobro": { forma, monto,
    // comprobante, persona, horaCelular }, con forma "efectivo" o
    // "transferencia". Sin cobro (o con cobro null) está "Pendiente" y
    // aparece en "A cobrar". Solo quien tiene "Cobra" (y el dueño) lo
    // registra o lo corrige; "Todavía no pagó" lo deja (o lo vuelve a dejar)
    // pendiente. El monto viene escrito con el total a cobrar y se puede
    // corregir. La foto del comprobante de una transferencia es opcional, se
    // comprime en el celular y va en su propio documento
    // (comprobantes/{id}: { idPedido, foto, persona, horaCelular }), así la
    // lista de pedidos no descarga fotos. Un pedido con el cobro registrado
    // ya no vuelve atrás de "Entregado".

    const FORMAS_DE_COBRO = [
        { id: "efectivo", nombre: "Efectivo" },
        { id: "transferencia", nombre: "Transferencia" }
    ];
    const MONTO_MAXIMO_COBRO = 1000000000;
    // Las reglas aceptan hasta 700.000 letras (Firestore guarda hasta 1 MB
    // por documento).
    const LARGO_MAXIMO_FOTO = 700000;

    // Fotos mandadas que la nube todavía no confirmó: cuentan como cambios
    // sin subir (T12), así "Salir" no deja salir sin subirlas.
    const comprobantesSinSubir = new Set();
    // Fotos ya leídas: id -> { foto, persona, horaCelular }.
    const comprobantesLeidos = new Map();

    function nombreDeFormaDeCobro(forma) {
        const encontrada = FORMAS_DE_COBRO.find(item => item.id === forma);
        return encontrada ? encontrada.nombre : "";
    }

    // El cobro registrado de un pedido entregado, o null si está pendiente.
    function cobroDelPedido(pedido) {
        if (!pedido || estadoActualDelPedido(pedido) !== "entregado") return null;

        const cobro = esMapa(pedido.cobro) ? pedido.cobro : null;
        if (!cobro || !nombreDeFormaDeCobro(cobro.forma)) return null;

        const monto = Number(cobro.monto);
        return {
            forma: cobro.forma,
            monto: Number.isFinite(monto) ? monto : 0,
            comprobante: typeof cobro.comprobante === "string" && cobro.comprobante ? cobro.comprobante : null,
            persona: esMapa(cobro.persona) ? cobro.persona : null,
            horaCelular: Number(cobro.horaCelular) || 0
        };
    }

    // Entregado, con estados y sin cobro registrado: va a "A cobrar".
    function cobroPendiente(pedido) {
        return pedidoTieneEstados(pedido) &&
            !esPedidoEliminado(pedido) &&
            estadoActualDelPedido(pedido) === "entregado" &&
            !cobroDelPedido(pedido);
    }

    // "Cobra" (el dueño también puede todo). "Controla pedidos" no alcanza:
    // el cobro lo registra solo quien cobra (T17).
    function puedeCobrar() {
        return Boolean(window.empleadosVendeFrio?.puede?.("cobra"));
    }

    function puedeRegistrarElCobro(pedido) {
        if (!pedidoTieneEstados(pedido) || esPedidoEliminado(pedido)) return false;

        return estadoActualDelPedido(pedido) === "entregado" &&
            pedido.estado === "entregado" &&
            puedeCobrar() &&
            Boolean(personaDeEsteCelular());
    }

    // El total a cobrar de lo entregado (el monto que viene escrito).
    function montoACobrar(pedido) {
        const entrega = entregaDelPedido(pedido);
        return Math.round(entrega.total.total * 100) / 100;
    }

    // "Efectivo · $ 12.500".
    function textoDelCobro(cobro) {
        if (!cobro) return "Pendiente";
        return nombreDeFormaDeCobro(cobro.forma) + " · " + textoPrecioEntrega(cobro.monto);
    }

    // Registra (o corrige) el cobro de un pedido entregado.
    // datos: { forma: "efectivo" | "transferencia" | "pendiente", monto, foto }.
    // foto es opcional, solo en transferencia: una imagen JPEG ya
    // comprimida ("data:image/jpeg;base64,..."). "pendiente" deja el pedido
    // en "A cobrar". Devuelve el cobro guardado (o null si quedó pendiente).
    function registrarCobro(idPedido, datos) {
        const { ref, pedido, persona } = pedidoConEstadosYPersona(idPedido, "Un pedido Histórico no tiene cobro.");

        if (esPedidoEliminado(pedido)) throw errorDelPedido("Ese pedido fue eliminado.");
        if (estadoActualDelPedido(pedido) !== "entregado" || pedido.estado !== "entregado") {
            throw errorDelPedido("El cobro se registra cuando el pedido está entregado.");
        }
        if (!puedeCobrar()) throw errorDelPedido("El cobro lo registra quien tiene el permiso «Cobra».");

        const forma = String(datos && datos.forma || "");

        if (forma === "pendiente") {
            // Ya estaba pendiente: no hay nada que guardar.
            if (!cobroDelPedido(pedido) && !esMapa(pedido.cobro)) return null;
            enviarCambiosDelPedido(ref, [{ ruta: ["cobro"], valor: null }]);
            return null;
        }

        if (!nombreDeFormaDeCobro(forma)) throw errorDelPedido("Elegí cómo pagó.");

        const texto = String(datos && datos.monto !== undefined && datos.monto !== null ? datos.monto : "").trim();
        const monto = Math.round(Number(texto.replace(",", ".")) * 100) / 100;
        if (!texto || !Number.isFinite(monto) || monto < 0 || monto > MONTO_MAXIMO_COBRO) {
            throw errorDelPedido("Escribí el monto que pagó (un número desde 0).");
        }

        const foto = forma === "transferencia" && typeof (datos && datos.foto) === "string" ? datos.foto : "";
        if (foto && (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(foto) || foto.length > LARGO_MAXIMO_FOTO)) {
            throw errorDelPedido("La foto del comprobante es demasiado grande. Probá con otra.");
        }

        // Al corregir una transferencia sin foto nueva, se conserva la de antes.
        const anterior = cobroDelPedido(pedido);
        let comprobante = forma === "transferencia" && anterior && anterior.forma === "transferencia"
            ? anterior.comprobante
            : null;
        if (datos && datos.quitarFoto) comprobante = null;

        const hora = Date.now();

        // La foto va primero, en su propio documento: si la nube la rechaza,
        // también rechaza el cobro que la nombra (las reglas revisan que
        // exista). Sin señal quedan las dos en el celular y suben en orden.
        if (foto) {
            comprobante = generarId("comp");
            const refComprobante = refDistribuidora.collection("comprobantes").doc(comprobante);
            const registro = { idPedido: String(pedido.id), foto, persona, horaCelular: hora };

            comprobantesLeidos.set(comprobante, registro);
            comprobantesSinSubir.add(comprobante);
            avisarSincronizacion();

            refComprobante.set(registro)
                .then(() => {
                    comprobantesSinSubir.delete(comprobante);
                    avisarSincronizacion();
                })
                .catch(error => {
                    comprobantesSinSubir.delete(comprobante);
                    comprobantesLeidos.delete(comprobante);
                    avisarSincronizacion();
                    errorAlEscribir(error);
                });
        }

        const cobro = { forma, monto, comprobante, persona, horaCelular: hora };
        enviarCambiosDelPedido(ref, [{ ruta: ["cobro"], valor: cobro }]);
        return cobro;
    }

    // Quien entregó tenía "Cobra" y respondió "Todavía no pagó" (o cerró la
    // pregunta): el aviso de cobro pendiente les llega a los demás de "Cobra".
    function avisarCobroPendiente(idPedido) {
        const { pedido } = pedidoEnLaNube(idPedido);
        if (!cobroPendiente(pedido)) return false;

        avisarAccionDePedido({
            accion: "cobroPendiente",
            pedido,
            resumen: "Cobro pendiente · " + textoPrecioEntrega(montoACobrar(pedido))
        });
        return true;
    }

    // La foto del comprobante. Primero la del celular (también la que todavía
    // no subió) y, si no está, la de la nube. Devuelve null si no existe o
    // si todavía no llegó.
    async function leerComprobante(id) {
        const clave = String(id || "");
        if (!/^comp_[A-Za-z0-9_]{1,80}$/.test(clave)) return null;
        if (comprobantesLeidos.has(clave)) return comprobantesLeidos.get(clave);
        if (!refDistribuidora) return null;

        const ref = refDistribuidora.collection("comprobantes").doc(clave);
        let foto = null;

        try {
            foto = await ref.get({ source: "cache" });
        } catch (error) {
            foto = null;
        }

        if (!foto || !foto.exists) {
            try {
                foto = await esperarNube(ref.get());
            } catch (error) {
                console.warn("No se pudo leer la foto del comprobante.", error);
                return null;
            }
        }

        if (!foto || !foto.exists) return null;

        const datos = foto.data() || {};
        if (typeof datos.foto !== "string") return null;

        const registro = { foto: datos.foto, persona: datos.persona || null, horaCelular: Number(datos.horaCelular) || 0 };
        comprobantesLeidos.set(clave, registro);
        return registro;
    }

    // -------------------------------------------------
    // Escucha en tiempo real
    // -------------------------------------------------

    function dejarDeEscuchar() {
        desuscripciones.forEach(dejar => dejar());
        desuscripciones = [];
    }

    function alFallarEscucha(error) {
        // Al salir (dueño o empleado) se vacía la copia de la nube y Firestore
        // corta las escuchas: no es un error.
        if (saliendo || !obtenerModoNubeGuardado()) {
            dejarDeEscuchar();
            return;
        }

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
        // Las fotos de los comprobantes (T28) no se escuchan: se cuentan aparte.
        return enDocumentos + borradosSinSubir + comprobantesSinSubir.size;
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
    // Indicador general de conexión (T12)
    // -------------------------------------------------
    // Es un cartel fijo abajo. Muestra la conexión y cuántos cambios faltan subir.

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

        const indicador = document.getElementById("indicadorNube");
        if (!indicador) return;

        indicador.dataset.estado = estadoIndicador();
        indicador.textContent = textoIndicador();
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
            throw errorMigracion("Tus datos ya salen de la nube.", "datos-locales");
        }
        // Una sola vez por celular (T16c): subir otra vez después de trabajar
        // en la nube vuelve a crear allá lo que se borró.
        if (migracionResuelta()) {
            throw errorMigracion("Los datos de este celular ya se resolvieron: no se vuelven a subir.", "datos-locales");
        }

        const usuario = window.cuentaVendeFrio?.usuarioActual();
        const idDistribuidora = window.distribuidoraVendeFrio?.idActual();
        const firestore = obtenerFirestore();

        if (!usuario || usuario.isAnonymous) throw errorMigracion("Primero ingresá a tu cuenta.", "datos-locales");
        if (!idDistribuidora) {
            throw errorMigracion("Tu distribuidora en la nube todavía no está lista.", "datos-locales");
        }
        if (!firestore) throw errorMigracion("La nube no está disponible en este momento.", "datos-locales");
        if (!navigator.onLine) throw errorMigracion(mensajeErrorMigracion({ code: "unavailable" }), "datos-locales");

        migracionEnCurso = true;
        migracionVerificada = null;

        // Si se corta y se vuelve a abrir la app, se pregunta otra vez (T16c).
        try {
            localStorage.setItem(DB_SUBIDA_EMPEZADA, "1");
        } catch (error) {
            console.warn("No se pudo anotar la subida empezada.", error);
        }

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

    // ¿Este celular ya subió sus datos antes? (T16c, decidido con el dueño)
    // Un celular que subió con T11 y después volvió a los datos del celular
    // no tiene ninguna marca. Antes de preguntar se revisa con internet si
    // alguno de sus registros ya está en la nube, por su id (como en la
    // verificación de T11). Si alguno está, ya subió: se da por resuelto sin
    // preguntar, porque subir otra vez vuelve a crear allá lo que se borró.
    // Lo que falte queda en el celular, para la revisión de T16e.
    const IDS_POR_CONSULTA = 30;

    async function datosDelCelularEnLaNube() {
        const usuario = window.cuentaVendeFrio?.usuarioActual();
        const idDistribuidora = window.distribuidoraVendeFrio?.idActual();
        const firestore = obtenerFirestore();

        if (!usuario || usuario.isAnonymous || !idDistribuidora || !firestore) {
            throw errorMigracion("La nube no está disponible en este momento.", "datos-locales");
        }
        if (!navigator.onLine) {
            throw errorMigracion("Hace falta internet para revisar si tus datos ya están en la nube. Tocá Reintentar cuando vuelva la señal.", "datos-locales");
        }

        const ref = firestore.collection("distribuidoras").doc(idDistribuidora);
        const idDocumento = window.firebase.firestore.FieldPath.documentId();
        const grupos = [
            ["comercios", obtenerComercios()],
            ["rutas", obtenerRutasGuardadas()],
            ["productos", listarProductosDeTodasLasMarcas(obtenerProductos())],
            ["pedidos", obtenerHistorial()]
        ];

        try {
            for (const [subcoleccion, registros] of grupos) {
                const ids = Array.from(new Set(registros.map(registro => registro && registro.id).filter(esIdValido)));

                for (let inicio = 0; inicio < ids.length; inicio += IDS_POR_CONSULTA) {
                    const foto = await esperarNube(
                        ref.collection(subcoleccion)
                            .where(idDocumento, "in", ids.slice(inicio, inicio + IDS_POR_CONSULTA))
                            .limit(1)
                            .get({ source: "server" })
                    );
                    if (!foto.empty) return true;
                }
            }
        } catch (error) {
            console.error("No se pudo revisar si los datos ya están en la nube.", error);
            throw errorMigracion(
                error && error.code === "permission-denied"
                    ? "La nube no deja leer tu distribuidora. Revisá que las reglas de seguridad estén publicadas."
                    : "No se pudo revisar si tus datos ya están en la nube. Revisá la señal y tocá Reintentar.",
                "datos-locales"
            );
        }

        return false;
    }

    // -------------------------------------------------
    // Limpieza de los datos viejos del celular (T16e)
    // -------------------------------------------------
    // Revisa con internet cuántos de los datos viejos del celular están en
    // la nube, igual que la verificación de T11 (por id o, en comercios,
    // productos y rutas, por nombre). No escribe nada en la nube.
    // Devuelve { completo, totales: [{ clave, nombre, enEsteCelular, enLaNube, faltan }] }.

    function nombreParaMostrar(clave, registro, marca) {
        if (clave === "pedidos") {
            const comercio = String(registro.comercio || "Sin comercio");
            return registro.fecha ? comercio + " (" + registro.fecha + ")" : comercio;
        }

        const nombre = String(registro.nombre || "Sin nombre");
        return clave === "productos" ? marca + " · " + nombre : nombre;
    }

    async function revisarDatosViejos(datos) {
        const usuario = window.cuentaVendeFrio?.usuarioActual();
        const idDistribuidora = window.distribuidoraVendeFrio?.idActual();
        const firestore = obtenerFirestore();

        if (!usuario || usuario.isAnonymous || !idDistribuidora || idDistribuidora !== usuario.uid || !firestore) {
            throw errorMigracion("La nube no está disponible en este momento.", "datos-locales");
        }
        if (!navigator.onLine) {
            throw errorMigracion("Hace falta internet para revisar la nube. Tocá de nuevo cuando vuelva la señal.", "datos-locales");
        }

        const esRegistro = registro => Boolean(registro) && typeof registro === "object" && !Array.isArray(registro);
        const productos = [];

        Object.keys(datos.productos).forEach(marca => {
            datos.productos[marca].filter(esRegistro).forEach(registro => {
                productos.push({ registro, extras: { _marca: marca } });
            });
        });

        const grupos = {
            comercios: datos.comercios.filter(esRegistro).map(registro => ({ registro, extras: {} })),
            productos,
            pedidos: datos.historial.filter(esRegistro).map(registro => ({ registro, extras: {} })),
            rutas: datos.rutasGuardadas.filter(esRegistro).map(registro => ({ registro, extras: {} }))
        };

        let enNube;

        try {
            enNube = await leerIdsEnNube(firestore.collection("distribuidoras").doc(idDistribuidora));
        } catch (error) {
            console.error("No se pudo revisar la nube.", error);
            throw errorMigracion(
                error && error.code === "permission-denied"
                    ? "La nube no deja leer tu distribuidora. Revisá que las reglas de seguridad estén publicadas."
                    : "No se pudo revisar la nube. Revisá la señal y probá de nuevo.",
                "datos-locales"
            );
        }

        const totales = GRUPOS_MIGRACION.map(grupo => {
            const items = grupos[grupo.clave];
            const faltan = items
                .filter(item => !estaEnNube(enNube[grupo.clave], grupo.clave, item))
                .map(item => nombreParaMostrar(grupo.clave, item.registro, item.extras._marca));

            return {
                clave: grupo.clave,
                nombre: grupo.nombre,
                enEsteCelular: items.length,
                enLaNube: items.length - faltan.length,
                faltan
            };
        });

        return { completo: totales.every(total => !total.faltan.length), totales };
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

        // Los datos de este celular ya están en la nube: no se vuelven a ofrecer (T16c).
        marcarMigracionResuelta();
        await vaciarCopiaDeLaNube();

        localStorage.setItem(DB_MODO_NUBE, JSON.stringify(migracionVerificada));
        window.location.reload();
    }

    // Solo nube (T16c): el dueño entra a la nube de su distribuidora sin subir
    // nada desde este celular. Se usa al registrarse o ingresar sin datos
    // propios, al abrir la app con sesión y con "No subirlos y usar la nube".
    // Los datos de este celular quedan resueltos (no se vuelve a ofrecer
    // subirlos) y guardados tal cual: localStorage no se toca.
    async function usarNube() {
        if (migracionEnCurso) throw errorMigracion("Esperá a que termine la subida.", "datos-locales");
        if (modo) throw errorMigracion("Tus datos ya salen de la nube.", "datos-locales");

        const usuario = window.cuentaVendeFrio?.usuarioActual();
        const idDistribuidora = window.distribuidoraVendeFrio?.idActual();

        if (!usuario || usuario.isAnonymous) throw errorMigracion("Primero ingresá a tu cuenta.", "datos-locales");
        if (!idDistribuidora || idDistribuidora !== usuario.uid) {
            throw errorMigracion("Tu distribuidora en la nube todavía no está lista.", "datos-locales");
        }
        if (!obtenerFirestore()) throw errorMigracion("La nube no está disponible en este momento.", "datos-locales");

        marcarMigracionResuelta();
        await vaciarCopiaDeLaNube();

        localStorage.setItem(DB_MODO_NUBE, JSON.stringify({ uid: usuario.uid, distribuidora: idDistribuidora }));
        window.location.reload();
    }

    // -------------------------------------------------
    // Salir (T16c)
    // -------------------------------------------------
    // Se sale siempre a la pantalla de inicio, nunca a los datos de este
    // celular: se olvida el modo nube y "Continuar sin iniciar sesión" (son
    // anotaciones, no datos) y se vacía la copia de la nube del celular (no
    // localStorage), así quien use después el celular no tiene los datos de
    // la distribuidora.

    let saliendo = false;

    function olvidarModo() {
        try {
            localStorage.removeItem(DB_MODO_NUBE);
            localStorage.removeItem(DB_INICIO_SIN_SESION);
        } catch (error) {
            console.warn("No se pudo limpiar el modo nube.", error);
        }
    }

    // "Salir de la cuenta" del dueño. Como el empleado (T14), no deja salir
    // con cambios sin subir, para no perderlos.
    async function salirDeLaCuenta() {
        const cuenta = window.cuentaVendeFrio;

        if (!cuenta || !cuenta.disponible()) {
            throw new Error("La cuenta no está disponible en este momento. Cerrá y volvé a abrir la app con internet.");
        }
        if (migracionEnCurso) throw new Error("Esperá a que termine la subida de tus datos.");

        const sinSubir = cantidadSinSubir();
        if (sinSubir > 0) {
            throw new Error(
                "Hay " + sinSubir + " cambio(s) sin subir a la nube. Esperá a tener señal y que diga \"todo subido\" antes de salir."
            );
        }

        if (saliendo) return;
        saliendo = true;

        // T29: este celular deja de recibir notificaciones (antes de cerrar
        // la sesión, que hace falta para borrarlo de la nube).
        await window.notificacionesVendeFrio?.olvidarEsteCelular?.();

        dejarDeEscuchar();
        olvidarModo();
        await vaciarCopiaDeLaNube();

        try {
            await cuenta.salir();
        } catch (error) {
            console.warn("No se pudo cerrar la sesión.", error);
        }

        window.location.reload();
    }

    // Si se pierde la sesión o entra otra cuenta mientras se usa la nube, se
    // sale igual que con "Salir". Si ya se está saliendo ("Salir" del dueño o
    // del empleado), no hace falta.
    async function dejarLaNube() {
        if (saliendo || !obtenerModoNubeGuardado()) return;
        saliendo = true;

        dejarDeEscuchar();
        olvidarModo();
        await vaciarCopiaDeLaNube();
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

    // Con cuenta o con código, los datos salen siempre de la nube (T16c).
    function iniciarNube(uidGuardado, idDistribuidora) {
        db = obtenerFirestore();
        const disponible = Boolean(db && window.cuentaVendeFrio && window.cuentaVendeFrio.disponible());
        if (!disponible) db = null;

        modo = "nube";
        if (disponible) refDistribuidora = db.collection("distribuidoras").doc(idDistribuidora);
        cambiarEstado(disponible ? "conectando" : "error");

        // Siempre el adaptador nube: aunque Firebase no cargue, no se muestran
        // ni se tocan los datos de este celular.
        usarAdaptadorDatos(adaptadorNube);
        escucharCambiosDatos(redibujarPantallas);
        alCargarPagina(mostrarIndicadorNube);

        // El indicador sigue el estado de la conexión (T12).
        oyentes.push(() => avisarSincronizacion());

        if (!disponible) {
            console.warn("La nube no está disponible: no se muestran datos.");
            alCargarPagina(() => mostrarAviso(
                "La nube no está disponible",
                "No se pudo cargar la nube en este celular, así que por ahora no se ven tus datos. Siguen guardados en la nube. Cerrá y volvé a abrir la app con internet."
            ));
            return;
        }

        // Si se pierde la sesión o entra otra cuenta, se sale de la nube a la
        // pantalla de inicio (no a los datos de este celular).
        window.cuentaVendeFrio.escuchar(usuario => {
            if (!usuario || usuario.uid !== uidGuardado) {
                dejarLaNube();
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
        modoNube: () => modo === "nube",
        estado: () => estado,
        subirDatos: subirDatosLocales,
        migracionEnCurso: () => migracionEnCurso,
        migracionVerificada: () => Boolean(migracionVerificada),
        activarNube,
        // Solo nube (T16c).
        usarNube,
        datosDelCelularEnLaNube,
        salirDeLaCuenta,
        // Limpieza de los datos viejos del celular (T16e).
        revisarDatosViejos,
        // Pedidos campo por campo (T20).
        cambiarCamposDelPedido,
        agregarEstadoAlPedido,
        // Incidencias (T22).
        incidenciasAbiertas,
        marcarIncidencia,
        resolverIncidencias,
        // Checklist de preparación y faltantes (T24).
        preparacionDelPedido,
        textoResumenDePreparacion,
        tildarProducto,
        marcarFaltante,
        quitarFaltante,
        marcarPreparado,
        // Editar el pedido (T25).
        puedeEditarElPedido,
        editarPedido,
        edicionesSinVer,
        quienesVieronLasEdiciones,
        marcarEdicionesVistas,
        // "Ticket impreso por" (T28d).
        anotarImpresion,
        impresionesDelPedido,
        // Eliminar y cancelar (T26).
        puedeEliminarElPedido,
        puedeCancelarElPedido,
        eliminarPedido,
        cancelarPedido,
        // Entrega (T27).
        entregaDelPedido,
        textoResumenDeEntrega,
        puedeEntregarElPedido,
        entregarPedido,
        estadoAntesDeLaEntrega,
        // Pasos más cortos (T29b).
        estadoAntesDelReparto,
        puedeVolverDeEntregado,
        volverDeEntregado,
        // Cobro (T28).
        FORMAS_DE_COBRO,
        nombreDeFormaDeCobro,
        cobroDelPedido,
        cobroPendiente,
        puedeCobrar,
        puedeRegistrarElCobro,
        montoACobrar,
        textoDelCobro,
        registrarCobro,
        avisarCobroPendiente,
        leerComprobante,
        comprobanteSinSubir: id => Boolean(id && comprobantesSinSubir.has(String(id))),
        LARGO_MAXIMO_FOTO,
        // Avisos (T23).
        escucharAccionesDePedidos,
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
        // Si Firebase no cargó, reintentar es volver a abrir la app.
        reintentar: () => (db ? escucharNube() : window.location.reload()),
        escuchar
    };

    // El modo prueba se sacó (T16c): se borra su anotación vieja. Ese celular
    // tiene sesión, así que inicio.js lo lleva a la nube de su distribuidora.
    try {
        if (localStorage.getItem(DB_MODO_NUBE_PRUEBA) !== null) localStorage.removeItem(DB_MODO_NUBE_PRUEBA);
    } catch (error) {
        console.warn("No se pudo borrar la anotación del modo prueba.", error);
    }

    const modoNubeGuardado = obtenerModoNubeGuardado();

    if (modoNubeGuardado) {
        // Los celulares que ya usan la nube se dan por resueltos (T16c).
        marcarMigracionResuelta();
        iniciarNube(modoNubeGuardado.uid, modoNubeGuardado.distribuidora);
    }

    window.dispatchEvent(new Event("nubeVendeFrioLista"));
}());
