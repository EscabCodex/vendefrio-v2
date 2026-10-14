// VendeFrío - Ayudas para las pruebas automáticas (W1)
//
// - Corta los pedidos a internet (Leaflet, mapas): la prueba no depende de
//   la señal y la app tiene que andar igual.
// - En las pruebas de la nube, la app usa los emuladores de Firebase en vez
//   de la nube real: se cambia solo la copia de firebase-config.js que
//   recibe el navegador de prueba. El archivo del repo no se toca.
// - Cualquier error de JavaScript en la página hace fallar la prueba.
// - capturar() guarda una foto de la pantalla en la carpeta "capturas".
const fs = require("fs");
const path = require("path");
const base = require("@playwright/test");

const RAIZ = path.resolve(__dirname, "..");
const CARPETA_CAPTURAS = path.join(RAIZ, "capturas");
const PROYECTO_EMULADORES = "demo-vendefrio";

function configuracionConEmuladores() {
    const original = fs.readFileSync(path.join(RAIZ, "firebase-config.js"), "utf8");
    const despuesDeIniciar = /window\.firebase\.initializeApp\(configuracionFirebase\);\s*\}/;
    if (!despuesDeIniciar.test(original) || !original.includes('projectId: "vendefrio"')) {
        throw new Error("Cambió firebase-config.js: hay que actualizar pruebas/ayudas.js para conectar los emuladores.");
    }
    return original
        .replace('projectId: "vendefrio"', `projectId: "${PROYECTO_EMULADORES}"`)
        .replace(despuesDeIniciar, texto => texto + `
        // Agregado solo en las pruebas: usar los emuladores de Firebase.
        window.firebase.auth().useEmulator("http://127.0.0.1:9099", { disableWarnings: true });
        window.firebase.firestore().useEmulator("127.0.0.1", 8080);`);
}

const test = base.test.extend({
    // Las pruebas que usan la nube ponen { nube: true } con test.use().
    nube: [false, { option: true }],

    page: async ({ page, nube }, use, testInfo) => {
        const errores = [];
        page.on("pageerror", error => errores.push(error.message));

        await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, ruta => {
            const tipo = ruta.request().resourceType() === "stylesheet" ? "text/css" : "text/javascript";
            return ruta.fulfill({ status: 200, contentType: tipo, body: "" });
        });

        if (nube) {
            const configuracion = configuracionConEmuladores();
            await page.route("**/firebase-config.js", ruta =>
                ruta.fulfill({ status: 200, contentType: "text/javascript", body: configuracion })
            );

            // El recordatorio "Descargá un respaldo" aparece cuando quiere
            // (una vez por día al dueño): si tapa la pantalla, "Ahora no".
            const recordatorio = page.locator("#modalRecordatorioRespaldo:not(.oculto)");
            await page.addLocatorHandler(recordatorio, async () => {
                await recordatorio.getByRole("button", { name: "Ahora no" }).click();
            });
        }

        await use(page);

        base.expect(errores, "La página tuvo errores de JavaScript").toEqual([]);
    }
});

// Guarda la pantalla como capturas/<nombre>-<claro|oscuro>.jpg.
async function capturar(page, nombre) {
    const tema = test.info().project.name;
    fs.mkdirSync(CARPETA_CAPTURAS, { recursive: true });
    // Espera a que se vayan los avisos cortos (toasts), que tapan botones,
    // y a que terminen las animaciones de las ventanas.
    await base.expect(page.locator("#contenedorToasts .toast")).toHaveCount(0, { timeout: 5000 });
    await page.waitForTimeout(400);
    await page.screenshot({
        path: path.join(CARPETA_CAPTURAS, `${nombre}-${tema}.jpg`),
        type: "jpeg",
        quality: 70,
        animations: "disabled",
        caret: "hide"
    });
}

// Arrastra el botón deslizable ("Deslizá para marcar ...") hasta el final,
// como lo hace el dedo.
async function deslizar(page, texto) {
    const tirador = page.getByRole("button", { name: new RegExp(texto) });
    await tirador.scrollIntoViewIfNeeded();
    const pista = tirador.locator("xpath=..");
    const caja = await pista.boundingBox();
    const boton = await tirador.boundingBox();
    const y = boton.y + boton.height / 2;
    await page.mouse.move(boton.x + boton.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(caja.x + caja.width / 2, y, { steps: 5 });
    await page.mouse.move(caja.x + caja.width - 2, y, { steps: 5 });
    await page.mouse.up();
}

module.exports = { test, expect: base.expect, capturar, deslizar, CARPETA_CAPTURAS };
