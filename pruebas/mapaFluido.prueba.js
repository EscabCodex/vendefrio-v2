// VendeFrío - El mapa no espera a guardar los cuadraditos (repaso de Rutas).
// Al mover o agrandar el mapa en un celular barato, cada cuadradito nuevo
// esperaba a que se guardara y a que se contaran los 600 guardados antes de
// verse. Ahora sw.js lo devuelve apenas llega y lo guarda después.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function cargarServiceWorker() {
    const oyentes = {};
    const guardados = new Map();
    const celular = { escrituras: 0, cuentas: 0, soltarEscritura: null };
    const cache = {
        match: async request => guardados.get(request.url),
        put: (request, respuesta) => new Promise(resolver => {
            celular.escrituras += 1;
            // La escritura en el celular tarda: queda colgada hasta soltarla.
            celular.soltarEscritura = () => {
                guardados.set(request.url, respuesta);
                resolver();
            };
        }),
        keys: async () => {
            celular.cuentas += 1;
            return [...guardados.keys()].map(url => ({ url }));
        },
        delete: async clave => guardados.delete(clave.url)
    };
    const self = {
        location: new URL("https://vendefrio.test/"),
        navigator: { userAgent: "Android" },
        registration: { scope: "https://vendefrio.test/" },
        clients: { matchAll: async () => [], claim() {} },
        addEventListener: (tipo, oyente) => {
            oyentes[tipo] = oyente;
        },
        skipWaiting() {}
    };
    const respuestaFalsa = () => ({ ok: true, clone() { return respuestaFalsa(); } });
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8"), {
        self, URL, URLSearchParams, console,
        caches: { open: async () => cache, keys: async () => [], delete: async () => true, match: async () => undefined },
        fetch: async () => respuestaFalsa()
    });
    celular.pedir = url => {
        let respuesta = null;
        const esperas = [];
        oyentes.fetch({
            request: { url, method: "GET" },
            respondWith: promesa => { respuesta = promesa; },
            waitUntil: promesa => esperas.push(promesa)
        });
        return { respuesta, esperas };
    };
    return { celular, guardados };
}

test("mapa fluido: el cuadradito se ve sin esperar a que se guarde", async () => {
    const { celular, guardados } = cargarServiceWorker();
    const url = "https://tile.openstreetmap.org/15/11063/19740.png";
    const { respuesta, esperas } = celular.pedir(url);
    // Llega aunque la escritura siga colgada.
    const llegada = await Promise.race([respuesta.then(() => "llegó"), new Promise(r => setTimeout(() => r("esperando"), 300))]);
    expect(llegada).toBe("llegó");
    expect((await respuesta).ok).toBe(true);
    // Se guarda después, sin hacer esperar al mapa.
    await expect.poll(() => celular.escrituras).toBe(1);
    celular.soltarEscritura();
    await Promise.all(esperas);
    expect(guardados.has(url)).toBe(true);
    // No cuenta los guardados con cada cuadradito.
    expect(celular.cuentas).toBe(0);

    // La segunda vez sale de lo guardado, sin ir a internet ni escribir.
    const otra = celular.pedir(url);
    expect((await otra.respuesta).ok).toBe(true);
    expect(celular.escrituras).toBe(1);

    // Cada tanto recorta la cache (no con cada cuadradito).
    for (let i = 0; i < 45; i++) {
        const pedido = celular.pedir("https://tile.openstreetmap.org/15/1/" + i + ".png");
        await pedido.respuesta;
        await expect.poll(() => celular.escrituras).toBe(i + 2);
        celular.soltarEscritura();
        await Promise.all(pedido.esperas);
    }
    expect(celular.cuentas).toBe(1);
});
