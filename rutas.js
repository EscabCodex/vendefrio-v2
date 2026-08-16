// =====================================================
// VendeFr\u00edo Lite - rutas.js
// Mapa, GPS y planificaci\u00f3n de rutas
// =====================================================

let mapaLeaflet = null;
let capaMarcadores = null;
let rutaOrdenada = [];
let distanciasRuta = [];
let comerciosSeleccionadosRuta = new Set();
let seleccionRutaInicializada = false;

function actualizarResumenRuta() {
    const resumen = document.getElementById("resumenRuta");
    if (!resumen) return;

    const comercios = obtenerComercios();
    const conGps = comercios.filter(comercioTieneGps).length;
    const sinGps = comercios.length - conGps;

    resumen.textContent =
        "Paradas con GPS: " +
        conGps +
        "  -  Sin GPS: " +
        sinGps +
        "  -  Total: " +
        comercios.length;
}

const LATITUD_POR_DEFECTO = -34.6185;
const LONGITUD_POR_DEFECTO = -58.6382;

function comercioTieneGps(comercio) {
    if (!comercio) return false;

    const latitud = comercio.lat;
    const longitud = comercio.lng;

    if (
        latitud === "" ||
        latitud === null ||
        longitud === "" ||
        longitud === null
    ) {
        return false;
    }

    return (
        Number.isFinite(Number(latitud)) &&
        Number.isFinite(Number(longitud))
    );
}

function crearPopupComercio(comercio) {
    const contenido = document.createElement("div");
    const nombre = document.createElement("strong");
    const salto = document.createElement("br");
    const direccion = document.createElement("span");

    nombre.textContent = comercio.nombre || "Sin nombre";
    direccion.textContent = comercio.direccion || "Sin direcci\u00f3n";

    contenido.append(nombre, salto, direccion);
    return contenido;
}

function configurarCierreModalAviso() {
    const modal = document.getElementById("modalAviso");
    const botonCerrar = document.getElementById("cerrarAviso");

    if (
        botonCerrar &&
        !botonCerrar.dataset.cierreConfigurado
    ) {
        botonCerrar.addEventListener("click", () => {
            if (modal) modal.classList.add("oculto");
        });

        botonCerrar.dataset.cierreConfigurado = "true";
    }

    if (
        modal &&
        !modal.dataset.cierreConfigurado
    ) {
        modal.addEventListener("click", event => {
            if (event.target === modal) {
                modal.classList.add("oculto");
            }
        });

        modal.dataset.cierreConfigurado = "true";
    }
}

function inicializarPantallaRutas() {
    actualizarResumenRuta();
    cargarSelectComerciosRuta();
    inicializarSeleccionRuta();
    iniciarMapa();
    renderizarPines();
}

function cargarSelectComerciosRuta() {
    const select = document.getElementById("selectComercioGps");
    if (!select) return;

    const valorSeleccionado = select.value;
    select.innerHTML = "";

    const opcionInicial = document.createElement("option");
    opcionInicial.value = "";
    opcionInicial.textContent = "Eleg\u00ed un comercio...";
    select.appendChild(opcionInicial);

    obtenerComercios()
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
        .forEach(comercio => {
            const opcion = document.createElement("option");
            opcion.value = comercio.nombre;
            opcion.textContent =
                comercio.nombre +
                " " +
                (
                    comercioTieneGps(comercio)
                        ? "\ud83d\udccd (GPS listo)"
                        : "\u26a0\ufe0f (Sin GPS)"
                );

            select.appendChild(opcion);
        });

    if (valorSeleccionado) {
        select.value = valorSeleccionado;
    }
}

function obtenerComerciosSeleccionRuta() {
    return obtenerComercios()
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function actualizarEstadoSeleccionRuta() {
    const estado = document.getElementById("estadoSeleccionRuta");
    if (!estado) return;

    const comercios = obtenerComerciosSeleccionRuta();
    const seleccionados = comercios.filter(comercio => {
        return comerciosSeleccionadosRuta.has(comercio.nombre);
    });
    const conGps = seleccionados.filter(comercioTieneGps).length;
    const sinGps = seleccionados.length - conGps;

    estado.textContent =
        seleccionados.length +
        " seleccionados - " +
        conGps +
        " con GPS - " +
        sinGps +
        " sin GPS";
}

function renderizarSeleccionRuta() {
    const contenedor = document.getElementById("listaSeleccionRuta");
    if (!contenedor) return;

    contenedor.innerHTML = "";

    obtenerComerciosSeleccionRuta().forEach(comercio => {
        const etiqueta = document.createElement("label");
        etiqueta.className = "opcionSeleccionRuta";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = comerciosSeleccionadosRuta.has(comercio.nombre);
        checkbox.dataset.nombre = comercio.nombre;

        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                comerciosSeleccionadosRuta.add(comercio.nombre);
            } else {
                comerciosSeleccionadosRuta.delete(comercio.nombre);
            }
            actualizarEstadoSeleccionRuta();
        });

        const texto = document.createElement("span");
        texto.textContent = comercio.nombre;

        const estado = document.createElement("small");
        estado.textContent = comercioTieneGps(comercio)
            ? "GPS listo"
            : "Sin GPS";
        estado.className = comercioTieneGps(comercio)
            ? "seleccionRutaGps"
            : "seleccionRutaSinGps";

        etiqueta.append(checkbox, texto, estado);
        contenedor.appendChild(etiqueta);
    });

    actualizarEstadoSeleccionRuta();
}

function inicializarSeleccionRuta() {
    const comercios = obtenerComerciosSeleccionRuta();

    if (!seleccionRutaInicializada) {
        comercios
            .filter(comercioTieneGps)
            .forEach(comercio => comerciosSeleccionadosRuta.add(comercio.nombre));
        seleccionRutaInicializada = true;
    }

    const nombresActuales = new Set(comercios.map(comercio => comercio.nombre));
    comerciosSeleccionadosRuta.forEach(nombre => {
        if (!nombresActuales.has(nombre)) {
            comerciosSeleccionadosRuta.delete(nombre);
        }
    });

    renderizarSeleccionRuta();
}

function seleccionarTodosLosComerciosRuta() {
    obtenerComerciosSeleccionRuta().forEach(comercio => {
        comerciosSeleccionadosRuta.add(comercio.nombre);
    });
    renderizarSeleccionRuta();
}

function seleccionarPendientesRuta() {
    comerciosSeleccionadosRuta.clear();
    obtenerComerciosSeleccionRuta()
        .filter(comercio => !comercioEstaVisitadoEstaSemana(comercio))
        .forEach(comercio => comerciosSeleccionadosRuta.add(comercio.nombre));
    renderizarSeleccionRuta();
}

function limpiarSeleccionRuta() {
    comerciosSeleccionadosRuta.clear();
    renderizarSeleccionRuta();
}

function obtenerComerciosElegidosParaRuta() {
    return obtenerComerciosSeleccionRuta().filter(comercio => {
        return comerciosSeleccionadosRuta.has(comercio.nombre);
    });
}

function iniciarMapa() {
    if (mapaLeaflet) {
        window.setTimeout(() => {
            mapaLeaflet.invalidateSize();
        }, 200);

        return;
    }

    const contenedor = document.getElementById("mapaRuta");

    if (!contenedor || typeof L === "undefined") {
        mostrarAviso(
            "Mapa no disponible",
            "No se pudo cargar el mapa. Revis\u00e1 tu conexi\u00f3n a internet."
        );

        return;
    }

    mapaLeaflet = L.map("mapaRuta").setView(
        [LATITUD_POR_DEFECTO, LONGITUD_POR_DEFECTO],
        13
    );

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution: "\u00a9 OpenStreetMap"
        }
    ).addTo(mapaLeaflet);

    capaMarcadores = L.layerGroup().addTo(mapaLeaflet);
}

function renderizarPines() {
    if (!mapaLeaflet || !capaMarcadores) return;

    capaMarcadores.clearLayers();

    const comerciosConGps = obtenerComercios().filter(
        comercioTieneGps
    );

    if (comerciosConGps.length === 0) return;

    const limites = L.latLngBounds();

    comerciosConGps.forEach(comercio => {
        const coordenadas = [
            Number(comercio.lat),
            Number(comercio.lng)
        ];

        const marcador = L.marker(coordenadas).bindPopup(
            crearPopupComercio(comercio)
        );

        capaMarcadores.addLayer(marcador);
        limites.extend(coordenadas);
    });

    mapaLeaflet.fitBounds(limites, {
        padding: [30, 30]
    });
}

function guardarGpsActual(boton) {
    const select = document.getElementById("selectComercioGps");
    const nombre = select ? select.value : "";

    if (!nombre) {
        mostrarAviso(
            "Atenci\u00f3n",
            "Eleg\u00ed un comercio primero en la lista."
        );

        return;
    }

    if (!navigator.geolocation) {
        mostrarAviso(
            "GPS no disponible",
            "Tu celular no soporta GPS en el navegador."
        );

        return;
    }

    const textoOriginal =
        "\ud83d\udccd Guardar mi GPS actual en este comercio";

    boton.disabled = true;
    boton.textContent = "\ud83d\udccd Obteniendo GPS...";

    navigator.geolocation.getCurrentPosition(
        posicion => {
            const guardado = actualizarComercio(
                nombre,
                {
                    lat: posicion.coords.latitude,
                    lng: posicion.coords.longitude
                }
            );

            boton.disabled = false;
            boton.textContent = textoOriginal;

            if (!guardado) {
                mostrarAviso(
                    "No se pudo guardar",
                    "No se encontr\u00f3 el comercio seleccionado."
                );

                return;
            }

            mostrarAviso(
                "\u00a1GPS guardado!",
                "Guardamos la ubicaci\u00f3n exacta para \"" +
                    nombre +
                    "\"."
            );

            actualizarResumenRuta();
            cargarSelectComerciosRuta();
            renderizarSeleccionRuta();
            renderizarPines();

            if (typeof actualizarDashboard === "function") {
                actualizarDashboard();
            }
        },
        () => {
            boton.disabled = false;
            boton.textContent = textoOriginal;

            mostrarAviso(
                "Error de GPS",
                "Asegurate de darle permiso de ubicaci\u00f3n al navegador en tu celular."
            );
        },
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15000
        }
    );
}

function borrarGpsComercio() {
    const select = document.getElementById("selectComercioGps");
    const nombre = select ? select.value : "";

    if (!nombre) {
        mostrarAviso(
            "Atenci\u00f3n",
            "Eleg\u00ed el comercio al que quer\u00e9s borrarle el GPS en la lista."
        );

        return;
    }

    const comercio = buscarComercioPorNombre(nombre);

    if (!comercio || !comercioTieneGps(comercio)) {
        mostrarAviso(
            "Sin ubicaci\u00f3n",
            "\"" +
                nombre +
                "\" no tiene ninguna ubicaci\u00f3n GPS guardada."
        );

        return;
    }

    const borrar = () => {
        const guardado = actualizarComercio(
            nombre,
            {
                lat: "",
                lng: ""
            }
        );

        if (!guardado) {
            mostrarAviso(
                "No se pudo borrar",
                "No se encontr\u00f3 el comercio seleccionado."
            );

            return;
        }

        mostrarAviso(
            "Ubicaci\u00f3n borrada",
            "Se elimin\u00f3 el pin del mapa para \"" +
                nombre +
                "\"."
        );

        actualizarResumenRuta();
        cargarSelectComerciosRuta();
        renderizarSeleccionRuta();
        renderizarPines();

        if (typeof actualizarDashboard === "function") {
            actualizarDashboard();
        }
    };

    const mensaje =
        "\u00bfEst\u00e1s seguro de borrar el pin de ubicaci\u00f3n de \"" +
        nombre +
        "\"?";

    if (typeof abrirConfirmacion === "function") {
        abrirConfirmacion(
            "Borrar ubicaci\u00f3n",
            mensaje,
            borrar
        );
    } else {
        mostrarAviso(
            "No se pudo confirmar",
            "El modal de confirmaci\u00f3n no est\u00e1 disponible."
        );
    }
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const radioTierra = 6371e3;
    const radianes = Math.PI / 180;

    const diferenciaLatitud =
        (Number(lat2) - Number(lat1)) * radianes;

    const diferenciaLongitud =
        (Number(lon2) - Number(lon1)) * radianes;

    const a =
        Math.sin(diferenciaLatitud / 2) ** 2 +
        Math.cos(Number(lat1) * radianes) *
            Math.cos(Number(lat2) * radianes) *
            Math.sin(diferenciaLongitud / 2) ** 2;

    const c = 2 * Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
    );

    return radioTierra * c;
}

function optimizarRuta() {
    const comerciosElegidos = obtenerComerciosElegidosParaRuta();

    if (comerciosElegidos.length === 0) {
        mostrarAviso(
            "Sin comercios seleccionados",
            "Eleg\u00ed al menos un comercio para preparar la ruta."
        );

        return;
    }

    const comerciosConGps = comerciosElegidos.filter(comercioTieneGps);
    const comerciosSinGps = comerciosElegidos.length - comerciosConGps.length;

    if (comerciosConGps.length < 2) {
        mostrarAviso(
            "Faltan ubicaciones",
            "Seleccionaste " +
                comerciosElegidos.length +
                " comercio(s), pero solo " +
                comerciosConGps.length +
                " tienen GPS. Guard\u00e1 al menos 2 ubicaciones para armar la ruta." +
                (comerciosSinGps > 0 ? " Hay comercios seleccionados sin GPS." : "")
        );

        return;
    }

    if (!navigator.geolocation) {
        mostrarAviso(
            "GPS no disponible",
            "Activ\u00e1 el GPS del celular para calcular la ruta desde tu ubicaci\u00f3n."
        );

        return;
    }

    navigator.geolocation.getCurrentPosition(
        posicion => {
            let latitudActual = posicion.coords.latitude;
            let longitudActual = posicion.coords.longitude;
            let pendientes = [...comerciosConGps];

            rutaOrdenada = [];
            distanciasRuta = [];

            while (pendientes.length > 0) {
                let masCercano = null;
                let menorDistancia = Infinity;
                let indiceCercano = -1;

                pendientes.forEach((comercio, indice) => {
                    const distancia = calcularDistancia(
                        latitudActual,
                        longitudActual,
                        comercio.lat,
                        comercio.lng
                    );

                    if (distancia < menorDistancia) {
                        menorDistancia = distancia;
                        masCercano = comercio;
                        indiceCercano = indice;
                    }
                });

                if (!masCercano) break;

                rutaOrdenada.push(masCercano);
                distanciasRuta.push(menorDistancia);
                latitudActual = Number(masCercano.lat);
                longitudActual = Number(masCercano.lng);
                pendientes.splice(indiceCercano, 1);
            }

            if (rutaOrdenada.length === 0) {
                mostrarAviso(
                    "No se pudo calcular",
                    "No se encontraron comercios v\u00e1lidos para la ruta."
                );

                return;
            }

            mostrarAviso(
                "\u00a1Ruta calculada!",
                "Primera parada sugerida: " +
                    rutaOrdenada[0].nombre
            );

            mostrarRutaEnLista();
        },
        () => {
            mostrarAviso(
                "GPS desactivado",
                "Activ\u00e1 el GPS del celular para calcular la ruta desde tu ubicaci\u00f3n."
            );
        },
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15000
        }
    );
}

function abrirGoogleMaps() {
    const paradas =
        rutaOrdenada.length > 0
            ? rutaOrdenada
            : obtenerComercios().filter(
                  comercio =>
                      comercioTieneGps(comercio) ||
                      Boolean(
                          comercio.direccion &&
                              comercio.direccion.trim() !== ""
                      )
              );

    if (paradas.length === 0) {
        mostrarAviso(
            "Sin datos",
            "No hay comercios con GPS ni direcci\u00f3n para enviar a Google Maps."
        );

        return;
    }

    const paradasFormateadas = paradas
        .map(comercio => {
            if (comercioTieneGps(comercio)) {
                return comercio.lat + "," + comercio.lng;
            }

            return encodeURIComponent(comercio.direccion);
        })
        .join("/");

    window.open(
        "https://www.google.com/maps/dir//" +
            paradasFormateadas,
        "_blank"
    );
}

function formatearDistanciaRuta(metros, indice) {
    const distancia = Number(metros) || 0;
    const referencia = indice === 0
        ? "desde tu ubicaci" + String.fromCodePoint(0xF3) + "n"
        : "desde la parada anterior";

    if (distancia < 1000) {
        return Math.round(distancia) + " m " + referencia;
    }

    return (distancia / 1000).toFixed(1) + " km " + referencia;
}

function mostrarRutaEnLista() {
    const contenedor = document.getElementById(
        "listaRutaOrdenada"
    );

    if (!contenedor) return;

    contenedor.innerHTML = "";

    const encabezado = document.createElement("div");
    encabezado.className = "encabezadoRuta";

    const titulo = document.createElement("h3");
    titulo.textContent = "Ruta sugerida:";
    encabezado.appendChild(titulo);

    if (rutaOrdenada.length > 0) {
        const botonSiguiente = document.createElement("button");
        botonSiguiente.type = "button";
        botonSiguiente.className = "btnAccion agregar pedidoParadaRuta";
        botonSiguiente.dataset.nombre = rutaOrdenada[0].nombre;
        botonSiguiente.textContent = "\ud83d\udcdd Pedido siguiente";
        encabezado.appendChild(botonSiguiente);
    }

    contenedor.appendChild(encabezado);

    rutaOrdenada.forEach((comercio, indice) => {
        const elemento = document.createElement("div");
        elemento.className = "paradaRuta";

        const informacion = document.createElement("div");
        const nombre = document.createElement("strong");
        nombre.textContent =
            "#" +
            (indice + 1) +
            " - " +
            comercio.nombre;

        const direccion = document.createElement("span");
        direccion.textContent = comercio.direccion || "Sin direcci\u00f3n";

        const distancia = document.createElement("small");
        distancia.textContent = formatearDistanciaRuta(
            distanciasRuta[indice],
            indice
        );

        informacion.append(nombre, direccion, distancia);

        const botonPedido = document.createElement("button");
        botonPedido.type = "button";
        botonPedido.className = "btnAccion ver pedidoParadaRuta";
        botonPedido.dataset.nombre = comercio.nombre;
        botonPedido.textContent = "\ud83d\udcdd Pedido";

        elemento.append(informacion, botonPedido);
        contenedor.appendChild(elemento);
    });
}

configurarCierreModalAviso();

const botonSeleccionarTodosRuta = document.getElementById("seleccionarTodosRuta");
const botonSeleccionarPendientesRuta = document.getElementById("seleccionarPendientesRuta");
const botonLimpiarSeleccionRuta = document.getElementById("limpiarSeleccionRuta");

if (botonSeleccionarTodosRuta) {
    botonSeleccionarTodosRuta.addEventListener("click", seleccionarTodosLosComerciosRuta);
}

if (botonSeleccionarPendientesRuta) {
    botonSeleccionarPendientesRuta.addEventListener("click", seleccionarPendientesRuta);
}

if (botonLimpiarSeleccionRuta) {
    botonLimpiarSeleccionRuta.addEventListener("click", limpiarSeleccionRuta);
}

document.addEventListener("click", event => {
    const boton = event.target.closest("button");
    if (!boton) return;

    if (boton.classList.contains("pedidoParadaRuta")) {
        if (typeof irAPedidoRapido === "function") {
            irAPedidoRapido(boton.dataset.nombre || "");
        }
        return;
    }

    if (boton.id === "btnGuardarGps") {
        guardarGpsActual(boton);
        return;
    }

    if (boton.id === "btnBorrarGps") {
        borrarGpsComercio();
        return;
    }

    if (boton.id === "btnOptimizarRuta") {
        optimizarRuta();
        return;
    }

    if (boton.id === "btnGoogleMaps") {
        abrirGoogleMaps();
    }
});