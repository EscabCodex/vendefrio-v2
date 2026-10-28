// VendeFrío - El comercio pide solo (T88).
// Desde la ficha del comercio se manda por WhatsApp un link personal
// (pedir.html?t=...). El comercio ve el catálogo con sus precios, arma el
// pedido y lo envía, sin cuenta. El pedido llega a Inicio ("X pidió por el
// link") y quien lo toma lo guarda como "Cargado", igual que uno cargado a
// mano. Solo con la nube: el link usa `enlacesPedido/`, el catálogo
// `catalogosPublicos/` y los pedidos `pedidosWeb/`.
(function () {
    "use strict";

    const p = window.piezas;
    const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const CLAVE_PUBLICADO = "vendefrio_catalogo_publico";
    const MAXIMO_PRODUCTOS = 600;

    function db() {
        return window.firebase.firestore();
    }

    function idDistribuidora() {
        return window.distribuidoraVendeFrio?.idActual?.() || "";
    }

    function enLaNube() {
        return Boolean(p.refNube()) && Boolean(idDistribuidora());
    }

    function nombreDistribuidora() {
        return String(window.distribuidoraVendeFrio?.nombreActual?.() || "Tu distribuidora").slice(0, 80);
    }

    function nuevoToken() {
        const azar = new Uint32Array(22);
        crypto.getRandomValues(azar);
        return Array.from(azar, numero => LETRAS[numero % LETRAS.length]).join("");
    }

    function direccionDe(token) {
        return new URL("pedir.html?t=" + token, window.location.href).href;
    }

    // ---------- Catálogo público ----------
    // Lo que ve el comercio: nombre, marca, precio, listas y oferta. Sin
    // fotos (pesan) ni productos archivados.
    // Se arma una vez por cambio del catálogo (y por día, por las ofertas):
    // se revisa con cada dibujo de Inicio (repasada).
    function catalogo() {
        if (typeof recordarHastaQueCambie !== "function") return armarCatalogo();
        return recordarHastaQueCambie("catalogoPublico", ["productos"], () => Object.freeze(armarCatalogo()), new Date().toDateString()).slice();
    }

    function armarCatalogo() {
        const productos = typeof productosParaLeer === "function" ? productosParaLeer() : {};
        const lista = [];
        Object.keys(productos).forEach(marca => (productos[marca] || []).forEach(producto => {
            if (!producto || producto.archivado === true || lista.length >= MAXIMO_PRODUCTOS) return;
            const item = { marca: String(marca).slice(0, 60), nombre: String(producto.nombre || "").slice(0, 80), precio: Number(producto.precio) || 0 };
            if (producto.precios && typeof producto.precios === "object") {
                const precios = {};
                Object.keys(producto.precios).slice(0, 20).forEach(clave => {
                    const valor = Number(producto.precios[clave]);
                    if (valor > 0) precios[String(clave).slice(0, 40)] = valor;
                });
                if (Object.keys(precios).length) item.precios = precios;
            }
            const oferta = typeof ofertaVigente === "function" ? ofertaVigente(producto) : null;
            if (oferta) item.oferta = { precio: oferta.precio, hasta: oferta.hasta };
            lista.push(item);
        }));
        return lista;
    }

    async function publicarCatalogo(forzar) {
        if (!enLaNube()) return false;
        const productos = catalogo();
        const firma = JSON.stringify([idDistribuidora(), nombreDistribuidora(), productos]);
        const anterior = p.lsLeer(CLAVE_PUBLICADO, null);
        if (!forzar && (!anterior || anterior.firma === firma)) return false;
        await db().collection("catalogosPublicos").doc(idDistribuidora()).set({
            nombre: nombreDistribuidora(),
            productos,
            horaCelular: Date.now()
        });
        p.lsGuardar(CLAVE_PUBLICADO, { firma, hora: Date.now() });
        return true;
    }

    // ---------- Link para un comercio ----------
    async function enlaceDe(comercio) {
        const consulta = await db().collection("enlacesPedido")
            .where("idDistribuidora", "==", idDistribuidora())
            .where("comercio", "==", comercio.nombre)
            .limit(1).get();
        if (!consulta.empty) return consulta.docs[0].id;
        const token = nuevoToken();
        await db().collection("enlacesPedido").doc(token).set({
            idDistribuidora: idDistribuidora(),
            comercio: String(comercio.nombre).slice(0, 80),
            distribuidora: nombreDistribuidora(),
            lista: String(comercio.listaPrecios || "").slice(0, 40),
            visita: String(comercio.diaVisita || "").slice(0, 20),
            activo: true,
            creado: Date.now()
        });
        return token;
    }

    async function mandarLink(comercio) {
        if (!enLaNube()) return;
        const hoja = p.hoja({
            titulo: "Link para que pida solo",
            sub: comercio.nombre,
            etiqueta: "Link para que pida solo",
            html: `<p class="pzHojaSub" id="estadoLinkPedido">${p.ico("reloj", 18)} Preparando el link…</p>`
        });
        let token;
        try {
            await publicarCatalogo(true);
            token = await enlaceDe(comercio);
        } catch (error) {
            console.error("No se pudo crear el link para pedir.", error);
            hoja.querySelector("#estadoLinkPedido").textContent = "No se pudo crear el link. Revisá la conexión y que las reglas nuevas estén publicadas.";
            return;
        }
        const direccion = direccionDe(token);
        const texto = "Hola " + comercio.nombre + ", desde este link podés hacernos el pedido cuando quieras: " + direccion;
        const telefono = String(comercio.telefono || "").replace(/\D/g, "");
        const numero = telefono ? (telefono.startsWith("54") ? telefono : "549" + telefono.replace(/^0/, "")) : "";
        hoja.querySelector(".pzHojaCuerpo").innerHTML = `
            <div class="pzLinkPedido">
                <span>${p.ico("compartir", 20)}</span>
                <code id="linkPedido">${p.esc(direccion)}</code>
            </div>
            <p class="pzHojaSub">Ve el catálogo con sus precios y te manda el pedido. Llega a Inicio para que lo cargues con un toque.</p>
            <a class="pzBtn pzBtnWa" id="mandarLinkWa" href="https://wa.me/${numero}?text=${encodeURIComponent(texto)}" target="_blank" rel="noopener">${p.ico("whatsapp", 20)}Mandar por WhatsApp</a>
            <button type="button" class="pzBtn pzBtnGris" id="copiarLinkPedido">${p.ico("copiar", 20)}Copiar link</button>`;
        hoja.querySelector("#copiarLinkPedido").addEventListener("click", () => {
            navigator.clipboard?.writeText(direccion).then(() => mostrarToast?.("Link copiado")).catch(() => {});
        });
    }

    (window.accionesFichaComercioExtras = window.accionesFichaComercioExtras || []).push((comercio, crearBoton, cerrarFicha) => {
        if (!enLaNube() || comercio.archivado === true) return null;
        return crearBoton(p.ico("compartir", 14) + " Link para que pida solo", "secundario", () => { cerrarFicha(); mandarLink(comercio); });
    });

    // ---------- Pedidos que llegan ----------
    let pedidos = [];
    let quitar = null;
    let escuchando = "";

    function revisarEscucha() {
        const clave = enLaNube() ? idDistribuidora() : "";
        if (clave === escuchando) return;
        if (quitar) { try { quitar(); } catch (error) { /* nada */ } }
        quitar = null;
        pedidos = [];
        escuchando = clave;
        if (!clave) { dibujarAviso(); return; }
        quitar = db().collection("pedidosWeb")
            .where("idDistribuidora", "==", clave)
            .where("estado", "==", "nuevo")
            .limit(50)
            .onSnapshot(foto => {
                pedidos = foto.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (Number(a.hora) || 0) - (Number(b.hora) || 0));
                dibujarAviso();
            }, error => console.warn("No se pudieron leer los pedidos del link.", error));
    }

    function unidades(pedido) {
        return (pedido.productos || []).reduce((suma, item) => suma + (Number(item.cantidad) || 0), 0);
    }

    function dibujarAviso() {
        if (!pedidos.length) { p.avisoInicio("avisoPedidosWeb", null); return; }
        const primero = pedidos[0];
        p.avisoInicio("avisoPedidosWeb", {
            color: "Ok",
            icono: "compartir",
            titulo: pedidos.length === 1 ? primero.comercio + " pidió por el link" : pedidos.length + " pedidos llegaron por el link",
            texto: pedidos.length === 1
                ? (primero.productos || []).length + " productos · " + unidades(primero) + " unidades · " + p.hora(primero.hora)
                : pedidos.map(pedido => pedido.comercio).join(", "),
            boton: "Ver pedido" + (pedidos.length === 1 ? "" : "s"),
            claseBoton: "pzBtnSec",
            etiqueta: "Ver pedido" + (pedidos.length === 1 ? "" : "s") + " del link",
            alTocar: () => verPedido(pedidos[0].id)
        }, "arriba");
    }

    function verPedido(id) {
        const pedido = pedidos.find(item => item.id === id);
        if (!pedido) return;
        const filas = (pedido.productos || []).map(item => `<div class="pzFila filaPedidoWeb">
                <span class="pzIni ${p.colorIni(item.producto)}">${p.esc(String(item.cantidad))}</span>
                <span class="pzFilaTxt"><strong>${p.esc(item.producto)}</strong><small>${p.esc(item.marca)}</small></span>
            </div>`).join("");
        p.hoja({
            titulo: pedido.comercio,
            sub: "Pidió por el link · " + p.fechaCorta(pedido.hora) + " " + p.hora(pedido.hora) + (pedidos.length > 1 ? " · 1 de " + pedidos.length : ""),
            etiqueta: "Pedido del link de " + pedido.comercio,
            html: `<div class="pzTarjeta pzLista">${filas}</div>${pedido.nota ? `<p class="pzNotaPedidoWeb">${p.ico("notaLapiz", 18)}<span>${p.esc(pedido.nota)}</span></p>` : ""}`,
            botones: [
                { texto: "Descartar", clase: "pzBtnGris", par: true, alTocar: () => descartar(pedido) },
                { texto: "Cargar pedido", icono: "check", par: true, id: "cargarPedidoWeb", alTocar: () => cargar(pedido) }
            ]
        });
    }

    function personaQueAtiende() {
        const yo = p.persona();
        return String(yo && yo.nombre || "").slice(0, 60);
    }

    // Lo toma una sola persona: la regla deja pasar de "nuevo" a "cargado"
    // una sola vez, y la transacción avisa si otro se adelantó.
    async function tomar(pedido, estado, idPedido) {
        const ref = db().collection("pedidosWeb").doc(pedido.id);
        await db().runTransaction(async transaccion => {
            const foto = await transaccion.get(ref);
            if (!foto.exists || foto.data().estado !== "nuevo") throw new Error("ya");
            transaccion.update(ref, { estado, atendido: { nombre: personaQueAtiende(), hora: Date.now(), idPedido: idPedido || "" } });
        });
    }

    async function descartar(pedido) {
        if (!(await p.preguntar({ icono: "alerta", color: "aviso", titulo: "¿Descartar el pedido?", texto: "No se carga. " + pedido.comercio + " no recibe aviso.", si: "Descartar", claseSi: "pzBtnPeligro" }))) return;
        try {
            await tomar(pedido, "descartado");
        } catch (error) {
            mostrarToast?.(error.message === "ya" ? "Otra persona ya lo atendió." : "No se pudo guardar. Revisá la conexión.", "error");
        }
    }

    async function cargar(pedido) {
        const comercio = typeof buscarComercioPorNombre === "function" ? buscarComercioPorNombre(pedido.comercio) : null;
        if (!comercio) {
            mostrarToast?.("No está el comercio " + pedido.comercio + ". Fijate si lo archivaron.", "error");
            return;
        }
        try {
            const foto = await db().collection("pedidosWeb").doc(pedido.id).get();
            if (!foto.exists || foto.data().estado !== "nuevo") throw new Error("ya");
        } catch (error) {
            mostrarToast?.(error.message === "ya" ? "Otra persona ya lo cargó." : "No se pudo revisar el pedido. Revisá la conexión.", "error");
            return;
        }
        if (typeof abrirPedidoNuevoParaComercio !== "function" || typeof generarPedido !== "function") return;
        abrirPedidoNuevoParaComercio(pedido.comercio);
        window.agregarProductosAlPedido?.(pedido.productos || [], pedido.comercio);
        const observaciones = document.getElementById("obs");
        if (observaciones) {
            observaciones.value = ("Pidió por el link" + (pedido.nota ? ": «" + pedido.nota + "»" : "")).slice(0, 300);
            observaciones.dispatchEvent(new Event("input", { bubbles: true }));
        }
        const antes = new Set((typeof historialParaLeer === "function" ? historialParaLeer() : []).map(item => item.id));
        const guardado = generarPedido();
        document.getElementById("modalPedido")?.classList.add("oculto");
        if (!guardado) {
            mostrarToast?.("Revisá el pedido y guardalo a mano.", "error");
            return;
        }
        const nuevo = (typeof historialParaLeer === "function" ? historialParaLeer() : []).find(item => !antes.has(item.id) && item.comercio === pedido.comercio);
        try {
            await tomar(pedido, "cargado", nuevo ? nuevo.id : "");
        } catch (error) {
            console.warn("El pedido del link se cargó, pero no se pudo marcar.", error);
        }
        if (typeof limpiarPedido === "function") limpiarPedido();
        if (typeof mostrarPantalla === "function") mostrarPantalla("menu");
        mostrarToast?.("Pedido de " + pedido.comercio + " cargado");
    }

    // Revisa la escucha y, si cambió el catálogo, lo vuelve a publicar
    // (solo si alguna vez se mandó un link desde este celular).
    function revisar() {
        try {
            revisarEscucha();
            if (enLaNube()) publicarCatalogo(false).catch(error => console.warn("No se pudo publicar el catálogo.", error));
        } catch (error) {
            console.warn("Falló la revisión de pedidos por link.", error);
        }
    }

    if (typeof window.actualizarDashboard === "function") {
        const original = window.actualizarDashboard;
        window.actualizarDashboard = function () {
            const resultado = original.apply(this, arguments);
            revisar();
            return resultado;
        };
    }
    setInterval(revisar, 30000);
    setTimeout(revisar, 0);

    window.pedidoWebVendeFrio = { catalogo, publicarCatalogo, mandarLink, verPedido, pedidos: () => pedidos.slice(), direccionDe };
}());
