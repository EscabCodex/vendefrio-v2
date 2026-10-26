// =====================================================
// VendeFr\u00edo Lite - database.js
// Almacenamiento local seguro y funciones de datos
// =====================================================

const DB_COMERCIOS = "vendefrio_comercios";
const DB_PRODUCTOS = "vendefrio_productos";
const DB_ORDEN_MARCAS = "vendefrio_orden_marcas";
const DB_HISTORIAL = "vendefrio_historial";
const DB_RUTAS_GUARDADAS = "vendefrio_rutas_guardadas";
const DB_ULTIMO_RESPALDO = "vendefrio_ultimo_respaldo";
const DB_RESPALDO_AUTOMATICO = "vendefrio_respaldo_automatico";
const DB_ULTIMO_RESPALDO_AUTOMATICO = "vendefrio_ultimo_respaldo_automatico";
const DB_SEMANA_ACTUAL = "vendefrio_semana_actual";
// Modo nube de prueba (T9). Se sac\u00f3 en T16c: nube.js solo borra esta
// anotaci\u00f3n vieja al abrir la app.
const DB_MODO_NUBE_PRUEBA = "vendefrio_modo_nube_prueba";
// Modo nube real (T11): guarda { uid, distribuidora } de la cuenta que lo activ\u00f3.
const DB_MODO_NUBE = "vendefrio_modo_nube";
// Pantalla de inicio (T13): "1" si se eligi\u00f3 "Continuar sin iniciar sesi\u00f3n".
// Al salir de la cuenta se olvida (T16c).
const DB_INICIO_SIN_SESION = "vendefrio_inicio_sin_sesion";
// Solo nube (T16c): "1" cuando los datos propios de este celular ya se
// resolvieron (se subieron, se eligi\u00f3 no subirlos o el celular ya usaba la
// nube). As\u00ed "Subir mis datos a la nube" se ofrece una sola vez por celular.
const DB_MIGRACION_RESUELTA = "vendefrio_migracion_resuelta";
// Solo nube (T16c): "1" mientras una subida de T11 empezada en este celular
// no termin\u00f3. As\u00ed, al volver a abrir, se pregunta otra vez y se puede terminar.
const DB_SUBIDA_EMPEZADA = "vendefrio_subida_empezada";
// Respaldo de la nube (T16b): fecha de la \u00faltima descarga en este celular y
// d\u00eda (AAAA-MM-DD) en que se mostr\u00f3 el recordatorio.
const DB_ULTIMO_RESPALDO_NUBE = "vendefrio_ultimo_respaldo_nube";
const DB_RECORDATORIO_RESPALDO_NUBE = "vendefrio_recordatorio_respaldo_nube";
const DIAS_ENTRE_RESPALDOS_AUTOMATICOS = 7;
const DIAS_PARA_RECORDAR_RESPALDO_NUBE = 7;

const PALETA_MARCAS = ["#0f9d63", "#ff8a3d", "#8b5cf6", "#3b82f6", "#e5483d", "#0891b2"];
const PALETA_AVATAR = ["#0f9d63", "#ff8a3d", "#8b5cf6", "#3b82f6", "#e5483d", "#0891b2", "#f59e0b", "#14b8a6"];

// -----------------------------------------------------
// UTILIDADES
// -----------------------------------------------------

function clonarDatos(datos) {
    return JSON.parse(JSON.stringify(datos));
}

// Se usa miles de veces por pantalla (comparar nombres de comercios y
// productos): se recuerda el resultado de cada texto (T151).
const textosNormalizados = new Map();

function normalizarTexto(texto) {
    const original = String(texto || "");
    let normalizado = textosNormalizados.get(original);
    if (normalizado !== undefined) return normalizado;
    normalizado = original
        .trim()
        .toLocaleLowerCase("es-AR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    if (textosNormalizados.size > 20000) textosNormalizados.clear();
    textosNormalizados.set(original, normalizado);
    return normalizado;
}

function obtenerInicioSemanaActual() {
    const fecha = new Date();
    fecha.setHours(0, 0, 0, 0);

    const dia = fecha.getDay();
    const diasDesdeLunes = dia === 0 ? 6 : dia - 1;
    fecha.setDate(fecha.getDate() - diasDesdeLunes);

    return fecha;
}

function obtenerClaveSemanaActual() {
    const inicio = obtenerInicioSemanaActual();
    const anio = inicio.getFullYear();
    const mes = String(inicio.getMonth() + 1).padStart(2, "0");
    const dia = String(inicio.getDate()).padStart(2, "0");

    return anio + "-" + mes + "-" + dia;
}

function obtenerFechaLocalDesdeTexto(texto) {
    const partes = String(texto || "").split("/");
    if (partes.length !== 3) return null;

    const fecha = new Date(
        Number(partes[2]),
        Number(partes[1]) - 1,
        Number(partes[0])
    );

    if (Number.isNaN(fecha.getTime())) return null;
    fecha.setHours(0, 0, 0, 0);
    return fecha;
}

function esFechaDeSemanaActual(fecha) {
    if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
        return false;
    }

    const inicio = obtenerInicioSemanaActual();
    const ahora = new Date();

    return fecha >= inicio && fecha <= ahora;
}

function comercioEstaVisitadoEstaSemana(comercio) {
    if (!comercio || comercio.pendienteSemana === true) return false;
    if (!comercio.ultimaVisita) return false;

    const fecha = obtenerFechaLocalDesdeTexto(comercio.ultimaVisita);
    return esFechaDeSemanaActual(fecha);
}

function asegurarReinicioSemanal() {
    // Con la nube no se hace (decidido con el due\u00f1o en T16c): cada celular
    // anotaba la semana por su cuenta y uno que volv\u00eda tarde borraba las
    // marcas que otro puso esa semana. No cambia lo que se ve: "visitado"
    // sale de la fecha de la \u00faltima visita y cada visita saca la marca.
    if (usaNubeReal()) return;

    const semanaActual = obtenerClaveSemanaActual();
    const semanaGuardada = localStorage.getItem(DB_SEMANA_ACTUAL);

    if (semanaGuardada !== semanaActual) {
        Object.keys(localStorage)
            .filter(clave => clave.indexOf("vendefrio_semanal_") === 0)
            .forEach(clave => localStorage.removeItem(clave));

        const comercios = obtenerComercios();
        comercios.forEach(comercio => {
            comercio.pendienteSemana = false;
        });
        guardarComercios(comercios);

        localStorage.setItem(DB_SEMANA_ACTUAL, semanaActual);
    }
}

function programarReinicioSemanal() {
    const ahora = new Date();
    const proximoLunes = obtenerInicioSemanaActual();
    proximoLunes.setDate(proximoLunes.getDate() + 7);

    const demora = Math.max(1000, proximoLunes.getTime() - ahora.getTime() + 1000);

    window.setTimeout(() => {
        asegurarReinicioSemanal();

        if (typeof actualizarDashboard === "function") {
            actualizarDashboard();
        }

        if (typeof renderizarComercios === "function") {
            renderizarComercios();
        }

        programarReinicioSemanal();
    }, demora);
}

// -----------------------------------------------------
// CAPA DE DATOS: ADAPTADOR, COPIA EN MEMORIA Y AVISOS (T6)
// -----------------------------------------------------
// Los datos compartidos (comercios, productos, orden de marcas, historial
// y rutas guardadas) se leen y se guardan solo con leerColeccion() y
// guardarColeccion(), salvo las migraciones del formato local de T3 y T4
// (al abrir la app), que trabajan sobre el texto guardado tal cual. Esas dos funciones trabajan contra una copia en
// memoria; el "adaptador" es el que sabe d\u00f3nde viven los datos de verdad.
//
// Hay dos adaptadores: el local (localStorage, el de siempre, para el modo
// sin sesi\u00f3n) y el nube (Firestore, en nube.js), que se usa con cuenta o
// con c\u00f3digo. Los dos cumplen esta misma interfaz:
//
//   nombre                            "local", "nube", etc.
//   leer(coleccion)                   devuelve los datos guardados, o undefined
//                                     si no hay nada. Es sincr\u00f3nico: la nube
//                                     responde con lo \u00faltimo que le lleg\u00f3.
//                                     Lanza un error si los datos est\u00e1n da\u00f1ados.
//   guardar(coleccion, datos, texto)  guarda la colecci\u00f3n completa ("texto" es
//                                     lo mismo pasado a JSON). La nube compara
//                                     con lo anterior y escribe solo los
//                                     registros que cambiaron. Lanza un error
//                                     si no se pudo.
//   borrar(coleccion)                 borra la colecci\u00f3n.
//   escucharCambios(alCambiar)        llama a alCambiar(coleccion) cuando los
//                                     datos cambian desde afuera (otra pesta\u00f1a,
//                                     otro celular). Devuelve una funci\u00f3n para
//                                     dejar de escuchar.
//
// Las preferencias, el borrador del pedido y las fechas y copias de
// respaldo son de cada celular: siguen yendo directo a localStorage.

const COLECCIONES_COMPARTIDAS = ["comercios", "productos", "ordenMarcas", "historial", "rutasGuardadas"];

const adaptadorLocal = {
    nombre: "local",

    claves: {
        comercios: DB_COMERCIOS,
        productos: DB_PRODUCTOS,
        ordenMarcas: DB_ORDEN_MARCAS,
        historial: DB_HISTORIAL,
        rutasGuardadas: DB_RUTAS_GUARDADAS
    },

    leer(coleccion) {
        const texto = localStorage.getItem(this.claves[coleccion]);
        if (!texto) return undefined;
        return JSON.parse(texto);
    },

    guardar(coleccion, datos, texto) {
        localStorage.setItem(
            this.claves[coleccion],
            texto !== undefined ? texto : JSON.stringify(datos)
        );
    },

    borrar(coleccion) {
        localStorage.removeItem(this.claves[coleccion]);
    },

    // El evento "storage" solo llega cuando cambia otra pesta\u00f1a de la app.
    escucharCambios(alCambiar) {
        const alCambiarStorage = evento => {
            if (evento.storageArea && evento.storageArea !== localStorage) return;

            COLECCIONES_COMPARTIDAS.forEach(coleccion => {
                if (evento.key === null || evento.key === this.claves[coleccion]) {
                    alCambiar(coleccion);
                }
            });
        };

        window.addEventListener("storage", alCambiarStorage);
        return () => window.removeEventListener("storage", alCambiarStorage);
    }
};

let adaptadorDatos = adaptadorLocal;
let dejarDeEscucharAdaptador = null;

// Una entrada por colecci\u00f3n: { existe, texto }. "texto" es null si no hay
// datos o si estaban da\u00f1ados. Se guarda como texto para que cada lectura
// devuelva una copia nueva, igual que antes al leer de localStorage.
let memoriaDatos = {};

function esAdaptadorValido(adaptador) {
    return Boolean(
        adaptador &&
        typeof adaptador === "object" &&
        ["leer", "guardar", "borrar", "escucharCambios"].every(metodo => {
            return typeof adaptador[metodo] === "function";
        })
    );
}

function conectarAdaptadorDatos() {
    if (dejarDeEscucharAdaptador) dejarDeEscucharAdaptador();

    const dejar = adaptadorDatos.escucharCambios(coleccion => {
        if (!COLECCIONES_COMPARTIDAS.includes(coleccion)) return;
        delete memoriaDatos[coleccion];
        avisarCambioDatos([coleccion], true);
    });

    dejarDeEscucharAdaptador = typeof dejar === "function" ? dejar : null;
}

// Cambia de d\u00f3nde salen los datos. La usa nube.js al usar la nube.
function usarAdaptadorDatos(adaptador) {
    if (!esAdaptadorValido(adaptador)) {
        console.error("El adaptador de datos no cumple la interfaz.", adaptador);
        return false;
    }

    adaptadorDatos = adaptador;
    memoriaDatos = {};
    conectarAdaptadorDatos();
    avisarCambioDatos(COLECCIONES_COMPARTIDAS, true);
    return true;
}

function obtenerNombreAdaptadorDatos() {
    return adaptadorDatos.nombre || "";
}

// --- Modo nube real (T11) ---
// Con cuenta o con c\u00f3digo, los datos salen de la distribuidora en la nube
// (Solo nube, T16c). Los datos de este celular (localStorage) no se borran:
// quedan guardados, sin usarse, y vuelven solo en el modo sin sesi\u00f3n.

function obtenerModoNubeGuardado() {
    try {
        const guardado = JSON.parse(localStorage.getItem(DB_MODO_NUBE) || "null");

        if (guardado && typeof guardado.uid === "string" && guardado.uid &&
            typeof guardado.distribuidora === "string" && guardado.distribuidora) {
            return { uid: guardado.uid, distribuidora: guardado.distribuidora };
        }
    } catch (error) {
        console.warn("El modo nube guardado no es v\u00e1lido.", error);
    }

    return null;
}

// Modo nube: los datos no salen de este celular sino de la nube (T10).
function estaEnModoNube() {
    return obtenerNombreAdaptadorDatos() !== "local";
}

// Solo nube (T16b): este celular usa la nube real de una distribuidora
// (dueño o empleado), aunque la nube todavía no haya cargado. Se sabe al
// abrir la app, antes que nube.js, y también sin internet.
function usaNubeReal() {
    return obtenerModoNubeGuardado() !== null;
}

// Solo nube (T16c): la migraci\u00f3n de T11 se ofrece una sola vez por celular.
function migracionResuelta() {
    try {
        return localStorage.getItem(DB_MIGRACION_RESUELTA) === "1";
    } catch (error) {
        return false;
    }
}

function marcarMigracionResuelta() {
    try {
        if (!migracionResuelta()) localStorage.setItem(DB_MIGRACION_RESUELTA, "1");
        localStorage.removeItem(DB_SUBIDA_EMPEZADA);
    } catch (error) {
        console.warn("No se pudo anotar que los datos del celular ya se resolvieron.", error);
    }
}

function subidaDeDatosEmpezada() {
    try {
        return localStorage.getItem(DB_SUBIDA_EMPEZADA) === "1";
    } catch (error) {
        return false;
    }
}

// El dueño usa la nube de su propia distribuidora (su id es el uid del
// dueño). El empleado usa la de su encargado, con otra cuenta.
function esDuenoEnLaNube() {
    const guardado = obtenerModoNubeGuardado();
    if (!usaNubeReal() || guardado.distribuidora !== guardado.uid) return false;
    return !(window.empleadosVendeFrio && window.empleadosVendeFrio.esEmpleado());
}

// Devuelve true (y avisa) si la acci\u00f3n no se puede usar porque los datos
// no salen de este celular.
function frenarSiDatosNoSonLocales() {
    if (obtenerNombreAdaptadorDatos() === "local") return false;

    mostrarAviso(
        "No disponible en modo nube",
        "Est\u00e1s usando los datos de la nube. Esta opci\u00f3n todav\u00eda no est\u00e1 disponible en modo nube."
    );
    return true;
}

function cargarColeccion(coleccion) {
    if (!memoriaDatos[coleccion]) {
        let entrada;

        try {
            const datos = adaptadorDatos.leer(coleccion);
            entrada = datos === undefined
                ? { existe: false, texto: null }
                : { existe: true, texto: JSON.stringify(datos) };
        } catch (error) {
            console.warn(`Los datos de ${coleccion} estaban da\u00f1ados. Se usar\u00e1n datos de respaldo.`, error);
            entrada = { existe: true, texto: null };
        }

        memoriaDatos[coleccion] = entrada;
    }

    return memoriaDatos[coleccion];
}

function existeColeccion(coleccion) {
    return cargarColeccion(coleccion).existe;
}

// Marca de una colección en memoria: cambia cada vez que se guarda o llega
// cambiada de la nube. Sirve para recordar cuentas hechas sobre esos datos
// (por ejemplo, lo que debe cada comercio) y no rehacerlas en cada toque.
const marcasDeColecciones = new WeakMap();
let ultimaMarcaDeColeccion = 0;

function marcaDeColeccion(coleccion) {
    const entrada = cargarColeccion(coleccion);
    if (!marcasDeColecciones.has(entrada)) marcasDeColecciones.set(entrada, ++ultimaMarcaDeColeccion);
    return marcasDeColecciones.get(entrada);
}

// Hay algo para guardar en un respaldo. Se recuerda hasta que cambian los
// datos: lo pregunta el aviso de Inicio cada vez que se dibuja.
let hayDatosRecordado = null;

function hayDatosParaRespaldar() {
    const marca = ["comercios", "productos", "historial"].map(marcaDeColeccion).join("|");
    if (!hayDatosRecordado || hayDatosRecordado.marca !== marca) {
        const total = {
            comercios: obtenerComercios().length,
            productos: listarProductosDeTodasLasMarcas(obtenerProductos()).length,
            pedidos: obtenerHistorial().length
        };
        hayDatosRecordado = { marca, hay: Boolean(total.comercios || total.productos || total.pedidos) };
    }
    return hayDatosRecordado.hay;
}

// Devuelve una copia: cambiarla no cambia los datos guardados.
function leerColeccion(coleccion, valorInicial) {
    const entrada = cargarColeccion(coleccion);

    if (entrada.texto === null) return clonarDatos(valorInicial);
    return JSON.parse(entrada.texto);
}

function guardarColeccion(coleccion, datos) {
    try {
        const texto = JSON.stringify(datos);
        adaptadorDatos.guardar(coleccion, datos, texto);
        memoriaDatos[coleccion] = { existe: true, texto };
    } catch (error) {
        console.error(`No se pudieron guardar los datos de ${coleccion}.`, error);

        if (error && error.code === "nube-no-disponible") {
            mostrarAviso(
                "La nube no est\u00e1 disponible",
                "No se guard\u00f3 el cambio. Cerr\u00e1 y volv\u00e9 a abrir la app con internet."
            );
            return false;
        }

        if (error && error.code === "borrado-masivo") {
            mostrarAviso(
                "Cambio frenado para cuidar los datos",
                "Ese cambio iba a borrar varios registros de la nube a la vez y se fren\u00f3. No se borr\u00f3 nada. Si quer\u00e9s borrar algo, hacelo de a uno."
            );
            return false;
        }

        mostrarAviso(
            "No se pudieron guardar los cambios",
            "Revis\u00e1 si el almacenamiento del navegador est\u00e1 lleno."
        );
        return false;
    }

    avisarCambioDatos([coleccion], false);
    return true;
}

// Para cuando algo escribi\u00f3 en el adaptador sin pasar por guardarColeccion
// (las migraciones de ids): la pr\u00f3xima lectura vuelve a cargar.
function olvidarColeccionesEnMemoria(colecciones) {
    colecciones.forEach(coleccion => delete memoriaDatos[coleccion]);
    avisarCambioDatos(colecciones, false);
}

// --- Aviso interno de cambios ---
// Las pantallas se anotan con escucharCambiosDatos(funcion) para volver a
// dibujarse solas. La funci\u00f3n recibe { colecciones, externo }: "externo" es
// true si el cambio vino de afuera (otra pesta\u00f1a u otro celular). Los cambios
// del mismo momento llegan juntos en un solo aviso. Las pantallas se
// redibujan solas despu\u00e9s de sus propios cambios, como siempre; nube.js se
// anota para redibujarlas cuando el cambio viene de otro celular (T9).

const oyentesCambiosDatos = new Set();
let avisoCambiosPendiente = null;

function escucharCambiosDatos(oyente) {
    if (typeof oyente !== "function") return () => {};

    oyentesCambiosDatos.add(oyente);
    return () => oyentesCambiosDatos.delete(oyente);
}

function avisarCambioDatos(colecciones, externo) {
    if (!avisoCambiosPendiente) {
        avisoCambiosPendiente = { colecciones: new Set(), externo: false };
        Promise.resolve().then(enviarAvisoCambioDatos);
    }

    colecciones.forEach(coleccion => avisoCambiosPendiente.colecciones.add(coleccion));
    if (externo) avisoCambiosPendiente.externo = true;
}

function enviarAvisoCambioDatos() {
    const aviso = {
        colecciones: Array.from(avisoCambiosPendiente.colecciones),
        externo: avisoCambiosPendiente.externo
    };
    avisoCambiosPendiente = null;

    oyentesCambiosDatos.forEach(oyente => {
        try {
            oyente(aviso);
        } catch (error) {
            console.error("Fall\u00f3 una pantalla al recibir el aviso de cambios.", error);
        }
    });
}

function mostrarToast(mensaje, tipo) {
    let contenedor = document.getElementById("contenedorToasts");
    if (!contenedor) {
        contenedor = document.createElement("div");
        contenedor.id = "contenedorToasts";
        document.body.appendChild(contenedor);
    }

    const toast = document.createElement("div");
    toast.className = "toast" + (tipo ? " toast-" + tipo : "");
    toast.innerHTML =
        (window.icono ? window.icono("check", 16) : "") +
        "<span>" + mensaje + "</span>";
    contenedor.appendChild(toast);

    if (navigator.vibrate) navigator.vibrate(20);

    requestAnimationFrame(() => toast.classList.add("toast-visible"));

    setTimeout(() => {
        toast.classList.remove("toast-visible");
        setTimeout(() => toast.remove(), 250);
    }, 2400);
}
window.mostrarToast = mostrarToast;

function mostrarAviso(titulo, mensaje) {
    let modalAviso = document.getElementById("modalAviso");

    if (!modalAviso) {
        modalAviso = document.createElement("div");
        modalAviso.id = "modalAviso";
        modalAviso.className = "modal oculto";
        modalAviso.innerHTML = `
            <div class="modalContenido">
                <h2 id="tituloAviso"></h2>
                <p id="mensajeAviso"></p>
                <div class="modalBotones">
                    <button id="cerrarAviso" class="btnModalConfirmar" type="button">
                        Entendido
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modalAviso);

        const cerrarAviso = () => {
            modalAviso.classList.add("oculto");
        };

        document.getElementById("cerrarAviso").addEventListener(
            "click",
            cerrarAviso
        );

        modalAviso.addEventListener("click", event => {
            if (event.target === modalAviso) {
                cerrarAviso();
            }
        });
    }

    document.getElementById("tituloAviso").textContent = titulo;
    document.getElementById("mensajeAviso").textContent = mensaje;
    modalAviso.classList.remove("oculto");
}

function colorMarca(indice) {
    return PALETA_MARCAS[Math.abs(Number(indice) || 0) % PALETA_MARCAS.length];
}

function colorAvatar(texto) {
    texto = texto || "?";
    let hash = 0;

    for (let i = 0; i < texto.length; i++) {
        hash = texto.charCodeAt(i) + ((hash << 5) - hash);
    }

    return PALETA_AVATAR[Math.abs(hash) % PALETA_AVATAR.length];
}

function iniciales(texto) {
    return (texto || "?").trim().slice(0, 2).toUpperCase();
}

// -----------------------------------------------------
// IDENTIFICADORES ÚNICOS
// -----------------------------------------------------

const PREFIJO_ID_COMERCIO = "com";
const PREFIJO_ID_PRODUCTO = "prod";
const PREFIJO_ID_PEDIDO = "ped";
const PREFIJO_ID_RUTA = "ruta";

function generarId(prefijo) {
    let aleatorio = "";

    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        aleatorio = window.crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    } else {
        aleatorio =
            Math.random().toString(36).slice(2, 8) +
            Math.random().toString(36).slice(2, 8);
    }

    return prefijo + "_" + Date.now().toString(36) + aleatorio;
}

function tieneId(registro) {
    return Boolean(
        registro &&
        typeof registro === "object" &&
        typeof registro.id === "string" &&
        registro.id.trim() !== ""
    );
}

// Pone un id a cada registro que no lo tenga. Nunca cambia un id existente,
// salvo que esté repetido: ahí la primera copia lo conserva y la otra recibe uno nuevo.
function asignarIdsFaltantes(registros, prefijo) {
    const usados = new Set();
    const pendientes = [];

    (Array.isArray(registros) ? registros : []).forEach(registro => {
        if (!registro || typeof registro !== "object") return;

        if (tieneId(registro) && !usados.has(registro.id)) {
            usados.add(registro.id);
        } else {
            pendientes.push(registro);
        }
    });

    pendientes.forEach(registro => {
        let id = generarId(prefijo);
        while (usados.has(id)) id = generarId(prefijo);
        registro.id = id;
        usados.add(id);
    });

    return pendientes.length;
}

function listarProductosDeTodasLasMarcas(productos) {
    if (!productos || typeof productos !== "object" || Array.isArray(productos)) {
        return [];
    }

    return Object.keys(productos).reduce((lista, marca) => {
        return Array.isArray(productos[marca])
            ? lista.concat(productos[marca])
            : lista;
    }, []);
}

function asignarIdsProductos(productos) {
    return asignarIdsFaltantes(
        listarProductosDeTodasLasMarcas(productos),
        PREFIJO_ID_PRODUCTO
    );
}

// -----------------------------------------------------
// COMERCIOS
// -----------------------------------------------------

function obtenerComercios() {
    let comercios = leerColeccion("comercios", COMERCIOS);

    if (!Array.isArray(comercios)) {
        comercios = clonarDatos(COMERCIOS);
    }

    // Limpia registros inv\u00e1lidos sin borrar datos \u00fatiles.
    comercios = comercios
        .filter(comercio => comercio && typeof comercio === "object")
        .map(comercio => ({
            ...comercio,
            nombre: String(comercio.nombre || "").trim(),
            direccion: String(comercio.direccion || "").trim(),
            enlaceMaps: String(comercio.enlaceMaps || "").trim(),
            origenGps: String(comercio.origenGps || ""),
            telefono: String(comercio.telefono || "").trim(),
            pedidosRealizados: Number(comercio.pedidosRealizados) || 0,
            ultimaVisita: comercio.ultimaVisita || "",
            pendienteSemana: comercio.pendienteSemana === true
        }))
        .filter(comercio => comercio.nombre !== "");

    if (!existeColeccion("comercios")) {
        guardarComercios(comercios);
    }

    return comercios;
}

// Archivar en vez de borrar (T63): lo archivado no se ofrece para vender
// ni para visitar, pero sigue guardado (los pedidos viejos lo nombran).
function comercioArchivado(comercio) {
    return Boolean(comercio && comercio.archivado === true);
}

function productoArchivado(producto) {
    return Boolean(producto && producto.archivado === true);
}

function comerciosActivos() {
    return obtenerComercios().filter(comercio => !comercioArchivado(comercio));
}

// Productos para vender: los mismos, sin los archivados (las marcas quedan).
function productosParaVender(productos = obtenerProductos()) {
    const activos = {};
    Object.keys(productos).forEach(marca => {
        activos[marca] = (productos[marca] || []).filter(producto => !productoArchivado(producto));
    });
    return activos;
}

function archivarComercioPorId(id, archivado = true) {
    return actualizarComercioPorId(id, { archivado: archivado === true, archivadoEl: archivado ? Date.now() : null });
}

function archivarProductoPorId(id, archivado = true) {
    return actualizarProductoPorId(id, { archivado: archivado === true, archivadoEl: archivado ? Date.now() : null });
}

function guardarComercios(comercios) {
    const lista = Array.isArray(comercios) ? comercios : [];
    asignarIdsFaltantes(lista, PREFIJO_ID_COMERCIO);
    return guardarColeccion("comercios", lista);
}

function buscarComercioPorNombre(nombre, comercios = obtenerComercios()) {
    const buscado = normalizarTexto(nombre);
    return comercios.find(comercio => normalizarTexto(comercio.nombre) === buscado);
}

function existeComercioConNombre(nombre, nombreExcluir = "") {
    const buscado = normalizarTexto(nombre);
    const excluir = normalizarTexto(nombreExcluir);

    return obtenerComercios().some(comercio =>
        normalizarTexto(comercio.nombre) === buscado &&
        normalizarTexto(comercio.nombre) !== excluir
    );
}

function agregarComercio(comercio) {
    if (!comercio || !String(comercio.nombre || "").trim()) return false;
    if (existeComercioConNombre(comercio.nombre)) return false;

    const comercios = obtenerComercios();
    comercios.push({
        nombre: String(comercio.nombre).trim(),
        direccion: String(comercio.direccion || "").trim(),
        enlaceMaps: String(comercio.enlaceMaps || "").trim(),
        origenGps: String(comercio.origenGps || ""),
        telefono: String(comercio.telefono || "").trim(),
        lat: comercio.lat !== undefined ? comercio.lat : "",
        lng: comercio.lng !== undefined ? comercio.lng : "",
        pedidosRealizados: Number(comercio.pedidosRealizados) || 0,
        ultimaVisita: comercio.ultimaVisita || "",
        pendienteSemana: comercio.pendienteSemana === true
    });

    return guardarComercios(comercios);
}

function eliminarComercio(nombre) {
    const comercios = obtenerComercios();
    const nuevos = comercios.filter(comercio =>
        normalizarTexto(comercio.nombre) !== normalizarTexto(nombre)
    );

    if (nuevos.length === comercios.length) return false;
    return guardarComercios(nuevos);
}

// -----------------------------------------------------
// PRODUCTOS Y MARCAS
// -----------------------------------------------------

// Datos del producto que no son id, nombre, precio ni imagen (Etapa 7).
const CAMPOS_BASE_PRODUCTO = ["id", "nombre", "precio", "imagen", "foto", "producto"];
function camposExtraDeProducto(producto) {
    const extra = {};
    Object.keys(producto || {}).forEach(campo => {
        if (!CAMPOS_BASE_PRODUCTO.includes(campo) && producto[campo] !== undefined) extra[campo] = producto[campo];
    });
    return extra;
}

function obtenerProductos() {
    let productos = leerColeccion("productos", PRODUCTOS);

    if (!productos || typeof productos !== "object" || Array.isArray(productos)) {
        productos = clonarDatos(PRODUCTOS);
    }

    const productosLimpios = {};

    Object.keys(productos).forEach(marca => {
        const nombreMarca = String(marca || "").trim();
        if (!nombreMarca) return;

        productosLimpios[nombreMarca] = Array.isArray(productos[marca])
            ? productos[marca]
                .filter(producto => producto && typeof producto === "object")
                .map(producto => ({
                    // Etapa 7: se conservan los datos extra del producto
                    // (archivado, oferta, stock, código, listas de precios).
                    ...camposExtraDeProducto(producto),
                    ...(tieneId(producto) ? { id: producto.id } : {}),
                    nombre: String(producto.nombre || "").trim(),
                    precio: Number(producto.precio) || 0,
                    imagen: String(producto.imagen || producto.foto || "")
                }))
                .filter(producto => producto.nombre !== "")
            : [];
    });

    if (!existeColeccion("productos")) {
        guardarProductos(productosLimpios);
    }

    return productosLimpios;
}

function guardarProductos(productos) {
    const datos = productos && typeof productos === "object" ? productos : {};
    asignarIdsProductos(datos);
    return guardarColeccion("productos", datos);
}

function obtenerOrdenMarcas() {
    const orden = leerColeccion("ordenMarcas", []);

    if (!Array.isArray(orden)) {
        return [];
    }

    return orden
        .map(nombre => String(nombre || "").trim())
        .filter((nombre, indice, lista) => {
            return nombre !== "" && lista.indexOf(nombre) === indice;
        });
}

function guardarOrdenMarcas(orden) {
    return guardarColeccion(
        "ordenMarcas",
        Array.isArray(orden) ? orden : []
    );
}

function obtenerMarcasOrdenadas(productos = obtenerProductos()) {
    const nombresActuales = Object.keys(productos);
    const ordenGuardado = obtenerOrdenMarcas();
    const ordenFinal = [];

    ordenGuardado.forEach(nombreGuardado => {
        const marcaReal = nombresActuales.find(nombre => {
            return normalizarTexto(nombre) === normalizarTexto(nombreGuardado);
        });

        if (marcaReal && !ordenFinal.includes(marcaReal)) {
            ordenFinal.push(marcaReal);
        }
    });

    nombresActuales.forEach(nombre => {
        if (!ordenFinal.includes(nombre)) {
            ordenFinal.push(nombre);
        }
    });

    const ordenAnterior = JSON.stringify(ordenGuardado);
    const ordenActualizado = JSON.stringify(ordenFinal);

    if (ordenAnterior !== ordenActualizado) {
        guardarOrdenMarcas(ordenFinal);
    }

    return ordenFinal;
}

function moverMarcaOrden(nombreMarca, direccion) {
    const productos = obtenerProductos();
    const orden = obtenerMarcasOrdenadas(productos);
    const indice = orden.findIndex(nombre => {
        return normalizarTexto(nombre) === normalizarTexto(nombreMarca);
    });

    if (indice < 0) return false;

    const nuevoIndice = indice + Number(direccion);

    if (nuevoIndice < 0 || nuevoIndice >= orden.length) {
        return false;
    }

    const temporal = orden[indice];
    orden[indice] = orden[nuevoIndice];
    orden[nuevoIndice] = temporal;

    return guardarOrdenMarcas(orden);
}

function buscarMarca(nombre, productos = obtenerProductos()) {
    const buscada = normalizarTexto(nombre);
    return Object.keys(productos).find(marca => normalizarTexto(marca) === buscada);
}

function agregarMarca(nombreMarca) {
    const nombre = String(nombreMarca || "").trim();
    const productos = obtenerProductos();

    if (!nombre || buscarMarca(nombre, productos)) return false;

    productos[nombre] = [];

    const guardado = guardarProductos(productos);

    if (guardado) {
        const orden = obtenerMarcasOrdenadas(productos);
        if (!orden.includes(nombre)) orden.push(nombre);
        guardarOrdenMarcas(orden);
    }

    return guardado;
}

function editarMarca(nombreAnterior, nombreNuevo) {
    const nuevoNombre = String(nombreNuevo || "").trim();
    const productos = obtenerProductos();
    const marcaReal = buscarMarca(nombreAnterior, productos);

    if (!marcaReal || !nuevoNombre) return false;

    const otraMarca = buscarMarca(nuevoNombre, productos);
    if (otraMarca && normalizarTexto(otraMarca) !== normalizarTexto(marcaReal)) {
        return false;
    }

    const ordenAntes = obtenerMarcasOrdenadas(productos);

    if (marcaReal !== nuevoNombre) {
        productos[nuevoNombre] = productos[marcaReal];
        delete productos[marcaReal];
    }

    const guardado = guardarProductos(productos);

    if (guardado && marcaReal !== nuevoNombre) {
        const orden = ordenAntes.map(nombre => {
            return normalizarTexto(nombre) === normalizarTexto(marcaReal)
                ? nuevoNombre
                : nombre;
        });

        guardarOrdenMarcas(orden);
    }

    return guardado;
}

function eliminarMarca(nombreMarca) {
    const productos = obtenerProductos();
    const marcaReal = buscarMarca(nombreMarca, productos);

    if (!marcaReal) return false;

    delete productos[marcaReal];

    const guardado = guardarProductos(productos);

    if (guardado) {
        const orden = obtenerMarcasOrdenadas(productos).filter(nombre => {
            return normalizarTexto(nombre) !== normalizarTexto(marcaReal);
        });

        guardarOrdenMarcas(orden);
    }

    return guardado;
}

function existeProductoEnMarca(marca, nombre, indiceExcluir = -1) {
    const productos = obtenerProductos();
    const marcaReal = buscarMarca(marca, productos);
    if (!marcaReal) return false;

    const buscado = normalizarTexto(nombre);
    return productos[marcaReal].some((producto, indice) =>
        indice !== indiceExcluir && normalizarTexto(producto.nombre) === buscado
    );
}

function agregarProducto(marca, producto) {
    const productos = obtenerProductos();
    const marcaReal = buscarMarca(marca, productos);
    const nombre = String(producto && producto.nombre || "").trim();

    if (!marcaReal || !nombre || existeProductoEnMarca(marcaReal, nombre)) return false;

    productos[marcaReal].push({
        nombre,
        precio: Number(producto.precio) || 0,
        imagen: String(producto.imagen || producto.foto || "")
    });

    return guardarProductos(productos);
}

function editarProducto(marca, indice, producto) {
    const productos = obtenerProductos();
    const marcaReal = buscarMarca(marca, productos);
    const nombre = String(producto && producto.nombre || "").trim();

    if (!marcaReal || !Number.isInteger(Number(indice)) || !productos[marcaReal][indice] || !nombre) {
        return false;
    }

    if (existeProductoEnMarca(marcaReal, nombre, Number(indice))) return false;

    const anterior = productos[marcaReal][indice];

    productos[marcaReal][indice] = {
        ...(tieneId(anterior) ? { id: anterior.id } : {}),
        nombre,
        precio: Number(producto.precio) || 0,
        imagen: String(producto.imagen || producto.foto || anterior.imagen || "")
    };

    return guardarProductos(productos);
}

function eliminarProducto(marca, indice) {
    const productos = obtenerProductos();
    const marcaReal = buscarMarca(marca, productos);

    if (!marcaReal || !productos[marcaReal][indice]) return false;

    productos[marcaReal].splice(indice, 1);
    return guardarProductos(productos);
}

// -----------------------------------------------------
// HISTORIAL
// -----------------------------------------------------

function obtenerHistorial() {
    let historial = leerColeccion("historial", []);

    if (!Array.isArray(historial)) historial = [];

    return historial.filter(registro => registro && typeof registro === "object");
}

function guardarHistorial(historial) {
    const lista = Array.isArray(historial) ? historial : [];
    asignarIdsFaltantes(lista, PREFIJO_ID_PEDIDO);
    return guardarColeccion("historial", lista);
}

function agregarHistorial(registro) {
    if (!registro || typeof registro !== "object") return false;

    const historial = obtenerHistorial();
    historial.unshift(registro);
    return guardarHistorial(historial);
}

// -----------------------------------------------------
// BORRADO TOTAL Y RESPALDO
// -----------------------------------------------------

function borrarTodosLosDatos() {
    // En modo nube no se borra nada: ni la nube ni este celular (T10).
    if (estaEnModoNube()) return false;

    Object.keys(localStorage)
        .filter(clave => clave.indexOf("vendefrio_") === 0)
        .forEach(clave => localStorage.removeItem(clave));

    memoriaDatos = {};
    return true;
}

function obtenerFechaDesdeClave(clave) {
    const valor = Number(localStorage.getItem(clave));

    if (!Number.isFinite(valor) || valor <= 0) return null;
    return new Date(valor);
}

function obtenerFechaUltimoRespaldo() {
    return obtenerFechaDesdeClave(DB_ULTIMO_RESPALDO);
}

function obtenerFechaUltimoRespaldoAutomatico() {
    return obtenerFechaDesdeClave(DB_ULTIMO_RESPALDO_AUTOMATICO);
}

function elegirFechaRespaldoMasReciente() {
    const fechas = [
        {
            fecha: obtenerFechaUltimoRespaldo(),
            tipo: "descargado"
        },
        {
            fecha: obtenerFechaUltimoRespaldoAutomatico(),
            tipo: "autom" + String.fromCodePoint(0xE1) + "tico"
        }
    ].filter(item => item.fecha && !Number.isNaN(item.fecha.getTime()));

    if (fechas.length === 0) return null;

    return fechas.sort((a, b) => b.fecha.getTime() - a.fecha.getTime())[0];
}

function actualizarEstadoRespaldo() {
    const elemento = document.getElementById("estadoRespaldo");
    if (!elemento) return;

    const respaldo = elegirFechaRespaldoMasReciente();
    const etiqueta =
        String.fromCodePoint(0xDA) +
        "ltimo respaldo";

    if (!respaldo) {
        elemento.textContent =
            etiqueta +
            ": todav" +
            String.fromCodePoint(0xED) +
            "a no se cre" +
            String.fromCodePoint(0xF3) +
            " ninguno.";
        elemento.classList.remove("respaldoActivo");
        return;
    }

    elemento.textContent =
        etiqueta +
        " (" +
        respaldo.tipo +
        "): " +
        respaldo.fecha.toLocaleString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    elemento.classList.add("respaldoActivo");
}

function guardarFechaUltimoRespaldo() {
    localStorage.setItem(DB_ULTIMO_RESPALDO, String(Date.now()));
    actualizarEstadoRespaldo();
}

function crearDatosRespaldo() {
    return {
        aplicacion: "VendeFr\u00edo",
        version: 1,
        fecha: new Date().toISOString(),
        datos: {
            comercios: clonarDatos(obtenerComercios()),
            productos: clonarDatos(obtenerProductos()),
            ordenMarcas: clonarDatos(obtenerMarcasOrdenadas()),
            historial: clonarDatos(obtenerHistorial()),
            rutasGuardadas: clonarDatos(obtenerRutasGuardadas())
        }
    };
}

function descargarArchivoRespaldo(respaldo, nombreArchivo) {
    const contenido = JSON.stringify(respaldo, null, 2);
    const archivo = new Blob([contenido], {
        type: "application/json"
    });

    const enlace = document.createElement("a");
    const url = URL.createObjectURL(archivo);

    enlace.href = url;
    enlace.download = nombreArchivo;
    enlace.style.display = "none";
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
}

function exportarRespaldo() {
    // Con la nube real se descargan los datos de la nube (T16b).
    if (usaNubeReal()) {
        exportarRespaldoNube();
        return;
    }

    if (frenarSiDatosNoSonLocales()) return;

    try {
        const respaldo = crearDatosRespaldo();
        const fecha = new Date().toISOString().slice(0, 10);

        descargarArchivoRespaldo(respaldo, `vendefrio-respaldo-${fecha}.json`);
        guardarFechaUltimoRespaldo();

        mostrarAviso(
            "Respaldo descargado",
            "Guard\u00e1 el archivo en un lugar seguro, como Google Drive."
        );
    } catch (error) {
        console.error("No se pudo exportar el respaldo.", error);
        mostrarAviso(
            "No se pudo exportar",
            "No se pudo crear el archivo de respaldo."
        );
    }
}

// -----------------------------------------------------
// RESPALDO DE LA NUBE (T16b)
// -----------------------------------------------------
// Con la nube real, "Exportar respaldo" descarga los datos de la nube (los
// mismos que ve la app) en un archivo que "Combinar respaldo" acepta. Solo
// el dueño exporta y combina, y exportar pide "Conectada" para que el
// archivo tenga lo último. La copia interna no se hace ni se ofrece.

// Devuelve true (y avisa) si el respaldo no se puede usar con la nube real:
// el empleado no lo usa y, si la nube no cargó, se mezclaría con los datos
// viejos del celular.
function frenarRespaldoEnLaNube() {
    if (!usaNubeReal()) return false;

    if (!esDuenoEnLaNube()) {
        mostrarAviso("Solo el dueño", "Los respaldos los maneja tu encargado.");
        return true;
    }

    if (!estaEnModoNube()) {
        mostrarAviso(
            "La nube no está disponible",
            "Para usar los respaldos tiene que cargar la nube. Cerrá y volvé a abrir la app con internet."
        );
        return true;
    }

    return false;
}

function obtenerFechaUltimoRespaldoNube() {
    return obtenerFechaDesdeClave(DB_ULTIMO_RESPALDO_NUBE);
}

function contarRegistrosRespaldo(respaldo) {
    const datos = respaldo.datos;

    return {
        comercios: datos.comercios.length,
        productos: listarProductosDeTodasLasMarcas(datos.productos).length,
        marcas: Object.keys(datos.productos).length,
        pedidos: datos.historial.length,
        rutas: datos.rutasGuardadas.length
    };
}

function exportarRespaldoNube() {
    if (frenarRespaldoEnLaNube()) return;

    const nube = window.nubeVendeFrio;

    if (!nube || nube.estado() !== "conectada" || !navigator.onLine) {
        mostrarAviso(
            "Todavía no",
            "Para que el archivo tenga lo último de la nube, esperá a que abajo diga \"Conectada\" y tocá de nuevo. Hace falta internet."
        );
        return;
    }

    try {
        // Mismo formato que el respaldo del celular (y que el de "Juntar
        // repetidos"): crearDatosRespaldo lee lo que ve la app, que es la nube.
        const respaldo = crearDatosRespaldo();
        const nombre = window.distribuidoraVendeFrio && window.distribuidoraVendeFrio.nombreActual();
        const fecha = new Date().toISOString().slice(0, 10);

        respaldo.origen = "nube";
        if (nombre) respaldo.distribuidora = nombre;

        descargarArchivoRespaldo(respaldo, `vendefrio-respaldo-nube-${fecha}.json`);
        localStorage.setItem(DB_ULTIMO_RESPALDO_NUBE, String(Date.now()));

        const total = contarRegistrosRespaldo(respaldo);
        mostrarAviso(
            "Respaldo de la nube descargado",
            "El archivo tiene:\n" +
                "- " + total.comercios + " comercio(s)\n" +
                "- " + total.productos + " producto(s) en " + total.marcas + " marca(s)\n" +
                "- " + total.pedidos + " pedido(s)\n" +
                "- " + total.rutas + " ruta(s)\n\n" +
                "Guardalo en un lugar seguro, como Google Drive. Para recuperar datos, usá \"Combinar respaldo\": agrega lo que falte, sin borrar nada."
        );
    } catch (error) {
        console.error("No se pudo exportar el respaldo de la nube.", error);
        mostrarAviso(
            "No se pudo exportar",
            "No se pudo crear el archivo de respaldo."
        );
    }
}

// Recordatorio: si pasaron 7 días desde la última descarga en este celular
// (o nunca se descargó), el dueño ve un aviso con "Descargar ahora", como
// máximo una vez por día. Se muestra al conectar, así el botón funciona.

function obtenerClaveDeHoy() {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, "0");
    const dia = String(hoy.getDate()).padStart(2, "0");
    return hoy.getFullYear() + "-" + mes + "-" + dia;
}

function mostrarRecordatorioRespaldoNube(ultimo) {
    let modal = document.getElementById("modalRecordatorioRespaldo");

    if (!modal) {
        modal = document.createElement("div");
        modal.id = "modalRecordatorioRespaldo";
        modal.className = "modal oculto";
        modal.innerHTML = `
            <div class="modalContenido">
                <h2>Descargá un respaldo</h2>
                <p id="mensajeRecordatorioRespaldo" style="text-align:center;line-height:1.5;"></p>
                <div class="modalBotones">
                    <button type="button" class="btnModalCancelar" data-recordatorio="ahoraNo">Ahora no</button>
                    <button type="button" class="btnModalConfirmar" data-recordatorio="descargar">Descargar ahora</button>
                </div>
            </div>
        `;

        modal.addEventListener("click", event => {
            const boton = event.target.closest("[data-recordatorio]");
            if (!boton && event.target !== modal) return;

            modal.classList.add("oculto");
            if (boton && boton.dataset.recordatorio === "descargar") exportarRespaldo();
        });

        document.body.appendChild(modal);
    }

    const dias = ultimo ? Math.floor((Date.now() - ultimo.getTime()) / (24 * 60 * 60 * 1000)) : 0;

    document.getElementById("mensajeRecordatorioRespaldo").textContent =
        (ultimo
            ? "Pasaron " + dias + " días desde el último respaldo de la nube que descargaste en este celular."
            : "Todavía no descargaste un respaldo de la nube en este celular.") +
        " Guardalo en un lugar seguro, como Google Drive, por si algún día hace falta recuperar datos.";
    modal.classList.remove("oculto");
}

function revisarRecordatorioRespaldoNube() {
    if (!esDuenoEnLaNube() || !estaEnModoNube() || !document.body) return;
    // T61: el recordatorio es un aviso en Inicio (confianza.js), sin tapar la app.
    if (window.confianzaVendeFrio) {
        window.confianzaVendeFrio.dibujarAvisos();
        return;
    }
    if (!window.nubeVendeFrio || window.nubeVendeFrio.estado() !== "conectada") return;
    if (document.documentElement.classList.contains("inicioAbierto")) return;

    try {
        const hoy = obtenerClaveDeHoy();
        if (localStorage.getItem(DB_RECORDATORIO_RESPALDO_NUBE) === hoy) return;

        const ultimo = obtenerFechaUltimoRespaldoNube();
        const intervalo = DIAS_PARA_RECORDAR_RESPALDO_NUBE * 24 * 60 * 60 * 1000;
        if (ultimo && Date.now() - ultimo.getTime() < intervalo) return;

        // Con la nube vacía no hay nada que respaldar.
        const total = contarRegistrosRespaldo(crearDatosRespaldo());
        if (!total.comercios && !total.productos && !total.pedidos && !total.rutas) return;

        localStorage.setItem(DB_RECORDATORIO_RESPALDO_NUBE, hoy);
        mostrarRecordatorioRespaldoNube(ultimo);
    } catch (error) {
        console.warn("No se pudo revisar el recordatorio del respaldo.", error);
    }
}

function prepararRecordatorioRespaldoNube() {
    if (!usaNubeReal()) return;

    // nube.js se carga después de database.js.
    const conectar = () => {
        window.nubeVendeFrio.escuchar(estado => {
            if (estado !== "conectada") return;
            // Un momento después de conectar, para no tapar la app mientras se dibuja.
            window.setTimeout(revisarRecordatorioRespaldoNube, 1500);
        });
    };

    if (window.nubeVendeFrio) {
        conectar();
    } else {
        window.addEventListener("nubeVendeFrioLista", conectar, { once: true });
    }
}

// -----------------------------------------------------
// LIMPIEZA DE LOS DATOS VIEJOS DEL CELULAR (T16e)
// -----------------------------------------------------
// Con la nube, los datos de antes siguen en localStorage sin usarse. Solo el
// dueño los borra, en tres pasos: descargar un archivo con todo, revisar con
// internet qué está en la nube (nube.js) y borrar con confirmación. Si algo
// falta en la nube, se muestra y se deja borrar igual: queda en el archivo,
// y "Combinar respaldo" lo puede recuperar (decidido con el dueño el
// 2026-10-11). La nube no se toca.

// Datos viejos: comercios, productos, marcas, pedidos, rutas y la copia
// interna (con su fecha).
const CLAVES_DATOS_VIEJOS = [
    DB_COMERCIOS,
    DB_PRODUCTOS,
    DB_ORDEN_MARCAS,
    DB_HISTORIAL,
    DB_RUTAS_GUARDADAS,
    DB_RESPALDO_AUTOMATICO,
    DB_ULTIMO_RESPALDO_AUTOMATICO
];
// Se borran junto con los datos viejos (decidido con el dueño): la marca de
// la subida a medias y el borrador del modo prueba, que se sacó en T16c.
// "vendefrio_migracion_resuelta" queda: la app la vuelve a escribir al abrir.
const CLAVES_SIN_USO_CON_DATOS_VIEJOS = [
    DB_SUBIDA_EMPEZADA,
    "vendefrio_borrador_pedido_prueba"
];

function puedeLimpiarDatosViejos() {
    return usaNubeReal() && esDuenoEnLaNube() && estaEnModoNube();
}

function celularTieneDatosViejos() {
    try {
        return CLAVES_DATOS_VIEJOS.some(clave => localStorage.getItem(clave) !== null);
    } catch (error) {
        return false;
    }
}

// Lee los datos viejos directo de localStorage (la capa de datos ya lee la
// nube). "firma" es el texto guardado: si cambia, hay que volver a descargar.
function leerDatosViejosDelCelular() {
    const textos = {};
    const sinLeer = {};

    CLAVES_DATOS_VIEJOS.forEach(clave => {
        textos[clave] = localStorage.getItem(clave);
    });

    const leer = (clave, esValido, vacio) => {
        const texto = textos[clave];
        if (texto === null) return vacio;

        try {
            const datos = JSON.parse(texto);
            if (esValido(datos)) return datos;
        } catch (error) {
            // Se guarda tal cual en el archivo, más abajo.
        }

        sinLeer[clave] = texto;
        return vacio;
    };

    const esLista = datos => Array.isArray(datos);
    const esObjeto = datos => Boolean(datos) && typeof datos === "object" && !Array.isArray(datos);
    const productos = leer(DB_PRODUCTOS, esObjeto, {});

    Object.keys(productos).forEach(marca => {
        if (!Array.isArray(productos[marca])) productos[marca] = [];
    });

    return {
        firma: JSON.stringify(textos),
        datos: {
            comercios: leer(DB_COMERCIOS, esLista, []),
            productos,
            ordenMarcas: leer(DB_ORDEN_MARCAS, esLista, []),
            historial: leer(DB_HISTORIAL, esLista, []),
            rutasGuardadas: leer(DB_RUTAS_GUARDADAS, esLista, [])
        },
        copiaInterna: leer(DB_RESPALDO_AUTOMATICO, esObjeto, null),
        sinLeer
    };
}

// Paso 1: archivo con todo, en el formato del respaldo, así "Combinar
// respaldo" lo acepta. Devuelve la firma de lo descargado, o null.
function descargarDatosViejosDelCelular() {
    try {
        const viejos = leerDatosViejosDelCelular();
        const respaldo = {
            aplicacion: "VendeFrío",
            version: 1,
            fecha: new Date().toISOString(),
            origen: "celular",
            datos: viejos.datos
        };

        if (viejos.copiaInterna) respaldo.copiaInterna = viejos.copiaInterna;
        if (Object.keys(viejos.sinLeer).length) respaldo.sinLeer = viejos.sinLeer;

        const fecha = new Date().toISOString().slice(0, 10);
        descargarArchivoRespaldo(respaldo, `vendefrio-datos-viejos-celular-${fecha}.json`);
        return viejos.firma;
    } catch (error) {
        console.error("No se pudo descargar el archivo con los datos viejos.", error);
        mostrarAviso("No se pudo descargar", "No se pudo crear el archivo con los datos viejos de este celular.");
        return null;
    }
}

// Paso 3: borra los datos viejos. Quedan las preferencias, el borrador del
// pedido, la sesión, el modo personal y las fechas de respaldo.
function borrarDatosViejosDelCelular() {
    if (!puedeLimpiarDatosViejos()) return false;

    try {
        CLAVES_DATOS_VIEJOS.concat(CLAVES_SIN_USO_CON_DATOS_VIEJOS)
            .forEach(clave => localStorage.removeItem(clave));
        return true;
    } catch (error) {
        console.error("No se pudieron borrar los datos viejos del celular.", error);
        return false;
    }
}

function guardarRespaldoAutomatico() {
    // La copia interna es de los datos de este celular.
    if (obtenerNombreAdaptadorDatos() !== "local") return false;
    // Con la nube real no se hace (T16b): copiaría los datos viejos del celular.
    if (usaNubeReal()) return false;

    try {
        const respaldo = crearDatosRespaldo();
        localStorage.setItem(
            DB_RESPALDO_AUTOMATICO,
            JSON.stringify(respaldo)
        );
        localStorage.setItem(
            DB_ULTIMO_RESPALDO_AUTOMATICO,
            String(Date.now())
        );
        actualizarEstadoRespaldo();
        return true;
    } catch (error) {
        console.warn("No se pudo crear el respaldo automatico.", error);
        return false;
    }
}

function respaldarAutomaticamenteSiCorresponde() {
    const ultimo = obtenerFechaUltimoRespaldoAutomatico();
    const intervalo = DIAS_ENTRE_RESPALDOS_AUTOMATICOS * 24 * 60 * 60 * 1000;
    const corresponde = !ultimo || Date.now() - ultimo.getTime() >= intervalo;

    if (corresponde) {
        guardarRespaldoAutomatico();
    }
}

function validarRespaldo(respaldo) {
    if (!respaldo || typeof respaldo !== "object") {
        return false;
    }

    const aplicacionValida =
        respaldo.aplicacion === "VendeFr\u00edo" ||
        respaldo.aplicacion === "VendeFr\u00edo Lite";

    if (!aplicacionValida) {
        return false;
    }

    const datos = respaldo.datos;

    return Boolean(
        datos &&
        typeof datos === "object" &&
        Array.isArray(datos.comercios) &&
        datos.productos &&
        typeof datos.productos === "object" &&
        !Array.isArray(datos.productos) &&
        Array.isArray(datos.historial)
    );
}

function restaurarRespaldo(respaldo) {
    // En modo nube restaurar reemplazar\u00eda los datos de todos: solo se
    // combina (combinarRespaldoSinBorrar). T10.
    if (estaEnModoNube()) {
        console.error("En modo nube no se restaura reemplazando: solo se combina.");
        return false;
    }

    const datos = respaldo.datos;
    // Foto de cómo estaban los datos, para volver atrás si algo falla.
    const anteriores = COLECCIONES_COMPARTIDAS.map(coleccion => ({
        coleccion,
        ...cargarColeccion(coleccion)
    }));

    const ordenMarcas = Array.isArray(datos.ordenMarcas)
        ? datos.ordenMarcas
        : Object.keys(datos.productos);

    // Los respaldos viejos no traen ids: se completan sin tocar los que ya vienen.
    asignarIdsFaltantes(datos.comercios, PREFIJO_ID_COMERCIO);
    asignarIdsProductos(datos.productos);
    asignarIdsFaltantes(datos.historial, PREFIJO_ID_PEDIDO);
    asignarIdsFaltantes(datos.rutasGuardadas, PREFIJO_ID_RUTA);

    const guardado =
        guardarColeccion("comercios", datos.comercios) &&
        guardarColeccion("productos", datos.productos) &&
        guardarColeccion("ordenMarcas", ordenMarcas) &&
        guardarColeccion("historial", datos.historial) &&
        guardarColeccion(
            "rutasGuardadas",
            Array.isArray(datos.rutasGuardadas) ? datos.rutasGuardadas : []
        );

    if (!guardado) {
        try {
            // Lo que estaba dañado (texto null) no se puede volver a escribir.
            anteriores.forEach(({ coleccion, existe, texto }) => {
                if (!existe) {
                    adaptadorDatos.borrar(coleccion);
                } else if (texto !== null) {
                    adaptadorDatos.guardar(coleccion, JSON.parse(texto), texto);
                }
            });
        } catch (error) {
            console.error("No se pudo recuperar el estado anterior.", error);
        }

        olvidarColeccionesEnMemoria(COLECCIONES_COMPARTIDAS);
        return false;
    }

    return true;
}

function importarRespaldoDesdeArchivo(archivo) {
    if (!archivo) return;

    // En modo nube "Importar" solo combina, sin borrar nada (T10). Con la nube
    // real, también si todavía no cargó: ahí combinar se frena (T16b).
    if (estaEnModoNube() || usaNubeReal()) {
        importarYCombinarRespaldoDesdeArchivo(archivo);
        return;
    }

    const lector = new FileReader();

    lector.onload = () => {
        let respaldo;

        try {
            respaldo = JSON.parse(lector.result);
        } catch (error) {
            mostrarAviso(
                "Archivo inv\u00e1lido",
                "El archivo no tiene un formato JSON v\u00e1lido."
            );
            return;
        }

        if (!validarRespaldo(respaldo)) {
            mostrarAviso(
                "Respaldo no reconocido",
                "Eleg\u00ed un archivo de respaldo creado por VendeFr\u00edo."
            );
            return;
        }

        const cantidadComercios = respaldo.datos.comercios.length;
        const cantidadMarcas = Object.keys(respaldo.datos.productos).length;
        const cantidadPedidos = respaldo.datos.historial.length;
        const mensaje =
            `Se reemplazar\u00e1n los datos actuales por el respaldo.\n\n` +
            `Comercios: ${cantidadComercios}\n` +
            `Marcas: ${cantidadMarcas}\n` +
            `Pedidos guardados: ${cantidadPedidos}`;

        const aplicar = () => {
            if (!restaurarRespaldo(respaldo)) {
                return;
            }

            mostrarAviso(
                "Respaldo restaurado",
                "La aplicaci\u00f3n se actualizar\u00e1 para mostrar los datos recuperados."
            );

            window.setTimeout(() => {
                window.location.reload();
            }, 1200);
        };

        if (typeof abrirConfirmacion === "function") {
            abrirConfirmacion(
                "Importar respaldo",
                mensaje,
                aplicar
            );
        } else {
            mostrarAviso(
                "No se pudo confirmar",
                "El modal de confirmaci\u00f3n no est\u00e1 disponible."
            );
        }
    };

    lector.onerror = () => {
        mostrarAviso(
            "No se pudo leer el archivo",
            "Prob\u00e1 nuevamente con otro archivo de respaldo."
        );
    };

    lector.readAsText(archivo);
}

function obtenerClavePedidoRespaldo(registro) {
    return [
        registro && registro.timestamp || "",
        normalizarTexto(registro && registro.comercio),
        registro && registro.pedido || "",
        JSON.stringify(registro && registro.productos || [])
    ].join("|");
}

function obtenerIdsDeRegistros(registros) {
    return new Set(
        (Array.isArray(registros) ? registros : [])
            .filter(tieneId)
            .map(registro => registro.id)
    );
}

function combinarProductosRespaldo(productosActuales, productosNuevos) {
    const resultado = clonarDatos(productosActuales || {});
    const idsActuales = obtenerIdsDeRegistros(listarProductosDeTodasLasMarcas(resultado));

    Object.entries(productosNuevos || {}).forEach(([marca, lista]) => {
        const marcaActual = Object.keys(resultado).find(nombre => {
            return normalizarTexto(nombre) === normalizarTexto(marca);
        });
        const nombreMarca = marcaActual || marca;
        if (!Array.isArray(resultado[nombreMarca])) resultado[nombreMarca] = [];

        (Array.isArray(lista) ? lista : []).forEach(producto => {
            if (!producto || typeof producto !== "object") return;
            if (tieneId(producto) && idsActuales.has(producto.id)) return;

            const repetido = resultado[nombreMarca].some(actual => {
                return normalizarTexto(actual && actual.nombre) === normalizarTexto(producto.nombre);
            });

            if (!repetido) {
                resultado[nombreMarca].push(producto);
                if (tieneId(producto)) idsActuales.add(producto.id);
            }
        });
    });

    return resultado;
}

function combinarRespaldoSinBorrar(respaldo) {
    const datosNuevos = respaldo.datos;
    const comerciosActuales = obtenerComercios();
    const comerciosNuevos = Array.isArray(datosNuevos.comercios)
        ? datosNuevos.comercios
        : [];
    const nombresActuales = new Set(
        comerciosActuales.map(comercio => normalizarTexto(comercio.nombre))
    );
    const idsComercios = obtenerIdsDeRegistros(comerciosActuales);
    const comerciosAgregados = comerciosNuevos.filter(comercio => {
        if (!comercio || typeof comercio !== "object") return false;
        if (tieneId(comercio) && idsComercios.has(comercio.id)) return false;

        const nombre = normalizarTexto(comercio.nombre);
        if (nombresActuales.has(nombre)) return false;

        nombresActuales.add(nombre);
        if (tieneId(comercio)) idsComercios.add(comercio.id);
        return true;
    });

    const historialActual = obtenerHistorial();
    const clavesHistorial = new Set(historialActual.map(obtenerClavePedidoRespaldo));
    const idsPedidos = obtenerIdsDeRegistros(historialActual);
    const pedidosNuevos = (Array.isArray(datosNuevos.historial) ? datosNuevos.historial : [])
        .filter(registro => {
            if (!registro || typeof registro !== "object") return false;
            if (tieneId(registro) && idsPedidos.has(registro.id)) return false;

            const clave = obtenerClavePedidoRespaldo(registro);
            if (clavesHistorial.has(clave)) return false;
            clavesHistorial.add(clave);
            if (tieneId(registro)) idsPedidos.add(registro.id);
            return true;
        });

    const productosCombinados = combinarProductosRespaldo(
        obtenerProductos(),
        datosNuevos.productos
    );
    const marcasActuales = obtenerMarcasOrdenadas();
    const marcasNuevas = Array.isArray(datosNuevos.ordenMarcas)
        ? datosNuevos.ordenMarcas
        : Object.keys(datosNuevos.productos || {});
    const ordenMarcas = [...marcasActuales];
    marcasNuevas.forEach(marca => {
        if (!ordenMarcas.some(actual => normalizarTexto(actual) === normalizarTexto(marca))) {
            ordenMarcas.push(marca);
        }
    });

    const rutasActuales = obtenerRutasGuardadas();
    const nombresRutas = new Set(rutasActuales.map(ruta => normalizarTexto(ruta.nombre)));
    const idsRutas = obtenerIdsDeRegistros(rutasActuales);
    const rutasNuevas = (Array.isArray(datosNuevos.rutasGuardadas) ? datosNuevos.rutasGuardadas : [])
        .filter(ruta => {
            if (tieneId(ruta) && idsRutas.has(ruta.id)) return false;

            const clave = normalizarTexto(ruta && ruta.nombre);
            if (!clave || nombresRutas.has(clave)) return false;
            nombresRutas.add(clave);
            if (tieneId(ruta)) idsRutas.add(ruta.id);
            return true;
        });

    // Las funciones de guardado completan los ids de lo que llega de respaldos viejos.
    const guardado =
        guardarComercios(comerciosActuales.concat(comerciosAgregados)) &&
        guardarProductos(productosCombinados) &&
        guardarColeccion("ordenMarcas", ordenMarcas) &&
        guardarHistorial(historialActual.concat(pedidosNuevos)) &&
        guardarRutasGuardadas(rutasActuales.concat(rutasNuevas));

    return {
        guardado,
        comerciosAgregados: comerciosAgregados.length,
        pedidosAgregados: pedidosNuevos.length,
        marcasAgregadas: Math.max(0, Object.keys(productosCombinados).length - Object.keys(obtenerProductos()).length),
        rutasAgregadas: rutasNuevas.length
    };
}

function importarYCombinarRespaldoDesdeArchivo(archivo) {
    if (!archivo) return;
    if (frenarRespaldoEnLaNube()) return;

    const lector = new FileReader();
    lector.onload = () => {
        let respaldo;
        try {
            respaldo = JSON.parse(lector.result);
        } catch (error) {
            mostrarAviso("Archivo inv\u00e1lido", "El archivo no tiene un formato JSON v\u00e1lido.");
            return;
        }

        if (!validarRespaldo(respaldo)) {
            mostrarAviso("Respaldo no reconocido", "Eleg\u00ed un archivo creado por VendeFr\u00edo.");
            return;
        }

        const mensaje =
            (estaEnModoNube()
                ? "En la nube no se reemplazan datos: el archivo se combina con lo que ya hay, sin borrar nada.\n\n"
                : "Se combinar\u00e1 con los datos actuales sin borrar nada.\n\n") +
            "Pedidos del archivo: " + respaldo.datos.historial.length + "\n" +
            "Comercios del archivo: " + respaldo.datos.comercios.length + "\n\n" +
            "Los datos actuales de VendeFr\u00edo tendr\u00e1n prioridad.";

        const aplicar = () => {
            guardarRespaldoAutomatico();
            const resultado = combinarRespaldoSinBorrar(respaldo);
            if (!resultado.guardado) {
                mostrarAviso("No se pudo combinar", "Los datos no se pudieron guardar completos.");
                return;
            }

            mostrarAviso(
                "Datos combinados",
                "Se agregaron:\n" +
                    "- " + resultado.pedidosAgregados + " pedido(s)\n" +
                    "- " + resultado.comerciosAgregados + " comercio(s)\n" +
                    "- " + resultado.rutasAgregadas + " ruta(s)\n\n" +
                    "Los datos actuales se conservaron."
            );

            // En la nube no se recarga: las escrituras siguen su curso y las
            // pantallas se redibujan con los datos combinados.
            if (estaEnModoNube()) {
                avisarCambioDatos(COLECCIONES_COMPARTIDAS, true);
                return;
            }

            window.setTimeout(() => window.location.reload(), 1500);
        };

        if (typeof abrirConfirmacion === "function") {
            abrirConfirmacion("Combinar respaldo", mensaje, aplicar);
        } else {
            mostrarAviso("No se pudo confirmar", "El modal de confirmaci\u00f3n no est\u00e1 disponible.");
        }
    };
    lector.onerror = () => mostrarAviso("No se pudo leer el archivo", "Prob\u00e1 nuevamente.");
    lector.readAsText(archivo);
}

function crearControlCombinarRespaldo(botonImportar) {
    if (!botonImportar || document.getElementById("combinarRespaldo")) return;

    const boton = document.createElement("button");
    boton.id = "combinarRespaldo";
    boton.type = "button";
    boton.className = "btnAccion ver";
    boton.style.justifyContent = "center";
    boton.style.margin = "0";
    boton.textContent = "Importar y combinar respaldo";

    const archivo = document.createElement("input");
    archivo.id = "archivoRespaldoFusion";
    archivo.type = "file";
    archivo.accept = "application/json,.json";
    archivo.style.display = "none";

    boton.addEventListener("click", () => archivo.click());
    archivo.addEventListener("change", () => {
        importarYCombinarRespaldoDesdeArchivo(archivo.files[0]);
        archivo.value = "";
    });

    botonImportar.insertAdjacentElement("afterend", boton);
    boton.insertAdjacentElement("afterend", archivo);
}

function prepararControlesRespaldo() {
    actualizarEstadoRespaldo();

    const botonExportar = document.getElementById("exportarRespaldo");
    const botonImportar = document.getElementById("importarRespaldo");
    const archivoRespaldo = document.getElementById("archivoRespaldo");
    const modalAviso = document.getElementById("modalAviso");
    const cerrarAviso = document.getElementById("cerrarAviso");

    crearControlCombinarRespaldo(botonImportar);

    if (cerrarAviso && !cerrarAviso.dataset.configurado) {
        cerrarAviso.addEventListener("click", () => {
            if (modalAviso) modalAviso.classList.add("oculto");
        });

        cerrarAviso.dataset.configurado = "true";
    }

    if (modalAviso && !modalAviso.dataset.configurado) {
        modalAviso.addEventListener("click", event => {
            if (event.target === modalAviso) {
                modalAviso.classList.add("oculto");
            }
        });

        modalAviso.dataset.configurado = "true";
    }

    if (botonExportar) {
        botonExportar.addEventListener("click", exportarRespaldo);
    }

    if (botonImportar && archivoRespaldo) {
        botonImportar.addEventListener("click", () => {
            archivoRespaldo.click();
        });

        archivoRespaldo.addEventListener("change", () => {
            importarRespaldoDesdeArchivo(archivoRespaldo.files[0]);
            archivoRespaldo.value = "";
        });
    }

    const botonBorrarTodos = document.getElementById("borrarTodosDatos");

    if (botonBorrarTodos && !botonBorrarTodos.dataset.configurado) {
        botonBorrarTodos.addEventListener("click", () => {
            if (estaEnModoNube()) {
                mostrarAviso(
                    "No disponible en la nube",
                    "\"Borrar todos los datos\" no borra nada de la nube: los datos son de toda la distribuidora. Para borrar un comercio, producto, pedido o ruta, hacelo uno por uno desde su pantalla."
                );
                return;
            }

            const borrar = () => {
                if (!borrarTodosLosDatos()) return;
                window.location.reload();
            };

            if (typeof abrirConfirmacion === "function") {
                abrirConfirmacion(
                    "Borrar todos los datos",
                    "Se eliminaran pedidos, comercios personalizados, productos, rutas, borradores y respaldos guardados. La aplicacion volvera a sus datos iniciales.",
                    borrar
                );
                return;
            }

            mostrarAviso(
                "No se pudo confirmar",
                "El modal de confirmacion no esta disponible."
            );
        });

        botonBorrarTodos.dataset.configurado = "true";
    }
}

function obtenerRutasGuardadas() {
    const rutas = leerColeccion("rutasGuardadas", []);
    return Array.isArray(rutas)
        ? rutas.filter(ruta => ruta && ruta.nombre && Array.isArray(ruta.comercios))
        : [];
}

function guardarRutasGuardadas(rutas) {
    const lista = Array.isArray(rutas) ? rutas : [];
    asignarIdsFaltantes(lista, PREFIJO_ID_RUTA);
    completarIdsComerciosDeRutas(lista);
    return guardarColeccion("rutasGuardadas", lista);
}

// -----------------------------------------------------
// FUNCIONES POR ID (T4)
// -----------------------------------------------------
// Obtener, agregar, actualizar y eliminar un registro por su id.
// Las funciones viejas (por nombre o posición) siguen existiendo.
// Lo que devuelven las funciones "obtener...PorId" es una copia:
// cambiarla no cambia los datos guardados.

function generarIdNuevo(prefijo, registros) {
    const usados = obtenerIdsDeRegistros(registros);
    let id = generarId(prefijo);
    while (usados.has(id)) id = generarId(prefijo);
    return id;
}

function buscarIndicePorId(registros, id) {
    if (!id) return -1;
    return registros.findIndex(registro => tieneId(registro) && registro.id === id);
}

// --- Comercios ---

function existeOtroComercioConNombre(nombre, idExcluir) {
    const buscado = normalizarTexto(nombre);
    return obtenerComercios().some(comercio =>
        comercio.id !== idExcluir && normalizarTexto(comercio.nombre) === buscado
    );
}

// Devuelve el id del comercio nuevo, o "" si no se pudo agregar.
function agregarComercioConId(comercio) {
    const nombre = String(comercio && comercio.nombre || "").trim();
    if (!nombre || existeOtroComercioConNombre(nombre, "")) return "";

    const comercios = obtenerComercios();
    const id = generarIdNuevo(PREFIJO_ID_COMERCIO, comercios);

    comercios.push({
        id,
        nombre,
        direccion: String(comercio.direccion || "").trim(),
        enlaceMaps: String(comercio.enlaceMaps || "").trim(),
        origenGps: String(comercio.origenGps || ""),
        telefono: String(comercio.telefono || "").trim(),
        lat: comercio.lat !== undefined ? comercio.lat : "",
        lng: comercio.lng !== undefined ? comercio.lng : "",
        pedidosRealizados: Number(comercio.pedidosRealizados) || 0,
        ultimaVisita: comercio.ultimaVisita || "",
        pendienteSemana: comercio.pendienteSemana === true
    });

    return guardarComercios(comercios) ? id : "";
}

// Cambia solo los campos que vienen en "datos". El id nunca cambia.
// Si cambia el nombre, las rutas guardadas que tienen este comercio
// pasan a mostrar el nombre nuevo.
function actualizarComercioPorId(id, datos) {
    const comercios = obtenerComercios();
    const indice = buscarIndicePorId(comercios, id);
    if (indice === -1 || !datos || typeof datos !== "object") return false;

    const anterior = comercios[indice];
    const nombreNuevo = String(
        datos.nombre !== undefined ? datos.nombre : anterior.nombre
    ).trim();

    if (!nombreNuevo || existeOtroComercioConNombre(nombreNuevo, id)) return false;

    comercios[indice] = {
        ...anterior,
        ...datos,
        id,
        nombre: nombreNuevo,
        direccion: String(datos.direccion !== undefined ? datos.direccion : (anterior.direccion || "")).trim(),
        enlaceMaps: String(datos.enlaceMaps !== undefined ? datos.enlaceMaps : (anterior.enlaceMaps || "")).trim(),
        telefono: String(datos.telefono !== undefined ? datos.telefono : (anterior.telefono || "")).trim()
    };

    if (!guardarComercios(comercios)) return false;

    if (nombreNuevo !== anterior.nombre) {
        renombrarComercioEnRutas(id, nombreNuevo);
    }

    return true;
}

function eliminarComercioPorId(id) {
    const comercios = obtenerComercios();
    const indice = buscarIndicePorId(comercios, id);
    if (indice === -1) return false;

    comercios.splice(indice, 1);
    return guardarComercios(comercios);
}

// --- Productos ---

// Devuelve { marca, indice, producto } o null si no existe.
function obtenerProductoPorId(id) {
    const productos = obtenerProductos();

    for (const marca of Object.keys(productos)) {
        const indice = buscarIndicePorId(productos[marca], id);
        if (indice !== -1) {
            return {
                marca,
                indice,
                producto: clonarDatos(productos[marca][indice])
            };
        }
    }

    return null;
}

// Devuelve el id del producto nuevo, o "" si no se pudo agregar.
function agregarProductoConId(marca, producto) {
    const productos = obtenerProductos();
    const marcaReal = buscarMarca(marca, productos);
    const nombre = String(producto && producto.nombre || "").trim();

    if (!marcaReal || !nombre || existeProductoEnMarca(marcaReal, nombre)) return "";

    const id = generarIdNuevo(
        PREFIJO_ID_PRODUCTO,
        listarProductosDeTodasLasMarcas(productos)
    );

    productos[marcaReal].push({
        ...camposExtraDeProducto(producto),
        id,
        nombre,
        precio: Number(producto.precio) || 0,
        imagen: String(producto.imagen || producto.foto || "")
    });

    return guardarProductos(productos) ? id : "";
}

// Cambia nombre, precio o imagen. El id y la marca no cambian.
function actualizarProductoPorId(id, datos) {
    const encontrado = obtenerProductoPorId(id);
    if (!encontrado || !datos || typeof datos !== "object") return false;

    const productos = obtenerProductos();
    const { marca, indice } = encontrado;
    const anterior = productos[marca][indice];
    const nombre = String(
        datos.nombre !== undefined ? datos.nombre : anterior.nombre
    ).trim();

    if (!nombre || existeProductoEnMarca(marca, nombre, indice)) return false;

    productos[marca][indice] = {
        ...camposExtraDeProducto(anterior),
        ...camposExtraDeProducto(datos),
        id,
        nombre,
        precio: datos.precio !== undefined
            ? Number(datos.precio) || 0
            : anterior.precio,
        imagen: datos.imagen !== undefined || datos.foto !== undefined
            ? String(datos.imagen || datos.foto || "")
            : anterior.imagen
    };

    return guardarProductos(productos);
}

function eliminarProductoPorId(id) {
    const encontrado = obtenerProductoPorId(id);
    if (!encontrado) return false;

    const productos = obtenerProductos();
    productos[encontrado.marca].splice(encontrado.indice, 1);
    return guardarProductos(productos);
}

// --- Pedidos (historial) ---

// Agrega el pedido al principio del historial, igual que agregarHistorial.
// Devuelve el id del pedido nuevo, o "" si no se pudo agregar.
function agregarPedidoConId(registro) {
    if (!registro || typeof registro !== "object") return "";

    const historial = obtenerHistorial();
    const id = generarIdNuevo(PREFIJO_ID_PEDIDO, historial);

    historial.unshift({ ...clonarDatos(registro), id });
    return guardarHistorial(historial) ? id : "";
}

// Cambia solo los campos que vienen en "datos". El id nunca cambia.
function eliminarPedidoPorId(id) {
    const historial = obtenerHistorial();
    const indice = buscarIndicePorId(historial, id);
    if (indice === -1) return false;

    historial.splice(indice, 1);
    return guardarHistorial(historial);
}

// --- Pedido completo (T20) ---
// Solo en la nube (con cuenta o con código): cada pedido nuevo nace
// "Cargado", con su autor, un id por línea, el precio de cada producto en ese
// momento y la primera entrada del historial de estados. El modo personal
// sigue igual. En la nube, un pedido sin historial de estados (los subidos
// con T11 y los cargados antes de T20) es "Histórico".
//
// Historial de estados (campo "estados"): un mapa que solo se agrega, con
// una entrada por cambio: { estado, persona: { idPersona, nombre, uid },
// horaCelular, nota }. El estado actual es el de la entrada más nueva según
// la hora en que se hizo. El campo "estado" guarda una copia para leerlo
// rápido: si dos cambios llegan desordenados, manda el historial.
//
// Pasos más cortos (T29b): "Cargado en el vehículo" ya no se usa. Un pedido
// que quedó en ese estado se ve y se maneja como "En reparto" (el estado
// actual lo dice así); su historial no cambia y sigue mostrando ese paso.

const ESTADOS_PEDIDO = [
    { id: "cargado", nombre: "Cargado" },
    { id: "enPreparacion", nombre: "En preparación" },
    { id: "preparado", nombre: "Preparado" },
    { id: "enVehiculo", nombre: "Cargado en el vehículo" },
    { id: "enReparto", nombre: "En reparto" },
    { id: "entregado", nombre: "Entregado" },
    { id: "cancelado", nombre: "Cancelado" }
];
const ESTADO_PEDIDO_INICIAL = "cargado";
const PREFIJO_ID_LINEA = "lin";
const PREFIJO_ID_ESTADO = "est";
const LARGO_MAXIMO_NOMBRE_PERSONA = 60;
const LARGO_MAXIMO_NOTA_ESTADO = 300;

function nombreDeEstadoPedido(id) {
    const estado = ESTADOS_PEDIDO.find(item => item.id === id);
    return estado ? estado.nombre : "";
}

function pedidoTieneEstados(pedido) {
    const estados = pedido && pedido.estados;
    return Boolean(estados) && typeof estados === "object" && !Array.isArray(estados) &&
        Object.keys(estados).length > 0;
}

// Id del estado actual: el de la entrada más nueva según la hora en que se
// hizo (si empatan, la de id mayor, así da igual en todos los celulares).
// "" si el pedido no tiene historial de estados.
function estadoActualDelPedido(pedido) {
    if (!pedidoTieneEstados(pedido)) return "";

    let elegida = null;
    let idElegida = "";

    Object.keys(pedido.estados).forEach(id => {
        const entrada = pedido.estados[id];
        if (!entrada || typeof entrada !== "object") return;

        const hora = Number(entrada.horaCelular) || 0;
        const horaElegida = elegida ? Number(elegida.horaCelular) || 0 : -Infinity;

        if (hora > horaElegida || (hora === horaElegida && id > idElegida)) {
            elegida = entrada;
            idElegida = id;
        }
    });

    const estado = elegida ? String(elegida.estado || "") : "";
    return estado === "enVehiculo" ? "enReparto" : estado;
}

function limpiarNombrePersona(nombre) {
    return String(nombre || "").trim().replace(/\s+/g, " ").slice(0, LARGO_MAXIMO_NOMBRE_PERSONA);
}

// Quién usa este celular, para guardarlo en el pedido: { idPersona, nombre,
// uid }, o null si todavía no se sabe. idPersona es el id de la ficha del
// empleado (no cambia con un reingreso) o "dueno".
function personaDeEsteCelular() {
    const yo = window.empleadosVendeFrio?.quienSoy?.();

    if (yo && (yo.tipo === "dueno" || yo.tipo === "empleado") && yo.idPersona && yo.uid) {
        return { idPersona: String(yo.idPersona), nombre: limpiarNombrePersona(yo.nombre), uid: String(yo.uid) };
    }

    // Al abrir la app sin señal, la distribuidora puede tardar en saberse: el
    // dueño se reconoce igual por la nube que usa este celular.
    const usuario = window.cuentaVendeFrio?.usuarioActual?.();
    const guardado = obtenerModoNubeGuardado();

    if (usuario && !usuario.isAnonymous && guardado && guardado.uid === usuario.uid && esDuenoEnLaNube()) {
        return {
            idPersona: "dueno",
            nombre: limpiarNombrePersona(window.distribuidoraVendeFrio?.nombreDuenoActual?.()),
            uid: usuario.uid
        };
    }

    return null;
}

// Devuelve [id, entrada] para el historial de estados.
function nuevaEntradaDeEstado(estado, nota, persona, horaCelular) {
    return [
        generarId(PREFIJO_ID_ESTADO),
        {
            estado,
            persona: { idPersona: persona.idPersona, nombre: persona.nombre, uid: persona.uid },
            horaCelular,
            nota: String(nota || "").trim().slice(0, LARGO_MAXIMO_NOTA_ESTADO)
        }
    ];
}

// Precio del producto en el catálogo en este momento, o null si no tiene
// (el catálogo muestra "Precio no cargado").
function precioDelCatalogo(marca, nombre, productos, comercio) {
    const marcaReal = Object.keys(productos).find(item => normalizarTexto(item) === normalizarTexto(marca));
    const lista = marcaReal && Array.isArray(productos[marcaReal]) ? productos[marcaReal] : [];
    const producto = lista.find(item => item && normalizarTexto(item.nombre) === normalizarTexto(nombre));

    return precioVigente(producto, comercio);
}

// Fecha de hoy como "AAAA-MM-DD" (hora del celular).
function fechaHoyISO(fecha) {
    const dia = fecha instanceof Date ? fecha : new Date();
    return dia.getFullYear() + "-" + String(dia.getMonth() + 1).padStart(2, "0") + "-" + String(dia.getDate()).padStart(2, "0");
}

// Oferta con fecha (T68): { precio, hasta: "AAAA-MM-DD" }. Vale hasta ese día
// inclusive; después el producto vuelve solo a su precio.
function ofertaVigente(producto, fecha) {
    const oferta = producto && producto.oferta;
    if (!oferta || typeof oferta !== "object") return null;
    const precio = Number(oferta.precio);
    const hasta = String(oferta.hasta || "");
    if (!Number.isFinite(precio) || precio <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return null;
    if (hasta < fechaHoyISO(fecha)) return null;
    return { precio, hasta };
}

// Precio sin oferta: el de la lista del comercio (T78) o el de siempre.
function precioDeLista(producto, comercio) {
    if (!producto) return null;
    const lista = comercio && typeof comercio === "object" ? String(comercio.listaPrecios || "") : "";
    const precios = producto.precios && typeof producto.precios === "object" ? producto.precios : null;
    const deLista = lista && precios ? Number(precios[lista]) : NaN;
    if (Number.isFinite(deLista) && deLista > 0) return deLista;
    const base = Number(producto.precio);
    return Number.isFinite(base) && base > 0 ? base : null;
}

// El precio que corre hoy para este comercio: la oferta, si es más barata,
// o el de su lista. Lo usan Nuevo pedido, el total y el pedido en la nube.
function precioVigente(producto, comercio) {
    const normal = precioDeLista(producto, comercio);
    const oferta = ofertaVigente(producto);
    if (oferta && (normal === null || oferta.precio < normal)) return oferta.precio;
    return normal;
}

// Lo que suma un pedido nuevo en la nube: los productos con su id de línea y
// su precio, y los campos de estado y autor. Devuelve { productos, campos }
// o null si todavía no se sabe quién usa el celular. "comercioElegido" trae
// la lista de precios elegida para este pedido (T161).
function prepararPedidoParaLaNube(productos, horaCelular, nombreComercio, comercioElegido) {
    const persona = personaDeEsteCelular();
    if (!persona) return null;

    const catalogo = obtenerProductos();
    const comercio = comercioElegido || (nombreComercio ? buscarComercioPorNombre(nombreComercio) : null);
    const [idEntrada, entrada] = nuevaEntradaDeEstado(ESTADO_PEDIDO_INICIAL, "", persona, horaCelular);

    return {
        productos: productos.map(item => ({
            id: generarId(PREFIJO_ID_LINEA),
            ...item,
            // El precio cambiado solo para este pedido (T98) queda como está.
            precio: item.precioCambiado ? item.precio : precioDelCatalogo(item.marca, item.producto, catalogo, comercio)
        })),
        campos: {
            estado: ESTADO_PEDIDO_INICIAL,
            autor: persona,
            estados: { [idEntrada]: entrada },
            eliminado: false
        }
    };
}

// Número corto del pedido (T28b): los últimos 6 caracteres del id, en
// mayúsculas. Es el que sale en el ticket impreso y en la ficha.
function numeroCortoDelPedido(pedido) {
    return String(pedido && pedido.id || "").slice(-6).toUpperCase();
}

// Total del pedido con los precios guardados al cargarlo. Devuelve
// { total, conPrecio, sinPrecio } (líneas con y sin precio).
function totalDelPedido(pedido) {
    const resultado = { total: 0, conPrecio: 0, sinPrecio: 0 };

    (Array.isArray(pedido && pedido.productos) ? pedido.productos : []).forEach(item => {
        if (!item || typeof item !== "object") return;

        const precio = item.precio === null || item.precio === undefined ? NaN : Number(item.precio);

        if (Number.isFinite(precio)) {
            resultado.total += precio * (Number(item.cantidad) || 0);
            resultado.conPrecio += 1;
        } else {
            resultado.sinPrecio += 1;
        }
    });

    return resultado;
}

// --- Eliminar y cancelar (T26) ---
// En la nube un pedido nunca se borra: el eliminado queda guardado por
// dentro (eliminado: true) y desaparece de la app, y el cancelado tiene
// "Cancelado" como estado actual (queda en "Cancelados" de la vista
// Pedidos). Ninguno de los dos cuenta en Historial, Estadísticas ni en los
// números de Inicio y de cada comercio. obtenerHistorial() sigue trayendo
// todos: el guardado de siempre compara contra la lista completa y, si
// faltaran, los borraría. En el modo personal no hay ni eliminados ni
// cancelados: cuentan todos, como siempre.

function pedidoEliminado(pedido) {
    return Boolean(pedido) && pedido.eliminado === true;
}

function pedidoCancelado(pedido) {
    return estadoActualDelPedido(pedido) === "cancelado";
}

function pedidoCuentaEnHistorial(pedido) {
    return !pedidoEliminado(pedido) && !pedidoCancelado(pedido);
}

// Los pedidos que cuentan, en el mismo orden que obtenerHistorial().
function obtenerPedidosQueCuentan() {
    return obtenerHistorial().filter(pedidoCuentaEnHistorial);
}

// --- Entrega (T27) ---
// En la nube, un pedido pasa a Historial recién cuando terminó todo el
// proceso: al quedar "Entregado". Mientras tanto se sigue en "Pedidos".
// Historial, Estadísticas e Inicio ("Pedidos hoy", "Pedidos semana" y
// "Último pedido") cuentan solo los entregados y los "Histórico" (los de
// antes, sin estados), sin eliminados ni cancelados. En el modo personal no
// hay estados: cuentan todos, como siempre.

function pedidoEstaEnHistorial(pedido) {
    if (!pedidoCuentaEnHistorial(pedido)) return false;
    if (!usaNubeReal() || !pedidoTieneEstados(pedido)) return true;
    return estadoActualDelPedido(pedido) === "entregado";
}

// Los pedidos de Historial, en el mismo orden que obtenerHistorial().
function obtenerPedidosDelHistorial() {
    return obtenerHistorial().filter(pedidoEstaEnHistorial);
}

// La misma lista, para leer sin cambiar nada (T168): se arma una sola vez
// hasta que cambia el historial, así que es compartida y quien la usa no
// tiene que modificar ni la lista ni los pedidos. Estadísticas la leía unas
// ocho veces al abrir y con muchos pedidos tardaba segundos.
let pedidosDelHistorialRecordados = null;

function pedidosDelHistorialParaLeer() {
    const marca = marcaDeColeccion("historial") + "|" + usaNubeReal();
    if (!pedidosDelHistorialRecordados || pedidosDelHistorialRecordados.marca !== marca) {
        pedidosDelHistorialRecordados = { marca, lista: obtenerPedidosDelHistorial() };
    }
    return pedidosDelHistorialRecordados.lista;
}

// --- Rutas guardadas ---
// Cada ruta guarda dos listas paralelas: "comercios" (nombres, para mostrar)
// e "idsComercios" (el id de cada uno, en la misma posición; "" si ese
// comercio ya no existe).

// Recibe nombres o ids de comercios y devuelve { nombres, ids }.
function armarComerciosDeRuta(lista, comercios = obtenerComercios()) {
    const nombres = [];
    const ids = [];

    (Array.isArray(lista) ? lista : []).forEach(entrada => {
        const texto = String(entrada || "").trim();
        if (!texto) return;

        const comercio =
            comercios.find(item => tieneId(item) && item.id === texto) ||
            buscarComercioPorNombre(texto, comercios);

        if (comercio) {
            nombres.push(comercio.nombre);
            ids.push(tieneId(comercio) ? comercio.id : "");
        } else if (texto.indexOf(PREFIJO_ID_COMERCIO + "_") !== 0) {
            // Comercio que ya no existe: se conserva el nombre, como antes.
            nombres.push(texto);
            ids.push("");
        }
    });

    return { nombres, ids };
}

// Completa "idsComercios" en cada ruta: conserva los ids que siguen
// existiendo y busca por nombre los que faltan. Devuelve true si cambió algo.
function completarIdsComerciosDeRutas(rutas, comercios = obtenerComercios()) {
    const idsExistentes = obtenerIdsDeRegistros(comercios);
    let cambio = false;

    (Array.isArray(rutas) ? rutas : []).forEach(ruta => {
        if (!ruta || typeof ruta !== "object" || !Array.isArray(ruta.comercios)) return;

        const anteriores = Array.isArray(ruta.idsComercios) ? ruta.idsComercios : [];
        const ids = ruta.comercios.map((nombre, posicion) => {
            const id = anteriores[posicion];
            if (typeof id === "string" && idsExistentes.has(id)) return id;

            const comercio = buscarComercioPorNombre(nombre, comercios);
            return comercio && tieneId(comercio) ? comercio.id : "";
        });

        if (JSON.stringify(ids) !== JSON.stringify(ruta.idsComercios)) {
            ruta.idsComercios = ids;
            cambio = true;
        }
    });

    return cambio;
}

function renombrarComercioEnRutas(idComercio, nombreNuevo) {
    const rutas = obtenerRutasGuardadas();
    let cambio = false;

    rutas.forEach(ruta => {
        if (!Array.isArray(ruta.idsComercios)) return;

        ruta.idsComercios.forEach((id, posicion) => {
            if (id === idComercio && ruta.comercios[posicion] !== nombreNuevo) {
                ruta.comercios[posicion] = nombreNuevo;
                cambio = true;
            }
        });
    });

    return cambio ? guardarRutasGuardadas(rutas) : true;
}

// Devuelve los comercios de una ruta: primero por id y, si no, por nombre.
function existeOtraRutaConNombre(nombre, idExcluir, rutas) {
    const buscado = normalizarTexto(nombre);
    return rutas.some(ruta =>
        ruta.id !== idExcluir && normalizarTexto(ruta.nombre) === buscado
    );
}

// "comercios" puede traer nombres o ids. Devuelve el id de la ruta nueva,
// o "" si no se pudo agregar (sin nombre, sin comercios o nombre repetido).
function agregarRutaConId(nombre, comercios, dia = "") {
    const nombreLimpio = String(nombre || "").trim();
    const { nombres, ids } = armarComerciosDeRuta(comercios);
    const rutas = obtenerRutasGuardadas();

    if (!nombreLimpio || nombres.length === 0) return "";
    if (existeOtraRutaConNombre(nombreLimpio, "", rutas)) return "";

    const id = generarIdNuevo(PREFIJO_ID_RUTA, rutas);

    rutas.push({
        id,
        nombre: nombreLimpio,
        comercios: nombres,
        idsComercios: ids,
        dia: String(dia || "").trim(),
        actualizado: Date.now()
    });

    return guardarRutasGuardadas(rutas) ? id : "";
}

// Cambia nombre, comercios (nombres o ids) o día. El id nunca cambia,
// también al renombrar la ruta.
function actualizarRutaPorId(id, datos) {
    const rutas = obtenerRutasGuardadas();
    const indice = buscarIndicePorId(rutas, id);
    if (indice === -1 || !datos || typeof datos !== "object") return false;

    const anterior = rutas[indice];
    const nombre = String(
        datos.nombre !== undefined ? datos.nombre : anterior.nombre
    ).trim();

    if (!nombre || existeOtraRutaConNombre(nombre, id, rutas)) return false;

    const actualizada = {
        ...anterior,
        id,
        nombre,
        dia: String(datos.dia !== undefined ? datos.dia : (anterior.dia || "")).trim(),
        actualizado: Date.now()
    };

    if (datos.comercios !== undefined) {
        const { nombres, ids } = armarComerciosDeRuta(datos.comercios);
        if (nombres.length === 0) return false;

        actualizada.comercios = nombres;
        actualizada.idsComercios = ids;
    }

    rutas[indice] = actualizada;
    return guardarRutasGuardadas(rutas);
}

function eliminarRutaPorId(id) {
    const rutas = obtenerRutasGuardadas();
    const indice = buscarIndicePorId(rutas, id);
    if (indice === -1) return false;

    rutas.splice(indice, 1);
    return guardarRutasGuardadas(rutas);
}

// Al abrir la app: agrega "idsComercios" a las rutas guardadas que no lo
// tengan. Trabaja sobre el texto guardado tal cual y solo escribe si hace falta.
function migrarIdsComerciosEnRutas() {
    const texto = localStorage.getItem(DB_RUTAS_GUARDADAS);
    if (!texto) return true;

    let rutas;
    try {
        rutas = JSON.parse(texto);
    } catch (error) {
        return false;
    }

    if (!Array.isArray(rutas) || !completarIdsComerciosDeRutas(rutas)) return true;
    return guardarColeccion("rutasGuardadas", rutas);
}

// -----------------------------------------------------
// MIGRACIÓN: IDS ÚNICOS (T3)
// -----------------------------------------------------

// Trabaja sobre el texto guardado tal cual, sin limpiar registros, para que
// lo único que cambie sea el id agregado. Si algo falla, vuelve todo atrás.
// Es una migración del formato local: lee y escribe localStorage directo y
// después hace que la copia en memoria se vuelva a cargar.
function migrarIdsLocales() {
    const colecciones = [
        {
            clave: DB_COMERCIOS,
            registros: datos => Array.isArray(datos) ? datos : [],
            asignar: datos => asignarIdsFaltantes(datos, PREFIJO_ID_COMERCIO)
        },
        {
            clave: DB_PRODUCTOS,
            registros: listarProductosDeTodasLasMarcas,
            asignar: asignarIdsProductos
        },
        {
            clave: DB_HISTORIAL,
            registros: datos => Array.isArray(datos) ? datos : [],
            asignar: datos => asignarIdsFaltantes(datos, PREFIJO_ID_PEDIDO)
        },
        {
            clave: DB_RUTAS_GUARDADAS,
            registros: datos => Array.isArray(datos) ? datos : [],
            asignar: datos => asignarIdsFaltantes(datos, PREFIJO_ID_RUTA)
        }
    ];

    const contarRegistros = (coleccion, datos) => {
        return coleccion.registros(datos)
            .filter(registro => registro && typeof registro === "object")
            .length;
    };

    // 1) Ver qué hace falta, sin escribir nada.
    const pendientes = [];

    colecciones.forEach(coleccion => {
        const texto = localStorage.getItem(coleccion.clave);
        if (!texto) return;

        let datos;
        try {
            datos = JSON.parse(texto);
        } catch (error) {
            return;
        }

        const registros = coleccion.registros(datos)
            .filter(registro => registro && typeof registro === "object");
        const ids = new Set();
        const faltan = registros.some(registro => {
            if (!tieneId(registro) || ids.has(registro.id)) return true;
            ids.add(registro.id);
            return false;
        });

        if (faltan) {
            pendientes.push({
                coleccion,
                textoOriginal: texto,
                datos,
                cantidad: registros.length
            });
        }
    });

    if (pendientes.length === 0) return true;

    // 2) Copia interna automática antes de tocar los datos.
    if (!guardarRespaldoAutomatico()) {
        console.warn("No se asignaron ids: no se pudo guardar la copia interna.");
        return false;
    }

    // 3) Completar ids, guardar y verificar leyendo de nuevo.
    const restaurarOriginales = () => {
        pendientes.forEach(item => {
            try {
                localStorage.setItem(item.coleccion.clave, item.textoOriginal);
            } catch (error) {
                console.error("No se pudo volver atrás " + item.coleccion.clave, error);
            }
        });
    };

    try {
        pendientes.forEach(item => {
            item.coleccion.asignar(item.datos);
            const texto = JSON.stringify(item.datos);
            localStorage.setItem(item.coleccion.clave, texto);

            const releido = JSON.parse(localStorage.getItem(item.coleccion.clave));
            const registros = item.coleccion.registros(releido)
                .filter(registro => registro && typeof registro === "object");
            const ids = new Set(registros.filter(tieneId).map(registro => registro.id));

            if (
                contarRegistros(item.coleccion, releido) !== item.cantidad ||
                ids.size !== registros.length
            ) {
                throw new Error("La verificación de " + item.coleccion.clave + " no coincide.");
            }
        });
    } catch (error) {
        console.error("No se pudieron asignar los ids. Se dejan los datos como estaban.", error);
        restaurarOriginales();
        olvidarColeccionesEnMemoria(COLECCIONES_COMPARTIDAS);
        mostrarAviso(
            "No se pudieron preparar los datos",
            "Tus datos quedaron como estaban y hay una copia interna guardada. Revisá si el almacenamiento del navegador está lleno."
        );
        return false;
    }

    olvidarColeccionesEnMemoria(COLECCIONES_COMPARTIDAS);
    return true;
}

conectarAdaptadorDatos();

// Con la nube (T16c), al abrir la app no se escribe nada en los datos de este
// celular (ni las listas de ejemplo ni los ids ni la copia interna) y no se
// hace el reinicio semanal de la marca "pendiente".
if (!usaNubeReal()) {
    migrarIdsLocales();
    migrarIdsComerciosEnRutas();
    asegurarReinicioSemanal();
    programarReinicioSemanal();
    respaldarAutomaticamenteSiCorresponde();
}

prepararControlesRespaldo();
prepararRecordatorioRespaldoNube();
