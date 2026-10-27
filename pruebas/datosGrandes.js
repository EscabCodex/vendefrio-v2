// VendeFrío - Datos de un reparto grande para las pruebas de velocidad
// (T150, T151): 200 comercios (el último, archivado) y 600 pedidos, en el
// modo personal. Se cargan en el celular de prueba con page.evaluate.
async function entrarSinCuenta(page) {
    await page.goto("/");
    await page.getByRole("button", { name: "Continuar sin iniciar sesión" }).click();
    await page.locator("#inicioNombrePersonal").fill("Jere");
    await page.locator("#inicioRolesPersonales").getByText("Vendedor").click();
    await page.locator("#inicioFormPersonal").getByRole("button", { name: "Guardar y entrar" }).click();
}

function cargarDatosGrandes() {
    // Un celular nuevo arranca vacío: se usa el catálogo de fábrica de antes
    // (productos.js), con sus tres marcas.
    let productos = JSON.parse(localStorage.getItem("vendefrio_productos") || "{}");
    if (!Object.keys(productos).length) {
        productos = PRODUCTOS;
        localStorage.setItem("vendefrio_productos", JSON.stringify(productos));
    }
    const lista = [];
    Object.entries(productos).forEach(([marca, items]) => items.forEach(item => lista.push([marca, item.nombre])));
    const comercios = [];
    for (let i = 0; i < 200; i++) {
        comercios.push({ nombre: "Comercio " + i, direccion: "Calle " + i + " 123", telefono: "", enlaceMaps: "", origenGps: "manual",
            lat: -34.6 + i * 0.001, lng: -58.4 - i * 0.001, pedidosRealizados: 3, ultimaVisita: "", pendienteSemana: false, id: "com_prueba" + i,
            archivado: i === 199 });
    }
    const pedidos = [];
    for (let i = 0; i < 600; i++) {
        const hora = Date.now() - i * 4 * 3600000;
        const productosDelPedido = [0, 1, 2, 3].map(k => {
            const [marca, producto] = lista[(i + k * 7) % lista.length];
            return { marca, producto, cantidad: 1 + (i + k) % 5 };
        });
        pedidos.push({ fecha: new Date(hora).toLocaleDateString("es-AR"), timestamp: hora, comercio: comercios[i % 200].nombre,
            cantidad: 10, pedido: "", productos: productosDelPedido, observaciones: "", id: "ped_prueba" + i });
    }
    localStorage.setItem("vendefrio_comercios", JSON.stringify(comercios));
    localStorage.setItem("vendefrio_historial", JSON.stringify(pedidos));
}

// Anota cada momento en que el celular queda trabado (más de 50 ms).
function anotarTrabas() {
    window.trabasDePrueba = [];
    new PerformanceObserver(lista => lista.getEntries().forEach(tarea => window.trabasDePrueba.push(tarea.duration)))
        .observe({ type: "longtask", buffered: true });
}

// Las listas largas se dibujan a medida que se baja (repasada): baja con el
// dedo hasta el final, hasta que estén las "cantidad" tarjetas.
async function bajarHastaElFinal(lista, selector, cantidad) {
    const { expect } = require("./ayudas");
    await expect(async () => {
        await lista.locator(":scope > *").last().scrollIntoViewIfNeeded();
        expect(await lista.locator(selector).count()).toBe(cantidad);
    }).toPass({ timeout: 30000, intervals: [100, 250, 500] });
}

module.exports = { entrarSinCuenta, cargarDatosGrandes, anotarTrabas, bajarHastaElFinal };
