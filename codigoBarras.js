// VendeFrío - Escanear código de barras (T89).
// En Nuevo pedido, "Escanear" abre la cámara: al leer el código muestra el
// producto con su precio y "Sumar al pedido". Usa el lector del navegador
// (BarcodeDetector, en Chrome de Android); si no hay cámara o lector, se
// escribe el número a mano. El código de cada producto se carga desde
// Catálogo > ⋯ > "Código de barras" (o desde una planilla, T84).
(function () {
    "use strict";

    const p = window.piezas;
    const FORMATOS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"];

    function limpiar(codigo) {
        return String(codigo || "").replace(/\D/g, "").slice(0, 20);
    }

    function productoConCodigo(codigo) {
        const buscado = limpiar(codigo);
        if (!buscado) return null;
        const productos = typeof productosParaLeer === "function" ? productosParaLeer() : {};
        for (const marca of Object.keys(productos)) {
            const producto = (productos[marca] || []).find(item => item && item.archivado !== true && limpiar(item.codigo) === buscado);
            if (producto) return { ...producto, marca };
        }
        return null;
    }

    function precioPara(producto) {
        const comercio = typeof buscarComercioPorNombre === "function"
            ? buscarComercioPorNombre(document.getElementById("cliente")?.value || "") : null;
        return typeof precioVigente === "function" ? precioVigente(producto, comercio) : Number(producto.precio) || 0;
    }

    // ---------- Pantalla de la cámara ----------
    let pantalla = null;
    let flujo = null;
    let leyendo = false;
    let cantidad = 1;
    let actual = null;

    function crear() {
        if (pantalla) return pantalla;
        pantalla = document.createElement("div");
        pantalla.id = "pantallaEscanear";
        pantalla.className = "pzEscanear oculto";
        pantalla.setAttribute("role", "dialog");
        pantalla.setAttribute("aria-modal", "true");
        pantalla.setAttribute("aria-label", "Escanear producto");
        pantalla.innerHTML = `
            <div class="fondoEscanear"></div>
            <video class="videoEscanear" playsinline muted></video>
            <div class="marcoEscanear"><span class="laserEscanear"></span></div>
            <div class="arribaEscanear">
                <button type="button" class="cerrarEscanear" aria-label="Cerrar">${p.ico("cerrarX", 22)}</button>
                <span>Escanear producto</span>
                <span class="espacioEscanear"></span>
            </div>
            <div class="hojaEscanear">
                <p class="estadoEscanear" aria-live="polite">Apuntá al código de barras</p>
                <div class="resultadoEscanear"></div>
                <form class="manualEscanear">
                    <input type="text" inputmode="numeric" autocomplete="off" id="codigoManual" placeholder="O escribí el número" aria-label="Número del código de barras">
                    <button type="submit" class="pzBtn pzBtnSec">Buscar</button>
                </form>
            </div>`;
        document.body.appendChild(pantalla);
        pantalla.querySelector(".cerrarEscanear").addEventListener("click", cerrar);
        pantalla.querySelector(".manualEscanear").addEventListener("submit", evento => {
            evento.preventDefault();
            mostrarResultado(pantalla.querySelector("#codigoManual").value);
        });
        pantalla.addEventListener("click", evento => {
            const boton = evento.target.closest("[data-cantidad]");
            if (boton) {
                cantidad = Math.max(1, Math.min(40, cantidad + Number(boton.dataset.cantidad)));
                pantalla.querySelector(".numeroEscanear").textContent = String(cantidad);
                return;
            }
            if (evento.target.closest("#sumarEscaneado")) sumar();
        });
        return pantalla;
    }

    function mostrarResultado(codigo) {
        const caja = pantalla.querySelector(".resultadoEscanear");
        const numero = limpiar(codigo);
        actual = productoConCodigo(numero);
        cantidad = 1;
        if (!numero) { caja.innerHTML = ""; return; }
        if (!actual) {
            caja.innerHTML = `<div class="pzBanner pzBanAviso">${p.ico("alerta", 22)}<div><strong>No hay un producto con el código ${p.esc(numero)}</strong><small>Cargalo en Catálogo › ⋯ › Código de barras.</small></div></div>`;
            if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
            return;
        }
        const precio = precioPara(actual);
        caja.innerHTML = `
            <div class="productoEscaneado">
                <div class="fotoEscaneado">${actual.imagen ? `<img src="${p.esc(actual.imagen)}" alt="">` : p.ico("paquete", 24)}</div>
                <div class="pzFilaTxt"><strong>${p.esc(actual.nombre)}</strong><small>${p.esc(actual.marca)} · ${precio ? p.plata(precio) : "sin precio"} · ${p.esc(numero)}</small></div>
            </div>
            <div class="accionesEscaneado">
                <div class="pzStepper"><button type="button" data-cantidad="-1" aria-label="Uno menos">−</button><b class="numeroEscanear">1</b><button type="button" data-cantidad="1" aria-label="Uno más">${p.ico("mas", 18)}</button></div>
                <button type="button" class="pzBtn pzBtnPri" id="sumarEscaneado">Sumar al pedido</button>
            </div>`;
        pantalla.querySelector(".estadoEscanear").textContent = "Encontrado";
        if (navigator.vibrate) navigator.vibrate(30);
    }

    function sumar() {
        if (!actual) return;
        const sumadas = window.agregarProductosAlPedido?.([{ marca: actual.marca, producto: actual.nombre, cantidad }], "") || 0;
        window.mostrarToast?.(sumadas ? actual.nombre + ": " + (sumadas === 1 ? "1 unidad" : sumadas + " unidades") + " al pedido" : "No se pudo sumar " + actual.nombre);
        actual = null;
        pantalla.querySelector(".resultadoEscanear").innerHTML = "";
        pantalla.querySelector("#codigoManual").value = "";
        pantalla.querySelector(".estadoEscanear").textContent = flujo ? "Apuntá al siguiente producto" : "Escribí el número del siguiente producto";
    }

    async function prenderCamara() {
        const estado = pantalla.querySelector(".estadoEscanear");
        if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
            pantalla.classList.add("sinCamara");
            estado.textContent = "Este celular no lee códigos con la cámara: escribí el número.";
            return;
        }
        try {
            const soportados = await window.BarcodeDetector.getSupportedFormats();
            const detector = new window.BarcodeDetector({ formats: FORMATOS.filter(formato => soportados.includes(formato)) });
            flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
            const video = pantalla.querySelector(".videoEscanear");
            video.srcObject = flujo;
            await video.play();
            leyendo = true;
            let ultimo = "";
            const leer = async () => {
                if (!leyendo) return;
                try {
                    const codigos = await detector.detect(video);
                    const valor = codigos[0] && codigos[0].rawValue;
                    if (valor && valor !== ultimo) { ultimo = valor; mostrarResultado(valor); }
                } catch (error) { /* sigue */ }
                setTimeout(leer, 250);
            };
            leer();
        } catch (error) {
            console.warn("No se pudo usar la cámara.", error);
            pantalla.classList.add("sinCamara");
            estado.textContent = "No se pudo abrir la cámara: escribí el número.";
        }
    }

    function abrir() {
        crear();
        pantalla.classList.remove("oculto", "sinCamara");
        document.documentElement.classList.add("conEscaner");
        pantalla.querySelector(".resultadoEscanear").innerHTML = "";
        pantalla.querySelector(".estadoEscanear").textContent = "Apuntá al código de barras";
        prenderCamara();
    }

    function cerrar() {
        leyendo = false;
        flujo?.getTracks().forEach(pista => pista.stop());
        flujo = null;
        pantalla?.classList.add("oculto");
        document.documentElement.classList.remove("conEscaner");
    }

    // "Escanear código de barras" está en el botón ⋯ de Nuevo pedido (T95).

    // ---------- Catálogo > ⋯ > Código de barras ----------
    function editar(producto) {
        p.hoja({
            titulo: "Código de barras",
            sub: producto.nombre + " · " + producto.marca,
            html: `<label class="pzCampo">Número del código<input type="text" inputmode="numeric" id="codigoProducto" maxlength="20" value="${p.esc(limpiar(producto.codigo))}" placeholder="Por ejemplo: 7790001234567"></label>
                <p class="pzHojaSub">Está abajo de las barras, en el envase. Con el código cargado, en Nuevo pedido tocás ⋯ > «Escanear código de barras» y se suma solo.</p>`,
            botones: [
                { texto: "Quitar", clase: "pzBtnGris", par: true, alTocar: () => guardar(producto, "") },
                { texto: "Guardar", par: true, alTocar: caja => guardar(producto, caja.querySelector("#codigoProducto").value) }
            ]
        });
    }

    function guardar(producto, valor) {
        const codigo = limpiar(valor);
        const otro = codigo ? productoConCodigo(codigo) : null;
        if (otro && otro.id !== producto.id) {
            window.mostrarToast?.("Ese código ya es de " + otro.nombre + ".", "error");
            return false;
        }
        if (!actualizarProductoPorId(producto.id, { codigo })) {
            window.mostrarToast?.("No se pudo guardar.", "error");
            return false;
        }
        window.renderizarCatalogo?.();
        window.mostrarToast?.(codigo ? "Código guardado" : "Código quitado");
        return true;
    }

    (window.opcionesProductoExtras = window.opcionesProductoExtras || []).push({
        opcion: "codigo", icono: "codigo",
        texto: producto => limpiar(producto.codigo) ? "Código de barras: " + limpiar(producto.codigo) : "Código de barras",
        abrir: editar
    });

    window.codigoBarrasVendeFrio = { abrir, cerrar, productoConCodigo, mostrarResultado: codigo => { crear(); mostrarResultado(codigo); } };
}());
