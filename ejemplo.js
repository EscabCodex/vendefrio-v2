// VendeFrío - Probar con datos de ejemplo (T85).
// Desde la pantalla de bienvenida, con el celular vacío, carga comercios,
// productos con precio y un mes de pedidos en modo personal, para ver la app
// andando sin cargar nada. En Inicio queda el aviso "Estás probando con datos
// de ejemplo" con "Empezar de cero", que borra solo lo de ejemplo.
(function () {
    "use strict";

    const p = window.piezas;
    const CLAVE = "vendefrio_datos_ejemplo";
    const DIA = 86400000;

    const MARCA = "Frío Sur";
    const PRODUCTOS = [
        ["Helado 1 kg", 4500],
        ["Helado 1/4 kg", 1600],
        ["Palito bombón", 800],
        ["Palito de agua", 500],
        ["Cucurucho", 1200],
        ["Torta helada", 6800]
    ];
    const COMERCIOS = [
        { nombre: "Almacén Don Pepe", direccion: "San Martín 123", telefono: "11 5555-1234", lat: -34.6045, lng: -58.3790, cada: 7, pide: [["Helado 1 kg", 3], ["Palito bombón", 20]] },
        { nombre: "Kiosco Luna", direccion: "Belgrano 45", telefono: "11 4000-1111", lat: -34.6010, lng: -58.3810, cada: 4, pide: [["Palito de agua", 30], ["Cucurucho", 10]] },
        { nombre: "Despensa Mary", direccion: "Mitre 900", telefono: "11 4444-2222", lat: -34.6080, lng: -58.3860, cada: 7, deja: 16, pide: [["Helado 1 kg", 2], ["Helado 1/4 kg", 6]] },
        { nombre: "Maxikiosco 24", direccion: "Rivadavia 2100", telefono: "11 3333-7777", lat: -34.6098, lng: -58.3950, cada: 10, pide: [["Torta helada", 2], ["Palito bombón", 15]] },
        { nombre: "Granja El Sol", direccion: "Moreno 550", telefono: "11 6666-0101", lat: -34.6125, lng: -58.3735, cada: 14, pide: [["Helado 1 kg", 4], ["Cucurucho", 12]] }
    ];

    function marcados() {
        return p.lsLeer(CLAVE, null);
    }

    // Los comercios de fábrica no cuentan: cuenta haber cargado pedidos.
    function hayDatosPropios() {
        const historial = typeof obtenerHistorial === "function" ? obtenerHistorial() : [];
        return historial.length > 0;
    }

    // Solo se ofrece con el celular vacío: nunca se mezcla con datos reales.
    function sePuede() {
        if (typeof usaNubeReal === "function" && usaNubeReal()) return false;
        return !hayDatosPropios();
    }

    function cargar() {
        if (hayDatosPropios()) throw new Error("Ya hay datos en este celular.");
        const productos = obtenerProductos();
        const marcaNueva = !Object.keys(productos).some(marca => marca.toLocaleLowerCase("es") === MARCA.toLocaleLowerCase("es"));
        if (marcaNueva) agregarMarca(MARCA);
        const agregados = [];
        PRODUCTOS.forEach(([nombre, precio]) => {
            if (agregarProducto(MARCA, { nombre, precio })) agregados.push(nombre);
        });

        const agregadosComercios = [];
        COMERCIOS.forEach(comercio => {
            if (agregarComercio({ nombre: comercio.nombre, direccion: comercio.direccion, telefono: comercio.telefono, lat: comercio.lat, lng: comercio.lng })) {
                agregadosComercios.push(comercio.nombre);
            }
        });

        // Un mes de pedidos, cada comercio con su ritmo.
        const precio = Object.fromEntries(PRODUCTOS);
        const hoy = new Date(); hoy.setHours(10, 0, 0, 0);
        const pedidos = [];
        COMERCIOS.forEach((comercio, numero) => {
            for (let hace = comercio.deja || (numero % 3); hace <= 35; hace += comercio.cada) {
                const variacion = (hace + numero) % 3 - 1;
                pedidos.push({
                    comercio: comercio.nombre,
                    timestamp: hoy.getTime() - hace * DIA + numero * 1800000,
                    ejemplo: true,
                    productos: comercio.pide.map(([producto, cantidad]) => ({
                        marca: MARCA, producto, cantidad: Math.max(1, cantidad + variacion * Math.ceil(cantidad / 5)), precio: precio[producto]
                    }))
                });
            }
        });
        pedidos.sort((a, b) => b.timestamp - a.timestamp);
        guardarHistorial(pedidos.concat(obtenerHistorial()));

        p.lsGuardar(CLAVE, {
            marca: marcaNueva ? MARCA : "",
            productos: agregados,
            comercios: agregadosComercios,
            hora: Date.now()
        });
        revisar();
        // Inicio, Comercios y Catálogo, ya con lo de ejemplo.
        setTimeout(() => ["renderizarComercios", "renderizarCatalogo", "actualizarDashboard"].forEach(nombre => {
            if (typeof window[nombre] === "function") { try { window[nombre](); } catch (error) { /* nada */ } }
        }), 0);
    }

    // Borra solo lo que cargó el ejemplo; lo que la persona agregó queda.
    function borrar() {
        const datos = marcados();
        if (!datos) return;
        guardarHistorial(obtenerHistorial().filter(pedido => !(pedido && pedido.ejemplo === true)));
        (datos.comercios || []).forEach(nombre => {
            const tienePedidos = obtenerHistorial().some(pedido => pedido.comercio === nombre);
            if (!tienePedidos) eliminarComercio(nombre);
        });
        const productos = obtenerProductos();
        const marca = Object.keys(productos).find(item => item.toLocaleLowerCase("es") === MARCA.toLocaleLowerCase("es"));
        if (marca) {
            const quedan = (productos[marca] || []).filter(producto => !(datos.productos || []).includes(producto.nombre));
            if (datos.marca && !quedan.length) {
                eliminarMarca(marca);
            } else {
                for (let indice = productos[marca].length - 1; indice >= 0; indice -= 1) {
                    if ((datos.productos || []).includes(productos[marca][indice].nombre)) eliminarProducto(marca, indice);
                }
            }
        }
        try { localStorage.removeItem(CLAVE); } catch (error) { /* nada */ }
        revisar();
        ["renderizarComercios", "renderizarCatalogo", "actualizarDashboard"].forEach(nombre => {
            if (typeof window[nombre] === "function") { try { window[nombre](); } catch (error) { /* nada */ } }
        });
        if (typeof mostrarToast === "function") mostrarToast("Listo: arrancás de cero");
    }

    function confirmarBorrar() {
        p.hoja({
            titulo: "¿Empezar de cero?",
            sub: "Se borran los comercios, productos y pedidos de ejemplo. Lo que hayas cargado vos queda.",
            etiqueta: "Empezar de cero",
            botones: [
                { texto: "Cancelar", clase: "pzBtnGris", par: true },
                { texto: "Borrar el ejemplo", clase: "pzBtnPeligro", par: true, alTocar: () => borrar() }
            ]
        });
    }

    function revisar() {
        const hay = Boolean(marcados()) && !(typeof usaNubeReal === "function" && usaNubeReal());
        p.avisoInicio("avisoDatosEjemplo", hay ? {
            color: "Info",
            icono: "chispa",
            titulo: "Estás probando con datos de ejemplo",
            texto: "Mirá todo lo que hace la app. Cuando quieras, empezá con lo tuyo.",
            boton: "Empezar de cero",
            claseBoton: "pzBtnSec",
            alTocar: confirmarBorrar
        } : null, "arriba");
    }

    if (typeof window.actualizarDashboard === "function") {
        const original = window.actualizarDashboard;
        window.actualizarDashboard = function () {
            const resultado = original.apply(this, arguments);
            try { revisar(); } catch (error) { console.error("Falló el aviso de datos de ejemplo.", error); }
            return resultado;
        };
    }
    window.addEventListener("modoPersonalVendeFrio", () => { try { revisar(); } catch (error) { /* nada */ } });
    setTimeout(() => { try { revisar(); } catch (error) { /* nada */ } }, 0);

    window.ejemploVendeFrio = { sePuede, cargar, borrar, hay: () => Boolean(marcados()) };

    // La bienvenida pudo dibujarse antes de que cargara este archivo.
    document.querySelector('#pantallaInicioSesion [data-inicio="ejemplo"]')?.classList.toggle("oculto", !sePuede());
}());
