// =====================================================
// VendeFrío - novedades.js
// Versión de la app y "Qué hay de nuevo" (Etapa 6, T45 y T49): después de
// una actualización, una ventana con las novedades (una sola vez por
// celular). También se ven desde Más > Seguridad y ayuda.
// =====================================================

(function () {
    const VERSION = "1.0 (vista previa)";
    const CLAVE = "vendefrio_novedades_vistas";

    const NOVEDADES = [
        ["tienda", "Estilo nuevo", "Azul hielo de día y lima de noche, barra de abajo con el «+» en el medio y «Más» desde tu inicial."],
        ["navegar", "Navegación propia", "«Ir» te lleva al comercio con la línea del camino, giro a giro y con voz. Al llegar, «Llegué» lo marca visitado."],
        ["microfono", "Voz", "Tocá el micrófono y decí «próxima parada» o «nuevo pedido para…». En Nuevo pedido podés dictar o pegar un mensaje."],
        ["lista", "Pedidos con historial", "Hoy, Semana, Mes y Todo en la misma lista. La ficha muestra los pasos del pedido y lo demás va en «⋯»."],
        ["calendario", "Suelen pedir hoy", "Inicio te muestra los comercios que suelen pedir este día de la semana y todavía no pidieron."],
        ["descargar", "Planilla para el contador", "Descargá los pedidos y cobros del período desde Estadísticas o Cierre del día."]
    ];

    function hayDatosDeAntes() {
        try {
            // Solo cuentan datos que deja el uso real: la app escribe otras
            // claves sola al arrancar (la semana, comercios y productos de ejemplo).
            // Las listas pueden quedar guardadas vacías: cuentan si tienen algo.
            const conAlgo = clave => {
                const texto = localStorage.getItem(clave);
                if (!texto) return false;
                try {
                    const dato = JSON.parse(texto);
                    return Array.isArray(dato) ? dato.length > 0 : Boolean(dato);
                } catch (error) {
                    return true;
                }
            };
            return ["vendefrio_historial", "vendefrio_rutas_guardadas", "vendefrio_modo_nube", "vendefrio_modo_personal", "vendefrio_empleado", "vendefrio_ultimo_respaldo"]
                .some(conAlgo);
        } catch (error) {
            return false;
        }
    }

    function leerVista() {
        try {
            return localStorage.getItem(CLAVE);
        } catch (error) {
            return VERSION;
        }
    }

    function marcarVista() {
        try {
            localStorage.setItem(CLAVE, VERSION);
        } catch (error) {
            // Sin lugar: se vuelve a mostrar la próxima vez.
        }
    }

    let ventana = null;

    function abrir() {
        if (!ventana) {
            ventana = document.createElement("div");
            ventana.className = "modal oculto ventanaNovedades";
            ventana.innerHTML = `
                <div class="modalContenido contenidoNovedades" role="dialog" aria-modal="true" aria-labelledby="tituloNovedades">
                    <span class="etiquetaVersion"></span>
                    <h2 id="tituloNovedades">Qué hay de nuevo</h2>
                    <ul class="listaNovedades"></ul>
                    <div class="modalBotones"><button type="button" class="btnModalConfirmar cerrarNovedades">Entendido</button></div>
                </div>`;
            document.body.appendChild(ventana);
            ventana.querySelector(".etiquetaVersion").textContent = "Versión " + VERSION;
            const lista = ventana.querySelector(".listaNovedades");
            NOVEDADES.forEach(([icono, titulo, texto]) => {
                const item = document.createElement("li");
                item.innerHTML = '<span class="iconoNovedad">' + window.icono(icono, 20) + "</span><div><strong></strong><p></p></div>";
                item.querySelector("strong").textContent = titulo;
                item.querySelector("p").textContent = texto;
                lista.appendChild(item);
            });
            const cerrar = () => {
                marcarVista();
                ventana.classList.add("oculto");
            };
            ventana.querySelector(".cerrarNovedades").addEventListener("click", cerrar);
            ventana.addEventListener("click", evento => { if (evento.target === ventana) cerrar(); });
        }
        ventana.classList.remove("oculto");
    }

    // Al abrir la app: si este celular ya usaba una versión anterior y no vio
    // estas novedades, se muestran una vez. En un celular nuevo, no.
    function revisar() {
        const vista = leerVista();
        if (vista === VERSION) return;
        if (!vista && !hayDatosDeAntes()) {
            marcarVista();
            return;
        }
        setTimeout(() => {
            const inicioSesion = document.getElementById("pantallaInicioSesion");
            if (inicioSesion && !inicioSesion.classList.contains("oculto")) return;
            abrir();
        }, 1200);
    }

    // Más > Seguridad y ayuda: botón "Ver novedades".
    document.addEventListener("click", evento => {
        if (evento.target.closest("[data-novedades]")) abrir();
    });

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", revisar);
    else revisar();

    window.novedadesVendeFrio = { version: VERSION, abrir };
}());
