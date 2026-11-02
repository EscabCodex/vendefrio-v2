// VendeFrío - El Asistente como un chat que crea cosas (tanda 2, pedido del
// dueño, 2026-11-02), con los emuladores de Firebase y una IA falsa (no
// gasta la clave).
// 1. Abierto desde la ficha de un comercio: no escucha solo, dice dónde
//    estás y trae preguntas para tocar. Claude recibe los pedidos de ese
//    comercio y arma un documento (la lista de ventas) que se ve como una
//    hoja de papel, lista para guardar en PDF.
// 2. «Creá una lista para mayoristas 10% más barata»: muestra qué va a
//    hacer, espera el «Sí» y crea la lista con su porcentaje.
// 3. «Creame una lista de precios tipo folleto para Almacén Don Pepe»: abre
//    el folleto para imprimir con los precios de su lista y para quién es.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora } = require("./recorridos");

test.use({ nube: true, claude: true });

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const { initializeApp, getApps } = require("firebase-admin/app");
const { crearManejador } = require("../api/entender.js");

const appAdmin = getApps().find(app => app.name === "pruebasAsistenteCrea") || initializeApp({ projectId: "demo-vendefrio" }, "pruebasAsistenteCrea");
const preguntas = [];
const vacio = { comercio: "", pantalla: "", lista: "", nombre: "", porcentaje: 0, productos: [] };
const sinDocumento = { titulo: "", intro: "", columnas: [], filas: [], pie: "" };
const manejador = crearManejador({
    obtenerApp: () => appAdmin,
    preguntar: async ({ mensaje }) => {
        preguntas.push(mensaje);
        const dijo = mensaje.split("Lo que dijo:\n").pop();
        if (/pdf/i.test(dijo)) {
            return {
                accion: "responder", comercio: "", pantalla: "", respuesta: "Te armé la lista de ventas de Almacén Don Pepe.", destacado: "", barras: [], pasos: [],
                documento: {
                    titulo: "Ventas de Almacén Don Pepe", intro: "Lo que te compró en los últimos 3 meses.",
                    columnas: ["Fecha", "Producto", "Cantidad"],
                    filas: [["01/11/2026", "Helado 1 kg", "4"], ["02/11/2026", "Palito de agua", "12"]],
                    pie: "Total: 16 unidades"
                }
            };
        }
        if (/folleto/i.test(dijo)) {
            return {
                accion: "responder", comercio: "", pantalla: "", respuesta: "Te armo el folleto.", destacado: "", barras: [],
                pasos: [{ ...vacio, accion: "folleto", comercio: "Almacén Don Pepe" }], documento: sinDocumento
            };
        }
        if (/lista/i.test(dijo)) {
            return {
                accion: "responder", comercio: "", pantalla: "", respuesta: "Creo la lista Mayoristas, 10% más barata.", destacado: "", barras: [],
                pasos: [{ ...vacio, accion: "crearLista", nombre: "Mayoristas", porcentaje: -10 }], documento: sinDocumento
            };
        }
        return { accion: "responder", comercio: "", pantalla: "", respuesta: "Listo.", destacado: "", barras: [], pasos: [], documento: sinDocumento };
    }
});

async function llamarFuncion({ cuerpo, credencial }) {
    let estado = 0;
    let datos = null;
    const respuesta = {
        setHeader() {},
        status(numero) { estado = numero; return this; },
        json(objeto) { datos = objeto; return this; }
    };
    await manejador({ method: "POST", headers: credencial ? { authorization: "Bearer " + credencial } : {}, body: cuerpo }, respuesta);
    return { estado, datos };
}

test.beforeEach(async ({ page }) => {
    await page.route("**/api/entender", async ruta => {
        const pedido = ruta.request();
        const credencial = String(pedido.headers().authorization || "").replace(/^Bearer /, "");
        const { estado, datos } = await llamarFuncion({ cuerpo: pedido.postDataJSON(), credencial });
        await ruta.fulfill({ status: estado, contentType: "application/json", body: JSON.stringify(datos) });
    });
});

test("asistente: chat por pantalla que arma un PDF y crea una lista de precios", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(() => {
        const preferencias = JSON.parse(localStorage.getItem("vendefrio_preferencias") || "{}");
        localStorage.setItem("vendefrio_preferencias", JSON.stringify({ ...preferencias, asistenteCalla: true }));
    });
    await expect.poll(() => page.evaluate(() => {
        agregarComercio({ nombre: "Almacén Don Pepe", direccion: "San Martín 123" });
        return obtenerComercios().some(comercio => comercio.nombre === "Almacén Don Pepe");
    }), { timeout: 15000 }).toBe(true);

    // 1. Desde la ficha del comercio: dice dónde estás y no escucha solo.
    await page.evaluate(() => { mostrarPantalla("comercios"); window.abrirFichaComercio("Almacén Don Pepe"); });
    await page.locator(".fichaComercioNueva").getByRole("button", { name: "Asistente" }).click();
    const ventana = page.getByRole("dialog", { name: "Asistente" });
    await expect(ventana.locator(".dondeAsistente")).toHaveText(/Estás en la ficha de Almacén Don Pepe/);
    await expect(ventana.locator(".burbujaApp").first()).toContainText("Preguntame lo que quieras de Almacén Don Pepe");
    await expect(ventana.getByRole("button", { name: "Nuevo pedido para Almacén Don Pepe" })).toBeVisible();
    await expect(ventana.locator(".botonHablarAsistente")).not.toHaveClass(/escuchando/);
    await expect(ventana.locator(".estadoAsistente")).toHaveText("");
    await capturar(page, "asistenteCrea-01-ficha");

    // Un PDF con las ventas: Claude recibe los pedidos de ese comercio.
    await ventana.getByRole("textbox", { name: "Hablale o escribile al Asistente" }).fill("haceme un pdf con las ventas para dárselo");
    await ventana.getByRole("button", { name: "Enviar" }).click();
    const tarjeta = ventana.locator(".documentoAsistente");
    await expect(tarjeta).toContainText("Ventas de Almacén Don Pepe");
    await expect(tarjeta).toContainText("2 renglones");
    expect(preguntas.at(-1)).toContain("## Pedidos de Almacén Don Pepe");
    // Las preguntas para tocar se van cuando empieza la charla.
    await expect(ventana.locator(".sugerencias")).toBeHidden();
    await capturar(page, "asistenteCrea-02-documento");
    await tarjeta.click();
    const hojaDoc = page.getByRole("dialog", { name: "Ventas de Almacén Don Pepe" });
    await expect(hojaDoc.locator(".documentoTabla")).toContainText("Palito de agua");
    await expect(hojaDoc.locator(".documentoPie")).toHaveText("Total: 16 unidades");
    await expect(hojaDoc.getByRole("button", { name: "Guardar en PDF o imprimir" })).toBeVisible();
    await capturar(page, "asistenteCrea-03-hoja-pdf");
    await page.keyboard.press("Escape");
    await page.evaluate(() => window.asistenteVendeFrio.cerrar());
    await page.locator(".fichaComercioNueva").getByRole("button", { name: "Cerrar" }).click();
    await expect(page.locator(".fichaComercioNueva")).toBeHidden();

    // 2. Crear una lista de precios: espera el «Sí».
    await page.evaluate(() => window.listasPreciosVendeFrio.abrirPantalla());
    await page.locator("#pantallaListasPrecios > .barraVolver").getByRole("button", { name: "Asistente" }).click();
    await expect(ventana.locator(".dondeAsistente")).toHaveText(/Estás en Listas de precios/);
    await ventana.getByRole("textbox", { name: "Hablale o escribile al Asistente" }).fill("creá una lista para mayoristas 10% más barata");
    await ventana.getByRole("button", { name: "Enviar" }).click();
    await expect(ventana.locator(".burbujaPlan")).toContainText("Crear la lista de precios «Mayoristas», 10% más barata que el general.");
    expect(await page.evaluate(() => window.listasDePrecios().includes("Mayoristas"))).toBe(false);
    await ventana.getByRole("button", { name: "Sí, hacelo" }).click();
    await expect.poll(() => page.evaluate(() => window.listasDePrecios().includes("Mayoristas"))).toBe(true);
    expect(await page.evaluate(() => window.listasPreciosVendeFrio.reglas().Mayoristas?.porcentaje)).toBe(-10);

    // 3. El folleto de precios para darle a un comercio, con su lista.
    await page.evaluate(() => {
        guardarProductos({ "Pastas Doña Rosa": [{ nombre: "Ravioles de ricota", precio: 3200 }, { nombre: "Ñoquis de papa", precio: 2500 }, { nombre: "Tapas de empanada", precio: 1800 }] });
        const comercio = obtenerComercios().find(otro => otro.nombre === "Almacén Don Pepe");
        comercio.listaPrecios = "Mayoristas";
        guardarComercios(obtenerComercios().map(otro => otro.nombre === comercio.nombre ? comercio : otro));
        window.listasPreciosVendeFrio.aplicarReglas?.(productosParaLeer());
        mostrarPantalla("comercios");
    });
    await page.locator("#pantallaComercios > .barraVolver").getByRole("button", { name: "Asistente" }).click();
    await ventana.getByRole("textbox", { name: "Hablale o escribile al Asistente" }).fill("creame una lista de precios tipo folleto para el Almacén Don Pepe, para imprimir");
    await ventana.getByRole("button", { name: "Enviar" }).click();
    const folleto = page.locator("#pantallaFolleto");
    await expect(folleto).toBeVisible();
    await expect(folleto.locator(".folletoTitulo")).toContainText("Lista de precios · Mayoristas");
    await expect(folleto.locator(".folletoTitulo")).toContainText("Para Almacén Don Pepe");
    await expect(folleto.locator(".folletoMarcas")).toContainText("Ravioles de ricota");
    await expect(folleto.getByRole("button", { name: "Imprimir o guardar en PDF" })).toBeVisible();
    expect(preguntas.at(-1)).toContain("## Catálogo con precios");
    await capturar(page, "asistenteCrea-04-folleto");
});
