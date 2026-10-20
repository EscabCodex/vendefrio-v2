// =====================================================
// VendeFrío - whatsapp.js
// Pedidos por WhatsApp (T55 a T59), en Más > WhatsApp:
// - Ronda de pedidos (T55): un mensaje con el nombre de cada comercio
//   ("Hola {nombre}, ¿tenías pedido?"). Sin cuentas, la app abre WhatsApp
//   con el texto listo, uno por uno, y vos tocás "Enviar". Con WhatsApp
//   automático prendido, el dueño lo manda a todos con un toque.
// - Compartir a VendeFrío (T56): un mensaje o un audio compartido desde
//   WhatsApp abre "Dictar o pegar pedido" con lo que se entendió.
// - Mensajes para revisar (T57): con WhatsApp automático, las respuestas de
//   los comercios llegan solas (api/whatsapp.js) y la app arma el pedido de
//   cada una: se carga con un toque, o todos los que se entendieron juntos.
// - WhatsApp automático (T58) y audios a texto (T59): ajustes del dueño,
//   apagados hasta que se conecte la cuenta de Meta (M16) y la clave de
//   audio a texto (M14) en Vercel.
// =====================================================

(function () {
    const CLAVE_MENSAJE = "vendefrio_whatsapp_mensaje";
    const MENSAJE_INICIAL = "Hola {nombre}, ¿cómo estás? Quería saber si tenías pedido para pasarme. Vamos a estar repartiendo toda la semana. ¡Muchas gracias!";
    const PLANTILLA_INICIAL = "pedido_semana";
    const LARGO_MAXIMO_OBS = 240;
    // Palabras de cortesía que no son productos ("sí, dale, mandame…").
    const CORTESIA = /\b(si|dale|bueno|buenisimo|ok|okey|joya|genial|perfecto|como estas|todo bien|un abrazo|abrazo|saludos|muchas|muchisimas|gracias|pasame|pasa|traeme|trae|por favor|porfa|esta semana|para el martes|el martes|te pido|quiero|necesito)\b/g;

    const CANTIDAD = /\d|\b(un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|docena|media)\b/;

    // Lo que entendió la IA de un mensaje (T54, «Voz con IA»): id → { texto, lectura }.
    const lecturasIA = new Map();
    // Lo que se eligió para lo no entendido (T118): id del mensaje → { tramo: producto o "no" }.
    const respuestasNoEntendido = new Map();

    let elegidos = new Set();
    let ronda = null;
    let config = { activo: false, audios: false, plantilla: PLANTILLA_INICIAL, idioma: "es_AR" };
    let mensajes = [];
    let escuchando = "";
    let quitarEscuchas = [];
    let pendiente = null;
    let conexion = null;
    let busqueda = "";

    // -------------------------------------------------
    // Utilidades
    // -------------------------------------------------

    function escapar(texto) {
        return String(texto ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function ico(nombre, tamano) {
        return window.icono ? window.icono(nombre, tamano) : "";
    }

    function enLaNube() {
        return typeof usaNubeReal === "function" && usaNubeReal();
    }

    function esElDueno() {
        return enLaNube() && Boolean(window.empleadosVendeFrio?.esDueno?.());
    }

    function idDistribuidora() {
        return window.distribuidoraVendeFrio?.idActual?.() || "";
    }

    function refDistribuidora() {
        const id = idDistribuidora();
        try {
            if (!id || !window.firebase?.apps?.length) return null;
            return window.firebase.firestore().collection("distribuidoras").doc(id);
        } catch (error) {
            return null;
        }
    }

    function normalizar(texto) {
        return String(texto || "").toLocaleLowerCase("es").normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    }

    // El número como lo usa WhatsApp: Argentina con 549 adelante y sin el 0
    // ni el 15 (igual que el botón WhatsApp de la ficha del comercio).
    function numeroWhatsapp(telefono) {
        let digitos = String(telefono || "").replace(/\D/g, "");
        if (digitos.length < 8) return "";
        if (!digitos.startsWith("54")) digitos = "549" + digitos.replace(/^0/, "").replace(/^(\d{2,4})15(\d{6,8})$/, "$1$2");
        return digitos;
    }

    function textoDelMensaje() {
        try {
            const guardado = localStorage.getItem(CLAVE_MENSAJE);
            if (guardado && guardado.trim()) return guardado;
        } catch (error) {
            // Sin almacenamiento: queda el de siempre.
        }
        return MENSAJE_INICIAL;
    }

    function guardarTextoDelMensaje(texto) {
        try {
            localStorage.setItem(CLAVE_MENSAJE, String(texto || ""));
        } catch (error) {
            console.warn("No se pudo guardar el mensaje de la ronda.", error);
        }
    }

    function textoPara(comercio) {
        return textoDelMensaje().replace(/\{nombre\}/gi, String(comercio && comercio.nombre || "").trim());
    }

    function enlacePara(comercio) {
        const numero = numeroWhatsapp(comercio && comercio.telefono);
        return numero ? "https://wa.me/" + numero + "?text=" + encodeURIComponent(textoPara(comercio)) : "";
    }

    function comercios() {
        return (typeof comerciosActivos === "function" ? comerciosActivos() : [])
            .filter(comercio => comercio && comercio.nombre)
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    }

    function nombrePersona() {
        const yo = window.empleadosVendeFrio?.quienSoy?.();
        return String(yo && yo.nombre || (yo && yo.tipo === "dueno" ? "El dueño" : "")).slice(0, 60);
    }

    function horaCorta(hora) {
        const fecha = new Date(Number(hora) || 0);
        const hoy = new Date();
        const dosDigitos = numero => String(numero).padStart(2, "0");
        const reloj = dosDigitos(fecha.getHours()) + ":" + dosDigitos(fecha.getMinutes());
        if (fecha.toDateString() === hoy.toDateString()) return reloj;
        return dosDigitos(fecha.getDate()) + "/" + dosDigitos(fecha.getMonth() + 1) + " " + reloj;
    }

    // Ventana de confirmar con dos botones. Devuelve true si confirma.
    function confirmar(titulo, texto, botonSi) {
        return new Promise(resolver => {
            const ventana = document.createElement("div");
            ventana.className = "modal waConfirmar";
            ventana.innerHTML = `
                <div class="modalContenido" role="dialog" aria-modal="true">
                    <h2></h2>
                    <p></p>
                    <div class="modalBotones">
                        <button type="button" class="btnModalSecundario" data-respuesta="no">Cancelar</button>
                        <button type="button" class="btnModalConfirmar" data-respuesta="si"></button>
                    </div>
                </div>`;
            ventana.querySelector("h2").textContent = titulo;
            ventana.querySelector("p").textContent = texto;
            ventana.querySelector('[data-respuesta="si"]').textContent = botonSi;
            ventana.addEventListener("click", evento => {
                const boton = evento.target.closest("[data-respuesta]");
                if (!boton && evento.target !== ventana) return;
                ventana.remove();
                resolver(Boolean(boton && boton.dataset.respuesta === "si"));
            });
            document.body.appendChild(ventana);
        });
    }

    // -------------------------------------------------
    // Leer un mensaje y armar el pedido
    // -------------------------------------------------

    function comercioDelMensaje(mensaje, lectura) {
        const lista = comercios();
        if (mensaje.idComercio) {
            const porId = lista.find(comercio => String(comercio.id) === String(mensaje.idComercio));
            if (porId) return porId;
        }
        if (mensaje.de) {
            const porNumero = lista.find(comercio => {
                const numero = numeroWhatsapp(comercio.telefono);
                return numero && numero.slice(-10) === String(mensaje.de).slice(-10);
            });
            if (porNumero) return porNumero;
        }
        return lectura && lectura.comercio || null;
    }

    // Lo que se entendió del mensaje: { comercio, productos, sinEntender, cambios, completo }.
    function leerMensaje(mensaje) {
        const lector = window.vozVendeFrio?.leerPedido;
        // Cada oración va en su renglón, así «… bombón. Tengo 1 cambio» no
        // queda pegado al producto de antes (el punto de «1.5» no corta).
        const texto = normalizar(mensaje && mensaje.texto).replace(/([^\d\s])[.!?]+(?=\s|$)/g, "$1\n").replace(CORTESIA, " ");
        const deIA = mensaje && lecturasIA.get(mensaje.id);
        const lectura = deIA && deIA.texto === mensaje.texto
            ? deIA.lectura
            : lector && texto.trim() ? lector(texto) : { comercio: null, productos: [], sinEntender: [] };
        const comercio = comercioDelMensaje(mensaje || {}, lectura);
        // Lo que no se entendió y tiene una cantidad parece un producto
        // ("2 cajas de alfajores"); lo demás es charla ("soy del kiosco").
        const respuestas = mensaje && respuestasNoEntendido.get(mensaje.id) || {};
        const elegidos = [];
        const dudosos = (lectura.sinEntender || []).filter(tramo => CANTIDAD.test(tramo)).filter(tramo => {
            const respuesta = respuestas[tramo];
            if (respuesta && respuesta !== "no") elegidos.push({ marca: respuesta.marca, producto: respuesta.producto, cantidad: respuesta.cantidad, dicho: tramo });
            return !respuesta;
        });
        return {
            comercio,
            productos: [...(lectura.productos || []), ...elegidos],
            sinEntender: dudosos,
            // Los cambios («2 cambio de ñoquis») no se suman: van en la observación.
            cambios: lectura.cambios || [],
            completo: Boolean(comercio && (lectura.productos.length || elegidos.length) && !dudosos.length)
        };
    }

    function observacionDe(mensaje, lectura) {
        const cambios = lectura && lectura.cambios && lectura.cambios.length ? "Cambios: " + lectura.cambios.join(", ") + ". " : "";
        const texto = String(mensaje.texto || "").replace(/\s+/g, " ").trim();
        const corto = texto.length > LARGO_MAXIMO_OBS ? texto.slice(0, LARGO_MAXIMO_OBS - 1) + "…" : texto;
        return cambios + (mensaje.tipo === "audio" ? "Audio de WhatsApp" : "WhatsApp") + (corto ? ": «" + corto + "»" : "");
    }

    function borradorConAlgo() {
        const datos = typeof obtenerDatosBorradorPedido === "function" ? obtenerDatosBorradorPedido() : null;
        return Boolean(datos && (datos.cantidades.length || datos.observaciones));
    }

    function llenarPedido(mensaje, lectura) {
        if (typeof abrirPedidoNuevoParaComercio !== "function") return false;
        abrirPedidoNuevoParaComercio(lectura.comercio ? lectura.comercio.nombre : "");
        if (typeof window.agregarProductosAlPedido === "function") {
            window.agregarProductosAlPedido(lectura.productos, lectura.comercio ? lectura.comercio.nombre : "");
        }
        const observaciones = document.getElementById("obs");
        if (observaciones) {
            observaciones.value = observacionDe(mensaje, lectura);
            observaciones.dispatchEvent(new Event("input", { bubbles: true }));
        }
        return true;
    }

    // «Entender con IA» (T54): la misma IA de «Voz con IA» lee el mensaje.
    async function entenderConIA(id, boton) {
        const mensaje = mensajes.find(item => item.id === id);
        const leer = window.vozVendeFrio?.leerPedidoConIA;
        if (!mensaje || !leer) return;
        boton.disabled = true;
        boton.lastChild.textContent = " Pensando…";
        let lectura = null;
        try {
            lectura = await leer(String(mensaje.texto || ""));
        } catch (error) {
            console.warn("La IA no pudo leer el mensaje.", error);
        }
        if (lectura) lecturasIA.set(id, { texto: mensaje.texto, lectura });
        else if (typeof mostrarToast === "function") mostrarToast("La IA no respondió. Revisá que «Voz con IA» esté prendida en Más > Trabajo.", "error");
        redibujar();
    }

    async function marcarMensaje(id, estado) {
        const ref = refDistribuidora();
        if (!ref || !id) return;
        try {
            await ref.collection("whatsapp").doc(id).update({ estado, atendido: { nombre: nombrePersona(), hora: Date.now() } });
        } catch (error) {
            console.error("No se pudo marcar el mensaje de WhatsApp.", error);
            if (typeof mostrarToast === "function") mostrarToast("No se pudo guardar. Revisá la conexión.", "error");
        }
    }

    // Un mensaje: abre "Nuevo pedido" ya armado para revisarlo y guardarlo.
    async function cargarUno(id) {
        const mensaje = mensajes.find(item => item.id === id);
        if (!mensaje) return;
        if (borradorConAlgo() && !(await confirmar("¿Reemplazar el pedido a medio cargar?", "En «Nuevo pedido» hay un pedido sin guardar. Si seguís, se reemplaza por el de este mensaje.", "Reemplazar"))) return;
        const lectura = leerMensaje(mensaje);
        if (!llenarPedido(mensaje, lectura)) return;
        pendiente = { id };
        window.scrollTo(0, 0);
        if (typeof mostrarToast === "function") mostrarToast("Revisá el pedido y tocá «Guardar pedido»");
    }

    // Todos los que se entendieron completos: se guardan solos, uno atrás
    // del otro, con el texto del mensaje en las observaciones.
    async function cargarEntendidos() {
        const lista = mensajes.filter(mensaje => leerMensaje(mensaje).completo);
        if (!lista.length) return;
        const pregunta = lista.length === 1 ? "Se guarda 1 pedido como «Cargado»." : "Se guardan " + lista.length + " pedidos como «Cargado».";
        const aviso = borradorConAlgo() ? " El pedido a medio cargar en «Nuevo pedido» se reemplaza." : "";
        if (!(await confirmar("¿Cargar los pedidos que se entendieron?", pregunta + aviso, "Cargar"))) return;

        let cargados = 0;
        for (const mensaje of lista) {
            const lectura = leerMensaje(mensaje);
            if (!llenarPedido(mensaje, lectura)) break;
            const guardado = typeof generarPedido === "function" && generarPedido();
            document.getElementById("modalPedido")?.classList.add("oculto");
            if (!guardado) break;
            cargados++;
            await marcarMensaje(mensaje.id, "cargado");
        }
        if (typeof limpiarPedido === "function") limpiarPedido();
        abrir();
        if (typeof mostrarToast === "function") {
            mostrarToast(cargados === 1 ? "Se cargó 1 pedido de WhatsApp" : "Se cargaron " + cargados + " pedidos de WhatsApp");
        }
    }

    // Al guardar el pedido de un mensaje (se abre la ventana del pedido
    // generado), el mensaje queda "cargado".
    function vigilarPedidoGuardado() {
        const modal = document.getElementById("modalPedido");
        if (!modal) return;
        new MutationObserver(() => {
            if (!pendiente || modal.classList.contains("oculto")) return;
            const { id } = pendiente;
            pendiente = null;
            marcarMensaje(id, "cargado");
        }).observe(modal, { attributes: true, attributeFilter: ["class"] });
    }

    // -------------------------------------------------
    // Nube: ajustes y mensajes
    // -------------------------------------------------

    function dejarDeEscuchar() {
        quitarEscuchas.forEach(quitar => {
            try {
                quitar();
            } catch (error) {
                // Ya estaba cerrada.
            }
        });
        quitarEscuchas = [];
        mensajes = [];
        config = { activo: false, audios: false, plantilla: PLANTILLA_INICIAL, idioma: "es_AR" };
    }

    function revisarEscucha() {
        const clave = enLaNube() ? idDistribuidora() : "";
        if (clave === escuchando) return;
        dejarDeEscuchar();
        escuchando = clave;
        const ref = clave ? refDistribuidora() : null;
        if (!ref) {
            escuchando = "";
            redibujar();
            return;
        }
        quitarEscuchas.push(ref.collection("config").doc("whatsapp").onSnapshot(foto => {
            const datos = foto.data() || {};
            config = {
                activo: datos.activo === true,
                audios: datos.audios === true,
                plantilla: String(datos.plantilla || PLANTILLA_INICIAL),
                idioma: String(datos.idioma || "es_AR")
            };
            redibujar();
        }, error => console.warn("No se pudo leer el ajuste de WhatsApp.", error)));
        quitarEscuchas.push(ref.collection("whatsapp").where("estado", "==", "nuevo").limit(100).onSnapshot(foto => {
            mensajes = foto.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (Number(b.hora) || 0) - (Number(a.hora) || 0));
            redibujar();
        }, error => console.warn("No se pudieron leer los mensajes de WhatsApp.", error)));
    }

    async function guardarConfig(cambios) {
        const ref = refDistribuidora();
        if (!ref || !esElDueno()) return;
        const nueva = { ...config, ...cambios };
        try {
            await ref.collection("config").doc("whatsapp").set({
                activo: nueva.activo === true,
                audios: nueva.audios === true,
                plantilla: String(nueva.plantilla || PLANTILLA_INICIAL).slice(0, 512),
                idioma: String(nueva.idioma || "es_AR").slice(0, 10)
            });
        } catch (error) {
            console.error("No se pudo guardar el ajuste de WhatsApp.", error);
            if (typeof mostrarToast === "function") mostrarToast("No se pudo guardar el ajuste.", "error");
            redibujar();
        }
    }

    async function llamarFuncion(direccion, cuerpo) {
        const usuario = window.firebase?.auth?.().currentUser;
        if (!usuario) throw new Error("Falta iniciar sesión.");
        const credencial = await usuario.getIdToken();
        const respuesta = await fetch(direccion, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + credencial },
            body: JSON.stringify({ idDistribuidora: idDistribuidora(), ...cuerpo })
        });
        const datos = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) {
            const error = new Error(datos.message || "La función respondió " + respuesta.status + ".");
            error.codigo = datos.codigo || "";
            throw error;
        }
        return datos;
    }

    async function revisarConexion() {
        conexion = { revisando: true };
        redibujar();
        try {
            conexion = await llamarFuncion("/api/whatsapp-enviar", { accion: "estado" });
        } catch (error) {
            conexion = { error: error.codigo === "sinFirebase" ? "Falta la cuenta de servicio de la nube en Vercel (M8)." : "No se pudo revisar: " + error.message };
        }
        redibujar();
    }

    async function enviarAutomatico() {
        const lista = comercios().filter(comercio => elegidos.has(String(comercio.id)) && numeroWhatsapp(comercio.telefono));
        if (!lista.length) return;
        const texto = lista.length === 1 ? "Se manda la plantilla aprobada por Meta a 1 comercio." : "Se manda la plantilla aprobada por Meta a " + lista.length + " comercios.";
        if (!(await confirmar("¿Mandar la ronda por WhatsApp?", texto + " Meta cobra cada mensaje.", "Mandar"))) return;
        const boton = document.getElementById("waEnviarTodos");
        if (boton) {
            boton.disabled = true;
            boton.textContent = "Mandando…";
        }
        try {
            const datos = await llamarFuncion("/api/whatsapp-enviar", { accion: "enviar", idsComercios: lista.map(comercio => String(comercio.id)) });
            const fallaron = (datos.resultados || []).filter(item => !item.ok);
            if (typeof mostrarAviso === "function") {
                mostrarAviso(
                    datos.enviados === 1 ? "Se mandó 1 mensaje" : "Se mandaron " + datos.enviados + " mensajes",
                    fallaron.length
                        ? "No se pudo mandar a: " + fallaron.map(item => (item.nombre || "un comercio") + " (" + item.motivo + ")").join(", ") + "."
                        : "Las respuestas van a llegar acá, en «Mensajes para revisar»."
                );
            }
        } catch (error) {
            const textos = {
                apagado: "WhatsApp automático está apagado.",
                sinWhatsapp: "Falta conectar la cuenta de WhatsApp de Meta en Vercel (M16)."
            };
            if (typeof mostrarAviso === "function") mostrarAviso("No se mandó la ronda", textos[error.codigo] || error.message);
        }
        redibujar();
    }

    // -------------------------------------------------
    // Pantalla
    // -------------------------------------------------

    function crearPantalla() {
        const seccion = document.createElement("section");
        seccion.id = "pantallaWhatsapp";
        seccion.className = "oculto pantallaExtra pantallaWhatsapp";
        seccion.innerHTML = `
            <header>
                <div class="logo">${ico("whatsapp", 22)}</div>
                <div><h1>WhatsApp</h1><p>Pedidos por WhatsApp</p></div>
            </header>
            <main class="container" id="contenidoWhatsapp"></main>`;
        document.body.insertBefore(seccion, document.querySelector("nav.bottom-nav"));

        seccion.addEventListener("click", evento => {
            const boton = evento.target.closest("[data-wa]");
            if (!boton) return;
            const accion = boton.dataset.wa;
            if (accion === "todos" || accion === "ninguno") {
                comerciosVisibles().forEach(comercio => {
                    if (!numeroWhatsapp(comercio.telefono)) return;
                    if (accion === "todos") elegidos.add(String(comercio.id));
                    else elegidos.delete(String(comercio.id));
                });
                redibujar();
            } else if (accion === "empezar") {
                const ids = comercios().filter(comercio => elegidos.has(String(comercio.id)) && numeroWhatsapp(comercio.telefono)).map(comercio => String(comercio.id));
                if (!ids.length) return;
                ronda = { ids, enviados: new Set(), salteados: new Set() };
                redibujar();
                window.scrollTo(0, 0);
            } else if (accion === "enviarUno") {
                // El enlace abre WhatsApp; acá solo se marca como enviado.
                ronda?.enviados.add(boton.dataset.id);
                setTimeout(redibujar, 50);
            } else if (accion === "saltear") {
                // T119: pasa al que sigue; queda en la lista para mandarle después.
                ronda?.salteados?.add(boton.dataset.id);
                redibujar();
            } else if (accion === "terminar") {
                ronda = null;
                redibujar();
            } else if (accion === "automatico") {
                enviarAutomatico();
            } else if (accion === "restablecer") {
                guardarTextoDelMensaje("");
                redibujar();
            } else if (accion === "cargar") {
                cargarUno(boton.dataset.id);
            } else if (accion === "ia") {
                entenderConIA(boton.dataset.id, boton);
            } else if (accion === "descartar") {
                marcarMensaje(boton.dataset.id, "descartado");
            } else if (accion === "cargarEntendidos") {
                cargarEntendidos();
            } else if (accion === "revisarConexion") {
                revisarConexion();
            } else if (accion === "copiarCodigo") {
                navigator.clipboard?.writeText(idDistribuidora()).then(() => {
                    if (typeof mostrarToast === "function") mostrarToast("Código copiado");
                }).catch(() => {});
            }
        });
        seccion.addEventListener("change", evento => {
            const campo = evento.target;
            if (campo.matches(".waElegir")) {
                if (campo.checked) elegidos.add(campo.value);
                else elegidos.delete(campo.value);
                actualizarBotonesRonda();
            } else if (campo.id === "waLlaveActivo") {
                guardarConfig({ activo: campo.checked });
            } else if (campo.id === "waLlaveAudios") {
                guardarConfig({ audios: campo.checked });
            } else if (campo.id === "waPlantilla") {
                const valor = campo.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
                guardarConfig({ plantilla: valor || PLANTILLA_INICIAL });
            }
        });
        seccion.addEventListener("input", evento => {
            if (evento.target.id === "waTexto") {
                guardarTextoDelMensaje(evento.target.value);
                const ejemplo = document.getElementById("waEjemplo");
                const primero = comercios()[0];
                if (ejemplo) ejemplo.textContent = textoPara(primero || { nombre: "Almacén" });
            } else if (evento.target.id === "waBuscar") {
                busqueda = evento.target.value;
                dibujarListaComercios();
            }
        });
        return seccion;
    }

    function comerciosVisibles() {
        const buscado = normalizar(busqueda);
        return comercios().filter(comercio => !buscado || normalizar(comercio.nombre).includes(buscado));
    }

    function cantidadElegidos() {
        return comercios().filter(comercio => elegidos.has(String(comercio.id)) && numeroWhatsapp(comercio.telefono)).length;
    }

    function actualizarBotonesRonda() {
        const cantidad = cantidadElegidos();
        const empezar = document.getElementById("waEmpezar");
        if (empezar) {
            empezar.disabled = cantidad === 0;
            empezar.innerHTML = ico("whatsapp", 18) + " Empezar ronda (" + cantidad + ")";
        }
        const todos = document.getElementById("waEnviarTodos");
        if (todos) {
            todos.disabled = cantidad === 0;
            todos.innerHTML = ico("compartir", 18) + " Mandar a " + cantidad + " automáticamente";
        }
        const resumen = document.getElementById("waResumenElegidos");
        if (resumen) resumen.textContent = cantidad === 1 ? "1 elegido" : cantidad + " elegidos";
    }

    function dibujarListaComercios() {
        const lista = document.getElementById("waListaComercios");
        if (!lista) return;
        const visibles = comerciosVisibles();
        if (!visibles.length) {
            lista.innerHTML = `<p class="waVacio">${comercios().length ? "No hay comercios con ese nombre." : "Todavía no cargaste comercios."}</p>`;
            return;
        }
        lista.innerHTML = visibles.map(comercio => {
            const numero = numeroWhatsapp(comercio.telefono);
            const id = escapar(String(comercio.id));
            return `
                <label class="waComercio${numero ? "" : " sinTelefono"}">
                    <input type="checkbox" class="waElegir" value="${id}" ${elegidos.has(String(comercio.id)) && numero ? "checked" : ""} ${numero ? "" : "disabled"} aria-label="${escapar(comercio.nombre)}">
                    <span><strong>${escapar(comercio.nombre)}</strong><small>${numero ? escapar(comercio.telefono) : "Sin teléfono: cargalo en la ficha del comercio"}</small></span>
                </label>`;
        }).join("");
    }

    function tarjetaRonda() {
        if (ronda) {
            const lista = comercios().filter(comercio => ronda.ids.includes(String(comercio.id)));
            const hechos = lista.filter(comercio => ronda.enviados.has(String(comercio.id))).length;
            const salteados = ronda.salteados || new Set();
            const siguiente = lista.find(comercio => !ronda.enviados.has(String(comercio.id)) && !salteados.has(String(comercio.id)));
            const numeroSiguiente = siguiente ? lista.indexOf(siguiente) + 1 : 0;
            return `
                <section class="waTarjeta" aria-labelledby="waTituloRonda">
                    <h2 id="waTituloRonda">Ronda de pedidos</h2>
                    <p class="waProgreso"><strong>${hechos} de ${lista.length}</strong> enviados</p>
                    <div class="waBarra"><span style="width:${lista.length ? Math.round(hechos * 100 / lista.length) : 0}%"></span></div>
                    <p class="waAyuda">Tocá «Enviar»: se abre WhatsApp con el mensaje listo. Mandalo y volvé a la app para seguir con el próximo.</p>
                    ${siguiente ? "" : `<p class="waListo">${ico("check", 18)} ¡Listo! Ya le escribiste a todos.</p>`}
                    <div class="waListaRonda">
                        ${lista.map(comercio => {
                            const hecho = ronda.enviados.has(String(comercio.id));
                            return `
                                <div class="waFilaRonda${hecho ? " hecho" : ""}">
                                    <span>${escapar(comercio.nombre)}${!hecho && salteados.has(String(comercio.id)) ? ` <small class="waSalteado">Salteado</small>` : ""}</span>
                                    <a data-wa="enviarUno" data-id="${escapar(String(comercio.id))}" href="${escapar(enlacePara(comercio))}" target="_blank" rel="noopener">${hecho ? ico("check", 16) + " Enviado" : "Enviar"}</a>
                                </div>`;
                        }).join("")}
                    </div>
                    <button type="button" class="waBotonSecundario" data-wa="terminar">Terminar ronda</button>
                    ${siguiente ? `<div class="waPieRonda">
                        <small>Siguiente: ${numeroSiguiente} de ${lista.length}</small>
                        <div class="waPieRondaBotones">
                            <a class="waBotonGrande" data-wa="enviarUno" data-id="${escapar(String(siguiente.id))}" href="${escapar(enlacePara(siguiente))}" target="_blank" rel="noopener">${ico("whatsapp", 20)} Enviar a ${escapar(siguiente.nombre)}</a>
                            <button type="button" class="waBotonSecundario" data-wa="saltear" data-id="${escapar(String(siguiente.id))}">Saltear</button>
                        </div>
                    </div>` : ""}
                </section>`;
        }

        const automatico = esElDueno() && config.activo;
        const primero = comercios()[0];
        return `
            <section class="waTarjeta" aria-labelledby="waTituloRonda">
                <h2 id="waTituloRonda">Ronda de pedidos</h2>
                <p class="waAyuda">Escribile a varios comercios el mismo mensaje, cada uno con su nombre.</p>
                <label class="waCampo" for="waTexto">Mensaje</label>
                <textarea id="waTexto" rows="4" maxlength="700">${escapar(textoDelMensaje())}</textarea>
                <p class="waAyuda">{nombre} se cambia por el nombre de cada comercio. <button type="button" class="waEnlace" data-wa="restablecer">Volver al mensaje de siempre</button></p>
                <p class="waEjemplo"><small>Así lo recibe ${escapar(primero ? primero.nombre : "un comercio")}:</small><span id="waEjemplo">${escapar(textoPara(primero || { nombre: "Almacén" }))}</span></p>
                ${automatico ? `<p class="waAviso">${ico("info", 16)} Con WhatsApp automático se manda la plantilla aprobada por Meta («${escapar(config.plantilla)}»), no este texto.</p>` : ""}
                <div class="waCabeceraLista">
                    <label class="waCampo" for="waBuscar">Comercios <small id="waResumenElegidos"></small></label>
                    <span><button type="button" class="waEnlace" data-wa="todos">Todos</button> · <button type="button" class="waEnlace" data-wa="ninguno">Ninguno</button></span>
                </div>
                <input type="search" id="waBuscar" placeholder="Buscar comercio" value="${escapar(busqueda)}" aria-label="Buscar comercio">
                <div class="waLista" id="waListaComercios"></div>
                <button type="button" class="waBotonGrande" id="waEmpezar" data-wa="empezar"></button>
                ${automatico ? `<button type="button" class="waBotonGrande waBotonAuto" id="waEnviarTodos" data-wa="automatico"></button>` : ""}
            </section>`;
    }

    function tarjetaMensajes() {
        if (!enLaNube() || (!config.activo && !mensajes.length)) return "";
        const entendidos = mensajes.filter(mensaje => leerMensaje(mensaje).completo).length;
        const tarjetas = mensajes.map(mensaje => {
            const lectura = leerMensaje(mensaje);
            const quien = lectura.comercio ? lectura.comercio.nombre : (mensaje.nombrePerfil || "+" + String(mensaje.de || ""));
            let cuerpo;
            if (mensaje.tipo === "audio" && !mensaje.texto) {
                const motivos = {
                    apagado: "Prendé «Pasar audios a texto» para que se lea solo. Mientras, escuchalo en WhatsApp.",
                    sinClave: "Falta la clave de audio a texto en Vercel (M14). Escuchalo en WhatsApp.",
                    error: "No se pudo pasar a texto. Escuchalo en WhatsApp."
                };
                cuerpo = `<p class="waTextoMensaje">${ico("microfono", 15)} Audio. ${escapar(motivos[mensaje.sinTexto] || motivos.error)}</p>`;
            } else {
                cuerpo = `<p class="waTextoMensaje">${mensaje.tipo === "audio" ? ico("microfono", 15) + " " : ""}«${escapar(mensaje.texto || "(sin texto)")}»</p>`;
            }
            const productos = lectura.productos.length
                ? `<ul class="waProductos">${lectura.productos.map(item => `<li><b>${escapar(item.cantidad)} ×</b> ${escapar(item.producto)} <small>${escapar(item.marca)}</small></li>`).join("")}</ul>`
                : `<p class="waAyuda">No se encontraron productos del catálogo.</p>`;
            const preguntar = window.vozVendeFrio?.htmlPregunta;
            const faltan = lectura.sinEntender.length
                ? (preguntar
                    ? `<div class="waNoEntendido sinEntenderDictado">${lectura.sinEntender.map(tramo => preguntar(tramo, false)).join("")}</div>`
                    : `<p class="waNoEntendido">No entendí: ${lectura.sinEntender.map(tramo => "«" + escapar(tramo) + "»").join(", ")}</p>`)
                : "";
            const cambios = lectura.cambios.length
                ? `<p class="waAyuda">Cambios (no se suman): ${lectura.cambios.map(tramo => "«" + escapar(tramo) + "»").join(", ")}</p>`
                : "";
            const sinComercio = lectura.comercio ? "" : `<p class="waNoEntendido">No sé de qué comercio es: elegilo al cargar el pedido.</p>`;
            const etiqueta = lectura.completo
                ? `<span class="waEtiqueta entendido">Se entendió todo</span>`
                : `<span class="waEtiqueta revisar">Para revisar</span>`;
            const conIA = !lectura.completo && mensaje.texto && window.vozVendeFrio?.leerPedidoConIA && !lecturasIA.has(mensaje.id)
                ? `<button type="button" class="waBotonSecundario waBotonIA" data-wa="ia" data-id="${escapar(mensaje.id)}">${ico("chispa", 16)}<span> Entender con IA</span></button>`
                : "";
            return `
                <article class="waMensaje" data-id="${escapar(mensaje.id)}">
                    <header><strong>${escapar(quien)}</strong><small>${lectura.comercio && mensaje.nombrePerfil && !mensaje.idComercio ? escapar(mensaje.nombrePerfil) + " · " : ""}${escapar(horaCorta(mensaje.hora))}</small>${etiqueta}</header>
                    ${cuerpo}${productos}${faltan}${cambios}${sinComercio}${conIA}
                    <div class="waBotonesMensaje">
                        <button type="button" class="waBotonSecundario" data-wa="descartar" data-id="${escapar(mensaje.id)}">Descartar</button>
                        <button type="button" class="waBotonPrincipal" data-wa="cargar" data-id="${escapar(mensaje.id)}">${ico("notaLapiz", 16)} Cargar pedido</button>
                    </div>
                </article>`;
        }).join("");
        return `
            <section class="waTarjeta" aria-labelledby="waTituloMensajes">
                <h2 id="waTituloMensajes">Mensajes para revisar (${mensajes.length})</h2>
                ${mensajes.length ? "" : `<p class="waVacio">Cuando un comercio te escriba, el mensaje aparece acá con el pedido armado.</p>`}
                ${entendidos ? `<button type="button" class="waBotonGrande" data-wa="cargarEntendidos">${ico("check", 18)} Cargar ${entendidos === 1 ? "el que se entendió" : "los " + entendidos + " que se entendieron"}</button>` : ""}
                ${tarjetas}
            </section>`;
    }

    function tarjetaCompartir() {
        return `
            <section class="waTarjeta" aria-labelledby="waTituloCompartir">
                <h2 id="waTituloCompartir">Compartir a VendeFrío</h2>
                <ol class="waPasos">
                    <li>En WhatsApp, mantené apretado el mensaje o el audio del pedido.</li>
                    <li>Tocá «Compartir» (o «Reenviar» y después el ícono de compartir) y elegí VendeFrío.</li>
                    <li>Se abre «Nuevo pedido» con los productos que se entendieron, para revisar y agregar.</li>
                </ol>
                <p class="waAyuda">Funciona en Android con la app instalada. En iPhone, copiá el texto y pegalo en «Dictar o pegar pedido».</p>
            </section>`;
    }

    function tarjetaAutomatico() {
        if (!esElDueno()) return "";
        let estado = "";
        if (conexion && conexion.revisando) estado = `<p class="waAyuda">Revisando…</p>`;
        else if (conexion && conexion.error) estado = `<p class="waNoEntendido">${escapar(conexion.error)}</p>`;
        else if (conexion) {
            const fila = (ok, texto) => `<li class="${ok ? "ok" : "falta"}">${ico(ok ? "check" : "alerta", 15)} ${texto}</li>`;
            estado = `<ul class="waEstado">
                ${fila(conexion.whatsapp, "Cuenta de WhatsApp de Meta")}
                ${fila(conexion.webhook && conexion.estaDistribuidora, "Recibir mensajes (webhook) en esta distribuidora")}
                ${fila(conexion.audios, "Clave de audio a texto (opcional)")}
            </ul>`;
        }
        return `
            <section class="waTarjeta" aria-labelledby="waTituloAutomatico">
                <h2 id="waTituloAutomatico">WhatsApp automático</h2>
                <p class="waAyuda">Con la cuenta oficial de WhatsApp para empresas (Meta), la ronda sale con un toque y las respuestas llegan solas acá. Meta cobra unos centavos de dólar por cada mensaje de la ronda; contestar es gratis.</p>
                <label class="waFilaLlave">
                    <span><strong>Usar WhatsApp automático</strong><small>Necesita la cuenta de Meta conectada en Vercel (M16).</small></span>
                    <input type="checkbox" class="ajLlave" id="waLlaveActivo" role="switch" aria-label="Usar WhatsApp automático" ${config.activo ? "checked" : ""}>
                </label>
                <label class="waFilaLlave">
                    <span><strong>Pasar audios a texto</strong><small>Servicio pago, menos de 1 centavo de dólar por minuto (M14).</small></span>
                    <input type="checkbox" class="ajLlave" id="waLlaveAudios" role="switch" aria-label="Pasar audios a texto" ${config.audios ? "checked" : ""}>
                </label>
                <label class="waCampo" for="waPlantilla">Nombre de la plantilla en Meta</label>
                <input type="text" id="waPlantilla" value="${escapar(config.plantilla)}" maxlength="80" autocomplete="off" autocapitalize="off">
                <p class="waAyuda">Código de la distribuidora (para Vercel):</p>
                <p class="waCodigo"><code>${escapar(idDistribuidora())}</code><button type="button" class="waEnlace" data-wa="copiarCodigo">Copiar</button></p>
                <button type="button" class="waBotonSecundario" data-wa="revisarConexion">${ico("refrescar", 16)} Revisar la conexión</button>
                ${estado}
            </section>`;
    }

    function dibujar() {
        const caja = document.getElementById("contenidoWhatsapp");
        if (!caja) return;
        const buscador = document.activeElement && document.activeElement.id;
        caja.innerHTML = tarjetaMensajes() + tarjetaRonda() + tarjetaCompartir() + tarjetaAutomatico();
        window.vozVendeFrio?.conectarPreguntas?.(caja, (tramo, respuesta, pregunta) => {
            const id = pregunta.closest(".waMensaje")?.dataset.id;
            if (!id) return;
            respuestasNoEntendido.set(id, { ...(respuestasNoEntendido.get(id) || {}), [tramo]: respuesta });
            dibujar();
        });
        dibujarListaComercios();
        actualizarBotonesRonda();
        if (buscador === "waBuscar" || buscador === "waTexto") {
            const campo = document.getElementById(buscador);
            campo?.focus();
            if (campo && typeof campo.value === "string") campo.setSelectionRange(campo.value.length, campo.value.length);
        }
    }

    function redibujar() {
        actualizarAvisoInicio();
        const seccion = document.getElementById("pantallaWhatsapp");
        if (seccion && !seccion.classList.contains("oculto")) dibujar();
    }

    function abrir() {
        revisarEscucha();
        const seccion = document.getElementById("pantallaWhatsapp") || crearPantalla();
        document.querySelectorAll('body > section[id^="pantalla"]').forEach(pantalla => pantalla.classList.add("oculto"));
        seccion.classList.remove("oculto");
        document.querySelectorAll(".nav-item").forEach(boton => boton.classList.remove("activo"));
        dibujar();
        window.scrollTo(0, 0);
    }

    // En Inicio, un aviso cuando hay mensajes de WhatsApp para revisar.
    function actualizarAvisoInicio() {
        const resumen = document.getElementById("resumenHoy");
        if (!resumen) return;
        let aviso = document.getElementById("dashWhatsapp");
        const cantidad = enLaNube() ? mensajes.length : 0;
        if (!cantidad) {
            aviso?.remove();
            return;
        }
        if (!aviso) {
            aviso = document.createElement("button");
            aviso.type = "button";
            aviso.id = "dashWhatsapp";
            aviso.className = "card waAvisoInicio";
            aviso.addEventListener("click", abrir);
            resumen.before(aviso);
        }
        aviso.innerHTML = `<span class="waAvisoIcono">${ico("whatsapp", 22)}</span><span><strong>${cantidad === 1 ? "1 mensaje de WhatsApp" : cantidad + " mensajes de WhatsApp"}</strong><small>Con el pedido armado, para revisar</small></span><b aria-hidden="true">${ico("chevDerecha", 18)}</b>`;
    }

    // -------------------------------------------------
    // Compartir a VendeFrío (T56)
    // -------------------------------------------------

    function blobABase64(blob) {
        return new Promise((resolver, rechazar) => {
            const lector = new FileReader();
            lector.onload = () => resolver(String(lector.result || "").split(",")[1] || "");
            lector.onerror = () => rechazar(lector.error);
            lector.readAsDataURL(blob);
        });
    }

    function ponerTextoEnDictado(texto) {
        const campo = document.querySelector(".ventanaDictado #textoDictado");
        if (!campo) return;
        campo.value = texto;
        campo.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function mostrarAudioEnDictado(audio, tipo) {
        const ventana = document.querySelector(".ventanaDictado");
        const contenido = ventana?.querySelector(".contenidoDictado");
        if (!contenido) return null;
        contenido.querySelector(".waAudioCompartido")?.remove();
        const caja = document.createElement("div");
        caja.className = "waAudioCompartido";
        const reproductor = document.createElement("audio");
        reproductor.controls = true;
        reproductor.src = URL.createObjectURL(new Blob([audio], { type: tipo }));
        const estado = document.createElement("p");
        estado.className = "waAyuda";
        estado.setAttribute("aria-live", "polite");
        caja.append(reproductor, estado);
        contenido.querySelector(".subtitulo")?.after(caja);
        // Al cerrar la ventana, el audio se va.
        const vigia = new MutationObserver(() => {
            if (!ventana.classList.contains("oculto")) return;
            URL.revokeObjectURL(reproductor.src);
            caja.remove();
            vigia.disconnect();
        });
        vigia.observe(ventana, { attributes: true, attributeFilter: ["class"] });
        return estado;
    }

    async function audioATexto(audio, tipo, estado) {
        if (!enLaNube() || !config.audios) {
            estado.textContent = "Escuchalo y dictalo con el micrófono, o pegá la transcripción de WhatsApp.";
            return;
        }
        estado.textContent = "Pasando el audio a texto…";
        try {
            const datos = await llamarFuncion("/api/whatsapp-audio", { audio: await blobABase64(new Blob([audio], { type: tipo })), tipo });
            estado.textContent = datos.texto ? "Audio pasado a texto: revisalo abajo." : "El audio no tenía palabras.";
            if (datos.texto) ponerTextoEnDictado(datos.texto);
        } catch (error) {
            const textos = {
                muyLargo: "El audio es muy largo para pasarlo a texto. Escuchalo y dictalo.",
                sinClave: "Falta la clave de audio a texto (M14). Escuchalo y dictalo.",
                apagado: "«Pasar audios a texto» está apagado. Escuchalo y dictalo."
            };
            estado.textContent = textos[error.codigo] || "No se pudo pasar a texto. Escuchalo y dictalo.";
        }
    }

    async function leerCompartido() {
        const parametros = new URLSearchParams(window.location.search);
        if (!parametros.has("compartido")) return;
        parametros.delete("compartido");
        const limpia = window.location.pathname + (parametros.toString() ? "?" + parametros.toString() : "") + window.location.hash;
        history.replaceState(history.state, "", limpia);
        if (!("caches" in window)) return;

        let datos = null;
        let audio = null;
        try {
            const cache = await caches.open("vendefrio-compartido");
            const respuestaDatos = await cache.match("./compartido/datos");
            if (respuestaDatos) datos = await respuestaDatos.json();
            const respuestaAudio = await cache.match("./compartido/audio");
            if (respuestaAudio) audio = await respuestaAudio.arrayBuffer();
            await cache.delete("./compartido/datos");
            await cache.delete("./compartido/audio");
        } catch (error) {
            console.warn("No se pudo leer lo compartido.", error);
        }
        if (!datos) return;

        if (typeof window.abrirNuevoPedido === "function") window.abrirNuevoPedido();
        if (!window.vozVendeFrio?.abrirDictado) return;
        window.vozVendeFrio.abrirDictado();
        const texto = [datos.texto, datos.enlace].filter(Boolean).join(" ").trim();
        if (texto) ponerTextoEnDictado(texto);
        if (audio && audio.byteLength) {
            const tipo = datos.audio && datos.audio.tipo || "audio/ogg";
            const estado = mostrarAudioEnDictado(audio, tipo);
            if (estado) {
                // Los ajustes de la nube pueden tardar un momento en llegar.
                revisarEscucha();
                setTimeout(() => audioATexto(audio, tipo, estado), enLaNube() ? 1500 : 0);
            }
        }
    }

    // -------------------------------------------------
    // Inicio
    // -------------------------------------------------

    function iniciar() {
        vigilarPedidoGuardado();
        revisarEscucha();
        // La sesión y la distribuidora llegan después: se revisa cada tanto.
        setInterval(revisarEscucha, 4000);
        window.addEventListener("nubeVendeFrioLista", revisarEscucha);
        // Después de que los demás archivos armaron sus pantallas.
        setTimeout(leerCompartido, 300);
    }

    document.addEventListener("click", evento => {
        if (evento.target.closest?.('[data-mas="whatsapp"]')) {
            evento.stopImmediatePropagation();
            abrir();
        }
    }, true);

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();

    window.whatsappVendeFrio = {
        abrir,
        leerMensaje,
        textoPara,
        enlacePara,
        numeroWhatsapp,
        mensajes: () => mensajes.slice(),
        config: () => ({ ...config })
    };
}());
