// VendeFrío - El comercio pide solo (T88): la página del link.
// pedir.html?t=<token>. Entra sin cuenta (cuenta anónima de Firebase; si en
// este celular ya hay una sesión de VendeFrío, usa esa), lee el link y el
// catálogo de la distribuidora y manda el pedido a `pedidosWeb/`.
(function () {
    "use strict";

    const ICONOS = {"calendario": "<rect x=\"3\" y=\"4.5\" width=\"18\" height=\"17\" rx=\"2.5\"/><path d=\"M3 9.5h18M8 2.5v4M16 2.5v4\"/><path d=\"M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01\"/>", "refrescar": "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\"/><path d=\"M21 3v5h-5\"/><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\"/><path d=\"M8 16H3v5\"/>", "buscar": "<circle cx=\"11\" cy=\"11\" r=\"7.5\"/><path d=\"m21 21-4.3-4.3\"/>", "paquete": "<path d=\"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z\"/><path d=\"M12 22V12\"/><path d=\"M3.3 7 12 12l8.7-5\"/><path d=\"m7.5 4.27 9 5.15\"/>", "flechaDerecha": "<path d=\"M5 12h14\"/><path d=\"m13 6 6 6-6 6\"/>", "mas": "<path d=\"M12 5v14M5 12h14\"/>", "menos": "<path d=\"M5 12h14\"/>", "check": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m8 12 2.7 2.7L16.2 9.2\"/>", "alerta": "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"/><path d=\"M12 9v4M12 17h.01\"/>", "notaLapiz": "<path d=\"M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\"/><path d=\"M18.38 2.63a1 1 0 0 1 3 3l-9.01 9.01a2 2 0 0 1-.85.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.85z\"/>", "cerrarX": "<path d=\"M18 6 6 18M6 6l12 12\"/>"};
    const FOTOS = ["f1", "f2", "f3", "f4"];
    const tienda = document.getElementById("tienda");
    const barra = document.getElementById("barraPedir");
    const token = new URLSearchParams(window.location.search).get("t") || "";
    const CLAVE_ULTIMO = "vendefrio_pedir_ultimo_" + token;

    let enlace = null;
    let productos = [];
    const cantidades = new Map();
    let filtro = "";
    let enviando = false;

    function ico(nombre) {
        return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[nombre] || ""}</svg>`;
    }

    function esc(texto) {
        return String(texto ?? "").replace(/[&<>"']/g, letra => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[letra]));
    }

    function plata(numero) {
        return "$ " + Math.round(Number(numero) || 0).toLocaleString("es-AR");
    }

    function normal(texto) {
        return String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    }

    function clave(producto) {
        return producto.marca + "|" + producto.nombre;
    }

    function hoyISO() {
        const fecha = new Date();
        return fecha.getFullYear() + "-" + String(fecha.getMonth() + 1).padStart(2, "0") + "-" + String(fecha.getDate()).padStart(2, "0");
    }

    // Igual que en la app: la oferta (si es más barata) o el precio de su lista.
    function precios(producto) {
        const deLista = enlace.lista && producto.precios ? Number(producto.precios[enlace.lista]) : 0;
        const normalP = deLista > 0 ? deLista : Number(producto.precio) || 0;
        const oferta = producto.oferta && Number(producto.oferta.precio) > 0 && String(producto.oferta.hasta || "") >= hoyISO() ? Number(producto.oferta.precio) : 0;
        if (oferta && (!normalP || oferta < normalP)) return { precio: oferta, antes: normalP, promo: true };
        return { precio: normalP, antes: 0, promo: false };
    }

    function iniciales(nombre) {
        return String(nombre || "").split(/\s+/).filter(Boolean).slice(0, 2).map(palabra => palabra[0]).join("").toUpperCase() || "VF";
    }

    function error(titulo, texto) {
        barra.classList.add("oculto");
        tienda.innerHTML = `<div class="error card">${ico("alerta")}<h1 style="font-size:22px">${esc(titulo)}</h1><p>${esc(texto)}</p></div>`;
    }

    function dibujarProductos() {
        const grilla = tienda.querySelector(".grillaPedir");
        const buscado = normal(filtro);
        const visibles = productos.filter(producto => !buscado || normal(producto.nombre + " " + producto.marca).includes(buscado));
        let marca = "";
        const marcas = new Set(productos.map(producto => producto.marca));
        grilla.innerHTML = visibles.map((producto, indice) => {
            const { precio, antes, promo } = precios(producto);
            const cantidad = cantidades.get(clave(producto)) || 0;
            const titulo = marcas.size > 1 && producto.marca !== marca ? `<h2 class="marcaPedir">${esc(producto.marca)}</h2>` : "";
            marca = producto.marca;
            return titulo + `<div class="tarjetaProducto" data-clave="${esc(clave(producto))}">
                <div class="fotoPedir ${FOTOS[productos.indexOf(producto) % FOTOS.length]}">${ico("paquete")}</div>
                <div class="textoProducto">
                    <small>${esc(producto.marca)}</small>
                    <strong>${esc(producto.nombre)}</strong>
                    <b>${precio ? plata(precio) : "Consultar"}</b>
                    ${promo ? `<s>${plata(antes)}</s><span class="chipPromo">Promo</span>` : ""}
                </div>
                <div class="cantidadProducto">${cantidad
                    ? `<div class="stepperPedir"><button type="button" data-cambio="-1" aria-label="Uno menos de ${esc(producto.nombre)}">${ico("menos")}</button><b aria-label="Cantidad de ${esc(producto.nombre)}">${cantidad}</b><button type="button" data-cambio="1" aria-label="Uno más de ${esc(producto.nombre)}">${ico("mas")}</button></div>`
                    : `<button type="button" class="sumarProducto" data-cambio="1" aria-label="Agregar ${esc(producto.nombre)}">Agregar</button>`}</div>
            </div>`;
        }).join("") || `<p class="vacioPedir">No hay productos con «${esc(filtro)}».</p>`;
        dibujarBarra();
    }

    function dibujarBarra() {
        let total = 0;
        let cuantos = 0;
        productos.forEach(producto => {
            const cantidad = cantidades.get(clave(producto)) || 0;
            if (!cantidad) return;
            cuantos += 1;
            total += cantidad * precios(producto).precio;
        });
        barra.classList.toggle("oculto", !cuantos);
        document.getElementById("cantidadPedir").textContent = cuantos === 1 ? "1 producto" : cuantos + " productos";
        document.getElementById("totalPedir").textContent = plata(total);
    }

    function dibujar() {
        const ultimo = leerUltimo();
        const visita = enlace.visita ? "Te lo llevamos el " + enlace.visita.toLowerCase() : "Te lo llevamos en la próxima visita";
        tienda.innerHTML = `
            <div class="tiendaTop"><div class="logoTienda">${esc(iniciales(enlace.distribuidora))}</div><div><small>${esc(enlace.distribuidora)}</small><strong>Hola, ${esc(enlace.comercio)}</strong></div></div>
            <div class="bannerPedir">${ico("calendario")}<div><strong>Pedí hasta las 20 h</strong><small>${esc(visita)}</small></div></div>
            ${ultimo ? `<button type="button" class="botonSec" id="repetirPedir">${ico("refrescar")}Repetir mi último pedido</button>` : ""}
            <label class="buscadorPedir">${ico("buscar")}<input type="search" id="buscarPedir" placeholder="Buscar producto" aria-label="Buscar producto" autocomplete="off"></label>
            <div class="grillaPedir"></div>
            <label class="notaPedir">Algo para aclarar (opcional)<textarea id="notaPedir" maxlength="300" placeholder="Por ejemplo: traigan cambio de $ 20.000"></textarea></label>`;
        tienda.querySelector("#buscarPedir").addEventListener("input", evento => { filtro = evento.target.value; dibujarProductos(); });
        tienda.querySelector("#repetirPedir")?.addEventListener("click", () => {
            cantidades.clear();
            ultimo.forEach(item => {
                if (productos.some(producto => clave(producto) === item.marca + "|" + item.producto)) cantidades.set(item.marca + "|" + item.producto, item.cantidad);
            });
            dibujarProductos();
        });
        dibujarProductos();
    }

    function leerUltimo() {
        try {
            const datos = JSON.parse(localStorage.getItem(CLAVE_ULTIMO) || "null");
            return Array.isArray(datos) && datos.length ? datos : null;
        } catch (error) {
            return null;
        }
    }

    tienda.addEventListener("click", evento => {
        const boton = evento.target.closest("[data-cambio]");
        if (!boton) return;
        const tarjeta = boton.closest("[data-clave]");
        const llave = tarjeta.dataset.clave;
        const nueva = Math.max(0, Math.min(999, (cantidades.get(llave) || 0) + Number(boton.dataset.cambio)));
        if (nueva) cantidades.set(llave, nueva); else cantidades.delete(llave);
        dibujarProductos();
    });

    document.getElementById("enviarPedir").addEventListener("click", async () => {
        if (enviando) return;
        const lista = productos.filter(producto => cantidades.get(clave(producto)))
            .map(producto => ({ marca: producto.marca, producto: producto.nombre, cantidad: cantidades.get(clave(producto)) }));
        if (!lista.length) return;
        enviando = true;
        const boton = document.getElementById("enviarPedir");
        boton.disabled = true;
        boton.textContent = "Enviando…";
        try {
            await firebase.firestore().collection("pedidosWeb").add({
                token,
                idDistribuidora: enlace.idDistribuidora,
                comercio: enlace.comercio,
                productos: lista.slice(0, 80),
                nota: String(document.getElementById("notaPedir")?.value || "").trim().slice(0, 300),
                hora: Date.now(),
                estado: "nuevo",
                uid: firebase.auth().currentUser.uid
            });
            try { localStorage.setItem(CLAVE_ULTIMO, JSON.stringify(lista)); } catch (error) { /* nada */ }
            barra.classList.add("oculto");
            tienda.innerHTML = `<div class="listo"><span class="marcaListo">${ico("check")}</span><h1>¡Pedido enviado!</h1>
                <p>${esc(enlace.distribuidora)} ya lo recibió. Si hace falta algo, te escriben por WhatsApp.</p>
                <button type="button" class="botonSec" id="otroPedir" style="max-width:320px">Hacer otro pedido</button></div>`;
            document.getElementById("otroPedir").addEventListener("click", () => { cantidades.clear(); dibujar(); });
        } catch (error) {
            console.error("No se pudo enviar el pedido.", error);
            alert("No se pudo enviar el pedido. Revisá la conexión y probá de nuevo.");
        } finally {
            enviando = false;
            boton.disabled = false;
            boton.innerHTML = "Enviar pedido" + ico("flechaDerecha");
        }
    });
    document.getElementById("enviarPedir").innerHTML = "Enviar pedido" + ico("flechaDerecha");

    async function sesion() {
        const auth = firebase.auth();
        const actual = await new Promise(resolver => {
            const quitar = auth.onAuthStateChanged(usuario => { quitar(); resolver(usuario); });
        });
        if (actual) return actual;
        return (await auth.signInAnonymously()).user;
    }

    async function arrancar() {
        if (!/^[A-Za-z0-9]{20,40}$/.test(token)) {
            error("Este link no anda", "Pedile a tu distribuidora que te mande el link de nuevo.");
            return;
        }
        if (typeof firebase === "undefined" || !firebase.apps.length) {
            error("No se pudo abrir", "Revisá la conexión a internet y volvé a abrir el link.");
            return;
        }
        try {
            await sesion();
            const foto = await firebase.firestore().collection("enlacesPedido").doc(token).get();
            if (!foto.exists || foto.data().activo !== true) {
                error("Este link ya no está activo", "Pedile a tu distribuidora que te mande uno nuevo.");
                return;
            }
            enlace = foto.data();
            document.title = "Pedido para " + enlace.distribuidora;
            const catalogo = await firebase.firestore().collection("catalogosPublicos").doc(enlace.idDistribuidora).get();
            productos = (catalogo.exists && Array.isArray(catalogo.data().productos) ? catalogo.data().productos : [])
                .filter(producto => producto && producto.nombre);
            if (catalogo.exists && catalogo.data().nombre) enlace.distribuidora = catalogo.data().nombre;
            dibujar();
        } catch (falla) {
            console.error("No se pudo abrir el catálogo.", falla);
            error("No se pudo abrir el catálogo", "Revisá la conexión a internet y volvé a abrir el link.");
        }
    }

    arrancar();
}());
