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
        const pedidosRegistrados = pedidos.length || Number(comercio?.pedidosRealizados || 0);
        const actividad = Math.min(100, Math.round((pedidosRegistrados / 12) * 100));

        return {
            comercio,
            pedidos: pedidosRegistrados,
            actividad,
            ultimo,
            productos: productosOrdenados.slice(0, 3)
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
                <div class="fichaEstadistica"><div class="fichaEstadisticaTitulo"><strong>Actividad de pedidos</strong><b></b></div><div class="fichaBarra"><span></span></div><small></small></div>
                <div class="fichaUltimo"></div>
                <div class="fichaProductos"></div>
                <div class="fichaAcciones"></div>
            </div>`;
        document.body.appendChild(modalFicha);

        const comercio = datos.comercio;
        modalFicha.querySelector(".fichaAvatar").textContent = String(comercio.nombre || "?").trim().slice(0, 2).toUpperCase();
        modalFicha.querySelector("#tituloFichaComercio").textContent = comercio.nombre;
        modalFicha.querySelector(".fichaEstado").textContent = estaVisitadoEstaSemana(comercio) ? "Visitado esta semana" : "Pendiente esta semana";
        modalFicha.querySelector(".fichaDatos").innerHTML = `<p>📍 ${comercio.direccion || "Sin dirección cargada"}</p><p>📞 ${comercio.telefono || "Sin teléfono cargado"}</p><p>📦 ${datos.pedidos} pedidos registrados</p>`;
        modalFicha.querySelector(".fichaEstadistica b").textContent = datos.actividad + "%";
        modalFicha.querySelector(".fichaEstadistica span").style.width = datos.actividad + "%";
        modalFicha.querySelector(".fichaEstadistica small").textContent = datos.pedidos ? "Frecuencia calculada sobre el historial guardado." : "Todavía no hay pedidos suficientes para calcular la frecuencia.";

        const ultimo = modalFicha.querySelector(".fichaUltimo");
        ultimo.innerHTML = datos.ultimo ? `<strong>Último pedido</strong><span>${datos.ultimo.fecha || "Fecha no disponible"}</span>` : `<strong>Último pedido</strong><span>Todavía no hay pedidos registrados.</span>`;

        const listaProductos = modalFicha.querySelector(".fichaProductos");
        listaProductos.innerHTML = `<strong>Productos habituales</strong>`;
        if (datos.productos.length) {
            datos.productos.forEach(([producto, cantidad]) => {
                const fila = document.createElement("span");
                fila.textContent = producto + " · " + cantidad + " unidades";
                listaProductos.appendChild(fila);
            });
        } else {
            const vacio = document.createElement("span");
            vacio.textContent = "Aún no hay productos habituales.";
            listaProductos.appendChild(vacio);
        }

        modalFicha.querySelector(".fichaAcciones").append(
            crearBoton("📝 Hacer pedido", "agregar", () => { cerrarFicha(); irAPedidoRapido(comercio.nombre); }),
            crearBoton("🗺️ Navegar", "ver", () => { cerrarFicha(); mostrarPantalla("rutas"); }),
            crearBoton("✏️ Editar", "secundario", () => { cerrarFicha(); abrirModalEditar(comercio); }),
            crearBoton("Cerrar", "secundario", cerrarFicha)
        );

        modalFicha.querySelector(".fichaCerrar").addEventListener("click", cerrarFicha);
        modalFicha.addEventListener("click", event => { if (event.target === modalFicha) cerrarFicha(); });
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
