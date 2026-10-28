// VendeFrío - "Datos del comercio": una sola hoja para cargar y cambiar
// todos los datos de un comercio (repaso de diseño de Comercios, 2026-10-28).
// La usan "Agregar comercio", "Editar datos" de la ficha y cada
// "+ Agregar …" de la app: se abre bajada hasta el dato que falta.
//
//   window.abrirDatosComercio(nombre, campo, alGuardar)
//   window.datosComercioVendeFrio.editar(nombre, { campo, alGuardar })
//   window.datosComercioVendeFrio.nuevo({ alGuardar })
//
// alGuardar(nombre) se llama después de guardar, con el nombre como quedó.
(function () {
    "use strict";

    const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    const DIAS_VISITA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const MANANA = { desde: 8 * 60, hasta: 13 * 60 };
    const TARDE = { desde: 17 * 60, hasta: 21 * 60 };

    // Qué campo de la hoja corresponde a cada nombre de dato.
    const CAMPOS = {
        nombre: "#modalNombre",
        direccion: "#modalDireccion", ubicacion: "#modalDireccion", gps: "#modalDireccion",
        telefono: "#modalTelefono", whatsapp: "#modalTelefono",
        horario: ".datosHorario",
        diavisita: "#datoDia", dia: "#datoDia",
        contacto: "#datoContacto",
        nota: "#datoNota",
        envases: "#datoTiene",
        topedeuda: "#datoTope", tope: "#datoTope",
        listaprecios: "#datoLista", lista: "#datoLista"
    };

    // ---------- Horario: "Lun a sáb · 8 a 13 y 17 a 21" ----------
    function textoHora(minutos) {
        const horas = Math.floor(minutos / 60);
        const resto = minutos % 60;
        return resto ? horas + ":" + String(resto).padStart(2, "0") : String(horas);
    }

    function textoDias(elegidos) {
        const indices = elegidos.map((si, indice) => si ? indice : -1).filter(indice => indice >= 0);
        if (!indices.length) return "";
        if (indices.length === 7) return "Todos los días";
        const seguidos = indices.every((dia, posicion) => !posicion || dia === indices[posicion - 1] + 1);
        if (seguidos && indices.length >= 3) return DIAS[indices[0]] + " a " + DIAS[indices[indices.length - 1]].toLocaleLowerCase("es");
        const nombres = indices.map((dia, posicion) => posicion ? DIAS[dia].toLocaleLowerCase("es") : DIAS[dia]);
        return nombres.length === 1 ? nombres[0] : nombres.slice(0, -1).join(", ") + " y " + nombres[nombres.length - 1];
    }

    function armarHorario(estado) {
        const dias = textoDias(estado.dias);
        const turnos = [estado.manana, estado.tarde].filter(turno => turno.prendido)
            .map(turno => textoHora(turno.desde) + " a " + textoHora(turno.hasta));
        if (!dias || !turnos.length) return "";
        return dias + " · " + turnos.join(" y ");
    }

    function sinTildes(texto) {
        return String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es").trim();
    }

    function indiceDeDia(texto) {
        const corto = sinTildes(texto).slice(0, 3);
        return ["lun", "mar", "mie", "jue", "vie", "sab", "dom"].indexOf(corto);
    }

    function leerHora(horas, minutos) {
        const valor = Number(horas) * 60 + Number(minutos || 0);
        return Number.isFinite(valor) && valor >= 0 && valor <= 24 * 60 ? valor : null;
    }

    // Lee un horario escrito con armarHorario. Si es otro texto, devuelve null
    // y la hoja lo deja como está mientras no se toquen los días ni los turnos.
    function leerHorario(texto) {
        const partes = String(texto || "").split("·");
        if (partes.length !== 2) return null;
        const dias = Array(7).fill(false);
        const textoDiasLeido = sinTildes(partes[0]);
        if (textoDiasLeido === "todos los dias") dias.fill(true);
        else {
            const rango = textoDiasLeido.match(/^(\S+) a (\S+)$/);
            if (rango) {
                const desde = indiceDeDia(rango[1]);
                const hasta = indiceDeDia(rango[2]);
                if (desde < 0 || hasta < desde) return null;
                for (let dia = desde; dia <= hasta; dia += 1) dias[dia] = true;
            } else {
                for (const nombre of textoDiasLeido.split(/\s*,\s*|\s+y\s+/)) {
                    const dia = indiceDeDia(nombre);
                    if (dia < 0) return null;
                    dias[dia] = true;
                }
            }
        }
        const turnos = [];
        for (const pedazo of partes[1].trim().split(/\s+y\s+/)) {
            const horas = pedazo.match(/^(\d{1,2})(?::(\d{2}))?\s*a\s*(\d{1,2})(?::(\d{2}))?$/);
            if (!horas) return null;
            const desde = leerHora(horas[1], horas[2]);
            const hasta = leerHora(horas[3], horas[4]);
            if (desde === null || hasta === null) return null;
            turnos.push({ desde, hasta });
        }
        if (!turnos.length || turnos.length > 2) return null;
        const estado = { dias, manana: { ...MANANA, prendido: false }, tarde: { ...TARDE, prendido: false } };
        if (turnos.length === 2) {
            estado.manana = { ...turnos[0], prendido: true };
            estado.tarde = { ...turnos[1], prendido: true };
        } else if (turnos[0].desde < 14 * 60) estado.manana = { ...turnos[0], prendido: true };
        else estado.tarde = { ...turnos[0], prendido: true };
        return estado;
    }

    function opcionesDeHora(elegida) {
        let html = "";
        for (let minutos = 0; minutos <= 24 * 60; minutos += 30) {
            const texto = Math.floor(minutos / 60) + ":" + String(minutos % 60).padStart(2, "0");
            html += `<option value="${minutos}"${minutos === elegida ? " selected" : ""}>${texto}</option>`;
        }
        return html;
    }

    function htmlTurno(clave, titulo, turno) {
        return `<div class="datosTurno${turno.prendido ? "" : " apagado"}" data-turno="${clave}">
            <strong>${titulo}</strong>
            <input type="checkbox" class="ajLlave" role="switch" aria-label="${titulo}"${turno.prendido ? " checked" : ""}>
            <div class="datosHoras">
                <select aria-label="${titulo}: abre">${opcionesDeHora(turno.desde)}</select>
                <span>a</span>
                <select aria-label="${titulo}: cierra">${opcionesDeHora(turno.hasta)}</select>
            </div>
        </div>`;
    }

    // ---------- Envases y números ----------
    function numeroEnvases(valor) {
        const numero = Math.round(Number(valor));
        return Number.isFinite(numero) && numero > 0 ? numero : 0;
    }

    function pareceEnlace(texto) {
        return /^https?:\/\//i.test(String(texto || "").trim());
    }

    // ---------- La hoja ----------
    function abrir(nombre, { campo = "", alGuardar = null } = {}) {
        const p = window.piezas;
        if (!p) return null;
        const comercio = nombre ? buscarComercioPorNombre(nombre) : null;
        if (nombre && !comercio) return null;
        const c = comercio || {};
        const envases = c.envases && typeof c.envases === "object" ? c.envases : {};
        const listas = typeof window.listasDePrecios === "function" ? window.listasDePrecios() : [];
        const leido = leerHorario(c.horario);
        const estado = leido || { dias: Array(7).fill(false), manana: { ...MANANA, prendido: false }, tarde: { ...TARDE, prendido: false } };
        // Un horario escrito a mano (de antes) queda igual si no se toca.
        const horarioViejo = !leido && c.horario ? String(c.horario) : "";
        let horarioTocado = false;
        let gpsTomado = null;

        const caja = p.hoja({
            titulo: comercio ? "Datos del comercio" : "Nuevo comercio",
            sub: comercio ? comercio.nombre : "",
            etiqueta: comercio ? "Datos del comercio" : "Nuevo comercio",
            clase: "hojaDatosComercio",
            html: `<label class="pzCampo"><span>Nombre</span><input id="modalNombre" maxlength="80" autocomplete="off" placeholder="Por ejemplo, Almacén Don Pepe" value="${p.esc(c.nombre || "")}"></label>
                <label class="pzCampo"><span>Dirección</span><input id="modalDireccion" maxlength="160" autocomplete="off" placeholder="Ej.: Mitre 900, Rosario" value="${p.esc(c.direccion || "")}"></label>
                <button type="button" class="pzBtn pzBtnSec datosUsarGps">${p.ico("ubicacion", 18)} Usar dónde estoy ahora</button>
                <label class="pzCampo"><span>Teléfono o WhatsApp</span><input id="modalTelefono" type="tel" inputmode="tel" maxlength="40" placeholder="Ej.: 11 5555-1234" value="${p.esc(c.telefono || "")}"></label>
                <p class="datosSeccion">Más datos (opcionales)</p>
                <div class="datosHorario" tabindex="-1">
                    <span class="datosEtiqueta">Qué días abre</span>
                    <div class="datosDias">${DIAS.map((dia, indice) => `<button type="button" class="pzFiltro" data-dia="${indice}" aria-pressed="${estado.dias[indice]}">${dia}</button>`).join("")}</div>
                    ${htmlTurno("manana", "Turno mañana", estado.manana)}
                    ${htmlTurno("tarde", "Turno tarde", estado.tarde)}
                    <p class="datosQueda" aria-live="polite"></p>
                </div>
                <div class="pzDosCampos">
                    <label class="pzCampo"><span>Día de visita</span><select id="datoDia"><option value="">Sin día fijo</option>${DIAS_VISITA.map(dia => `<option${c.diaVisita === dia ? " selected" : ""}>${dia}</option>`).join("")}</select></label>
                    <label class="pzCampo"><span>Contacto</span><input id="datoContacto" maxlength="60" placeholder="Ej.: Pepe Gómez" value="${p.esc(c.contacto || "")}"></label>
                </div>
                <label class="pzCampo"><span>Nota</span><textarea id="datoNota" rows="2" maxlength="300" placeholder="Ej.: Tocar timbre. Descargar por el costado.">${p.esc(c.nota || "")}</textarea></label>
                ${comercio ? `<div class="pzDosCampos">
                    <label class="pzCampo"><span>Cajones que tiene</span><input id="datoTiene" type="number" inputmode="numeric" min="0" step="1" value="${numeroEnvases(envases.tiene) || ""}"></label>
                    <label class="pzCampo"><span>Ya devolvió</span><input id="datoDevolvio" type="number" inputmode="numeric" min="0" step="1" value="${numeroEnvases(envases.devolvio) || ""}"></label>
                </div>` : ""}
                ${listas.length ? `<label class="pzCampo"><span>Lista de precios</span><select id="datoLista"><option value="">General</option>${listas.map(lista => `<option${c.listaPrecios === lista ? " selected" : ""}>${p.esc(lista)}</option>`).join("")}</select></label>` : ""}
                <label class="pzCampo"><span>Tope de deuda (opcional)</span><input id="datoTope" type="number" inputmode="numeric" min="0" step="1000" placeholder="Sin tope" value="${Number(c.topeDeuda) > 0 ? Number(c.topeDeuda) : ""}"></label>`,
            botones: [{ texto: "Guardar", icono: "check", id: "guardarModal", alTocar: () => guardar() }]
        });

        const queda = caja.querySelector(".datosQueda");
        function mostrarQueda() {
            const texto = horarioTocado || !horarioViejo ? armarHorario(estado) : horarioViejo;
            const faltaTurno = estado.dias.some(Boolean) && !estado.manana.prendido && !estado.tarde.prendido;
            queda.innerHTML = texto
                ? "Queda: <b>" + p.esc(texto) + "</b>"
                : (faltaTurno ? "Prendé al menos un turno." : "Tocá los días que abre.");
        }

        caja.querySelector(".datosDias").addEventListener("click", evento => {
            const boton = evento.target.closest("[data-dia]");
            if (!boton) return;
            const dia = Number(boton.dataset.dia);
            const ningunoAntes = !estado.dias.some(Boolean);
            estado.dias[dia] = !estado.dias[dia];
            boton.setAttribute("aria-pressed", String(estado.dias[dia]));
            horarioTocado = true;
            // El primer día prende los dos turnos (se apagan con su llave).
            if (ningunoAntes && !estado.manana.prendido && !estado.tarde.prendido) {
                caja.querySelectorAll(".datosTurno").forEach(fila => {
                    estado[fila.dataset.turno].prendido = true;
                    fila.classList.remove("apagado");
                    fila.querySelector(".ajLlave").checked = true;
                });
            }
            mostrarQueda();
        });
        caja.querySelectorAll(".datosTurno").forEach(fila => {
            const turno = estado[fila.dataset.turno];
            const [desde, hasta] = fila.querySelectorAll("select");
            fila.querySelector(".ajLlave").addEventListener("change", evento => {
                turno.prendido = evento.target.checked;
                fila.classList.toggle("apagado", !turno.prendido);
                horarioTocado = true;
                mostrarQueda();
            });
            [desde, hasta].forEach(select => select.addEventListener("change", () => {
                turno.desde = Number(desde.value);
                turno.hasta = Number(hasta.value);
                horarioTocado = true;
                mostrarQueda();
            }));
        });
        mostrarQueda();

        const botonGps = caja.querySelector(".datosUsarGps");
        botonGps.addEventListener("click", () => {
            if (!navigator.geolocation) {
                mostrarAviso("GPS no disponible", "Tu celular no soporta GPS en el navegador.");
                return;
            }
            botonGps.disabled = true;
            botonGps.innerHTML = p.ico("mira", 18) + " Buscando dónde estás...";
            navigator.geolocation.getCurrentPosition(posicion => {
                gpsTomado = { lat: posicion.coords.latitude, lng: posicion.coords.longitude };
                botonGps.disabled = false;
                botonGps.classList.add("tomado");
                botonGps.innerHTML = p.ico("check", 18) + " Ubicación tomada";
            }, () => {
                botonGps.disabled = false;
                botonGps.innerHTML = p.ico("ubicacion", 18) + " Usar dónde estoy ahora";
                mostrarAviso("Error de GPS", "Asegurate de darle permiso de ubicación al navegador en tu celular.");
            }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
        });

        async function guardar() {
            const valor = selector => String(caja.querySelector(selector)?.value || "").trim();
            const nombreNuevo = valor("#modalNombre");
            if (!nombreNuevo) {
                mostrarAviso("Falta el nombre", "Ingresá un nombre antes de guardar el comercio.");
                return false;
            }
            let direccion = valor("#modalDireccion");
            const datos = {
                nombre: nombreNuevo,
                telefono: valor("#modalTelefono"),
                diaVisita: valor("#datoDia"),
                contacto: valor("#datoContacto").slice(0, 60),
                nota: valor("#datoNota").slice(0, 300)
            };
            if (horarioTocado || !horarioViejo) datos.horario = armarHorario(estado);
            if (caja.querySelector("#datoTiene")) datos.envases = { tiene: numeroEnvases(valor("#datoTiene")), devolvio: numeroEnvases(valor("#datoDevolvio")) };
            if (caja.querySelector("#datoLista")) datos.listaPrecios = valor("#datoLista");
            const tope = Math.round(Number(valor("#datoTope")) || 0);
            datos.topeDeuda = tope > 0 ? Math.min(tope, 999999999) : 0;

            // Si pegaron un enlace de Google Maps en la dirección, se usa como antes.
            if (pareceEnlace(direccion)) {
                datos.enlaceMaps = direccion;
                direccion = "";
                let coordenadas = typeof extraerCoordenadasDeMaps === "function" ? extraerCoordenadasDeMaps(datos.enlaceMaps) : null;
                if (!coordenadas && typeof resolverEnlaceMaps === "function") {
                    try {
                        const remotos = await resolverEnlaceMaps(datos.enlaceMaps);
                        if (remotos.direccion) direccion = remotos.direccion;
                        if (remotos.lat !== null && remotos.lng !== null) coordenadas = { lat: Number(remotos.lat), lng: Number(remotos.lng) };
                    } catch (error) {
                        // Se guarda el enlace sin GPS.
                    }
                }
                if (coordenadas) Object.assign(datos, coordenadas, { origenGps: "maps" });
            }
            datos.direccion = direccion || (datos.enlaceMaps ? String(c.direccion || "") : "");
            if (gpsTomado) Object.assign(datos, gpsTomado, { origenGps: "gps" });

            let id = comercio ? comercio.id : "";
            if (comercio) {
                if (!actualizarComercioPorId(id, datos)) {
                    mostrarAviso("Comercio no modificado", "No se pudo guardar. Revisá que el nombre no esté repetido.");
                    return false;
                }
            } else {
                id = agregarComercioConId({ ...datos, pedidosRealizados: 0, ultimaVisita: "" });
                if (!id) {
                    mostrarAviso("Comercio no creado", "Ese comercio ya existe o el nombre no es válido.");
                    return false;
                }
                const { nombre: _nombre, direccion: _direccion, telefono: _telefono, enlaceMaps: _enlace, lat: _lat, lng: _lng, origenGps: _origen, ...resto } = datos;
                actualizarComercioPorId(id, resto);
            }

            if (typeof redibujarComerciosEnTodasPartes === "function") redibujarComerciosEnTodasPartes();
            else if (typeof renderizarComercios === "function") renderizarComercios();
            if (typeof actualizarDashboard === "function" && typeof redibujarComerciosEnTodasPartes !== "function") actualizarDashboard();
            if (typeof mostrarToast === "function") mostrarToast(comercio ? "Datos guardados" : "Comercio agregado");
            if (typeof alGuardar === "function") {
                try {
                    alGuardar(nombreNuevo);
                } catch (error) {
                    console.error(error);
                }
            }
            return true;
        }

        // Bajada hasta el dato que se quiere cargar.
        const selector = CAMPOS[sinTildes(campo).replace(/[^a-z]/g, "")];
        const destino = selector ? caja.querySelector(selector) : (comercio ? null : caja.querySelector("#modalNombre"));
        if (destino) {
            setTimeout(() => {
                destino.scrollIntoView({ block: "center", behavior: "smooth" });
                if (selector) destino.closest(".pzCampo, .datosHorario")?.classList.add("datoResaltado");
                const foco = destino.matches("input, textarea, select") ? destino : destino.querySelector("button");
                try {
                    foco?.focus({ preventScroll: true });
                } catch (error) {
                    foco?.focus();
                }
            }, 260);
        }
        return caja;
    }

    function abrirDatosComercio(nombre, campo, alGuardar) {
        return abrir(nombre, { campo, alGuardar });
    }

    window.abrirDatosComercio = abrirDatosComercio;
    window.datosComercioVendeFrio = {
        editar: (nombre, opciones) => abrir(nombre, opciones || {}),
        nuevo: (opciones) => abrir("", opciones || {}),
        armarHorario,
        leerHorario
    };
}());
