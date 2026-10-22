// =====================================================
// VendeFrío - equipoRuta.js
// El equipo en el mapa de Rutas y de la navegación (Bloque O, etapa 3).
// - T139 «Avisar»: navegando, el botón naranja (o la voz: «avisar calle
//   cortada») deja un aviso donde estás: calle cortada, control, tránsito
//   lento, pozo o calle rota, choque o comercio cerrado. Dura 2 horas y lo
//   ven todos los de la distribuidora en los dos mapas; si lo dejó otro, una
//   tarjeta lo cuenta («Lucas avisó: …»). Si una calle cortada o un choque
//   queda en tu camino, la navegación pide otro recorrido (navegacion.js).
//   En la nube: `avisosCalle/{id}`. Sin cuenta, o mientras las reglas de la
//   nube no lo dejen, queda en el celular (lo hace extras.js): cada uno ve
//   los suyos.
// - T140 Compañeros: quienes comparten su ubicación (repartidores.js, T73)
//   aparecen con su inicial en los dos mapas. Por ahora solo en el celular
//   del dueño, el único que puede leerlas.
// =====================================================

(function () {
    "use strict";

    const p = window.piezas;
    const extras = window.extrasVendeFrio;
    if (!p || !extras) return;

    const DURA = 2 * 3600000;          // ms: lo que dura un aviso
    const VIGENTE_UBICACION = 20 * 60000;
    const BLOQUEAN = ["cortada", "choque"];

    // Tipos de aviso, con el color y el dibujo de la maqueta (H-avisar).
    const TIPOS = {
        cortada: { texto: "Calle cortada", dicho: "calle cortada", color: "#D33A3A", d: "M5 12h14M4 8h16v8H4z" },
        control: { texto: "Control", dicho: "control", color: "#1F5FE0", d: "M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6z" },
        lento: { texto: "Tránsito lento", dicho: "tránsito lento", color: "#C2410C", d: "M3 13l2.2-6h13.6L21 13v5H3zM3 13h18" },
        pozo: { texto: "Pozo o calle rota", dicho: "pozo", color: "#8A5A2B", d: "M3 17h18M7 17c0-3 2-5 5-5s5 2 5 5" },
        choque: { texto: "Choque", dicho: "choque", color: "#7B4DDB", d: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" },
        cerrado: { texto: "Comercio cerrado", dicho: "comercio cerrado", color: "#56657A", d: "M3 9l1.5-5h15L21 9M4 9v11h16V9M9 20v-6h6v6" }
    };
    const ALERTA = "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z";

    function dibujo(d, tam, grosor) {
        return `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${grosor || 2.2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
    }

    extras.registrar("avisosCalle", {
        dias: 1,
        describir: aviso => ({ titulo: "Aviso de la calle", detalle: (TIPOS[aviso.tipo] || {}).texto || "" })
    });

    function yo() {
        return p.persona();
    }

    function esMio(aviso) {
        const persona = yo();
        return !aviso.idPersona || Boolean(persona && aviso.idPersona === persona.idPersona);
    }

    // Los avisos de las últimas 2 horas, el más nuevo primero.
    function vigentes() {
        const desde = Date.now() - DURA;
        return extras.lista("avisosCalle").filter(aviso => TIPOS[aviso.tipo] &&
            Number(aviso.horaCelular) >= desde &&
            Number.isFinite(Number(aviso.lat)) && Number.isFinite(Number(aviso.lng)));
    }

    // Para la navegación: los que cortan el camino.
    function bloqueos() {
        return vigentes().filter(aviso => BLOQUEAN.includes(aviso.tipo))
            .map(aviso => ({ ...aviso, lat: Number(aviso.lat), lng: Number(aviso.lng) }));
    }

    function haceCuanto(hora) {
        const minutos = Math.max(0, Math.round((Date.now() - Number(hora)) / 60000));
        if (minutos < 1) return "recién";
        if (minutos < 60) return "hace " + minutos + " min";
        return "hace " + Math.floor(minutos / 60) + " h " + (minutos % 60 ? (minutos % 60) + " min" : "");
    }

    function primerNombre(nombre) {
        return String(nombre || "").trim().split(/\s+/)[0] || "Alguien";
    }

    // «calle cortada en Mitre», «comercio cerrado: Kiosco Lili».
    function queDice(aviso) {
        const tipo = TIPOS[aviso.tipo];
        if (aviso.tipo === "cerrado" && aviso.comercio) return tipo.dicho + ": " + aviso.comercio;
        return tipo.dicho + (aviso.calle ? " en " + aviso.calle : "");
    }

    // -------------------------------------------------
    // Avisar
    // -------------------------------------------------

    function dondeEstoy() {
        const navegando = window.navegacionVendeFrio?.abierta?.() && window.navegacionVendeFrio.posicion?.();
        if (navegando) return Promise.resolve(navegando);
        return new Promise(resolver => {
            if (!navigator.geolocation) return resolver(null);
            navigator.geolocation.getCurrentPosition(
                lugar => resolver([lugar.coords.latitude, lugar.coords.longitude]),
                () => resolver(null),
                { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 });
        });
    }

    async function crear(tipo) {
        if (!TIPOS[tipo]) return false;
        const lugar = await dondeEstoy();
        if (!lugar) {
            mostrarToast("No se pudo saber dónde estás. Prendé la ubicación y probá de nuevo.");
            return false;
        }
        const persona = yo();
        const navegacion = window.navegacionVendeFrio;
        const parada = navegacion?.abierta?.() ? navegacion.paradaActual?.() : null;
        const datos = {
            tipo,
            lat: lugar[0],
            lng: lugar[1],
            nombre: String(persona && persona.nombre || window.empleadosVendeFrio?.quienSoy?.()?.nombre || "").slice(0, 60),
            idPersona: persona && persona.idPersona ? String(persona.idPersona) : "",
            calle: String(navegacion?.calle?.() || "").slice(0, 80),
            comercio: tipo === "cerrado" && parada ? String(parada.nombre || "").slice(0, 120) : "",
            horaCelular: Date.now()
        };
        extras.guardar("avisosCalle", datos);
        limpiarViejos();
        mostrarToast("Avisaste: " + TIPOS[tipo].texto.toLowerCase() + ". Lo ve el equipo por 2 horas.");
        return true;
    }

    // Los avisos propios que ya vencieron se borran (los de los demás, cada uno).
    function limpiarViejos() {
        const limite = Date.now() - DURA;
        extras.lista("avisosCalle").forEach(aviso => {
            if (esMio(aviso) && Number(aviso.horaCelular) < limite) extras.borrar("avisosCalle", aviso.id);
        });
    }

    function abrirAvisar() {
        const voz = window.vozVendeFrio?.disponible ? `<div class="vozAvisar">${p.ico("microfono", 22)}<span>O decilo con la voz: <em>«avisar calle cortada»</em></span></div>` : "";
        const caja = p.hoja({
            titulo: "¿Qué querés avisar?",
            sub: "Lo ven los repartidores de tu equipo durante 2 horas.",
            clase: "hojaAvisar",
            html: `<div class="tiposAvisar">${Object.entries(TIPOS).map(([clave, tipo]) => `
                <button type="button" class="tipoAvisar" data-avisar="${clave}">
                    <span class="circuloAvisar" style="background:${tipo.color}">${dibujo(tipo.d, 24)}</span>${p.esc(tipo.texto)}
                </button>`).join("")}</div>${voz}`,
            botones: [{ texto: "Cancelar", clase: "pzBtnGris" }]
        });
        caja.querySelectorAll("[data-avisar]").forEach(boton => boton.addEventListener("click", () => {
            p.cerrar();
            crear(boton.dataset.avisar);
        }));
        return caja;
    }

    // -------------------------------------------------
    // Compañeros (T140)
    // -------------------------------------------------

    // Por ahora solo el dueño lee las ubicaciones (reglas de T73, y quien
    // comparte acepta «con el dueño»). Que las vean también los compañeros
    // necesita reglas nuevas y otro texto al activar: lo decide el dueño.
    function companerosVigentes() {
        const persona = yo();
        if (!p.refNube() || !p.esDueno()) return [];
        return extras.lista("ubicaciones").filter(item => (!persona || item.id !== persona.idPersona) &&
            Date.now() - (Number(item.horaCelular) || 0) < VIGENTE_UBICACION &&
            Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)));
    }

    // -------------------------------------------------
    // Los mapas
    // -------------------------------------------------

    // Una capa por mapa; los marcadores se reusan (un celular barato no
    // redibuja todo con cada posición nueva).
    const capas = new Map();   // mapa -> { capa, marcadores: Map(clave -> marcador) }

    function capaDe(mapa) {
        if (!capas.has(mapa)) capas.set(mapa, { capa: L.layerGroup().addTo(mapa), marcadores: new Map() });
        return capas.get(mapa);
    }

    function iconoAviso(aviso) {
        const tipo = TIPOS[aviso.tipo];
        return L.divIcon({
            className: "pinAvisoCalle",
            html: `<span class="cabezaAvisoCalle" style="background:${tipo.color}">${dibujo(tipo.d, 20, 2.6)}</span>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
    }

    function iconoCompanero(item) {
        return L.divIcon({
            className: "pinCompanero",
            html: `<span class="cabezaCompanero">${p.esc(p.iniciales(item.nombre))}</span>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19]
        });
    }

    function dibujarEn(mapa) {
        if (!mapa || typeof L === "undefined") return;
        const { capa, marcadores } = capaDe(mapa);
        const quedan = new Set();
        vigentes().forEach(aviso => {
            const clave = "aviso:" + aviso.id;
            quedan.add(clave);
            if (marcadores.has(clave)) return;
            const quien = esMio(aviso) ? "Vos" : primerNombre(aviso.nombre);
            const marcador = L.marker([Number(aviso.lat), Number(aviso.lng)], {
                icon: iconoAviso(aviso), keyboard: false, zIndexOffset: 500,
                title: TIPOS[aviso.tipo].texto + " · avisó " + quien
            }).addTo(capa);
            marcador.on("click", () => abrirAviso(aviso.id));
            marcadores.set(clave, marcador);
        });
        companerosVigentes().forEach(item => {
            const clave = "companero:" + item.id;
            quedan.add(clave);
            const lugar = [Number(item.lat), Number(item.lng)];
            if (marcadores.has(clave)) {
                marcadores.get(clave).setLatLng(lugar);
                return;
            }
            marcadores.set(clave, L.marker(lugar, {
                icon: iconoCompanero(item), keyboard: false, interactive: false, zIndexOffset: 400,
                title: item.nombre + ", repartidor del equipo"
            }).addTo(capa));
        });
        marcadores.forEach((marcador, clave) => {
            if (quedan.has(clave)) return;
            marcador.remove();
            marcadores.delete(clave);
        });
    }

    function abrirAviso(id) {
        const aviso = vigentes().find(item => item.id === id);
        if (!aviso) return;
        const tipo = TIPOS[aviso.tipo];
        const puedeSacar = esMio(aviso) || p.esDueno();
        p.hoja({
            titulo: tipo.texto,
            sub: (esMio(aviso) ? "Avisaste vos" : primerNombre(aviso.nombre) + " avisó") + " · " + haceCuanto(aviso.horaCelular) +
                (aviso.calle ? " · en " + aviso.calle : "") + (aviso.comercio ? " · " + aviso.comercio : ""),
            etiqueta: "Aviso: " + tipo.texto,
            botones: [
                ...(puedeSacar ? [{ texto: "Ya no está: sacar el aviso", clase: "pzBtnSec", alTocar: () => {
                    extras.borrar("avisosCalle", aviso.id);
                    mostrarToast("Sacaste el aviso");
                } }] : []),
                { texto: "Cerrar", clase: "pzBtnGris" }
            ]
        });
    }

    // -------------------------------------------------
    // «Lucas avisó…»
    // -------------------------------------------------

    function ultimoDeOtro() {
        return vigentes().find(aviso => !esMio(aviso)) || null;
    }

    // En la vista previa de Rutas: el aviso del equipo más nuevo, arriba de
    // Iniciar.
    function dibujarAvisoRutas() {
        const hoja = document.querySelector("#pantallaRutas .hojaPlanRutas");
        if (!hoja) return;
        let cartel = hoja.querySelector(".avisoEquipoRutas");
        if (!cartel) {
            cartel = document.createElement("button");
            cartel.type = "button";
            cartel.className = "avisoEquipoRutas";
            cartel.addEventListener("click", () => cartel.dataset.id && abrirAviso(cartel.dataset.id));
            hoja.querySelector(".botonesPlanRutas")?.insertAdjacentElement("beforebegin", cartel);
        }
        const aviso = ultimoDeOtro();
        cartel.hidden = !aviso;
        if (!aviso) return;
        const otros = vigentes().filter(item => !esMio(item)).length - 1;
        cartel.dataset.id = aviso.id;
        const texto = primerNombre(aviso.nombre) + " avisó: " + queDice(aviso) + (otros > 0 ? " · y " + otros + " más" : "");
        if (cartel.dataset.texto !== texto) {
            cartel.dataset.texto = texto;
            cartel.innerHTML = dibujo(ALERTA, 16, 2.4) + `<span>${p.esc(texto)}</span>`;
        }
    }

    // Navegando: tarjeta debajo de la maniobra, unos segundos.
    let pantallaNav = null;
    let esperaTarjeta = null;
    const contados = new Set();

    function mostrarTarjeta(aviso, texto) {
        if (!pantallaNav) return;
        let tarjeta = pantallaNav.querySelector(".tarjetaEquipoNav");
        if (!tarjeta) {
            tarjeta = document.createElement("button");
            tarjeta.type = "button";
            tarjeta.className = "tarjetaEquipoNav oculto";
            tarjeta.setAttribute("aria-live", "polite");
            tarjeta.addEventListener("click", () => tarjeta.classList.add("oculto"));
            pantallaNav.appendChild(tarjeta);
        }
        tarjeta.innerHTML = `<span class="inicialEquipoNav">${p.esc(p.iniciales(aviso.nombre || "?"))}</span>
            <span class="textoEquipoNav"><b>${p.esc(primerNombre(aviso.nombre))} avisó:</b> ${p.esc(texto)}</span>`;
        tarjeta.classList.remove("oculto");
        clearTimeout(esperaTarjeta);
        esperaTarjeta = setTimeout(() => tarjeta.classList.add("oculto"), 15000);
    }

    // La navegación encontró un aviso en el camino al calcularlo.
    function alDesviar(desvio) {
        const aviso = desvio && desvio.aviso;
        if (!aviso || esMio(aviso) || contados.has(aviso.id + (desvio.otro ? ":otro" : ""))) return;
        contados.add(aviso.id);
        contados.add(aviso.id + (desvio.otro ? ":otro" : ""));
        const minutos = Math.round((Number(desvio.extra) || 0) / 60);
        const texto = desvio.otro
            ? queDice(aviso) + ". Te desvié" + (minutos > 0 ? ", +" + minutos + " min." : ".")
            : queDice(aviso) + ". No hay otro camino: pasá con cuidado.";
        mostrarTarjeta(aviso, texto);
        window.navegacionVendeFrio?.hablar?.(primerNombre(aviso.nombre) + " avisó " + TIPOS[aviso.tipo].dicho +
            (desvio.otro ? ". Te llevo por otro camino" : " en tu camino. Pasá con cuidado"), { clave: "avisoEquipo" });
    }

    // Llegó un aviso nuevo mientras navegás: si queda en el camino, se
    // cuenta y, si corta el paso, se recalcula.
    function revisarCamino() {
        const navegacion = window.navegacionVendeFrio;
        if (!pantallaNav || !navegacion?.abierta?.()) return;
        vigentes().forEach(aviso => {
            if (esMio(aviso) || contados.has(aviso.id) || !navegacion.pasaCerca?.(aviso.lat, aviso.lng)) return;
            if (BLOQUEAN.includes(aviso.tipo)) {
                navegacion.recalcular?.();
                return;
            }
            contados.add(aviso.id);
            mostrarTarjeta(aviso, queDice(aviso) + ", en tu camino.");
            navegacion.hablar?.("Ojo: " + primerNombre(aviso.nombre) + " avisó " + TIPOS[aviso.tipo].dicho + " en tu camino", { clave: "avisoEquipo" });
        });
    }

    // -------------------------------------------------
    // Cuándo se dibuja
    // -------------------------------------------------

    function mapaRutas() {
        const pantalla = document.getElementById("pantallaRutas");
        if (!pantalla || pantalla.classList.contains("oculto")) return null;
        return typeof mapaLeaflet !== "undefined" ? mapaLeaflet : null;
    }

    let mapaNav = null;

    function dibujarTodo() {
        const enRutas = mapaRutas();
        if (enRutas) {
            dibujarEn(enRutas);
            dibujarAvisoRutas();
        }
        if (mapaNav && pantallaNav && !pantallaNav.classList.contains("oculto")) {
            dibujarEn(mapaNav);
            revisarCamino();
        }
    }

    function alAbrirRutas() {
        dibujarTodo();
    }

    function alAbrirNavegacion(mapa, pantalla) {
        mapaNav = mapa;
        pantallaNav = pantalla;
        contados.clear();
        if (!pantalla.querySelector(".avisarNavegacion")) {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.className = "avisarNavegacion";
            boton.setAttribute("aria-label", "Avisar al equipo");
            boton.innerHTML = dibujo(ALERTA, 24, 2.4) + "<span>Avisar</span>";
            boton.addEventListener("click", abrirAvisar);
            pantalla.appendChild(boton);
        }
        // Lo que ya estaba en el camino al salir lo cuenta el primer cálculo.
        setTimeout(dibujarTodo, 0);
    }

    function alCerrarNavegacion() {
        pantallaNav?.querySelector(".tarjetaEquipoNav")?.classList.add("oculto");
        pantallaNav = null;
    }

    if (typeof window.inicializarPantallaRutas === "function") {
        const original = window.inicializarPantallaRutas;
        window.inicializarPantallaRutas = function () {
            const resultado = original.apply(this, arguments);
            try { alAbrirRutas(); } catch (error) { console.error("Falló el equipo en Rutas.", error); }
            return resultado;
        };
    }
    extras.escuchar("avisosCalle", () => {
        try { dibujarTodo(); } catch (error) { console.error(error); }
    });
    extras.escuchar("ubicaciones", () => {
        try { dibujarTodo(); } catch (error) { console.error(error); }
    });
    // Los avisos vencen y los compañeros que dejan de compartir se van.
    setInterval(() => {
        try { dibujarTodo(); } catch (error) { /* nada */ }
    }, 60000);

    window.avisosCalleVendeFrio = { crear, abrirAvisar, vigentes, bloqueos, alDesviar, tipos: TIPOS };
    window.equipoRutaVendeFrio = { alAbrirNavegacion, alCerrarNavegacion, companeros: companerosVigentes, dibujar: dibujarTodo };
}());
