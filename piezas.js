// =====================================================
// VendeFrío - piezas.js (Etapa 7, ideas para la 1.0)
// Ayudas que comparten las ideas nuevas: pantallas, hojas que suben desde
// abajo, ventanas de "¿Seguro?", el aviso con "Deshacer", los avisos de
// Inicio y formatos de plata y fechas. Las clases están en piezas.css.
// =====================================================
(function () {
    const ico = (nombre, tam) => '<span class="pzIco">' + (window.icono ? window.icono(nombre, tam || 20) : "") + "</span>";

    function esc(texto) {
        return String(texto == null ? "" : texto)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function plata(valor) {
        const numero = Math.round((Number(valor) || 0) * 100) / 100;
        const signo = numero < 0 ? "- " : "";
        return signo + "$ " + Math.abs(numero).toLocaleString("es-AR", { maximumFractionDigits: 2 });
    }

    function hora(fecha) {
        const d = fecha instanceof Date ? fecha : new Date(Number(fecha) || fecha);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
    }

    function fechaCorta(fecha) {
        const d = fecha instanceof Date ? fecha : new Date(Number(fecha) || fecha);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" }).replace(".", "");
    }

    function inicialesDe(texto) {
        if (typeof window.iniciales === "function") return window.iniciales(texto);
        const partes = String(texto || "").trim().split(/\s+/).filter(Boolean);
        return ((partes[0] || "?")[0] + (partes[1] ? partes[1][0] : "")).toUpperCase();
    }

    // Color de las iniciales (1, 2 o 3), siempre el mismo para el mismo nombre.
    function colorIni(texto) {
        let suma = 0;
        String(texto || "").split("").forEach(letra => { suma += letra.charCodeAt(0); });
        return "pzIni" + ((suma % 3) + 1);
    }

    function lsLeer(clave, valor) {
        try {
            const guardado = localStorage.getItem(clave);
            return guardado === null ? valor : JSON.parse(guardado);
        } catch (error) {
            return valor;
        }
    }

    function lsGuardar(clave, valor) {
        try {
            localStorage.setItem(clave, JSON.stringify(valor));
            return true;
        } catch (error) {
            console.warn("No se pudo guardar " + clave, error);
            return false;
        }
    }

    // ---------- Pantallas ----------
    // Crea (una sola vez) una pantalla como las demás: encabezado con ícono,
    // título y subtítulo, y un <main> para el contenido. "volverA" es "menu",
    // "mas" o una función.
    const alVolver = {};

    function pantalla(id, { titulo, sub = "", icono = "", volverA = "menu", accion = null } = {}) {
        let seccion = document.getElementById(id);
        if (!seccion) {
            seccion = document.createElement("section");
            seccion.id = id;
            seccion.className = "oculto pantallaExtra pzPantalla";
            seccion.innerHTML = `
                <header>
                    <div class="logo">${icono ? ico(icono, 22) : ""}</div>
                    <div><h1></h1><p></p></div>
                </header>
                <main class="container"></main>`;
            document.body.insertBefore(seccion, document.querySelector("nav.bottom-nav"));
        }
        seccion.querySelector(":scope > header h1").textContent = titulo || "";
        seccion.querySelector(":scope > header p").textContent = sub;
        if (typeof volverA === "function") {
            alVolver[id] = volverA;
            seccion.dataset.volverA = "propio";
        } else {
            delete alVolver[id];
            seccion.dataset.volverA = volverA;
        }
        let botonAccion = seccion.querySelector(":scope > .pzCabAccion");
        if (accion) {
            if (!botonAccion) {
                botonAccion = document.createElement("button");
                botonAccion.type = "button";
                botonAccion.className = "pzCabAccion";
                seccion.appendChild(botonAccion);
            }
            botonAccion.innerHTML = ico(accion.icono, 20);
            botonAccion.setAttribute("aria-label", accion.nombre);
            botonAccion.title = accion.nombre;
            botonAccion.onclick = accion.alTocar;
        } else if (botonAccion) {
            botonAccion.remove();
        }
        return seccion;
    }

    function mostrar(seccion) {
        document.querySelectorAll('body > section[id^="pantalla"]').forEach(otra => otra.classList.add("oculto"));
        seccion.classList.remove("oculto");
        document.querySelectorAll(".nav-item").forEach(boton => boton.classList.remove("activo"));
        window.scrollTo(0, 0);
        pedirAcomodarCabeceras();
    }

    function volverDesde(seccion) {
        const funcion = seccion && alVolver[seccion.id];
        if (funcion) {
            funcion();
            return true;
        }
        return false;
    }

    // ---------- Hojas y ventanas ----------
    let abierta = null;

    function cerrar() {
        if (!abierta) return;
        const fondo = abierta;
        abierta = null;
        fondo.classList.remove("visible");
        setTimeout(() => fondo.remove(), 200);
        document.removeEventListener("keydown", alApretarTecla);
    }

    function alApretarTecla(evento) {
        if (evento.key === "Escape") cerrar();
    }

    function abrirFondo(fondo, contenido, alCerrarFuera) {
        cerrar();
        document.body.appendChild(fondo);
        abierta = fondo;
        fondo.addEventListener("click", evento => {
            if (evento.target === fondo) {
                if (typeof alCerrarFuera === "function") alCerrarFuera();
                cerrar();
            }
        });
        document.addEventListener("keydown", alApretarTecla);
        requestAnimationFrame(() => fondo.classList.add("visible"));
        const primero = contenido.querySelector("[autofocus]");
        if (primero) setTimeout(() => primero.focus(), 220);
    }

    // hoja({ titulo, sub, html, botones: [{texto, clase, icono, alTocar, cerrar}] })
    // Devuelve el elemento de la hoja para leer sus campos.
    function hoja({ titulo = "", sub = "", html = "", botones = [], clase = "", etiqueta = "" } = {}) {
        const fondo = document.createElement("div");
        fondo.className = "pzFondo";
        const caja = document.createElement("div");
        caja.className = "pzHoja " + clase;
        caja.setAttribute("role", "dialog");
        caja.setAttribute("aria-modal", "true");
        caja.setAttribute("aria-label", etiqueta || titulo);
        caja.innerHTML = `<div class="pzAsa"></div>
            ${titulo ? `<h2 class="pzHojaTit">${esc(titulo)}</h2>` : ""}
            ${sub ? `<p class="pzHojaSub">${esc(sub)}</p>` : ""}
            <div class="pzHojaCuerpo">${html}</div>`;
        agregarBotones(caja, botones);
        fondo.appendChild(caja);
        abrirFondo(fondo, caja);
        return caja;
    }

    function agregarBotones(caja, botones) {
        if (!botones.length) return;
        const contenedor = botones.length === 2 && botones.every(boton => boton.par) ? document.createElement("div") : null;
        if (contenedor) contenedor.className = "pzBotones";
        botones.forEach(datos => {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.className = "pzBtn " + (datos.clase || "pzBtnPri");
            boton.innerHTML = (datos.icono ? ico(datos.icono, 18) : "") + esc(datos.texto);
            if (datos.id) boton.id = datos.id;
            boton.addEventListener("click", async () => {
                let seguir = true;
                if (typeof datos.alTocar === "function") seguir = (await datos.alTocar(caja, boton)) !== false;
                if (seguir && datos.cerrar !== false) cerrar();
            });
            (contenedor || caja).appendChild(boton);
        });
        if (contenedor) caja.appendChild(contenedor);
    }

    // modal({ icono, color: "aviso"|"ok"|"pri"|"peligro", titulo, texto, html, botones })
    function modal({ icono = "alerta", color = "aviso", titulo = "", texto = "", html = "", botones = [] } = {}) {
        const fondo = document.createElement("div");
        fondo.className = "pzFondo pzFondoCentro";
        const caja = document.createElement("div");
        caja.className = "pzModal";
        caja.setAttribute("role", "alertdialog");
        caja.setAttribute("aria-modal", "true");
        caja.setAttribute("aria-label", titulo);
        caja.innerHTML = `<div class="pzIconoGrande pzIcono${color[0].toUpperCase() + color.slice(1)}">${ico(icono, 28)}</div>
            <h3>${esc(titulo)}</h3>${texto ? `<p>${esc(texto)}</p>` : ""}${html}`;
        agregarBotones(caja, botones.map(boton => ({ par: true, ...boton })));
        fondo.appendChild(caja);
        abrirFondo(fondo, caja);
        return caja;
    }

    // Pregunta y devuelve una promesa con true (sí) o false (no).
    function preguntar({ icono, color, titulo, texto, si = "Sí", no = "Cancelar", claseSi = "pzBtnPri", html = "" }) {
        return new Promise(resolver => {
            let respondida = false;
            const responder = valor => {
                if (respondida) return;
                respondida = true;
                resolver(valor);
            };
            const caja = modal({
                icono, color, titulo, texto, html,
                botones: [
                    { texto: no, clase: "pzBtnGris", alTocar: () => responder(false) },
                    { texto: si, clase: claseSi, alTocar: () => responder(true) }
                ]
            });
            const fondo = caja.parentElement;
            fondo.addEventListener("click", evento => {
                if (evento.target === fondo) responder(false);
            });
        });
    }

    // ---------- Lo último que se abre queda arriba ----------
    // Cada hoja o ventana tiene su altura (z-index) en el CSS, y entre dos de
    // la misma altura ganaba la que se creó después: la de "una o dos copias"
    // del ticket salía debajo de la ficha del pedido. Ahora la que se abre
    // sube por encima de las que ya estaban abiertas, en toda la app.
    const CAPAS = ".modal, .pzFondo, .modalCatalogo, .pzEscanear";
    const capasAbiertas = new WeakMap();

    function capaAbierta(capa) {
        return capa.isConnected && !capa.hidden && !capa.classList.contains("oculto");
    }

    function alturaDe(capa) {
        return Number(getComputedStyle(capa).zIndex) || 0;
    }

    function subirCapa(capa) {
        capa.style.removeProperty("z-index");
        let encima = 0;
        for (const otra of document.body.children) {
            if (otra !== capa && otra.matches(CAPAS) && capaAbierta(otra)) encima = Math.max(encima, alturaDe(otra));
        }
        if (encima && encima >= alturaDe(capa)) capa.style.setProperty("z-index", String(encima + 1), "important");
    }

    function revisarCapa(capa) {
        const abiertaAhora = capaAbierta(capa);
        if (abiertaAhora && !capasAbiertas.get(capa)) subirCapa(capa);
        capasAbiertas.set(capa, abiertaAhora);
    }

    // Se mira solo la clase de cada ventana (no todo lo de adentro), así no
    // cuesta nada mientras la app se usa.
    const vigiaCapas = new MutationObserver(cambios => {
        new Set(cambios.map(cambio => cambio.target)).forEach(revisarCapa);
    });

    function vigilarCapa(capa) {
        if (!capasAbiertas.has(capa)) vigiaCapas.observe(capa, { attributes: true, attributeFilter: ["class", "hidden"] });
        capasAbiertas.set(capa, false);
        revisarCapa(capa);
    }

    new MutationObserver(cambios => {
        cambios.forEach(cambio => {
            cambio.addedNodes.forEach(nodo => {
                if (nodo.nodeType === 1 && nodo.matches(CAPAS)) vigilarCapa(nodo);
            });
        });
    }).observe(document.body, { childList: true });
    [...document.body.children].forEach(nodo => {
        if (nodo.matches(CAPAS)) vigilarCapa(nodo);
    });

    // ---------- "Deshacer" ----------
    let deshacerActual = null;

    function deshacer(texto, alDeshacer, segundos = 6) {
        if (deshacerActual) deshacerActual.quitar();
        const caja = document.createElement("div");
        caja.className = "pzDeshacer";
        caja.setAttribute("role", "status");
        caja.innerHTML = `<span>${esc(texto)}</span><button type="button">${ico("deshacer", 16)}Deshacer</button>`;
        document.body.appendChild(caja);
        requestAnimationFrame(() => caja.classList.add("visible"));
        const actual = {
            quitar() {
                clearTimeout(reloj);
                caja.classList.remove("visible");
                setTimeout(() => caja.remove(), 200);
                if (deshacerActual === actual) deshacerActual = null;
            }
        };
        const reloj = setTimeout(actual.quitar, segundos * 1000);
        caja.querySelector("button").addEventListener("click", () => {
            actual.quitar();
            alDeshacer();
        });
        deshacerActual = actual;
        return actual;
    }

    // ---------- Avisos de Inicio ----------
    // Lugar: "arriba" (antes del resumen de hoy) o "abajo" (después de la
    // próxima parada). Con datos = null se saca.
    function avisoInicio(id, datos, lugar = "arriba") {
        let aviso = document.getElementById(id);
        if (!datos) {
            aviso?.remove();
            return null;
        }
        const contenedor = document.querySelector("#pantallaMenu main.container");
        if (!contenedor) return null;
        const conBoton = Boolean(datos.boton);
        if (!aviso || aviso.tagName !== (conBoton ? "DIV" : "BUTTON")) {
            aviso?.remove();
            aviso = document.createElement(conBoton ? "div" : "button");
            if (!conBoton) aviso.type = "button";
            aviso.id = id;
        }
        aviso.className = "pzBanner pzBan" + (datos.color || "Pri");
        aviso.innerHTML = `${ico(datos.icono || "info", 22)}<div><strong>${esc(datos.titulo)}</strong>${datos.texto || datos.destacado ? `<small>${esc(datos.texto || "")}${datos.destacado ? `${datos.texto ? " " : ""}<b class="pzDestacado">${esc(datos.destacado)}</b>` : ""}</small>` : ""}</div>` +
            (conBoton ? `<button type="button" class="pzBtn ${datos.claseBoton || "pzBtnPri"}">${esc(datos.boton)}</button>` : ico("chevDerecha", 20));
        const tocar = conBoton ? aviso.querySelector("button") : aviso;
        tocar.onclick = datos.alTocar || null;
        if (datos.etiqueta) tocar.setAttribute("aria-label", datos.etiqueta);

        const ancla = lugar === "arriba"
            ? contenedor.firstElementChild
            : (document.getElementById("dashProximaParada")?.nextElementSibling || null);
        const orden = Number(datos.orden) || 0;
        aviso.dataset.orden = String(orden);
        if (aviso.parentElement !== contenedor || aviso.dataset.lugar !== lugar) {
            aviso.dataset.lugar = lugar;
            contenedor.insertBefore(aviso, ancla);
        }
        // Los avisos del mismo lugar quedan en su orden.
        const hermanos = [...contenedor.querySelectorAll(`:scope > .pzBanner[data-lugar="${lugar}"]`)];
        hermanos.sort((a, b) => Number(a.dataset.orden) - Number(b.dataset.orden));
        hermanos.forEach((hermano, indice) => {
            if (indice > 0 && hermanos[indice - 1].nextElementSibling !== hermano) {
                hermanos[indice - 1].after(hermano);
            }
        });
        return aviso;
    }

    // ---------- Errores recientes (T62) ----------
    // Se guardan los últimos para adjuntarlos a "Informar un problema".
    const CLAVE_ERRORES = "vendefrio_errores_recientes";
    const MAXIMO_ERRORES = 15;

    function anotarError(texto) {
        const limpio = String(texto || "").replace(/\s+/g, " ").trim().slice(0, 300);
        if (!limpio) return;
        const lista = lsLeer(CLAVE_ERRORES, []);
        const errores = Array.isArray(lista) ? lista : [];
        errores.unshift({ hora: Date.now(), texto: limpio });
        lsGuardar(CLAVE_ERRORES, errores.slice(0, MAXIMO_ERRORES));
    }

    function erroresRecientes(desde = 0) {
        const lista = lsLeer(CLAVE_ERRORES, []);
        return (Array.isArray(lista) ? lista : []).filter(error => error && Number(error.hora) >= desde);
    }

    window.addEventListener("error", evento => anotarError(evento.message || "Error"));
    window.addEventListener("unhandledrejection", evento => anotarError("Promesa: " + (evento.reason?.message || evento.reason || "")));
    const errorOriginal = console.error;
    console.error = function () {
        try {
            anotarError(Array.from(arguments).map(parte => parte instanceof Error ? parte.message : typeof parte === "string" ? parte : "").join(" "));
        } catch (error) { /* nada */ }
        return errorOriginal.apply(console, arguments);
    };

    // ---------- Fotos ----------
    // Achica una foto (archivo de la cámara o la galería) a JPEG, para que
    // entre en un documento de la nube.
    function comprimirImagen(archivo, { lado = 1280, calidad = 0.72, largoMaximo = 600000 } = {}) {
        return new Promise((resolver, rechazar) => {
            const lector = new FileReader();
            lector.onerror = () => rechazar(new Error("No se pudo leer la foto."));
            lector.onload = () => {
                const imagen = new Image();
                imagen.onerror = () => rechazar(new Error("No se pudo abrir la foto."));
                imagen.onload = () => {
                    let ancho = imagen.naturalWidth || imagen.width;
                    let alto = imagen.naturalHeight || imagen.height;
                    let tope = lado;
                    let q = calidad;
                    for (let intento = 0; intento < 6; intento++) {
                        const escala = Math.min(1, tope / Math.max(ancho, alto));
                        const lienzo = document.createElement("canvas");
                        lienzo.width = Math.max(1, Math.round(ancho * escala));
                        lienzo.height = Math.max(1, Math.round(alto * escala));
                        lienzo.getContext("2d").drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
                        const datos = lienzo.toDataURL("image/jpeg", q);
                        if (datos.length <= largoMaximo) {
                            resolver(datos);
                            return;
                        }
                        tope = Math.round(tope * 0.75);
                        q = Math.max(0.5, q - 0.06);
                    }
                    rechazar(new Error("La foto es muy pesada."));
                };
                imagen.src = lector.result;
            };
            lector.readAsDataURL(archivo);
        });
    }

    // ---------- Nube ----------
    // La distribuidora en Firestore, o null sin cuenta (modo personal).
    function refNube() {
        try {
            const id = window.distribuidoraVendeFrio?.idActual?.();
            if (!id || typeof usaNubeReal !== "function" || !usaNubeReal() || !window.firebase?.apps?.length) return null;
            return window.firebase.firestore().collection("distribuidoras").doc(id);
        } catch (error) {
            return null;
        }
    }

    function persona() {
        return typeof personaDeEsteCelular === "function" ? personaDeEsteCelular() : null;
    }

    function esDueno() {
        if (window.empleadosVendeFrio?.esEmpleado?.()) return false;
        return typeof esDuenoEnLaNube === "function" && esDuenoEnLaNube();
    }

    // Nombre corto del celular, para los informes.
    function dispositivo() {
        const agente = navigator.userAgent || "";
        if (/Android/i.test(agente)) return "Android";
        if (/iPhone|iPad|iPod/i.test(agente)) return "iPhone";
        return /Mobile/i.test(agente) ? "Celular" : "Computadora";
    }

    // Listas largas (T151): las primeras tarjetas se dibujan enseguida y el
    // resto de a tandas, sin trabar el celular. Volver a dibujar la lista (o
    // cortarTandas) frena las tandas que quedaban de antes.
    // Repasada: lo que está a más de dos pantallas de distancia se dibuja
    // recién cuando el dedo baja y se acerca. Con mil comercios, dibujarlos
    // todos ocupaba mucha memoria (y Android cerraba antes la app de fondo).
    function cortarTandas(contenedor) {
        if (!contenedor) return;
        const tanda = contenedor.tandaVendeFrio;
        if (tanda && tanda.soltar) tanda.soltar();
        contenedor.tandaVendeFrio = null;
    }

    function dibujarDeATandas(contenedor, items, dibujarUno, opciones) {
        // Cada tanda dura como mucho unos milisegundos: así el celular sigue
        // respondiendo al dedo mientras se completa la lista.
        const { primeros = 8, milisegundos = 10, alTerminar } = opciones || {};
        cortarTandas(contenedor);
        const tanda = {};
        contenedor.tandaVendeFrio = tanda;
        let siguiente = 0;
        let vigia = null;
        tanda.soltar = () => {
            if (vigia) vigia.disconnect();
            vigia = null;
        };
        // ¿El final de la lista está a menos de dos pantallas de lo que se ve?
        function cerca() {
            return contenedor.getBoundingClientRect().bottom < window.innerHeight * 3;
        }
        function dibujar(minimo) {
            const inicio = performance.now();
            const fragmento = document.createDocumentFragment();
            while (siguiente < items.length && (siguiente < minimo || performance.now() - inicio < milisegundos)) {
                const elemento = dibujarUno(items[siguiente], siguiente);
                if (elemento) fragmento.appendChild(elemento);
                siguiente++;
            }
            contenedor.appendChild(fragmento);
            if (siguiente < items.length) {
                if (cerca()) setTimeout(seguir, 0);
                else esperarAlDedo();
                return;
            }
            contenedor.tandaVendeFrio = null;
            if (alTerminar) alTerminar();
        }
        // Se mira la última tarjeta: cuando el dedo la acerca, sigue la lista.
        function esperarAlDedo() {
            const ultima = contenedor.lastElementChild;
            if (!ultima || typeof IntersectionObserver !== "function") {
                setTimeout(seguir, 0);
                return;
            }
            vigia = new IntersectionObserver(entradas => {
                if (!entradas.some(entrada => entrada.isIntersecting)) return;
                tanda.soltar();
                seguir();
            }, { rootMargin: "0px 0px " + Math.round(window.innerHeight * 2) + "px 0px" });
            vigia.observe(ultima);
        }
        function seguir() {
            if (contenedor.tandaVendeFrio !== tanda) return;
            // Si se fue de la pantalla, se corta: al volver se dibuja de nuevo.
            if (!contenedor.isConnected || contenedor.closest(".oculto")) {
                cortarTandas(contenedor);
                return;
            }
            dibujar(0);
        }
        dibujar(primeros);
    }

    // Repasada: lo que parece solo información (un número, una tarjeta) se
    // puede tocar y lleva a su detalle. Se ve igual que antes; al apretarlo
    // se achica apenas, como los botones. Un solo oyente para toda la app.
    // Si adentro tiene su propio botón o enlace, ese sigue haciendo lo suyo.
    const alTocarDe = new WeakMap();
    function tocable(elemento, alTocar, { etiqueta = "", rol = true } = {}) {
        if (!elemento || typeof alTocar !== "function") return elemento;
        alTocarDe.set(elemento, alTocar);
        elemento.classList.add("pzTocable");
        if (rol && elemento.tagName !== "BUTTON" && elemento.tagName !== "A") {
            elemento.setAttribute("role", "button");
            elemento.tabIndex = 0;
        }
        if (etiqueta) elemento.setAttribute("aria-label", etiqueta);
        return elemento;
    }
    function tocadoEn(evento) {
        const elemento = evento.target.closest?.(".pzTocable");
        if (!elemento || !alTocarDe.has(elemento)) return null;
        const propio = evento.target.closest("button, a[href], input, select, textarea, label, [role='button']");
        return propio && propio !== elemento && elemento.contains(propio) ? null : elemento;
    }
    document.addEventListener("click", evento => {
        const elemento = tocadoEn(evento);
        if (elemento) alTocarDe.get(elemento)(evento);
    });
    document.addEventListener("keydown", evento => {
        if (evento.key !== "Enter" && evento.key !== " ") return;
        const elemento = evento.target;
        if (!alTocarDe.has(elemento) || elemento.tagName === "BUTTON" || elemento.tagName === "A") return;
        evento.preventDefault();
        alTocarDe.get(elemento)(evento);
    });

    // Cabeceras en un celular chico (T152): si el título no entra al lado de
    // "Avisos" y "?", pasa a su propio renglón debajo de los botones, en vez
    // de empujarlos fuera de la pantalla. Se mira después de cada toque (que
    // es lo que abre las pantallas) y al girar el celular.
    function acomodarCabeceras() {
        document.querySelectorAll("body > section:not(.oculto) > header").forEach(cabecera => {
            const titulo = cabecera.querySelector(":scope > div > h1");
            if (!titulo) return;
            cabecera.classList.remove("cabeceraDosFilas");
            if (titulo.scrollWidth > titulo.clientWidth + 1) cabecera.classList.add("cabeceraDosFilas");
        });
    }
    let cabecerasPendientes = false;
    function pedirAcomodarCabeceras() {
        if (cabecerasPendientes) return;
        cabecerasPendientes = true;
        requestAnimationFrame(() => setTimeout(() => {
            cabecerasPendientes = false;
            acomodarCabeceras();
        }, 0));
    }
    document.addEventListener("click", pedirAcomodarCabeceras, true);
    window.addEventListener("resize", pedirAcomodarCabeceras);
    window.addEventListener("load", pedirAcomodarCabeceras);

    // Que mantener apretado no abra el menú de Chrome (abrir imagen, copiar
    // link) ni se puedan arrastrar las imágenes. Donde se escribe o en lo que
    // tiene .copiable el menú sigue, para poder copiar y pegar.
    function dejaMenu(elemento) {
        return !!(elemento && elemento.closest && elemento.closest("input, textarea, select, [contenteditable], .copiable"));
    }
    document.addEventListener("contextmenu", evento => {
        if (!dejaMenu(evento.target)) evento.preventDefault();
    });
    document.addEventListener("dragstart", evento => {
        if (evento.target && evento.target.closest && evento.target.closest("img, svg, a")) evento.preventDefault();
    });

    // Deslizar hacia abajo para cerrar (T169): cualquier hoja que sube desde
    // abajo (las de piezas y las ventanas .modalHoja) se cierra arrastrándola
    // hacia abajo, como en las apps del celular. Solo mueve la hoja con
    // transform, para que ande fluido en celulares baratos.
    const HOJAS = ".pzHoja, .modal.modalHoja > .modalContenido, .modal > .modalContenido.fichaPedido, .modalFichaComercio > .modalContenido, .ventanaNotas > .notasCaja";
    let arrastre = null;
    const BOTONES_CERRAR = /^(Cancelar|Cerrar|Volver|Ahora no|Entendido)$/;

    function subioAlgo(desde, hasta) {
        for (let elemento = desde; elemento && elemento !== hasta.parentElement; elemento = elemento.parentElement) {
            if (elemento.scrollTop > 0) return true;
        }
        return false;
    }

    function fondoDe(hoja) {
        return hoja.closest(".pzFondo") || hoja.closest(".modal");
    }

    function sigueAbierta(fondo) {
        if (!fondo.isConnected || fondo.classList.contains("oculto")) return false;
        return !fondo.classList.contains("pzFondo") || fondo.classList.contains("visible");
    }

    function soltarHoja(hoja, hasta) {
        hoja.classList.remove("hojaArrastrando");
        hoja.classList.add("hojaSoltando");
        hoja.style.transform = hasta || "";
        setTimeout(() => hoja.classList.remove("hojaSoltando"), 220);
    }

    function cerrarArrastrada(hoja) {
        const fondo = fondoDe(hoja);
        soltarHoja(hoja, "translateY(100%)");
        setTimeout(() => {
            // Igual que tocar afuera: cada ventana decide qué pasa al cerrarla.
            if (fondo) fondo.dispatchEvent(new MouseEvent("click", { bubbles: true }));
            setTimeout(() => {
                // Si tocar afuera no la cierra, se usa su botón de cancelar.
                if (fondo && sigueAbierta(fondo)) {
                    const cancelar = Array.from(hoja.querySelectorAll("button"))
                        .find(boton => boton.offsetParent && (BOTONES_CERRAR.test(boton.textContent.trim()) ||
                            /^Cerrar/.test(boton.getAttribute("aria-label") || "")));
                    if (cancelar) cancelar.click();
                }
                setTimeout(() => {
                    if (fondo && sigueAbierta(fondo)) soltarHoja(hoja, "");
                    else hoja.style.transform = "";
                }, 60);
            }, 60);
        }, 160);
    }

    document.addEventListener("touchstart", evento => {
        arrastre = null;
        if (evento.touches.length !== 1 || !evento.target.closest) return;
        const hoja = evento.target.closest(HOJAS);
        if (!hoja || evento.target.closest("input, textarea, select, [contenteditable], .sinArrastre")) return;
        if (subioAlgo(evento.target, hoja)) return;
        const toque = evento.touches[0];
        arrastre = { hoja, x: toque.clientX, y: toque.clientY, hora: Date.now(), activo: false, dy: 0, cuadro: 0 };
    }, { passive: true });

    document.addEventListener("touchmove", evento => {
        if (!arrastre) return;
        const toque = evento.touches[0];
        const dx = toque.clientX - arrastre.x;
        const dy = toque.clientY - arrastre.y;
        if (!arrastre.activo) {
            if (dy < -6 || Math.abs(dx) > Math.abs(dy) + 4) { arrastre = null; return; }
            if (dy < 10 || arrastre.hoja.scrollTop > 0) return;
            arrastre.activo = true;
            arrastre.hoja.classList.add("hojaArrastrando");
        }
        arrastre.dy = Math.max(0, dy - 10);
        if (!arrastre.cuadro) {
            const actual = arrastre;
            actual.cuadro = requestAnimationFrame(() => {
                actual.cuadro = 0;
                actual.hoja.style.transform = "translateY(" + actual.dy + "px)";
            });
        }
    }, { passive: true });

    function terminarArrastre() {
        const actual = arrastre;
        arrastre = null;
        if (!actual || !actual.activo) return;
        if (actual.cuadro) cancelAnimationFrame(actual.cuadro);
        const rapido = actual.dy / Math.max(1, Date.now() - actual.hora);
        if (actual.dy > Math.max(90, actual.hoja.offsetHeight * 0.25) || (rapido > 0.6 && actual.dy > 40)) {
            cerrarArrastrada(actual.hoja);
        } else {
            soltarHoja(actual.hoja, "");
        }
    }
    document.addEventListener("touchend", terminarArrastre, { passive: true });
    document.addEventListener("touchcancel", terminarArrastre, { passive: true });

    window.piezas = {
        refNube, persona, esDueno, dispositivo,
        anotarError, erroresRecientes, comprimirImagen,
        ico, esc, plata, hora, fechaCorta, iniciales: inicialesDe, colorIni,
        lsLeer, lsGuardar,
        pantalla, mostrar, volverDesde,
        hoja, modal, preguntar, cerrar, deshacer, tocable,
        avisoInicio, dibujarDeATandas, cortarTandas, acomodarCabeceras: pedirAcomodarCabeceras
    };
})();
