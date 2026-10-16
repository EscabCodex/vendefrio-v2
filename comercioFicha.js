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
        modalFicha.querySelector(".fichaDireccion").textContent = comercio.direccion || "Sin dirección cargada";
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
