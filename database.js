// =====================================================
// VendeFr\u00edo Lite - database.js
// Almacenamiento local seguro y funciones de datos
// =====================================================

const DB_COMERCIOS = "vendefrio_comercios";
const DB_PRODUCTOS = "vendefrio_productos";
const DB_ORDEN_MARCAS = "vendefrio_orden_marcas";
const DB_HISTORIAL = "vendefrio_historial";
const DB_ULTIMO_RESPALDO = "vendefrio_ultimo_respaldo";
const DB_RESPALDO_AUTOMATICO = "vendefrio_respaldo_automatico";
const DB_ULTIMO_RESPALDO_AUTOMATICO = "vendefrio_ultimo_respaldo_automatico";
const DB_SEMANA_ACTUAL = "vendefrio_semana_actual";
const DIAS_ENTRE_RESPALDOS_AUTOMATICOS = 7;

const PALETA_MARCAS = ["#0f9d63", "#ff8a3d", "#8b5cf6", "#3b82f6", "#e5483d", "#0891b2"];
const PALETA_AVATAR = ["#0f9d63", "#ff8a3d", "#8b5cf6", "#3b82f6", "#e5483d", "#0891b2", "#f59e0b", "#14b8a6"];

// -----------------------------------------------------
// UTILIDADES
// -----------------------------------------------------

function clonarDatos(datos) {
    return JSON.parse(JSON.stringify(datos));
}

function normalizarTexto(texto) {
    return String(texto || "")
        .trim()
        .toLocaleLowerCase("es-AR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
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

function leerJSON(clave, valorInicial) {
    const texto = localStorage.getItem(clave);

    if (!texto) return clonarDatos(valorInicial);

    try {
        return JSON.parse(texto);
    } catch (error) {
        console.warn(`Los datos de ${clave} estaban da\u00f1ados. Se usar\u00e1n datos de respaldo.`, error);
        return clonarDatos(valorInicial);
    }
}

function guardarJSON(clave, datos) {
    try {
        localStorage.setItem(clave, JSON.stringify(datos));
        return true;
    } catch (error) {
        console.error(`No se pudieron guardar los datos de ${clave}.`, error);
        mostrarAviso(
            "No se pudieron guardar los cambios",
            "Revis\u00e1 si el almacenamiento del navegador est\u00e1 lleno."
        );
        return false;
    }
}

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
// COMERCIOS
// -----------------------------------------------------

function obtenerComercios() {
    let comercios = leerJSON(DB_COMERCIOS, COMERCIOS);

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

    if (!localStorage.getItem(DB_COMERCIOS)) {
        guardarComercios(comercios);
    }

    return comercios;
}

function guardarComercios(comercios) {
    return guardarJSON(DB_COMERCIOS, Array.isArray(comercios) ? comercios : []);
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

function actualizarComercio(nombreAnterior, datos) {
    const comercios = obtenerComercios();
    const indice = comercios.findIndex(comercio =>
        normalizarTexto(comercio.nombre) === normalizarTexto(nombreAnterior)
    );

    if (indice === -1) return false;

    const nombreNuevo = String(datos.nombre || comercios[indice].nombre).trim();

    if (!nombreNuevo || existeComercioConNombre(nombreNuevo, nombreAnterior)) {
        return false;
    }

    comercios[indice] = {
        ...comercios[indice],
        ...datos,
        nombre: nombreNuevo,
        direccion: String(datos.direccion !== undefined ? datos.direccion : (comercios[indice].direccion || "")).trim(),
        enlaceMaps: String(datos.enlaceMaps !== undefined ? datos.enlaceMaps : (comercios[indice].enlaceMaps || "")).trim(),
        telefono: String(datos.telefono !== undefined ? datos.telefono : (comercios[indice].telefono || "")).trim()
    };

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

function obtenerProductos() {
    let productos = leerJSON(DB_PRODUCTOS, PRODUCTOS);

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
                    nombre: String(producto.nombre || "").trim(),
                    precio: Number(producto.precio) || 0
                }))
                .filter(producto => producto.nombre !== "")
            : [];
    });

    if (!localStorage.getItem(DB_PRODUCTOS)) {
        guardarProductos(productosLimpios);
    }

    return productosLimpios;
}

function guardarProductos(productos) {
    return guardarJSON(DB_PRODUCTOS, productos && typeof productos === "object" ? productos : {});
}

function obtenerOrdenMarcas() {
    const orden = leerJSON(DB_ORDEN_MARCAS, []);

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
    return guardarJSON(
        DB_ORDEN_MARCAS,
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
        precio: Number(producto.precio) || 0
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

    productos[marcaReal][indice] = {
        nombre,
        precio: Number(producto.precio) || 0
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
    let historial = leerJSON(DB_HISTORIAL, []);

    if (!Array.isArray(historial)) historial = [];

    return historial.filter(registro => registro && typeof registro === "object");
}

function guardarHistorial(historial) {
    return guardarJSON(DB_HISTORIAL, Array.isArray(historial) ? historial : []);
}

function agregarHistorial(registro) {
    if (!registro || typeof registro !== "object") return false;

    const historial = obtenerHistorial();
    historial.unshift(registro);
    return guardarHistorial(historial);
}

function eliminarHistorial(indice) {
    const historial = obtenerHistorial();
    const posicion = Number(indice);

    if (!Number.isInteger(posicion) || !historial[posicion]) return false;

    historial.splice(posicion, 1);
    return guardarHistorial(historial);
}

// -----------------------------------------------------
// BORRADO TOTAL Y RESPALDO
// -----------------------------------------------------

function borrarTodosLosDatos() {
    Object.keys(localStorage)
        .filter(clave => clave.indexOf("vendefrio_") === 0)
        .forEach(clave => localStorage.removeItem(clave));

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

function exportarRespaldo() {
    try {
        const respaldo = crearDatosRespaldo();
        const contenido = JSON.stringify(respaldo, null, 2);
        const archivo = new Blob([contenido], {
            type: "application/json"
        });

        const enlace = document.createElement("a");
        const url = URL.createObjectURL(archivo);
        const fecha = new Date().toISOString().slice(0, 10);

        enlace.href = url;
        enlace.download = `vendefrio-respaldo-${fecha}.json`;
        enlace.style.display = "none";
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        URL.revokeObjectURL(url);
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

function guardarRespaldoAutomatico() {
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
    const datos = respaldo.datos;
    const anteriores = {
        comercios: localStorage.getItem(DB_COMERCIOS),
        productos: localStorage.getItem(DB_PRODUCTOS),
        ordenMarcas: localStorage.getItem(DB_ORDEN_MARCAS),
        historial: localStorage.getItem(DB_HISTORIAL),
        rutasGuardadas: localStorage.getItem(DB_RUTAS_GUARDADAS)
    };

    const ordenMarcas = Array.isArray(datos.ordenMarcas)
        ? datos.ordenMarcas
        : Object.keys(datos.productos);

    const guardado =
        guardarJSON(DB_COMERCIOS, datos.comercios) &&
        guardarJSON(DB_PRODUCTOS, datos.productos) &&
        guardarJSON(DB_ORDEN_MARCAS, ordenMarcas) &&
        guardarJSON(DB_HISTORIAL, datos.historial) &&
        guardarJSON(
            DB_RUTAS_GUARDADAS,
            Array.isArray(datos.rutasGuardadas) ? datos.rutasGuardadas : []
        );

    if (!guardado) {
        try {
            Object.entries(anteriores).forEach(([clave, valor]) => {
                const claveReal = {
                    comercios: DB_COMERCIOS,
                    productos: DB_PRODUCTOS,
                    ordenMarcas: DB_ORDEN_MARCAS,
                    historial: DB_HISTORIAL,
                    rutasGuardadas: DB_RUTAS_GUARDADAS
                }[clave];

                if (valor === null) {
                    localStorage.removeItem(claveReal);
                } else {
                    localStorage.setItem(claveReal, valor);
                }
            });
        } catch (error) {
            console.error("No se pudo recuperar el estado anterior.", error);
        }

        return false;
    }

    return true;
}

function importarRespaldoDesdeArchivo(archivo) {
    if (!archivo) return;

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

function prepararControlesRespaldo() {
    actualizarEstadoRespaldo();

    const botonExportar = document.getElementById("exportarRespaldo");
    const botonImportar = document.getElementById("importarRespaldo");
    const archivoRespaldo = document.getElementById("archivoRespaldo");
    const modalAviso = document.getElementById("modalAviso");
    const cerrarAviso = document.getElementById("cerrarAviso");

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

const DB_RUTAS_GUARDADAS = "vendefrio_rutas_guardadas";

function obtenerRutasGuardadas() {
    const rutas = leerJSON(DB_RUTAS_GUARDADAS, []);
    return Array.isArray(rutas)
        ? rutas.filter(ruta => ruta && ruta.nombre && Array.isArray(ruta.comercios))
        : [];
}

function guardarRutasGuardadas(rutas) {
    return guardarJSON(
        DB_RUTAS_GUARDADAS,
        Array.isArray(rutas) ? rutas : []
    );
}

function agregarRutaGuardada(nombre, comercios, dia = "") {
    const nombreLimpio = String(nombre || "").trim();
    const listaComercios = Array.isArray(comercios)
        ? comercios.map(comercio => String(comercio || "").trim()).filter(Boolean)
        : [];

    if (!nombreLimpio || listaComercios.length === 0) return false;

    const rutas = obtenerRutasGuardadas();
    const existente = rutas.find(ruta => {
        return normalizarTexto(ruta.nombre) === normalizarTexto(nombreLimpio);
    });

    const datos = {
        nombre: nombreLimpio,
        comercios: listaComercios,
        dia: String(dia || "").trim(),
        actualizado: Date.now()
    };

    if (existente) {
        Object.assign(existente, datos);
    } else {
        rutas.push(datos);
    }

    return guardarRutasGuardadas(rutas);
}

function eliminarRutaGuardada(nombre) {
    const rutas = obtenerRutasGuardadas();
    const nuevas = rutas.filter(ruta => {
        return normalizarTexto(ruta.nombre) !== normalizarTexto(nombre);
    });

    if (nuevas.length === rutas.length) return false;
    return guardarRutasGuardadas(nuevas);
}

asegurarReinicioSemanal();
programarReinicioSemanal();
respaldarAutomaticamenteSiCorresponde();
prepararControlesRespaldo();
