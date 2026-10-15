// =====================================================
// VendeFrío - navegacion.js
// Navegación propia (Etapa 5, T41 y T42): mapa 2D a pantalla completa con
// tu posición, la línea azul del camino hasta el comercio y, abajo, una hoja
// que se desliza con sus datos y opciones (como Uber o DiDi, pero del lado
// de quien visita). Arriba, la próxima maniobra; con voz si está prendida.
//
// Todo gratis y sin claves: mapas de OpenStreetMap (mapa.js), el camino lo
// calcula el OSRM público de FOSSGIS (routing.openstreetmap.de) y la voz es
// la del celular (speechSynthesis). Si algo falla, se ve la línea recta y
// queda "Abrir en Google Maps".
// =====================================================

(function () {
    const CLAVE_PREFERENCIAS = "vendefrio_preferencias";
    const SERVIDOR_RUTAS = "https://routing.openstreetmap.de/";
    const PERFILES = { bicicleta: "routed-bike", moto: "routed-car", auto: "routed-car", pie: "routed-foot" };
    const VELOCIDAD_SIN_RUTA = { bicicleta: 4.2, moto: 8.3, auto: 8.3, pie: 1.3 }; // m/s, para estimar sin camino
    const DISTANCIA_LLEGADA = 35;     // m: "Llegaste"
    const DISTANCIA_FUERA = 45;       // m: te saliste del camino
    const ESPERA_RECALCULO = 12000;   // ms entre dos cálculos del camino

    let pantalla = null;
    let mapa = null;
    let capaCamino = null;
    let marcadorYo = null;
    let marcadorDestino = null;
    let vigilancia = null;
    let paradas = [];
    let indiceParada = 0;
    let posicion = null;
    let camino = null;           // { puntos: [[lat,lng]], acumulado: [m], distancia, duracion, pasos: [] }
    let calculando = false;
    let ultimoCalculo = 0;
    let fueraDelCamino = 0;
    let seguir = true;
    let llego = false;
    const pasosAnunciados = new Map();

    // -------------------------------------------------
    // Preferencias (Más > Cómo hacés el recorrido)
    // -------------------------------------------------

    function preferencias() {
        try {
            return JSON.parse(localStorage.getItem(CLAVE_PREFERENCIAS)) || {};
        } catch (error) {
            return {};
        }
    }

    function vehiculo() {
        const elegido = preferencias().vehiculo;
        return PERFILES[elegido] ? elegido : "bicicleta";
    }

    function conVoz() {
        return preferencias().voz !== "no";
    }

    function usaGoogleMaps() {
        return preferencias().navegador === "google";
    }

    // -------------------------------------------------
    // Utilidades
    // -------------------------------------------------

    function tieneGps(comercio) {
        if (!comercio) return false;
        if (typeof comercioTieneGps === "function") return comercioTieneGps(comercio);
        const lat = Number(comercio.lat);
        const lng = Number(comercio.lng);
        return comercio.lat !== "" && comercio.lng !== "" && Number.isFinite(lat) && Number.isFinite(lng);
    }

    function destinoDe(comercio) {
        return [Number(comercio.lat), Number(comercio.lng)];
    }

    function enlaceGoogle(comercio) {
        const destino = tieneGps(comercio) ? comercio.lat + "," + comercio.lng : String(comercio.direccion || "").trim();
        if (!destino) return "";
        const modo = { bicicleta: "bicycling", pie: "walking" }[vehiculo()] || "driving";
        return "https://www.google.com/maps/dir/?api=1&travelmode=" + modo + "&destination=" + encodeURIComponent(destino);
    }

    function enlaceWhatsapp(telefono) {
        let digitos = String(telefono || "").replace(/\D/g, "");
        if (digitos.length < 8) return "";
        if (!digitos.startsWith("54")) digitos = "549" + digitos.replace(/^0/, "").replace(/^(\d{2,4})15(\d{6,8})$/, "$1$2");
        return "https://wa.me/" + digitos;
    }

    // Distancia en metros entre dos puntos [lat, lng].
    function distancia(a, b) {
        const radio = 6371000;
        const rad = Math.PI / 180;
        const dLat = (b[0] - a[0]) * rad;
        const dLng = (b[1] - a[1]) * rad;
        const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
        return 2 * radio * Math.asin(Math.min(1, Math.sqrt(s)));
    }

    // Dónde cae un punto sobre el camino: metros recorridos y qué tan lejos
    // queda de la línea. Proyección plana: alcanza para unas cuadras.
    function proyectar(punto) {
        if (!camino || camino.puntos.length < 2) return null;
        const cosLat = Math.cos(punto[0] * Math.PI / 180);
        const metros = p => [p[0] * 111320, p[1] * 111320 * cosLat];
        const P = metros(punto);
        let mejor = { lejos: Infinity, recorrido: 0 };
        for (let i = 0; i < camino.puntos.length - 1; i++) {
            const A = metros(camino.puntos[i]);
            const B = metros(camino.puntos[i + 1]);
            const dx = B[0] - A[0];
            const dy = B[1] - A[1];
            const largo2 = dx * dx + dy * dy;
            const t = largo2 ? Math.max(0, Math.min(1, ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / largo2)) : 0;
            const X = A[0] + t * dx;
            const Y = A[1] + t * dy;
            const lejos = Math.hypot(P[0] - X, P[1] - Y);
            if (lejos < mejor.lejos) {
                mejor = { lejos, recorrido: camino.acumulado[i] + t * Math.sqrt(largo2) };
            }
        }
        return mejor;
    }

    function textoDistancia(metros) {
        if (metros >= 1000) return (metros / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " km";
        if (metros >= 100) return Math.round(metros / 50) * 50 + " m";
        return Math.max(10, Math.round(metros / 10) * 10) + " m";
    }

    function textoDistanciaHablada(metros) {
        if (metros >= 1000) return (metros / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " kilómetros";
        return (metros >= 100 ? Math.round(metros / 50) * 50 : Math.max(10, Math.round(metros / 10) * 10)) + " metros";
    }

    function textoMinutos(segundos) {
        const minutos = Math.max(1, Math.round(segundos / 60));
        if (minutos < 60) return minutos + " min";
        return Math.floor(minutos / 60) + " h " + (minutos % 60) + " min";
    }

    function horaDeLlegada(segundos) {
        const llegada = new Date(Date.now() + segundos * 1000);
        return llegada.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
    }

    // -------------------------------------------------
    // Indicaciones (T42)
    // -------------------------------------------------

    const LADOS = {
        left: "a la izquierda",
        right: "a la derecha",
        "slight left": "levemente a la izquierda",
        "slight right": "levemente a la derecha",
        "sharp left": "cerrado a la izquierda",
        "sharp right": "cerrado a la derecha"
    };

    // Texto de una maniobra del OSRM, en castellano de acá.
    function indicacion(paso, nombreDestino) {
        const tipo = paso.maniobra.tipo;
        const lado = paso.maniobra.lado;
        const calle = paso.calle ? " por " + paso.calle : "";
        if (tipo === "arrive") return "Llegaste a " + nombreDestino;
        if (tipo === "depart") return "Arrancá" + (calle || " por el camino marcado");
        if (tipo === "roundabout" || tipo === "rotary" || tipo === "roundabout turn" || tipo === "exit roundabout" || tipo === "exit rotary") {
            const salida = paso.maniobra.salida;
            return "En la rotonda, tomá la " + (salida ? ["primera", "segunda", "tercera", "cuarta", "quinta"][salida - 1] || salida + "ª" : "") + " salida" + calle;
        }
        if (lado === "uturn") return "Pegá la vuelta" + calle;
        if (lado === "straight" || !lado) return "Seguí derecho" + calle;
        if (tipo === "fork" || tipo === "merge" || tipo === "on ramp" || tipo === "off ramp") {
            return "Mantenete " + (lado.includes("left") ? "a la izquierda" : "a la derecha") + calle;
        }
        if (tipo === "end of road") return "Al final de la calle, doblá " + (LADOS[lado] || "") + calle;
        if (tipo === "continue" || tipo === "new name") {
            return lado.includes("slight") ? "Seguí " + LADOS[lado] + calle : "Doblá " + (LADOS[lado] || "") + calle;
        }
        return "Doblá " + (LADOS[lado] || "") + calle;
    }

    // Flecha de la maniobra: un solo dibujo, girado.
    const GIROS = { left: -90, right: 90, "slight left": -45, "slight right": 45, "sharp left": -135, "sharp right": 135, uturn: 180, straight: 0 };
    function iconoManiobra(paso) {
        const tipo = paso ? paso.maniobra.tipo : "";
        if (tipo === "arrive") return window.icono("bandera", 30);
        if (tipo && tipo.includes("round")) return window.icono("refrescar", 30);
        const grados = paso ? (GIROS[paso.maniobra.lado] ?? 0) : 0;
        return '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="transform:rotate(' + grados + 'deg)"><path d="M12 20V5"/><path d="m6 11 6-6 6 6"/></svg>';
    }

    function hablar(texto) {
        if (!conVoz() || !("speechSynthesis" in window) || !texto) return;
        try {
            window.speechSynthesis.cancel();
            const frase = new SpeechSynthesisUtterance(texto);
            frase.lang = "es-AR";
            const voces = window.speechSynthesis.getVoices();
            const voz = voces.find(v => v.lang === "es-AR") || voces.find(v => /^es/i.test(v.lang));
            if (voz) frase.voice = voz;
            frase.rate = 1.02;
            window.speechSynthesis.speak(frase);
        } catch (error) {
            // Sin voz en este celular: quedan las indicaciones en pantalla.
        }
    }

    // -------------------------------------------------
    // Camino (OSRM)
    // -------------------------------------------------

    function caminoRecto(desde, hasta) {
        const metros = distancia(desde, hasta);
        return armarCamino([desde, hasta], metros / VELOCIDAD_SIN_RUTA[vehiculo()], [], true);
    }

    function armarCamino(puntos, duracion, pasos, recto) {
        const acumulado = [0];
        for (let i = 1; i < puntos.length; i++) acumulado.push(acumulado[i - 1] + distancia(puntos[i - 1], puntos[i]));
        const total = acumulado[acumulado.length - 1];
        // Cada maniobra, en qué metro del camino está.
        pasos.forEach(paso => {
            let mejor = 0;
            let menor = Infinity;
            puntos.forEach((p, i) => {
                const d = distancia(p, paso.lugar);
                if (d < menor) { menor = d; mejor = i; }
            });
            paso.metro = acumulado[mejor];
        });
        return { puntos, acumulado, distancia: total, duracion, pasos, recto: Boolean(recto) };
    }

    async function pedirCamino(desde, hasta) {
        const perfil = PERFILES[vehiculo()];
        const url = SERVIDOR_RUTAS + perfil + "/route/v1/driving/" +
            desde[1] + "," + desde[0] + ";" + hasta[1] + "," + hasta[0] +
            "?overview=full&geometries=geojson&steps=true";
        const respuesta = await fetch(url);
        if (!respuesta.ok) throw new Error("Sin camino");
        const datos = await respuesta.json();
        const ruta = datos && Array.isArray(datos.routes) ? datos.routes[0] : null;
        if (!ruta || !ruta.geometry || !Array.isArray(ruta.geometry.coordinates)) throw new Error("Sin camino");
        const puntos = ruta.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        const pasos = [];
        (ruta.legs || []).forEach(tramo => (tramo.steps || []).forEach(paso => {
            const maniobra = paso.maneuver || {};
            if (!Array.isArray(maniobra.location)) return;
            pasos.push({
                lugar: [maniobra.location[1], maniobra.location[0]],
                calle: String(paso.name || "").trim(),
                maniobra: { tipo: String(maniobra.type || ""), lado: String(maniobra.modifier || ""), salida: Number(maniobra.exit) || 0 }
            });
        }));
        return armarCamino(puntos, Number(ruta.duration) || 0, pasos, false);
    }

    async function calcularCamino() {
        const comercio = paradaActual();
        if (!comercio || !posicion || calculando) return;
        calculando = true;
        ultimoCalculo = Date.now();
        const destino = destinoDe(comercio);
        try {
            camino = await pedirCamino(posicion, destino);
        } catch (error) {
            camino = caminoRecto(posicion, destino);
        }
        calculando = false;
        fueraDelCamino = 0;
        pasosAnunciados.clear();
        dibujarCamino();
        actualizar(true);
    }

    // -------------------------------------------------
    // Pantalla
    // -------------------------------------------------

    function paradaActual() {
        return paradas[indiceParada] || null;
    }

    function crearPantalla() {
        if (pantalla) return pantalla;
        pantalla = document.createElement("section");
        pantalla.id = "pantallaNavegacion";
        pantalla.className = "pantallaNavegacion oculto";
        pantalla.setAttribute("aria-label", "Navegación");
        pantalla.innerHTML = `
            <div class="mapaNavegacion" id="mapaNavegacion"></div>
            <div class="cartelManiobra" aria-live="polite">
                <span class="iconoManiobra"></span>
                <div><strong class="distanciaManiobra"></strong><span class="textoManiobra"></span></div>
            </div>
            <div class="botonesNavegacion">
                <button type="button" class="botonFlotanteNav cerrarNavegacion" aria-label="Terminar navegación">${window.icono("cerrarX", 22)}</button>
                <button type="button" class="botonFlotanteNav vozNavegacion" aria-label="Voz"></button>
            </div>
            <button type="button" class="botonFlotanteNav centrarNavegacion oculto" aria-label="Centrar en mi posición">${window.icono("mira", 22)}</button>
            <div class="hojaNavegacion" role="region" aria-label="Datos del comercio">
                <button type="button" class="asaHoja" aria-label="Ver más datos del comercio" aria-expanded="false"><span></span></button>
                <div class="hojaResumen">
                    <div class="hojaTiempo"><strong class="tiempoNavegacion"></strong><small class="detalleTiempo"></small></div>
                    <div class="hojaComercio"><div class="hojaAvatar"></div><div><h2 class="nombreNavegacion"></h2><p class="direccionNavegacion"></p></div></div>
                </div>
                <div class="hojaAcciones"></div>
                <div class="hojaMas">
                    <div class="hojaPedidos"></div>
                    <div class="hojaParadas"></div>
                    <a class="btnAccion secundario abrirEnGoogle" target="_blank" rel="noopener">${window.icono("mapa", 16)} Abrir en Google Maps</a>
                </div>
                <p class="avisoNavegacion" aria-live="polite"></p>
            </div>`;
        document.body.appendChild(pantalla);

        // Comando por voz también navegando ("llegué", "nuevo pedido para…").
        if (window.vozVendeFrio?.disponible) {
            const microfono = document.createElement("button");
            microfono.type = "button";
            microfono.className = "botonFlotanteNav microfonoNavegacion";
            microfono.setAttribute("aria-label", "Comando por voz");
            microfono.innerHTML = window.icono("microfono", 22);
            microfono.addEventListener("click", () => window.vozVendeFrio.comando());
            pantalla.querySelector(".botonesNavegacion").appendChild(microfono);
        }
        pantalla.querySelector(".cerrarNavegacion").addEventListener("click", cerrar);
        pantalla.querySelector(".vozNavegacion").addEventListener("click", alternarVoz);
        pantalla.querySelector(".centrarNavegacion").addEventListener("click", () => {
            seguir = true;
            pantalla.querySelector(".centrarNavegacion").classList.add("oculto");
            if (posicion && mapa) mapa.setView(posicion, Math.max(mapa.getZoom(), 17));
        });

        // La hoja: tocar el asa o deslizar para arriba o abajo.
        const hoja = pantalla.querySelector(".hojaNavegacion");
        const asa = pantalla.querySelector(".asaHoja");
        asa.addEventListener("click", () => abrirHoja(!hoja.classList.contains("abierta")));
        let inicioY = null;
        hoja.addEventListener("pointerdown", evento => {
            if (evento.target.closest("button:not(.asaHoja), a")) return;
            inicioY = evento.clientY;
        });
        hoja.addEventListener("pointerup", evento => {
            if (inicioY === null) return;
            const movido = inicioY - evento.clientY;
            inicioY = null;
            if (movido > 30) abrirHoja(true);
            if (movido < -30) abrirHoja(false);
        });
        hoja.addEventListener("pointercancel", () => { inicioY = null; });
        return pantalla;
    }

    function abrirHoja(abierta) {
        const hoja = pantalla.querySelector(".hojaNavegacion");
        hoja.classList.toggle("abierta", abierta);
        pantalla.querySelector(".asaHoja").setAttribute("aria-expanded", abierta ? "true" : "false");
    }

    function dibujarBotonVoz() {
        const boton = pantalla.querySelector(".vozNavegacion");
        const prendida = conVoz();
        boton.innerHTML = window.icono(prendida ? "volumen" : "volumenNo", 22);
        boton.setAttribute("aria-label", prendida ? "Silenciar la voz" : "Prender la voz");
        boton.classList.toggle("apagado", !prendida);
    }

    function alternarVoz() {
        const datos = preferencias();
        datos.voz = conVoz() ? "no" : "si";
        try {
            localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify(datos));
        } catch (error) {
            // Sin lugar: el ajuste vale hasta cerrar.
        }
        if (!conVoz() && "speechSynthesis" in window) window.speechSynthesis.cancel();
        dibujarBotonVoz();
    }

    function iconoDestino() {
        return L.divIcon({
            className: "pinNavegacion",
            html: '<span class="pinNavegacionCabeza">' + window.icono("tienda", 18) + "</span>",
            iconSize: [40, 48],
            iconAnchor: [20, 46]
        });
    }

    function dibujarCamino() {
        if (!mapa || !camino) return;
        if (capaCamino) capaCamino.remove();
        capaCamino = L.layerGroup([
            L.polyline(camino.puntos, { color: "#ffffff", weight: 10, opacity: 0.95, lineCap: "round", lineJoin: "round" }),
            L.polyline(camino.puntos, { className: "lineaCamino", color: "#1F5FE0", weight: 6, opacity: 1, lineCap: "round", lineJoin: "round", dashArray: camino.recto ? "2 10" : null })
        ]).addTo(mapa);
        if (marcadorYo) marcadorYo.bringToFront?.();
        if (seguir && camino.puntos.length > 1) {
            mapa.fitBounds(L.latLngBounds(camino.puntos), { paddingTopLeft: [30, 130], paddingBottomRight: [30, 240], maxZoom: 17 });
        }
    }

    function dibujarHoja() {
        const comercio = paradaActual();
        if (!comercio) return;
        pantalla.querySelector(".nombreNavegacion").textContent = comercio.nombre;
        pantalla.querySelector(".direccionNavegacion").textContent = comercio.direccion || "Sin dirección cargada";
        const avatar = pantalla.querySelector(".hojaAvatar");
        avatar.textContent = String(comercio.nombre || "?").trim().slice(0, 2).toUpperCase();
        if (typeof colorAvatar === "function") avatar.style.background = colorAvatar(comercio.nombre);
        const google = pantalla.querySelector(".abrirEnGoogle");
        google.href = enlaceGoogle(comercio);

        // Accesos: llamar, WhatsApp, cargar pedido y "Llegué".
        const acciones = pantalla.querySelector(".hojaAcciones");
        acciones.innerHTML = "";
        const acceso = (icono, texto, etiqueta) => {
            const elemento = document.createElement(etiqueta || "button");
            elemento.className = "accesoNavegacion";
            if (elemento.tagName === "BUTTON") elemento.type = "button";
            elemento.innerHTML = '<span class="accesoNavegacionIcono">' + window.icono(icono, 22) + "</span><small></small>";
            elemento.querySelector("small").textContent = texto;
            acciones.appendChild(elemento);
            return elemento;
        };
        if (comercio.telefono) {
            acceso("telefono", "Llamar", "a").href = "tel:" + String(comercio.telefono).replace(/[^\d+]/g, "");
            const whatsapp = enlaceWhatsapp(comercio.telefono);
            if (whatsapp) {
                const enlace = acceso("whatsapp", "WhatsApp", "a");
                enlace.href = whatsapp;
                enlace.target = "_blank";
                enlace.rel = "noopener";
            }
        }
        acceso("documento", "Cargar pedido").addEventListener("click", () => {
            const nombre = comercio.nombre;
            cerrar();
            if (typeof irAPedidoRapido === "function") irAPedidoRapido(nombre);
        });
        const llegue = acceso("check", "Llegué");
        llegue.classList.add("accesoNavegacionPrincipal");
        llegue.addEventListener("click", marcarLlegada);

        dibujarPedidosPendientes(comercio);
        dibujarParadas();
    }

    // Pedidos de este comercio que todavía no se entregaron (en la nube).
    function dibujarPedidosPendientes(comercio) {
        const caja = pantalla.querySelector(".hojaPedidos");
        caja.innerHTML = "";
        const historial = typeof obtenerHistorial === "function" ? obtenerHistorial() : [];
        const normalizar = texto => String(texto || "").trim().toLocaleLowerCase("es");
        const pendientes = historial.filter(pedido => {
            if (pedido.eliminado === true) return false;
            if (normalizar(pedido.comercio) !== normalizar(comercio.nombre)) return false;
            const estado = typeof estadoActualDelPedido === "function" ? estadoActualDelPedido(pedido) : "";
            return estado && !["entregado", "cancelado"].includes(estado);
        });
        const titulo = document.createElement("strong");
        titulo.textContent = pendientes.length ? "Para entregar acá" : "Sin pedidos para entregar acá";
        caja.appendChild(titulo);
        pendientes.slice(0, 4).forEach(pedido => {
            const fila = document.createElement("button");
            fila.type = "button";
            fila.className = "pedidoNavegacion";
            const unidades = Array.isArray(pedido.productos) ? pedido.productos.reduce((t, p) => t + (Number(p.cantidad) || 0), 0) : 0;
            fila.innerHTML = "<span></span><small></small>";
            fila.querySelector("span").textContent = "Pedido N° " + String(pedido.id || "").slice(-6).toUpperCase();
            fila.querySelector("small").textContent = unidades + (unidades === 1 ? " unidad" : " unidades");
            fila.addEventListener("click", () => {
                if (window.seguimientoVendeFrio?.abrirPedido?.(pedido.id)) cerrar();
            });
            caja.appendChild(fila);
        });
    }

    function dibujarParadas() {
        const caja = pantalla.querySelector(".hojaParadas");
        caja.innerHTML = "";
        if (paradas.length < 2) return;
        const titulo = document.createElement("strong");
        titulo.textContent = "Parada " + (indiceParada + 1) + " de " + paradas.length;
        caja.appendChild(titulo);
        const lista = document.createElement("ol");
        paradas.forEach((parada, indice) => {
            const item = document.createElement("li");
            item.textContent = parada.nombre;
            if (indice < indiceParada) item.className = "hecha";
            if (indice === indiceParada) item.className = "actual";
            lista.appendChild(item);
        });
        caja.appendChild(lista);
    }

    function avisar(texto) {
        pantalla.querySelector(".avisoNavegacion").textContent = texto || "";
    }

    // Cartel de arriba, tiempo y distancia, voz y si hay que recalcular.
    function actualizar(recienCalculado) {
        if (!pantalla || !camino || !posicion) return;
        const comercio = paradaActual();
        const proyeccion = proyectar(posicion);
        const recorrido = proyeccion ? proyeccion.recorrido : 0;
        const falta = Math.max(0, camino.distancia - recorrido);
        const restante = camino.distancia ? falta / camino.distancia : 0;
        const segundos = camino.duracion * restante;

        pantalla.querySelector(".tiempoNavegacion").textContent = llego ? "Llegaste" : textoMinutos(segundos);
        pantalla.querySelector(".detalleTiempo").textContent = llego
            ? "Estás en la puerta"
            : textoDistancia(falta) + " · llegada " + horaDeLlegada(segundos);

        // ¿Llegó?
        const alDestino = distancia(posicion, destinoDe(comercio));
        if (!llego && alDestino <= DISTANCIA_LLEGADA) {
            llego = true;
            pantalla.classList.add("llego");
            dibujarManiobra({ maniobra: { tipo: "arrive", lado: "" } }, 0);
            hablar("Llegaste a " + comercio.nombre);
            abrirHoja(true);
            actualizar(false);
            return;
        }
        if (llego) return;

        // ¿Se salió del camino? Recalcula (como mucho cada 12 segundos).
        if (proyeccion && proyeccion.lejos > DISTANCIA_FUERA && !camino.recto) {
            fueraDelCamino++;
            if (fueraDelCamino >= 2 && Date.now() - ultimoCalculo > ESPERA_RECALCULO) {
                avisar("Recalculando el camino…");
                hablar("Recalculando");
                calcularCamino();
                return;
            }
        } else {
            fueraDelCamino = 0;
            avisar(camino.recto ? "Sin camino por calles: va la línea recta. Revisá la señal." : "");
        }

        // Próxima maniobra.
        const proximo = camino.pasos.find((paso, indice) => indice > 0 && paso.metro > recorrido + 8);
        if (!proximo) {
            dibujarManiobra({ maniobra: { tipo: "arrive", lado: "" } }, falta);
            return;
        }
        const hasta = proximo.metro - recorrido;
        dibujarManiobra(proximo, hasta);

        // Voz: al empezar, a unos 200 m y justo antes de la maniobra.
        const clave = camino.pasos.indexOf(proximo);
        const dichos = pasosAnunciados.get(clave) || new Set();
        const texto = indicacion(proximo, comercio.nombre);
        if (recienCalculado && !dichos.has("inicio")) {
            dichos.add("inicio");
            hablar((hasta > 40 ? "En " + textoDistanciaHablada(hasta) + ", " : "") + texto.charAt(0).toLowerCase() + texto.slice(1));
        } else if (hasta <= 220 && hasta > 60 && !dichos.has("lejos")) {
            dichos.add("lejos");
            hablar("En " + textoDistanciaHablada(hasta) + ", " + texto.charAt(0).toLowerCase() + texto.slice(1));
        } else if (hasta <= 40 && !dichos.has("cerca")) {
            dichos.add("cerca");
            hablar(texto);
        }
        pasosAnunciados.set(clave, dichos);
    }

    function dibujarManiobra(paso, metros) {
        const comercio = paradaActual();
        pantalla.querySelector(".iconoManiobra").innerHTML = iconoManiobra(paso);
        pantalla.querySelector(".distanciaManiobra").textContent = paso.maniobra.tipo === "arrive" && llego ? "" : textoDistancia(metros);
        pantalla.querySelector(".textoManiobra").textContent = indicacion(paso, comercio ? comercio.nombre : "");
    }

    // -------------------------------------------------
    // GPS
    // -------------------------------------------------

    function alMoverse(lugar) {
        posicion = [lugar.coords.latitude, lugar.coords.longitude];
        if (!marcadorYo) {
            marcadorYo = L.circleMarker(posicion, { radius: 9, weight: 4, color: "#ffffff", fillColor: "#1F5FE0", fillOpacity: 1, className: "puntoYo" }).addTo(mapa);
        } else {
            marcadorYo.setLatLng(posicion);
        }
        if (!camino && !calculando) {
            calcularCamino();
            return;
        }
        if (seguir && mapa && camino && !llego) mapa.panTo(posicion, { animate: true });
        actualizar(false);
    }

    function sinGps(error) {
        // Quieto, el GPS a veces tarda en dar otra posición: no es un error.
        if (posicion && (!error || error.code !== 1)) return;
        avisar("Activá la ubicación del celular para ver por dónde ir. Mientras, podés abrirlo en Google Maps.");
        pantalla.querySelector(".tiempoNavegacion").textContent = "Sin GPS";
        pantalla.querySelector(".detalleTiempo").textContent = "Esperando tu ubicación";
        pantalla.querySelector(".textoManiobra").textContent = "Esperando tu ubicación";
        pantalla.querySelector(".distanciaManiobra").textContent = "";
    }

    function empezarGps() {
        if (!navigator.geolocation) {
            sinGps();
            return;
        }
        vigilancia = navigator.geolocation.watchPosition(alMoverse, sinGps, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
    }

    // -------------------------------------------------
    // Abrir, siguiente parada y cerrar
    // -------------------------------------------------

    function empezarParada() {
        const comercio = paradaActual();
        camino = null;
        llego = false;
        seguir = true;
        pasosAnunciados.clear();
        pantalla.classList.remove("llego");
        abrirHoja(false);
        avisar("");
        if (marcadorDestino) marcadorDestino.remove();
        marcadorDestino = L.marker(destinoDe(comercio), { icon: iconoDestino(), keyboard: false }).addTo(mapa);
        dibujarHoja();
        dibujarManiobra({ maniobra: { tipo: "depart", lado: "" }, calle: "" }, 0);
        pantalla.querySelector(".textoManiobra").textContent = "Buscando el camino…";
        pantalla.querySelector(".distanciaManiobra").textContent = "";
        pantalla.querySelector(".tiempoNavegacion").textContent = "…";
        pantalla.querySelector(".detalleTiempo").textContent = "Buscando tu ubicación";
        if (posicion) calcularCamino();
        else mapa.setView(destinoDe(comercio), 16);
    }

    function marcarLlegada() {
        const comercio = paradaActual();
        if (!comercio) return;
        if (typeof marcarVisitaManual === "function") marcarVisitaManual(comercio.nombre);
        if (navigator.vibrate) navigator.vibrate(30);
        if (indiceParada < paradas.length - 1) {
            indiceParada++;
            hablar("Vamos a " + paradaActual().nombre);
            empezarParada();
            return;
        }
        hablar(paradas.length > 1 ? "Terminaste el recorrido" : "");
        cerrar();
    }

    // Abre la navegación a uno o varios comercios (por nombre). Devuelve
    // false si no se puede (sin GPS guardado, sin mapa o con Google Maps
    // elegido): quien llama abre Google Maps como antes.
    function abrir(nombres) {
        const lista = (Array.isArray(nombres) ? nombres : [nombres])
            .map(nombre => (typeof buscarComercioPorNombre === "function" ? buscarComercioPorNombre(nombre) : null))
            .filter(tieneGps);
        if (!lista.length || usaGoogleMaps() || !window.mapaVendeFrio?.disponible?.()) return false;

        crearPantalla();
        paradas = lista;
        indiceParada = 0;
        document.querySelectorAll('body > section[id^="pantalla"]').forEach(seccion => {
            if (seccion !== pantalla && !seccion.classList.contains("oculto")) seccion.dataset.antesDeNavegar = "si";
        });
        pantalla.classList.remove("oculto");
        document.documentElement.classList.add("enNavegacion");
        dibujarBotonVoz();

        if (!mapa) {
            mapa = window.mapaVendeFrio.crearMapa(pantalla.querySelector("#mapaNavegacion"), { zoomControl: false, centro: destinoDe(lista[0]), zoom: 16 });
            mapa.on("dragstart", () => {
                seguir = false;
                pantalla.querySelector(".centrarNavegacion").classList.remove("oculto");
            });
        } else {
            mapa.invalidateSize();
        }
        empezarParada();
        empezarGps();
        // Pedir la pantalla prendida mientras se navega (si el celular deja).
        navigator.wakeLock?.request?.("screen").then(candado => { pantalla.candado = candado; }).catch(() => {});
        return true;
    }

    function cerrar() {
        if (!pantalla) return;
        if (vigilancia !== null && navigator.geolocation) navigator.geolocation.clearWatch(vigilancia);
        vigilancia = null;
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
        pantalla.candado?.release?.().catch(() => {});
        pantalla.candado = null;
        pantalla.classList.add("oculto");
        document.documentElement.classList.remove("enNavegacion");
        if (marcadorYo) { marcadorYo.remove(); marcadorYo = null; }
        if (capaCamino) { capaCamino.remove(); capaCamino = null; }
        camino = null;
        posicion = null;
        paradas = [];
    }

    function abierta() {
        return Boolean(pantalla && !pantalla.classList.contains("oculto"));
    }

    // "Ir" de Inicio, de la ficha del comercio y de Rutas: si se puede,
    // la navegación propia; si no, el enlace sigue a Google Maps.
    document.addEventListener("click", evento => {
        const enlace = evento.target.closest("[data-navegar-a]");
        if (!enlace) return;
        if (abrir(enlace.dataset.navegarA)) {
            evento.preventDefault();
            if (typeof window.cerrarFichaComercio === "function") window.cerrarFichaComercio();
        }
    }, true);

    window.navegacionVendeFrio = { abrir, cerrar, abierta, indicacion, siguiente: marcarLlegada };
}());
