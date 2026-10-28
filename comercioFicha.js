// VendeFrío - ficha rápida de comercio
(function () {
    let modalFicha = null;

    function normalizarFicha(texto) {
        return String(texto || "").trim().toLocaleLowerCase("es");
    }

    function obtenerDatosFicha(nombre) {
        const buscado = normalizarFicha(nombre);
        const encontrado = comerciosParaLeer().find(item => normalizarFicha(item.nombre) === buscado);
        // Una copia propia: la ficha se la pasa a editar, al GPS y a otras partes.
        const comercio = encontrado ? clonarDatos(encontrado) : undefined;
        // Eliminados y cancelados no cuentan (T26).
        const historial = typeof pedidosQueCuentanParaLeer === "function" ? pedidosQueCuentanParaLeer() : [];
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
            listaPedidos: pedidos,
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

    // ---------- Datos del comercio (T69) ----------
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

    // Todos los datos, aunque falten: el que falta se agrega tocándolo.
    function lineasDeDatos(comercio) {
        const lineas = [
            ["direccion", "ubicacion", "Dirección", comercio.direccion],
            ["telefono", "telefono", "Teléfono", comercio.telefono],
            ["contacto", "persona", "Contacto", comercio.contacto],
            ["horario", "alarma", "Horario", comercio.horario],
            ["diaVisita", "calendario", "Día de visita", comercio.diaVisita],
            ["nota", "notaLapiz", "Nota", comercio.nota],
            ["envases", "paquete", "Envases", textoEnvases(comercio)],
            ["topeDeuda", "moneda", "Tope de deuda", Number(comercio.topeDeuda) > 0 ? window.piezas.plata(Number(comercio.topeDeuda)) : ""]
        ];
        // Lista de precios (T78), cuando hay listas cargadas.
        const listas = typeof window.listasDePrecios === "function" ? window.listasDePrecios() : [];
        if (listas.length) lineas.push(["listaPrecios", "etiqueta", "Lista de precios", comercio.listaPrecios || "General"]);
        return lineas;
    }

    function dibujarDatos(contenedor, comercio) {
        const p = window.piezas;
        contenedor.innerHTML = `<div class="pzTarjeta pzLista fichaDatos">${lineasDeDatos(comercio).map(([campo, icono, titulo, valor]) => {
            const tiene = String(valor || "").trim();
            const gps = campo === "direccion"
                ? `<button type="button" class="fichaGps botonGpsComercio" aria-label="Actualizar con mi GPS">${p.ico("mira", 15)} Mi GPS</button>`
                : p.ico("chevDerecha", 18);
            return `<div role="button" tabindex="0" class="pzFila fichaDato${tiene ? "" : " fichaDatoVacio"}" data-campo="${campo}" aria-label="${tiene ? "Cambiar" : "Agregar"} ${p.esc(titulo.toLocaleLowerCase("es"))}">
                <span class="fichaDatoIco">${p.ico(icono, 22)}</span>
                <span class="pzFilaTxt"><small>${p.esc(titulo)}</small><strong>${tiene ? p.esc(tiene) : "+ Agregar " + p.esc(titulo.toLocaleLowerCase("es"))}</strong></span>
                ${gps}
            </div>`;
        }).join("")}</div>`;
        const editar = fila => editarDato(comercio.nombre, fila.dataset.campo);
        contenedor.addEventListener("click", evento => {
            const gps = evento.target.closest(".fichaGps");
            if (gps) {
                guardarMiGps(comercio, gps);
                return;
            }
            const fila = evento.target.closest("[data-campo]");
            if (fila) editar(fila);
        });
        contenedor.addEventListener("keydown", evento => {
            if (evento.key !== "Enter" && evento.key !== " ") return;
            const fila = evento.target.closest("[data-campo]");
            if (!fila || evento.target !== fila) return;
            evento.preventDefault();
            evento.stopPropagation();
            editar(fila);
        });
    }

    // La hoja "Datos del comercio" se abre arriba de la ficha; al guardar,
    // la ficha se dibuja de nuevo con lo cargado.
    function editarDato(nombre, campo) {
        if (!window.datosComercioVendeFrio) return;
        window.datosComercioVendeFrio.editar(nombre, {
            campo,
            alGuardar: nombreNuevo => { if (modalFicha) abrirFicha(nombreNuevo); }
        });
    }

    // ---------- Los 9 números de arriba ----------
    function textoHaceDias(dias) {
        if (dias <= 0) return "hoy";
        if (dias === 1) return "ayer";
        return "hace " + dias + " d";
    }

    function numerosDeLaFicha(nombre, datos) {
        const p = window.piezas;
        const historial = typeof pedidosQueCuentanParaLeer === "function" ? pedidosQueCuentanParaLeer() : [];
        const buscado = normalizarFicha(nombre);
        const perfil = typeof obtenerPerfilesComerciales === "function"
            ? obtenerPerfilesComerciales(historial).find(item => normalizarFicha(item.nombre) === buscado)
            : null;
        const pedidos = datos.listaPedidos;
        const fechas = pedidos.map(pedido => typeof obtenerFechaRegistro === "function" ? obtenerFechaRegistro(pedido) : null).filter(Boolean);
        const ahora = new Date();
        const delMes = pedidos.filter((pedido, indice) => {
            const fecha = typeof obtenerFechaRegistro === "function" ? obtenerFechaRegistro(pedido) : null;
            return fecha && fecha.getMonth() === ahora.getMonth() && fecha.getFullYear() === ahora.getFullYear();
        });
        const total = pedido => {
            if (typeof totalParaHistorial !== "function") return 0;
            try {
                return Number(totalParaHistorial(pedido).valor) || 0;
            } catch (error) {
                return 0;
            }
        };
        const unidades = pedido => (Array.isArray(pedido.productos) ? pedido.productos : []).reduce((suma, producto) => suma + Number(producto.cantidad || 1), 0);
        const veoPlata = window.verPlataVendeFrio?.puedoVer ? window.verPlataVendeFrio.puedoVer() : true;
        const primero = fechas.sort((a, b) => a - b)[0];
        const ultimaVisita = String(datos.ultimaVisita).replace(/^(\d{1,2}\/\d{1,2})\/\d{4}$/, "$1");

        const numeros = [
            { valor: String(datos.pedidos), texto: datos.pedidos === 1 ? "pedido" : "pedidos", verPedidos: true },
            { valor: String(datos.totalUnidades), texto: "unidades", verPedidos: true },
            { valor: ultimaVisita, texto: "última visita" },
            { valor: perfil && perfil.promedioDias ? perfil.promedioDias + " días" : "—", texto: "pide cada", verPedidos: true },
            { valor: perfil ? textoHaceDias(perfil.diasDesdeUltimo) : "—", texto: "último pedido", verPedidos: true, clase: perfil && perfil.atrasado ? "fichaNumeroAviso" : "" }
        ];
        if (window.saldosVendeFrio?.veDeudas?.()) {
            const debe = window.saldosVendeFrio.deudaDe(nombre) || 0;
            numeros.push({ valor: p.plata(debe), texto: "debe", clase: debe > 0 ? "fichaNumeroDebe" : "", alTocar: debe > 0 ? () => window.saldosVendeFrio.verCuenta(nombre) : null });
        } else {
            numeros.push({ valor: String(delMes.length), texto: delMes.length === 1 ? "pedido este mes" : "pedidos este mes", verPedidos: true, delMes: true });
        }
        if (veoPlata) {
            const delMesPlata = delMes.reduce((suma, pedido) => suma + total(pedido), 0);
            const todos = pedidos.reduce((suma, pedido) => suma + total(pedido), 0);
            numeros.push({ valor: p.plata(delMesPlata), texto: "compró este mes", verPedidos: true, delMes: true });
            numeros.push({ valor: pedidos.length ? p.plata(Math.round(todos / pedidos.length)) : "—", texto: "compra promedio", verPedidos: true });
        } else {
            const delMesUnidades = delMes.reduce((suma, pedido) => suma + unidades(pedido), 0);
            numeros.push({ valor: String(delMesUnidades), texto: "unidades este mes", verPedidos: true, delMes: true });
            numeros.push({ valor: pedidos.length ? String(Math.round(datos.totalUnidades / pedidos.length)) : "—", texto: "unidades por pedido", verPedidos: true });
        }
        numeros.push({
            valor: primero ? primero.toLocaleDateString("es-AR", { month: "short", year: "numeric" }).replace(".", "").replace(" de ", " ") : "—",
            texto: "cliente desde",
            verPedidos: true
        });
        return numeros;
    }

    // ---------- El menú de los tres puntitos ----------
    function itemMenu(icono, texto, clase = "", enlace = "") {
        const item = document.createElement(enlace ? "a" : "button");
        item.className = "fichaMenuItem " + clase;
        if (enlace) item.href = enlace;
        else item.type = "button";
        item.innerHTML = window.piezas.ico(icono, 20) + '<span class="fichaMenuTexto"></span>';
        item.querySelector(".fichaMenuTexto").textContent = texto;
        return item;
    }

    function abrirFicha(nombre) {
        const datos = obtenerDatosFicha(nombre);
        if (!datos.comercio) return;
        cerrarFicha();

        const p = window.piezas;
        const comercio = datos.comercio;
        modalFicha = document.createElement("div");
        modalFicha.className = "modal modalFichaComercio";
        modalFicha.innerHTML = `
            <div class="fichaMarco">
                <div class="modalContenido fichaContenido fichaComercioNueva" role="dialog" aria-modal="true" aria-labelledby="tituloFichaComercio">
                    <button type="button" class="fichaCerrar" aria-label="Cerrar ficha">${window.icono("cerrarX", 20)}</button>
                    <button type="button" class="fichaAsistente" aria-label="Asistente" title="Asistente" data-abrir-asistente>${window.icono("chispa", 20)}</button>
                    <div class="fichaEncabezado">
                        <div class="fichaAvatar"></div>
                        <div class="fichaTitulo"><h2 id="tituloFichaComercio"></h2></div>
                    </div>
                    <div class="fichaNumeros"></div>
                    <div class="fichaMasDatos"></div>
                    <div class="fichaProductos"><strong>Productos habituales</strong><div class="fichaListaProductos"></div></div>
                </div>
                <div class="fichaVelo" hidden></div>
                <div class="fichaMenu" role="dialog" hidden></div>
                <button type="button" class="fichaMenuBoton" aria-label="Más opciones" aria-haspopup="dialog" aria-expanded="false">${p.ico("puntos", 26)}</button>
            </div>`;
        document.body.appendChild(modalFicha);

        const avatar = modalFicha.querySelector(".fichaAvatar");
        avatar.textContent = String(comercio.nombre || "?").trim().slice(0, 2).toUpperCase();
        if (typeof colorAvatar === "function") avatar.style.background = colorAvatar(comercio.nombre);
        modalFicha.querySelector("#tituloFichaComercio").textContent = comercio.nombre;

        // Repasada: los números y los productos habituales llevan a sus pedidos
        // (lo mismo que "Ver sus pedidos").
        const verPedidos = () => { cerrarFicha(); if (typeof abrirHistorialDeComercio === "function") abrirHistorialDeComercio(comercio.nombre); };
        // Los números "este mes" abren sus pedidos en "Mes".
        const verPedidosDelMes = () => { cerrarFicha(); if (typeof abrirHistorialDeComercio === "function") abrirHistorialDeComercio(comercio.nombre, "mes"); };
        const tocable = window.piezas?.tocable;
        const cajaNumeros = modalFicha.querySelector(".fichaNumeros");
        numerosDeLaFicha(comercio.nombre, datos).forEach(numero => {
            const caja = document.createElement("div");
            if (numero.clase) caja.className = numero.clase;
            const fuerte = document.createElement("strong");
            fuerte.textContent = numero.valor;
            const chico = document.createElement("small");
            chico.textContent = numero.texto;
            caja.append(fuerte, chico);
            const alTocar = numero.alTocar || (numero.verPedidos && datos.pedidos > 0 ? (numero.delMes ? verPedidosDelMes : verPedidos) : null);
            if (alTocar && tocable) tocable(caja, alTocar);
            cajaNumeros.appendChild(caja);
        });

        dibujarDatos(modalFicha.querySelector(".fichaMasDatos"), comercio);

        const listaProductos = modalFicha.querySelector(".fichaListaProductos");
        if (datos.productos.length) {
            datos.productos.forEach(producto => {
                const fila = document.createElement("div");
                fila.className = "fichaProductoBarraFila";
                fila.innerHTML = `<span class="fichaProductoNombre"></span><b class="fichaProductoPorcentaje"></b><span class="fichaProductoBarra"><i></i></span>`;
                fila.querySelector(".fichaProductoNombre").textContent = producto.nombre;
                fila.querySelector(".fichaProductoPorcentaje").textContent = producto.cantidad + " u · " + producto.porcentaje + "%";
                fila.querySelector(".fichaProductoBarra i").style.width = Math.max(4, producto.porcentaje) + "%";
                if (datos.pedidos > 0 && tocable) tocable(fila, verPedidos);
                listaProductos.appendChild(fila);
            });
        } else {
            const vacio = document.createElement("span");
            vacio.className = "subtitulo";
            vacio.textContent = "Aún no hay productos habituales.";
            listaProductos.appendChild(vacio);
        }

        armarMenu(comercio, datos, verPedidos);

        modalFicha.querySelector(".fichaCerrar").onclick = event => {
            event.preventDefault();
            event.stopPropagation();
            // Con el menú abierto, el atrás del celular primero cierra el menú.
            if (menuAbierto()) cerrarMenu();
            else cerrarFicha();
        };
        modalFicha.addEventListener("click", event => {
            if (event.target === modalFicha || event.target.classList.contains("fichaMarco")) cerrarFicha();
        });
    }

    function menuAbierto() {
        return Boolean(modalFicha && modalFicha.classList.contains("conMenu"));
    }

    function abrirMenu() {
        if (!modalFicha) return;
        modalFicha.classList.add("conMenu");
        modalFicha.querySelector(".fichaMenu").hidden = false;
        modalFicha.querySelector(".fichaVelo").hidden = false;
        const boton = modalFicha.querySelector(".fichaMenuBoton");
        boton.setAttribute("aria-expanded", "true");
        boton.setAttribute("aria-label", "Cerrar opciones");
        boton.innerHTML = window.piezas.ico("cerrarX", 26);
    }

    function cerrarMenu() {
        if (!modalFicha) return;
        modalFicha.classList.remove("conMenu");
        modalFicha.querySelector(".fichaMenu").hidden = true;
        modalFicha.querySelector(".fichaVelo").hidden = true;
        const boton = modalFicha.querySelector(".fichaMenuBoton");
        boton.setAttribute("aria-expanded", "false");
        boton.setAttribute("aria-label", "Más opciones");
        boton.innerHTML = window.piezas.ico("puntos", 26);
    }

    // Lo principal arriba y resaltado; abajo de la rayita, lo demás.
    function armarMenu(comercio, datos, verPedidos) {
        const menu = modalFicha.querySelector(".fichaMenu");
        menu.setAttribute("aria-label", "Más opciones de " + comercio.nombre);
        const agregar = (item, alTocar) => {
            if (alTocar) item.addEventListener("click", alTocar);
            menu.appendChild(item);
            return item;
        };
        const archivado = comercioArchivado(comercio);
        // Con la bandeja de pedido (hilo de Catálogo), el pedido se carga
        // encima de la ficha y al bajarla se sigue en la ficha.
        agregar(itemMenu("documento", "Cargar pedido", "fichaMenuPrincipal"), () => {
            if (typeof window.abrirPedidoEnHoja === "function") {
                window.abrirPedidoEnHoja(comercio.nombre);
                return;
            }
            cerrarFicha();
            irAPedidoRapido(comercio.nombre);
        });
        if (comercio.telefono) {
            agregar(itemMenu("telefono", "Llamar", "", "tel:" + String(comercio.telefono).replace(/[^\d+]/g, "")));
            const whatsapp = enlaceWhatsapp(comercio.telefono);
            if (whatsapp) {
                const enlace = agregar(itemMenu("whatsapp", "WhatsApp", "fichaMenuWa", whatsapp));
                enlace.target = "_blank";
                enlace.rel = "noopener";
            }
        }
        const ir = enlaceIr(comercio);
        if (ir) {
            const enlace = agregar(itemMenu("navegar", "Ir", "", ir));
            enlace.dataset.navegarA = comercio.nombre;
            enlace.target = "_blank";
            enlace.rel = "noopener";
        }
        // "Sin pedido" (T65): el motivo de la visita.
        if (window.visitasVendeFrio && !archivado) {
            agregar(itemMenu("cerrarX", "Visité, sin pedido"), () => window.visitasVendeFrio.abrir(comercio.nombre));
        }
        menu.appendChild(document.createElement("hr"));
        agregar(itemMenu("historial", "Ver sus pedidos"), verPedidos);
        if (datos.visitadoEstaSemana) {
            agregar(itemMenu("puntoRojo", "Marcar pendiente"), () => { cerrarFicha(); marcarPendienteManual(comercio.nombre); });
        } else {
            agregar(itemMenu("check", "Marcar visitado"), () => { cerrarFicha(); marcarVisitaManual(comercio.nombre); if (navigator.vibrate) navigator.vibrate(30); });
        }
        agregar(itemMenu("lapiz", "Editar datos"), () => editarDato(comercio.nombre, "nombre"));
        // Botones de otras partes (T88: link para que pida solo; heladeras).
        (window.accionesFichaComercioExtras || []).forEach(crear => {
            try {
                const boton = crear(comercio, crearBoton, cerrarFicha);
                if (!boton) return;
                boton.className = "fichaMenuItem";
                boton.querySelectorAll("svg").forEach(svg => { svg.setAttribute("width", "20"); svg.setAttribute("height", "20"); });
                menu.appendChild(boton);
            } catch (error) {
                console.error(error);
            }
        });
        // T63: archivar en vez de eliminar; y eliminar, con "¿Seguro?".
        if (archivado) {
            agregar(itemMenu("deshacer", "Recuperar comercio"), () => { cerrarFicha(); archivarComercioPorId(comercio.id, false); redibujarComerciosEnTodasPartes(); mostrarToast("Comercio recuperado"); });
        } else {
            agregar(itemMenu("archivo", "Archivar comercio"), () => { cerrarFicha(); archivarComercioConDeshacer(comercio.nombre); });
        }
        agregar(itemMenu("tacho", "Eliminar comercio", "fichaMenuPeligro"), () => eliminarConPregunta(comercio));

        // Primero se cierra el menú y después corre la opción.
        menu.addEventListener("click", evento => { if (evento.target.closest(".fichaMenuItem")) cerrarMenu(); });
        modalFicha.querySelector(".fichaVelo").addEventListener("click", cerrarMenu);
        modalFicha.querySelector(".fichaMenuBoton").addEventListener("click", () => (menuAbierto() ? cerrarMenu() : abrirMenu()));
    }

    async function eliminarConPregunta(comercio) {
        const si = await window.piezas.preguntar({
            icono: "tacho",
            color: "peligro",
            titulo: "¿Eliminar " + comercio.nombre + "?",
            texto: "Se borra para siempre. Sus pedidos viejos quedan en el historial.",
            si: "Eliminar",
            claseSi: "pzBtnPeligro"
        });
        if (!si) return;
        cerrarFicha();
        eliminarComercioPorId(comercio.id);
        redibujarComerciosEnTodasPartes();
        mostrarToast("Comercio eliminado");
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
        if (event.key === "Escape") {
            if (document.querySelector(".pzFondo.visible")) return;
            if (menuAbierto()) cerrarMenu();
            else cerrarFicha();
        }
        if (event.key !== "Enter" && event.key !== " ") return;
        const tarjeta = document.activeElement?.closest?.(".comercioCard");
        if (tarjeta) {
            event.preventDefault();
            const titulo = tarjeta.querySelector("h3");
            if (titulo) abrirFicha(titulo.textContent);
        }
    });
}());
