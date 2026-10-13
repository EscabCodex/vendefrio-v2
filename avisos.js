// =====================================================
// VendeFrío - avisos.js
// Avisos dentro de la app (T23). Solo en la nube (con cuenta o con código):
// el modo personal no tiene avisos.
// - Cada persona tiene su buzón en la nube: avisos/{idPersona}/recibidos.
//   Quien hace un cambio deja una copia del aviso en el buzón de cada
//   destinatario (nunca en el suyo: nadie recibe aviso de lo que hizo él
//   mismo). Quien tenía la app cerrada lo ve al abrirla.
// - Campanita arriba con la cantidad sin leer; al tocarla, la lista (los más
//   nuevos primero); al tocar un aviso se abre su pedido y queda leído.
//   "Marcar todos como leídos". Aviso emergente si llega uno con la app
//   abierta.
// - Configuración > Avisos: cada persona elige qué avisos recibe. Se guarda
//   en la nube (preferenciasAvisos/{idPersona}), así vale en cualquier
//   celular, y quien hace un cambio no le deja aviso a quien lo apagó.
// - Arranca con los avisos que ya existen: pedido nuevo, incidencia y su
//   resolución. Cada tarea siguiente suma los suyos: pedido preparado y
//   faltante (T24).
// - Se muestran los últimos 50 y, una vez por día, se borran los que se
//   leyeron hace más de 7 días.
// =====================================================

(function () {
    // Qué se avisa y a quién (T17). "permiso" es el permiso que hace falta
    // para recibirlo además de quien cargó el pedido (si corresponde).
    const TIPOS = [
        {
            id: "pedidoNuevo",
            nombre: "Pedido nuevo",
            quien: "Le llega a quien prepara pedidos.",
            permiso: "prepara",
            icono: "paquete",
            hecho: "Cargado por"
        },
        {
            id: "preparado",
            nombre: "Pedido preparado",
            quien: "Le llega a quien cargó el pedido y a quien reparte.",
            icono: "check",
            hecho: "Preparado por"
        },
        {
            id: "faltante",
            nombre: "Faltante",
            quien: "Le llega a quien cargó el pedido y a quien recibe aviso de faltantes.",
            icono: "alerta",
            hecho: "Anotado por"
        },
        {
            id: "incidencia",
            nombre: "Incidencia",
            quien: "Le llega a quien cargó el pedido y a quien controla pedidos.",
            icono: "alerta",
            hecho: "Marcada por"
        },
        {
            id: "incidenciaResuelta",
            nombre: "Incidencia resuelta",
            quien: "Le llega a quien cargó el pedido, a quien marcó la incidencia y a quien controla pedidos.",
            icono: "check",
            hecho: "Resuelta por"
        }
    ];
    const IDS_TIPOS = TIPOS.map(tipo => tipo.id);

    const MAXIMO_EN_LISTA = 50;
    const DIA = 24 * 60 * 60 * 1000;
    const DIAS_PARA_LIMPIAR_LEIDOS = 7;
    const MAXIMO_POR_LIMPIEZA = 100;
    const CLAVE_LIMPIEZA = "vendefrio_limpieza_avisos";
    // Un pedido nuevo se avisa solo si se acaba de cargar (no, por ejemplo,
    // al combinar un respaldo).
    const PEDIDO_RECIENTE = 10 * 60 * 1000;
    // El aviso emergente sale solo para avisos de las últimas horas.
    const AVISO_RECIENTE = 6 * 60 * 60 * 1000;
    const DURACION_EMERGENTE = 6000;

    // Quién usa este celular: { idPersona, uid } o null.
    let yo = null;
    let refDistribuidora = null;
    let quitarEscuchas = [];
    // "apagado", "cargando", "listo", "sinPermiso" o "error".
    let estado = "apagado";
    let avisos = [];
    let listoDelServidor = false;
    const vistos = new Set();
    // Fichas activas: idEmpleado -> lista de ids de rol.
    let empleados = new Map();
    let empleadosCargados = false;
    // idPersona -> Set de tipos apagados.
    let preferencias = new Map();
    let preferenciasCargadas = false;
    // Lo que se hizo antes de saber quién recibe: se manda al cargar.
    let accionesEnEspera = [];
    const oyentes = [];

    // -------------------------------------------------
    // Utilidades
    // -------------------------------------------------

    function obtenerFirestore() {
        try {
            if (window.firebase && window.firebase.apps.length && window.firebase.firestore) {
                return window.firebase.firestore();
            }
        } catch (error) {
            console.error("Firestore no está disponible.", error);
        }
        return null;
    }

    function crear(tag, clase, texto) {
        const elemento = document.createElement(tag);
        if (clase) elemento.className = clase;
        if (texto !== undefined) elemento.textContent = texto;
        return elemento;
    }

    function dosDigitos(numero) {
        return String(numero).padStart(2, "0");
    }

    // "Hoy 14:35", "Ayer 09:10" o "10/10/2026 18:02".
    function textoCuando(hora) {
        const fecha = new Date(hora);
        if (!hora || Number.isNaN(fecha.getTime())) return "";

        const hoy = new Date();
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);

        let dia = dosDigitos(fecha.getDate()) + "/" + dosDigitos(fecha.getMonth() + 1) + "/" + fecha.getFullYear();
        if (fecha.toDateString() === hoy.toDateString()) dia = "Hoy";
        else if (fecha.toDateString() === ayer.toDateString()) dia = "Ayer";

        return dia + " " + dosDigitos(fecha.getHours()) + ":" + dosDigitos(fecha.getMinutes());
    }

    function nombrePersona(persona) {
        const nombre = String(persona && persona.nombre || "").trim();
        if (nombre) return nombre;
        return persona && persona.idPersona === "dueno" ? "el dueño" : "un empleado";
    }

    function datosDelTipo(id) {
        return TIPOS.find(tipo => tipo.id === id) || { id, nombre: "Aviso", icono: "documento", hecho: "Por" };
    }

    function avisarCambio() {
        actualizarCampanas();
        if (listaAbierta()) dibujarLista();

        oyentes.forEach(oyente => {
            try {
                oyente();
            } catch (error) {
                console.error("Falló un aviso de la campanita.", error);
            }
        });
    }

    // -------------------------------------------------
    // Preferencias: qué avisos recibe cada persona
    // -------------------------------------------------

    function apagadosDe(idPersona) {
        return preferencias.get(idPersona) || new Set();
    }

    function recibe(tipo) {
        return Boolean(yo) && !apagadosDe(yo.idPersona).has(tipo);
    }

    // Se guarda en la nube; sin señal queda en el celular y sube al volver.
    function cambiarPreferencia(tipo, recibir) {
        if (!yo || !refDistribuidora) return Promise.reject(new Error("Los avisos todavía no están listos."));
        if (!IDS_TIPOS.includes(tipo)) return Promise.reject(new Error("Ese aviso no existe."));

        const apagados = new Set(apagadosDe(yo.idPersona));
        if (recibir) apagados.delete(tipo);
        else apagados.add(tipo);

        const lista = IDS_TIPOS.filter(id => apagados.has(id));
        preferencias.set(yo.idPersona, new Set(lista));
        avisarCambio();

        refDistribuidora.collection("preferenciasAvisos").doc(yo.idPersona)
            .set({ apagados: lista })
            .catch(error => {
                console.warn("No se guardó qué avisos recibís.", error);
                if (typeof mostrarAviso === "function") {
                    mostrarAviso("No se guardó el cambio", "Probá de nuevo en unos segundos.");
                }
            });

        return Promise.resolve();
    }

    // -------------------------------------------------
    // Quién recibe cada aviso
    // -------------------------------------------------

    // El dueño tiene todos los permisos; el empleado, los de sus roles.
    function tienePermiso(idPersona, permiso) {
        if (idPersona === "dueno") return true;

        const roles = empleados.get(idPersona);
        if (!roles) return false;

        const lista = window.empleadosVendeFrio?.roles?.() || [];
        return lista.some(rol => roles.includes(rol.id) && Array.isArray(rol.permisos) && rol.permisos.includes(permiso));
    }

    function personasConPermiso(permiso) {
        return ["dueno", ...empleados.keys()].filter(idPersona => tienePermiso(idPersona, permiso));
    }

    // Sin quien hizo el cambio, sin empleados dados de baja y sin quienes
    // apagaron ese aviso.
    function destinatarios(tipo, candidatos) {
        const lista = new Set();

        candidatos.forEach(idPersona => {
            const id = String(idPersona || "");
            if (!id || id === yo.idPersona) return;
            if (id !== "dueno" && !empleados.has(id)) return;
            if (apagadosDe(id).has(tipo)) return;
            lista.add(id);
        });

        return Array.from(lista);
    }

    function dejarAvisos(tipo, pedido, detalle, candidatos) {
        const db = obtenerFirestore();
        const persona = typeof personaDeEsteCelular === "function" ? personaDeEsteCelular() : null;
        if (!db || !refDistribuidora || !persona || !pedido || !pedido.id) return;

        const para = destinatarios(tipo, candidatos);
        if (!para.length) return;

        const idAviso = generarId("avi");
        const datos = {
            tipo,
            idPedido: String(pedido.id),
            comercio: String(pedido.comercio || "").trim().slice(0, 120),
            detalle: String(detalle || "").trim().slice(0, 300),
            persona: { idPersona: persona.idPersona, nombre: persona.nombre, uid: persona.uid },
            horaCelular: Date.now(),
            leido: null
        };

        // Va aparte del cambio del pedido: si la nube rechaza el aviso, el
        // pedido no se pierde. Sin señal queda en el celular y sube al volver.
        const tanda = db.batch();
        para.forEach(idPersona => {
            tanda.set(refDistribuidora.collection("avisos").doc(idPersona).collection("recibidos").doc(idAviso), datos);
        });
        tanda.commit().catch(error => console.warn("No se pudo dejar un aviso.", error));
    }

    function alHacerAlgo(accion) {
        if (!yo || !accion || !accion.pedido) return;

        // Hasta saber quién trabaja en la distribuidora y qué avisos apagó
        // cada uno, se espera (la copia del celular llega enseguida).
        if (!empleadosCargados || !preferenciasCargadas) {
            accionesEnEspera.push(accion);
            return;
        }

        const pedido = accion.pedido;
        const autor = pedido.autor && pedido.autor.idPersona;

        if (accion.accion === "pedidoNuevo") {
            const entradas = pedido.estados && typeof pedido.estados === "object" ? Object.values(pedido.estados) : [];
            const recien = entradas.length === 1 && entradas[0] && entradas[0].estado === "cargado" &&
                Date.now() - (Number(entradas[0].horaCelular) || 0) < PEDIDO_RECIENTE;
            if (!recien || !pedido.autor || pedido.autor.uid !== yo.uid) return;

            dejarAvisos("pedidoNuevo", pedido, "", personasConPermiso("prepara"));
        } else if (accion.accion === "incidencia") {
            dejarAvisos("incidencia", pedido, accion.motivo, [autor, ...personasConPermiso("controla")]);
        } else if (accion.accion === "incidenciaResuelta") {
            const marcaron = (accion.incidencias || []).map(incidencia => incidencia.persona && incidencia.persona.idPersona);
            dejarAvisos("incidenciaResuelta", pedido, accion.nota, [autor, ...marcaron, ...personasConPermiso("controla")]);
        } else if (accion.accion === "preparado") {
            // T24: "12 productos · 32 unidades · 1 faltante".
            dejarAvisos("preparado", pedido, accion.resumen, [autor, ...personasConPermiso("reparte")]);
        } else if (accion.accion === "faltante") {
            // T24: "Coca 2L: 8 de 10 · no había más".
            const detalle = accion.producto + ": " + accion.preparada + " de " + accion.pedida + " · " + accion.observacion;
            dejarAvisos("faltante", pedido, detalle, [autor, ...personasConPermiso("avisoFaltantes")]);
        }
    }

    function mandarAccionesEnEspera() {
        if (!empleadosCargados || !preferenciasCargadas || !accionesEnEspera.length) return;

        const acciones = accionesEnEspera;
        accionesEnEspera = [];
        acciones.forEach(alHacerAlgo);
    }

    // -------------------------------------------------
    // Mi buzón
    // -------------------------------------------------

    function miBuzon() {
        return refDistribuidora.collection("avisos").doc(yo.idPersona).collection("recibidos");
    }

    // Los que se muestran: los tipos que la persona recibe.
    function avisosVisibles() {
        return avisos.filter(aviso => recibe(aviso.tipo));
    }

    function sinLeer() {
        return avisosVisibles().filter(aviso => !aviso.leido).length;
    }

    function marcarLeido(id) {
        const aviso = avisos.find(item => item.id === id);
        if (!aviso || aviso.leido || !refDistribuidora) return;

        aviso.leido = Date.now();
        avisarCambio();
        miBuzon().doc(id).update({ leido: aviso.leido }).catch(error => console.warn("No se marcó el aviso como leído.", error));
    }

    function marcarTodosLeidos() {
        const db = obtenerFirestore();
        const pendientes = avisosVisibles().filter(aviso => !aviso.leido);
        if (!db || !pendientes.length) return;

        const hora = Date.now();
        const tanda = db.batch();
        pendientes.forEach(aviso => {
            aviso.leido = hora;
            tanda.update(miBuzon().doc(aviso.id), { leido: hora });
        });
        avisarCambio();
        tanda.commit().catch(error => console.warn("No se marcaron los avisos como leídos.", error));
    }

    // Una vez por día, con internet: se borran los avisos que se leyeron hace
    // más de 7 días (hasta 100 por vez).
    function limpiarLeidosViejos() {
        const db = obtenerFirestore();
        if (!db || !navigator.onLine) return;

        const hoy = new Date().toDateString() + "|" + yo.idPersona;
        try {
            if (localStorage.getItem(CLAVE_LIMPIEZA) === hoy) return;
            localStorage.setItem(CLAVE_LIMPIEZA, hoy);
        } catch (error) {
            return;
        }

        const buzon = miBuzon();
        buzon.where("leido", "<", Date.now() - DIAS_PARA_LIMPIAR_LEIDOS * DIA).limit(MAXIMO_POR_LIMPIEZA).get()
            .then(foto => {
                if (foto.empty) return null;
                const tanda = db.batch();
                foto.docs.forEach(documento => tanda.delete(documento.ref));
                return tanda.commit();
            })
            .catch(error => console.warn("No se pudieron limpiar los avisos viejos.", error));
    }

    function recibirBuzon(foto) {
        avisos = foto.docs.map(documento => ({ id: documento.id, ...(documento.data() || {}) }));
        estado = "listo";

        if (!foto.metadata.fromCache && !listoDelServidor) {
            // Lo que ya estaba al abrir la app se ve en la lista, sin
            // emergente.
            listoDelServidor = true;
            avisos.forEach(aviso => vistos.add(aviso.id));
            setTimeout(limpiarLeidosViejos, 3000);
        } else if (listoDelServidor) {
            const nuevos = foto.docChanges()
                .filter(cambio => cambio.type === "added" && !vistos.has(cambio.doc.id))
                .map(cambio => avisos.find(aviso => aviso.id === cambio.doc.id))
                .filter(Boolean);

            nuevos.forEach(aviso => vistos.add(aviso.id));

            const paraMostrar = nuevos.filter(aviso =>
                !aviso.leido && recibe(aviso.tipo) && Math.abs(Date.now() - (Number(aviso.horaCelular) || 0)) < AVISO_RECIENTE
            );
            if (paraMostrar.length) mostrarEmergente(paraMostrar);
        }

        avisarCambio();
    }

    function falloElBuzon(error) {
        console.warn("No se pudieron leer los avisos.", error);
        estado = error && error.code === "permission-denied" ? "sinPermiso" : "error";
        avisarCambio();
    }

    // -------------------------------------------------
    // Arranque: cuando se sabe quién usa el celular
    // -------------------------------------------------

    function apagar() {
        quitarEscuchas.forEach(quitar => quitar());
        quitarEscuchas = [];
        yo = null;
        refDistribuidora = null;
        estado = "apagado";
        avisos = [];
        listoDelServidor = false;
        vistos.clear();
        empleados = new Map();
        empleadosCargados = false;
        preferencias = new Map();
        preferenciasCargadas = false;
        accionesEnEspera = [];
        cerrarLista();
        document.documentElement.classList.remove("conAvisos");
        avisarCambio();
    }

    function arrancar() {
        const quien = window.empleadosVendeFrio?.quienSoy?.();
        const guardado = typeof obtenerModoNubeGuardado === "function" ? obtenerModoNubeGuardado() : null;
        const db = obtenerFirestore();

        const valido = quien && (quien.tipo === "dueno" || quien.tipo === "empleado") && quien.idPersona && quien.uid &&
            guardado && guardado.distribuidora && db && typeof usaNubeReal === "function" && usaNubeReal();

        if (!valido) {
            if (yo) apagar();
            return;
        }
        if (yo && yo.idPersona === quien.idPersona && yo.uid === quien.uid) return;
        if (yo) apagar();

        yo = { idPersona: String(quien.idPersona), uid: String(quien.uid) };
        refDistribuidora = db.collection("distribuidoras").doc(guardado.distribuidora);
        estado = "cargando";
        document.documentElement.classList.add("conAvisos");
        ponerCampanas();

        quitarEscuchas.push(
            miBuzon().orderBy("horaCelular", "desc").limit(MAXIMO_EN_LISTA)
                .onSnapshot({ includeMetadataChanges: true }, recibirBuzon, falloElBuzon)
        );

        quitarEscuchas.push(
            refDistribuidora.collection("empleados").onSnapshot(foto => {
                const activos = new Map();
                foto.docs.forEach(documento => {
                    const datos = documento.data() || {};
                    if (datos.activo !== false) activos.set(documento.id, Array.isArray(datos.roles) ? datos.roles : []);
                });
                empleados = activos;
                empleadosCargados = true;
                mandarAccionesEnEspera();
            }, error => console.warn("Los avisos no pudieron leer la lista de empleados.", error))
        );

        quitarEscuchas.push(
            refDistribuidora.collection("preferenciasAvisos").onSnapshot(foto => {
                const mapa = new Map();
                foto.docs.forEach(documento => {
                    const datos = documento.data() || {};
                    mapa.set(documento.id, new Set(Array.isArray(datos.apagados) ? datos.apagados : []));
                });
                preferencias = mapa;
                preferenciasCargadas = true;
                mandarAccionesEnEspera();
                avisarCambio();
            }, error => {
                console.warn("No se pudo leer qué avisos recibe cada uno.", error);
                // Igual se avisa: sin preferencias, a todos los que corresponde.
                preferenciasCargadas = true;
                mandarAccionesEnEspera();
            })
        );

        avisarCambio();
    }

    // -------------------------------------------------
    // Campanita
    // -------------------------------------------------

    function crearCampana() {
        const boton = crear("button", "campanaAvisos");
        boton.type = "button";
        boton.setAttribute("aria-label", "Avisos");
        boton.title = "Avisos";
        boton.innerHTML = window.icono ? window.icono("campana", 22) : "🔔";
        boton.appendChild(crear("span", "contadorAvisos oculto", "0"));
        return boton;
    }

    // Una campanita en el encabezado de cada pantalla (también las que se
    // crean después, como Configuración, Catálogo y Estadísticas).
    function ponerCampanas() {
        document.querySelectorAll('body > section[id^="pantalla"] > header').forEach(encabezado => {
            if (encabezado.querySelector(".campanaAvisos")) return;

            const lugar = encabezado.querySelector(".dashboardHeaderTop") || encabezado;
            lugar.appendChild(crearCampana());
        });
        actualizarCampanas();
    }

    function actualizarCampanas() {
        const cantidad = yo ? sinLeer() : 0;
        const lleno = cantidad >= MAXIMO_EN_LISTA;
        const texto = lleno ? MAXIMO_EN_LISTA + "+" : String(cantidad);

        document.querySelectorAll(".campanaAvisos").forEach(boton => {
            const contador = boton.querySelector(".contadorAvisos");
            if (contador) {
                contador.textContent = texto;
                contador.classList.toggle("oculto", cantidad === 0);
            }
            boton.setAttribute("aria-label", cantidad ? "Avisos, " + texto + " sin leer" : "Avisos");
        });
    }

    document.addEventListener("click", evento => {
        if (evento.target.closest(".campanaAvisos")) abrirLista();
    });

    new MutationObserver(() => {
        if (yo) ponerCampanas();
    }).observe(document.body, { childList: true });

    // -------------------------------------------------
    // Lista de avisos
    // -------------------------------------------------

    function crearModalLista() {
        let modal = document.getElementById("modalAvisos");
        if (modal) return modal;

        modal = crear("div", "modal oculto");
        modal.id = "modalAvisos";

        const contenido = crear("div", "modalContenido listaAvisosContenido");
        contenido.setAttribute("role", "dialog");
        contenido.setAttribute("aria-modal", "true");
        contenido.setAttribute("aria-labelledby", "tituloAvisos");

        const titulo = crear("h2", "", "Avisos");
        titulo.id = "tituloAvisos";

        const todos = crear("button", "btnAccion secundario marcarTodosAvisos", "Marcar todos como leídos");
        todos.type = "button";
        todos.id = "marcarTodosAvisos";

        const cuerpo = crear("div", "cuerpoAvisos");
        cuerpo.id = "cuerpoAvisos";

        const botones = crear("div", "modalBotones");
        const elegir = crear("button", "btnModalSecundario", "Elegir qué avisos recibir");
        elegir.type = "button";
        const cerrar = crear("button", "btnModalConfirmar", "Cerrar");
        cerrar.type = "button";
        botones.append(elegir, cerrar);

        contenido.append(titulo, todos, cuerpo, botones);
        modal.appendChild(contenido);
        document.body.appendChild(modal);

        cerrar.addEventListener("click", cerrarLista);
        modal.addEventListener("click", evento => {
            if (evento.target === modal) cerrarLista();
        });
        todos.addEventListener("click", marcarTodosLeidos);
        elegir.addEventListener("click", () => {
            cerrarLista();
            if (typeof window.abrirConfiguracionEn === "function") window.abrirConfiguracionEn("avisos");
            else if (typeof window.abrirConfiguracion === "function") window.abrirConfiguracion();
        });
        cuerpo.addEventListener("click", evento => {
            const item = evento.target.closest(".itemAviso");
            if (item) abrirAviso(item.dataset.id);
        });

        return modal;
    }

    function listaAbierta() {
        const modal = document.getElementById("modalAvisos");
        return Boolean(modal && !modal.classList.contains("oculto"));
    }

    function abrirLista() {
        if (!yo) return;

        cerrarEmergente();
        const modal = crearModalLista();
        dibujarLista();
        modal.classList.remove("oculto");

        const contenido = modal.querySelector(".modalContenido");
        if (contenido) contenido.scrollTop = 0;
    }

    function cerrarLista() {
        const modal = document.getElementById("modalAvisos");
        if (modal) modal.classList.add("oculto");
    }

    function crearItem(aviso) {
        const tipo = datosDelTipo(aviso.tipo);
        const item = crear("button", "itemAviso" + (aviso.leido ? "" : " noLeido"));
        item.type = "button";
        item.dataset.id = aviso.id;
        item.dataset.tipo = aviso.tipo;

        const icono = crear("span", "iconoAviso");
        icono.innerHTML = window.icono ? window.icono(tipo.icono, 18) : "";

        const textos = crear("span", "textosAviso");
        textos.append(
            crear("strong", "tituloAviso", tipo.nombre),
            crear("span", "comercioAviso", String(aviso.comercio || "Sin comercio"))
        );
        const detalle = String(aviso.detalle || "").trim();
        if (detalle) textos.appendChild(crear("span", "detalleAviso", detalle));
        textos.appendChild(crear("small", "cuandoAviso", tipo.hecho + " " + nombrePersona(aviso.persona) + "  ·  " + textoCuando(aviso.horaCelular)));

        item.append(icono, textos);
        if (!aviso.leido) item.appendChild(crear("span", "puntoAviso"));
        item.setAttribute("aria-label", (aviso.leido ? "" : "Sin leer: ") + tipo.nombre + ", " + String(aviso.comercio || ""));
        return item;
    }

    function dibujarLista() {
        const cuerpo = document.getElementById("cuerpoAvisos");
        const todos = document.getElementById("marcarTodosAvisos");
        if (!cuerpo) return;

        const visibles = avisosVisibles();
        cuerpo.innerHTML = "";
        if (todos) todos.classList.toggle("oculto", !visibles.some(aviso => !aviso.leido));

        if (estado === "sinPermiso" || estado === "error") {
            const vacio = crear("div", "avisosVacio");
            vacio.append(
                crear("strong", "", "No se pudieron leer tus avisos"),
                crear("p", "", estado === "sinPermiso"
                    ? "La nube no dejó leerlos. Si sos el dueño, revisá que las reglas nuevas estén publicadas en Firebase."
                    : "Revisá la señal y volvé a abrir la app.")
            );
            cuerpo.appendChild(vacio);
            return;
        }

        if (!visibles.length) {
            const vacio = crear("div", "avisosVacio");
            vacio.append(
                crear("strong", "", estado === "cargando" ? "Buscando tus avisos…" : "No tenés avisos"),
                crear("p", "", "Acá aparecen los pedidos nuevos, los preparados, los faltantes y las incidencias. Nunca te llega aviso de lo que hacés vos.")
            );
            cuerpo.appendChild(vacio);
            return;
        }

        const lista = crear("div", "listaAvisos");
        lista.setAttribute("role", "list");
        visibles.forEach(aviso => lista.appendChild(crearItem(aviso)));
        cuerpo.appendChild(lista);

        if (avisos.length >= MAXIMO_EN_LISTA) {
            cuerpo.appendChild(crear("p", "notaAvisos", "Se muestran los últimos " + MAXIMO_EN_LISTA + " avisos."));
        }
    }

    // Abre el pedido del aviso y lo marca como leído.
    function abrirAviso(id) {
        const aviso = avisos.find(item => item.id === id);
        if (!aviso) return;

        marcarLeido(id);
        cerrarLista();
        cerrarEmergente();

        const abierto = window.seguimientoVendeFrio?.abrirPedido?.(aviso.idPedido);
        if (!abierto && typeof mostrarToast === "function") mostrarToast("Ese pedido ya no está en Pedidos");
    }

    // -------------------------------------------------
    // Aviso emergente (con la app abierta)
    // -------------------------------------------------

    let temporizadorEmergente = null;

    function cerrarEmergente() {
        clearTimeout(temporizadorEmergente);
        const emergente = document.getElementById("emergenteAviso");
        if (!emergente) return;

        emergente.classList.remove("visible");
        setTimeout(() => {
            if (!emergente.classList.contains("visible")) emergente.classList.add("oculto");
        }, 250);
    }

    function mostrarEmergente(nuevos) {
        if (listaAbierta()) return;

        let emergente = document.getElementById("emergenteAviso");
        if (!emergente) {
            emergente = crear("div", "emergenteAviso oculto");
            emergente.id = "emergenteAviso";
            emergente.setAttribute("role", "status");
            emergente.setAttribute("aria-live", "polite");
            document.body.appendChild(emergente);

            emergente.addEventListener("click", evento => {
                if (evento.target.closest(".cerrarEmergenteAviso")) {
                    cerrarEmergente();
                    return;
                }
                const id = emergente.dataset.id;
                if (id) abrirAviso(id);
                else abrirLista();
            });
        }

        const masNuevo = nuevos.slice().sort((a, b) => (Number(b.horaCelular) || 0) - (Number(a.horaCelular) || 0))[0];
        const tipo = datosDelTipo(masNuevo.tipo);
        const uno = nuevos.length === 1;

        emergente.innerHTML = "";
        emergente.dataset.id = uno ? masNuevo.id : "";
        emergente.dataset.tipo = uno ? masNuevo.tipo : "";

        const icono = crear("span", "iconoAviso");
        icono.innerHTML = window.icono ? window.icono(uno ? tipo.icono : "campana", 18) : "";

        const textos = crear("span", "textosAviso");
        if (uno) {
            textos.append(
                crear("strong", "tituloAviso", tipo.nombre + " · " + String(masNuevo.comercio || "")),
                crear("small", "cuandoAviso", tipo.hecho + " " + nombrePersona(masNuevo.persona) + (masNuevo.detalle ? ": " + masNuevo.detalle : ""))
            );
        } else {
            textos.append(
                crear("strong", "tituloAviso", nuevos.length + " avisos nuevos"),
                crear("small", "cuandoAviso", "El último: " + tipo.nombre + " · " + String(masNuevo.comercio || ""))
            );
        }

        const cerrar = crear("button", "cerrarEmergenteAviso");
        cerrar.type = "button";
        cerrar.setAttribute("aria-label", "Cerrar aviso");
        cerrar.innerHTML = window.icono ? window.icono("cerrarX", 16) : "×";

        emergente.append(icono, textos, cerrar);
        emergente.classList.remove("oculto");
        requestAnimationFrame(() => emergente.classList.add("visible"));
        if (navigator.vibrate) navigator.vibrate([30, 60, 30]);

        clearTimeout(temporizadorEmergente);
        temporizadorEmergente = setTimeout(cerrarEmergente, DURACION_EMERGENTE);
    }

    // -------------------------------------------------
    // Conexión con el resto de la app
    // -------------------------------------------------

    window.avisosVendeFrio = {
        tipos: () => TIPOS.map(tipo => ({ id: tipo.id, nombre: tipo.nombre, quien: tipo.quien, permiso: tipo.permiso || "" })),
        disponible: () => Boolean(yo),
        estado: () => estado,
        recibe,
        cambiarPreferencia,
        sinLeer: () => (yo ? sinLeer() : 0),
        abrirLista,
        escuchar(oyente) {
            if (typeof oyente !== "function") return () => {};
            oyentes.push(oyente);
            return () => {
                const indice = oyentes.indexOf(oyente);
                if (indice >= 0) oyentes.splice(indice, 1);
            };
        }
    };

    window.nubeVendeFrio?.escucharAccionesDePedidos?.(alHacerAlgo);
    window.empleadosVendeFrio?.escucharQuienSoy?.(arrancar);
    // Los roles y permisos del empleado pueden llegar después.
    window.empleadosVendeFrio?.escucharPermisos?.(() => avisarCambio());
    window.addEventListener("load", arrancar);
})();
