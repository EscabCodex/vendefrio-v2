// Temporal: mide abrir Estadísticas en la nube con muchos datos.
const fs = require("fs");
const { test, expect } = require("./ayudas");
const { registrarDistribuidora, cargarPedido } = require("./recorridos");

test.use({ nube: true, viewport: { width: 360, height: 640 }, trace: "off" });

test("medir estadisticas", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "claro");
    test.setTimeout(300000);
    await registrarDistribuidora(page, testInfo);
    await cargarPedido(page, false);
    await page.evaluate(cuantos => {
        const base = obtenerHistorial()[0];
        const comercios = obtenerComercios();
        for (let i = 0; i < 80; i++) comercios.push({ nombre: "Comercio " + i, direccion: "Calle " + i, telefono: "", lat: -34.6 + i * 0.001, lng: -58.4 });
        guardarComercios(comercios);
        const lista = [];
        const ahora = Date.now();
        for (let i = 0; i < cuantos; i++) {
            const hora = ahora - i * 2.4 * 3600000;
            const p = JSON.parse(JSON.stringify(base));
            p.id = "ped_m" + i;
            p.comercio = "Comercio " + (i % 80);
            p.timestamp = hora;
            p.fecha = new Date(hora).toLocaleDateString("es-AR");
            p.estado = "entregado";
            const e0 = Object.values(base.estados)[0];
            p.estados = {};
            ["pendiente", "armado", "cargado", "enReparto", "entregado"].forEach((estado, k) => { p.estados["est_" + k + "_" + i] = { ...e0, estado, horaCelular: hora + k * 60000, nota: "" }; });
            p.productos = Array.from({ length: 12 }, (_, k) => ({ ...base.productos[k % base.productos.length], id: "lin_" + i + "_" + k, cantidad: 1 + (i + k) % 6 }));
            p.entrega = { cambios: {}, persona: e0.persona, horaCelular: hora + 240000 };
            p.cobro = { forma: "efectivo", monto: 10000, persona: e0.persona, horaCelular: hora + 250000 };
            lista.push(p);
        }
        guardarHistorial(lista.concat(obtenerHistorial()));
    }, Number(process.env.PEDIDOS_MEDIR || 600));
    await page.evaluate(() => firebase.firestore().waitForPendingWrites());
    await page.reload();
    await expect(page.locator("#pantallaMenu")).toBeVisible({ timeout: 60000 });
    await page.waitForTimeout(15000);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    await page.waitForTimeout(3000);
    const medir = () => page.evaluate(async () => {
        const inicio = performance.now();
        document.querySelector('[data-dashboard-accion="vendidoSemana"]').click();
        await new Promise(listo => requestAnimationFrame(() => setTimeout(listo, 0)));
        return Math.round(performance.now() - inicio);
    });
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
    await cdp.send("Profiler.start");
    const t1 = await medir();
    const { profile } = await cdp.send("Profiler.stop");
    fs.writeFileSync((process.env.SALIDA_MEDIR || "/tmp/medir.txt") + ".t1", String(t1));
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    await page.waitForTimeout(1000);
    const t2 = await medir();
    // Self time por función.
    const porNodo = new Map(profile.nodes.map(n => [n.id, n]));
    const propio = new Map();
    const dt = profile.timeDeltas;
    profile.samples.forEach((id, i) => {
        const n = porNodo.get(id);
        const clave = n.callFrame.functionName + " " + n.callFrame.url.split("/").pop() + ":" + n.callFrame.lineNumber;
        propio.set(clave, (propio.get(clave) || 0) + (dt[i] || 0) / 1000);
    });
    // Total (inclusive) por función.
    const padres = new Map();
    profile.nodes.forEach(n => (n.children || []).forEach(c => padres.set(c, n.id)));
    const total = new Map();
    profile.samples.forEach((id, i) => {
        const vistos = new Set();
        let actual = id;
        while (actual) {
            const n = porNodo.get(actual);
            const clave = n.callFrame.functionName + " " + n.callFrame.url.split("/").pop() + ":" + n.callFrame.lineNumber;
            if (!vistos.has(clave)) { total.set(clave, (total.get(clave) || 0) + (dt[i] || 0) / 1000); vistos.add(clave); }
            actual = padres.get(actual);
        }
    });
    const top = m => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => Math.round(v) + "ms " + k).join("\n");
    fs.writeFileSync(process.env.SALIDA_MEDIR || "/tmp/medir.txt", `primera ${t1} ms, segunda ${t2} ms\n\nPROPIO\n${top(propio)}\n\nTOTAL\n${top(total)}\n`);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
});
