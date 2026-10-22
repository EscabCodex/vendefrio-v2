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
    const DISTANCIA_LLEGANDO = 150;   // m: se agranda la hoja (T135)
    const DISTANCIA_FUERA = 35;       // m: te saliste del camino
    const ESPERA_RECALCULO = 5000;    // ms entre dos cálculos del camino
    const ADELANTO_GPS = 1.5;         // s: el GPS llega tarde; se adelanta según la velocidad

    let pantalla = null;
    let mapa = null;
    let capaCamino = null;
    let lineasCamino = [];       // borde blanco y línea azul (T132: se recortan al avanzar)
    let lineaHecha = null;       // lo ya hecho, gris punteado (T132)
    let metroRecortado = 0;
    let marcadorYo = null;
    let marcadorDestino = null;
    let vigilancia = null;
    let paradas = [];
    let indiceParada = 0;
    let posicion = null;
    let velocidad = 0;           // m/s, para adelantar el GPS y avisar antes
    let ultimaLectura = 0;
    let rumbo = null;            // grados (0 = norte) hacia donde vas
    let rumboDibujado = null;
    let camino = null;           // { puntos: [[lat,lng]], acumulado: [m], distancia, duracion, pasos: [] }
    let calculando = false;
    let ultimoCalculo = 0;
    let fueraDelCamino = 0;
    let seguir = true;
    let llego = false;
    let llegandoAvisado = false; // la hoja se agrandó sola en esta parada (T135)
    let desplazoHoja = 0;        // px: con la hoja abierta, tu posición va más arriba
    const pasosAnunciados = new Map();
    let proximaManiobra = -1;    // índice del paso que viene (para la voz)

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
        // De fábrica, en auto: el camino de bici usa veredas, pasajes y contramano.
        return PERFILES[elegido] ? elegido : "auto";
    }

    function conVoz() {
        return preferencias().voz !== "no";
    }

    function usaGoogleMaps() {
        return preferencias().navegador === "google";
    }

    // Más > Cómo hacés el recorrido (T50).
    function zoomPreferido() {
        const zoom = Number(preferencias().zoom);
        return [15, 17, 18].includes(zoom) ? zoom : 17;
    }

    function sigueSolo() {
        return preferencias().seguimiento !== false;
    }

    function velocidadVoz() {
        return { lenta: 0.85, rapida: 1.2 }[preferencias().velocidadVoz] || 1.02;
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

    // Para "Ya llego" (T72): los minutos que faltan según la navegación.
    let minutosQueFaltan = 0;

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
    // Primero busca cerca de donde ibas (no salta para atrás en una esquina
    // por donde el camino pasa dos veces); si no encuentra, busca en todo.
    let ultimoRecorrido = 0;
    function proyectar(punto) {
        if (!camino || camino.puntos.length < 2) return null;
        const cerca = proyectarEntre(punto, ultimoRecorrido - 40, ultimoRecorrido + 600);
        const resultado = cerca && cerca.lejos <= DISTANCIA_FUERA ? cerca : proyectarEntre(punto, -Infinity, Infinity);
        if (resultado && resultado.lejos <= DISTANCIA_FUERA) ultimoRecorrido = resultado.recorrido;
        return resultado;
    }

    function proyectarEntre(punto, desde, hasta) {
        const cosLat = Math.cos(punto[0] * Math.PI / 180);
        const metros = p => [p[0] * 111320, p[1] * 111320 * cosLat];
        const P = metros(punto);
        let mejor = { lejos: Infinity, recorrido: 0 };
        for (let i = 0; i < camino.puntos.length - 1; i++) {
            if (camino.acumulado[i + 1] < desde || camino.acumulado[i] > hasta) continue;
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
        return mejor.lejos === Infinity ? null : mejor;
    }

    function rumboEntre(a, b) {
        const rad = Math.PI / 180;
        const y = Math.sin((b[1] - a[1]) * rad) * Math.cos(b[0] * rad);
        const x = Math.cos(a[0] * rad) * Math.sin(b[0] * rad) - Math.sin(a[0] * rad) * Math.cos(b[0] * rad) * Math.cos((b[1] - a[1]) * rad);
        return (Math.atan2(y, x) / rad + 360) % 360;
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

    // Un solo formateador (T141): crearlo en cada posición del GPS es caro en
    // un celular barato.
    const formatoHora = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
    function horaDeLlegada(segundos) {
        return formatoHora.format(new Date(Date.now() + segundos * 1000));
    }

    // Cambia el texto solo si es otro: así cada posición del GPS no toca la
    // pantalla de más (T141).
    function ponerTexto(elemento, texto) {
        if (elemento && elemento.textContent !== texto) elemento.textContent = texto;
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

    // T131: las frases van en fila. La nueva espera a que termine la que se
    // está diciendo (antes la cortaba a la mitad); al llegarle el turno, si
    // ya no sirve (la maniobra pasó o hay una más nueva para la misma), se
    // descarta. Mientras se dice, se ve escrita en la tarjeta de arriba.
    // La frase queda guardada afuera: si no, el navegador a veces la tira a
    // la basura a mitad de camino y la voz se corta. Se prefiere una voz del
    // celular (no de internet), que con datos móviles se entrecorta.
    let fraseActual = null;
    const filaDeFrases = [];     // { texto, clave, vigente }
    const MAXIMO_EN_FILA = 3;
    let vigiaFrase = null;
    function vozElegida() {
        const voces = window.speechSynthesis.getVoices();
        const castellanas = voces.filter(v => /^es/i.test(v.lang));
        return castellanas.find(v => v.localService && /AR|419|US|MX/i.test(v.lang))
            || castellanas.find(v => v.localService)
            || castellanas.find(v => v.lang === "es-AR")
            || castellanas[0] || null;
    }

    // Pone una frase en la fila. "clave" junta las frases de una misma
    // maniobra: la nueva reemplaza a la que todavía esperaba. "vigente" dice
    // si sigue sirviendo cuando le toca.
    function hablar(texto, opciones = {}) {
        if (!conVoz() || !("speechSynthesis" in window) || !texto) return;
        if (fraseActual && fraseActual.text === texto) return;
        if (filaDeFrases.some(frase => frase.texto === texto)) return;
        if (opciones.clave !== undefined) {
            for (let i = filaDeFrases.length - 1; i >= 0; i--) {
                if (filaDeFrases[i].clave === opciones.clave) filaDeFrases.splice(i, 1);
            }
        }
        filaDeFrases.push({ texto, clave: opciones.clave, vigente: opciones.vigente || (() => true) });
        // Si se juntan muchas (GPS que salta), quedan las más nuevas.
        while (filaDeFrases.length > MAXIMO_EN_FILA) filaDeFrases.shift();
        if (!fraseActual) decirLaSiguiente();
    }

    function decirLaSiguiente() {
        clearTimeout(vigiaFrase);
        fraseActual = null;
        let siguiente = filaDeFrases.shift();
        while (siguiente && !siguiente.vigente()) siguiente = filaDeFrases.shift();
        if (!siguiente || !conVoz()) {
            filaDeFrases.length = 0;
            mostrarFrase("");
            return;
        }
        try {
            const sintesis = window.speechSynthesis;
            const frase = new SpeechSynthesisUtterance(siguiente.texto);
            const voz = vozElegida();
            frase.lang = voz ? voz.lang : "es-AR";
            if (voz) frase.voice = voz;
            frase.rate = velocidadVoz();
            const termino = () => {
                if (fraseActual !== frase) return;
                // Un respiro entre frase y frase (algunos celulares se traban
                // si se pide la próxima en el mismo instante).
                fraseActual = { text: frase.text };
                clearTimeout(vigiaFrase);
                vigiaFrase = setTimeout(decirLaSiguiente, 150);
            };
            frase.onend = frase.onerror = termino;
            fraseActual = frase;
            mostrarFrase(siguiente.texto);
            // Hay celulares que no avisan cuando terminan: pasado un tiempo
            // largo para esa frase, se sigue igual.
            vigiaFrase = setTimeout(termino, 3000 + siguiente.texto.length * 90 / frase.rate);
            if (sintesis.paused) sintesis.resume();
            sintesis.speak(frase);
        } catch (error) {
            // Sin voz en este celular: quedan las indicaciones en pantalla.
            filaDeFrases.length = 0;
            fraseActual = null;
            mostrarFrase("");
        }
    }

    // Se calla y se vacía la fila (al silenciar o al salir).
    function callar() {
        clearTimeout(vigiaFrase);
        filaDeFrases.length = 0;
        fraseActual = null;
        mostrarFrase("");
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    }

    // La frase que se está diciendo, escrita en la tarjeta de la maniobra.
    function mostrarFrase(texto) {
        const lugar = pantalla?.querySelector(".fraseManiobra");
        if (!lugar) return;
        if (lugar.textContent !== texto) lugar.textContent = texto;
        pantalla.querySelector(".vozManiobra").classList.toggle("oculto", !texto);
        acomodarPieManiobra();
    }

    // La franja de abajo de la tarjeta se ve solo si tiene algo (T134).
    function acomodarPieManiobra() {
        const pie = pantalla.querySelector(".pieManiobra");
        const vacio = !pantalla.querySelector(".fraseManiobra").textContent && !pantalla.querySelector(".luegoManiobra").textContent;
        if (pie.classList.contains("vacio") !== vacio) pie.classList.toggle("vacio", vacio);
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
            // Carriles (T134): solo donde el mapa los tiene cargados.
            const cruce = Array.isArray(paso.intersections) ? paso.intersections[0] : null;
            const carriles = cruce && Array.isArray(cruce.lanes) ? cruce.lanes.map(carril => ({
                sirve: carril.valid === true,
                hacia: Array.isArray(carril.indications) ? String(carril.indications[0] || "straight") : "straight"
            })) : [];
            pasos.push({
                lugar: [maniobra.location[1], maniobra.location[0]],
                calle: String(paso.name || "").trim(),
                maniobra: { tipo: String(maniobra.type || ""), lado: String(maniobra.modifier || ""), salida: Number(maniobra.exit) || 0 },
                carriles: carriles.length >= 2 && carriles.some(carril => carril.sirve) ? carriles : []
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
        ultimoRecorrido = 0;
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
        // T134 «Manejando»: arriba la barra del día y la tarjeta grande de la
        // maniobra (que nada tapa); abajo la tarjeta chica de la parada, con
        // la siguiente asomando; a los costados el velocímetro, la voz y salir.
        // Tocar la tarjeta de la parada abre la hoja con todos sus datos.
        pantalla.innerHTML = `
            <div class="mapaNavegacion" id="mapaNavegacion"></div>
            <div class="barraDiaNavegacion" role="img"></div>
            <div class="cartelManiobra" aria-live="polite">
                <div class="filaManiobra">
                    <span class="iconoManiobra"></span>
                    <div class="textosManiobra"><strong class="distanciaManiobra"></strong><span class="textoManiobra"></span></div>
                    <div class="carrilesManiobra oculto" role="img"></div>
                </div>
                <div class="pieManiobra vacio">
                    <span class="vozManiobra oculto">${window.icono("volumen", 16)}<p class="fraseManiobra" aria-hidden="true"></p></span>
                    <span class="luegoManiobra"></span>
                </div>
            </div>
            <div class="velocimetroNavegacion" aria-hidden="true"><strong>0</strong><small>km/h</small></div>
            <div class="botonesNavegacion">
                <button type="button" class="botonFlotanteNav vozNavegacion" aria-label="Voz"></button>
                <button type="button" class="botonFlotanteNav cerrarNavegacion" aria-label="Terminar navegación">${window.icono("cerrarX", 22)}</button>
            </div>
            <button type="button" class="botonFlotanteNav centrarNavegacion oculto" aria-label="Centrar en mi posición">${window.icono("mira", 22)}</button>
            <div class="paradasNavegacion">
                <button type="button" class="paradaActualNavegacion" aria-label="Ver más datos del comercio" aria-expanded="false">
                    <span class="datosTarjetaParada">
                        <small class="numeroTarjetaParada"></small>
                        <strong class="nombreTarjetaParada"></strong>
                        <span class="direccionTarjetaParada"></span>
                    </span>
                    <span class="tiempoTarjetaParada"><strong class="minutosTarjetaParada"></strong><small class="detalleTarjetaParada"></small></span>
                </button>
                <div class="siguienteParadaNavegacion" aria-hidden="true"><small>Después</small><strong></strong></div>
            </div>
            <div class="hojaNavegacion" role="region" aria-label="Datos del comercio">
                <div class="cabezaHoja">
                    <button type="button" class="botonChicoNav vozNavegacion" aria-label="Voz"></button>
                    <button type="button" class="asaHoja" aria-label="Ver más datos del comercio" aria-expanded="false"><span></span></button>
                    <button type="button" class="botonChicoNav cerrarNavegacion" aria-label="Terminar navegación">${window.icono("cerrarX", 20)}</button>
                </div>
                <div class="hojaResumen">
                    <div class="hojaComercio"><div class="hojaAvatar"></div><div><h2 class="nombreNavegacion"></h2><p class="direccionNavegacion"></p></div></div>
                    <div class="hojaTiempo"><strong class="tiempoNavegacion"></strong><small class="detalleTiempo"></small></div>
                    <div class="chipsHoja"></div>
                </div>
                <div class="hojaAcciones"></div>
                <div class="llegueHoja"></div>
                <div class="pieHoja">
                    <button type="button" class="botonPieHoja saltearNavegacion">Saltear parada</button>
                    <button type="button" class="botonPieHoja salirNavegacion">Salir</button>
                </div>
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
            const botones = pantalla.querySelector(".botonesNavegacion");
            botones.insertBefore(microfono, botones.querySelector(".cerrarNavegacion"));
        }
        // Voz y salir están flotando y, con la hoja abierta, arriba de la hoja.
        pantalla.querySelectorAll(".cerrarNavegacion").forEach(boton => boton.addEventListener("click", () => cerrar()));
        pantalla.querySelectorAll(".vozNavegacion").forEach(boton => boton.addEventListener("click", alternarVoz));
        pantalla.querySelector(".saltearNavegacion").addEventListener("click", saltearParada);
        pantalla.querySelector(".salirNavegacion").addEventListener("click", () => cerrar());
        pantalla.querySelector(".centrarNavegacion").addEventListener("click", () => {
            seguir = true;
            pantalla.querySelector(".centrarNavegacion").classList.add("oculto");
            if (posicion && mapa) mapa.setView(puntoParaCentrar(), Math.max(mapa.getZoom(), zoomPreferido()));
        });

        // La atribución del mapa (© OpenStreetMap) va siempre justo debajo de
        // la tarjeta de la maniobra, que cambia de alto con carriles y «Luego».
        const cartel = pantalla.querySelector(".cartelManiobra");
        if (window.ResizeObserver) {
            new ResizeObserver(() => {
                pantalla.style.setProperty("--bajoCartel", (cartel.offsetTop + cartel.offsetHeight) + "px");
            }).observe(cartel);
        }

        // La hoja: tocar la tarjeta de la parada o el asa, o deslizar para
        // arriba o abajo.
        const hoja = pantalla.querySelector(".hojaNavegacion");
        const asa = pantalla.querySelector(".asaHoja");
        asa.addEventListener("click", () => abrirHoja(!hoja.classList.contains("abierta")));
        pantalla.querySelector(".paradaActualNavegacion").addEventListener("click", () => abrirHoja(true));
        let inicioTarjeta = null;
        const tarjetas = pantalla.querySelector(".paradasNavegacion");
        tarjetas.addEventListener("pointerdown", evento => { inicioTarjeta = evento.clientY; });
        tarjetas.addEventListener("pointerup", evento => {
            if (inicioTarjeta !== null && inicioTarjeta - evento.clientY > 30) abrirHoja(true);
            inicioTarjeta = null;
        });
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
        pantalla.classList.toggle("conHojaAbierta", abierta);
        pantalla.querySelector(".asaHoja").setAttribute("aria-expanded", abierta ? "true" : "false");
        pantalla.querySelector(".paradaActualNavegacion").setAttribute("aria-expanded", abierta ? "true" : "false");
        // Con la hoja abierta, tu posición va en el pedazo de mapa que queda
        // entre la tarjeta de arriba y la hoja (T135). Se mide una vez, al
        // abrirla, y no con cada lectura del GPS.
        desplazoHoja = 0;
        if (!mapa) return;
        if (abierta) {
            // La hoja llega hasta «Salir» y asoma lo que sigue (pedidos y
            // paradas, deslizando la hoja): así queda mapa a la vista.
            const pie = hoja.querySelector(".pieHoja");
            hoja.style.maxHeight = "";
            const hasta = pie.offsetTop + pie.offsetHeight + 34;
            if (hasta < hoja.offsetHeight) hoja.style.maxHeight = hasta + "px";
            const arriba = pantalla.querySelector(".cartelManiobra").getBoundingClientRect().bottom;
            const abajo = hoja.getBoundingClientRect().top;
            if (abajo > arriba) desplazoHoja = Math.round(mapa.getSize().y / 2 - (arriba + abajo) / 2);
        }
        if (seguir && posicion) {
            mapa.stop();
            mapa.panTo(puntoParaCentrar(), { animate: false });
        }
    }

    // Dónde va el centro del mapa para que tu posición se vea.
    function puntoParaCentrar() {
        if (!desplazoHoja || !mapa) return posicion;
        return mapa.containerPointToLatLng(mapa.latLngToContainerPoint(posicion).add([0, desplazoHoja]));
    }

    function dibujarBotonVoz() {
        const prendida = conVoz();
        pantalla.querySelectorAll(".vozNavegacion").forEach(boton => {
            boton.innerHTML = window.icono(prendida ? "volumen" : "volumenNo", boton.classList.contains("botonChicoNav") ? 20 : 22);
            boton.setAttribute("aria-label", prendida ? "Silenciar la voz" : "Prender la voz");
            boton.classList.toggle("apagado", !prendida);
        });
    }

    function alternarVoz() {
        const datos = preferencias();
        datos.voz = conVoz() ? "no" : "si";
        try {
            localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify(datos));
        } catch (error) {
            // Sin lugar: el ajuste vale hasta cerrar.
        }
        if (!conVoz()) callar();
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
        lineasCamino = [
            L.polyline(camino.puntos, { className: "bordeCamino", color: "#0F3E9E", weight: 12, opacity: 1, lineCap: "round", lineJoin: "round", interactive: false }),
            L.polyline(camino.puntos, { className: "lineaCamino", color: "#1F5FE0", weight: 8, opacity: 1, lineCap: "round", lineJoin: "round", dashArray: camino.recto ? "2 10" : null, interactive: false })
        ];
        metroRecortado = 0;
        lineaHecha = L.polyline([], { className: "lineaHecha", color: "#9AA7B8", weight: 5, opacity: 0.9, lineCap: "round", lineJoin: "round", dashArray: "2 9", interactive: false });
        capaCamino = L.layerGroup([lineaHecha].concat(lineasCamino)).addTo(mapa);
        if ((seguir || !sigueSolo()) && camino.puntos.length > 1) {
            mapa.fitBounds(L.latLngBounds(camino.puntos), { paddingTopLeft: [30, 190], paddingBottomRight: [30, 140], maxZoom: zoomPreferido() });
        }
    }

    // T132: la línea azul arranca donde estás y lo ya hecho queda gris
    // punteado, como en la maqueta. Se recorta cada 5 m (no con cada lectura
    // del GPS) y solo si vas por el camino; la línea recta (sin camino por
    // calles) no se toca.
    function recortarCamino(recorrido) {
        if (!camino || camino.recto || lineasCamino.length === 0) return;
        if (Math.abs(recorrido - metroRecortado) < 5) return;
        metroRecortado = recorrido;
        const { puntos, acumulado } = camino;
        // El tramo donde caés: el último punto que ya pasaste.
        let bajo = 0;
        let alto = acumulado.length - 1;
        while (bajo < alto) {
            const medio = Math.ceil((bajo + alto) / 2);
            if (acumulado[medio] <= recorrido) bajo = medio;
            else alto = medio - 1;
        }
        const desde = puntos[bajo];
        const hasta = puntos[Math.min(bajo + 1, puntos.length - 1)];
        const largo = (acumulado[bajo + 1] ?? acumulado[bajo]) - acumulado[bajo];
        const t = largo > 0 ? Math.min(1, (recorrido - acumulado[bajo]) / largo) : 0;
        const aca = [desde[0] + (hasta[0] - desde[0]) * t, desde[1] + (hasta[1] - desde[1]) * t];
        const falta = [aca].concat(puntos.slice(bajo + 1));
        lineasCamino.forEach(linea => linea.setLatLngs(falta.length > 1 ? falta : [aca, aca]));
        if (lineaHecha) lineaHecha.setLatLngs(puntos.slice(0, bajo + 1).concat([aca]));
    }

    function dibujarHoja() {
        const comercio = paradaActual();
        if (!comercio) return;
        pantalla.querySelector(".nombreNavegacion").textContent = comercio.nombre;
        pantalla.querySelector(".direccionNavegacion").textContent = (comercio.direccion || "Sin dirección cargada") +
            (paradas.length > 1 ? " · parada " + (indiceParada + 1) + " de " + paradas.length : "");
        const avatar = pantalla.querySelector(".hojaAvatar");
        avatar.textContent = String(comercio.nombre || "?").trim().slice(0, 2).toUpperCase();
        if (typeof colorAvatar === "function") avatar.style.background = colorAvatar(comercio.nombre);
        const google = pantalla.querySelector(".abrirEnGoogle");
        google.href = enlaceGoogle(comercio);

        // Lo que hay para entregar y para cobrar acá (T135), si podés ver la plata.
        const pendientes = pedidosParaEntregar(comercio);
        dibujarChips(comercio, pendientes);

        // Accesos: llamar, WhatsApp, ya llego y cargar pedido.
        const acciones = pantalla.querySelector(".hojaAcciones");
        acciones.innerHTML = "";
        const acceso = (icono, texto, etiqueta) => {
            const elemento = document.createElement(etiqueta || "button");
            elemento.className = "accesoNavegacion";
            if (elemento.tagName === "BUTTON") elemento.type = "button";
            elemento.innerHTML = '<span class="accesoNavegacionIcono">' + window.icono(icono, 20) + "</span><small></small>";
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
        // "Ya llego" (T72): WhatsApp con el mensaje y los minutos que faltan.
        const yaLlego = window.yaLlegoVendeFrio ? window.yaLlegoVendeFrio.enlace(comercio, minutosQueFaltan) : "";
        if (yaLlego) {
            const enlace = acceso("whatsapp", "Ya llego", "a");
            enlace.classList.add("accesoYaLlego");
            enlace.href = yaLlego;
            enlace.target = "_blank";
            enlace.rel = "noopener";
            enlace.addEventListener("click", () => {
                enlace.href = window.yaLlegoVendeFrio.enlace(comercio, minutosQueFaltan);
            });
        }
        acceso("documento", "Cargar pedido").addEventListener("click", () => {
            const nombre = comercio.nombre;
            cerrar();
            if (typeof irAPedidoRapido === "function") irAPedidoRapido(nombre);
        });

        // "Llegué" se desliza, para no marcarlo sin querer manejando (T135).
        const llegue = pantalla.querySelector(".llegueHoja");
        llegue.innerHTML = "";
        if (typeof window.seguimientoVendeFrio?.crearDeslizador === "function") {
            llegue.appendChild(window.seguimientoVendeFrio.crearDeslizador("Deslizá para marcar Llegué", marcarLlegada));
        } else {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.className = "btnAccion llegueNavegacion";
            boton.textContent = "Llegué";
            boton.addEventListener("click", marcarLlegada);
            llegue.appendChild(boton);
        }
        pantalla.querySelector(".pieHoja").classList.toggle("unaSola", paradas.length < 2);

        dibujarPedidosPendientes(pendientes);
        dibujarParadas();
        dibujarTarjetasParada();
        dibujarBarraDelDia();
    }

    // Abajo, la tarjeta chica de la parada y la siguiente asomando (T134).
    function dibujarTarjetasParada() {
        const comercio = paradaActual();
        ponerTexto(pantalla.querySelector(".numeroTarjetaParada"), paradas.length > 1 ? "Parada " + (indiceParada + 1) + " de " + paradas.length : "Tu parada");
        ponerTexto(pantalla.querySelector(".nombreTarjetaParada"), comercio.nombre);
        ponerTexto(pantalla.querySelector(".direccionTarjetaParada"), comercio.direccion || "Sin dirección cargada");
        const siguiente = paradas[indiceParada + 1];
        const caja = pantalla.querySelector(".siguienteParadaNavegacion");
        caja.classList.toggle("oculto", !siguiente);
        pantalla.querySelector(".paradasNavegacion").classList.toggle("sinSiguiente", !siguiente);
        ponerTexto(caja.querySelector("strong"), siguiente ? siguiente.nombre : "");
    }

    // Arriba, una rayita por parada: verde las hechas y del color de la app
    // la que sigue. Con muchas paradas, una sola barra que se llena.
    function dibujarBarraDelDia() {
        const barra = pantalla.querySelector(".barraDiaNavegacion");
        barra.classList.toggle("oculto", paradas.length < 2);
        barra.setAttribute("aria-label", "Parada " + (indiceParada + 1) + " de " + paradas.length);
        barra.innerHTML = "";
        if (paradas.length < 2) return;
        if (paradas.length > 20) {
            const llena = document.createElement("span");
            llena.className = "rayaDia continua";
            llena.style.setProperty("--avance", (indiceParada / paradas.length * 100).toFixed(1) + "%");
            barra.appendChild(llena);
            return;
        }
        paradas.forEach((parada, indice) => {
            const raya = document.createElement("span");
            raya.className = "rayaDia" + (indice < indiceParada ? " hecha" : indice === indiceParada ? " actual" : "");
            barra.appendChild(raya);
        });
    }

    // Carriles: una flechita por carril; los que sirven, enteros (T134).
    const GIROS_CARRIL = { left: -90, "slight left": -45, "sharp left": -135, straight: 0, "slight right": 45, right: 90, "sharp right": 135, uturn: 180 };
    function dibujarCarriles(paso) {
        const caja = pantalla.querySelector(".carrilesManiobra");
        const carriles = paso && Array.isArray(paso.carriles) ? paso.carriles : [];
        const clave = carriles.map(carril => carril.hacia + (carril.sirve ? "+" : "-")).join(",");
        if (caja.dataset.clave === clave) return;
        caja.dataset.clave = clave;
        caja.classList.toggle("oculto", !carriles.length);
        caja.innerHTML = carriles.map(carril => '<svg viewBox="0 0 24 24" width="20" height="26" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' +
            (carril.sirve ? "" : ' opacity=".45"') + ' style="transform:rotate(' + (GIROS_CARRIL[carril.hacia] ?? 0) + 'deg)"><path d="M12 21V4"/><path d="m6 10 6-6 6 6"/></svg>').join("");
        const sirven = carriles.map((carril, indice) => carril.sirve ? indice + 1 : 0).filter(Boolean);
        caja.setAttribute("aria-label", carriles.length ? "Usá " + (sirven.length === 1 ? "el carril " + sirven[0] : "los carriles " + sirven.join(" y ")) + " de " + carriles.length : "");
    }

    // "Luego …": la maniobra que viene después de la próxima.
    function textoLuego(paso) {
        if (!paso) return "";
        if (paso.maniobra.tipo === "arrive") return "Luego llegás";
        const texto = indicacion(paso, "");
        return "Luego " + texto.charAt(0).toLowerCase() + texto.slice(1);
    }

    // Pedidos de este comercio que todavía no se entregaron (en la nube).
    function pedidosParaEntregar(comercio) {
        const historial = typeof obtenerHistorial === "function" ? obtenerHistorial() : [];
        const normalizar = texto => String(texto || "").trim().toLocaleLowerCase("es");
        return historial.filter(pedido => {
            if (pedido.eliminado === true) return false;
            if (normalizar(pedido.comercio) !== normalizar(comercio.nombre)) return false;
            const estado = typeof estadoActualDelPedido === "function" ? estadoActualDelPedido(pedido) : "";
            return estado && !["entregado", "cancelado"].includes(estado);
        });
    }

    // "Pedido $ …" y "Cobrar saldo $ …", solo si podés ver la plata.
    function dibujarChips(comercio, pendientes) {
        const caja = pantalla.querySelector(".chipsHoja");
        caja.innerHTML = "";
        if (window.verPlataVendeFrio && !window.verPlataVendeFrio.puedoVer()) return;
        const plata = valor => window.piezas?.plata ? window.piezas.plata(valor) : "$ " + Math.round(valor);
        const chip = (clase, texto) => {
            const elemento = document.createElement("span");
            elemento.className = "chipHoja " + clase;
            elemento.textContent = texto;
            caja.appendChild(elemento);
        };
        const total = typeof totalDelPedido === "function"
            ? pendientes.reduce((suma, pedido) => suma + (Number(totalDelPedido(pedido)?.total) || 0), 0) : 0;
        if (total > 0) chip("chipPedido", "Pedido " + plata(total));
        const saldo = Number(window.saldosVendeFrio?.cuentaDe?.(comercio.nombre)?.total) || 0;
        if (saldo > 0) chip("chipSaldo", "Cobrar saldo " + plata(saldo));
    }

    function dibujarPedidosPendientes(pendientes) {
        const caja = pantalla.querySelector(".hojaPedidos");
        caja.innerHTML = "";
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
        ponerTexto(pantalla.querySelector(".avisoNavegacion"), texto || "");
    }

    // Cartel de arriba, tiempo y distancia, voz y si hay que recalcular.
    function actualizar(recienCalculado) {
        if (!pantalla || !camino || !posicion) return;
        const comercio = paradaActual();
        const proyeccion = proyectar(posicion);
        // El GPS llega un poco tarde: se adelanta lo que avanzás en ese rato.
        const adelanto = proyeccion && proyeccion.lejos <= DISTANCIA_FUERA ? velocidad * ADELANTO_GPS : 0;
        const recorrido = proyeccion ? Math.min(camino.distancia, proyeccion.recorrido + adelanto) : 0;
        const falta = Math.max(0, camino.distancia - recorrido);
        if (proyeccion && proyeccion.lejos <= DISTANCIA_FUERA) recortarCamino(proyeccion.recorrido);
        const restante = camino.distancia ? falta / camino.distancia : 0;
        const segundos = camino.duracion * restante;
        minutosQueFaltan = segundos / 60;

        ponerTexto(pantalla.querySelector(".tiempoNavegacion"), llego ? "Llegaste" : textoMinutos(segundos));
        ponerTexto(pantalla.querySelector(".detalleTiempo"), llego
            ? "Estás en la puerta"
            : textoDistancia(falta) + " · llegada " + horaDeLlegada(segundos));
        ponerTexto(pantalla.querySelector(".minutosTarjetaParada"), llego ? "Llegaste" : textoMinutos(segundos));
        ponerTexto(pantalla.querySelector(".detalleTarjetaParada"), llego ? "En la puerta" : textoDistancia(falta) + " · " + horaDeLlegada(segundos));
        ponerTexto(pantalla.querySelector(".velocimetroNavegacion strong"), String(Math.round(velocidad * 3.6)));

        // ¿Llegó?
        const alDestino = distancia(posicion, destinoDe(comercio));
        if (!llego && alDestino <= DISTANCIA_LLEGADA) {
            llego = true;
            pantalla.classList.add("llego");
            pantalla.classList.remove("llegando");
            dibujarManiobra({ maniobra: { tipo: "arrive", lado: "" } }, 0);
            hablar("Llegaste a " + comercio.nombre);
            abrirHoja(true);
            actualizar(false);
            return;
        }
        if (llego) return;

        // ¿Se salió del camino? Recalcula (como mucho cada 5 segundos).
        if (proyeccion && proyeccion.lejos > DISTANCIA_FUERA && !camino.recto) {
            fueraDelCamino++;
            if (fueraDelCamino >= 2 && Date.now() - ultimoCalculo > ESPERA_RECALCULO) {
                avisar("Recalculando el camino…");
                hablar("Recalculando", { clave: "recalculando" });
                calcularCamino();
                return;
            }
        } else {
            fueraDelCamino = 0;
            avisar(camino.recto ? "Sin camino por calles: va la línea recta. Revisá la señal." : "");
        }

        // Próxima maniobra.
        const proximo = camino.pasos.find((paso, indice) => indice > 0 && paso.metro > recorrido + 8);

        // «Llegando» (T135): sin más giros y a menos de 150 m, la tarjeta de
        // arriba dice de qué lado queda y la hoja se agranda sola, una vez
        // por parada (si la cerrás, no vuelve). Por distancia y no al frenar,
        // para que no salte en cada semáforo.
        const llegando = (!proximo || proximo.maniobra.tipo === "arrive") && falta <= DISTANCIA_LLEGANDO;
        pantalla.classList.toggle("llegando", llegando);
        if (llegando) {
            const lado = ladoDeLlegada(proximo || camino.pasos[camino.pasos.length - 1]);
            dibujarManiobra({ maniobra: { tipo: "arrive", lado: "" } }, falta, null, {
                distancia: "Llegando · " + textoDistancia(falta),
                texto: lado ? "El comercio queda " + lado : "Llegás a " + comercio.nombre
            });
            if (!llegandoAvisado) {
                llegandoAvisado = true;
                const deEstaParada = comercio;
                hablar("Llegando a " + comercio.nombre + (lado ? ". Queda " + lado : ""),
                    { clave: "llegando", vigente: () => paradaActual() === deEstaParada && !llego });
                abrirHoja(true);
            }
            return;
        }
        if (!proximo) {
            dibujarManiobra({ maniobra: { tipo: "arrive", lado: "" } }, falta);
            return;
        }
        const hasta = proximo.metro - recorrido;
        dibujarManiobra(proximo, hasta, camino.pasos[camino.pasos.indexOf(proximo) + 1]);

        // Voz: al empezar, a unos 200 m y justo antes de la maniobra. Cada
        // frase sirve mientras esa siga siendo la próxima maniobra de este
        // camino; si no, se descarta sin decirla (T131).
        const clave = camino.pasos.indexOf(proximo);
        proximaManiobra = clave;
        const dichos = pasosAnunciados.get(clave) || new Set();
        const texto = indicacion(proximo, comercio.nombre);
        const deEsteCamino = camino;
        const voz = { clave: "maniobra" + clave, vigente: () => camino === deEsteCamino && proximaManiobra === clave && !llego };
        if (recienCalculado && !dichos.has("inicio")) {
            dichos.add("inicio");
            hablar((hasta > 40 ? "En " + textoDistanciaHablada(hasta) + ", " : "") + texto.charAt(0).toLowerCase() + texto.slice(1), voz);
        } else if (proximo.maniobra.tipo === "arrive") {
            // La llegada la avisa «Llegando» (T135).
        } else if (hasta <= Math.max(220, velocidad * 18) && hasta > Math.max(60, velocidad * 7) && !dichos.has("lejos")) {
            dichos.add("lejos");
            hablar("En " + textoDistanciaHablada(hasta) + ", " + texto.charAt(0).toLowerCase() + texto.slice(1), voz);
        } else if (hasta <= Math.max(40, velocidad * 5) && !dichos.has("cerca")) {
            dichos.add("cerca");
            hablar(texto, voz);
        }
        pasosAnunciados.set(clave, dichos);
    }

    // De qué lado de la calle queda el comercio, según el mapa.
    function ladoDeLlegada(paso) {
        const lado = paso && paso.maniobra ? paso.maniobra.lado : "";
        if (lado.includes("right")) return "a tu derecha";
        if (lado.includes("left")) return "a tu izquierda";
        return "";
    }

    // El dibujo de la flecha se cambia solo cuando cambia la maniobra.
    // "textos" reemplaza la distancia y la indicación («Llegando», T135).
    function dibujarManiobra(paso, metros, despues, textos) {
        const comercio = paradaActual();
        dibujarCarriles(paso);
        ponerTexto(pantalla.querySelector(".luegoManiobra"), textoLuego(despues));
        acomodarPieManiobra();
        const icono = pantalla.querySelector(".iconoManiobra");
        const flecha = iconoManiobra(paso);
        if (icono.dataset.flecha !== flecha) {
            icono.innerHTML = flecha;
            icono.dataset.flecha = flecha;
        }
        ponerTexto(pantalla.querySelector(".distanciaManiobra"), textos ? textos.distancia : paso.maniobra.tipo === "arrive" && llego ? "" : textoDistancia(metros));
        ponerTexto(pantalla.querySelector(".textoManiobra"), textos ? textos.texto : indicacion(paso, comercio ? comercio.nombre : ""));
    }

    // -------------------------------------------------
    // GPS
    // -------------------------------------------------

    function alMoverse(lugar) {
        const nueva = [lugar.coords.latitude, lugar.coords.longitude];
        // Velocidad en m/s: la del GPS, o la calculada entre dos posiciones.
        const ahora = lugar.timestamp || Date.now();
        if (Number.isFinite(lugar.coords.speed) && lugar.coords.speed >= 0) {
            velocidad = lugar.coords.speed;
        } else if (posicion && ultimaLectura && ahora > ultimaLectura) {
            velocidad = Math.min(40, distancia(posicion, nueva) / ((ahora - ultimaLectura) / 1000));
        }
        ultimaLectura = ahora;
        // Hacia dónde vas (T134): el rumbo del GPS o el de los últimos metros.
        if (Number.isFinite(lugar.coords.heading) && velocidad > 1) {
            rumbo = lugar.coords.heading;
        } else if (posicion && distancia(posicion, nueva) > 3) {
            rumbo = rumboEntre(posicion, nueva);
        }
        posicion = nueva;
        if (!marcadorYo) {
            marcadorYo = L.marker(posicion, {
                icon: L.divIcon({ className: "marcadorYoNav", html: '<span class="flechaYo"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 2 20 21 12 16.5 4 21z"/></svg></span>', iconSize: [44, 44], iconAnchor: [22, 22] }),
                interactive: false, keyboard: false, zIndexOffset: 1000
            }).addTo(mapa);
            rumboDibujado = null;
        } else {
            marcadorYo.setLatLng(posicion);
        }
        // La flecha gira solo si el rumbo cambió de verdad.
        if (rumbo !== null && (rumboDibujado === null || Math.abs(rumbo - rumboDibujado) > 4)) {
            const flecha = marcadorYo.getElement()?.querySelector(".flechaYo svg");
            if (flecha) flecha.style.transform = "rotate(" + Math.round(rumbo) + "deg)";
            rumboDibujado = rumbo;
        }
        if (!camino && !calculando) {
            calcularCamino();
            return;
        }
        // Mover el mapa por un par de metros no se nota y redibuja el camino
        // entero (T141): se mueve cuando el punto se corrió unos píxeles.
        if (seguir && mapa && camino && !llego) {
            const corrido = mapa.latLngToContainerPoint(posicion).distanceTo(mapa.getSize().divideBy(2).subtract([0, desplazoHoja]));
            if (corrido > 4) mapa.panTo(puntoParaCentrar(), { animate: velocidad < 8, duration: 0.4 });
        }
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
        vigilancia = navigator.geolocation.watchPosition(alMoverse, sinGps, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    }

    // -------------------------------------------------
    // Abrir, siguiente parada y cerrar
    // -------------------------------------------------

    function empezarParada() {
        const comercio = paradaActual();
        camino = null;
        llego = false;
        llegandoAvisado = false;
        seguir = sigueSolo();
        pantalla.querySelector(".centrarNavegacion")?.classList.toggle("oculto", seguir);
        pasosAnunciados.clear();
        pantalla.classList.remove("llego", "llegando");
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
        cerrar({ despedida: true });
    }

    // Saltear parada (T135): pasa a la que sigue sin marcar la visita. En
    // la última, termina.
    function saltearParada() {
        if (!paradaActual()) return;
        if (indiceParada < paradas.length - 1) {
            indiceParada++;
            hablar("Vamos a " + paradaActual().nombre);
            empezarParada();
            return;
        }
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
        if (preferencias().pantallaEncendida !== false) {
            navigator.wakeLock?.request?.("screen").then(candado => { pantalla.candado = candado; }).catch(() => {});
        }
        return true;
    }

    // Con { despedida: true } se deja terminar la última frase ("Terminaste
    // el recorrido"); si no, se calla enseguida.
    function cerrar(opciones) {
        if (!pantalla) return;
        if (vigilancia !== null && navigator.geolocation) navigator.geolocation.clearWatch(vigilancia);
        vigilancia = null;
        if (opciones && opciones.despedida === true) {
            filaDeFrases.splice(0, filaDeFrases.length - 1);
        } else {
            callar();
        }
        pantalla.candado?.release?.().catch(() => {});
        pantalla.candado = null;
        pantalla.classList.add("oculto");
        document.documentElement.classList.remove("enNavegacion");
        if (marcadorYo) { marcadorYo.remove(); marcadorYo = null; }
        rumbo = null;
        if (capaCamino) { capaCamino.remove(); capaCamino = null; }
        lineasCamino = [];
        lineaHecha = null;
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

    window.navegacionVendeFrio = { abrir, cerrar, abierta, indicacion, siguiente: marcarLlegada, saltear: saltearParada, paradaActual };
}());
