// VendeFrío - Tutorial interactivo (T157).
// 1. Tutorial de inicio: al crear la cuenta (dueño) arranca solo y lo
//    básico se hace de verdad, paso a paso: un comercio, una marca, un
//    producto con su precio, el primer pedido, la ruta y la entrega. Cada
//    paso señala el botón real y espera a que la persona lo haga. A quien
//    entra con código (empleado) le muestra dónde está cada cosa, sin
//    cargar nada, porque los datos son los de toda la distribuidora.
// 2. Tutorial de cada pantalla: la primera vez que se entra a una pantalla
//    que no estaba en el de inicio (Estadísticas, Cierre del día, Precios
//    por lista…), un recorrido corto que señala sus botones.
// Se saltea cuando se quiere. Se vuelve a ver desde Primeros pasos o desde
// Más > Seguridad y ayuda, donde también se apaga el de cada pantalla.
// Liviano para celulares baratos: dos cajas fijas, sin animaciones, y solo
// mira la pantalla al cambiar de paso, al girar el celular y, mientras
// espera que la persona haga algo, dos veces por segundo.
(function () {
    "use strict";

    // "visto", o "pendiente-dueno" / "pendiente-empleado" recién entrado.
    const CLAVE = "vendefrio_tutorial";
    // "si" o "no": el tutorial de cada pantalla.
    const CLAVE_PANTALLAS = "vendefrio_tutoriales_pantallas";
    // Las pantallas que ya se explicaron en este celular.
    const CLAVE_VISTAS = "vendefrio_tutoriales_vistos";

    function leer(clave) {
        try { return localStorage.getItem(clave); } catch (error) { return null; }
    }

    function escribir(clave, valor) {
        try { localStorage.setItem(clave, valor); } catch (error) { /* sin lugar */ }
    }

    function enLaNube() {
        return typeof usaNubeReal === "function" && usaNubeReal();
    }

    // ---------- Lo que hay cargado, para saber si ya lo hizo ----------
    function contar() {
        const productos = typeof productosParaLeer === "function" ? productosParaLeer() : {};
        const listas = Object.values(productos).filter(Array.isArray);
        return {
            comercios: typeof comerciosParaLeer === "function" ? comerciosParaLeer().length : 0,
            marcas: Object.keys(productos).length,
            productos: listas.reduce((total, lista) => total + lista.length, 0),
            pedidos: typeof historialParaLeer === "function" ? historialParaLeer().length : 0,
            entregados: typeof pedidosDelHistorialParaLeer === "function" ? pedidosDelHistorialParaLeer().length : 0
        };
    }

    function tiradorEntregado() {
        return [...document.querySelectorAll("#modalFichaPedido .tiradorDeslizador")]
            .find(tirador => /Entregado/.test(tirador.getAttribute("aria-label") || "")) || null;
    }

    // ---------- Tutorial de inicio ----------
    // tipo "centro": un cartel en el medio. "ver": señala y se sigue con
    // "Siguiente". "hacer": señala, deja tocar solo ese botón y espera a que
    // listo() diga que ya está; mientras completa la ventana, muestra
    // "mientras" en un cartel chico. Al terminar, espera que se cierre la
    // ventana, salvo "conVentana" (el paso que sigue es adentro de ella).
    const PRACTICO = [
        { tipo: "centro", titulo: "Hagamos lo básico juntos",
            texto: "Vas a cargar tu primer comercio, una marca con su producto y el primer pedido, ver la ruta y entregarlo. Lo hacés vos, de verdad, y yo te señalo cada botón.",
            siguiente: "Empezar" },
        { tipo: "hacer", pantalla: "comercios", objetivo: "#agregarComercio", titulo: "1. Tu primer comercio",
            texto: "Tocá «Agregar comercio».",
            mientras: "Escribí el nombre, la dirección y el teléfono, y tocá «Guardar».",
            listo: (antes, ahora) => ahora.comercios > antes.comercios },
        { tipo: "hacer", pantalla: "productos", objetivo: "#agregarMarca", titulo: "2. Una marca",
            texto: "Tocá «Agregar marca».",
            mientras: "Escribí el nombre de la marca y guardala.",
            listo: (antes, ahora) => ahora.marcas > antes.marcas },
        { tipo: "hacer", pantalla: "productos", objetivo: "#agregarProducto", titulo: "3. Un producto con su precio",
            texto: "Tocá «Agregar producto».",
            mientras: "Elegí la marca, escribí el nombre del producto y su precio, y guardalo.",
            listo: (antes, ahora) => ahora.productos > antes.productos },
        { tipo: "hacer", pantalla: "menu", objetivo: ".bottom-nav .nav-nuevo", titulo: "4. El primer pedido",
            texto: "Tocá el + de abajo. Desde cualquier pantalla carga un pedido nuevo.",
            mientras: "Elegí el comercio que creaste, sumá el producto con el + y tocá «Guardar pedido».", sinMostrar: true,
            listo: (antes, ahora) => ahora.pedidos > antes.pedidos },
        { tipo: "ver", pantalla: "rutas", objetivo: "#btnElegirRutas", titulo: "5. La ruta del día",
            texto: "Con «Elegir» marcás los comercios que vas a visitar hoy." },
        { tipo: "ver", pantalla: "rutas", objetivo: "#btnOptimizarRuta", titulo: "5. La ruta del día",
            texto: "«Optimizar» los ordena por el camino más corto." },
        { tipo: "ver", pantalla: "rutas", objetivo: "#btnNavegarRuta", titulo: "5. La ruta del día",
            texto: "Con «Iniciar» la app te lleva parada por parada. Para eso cada comercio necesita su ubicación: en su ficha, «Actualizar con mi GPS»." },
        { tipo: "hacer", soloNube: true, pantalla: "menu", objetivo: '.bottom-nav [data-pantalla="pedido"]', titulo: "6. Entregar el pedido",
            texto: "Tocá «Pedidos».", conVentana: true,
            listo: () => Boolean(document.querySelector("#listaVistaPedidos .tarjetaSeguimiento")) && !document.getElementById("vistaPedidos")?.classList.contains("oculto") },
        { tipo: "hacer", soloNube: true, objetivo: "#listaVistaPedidos .tarjetaSeguimiento", titulo: "6. Entregar el pedido",
            texto: "Tocá tu pedido para abrirlo.", conVentana: true,
            listo: () => Boolean(tiradorEntregado()) },
        { tipo: "hacer", soloNube: true, objetivo: () => tiradorEntregado()?.parentElement, titulo: "6. Entregar el pedido",
            texto: "Deslizá el botón hacia la derecha: así queda entregado.",
            mientras: "Si te pregunta cómo pagó, elegí una opción.",
            listo: (antes, ahora) => ahora.entregados > antes.entregados },
        { tipo: "centro", titulo: "¡Ya sabés lo básico!",
            texto: "Cuando entres por primera vez a otra pantalla, te muestro cómo se usa. Este tutorial lo volvés a ver en Más › Seguridad y ayuda.",
            siguiente: "Terminar" }
    ];

    // Para quien entra con código: dónde está cada cosa, sin cargar nada.
    const MIRAR = [
        { tipo: "centro", titulo: "Te muestro la app",
            texto: "Son unos pasos cortos. Te señalo cada botón en la pantalla de verdad.", siguiente: "Empezar" },
        { tipo: "ver", pantalla: "comercios", objetivo: "#agregarComercio", titulo: "Comercios",
            texto: "Acá están los comercios. Con «Agregar comercio» sumás uno nuevo." },
        { tipo: "ver", pantalla: "catalogo", objetivo: '.bottom-nav [data-pantalla="catalogo"]', titulo: "Catálogo",
            texto: "Los productos con su precio." },
        { tipo: "ver", pantalla: "menu", objetivo: ".bottom-nav .nav-nuevo", titulo: "Cargar un pedido",
            texto: "Con el + de abajo cargás un pedido: elegís el comercio, sumás los productos y tocás «Guardar pedido»." },
        { tipo: "ver", pantalla: "menu", objetivo: '.bottom-nav [data-pantalla="pedido"]', titulo: "Pedidos",
            texto: "Acá seguís cada pedido: armarlo, repartirlo y entregarlo deslizando «Entregado»." },
        { tipo: "ver", pantalla: "rutas", objetivo: "#btnNavegarRuta", titulo: "Rutas",
            texto: "Elegís los comercios del día, «Optimizar» los ordena y con «Iniciar» la app te lleva." },
        { tipo: "ver", pantalla: "mas", objetivo: '#pantallaConfiguracion [data-config-seccion="seguridad"]', titulo: "Más",
            texto: "En Más están las herramientas y los ajustes. En «Seguridad y ayuda» volvés a ver esto." },
        { tipo: "centro", titulo: "¡Listo!",
            texto: "Cuando entres por primera vez a otra pantalla, te muestro cómo se usa. Y en cada una, el botón «?» te explica qué hacer.",
            siguiente: "Terminar" }
    ];

    // ---------- Tutorial de cada pantalla ----------
    // Las del tutorial de inicio y las que no conviene tapar (navegando o
    // con la cámara) no lo llevan.
    const SIN_TUTORIAL = new Set(["pantallaMenu", "pantallaInicioSesion", "pantallaPedido", "pantallaComercios",
        "pantallaProductos", "pantallaCatalogo", "pantallaRutas", "pantallaConfiguracion", "pantallaNavegacion",
        "pantallaNavegacion3D", "pantallaEscanear"]);

    const DE_PANTALLA = {
        pantallaEstadisticas: [
            { objetivo: ".selectorPeriodoEstadisticas", titulo: "El período", texto: "Elegí si querés ver hoy, la semana, el mes o todo." },
            { objetivo: ".statsNumeros", titulo: "Cuánto vendiste", texto: "Lo vendido y los pedidos del período, comparados con el anterior." },
            { objetivo: ".statsPestanas", titulo: "Lo más pedido", texto: "Cambiá de pestaña para ver los productos o los comercios que más compran." }
        ],
        pantallaHistorial: [
            { objetivo: "#buscarHistorial", titulo: "Buscar", texto: "Escribí el nombre de un comercio para encontrar sus pedidos." },
            { objetivo: "#filtroFechaHistorial", titulo: "Por fecha", texto: "Mirá solo los de hoy o los de esta semana." }
        ],
        pantallaCierre: [
            { objetivo: ".heroCierre", titulo: "Tu día", texto: "Lo que vendiste, lo que cobraste y lo que falta cobrar." },
            { objetivo: ".contarPlata", titulo: "Contá la plata", texto: "Escribí lo que tenés en mano y la app te dice si falta o sobra." },
            { objetivo: "#cerrarYMandarCierre", titulo: "Cerrar el día", texto: "Cerralo y mandalo, o imprimilo si lo tenés que rendir." }
        ],
        pantallaWhatsapp: [
            { objetivo: "#pantallaWhatsapp .waBotonPrincipal", titulo: "La ronda", texto: "Mandale a cada comercio un mensaje para que te pida." }
        ]
    };

    function pasosDePantalla(seccion) {
        const id = seccion.id;
        const propios = (DE_PANTALLA[id] || []).map(paso => ({ tipo: "ver", ...paso, objetivo: "#" + id + " " + paso.objetivo.replace("#" + id + " ", "") }));
        const visibles = propios.filter(paso => visible(document.querySelector(paso.objetivo)));
        const ayuda = window.ayudaPantallasVendeFrio?.temas?.[id];
        if (!visibles.length) {
            if (!ayuda) return [];
            visibles.push({ tipo: "ver", objetivo: "#" + id + " > header", titulo: ayuda.titulo, texto: ayuda.pasos.join(" ") });
        }
        visibles.push({ tipo: "ver", objetivo: "#" + id + " .botonAyudaPantalla", titulo: "Si te olvidás",
            texto: "Tocá «?» y te lo explico de nuevo, también en voz alta." });
        return visibles;
    }

    // ---------- El dibujo ----------
    let capa = null;
    let foco = null;
    let globo = null;
    let tapas = [];
    let pasos = [];
    let indice = 0;
    let tipoRecorrido = "";
    let turno = 0;
    let reloj = null;
    let antes = null;
    let terminado = false;

    function visible(elemento) {
        if (!elemento) return false;
        const caja = elemento.getBoundingClientRect();
        return caja.width > 0 && caja.height > 0 && getComputedStyle(elemento).visibility !== "hidden";
    }

    function buscar(paso) {
        if (!paso.objetivo) return null;
        return typeof paso.objetivo === "function" ? paso.objetivo() : document.querySelector(paso.objetivo);
    }

    // Una ventana (o una hoja de abajo) abierta que no es la del botón.
    function ventanaAbierta(objetivo) {
        return [...document.querySelectorAll(".modal:not(.oculto), .pzFondo")]
            .find(ventana => !objetivo || !ventana.contains(objetivo)) || null;
    }

    function dosCuadros() {
        return new Promise(listo => requestAnimationFrame(() => requestAnimationFrame(listo)));
    }

    function abrirPantalla(nombre) {
        if (typeof window.cerrarFichaComercio === "function") window.cerrarFichaComercio();
        if (typeof mostrarPantalla === "function") mostrarPantalla(nombre);
    }

    function crear() {
        capa = document.createElement("div");
        capa.className = "tutorialCapa";
        capa.innerHTML = `
            <div class="tutorialTapa"></div><div class="tutorialTapa"></div><div class="tutorialTapa"></div><div class="tutorialTapa"></div>
            <div class="tutorialFoco" aria-hidden="true"></div>
            <div class="tutorialGlobo" role="dialog" aria-modal="true" aria-label="Tutorial">
                <small class="tutorialPaso"></small>
                <strong class="tutorialTitulo"></strong>
                <p class="tutorialTexto" aria-live="polite"></p>
                <div class="tutorialBotones">
                    <button type="button" class="tutorialSaltear">Saltear</button>
                    <button type="button" class="tutorialAtras">Atrás</button>
                    <button type="button" class="tutorialMostrar">Mostrame</button>
                    <button type="button" class="tutorialSaltarPaso">Saltar este paso</button>
                    <button type="button" class="tutorialSiguiente">Siguiente</button>
                </div>
            </div>`;
        tapas = [...capa.querySelectorAll(".tutorialTapa")];
        foco = capa.querySelector(".tutorialFoco");
        globo = capa.querySelector(".tutorialGlobo");
        capa.querySelector(".tutorialSaltear").addEventListener("click", () => cerrar());
        capa.querySelector(".tutorialAtras").addEventListener("click", () => irA(indice - 1, -1));
        capa.querySelector(".tutorialSiguiente").addEventListener("click", () => siguiente());
        capa.querySelector(".tutorialSaltarPaso").addEventListener("click", () => siguiente());
        capa.querySelector(".tutorialMostrar").addEventListener("click", () => irA(indice, 1));
        // En los pasos para mirar, tocar el botón señalado también avanza.
        tapas.forEach(tapa => tapa.addEventListener("click", evento => {
            if (capa.dataset.modo === "ver") {
                const caja = foco.getBoundingClientRect();
                if (evento.clientX >= caja.left && evento.clientX <= caja.right && evento.clientY >= caja.top && evento.clientY <= caja.bottom) siguiente();
            }
        }));
        capa.addEventListener("keydown", evento => {
            if (evento.key === "Escape") cerrar();
        });
        document.body.appendChild(capa);
    }

    function siguiente() {
        if (indice >= pasos.length - 1) {
            terminado = true;
            cerrar();
        } else {
            irA(indice + 1, 1);
        }
    }

    // Abre la pantalla del paso y busca su botón. Si no está (por ejemplo,
    // un empleado sin permiso para el catálogo), sigue en la misma dirección.
    async function irA(nuevo, direccion) {
        const mio = ++turno;
        detenerReloj();
        while (nuevo >= 0 && nuevo < pasos.length) {
            const paso = pasos[nuevo];
            if (paso.soloNube && !enLaNube()) {
                nuevo += direccion;
                continue;
            }
            if (paso.pantalla) abrirPantalla(paso.pantalla);
            // Algunas pantallas acomodan la barra de abajo en el cuadro siguiente.
            await dosCuadros();
            if (mio !== turno || !capa) return;
            const objetivo = buscar(paso);
            if (paso.tipo === "centro" || visible(objetivo)) {
                indice = nuevo;
                mostrar(paso, objetivo);
                return;
            }
            nuevo += direccion;
        }
        if (nuevo >= pasos.length) {
            terminado = true;
            cerrar();
        } else if (capa) {
            irA(0, 1);
        }
    }

    function mostrar(paso, objetivo) {
        capa.querySelector(".tutorialPaso").textContent = tipoRecorrido === "pantalla"
            ? (indice + 1) + " de " + pasos.length
            : "Paso " + (indice + 1) + " de " + pasos.length;
        capa.querySelector(".tutorialTitulo").textContent = paso.titulo;
        capa.dataset.paso = String(indice + 1);
        if (paso.tipo === "hacer") {
            antes = contar();
            modoHacer(paso, objetivo);
            reloj = setInterval(() => vigilar(paso), 500);
        } else {
            modoVer(paso, objetivo);
        }
    }

    function botones({ atras = false, siguiente = "", saltarPaso = false, mostrarBoton = false }) {
        capa.querySelector(".tutorialAtras").hidden = !atras;
        capa.querySelector(".tutorialSiguiente").hidden = !siguiente;
        capa.querySelector(".tutorialSiguiente").textContent = siguiente || "Siguiente";
        capa.querySelector(".tutorialSaltarPaso").hidden = !saltarPaso;
        capa.querySelector(".tutorialMostrar").hidden = !mostrarBoton;
    }

    function modoVer(paso, objetivo) {
        capa.dataset.modo = paso.tipo === "centro" ? "centro" : "ver";
        capa.querySelector(".tutorialTexto").textContent = paso.texto;
        const ultimo = indice === pasos.length - 1;
        botones({ atras: indice > 0 && paso.tipo !== "centro", siguiente: paso.siguiente || (ultimo ? "Terminar" : "Siguiente") });
        if (objetivo && !objetivo.closest(".bottom-nav")) objetivo.scrollIntoView({ block: "center" });
        ubicar(objetivo, true);
        capa.querySelector(".tutorialSiguiente").focus({ preventScroll: true });
    }

    function modoHacer(paso, objetivo) {
        capa.dataset.modo = "hacer";
        capa.querySelector(".tutorialTexto").textContent = paso.texto;
        botones({ saltarPaso: true });
        if (!objetivo.closest(".bottom-nav")) objetivo.scrollIntoView({ block: "center" });
        ubicar(objetivo, false);
    }

    // Mientras completa la ventana (o cuando ya lo hizo y falta cerrarla),
    // un cartel chico que no tapa nada: abajo si hay una ventana arriba, y
    // arriba en las pantallas enteras como Nuevo pedido.
    function modoMientras(texto, conMostrar) {
        capa.dataset.modo = "mientras";
        capa.querySelector(".tutorialTexto").textContent = texto;
        botones({ saltarPaso: true, mostrarBoton: conMostrar });
        ubicar(null, false);
        globo.classList.toggle("abajo", Boolean(document.querySelector(".modal:not(.oculto)")));
        // En Nuevo pedido, arriba está el comercio: el cartel va justo
        // encima de «Guardar pedido».
        const pie = document.querySelector("#pantallaPedido:not(.oculto) .piePedido");
        if (!globo.classList.contains("abajo") && visible(pie)) {
            globo.classList.add("abajo");
            globo.style.bottom = (window.innerHeight - pie.getBoundingClientRect().top + 8) + "px";
        }
    }

    function vigilar(paso) {
        if (!capa) return detenerReloj();
        const objetivo = buscar(paso);
        if (paso.listo(antes, contar())) {
            if (ventanaAbierta(null) && !paso.conVentana) {
                if (capa.dataset.modo !== "listo") {
                    modoMientras("¡Muy bien! Cerrá la ventana para seguir.", false);
                    capa.dataset.modo = "listo";
                    capa.querySelector(".tutorialSaltarPaso").hidden = true;
                }
                return;
            }
            siguiente();
            return;
        }
        const libre = visible(objetivo) && !ventanaAbierta(objetivo);
        if (libre && capa.dataset.modo !== "hacer") modoHacer(paso, objetivo);
        else if (!libre && capa.dataset.modo === "hacer") modoMientras(paso.mientras || paso.texto, !paso.sinMostrar && !ventanaAbierta(objetivo));
    }

    function detenerReloj() {
        if (reloj) clearInterval(reloj);
        reloj = null;
    }

    // El recuadro sobre el botón y cuatro tapas alrededor: en "hacer" se
    // puede tocar solo el botón; en "ver", nada (tocar el recuadro avanza).
    function ubicar(objetivo, tapar) {
        const ancho = window.innerWidth;
        const alto = window.innerHeight;
        globo.classList.remove("abajo");
        if (!objetivo) {
            foco.hidden = true;
            const centro = capa.dataset.modo === "centro";
            tapas[0].style.cssText = centro ? "top:0;left:0;width:100%;height:100%" : "display:none";
            tapas.slice(1).forEach(tapa => { tapa.style.cssText = "display:none"; });
            globo.style.top = "";
            globo.style.bottom = "";
            return;
        }
        const caja = objetivo.getBoundingClientRect();
        const margen = 6;
        const arriba = Math.max(0, caja.top - margen);
        const izquierda = Math.max(0, caja.left - margen);
        const derecha = Math.min(ancho, caja.right + margen);
        const abajo = Math.min(alto, caja.bottom + margen);
        foco.hidden = false;
        foco.style.cssText = `top:${arriba}px;left:${izquierda}px;width:${derecha - izquierda}px;height:${abajo - arriba}px`;
        tapas[0].style.cssText = `top:0;left:0;width:100%;height:${arriba}px`;
        tapas[1].style.cssText = `top:${abajo}px;left:0;width:100%;height:${Math.max(0, alto - abajo)}px`;
        tapas[2].style.cssText = `top:${arriba}px;left:0;width:${izquierda}px;height:${abajo - arriba}px`;
        tapas[3].style.cssText = `top:${arriba}px;left:${derecha}px;width:${Math.max(0, ancho - derecha)}px;height:${abajo - arriba}px`;
        // En "ver" la tapa de arriba cubre también el botón, así no se toca.
        if (tapar) tapas[0].style.height = abajo + "px";
        // El globo va donde haya más lugar: abajo del botón o arriba.
        if (caja.top + caja.height / 2 > alto / 2) {
            globo.style.top = "";
            globo.style.bottom = (alto - arriba + 12) + "px";
        } else {
            globo.style.bottom = "";
            globo.style.top = (abajo + 12) + "px";
        }
    }

    function alGirar() {
        if (!capa || capa.dataset.modo === "mientras" || capa.dataset.modo === "listo") return;
        const paso = pasos[indice];
        ubicar(paso ? buscar(paso) : null, capa.dataset.modo === "ver");
    }

    // Si algo se desplaza (una ventana con su barra), el recuadro lo sigue,
    // una vez por cuadro.
    let moviendo = false;
    function alMover() {
        if (moviendo) return;
        moviendo = true;
        requestAnimationFrame(() => {
            moviendo = false;
            alGirar();
        });
    }

    function empezar(lista, tipo) {
        if (capa) return false;
        pasos = lista;
        tipoRecorrido = tipo;
        terminado = false;
        crear();
        capa.querySelector(".tutorialGlobo").setAttribute("aria-label", tipo === "pantalla" ? "Cómo se usa esta pantalla" : "Tutorial");
        document.documentElement.classList.add("conTutorial");
        window.addEventListener("resize", alGirar);
        window.addEventListener("scroll", alMover, { capture: true, passive: true });
        irA(0, 1);
        return true;
    }

    // Práctico para quien puede cargar (dueño o modo personal); para mirar,
    // para los empleados.
    function abrir(tipo) {
        const esEmpleado = enLaNube() && window.piezas?.esDueno?.() === false;
        const elegido = tipo || (esEmpleado ? "mirar" : "practico");
        return empezar(elegido === "mirar" ? MIRAR : PRACTICO, "inicio");
    }

    function cerrar() {
        if (!capa) return;
        turno++;
        detenerReloj();
        window.removeEventListener("resize", alGirar);
        window.removeEventListener("scroll", alMover, { capture: true });
        capa.remove();
        capa = foco = globo = null;
        tapas = [];
        document.documentElement.classList.remove("conTutorial");
        if (tipoRecorrido === "pantalla") {
            marcarVista(pantallaDelRecorrido);
        } else {
            escribir(CLAVE, "visto");
            abrirPantalla("menu");
        }
        // Al terminar el de inicio puede tocar el de la pantalla de Inicio: no.
        if (terminado && typeof mostrarToast === "function" && tipoRecorrido === "inicio") mostrarToast("¡Listo! Ya sabés lo básico");
    }

    // ---------- Cuándo arranca solo ----------
    let pantallaDelRecorrido = "";

    function vistas() {
        try { return JSON.parse(leer(CLAVE_VISTAS) || "[]"); } catch (error) { return []; }
    }

    function marcarVista(id) {
        if (!id) return;
        const lista = vistas();
        if (!lista.includes(id)) lista.push(id);
        escribir(CLAVE_VISTAS, JSON.stringify(lista));
    }

    function pantallasPrendidas() {
        return leer(CLAVE_PANTALLAS) === "si";
    }

    function prenderPantallas(prendido) {
        escribir(CLAVE_PANTALLAS, prendido ? "si" : "no");
        // Al volver a prenderlo, explica de nuevo todas las pantallas.
        if (prendido) escribir(CLAVE_VISTAS, "[]");
    }

    // inicio.js lo marca al crear la cuenta o al entrar con un código nuevo.
    function marcarRecienEntrado(quien) {
        if (leer(CLAVE) === "visto") return;
        escribir(CLAVE, quien === "empleado" ? "pendiente-empleado" : "pendiente-dueno");
    }

    function pantallaVisible() {
        return [...document.querySelectorAll('body > section[id^="pantalla"]')]
            .find(seccion => !seccion.classList.contains("oculto")) || null;
    }

    let revisando = false;
    function revisar() {
        if (revisando) return;
        revisando = true;
        // Se espera un momento: que la pantalla termine de dibujarse.
        setTimeout(() => {
            revisando = false;
            if (capa || window.vendefrioPruebas?.tutorial === false) return;
            const seccion = pantallaVisible();
            if (!seccion || ventanaAbierta(null)) return;
            const marca = leer(CLAVE) || "";
            if (seccion.id === "pantallaMenu" && marca.startsWith("pendiente-")) {
                if (!leer(CLAVE_PANTALLAS)) escribir(CLAVE_PANTALLAS, "si");
                abrir(marca === "pendiente-empleado" ? "mirar" : "practico");
                return;
            }
            if (!pantallasPrendidas() || SIN_TUTORIAL.has(seccion.id) || vistas().includes(seccion.id)) return;
            const lista = pasosDePantalla(seccion);
            if (!lista.length) return;
            pantallaDelRecorrido = seccion.id;
            empezar(lista, "pantalla");
        }, 600);
    }

    // Se mira solo el atributo class de cada pantalla (no lo de adentro),
    // y las pantallas nuevas que se agregan al cuerpo.
    const observadorClase = new MutationObserver(revisar);
    function observarPantallas() {
        document.querySelectorAll('body > section[id^="pantalla"]').forEach(seccion => {
            if (seccion.dataset.tutorialMirada) return;
            seccion.dataset.tutorialMirada = "1";
            observadorClase.observe(seccion, { attributes: true, attributeFilter: ["class"] });
        });
    }
    new MutationObserver(() => {
        observarPantallas();
        revisar();
    }).observe(document.body, { childList: true });
    observarPantallas();
    revisar();

    // La llave de Más > Seguridad y ayuda.
    document.addEventListener("change", evento => {
        const llave = evento.target.closest?.("[data-tutorial-pantallas]");
        if (llave) prenderPantallas(llave.checked);
    });

    window.tutorialVendeFrio = {
        abrir, cerrar, yaLoVio: () => leer(CLAVE) === "visto", marcarRecienEntrado,
        pantallasPrendidas, prenderPantallas, abierto: () => Boolean(capa)
    };
}());
