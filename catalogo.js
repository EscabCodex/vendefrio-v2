// VendeFrío - Catálogo de venta móvil
(function () {
    let catalogoCreado = false;
    function crear() {
        if (catalogoCreado) return document.getElementById("pantallaCatalogo");
        const s = document.createElement("section"); s.id = "pantallaCatalogo"; s.className = "oculto pantallaExtra pantallaCatalogo";
        s.innerHTML = `<header><div class="logo">${window.icono("bolsa",22)}</div><div><h1>Catálogo</h1><p>Lo que vendés y sus precios</p></div></header><main class="container"><button class="extraVolver" type="button">‹ Volver</button><div class="catalogoFiltros"><input id="buscarCatalogo" class="buscadorCatalogo" type="search" placeholder="Buscar producto..."><select id="filtroMarcaCatalogo" aria-label="Filtrar por marca"><option value="todas">Todas las marcas</option></select></div><div id="grillaCatalogo" class="grillaCatalogo"></div></main></section>`;
        document.body.insertBefore(s, document.querySelector("nav.bottom-nav")); s.querySelector(".extraVolver").onclick = () => { s.classList.add("oculto"); mostrarPantalla("menu"); }; s.querySelector("#buscarCatalogo").oninput = renderizar; s.querySelector("#filtroMarcaCatalogo").onchange = renderizar; s.querySelector("main").prepend(crearSegmentoCatalogo("catalogo")); catalogoCreado = true; return s;
    }
    function datos() { const productos = typeof productosParaLeer === "function" ? productosParaLeer() : {}; const lista = []; Object.entries(productos).forEach(([marca, items]) => (items || []).forEach(item => { const p = typeof item === "string" ? { nombre: item } : item || {}; lista.push({ ...p, nombre: p.nombre || p.producto || "Producto", marca }); })); return lista; }
    function abrirEditorFoto(archivo, alGuardar) {
        const lector = new FileReader();
        lector.onload = () => {
            const imagen = new Image(); imagen.onload = () => {
                const modal = document.createElement("div"); modal.className = "modalCatalogo modalEditorFoto";
                modal.innerHTML = `<div class="modalCatalogoContenido editorFotoContenido"><div class="modalCatalogoTitulo"><strong>Ajustar foto</strong><button type="button" class="cerrarModalCatalogo">×</button></div><p class="subtitulo">Mové la imagen y ajustá el zoom para ver el encuadre.</p><canvas class="canvasEditorFoto" width="300" height="300"></canvas><label>Zoom<input class="zoomEditorFoto" type="range" min="100" max="250" value="100"></label><div class="accionesModalCatalogo"><button type="button" class="cancelarEdicionCatalogo">Cancelar</button><button type="button" class="guardarEdicionCatalogo">Usar este encuadre</button></div></div>`;
                document.body.appendChild(modal); const canvas = modal.querySelector(".canvasEditorFoto"); const ctx = canvas.getContext("2d"); const zoom = modal.querySelector(".zoomEditorFoto"); let desplazamientoX = 0; let desplazamientoY = 0; let inicioX = 0; let inicioY = 0; let moviendo = false;
                function dibujar() { const escalaBase = Math.max(300 / imagen.width, 300 / imagen.height) * (Number(zoom.value) / 100); const ancho = imagen.width * escalaBase; const alto = imagen.height * escalaBase; const x = (300 - ancho) / 2 + desplazamientoX; const y = (300 - alto) / 2 + desplazamientoY; ctx.clearRect(0, 0, 300, 300); ctx.fillStyle = "#111827"; ctx.fillRect(0, 0, 300, 300); ctx.drawImage(imagen, x, y, ancho, alto); }
                dibujar(); zoom.oninput = dibujar; canvas.onpointerdown = event => { moviendo = true; inicioX = event.clientX - desplazamientoX; inicioY = event.clientY - desplazamientoY; canvas.setPointerCapture(event.pointerId); }; canvas.onpointermove = event => { if (!moviendo) return; desplazamientoX = event.clientX - inicioX; desplazamientoY = event.clientY - inicioY; dibujar(); }; canvas.onpointerup = () => { moviendo = false; }; canvas.onpointercancel = () => { moviendo = false; };
                const cerrar = () => modal.remove(); modal.querySelector(".cerrarModalCatalogo").onclick = cerrar; modal.querySelector(".cancelarEdicionCatalogo").onclick = cerrar; modal.querySelector(".guardarEdicionCatalogo").onclick = () => { alGuardar(canvas.toDataURL("image/jpeg", .82)); cerrar(); };
            }; imagen.onerror = () => { modal.remove(); }; imagen.src = String(lector.result || "");
        }; lector.readAsDataURL(archivo);
    }
    // T166: "Editar precio o foto" en una hoja que sube desde abajo, con la
    // foto de muestra (o el color de la marca) y el precio con "$".
    function editarProductoCatalogo(producto) {
        const pz = window.piezas;
        let fotoNueva = producto.imagen || "";
        const caja = pz.hoja({
            titulo: "Editar producto",
            sub: producto.nombre + " · " + producto.marca,
            clase: "hojaEditarCatalogo",
            html: `<div class="fotoEdicionCatalogo ${tonoDeMarca(producto.marca)}"><div class="muestraFotoCatalogo"></div><div><label class="pzBtn pzBtnSec pzBtnChico botonFotoCatalogo">${pz.ico("camara", 16)}<span class="textoFotoCatalogo"></span><input class="fotoCatalogoEdicion" type="file" accept="image/*"></label><p class="estadoFotoCatalogo">Opcional. Se ve en el catálogo.</p></div></div>
                <label class="pzCampo campoPrecioCatalogo"><span>Precio</span><input class="precioCatalogoEdicion" type="number" min="0" step="0.01" inputmode="decimal"></label>`,
            botones: [
                { texto: "Cancelar", clase: "pzBtnGris cancelarEdicionCatalogo", par: true },
                { texto: "Guardar", clase: "pzBtnPri guardarEdicionCatalogo", par: true, cerrar: false, alTocar: guardar }
            ]
        });
        const muestra = caja.querySelector(".muestraFotoCatalogo");
        const estado = caja.querySelector(".estadoFotoCatalogo");
        function dibujarMuestra() {
            muestra.innerHTML = fotoNueva ? `<img alt="">` : pz.ico("paquete", 30);
            if (fotoNueva) muestra.querySelector("img").src = fotoNueva;
            caja.querySelector(".textoFotoCatalogo").textContent = fotoNueva ? "Cambiar foto" : "Poner foto";
        }
        dibujarMuestra();
        caja.querySelector(".precioCatalogoEdicion").value = Number(producto.precio) || 0;
        caja.querySelector(".fotoCatalogoEdicion").onchange = event => { const archivo = event.target.files && event.target.files[0]; if (!archivo) return; abrirEditorFoto(archivo, resultado => { fotoNueva = resultado; dibujarMuestra(); estado.textContent = "Foto encuadrada y lista para guardar"; }); };
        function guardar(_caja, boton) {
            if (!obtenerProductoPorId(producto.id)) { pz.cerrar(); return false; }
            const precio = Math.max(0, Number(caja.querySelector(".precioCatalogoEdicion").value) || 0);
            boton.disabled = true; boton.textContent = "Guardando...";
            const guardado = actualizarProductoPorId(producto.id, { precio, imagen: fotoNueva });
            if (!guardado) { boton.disabled = false; boton.textContent = "Guardar"; estado.textContent = "No se pudo guardar. Revisá el almacenamiento."; return false; }
            pz.cerrar(); renderizar(); return false;
        }
    }

    // Etapa 4 (T36): Catálogo y "Productos y marcas" son una sola sección,
    // con dos pestañas arriba: "Para vender" (la grilla) y "Productos y
    // marcas" (la administración de siempre). La barra marca "Catálogo" en
    // las dos. Etapa 8: se llaman "Productos" y "Editar marcas".
    function crearSegmentoCatalogo(activa) {
        const segmento = document.createElement("div");
        segmento.className = "segmentoCatalogo";
        segmento.setAttribute("role", "tablist");
        segmento.setAttribute("aria-label", "Catálogo");
        [["catalogo", "Productos"], ["productos", "Editar marcas"]].forEach(([destino, texto]) => {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.setAttribute("role", "tab");
            boton.dataset.destino = destino;
            boton.textContent = texto;
            boton.setAttribute("aria-selected", destino === activa ? "true" : "false");
            if (destino === activa) boton.classList.add("activo");
            boton.onclick = () => { if (destino !== activa) mostrarPantalla(destino); };
            segmento.appendChild(boton);
        });
        return segmento;
    }
    const mainProductos = document.querySelector("#pantallaProductos main");
    if (mainProductos) mainProductos.prepend(crearSegmentoCatalogo("productos"));

    // Repaso de Catálogo: filtros con el número adentro (como en Pedidos),
    // arriba del buscador. Primero Todas y las marcas; al final los avisos
    // ("Poco stock", "Sin precio"), que muestran solo esos productos. El
    // desplegable queda escondido y sigue siendo el que manda la marca.
    function dibujarChipsMarcas(filtro, marcas, lista) {
        let chips = document.getElementById("chipsMarcasCatalogo");
        if (!chips) {
            chips = document.createElement("div");
            chips.id = "chipsMarcasCatalogo";
            chips.className = "filtrosEtapaPedidos filtrosCatalogo";
            chips.setAttribute("role", "group");
            chips.setAttribute("aria-label", "Filtrar productos");
            filtro.closest(".catalogoFiltros").before(chips);
            filtro.classList.add("oculto");
        }
        chips.innerHTML = "";
        const ico = window.icono;
        const pocoStock = lista.filter(p => estaBajo(p)).length;
        const sinPrecio = verArchivados ? 0 : lista.filter(p => !(Number(p.precio) > 0)).length;
        if (!pocoStock) soloPocoStock = false;
        if (!sinPrecio) soloSinPrecio = false;
        const avisoActivo = soloPocoStock || soloSinPrecio;
        const boton = (texto, cantidad, activo, clase, alTocar, adelante = "") => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "filtroEtapa" + (activo ? " activo" : "") + (clase ? " " + clase : "");
            chip.setAttribute("aria-pressed", activo ? "true" : "false");
            chip.innerHTML = adelante;
            const nombre = document.createElement("span"); nombre.className = "filtroEtapaNombre"; nombre.textContent = texto;
            const numero = document.createElement("small"); numero.className = "filtroEtapaCantidad"; numero.textContent = String(cantidad);
            chip.append(nombre, numero);
            chip.onclick = alTocar;
            chips.appendChild(chip);
        };
        boton("Todas", lista.length, filtro.value === "todas" && !avisoActivo, "", () => { filtro.value = "todas"; soloPocoStock = false; soloSinPrecio = false; renderizar(); });
        marcas.forEach(m => boton(m, lista.filter(p => p.marca === m).length, filtro.value === m && !avisoActivo, "conTono " + tonoDeMarca(m),
            () => { filtro.value = m; soloPocoStock = false; soloSinPrecio = false; renderizar(); }));
        if (pocoStock) boton("Poco stock", pocoStock, soloPocoStock, "chipAviso", () => { soloPocoStock = !soloPocoStock; soloSinPrecio = false; filtro.value = "todas"; renderizar(); }, ico("alerta", 16));
        if (sinPrecio) boton("Sin precio", sinPrecio, soloSinPrecio, "chipAviso", () => { soloSinPrecio = !soloSinPrecio; soloPocoStock = false; filtro.value = "todas"; renderizar(); }, ico("alerta", 16));
    }
    function estaBajo(p) {
        const stock = window.stockVendeFrio;
        if (!stock || p.archivado === true) return false;
        try {
            const estado = stock.estadoDe(p, p.marca);
            return Boolean(estado && estado.nivel !== "ok");
        } catch (error) {
            return false;
        }
    }
    // T166: cada marca tiene su color (el mismo en Productos y en Editar
    // marcas), según el orden de las marcas.
    function tonoDeMarca(marca) { const orden = typeof obtenerMarcasOrdenadas === "function" ? obtenerMarcasOrdenadas() : []; const i = orden.indexOf(marca); return "tono" + ((i < 0 ? 0 : i) % 6); }
    window.tonoDeMarca = tonoDeMarca;
    let soloSinPrecio = false;
    let soloPocoStock = false;
    // El "+" de cada producto (repaso de Catálogo): sin pedido empezado abre
    // el Nuevo pedido como hoja encima, con ese producto; con un pedido a
    // medio hacer suma uno ahí mismo y el botón muestra cuántos van.
    function prepararBotonPedido(boton, p) {
        const enHoja = window.pedidoEnHoja;
        const cantidad = enHoja ? enHoja.cantidadDe(p.marca, p.nombre) : 0;
        if (cantidad) {
            boton.classList.add("conCantidad");
            boton.textContent = String(cantidad);
            boton.setAttribute("aria-label", "Sumar otro " + p.nombre + " (" + cantidad + " en el pedido)");
        }
        boton.onclick = () => {
            const elegido = { marca: p.marca, producto: p.nombre };
            if (!enHoja) {
                localStorage.setItem("vendefrio_producto_catalogo_pendiente", JSON.stringify(elegido));
                mostrarPantalla("pedido");
                return;
            }
            if (!enHoja.resumen()) {
                enHoja.abrir({ producto: elegido });
                return;
            }
            if (!enHoja.sumar(p.marca, p.nombre)) return;
            if (navigator.vibrate) navigator.vibrate(15);
            const nueva = enHoja.cantidadDe(p.marca, p.nombre);
            boton.classList.add("conCantidad");
            boton.textContent = String(nueva);
            boton.setAttribute("aria-label", "Sumar otro " + p.nombre + " (" + nueva + " en el pedido)");
        };
    }
    function renderizar() { const grilla = document.getElementById("grillaCatalogo"); const filtro = document.getElementById("filtroMarcaCatalogo"); if (!grilla || !filtro) return; const todos = datos(); const cantidadArchivados = todos.filter(p => p.archivado === true).length; if (!cantidadArchivados) verArchivados = false; dibujarFiltroArchivados(todos.length - cantidadArchivados, cantidadArchivados); const lista = todos.filter(p => (p.archivado === true) === verArchivados); const marcaActual = filtro.value; const marcas = [...new Set(lista.map(p => p.marca))].sort((a,b) => a.localeCompare(b,"es")); filtro.innerHTML = '<option value="todas">Todas las marcas</option>' + marcas.map(m => `<option value="${m.replace(/"/g,"&quot;")}">${m}</option>`).join(""); filtro.value = marcas.includes(marcaActual) ? marcaActual : "todas"; dibujarChipsMarcas(filtro, marcas, lista); const texto = (document.getElementById("buscarCatalogo")?.value || "").toLocaleLowerCase("es"); const visibles = lista.filter(p => (filtro.value === "todas" || p.marca === filtro.value) && (p.nombre + " " + p.marca).toLocaleLowerCase("es").includes(texto) && (!soloSinPrecio || !(Number(p.precio) > 0)) && (!soloPocoStock || estaBajo(p))); grilla.innerHTML = ""; visibles.forEach(p => { const card = document.createElement("article"); card.className = "itemCatalogo " + tonoDeMarca(p.marca); card.dataset.idProducto = p.id || ""; const imagen = p.imagen || p.foto || p.image || ""; card.innerHTML = `<div class="fotoCatalogo${imagen ? " conFoto" : ""}">${imagen ? `<img alt="">` : window.icono("paquete",34)}</div><button type="button" class="btnCatalogoEditar" aria-label="Opciones" title="Opciones">${window.icono("puntos",18)}</button><small></small><strong></strong><div class="pieItemCatalogo"><b></b><button type="button" class="btnCatalogoPedido" aria-label="Agregar al pedido" title="Agregar al pedido">${window.icono("mas",18)}</button></div>`; card.dataset.marca = p.marca; if (imagen) { const img = card.querySelector("img"); img.src = imagen; img.alt = p.nombre; } card.querySelector("small").textContent = p.marca; card.querySelector("strong").textContent = p.nombre; card.querySelector("b").textContent = p.precio ? "$ " + Number(p.precio).toLocaleString("es-AR") : "+ Agregar precio"; if (!p.precio) { const precio = card.querySelector("b"); precio.classList.add("sinPrecioCatalogo"); precio.setAttribute("role", "button"); precio.tabIndex = 0; precio.onclick = () => editarProductoCatalogo(p); } if (!imagen && p.archivado !== true) { const foto = document.createElement("button"); foto.type = "button"; foto.className = "agregarFotoCatalogo"; foto.textContent = "+ Agregar foto"; foto.setAttribute("aria-label", "Agregar foto a " + p.nombre); foto.onclick = () => editarProductoCatalogo(p); card.querySelector(".fotoCatalogo").appendChild(foto); } const oferta = typeof ofertaVigente === "function" ? ofertaVigente(p) : null; if (oferta && window.ofertasVendeFrio && p.archivado !== true) { card.querySelector("b").innerHTML = window.ofertasVendeFrio.htmlPrecio(p); card.classList.add("enOferta"); card.querySelector("strong").insertAdjacentHTML("afterend", `<span class="pzChip pzChipPromo">${window.piezas.esc(window.ofertasVendeFrio.textoHasta(oferta.hasta))}</span>`); } prepararBotonPedido(card.querySelector(".btnCatalogoPedido"), p); card.querySelector(".btnCatalogoEditar").setAttribute("aria-label", "Opciones de " + p.nombre); card.querySelector(".btnCatalogoEditar").onclick = evento => opcionesProducto(p, evento.currentTarget); if (p.archivado === true) { card.classList.add("archivado"); card.querySelector("b").textContent = "Archivado"; card.querySelector("b").classList.remove("sinPrecioCatalogo"); card.querySelector(".btnCatalogoPedido").remove(); } grilla.appendChild(card); }); if (!visibles.length) grilla.innerHTML = '<p class="catalogoVacio">No se encontraron productos.</p>'; dibujarExtras(grilla, verArchivados ? [] : visibles); dibujarVista(grilla, visibles.length); }
    // Archivar en vez de borrar (T63): "Activos" y "Archivados" arriba de
    // la grilla, y los tres puntos de cada producto.
    let verArchivados = false;
    function dibujarFiltroArchivados(activos, archivados) {
        const grilla = document.getElementById("grillaCatalogo");
        let filtro = document.getElementById("filtroArchivadosCatalogo");
        if (!archivados) {
            filtro?.remove();
            return;
        }
        if (!filtro) {
            filtro = document.createElement("div");
            filtro.id = "filtroArchivadosCatalogo";
            filtro.className = "pzFiltros";
            filtro.setAttribute("role", "group");
            filtro.setAttribute("aria-label", "Mostrar");
            grilla.before(filtro);
        }
        filtro.innerHTML = "";
        [[false, "Activos", activos], [true, "Archivados", archivados]].forEach(([valor, texto, cantidad]) => {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.className = "pzFiltro";
            boton.setAttribute("aria-pressed", String(verArchivados === valor));
            boton.innerHTML = texto + " <b>" + cantidad + "</b>";
            boton.onclick = () => { verArchivados = valor; renderizar(); };
            filtro.appendChild(boton);
        });
    }
    // Cuadros o Lista (T117): en lista entran el doble de productos. Se
    // recuerda en el celular.
    const CLAVE_VISTA = "vendefrio_catalogo_vista";
    function vistaElegida() {
        try { return localStorage.getItem(CLAVE_VISTA) === "lista" ? "lista" : "cuadros"; } catch (error) { return "cuadros"; }
    }
    function dibujarVista(grilla, cantidad) {
        const vista = vistaElegida();
        grilla.classList.toggle("vistaLista", vista === "lista");
        let barra = document.getElementById("vistaCatalogo");
        if (!barra) {
            barra = document.createElement("div");
            barra.id = "vistaCatalogo";
            barra.className = "vistaCatalogo";
            // Repaso de Catálogo: solo los dibujos (4 cuadraditos y renglones
            // con puntitos) y "+ Agregar producto" al lado, como en Comercios.
            barra.innerHTML = `<small></small><div class="pzSegmentos" role="group" aria-label="Ver como">
                <button type="button" data-vista="cuadros" aria-label="Ver en cuadros" title="Cuadros"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/></svg></button>
                <button type="button" data-vista="lista" aria-label="Ver en lista" title="Lista"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="4.5" cy="6" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor"/><path d="M9 6h11M9 12h11M9 18h11"/></svg></button></div>
                <button type="button" class="agregarProductoCatalogo">+ Agregar producto</button>`;
            barra.querySelector(".agregarProductoCatalogo").addEventListener("click", () => {
                if (typeof abrirModalNuevoProducto === "function") abrirModalNuevoProducto();
            });
            barra.addEventListener("click", evento => {
                const boton = evento.target.closest("[data-vista]");
                if (!boton) return;
                try { localStorage.setItem(CLAVE_VISTA, boton.dataset.vista); } catch (error) { /* sin lugar: queda por esta vez */ }
                renderizar();
            });
        }
        if (barra.nextElementSibling !== grilla) grilla.before(barra);
        barra.querySelector("small").textContent = cantidad === 1 ? "1 producto" : cantidad + " productos";
        barra.querySelectorAll("[data-vista]").forEach(boton => boton.setAttribute("aria-pressed", String(boton.dataset.vista === vista)));
    }
    // Opciones y dibujos de otras partes (T89 código de barras, T90 stock).
    function extrasOpciones(p) {
        return (window.opcionesProductoExtras || []).filter(extra => { try { return !extra.mostrar || extra.mostrar(p); } catch (error) { return false; } });
    }
    function dibujarExtras(grilla, visibles) {
        (window.catalogoExtras || []).forEach(extra => {
            try { extra(grilla, visibles); } catch (error) { console.error("Falló un agregado del catálogo.", error); }
        });
    }
    // Repaso de Catálogo: el ⋯ de cada producto abre el menú flotante (el de
    // la ficha del comercio), con "Editar datos" resaltado arriba. El "+" de
    // la tarjeta ya suma al pedido, así que acá no se repite.
    function opcionesProducto(p, boton) {
        const pz = window.piezas;
        const archivado = p.archivado === true;
        const items = [{ icono: "lapiz", texto: "Editar datos", principal: true, alTocar: () => editarProductoCatalogo(p) }];
        if (archivado) {
            items.push({ icono: "deshacer", texto: "Recuperar para vender", alTocar: () => {
                archivarProductoPorId(p.id, false);
                if (typeof renderizarPedido === "function") renderizarPedido();
                renderizar();
                window.mostrarToast?.("Producto recuperado: vuelve a estar para vender");
            } });
        } else {
            if (window.ofertasVendeFrio) items.push({ icono: "etiqueta", texto: typeof ofertaVigente === "function" && ofertaVigente(p) ? "Cambiar la oferta" : "Poner en oferta", alTocar: () => window.ofertasVendeFrio.abrir(p) });
            if (window.listasPreciosVendeFrio) items.push({ icono: "etiqueta", texto: "Precios por lista", alTocar: () => window.listasPreciosVendeFrio.abrir(p) });
            extrasOpciones(p).forEach(extra => items.push({ icono: extra.icono, texto: extra.texto(p), alTocar: () => extra.abrir(p) }));
            items.push("-", { icono: "archivo", texto: "Archivar", alTocar: () => window.archivarProductoConDeshacer?.(p.id) });
        }
        pz.menu(boton, {
            titulo: p.nombre,
            sub: p.marca + (archivado ? " · archivado" : " · " + (p.precio ? pz.plata(p.precio) : "sin precio")),
            items
        });
    }
    function abrir() { const s = crear(); document.querySelectorAll('body > section[id^="pantalla"]').forEach(item => item.classList.add("oculto")); s.classList.remove("oculto"); renderizar(); }
    // Repasada: desde Estadísticas ("Lo más pedido") abre en esa marca y,
    // si es un producto, lo deja a la vista.
    function abrirEn({ marca = "", producto = "" } = {}) {
        crear();
        const filtro = document.getElementById("filtroMarcaCatalogo");
        const buscar = document.getElementById("buscarCatalogo");
        if (buscar) buscar.value = "";
        if (filtro && marca) {
            if (![...filtro.options].some(opcion => opcion.value === marca)) filtro.add(new Option(marca, marca));
            filtro.value = marca;
        }
        if (typeof mostrarPantalla === "function") mostrarPantalla("catalogo"); else abrir();
        if (!producto) return;
        const tarjeta = [...document.querySelectorAll("#grillaCatalogo .itemCatalogo")]
            .find(item => item.querySelector("strong")?.textContent === producto);
        if (tarjeta) tarjeta.scrollIntoView({ block: "center" });
    }
    window.abrirCatalogo = abrir;
    window.abrirCatalogoEn = abrirEn;
    window.renderizarCatalogo = renderizar;
}());
