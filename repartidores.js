// VendeFrío - Repartidores en el mapa (T73).
// Cada repartidor decide si comparte su ubicación (aviso en Inicio cuando
// tiene pedidos En reparto) y se apaga sola al terminar el reparto. El dueño
// ve "Repartiendo ahora": el mapa con cada uno, a dónde va y hace cuánto.
// En la nube: `ubicaciones/{idPersona}` (solo el dueño las lee).
(function () {
    "use strict";

    const p = window.piezas;
    const extras = window.extrasVendeFrio;
    const CLAVE = "vendefrio_compartiendo_ubicacion";
    const CLAVE_NO = "vendefrio_ubicacion_no_hoy";
    const VIGENTE = 20 * 60000;
    const MAXIMO = 12 * 3600000;

    extras.registrar("ubicaciones", {
        dias: 1,
        puedeLeer: () => p.esDueno(),
        describir: () => ({ titulo: "Tu ubicación", detalle: "para el dueño" })
    });

    // ---------- Pedidos de esta persona ----------
    function ultimaEntrada(pedido, estado) {
        const entradas = pedido && pedido.estados && typeof pedido.estados === "object" ? Object.values(pedido.estados) : [];
        return entradas.filter(entrada => entrada && entrada.estado === estado)
            .sort((a, b) => (Number(b.horaCelular) || 0) - (Number(a.horaCelular) || 0))[0] || null;
    }

    function hoy() {
        const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
        return inicio.getTime();
    }

    // Lo que esta persona lleva: { enReparto, hechas, total, siguiente }.
    // Se recuerda hasta que cambian los pedidos, la persona o el día: Inicio
    // lo pregunta en cada dibujo (repasada).
    function miReparto() {
        const yo = p.persona();
        const cuenta = recordarHastaQueCambie("miReparto", ["historial"], () => {
            const vivos = historialParaLeer().filter(pedido => pedido && pedido.eliminado !== true && typeof estadoActualDelPedido === "function");
            const enReparto = vivos.filter(pedido => estadoActualDelPedido(pedido) === "enReparto" &&
                (!yo || !ultimaEntrada(pedido, "enReparto") || (ultimaEntrada(pedido, "enReparto").persona || {}).idPersona === yo.idPersona));
            const hechas = vivos.filter(pedido => estadoActualDelPedido(pedido) === "entregado" &&
                pedido.entrega && pedido.entrega.persona && yo && pedido.entrega.persona.idPersona === yo.idPersona &&
                Number(pedido.entrega.horaCelular) >= hoy()).length;
            return { enReparto, hechas };
        }, (yo ? String(yo.idPersona || "") : "") + "|" + hoy());
        const enReparto = cuenta.enReparto.slice();
        return { enReparto, hechas: cuenta.hechas, total: cuenta.hechas + enReparto.length, siguiente: enReparto[0] || null };
    }

    // ---------- Compartir (el repartidor) ----------
    let vigilancia = null;
    let ultimaEscritura = { hora: 0, lat: 0, lng: 0 };

    function compartiendo() {
        const datos = p.lsLeer(CLAVE, null);
        return Boolean(datos && datos.desde && Date.now() - datos.desde < MAXIMO);
    }

    function destinoActual(reparto) {
        const navegando = window.navegacionVendeFrio?.abierta?.() && window.navegacionVendeFrio?.paradaActual?.();
        if (navegando && navegando.nombre) return navegando;
        const nombre = reparto.siguiente ? String(reparto.siguiente.comercio || "") : "";
        return nombre && typeof buscarComercioPorNombre === "function" ? (buscarComercioPorNombre(nombre) || { nombre }) : (nombre ? { nombre } : null);
    }

    function escribir(posicion) {
        const yo = p.persona();
        if (!yo || !p.refNube()) return;
        const reparto = miReparto();
        // Se apaga sola: sin pedidos En reparto, terminó el reparto.
        if (!reparto.enReparto.length) {
            apagar(true);
            return;
        }
        const lat = posicion.coords.latitude, lng = posicion.coords.longitude;
        const movido = window.pruebaEntregaVendeFrio
            ? window.pruebaEntregaVendeFrio.distanciaMetros(lat, lng, ultimaEscritura.lat, ultimaEscritura.lng) : 999;
        const pasado = Date.now() - ultimaEscritura.hora;
        if (pasado < 20000 || (pasado < 60000 && movido < 50)) return;
        const destino = destinoActual(reparto);
        let paso = "enCamino";
        if (destino && Number.isFinite(Number(destino.lat)) && destino.lat !== "" && window.pruebaEntregaVendeFrio &&
            window.pruebaEntregaVendeFrio.distanciaMetros(lat, lng, Number(destino.lat), Number(destino.lng)) <= 80) paso = "entregando";
        ultimaEscritura = { hora: Date.now(), lat, lng };
        extras.guardar("ubicaciones", {
            nombre: String(yo.nombre || "").slice(0, 60),
            lat, lng,
            precision: Math.round(Number(posicion.coords.accuracy) || 0),
            destino: destino ? String(destino.nombre || "").slice(0, 120) : "",
            paso,
            hechas: reparto.hechas,
            total: reparto.total,
            horaCelular: Date.now()
        }, yo.idPersona);
    }

    function vigilar() {
        if (vigilancia !== null || !navigator.geolocation) return;
        vigilancia = navigator.geolocation.watchPosition(escribir, error => {
            console.warn("No se pudo leer la ubicación para compartir.", error);
        }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 });
    }

    function activar() {
        if (!navigator.geolocation) {
            mostrarToast("Este celular no da la ubicación");
            return;
        }
        p.lsGuardar(CLAVE, { desde: Date.now() });
        ultimaEscritura = { hora: 0, lat: 0, lng: 0 };
        vigilar();
        mostrarToast("Compartiendo tu ubicación con el dueño");
        dibujarAvisos();
    }

    function apagar(solo) {
        if (vigilancia !== null && navigator.geolocation) navigator.geolocation.clearWatch(vigilancia);
        vigilancia = null;
        const estaba = compartiendo();
        try { localStorage.removeItem(CLAVE); } catch (error) { /* sin espacio */ }
        const yo = p.persona();
        if (yo && p.refNube()) extras.borrar("ubicaciones", yo.idPersona);
        if (estaba) mostrarToast(solo ? "Terminaste el reparto: dejaste de compartir tu ubicación" : "Dejaste de compartir tu ubicación");
        dibujarAvisos();
    }

    // ---------- "Repartiendo ahora" (el dueño) ----------
    function repartiendo() {
        return extras.lista("ubicaciones").filter(item => Date.now() - (Number(item.horaCelular) || 0) < VIGENTE);
    }

    function haceCuanto(hora) {
        const minutos = Math.max(0, Math.round((Date.now() - Number(hora)) / 60000));
        if (minutos < 1) return "recién";
        return "hace " + minutos + " min";
    }

    let mapa = null;
    let capa = null;

    function abrirPantalla() {
        const seccion = p.pantalla("pantallaRepartidores", { titulo: "Repartiendo ahora", sub: "Dónde está cada repartidor", icono: "camion", volverA: "menu" });
        const main = seccion.querySelector("main");
        if (!main.querySelector("#mapaRepartidores")) {
            main.innerHTML = `<div id="mapaRepartidores" class="pzMapa" role="img" aria-label="Mapa con los repartidores"></div>
                <div class="pzTarjeta pzLista" id="listaRepartidores"></div>
                <div class="pzNota pzNotaAviso">${p.ico("escudo", 20)}<span>Cada repartidor decide si comparte su ubicación, y se apaga sola al terminar el reparto.</span></div>`;
        }
        p.mostrar(seccion);
        dibujarPantalla();
    }

    function dibujarPantalla() {
        const seccion = document.getElementById("pantallaRepartidores");
        if (!seccion || seccion.classList.contains("oculto")) return;
        const lista = repartiendo();
        const filas = lista.map(item => {
            const entregando = item.paso === "entregando";
            const donde = item.destino ? (entregando ? "En " : "Va a ") + item.destino : "Repartiendo";
            const cuenta = Number(item.total) ? " · " + (Number(item.hechas) + 1) + " de " + Number(item.total) : "";
            return `<div class="pzFila">
                <div class="pzIni ${p.colorIni(item.nombre)}">${p.esc(p.iniciales(item.nombre))}</div>
                <div class="pzFilaTxt"><strong>${p.esc(item.nombre)}</strong><small>${p.esc(donde + cuenta)}</small></div>
                <div class="pzFilaDer"><span class="pzChip ${entregando ? "pzChipOk" : "pzChipAcento"}">${entregando ? "Entregando" : "En camino"}</span><b>${haceCuanto(item.horaCelular)}</b></div>
            </div>`;
        }).join("");
        seccion.querySelector("#listaRepartidores").innerHTML = filas || `<div class="pzVacio">Nadie está compartiendo su ubicación ahora.</div>`;

        const caja = seccion.querySelector("#mapaRepartidores");
        if (!window.mapaVendeFrio?.disponible?.()) {
            caja.classList.add("pzOcultar");
            return;
        }
        if (!mapa) {
            const centro = lista[0] ? [lista[0].lat, lista[0].lng] : [-34.6037, -58.3816];
            mapa = window.mapaVendeFrio.crearMapa(caja, { centro, zoom: 14, zoomControl: false });
        }
        if (capa) capa.remove();
        capa = L.layerGroup().addTo(mapa);
        const puntos = [];
        lista.forEach(item => {
            const icono = L.divIcon({
                className: "pinRepartidor",
                html: `<span class="pinRepartidorCabeza ${item.paso === "entregando" ? "entregando" : ""}">${p.esc(p.iniciales(item.nombre).slice(0, 1))}</span>`,
                iconSize: [38, 38],
                iconAnchor: [19, 19]
            });
            L.marker([item.lat, item.lng], { icon: icono, keyboard: false, title: item.nombre }).addTo(capa);
            puntos.push([item.lat, item.lng]);
            const destino = item.destino && typeof buscarComercioPorNombre === "function" ? buscarComercioPorNombre(item.destino) : null;
            if (destino && Number.isFinite(Number(destino.lat)) && destino.lat !== "") {
                L.polyline([[item.lat, item.lng], [Number(destino.lat), Number(destino.lng)]], { className: "lineaRepartidor", weight: 4, dashArray: "2 8" }).addTo(capa);
                L.marker([Number(destino.lat), Number(destino.lng)], {
                    icon: L.divIcon({ className: "pinRepartidor", html: `<span class="pinRepartidorDestino">${p.ico("tienda", 16)}</span>`, iconSize: [32, 32], iconAnchor: [16, 16] }),
                    keyboard: false, title: destino.nombre
                }).addTo(capa);
                puntos.push([Number(destino.lat), Number(destino.lng)]);
            }
        });
        setTimeout(() => {
            mapa.invalidateSize();
            if (puntos.length > 1) mapa.fitBounds(puntos, { padding: [40, 40], maxZoom: 16 });
            else if (puntos.length) mapa.setView(puntos[0], 15);
        }, 60);
    }

    // ---------- Avisos de Inicio ----------
    function dibujarAvisos() {
        if (!p.refNube() || !p.persona()) {
            p.avisoInicio("avisoCompartirUbicacion", null);
            p.avisoInicio("avisoRepartiendo", null);
            return;
        }
        // El dueño: quién está repartiendo ahora.
        const ahora = p.esDueno() ? repartiendo() : [];
        p.avisoInicio("avisoRepartiendo", ahora.length ? {
            color: "Info",
            icono: "camion",
            titulo: ahora.length === 1 ? ahora[0].nombre + " está repartiendo" : ahora.length + " repartiendo ahora",
            texto: "Mirá dónde está cada uno",
            boton: "Ver mapa",
            claseBoton: "pzBtnSec",
            alTocar: abrirPantalla,
            etiqueta: "Ver mapa de quién reparte"
        } : null, "arriba");

        // El repartidor: compartir mientras tiene pedidos En reparto.
        const reparto = miReparto();
        if (compartiendo()) {
            vigilar();
            p.avisoInicio("avisoCompartirUbicacion", {
                color: "Ok",
                icono: "ubicacion",
                titulo: "Compartiendo tu ubicación",
                texto: "Se apaga sola al terminar el reparto",
                boton: "Apagar",
                claseBoton: "pzBtnSec",
                alTocar: () => apagar(false)
            }, "arriba");
            if (!reparto.enReparto.length) apagar(true);
            return;
        }
        const noHoy = p.lsLeer(CLAVE_NO, 0) >= hoy();
        const puedeRepartir = !window.empleadosVendeFrio?.puede || window.empleadosVendeFrio.puede("reparte");
        p.avisoInicio("avisoCompartirUbicacion", reparto.enReparto.length && !noHoy && puedeRepartir ? {
            color: "Info",
            icono: "ubicacion",
            titulo: "¿Compartís tu ubicación?",
            texto: "Así el dueño ve dónde va el reparto",
            boton: "Activar",
            alTocar: activar,
            etiqueta: "Activar: compartir mi ubicación"
        } : null, "arriba");
    }

    if (typeof window.actualizarDashboard === "function") {
        const original = window.actualizarDashboard;
        window.actualizarDashboard = function () {
            const resultado = original.apply(this, arguments);
            try { dibujarAvisos(); } catch (error) { console.error("Falló el aviso de reparto.", error); }
            return resultado;
        };
    }
    extras.escuchar("ubicaciones", () => {
        try { dibujarAvisos(); dibujarPantalla(); } catch (error) { console.error(error); }
    });
    // "hace N min" sigue andando.
    setInterval(() => { try { dibujarPantalla(); } catch (error) { /* nada */ } }, 60000);
    if (compartiendo()) setTimeout(vigilar, 2000);

    window.repartidoresVendeFrio = { activar, apagar, compartiendo, abrirPantalla, repartiendo, miReparto, escribir };
}());
