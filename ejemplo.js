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

    // Una distribuidora inventada y completa (pedido del dueño, informe "visto
    // por un desconocido"): un solo rubro, todo con precio, y cada casilla de
    // la app usada: stock (T90), código de barras, listas de precios (T78),
    // una oferta (T68), los datos de la ficha y dos rutas guardadas.
    const MARCAS = {
        "Frío Sur": [
            ["Helado 1 kg", 4500, 40], ["Helado 1/2 kg", 2600, 35], ["Helado 1/4 kg", 1600, 60],
            ["Palito bombón", 800, 120], ["Palito de agua", 500, 150], ["Cucurucho", 1200, 80]
        ],
        "Dulce Polar": [
            ["Torta helada", 6800, 12], ["Almendrado", 5200, 7], ["Bombón suizo", 900, 70], ["Copa helada", 1500, 30]
        ],
        "Hielo Austral": [
            ["Bolsa de hielo 2 kg", 1100, 50], ["Bolsa de hielo 5 kg", 2300, 25]
        ]
    };
    const MARCA = "Frío Sur";
    // Kioscos paga un poco más y Supermercados un poco menos que la general.
    const LISTAS = { Kioscos: 1.05, Supermercados: 0.92 };
    const EN_OFERTA = { nombre: "Cucurucho", precio: 990, dias: 5 };
    const PRODUCTOS = Object.values(MARCAS).flat().map(([nombre, precio]) => [nombre, precio]);
    const MARCA_DE = Object.fromEntries(Object.entries(MARCAS).flatMap(([marca, lista]) => lista.map(([nombre]) => [nombre, marca])));
    const COMERCIOS = [
        { nombre: "Almacén Don Pepe", datos: { horario: "Lun a sáb · 8 a 13 y 17 a 21", diaVisita: "Lunes", contacto: "José Pérez", nota: "Descargar por el costado. El freezer grande está al fondo.", envases: { tiene: 3, devolvio: 1 }, listaPrecios: "Kioscos", topeDeuda: 40000 }, direccion: "San Martín 123", telefono: "11 5555-1234", lat: -34.6045, lng: -58.3790, cada: 7, pide: [["Helado 1 kg", 3], ["Palito bombón", 20], ["Bolsa de hielo 2 kg", 4]] },
        { nombre: "Kiosco Luna", datos: { horario: "Todos los días · 7 a 23", diaVisita: "Lunes", contacto: "Luna Ríos", nota: "Pide más palitos los viernes.", listaPrecios: "Kioscos" }, direccion: "Belgrano 45", telefono: "11 4000-1111", lat: -34.6010, lng: -58.3810, cada: 4, pide: [["Palito de agua", 30], ["Cucurucho", 10]] },
        { nombre: "Despensa Mary", datos: { horario: "Lun a sáb · 8 a 13", diaVisita: "Martes", contacto: "María Gómez", nota: "Paga en efectivo. Tocar timbre.", envases: { tiene: 2, devolvio: 2 }, topeDeuda: 25000 }, direccion: "Mitre 900", telefono: "11 4444-2222", lat: -34.6080, lng: -58.3860, cada: 7, deja: 16, pide: [["Helado 1 kg", 2], ["Helado 1/4 kg", 6]] },
        { nombre: "Maxikiosco 24", datos: { horario: "Abierto las 24 horas", diaVisita: "Jueves", contacto: "Carlos Díaz", nota: "Estacionar en Rivadavia, la otra calle es mano única.", listaPrecios: "Kioscos" }, direccion: "Rivadavia 2100", telefono: "11 3333-7777", lat: -34.6098, lng: -58.3950, cada: 10, pide: [["Torta helada", 2], ["Palito bombón", 15]] },
        { nombre: "Granja El Sol", datos: { horario: "Lun a sáb · 9 a 13 y 16 a 20", diaVisita: "Viernes", contacto: "Sol Martínez", nota: "Avisar por WhatsApp antes de ir." }, direccion: "Moreno 550", telefono: "11 6666-0101", lat: -34.6125, lng: -58.3735, cada: 14, pide: [["Helado 1 kg", 4], ["Cucurucho", 12]] },
        { nombre: "Autoservicio La Esquina", datos: { horario: "Lun a dom · 8 a 22", diaVisita: "Lunes", contacto: "Wei Chen", nota: "Recibe por la puerta de atrás.", envases: { tiene: 4, devolvio: 0 }, listaPrecios: "Supermercados", topeDeuda: 80000 }, direccion: "Av. Corrientes 1450", telefono: "11 4321-5678", lat: -34.6037, lng: -58.3880, cada: 7, pide: [["Helado 1/2 kg", 6], ["Bombón suizo", 24], ["Bolsa de hielo 5 kg", 3]] },
        { nombre: "Kiosco El Faro", datos: { horario: "Lun a vie · 7 a 21", diaVisita: "Martes", contacto: "Ana Torres", nota: "Cerca de la escuela: ir antes de las 12.", listaPrecios: "Kioscos" }, direccion: "Tucumán 780", telefono: "11 4123-9090", lat: -34.6020, lng: -58.3770, cada: 5, pide: [["Palito bombón", 25], ["Palito de agua", 20]] },
        { nombre: "Almacén Doña Rosa", datos: { horario: "Lun a sáb · 8 a 13 y 17 a 20", diaVisita: "Jueves", contacto: "Rosa Fernández", nota: "Pide la torta helada para los cumpleaños del barrio." }, direccion: "Sarmiento 1220", telefono: "11 4777-3030", lat: -34.6055, lng: -58.3905, cada: 7, deja: 9, pide: [["Helado 1/4 kg", 8], ["Almendrado", 2]] },
        { nombre: "Súper Tres Hermanos", datos: { horario: "Todos los días · 8 a 22", diaVisita: "Jueves", contacto: "Diego Rojas", nota: "Firma el remito el encargado.", envases: { tiene: 5, devolvio: 3 }, listaPrecios: "Supermercados", topeDeuda: 120000 }, direccion: "Av. Callao 300", telefono: "11 4950-2020", lat: -34.6070, lng: -58.3925, cada: 7, pide: [["Helado 1 kg", 6], ["Torta helada", 3], ["Copa helada", 12]] },
        { nombre: "Rotisería La Estación", datos: { horario: "Mar a dom · 11 a 15 y 19 a 23", diaVisita: "Viernes", contacto: "Lucía Benítez", nota: "Usa mucho hielo los fines de semana." }, direccion: "Lavalle 1600", telefono: "11 4372-1188", lat: -34.6030, lng: -58.3895, cada: 14, pide: [["Bolsa de hielo 5 kg", 6], ["Helado 1/2 kg", 4]] },
        { nombre: "Kiosco Plaza", datos: { horario: "Todos los días · 8 a 22", diaVisita: "Martes", contacto: "Martín Silva", nota: "Frente a la plaza, dejar en el mostrador.", listaPrecios: "Kioscos" }, direccion: "Paraná 450", telefono: "11 4811-4545", lat: -34.6040, lng: -58.3920, cada: 4, pide: [["Palito de agua", 25], ["Cucurucho", 8], ["Bombón suizo", 12]] },
        { nombre: "Mercadito Los Pinos", datos: { horario: "Lun a sáb · 8 a 21", diaVisita: "Viernes", contacto: "Pablo Acosta", nota: "Paga con transferencia.", listaPrecios: "Supermercados" }, direccion: "Uruguay 950", telefono: "11 4816-6060", lat: -34.6005, lng: -58.3860, cada: 10, deja: 21, pide: [["Helado 1 kg", 3], ["Copa helada", 10]] }
    ];
    // Rutas guardadas: cada una con su día (Rutas > Guardadas).
    const RUTAS = [
        { nombre: "Centro · lunes", dia: "lunes", comercios: ["Almacén Don Pepe", "Kiosco Luna", "Autoservicio La Esquina", "Kiosco El Faro", "Kiosco Plaza", "Despensa Mary"] },
        { nombre: "Once · jueves", dia: "jueves", comercios: ["Maxikiosco 24", "Almacén Doña Rosa", "Súper Tres Hermanos", "Rotisería La Estación", "Mercadito Los Pinos", "Granja El Sol"] }
    ];

    // La fecha, las unidades y el mensaje que guarda Nuevo pedido.
    function comoPedidoGuardado(comercio, timestamp, productos) {
        const fecha = new Date(timestamp).toLocaleDateString("es-AR");
        const cantidad = productos.reduce((total, item) => total + item.cantidad, 0);
        const marcas = [...new Set(productos.map(item => item.marca))];
        const pedido = String.fromCodePoint(0x1F3EA) + " *" + comercio + "*\n" + fecha + "\n\n" +
            String.fromCodePoint(0x1F4E6) + " *RESUMEN DEL PEDIDO*\nUnidades totales: " + cantidad +
            "\nProductos diferentes: " + productos.length + "\n\n" +
            marcas.map(marca => String.fromCodePoint(0x1F535) + " *" + marca + "*\n" +
                productos.filter(item => item.marca === marca).map(item => "- " + item.producto + " x" + item.cantidad).join("\n")).join("\n\n");
        return { fecha, cantidad, pedido };
    }

    function marcados() {
        return p.lsLeer(CLAVE, null);
    }

    // Los comercios de fábrica no cuentan: cuenta haber cargado pedidos.
    function hayDatosPropios() {
        const historial = typeof historialParaLeer === "function" ? historialParaLeer() : [];
        return historial.length > 0;
    }

    // Solo se ofrece con el celular vacío: nunca se mezcla con datos reales.
    function sePuede() {
        if (typeof usaNubeReal === "function" && usaNubeReal()) return false;
        return !hayDatosPropios();
    }

    const normal = texto => String(texto || "").trim().toLocaleLowerCase("es");
    const buscarMarcaGuardada = (productos, marca) => Object.keys(productos).find(item => normal(item) === normal(marca));

    function cargar() {
        if (hayDatosPropios()) throw new Error("Ya hay datos en este celular.");
        // La lista de fábrica de antes (sin tocar) no se mezcla con el ejemplo.
        if (window.inicioVendeFrio?.tieneDatosPropios?.() === false) {
            guardarComercios([]);
            guardarProductos({});
        }
        const marcasNuevas = [];
        const agregados = [];
        Object.entries(MARCAS).forEach(([marca, lista]) => {
            if (!buscarMarcaGuardada(obtenerProductos(), marca)) {
                agregarMarca(marca);
                marcasNuevas.push(marca);
            }
            lista.forEach(([nombre, precio]) => {
                if (agregarProducto(marca, { nombre, precio })) agregados.push(nombre);
            });
        });
        // El stock contado hace dos días, para que el Catálogo lo muestre.
        const productos = obtenerProductos();
        const contado = Date.now() - 2 * DIA;
        Object.entries(MARCAS).forEach(([marca, lista]) => {
            const guardada = buscarMarcaGuardada(productos, marca);
            lista.forEach(([nombre, , stock]) => {
                const producto = (productos[guardada] || []).find(item => item.nombre === nombre);
                if (!producto || !agregados.includes(nombre)) return;
                if (producto.stock === undefined) {
                    producto.stock = stock;
                    producto.stockHora = contado;
                }
                // Un código de barras inventado (779 es el prefijo de Argentina).
                producto.codigo = "7790000" + String(100000 + PRODUCTOS.findIndex(([item]) => item === nombre) * 7919).slice(-6);
                producto.precios = Object.fromEntries(Object.entries(LISTAS)
                    .map(([lista, factor]) => [lista, Math.round(producto.precio * factor / 10) * 10]));
                if (nombre === EN_OFERTA.nombre) {
                    const hasta = new Date(Date.now() + EN_OFERTA.dias * DIA);
                    producto.oferta = { precio: EN_OFERTA.precio, hasta: fechaHoyISO(hasta) };
                }
            });
        });
        guardarProductos(productos);

        const agregadosComercios = [];
        COMERCIOS.forEach(comercio => {
            if (agregarComercio({ nombre: comercio.nombre, direccion: comercio.direccion, telefono: comercio.telefono, lat: comercio.lat, lng: comercio.lng })) {
                agregadosComercios.push(comercio.nombre);
                const guardado = typeof buscarComercioPorNombre === "function" ? buscarComercioPorNombre(comercio.nombre) : null;
                if (guardado) actualizarComercioPorId(guardado.id, { envases: { tiene: 2, devolvio: 1 }, topeDeuda: 30000, ...comercio.datos, origenGps: "manual", favoritos: comercio.pide.map(([producto]) => producto) });
            }
        });

        const agregadasRutas = [];
        const guardadas = typeof obtenerRutasGuardadas === "function" ? obtenerRutasGuardadas() : [];
        RUTAS.forEach(ruta => {
            if (guardadas.some(item => normal(item.nombre) === normal(ruta.nombre))) return;
            if (agregarRutaConId(ruta.nombre, ruta.comercios, ruta.dia)) agregadasRutas.push(ruta.nombre);
        });

        // Un mes de pedidos, cada comercio con su ritmo.
        const precio = Object.fromEntries(PRODUCTOS);
        const hoy = new Date(); hoy.setHours(10, 0, 0, 0);
        const pedidos = [];
        COMERCIOS.forEach((comercio, numero) => {
            for (let hace = comercio.deja || (numero % 3); hace <= 35; hace += comercio.cada) {
                const variacion = (hace + numero) % 3 - 1;
                const timestamp = hoy.getTime() - hace * DIA + numero * 1800000;
                const productos = comercio.pide.map(([producto, cantidad]) => ({
                    marca: MARCA_DE[producto], producto, cantidad: Math.max(1, cantidad + variacion * Math.ceil(cantidad / 5)), precio: precio[producto]
                }));
                pedidos.push({
                    comercio: comercio.nombre,
                    timestamp,
                    ejemplo: true,
                    productos,
                    // Como un pedido cargado en la app: Historial muestra la
                    // fecha, las unidades y el mensaje de "Ver pedido".
                    ...comoPedidoGuardado(comercio.nombre, timestamp, productos)
                });
            }
        });
        pedidos.sort((a, b) => b.timestamp - a.timestamp);
        guardarHistorial(pedidos.concat(obtenerHistorial()));
        // La última visita y la cuenta de pedidos, como si se hubieran cargado
        // en la app (antes la ficha decía "Nunca" con 6 pedidos, T153).
        agregadosComercios.forEach(nombre => {
            const comercio = typeof buscarComercioPorNombre === "function" ? buscarComercioPorNombre(nombre) : null;
            const suyos = pedidos.filter(pedido => pedido.comercio === nombre);
            if (!comercio || !suyos.length) return;
            actualizarComercioPorId(comercio.id, { pedidosRealizados: suyos.length, ultimaVisita: suyos[0].fecha, pendienteSemana: false });
        });

        p.lsGuardar(CLAVE, {
            marcas: marcasNuevas,
            productos: agregados,
            comercios: agregadosComercios,
            rutas: agregadasRutas,
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
        (datos.rutas || []).forEach(nombre => {
            const ruta = obtenerRutasGuardadas().find(item => normal(item.nombre) === normal(nombre));
            if (ruta) eliminarRutaPorId(ruta.id);
        });
        // Antes se guardaba una sola marca ("marca"); se sigue leyendo.
        const nuevas = (datos.marcas || (datos.marca ? [datos.marca] : [])).map(normal);
        const deEjemplo = datos.productos || [];
        Object.keys(MARCAS).forEach(nombreMarca => {
            const productos = obtenerProductos();
            const marca = buscarMarcaGuardada(productos, nombreMarca);
            if (!marca) return;
            const quedan = (productos[marca] || []).filter(producto => !deEjemplo.includes(producto.nombre));
            if (nuevas.includes(normal(marca)) && !quedan.length) {
                eliminarMarca(marca);
                return;
            }
            for (let indice = productos[marca].length - 1; indice >= 0; indice -= 1) {
                if (deEjemplo.includes(productos[marca][indice].nombre)) eliminarProducto(marca, indice);
            }
        });
        try { localStorage.removeItem(CLAVE); } catch (error) { /* nada */ }
        revisar();
        window.inicioVendeFrio?.mostrarCartelPersonal?.();
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
        // Un solo cartel arriba mientras se prueba (inicio.js no lo vuelve a poner).
        if (hay) p.avisoInicio("avisoModoPersonal", null);
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
