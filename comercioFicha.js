// VendeFrío - ficha rápida de comercio
(function () {
    let modalFicha = null;

    function normalizarFicha(texto) {
        return String(texto || "").trim().toLocaleLowerCase("es");
    }

    function obtenerDatosFicha(nombre) {
        const comercio = obtenerComercios().find(item => normalizarFicha(item.nombre) === normalizarFicha(nombre));
        const historial = typeof obtenerHistorial === "function" ? obtenerHistorial() : [];
        const pedidos = historial.filter(item => normalizarFicha(item.comercio) === normalizarFicha(nombre));
        const ultimo = pedidos.slice().sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))[0];
        const productos = {};

        pedidos.forEach(pedido => {
            if (!Array.isArray(pedido.productos)) return;
            pedido.productos.forEach(producto => {
                const nombreProducto = String(producto.nombre || producto.producto || "").trim();
                if (nombreProducto) productos[nombreProducto] = (productos[nombreProducto] || 0) + Number(producto.cantidad || 1);
            });
        });

        const productosOrdenados = Object.entries(productos).sort((a, b) => b[1] - a[1]);
        const totalUnidades = productosOrdenados.reduce((total, item) => total + item[1], 0);
        const pedidosRegistrados = pedidos.length || Number(comercio?.pedidosRealizados || 0);
        const visitadoEstaSemana = estaVisitadoEstaSemana(comercio);
        const frecuenciaVisita = visitadoEstaSemana ? 100 : (comercio?.ultimaVisita ? 45 : 0);

        return {
            comercio,
            pedidos: pedidosRegistrados,
            frecuenciaVisita,
            visitadoEstaSemana,
            ultimaVisita: comercio?.ultimaVisita || "Nunca",
            totalUnidades,
            ultimo,
            productos: productosOrdenados.slice(0, 5).map(([nombre, cantidad]) => ({
                nombre,
                cantidad,
                porcentaje: totalUnidades ? Math.round((cantidad / totalUnidades) * 100) : 0
            }))
        };
    }

    function cerrarFicha() {
        if (modalFicha) modalFicha.remove();
        modalFicha = null;
    }

    function crearBoton(texto, clase, accion) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "btnAccion fichaBoton " + clase;
        boton.textContent = texto;
        boton.addEventListener("click", accion);
        return boton;
    }

    function abrirFicha(nombre) {
        const datos = obtenerDatosFicha(nombre);
        if (!datos.comercio) return;
        cerrarFicha();

        modalFicha = document.createElement("div");
        modalFicha.className = "modal modalFichaComercio";
        modalFicha.innerHTML = `
            <div class="modalContenido fichaContenido" role="dialog" aria-modal="true" aria-labelledby="tituloFichaComercio">
                <button type="button" class="fichaCerrar" aria-label="Cerrar ficha">×</button>
                <div class="fichaEncabezado">
                    <div class="fichaAvatar"></div>
                    <div><h2 id="tituloFichaComercio"></h2><p class="fichaEstado"></p></div>
                </div>
                <div class="fichaDatos"></div>
                <div class="fichaFrecuencia"><strong>Frecuencia de visita</strong><div class="fichaFrecuenciaTexto"></div></div>
                <div class="fichaUltimo"></div>
                <div class="fichaProductos"><strong>Productos habituales</strong><div class="fichaListaProductos"></div></div>
                <div class="fichaAcciones"></div>
            </div>`;
        document.body.appendChild(modalFicha);

        const comercio = datos.comercio;
        modalFicha.querySelector(".fichaAvatar").textContent = String(comercio.nombre || "?").trim().slice(0, 2).toUpperCase();
        modalFicha.querySelector("#tituloFichaComercio").textContent = comercio.nombre;
        modalFicha.querySelector(".fichaEstado").textContent = estaVisitadoEstaSemana(comercio) ? "Visitado esta semana" : "Pendiente esta semana";
        modalFicha.querySelector(".fichaDatos").innerHTML = `<p>📍 ${comercio.direccion || "Sin dirección cargada"}</p><p>📞 ${comercio.telefono || "Sin teléfono cargado"}</p><p>📦 ${datos.pedidos} pedidos registrados</p>`;
        modalFicha.querySelector(".fichaFrecuenciaTexto").textContent = datos.visitadoEstaSemana
            ? "Visitado esta semana · Última visita: " + datos.ultimaVisita
            : "Última visita: " + datos.ultimaVisita;

        const ultimo = modalFicha.querySelector(".fichaUltimo");
        ultimo.innerHTML = datos.ultimo ? `<strong>Último pedido</strong><span>${datos.ultimo.fecha || "Fecha no disponible"}</span>` : `<strong>Último pedido</strong><span>Todavía no hay pedidos registrados.</span>`;

        const listaProductos = modalFicha.querySelector(".fichaListaProductos");
        if (datos.productos.length) {
            datos.productos.forEach(producto => {
                const fila = document.createElement("div");
                fila.className = "fichaProductoBarraFila";
                const bloques = "█".repeat(Math.max(1, Math.round(producto.porcentaje / 10)));
                fila.innerHTML = `<span class="fichaProductoNombre"></span><span class="fichaProductoBloques"></span><b class="fichaProductoPorcentaje"></b>`;
                fila.querySelector(".fichaProductoNombre").textContent = producto.nombre;
                fila.querySelector(".fichaProductoBloques").textContent = bloques;
                fila.querySelector(".fichaProductoPorcentaje").textContent = producto.porcentaje + "% / " + producto.cantidad + "u";
                listaProductos.appendChild(fila);
            });
        } else {
            const vacio = document.createElement("span");
            vacio.textContent = "Aún no hay productos habituales.";
            listaProductos.appendChild(vacio);
        }

        const botonEstado = datos.visitadoEstaSemana
            ? crearBoton("🔴 Marcar pendiente", "secundario", () => { cerrarFicha(); marcarPendienteManual(comercio.nombre); })
            : crearBoton("✅ Marcar visitado", "ver", () => { cerrarFicha(); marcarVisitaManual(comercio.nombre); });
        const botonEliminar = crearBoton("🗑️ Eliminar comercio", "eliminar", () => { if (typeof abrirConfirmacion === "function") abrirConfirmacion("Eliminar comercio", "¿Eliminar " + comercio.nombre + "?", () => { cerrarFicha(); eliminarComercio(comercio.nombre); actualizarDatalist(); renderizarComercios(); if (typeof actualizarDashboard === "function") actualizarDashboard(); }); });
        modalFicha.querySelector(".fichaAcciones").append(
            crearBoton("📝 Hacer pedido", "agregar", () => { cerrarFicha(); irAPedidoRapido(comercio.nombre); }),
            crearBoton("🗺️ Navegar", "ver", () => { cerrarFicha(); mostrarPantalla("rutas"); }),
            crearBoton("✏️ Editar", "secundario", () => { cerrarFicha(); abrirModalEditar(comercio); }),
            botonEstado, botonEliminar,
            crearBoton("Cerrar", "secundario", cerrarFicha)
        );

        modalFicha.querySelector(".fichaCerrar").onclick = event => { event.preventDefault(); event.stopPropagation(); cerrarFicha(); };
        modalFicha.addEventListener("click", event => { if (event.target === modalFicha || event.target.closest(".fichaCerrar")) cerrarFicha(); });
    }

    document.addEventListener("click", event => {
        const tarjeta = event.target.closest(".comercioCard");
        if (!tarjeta || event.target.closest("button")) return;
        const titulo = tarjeta.querySelector("h3");
        if (titulo) abrirFicha(titulo.textContent);
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") cerrarFicha();
        if (event.key !== "Enter" && event.key !== " ") return;
        const tarjeta = document.activeElement?.closest?.(".comercioCard");
        if (tarjeta) {
            event.preventDefault();
            const titulo = tarjeta.querySelector("h3");
            if (titulo) abrirFicha(titulo.textContent);
        }
    });
}());
