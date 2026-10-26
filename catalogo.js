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

    // Las marcas como chips (como al cargar un pedido). El desplegable queda
    // escondido y sigue siendo el que manda.
    function dibujarChipsMarcas(filtro, marcas, lista) {
        let chips = document.getElementById("chipsMarcasCatalogo");
        if (!chips) {
            chips = document.createElement("div");
            chips.id = "chipsMarcasCatalogo";
            chips.className = "chipsMarcasPedido chipsMarcasCatalogo";
            filtro.after(chips);
            filtro.classList.add("oculto");
        }
        chips.innerHTML = "";
        [["todas", "Todas", lista.length]].concat(marcas.map(m => [m, m, lista.filter(p => p.marca === m).length])).forEach(([valor, texto, cantidad]) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "chipMarca" + (filtro.value === valor ? " activo" : "") + (valor === "todas" ? "" : " conTono " + tonoDeMarca(valor));
            chip.setAttribute("aria-pressed", filtro.value === valor ? "true" : "false");
            const nombre = document.createElement("span"); nombre.textContent = texto;
            const numero = document.createElement("small"); numero.textContent = String(cantidad);
            chip.append(nombre, numero);
            chip.onclick = () => { filtro.value = valor; renderizar(); };
            chips.appendChild(chip);
        });
    }
    // T166: cada marca tiene su color (el mismo en Productos y en Editar
    // marcas), según el orden de las marcas.
    function tonoDeMarca(marca) { const orden = typeof obtenerMarcasOrdenadas === "function" ? obtenerMarcasOrdenadas() : []; const i = orden.indexOf(marca); return "tono" + ((i < 0 ? 0 : i) % 6); }
    window.tonoDeMarca = tonoDeMarca;
    let soloSinPrecio = false;
    function dibujarAvisoSinPrecio(lista) {
        const grilla = document.getElementById("grillaCatalogo");
        const sinPrecio = verArchivados ? 0 : lista.filter(p => !(Number(p.precio) > 0)).length;
        if (!sinPrecio) soloSinPrecio = false;
        let aviso = document.getElementById("avisoSinPrecio");
        if (!sinPrecio) { aviso?.remove(); return; }
        if (!aviso) {
            aviso = document.createElement("button");
            aviso.type = "button";
            aviso.id = "avisoSinPrecio";
            aviso.className = "pzBanner pzBanAviso";
            aviso.onclick = () => { soloSinPrecio = !soloSinPrecio; renderizar(); };
        }
        const pz = window.piezas;
        const ico = (n, t) => pz ? pz.ico(n, t) : window.icono(n, t);
        aviso.innerHTML = `${ico("alerta", 22)}<div><strong>${sinPrecio === 1 ? "1 producto sin precio" : sinPrecio + " productos sin precio"}</strong><small>${soloSinPrecio ? "Mostrando solo esos. Tocá para ver todos." : "No se pueden cobrar bien."}</small></div><span class="avisoSinPrecioVer">${soloSinPrecio ? "Ver todos" : "Ver"}</span>`;
        const chips = document.getElementById("chipsMarcasCatalogo");
        if (chips) chips.after(aviso); else grilla.before(aviso);
    }
    function renderizar() { const grilla = document.getElementById("grillaCatalogo"); const filtro = document.getElementById("filtroMarcaCatalogo"); if (!grilla || !filtro) return; const todos = datos(); const cantidadArchivados = todos.filter(p => p.archivado === true).length; if (!cantidadArchivados) verArchivados = false; dibujarFiltroArchivados(todos.length - cantidadArchivados, cantidadArchivados); const lista = todos.filter(p => (p.archivado === true) === verArchivados); const marcaActual = filtro.value; const marcas = [...new Set(lista.map(p => p.marca))].sort((a,b) => a.localeCompare(b,"es")); filtro.innerHTML = '<option value="todas">Todas las marcas</option>' + marcas.map(m => `<option value="${m.replace(/"/g,"&quot;")}">${m}</option>`).join(""); filtro.value = marcas.includes(marcaActual) ? marcaActual : "todas"; dibujarChipsMarcas(filtro, marcas, lista); const texto = (document.getElementById("buscarCatalogo")?.value || "").toLocaleLowerCase("es"); const visibles = lista.filter(p => (filtro.value === "todas" || p.marca === filtro.value) && (p.nombre + " " + p.marca).toLocaleLowerCase("es").includes(texto) && (!soloSinPrecio || !(Number(p.precio) > 0))); grilla.innerHTML = ""; visibles.forEach(p => { const card = document.createElement("article"); card.className = "itemCatalogo " + tonoDeMarca(p.marca); card.dataset.idProducto = p.id || ""; const imagen = p.imagen || p.foto || p.image || ""; card.innerHTML = `<div class="fotoCatalogo${imagen ? " conFoto" : ""}">${imagen ? `<img alt="">` : window.icono("paquete",34)}</div><button type="button" class="btnCatalogoEditar" aria-label="Opciones" title="Opciones">${window.icono("puntos",18)}</button><small></small><strong></strong><div class="pieItemCatalogo"><b></b><button type="button" class="btnCatalogoPedido" aria-label="Agregar al pedido" title="Agregar al pedido">${window.icono("mas",18)}</button></div>`; card.dataset.marca = p.marca; if (imagen) { const img = card.querySelector("img"); img.src = imagen; img.alt = p.nombre; } card.querySelector("small").textContent = p.marca; card.querySelector("strong").textContent = p.nombre; card.querySelector("b").textContent = p.precio ? "$ " + Number(p.precio).toLocaleString("es-AR") : "Sin precio"; if (!p.precio) card.querySelector("b").classList.add("sinPrecioCatalogo"); const oferta = typeof ofertaVigente === "function" ? ofertaVigente(p) : null; if (oferta && window.ofertasVendeFrio && p.archivado !== true) { card.querySelector("b").innerHTML = window.ofertasVendeFrio.htmlPrecio(p); card.classList.add("enOferta"); card.querySelector("strong").insertAdjacentHTML("afterend", `<span class="pzChip pzChipPromo">${window.piezas.esc(window.ofertasVendeFrio.textoHasta(oferta.hasta))}</span>`); } card.querySelector(".btnCatalogoPedido").onclick = () => { localStorage.setItem("vendefrio_producto_catalogo_pendiente", JSON.stringify({ marca: p.marca, producto: p.nombre })); mostrarPantalla("pedido"); }; card.querySelector(".btnCatalogoEditar").setAttribute("aria-label", "Opciones de " + p.nombre); card.querySelector(".btnCatalogoEditar").onclick = () => opcionesProducto(p); if (p.archivado === true) { card.classList.add("archivado"); card.querySelector("b").textContent = "Archivado"; card.querySelector("b").classList.remove("sinPrecioCatalogo"); card.querySelector(".btnCatalogoPedido").remove(); } grilla.appendChild(card); }); if (!visibles.length) grilla.innerHTML = '<p class="catalogoVacio">No se encontraron productos.</p>'; dibujarAvisoSinPrecio(lista); dibujarExtras(grilla, verArchivados ? [] : visibles); dibujarVista(grilla, visibles.length); }
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
            barra.innerHTML = `<small></small><div class="pzSegmentos" role="group" aria-label="Ver como">
                <button type="button" data-vista="cuadros" aria-label="Ver en cuadros" title="Cuadros">${window.icono("menu", 16)}<span>Cuadros</span></button>
                <button type="button" data-vista="lista" aria-label="Ver en lista" title="Lista">${window.icono("lista", 16)}<span>Lista</span></button></div>`;
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
    function opcionesProducto(p) {
        const pz = window.piezas;
        const archivado = p.archivado === true;
        pz.hoja({
            titulo: p.nombre,
            sub: p.marca + (archivado ? " · archivado" : " · " + (p.precio ? pz.plata(p.precio) : "sin precio")),
            html: `<div class="pzMotivos">
                <button type="button" class="pzMotivo" data-opcion="editar">${pz.ico("lapiz", 20)}Editar precio o foto</button>
                ${archivado
                    ? `<button type="button" class="pzMotivo" data-opcion="recuperar">${pz.ico("deshacer", 20)}Recuperar para vender</button>`
                    : `${window.ofertasVendeFrio ? `<button type="button" class="pzMotivo" data-opcion="oferta">${pz.ico("etiqueta", 20)}${typeof ofertaVigente === "function" && ofertaVigente(p) ? "Cambiar la oferta" : "Poner en oferta"}</button>` : ""}${window.listasPreciosVendeFrio ? `<button type="button" class="pzMotivo" data-opcion="listas">${pz.ico("etiqueta", 20)}Precios por lista</button>` : ""}${extrasOpciones(p).map(extra => `<button type="button" class="pzMotivo" data-opcion="${extra.opcion}">${pz.ico(extra.icono, 20)}${pz.esc(extra.texto(p))}</button>`).join("")}<button type="button" class="pzMotivo" data-opcion="archivar">${pz.ico("archivo", 20)}Archivar</button>`}
            </div>
            <p class="pzHojaSub">${archivado ? "Vuelve a aparecer en Nuevo pedido." : "Deja de aparecer para vender. Los pedidos viejos lo siguen mostrando igual."}</p>`
        }).addEventListener("click", evento => {
            const opcion = evento.target.closest("[data-opcion]")?.dataset.opcion;
            if (!opcion) return;
            pz.cerrar();
            if (opcion === "editar") editarProductoCatalogo(p);
            if (opcion === "oferta") window.ofertasVendeFrio.abrir(p);
            if (opcion === "listas") window.listasPreciosVendeFrio.abrir(p);
            extrasOpciones(p).find(extra => extra.opcion === opcion)?.abrir(p);
            if (opcion === "archivar") window.archivarProductoConDeshacer?.(p.id);
            if (opcion === "recuperar") {
                archivarProductoPorId(p.id, false);
                if (typeof renderizarPedido === "function") renderizarPedido();
                renderizar();
                window.mostrarToast?.("Producto recuperado: vuelve a estar para vender");
            }
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
