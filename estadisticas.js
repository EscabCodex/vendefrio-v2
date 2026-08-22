// VendeFrío - Estadísticas móviles
(function () {
    function abrirEstadisticas() {
        let pantalla = document.getElementById("pantallaEstadisticas");
        if (!pantalla) pantalla = crearPantalla();
        document.querySelectorAll('body > section[id^="pantalla"]').forEach(s => s.classList.add("oculto"));
        pantalla.classList.remove("oculto");
        renderizar();
    }
    function crearPantalla() {
        const s = document.createElement("section"); s.id = "pantallaEstadisticas"; s.className = "oculto pantallaExtra";
        s.innerHTML = `<header><div class="logo">📊</div><div><h1>Estadísticas</h1><p>Conocé el movimiento de tu negocio</p></div></header><main class="container"><button class="extraVolver" type="button">‹ Volver</button><div id="contenidoEstadisticas"></div></main></section>`;
        document.body.insertBefore(s, document.querySelector("nav.bottom-nav"));
        s.querySelector(".extraVolver").addEventListener("click", () => { s.classList.add("oculto"); mostrarPantalla("menu"); });
        return s;
    }
    function renderizar() {
        const pedidos = typeof obtenerHistorial === "function" ? obtenerHistorial() : [];
        const ahora = new Date(); const hoy = pedidos.filter(p => String(p.fecha || "").includes(String(ahora.getDate()).padStart(2,"0"))).length;
        const cantidades = {}; pedidos.forEach(p => (p.productos || []).forEach(x => { const n = x.nombre || x.producto; if (n) cantidades[n] = (cantidades[n] || 0) + Number(x.cantidad || 1); }));
        const top = Object.entries(cantidades).sort((a,b) => b[1]-a[1]).slice(0,5); const max = top[0]?.[1] || 1;
        document.getElementById("contenidoEstadisticas").innerHTML = `<div class="estadisticaResumen"><div><small>Pedidos totales</small><strong>${pedidos.length}</strong></div><div><small>Pedidos de hoy</small><strong>${hoy}</strong></div><div><small>Comercios activos</small><strong>${new Set(pedidos.map(p => p.comercio)).size}</strong></div></div><section class="listaEstadistica"><h2>Productos más pedidos</h2>${top.length ? top.map(([n,c]) => `<div class="filaEstadistica"><div><span>${n}</span><b>${c}u.</b></div><div class="barraEstadistica"><i style="width:${Math.round(c/max*100)}%"></i></div></div>`).join("") : `<p>Aún no hay datos suficientes.</p>`}</section><section class="listaEstadistica"><h2>Resumen</h2><p>Estas estadísticas se calculan usando los pedidos guardados en el dispositivo.</p></section>`;
    }
    const b = document.createElement("button"); b.type="button"; b.className="menuBtn botonEstadisticasInicio"; b.textContent="📊 Estadísticas"; b.addEventListener("click", abrirEstadisticas);
    const accesos = document.querySelector("#pantallaMenu .container > div[style*='grid-template-columns']"); if (accesos) accesos.appendChild(b);
}());
