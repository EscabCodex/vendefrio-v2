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
let indiceActual = -1;

function cargarSelectMarcas() {
    if (!productoMarca) return;

    productoMarca.innerHTML = "";
    const productos = obtenerProductos();

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
    boton.textContent = texto;
    boton.title = titulo;

    Object.keys(datos).forEach(nombre => {
        boton.dataset[nombre] = datos[nombre];
    });

    return boton;
}

function renderizarProductosAdmin(filtro = "") {
    if (!listaProductosAdmin) return;

    listaProductosAdmin.innerHTML = "";
    const productos = obtenerProductos();
    const filtroNormalizado = normalizarTexto(filtro);

    obtenerMarcasOrdenadas(productos)
        .forEach((nombreMarca, indiceMarca) => {
            const lista = Array.isArray(productos[nombreMarca]) ? productos[nombreMarca] : [];
            const marcaCoincide = normalizarTexto(nombreMarca).includes(filtroNormalizado);
            const visibles = lista
                .map((producto, indiceReal) => ({ producto, indiceReal }))
                .filter(({ producto }) => {
                    return marcaCoincide || normalizarTexto(producto.nombre).includes(filtroNormalizado);
                });

            if (filtroNormalizado && visibles.length === 0) return;

            const card = document.createElement("div");
            card.className = "tarjetaMarca";

            const cabecera = document.createElement("div");
            cabecera.className = "cabeceraMarca";
            cabecera.style.setProperty("--acento", colorMarca(indiceMarca));

            const titulo = document.createElement("h2");
            titulo.textContent = nombreMarca;

            const accionesMarca = document.createElement("div");
            accionesMarca.className = "accionesMarca";
            accionesMarca.append(
                crearBoton("ghost subirMarca", "\u2191", "Subir marca", { marca: nombreMarca }),
                crearBoton("ghost bajarMarca", "\u2193", "Bajar marca", { marca: nombreMarca }),
                crearBoton("ghost editarMarca", "\u270f\ufe0f", "Editar marca", { marca: nombreMarca }),
                crearBoton("ghost eliminarMarca", "\ud83d\uddd1\ufe0f", "Eliminar marca", { marca: nombreMarca })
            );
            cabecera.append(titulo, accionesMarca);

            const cuerpo = document.createElement("div");
            cuerpo.className = "cuerpoMarca";

            if (visibles.length === 0) {
                const vacio = document.createElement("p");
                vacio.className = "subtitulo";
                vacio.textContent = "Esta marca todav\u00eda no tiene productos.";
                cuerpo.appendChild(vacio);
            }

            visibles.forEach(({ producto, indiceReal }) => {
                const fila = document.createElement("div");
                fila.className = "filaProducto";

                const informacion = document.createElement("div");
                const nombre = document.createElement("strong");
                nombre.textContent = producto.nombre;
                const salto = document.createElement("br");
                const precio = document.createElement("small");
                precio.textContent = "$" + (Number(producto.precio) || 0);
                informacion.append(nombre, salto, precio);

                const botones = document.createElement("div");
                botones.className = "filaBotones";
                botones.append(
                    crearBoton("tinteAmbar editarProducto", "\u270f\ufe0f", "Editar producto", {
                        marca: nombreMarca,
                        indice: indiceReal
                    }),
                    crearBoton("tinteRojo eliminarProducto", "\ud83d\uddd1\ufe0f", "Eliminar producto", {
                        marca: nombreMarca,
                        indice: indiceReal
                    })
                );

                fila.append(informacion, botones);
                cuerpo.appendChild(fila);
            });

            card.append(cabecera, cuerpo);
            listaProductosAdmin.appendChild(card);
        });
}

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
    indiceActual = -1;

    modalProductoTitulo.textContent = "Nueva marca";
    mostrarCampo(labelMarca, false);
    mostrarCampo(productoMarca, false);
    mostrarCampo(labelPrecio, false);
    mostrarCampo(productoPrecio, false);
    productoNombre.value = "";
    productoPrecio.value = "";
    modalProducto.classList.remove("oculto");
}

function abrirModalNuevoProducto() {
    const marcas = Object.keys(obtenerProductos());
    if (marcas.length === 0) {
        mostrarAviso(
            "No hay marcas",
            "Primero cre\u00e1 una marca y despu\u00e9s vas a poder agregar productos."
        );

        return;
    }

    modo = "nuevoProducto";
    marcaActual = "";
    indiceActual = -1;

    modalProductoTitulo.textContent = "Nuevo producto";
    mostrarCampo(labelMarca, true);
    mostrarCampo(productoMarca, true);
    mostrarCampo(labelPrecio, true);
    mostrarCampo(productoPrecio, true);
    productoNombre.value = "";
    productoPrecio.value = "";
    cargarSelectMarcas();
    modalProducto.classList.remove("oculto");
}

function abrirModalEditarMarca(nombre) {
    modo = "editarMarca";
    marcaActual = nombre;
    indiceActual = -1;

    modalProductoTitulo.textContent = "Editar marca";
    mostrarCampo(labelMarca, false);
    mostrarCampo(productoMarca, false);
    mostrarCampo(labelPrecio, false);
    mostrarCampo(productoPrecio, false);
    productoNombre.value = nombre;
    modalProducto.classList.remove("oculto");
}

function abrirModalEditarProducto(marca, indice) {
    const productos = obtenerProductos();
    const marcaReal = buscarMarca(marca, productos);
    const producto = marcaReal && productos[marcaReal][indice];
    if (!producto) return;

    modo = "editarProducto";
    marcaActual = marcaReal;
    indiceActual = indice;

    modalProductoTitulo.textContent = "Editar producto";
    mostrarCampo(labelMarca, false);
    mostrarCampo(productoMarca, false);
    mostrarCampo(labelPrecio, true);
    mostrarCampo(productoPrecio, true);
    productoNombre.value = producto.nombre;
    productoPrecio.value = producto.precio;
    modalProducto.classList.remove("oculto");
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
            guardado = agregarProducto(
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
            guardado = editarProducto(
                marcaActual,
                indiceActual,
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
        const elemento = event.target;

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
            abrirModalEditarProducto(elemento.dataset.marca, Number(elemento.dataset.indice));
            return;
        }

        if (elemento.classList.contains("eliminarMarca")) {
            const marca = elemento.dataset.marca;
            abrirConfirmacion("Eliminar marca", `\u00bfEliminar "${marca}"?`, () => {
                eliminarMarca(marca);
                renderizarProductosAdmin(buscarProducto ? buscarProducto.value : "");
                if (typeof renderizarPedido === "function") renderizarPedido();
            });
            return;
        }

        if (elemento.classList.contains("eliminarProducto")) {
            const marca = elemento.dataset.marca;
            const indice = Number(elemento.dataset.indice);
            abrirConfirmacion("Eliminar producto", "\u00bfSeguro que quer\u00e9s eliminar este producto?", () => {
                eliminarProducto(marca, indice);
                renderizarProductosAdmin(buscarProducto ? buscarProducto.value : "");
                if (typeof renderizarPedido === "function") renderizarPedido();
            });
        }
    });
}

renderizarProductosAdmin();