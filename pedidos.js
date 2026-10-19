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

// El borrador del pedido queda en cada celular. El del modo prueba (T9, se
// sacó en T16c) queda guardado en "vendefrio_borrador_pedido_prueba", sin usarse.
const DB_BORRADOR_PEDIDO = "vendefrio_borrador_pedido";

let ultimoPedidoTexto = "";
let buscadorProductosPedido = null;
let mensajeSinResultadosPedido = null;

// -----------------------------------------------------
// COMERCIOS
// -----------------------------------------------------

function actualizarDatalistPedido() {
    if (!listaComercios) return;

    listaComercios.innerHTML = "";

    comerciosActivos()
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

// El comercio elegido en Nuevo pedido, o null.
function comercioDelPedidoActual() {
    const nombre = inputCliente ? inputCliente.value.trim() : "";
    return nombre ? buscarComercioPorNombre(nombre) : null;
}

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
        const palabra = document.getElementById("palabraTiposPedido");
        if (palabra) palabra.textContent = tipos === 1 ? "producto" : "productos";
    }

    // Estilo nuevo (T34): total en plata abajo y "N en el pedido" por marca.
    const productosCatalogo = obtenerProductos();
    const comercioActual = comercioDelPedidoActual();
    let plata = 0;
    document.querySelectorAll("#productos .marca").forEach(marca => {
        let enElPedido = 0;
        marca.querySelectorAll("select").forEach(select => {
            const cantidad = Number(select.value) || 0;
            if (!cantidad) return;
            enElPedido += 1;
            const producto = (productosCatalogo[select.dataset.marca] || [])
                .find(item => item && item.nombre === select.dataset.producto);
            // El precio que corre hoy: oferta o lista del comercio (T68, T78),
            // o el cambiado solo para este pedido (T98).
            const cambiado = window.nuevoPedidoVendeFrio
                ? window.nuevoPedidoVendeFrio.precioCambiado(select.dataset.marca, select.dataset.producto)
                : null;
            const precio = Number(cambiado !== null ? cambiado : precioVigente(producto, comercioActual));
            if (Number.isFinite(precio)) plata += precio * cantidad;
        });
        const contador = marca.querySelector(".contadorMarca");
        if (contador) contador.textContent = enElPedido ? enElPedido + " en el pedido" : "";
    });
    const totalPlata = document.getElementById("totalPlataPedido");
    if (totalPlata) totalPlata.textContent = "$ " + Math.round(plata).toLocaleString("es-AR");
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
    // El "+" se convierte en contador (T34): los controles saben la cantidad.
    if (select.parentNode) select.parentNode.dataset.cantidad = select.value;
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
        "",
        "Volver a cero"
    );
    botonBorrar.innerHTML = window.icono("tacho", 17);
    botonMenos.innerHTML = window.icono("menos", 18);
    botonMas.innerHTML = window.icono("mas", 18);

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
        botonBorrar,
        botonMenos,
        select,
        botonMas
    );
    controles.dataset.cantidad = "0";

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

    // "Repetir último pedido" está en el botón ⋯ de Nuevo pedido (T95).
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

    accionesBusqueda.append(buscadorProductosPedido);

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

        const marcaElegida = !marcaElegidaPedido || marca.dataset.marca === marcaElegidaPedido;
        // T97: abierta si la abrió, si se busca algo o si se eligió su chip.
        const abierta = marca.dataset.plegable !== "1" || termino !== "" ||
            Boolean(marcaElegidaPedido) || marcaAbiertaPedido(marca.dataset.marca);

        marca.querySelectorAll(".fila").forEach(fila => {
            const textoProducto = fila.querySelector("span");
            const nombreProducto = normalizarTexto(
                fila.dataset.producto ||
                (textoProducto ? textoProducto.textContent : "")
            );
            const visible = marcaElegida && (termino === "" || coincideMarca || nombreProducto.includes(termino));

            fila.style.display = visible ? "flex" : "none";
            if (visible) cantidadFilasVisibles += 1;
        });

        const visible = cantidadFilasVisibles > 0;
        marca.style.display = visible ? "block" : "none";

        const cuerpo = marca.querySelector(".listaProdutos");
        if (cuerpo) {
            cuerpo.style.display = abierta ? "block" : "none";
        }
        marca.classList.toggle("cerrada", !abierta);
        const titulo = marca.querySelector(".tituloMarca");
        if (titulo && marca.dataset.plegable === "1") titulo.setAttribute("aria-expanded", String(abierta));

        if (visible) cantidadMarcasVisibles += 1;
    });

    if (mensajeSinResultadosPedido) {
        mensajeSinResultadosPedido.style.display =
            termino !== "" && cantidadMarcasVisibles === 0
                ? "block"
                : "none";
    }
}

// Más > Preferencias de trabajo > "Productos en el pedido" (T50): como en
// el catálogo, de la A a la Z o los más pedidos primero.
function ordenarProductosDelPedido(productos) {
    const orden = window.preferenciasVendeFrio?.valor("ordenProductos") || "marca";
    const lista = productos.slice();
    if (orden === "alfabetico") {
        return lista.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
    }
    if (orden === "frecuencia") {
        const pedidos = typeof obtenerPedidosQueCuentan === "function" ? obtenerPedidosQueCuentan() : [];
        const veces = new Map();
        pedidos.forEach(pedido => (pedido.productos || []).forEach(item => {
            const nombre = String(item.nombre || item.producto || "");
            veces.set(nombre, (veces.get(nombre) || 0) + (Number(item.cantidad) || 0));
        }));
        return lista.sort((a, b) => (veces.get(b.nombre) || 0) - (veces.get(a.nombre) || 0));
    }
    return lista;
}

// Marcas desplegables (T97): con dos marcas o más, cada una se abre y se
// cierra tocando su nombre. Las abiertas se recuerdan en este celular.
const DB_MARCAS_ABIERTAS_PEDIDO = "vendefrio_marcas_abiertas_pedido";

function marcasAbiertasPedido() {
    try {
        const lista = JSON.parse(localStorage.getItem(DB_MARCAS_ABIERTAS_PEDIDO) || "[]");
        return Array.isArray(lista) ? lista : [];
    } catch (error) {
        return [];
    }
}

function marcaAbiertaPedido(nombreMarca) {
    return marcasAbiertasPedido().includes(nombreMarca);
}

function abrirMarcaPedido(nombreMarca, abrir) {
    const lista = marcasAbiertasPedido().filter(nombre => nombre !== nombreMarca);
    if (abrir) lista.push(nombreMarca);
    try {
        localStorage.setItem(DB_MARCAS_ABIERTAS_PEDIDO, JSON.stringify(lista));
    } catch (error) {
        console.warn("No se pudo recordar la marca abierta.", error);
    }
}

function crearMarca(nombreMarca, productos, indiceMarca, plegable) {
    const card = document.createElement("div");
    card.className = "marca";
    card.style.setProperty("--acento", colorMarca(indiceMarca));

    const titulo = document.createElement("div");
    titulo.className = "tituloMarca";

    const nombre = document.createElement("span");
    nombre.textContent = nombreMarca;

    // Estilo nuevo (T34): las marcas van abiertas, una debajo de la otra,
    // con cuántos productos de cada una hay en el pedido.
    const contador = document.createElement("small");
    contador.className = "contadorMarca";
    titulo.append(nombre, contador);
    card.dataset.marca = nombreMarca;
    if (plegable) {
        card.dataset.plegable = "1";
        titulo.setAttribute("role", "button");
        titulo.tabIndex = 0;
        titulo.setAttribute("aria-expanded", "false");
        const flecha = document.createElement("i");
        flecha.className = "flechaMarca";
        flecha.innerHTML = window.icono("chevAbajo", 18);
        titulo.appendChild(flecha);
    }

    const cuerpo = document.createElement("div");
    cuerpo.className = "listaProdutos";
    cuerpo.style.display = "block";

    if (!Array.isArray(productos) || productos.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "subtitulo";
        vacio.textContent = "Esta marca todav\u00eda no tiene productos.";
        cuerpo.appendChild(vacio);
    } else {
        ordenarProductosDelPedido(productos).forEach(producto => {
            const fila = document.createElement("div");
            fila.className = "fila";
            fila.dataset.producto = producto.nombre;

            const texto = document.createElement("span");
            texto.className = "nombreProductoPedido";
            texto.textContent = producto.nombre;
            const precio = Number(producto.precio);
            if (producto.precio !== null && producto.precio !== undefined && producto.precio !== "" && Number.isFinite(precio)) {
                const precioTexto = document.createElement("small");
                precioTexto.textContent = "$ " + precio.toLocaleString("es-AR") + " c/u";
                texto.appendChild(precioTexto);
            }

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

    // Tocar el nombre la abre o la cierra (T97). Con una sola marca, va abierta.
    const alternar = () => {
        if (!plegable) return;
        abrirMarcaPedido(nombreMarca, card.classList.contains("cerrada"));
        aplicarFiltroProductosPedido();
    };
    titulo.addEventListener("click", alternar);
    titulo.addEventListener("keydown", evento => {
        if (evento.key !== "Enter" && evento.key !== " ") return;
        evento.preventDefault();
        alternar();
    });

    card.append(titulo, cuerpo);
    contenedorProductos.appendChild(card);
}

// Chips de marcas arriba de los productos (T34): "Todas" o una marca.
let marcaElegidaPedido = "";

function dibujarChipsMarcasPedido(marcas, productos) {
    if (!contenedorProductos) return;
    let chips = document.getElementById("chipsMarcasPedido");
    if (!chips) {
        chips = document.createElement("div");
        chips.id = "chipsMarcasPedido";
        chips.className = "chipsMarcasPedido";
        chips.setAttribute("role", "tablist");
        chips.setAttribute("aria-label", "Marcas");
        contenedorProductos.parentNode.insertBefore(chips, contenedorProductos);
    }
    if (marcaElegidaPedido && !marcas.includes(marcaElegidaPedido)) marcaElegidaPedido = "";
    chips.innerHTML = "";
    chips.classList.toggle("oculto", marcas.length < 2);

    const chip = (valor, texto, cantidad) => {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "chipMarca" + (marcaElegidaPedido === valor ? " activo" : "");
        boton.setAttribute("role", "tab");
        boton.setAttribute("aria-selected", String(marcaElegidaPedido === valor));
        boton.textContent = texto;
        if (cantidad !== undefined) {
            const numero = document.createElement("small");
            numero.textContent = String(cantidad);
            boton.appendChild(numero);
        }
        boton.addEventListener("click", () => {
            marcaElegidaPedido = valor;
            chips.querySelectorAll(".chipMarca").forEach(otro => {
                const activo = otro === boton;
                otro.classList.toggle("activo", activo);
                otro.setAttribute("aria-selected", String(activo));
            });
            aplicarFiltroProductosPedido();
        });
        return boton;
    };

    chips.appendChild(chip("", "Todas"));
    marcas.forEach(marca => chips.appendChild(chip(marca, marca, (productos[marca] || []).length)));
}

function renderizarPedido() {
    if (!contenedorProductos) return;

    prepararBuscadorProductosPedido();
    contenedorProductos.innerHTML = "";
    // Los archivados (T63) no se venden.
    const productos = productosParaVender();

    const marcas = obtenerMarcasOrdenadas(productos);
    marcas.forEach((marca, indiceMarca) => {
        crearMarca(marca, productos[marca], indiceMarca, marcas.length > 1);
    });

    dibujarChipsMarcasPedido(obtenerMarcasOrdenadas(productos), productos);
    restaurarBorradorPedido();
    actualizarResumenPedido();
    aplicarFiltroProductosPedido();
    aplicarProductoPendienteCatalogo();
}

// -----------------------------------------------------
// PRODUCTO ELEGIDO DESDE CATALOGO
// -----------------------------------------------------

// catalogo.js deja el producto elegido en esta clave antes de abrir Pedido.
const DB_PRODUCTO_CATALOGO_PENDIENTE = "vendefrio_producto_catalogo_pendiente";

function aplicarProductoPendienteCatalogo() {
    const contenido = localStorage.getItem(DB_PRODUCTO_CATALOGO_PENDIENTE);
    if (!contenido) return;

    localStorage.removeItem(DB_PRODUCTO_CATALOGO_PENDIENTE);

    let pendiente;

    try {
        pendiente = JSON.parse(contenido);
    } catch (error) {
        return;
    }

    if (!pendiente || typeof pendiente !== "object") return;

    const select = Array.from(
        document.querySelectorAll(".marca select")
    ).find(item => {
        return (
            normalizarTexto(item.dataset.marca) === normalizarTexto(pendiente.marca) &&
            normalizarTexto(item.dataset.producto) === normalizarTexto(pendiente.producto)
        );
    });

    if (!select) {
        mostrarAviso(
            "Producto no encontrado",
            "No se encontr" + String.fromCodePoint(0xF3) +
            " el producto en el pedido."
        );
        return;
    }

    if (buscadorProductosPedido && buscadorProductosPedido.value) {
        buscadorProductosPedido.value = "";
        aplicarFiltroProductosPedido();
    }

    cambiarCantidad(select, 1);

    const marca = select.closest(".marca");
    if (marca) {
        abrirMarcaPedido(marca.dataset.marca, true);
        aplicarFiltroProductosPedido();
    }

    const fila = select.closest(".fila");
    if (fila) fila.scrollIntoView({ block: "center" });

    mostrarToast(
        escaparHtmlPedido(select.dataset.producto) + " agregado al pedido"
    );
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
    // Eliminados y cancelados no se repiten (T26).
    const historial = obtenerPedidosQueCuentan();
    // T64: en la nube, el último pedido que cargó esta persona (no el de
    // otro del equipo).
    const yo = usaNubeReal() && typeof personaDeEsteCelular === "function" ? personaDeEsteCelular() : null;
    const ultimo = yo
        ? historial.find(pedido => !pedido.autor || pedido.autor.idPersona === yo.idPersona)
        : historial[0];

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

    // Etapa 8: sin "¿Seguro?". Si había algo a medio armar, "Deshacer" lo
    // devuelve.
    const volverAlPedido = hayCantidadActual ? recordarPedidoActual() : null;
    cargar();
    if (volverAlPedido && window.piezas) {
        window.piezas.deshacer("Se reemplazó el pedido que armabas", volverAlPedido);
    }
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

    // Precios cambiados solo para este pedido (T98).
    if (window.nuevoPedidoVendeFrio) window.nuevoPedidoVendeFrio.ajustarProductos(productosEstructurados);

    if (!hayProductos) {
        mostrarAviso(
            "Pedido vac\u00edo",
            "Seleccion\u00e1 al menos un producto antes de generar el pedido."
        );

        return false;
    }

    // Pedido completo (T20): en la nube el pedido nace "Cargado", con su
    // autor y el precio de cada producto. Sin saber quién usa el celular no
    // se carga, para que no quede sin autor. El modo personal sigue igual.
    const timestamp = Date.now();
    let datosNube = null;

    if (usaNubeReal()) {
        datosNube = prepararPedidoParaLaNube(productosEstructurados, timestamp, cliente);

        if (!datosNube) {
            mostrarAviso(
                "Esperá un momento",
                "La app todavía está reconociendo quién usa este celular. Probá de nuevo en unos segundos: el pedido no se perdió. Si sigue igual, cerrá y volvé a abrir la app."
            );
            return false;
        }
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
                .map(item => "- " + item.producto + " x" + item.cantidad +
                    (item.precioCambiado ? " (precio especial $ " + Number(item.precio).toLocaleString("es-AR") + ")" : ""))
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

    // Fecha de entrega, cambios y precio especial (T95, T96, T98).
    const textoExtra = window.nuevoPedidoVendeFrio ? window.nuevoPedidoVendeFrio.textoParaMensaje() : "";
    if (textoExtra) mensaje += "\n\n" + textoExtra;

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

    const idPedidoNuevo = agregarPedidoConId({
        fecha,
        timestamp,
        comercio: cliente,
        cantidad: cantidadProductos,
        pedido: ultimoPedidoTexto,
        productos: datosNube ? datosNube.productos : productosEstructurados,
        observaciones,
        ...(datosNube ? datosNube.campos : {})
    });

    borrarBorradorPedido();
    if (window.nuevoPedidoVendeFrio) window.nuevoPedidoVendeFrio.alGuardar(idPedidoNuevo, cliente);

    if (pedidoCliente) pedidoCliente.textContent = cliente;
    if (pedidoCantidad) pedidoCantidad.textContent = String(cantidadProductos);
    mostrarVistaPreviaPedido(ultimoPedidoTexto);
    mostrarImprimirPedidoGenerado(idPedidoNuevo);
    if (modalPedido) modalPedido.classList.remove("oculto");
    if (navigator.vibrate && window.preferenciasVendeFrio?.valor("vibrar") !== false) navigator.vibrate(35);

    return true;
}

// -----------------------------------------------------
// REGISTRAR VISITA
// -----------------------------------------------------

function registrarPedido(nombreComercio) {
    const comercio = buscarComercioPorNombre(nombreComercio);

    // El pedido ya queda guardado en el historial aunque el nombre sea nuevo.
    if (!comercio) return false;

    // T64: el contador sale de los pedidos guardados (más este, que se guarda
    // enseguida), así dos celulares que cargan a la vez no se pisan la cuenta.
    const anteriores = typeof contarPedidosDelComercio === "function" && typeof obtenerPedidosQueCuentan === "function"
        ? contarPedidosDelComercio(comercio.nombre, obtenerPedidosQueCuentan())
        : Number(comercio.pedidosRealizados) || 0;

    return actualizarComercioPorId(comercio.id, {
        pedidosRealizados: anteriores + 1,
        ultimaVisita: new Date().toLocaleDateString("es-AR"),
        pendienteSemana: false
    });
}

// -----------------------------------------------------
// LIMPIAR PEDIDO
// -----------------------------------------------------

// Etapa 8 ("Deshacer" en vez de "¿Seguro?"): guarda cómo está el pedido
// ahora y devuelve la función que lo deja como estaba.
function recordarPedidoActual() {
    const datos = obtenerDatosBorradorPedido();
    const extras = window.nuevoPedidoVendeFrio?.leerBorrador?.();
    return () => {
        try {
            localStorage.setItem(DB_BORRADOR_PEDIDO, JSON.stringify(datos));
        } catch (error) {
            return;
        }
        restaurarBorradorPedido();
        if (extras) window.nuevoPedidoVendeFrio.guardarBorrador(extras);
        if (inputCliente) inputCliente.dispatchEvent(new Event("input", { bubbles: true }));
        document.querySelectorAll(".marca select").forEach(actualizarEstadoCantidad);
        aplicarFiltroProductosPedido();
        actualizarResumenPedido();
    };
}

function limpiarPedido() {
    if (inputCliente) inputCliente.value = "";
    if (inputObs) inputObs.value = "";

    document.querySelectorAll(".marca select").forEach(select => {
        select.value = "0";
        select.classList.remove("activo");
        // Que el contador verde vuelva a ser el "+".
        if (select.parentNode) select.parentNode.dataset.cantidad = "0";
    });

    borrarBorradorPedido();
    aplicarFiltroProductosPedido();
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

        // Etapa 8: sin "¿Seguro?". Se vacía y queda "Deshacer" unos segundos.
        const volverAlPedido = recordarPedidoActual();
        limpiarPedido();
        if (window.piezas) window.piezas.deshacer("Pedido vaciado", volverAlPedido);
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

// Imprimir ticket (T28b): en "Pedido generado", la opción de imprimir el
// pedido recién cargado (solo en la nube y con Web Bluetooth). Elige las
// copias e imprime; si no se toca, se sigue como siempre.
let idUltimoPedidoGenerado = "";

function mostrarImprimirPedidoGenerado(id) {
    idUltimoPedidoGenerado = id || "";
    const boton = document.getElementById("imprimirPedidoGenerado");
    if (!boton) return;

    const pedido = id ? obtenerHistorial().find(item => item.id === id) : null;
    const puede = Boolean(pedido && window.impresionVendeFrio?.puedeImprimir?.(pedido));
    boton.classList.toggle("oculto", !puede);
    if (puede && window.icono && !boton.querySelector("svg")) {
        boton.insertAdjacentHTML("afterbegin", window.icono("impresora", 18));
    }
}

document.getElementById("imprimirPedidoGenerado")?.addEventListener("click", () => {
    if (!idUltimoPedidoGenerado) return;
    window.impresionVendeFrio?.elegirCopias?.(idUltimoPedidoGenerado);
});

// -----------------------------------------------------
// EDITAR UN PEDIDO (T25)
// -----------------------------------------------------
// Solo en la nube, desde la ficha del pedido (seguimiento.js), para quien lo
// cargó y el dueño. Es una ventana aparte del formulario "Nuevo pedido": el
// borrador del pedido nuevo no se toca. Los productos que no cambian
// conservan su línea (y sus tildes); uno nuevo o con otra cantidad lleva una
// línea nueva, vuelve a quedar sin tildar y la checklist lo marca para
// revisar. nube.js guarda la edición y avisa a quien corresponde.

const CANTIDAD_MAXIMA_EDICION = 40;
const MAXIMO_RESULTADOS_EDICION = 12;

// { id, foto (lo pedido al abrir, para saber si otro lo cambió), comercio,
//   observaciones, filas: [{ clave, item (línea original o null), marca,
//   producto, original, cantidad }] }
let edicionAbierta = null;
let contadorFilasNuevas = 0;

// El mismo texto para WhatsApp que arma generarPedido, para un pedido que
// ya existe (con su fecha de carga). Las marcas van en el orden en que
// aparecen en el pedido.
function armarTextoDelPedido(cliente, fechaTexto, productos, observaciones) {
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

    const bloquesMarcas = [];
    let cantidadProductos = 0;

    productos.forEach(item => {
        let bloque = bloquesMarcas.find(actual => actual.marca === item.marca);
        if (!bloque) {
            bloque = { marca: item.marca, productos: [] };
            bloquesMarcas.push(bloque);
        }
        bloque.productos.push(item);
        cantidadProductos += Number(item.cantidad) || 0;
    });

    const detalleProductos = bloquesMarcas
        .map((bloque, indice) => {
            const emojiMarca = emojisMarcas[indice % emojisMarcas.length];
            const lineas = bloque.productos
                .map(item => "- " + item.producto + " x" + item.cantidad +
                    (item.precioCambiado ? " (precio especial $ " + Number(item.precio).toLocaleString("es-AR") + ")" : ""))
                .join("\n");

            return emojiMarca + " *" + bloque.marca + "*\n" + lineas;
        })
        .join("\n\n");

    let mensaje =
        emojiComercio + " *" + cliente + "*\n" +
        fechaTexto + "\n\n" +
        emojiResumen + " *RESUMEN DEL PEDIDO*\n" +
        "Unidades totales: " + cantidadProductos + "\n" +
        "Productos diferentes: " + productos.length + "\n\n" +
        detalleProductos;

    if (observaciones) {
        mensaje += "\n\n" + emojiObservaciones + " *OBSERVACIONES*\n" + observaciones;
    }

    return mensaje.trim();
}

function fotoDeLoPedido(pedido) {
    return JSON.stringify([
        Array.isArray(pedido.productos) ? pedido.productos : [],
        String(pedido.comercio || ""),
        String(pedido.observaciones || "")
    ]);
}

function crearModalEdicionPedido() {
    let modal = document.getElementById("modalEditarPedido");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "modalEditarPedido";
    modal.className = "modal oculto";
    modal.innerHTML = `
        <div class="modalContenido editarPedido" role="dialog" aria-modal="true" aria-labelledby="tituloEditarPedido">
            <h2 id="tituloEditarPedido">Editar pedido</h2>
            <p class="explicacionTextoPedido" id="explicacionEditarPedido"></p>
            <label for="comercioEditarPedido">Comercio</label>
            <input id="comercioEditarPedido" type="text" list="listaComercios" autocomplete="off" placeholder="Nombre del comercio">
            <h3 class="tituloSeccionEditar">Productos</h3>
            <div id="productosEditarPedido" class="productosEditarPedido"></div>
            <label for="buscarEditarPedido">Agregar producto</label>
            <input id="buscarEditarPedido" type="search" autocomplete="off" placeholder="Buscar producto o marca...">
            <div id="resultadosEditarPedido" class="resultadosEditarPedido"></div>
            <label for="obsEditarPedido">Observaciones</label>
            <textarea id="obsEditarPedido" rows="3" placeholder="Observaciones del pedido"></textarea>
            <div id="cambiosEditarPedido" class="cambiosEditarPedido" aria-live="polite"></div>
            <p id="errorEditarPedido" class="errorTextoPedido oculto" role="alert"></p>
            <div class="modalBotones">
                <button type="button" class="btnModalCancelar" id="cancelarEditarPedido">Cancelar</button>
                <button type="button" class="btnModalConfirmar" id="guardarEditarPedido">Guardar cambios</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Tocar afuera cierra solo si todavía no se cambió nada.
    modal.addEventListener("click", event => {
        if (event.target === modal && cambiosDeLaEdicion().partes.length === 0) cerrarEdicionPedido();
    });

    document.getElementById("cancelarEditarPedido").addEventListener("click", cerrarEdicionPedido);
    document.getElementById("guardarEditarPedido").addEventListener("click", guardarEdicionPedido);

    const productos = document.getElementById("productosEditarPedido");
    productos.addEventListener("click", event => {
        const boton = event.target.closest("button[data-clave]");
        if (!boton) return;

        const fila = filaDeEdicion(boton.dataset.clave);
        if (!fila) return;

        if (boton.classList.contains("botonMenos")) fila.cantidad = Math.max(0, fila.cantidad - 1);
        else if (boton.classList.contains("botonMas")) fila.cantidad = Math.min(maximoDeFila(fila), fila.cantidad + 1);
        else if (boton.classList.contains("botonBorrar")) fila.cantidad = 0;
        else return;

        dibujarFilasEdicion(fila.clave);
    });

    productos.addEventListener("change", event => {
        const select = event.target.closest("select[data-clave]");
        const fila = select ? filaDeEdicion(select.dataset.clave) : null;
        if (!fila) return;

        fila.cantidad = Math.max(0, Math.min(maximoDeFila(fila), Number(select.value) || 0));
        dibujarFilasEdicion(fila.clave);
    });

    const buscador = document.getElementById("buscarEditarPedido");
    buscador.addEventListener("input", dibujarResultadosEdicion);
    buscador.addEventListener("keydown", event => {
        if (event.key === "Enter") event.preventDefault();
    });

    document.getElementById("resultadosEditarPedido").addEventListener("click", event => {
        const boton = event.target.closest("button[data-marca]");
        if (boton) agregarProductoEdicion(boton.dataset.marca, boton.dataset.producto);
    });

    ["comercioEditarPedido", "obsEditarPedido"].forEach(id => {
        document.getElementById(id).addEventListener("input", () => {
            ocultarErrorEdicion();
            dibujarCambiosEdicion();
        });
    });

    return modal;
}

function filaDeEdicion(clave) {
    return edicionAbierta ? edicionAbierta.filas.find(fila => fila.clave === clave) || null : null;
}

function maximoDeFila(fila) {
    return Math.max(CANTIDAD_MAXIMA_EDICION, fila.original);
}

function abrirEdicionPedido(id) {
    const pedido = obtenerHistorial().find(item => String(item.id || "") === String(id || ""));
    const nube = window.nubeVendeFrio;

    if (!pedido || !nube || typeof nube.puedeEditarElPedido !== "function" || !nube.puedeEditarElPedido(pedido)) {
        mostrarAviso("No se puede editar", "Solo quien cargó el pedido o el dueño lo edita, y un pedido cancelado no se edita.");
        return;
    }

    const modal = crearModalEdicionPedido();

    edicionAbierta = {
        id: String(pedido.id),
        foto: fotoDeLoPedido(pedido),
        comercio: String(pedido.comercio || "").trim(),
        observaciones: String(pedido.observaciones || "").trim(),
        filas: (Array.isArray(pedido.productos) ? pedido.productos : [])
            .filter(item => item && typeof item === "object" && (Number(item.cantidad) || 0) > 0)
            .map((item, posicion) => ({
                clave: "lin" + posicion,
                item,
                marca: String(item.marca || "").trim(),
                producto: String(item.producto || "").trim(),
                original: Number(item.cantidad) || 0,
                cantidad: Number(item.cantidad) || 0
            }))
    };

    const estado = estadoActualDelPedido(pedido);
    document.getElementById("explicacionEditarPedido").textContent = estado === "cargado"
        ? "Los cambios quedan en el seguimiento con tu nombre."
        : "Está «" + nombreDeEstadoPedido(estado) + "». Los productos que no cambies conservan sus tildes; lo nuevo o con otra cantidad queda para revisar y se avisa a quien está trabajando en el pedido.";
    document.getElementById("comercioEditarPedido").value = edicionAbierta.comercio;
    document.getElementById("obsEditarPedido").value = edicionAbierta.observaciones;
    document.getElementById("buscarEditarPedido").value = "";

    actualizarDatalistPedido();
    ocultarErrorEdicion();
    dibujarFilasEdicion();
    dibujarResultadosEdicion();

    modal.classList.remove("oculto");
    const contenido = modal.querySelector(".modalContenido");
    if (contenido) contenido.scrollTop = 0;
}

function cerrarEdicionPedido() {
    edicionAbierta = null;
    const modal = document.getElementById("modalEditarPedido");
    if (modal) modal.classList.add("oculto");
}

function ocultarErrorEdicion() {
    const error = document.getElementById("errorEditarPedido");
    if (error) error.classList.add("oculto");
}

function mostrarErrorEdicion(texto) {
    const error = document.getElementById("errorEditarPedido");
    if (!error) return;

    error.textContent = texto;
    error.classList.remove("oculto");
    error.scrollIntoView({ block: "nearest" });
}

// Productos agrupados por marca, en el orden del pedido. Cada uno con su
// cantidad y, si cambió, cómo era antes.
function dibujarFilasEdicion(claveConFoco) {
    const contenedor = document.getElementById("productosEditarPedido");
    if (!contenedor || !edicionAbierta) return;

    contenedor.innerHTML = "";

    const marcas = [];
    edicionAbierta.filas.forEach(fila => {
        let grupo = marcas.find(actual => actual.marca === fila.marca);
        if (!grupo) {
            grupo = { marca: fila.marca, filas: [] };
            marcas.push(grupo);
        }
        grupo.filas.push(fila);
    });

    marcas.forEach(grupo => {
        const titulo = document.createElement("p");
        titulo.className = "marcaFichaPedido";
        titulo.textContent = grupo.marca || "Sin marca";
        contenedor.appendChild(titulo);

        grupo.filas.forEach(fila => {
            const elemento = document.createElement("div");
            elemento.className = "filaEditarPedido";
            elemento.dataset.clave = fila.clave;

            let nota = "";
            if (!fila.item) {
                elemento.dataset.cambio = "nuevo";
                nota = fila.cantidad > 0 ? "Nuevo" : "Nuevo · sin cantidad, no se agrega";
            } else if (fila.cantidad === 0) {
                elemento.dataset.cambio = "quitado";
                nota = "Se quita (era x" + fila.original + ")";
            } else if (fila.cantidad !== fila.original) {
                elemento.dataset.cambio = "cantidad";
                nota = "Antes x" + fila.original;
            }

            const textos = document.createElement("div");
            textos.className = "textoFilaEditar";
            const nombre = document.createElement("strong");
            nombre.textContent = fila.producto;
            textos.appendChild(nombre);
            if (nota) {
                const pequeno = document.createElement("small");
                pequeno.textContent = nota;
                textos.appendChild(pequeno);
            }

            const controles = document.createElement("div");
            controles.className = "controlesCantidad";

            const menos = crearBotonCantidad("botonCantidad botonMenos", "-", "Una menos de " + fila.producto);
            const mas = crearBotonCantidad("botonCantidad botonMas", "+", "Una más de " + fila.producto);
            const borrar = crearBotonCantidad("botonCantidad botonBorrar", "", "Quitar " + fila.producto);
            borrar.innerHTML = window.icono("tacho", 14);
            [menos, mas, borrar].forEach(boton => {
                boton.dataset.clave = fila.clave;
            });

            const select = document.createElement("select");
            select.dataset.clave = fila.clave;
            select.setAttribute("aria-label", "Cantidad de " + fila.producto);
            for (let cantidad = 0; cantidad <= maximoDeFila(fila); cantidad++) {
                const option = document.createElement("option");
                option.value = cantidad;
                option.textContent = cantidad;
                select.appendChild(option);
            }
            select.value = String(fila.cantidad);
            select.classList.toggle("activo", fila.cantidad > 0);

            controles.append(menos, select, mas, borrar);
            elemento.append(textos, controles);
            contenedor.appendChild(elemento);
        });
    });

    if (claveConFoco) {
        const fila = contenedor.querySelector('.filaEditarPedido[data-clave="' + claveConFoco + '"]');
        const select = fila ? fila.querySelector("select") : null;
        if (select) select.focus({ preventScroll: true });
    }

    ocultarErrorEdicion();
    dibujarCambiosEdicion();
}

// Productos del catálogo que coinciden con lo buscado.
function dibujarResultadosEdicion() {
    const contenedor = document.getElementById("resultadosEditarPedido");
    const buscador = document.getElementById("buscarEditarPedido");
    if (!contenedor || !buscador || !edicionAbierta) return;

    contenedor.innerHTML = "";
    const termino = normalizarTexto(buscador.value);
    if (!termino) return;

    const productos = obtenerProductos();
    const resultados = [];

    obtenerMarcasOrdenadas(productos).forEach(marca => {
        (Array.isArray(productos[marca]) ? productos[marca] : []).forEach(producto => {
            if (!producto || !producto.nombre) return;
            if (normalizarTexto(marca).includes(termino) || normalizarTexto(producto.nombre).includes(termino)) {
                resultados.push({ marca, producto: String(producto.nombre) });
            }
        });
    });

    if (!resultados.length) {
        const vacio = document.createElement("p");
        vacio.className = "mensajeBusquedaPedido";
        vacio.textContent = "No se encontraron productos con esa búsqueda.";
        contenedor.appendChild(vacio);
        return;
    }

    resultados.slice(0, MAXIMO_RESULTADOS_EDICION).forEach(resultado => {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "resultadoEditarPedido";
        boton.dataset.marca = resultado.marca;
        boton.dataset.producto = resultado.producto;

        const nombre = document.createElement("strong");
        nombre.textContent = resultado.producto;
        const detalle = document.createElement("small");
        const yaEsta = edicionAbierta.filas.some(fila => mismoProducto(fila, resultado.marca, resultado.producto));
        detalle.textContent = resultado.marca + (yaEsta ? " · ya está en el pedido" : "");
        boton.append(nombre, detalle);
        contenedor.appendChild(boton);
    });

    if (resultados.length > MAXIMO_RESULTADOS_EDICION) {
        const mas = document.createElement("p");
        mas.className = "mensajeBusquedaPedido";
        mas.textContent = "Hay " + (resultados.length - MAXIMO_RESULTADOS_EDICION) + " más: escribí un poco más para encontrarlo.";
        contenedor.appendChild(mas);
    }
}

function mismoProducto(fila, marca, producto) {
    return normalizarTexto(fila.marca) === normalizarTexto(marca) &&
        normalizarTexto(fila.producto) === normalizarTexto(producto);
}

// Suma un producto del catálogo. Si ya está en el pedido, le suma uno. Lo
// nuevo va después de los productos de su marca.
function agregarProductoEdicion(marca, producto) {
    if (!edicionAbierta) return;

    let fila = edicionAbierta.filas.find(actual => mismoProducto(actual, marca, producto));

    if (fila) {
        fila.cantidad = Math.min(maximoDeFila(fila), fila.cantidad + 1);
    } else {
        contadorFilasNuevas += 1;
        fila = { clave: "nueva" + contadorFilasNuevas, item: null, marca, producto, original: 0, cantidad: 1 };

        let posicion = -1;
        edicionAbierta.filas.forEach((actual, indice) => {
            if (normalizarTexto(actual.marca) === normalizarTexto(marca)) posicion = indice;
        });

        if (posicion >= 0) edicionAbierta.filas.splice(posicion + 1, 0, fila);
        else edicionAbierta.filas.push(fila);
    }

    const buscador = document.getElementById("buscarEditarPedido");
    if (buscador) buscador.value = "";
    dibujarResultadosEdicion();
    dibujarFilasEdicion(fila.clave);

    const elemento = document.querySelector('#productosEditarPedido .filaEditarPedido[data-clave="' + fila.clave + '"]');
    if (elemento) elemento.scrollIntoView({ block: "center" });
    mostrarToast(escaparHtmlPedido(producto) + ": x" + fila.cantidad);
}

// Lo que cambió, en el orden del pedido: "Agregó 2 Coca 2L", "Quitó
// Sprite", "Fanta: de 3 a 5", y el comercio y las observaciones.
function cambiosDeLaEdicion() {
    const partes = [];
    if (!edicionAbierta) return { partes };

    edicionAbierta.filas.forEach(fila => {
        if (!fila.item && fila.cantidad > 0) partes.push("Agregó " + fila.cantidad + " " + fila.producto);
        else if (fila.item && fila.cantidad === 0) partes.push("Quitó " + fila.producto);
        else if (fila.item && fila.cantidad !== fila.original) partes.push(fila.producto + ": de " + fila.original + " a " + fila.cantidad);
    });

    const comercio = String(document.getElementById("comercioEditarPedido")?.value || "").trim();
    if (comercio && comercio !== edicionAbierta.comercio) {
        partes.push("Comercio: de " + (edicionAbierta.comercio || "sin nombre") + " a " + comercio);
    }

    const observaciones = String(document.getElementById("obsEditarPedido")?.value || "").trim();
    if (observaciones !== edicionAbierta.observaciones) {
        partes.push(observaciones ? "Cambió las observaciones" : "Quitó las observaciones");
    }

    return { partes, comercio, observaciones };
}

function dibujarCambiosEdicion() {
    const contenedor = document.getElementById("cambiosEditarPedido");
    if (!contenedor) return;

    const { partes } = cambiosDeLaEdicion();
    contenedor.innerHTML = "";
    contenedor.classList.toggle("conCambios", partes.length > 0);

    const titulo = document.createElement("strong");
    titulo.textContent = partes.length ? "Cambios" : "Todavía no cambiaste nada";
    contenedor.appendChild(titulo);

    if (partes.length) {
        const texto = document.createElement("p");
        texto.textContent = partes.join(" · ");
        contenedor.appendChild(texto);
    }
}

function guardarEdicionPedido() {
    if (!edicionAbierta) return;

    const { partes, comercio, observaciones } = cambiosDeLaEdicion();
    const filas = edicionAbierta.filas.filter(fila => fila.cantidad > 0);

    if (!comercio) {
        mostrarErrorEdicion("Escribí el comercio.");
        return;
    }
    if (!filas.length) {
        mostrarErrorEdicion("Dejá al menos un producto en el pedido.");
        return;
    }
    if (!partes.length) {
        mostrarErrorEdicion("Todavía no cambiaste nada.");
        return;
    }

    // Si mientras tanto el pedido cambió (otra edición), no se pisa.
    const pedido = obtenerHistorial().find(item => String(item.id || "") === edicionAbierta.id);
    if (!pedido || fotoDeLoPedido(pedido) !== edicionAbierta.foto) {
        cerrarEdicionPedido();
        mostrarAviso("El pedido cambió", "Otra persona lo editó mientras lo cambiabas. Abrí «Editar pedido» de nuevo para ver cómo quedó.");
        return;
    }

    const catalogo = obtenerProductos();
    const revisar = {};
    const productos = filas.map(fila => {
        if (fila.item && fila.cantidad === fila.original) return JSON.parse(JSON.stringify(fila.item));

        const id = generarId(PREFIJO_ID_LINEA);

        // Otra cantidad: línea nueva (vuelve a quedar sin tildar) con el
        // precio con que se cargó.
        if (fila.item) {
            revisar[id] = "Antes x" + fila.original;
            return { ...JSON.parse(JSON.stringify(fila.item)), id, cantidad: fila.cantidad };
        }

        revisar[id] = "Nuevo";
        return {
            id,
            marca: fila.marca,
            producto: fila.producto,
            cantidad: fila.cantidad,
            precio: precioDelCatalogo(fila.marca, fila.producto, catalogo, buscarComercioPorNombre(pedido.comercio || pedido.cliente || ""))
        };
    });

    const fecha = String(pedido.fecha || "") || new Date(Number(pedido.timestamp) || Date.now()).toLocaleDateString("es-AR");
    const cantidad = productos.reduce((total, item) => total + (Number(item.cantidad) || 0), 0);

    try {
        window.nubeVendeFrio.editarPedido(edicionAbierta.id, {
            productos,
            comercio,
            observaciones,
            pedido: armarTextoDelPedido(comercio, fecha, productos, observaciones),
            cantidad,
            texto: partes.join(" · "),
            revisar
        });
    } catch (error) {
        console.error("No se pudo editar el pedido.", error);
        mostrarErrorEdicion(error && error.code === "pedido" ? error.message : "No se pudo guardar. Probá de nuevo en unos segundos.");
        return;
    }

    cerrarEdicionPedido();
    mostrarToast("Pedido editado");
}

window.abrirEdicionPedido = abrirEdicionPedido;
window.cerrarEdicionPedido = cerrarEdicionPedido;

// Etapa 5 (T44): suma productos al pedido que se está cargando (lo usa el
// pedido dictado o pegado de voz.js). Cada item: { marca, producto,
// cantidad }. Devuelve cuántas unidades se sumaron.
function agregarProductosAlPedido(items, comercio) {
    if (comercio && inputCliente && !inputCliente.value.trim()) inputCliente.value = comercio;
    let sumadas = 0;
    (items || []).forEach(item => {
        const select = Array.from(document.querySelectorAll(".marca select")).find(elemento =>
            normalizarTexto(elemento.dataset.marca) === normalizarTexto(item.marca) &&
            normalizarTexto(elemento.dataset.producto) === normalizarTexto(item.producto));
        if (!select) return;
        const antes = Number(select.value) || 0;
        const despues = Math.min(40, antes + Math.max(0, Math.round(Number(item.cantidad) || 0)));
        select.value = String(despues);
        actualizarEstadoCantidad(select);
        sumadas += despues - antes;
    });
    if (buscadorProductosPedido) buscadorProductosPedido.value = "";
    aplicarFiltroProductosPedido();
    actualizarResumenPedido();
    guardarBorradorPedido();
    return sumadas;
}
window.agregarProductosAlPedido = agregarProductosAlPedido;
