// =====================================================
// VendeFrío - notasDeCambios.js
// Notas de cambios, como las de los juegos: al tocar la tarjeta "Hay una
// versión nueva" de Inicio se abre una ventana con lo que cambió, en palabras
// simples. Las notas están en notas.json (cada hilo suma la suya al subir un
// cambio, ver "Notas de cambios" en WORKING_GUIDE.md). Se muestra solo lo
// que este celular todavía no vio: se guarda la versión más alta que vio.
// Si actualizó sin mirarlas, Inicio muestra "La app se actualizó" una vez.
// =====================================================
(function () {
    const CLAVE = "vendefrio_notas_vistas";
    // Quien pasa varias versiones de golpe ve todo lo acumulado; el tope es
    // solo por si acaso. Con muchas, van en páginas que se deslizan de costado.
    const MAXIMO = 60;
    const POR_PAGINA = 6;
    const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

    const pz = () => window.piezas;
    let ventana = null;
    let alActualizar = null;

    function valida(nota) {
        return nota && Number.isFinite(Number(nota.version)) && typeof nota.titulo === "string" && nota.titulo.trim();
    }

    // Sin service worker se pide al servidor; con él, sale de la versión que
    // bajó (la nueva, si ya llegó): así la versión vieja ve las notas nuevas.
    async function leerNotas() {
        try {
            const respuesta = await fetch("notas.json", { cache: "no-cache" });
            if (!respuesta.ok) return [];
            const datos = await respuesta.json();
            const notas = Array.isArray(datos?.notas) ? datos.notas.filter(valida) : [];
            return notas.sort((a, b) => Number(b.version) - Number(a.version));
        } catch (error) {
            return [];
        }
    }

    function leerVista() {
        try {
            const texto = localStorage.getItem(CLAVE);
            return texto === null ? null : Number(texto) || 0;
        } catch (error) {
            return null;
        }
    }

    function marcarVista(version) {
        if (!Number.isFinite(version)) return;
        try {
            if (version > (leerVista() || 0)) localStorage.setItem(CLAVE, String(version));
        } catch (error) {
            // Sin lugar: se vuelven a mostrar la próxima vez.
        }
    }

    function sinVer(notas) {
        const vista = leerVista() || 0;
        return notas.filter(nota => Number(nota.version) > vista).slice(0, MAXIMO);
    }

    function cuantos(cantidad) {
        return cantidad === 1 ? "1 cambio" : cantidad + " cambios";
    }

    function fechaCorta(texto) {
        const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto || ""));
        return partes ? Number(partes[3]) + " " + MESES[Number(partes[2]) - 1].slice(0, 3) : "";
    }

    // Una ventana en el medio, como las notas de los juegos (opción B que
    // eligió el dueño). Se cierra con "Después", tocando afuera, deslizándola
    // hacia abajo o con el atrás del celular.
    function crearVentana() {
        ventana = document.createElement("div");
        ventana.className = "modal oculto ventanaNotas";
        ventana.innerHTML = `
            <div class="notasCaja" role="dialog" aria-modal="true" aria-labelledby="tituloNotas">
                <div class="notasBanda"><small class="notasCuando"></small><h2 id="tituloNotas">¡Hay cosas nuevas!</h2></div>
                <div class="notasLista"></div>
                <div class="notasPaginas" hidden>
                    <div class="notasPuntos" aria-hidden="true"></div>
                    <span class="notasNumero"></span>
                </div>
                <div class="notasPie">
                    <button type="button" class="notasCerrar">Después</button>
                    <button type="button" class="notasActualizar">Actualizar ahora</button>
                </div>
            </div>`;
        document.body.appendChild(ventana);
        const cerrar = () => ventana.classList.add("oculto");
        ventana.querySelector(".notasCerrar").addEventListener("click", cerrar);
        ventana.addEventListener("click", evento => { if (evento.target === ventana) cerrar(); });
        // Páginas: se deslizan con el dedo (el navegador hace el trabajo);
        // los puntitos dicen en cuál estás.
        const lista = ventana.querySelector(".notasLista");
        let cuadro = 0;
        lista.addEventListener("scroll", () => {
            if (!cuadro) cuadro = requestAnimationFrame(() => { cuadro = 0; marcarPagina(); });
        }, { passive: true });
        ventana.querySelector(".notasActualizar").addEventListener("click", () => {
            const boton = ventana.querySelector(".notasActualizar");
            boton.disabled = true;
            boton.textContent = "Actualizando…";
            (alActualizar || (() => window.location.reload()))();
        });
    }

    function seccion(clase, icono, titulo, notas) {
        if (!notas.length) return "";
        const p = pz();
        return `<div class="notasSeccion ${clase}"><h3>${window.icono(icono, 18)}${titulo}</h3><ul>` +
            notas.map(nota => `<li class="notaFila"><b>${p.esc(nota.titulo)}.</b>${nota.texto ? " <span>" + p.esc(nota.texto) + "</span>" : ""}</li>`).join("") +
            "</ul></div>";
    }

    // Cada sección se corta en páginas de POR_PAGINA notas.
    function paginas(clase, icono, titulo, notas) {
        const lista = [];
        for (let i = 0; i < notas.length; i += POR_PAGINA) {
            lista.push(seccion(clase, icono, titulo, notas.slice(i, i + POR_PAGINA)));
        }
        return lista;
    }

    function cantidadPaginas() {
        return ventana.querySelectorAll(".notasPagina").length;
    }

    function paginaActual() {
        const lista = ventana.querySelector(".notasLista");
        return lista.clientWidth ? Math.round(lista.scrollLeft / lista.clientWidth) : 0;
    }

    function marcarPagina() {
        const total = cantidadPaginas();
        const actual = Math.min(total - 1, paginaActual());
        ventana.querySelectorAll(".notasPuntos i").forEach((punto, indice) => punto.classList.toggle("activo", indice === actual));
        ventana.querySelector(".notasNumero").textContent = (actual + 1) + " de " + total;
        ajustarAlto(actual);
    }

    // La tarjeta toma el largo de la página que se ve: los puntitos quedan
    // pegados al texto, sin hueco (pedido del dueño).
    function ajustarAlto(actual) {
        const pagina = ventana.querySelectorAll(".notasPagina")[actual];
        if (pagina) ventana.querySelector(".notasLista").style.height = pagina.scrollHeight + "px";
    }

    function dibujar(notas) {
        const lista = ventana.querySelector(".notasLista");
        ventana.querySelector(".notasCuando").textContent = ["Notas de la versión", fechaCorta(notas[0]?.fecha)].filter(Boolean).join(" · ");
        ventana.querySelector("#tituloNotas").textContent = notas.length ? "¡Hay cosas nuevas!" : "Arreglos chicos";
        if (!notas.length) {
            lista.innerHTML = '<div class="notasPagina"><p class="notasVacio">Esta vez son arreglos chicos para que todo ande mejor.</p></div>';
            ventana.querySelector(".notasPaginas").hidden = true;
            return;
        }
        const todas = paginas("", "chispa", "Nuevo y mejor", notas.filter(nota => nota.tipo !== "arreglado"))
            .concat(paginas("notasArreglado", "herramientas", "Arreglado", notas.filter(nota => nota.tipo === "arreglado")));
        lista.innerHTML = todas.map(html => `<div class="notasPagina">${html}</div>`).join("");
        ventana.querySelector(".notasPuntos").innerHTML = todas.length > 12 ? "" : todas.map(() => "<i></i>").join("");
        ventana.querySelector(".notasPaginas").hidden = todas.length < 2;
    }

    // conActualizar: desde "Hay una versión nueva" (el botón actualiza).
    async function abrir({ conActualizar = false, actualizar = null } = {}) {
        if (!ventana) crearVentana();
        alActualizar = actualizar;
        const notas = await leerNotas();
        let mostrar = sinVer(notas);
        // Sin nada nuevo desde "Ya actualizada": las últimas, para no abrir vacía.
        if (!mostrar.length && !conActualizar) mostrar = notas.slice(0, MAXIMO);
        dibujar(mostrar);
        ventana.querySelector(".notasActualizar").hidden = !conActualizar;
        ventana.querySelector(".notasActualizar").disabled = false;
        ventana.querySelector(".notasActualizar").textContent = "Actualizar ahora";
        ventana.querySelector(".notasCerrar").textContent = conActualizar ? "Después" : "Entendido";
        ventana.classList.toggle("notasSinActualizar", !conActualizar);
        ventana.querySelector(".notasLista").scrollLeft = 0;
        ventana.classList.remove("oculto");
        ventana.querySelector(".notasLista").style.height = "";
        if (cantidadPaginas() > 1) marcarPagina();
        if (notas.length) marcarVista(Number(notas[0].version));
        avisoActualizada(0);
    }

    // Cuántos cambios trae la versión nueva (para la tarjeta de Inicio).
    async function cuantasNuevas() {
        return sinVer(await leerNotas()).length;
    }

    // "La app se actualizó": si este celular tiene notas que todavía no vio
    // (actualizó sin tocar la tarjeta), una tarjeta en Inicio hasta que la mire.
    function avisoActualizada(cantidad) {
        if (!pz()) return;
        pz().avisoInicio("avisoNotasCambios", cantidad > 0 ? {
            color: "Pri",
            icono: "chispa",
            titulo: "La app se actualizó",
            texto: "Trae " + cuantos(cantidad) + ".",
            destacado: "Tocá para ver qué cambió",
            etiqueta: "La app se actualizó. Tocá para ver qué cambió",
            alTocar: () => abrir(),
            orden: 0
        } : null, "arriba");
    }

    async function revisarAlAbrir() {
        const notas = await leerNotas();
        if (!notas.length) return;
        if (leerVista() === null) {
            // Celular nuevo: no hay nada "de antes" que contar.
            if (!window.novedadesVendeFrio?.hayDatosDeAntes?.()) {
                marcarVista(Number(notas[0].version));
                return;
            }
        }
        avisoActualizada(sinVer(notas).length);
    }

    // Después de que la app termina de arrancar, sin apurar al celular.
    function alArrancar() {
        if (window.vendefrioPruebas?.notasDeCambios === false) return;
        setTimeout(revisarAlAbrir, 2500);
    }
    if (document.readyState === "complete") alArrancar();
    else window.addEventListener("load", alArrancar);

    window.notasDeCambiosVendeFrio = { abrir, cuantasNuevas, leerNotas, revisarAlAbrir };
}());
