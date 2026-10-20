// =====================================================
// VendeFrío - confianza.js (Etapa 7, tanda 1)
// T60: aviso de versión nueva, "N cambios sin subir" en Inicio y la
//      pantalla "Sin subir" con lo que quedó en este celular.
// T61: recordatorio de respaldo en Inicio (en vez de la ventana que tapaba).
// T62: "Informar un problema", con lo técnico adjunto, y la lista del dueño.
// =====================================================
(function () {
    const pz = () => window.piezas;
    const nube = () => window.nubeVendeFrio;
    const enLaNube = () => Boolean(nube()?.modoNube?.());

    // -------------------------------------------------
    // Versión nueva
    // -------------------------------------------------
    // El service worker (sw.js) se instala solo y toma el control apenas
    // hay una versión nueva. Esta pantalla sigue con el código viejo hasta
    // que se recarga: el aviso ofrece hacerlo en un toque.
    let versionNueva = false;
    let ultimaRevision = 0;
    const MINUTOS_ENTRE_REVISIONES = 30;

    function avisarVersionNueva() {
        versionNueva = true;
        dibujarAvisos();
    }

    function actualizarApp() {
        const boton = document.querySelector("#avisoVersionNueva button");
        if (boton) {
            boton.disabled = true;
            boton.textContent = "Actualizando…";
        }
        window.location.reload();
    }

    function revisarVersion() {
        if (!("serviceWorker" in navigator)) return;
        const ahora = Date.now();
        if (ahora - ultimaRevision < MINUTOS_ENTRE_REVISIONES * 60000) return;
        ultimaRevision = ahora;
        navigator.serviceWorker.getRegistration().then(registro => registro?.update()).catch(() => {});
    }

    if ("serviceWorker" in navigator) {
        const habiaControlador = Boolean(navigator.serviceWorker.controller);
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            // La primera vez que se instala no hay nada viejo que reemplazar.
            if (habiaControlador) avisarVersionNueva();
        });
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") revisarVersion();
        });
    }

    // -------------------------------------------------
    // Cambios sin subir
    // -------------------------------------------------
    const SEGUNDOS_ANTES_DE_AVISAR = 3;
    let pendienteDesde = 0;
    let relojAviso = null;

    function detalle() {
        return nube()?.detalleSinSubir?.() || null;
    }

    function textoCambios(cantidad) {
        return cantidad === 1 ? "1 cambio" : cantidad + " cambios";
    }

    // El aviso sale sin señal, o si lo pendiente tarda más de unos segundos
    // (con señal, un cambio sube enseguida y no hace falta avisar).
    function hayQueAvisarSinSubir(datos) {
        if (!datos || !datos.total) {
            pendienteDesde = 0;
            return false;
        }
        if (datos.estado !== "conectada") return true;
        if (!pendienteDesde) pendienteDesde = Date.now();
        const falta = SEGUNDOS_ANTES_DE_AVISAR * 1000 - (Date.now() - pendienteDesde);
        if (falta > 0) {
            clearTimeout(relojAviso);
            relojAviso = setTimeout(dibujarAvisos, falta + 50);
            return false;
        }
        return true;
    }

    function dibujarAvisos() {
        if (!pz()) return;
        pz().avisoInicio("avisoVersionNueva", versionNueva ? {
            color: "Pri",
            icono: "refrescar",
            titulo: "Hay una versión nueva",
            texto: "Trae arreglos. Tarda unos segundos.",
            boton: "Actualizar",
            alTocar: actualizarApp,
            orden: 0
        } : null, "arriba");

        const datos = enLaNube() ? detalle() : null;
        pz().avisoInicio("avisoSinSubir", hayQueAvisarSinSubir(datos) ? {
            color: "Aviso",
            icono: "nube",
            titulo: textoCambios(datos.total) + " sin subir",
            texto: datos.estado === "sinConexion" ? "Se suben solos cuando vuelva la señal" : "Se están subiendo a la nube",
            etiqueta: textoCambios(datos.total) + " sin subir. Ver el detalle",
            alTocar: abrirSinSubir,
            orden: 1
        } : null, "arriba");

        const dias = diasSinRespaldo();
        pz().avisoInicio("avisoRespaldo", dias === null ? null : {
            color: "Ok",
            icono: "disquete",
            titulo: dias < 0 ? "Todavía no guardaste un respaldo" : "Hace " + dias + " días que no guardás un respaldo",
            texto: "Descargalo en un toque, por si algo falla",
            boton: "Guardar",
            claseBoton: "pzBtnSec",
            alTocar: guardarRespaldo,
            orden: 5
        }, "abajo");

        if (document.getElementById("pantallaSinSubir")?.classList.contains("oculto") === false) dibujarSinSubir();
    }

    // -------------------------------------------------
    // Recordatorio de respaldo (T61)
    // -------------------------------------------------
    // Solo para el dueño (o sin cuenta): si pasaron 7 días (o lo elegido en
    // Más > Datos y respaldo) desde el último archivo descargado en este
    // celular, o nunca se descargó.
    const DIAS_SEGUN_PREFERENCIA = { diario: 1, semanal: 7, mensual: 30 };

    function diasSinRespaldo() {
        try {
            if (window.empleadosVendeFrio?.esEmpleado?.()) return null;
            const nubeReal = typeof usaNubeReal === "function" && usaNubeReal();
            if (nubeReal && !esDuenoEnLaNube()) return null;
            const ultimo = nubeReal
                ? obtenerFechaUltimoRespaldoNube()
                : (elegirFechaRespaldoMasReciente()?.fecha || null);
            const valido = ultimo && !Number.isNaN(ultimo.getTime());
            const dias = valido ? Math.floor((Date.now() - ultimo.getTime()) / 86400000) : -1;
            // Más > Datos y respaldo > "Recordarme el respaldo".
            const preferencia = window.preferenciasVendeFrio?.valor?.("recordarRespaldo") || "semanal";
            if (preferencia === "nunca") return null;
            if (valido && dias < (DIAS_SEGUN_PREFERENCIA[preferencia] || 7)) return null;
            // Sin datos no hay nada que guardar.
            const total = contarRegistrosRespaldo(crearDatosRespaldo());
            if (!total.comercios && !total.productos && !total.pedidos) return null;
            return dias;
        } catch (error) {
            return null;
        }
    }

    function guardarRespaldo() {
        exportarRespaldo();
        setTimeout(dibujarAvisos, 300);
    }

    function filaCambio(cambio, subido) {
        const p = pz();
        const nombre = cambio.nombre || cambio.titulo;
        const titulo = cambio.nombre ? cambio.titulo + " · " + cambio.nombre : cambio.titulo;
        const hora = p.hora(cambio.hora);
        const pie = [hora, cambio.detalle].filter(Boolean).join(" · ");
        return `<div class="pzFila">
            <div class="pzIni ${p.colorIni(nombre)}">${p.esc(p.iniciales(nombre))}</div>
            <div class="pzFilaTxt"><strong>${p.esc(titulo)}</strong><small>${p.esc(pie)}</small></div>
            ${subido ? '<span class="pzChip pzChipOk">Subido</span>' : '<span class="pzChip pzChipAviso">Esperando</span>'}
        </div>`;
    }

    function dibujarSinSubir() {
        const p = pz();
        const seccion = document.getElementById("pantallaSinSubir");
        if (!seccion || !p) return;
        const datos = detalle() || { estado: "apagado", pendientes: [], subidos: [], borrados: 0, fotos: 0, total: 0 };
        const contenido = seccion.querySelector("main");

        let banner;
        if (datos.estado === "sinConexion") {
            const desde = datos.sinSenalDesde ? " desde las " + p.hora(datos.sinSenalDesde) : "";
            banner = { color: "Aviso", icono: "alerta", titulo: "Sin señal" + desde, texto: "Nada se pierde: queda guardado en este celular" };
        } else if (datos.total) {
            banner = { color: "Pri", icono: "nube", titulo: "Subiendo " + textoCambios(datos.total), texto: "Hay señal: en un momento queda todo en la nube" };
        } else {
            banner = { color: "Ok", icono: "check", titulo: "Todo subido", texto: "Lo que hiciste en este celular ya está en la nube" };
        }

        const filas = datos.pendientes.map(cambio => filaCambio(cambio, false));
        if (datos.borrados) {
            filas.push(filaCambio({ titulo: "Borrado", detalle: datos.borrados === 1 ? "1 registro" : datos.borrados + " registros", hora: Date.now() }, false));
        }
        if (datos.fotos) {
            filas.push(filaCambio({ titulo: "Foto del comprobante", detalle: datos.fotos === 1 ? "1 foto" : datos.fotos + " fotos", hora: Date.now() }, false));
        }
        datos.subidos.forEach(cambio => filas.push(filaCambio(cambio, true)));

        contenido.innerHTML = `
            <div class="pzBanner pzBan${banner.color}">${p.ico(banner.icono, 22)}<div><strong>${p.esc(banner.titulo)}</strong><small>${p.esc(banner.texto)}</small></div></div>
            <div class="pzTarjeta pzLista pzFilaLarga">${filas.join("") || '<p class="pzVacio">No hay cambios esperando para subir.</p>'}</div>
            ${datos.total ? `<button type="button" class="pzBtn pzBtnPri pzBtnBloque" data-reintentar>${p.ico("refrescar", 18)}Reintentar ahora</button>
            <div class="pzNota">${p.ico("alerta", 20)}<span>Si falta subir algo, la app no te deja cerrar sesión: así ${datos.total === 1 ? "este cambio no se pierde" : "estos " + datos.total + " cambios no se pierden"}.</span></div>` : ""}`;
        contenido.querySelector("[data-reintentar]")?.addEventListener("click", reintentar);
    }

    async function reintentar(evento) {
        const boton = evento?.currentTarget;
        if (boton) boton.disabled = true;
        const pudo = await (nube()?.reintentarSubida?.() || Promise.resolve(false));
        if (boton) boton.disabled = false;
        if (!pudo) {
            window.mostrarToast?.("Todavía no hay señal. Se va a subir solo cuando vuelva.", "error");
        } else {
            window.mostrarToast?.("Probando de nuevo…");
        }
        dibujarSinSubir();
    }

    function abrirSinSubir() {
        const p = pz();
        const seccion = p.pantalla("pantallaSinSubir", {
            titulo: "Sin subir",
            sub: "Lo que quedó en este celular",
            icono: "nube",
            volverA: "menu",
            accion: { icono: "refrescar", nombre: "Reintentar ahora", alTocar: reintentar }
        });
        p.mostrar(seccion);
        dibujarSinSubir();
    }

    // -------------------------------------------------
    // Informar un problema (T62)
    // -------------------------------------------------
    // Se manda a la nube de la distribuidora (problemas/{id}) con la
    // versión, la pantalla donde estaba, los errores de hoy y el celular. El
    // dueño los ve en Más > Seguridad y ayuda > Problemas informados.
    const NOMBRES_PANTALLAS = {
        pantallaMenu: "Inicio", pantallaPedido: "Pedidos", pantallaComercios: "Comercios",
        pantallaProductos: "Productos", pantallaHistorial: "Historial", pantallaRutas: "Rutas",
        pantallaCatalogo: "Catálogo", pantallaEstadisticas: "Estadísticas", pantallaCierre: "Cierre del día",
        pantallaWhatsapp: "WhatsApp"
    };
    let ultimaPantalla = "Inicio";

    document.addEventListener("click", () => {
        const visible = [...document.querySelectorAll('body > section[id^="pantalla"]')]
            .find(seccion => !seccion.classList.contains("oculto") && seccion.id !== "pantallaConfiguracion");
        if (!visible) return;
        ultimaPantalla = NOMBRES_PANTALLAS[visible.id] || visible.querySelector(":scope > header h1")?.textContent?.trim() || visible.id;
    }, true);

    function version() {
        return window.novedadesVendeFrio?.version || "1.0";
    }

    function inicioDeHoy() {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        return hoy.getTime();
    }

    function adjuntos() {
        const errores = pz().erroresRecientes(inicioDeHoy());
        return {
            version: version(),
            pantalla: ultimaPantalla,
            errores: errores.slice(0, 10).map(error => pz().hora(error.hora) + " " + error.texto),
            dispositivo: pz().dispositivo()
        };
    }

    function textoAdjuntos(datos) {
        const errores = datos.errores.length === 1 ? "1 error de hoy" : datos.errores.length + " errores de hoy";
        return "Versión " + datos.version + " · " + datos.pantalla + " · " + errores + " · " + datos.dispositivo;
    }

    function informeEnTexto(problema) {
        return [
            "Problema en VendeFrío",
            problema.texto,
            "",
            "Versión: " + problema.version,
            "Pantalla: " + problema.pantalla,
            "Celular: " + problema.dispositivo,
            problema.persona?.nombre ? "Quién: " + problema.persona.nombre : "",
            problema.horaCelular ? "Cuándo: " + new Date(problema.horaCelular).toLocaleString("es-AR") : "",
            problema.errores.length ? "Errores:\n" + problema.errores.join("\n") : "Errores: ninguno"
        ].filter(linea => linea !== "").join("\n");
    }

    async function copiar(texto) {
        try {
            await navigator.clipboard.writeText(texto);
            window.mostrarToast?.("Copiado");
            return true;
        } catch (error) {
            return false;
        }
    }

    function informarProblema() {
        const p = pz();
        const datos = adjuntos();
        let captura = null;
        const caja = p.hoja({
            titulo: "¿Qué pasó?",
            sub: "Contalo con tus palabras. Lo técnico se adjunta solo.",
            etiqueta: "Informar un problema",
            html: `
                <label class="pzCampo"><span class="pzOcultar">Qué pasó</span>
                    <textarea id="textoProblema" maxlength="2000" placeholder="Por ejemplo: no me deja marcar entregado el pedido de Súper Ruta 3" aria-label="Qué pasó" autofocus></textarea>
                </label>
                <div class="pzFotos">
                    <div class="pzFotoVista pzOcultar" id="vistaCapturaProblema"></div>
                    <label class="pzFotoAgregar">${p.ico("camara", 22)}<span>Captura</span>
                        <input type="file" accept="image/*" id="capturaProblema" class="pzOcultar">
                    </label>
                </div>
                <div class="pzBanner pzBanPri pzEnHoja">${p.ico("documento", 20)}<div><strong>Se adjunta solo</strong><small>${p.esc(textoAdjuntos(datos))}</small></div></div>`,
            botones: [{
                texto: "Enviar",
                icono: "flechaDerecha",
                alTocar: async (hoja, boton) => {
                    const texto = hoja.querySelector("#textoProblema").value.trim();
                    if (!texto) {
                        window.mostrarToast?.("Contá qué pasó antes de enviar", "error");
                        hoja.querySelector("#textoProblema").focus();
                        return false;
                    }
                    boton.disabled = true;
                    const enviado = await enviarProblema({ texto, captura, ...datos });
                    boton.disabled = false;
                    return enviado;
                }
            }]
        });
        caja.querySelector("#capturaProblema").addEventListener("change", async evento => {
            const archivo = evento.target.files && evento.target.files[0];
            if (!archivo) return;
            try {
                captura = await p.comprimirImagen(archivo, { lado: 1080, largoMaximo: 500000 });
                const vista = caja.querySelector("#vistaCapturaProblema");
                vista.style.backgroundImage = "url(" + captura + ")";
                vista.classList.remove("pzOcultar");
            } catch (error) {
                window.mostrarToast?.(error.message, "error");
            }
        });
    }

    async function enviarProblema(datos) {
        const p = pz();
        const ref = p.refNube();
        const problema = { ...datos, persona: p.persona(), horaCelular: Date.now() };
        if (!ref || !problema.persona) {
            // Sin cuenta: se comparte el texto (WhatsApp, mail) o se copia.
            const texto = informeEnTexto(problema);
            try {
                if (navigator.share) {
                    await navigator.share({ title: "Problema en VendeFrío", text: texto });
                    return true;
                }
            } catch (error) {
                if (error && error.name === "AbortError") return false;
            }
            if (await copiar(texto)) {
                p.modal({ icono: "copiar", color: "ok", titulo: "Informe copiado", texto: "Pegalo en un mensaje a quien te ayuda con VendeFrío.", botones: [{ texto: "Listo", clase: "pzBtnPri" }] });
                return false;
            }
            window.mostrarToast?.("No se pudo compartir el informe", "error");
            return false;
        }
        try {
            // Sin esperar a la nube: sin señal queda guardado y sube solo.
            ref.collection("problemas").doc(generarId("prob")).set({
                texto: problema.texto,
                captura: problema.captura || null,
                version: problema.version,
                pantalla: String(problema.pantalla).slice(0, 60),
                errores: problema.errores.map(error => String(error).slice(0, 320)),
                dispositivo: problema.dispositivo,
                persona: problema.persona,
                horaCelular: problema.horaCelular,
                visto: false
            }).catch(error => {
                console.error("No se pudo mandar el problema.", error);
                window.mostrarToast?.("La nube no aceptó el informe", "error");
            });
        } catch (error) {
            window.mostrarToast?.("No se pudo mandar el informe", "error");
            return false;
        }
        p.modal({
            icono: "check", color: "ok", titulo: "¡Gracias! Ya lo mandaste",
            texto: p.esDueno() ? "Queda en Más > Seguridad y ayuda > Problemas informados." : "Le llega a tu encargado, con todo lo técnico.",
            botones: [{ texto: "Listo", clase: "pzBtnPri" }]
        });
        return false;
    }

    async function verProblemas() {
        const p = pz();
        const ref = p.refNube();
        const seccion = p.pantalla("pantallaProblemas", { titulo: "Problemas", sub: "Lo que informaron en tu distribuidora", icono: "bandera", volverA: "mas" });
        p.mostrar(seccion);
        const contenido = seccion.querySelector("main");
        if (!ref) {
            contenido.innerHTML = '<p class="pzVacio">Hace falta la cuenta de la distribuidora.</p>';
            return;
        }
        contenido.innerHTML = '<p class="pzVacio">Cargando…</p>';
        let foto;
        try {
            foto = await ref.collection("problemas").orderBy("horaCelular", "desc").limit(40).get();
        } catch (error) {
            contenido.innerHTML = '<p class="pzVacio">No se pudieron leer. Probá con internet.</p>';
            return;
        }
        const problemas = foto.docs.map(documento => ({ id: documento.id, ...documento.data() }));
        if (!problemas.length) {
            contenido.innerHTML = '<div class="pzBanner pzBanOk">' + p.ico("check", 22) + '<div><strong>No hay problemas informados</strong><small>Cuando alguien informe uno, aparece acá.</small></div></div>';
            return;
        }
        contenido.innerHTML = `<div class="pzTarjeta pzLista">${problemas.map(problema => `
            <button type="button" class="pzFila" data-problema="${p.esc(problema.id)}">
                <div class="pzIni ${p.colorIni(problema.persona?.nombre)}">${p.esc(p.iniciales(problema.persona?.nombre || "?"))}</div>
                <div class="pzFilaTxt"><strong>${p.esc(problema.texto)}</strong><small>${p.esc([problema.persona?.nombre, p.fechaCorta(problema.horaCelular) + " " + p.hora(problema.horaCelular), problema.pantalla].filter(Boolean).join(" · "))}</small></div>
                ${problema.visto ? '<span class="pzChip pzChipGris">Visto</span>' : '<span class="pzChip pzChipAviso">Nuevo</span>'}
            </button>`).join("")}</div>
            <div class="pzNota pzNotaInfo">${p.ico("info", 20)}<span>Tocá uno para ver el detalle y copiarlo, así se lo pasás a quien arregla la app.</span></div>`;
        contenido.querySelectorAll("[data-problema]").forEach(fila => {
            fila.addEventListener("click", () => {
                const problema = problemas.find(item => item.id === fila.dataset.problema);
                if (problema) verProblema(ref, problema);
            });
        });
    }

    function verProblema(ref, problema) {
        const p = pz();
        p.hoja({
            titulo: problema.persona?.nombre ? "Informó " + problema.persona.nombre : "Problema informado",
            sub: p.fechaCorta(problema.horaCelular) + " · " + p.hora(problema.horaCelular),
            html: `<div class="pzCampo"><div class="pzTextoLeido">${p.esc(problema.texto)}</div></div>
                ${problema.captura ? `<img class="pzCapturaGrande" alt="Captura del problema" src="${p.esc(problema.captura)}">` : ""}
                <div class="pzBanner pzBanPri pzEnHoja">${p.ico("documento", 20)}<div><strong>Lo técnico</strong><small>${p.esc(textoAdjuntos({ ...problema, errores: problema.errores || [] }))}</small></div></div>`,
            botones: [
                { texto: "Copiar el informe", icono: "copiar", clase: "pzBtnPri", alTocar: () => copiar(informeEnTexto({ ...problema, errores: problema.errores || [] })) }
            ]
        });
        if (!problema.visto) {
            ref.collection("problemas").doc(problema.id).update({ visto: true }).catch(() => {});
            problema.visto = true;
        }
    }

    function conectar() {
        const api = nube();
        if (!api) return;
        api.escuchar?.(() => dibujarAvisos());
        api.escucharSincronizacion?.(() => dibujarAvisos());
    }

    // Los avisos se redibujan con Inicio.
    if (typeof window.actualizarDashboard === "function") {
        const dibujarInicio = window.actualizarDashboard;
        window.actualizarDashboard = function () {
            const resultado = dibujarInicio.apply(this, arguments);
            dibujarAvisos();
            return resultado;
        };
    }

    if (window.nubeVendeFrio) conectar();
    else window.addEventListener("nubeVendeFrioLista", conectar, { once: true });
    window.addEventListener("online", dibujarAvisos);
    window.addEventListener("offline", dibujarAvisos);

    window.confianzaVendeFrio = {
        avisarVersionNueva,
        abrirSinSubir,
        dibujarAvisos,
        informarProblema,
        verProblemas
    };
})();
