// VendeFrío - ficha rápida de comercio
(function () {
    let modalFicha = null;

    function normalizarFicha(texto) {
        return String(texto || "").trim().toLocaleLowerCase("es");
    }

    function obtenerDatosFicha(nombre) {
        const comercio = obtenerComercios().find(item => normalizarFicha(item.nombre) === normalizarFicha(nombre));
        // Eliminados y cancelados no cuentan (T26).
        const historial = typeof obtenerPedidosQueCuentan === "function" ? obtenerPedidosQueCuentan() : [];
        const pedidos = historial.filter(item => typeof nombresComercioCompatibles === "function"
            ? nombresComercioCompatibles(nombre, item.comercio || item.cliente)
            : normalizarFicha(item.comercio || item.cliente) === normalizarFicha(nombre));
        const ultimo = pedidos.slice().sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))[0];
        const productos = {};

        pedidos.forEach(pedido => {
            if (!Array.isArray(pedido.productos)) return;
            pedido.productos.forEach(producto => {
                const nombreProducto = String(producto.nombre || producto.producto || "").trim();
                if (nombreProducto) productos[nombreProducto] = (productos[nombreProducto] || 0) + Number(producto.cantidad || 1);
            });
        });

        const productosOrdenados = Object.entries(productos).sort((a, b) => b[1] - a[1]);
        const totalUnidades = productosOrdenados.reduce((total, item) => total + item[1], 0);
        const pedidosRegistrados = pedidos.length || Number(comercio?.pedidosRealizados || 0);
        const visitadoEstaSemana = estaVisitadoEstaSemana(comercio);
        const frecuenciaVisita = visitadoEstaSemana ? 100 : (comercio?.ultimaVisita ? 45 : 0);

        return {
            comercio,
            pedidos: pedidosRegistrados,
            frecuenciaVisita,
            visitadoEstaSemana,
            ultimaVisita: comercio?.ultimaVisita || "Nunca",
            totalUnidades,
            ultimo,
            productos: productosOrdenados.slice(0, 5).map(([nombre, cantidad]) => ({
                nombre,
                cantidad,
                porcentaje: totalUnidades ? Math.round((cantidad / totalUnidades) * 100) : 0
            }))
        };
    }

    function cerrarFicha() {
        if (modalFicha) modalFicha.remove();
        modalFicha = null;
    }

    function crearBoton(texto, clase, accion) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "btnAccion fichaBoton " + clase;
        boton.innerHTML = texto;
        boton.addEventListener("click", accion);
        return boton;
    }

    function tieneGps(comercio) {
        if (typeof comercioTieneGps === "function") return comercioTieneGps(comercio);
        return Number.isFinite(Number(comercio?.lat)) && Number.isFinite(Number(comercio?.lng)) && comercio.lat !== "" && comercio.lng !== "";
    }

    // "Ir": la navegación de Google Maps al punto GPS o, si no tiene, a la
    // dirección (Etapa 4, como "Ir" en Próxima parada de Inicio).
    function enlaceIr(comercio) {
        const destino = tieneGps(comercio) ? comercio.lat + "," + comercio.lng : String(comercio.direccion || "").trim();
        if (!destino) return "";
        return "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + encodeURIComponent(destino);
    }

    // WhatsApp: el número de Argentina con 549 adelante (sin 0 ni 15).
    function enlaceWhatsapp(telefono) {
        let digitos = String(telefono || "").replace(/\D/g, "");
        if (digitos.length < 8) return "";
        if (!digitos.startsWith("54")) digitos = "549" + digitos.replace(/^0/, "").replace(/^(\d{2,4})15(\d{6,8})$/, "$1$2");
        return "https://wa.me/" + digitos;
    }

    // "Actualizar con mi GPS" (T37): antes estaba en Rutas.
    function guardarMiGps(comercio, boton) {
        if (!navigator.geolocation) {
            mostrarAviso("GPS no disponible", "Tu celular no soporta GPS en el navegador.");
            return;
        }
        const textoOriginal = boton.innerHTML;
        boton.disabled = true;
        boton.innerHTML = window.icono("mira", 16) + " Buscando tu ubicación...";
        navigator.geolocation.getCurrentPosition(posicion => {
            boton.disabled = false;
            boton.innerHTML = textoOriginal;
            const guardado = actualizarComercioPorNombre(comercio.nombre, {
                lat: posicion.coords.latitude,
                lng: posicion.coords.longitude,
                origenGps: "gps"
            });
            if (!guardado) {
                mostrarAviso("No se pudo guardar", "No se encontró el comercio.");
                return;
            }
            mostrarAviso("¡GPS guardado!", "Guardamos la ubicación exacta para \"" + comercio.nombre + "\".");
            if (typeof renderizarComercios === "function") renderizarComercios();
            if (typeof actualizarDashboard === "function") actualizarDashboard();
            if (modalFicha) abrirFicha(comercio.nombre);
        }, () => {
            boton.disabled = false;
            boton.innerHTML = textoOriginal;
            mostrarAviso("Error de GPS", "Asegurate de darle permiso de ubicación al navegador en tu celular.");
        }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    }

    function acceso(icono, texto, clase) {
        const elemento = document.createElement(clase === "a" ? "a" : "button");
        elemento.className = "fichaAcceso";
        if (elemento.tagName === "BUTTON") elemento.type = "button";
        elemento.innerHTML = '<span class="fichaAccesoIcono">' + window.icono(icono, 22) + "</span><small></small>";
        elemento.querySelector("small").textContent = texto;
        return elemento;
    }

    function abrirFicha(nombre) {
        const datos = obtenerDatosFicha(nombre);
        if (!datos.comercio) return;
        cerrarFicha();

        modalFicha = document.createElement("div");
        modalFicha.className = "modal modalFichaComercio";
        modalFicha.innerHTML = `
            <div class="modalContenido fichaContenido fichaComercioNueva" role="dialog" aria-modal="true" aria-labelledby="tituloFichaComercio">
                <button type="button" class="fichaCerrar" aria-label="Cerrar ficha">${window.icono("cerrarX", 20)}</button>
                <div class="fichaEncabezado">
                    <div class="fichaAvatar"></div>
                    <div class="fichaTitulo"><h2 id="tituloFichaComercio"></h2><p class="fichaDireccion"></p><span class="chipEstado fichaEstado"></span></div>
                </div>
                <div class="fichaAccesos"></div>
                <div class="fichaDebe"></div>
                <div class="fichaMasDatos"></div>
                <div class="fichaNumeros"></div>
                <div class="fichaUbicacion"></div>
                <div class="fichaProductos"><strong>Productos habituales</strong><div class="fichaListaProductos"></div></div>
                <div class="fichaAcciones"></div>
            </div>`;
        document.body.appendChild(modalFicha);

        const comercio = datos.comercio;
        const avatar = modalFicha.querySelector(".fichaAvatar");
        avatar.textContent = String(comercio.nombre || "?").trim().slice(0, 2).toUpperCase();
        if (typeof colorAvatar === "function") avatar.style.background = colorAvatar(comercio.nombre);
        modalFicha.querySelector("#tituloFichaComercio").textContent = comercio.nombre;
        modalFicha.querySelector(".fichaDireccion").textContent = [comercio.direccion || "Sin dirección cargada", comercio.contacto].filter(Boolean).join(" · ");
        const estado = modalFicha.querySelector(".fichaEstado");
        estado.textContent = datos.visitadoEstaSemana ? "Visitado esta semana" : "Pendiente esta semana";
        estado.dataset.tono = datos.visitadoEstaSemana ? "ok" : "aviso";

        // Accesos: pedido, llamar, WhatsApp e ir.
        const accesos = modalFicha.querySelector(".fichaAccesos");
        const pedido = acceso("documento", "Pedido");
        pedido.classList.add("fichaAccesoPrincipal");
        pedido.addEventListener("click", () => { cerrarFicha(); irAPedidoRapido(comercio.nombre); });
        accesos.appendChild(pedido);
        if (comercio.telefono) {
            const llamar = acceso("telefono", "Llamar", "a");
            llamar.href = "tel:" + String(comercio.telefono).replace(/[^\d+]/g, "");
            accesos.appendChild(llamar);
            const whatsapp = enlaceWhatsapp(comercio.telefono);
            if (whatsapp) {
                const enlace = acceso("whatsapp", "WhatsApp", "a");
                enlace.classList.add("fichaAccesoWa");
                enlace.href = whatsapp;
                enlace.target = "_blank";
                enlace.rel = "noopener";
                accesos.appendChild(enlace);
            }
        }
        const ir = enlaceIr(comercio);
        if (ir) {
            const enlace = acceso("navegar", "Ir", "a");
            enlace.href = ir;
            enlace.dataset.navegarA = comercio.nombre;
            enlace.target = "_blank";
            enlace.rel = "noopener";
            accesos.appendChild(enlace);
        }
        // "Sin pedido" (T65): el motivo de la visita.
        if (window.visitasVendeFrio && !comercioArchivado(comercio)) {
            const sinPedido = acceso("cerrarX", "Sin pedido");
            sinPedido.classList.add("fichaAccesoSinPedido");
            sinPedido.addEventListener("click", () => window.visitasVendeFrio.abrir(comercio.nombre));
            accesos.appendChild(sinPedido);
        }

        dibujarMasDatos(modalFicha.querySelector(".fichaMasDatos"), comercio);

        const numeros = modalFicha.querySelector(".fichaNumeros");
        [[String(datos.pedidos), datos.pedidos === 1 ? "pedido" : "pedidos"], [String(datos.totalUnidades), "unidades"], [String(datos.ultimaVisita).replace(/^(\d{1,2}\/\d{1,2})\/\d{4}$/, "$1"), "última visita"]].forEach(([valor, texto]) => {
            const caja = document.createElement("div");
            const fuerte = document.createElement("strong");
            fuerte.textContent = valor;
            const chico = document.createElement("small");
            chico.textContent = texto;
            caja.append(fuerte, chico);
            numeros.appendChild(caja);
        });

        // Ubicación: si tiene GPS y "Actualizar con mi GPS".
        const ubicacion = modalFicha.querySelector(".fichaUbicacion");
        const conGps = tieneGps(comercio);
        ubicacion.innerHTML = `<span class="fichaUbicacionIcono">${window.icono("ubicacion", 18)}</span><div><strong></strong><small></small></div>`;
        ubicacion.querySelector("strong").textContent = conGps ? "Ubicación guardada" : "Sin ubicación GPS";
        ubicacion.querySelector("small").textContent = conGps
            ? (comercio.origenGps === "gps" ? "Tomada con el GPS del celular" : "Tomada de la dirección o del enlace de Maps")
            : "Parate en la puerta del comercio y tocá el botón";
        const botonGps = crearBoton(window.icono("mira", 16) + " Actualizar con mi GPS", "secundario botonGpsComercio", () => guardarMiGps(comercio, botonGps));
        ubicacion.appendChild(botonGps);

        const listaProductos = modalFicha.querySelector(".fichaListaProductos");
        if (datos.productos.length) {
            datos.productos.forEach(producto => {
                const fila = document.createElement("div");
                fila.className = "fichaProductoBarraFila";
                fila.innerHTML = `<span class="fichaProductoNombre"></span><b class="fichaProductoPorcentaje"></b><span class="fichaProductoBarra"><i></i></span>`;
                fila.querySelector(".fichaProductoNombre").textContent = producto.nombre;
                fila.querySelector(".fichaProductoPorcentaje").textContent = producto.cantidad + " u · " + producto.porcentaje + "%";
                fila.querySelector(".fichaProductoBarra i").style.width = Math.max(4, producto.porcentaje) + "%";
                listaProductos.appendChild(fila);
            });
        } else {
            const vacio = document.createElement("span");
            vacio.className = "subtitulo";
            vacio.textContent = "Aún no hay productos habituales.";
            listaProductos.appendChild(vacio);
        }

        const botonEstado = datos.visitadoEstaSemana
            ? crearBoton(window.icono("puntoRojo",14) + " Marcar pendiente", "secundario", () => { cerrarFicha(); marcarPendienteManual(comercio.nombre); })
            : crearBoton(window.icono("check",14) + " Marcar visitado", "ver", () => { cerrarFicha(); marcarVisitaManual(comercio.nombre); if (navigator.vibrate) navigator.vibrate(30); });
        // T63: archivar en vez de eliminar (se elimina desde "Archivados").
        const botonEliminar = comercioArchivado(comercio)
            ? crearBoton(window.icono("deshacer",14) + " Recuperar comercio", "ver", () => { cerrarFicha(); archivarComercioPorId(comercio.id, false); redibujarComerciosEnTodasPartes(); mostrarToast("Comercio recuperado"); })
            : crearBoton(window.icono("archivo",14) + " Archivar comercio", "eliminar", () => { cerrarFicha(); archivarComercioConDeshacer(comercio.nombre); });
        modalFicha.querySelector(".fichaAcciones").append(
            botonEstado,
            crearBoton(window.icono("historial",14) + " Ver sus pedidos", "secundario", () => { cerrarFicha(); if (typeof abrirHistorialDeComercio === "function") abrirHistorialDeComercio(comercio.nombre); }),
            crearBoton(window.icono("lapiz",14) + " Editar datos", "secundario", () => { cerrarFicha(); abrirModalEditar(comercio); }),
            botonEliminar
        );

        modalFicha.querySelector(".fichaCerrar").onclick = event => { event.preventDefault(); event.stopPropagation(); cerrarFicha(); };
        modalFicha.addEventListener("click", event => { if (event.target === modalFicha || event.target.closest(".fichaCerrar")) cerrarFicha(); });
    }

    // ---------- Más datos del comercio (T69) ----------
    const DIAS_VISITA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

    function numeroEnvases(valor) {
        const numero = Math.round(Number(valor));
        return Number.isFinite(numero) && numero > 0 ? numero : 0;
    }

    function textoEnvases(comercio) {
        const envases = comercio && comercio.envases;
        if (!envases || typeof envases !== "object") return "";
        const tiene = numeroEnvases(envases.tiene);
        const devolvio = numeroEnvases(envases.devolvio);
        if (!tiene && !devolvio) return "";
        return "Tiene " + tiene + (tiene === 1 ? " cajón" : " cajones") + (devolvio ? " · devolvió " + devolvio : "");
    }

    function lineasDeDatos(comercio) {
        const lineas = [
            ["alarma", "Horario", comercio.horario],
            ["calendario", "Día de visita", comercio.diaVisita],
            ["persona", "Contacto", comercio.contacto],
            ["notaLapiz", "Nota", comercio.nota],
            ["paquete", "Envases", textoEnvases(comercio)]
        ];
        // Lista de precios (T78), cuando hay listas cargadas.
        const listas = typeof window.listasDePrecios === "function" ? window.listasDePrecios() : [];
        if (listas.length) lineas.push(["etiqueta", "Lista de precios", comercio.listaPrecios || "General"]);
        return lineas;
    }

    function dibujarMasDatos(contenedor, comercio) {
        if (!contenedor || !window.piezas) return;
        const p = window.piezas;
        const lineas = lineasDeDatos(comercio);
        const conDato = lineas.filter(linea => String(linea[2] || "").trim());
        const filas = (conDato.length ? conDato : []).map(([icono, titulo, valor]) => `<button type="button" class="pzFila fichaDato" data-editar-dato aria-label="Editar ${p.esc(titulo.toLocaleLowerCase("es"))}">
                <span class="fichaDatoIco">${p.ico(icono, 22)}</span>
                <span class="pzFilaTxt"><small>${p.esc(titulo)}</small><strong>${p.esc(valor)}</strong></span>
            </button>`).join("");
        const faltan = lineas.length - conDato.length;
        contenedor.innerHTML = `<div class="pzTarjeta pzLista fichaDatos">${filas}
            <button type="button" class="pzFila fichaDatoAgregar" data-editar-dato>
                <span class="fichaDatoIco">${p.ico(conDato.length ? "lapiz" : "mas", 20)}</span>
                <span class="pzFilaTxt"><strong>${conDato.length ? "Editar horario, nota y envases" : "Agregar horario, día de visita y nota"}</strong>${faltan && conDato.length ? `<small>${faltan} ${faltan === 1 ? "dato" : "datos"} sin cargar</small>` : ""}</span>
                ${p.ico("chevDerecha", 18)}
            </button></div>`;
        contenedor.addEventListener("click", evento => {
            if (evento.target.closest("[data-editar-dato]")) editarMasDatos(comercio);
        });
    }

    function editarMasDatos(comercio) {
        const p = window.piezas;
        const envases = comercio.envases && typeof comercio.envases === "object" ? comercio.envases : {};
        const listas = typeof window.listasDePrecios === "function" ? window.listasDePrecios() : [];
        const campoLista = listas.length ? `<label class="pzCampo"><span>Lista de precios</span><select id="datoLista">
                <option value="">General</option>${listas.map(lista => `<option ${comercio.listaPrecios === lista ? "selected" : ""}>${p.esc(lista)}</option>`).join("")}
            </select></label>` : "";
        cerrarFicha();
        p.hoja({
            titulo: "Datos de " + comercio.nombre,
            etiqueta: "Datos del comercio",
            html: `<label class="pzCampo"><span>Horario</span><input id="datoHorario" maxlength="80" placeholder="Ej.: Lun a sáb · 8 a 13 y 17 a 21" value="${p.esc(comercio.horario || "")}"></label>
                <div class="pzDosCampos">
                    <label class="pzCampo"><span>Día de visita</span><select id="datoDia"><option value="">Sin día fijo</option>${DIAS_VISITA.map(dia => `<option ${comercio.diaVisita === dia ? "selected" : ""}>${dia}</option>`).join("")}</select></label>
                    <label class="pzCampo"><span>Contacto</span><input id="datoContacto" maxlength="60" placeholder="Ej.: Pepe Gómez" value="${p.esc(comercio.contacto || "")}"></label>
                </div>
                <label class="pzCampo"><span>Nota</span><textarea id="datoNota" rows="2" maxlength="300" placeholder="Ej.: Tocar timbre. Descargar por el costado.">${p.esc(comercio.nota || "")}</textarea></label>
                <div class="pzDosCampos">
                    <label class="pzCampo"><span>Cajones que tiene</span><input id="datoTiene" type="number" inputmode="numeric" min="0" step="1" value="${numeroEnvases(envases.tiene) || ""}"></label>
                    <label class="pzCampo"><span>Ya devolvió</span><input id="datoDevolvio" type="number" inputmode="numeric" min="0" step="1" value="${numeroEnvases(envases.devolvio) || ""}"></label>
                </div>${campoLista}`,
            botones: [{
                texto: "Guardar",
                icono: "check",
                alTocar: caja => {
                    const valor = selector => String(caja.querySelector(selector)?.value || "").trim();
                    const datos = {
                        horario: valor("#datoHorario").slice(0, 80),
                        diaVisita: valor("#datoDia"),
                        contacto: valor("#datoContacto").slice(0, 60),
                        nota: valor("#datoNota").slice(0, 300),
                        envases: { tiene: numeroEnvases(valor("#datoTiene")), devolvio: numeroEnvases(valor("#datoDevolvio")) }
                    };
                    if (caja.querySelector("#datoLista")) datos.listaPrecios = valor("#datoLista");
                    actualizarComercioPorId(comercio.id, datos);
                    if (typeof renderizarComercios === "function") renderizarComercios();
                    if (typeof actualizarDashboard === "function") actualizarDashboard();
                    mostrarToast("Datos guardados");
                    setTimeout(() => abrirFicha(comercio.nombre), 250);
                }
            }]
        });
    }

    window.cerrarFichaComercio = cerrarFicha;
    window.abrirFichaComercio = abrirFicha;

    document.addEventListener("click", event => {
        const tarjeta = event.target.closest(".comercioCard");
        if (!tarjeta || event.target.closest("button")) return;
        const titulo = tarjeta.querySelector("h3");
        if (titulo) abrirFicha(titulo.textContent);
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") cerrarFicha();
        if (event.key !== "Enter" && event.key !== " ") return;
        const tarjeta = document.activeElement?.closest?.(".comercioCard");
        if (tarjeta) {
            event.preventDefault();
            const titulo = tarjeta.querySelector("h3");
            if (titulo) abrirFicha(titulo.textContent);
        }
    });
}());
