// VendeFrío - App de Android (appAndroid.js).
// Con la app de Android (Capacitor) la web usa el GPS de Android para
// compartir la ubicación y muestra los avisos como notificaciones del celular
// cuando la app está en segundo plano. En Chrome no cambia nada.
const { test, expect } = require("./ayudas");
const { entrarSinCuenta } = require("./datosGrandes");

// Capacitor de mentira: anota lo que la web le pide.
function capacitorDePrueba() {
    const pedidos = window.__pedidosCapacitor = [];
    const anotar = (nombre, valor) => { pedidos.push({ nombre, valor }); return Promise.resolve(valor); };
    window.Capacitor = {
        getPlatform: () => "android",
        Plugins: {
            LocalNotifications: {
                createChannel: o => anotar("canal", o),
                registerActionTypes: o => anotar("acciones", o),
                addListener: (evento, fn) => { window.__alTocarNotificacion = fn; return Promise.resolve({ remove() {} }); },
                checkPermissions: () => Promise.resolve({ display: "granted" }),
                requestPermissions: () => Promise.resolve({ display: "granted" }),
                schedule: o => anotar("notificar", o),
                cancel: o => anotar("cancelar", o),
                removeAllDeliveredNotifications: () => anotar("limpiar", true),
                getDeliveredNotifications: () => Promise.resolve({ notifications: [] })
            },
            NotificacionReparto: {
                mostrar: o => anotar("navegacion", o),
                quitar: () => anotar("quitarNavegacion", true),
                addListener: (evento, fn) => { window.__botonNavegacion = fn; return Promise.resolve({ remove() {} }); }
            },
            BackgroundGeolocation: {
                addWatcher: (opciones, fn) => { window.__moverGps = fn; return anotar("gps", opciones).then(() => "vigia-1"); },
                removeWatcher: o => anotar("sinGps", o)
            }
        }
    };
}

test("app de Android: notificaciones con botones y GPS en segundo plano", async ({ page }) => {
    await page.addInitScript(capacitorDePrueba);
    await entrarSinCuenta(page);
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.classList.contains("enAppAndroid"))).toBe(true);

    // Con la app a la vista no se manda notificación (ya está el emergente).
    await page.evaluate(() => window.appAndroidVendeFrio.avisosNuevos([{ id: "a1", tipo: "pedidoNuevo", comercio: "Don Pepe" }]));
    // En segundo plano, sí: una notificación aparte por aviso.
    await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        return window.appAndroidVendeFrio.avisosNuevos([
            { id: "a1", tipo: "pedidoNuevo", comercio: "Don Pepe", idPedido: "p1", persona: { nombre: "Maxi" }, detalle: "12 productos" },
            { id: "a2", tipo: "entregado", comercio: "Súper Mitre", idPedido: "p2", detalle: "Cobro pendiente · $ 31.200" }
        ], id => ({ nombre: id === "pedidoNuevo" ? "Pedido nuevo" : "Pedido entregado", hecho: "Por" }), p => (p && p.nombre) || "alguien");
    });
    const pedidos = await page.evaluate(() => window.__pedidosCapacitor);
    const notificar = pedidos.filter(p => p.nombre === "notificar");
    expect(notificar).toHaveLength(1);
    const lista = notificar[0].valor.notifications;
    expect(lista).toHaveLength(2);
    expect(lista[0]).toMatchObject({ title: "Pedido nuevo · Don Pepe", body: "Por Maxi: 12 productos", actionTypeId: "pedido", channelId: "avisos" });
    expect(lista[1].actionTypeId).toBe("cobro");
    expect(lista.some(n => n.groupSummary)).toBe(false);
    const acciones = pedidos.find(p => p.nombre === "acciones").valor.types;
    expect(acciones.find(t => t.id === "pedido").actions.map(a => a.title)).toEqual(["Ver pedido", "Marcar leído"]);

    // GPS: vigila con la notificación fija "Repartiendo" y deja de vigilar.
    const recibido = await page.evaluate(async () => {
        let ultimo = null;
        const clave = window.appAndroidVendeFrio.vigilarUbicacion(posicion => { ultimo = posicion; });
        await new Promise(r => setTimeout(r, 50));
        window.__moverGps({ latitude: -34.6, longitude: -58.4, accuracy: 8, time: 1 });
        window.appAndroidVendeFrio.dejarDeVigilar(clave);
        await new Promise(r => setTimeout(r, 50));
        return ultimo;
    });
    expect(recibido.coords).toMatchObject({ latitude: -34.6, longitude: -58.4, accuracy: 8 });
    const despues = await page.evaluate(() => window.__pedidosCapacitor);
    expect(despues.find(p => p.nombre === "gps").valor).toMatchObject({ backgroundTitle: "Repartiendo", requestPermissions: true });
    expect(despues.find(p => p.nombre === "sinGps").valor).toEqual({ id: "vigia-1" });

    // Reparto: la notificación fija dice por qué parada vas, con Cargar pedido y Sin pedido.
    const parada = await page.evaluate(async () => {
        window.__pedidosCapacitor.length = 0;
        await window.appAndroidVendeFrio.reparto({ hechas: 2, total: 8, destino: { nombre: "Almacén Don Pepe", direccion: "Av. Mitre 1234", lat: -34.6, lng: -58.4 }, lat: -34.6, lng: -58.4054 });
        // La misma parada y distancia no se vuelve a mandar.
        await window.appAndroidVendeFrio.reparto({ hechas: 2, total: 8, destino: { nombre: "Almacén Don Pepe", direccion: "Av. Mitre 1234", lat: -34.6, lng: -58.4 }, lat: -34.6, lng: -58.4054 });
        await window.appAndroidVendeFrio.reparto(null);
        return window.__pedidosCapacitor;
    });
    const mandadas = parada.filter(p => p.nombre === "notificar");
    expect(mandadas).toHaveLength(1);
    expect(mandadas[0].valor.notifications[0]).toMatchObject({ id: 28351, title: "Parada 3 de 8 · Almacén Don Pepe", body: "Av. Mitre 1234 · 490 m", ongoing: true, actionTypeId: "parada", channelId: "reparto" });
    expect(parada.find(p => p.nombre === "cancelar").valor).toEqual({ notifications: [{ id: 28351 }] });
    const tiposParada = acciones.find(t => t.id === "parada").actions.map(a => a.title);
    expect(tiposParada).toEqual(["Cargar pedido", "Sin pedido"]);

    // Navegación en la notificación: indicación, parada, llegada y barra por
    // paradas hechas. Mientras navega, la del reparto no la pisa.
    const navegacion = await page.evaluate(async () => {
        window.__pedidosCapacitor.length = 0;
        const app = window.appAndroidVendeFrio;
        const datos = { distancia: "200 m", texto: "Doblá a la derecha por Av. Mitre", tipo: "turn", grados: 90, parada: 3, total: 8, comercio: "Almacén Don Pepe", llegada: "08:51" };
        await app.navegacion(datos);
        await app.navegacion(datos);
        await app.reparto({ hechas: 2, total: 8, destino: { nombre: "Otro" }, lat: -34.6, lng: -58.4 });
        await app.navegacion(null);
        return window.__pedidosCapacitor;
    });
    const mostradas = navegacion.filter(p => p.nombre === "navegacion");
    expect(mostradas).toHaveLength(1);
    expect(mostradas[0].valor).toMatchObject({ titulo: "200 m · Doblá a la derecha", texto: "por Av. Mitre", detalle: "Parada 3 de 8 · Almacén Don Pepe · llegás 08:51", hechas: 2, total: 8, flecha: "giro", grados: 90, botones: true, sinPedido: true });
    expect(mostradas[0].valor.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(navegacion.some(p => p.nombre === "notificar")).toBe(false);
    expect(navegacion.some(p => p.nombre === "quitarNavegacion")).toBe(true);

    // "Sin pedido" desde la notificación pasa a la parada que sigue.
    const siguiente = await page.evaluate(() => {
        let pasadas = 0;
        window.navegacionVendeFrio = { abierta: () => true, minimizada: () => false, sinPedido: () => { pasadas++; }, paradaActual: () => ({ nombre: "Almacén Don Pepe" }) };
        window.__botonNavegacion({ accion: "sinPedido" });
        return pasadas;
    });
    expect(siguiente).toBe(1);

    // "Estoy repartiendo": el día de un vistazo, sin datos de la ruta.
    const resumen = await page.evaluate(async () => {
        window.__pedidosCapacitor.length = 0;
        window.appAndroidVendeFrio.repartiendo(true, Date.now() - 75 * 60000);
        await new Promise(r => setTimeout(r, 50));
        const lista = window.__pedidosCapacitor.filter(p => p.nombre === "navegacion").map(p => p.valor);
        window.appAndroidVendeFrio.repartiendo(false);
        await new Promise(r => setTimeout(r, 50));
        return { lista, quitada: window.__pedidosCapacitor.some(p => p.nombre === "quitarNavegacion") };
    });
    expect(resumen.lista.length).toBeGreaterThan(0);
    expect(resumen.lista[0]).toMatchObject({ flecha: "ninguna", total: 0, sinPedido: false });
    expect(resumen.lista[0].detalle).toContain("(1 h 15 min)");
    expect(resumen.lista[0].titulo).not.toContain("Parada");
    expect(resumen.quitada).toBe(true);
});

test("app de Android: en Chrome no hace nada", async ({ page }) => {
    await entrarSinCuenta(page);
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    expect(await page.evaluate(() => window.appAndroidVendeFrio)).toEqual({ esApp: false });
    expect(await page.evaluate(() => document.documentElement.classList.contains("enAppAndroid"))).toBe(false);
});
