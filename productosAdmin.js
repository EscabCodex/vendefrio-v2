// =====================================================
// VendeFr\u00edo Lite - productosAdmin.js
// Administraci\u00f3n de marcas y productos
// =====================================================

const listaProductosAdmin = document.getElementById("listaProductosAdmin");
const buscarProducto = document.getElementById("buscarProducto");
const botonAgregarMarca = document.getElementById("agregarMarca");
const botonAgregarProducto = document.getElementById("agregarProducto");

const modalProducto = document.getElementById("modalProducto");
const modalProductoTitulo = document.getElementById("modalProductoTitulo");
const productoMarca = document.getElementById("productoMarca");
const productoNombre = document.getElementById("productoNombre");
const productoPrecio = document.getElementById("productoPrecio");
const guardarProducto = document.getElementById("guardarProducto");
const cancelarProducto = document.getElementById("cancelarProducto");
const labelMarca = document.getElementById("labelMarca");
const labelPrecio = document.getElementById("labelPrecio");

let modo = "";
let marcaActual = "";
let idProductoActual = "";

function cargarSelectMarcas() {
    if (!productoMarca) return;

    productoMarca.innerHTML = "";
    const productos = productosParaLeer();

    obtenerMarcasOrdenadas(productos)
        .forEach(marca => {
            const option = document.createElement("option");
            option.value = marca;
            option.textContent = marca;
            productoMarca.appendChild(option);
        });
}

function crearBoton(clase, texto, titulo, datos = {}) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = `btnIcono ${clase}`;
    boton.innerHTML = texto;
    boton.title = titulo;

    Object.keys(datos).forEach(nombre => {
        boton.dataset[nombre] = datos[nombre];
    });

    return boton;
}

// T166: las iniciales de la marca, para su cuadrito de color.
function inicialesMarca(nombre) {
    const palabras = String(nombre || "").split(/\s+/).filter(palabra => /^[\p{L}\d]/u.test(palabra));
    return (palabras.length > 1 ? palabras[0][0] + palabras[1][0] : (palabras[0] || "?").slice(0, 2)).toUpperCase();
}

function textoPrecioAdmin(precio) {
    const valor = Number(precio) || 0;
    const caja = document.createElement(valor > 0 ? "b" : "span");
    caja.className = valor > 0 ? "precioAdmin" : "pzChip pzChipAviso sinPunto";
    caja.textContent = valor > 0 ? "$ " + valor.toLocaleString("es-AR") : "Sin precio";
    return caja;
}

function renderizarProductosAdmin(filtro = "") {
    if (!listaProductosAdmin) return;
    // Con Productos y marcas oculta no se dibuja: mostrarPantalla la dibuja al abrirla (T150).
    if (document.getElementById("pantallaProductos")?.classList.contains("oculto")) return;

    listaProductosAdmin.innerHTML = "";
    const productos = productosParaLeer();
    const filtroNormalizado = normalizarTexto(filtro);
    const tono = marca => typeof window.tonoDeMarca === "function" ? window.tonoDeMarca(marca) : "tono0";

    obtenerMarcasOrdenadas(productos)
        .forEach(nombreMarca => {
            // Los archivados (T63) van aparte, al final.
            const lista = (Array.isArray(productos[nombreMarca]) ? productos[nombreMarca] : [])
                .filter(producto => !productoArchivado(producto));
            const marcaCoincide = normalizarTexto(nombreMarca).includes(filtroNormalizado);
            const visibles = lista.filter(producto => {
                return marcaCoincide || normalizarTexto(producto.nombre).includes(filtroNormalizado);
            });

            if (filtroNormalizado && visibles.length === 0) return;

            const card = document.createElement("section");
            card.className = "tarjetaMarca " + tono(nombreMarca);

            const cabecera = document.createElement("div");
            cabecera.className = "cabeceraMarca";

            const iniciales = document.createElement("span");
            iniciales.className = "inicialesMarca";
            iniciales.setAttribute("aria-hidden", "true");
            iniciales.textContent = inicialesMarca(nombreMarca);

            const textos = document.createElement("div");
            textos.className = "textosMarca";
            const titulo = document.createElement("h2");
            titulo.textContent = nombreMarca;
            const detalle = document.createElement("small");
            const sinPrecio = lista.filter(producto => !(Number(producto.precio) > 0)).length;
            detalle.textContent = (lista.length === 1 ? "1 producto" : lista.length + " productos") +
                (sinPrecio ? " · " + (sinPrecio === 1 ? "1 sin precio" : sinPrecio + " sin precio") : "");
            textos.append(titulo, detalle);

            const accionesMarca = document.createElement("div");
            accionesMarca.className = "accionesMarca";
            accionesMarca.append(
                crearBoton("ghost subirMarca", window.icono("chevArriba",16), "Subir marca", { marca: nombreMarca }),
                crearBoton("ghost bajarMarca", window.icono("chevAbajo",16), "Bajar marca", { marca: nombreMarca }),
                crearBoton("ghost opcionesMarca", window.icono("puntos",18), "Opciones de " + nombreMarca, { marca: nombreMarca })
            );
            accionesMarca.querySelectorAll("button").forEach(boton => boton.setAttribute("aria-label", boton.title));
            cabecera.append(iniciales, textos, accionesMarca);

            const cuerpo = document.createElement("div");
            cuerpo.className = "cuerpoMarca";

            if (visibles.length === 0) {
                const vacio = document.createElement("p");
                vacio.className = "subtitulo";
                vacio.textContent = "Esta marca todav\u00eda no tiene productos.";
                cuerpo.appendChild(vacio);
            }

            // Cada producto es una fila: se toca para editarlo (nombre,
            // precio o archivarlo).
            visibles.forEach(producto => {
                const fila = document.createElement("button");
                fila.type = "button";
                fila.className = "filaProducto editarProducto";
                fila.dataset.id = producto.id;
                fila.setAttribute("aria-label", "Editar " + producto.nombre);
                const nombre = document.createElement("strong");
                nombre.textContent = producto.nombre;
                const flecha = document.createElement("span");
                flecha.className = "flechaFilaProducto";
                flecha.innerHTML = window.icono("chevDerecha", 18);
                fila.append(nombre, textoPrecioAdmin(producto.precio), flecha);
                cuerpo.appendChild(fila);
            });

            const agregar = document.createElement("button");
            agregar.type = "button";
            agregar.className = "agregarEnMarca";
            agregar.dataset.marca = nombreMarca;
            agregar.innerHTML = window.icono("mas", 18);
            agregar.append(document.createTextNode("Agregar producto a " + nombreMarca));
            cuerpo.appendChild(agregar);

            card.append(cabecera, cuerpo);
            listaProductosAdmin.appendChild(card);
        });

    dibujarProductosArchivados(productos, filtroNormalizado);
}

// Archivados (T63): se recuperan o, recién ahí, se eliminan para siempre.
function dibujarProductosArchivados(productos, filtroNormalizado) {
    const archivados = [];
    obtenerMarcasOrdenadas(productos).forEach(marca => {
        (productos[marca] || []).forEach(producto => {
            if (!productoArchivado(producto)) return;
            if (filtroNormalizado && !normalizarTexto(producto.nombre + " " + marca).includes(filtroNormalizado)) return;
            archivados.push({ ...producto, marca });
        });
    });
    if (!archivados.length) return;

    const card = document.createElement("section");
    card.className = "tarjetaMarca tarjetaArchivados";
    const cabecera = document.createElement("div");
    cabecera.className = "cabeceraMarca";
    const iniciales = document.createElement("span");
    iniciales.className = "inicialesMarca";
    iniciales.innerHTML = window.icono("archivo", 20);
    const textos = document.createElement("div");
    textos.className = "textosMarca";
    const titulo = document.createElement("h2");
    titulo.textContent = "Archivados (" + archivados.length + ")";
    const detalle = document.createElement("small");
    detalle.textContent = "No se ofrecen para vender";
    textos.append(titulo, detalle);
    cabecera.append(iniciales, textos);
    const cuerpo = document.createElement("div");
    cuerpo.className = "cuerpoMarca";
    archivados.forEach(producto => {
        const fila = document.createElement("div");
        fila.className = "filaProducto filaArchivado";
        const informacion = document.createElement("div");
        informacion.className = "textosArchivado";
        const nombre = document.createElement("strong");
        nombre.textContent = producto.nombre;
        const marca = document.createElement("small");
        marca.textContent = producto.marca;
        informacion.append(nombre, marca);
        const recuperar = crearBoton("recuperarProducto", window.icono("deshacer", 16) + "Recuperar", "Recuperar producto", { id: producto.id });
        recuperar.className = "pzBtn pzBtnSec pzBtnChico recuperarProducto";
        const eliminar = crearBoton("eliminarProducto", window.icono("tacho", 16), "Eliminar para siempre", { id: producto.id });
        eliminar.setAttribute("aria-label", "Eliminar para siempre");
        fila.append(informacion, recuperar, eliminar);
        cuerpo.appendChild(fila);
    });
    card.append(cabecera, cuerpo);
    listaProductosAdmin.appendChild(card);
}

// Archiva con "Deshacer" unos segundos (T63). Los pedidos viejos no cambian.
function archivarProductoConDeshacer(id) {
    const encontrado = obtenerProductoPorId(id);
    if (!encontrado || !archivarProductoPorId(id, true)) return;
    redibujarProductosEnTodasPartes();
    window.piezas?.deshacer("“" + encontrado.producto.nombre + "” archivado", () => {
        archivarProductoPorId(id, false);
        redibujarProductosEnTodasPartes();
    });
}

function redibujarProductosEnTodasPartes() {
    renderizarProductosAdmin(buscarProducto ? buscarProducto.value : "");
    if (typeof renderizarPedido === "function") renderizarPedido();
    if (!document.getElementById("pantallaCatalogo")?.classList.contains("oculto") && typeof window.abrirCatalogo === "function") window.abrirCatalogo();
}
window.archivarProductoConDeshacer = archivarProductoConDeshacer;

// Alias opcional para otros m\u00f3dulos.
window.renderizarProductosAdmin = renderizarProductosAdmin;

if (buscarProducto) {
    buscarProducto.addEventListener("input", () => {
        renderizarProductosAdmin(buscarProducto.value);
    });
}

function mostrarCampo(elemento, mostrar) {
    if (elemento) elemento.style.display = mostrar ? "block" : "none";
}

function abrirModalNuevaMarca() {
    modo = "nuevaMarca";
    marcaActual = "";
    idProductoActual = "";

    modalProductoTitulo.textContent = "Nueva marca";
    mostrarCampo(labelMarca, false);
    mostrarCampo(productoMarca, false);
    mostrarCampo(labelPrecio, false);
    mostrarCampo(productoPrecio, false);
    productoNombre.value = "";
    productoPrecio.value = "";
    mostrarArchivarEnModal(false);
    modalProducto.classList.remove("oculto");
}

function confirmarEliminarMarca(marca) {
    abrirConfirmacion("Eliminar marca", `\u00bfEliminar "${marca}"?`, () => {
        eliminarMarca(marca);
        renderizarProductosAdmin(buscarProducto ? buscarProducto.value : "");
        if (typeof renderizarPedido === "function") renderizarPedido();
    });
}

// T166: lo que se hace con una marca, en una hoja (con una mano).
function abrirOpcionesMarca(marca) {
    const pz = window.piezas;
    if (!pz) return abrirModalEditarMarca(marca);
    pz.hoja({
        titulo: marca,
        sub: "Marca",
        html: `<div class="pzMotivos">
            <button type="button" class="pzMotivo" data-opcion="producto">${pz.ico("mas", 20)}Agregar producto</button>
            <button type="button" class="pzMotivo" data-opcion="nombre">${pz.ico("lapiz", 20)}Cambiar el nombre</button>
            <button type="button" class="pzMotivo opcionPeligro" data-opcion="eliminar">${pz.ico("tacho", 20)}Eliminar marca</button>
        </div>`
    }).addEventListener("click", evento => {
        const opcion = evento.target.closest("[data-opcion]")?.dataset.opcion;
        if (!opcion) return;
        pz.cerrar();
        if (opcion === "producto") abrirModalNuevoProducto(marca);
        if (opcion === "nombre") abrirModalEditarMarca(marca);
        if (opcion === "eliminar") confirmarEliminarMarca(marca);
    });
}

function abrirModalNuevoProducto(marcaElegida) {
    const marcas = Object.keys(productosParaLeer());
    if (marcas.length === 0) {
        mostrarAviso(
            "No hay marcas",
            "Primero cre\u00e1 una marca y despu\u00e9s vas a poder agregar productos."
        );

        return;
    }

    modo = "nuevoProducto";
    marcaActual = "";
    idProductoActual = "";

    modalProductoTitulo.textContent = "Nuevo producto";
    mostrarCampo(labelMarca, true);
    mostrarCampo(productoMarca, true);
    mostrarCampo(labelPrecio, true);
    mostrarCampo(productoPrecio, true);
    productoNombre.value = "";
    productoPrecio.value = "";
    cargarSelectMarcas();
    if (typeof marcaElegida === "string" && marcas.includes(marcaElegida)) productoMarca.value = marcaElegida;
    mostrarArchivarEnModal(false);
    modalProducto.classList.remove("oculto");
}

function abrirModalEditarMarca(nombre) {
    modo = "editarMarca";
    marcaActual = nombre;
    idProductoActual = "";

    modalProductoTitulo.textContent = "Editar marca";
    mostrarCampo(labelMarca, false);
    mostrarCampo(productoMarca, false);
    mostrarCampo(labelPrecio, false);
    mostrarCampo(productoPrecio, false);
    productoNombre.value = nombre;
    mostrarArchivarEnModal(false);
    modalProducto.classList.remove("oculto");
}

function abrirModalEditarProducto(id) {
    const encontrado = obtenerProductoPorId(id);
    if (!encontrado) return;
    const producto = encontrado.producto;

    modo = "editarProducto";
    marcaActual = encontrado.marca;
    idProductoActual = id;

    modalProductoTitulo.textContent = "Editar producto";
    mostrarCampo(labelMarca, false);
    mostrarCampo(productoMarca, false);
    mostrarCampo(labelPrecio, true);
    mostrarCampo(productoPrecio, true);
    productoNombre.value = producto.nombre;
    productoPrecio.value = producto.precio;
    mostrarArchivarEnModal(true);
    modalProducto.classList.remove("oculto");
}

// Al editar un producto, "Archivar producto" va abajo de la ventana (T166).
function mostrarArchivarEnModal(mostrar) {
    const boton = document.getElementById("archivarDesdeModal");
    if (boton) boton.classList.toggle("oculto", !mostrar);
}
const botonArchivarDesdeModal = document.getElementById("archivarDesdeModal");
if (botonArchivarDesdeModal) {
    botonArchivarDesdeModal.onclick = () => {
        const id = idProductoActual;
        cerrarModalProducto();
        if (id) archivarProductoConDeshacer(id);
    };
}

function cerrarModalProducto() {
    if (modalProducto) modalProducto.classList.add("oculto");
}

if (botonAgregarMarca) botonAgregarMarca.onclick = abrirModalNuevaMarca;
if (botonAgregarProducto) botonAgregarProducto.onclick = abrirModalNuevoProducto;
if (cancelarProducto) cancelarProducto.onclick = cerrarModalProducto;

if (modalProducto) {
    modalProducto.addEventListener("click", event => {
        if (event.target === modalProducto) cerrarModalProducto();
    });
}

if (guardarProducto) {
    guardarProducto.onclick = () => {
        const nombre = productoNombre.value.trim();
        const precio = Math.max(0, Number(productoPrecio.value) || 0);
        let guardado = false;

        if (!nombre) {
            mostrarAviso(
                "Falta el nombre",
                "Ingres\u00e1 un nombre antes de guardar."
            );

            return;
        }

        if (modo === "nuevaMarca") {
            guardado = agregarMarca(nombre);

            if (!guardado) {
                mostrarAviso(
                    "Marca no creada",
                    "Esa marca ya existe o el nombre no es v\u00e1lido."
                );
            }
        }

        if (modo === "nuevoProducto") {
            guardado = agregarProductoConId(
                productoMarca.value,
                { nombre, precio }
            );

            if (!guardado) {
                mostrarAviso(
                    "Producto no creado",
                    "Ese producto ya existe en la marca elegida."
                );
            }
        }

        if (modo === "editarMarca") {
            guardado = editarMarca(
                marcaActual,
                nombre
            );

            if (!guardado) {
                mostrarAviso(
                    "Marca no modificada",
                    "No se pudo cambiar el nombre. Revis\u00e1 que no est\u00e9 repetido."
                );
            }
        }

        if (modo === "editarProducto") {
            guardado = actualizarProductoPorId(
                idProductoActual,
                { nombre, precio }
            );

            if (!guardado) {
                mostrarAviso(
                    "Producto no modificado",
                    "No se pudo guardar. Revis\u00e1 que el nombre no est\u00e9 repetido."
                );
            }
        }

        if (!guardado) return;

        cerrarModalProducto();
        renderizarProductosAdmin(buscarProducto ? buscarProducto.value : "");
        if (typeof renderizarPedido === "function") renderizarPedido();
    };
}

if (listaProductosAdmin) {
    listaProductosAdmin.addEventListener("click", event => {
        const elemento = event.target.closest("button");
        if (!elemento) return;

        if (elemento.classList.contains("agregarEnMarca")) {
            abrirModalNuevoProducto(elemento.dataset.marca);
            return;
        }

        if (elemento.classList.contains("opcionesMarca")) {
            abrirOpcionesMarca(elemento.dataset.marca);
            return;
        }

        if (
            elemento.classList.contains("subirMarca") ||
            elemento.classList.contains("bajarMarca")
        ) {
            const direccion = elemento.classList.contains("subirMarca")
                ? -1
                : 1;

            moverMarcaOrden(
                elemento.dataset.marca,
                direccion
            );

            renderizarProductosAdmin(
                buscarProducto ? buscarProducto.value : ""
            );

            if (typeof renderizarPedido === "function") {
                renderizarPedido();
            }

            return;
        }

        if (elemento.classList.contains("editarMarca")) {
            abrirModalEditarMarca(elemento.dataset.marca);
            return;
        }

        if (elemento.classList.contains("editarProducto")) {
            abrirModalEditarProducto(elemento.dataset.id);
            return;
        }

        if (elemento.classList.contains("eliminarMarca")) {
            confirmarEliminarMarca(elemento.dataset.marca);
            return;
        }

        if (elemento.classList.contains("archivarProducto")) {
            archivarProductoConDeshacer(elemento.dataset.id);
            return;
        }

        if (elemento.classList.contains("recuperarProducto")) {
            archivarProductoPorId(elemento.dataset.id, false);
            redibujarProductosEnTodasPartes();
            mostrarToast("Producto recuperado: vuelve a estar para vender");
            return;
        }

        if (elemento.classList.contains("eliminarProducto")) {
            const id = elemento.dataset.id;
            abrirConfirmacion("Eliminar para siempre", "Se borra del catálogo. Los pedidos viejos lo siguen mostrando. ¿Seguro?", () => {
                eliminarProductoPorId(id);
                renderizarProductosAdmin(buscarProducto ? buscarProducto.value : "");
                if (typeof renderizarPedido === "function") renderizarPedido();
            });
        }
    });
}

renderizarProductosAdmin();