// VendeFrío - Catálogo de venta móvil
(function () {
    let catalogoCreado = false;
    function crear() {
        if (catalogoCreado) return document.getElementById("pantallaCatalogo");
        const s = document.createElement("section"); s.id = "pantallaCatalogo"; s.className = "oculto pantallaExtra pantallaCatalogo";
        s.innerHTML = `<header><div class="logo">🛍️</div><div><h1>Catálogo</h1><p>Productos y precios para vender</p></div></header><main class="container"><button class="extraVolver" type="button">‹ Volver</button><div class="catalogoFiltros"><input id="buscarCatalogo" class="buscadorCatalogo" type="search" placeholder="Buscar producto..."><select id="filtroMarcaCatalogo" aria-label="Filtrar por marca"><option value="todas">Todas las marcas</option></select></div><div id="grillaCatalogo" class="grillaCatalogo"></div></main></section>`;
        document.body.insertBefore(s, document.querySelector("nav.bottom-nav"));
        s.querySelector(".extraVolver").addEventListener("click", () => { s.classList.add("oculto"); mostrarPantalla("menu"); });
        s.querySelector("#buscarCatalogo").addEventListener("input", renderizar); s.querySelector("#filtroMarcaCatalogo").addEventListener("change", renderizar); catalogoCreado = true; return s;
    }
    function datos() { const productos = typeof obtenerProductos === "function" ? obtenerProductos() : {}; const lista = []; Object.entries(productos).forEach(([marca, items]) => (items || []).forEach(item => { const p = typeof item === "string" ? { nombre: item } : item || {}; lista.push({ ...p, nombre: p.nombre || p.producto || "Producto", marca }); })); return lista; }
    function editarProductoCatalogo(producto) {
        const modal = document.createElement("div"); modal.className = "modalCatalogo";
        modal.innerHTML = `<div class="modalCatalogoContenido"><div class="modalCatalogoTitulo"><strong>Editar producto</strong><button type="button" class="cerrarModalCatalogo">×</button></div><p class="subtitulo"></p><label>Precio<input class="precioCatalogoEdicion" type="number" min="0" step="0.01"></label><label>Foto del producto<input class="fotoCatalogoEdicion" type="file" accept="image/*"></label><div class="accionesModalCatalogo"><button type="button" class="cancelarEdicionCatalogo">Cancelar</button><button type="button" class="guardarEdicionCatalogo">Guardar</button></div></div>`;
        document.body.appendChild(modal); modal.querySelector(".subtitulo").textContent = producto.nombre + " · " + producto.marca; modal.querySelector(".precioCatalogoEdicion").value = Number(producto.precio) || 0;
        const cerrar = () => modal.remove(); modal.querySelectorAll(".cerrarModalCatalogo,.cancelarEdicionCatalogo").forEach(b => b.addEventListener("click", cerrar));
        modal.querySelector(".guardarEdicionCatalogo").addEventListener("click", event => {
            event.preventDefault();
            const botonGuardar = event.currentTarget;
            const productos = obtenerProductos();
            const lista = productos[producto.marca] || [];
            const original = lista.find(p => p.nombre === producto.nombre);
            if (!original) return cerrar();
            original.precio = Math.max(0, Number(modal.querySelector(".precioCatalogoEdicion").value) || 0);
            const archivo = modal.querySelector(".fotoCatalogoEdicion").files[0];
            const terminar = () => {
                const guardado = guardarProductos(productos);
                if (!guardado) { modal.querySelector(".subtitulo").textContent = "No se pudo guardar. Intentá nuevamente."; return; }
                cerrar(); renderizar();
            };
            botonGuardar.disabled = true; botonGuardar.textContent = "Guardando...";
            if (!archivo) { terminar(); return; }
            const lector = new FileReader();
            lector.onload = () => {
                const imagen = new Image();
                imagen.onload = () => {
                    const maximo = 900; const escala = Math.min(1, maximo / Math.max(imagen.width, imagen.height));
                    const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(imagen.width * escala)); canvas.height = Math.max(1, Math.round(imagen.height * escala));
                    canvas.getContext("2d").drawImage(imagen, 0, 0, canvas.width, canvas.height);
                    original.imagen = canvas.toDataURL("image/jpeg", 0.8); terminar();
                };
                imagen.onerror = () => { botonGuardar.disabled = false; botonGuardar.textContent = "Guardar"; modal.querySelector(".subtitulo").textContent = "El archivo no parece ser una imagen válida."; };
                imagen.src = String(lector.result || "");
            };
            lector.onerror = () => { botonGuardar.disabled = false; botonGuardar.textContent = "Guardar"; modal.querySelector(".subtitulo").textContent = "No se pudo leer la foto."; };
            lector.readAsDataURL(archivo);
        });
    }
    function renderizar() { const grilla = document.getElementById("grillaCatalogo"); const filtro = document.getElementById("filtroMarcaCatalogo"); if (!grilla || !filtro) return; const lista = datos(); const marcaActual = filtro.value; const marcas = [...new Set(lista.map(p => p.marca))].sort((a,b) => a.localeCompare(b,"es")); filtro.innerHTML = '<option value="todas">Todas las marcas</option>' + marcas.map(m => `<option value="${m.replace(/"/g,"&quot;")}">${m}</option>`).join(""); filtro.value = marcas.includes(marcaActual) ? marcaActual : "todas"; const texto = (document.getElementById("buscarCatalogo")?.value || "").toLocaleLowerCase("es"); const visibles = lista.filter(p => (filtro.value === "todas" || p.marca === filtro.value) && (p.nombre + " " + p.marca).toLocaleLowerCase("es").includes(texto)); grilla.innerHTML = ""; visibles.forEach(p => { const card = document.createElement("article"); card.className = "itemCatalogo"; const imagen = p.imagen || p.foto || p.image || ""; card.innerHTML = `<div class="fotoCatalogo">${imagen ? `<img alt="">` : `<span>${p.nombre.trim().slice(0,1).toUpperCase()}</span>`}</div><small></small><strong></strong><b></b><button type="button" class="btnCatalogoPedido">＋ Agregar al pedido</button><button type="button" class="btnCatalogoEditar">✎ Editar precio o foto</button>`; if (imagen) { const img = card.querySelector("img"); img.src = imagen; img.alt = p.nombre; } card.querySelector("small").textContent = p.marca; card.querySelector("strong").textContent = p.nombre; card.querySelector("b").textContent = p.precio ? "$ " + p.precio : "Precio no cargado"; card.querySelector(".btnCatalogoPedido").addEventListener("click", () => { localStorage.setItem("vendefrio_producto_catalogo_pendiente", JSON.stringify({ marca: p.marca, producto: p.nombre })); mostrarPantalla("pedido"); }); card.querySelector(".btnCatalogoEditar").addEventListener("click", () => editarProductoCatalogo(p)); grilla.appendChild(card); }); if (!visibles.length) grilla.innerHTML = '<p class="catalogoVacio">No se encontraron productos.</p>'; }
    function abrir() { const s = crear(); document.querySelectorAll('body > section[id^="pantalla"]').forEach(item => item.classList.add("oculto")); s.classList.remove("oculto"); renderizar(); }
    window.abrirCatalogo = abrir;
}());
