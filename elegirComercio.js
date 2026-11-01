// VendeFrío - Elegir el comercio de Nuevo pedido (repaso de diseño,
// aprobado por el dueño el 2026-11-01).
// Sin comercio, arriba se ve la tarjeta "Elegí un comercio". Al tocarla (o
// "Cambiar" en la tarjeta del comercio) se abre una hoja con la lupa y los
// filtros Para hoy · Todos · Cerca y la lista de comercios. Si lo que se
// escribe no es un comercio guardado, ofrece crearlo con ese nombre o hacer
// el pedido igual.
//   Para hoy: los que tienen hoy como día de visita y los de la ruta de hoy.
//   Cerca: los que están a 1 km o menos de donde estás (GPS), el más cerca
//   primero. Si el celular no da la ubicación, el botón no aparece.
// El campo #cliente sigue siendo el que manda: elegir un comercio le pone el
// nombre y avisa (input y change), como si se hubiera escrito.
//   window.elegirComercioVendeFrio.abrir()
(function () {
    "use strict";

    const pantalla = document.getElementById("pantallaPedido");
    const input = document.getElementById("cliente");
    const tarjeta = pantalla && pantalla.querySelector(".clientePedido");
    const p = window.piezas;
    if (!pantalla || !input || !tarjeta || !p) return;

    const RADIO_CERCA_KM = 1;
    const MAXIMO_FILAS = 150;
    const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const sinTildes = texto => String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es").trim();

    // ---------- La tarjeta "Elegí un comercio" ----------
    // El campo queda encima de la tarjeta, transparente: tocarlo abre la hoja
    // (sin teclado); escribir en él (el asistente, el dictado) sigue andando.
    tarjeta.classList.add("elegirComercioPedido");
    const vista = document.createElement("span");
    vista.className = "elegirComercioVista";
    vista.setAttribute("aria-hidden", "true");
    tarjeta.appendChild(vista);
    input.setAttribute("aria-label", "Elegí un comercio");
    input.setAttribute("autocomplete", "off");

    function dibujarVista() {
        const cantidad = comerciosActivos().length;
        const html = `<span class="elegirComercioIcono">${p.ico("tienda", 24)}</span>
            <span class="elegirComercioTxt"><strong>Elegí un comercio</strong><small>${cantidad ? `Tocá para buscar entre tus ${cantidad} ${cantidad === 1 ? "comercio" : "comercios"}` : "Tocá para elegirlo o crear uno"}</small></span>
            ${p.ico("chevDerecha", 20)}`;
        if (vista.innerHTML !== html) vista.innerHTML = html;
    }

    let tocado = 0;
    const alTocar = evento => {
        if (evento.button !== undefined && evento.button !== 0) return;
        evento.preventDefault();
        tocado = Date.now();
        input.blur();
        abrir();
    };
    input.addEventListener("pointerdown", alTocar);
    input.addEventListener("mousedown", evento => evento.preventDefault());
    input.addEventListener("touchstart", evento => evento.preventDefault(), { passive: false });
    // Si igual el celular le dio el foco al tocar, se saca (sin teclado).
    input.addEventListener("focus", () => { if (Date.now() - tocado < 800) input.blur(); });
    input.addEventListener("keydown", evento => {
        if (evento.key === "Enter" || evento.key === " ") alTocar(evento);
    });

    // ---------- Los comercios ----------
    function comerciosActivos() {
        const todos = typeof obtenerComercios === "function" ? obtenerComercios() : [];
        return todos.filter(comercio => comercio && comercio.nombre && !(typeof comercioArchivado === "function" && comercioArchivado(comercio)));
    }

    function enLaRutaDeHoy() {
        try {
            return new Set((typeof obtenerComerciosElegidosParaRuta === "function" ? obtenerComerciosElegidosParaRuta() : []).map(comercio => comercio.nombre));
        } catch (error) {
            return new Set();
        }
    }

    function esParaHoy(comercio, ruta) {
        const hoy = DIAS[new Date().getDay()];
        return sinTildes(comercio.diaVisita) === sinTildes(hoy) || ruta.has(comercio.nombre);
    }

    function visitado(comercio) {
        try {
            return typeof estaVisitadoEstaSemana === "function" && estaVisitadoEstaSemana(comercio);
        } catch (error) {
            return false;
        }
    }

    function distanciaKm(a, b) {
        const rad = grados => grados * Math.PI / 180;
        const dLat = rad(b.lat - a.lat);
        const dLng = rad(b.lng - a.lng);
        const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
        return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    }

    const tieneLugar = comercio => Number.isFinite(Number(comercio.lat)) && Number.isFinite(Number(comercio.lng)) && !(Number(comercio.lat) === 0 && Number(comercio.lng) === 0);

    // Dónde estás: se pregunta al tocar "Cerca" (o al abrir, si el permiso ya
    // está dado). null si no se sabe; false si el celular no la da.
    let aqui = null;
    let pidiendo = false;

    function pedirUbicacion(alSaber) {
        if (!navigator.geolocation) {
            aqui = false;
            alSaber();
            return;
        }
        if (pidiendo) return;
        pidiendo = true;
        navigator.geolocation.getCurrentPosition(posicion => {
            pidiendo = false;
            aqui = { lat: posicion.coords.latitude, lng: posicion.coords.longitude };
            alSaber();
        }, () => {
            pidiendo = false;
            aqui = false;
            alSaber();
        }, { enableHighAccuracy: false, maximumAge: 120000, timeout: 10000 });
    }

    // ---------- La hoja ----------
    let caja = null;
    let filtro = "";
    let buscador = null;

    function filasDe(lista, conDistancia) {
        return lista.slice(0, MAXIMO_FILAS).map(({ comercio, km }) => {
            const lugar = comercio.direccion
                ? `<small>${p.esc(comercio.direccion)}${conDistancia && km !== undefined ? " · " + (km < 1 ? Math.round(km * 1000 / 10) * 10 + " m" : km.toFixed(1).replace(".", ",") + " km") : ""}</small>`
                : `<small><button type="button" class="agregarDireccionElegir" data-agregar-direccion="${p.esc(comercio.nombre)}">${p.ico("mas", 14)} Agregar dirección</button></small>`;
            const ok = visitado(comercio);
            return `<div class="filaElegirComercio" role="button" tabindex="0" data-elegir="${p.esc(comercio.nombre)}" aria-label="Elegir ${p.esc(comercio.nombre)}">
                <span class="pzIni ${p.colorIni(comercio.nombre)}">${p.esc(p.iniciales(comercio.nombre))}</span>
                <span class="filaElegirTxt"><strong>${p.esc(comercio.nombre)}</strong>${lugar}</span>
                <span class="estadoElegirComercio ${ok ? "visitado" : "pendiente"}">${ok ? "Visitado" : "Pendiente"}</span>
            </div>`;
        }).join("");
    }

    function dibujarHoja() {
        if (!caja || !caja.isConnected) return;
        const todos = comerciosActivos();
        const ruta = enLaRutaDeHoy();
        const paraHoy = todos.filter(comercio => esParaHoy(comercio, ruta));
        const conLugar = todos.filter(tieneLugar);
        const cerca = aqui ? conLugar.map(comercio => ({ comercio, km: distanciaKm(aqui, { lat: Number(comercio.lat), lng: Number(comercio.lng) }) }))
            .filter(item => item.km <= RADIO_CERCA_KM).sort((a, b) => a.km - b.km) : [];
        const hayCerca = aqui !== false && conLugar.length > 0;
        if (!filtro) filtro = paraHoy.length ? "hoy" : "todos";
        if (filtro === "cerca" && !hayCerca) filtro = "todos";

        const texto = sinTildes(buscador ? buscador.value : "");
        const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, "es");
        let lista;
        if (texto) {
            lista = todos.filter(comercio => sinTildes(comercio.nombre).includes(texto) || sinTildes(comercio.direccion).includes(texto))
                .sort((a, b) => Number(!sinTildes(a.nombre).startsWith(texto)) - Number(!sinTildes(b.nombre).startsWith(texto)) || porNombre(a, b))
                .map(comercio => ({ comercio }));
        } else if (filtro === "hoy") {
            lista = paraHoy.sort((a, b) => Number(visitado(a)) - Number(visitado(b)) || porNombre(a, b)).map(comercio => ({ comercio }));
        } else if (filtro === "cerca") {
            lista = cerca;
        } else {
            lista = todos.sort(porNombre).map(comercio => ({ comercio }));
        }

        const boton = (clave, nombre, cantidad) => `<button type="button" class="filtroEtapa${!texto && filtro === clave ? " activo" : ""}" data-filtro-comercio="${clave}" aria-pressed="${!texto && filtro === clave}"><span class="filtroEtapaNombre">${nombre}</span>${cantidad === null ? "" : `<small class="filtroEtapaCantidad">${cantidad}</small>`}</button>`;
        // Solo los botones: la lupa (con el teclado abierto) no se toca.
        const botones = caja.querySelector(".botonesElegirComercio");
        const htmlBotones = boton("hoy", "Para hoy", paraHoy.length) + boton("todos", "Todos", todos.length)
            + (hayCerca ? boton("cerca", "Cerca", aqui ? cerca.length : null) : "");
        if (botones.innerHTML !== htmlBotones) botones.innerHTML = htmlBotones;

        const cuerpo = caja.querySelector(".listaElegirComercio");
        const escrito = buscador ? buscador.value.trim() : "";
        let html = filasDe(lista, filtro === "cerca" && !texto);
        if (!lista.length && escrito) {
            html = `<div class="noExisteComercio">
                <span class="noExisteIcono">${p.ico("tienda", 26)}</span>
                <strong>No tenés «${p.esc(escrito)}» guardado</strong>
                <small>Podés crearlo ahora o hacerle el pedido igual.</small>
                <button type="button" class="pzBtn pzBtnPri" data-crear-comercio>${p.ico("mas", 18)} Crear comercio con este nombre</button>
                <button type="button" class="pzBtn pzBtnSec" data-sin-guardar>Hacer el pedido sin guardarlo</button>
            </div>`;
        } else if (!lista.length) {
            const vacio = filtro === "cerca" ? (aqui ? "No hay comercios a 1 km de donde estás." : "Buscando dónde estás…")
                : filtro === "hoy" ? "Hoy no tenés comercios para visitar." : "Todavía no tenés comercios.";
            html = `<p class="vacioElegirComercio">${vacio}</p>`;
        }
        if (cuerpo.innerHTML !== html) cuerpo.innerHTML = html;
    }

    function elegir(nombre) {
        input.value = nombre;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        cerrarHoja();
    }

    function cerrarHoja() {
        if (caja && caja.isConnected) p.cerrar();
    }

    function crear(nombre) {
        const datos = window.datosComercioVendeFrio;
        if (!datos) return;
        cerrarHoja();
        setTimeout(() => datos.nuevo({ nombre, alGuardar: nuevo => elegir(nuevo) }), 0);
    }

    function abrir({ alCerrar = null } = {}) {
        if (caja && caja.isConnected) return caja;
        filtro = "";
        buscador = document.createElement("input");
        buscador.type = "search";
        buscador.placeholder = "Buscar comercio…";
        buscador.setAttribute("aria-label", "Buscar comercio");
        buscador.setAttribute("autocomplete", "off");
        caja = p.hoja({
            titulo: "Elegí un comercio",
            etiqueta: "Elegí un comercio",
            clase: "hojaElegirComercio",
            html: `<div class="filtrosEtapaPedidos filtrosElegirComercio" role="group" aria-label="Qué comercios ver"><span class="botonesElegirComercio"></span></div>
                <div class="listaElegirComercio"></div>
                <button type="button" class="pzBtn pzBtnSec nuevoComercioElegir" data-crear-comercio="nuevo">${p.ico("mas", 18)} Nuevo comercio</button>`
        });
        p.lupa(buscador, { etiqueta: "Buscar comercio" }).poner(caja.querySelector(".filtrosElegirComercio"));
        buscador.addEventListener("input", dibujarHoja);
        // Al cerrarse la hoja (elegido o no), avisa a quien la abrió.
        const vigia = new MutationObserver(() => {
            if (caja.isConnected) return;
            vigia.disconnect();
            if (typeof alCerrar === "function") alCerrar();
        });
        vigia.observe(document.body, { childList: true });
        caja.addEventListener("click", evento => {
            const agregar = evento.target.closest("[data-agregar-direccion]");
            if (agregar) {
                evento.stopPropagation();
                const nombre = agregar.dataset.agregarDireccion;
                if (typeof window.abrirDatosComercio === "function") window.abrirDatosComercio(nombre, "direccion", () => dibujarHoja());
                return;
            }
            const boton = evento.target.closest("[data-filtro-comercio]");
            if (boton) {
                filtro = boton.dataset.filtroComercio;
                if (buscador.value) {
                    buscador.value = "";
                    buscador.closest(".pzLupa")?.classList.remove("abierta");
                }
                if (filtro === "cerca" && !aqui) pedirUbicacion(() => {
                    if (aqui === false && typeof mostrarToast === "function") mostrarToast("No pudimos saber dónde estás");
                    dibujarHoja();
                });
                dibujarHoja();
                return;
            }
            const fila = evento.target.closest("[data-elegir]");
            if (fila) {
                elegir(fila.dataset.elegir);
                return;
            }
            const crearBoton = evento.target.closest("[data-crear-comercio]");
            if (crearBoton) {
                crear(buscador.value.trim());
                return;
            }
            if (evento.target.closest("[data-sin-guardar]")) elegir(buscador.value.trim());
        });
        caja.addEventListener("keydown", evento => {
            const fila = evento.target.closest && evento.target.closest("[data-elegir]");
            if (fila && (evento.key === "Enter" || evento.key === " ")) {
                evento.preventDefault();
                elegir(fila.dataset.elegir);
            }
        });
        // Si el permiso de ubicación ya está dado, "Cerca" se cuenta solo.
        if (aqui === null && navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: "geolocation" }).then(estado => {
                if (estado.state === "granted") pedirUbicacion(dibujarHoja);
                if (estado.state === "denied") {
                    aqui = false;
                    dibujarHoja();
                }
            }).catch(() => {});
        }
        dibujarHoja();
        return caja;
    }

    // Si se escribe en el campo (el asistente, el dictado, las pruebas)
    // mientras la hoja está abierta, el comercio ya quedó elegido.
    input.addEventListener("change", () => {
        if (caja && caja.isConnected && input.value.trim()) cerrarHoja();
    });
    input.addEventListener("input", () => {
        if (caja && caja.isConnected && document.activeElement === input && input.value.trim()) cerrarHoja();
    });

    // La nota del pedido: un renglón que crece al escribir.
    const nota = document.getElementById("obs");
    function ajustarNota() {
        if (!nota || !nota.offsetParent) return;
        nota.style.height = "";
        if (nota.scrollHeight > nota.clientHeight + 1) nota.style.height = Math.min(140, nota.scrollHeight) + "px";
    }
    if (nota) nota.addEventListener("input", ajustarNota);

    dibujarVista();
    if (typeof window.actualizarResumenPedido === "function") {
        const original = window.actualizarResumenPedido;
        window.actualizarResumenPedido = function () {
            const resultado = original.apply(this, arguments);
            try {
                dibujarVista();
                ajustarNota();
            } catch (error) {
                console.error(error);
            }
            return resultado;
        };
    }

    window.elegirComercioVendeFrio = { abrir, elegir };
}());
