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
                removeAllDeliveredNotifications: () => anotar("limpiar", true),
                getDeliveredNotifications: () => Promise.resolve({ notifications: [] })
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
    // En segundo plano, sí: una por aviso y una que los agrupa.
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
    expect(lista).toHaveLength(3);
    expect(lista[0]).toMatchObject({ title: "Pedido nuevo · Don Pepe", body: "Por Maxi: 12 productos", actionTypeId: "pedido", channelId: "avisos" });
    expect(lista[1].actionTypeId).toBe("cobro");
    expect(lista[2]).toMatchObject({ title: "2 avisos nuevos", groupSummary: true });
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
});

test("app de Android: en Chrome no hace nada", async ({ page }) => {
    await entrarSinCuenta(page);
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    expect(await page.evaluate(() => window.appAndroidVendeFrio)).toEqual({ esApp: false });
    expect(await page.evaluate(() => document.documentElement.classList.contains("enAppAndroid"))).toBe(false);
});
