// =====================================================
// VendeFr\u00edo Lite - pedidos.js
// Carga, validaci\u00f3n y generaci\u00f3n de pedidos
// =====================================================

const contenedorProductos = document.getElementById("productos");
const totalUnidadesPedido = document.getElementById("totalUnidadesPedido");
const totalTiposPedido = document.getElementById("totalTiposPedido");
const inputCliente = document.getElementById("cliente");
const inputObs = document.getElementById("obs");
const listaComercios = document.getElementById("listaComercios");
const botonGenerar = document.getElementById("generar");
const botonReset = document.getElementById("reset");

const modalPedido = document.getElementById("modalPedido");
const pedidoCliente = document.getElementById("pedidoCliente");
const pedidoCantidad = document.getElementById("pedidoCantidad");
const pedidoDetalle = document.getElementById("pedidoDetalle");
const copiarPedido = document.getElementById("copiarPedido");
const whatsappPedido = document.getElementById("whatsappPedido");

const DB_BORRADOR_PEDIDO = "vendefrio_borrador_pedido";

let ultimoPedidoTexto = "";
let buscadorProductosPedido = null;
let botonRepetirPedido = null;
let mensajeSinResultadosPedido = null;

// -----------------------------------------------------
// COMERCIOS
// -----------------------------------------------------

function actualizarDatalistPedido() {
    if (!listaComercios) return;

    listaComercios.innerHTML = "";

    obtenerComercios()
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
        .forEach(comercio => {
            const option = document.createElement("option");
            option.value = comercio.nombre;
            listaComercios.appendChild(option);
        });
}

// Alias usados por menu.js para que la pantalla se actualice al abrirla.
const cargarListaClientes = actualizarDatalistPedido;

// -----------------------------------------------------
// PRODUCTOS DEL PEDIDO
// -----------------------------------------------------

function actualizarResumenPedido() {
    let unidades = 0;
    let tipos = 0;

    document.querySelectorAll(".marca select").forEach(select => {
        const cantidad = Number(select.value) || 0;

        if (cantidad > 0) {
            unidades += cantidad;
            tipos += 1;
        }
    });

    if (totalUnidadesPedido) {
        totalUnidadesPedido.textContent = String(unidades);
    }

    if (totalTiposPedido) {
        totalTiposPedido.textContent = String(tipos);
    }
}

function crearSelect(marca, producto) {
    const select = document.createElement("select");
    select.dataset.marca = marca;
    select.dataset.producto = producto.nombre;
    select.setAttribute("aria-label", "Cantidad de " + producto.nombre);

    for (let cantidad = 0; cantidad <= 40; cantidad++) {
        const option = document.createElement("option");
        option.value = cantidad;
        option.textContent = cantidad;
        select.appendChild(option);
    }

    select.addEventListener("change", () => {
        actualizarEstadoCantidad(select);
    });

    return select;
}

function actualizarEstadoCantidad(select) {
    select.classList.toggle("activo", select.value !== "0");
    actualizarResumenPedido();
    guardarBorradorPedido();
}

function cambiarCantidad(select, cambio) {
    const cantidadActual = Number(select.value) || 0;
    const nuevaCantidad = Math.max(
        0,
        Math.min(40, cantidadActual + cambio)
    );

    select.value = String(nuevaCantidad);
    actualizarEstadoCantidad(select);
}

function crearBotonCantidad(clase, texto, titulo) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = clase;
    boton.textContent = texto;
    boton.title = titulo;
    boton.setAttribute("aria-label", titulo);
    return boton;
}

function crearControlesProducto(marca, producto) {
    const controles = document.createElement("div");
    controles.className = "controlesCantidad";

    const botonMenos = crearBotonCantidad(
        "botonCantidad botonMenos",
        "-",
        "Disminuir cantidad"
    );

    const select = crearSelect(marca, producto);

    const botonMas = crearBotonCantidad(
        "botonCantidad botonMas",
        "+",
        "Aumentar cantidad"
    );

    const botonBorrar = crearBotonCantidad(
        "botonCantidad botonBorrar",
        String.fromCodePoint(0x1F5D1, 0xFE0F),
        "Volver a cero"
    );

    botonMenos.addEventListener("click", () => {
        cambiarCantidad(select, -1);
    });

    botonMas.addEventListener("click", () => {
        cambiarCantidad(select, 1);
    });

    botonBorrar.addEventListener("click", () => {
        select.value = "0";
        actualizarEstadoCantidad(select);
    });

    controles.append(
        botonMenos,
        select,
        botonMas,
        botonBorrar
    );

    return controles;
}

function obtenerDatosBorradorPedido() {
    const cantidades = [];

    document.querySelectorAll(".marca select").forEach(select => {
        const cantidad = Number(select.value) || 0;

        if (cantidad > 0) {
            cantidades.push({
                marca: select.dataset.marca,
                producto: select.dataset.producto,
                cantidad
            });
        }
    });

    return {
        cliente: inputCliente ? inputCliente.value.trim() : "",
        observaciones: inputObs ? inputObs.value.trim() : "",
        cantidades
    };
}

function guardarBorradorPedido() {
    const datos = obtenerDatosBorradorPedido();

    if (
        !datos.cliente &&
        !datos.observaciones &&
        datos.cantidades.length === 0
    ) {
        localStorage.removeItem(DB_BORRADOR_PEDIDO);
        return;
    }

    try {
        localStorage.setItem(
            DB_BORRADOR_PEDIDO,
            JSON.stringify(datos)
        );
    } catch (error) {
        console.warn("No se pudo guardar el borrador del pedido.", error);
    }
}

function borrarBorradorPedido() {
    localStorage.removeItem(DB_BORRADOR_PEDIDO);
}

function restaurarBorradorPedido() {
    const contenido = localStorage.getItem(DB_BORRADOR_PEDIDO);
    if (!contenido) return false;

    let datos;

    try {
        datos = JSON.parse(contenido);
    } catch (error) {
        borrarBorradorPedido();
        return false;
    }

    if (!datos || typeof datos !== "object") {
        borrarBorradorPedido();
        return false;
    }

    if (inputCliente) inputCliente.value = String(datos.cliente || "");
    if (inputObs) inputObs.value = String(datos.observaciones || "");

    const cantidades = Array.isArray(datos.cantidades)
        ? datos.cantidades
        : [];

    document.querySelectorAll(".marca select").forEach(select => {
        const encontrado = cantidades.find(item => {
            return (
                normalizarTexto(item.marca) === normalizarTexto(select.dataset.marca) &&
                normalizarTexto(item.producto) === normalizarTexto(select.dataset.producto)
            );
        });

        const cantidad = encontrado
            ? Math.max(0, Math.min(40, Number(encontrado.cantidad) || 0))
            : 0;

        select.value = String(cantidad);
        select.classList.toggle("activo", cantidad > 0);
    });

    return Boolean(
        datos.cliente ||
        datos.observaciones ||
        cantidades.length > 0
    );
}

function prepararBuscadorProductosPedido() {
    if (!contenedorProductos || buscadorProductosPedido) return;

    const accionesBusqueda = document.createElement("div");
    accionesBusqueda.className = "accionesBusquedaPedido";

    botonRepetirPedido = document.createElement("button");
    botonRepetirPedido.type = "button";
    botonRepetirPedido.className = "botonRepetirPedido";
    botonRepetirPedido.textContent =
        String.fromCodePoint(0x21BB) +
        " Repetir " +
        String.fromCodePoint(0xFA) +
        "ltimo pedido";
    botonRepetirPedido.addEventListener("click", repetirUltimoPedido);

    buscadorProductosPedido = document.createElement("input");
    buscadorProductosPedido.type = "search";
    buscadorProductosPedido.className = "buscadorPedido";
    buscadorProductosPedido.placeholder = "Buscar producto o marca...";
    buscadorProductosPedido.setAttribute(
        "aria-label",
        "Buscar producto o marca"
    );

    buscadorProductosPedido.addEventListener("input", () => {
        aplicarFiltroProductosPedido();
    });

    accionesBusqueda.append(
        botonRepetirPedido,
        buscadorProductosPedido
    );

    contenedorProductos.parentNode.insertBefore(
        accionesBusqueda,
        contenedorProductos
    );

    mensajeSinResultadosPedido = document.createElement("p");
    mensajeSinResultadosPedido.className = "mensajeBusquedaPedido";
    mensajeSinResultadosPedido.textContent =
        "No se encontraron productos con esa b" +
        String.fromCodePoint(0xFA) +
        "squeda.";
    mensajeSinResultadosPedido.style.display = "none";
    contenedorProductos.parentNode.insertBefore(
        mensajeSinResultadosPedido,
        contenedorProductos.nextSibling
    );
}

function actualizarEstadoBotonRepetir() {
    if (!botonRepetirPedido) return;

    botonRepetirPedido.style.display = obtenerHistorial().length > 0
        ? "inline-flex"
        : "none";
}

function aplicarFiltroProductosPedido() {
    if (!contenedorProductos) return;

    const termino = normalizarTexto(
        buscadorProductosPedido ? buscadorProductosPedido.value : ""
    );
    let cantidadMarcasVisibles = 0;

    contenedorProductos.querySelectorAll(".marca").forEach(marca => {
        const tituloMarca = marca.querySelector(".tituloMarca span");
        const nombreMarca = normalizarTexto(
            tituloMarca ? tituloMarca.textContent : ""
        );
        const coincideMarca = termino !== "" && nombreMarca.includes(termino);
        let cantidadFilasVisibles = 0;

        marca.querySelectorAll(".fila").forEach(fila => {
            const textoProducto = fila.querySelector("span");
            const nombreProducto = normalizarTexto(
                fila.dataset.producto ||
                (textoProducto ? textoProducto.textContent : "")
            );
            const visible = termino === "" || coincideMarca || nombreProducto.includes(termino);

            fila.style.display = visible ? "flex" : "none";
            if (visible) cantidadFilasVisibles += 1;
        });

        const visible = cantidadFilasVisibles > 0;
        marca.style.display = visible ? "block" : "none";

        const cuerpo = marca.querySelector(".listaProdutos");
        if (cuerpo) {
            if (termino !== "" && visible) {
                cuerpo.style.display = "block";
            } else if (termino === "") {
                cuerpo.style.display = "none";
            }
        }

        if (visible) cantidadMarcasVisibles += 1;
    });

    if (mensajeSinResultadosPedido) {
        mensajeSinResultadosPedido.style.display =
            termino !== "" && cantidadMarcasVisibles === 0
                ? "block"
                : "none";
    }
}

function crearMarca(nombreMarca, productos, indiceMarca) {
    const card = document.createElement("div");
    card.className = "marca";
    card.style.setProperty("--acento", colorMarca(indiceMarca));

    const titulo = document.createElement("div");
    titulo.className = "tituloMarca";

    const nombre = document.createElement("span");
    nombre.textContent = nombreMarca;

    const flecha = document.createElement("span");
    flecha.textContent = "\u25bc";
    titulo.append(nombre, flecha);

    const cuerpo = document.createElement("div");
    cuerpo.className = "listaProdutos";
    cuerpo.style.display = "none";

    if (!Array.isArray(productos) || productos.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "subtitulo";
        vacio.textContent = "Esta marca todav\u00eda no tiene productos.";
        cuerpo.appendChild(vacio);
    } else {
        productos.forEach(producto => {
            const fila = document.createElement("div");
            fila.className = "fila";
            fila.dataset.producto = producto.nombre;

            const texto = document.createElement("span");
            texto.textContent = producto.nombre;

            fila.append(
                texto,
                crearControlesProducto(
                    nombreMarca,
                    producto
                )
            );
            cuerpo.appendChild(fila);
        });
    }

    titulo.addEventListener("click", () => {
        document.querySelectorAll(".listaProdutos").forEach(lista => {
            if (lista !== cuerpo) lista.style.display = "none";
        });

        cuerpo.style.display = cuerpo.style.display === "none" ? "block" : "none";
    });

    card.append(titulo, cuerpo);
    contenedorProductos.appendChild(card);
}

function renderizarPedido() {
    if (!contenedorProductos) return;

    prepararBuscadorProductosPedido();
    actualizarEstadoBotonRepetir();
    contenedorProductos.innerHTML = "";
    const productos = obtenerProductos();

    obtenerMarcasOrdenadas(productos)
        .forEach((marca, indiceMarca) => {
            crearMarca(marca, productos[marca], indiceMarca);
        });

    restaurarBorradorPedido();
    actualizarResumenPedido();
    aplicarFiltroProductosPedido();
}

// Alias usado por menu.js.
const renderizarProductosPedido = renderizarPedido;

actualizarDatalistPedido();
renderizarPedido();

// -----------------------------------------------------
// PORTAPAPELES
// -----------------------------------------------------

async function copiarTexto(texto) {
    if (!texto) return false;

    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            await navigator.clipboard.writeText(texto);
            return true;
        }
    } catch (error) {
        console.warn("No se pudo usar el portapapeles moderno.", error);
    }

    // Alternativa para navegadores que no habilitan navigator.clipboard.
    try {
        const auxiliar = document.createElement("textarea");
        auxiliar.value = texto;
        auxiliar.setAttribute("readonly", "");
        auxiliar.style.position = "fixed";
        auxiliar.style.opacity = "0";
        document.body.appendChild(auxiliar);
        auxiliar.select();
        const copiado = document.execCommand("copy");
        auxiliar.remove();
        return copiado;
    } catch (error) {
        console.warn("No se pudo copiar el pedido.", error);
        return false;
    }
}

// -----------------------------------------------------
// REPETIR ULTIMO PEDIDO
// -----------------------------------------------------

function obtenerProductosEstructuradosPedido(pedido) {
    if (!pedido || !Array.isArray(pedido.productos)) return [];

    return pedido.productos
        .filter(item => item && typeof item === "object")
        .map(item => ({
            marca: String(item.marca || "").trim(),
            producto: String(item.producto || "").trim(),
            cantidad: Math.min(40, Math.max(0, Number(item.cantidad) || 0))
        }))
        .filter(item => item.marca && item.producto && item.cantidad > 0);
}

function obtenerObservacionesPedidoAnterior(pedido) {
    if (typeof pedido.observaciones === "string") {
        return pedido.observaciones.trim();
    }

    const textoPedido = String(pedido && pedido.pedido || "");
    const indiceObservaciones = textoPedido.indexOf("OBSERVACIONES\n");

    if (indiceObservaciones < 0) return "";

    return textoPedido
        .slice(indiceObservaciones + "OBSERVACIONES\n".length)
        .trim();
}

function repetirUltimoPedido() {
    const historial = obtenerHistorial();
    const ultimo = historial[0];

    if (!ultimo || (!ultimo.pedido && !Array.isArray(ultimo.productos))) {
        mostrarAviso(
            "Sin pedidos anteriores",
            "Todav" +
            String.fromCodePoint(0xED) +
            "a no hay un pedido guardado para repetir."
        );
        return;
    }

    const hayCantidadActual = Array.from(
        document.querySelectorAll(".marca select")
    ).some(select => Number(select.value) > 0);

    const cargar = () => {
        limpiarPedido();

        if (inputCliente) {
            inputCliente.value = String(ultimo.comercio || "");
        }

        if (inputObs) {
            inputObs.value = obtenerObservacionesPedidoAnterior(ultimo);
        }

        let cantidadCargada = 0;
        const productos = obtenerProductos();
        const productosEstructurados = obtenerProductosEstructuradosPedido(ultimo);
        const textoPedido = String(ultimo.pedido || "");

        document.querySelectorAll(".marca select").forEach(select => {
            const marca = Object.keys(productos).find(nombre => {
                return normalizarTexto(nombre) === normalizarTexto(select.dataset.marca);
            });

            const producto = marca
                ? productos[marca].find(item => {
                    return normalizarTexto(item.nombre) === normalizarTexto(select.dataset.producto);
                })
                : null;

            if (!producto) return;

            let cantidad = 0;
            const registroEstructurado = productosEstructurados.find(item => {
                return normalizarTexto(item.marca) === normalizarTexto(select.dataset.marca) &&
                    normalizarTexto(item.producto) === normalizarTexto(select.dataset.producto);
            });

            if (registroEstructurado) {
                cantidad = registroEstructurado.cantidad;
            } else if (productosEstructurados.length === 0) {
                const patron = new RegExp(
                    "^" + escaparTextoRegex(producto.nombre) + "\\s+x(\\d+)\\s*$",
                    "im"
                );
                const coincidencia = textoPedido.match(patron);
                cantidad = coincidencia ? Math.min(40, Number(coincidencia[1])) : 0;
            }

            select.value = String(cantidad);
            actualizarEstadoCantidad(select);
            cantidadCargada += cantidad;
        });

        if (buscadorProductosPedido) {
            buscadorProductosPedido.value = "";
        }

        aplicarFiltroProductosPedido();
        actualizarResumenPedido();
        guardarBorradorPedido();

        mostrarAviso(
            "Pedido repetido",
            "Se cargaron " +
            cantidadCargada +
            " unidades del " +
            String.fromCodePoint(0xFA) +
            "ltimo pedido."
        );
    };

    if (hayCantidadActual && typeof abrirConfirmacion === "function") {
        abrirConfirmacion(
            "Repetir pedido",
            "Se reemplazara el pedido que estas armando. " +
            String.fromCodePoint(0xBF) +
            "Continuar?",
            cargar
        );
        return;
    }

    cargar();
}

function escaparTextoRegex(texto) {
    const barra = String.fromCodePoint(0x5C);
    const caracteresEspeciales = ".*+?^${}()|[]" + barra;

    return String(texto)
        .split("")
        .map(caracter => {
            return caracteresEspeciales.includes(caracter)
                ? barra + caracter
                : caracter;
        })
        .join("");
}

function escaparHtmlPedido(texto) {
    return String(texto || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function mostrarVistaPreviaPedido(texto) {
    if (!pedidoDetalle) return;

    const seguro = escaparHtmlPedido(texto);
    pedidoDetalle.innerHTML = seguro
        .replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>");
}

// -----------------------------------------------------
// GENERAR PEDIDO
// -----------------------------------------------------

function generarPedido() {
    const cliente = inputCliente ? inputCliente.value.trim() : "";
    const observaciones = inputObs ? inputObs.value.trim() : "";
    const selects = document.querySelectorAll(".marca select");

    if (!cliente) {
        mostrarAviso(
            "Falta el comercio",
            "Ingres\u00e1 o eleg\u00ed el nombre del comercio antes de generar el pedido."
        );

        return false;
    }

    let cantidadProductos = 0;
    let cantidadTipos = 0;
    let hayProductos = false;
    const productosEstructurados = [];
    const bloquesMarcas = [];

    document.querySelectorAll(".marca").forEach(marca => {
        const titulo = marca.querySelector(".tituloMarca span");
        const nombreMarca = titulo ? titulo.textContent.trim() : "";
        const productosMarca = [];

        marca.querySelectorAll("select").forEach(select => {
            const cantidad = Number(select.value) || 0;
            if (cantidad <= 0) return;

            hayProductos = true;
            cantidadProductos += cantidad;
            cantidadTipos += 1;

            const producto = {
                marca: nombreMarca,
                producto: select.dataset.producto,
                cantidad
            };

            productosEstructurados.push(producto);
            productosMarca.push(producto);
        });

        if (productosMarca.length > 0) {
            bloquesMarcas.push({
                marca: nombreMarca,
                productos: productosMarca
            });
        }
    });

    if (!hayProductos) {
        mostrarAviso(
            "Pedido vac\u00edo",
            "Seleccion\u00e1 al menos un producto antes de generar el pedido."
        );

        return false;
    }

    const fechaTexto = new Date().toLocaleDateString("es-AR");
    const emojiComercio = String.fromCodePoint(0x1F3EA);
    const emojiResumen = String.fromCodePoint(0x1F4E6);
    const emojiObservaciones = String.fromCodePoint(0x1F50E);
    const emojisMarcas = [
        String.fromCodePoint(0x1F535),
        String.fromCodePoint(0x1F7E2),
        String.fromCodePoint(0x1F7E3),
        String.fromCodePoint(0x1F7E0),
        String.fromCodePoint(0x1F534)
    ];

    const detalleProductos = bloquesMarcas
        .map((bloque, indice) => {
            const emojiMarca = emojisMarcas[indice % emojisMarcas.length];
            const productos = bloque.productos
                .map(item => "- " + item.producto + " x" + item.cantidad)
                .join("\n");

            return emojiMarca + " *" + bloque.marca + "*\n" + productos;
        })
        .join("\n\n");

    let mensaje =
        emojiComercio +
        " *" +
        cliente +
        "*\n" +
        fechaTexto +
        "\n\n" +
        emojiResumen +
        " *RESUMEN DEL PEDIDO*\n" +
        "Unidades totales: " +
        cantidadProductos +
        "\n" +
        "Productos diferentes: " +
        cantidadTipos +
        "\n\n" +
        detalleProductos;

    if (observaciones) {
        mensaje +=
            "\n\n" +
            emojiObservaciones +
            " *OBSERVACIONES*\n" +
            observaciones;
    }

    ultimoPedidoTexto = mensaje.trim();
    const fecha = fechaTexto;

    // Copiar no debe bloquear ni impedir guardar el pedido.
    void copiarTexto(ultimoPedidoTexto);
    registrarPedido(cliente);

    agregarHistorial({
        fecha,
        timestamp: Date.now(),
        comercio: cliente,
        cantidad: cantidadProductos,
        pedido: ultimoPedidoTexto,
        productos: productosEstructurados,
        observaciones
    });

    actualizarEstadoBotonRepetir();
    borrarBorradorPedido();

    if (pedidoCliente) pedidoCliente.textContent = cliente;
    if (pedidoCantidad) pedidoCantidad.textContent = String(cantidadProductos);
    mostrarVistaPreviaPedido(ultimoPedidoTexto);
    if (modalPedido) modalPedido.classList.remove("oculto");

    return true;
}

// -----------------------------------------------------
// REGISTRAR VISITA
// -----------------------------------------------------

function registrarPedido(nombreComercio) {
    const comercios = obtenerComercios();
    const comercio = buscarComercioPorNombre(nombreComercio, comercios);

    // El pedido ya queda guardado en el historial aunque el nombre sea nuevo.
    if (!comercio) return false;

    comercio.pedidosRealizados = (Number(comercio.pedidosRealizados) || 0) + 1;
    comercio.ultimaVisita = new Date().toLocaleDateString("es-AR");
    comercio.pendienteSemana = false;

    return guardarComercios(comercios);
}

// -----------------------------------------------------
// LIMPIAR PEDIDO
// -----------------------------------------------------

function limpiarPedido() {
    if (inputCliente) inputCliente.value = "";
    if (inputObs) inputObs.value = "";

    document.querySelectorAll(".marca select").forEach(select => {
        select.value = "0";
        select.classList.remove("activo");
    });

    document.querySelectorAll(".listaProdutos").forEach(lista => {
        lista.style.display = "none";
    });

    borrarBorradorPedido();
    actualizarResumenPedido();
}

function abrirPedidoNuevoParaComercio(nombreComercio) {
    // Este acceso siempre empieza desde cero, sin recuperar el borrador anterior.
    limpiarPedido();

    if (buscadorProductosPedido) {
        buscadorProductosPedido.value = "";
    }

    if (typeof mostrarPantalla === "function") {
        mostrarPantalla("pedido");
    }

    if (inputCliente) {
        inputCliente.value = String(nombreComercio || "").trim();
    }

    if (inputObs) {
        inputObs.value = "";
    }

    aplicarFiltroProductosPedido();
    actualizarResumenPedido();
    guardarBorradorPedido();
}

// -----------------------------------------------------
// BOTONES Y ATAJOS
// -----------------------------------------------------

if (botonGenerar) {
    botonGenerar.addEventListener("click", generarPedido);
}

if (botonReset) {
    botonReset.addEventListener("click", () => {
        const datos = obtenerDatosBorradorPedido();
        const hayAlgoParaBorrar = Boolean(
            datos.cliente ||
            datos.observaciones ||
            datos.cantidades.length > 0
        );

        if (!hayAlgoParaBorrar) return;

        if (typeof abrirConfirmacion === "function") {
            abrirConfirmacion(
                "Vaciar pedido",
                "Se van a borrar las cantidades, el comercio y las observaciones del pedido actual.",
                limpiarPedido
            );
        }
    });
}

if (inputCliente) {
    inputCliente.addEventListener("input", guardarBorradorPedido);

    inputCliente.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
        }
    });
}

if (inputObs) {
    inputObs.addEventListener("input", guardarBorradorPedido);

    inputObs.addEventListener("keydown", event => {
        if (event.ctrlKey && event.key === "Enter") generarPedido();
    });
}

if (copiarPedido) {
    copiarPedido.addEventListener("click", () => {
        void copiarTexto(ultimoPedidoTexto);
    });
}

if (whatsappPedido) {
    whatsappPedido.addEventListener("click", () => {
        const texto = encodeURIComponent(ultimoPedidoTexto);
        const esAndroid = /Android/i.test(navigator.userAgent);

        if (esAndroid) {
            const fallback = encodeURIComponent(`https://wa.me/?text=${texto}`);
            window.location.href =
                `intent://send?text=${texto}#Intent;` +
                "scheme=whatsapp;" +
                "package=com.whatsapp;" +
                `S.browser_fallback_url=${fallback};` +
                "end";
        } else {
            window.open(`https://wa.me/?text=${texto}`, "_blank");
        }
    });
}

if (modalPedido) {
    modalPedido.addEventListener("click", event => {
        if (event.target === modalPedido) modalPedido.classList.add("oculto");
    });
}