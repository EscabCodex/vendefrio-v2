// VendeFrío - Registro de cambios (T82).
// Quién cambió qué y cuándo: precios, productos, comercios y el equipo.
// Solo el dueño lo ve (Más > Registro de cambios) y nadie lo puede borrar
// ni editar (`cambios/`, reglas). Se anota desde este celular al cambiar:
// lo que llega de otro celular ya lo anotó ese celular.
(function () {
    "use strict";

    const p = window.piezas;
    const extras = window.extrasVendeFrio;
    const TIPOS = [
        { clave: "todo", texto: "Todo" },
        { clave: "precios", texto: "Precios" },
        { clave: "equipo", texto: "Equipo" },
        { clave: "comercios", texto: "Comercios" },
        { clave: "productos", texto: "Productos" }
    ];
    let filtro = "todo";

    extras.registrar("cambios", {
        dias: 120,
        puedeLeer: () => p.esDueno(),
        describir: cambio => ({ titulo: "Registro", nombre: cambio.titulo || "", detalle: cambio.detalle || "" })
    });

    function enLaNube() {
        return typeof usaNubeReal === "function" && usaNubeReal() && Boolean(p.refNube()) && Boolean(p.persona());
    }

    function primerNombre() {
        const persona = p.persona();
        return persona && persona.nombre ? String(persona.nombre).split(/\s+/)[0] : "Alguien";
    }

    function anotar(tipo, accion, detalle) {
        if (!enLaNube()) return;
        try {
            extras.guardar("cambios", {
                tipo,
                titulo: (primerNombre() + " " + accion).slice(0, 120),
                detalle: String(detalle || "").slice(0, 200),
                persona: p.persona(),
                horaCelular: Date.now()
            }, typeof generarId === "function" ? generarId("cambio") : undefined);
        } catch (error) {
            console.warn("No se pudo anotar el cambio.", error);
        }
    }

    const plata = valor => Number(valor) > 0 ? p.plata(Number(valor)) : "sin precio";

    // ---------- Productos ----------
    if (typeof window.actualizarProductoPorId === "function") {
        const original = window.actualizarProductoPorId;
        window.actualizarProductoPorId = function (id, datos) {
            const antes = typeof obtenerProductoPorId === "function" ? obtenerProductoPorId(id) : null;
            const resultado = original.apply(this, arguments);
            if (resultado && antes && datos && typeof datos === "object") {
                try { anotarProducto(antes.producto, datos); } catch (error) { console.warn(error); }
            }
            return resultado;
        };
    }

    function anotarProducto(anterior, datos) {
        const nombre = anterior.nombre;
        if (datos.precio !== undefined && Number(datos.precio) !== Number(anterior.precio)) {
            anotar("precios", "cambió un precio", nombre + ": de " + plata(anterior.precio) + " a " + plata(datos.precio));
        }
        if (datos.nombre !== undefined && String(datos.nombre).trim() !== nombre) {
            anotar("productos", "cambió el nombre de un producto", nombre + " → " + String(datos.nombre).trim());
        }
        if (datos.archivado !== undefined && Boolean(datos.archivado) !== Boolean(anterior.archivado)) {
            anotar("productos", datos.archivado ? "archivó un producto" : "recuperó un producto", nombre);
        }
        if (datos.oferta !== undefined && JSON.stringify(datos.oferta || null) !== JSON.stringify(anterior.oferta || null)) {
            anotar("precios", datos.oferta ? "puso un producto en oferta" : "sacó una oferta",
                datos.oferta ? nombre + ": " + plata(datos.oferta.precio) + " hasta el " + String(datos.oferta.hasta || "").split("-").reverse().slice(0, 2).join("/") : nombre);
        }
        if (datos.precios !== undefined && JSON.stringify(datos.precios || {}) !== JSON.stringify(anterior.precios || {})) {
            const listas = Object.keys(datos.precios || {}).map(lista => lista + " " + plata(datos.precios[lista])).join(", ");
            anotar("precios", "cambió precios por lista", nombre + (listas ? ": " + listas : ": sin listas"));
        }
        if (datos.stock !== undefined && Number(datos.stock) !== Number(anterior.stock)) {
            anotar("productos", "cambió el stock", nombre + ": de " + (Number(anterior.stock) || 0) + " a " + (Number(datos.stock) || 0));
        }
    }

    if (typeof window.eliminarProductoPorId === "function") {
        const original = window.eliminarProductoPorId;
        window.eliminarProductoPorId = function (id) {
            const antes = typeof obtenerProductoPorId === "function" ? obtenerProductoPorId(id) : null;
            const resultado = original.apply(this, arguments);
            if (resultado && antes) anotar("productos", "borró un producto", antes.marca + " · " + antes.producto.nombre);
            return resultado;
        };
    }

    // ---------- Comercios ----------
    const CAMPOS_COMERCIO = {
        nombre: "nombre", direccion: "dirección", telefono: "teléfono", contacto: "contacto",
        horario: "horario", diaVisita: "día de visita", nota: "nota", listaPrecios: "lista de precios",
        lat: "ubicación", envases: "envases"
    };

    // Cómo estaba el comercio antes del cambio (se guarda congelado: no
    // hace falta copiar todos los comercios en cada edición).
    function comercioAntesDeCambiar(id) {
        if (typeof comercioParaLeerPorId === "function") return comercioParaLeerPorId(id) || null;
        return typeof obtenerComercios === "function" ? obtenerComercios().find(comercio => comercio.id === id) || null : null;
    }

    if (typeof window.actualizarComercioPorId === "function") {
        const original = window.actualizarComercioPorId;
        window.actualizarComercioPorId = function (id, datos) {
            const antes = comercioAntesDeCambiar(id);
            const resultado = original.apply(this, arguments);
            if (resultado && antes && datos && typeof datos === "object") {
                try { anotarComercio(antes, datos); } catch (error) { console.warn(error); }
            }
            return resultado;
        };
    }

    function anotarComercio(anterior, datos) {
        const nombre = anterior.nombre;
        if (datos.archivado !== undefined && Boolean(datos.archivado) !== Boolean(anterior.archivado)) {
            anotar("comercios", datos.archivado ? "archivó un comercio" : "recuperó un comercio", nombre);
        }
        if (datos.topeDeuda !== undefined && (Number(datos.topeDeuda) || 0) !== (Number(anterior.topeDeuda) || 0)) {
            anotar("comercios", "cambió el tope de deuda", nombre + ": de " + (Number(anterior.topeDeuda) ? p.plata(anterior.topeDeuda) : "sin tope") +
                " a " + (Number(datos.topeDeuda) ? p.plata(datos.topeDeuda) : "sin tope"));
        }
        const cambiados = Object.keys(CAMPOS_COMERCIO).filter(campo => datos[campo] !== undefined &&
            JSON.stringify(datos[campo] ?? "") !== JSON.stringify(anterior[campo] ?? ""));
        if (!cambiados.length) return;
        const textos = cambiados.map(campo => CAMPOS_COMERCIO[campo]);
        const lista = textos.length > 1 ? textos.slice(0, -1).join(", ") + " y " + textos[textos.length - 1] : textos[0];
        anotar("comercios", "editó un comercio", nombre + ": " + lista + (textos.length === 1 && cambiados[0] !== "lat" ? " nuevo" : ""));
    }

    if (typeof window.eliminarComercioPorId === "function") {
        const original = window.eliminarComercioPorId;
        window.eliminarComercioPorId = function (id) {
            const antes = comercioAntesDeCambiar(id);
            const resultado = original.apply(this, arguments);
            if (resultado && antes) anotar("comercios", "borró un comercio", antes.nombre);
            return resultado;
        };
    }

    // ---------- Equipo ----------
    const empleados = window.empleadosVendeFrio;
    if (empleados) {
        const nombreDe = idEmpleado => {
            try {
                const lista = window.__empleadosConocidos || [];
                const empleado = lista.find(item => item.id === idEmpleado || item.uid === idEmpleado);
                return empleado && empleado.nombre ? empleado.nombre : "un empleado";
            } catch (error) {
                return "un empleado";
            }
        };
        const nombreRol = idRol => {
            try { return (empleados.nombresDeRoles ? empleados.nombresDeRoles([idRol]) : [idRol]).join(", ") || idRol; } catch (error) { return idRol; }
        };
        const envolver = (clave, armar) => {
            if (typeof empleados[clave] !== "function") return;
            const original = empleados[clave];
            empleados[clave] = function () {
                const argumentos = arguments;
                const resultado = original.apply(this, argumentos);
                const anotarSiAnduvo = () => { try { const [accion, detalle] = armar(...argumentos); anotar("equipo", accion, detalle); } catch (error) { /* nada */ } };
                if (resultado && typeof resultado.then === "function") resultado.then(anotarSiAnduvo, () => {});
                else if (resultado !== false) anotarSiAnduvo();
                return resultado;
            };
        };
        envolver("aprobarRol", (idEmpleado, idRol) => ["aprobó un rol", nombreDe(idEmpleado) + " ahora es " + nombreRol(idRol)]);
        envolver("rechazarRol", (idEmpleado, idRol) => ["rechazó un rol", nombreDe(idEmpleado) + ": " + nombreRol(idRol)]);
        envolver("cambiarRolesDe", (idEmpleado, roles) => ["cambió los roles", nombreDe(idEmpleado) + ": " + (Array.isArray(roles) ? roles.map(nombreRol).join(", ") : "")]);
        envolver("darDeBaja", idEmpleado => ["dio de baja a un empleado", nombreDe(idEmpleado)]);
        envolver("generarCodigo", () => ["generó un código de ingreso", "Para sumar un empleado"]);
        if (typeof empleados.escucharEmpleados === "function") {
            const original = empleados.escucharEmpleados;
            empleados.escucharEmpleados = function (oyente) {
                return original.call(this, lista => {
                    window.__empleadosConocidos = Array.isArray(lista) ? lista : [];
                    return oyente(lista);
                });
            };
        }
    }

    // ---------- Pantalla ----------
    function textoDia(hora) {
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const dia = new Date(hora); dia.setHours(0, 0, 0, 0);
        const diferencia = Math.round((hoy - dia) / 86400000);
        if (diferencia === 0) return "Hoy";
        if (diferencia === 1) return "Ayer";
        const nombre = dia.toLocaleDateString("es-AR", { weekday: "long" });
        return nombre.charAt(0).toUpperCase() + nombre.slice(1) + " " + dia.getDate() + "/" + (dia.getMonth() + 1);
    }

    function abrir() {
        const seccion = p.pantalla("pantallaCambios", {
            titulo: "Registro de cambios",
            sub: "Solo lo ves vos · no se puede borrar",
            icono: "historial",
            volverA: "mas"
        });
        p.mostrar(seccion);
        dibujar();
    }

    function dibujar() {
        const seccion = document.getElementById("pantallaCambios");
        if (!seccion || seccion.classList.contains("oculto")) return;
        const todos = extras.lista("cambios").slice().sort((a, b) => Number(b.horaCelular) - Number(a.horaCelular));
        const lista = filtro === "todo" ? todos : todos.filter(cambio => cambio.tipo === filtro);
        const grupos = [];
        lista.forEach(cambio => {
            const dia = textoDia(cambio.horaCelular);
            const grupo = grupos[grupos.length - 1];
            if (grupo && grupo.dia === dia) grupo.cambios.push(cambio);
            else grupos.push({ dia, cambios: [cambio] });
        });
        const filtros = TIPOS.map(tipo => `<button type="button" class="pzFiltro" data-tipo="${tipo.clave}" aria-pressed="${tipo.clave === filtro}">${tipo.texto}</button>`).join("");
        const cuerpo = grupos.length
            ? grupos.map(grupo => `<section class="pzBloque grupoCambios">
                    <div class="pzBloqueCab"><h2>${p.esc(grupo.dia)}</h2></div>
                    <div class="pzTarjeta pzLista">${grupo.cambios.map(cambio => `<div class="pzFila filaCambio">
                        <span class="horaCambio">${p.hora(cambio.horaCelular)}</span>
                        <div class="pzFilaTxt"><strong>${p.esc(cambio.titulo)}</strong><small>${p.esc(cambio.detalle)}</small></div>
                    </div>`).join("")}</div>
                </section>`).join("")
            : `<div class="pzTarjeta"><div class="pzVacio">${filtro === "todo" ? "Todavía no hay cambios anotados. Cuando alguien cambie un precio, un comercio o el equipo, aparece acá." : "No hay cambios de este tipo."}</div></div>`;
        seccion.querySelector("main").innerHTML = `<div class="pzFiltros" role="group" aria-label="Qué cambios ver">${filtros}</div>${cuerpo}`;
        seccion.querySelector("main").onclick = evento => {
            const boton = evento.target.closest("[data-tipo]");
            if (!boton) return;
            filtro = boton.dataset.tipo;
            dibujar();
        };
    }

    extras.escuchar("cambios", dibujar);
    (window.accesosMasExtras = window.accesosMasExtras || []).push({
        destino: "cambios", icono: "historial", texto: "Registro de cambios",
        mostrar: () => typeof usaNubeReal === "function" && usaNubeReal() && p.esDueno(),
        abrir
    });

    window.cambiosVendeFrio = { anotar, abrir, dibujar };
}());
