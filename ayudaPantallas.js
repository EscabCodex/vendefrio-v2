// VendeFrío - Ayuda en cada pantalla (Etapa 8, pedido del dueño).
// Un botón "?" arriba a la derecha de cada pantalla abre "¿Qué hago acá?"
// con tres pasos cortos y "Escuchar en voz alta". Inicio no lo lleva: ahí
// está el Asistente, que también explica cómo se usa todo.
// Acá también va la confirmación hablada al guardar (opcional, apagada de
// fábrica): dice en voz alta los avisos cortos de abajo ("Pedido guardado").
(function () {
    "use strict";

    const p = window.piezas;
    if (!p) return;

    const PANTALLAS = {
        pedidos: { titulo: "Pedidos", pasos: [
            "Acá están los pedidos de hoy, separados por lo que falta hacer.",
            "Tocá un pedido para armarlo o entregarlo. Adentro tenés los pasos en orden.",
            "Para cargar uno nuevo, tocá el + de abajo."] },
        pantallaPedido: { titulo: "Nuevo pedido", pasos: [
            "Arriba, elegí el comercio.",
            "Tocá una marca para abrirla y sumá cada producto con el +.",
            "Tocá «Guardar pedido». Con el botón redondo ⋯ repetís el último, dictás o anotás un cambio."] },
        pantallaComercios: { titulo: "Comercios", pasos: [
            "Acá están todos tus comercios. Arriba ves cuántos te faltan visitar.",
            "Tocá uno para abrir su ficha: llamarlo, ir, o cargarle un pedido.",
            "Para sumar uno nuevo, tocá «Agregar comercio»."] },
        pantallaProductos: { titulo: "Productos y marcas", pasos: [
            "Acá sumás productos y marcas nuevos.",
            "Tocá los tres puntos de un producto para editarlo o archivarlo.",
            "Lo archivado deja de salir en Nuevo pedido, pero se puede recuperar."] },
        pantallaCatalogo: { titulo: "Catálogo", pasos: [
            "Acá ves todo lo que vendés, con su precio.",
            "Tocá los tres puntos de un producto para cambiarle el precio o la foto.",
            "En «Editar marcas» sumás productos y marcas nuevos."] },
        pantallaRutas: { titulo: "Rutas", pasos: [
            "Elegí los comercios que vas a visitar.",
            "Tocá «Optimizar ruta» para recorrerlos en el orden más corto.",
            "Guardala con un nombre para usarla otro día."] },
        pantallaHistorial: { titulo: "Historial", pasos: [
            "Acá están los pedidos terminados, del más nuevo al más viejo.",
            "Buscá por comercio o filtrá por fecha.",
            "Tocá uno para ver el detalle."] },
        pantallaEstadisticas: { titulo: "Estadísticas", pasos: [
            "Arriba elegí el período: hoy, la semana, el mes o todo.",
            "Ves cuánto vendiste y lo más pedido.",
            "Más abajo, los comercios que hace mucho no visitás."] },
        pantallaCierre: { titulo: "Cierre del día", pasos: [
            "Acá ves lo que vendiste, lo que cobraste y lo que falta cobrar hoy.",
            "Sumá los gastos del día, como la nafta.",
            "Compartilo o imprimilo si lo tenés que rendir."] },
        pantallaWhatsapp: { titulo: "WhatsApp", pasos: [
            "Mandá la ronda: un mensaje a cada comercio para que te pida.",
            "Pegá acá lo que te contestan y la app arma los pedidos.",
            "Revisá cada pedido antes de cargarlo."] },
        pantallaConfiguracion: { titulo: "Más", pasos: [
            "Arriba están las herramientas, en grupos: Plata, Ventas y Herramientas.",
            "Abajo, los ajustes: apariencia, trabajo, cuenta y respaldo.",
            "Si algo no anda, entrá a «Seguridad y ayuda» e informá el problema."] },
        pantallaSinSubir: { titulo: "Sin subir", pasos: [
            "Acá está lo que quedó en este celular y todavía no llegó a la nube.",
            "Se sube solo cuando vuelve la señal.",
            "Para probar ya, tocá el botón de arriba a la derecha."] },
        pantallaHeladera: { titulo: "Exhibición", pasos: [
            "Acá están las fotos de la heladera de este comercio.",
            "Tocá la cámara de arriba para sacar una nueva.",
            "Sirven para comparar y ver qué le falta."] },
        pantallaRepartidores: { titulo: "Repartiendo ahora", pasos: [
            "En el mapa ves dónde está cada repartidor.",
            "Aparece solo mientras reparte con la app abierta.",
            "Volvé con la flecha de arriba."] },
        pantallaMapaVentas: { titulo: "Mapa de ventas", pasos: [
            "Cada comercio aparece en el mapa según lo que compró este mes.",
            "Abajo está la leyenda de los colores.",
            "Tocá un punto para ver el comercio."] },
        pantallaImportar: { titulo: "Importar planilla", pasos: [
            "Elegí si vas a traer productos o comercios.",
            "Elegí la planilla de Excel del celular.",
            "Revisá la vista previa y confirmá."] },
        pantallaCambios: { titulo: "Registro de cambios", pasos: [
            "Acá ves qué se cambió en la app, quién y cuándo.",
            "Solo lo ves vos, y no se puede borrar.",
            "Sirve para saber, por ejemplo, quién cambió un precio."] },
        pantallaACobrar: { titulo: "A cobrar", pasos: [
            "Acá ves lo que te debe cada comercio.",
            "Tocá uno para registrar lo que te paga.",
            "Cuando paga todo, sale de la lista."] },
        pantallaRecibo: { titulo: "Recibo", pasos: [
            "Es el recibo del cobro que registraste.",
            "Compartilo por WhatsApp para que el comercio lo tenga.",
            "Volvé con la flecha de arriba."] },
        pantallaProblemas: { titulo: "Problemas", pasos: [
            "Acá están los problemas que informaron en tu distribuidora.",
            "Cada uno dice quién, cuándo y en qué pantalla estaba.",
            "Para informar uno nuevo, entrá a Más › Seguridad y ayuda."] },
        pantallaPreciosLista: { titulo: "Precios por lista", pasos: [
            "Cada lista puede tener un precio distinto para este producto.",
            "Escribí el precio de cada lista.",
            "Los comercios de esa lista lo ven con ese precio."] },
        pantallaNavegacion: { titulo: "Navegación", pasos: [
            "Seguí la línea del mapa.",
            "Si está prendida, la voz te avisa cuándo doblar.",
            "Al llegar, tocá «Llegué»."] },
        pantallaEscanear: { titulo: "Escanear", pasos: [
            "Apuntá la cámara al código de barras.",
            "Cuando lo lee, la app busca el producto.",
            "Si no lo encuentra, podés cargarlo a mano."] }
    };

    // ---------- La pantalla que se ve ahora ----------
    function pantallaVisible() {
        return [...document.querySelectorAll('body > section[id^="pantalla"]')]
            .find(seccion => !seccion.classList.contains("oculto")) || null;
    }

    function ayudaDe(seccion) {
        if (!seccion) return null;
        if (seccion.id === "pantallaPedido") {
            const vista = document.getElementById("vistaPedidos");
            return PANTALLAS[vista && !vista.classList.contains("oculto") ? "pedidos" : "pantallaPedido"];
        }
        if (PANTALLAS[seccion.id]) return PANTALLAS[seccion.id];
        const titulo = seccion.querySelector(":scope > header h1")?.textContent?.trim() || "Esta pantalla";
        return { titulo, pasos: [
            "Leé el título de arriba: dice para qué es esta pantalla.",
            "Si no sabés cómo hacer algo, preguntale al Asistente (el botón con la chispa en Inicio).",
            "Volvé con la flecha de arriba o con la barra de abajo."] };
    }

    // ---------- Hablar ----------
    function hablar(texto) {
        if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return false;
        try {
            window.speechSynthesis.cancel();
            const dicho = new SpeechSynthesisUtterance(texto);
            dicho.lang = "es-AR";
            window.speechSynthesis.speak(dicho);
            return true;
        } catch (error) {
            return false;
        }
    }

    // ---------- "¿Qué hago acá?" ----------
    function abrirAyuda(seccion = pantallaVisible()) {
        const ayuda = ayudaDe(seccion);
        if (!ayuda) return;
        p.hoja({
            titulo: "¿Qué hago acá?",
            sub: ayuda.titulo,
            etiqueta: "Ayuda de " + ayuda.titulo,
            clase: "hojaAyuda",
            html: `<ol class="pasosAyuda">${ayuda.pasos.map(paso => `<li>${p.esc(paso)}</li>`).join("")}</ol>`,
            botones: [
                { texto: "Escuchar en voz alta", icono: "volumen", clase: "pzBtnSec escucharAyuda", cerrar: false,
                    alTocar: () => {
                        if (!hablar(ayuda.pasos.map((paso, indice) => (indice + 1) + ". " + paso).join(" ")) && typeof mostrarToast === "function") {
                            mostrarToast("Este celular no puede leer en voz alta");
                        }
                    } },
                { texto: "Entendido", clase: "pzBtnPri", alTocar: () => window.speechSynthesis?.cancel() }
            ]
        });
    }

    // ---------- El botón "?" de cada encabezado ----------
    function crearBoton() {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "botonAyudaPantalla conNombre";
        boton.setAttribute("aria-label", "Ayuda de esta pantalla");
        boton.title = "¿Qué hago acá?";
        boton.dataset.nombre = "Ayuda";
        boton.innerHTML = '<span aria-hidden="true">?</span>';
        return boton;
    }

    function ponerBotones() {
        document.querySelectorAll('body > section[id^="pantalla"] > header').forEach(encabezado => {
            const seccion = encabezado.parentElement;
            if (seccion.id === "pantallaMenu" || seccion.id === "pantallaInicioSesion") return;
            if (encabezado.querySelector(".botonAyudaPantalla")) return;
            encabezado.appendChild(crearBoton());
        });
    }

    document.addEventListener("click", evento => {
        const boton = evento.target.closest(".botonAyudaPantalla");
        if (boton) abrirAyuda(boton.closest('body > section[id^="pantalla"]'));
    });

    // Algunas pantallas (como Más) se vuelven a dibujar enteras: se mira
    // todo el cuerpo, una vez por cuadro.
    // Lo que cambia dentro de un mapa o de la navegación (cada posición del
    // GPS) no agrega pantallas: se ignora, así no se trabaja de más (T141).
    let pendiente = false;
    new MutationObserver(cambios => {
        if (pendiente) return;
        if (cambios.every(cambio => cambio.target.closest?.(".leaflet-container, #pantallaNavegacion > *"))) return;
        pendiente = true;
        requestAnimationFrame(() => {
            pendiente = false;
            ponerBotones();
        });
    }).observe(document.body, { childList: true, subtree: true });
    ponerBotones();

    // ---------- Confirmación hablada al guardar (opcional) ----------
    const mostrarToastOriginal = window.mostrarToast;
    if (typeof mostrarToastOriginal === "function") {
        window.mostrarToast = function (mensaje, tipo) {
            const resultado = mostrarToastOriginal.apply(this, arguments);
            if (window.preferenciasVendeFrio?.valor("hablarAlGuardar") === true) {
                const texto = String(mensaje || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
                if (texto) hablar(texto);
            }
            return resultado;
        };
    }

    window.ayudaPantallasVendeFrio = { abrir: abrirAyuda, temas: PANTALLAS, hablar };
}());
