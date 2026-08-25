// VendeFrío - Informe completo de estadísticas / rework visual
(function () {
    function ocultarPantallas() {
        document.querySelectorAll('body > section[id^="pantalla"]').forEach(s => s.classList.add("oculto"));
    }

    function crearPantalla() {
        const s = document.createElement("section");
        s.id = "pantallaEstadisticas";
        s.className = "oculto pantallaExtra pantallaEstadisticas";
        s.innerHTML = `<header><div class="logo">📊</div><div><h1>Estadísticas</h1><p>Una vista clara de cómo se mueve tu negocio</p></div></header><main class="container"><button class="extraVolver" type="button">‹ Volver</button><div class="selectorPeriodoEstadisticas" aria-label="Filtrar estadísticas por período"><button type="button" data-periodo="hoy">Hoy</button><button type="button" data-periodo="semana">Semana</button><button type="button" data-periodo="mes">Mes</button><button type="button" class="activo" data-periodo="todo">Todo</button></div><select id="filtroPeriodoEstadisticas" class="selectorPeriodoOculto" aria-label="Período"><option value="hoy">Hoy</option><option value="semana">Esta semana</option><option value="mes">Este mes</option><option value="todo" selected>Todo</option></select><div id="contenidoEstadisticas" class="informeEstadisticas"></div></main></section>`;
        document.body.insertBefore(s, document.querySelector("nav.bottom-nav"));
        s.querySelector(".extraVolver").addEventListener("click", () => { s.classList.add("oculto"); mostrarPantalla("menu"); });
        return s;
    }

    function fechaPedido(pedido) {
        const fecha = typeof obtenerFechaRegistro === "function" ? obtenerFechaRegistro(pedido) : new Date(Number(pedido.timestamp || 0));
        return fecha instanceof Date && !Number.isNaN(fecha.getTime()) ? fecha : null;
    }

    function unidadesPedido(pedido) {
        return (pedido.productos || []).reduce((total, item) => total + Number(item.cantidad || 0), 0);
    }

    function obtenerHistorialPeriodo() {
        const historial = typeof obtenerHistorial === "function" ? obtenerHistorial() : [];
        const periodo = document.getElementById("filtroPeriodoEstadisticas")?.value || "todo";
        if (periodo === "todo") return historial;
        const ahora = new Date();
        const inicio = new Date(ahora); inicio.setHours(0, 0, 0, 0);
        if (periodo === "semana") inicio.setDate(inicio.getDate() - 6);
        if (periodo === "mes") inicio.setDate(1);
        return historial.filter(pedido => { const fecha = fechaPedido(pedido); return fecha && fecha >= inicio && fecha <= ahora; });
    }

    function estadisticasPeriodo(historial) {
        const comercios = {}, productos = {}, marcas = {};
        historial.forEach(pedido => {
            const comercio = pedido.comercio || "Sin comercio";
            comercios[comercio] = (comercios[comercio] || 0) + 1;
            (pedido.productos || []).forEach(item => {
                const nombre = item.nombre || item.producto || "Producto";
                const marca = item.marca || "Sin marca";
                const cantidad = Number(item.cantidad || 0);
                productos[marca + " - " + nombre] = (productos[marca + " - " + nombre] || 0) + cantidad;
                marcas[marca] = (marcas[marca] || 0) + cantidad;
            });
        });
        const ordenar = datos => Object.entries(datos).sort((a,b) => b[1]-a[1]).slice(0,5);
        const perfiles = typeof obtenerPerfilesComerciales === "function" ? obtenerPerfilesComerciales(historial) : [];
        return { comercios: ordenar(comercios), productos: ordenar(productos), marcas: ordenar(marcas), perfiles, atrasados: perfiles.filter(p => p.atrasado) };
    }

    function crearHero(historial) {
        const total = historial.length;
        const unidades = historial.reduce((t,p) => t + unidadesPedido(p), 0);
        const promedio = total ? (unidades / total).toFixed(1) : "0";
        const hero = document.createElement("section");
        hero.className = "statsHero";
        hero.innerHTML = `<div><small>ACTIVIDAD DEL PERÍODO</small><strong>${total}</strong><p>${total === 1 ? "pedido registrado" : "pedidos registrados"}</p></div><div class="statsHeroKpi"><strong>${promedio}</strong><span>unid. / pedido</span></div>`;
        return hero;
    }

    function crearKpis(historial) {
        const comercios = new Set(historial.map(p => p.comercio).filter(Boolean)).size;
        const unidades = historial.reduce((t,p) => t + unidadesPedido(p), 0);
        const kpis = document.createElement("section"); kpis.className = "statsKpis";
        kpis.innerHTML = `<div class="statsKpi"><small>COMERCIOS</small><strong>${comercios}</strong><span>con pedidos</span></div><div class="statsKpi"><small>UNIDADES</small><strong>${unidades}</strong><span>productos pedidos</span></div><div class="statsKpi"><small>PROMEDIO</small><strong>${historial.length ? (unidades/historial.length).toFixed(1) : "0"}</strong><span>por pedido</span></div>`;
        return kpis;
    }

    function crearGraficoPedidos(historial) {
        const card = document.createElement("section"); card.className = "statsChartCard";
        const puntos = [];
        const ahora = new Date();
        const periodo = document.getElementById("filtroPeriodoEstadisticas")?.value || "todo";
        const cantidadDias = periodo === "mes" ? Math.min(14, new Date(ahora.getFullYear(), ahora.getMonth()+1, 0).getDate()) : periodo === "todo" ? 14 : 7;
        for (let i = cantidadDias - 1; i >= 0; i--) {
            const dia = new Date(ahora); dia.setHours(0,0,0,0); dia.setDate(dia.getDate()-i);
            const siguiente = new Date(dia); siguiente.setDate(dia.getDate()+1);
            const total = historial.filter(p => { const f=fechaPedido(p); return f && f>=dia && f<siguiente; }).length;
            puntos.push({dia,total});
        }
        const max = Math.max(...puntos.map(p=>p.total),1);
        const w=340,h=175,left=8,right=8,top=14,bottom=28,innerW=w-left-right,innerH=h-top-bottom;
        const xy = (p,i) => ({x:left+(puntos.length===1?innerW/2:(i/(puntos.length-1))*innerW),y:top+innerH-(p.total/max)*innerH});
        const coords=puntos.map(xy);
        const path=coords.map((p,i)=>(i?"L":"M")+p.x.toFixed(1)+" "+p.y.toFixed(1)).join(" ");
        const area=path+` L ${coords.at(-1).x} ${top+innerH} L ${coords[0].x} ${top+innerH} Z`;
        const grid=[0,.5,1].map(v=>`<line class="grid" x1="${left}" y1="${top+innerH-(v*innerH)}" x2="${w-right}" y2="${top+innerH-(v*innerH)}"/>`).join("");
        const labels=coords.map((p,i)=>{ if(i%Math.ceil(puntos.length/5)!==0 && i!==puntos.length-1)return ""; return `<text x="${p.x}" y="${h-8}" text-anchor="middle">${puntos[i].dia.getDate()}/${puntos[i].dia.getMonth()+1}</text>`; }).join("");
        const dots=coords.map((p,i)=>puntos[i].total?`<circle class="dot" cx="${p.x}" cy="${p.y}" r="4"/>`:"").join("");
        card.innerHTML=`<div class="statsCardHead"><div><h2>Pedidos por día</h2><p>Actividad reciente</p></div><span class="statsCardBadge">${max} máx.</span></div><svg class="statsLineChart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="Gráfico de pedidos por día">${grid}<path class="area" d="${area}"/><path class="line" d="${path}"/>${dots}${labels}</svg>`;
        return card;
    }

    function crearBarras(titulo, datos, sufijo) {
        const card=document.createElement("section"); card.className="statsListCard";
        const filas=(datos||[]); const max=Math.max(...filas.map(x=>Number(x[1])||0),1);
        card.innerHTML=`<div class="statsCardHead"><div><h2>${titulo}</h2><p>Top ${filas.length || 0} del período</p></div></div>`;
        if(!filas.length){card.innerHTML+=`<div class="statsEmpty">Todavía no hay datos suficientes.</div>`;return card;}
        const list=document.createElement("div"); list.className="statsBarList";
        filas.forEach(([nombre,valor])=>{const row=document.createElement("div");row.className="statsBarItem";const pct=Math.round((Number(valor)||0)/max*100);row.innerHTML=`<div class="statsBarTop"><span>${nombre}</span><strong>${valor} ${sufijo}</strong></div><div class="statsBarTrack"><div class="statsBarFill" style="width:${pct}%"></div></div>`;list.appendChild(row);});
        card.appendChild(list); return card;
    }

    function renderizar() {
        const destino=document.getElementById("contenidoEstadisticas"); if(!destino)return;
        destino.innerHTML="";
        const historial=obtenerHistorialPeriodo();
        const estadisticas=estadisticasPeriodo(historial);
        destino.appendChild(crearHero(historial));
        destino.appendChild(crearKpis(historial));
        destino.appendChild(crearGraficoPedidos(historial));
        destino.appendChild(crearBarras("Comercios con más pedidos",estadisticas.comercios,"pedidos"));
        destino.appendChild(crearBarras("Productos más pedidos",estadisticas.productos,"unid."));
        destino.appendChild(crearBarras("Marcas más pedidas",estadisticas.marcas,"unid."));
        if(typeof crearComparativaSemanal === "function") destino.appendChild(crearComparativaSemanal(historial));
        if(typeof crearResumenMensual === "function") destino.appendChild(crearResumenMensual(historial));
        if(typeof crearPanelPerfilesComerciales === "function" && estadisticas.perfiles.length) destino.appendChild(crearPanelPerfilesComerciales(estadisticas.perfiles));
        if(typeof crearSeguimientoSemanal === "function") destino.appendChild(crearSeguimientoSemanal(estadisticas.perfiles,historial));
        if(typeof crearAlertasComerciales === "function") destino.appendChild(crearAlertasComerciales(estadisticas.atrasados));
    }

    function abrir() {
        const s=document.getElementById("pantallaEstadisticas")||crearPantalla(); ocultarPantallas(); s.classList.remove("oculto"); renderizar();
        const filtro=document.getElementById("filtroPeriodoEstadisticas");
        if(filtro && !filtro.dataset.conectado){
            filtro.addEventListener("change",()=>{const boton=s.querySelector(`[data-periodo="${filtro.value}"]`);s.querySelectorAll("[data-periodo]").forEach(b=>b.classList.remove("activo"));boton?.classList.add("activo");renderizar();}); filtro.dataset.conectado="true";
            s.querySelectorAll("[data-periodo]").forEach(b=>b.addEventListener("click",()=>{filtro.value=b.dataset.periodo;s.querySelectorAll("[data-periodo]").forEach(x=>x.classList.remove("activo"));b.classList.add("activo");renderizar();}));
        }
    }
    window.abrirEstadisticas=abrir;
}());
