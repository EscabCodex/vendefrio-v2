// VendeFrío - Arreglar la lentitud de la nube, con los emuladores de Firebase.
// La app escucha en vivo solo los pedidos de los últimos 60 días; los más
// viejos se leen una vez al abrir. Estas pruebas cuidan que nada se pierda:
// 1. Un pedido viejo se ve, se cobra sin señal (el cobro se ve al instante y
//    cuenta en «Cobrado hoy»), sigue ahí al cerrar y abrir la app sin señal,
//    y sube al volver.
// 2. Lo que otro celular cambia llega: al instante en un pedido reciente y,
//    en uno viejo, al volver a abrir la app. Si la nube rechaza un cambio,
//    la pantalla vuelve a como estaba.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, cargarPedido, irAPedidos } = require("./recorridos");

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const appAdmin = getApps().find(app => app.name === "pruebas") || initializeApp({ projectId: "demo-vendefrio" }, "pruebas");
const nube = getFirestore(appAdmin);
const DIA = 86400000;

test.use({ nube: true });

async function irAInicio(page) {
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    await expect(page.locator("#pantallaMenu")).toBeVisible();
}

const sinSubir = page => page.evaluate(() => window.nubeVendeFrio?.sincronizacion?.().sinSubir ?? 0);

async function esperarTodoSubido(page) {
    await expect(async () => {
        expect(await sinSubir(page)).toBe(0);
        await page.waitForTimeout(1500);
        expect(await sinSubir(page)).toBe(0);
    }).toPass({ timeout: 30000 });
}

// Un pedido entregado y sin cobrar, cargado hace "dias" días (lo escribe
// "otro celular": la nube directamente, copiando uno de verdad).
async function crearPedidoDeOtroDia(refPedidos, modelo, id, dias) {
    const hora = Date.now() - dias * DIA;
    const estados = {};
    Object.entries(modelo.estados || {}).forEach(([clave, entrada]) => {
        estados[clave] = { ...entrada, horaCelular: hora };
    });
    await refPedidos.doc(id).set({
        ...modelo,
        estados,
        timestamp: hora,
        fecha: new Date(hora).toLocaleDateString("es-AR"),
        comercio: "Kiosco Viejo",
        _orden: -1000 - dias
    });
}

test("nube rápida: un pedido viejo se cobra sin señal y no se pierde", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await cargarPedido(page, false);
    const idDistribuidora = await page.evaluate(() => obtenerModoNubeGuardado().distribuidora);
    const idReciente = await page.evaluate(() => historialParaLeer()[0].id);
    await page.evaluate(id => window.nubeVendeFrio.entregarPedido(id), idReciente);
    await esperarTodoSubido(page);

    const refPedidos = nube.collection("distribuidoras").doc(idDistribuidora).collection("pedidos");
    const modelo = (await refPedidos.doc(idReciente).get()).data();
    expect(modelo.estado).toBe("entregado");
    await crearPedidoDeOtroDia(refPedidos, modelo, "ped_viejoPrueba", 200);

    // Al abrir la app se ve el pedido viejo, aunque no se escuche en vivo.
    await page.reload();
    await expect(page.locator("#dashNombreDistribuidora")).toHaveText("Distribuidora Prueba");
    await expect.poll(() => page.evaluate(() => Boolean(pedidoParaLeer("ped_viejoPrueba"))), { timeout: 30000 }).toBe(true);
    expect(await page.evaluate(() => window.nubeVendeFrio.pedidosEnVivo())).toBe(1);
    await expect.poll(() => page.evaluate(() => window.nubeVendeFrio.estado()), { timeout: 30000 }).toBe("conectada");

    // Sin señal (la app no llega a la nube): el cobro se ve al instante.
    await page.route(/127\.0\.0\.1:8080/, ruta => ruta.abort());
    await page.evaluate(() => window.firebase.firestore().disableNetwork());
    const alInstante = await page.evaluate(() => {
        window.nubeVendeFrio.registrarCobro("ped_viejoPrueba", { forma: "efectivo", monto: "9800" });
        const cobro = window.nubeVendeFrio.cobroDelPedido(pedidoParaLeer("ped_viejoPrueba"));
        return cobro && cobro.forma;
    });
    expect(alInstante).toBe("efectivo");
    await expect.poll(() => sinSubir(page)).toBe(1);

    // Se cierra la app con el cobro sin subir y se abre de nuevo, sin señal.
    await page.reload();
    await expect(page.locator("#dashNombreDistribuidora")).toHaveText("Distribuidora Prueba");
    await expect.poll(() => page.evaluate(() => {
        const pedido = pedidoParaLeer("ped_viejoPrueba");
        const cobro = pedido && window.nubeVendeFrio.cobroDelPedido(pedido);
        return cobro ? cobro.forma + " " + cobro.monto : "";
    }), { timeout: 30000 }).toBe("efectivo 9800");
    await irAInicio(page);
    await expect(page.locator("#avisoSinSubir")).toContainText("1 cambio sin subir", { timeout: 30000 });
    // El cobro de hoy (de un pedido viejo) cuenta en «Cobrado hoy».
    await expect(page.locator("#dashVendidoHoy")).toContainText("9.800");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "nubeRapida-01-cobro-viejo-sin-subir");
    expect((await refPedidos.doc("ped_viejoPrueba").get()).data().cobro).toBeFalsy();

    // Vuelve la señal: el cobro sube solo y queda en la nube.
    await page.unroute(/127\.0\.0\.1:8080/);
    await page.evaluate(() => window.nubeVendeFrio.reintentarSubida());
    await expect.poll(async () => {
        const cobro = (await refPedidos.doc("ped_viejoPrueba").get()).data().cobro;
        return cobro ? cobro.forma + " " + cobro.monto : "";
    }, { timeout: 30000 }).toBe("efectivo 9800");
    await esperarTodoSubido(page);
    await expect(page.locator("#avisoSinSubir")).toBeHidden();
});

test("nube rápida: los cambios de otro celular llegan", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await cargarPedido(page, false);
    const idDistribuidora = await page.evaluate(() => obtenerModoNubeGuardado().distribuidora);
    const idReciente = await page.evaluate(() => historialParaLeer()[0].id);
    await esperarTodoSubido(page);

    const refPedidos = nube.collection("distribuidoras").doc(idDistribuidora).collection("pedidos");
    const modelo = (await refPedidos.doc(idReciente).get()).data();
    await crearPedidoDeOtroDia(refPedidos, modelo, "ped_viejoOtro", 120);
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(pedidoParaLeer("ped_viejoOtro"))), { timeout: 30000 }).toBe(true);

    // Un pedido reciente que cambia otro celular se ve enseguida en la lista.
    await refPedidos.doc(idReciente).update({ comercio: "Almacén Cambiado" });
    await irAPedidos(page);
    await expect(page.locator(".tarjetaSeguimiento", { hasText: "Almacén Cambiado" }).first()).toBeVisible({ timeout: 15000 });
    await capturar(page, "nubeRapida-02-cambio-de-otro-celular");

    // Uno viejo, al volver a abrir la app.
    await refPedidos.doc("ped_viejoOtro").update({ observaciones: "Pagó la mitad" });
    await page.reload();
    await expect.poll(() => page.evaluate(() => (pedidoParaLeer("ped_viejoOtro") || {}).observaciones || ""), { timeout: 30000 })
        .toBe("Pagó la mitad");

    // Si la nube rechaza un cambio (de Cargado a Entregado sin la entrega),
    // lo que se vio al instante vuelve a como estaba.
    const estadoDe = () => page.evaluate(id => pedidoParaLeer(id).estado, idReciente);
    expect(await estadoDe()).toBe("cargado");
    expect(await page.evaluate(id => {
        window.nubeVendeFrio.agregarEstadoAlPedido(id, "entregado");
        return pedidoParaLeer(id).estado;
    }, idReciente)).toBe("entregado");
    await expect.poll(estadoDe, { timeout: 15000 }).toBe("cargado");
    await expect(page.getByText("La nube no guardó un cambio")).toBeVisible();
});
