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
    const caja = document.createElement("b");
    // Repaso de Catálogo: sin precio, "+ Agregar precio" (se toca la fila).
    caja.className = valor > 0 ? "precioAdmin" : "precioAdmin agregarPrecioAdmin";
    caja.textContent = valor > 0 ? "$ " + valor.toLocaleString("es-AR") : "+ Agregar precio";
    return caja;
}

// ---------- Color elegido de cada marca (repaso de Catálogo) ----------
// Se guarda en este celular. Sin elegir, cada marca toma el color por su
// lugar en el orden (como hasta ahora).
const CLAVE_COLORES_MARCAS = "vendefrio_colores_marcas";

function leerColoresMarcas() {
    try {
        const datos = JSON.parse(localStorage.getItem(CLAVE_COLORES_MARCAS) || "{}");
        return datos && typeof datos === "object" ? datos : {};
    } catch (error) {
        return {};
    }
}

function guardarColoresMarcas(datos) {
    try {
        localStorage.setItem(CLAVE_COLORES_MARCAS, JSON.stringify(datos));
        return true;
    } catch (error) {
        return false;
    }
}

function colorElegidoDeMarca(marca) {
    const elegido = leerColoresMarcas()[normalizarTexto(marca)];
    return /^tono[0-5]$/.test(elegido) ? elegido : "";
}
window.colorElegidoDeMarca = colorElegidoDeMarca;

function tonoMarcaAdmin(marca) {
    if (typeof window.tonoDeMarca === "function") return window.tonoDeMarca(marca);
    const elegido = colorElegidoDeMarca(marca);
    if (elegido) return elegido;
    const indice = obtenerMarcasOrdenadas().indexOf(marca);
    return "tono" + ((indice < 0 ? 0 : indice) % 6);
}

// Las marcas arrancan cerradas cada vez que se entra a Editar marcas; la
// flechita de cada una muestra u oculta sus productos.
const marcasAbiertas = new Set();

function renderizarProductosAdmin(filtro = "") {
    if (!listaProductosAdmin) return;
    // Con Productos y marcas oculta no se dibuja: mostrarPantalla la dibuja al abrirla (T150).
    if (document.getElementById("pantallaProductos")?.classList.contains("oculto")) return;
    // Sin nada (al entrar desde el menú), todas cerradas.
    if (arguments.length === 0) marcasAbiertas.clear();

    listaProductosAdmin.innerHTML = "";
    const productos = productosParaLeer();
    const filtroNormalizado = normalizarTexto(filtro);

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

            // Al buscar se abren solas, para ver lo que se encontró.
            const abierta = Boolean(filtroNormalizado) || marcasAbiertas.has(nombreMarca);
            const card = document.createElement("section");
            card.className = "tarjetaMarca " + tonoMarcaAdmin(nombreMarca) + (abierta ? "" : " marcaCerrada");

            const cabecera = document.createElement("div");
            cabecera.className = "cabeceraMarca";

            // El nombre y las iniciales abren la ficha de la marca.
            const abrir = document.createElement("button");
            abrir.type = "button";
            abrir.className = "abrirFichaMarca";
            abrir.dataset.marca = nombreMarca;
            abrir.setAttribute("aria-label", "Ficha de " + nombreMarca);

            const iniciales = document.createElement("span");
            iniciales.className = "inicialesMarca";
            iniciales.setAttribute("aria-hidden", "true");
            iniciales.textContent = inicialesMarca(nombreMarca);

            const textos = document.createElement("span");
            textos.className = "textosMarca";
            const titulo = document.createElement("strong");
            titulo.className = "nombreMarca";
            titulo.textContent = nombreMarca;
            const detalle = document.createElement("small");
            const sinPrecio = lista.filter(producto => !(Number(producto.precio) > 0)).length;
            detalle.textContent = (lista.length === 1 ? "1 producto" : lista.length + " productos") +
                (sinPrecio ? " · " + (sinPrecio === 1 ? "1 sin precio" : sinPrecio + " sin precio") : "");
            textos.append(titulo, detalle);
            abrir.append(iniciales, textos);

            const desplegar = document.createElement("button");
            desplegar.type = "button";
            desplegar.className = "desplegarMarca";
            desplegar.dataset.marca = nombreMarca;
            desplegar.innerHTML = window.icono("chevAbajo", 20);
            desplegar.setAttribute("aria-expanded", String(abierta));
            desplegar.setAttribute("aria-label", (abierta ? "Ocultar productos de " : "Ver productos de ") + nombreMarca);
            cabecera.append(abrir, desplegar);

            const cuerpo = document.createElement("div");
            cuerpo.className = "cuerpoMarca";

            if (visibles.length === 0) {
                const vacio = document.createElement("p");
                vacio.className = "subtitulo";
                vacio.textContent = "Esta marca todavía no tiene productos.";
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

function desplegarMarca(boton) {
    const card = boton.closest(".tarjetaMarca");
    if (!card) return;
    const marca = boton.dataset.marca;
    const abierta = card.classList.toggle("marcaCerrada") === false;
    if (abierta) marcasAbiertas.add(marca);
    else marcasAbiertas.delete(marca);
    boton.setAttribute("aria-expanded", String(abierta));
    boton.setAttribute("aria-label", (abierta ? "Ocultar productos de " : "Ver productos de ") + marca);
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
    refrescarFichaMarca();
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
    if (elemento) elemento.style.display = mostrar ? "" : "none";
    // El gramaje o las unidades van con el precio: solo en los productos.
    if (elemento === labelPrecio) mostrarCampo(document.getElementById("labelContenido"), mostrar);
}
function campoContenido(valor) {
    const campo = document.getElementById("productoContenido");
    if (!campo) return "";
    if (valor !== undefined) campo.value = valor;
    return campo.value.trim().slice(0, 30);
}

// La hoja de marca y producto (como las de piezas.js): sube desde abajo, con
// el fondo difuminado. Debajo del título, de qué marca es (al editar).
function mostrarHojaProducto(sub = "") {
    if (!modalProducto) return;
    const subtitulo = document.getElementById("modalProductoSub");
    if (subtitulo) {
        subtitulo.textContent = sub;
        subtitulo.hidden = !sub;
    }
    clearTimeout(mostrarHojaProducto.cierre);
    modalProducto.classList.add("pzFondo");
    modalProducto.firstElementChild.classList.add("pzHoja");
    modalProducto.classList.remove("oculto");
    requestAnimationFrame(() => modalProducto.classList.add("visible"));
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
    mostrarHojaProducto();
}

function confirmarEliminarMarca(marca) {
    abrirConfirmacion(`\u00bfEliminar la marca \u00ab${marca}\u00bb?`, "Se borra con todos sus productos.", () => {
        eliminarMarca(marca);
        if (marcaDeLaFicha === marca) cerrarFichaMarca();
        renderizarProductosAdmin(buscarProducto ? buscarProducto.value : "");
        if (typeof renderizarPedido === "function") renderizarPedido();
    });
}

// ---------- Ficha de la marca (repaso de Catálogo) ----------
// Se abre tocando el nombre o las iniciales: centrada como la del comercio,
// con el fondo apenas difuminado. Arriba sus números del mes, abajo sus
// productos y el ⋯ con lo que se hace con la marca.
let fichaMarca = null;
let marcaDeLaFicha = "";

function cerrarFichaMarca() {
    if (fichaMarca) fichaMarca.remove();
    fichaMarca = null;
    marcaDeLaFicha = "";
}

// Si la ficha está abierta, se vuelve a dibujar (después de editar algo).
function refrescarFichaMarca(nombreNuevo) {
    if (!fichaMarca) return;
    const marca = nombreNuevo || marcaDeLaFicha;
    if (!Object.prototype.hasOwnProperty.call(productosParaLeer(), marca)) {
        cerrarFichaMarca();
        return;
    }
    abrirFichaMarca(marca, fichaMarca.querySelector(".fichaComercioNueva")?.scrollTop || 0);
}

function plataMarca(valor) {
    return window.piezas ? window.piezas.plata(valor) : "$ " + Math.round(Number(valor) || 0).toLocaleString("es-AR");
}

// Ficha de la marca para estudiar el mercado (Tanda 3, aprobada por el
// dueño): todo sale de los pedidos que cuentan, sin pedir nada a la nube.
// Si quien mira no puede ver la plata, se mide en unidades.
function estudioDeMarca(marca) {
    const conPlata = window.verPlataVendeFrio?.puedoVer?.() !== false;
    const pedidos = typeof pedidosQueCuentanParaLeer === "function" ? pedidosQueCuentanParaLeer() : [];
    const marcaNormal = normalizarTexto(marca);
    const ahora = new Date();
    const dia = 86400000;
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();
    const inicioAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1).getTime();
    const corteAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, ahora.getDate() + 1).getTime();
    const hace30 = Date.now() - 30 * dia;
    const hace60 = Date.now() - 60 * dia;
    const hace90 = Date.now() - 90 * dia;
    let mesPlata = 0, mesUnidades = 0, anterior = 0, ultimo = 0, totalMes = 0;
    const porProducto = new Map();
    const porComercio = new Map();
    const activos = new Map();
    const compranMarca = new Set();
    const porMarcaMes = new Map();
    pedidos.forEach(pedido => {
        const fecha = typeof obtenerFechaRegistro === "function" ? obtenerFechaRegistro(pedido) : new Date(Number(pedido.timestamp) || 0);
        const hora = fecha ? fecha.getTime() : 0;
        const comercio = String(pedido.comercio || "").trim();
        (pedido.productos || []).forEach(item => {
            if (!item) return;
            const cantidad = Number(item.cantidad) || 0;
            if (!cantidad) return;
            const valor = conPlata ? cantidad * (Number(item.precio) || 0) : cantidad;
            if (hora >= inicioMes) {
                totalMes += valor;
                const otra = String(item.marca || "").trim() || "Sin marca";
                porMarcaMes.set(otra, (porMarcaMes.get(otra) || 0) + valor);
            }
            if (comercio && hora >= hace60) activos.set(comercio, (activos.get(comercio) || 0) + cantidad);
            if (normalizarTexto(item.marca) !== marcaNormal) return;
            if (hora >= inicioMes) { mesPlata += cantidad * (Number(item.precio) || 0); mesUnidades += cantidad; }
            else if (hora >= inicioAnterior && hora < corteAnterior) anterior += valor;
            if (hora > ultimo) ultimo = hora;
            const nombre = normalizarTexto(item.producto || item.nombre);
            if (hora >= hace30) porProducto.set(nombre, (porProducto.get(nombre) || 0) + cantidad);
            if (comercio && hora >= hace60) compranMarca.add(comercio);
            if (comercio && hora >= hace90) porComercio.set(comercio, (porComercio.get(comercio) || 0) + cantidad);
        });
    });
    const mesValor = conPlata ? mesPlata : mesUnidades;
    const dias = ultimo ? Math.floor((Date.now() - ultimo) / dia) : -1;
    const oportunidades = [...activos.entries()].filter(([comercio]) => !compranMarca.has(comercio)).sort((a, b) => b[1] - a[1]);
    return {
        conPlata, mesPlata, mesUnidades, porProducto, oportunidades,
        parte: totalMes ? Math.round(mesValor / totalMes * 100) : 0,
        cambio: anterior ? Math.round((mesValor - anterior) / anterior * 100) : null,
        compran: compranMarca.size, activos: activos.size,
        ultimo: dias < 0 ? "—" : dias === 0 ? "hoy" : dias === 1 ? "ayer" : "hace " + dias + " d",
        top: [...porComercio.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
        ranking: [...porMarcaMes.entries()].filter(([, valor]) => valor > 0).sort((a, b) => b[1] - a[1]).slice(0, 6)
    };
}

// Las frases de "Lo que dicen los números", armadas con los datos.
function lecturaDeMarca(marca, estudio, lista) {
    const frases = [];
    if (estudio.cambio !== null && Math.abs(estudio.cambio) >= 5) {
        frases.push(estudio.cambio > 0 ? `Viene creciendo: ${estudio.cambio}% más que el mes pasado a esta altura.` : `Viene bajando: ${Math.abs(estudio.cambio)}% menos que el mes pasado a esta altura.`);
    }
    const vendidos = lista.map(producto => [producto.nombre, estudio.porProducto.get(normalizarTexto(producto.nombre)) || 0]).filter(([, cantidad]) => cantidad > 0).sort((a, b) => b[1] - a[1]);
    const total = vendidos.reduce((suma, [, cantidad]) => suma + cantidad, 0);
    if (vendidos.length > 1 && total) {
        const parte = Math.round(vendidos[0][1] / total * 100);
        if (parte >= 35) frases.push(`${vendidos[0][0]} es el ${parte}% de lo que vendés de ${marca}.`);
    }
    const quietos = lista.length - vendidos.length;
    if (quietos > 0 && vendidos.length) frases.push(quietos === 1 ? "1 producto no se vendió en 30 días." : `${quietos} productos no se vendieron en 30 días.`);
    if (estudio.oportunidades.length) frases.push(estudio.oportunidades.length === 1 ? "1 comercio que te compra otras cosas nunca le compró: ofrecésela." : `${estudio.oportunidades.length} comercios que te compran otras cosas nunca le compraron: ofrecésela.`);
    if (!frases.length) frases.push(total ? `Se vende parejo: ${estudio.compran} de tus ${estudio.activos} comercios la compran.` : "Todavía no hay pedidos de esta marca para estudiar.");
    return frases.slice(0, 3);
}

function itemMenuMarca(icono, texto, clase = "") {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "fichaMenuItem " + clase;
    item.innerHTML = window.icono(icono, 20) + '<span class="fichaMenuTexto"></span>';
    item.querySelector(".fichaMenuTexto").textContent = texto;
    return item;
}

function abrirFichaMarca(marca, scroll = 0) {
    const productos = productosParaLeer();
    if (!Object.prototype.hasOwnProperty.call(productos, marca)) return;
    cerrarFichaMarca();
    marcaDeLaFicha = marca;

    const todos = Array.isArray(productos[marca]) ? productos[marca] : [];
    const lista = todos.filter(producto => !productoArchivado(producto));
    const archivados = todos.length - lista.length;
    const estados = new Map();
    try {
        (window.stockVendeFrio ? window.stockVendeFrio.todos() : []).forEach(({ producto, estado }) => {
            if (estado && producto.marca === marca) estados.set(producto.id, estado);
        });
    } catch (error) { /* sin stock: no se muestra */ }
    const sinPrecio = lista.filter(producto => !(Number(producto.precio) > 0));
    const pocoStock = lista.filter(producto => estados.get(producto.id)?.nivel !== undefined && estados.get(producto.id).nivel !== "ok").length;
    const estudio = estudioDeMarca(marca);
    const vendido = producto => estudio.porProducto.get(normalizarTexto(producto.nombre)) || 0;
    lista.sort((x, y) => vendido(y) - vendido(x));
    const maximo = Math.max(1, ...lista.map(vendido));

    fichaMarca = document.createElement("div");
    fichaMarca.className = "modal modalFichaComercio modalFichaMarca " + tonoMarcaAdmin(marca);
    fichaMarca.innerHTML = `
        <div class="fichaMarco">
            <div class="modalContenido fichaContenido fichaComercioNueva" role="dialog" aria-modal="true" aria-labelledby="tituloFichaMarca">
                <button type="button" class="fichaCerrar" aria-label="Cerrar ficha">${window.icono("cerrarX", 20)}</button>
                <button type="button" class="fichaAsistente" aria-label="Asistente" title="Asistente" data-abrir-asistente>${window.icono("chispa", 20)}</button>
                <div class="fichaEncabezado">
                    <div class="fichaAvatar inicialesMarca" aria-hidden="true"></div>
                    <div class="fichaTitulo"><h2 id="tituloFichaMarca"></h2><small>Marca</small></div>
                </div>
                <div class="fichaNumeros"></div>
                <div class="fichaMarcaLectura"><strong>Lo que dicen los números</strong><ul></ul></div>
                <div class="fichaMarcaProductos"><strong>Productos · más vendidos en 30 días</strong><div class="listaFichaMarca"></div></div>
                <div class="fichaMarcaProductos fichaMarcaComercios"><strong>Quién la compra más</strong><div></div></div>
                <div class="fichaMarcaProductos fichaMarcaOportunidades"><strong>Para ofrecérsela</strong><div></div></div>
                <div class="fichaMarcaProductos fichaMarcaRanking"><strong>Contra tus otras marcas · este mes</strong><div></div></div>
            </div>
            <div class="fichaVelo" hidden></div>
            <div class="fichaMenu" role="dialog" hidden></div>
            <button type="button" class="fichaMenuBoton" aria-label="Más opciones" aria-haspopup="dialog" aria-expanded="false">${window.icono("puntos", 26)}</button>
        </div>`;
    document.body.appendChild(fichaMarca);
    fichaMarca.querySelector(".fichaAvatar").textContent = inicialesMarca(marca);
    fichaMarca.querySelector("#tituloFichaMarca").textContent = marca;

    // Los seis números para estudiar la marca.
    const comparar = estudio.cambio === null ? "—" : (estudio.cambio > 0 ? "+" : "") + estudio.cambio + "%";
    const numeros = [
        estudio.conPlata ? { valor: plataMarca(estudio.mesPlata), texto: "vendido este mes" } : { valor: estudio.mesUnidades + " u", texto: "vendidas este mes" },
        { valor: estudio.parte + "%", texto: "de tus ventas" },
        { valor: comparar, texto: "vs. mes pasado", clase: estudio.cambio !== null && estudio.cambio < 0 ? "fichaNumeroAviso" : "" },
        estudio.conPlata ? { valor: estudio.mesUnidades + " u", texto: "unidades este mes" } : { valor: String(lista.length), texto: lista.length === 1 ? "producto" : "productos" },
        { valor: estudio.compran + " de " + estudio.activos, texto: "comercios la compran" },
        { valor: estudio.ultimo, texto: "último pedido" }
    ];
    // Avisos que ya estaban: sin precio y poco stock, en la lectura.
    const frases = lecturaDeMarca(marca, estudio, lista);
    if (sinPrecio.length) frases.push(sinPrecio.length === 1 ? "1 producto no tiene precio." : sinPrecio.length + " productos no tienen precio.");
    if (pocoStock) frases.push(pocoStock === 1 ? "1 producto tiene poco stock." : pocoStock + " productos tienen poco stock.");
    const listaLectura = fichaMarca.querySelector(".fichaMarcaLectura ul");
    frases.forEach(frase => { const li = document.createElement("li"); li.textContent = frase; listaLectura.appendChild(li); });
    // Filas con barrita: comercios, oportunidades y marcas.
    const filasConBarra = (caja, filas, vacio, alTocar) => {
        const destino = fichaMarca.querySelector(caja + " > div");
        if (!filas.length) { destino.innerHTML = '<p class="fichaMarcaVacio"></p>'; destino.firstChild.textContent = vacio; return; }
        const mayor = Math.max(1, ...filas.map(fila => fila[1]));
        filas.forEach(([nombre, valor, resaltar, texto], indice) => {
            const fila = document.createElement(alTocar ? "button" : "div");
            if (alTocar) { fila.type = "button"; fila.addEventListener("click", () => alTocar(nombre)); }
            fila.className = "filaBarraMarca" + (resaltar ? " resaltada" : "");
            fila.innerHTML = '<span class="filaBarraNumero"></span><span class="filaBarraTexto"><span class="filaBarraNombre"></span><span class="filaBarra"><i></i></span></span><b></b>';
            fila.querySelector(".filaBarraNumero").textContent = String(indice + 1);
            fila.querySelector(".filaBarraNombre").textContent = nombre;
            fila.querySelector(".filaBarra i").style.width = Math.max(4, Math.round(valor / mayor * 100)) + "%";
            fila.querySelector("b").textContent = texto;
            destino.appendChild(fila);
        });
    };
    const abrirComercio = nombre => { cerrarFichaMarca(); window.abrirFichaComercio?.(nombre); };
    filasConBarra(".fichaMarcaComercios", estudio.top.map(([nombre, cantidad]) => [nombre, cantidad, false, cantidad + " u."]), "Todavía nadie la pidió en los últimos 90 días.", abrirComercio);
    filasConBarra(".fichaMarcaOportunidades", estudio.oportunidades.slice(0, 5).map(([nombre, cantidad]) => [nombre, cantidad, false, cantidad + " u. de otras"]), "Todos tus comercios activos ya la compran.", abrirComercio);
    filasConBarra(".fichaMarcaRanking", estudio.ranking.map(([nombre, valor]) => [nombre, valor, normalizarTexto(nombre) === normalizarTexto(marca), estudio.conPlata ? plataMarca(valor) : valor + " u."]), "Este mes todavía no hay ventas.");
    const cajaNumeros = fichaMarca.querySelector(".fichaNumeros");
    numeros.forEach(numero => {
        const caja = document.createElement("div");
        if (numero.clase) caja.className = numero.clase;
        const fuerte = document.createElement("strong");
        fuerte.textContent = numero.valor;
        const chico = document.createElement("small");
        chico.textContent = numero.texto;
        caja.append(fuerte, chico);
        if (numero.alTocar && window.piezas?.tocable) window.piezas.tocable(caja, numero.alTocar);
        cajaNumeros.appendChild(caja);
    });

    // Cada producto: su foto (o el paquete), el stock si se cuenta, el
    // precio o "+ Agregar precio". Se toca para editarlo.
    const listaFicha = fichaMarca.querySelector(".listaFichaMarca");
    lista.forEach(producto => {
        const fila = document.createElement("button");
        fila.type = "button";
        fila.className = "filaFichaMarca";
        fila.setAttribute("aria-label", "Editar " + producto.nombre);
        const foto = document.createElement("span");
        foto.className = "fotoFichaMarca";
        const imagen = producto.imagen || producto.foto || "";
        if (imagen) {
            const img = document.createElement("img");
            img.alt = "";
            img.loading = "lazy";
            img.src = imagen;
            foto.appendChild(img);
        } else {
            foto.innerHTML = window.icono("paquete", 20);
        }
        const textos = document.createElement("span");
        textos.className = "textosFichaMarca";
        const nombre = document.createElement("strong");
        nombre.textContent = producto.nombre;
        textos.appendChild(nombre);
        const unidades = vendido(producto);
        const ventas = document.createElement("small");
        ventas.className = "ventasFichaMarca" + (unidades ? "" : " sinVentas");
        ventas.innerHTML = unidades ? '<span class="filaBarra"><i></i></span>' : "";
        ventas.append(document.createTextNode(unidades ? unidades + " u." : "Sin ventas en 30 días"));
        if (unidades) ventas.querySelector("i").style.width = Math.max(4, Math.round(unidades / maximo * 100)) + "%";
        textos.appendChild(ventas);
        const estado = estados.get(producto.id);
        if (estado) {
            const stock = document.createElement("small");
            stock.className = "stock-" + estado.nivel;
            stock.textContent = estado.hay + " u " + (estado.nivel === "ok" ? "disponibles" : estado.nivel === "no" ? "sin stock" : "poco stock");
            textos.appendChild(stock);
        }
        const flecha = document.createElement("span");
        flecha.className = "flechaFilaProducto";
        flecha.innerHTML = window.icono("chevDerecha", 18);
        fila.append(foto, textos, textoPrecioAdmin(producto.precio), flecha);
        fila.addEventListener("click", () => {
            if (typeof window.abrirFichaProducto === "function") { cerrarFichaMarca(); window.abrirFichaProducto(producto.id); }
            else abrirModalEditarProducto(producto.id);
        });
        listaFicha.appendChild(fila);
    });
    if (!lista.length) {
        const vacio = document.createElement("p");
        vacio.className = "subtitulo";
        vacio.textContent = "Esta marca todavía no tiene productos.";
        listaFicha.appendChild(vacio);
    }
    const agregar = document.createElement("button");
    agregar.type = "button";
    agregar.className = "agregarEnMarca";
    agregar.innerHTML = window.icono("mas", 18);
    agregar.append(document.createTextNode("Agregar producto a " + marca));
    agregar.addEventListener("click", () => abrirModalNuevoProducto(marca));
    listaFicha.appendChild(agregar);

    armarMenuMarca(marca, archivados);

    fichaMarca.querySelector(".fichaCerrar").onclick = evento => {
        evento.preventDefault();
        evento.stopPropagation();
        // Con el menú abierto, el atrás del celular primero cierra el menú.
        if (fichaMarca.classList.contains("conMenu")) cerrarMenuMarca();
        else cerrarFichaMarca();
    };
    fichaMarca.addEventListener("click", evento => {
        if (evento.target === fichaMarca || evento.target.classList.contains("fichaMarco")) cerrarFichaMarca();
    });
    if (scroll) fichaMarca.querySelector(".fichaComercioNueva").scrollTop = scroll;
}

function abrirMenuMarca() {
    if (!fichaMarca) return;
    fichaMarca.classList.add("conMenu");
    fichaMarca.querySelector(".fichaMenu").hidden = false;
    fichaMarca.querySelector(".fichaVelo").hidden = false;
    const boton = fichaMarca.querySelector(".fichaMenuBoton");
    boton.setAttribute("aria-expanded", "true");
    boton.setAttribute("aria-label", "Cerrar opciones");
    boton.innerHTML = window.icono("cerrarX", 26);
}

function cerrarMenuMarca() {
    if (!fichaMarca) return;
    fichaMarca.classList.remove("conMenu");
    fichaMarca.querySelector(".fichaMenu").hidden = true;
    fichaMarca.querySelector(".fichaVelo").hidden = true;
    const boton = fichaMarca.querySelector(".fichaMenuBoton");
    boton.setAttribute("aria-expanded", "false");
    boton.setAttribute("aria-label", "Más opciones");
    boton.innerHTML = window.icono("puntos", 26);
}

// El ⋯ de la ficha: lo principal arriba y resaltado; eliminar, abajo en rojo.
function armarMenuMarca(marca, archivados) {
    const menu = fichaMarca.querySelector(".fichaMenu");
    menu.setAttribute("aria-label", "Opciones de " + marca);
    const agregar = (item, alTocar) => {
        item.addEventListener("click", () => {
            cerrarMenuMarca();
            alTocar();
        });
        menu.appendChild(item);
    };
    agregar(itemMenuMarca("mas", "Agregar producto", "fichaMenuPrincipal"), () => abrirModalNuevoProducto(marca));
    agregar(itemMenuMarca("lapiz", "Cambiar el nombre"), () => abrirModalEditarMarca(marca));
    agregar(itemMenuMarca("paleta", "Cambiar el color"), () => elegirColorMarca(marca));
    agregar(itemMenuMarca("archivo", archivados ? "Ver archivados (" + archivados + ")" : "Ver archivados"), () => verArchivadosDeMarca(marca));
    menu.appendChild(document.createElement("hr"));
    agregar(itemMenuMarca("tacho", "Eliminar marca", "fichaMenuPeligro"), () => confirmarEliminarMarca(marca));
    fichaMarca.querySelector(".fichaVelo").addEventListener("click", cerrarMenuMarca);
    fichaMarca.querySelector(".fichaMenuBoton").addEventListener("click", () => {
        if (fichaMarca.classList.contains("conMenu")) cerrarMenuMarca();
        else abrirMenuMarca();
    });
}

// Los seis colores de las marcas, en una hoja.
function elegirColorMarca(marca) {
    const pz = window.piezas;
    if (!pz) return;
    const actual = tonoMarcaAdmin(marca);
    const hoja = pz.hoja({
        titulo: "Color de " + marca,
        sub: "Se ve en Catálogo y en Editar marcas. Queda en este celular.",
        html: `<div class="coloresMarca">${[0, 1, 2, 3, 4, 5].map(numero => `<button type="button" class="colorMarca tono${numero}${actual === "tono" + numero ? " elegido" : ""}" data-tono="tono${numero}" aria-label="Color ${numero + 1}" aria-pressed="${actual === "tono" + numero}">${actual === "tono" + numero ? window.icono("check", 22) : ""}</button>`).join("")}</div>`
    });
    hoja.addEventListener("click", evento => {
        const boton = evento.target.closest(".colorMarca");
        if (!boton) return;
        const colores = leerColoresMarcas();
        colores[normalizarTexto(marca)] = boton.dataset.tono;
        guardarColoresMarcas(colores);
        pz.cerrar();
        redibujarProductosEnTodasPartes();
    });
}

// Los archivados de la marca, para recuperarlos ahí mismo.
function verArchivadosDeMarca(marca) {
    const pz = window.piezas;
    if (!pz) return;
    const archivados = (productosParaLeer()[marca] || []).filter(producto => productoArchivado(producto));
    const hoja = pz.hoja({
        titulo: "Archivados de " + marca,
        sub: "No se ofrecen para vender",
        html: archivados.length
            ? `<div class="archivadosMarca">${archivados.map(producto => `<div class="filaArchivadoMarca"><strong>${pz.esc(producto.nombre)}</strong><button type="button" class="pzBtn pzBtnSec pzBtnChico" data-id="${pz.esc(producto.id)}">${window.icono("deshacer", 16)}Recuperar</button></div>`).join("")}</div>`
            : `<p class="subtitulo">No hay productos archivados de ${pz.esc(marca)}.</p>`
    });
    hoja.addEventListener("click", evento => {
        const boton = evento.target.closest("[data-id]");
        if (!boton) return;
        archivarProductoPorId(boton.dataset.id, false);
        boton.closest(".filaArchivadoMarca")?.remove();
        redibujarProductosEnTodasPartes();
        mostrarToast("Producto recuperado: vuelve a estar para vender");
    });
}

// ---------- Orden de las marcas (Ajustes › Preferencias de trabajo) ----------
function abrirOrdenMarcas() {
    const pz = window.piezas;
    if (!pz) return;
    const dibujar = () => {
        const marcas = obtenerMarcasOrdenadas();
        if (!marcas.length) return '<p class="subtitulo">Todavía no hay marcas.</p>';
        return marcas.map((marca, indice) => `<div class="filaOrdenMarca ${tonoMarcaAdmin(marca)}">
            <span class="numeroOrdenMarca">${indice + 1}</span>
            <span class="inicialesMarca" aria-hidden="true">${pz.esc(inicialesMarca(marca))}</span>
            <strong>${pz.esc(marca)}</strong>
            <button type="button" class="moverMarca" data-marca="${pz.esc(marca)}" data-direccion="-1" aria-label="Subir ${pz.esc(marca)}" ${indice === 0 ? "disabled" : ""}>${window.icono("chevArriba", 20)}</button>
            <button type="button" class="moverMarca" data-marca="${pz.esc(marca)}" data-direccion="1" aria-label="Bajar ${pz.esc(marca)}" ${indice === marcas.length - 1 ? "disabled" : ""}>${window.icono("chevAbajo", 20)}</button>
        </div>`).join("");
    };
    const hoja = pz.hoja({
        titulo: "Orden de las marcas",
        sub: "Así aparecen en Catálogo y en Nuevo pedido",
        html: `<div class="ordenMarcas">${dibujar()}</div>`,
        botones: [{ texto: "Listo", clase: "pzBtnPri" }]
    });
    hoja.addEventListener("click", evento => {
        const boton = evento.target.closest(".moverMarca");
        if (!boton || boton.disabled) return;
        if (!moverMarcaOrden(boton.dataset.marca, Number(boton.dataset.direccion))) return;
        const caja = hoja.querySelector(".ordenMarcas");
        caja.innerHTML = dibujar();
        // El foco sigue en la misma flecha de la misma marca.
        const mismo = [...caja.querySelectorAll(".moverMarca")].find(b => b.dataset.marca === boton.dataset.marca && b.dataset.direccion === boton.dataset.direccion && !b.disabled);
        if (mismo) mismo.focus();
        redibujarProductosEnTodasPartes();
    });
}
window.abrirOrdenMarcas = abrirOrdenMarcas;
window.abrirFichaMarca = abrirFichaMarca;

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
    campoContenido("");
    cargarSelectMarcas();
    if (typeof marcaElegida === "string" && marcas.includes(marcaElegida)) productoMarca.value = marcaElegida;
    mostrarArchivarEnModal(false);
    mostrarHojaProducto();
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
    mostrarHojaProducto();
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
    campoContenido(producto.contenido || "");
    mostrarArchivarEnModal(true);
    mostrarHojaProducto(encontrado.marca);
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
    if (!modalProducto || modalProducto.classList.contains("oculto")) return;
    modalProducto.classList.remove("visible");
    mostrarHojaProducto.cierre = setTimeout(() => {
        modalProducto.classList.add("oculto");
        modalProducto.classList.remove("pzFondo");
        modalProducto.firstElementChild.classList.remove("pzHoja");
    }, 200);
}

if (botonAgregarMarca) botonAgregarMarca.onclick = abrirModalNuevaMarca;
if (botonAgregarProducto) botonAgregarProducto.onclick = abrirModalNuevoProducto;

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
                { nombre, precio, ...(campoContenido() ? { contenido: campoContenido() } : {}) }
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

            if (guardado) {
                // El color elegido sigue a la marca con su nombre nuevo.
                const colores = leerColoresMarcas();
                const anterior = normalizarTexto(marcaActual);
                if (colores[anterior] && anterior !== normalizarTexto(nombre)) {
                    colores[normalizarTexto(nombre)] = colores[anterior];
                    delete colores[anterior];
                    guardarColoresMarcas(colores);
                }
            }

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
                { nombre, precio, contenido: campoContenido() }
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
        // Si se agregó desde Catálogo, que aparezca ahí mismo.
        if (typeof window.renderizarCatalogo === "function") window.renderizarCatalogo();
        refrescarFichaMarca(modo === "editarMarca" ? nombre : "");
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

        if (elemento.classList.contains("abrirFichaMarca")) {
            abrirFichaMarca(elemento.dataset.marca);
            return;
        }

        if (elemento.classList.contains("desplegarMarca")) {
            desplegarMarca(elemento);
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