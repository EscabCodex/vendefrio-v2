// VendeFrío - Informe completo de estadísticas
(function () {
    function ocultarPantallas() { document.querySelectorAll('body > section[id^="pantalla"]').forEach(s => s.classList.add("oculto")); }
    function crearPantalla() {
        const s = document.createElement("section"); s.id = "pantallaEstadisticas"; s.className = "oculto pantallaExtra pantallaEstadisticas";
        s.innerHTML = `<header><div class="logo">📊</div><div><h1>Estadísticas</h1><p>Todo el movimiento de tu negocio</p></div></header><main class="container"><button class="extraVolver" type="button">‹ Volver</button><div class="selectorPeriodoEstadisticas" aria-label="Filtrar estadísticas por período"><button type="button" data-periodo="hoy">Hoy</button><button type="button" data-periodo="semana">Semana</button><button type="button" data-periodo="mes">Mes</button><button type="button" class="activo" data-periodo="todo">Todo</button></div><select id="filtroPeriodoEstadisticas" class="selectorPeriodoOculto" aria-label="Período"><option value="hoy">Hoy</option><option value="semana">Esta semana</option><option value="mes">Este mes</option><option value="todo" selected>Todo</option></select><div id="contenidoEstadisticas" class="informeEstadisticas"></div></main></section>`;
        document.body.insertBefore(s, document.querySelector("nav.bottom-nav"));
        s.querySelector(".extraVolver").addEventListener("click", () => { s.classList.add("oculto"); mostrarPantalla("menu"); });
        return s;
    }
    function lista(titulo, datos, sufijo) {
        const bloque = document.createElement("section"); bloque.className = "listaEstadistica";
        bloque.innerHTML = `<h2>${titulo}</h2>`;
        if (!datos || !datos.length) { bloque.innerHTML += "<p>Todavía no hay datos suficientes.</p>"; return bloque; }
        const max = Math.max(...datos.map(item => Number(item[1]) || 0), 1);
        datos.forEach(item => { const fila = document.createElement("div"); fila.className = "filaEstadistica"; fila.innerHTML = `<div><span></span><b></b></div><div class="barraEstadistica"><i></i></div>`; fila.querySelector("span").textContent = item[0]; fila.querySelector("b").textContent = item[1] + " " + sufijo; fila.querySelector("i").style.width = Math.round((item[1] / max) * 100) + "%"; bloque.appendChild(fila); });
        return bloque;
    }
    function obtenerHistorialPeriodo() {
        const historial = typeof obtenerHistorial === "function" ? obtenerHistorial() : [];
        const periodo = document.getElementById("filtroPeriodoEstadisticas")?.value || "todo";
        if (periodo === "todo") return historial;
        const ahora = new Date();
        const inicio = new Date(ahora);
        inicio.setHours(0, 0, 0, 0);
        if (periodo === "semana") inicio.setDate(inicio.getDate() - 6);
        if (periodo === "mes") inicio.setDate(1);
        return historial.filter(pedido => {
            const fecha = typeof obtenerFechaRegistro === "function" ? obtenerFechaRegistro(pedido) : new Date(Number(pedido.timestamp || 0));
            return fecha && !Number.isNaN(fecha.getTime()) && fecha >= inicio && fecha <= ahora;
        });
    }

    function estadisticasPeriodo(historial) {
        const comercios = {}, productos = {}, marcas = {};
        historial.forEach(pedido => {
            const comercio = pedido.comercio || "Sin comercio"; comercios[comercio] = (comercios[comercio] || 0) + 1;
            (pedido.productos || []).forEach(item => { const nombre = item.nombre || item.producto || "Producto"; const marca = item.marca || "Sin marca"; const cantidad = Number(item.cantidad || 1); productos[marca + " - " + nombre] = (productos[marca + " - " + nombre] || 0) + cantidad; marcas[marca] = (marcas[marca] || 0) + cantidad; });
        });
        const ordenar = datos => Object.entries(datos).sort((a,b) => b[1]-a[1]).slice(0,5);
        const perfiles = typeof obtenerPerfilesComerciales === "function" ? obtenerPerfilesComerciales(historial) : [];
        return { comercios: ordenar(comercios), productos: ordenar(productos), marcas: ordenar(marcas), perfiles, atrasados: perfiles.filter(p => p.atrasado) };
    }

    function renderizar() {
        const destino = document.getElementById("contenidoEstadisticas"); if (!destino) return; destino.innerHTML = "";
        const historial = obtenerHistorialPeriodo();
        const estadisticas = estadisticasPeriodo(historial);
        const resumen = document.createElement("div"); resumen.className = "estadisticaResumen"; resumen.innerHTML = `<div><small>Pedidos totales</small><strong>${historial.length}</strong></div><div><small>Comercios activos</small><strong>${new Set(historial.map(item => item.comercio)).size}</strong></div><div><small>Unidades totales</small><strong>${historial.reduce((total,item) => total + Number(item.cantidad || 0), 0)}</strong></div>`; destino.appendChild(resumen);
        destino.appendChild(lista("Comercios con más pedidos", estadisticas.comercios, "pedidos"));
        destino.appendChild(lista("Productos más pedidos", estadisticas.productos, "unidades"));
        destino.appendChild(lista("Marcas más pedidas", estadisticas.marcas, "unidades"));
        if (typeof crearComparativaSemanal === "function") destino.appendChild(crearComparativaSemanal(historial));
        if (typeof crearResumenMensual === "function") destino.appendChild(crearResumenMensual(historial));
        if (typeof crearPanelPerfilesComerciales === "function" && estadisticas.perfiles.length) destino.appendChild(crearPanelPerfilesComerciales(estadisticas.perfiles));
        if (typeof crearSeguimientoSemanal === "function") destino.appendChild(crearSeguimientoSemanal(estadisticas.perfiles, historial));
        if (typeof crearAlertasComerciales === "function") destino.appendChild(crearAlertasComerciales(estadisticas.atrasados));
    }
    function abrir() { const s = document.getElementById("pantallaEstadisticas") || crearPantalla(); ocultarPantallas(); s.classList.remove("oculto"); renderizar(); const filtro = document.getElementById("filtroPeriodoEstadisticas"); if (filtro && !filtro.dataset.conectado) { filtro.addEventListener("change", renderizar); filtro.dataset.conectado = "true"; const botones = s.querySelectorAll("[data-periodo]"); botones.forEach(botonPeriodo => botonPeriodo.addEventListener("click", () => { filtro.value = botonPeriodo.dataset.periodo; botones.forEach(item => item.classList.remove("activo")); botonPeriodo.classList.add("activo"); renderizar(); })); } }
    window.abrirEstadisticas = abrir;
}());
