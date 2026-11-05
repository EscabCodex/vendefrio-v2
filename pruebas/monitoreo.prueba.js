// VendeFrío - Medir la fluidez y avisar errores (monitoreo.js, 2026-11-05).
// 1. En la compu y en las pruebas no se carga nada de afuera (ni Sentry ni
//    Vercel), así no se mezclan datos de prueba con los reales.
// 2. Los textos que salen del celular no llevan mails, teléfonos ni montos.
// 3. monitoreo.js viaja con la app (sw.js).
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { test, expect } = require("./ayudas");

const RAIZ = path.resolve(__dirname, "..");
const CODIGO = fs.readFileSync(path.join(RAIZ, "monitoreo.js"), "utf8");

// Corre monitoreo.js como si estuviera en Vercel, sin navegador.
function cargarComoEnVercel(hostname) {
    const ventana = {
        addEventListener() {}, removeEventListener() {},
        requestIdleCallback() {}
    };
    const contexto = {
        window: ventana, location: { hostname, origin: "https://" + hostname },
        document: { readyState: "loading", createElement() { return {}; }, head: { appendChild() {} } },
        localStorage: { getItem: () => null }, navigator: { userAgent: "prueba" },
        setTimeout() {}, console
    };
    vm.runInNewContext(CODIGO, contexto);
    return ventana.monitoreoVendeFrio;
}

test("monitoreo: en la compu no pide nada a Sentry ni a Vercel", async ({ page }) => {
    const pedidos = [];
    page.on("request", pedido => {
        if (/sentry|_vercel/.test(pedido.url())) pedidos.push(pedido.url());
    });
    await page.goto("/");
    await page.waitForTimeout(5000);
    expect(pedidos).toEqual([]);
    expect(await page.evaluate(() => window.monitoreoVendeFrio)).toBeUndefined();
});

test("monitoreo: limpia los datos de clientes y sabe en qué app está", async () => {
    const real = cargarComoEnVercel("vendefrio-v2.vercel.app");
    expect(real.entorno).toBe("produccion");
    expect(cargarComoEnVercel("vendefrio-v2-git-desarrollo-escab-codex.vercel.app").entorno).toBe("desarrollo");

    const sucio = 'No se guardó "Almacén Don Pepe" de pepe@gmail.com, tel 11 4567-8901, debe $ 12.500 en «Kiosco Sol»';
    const limpio = real.limpiar(sucio);
    expect(limpio).not.toContain("Pepe");
    expect(limpio).not.toContain("gmail");
    expect(limpio).not.toContain("4567");
    expect(limpio).not.toContain("12.500");
    expect(limpio).not.toContain("Sol");
    expect(limpio).toContain("No se guardó");
    // Los errores comunes de JavaScript se siguen entendiendo.
    expect(real.limpiar("Cannot read properties of undefined (reading 'nombre')")).toBe("Cannot read properties of undefined (reading 'nombre')");
});

test("monitoreo: viaja con la app", async () => {
    const sw = fs.readFileSync(path.join(RAIZ, "sw.js"), "utf8");
    const index = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
    expect(sw).toContain('"./monitoreo.js"');
    expect(index).toContain('<script src="monitoreo.js" defer></script>');
});
