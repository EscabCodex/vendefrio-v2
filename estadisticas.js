// VendeFrío - Informe completo de estadísticas
(function () {
    function ocultarPantallas() { document.querySelectorAll('body > section[id^="pantalla"]').forEach(s => s.classList.add("oculto")); }
    function crearPantalla() {
        const s = document.createElement("section"); s.id = "pantallaEstadisticas"; s.className = "oculto pantallaExtra pantallaEstadisticas";
        s.innerHTML = `<header><div class="logo">📊</div><div><h1>Estadísticas</h1><p>Todo el movimiento de tu negocio</p></div></header><main class="container"><button class="extraVolver" type="button">‹ Volver</button><div id="contenidoEstadisticas" class="informeEstadisticas"></div></main></section>`;
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
    function renderizar() {
        const destino = document.getElementById("contenidoEstadisticas"); if (!destino) return; destino.innerHTML = "";
        const historial = typeof obtenerHistorial === "function" ? obtenerHistorial() : [];
        const estadisticas = typeof obtenerEstadisticasComerciales === "function" ? obtenerEstadisticasComerciales() : { comercios: [], productos: [], marcas: [], perfiles: [], atrasados: [] };
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
    function abrir() { const s = document.getElementById("pantallaEstadisticas") || crearPantalla(); ocultarPantallas(); s.classList.remove("oculto"); renderizar(); }
    const boton = document.querySelector(".botonEstadisticasInicio") || document.createElement("button"); boton.type = "button"; boton.className = "menuBtn botonEstadisticasInicio"; boton.textContent = "📊 Estadísticas"; boton.addEventListener("click", abrir); const accesos = document.querySelector("#pantallaMenu .container > div[style*='grid-template-columns']"); if (accesos && !document.querySelector(".botonEstadisticasInicio")) accesos.appendChild(boton);
}());
