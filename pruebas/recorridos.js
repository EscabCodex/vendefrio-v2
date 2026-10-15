// VendeFrío - Pasos que comparten las pruebas de la nube: registrar una
// distribuidora, cargar un pedido, abrir Configuración e ir a Pedidos.
const { expect, capturar, prepararPagina } = require("./ayudas");

// Cuenta y distribuidora nuevas (en el emulador), con un comercio y dos
// productos con precio, guardados con las mismas funciones que usa la app.
async function registrarDistribuidora(page, testInfo) {
    await page.goto("/");

    await page.getByRole("button", { name: /Distribuidora/ }).click();
    await page.getByRole("button", { name: /Registrarse/ }).click();
    await page.locator("#inicioRegistroNombre").fill("Distribuidora Prueba");
    await page.locator("#inicioRegistroEmail").fill(`dueno-${testInfo.project.name}-${Date.now()}@prueba.com`);
    await page.locator("#inicioRegistroContrasena").fill("clave-de-prueba");
    await page.locator("#inicioRegistroRepetir").fill("clave-de-prueba");
    await page.getByRole("button", { name: "Crear cuenta y distribuidora" }).click();

    // "Tu nombre" (se pide una sola vez al dueño).
    await expect(page.locator("#inicioNombreDueno")).toBeVisible({ timeout: 20000 });
    await page.locator("#inicioNombreDueno").fill("Jere");
    await page.locator("#inicioFormDatosDueno").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await expect(page.locator("#dashNombreDistribuidora")).toHaveText("Distribuidora Prueba");

    const guardado = await page.evaluate(() =>
        agregarComercio({ nombre: "Almacén Don Pepe", direccion: "San Martín 123", telefono: "11 5555-1234" }) &&
        agregarMarca("Frío Sur") &&
        agregarProducto("Frío Sur", { nombre: "Helado 1 kg", precio: 4500 }) &&
        agregarProducto("Frío Sur", { nombre: "Palito bombón", precio: 800 })
    );
    expect(guardado).toBeTruthy();
}

// Carga un pedido de 2 helados y 1 palito (sin captura si no se pide).
async function cargarPedido(page, conCaptura, comercio = "Almacén Don Pepe") {
    await irAPedidos(page);
    await page.getByRole("button", { name: "Nuevo pedido" }).click();
    await page.locator("#cliente").fill(comercio);
    await page.locator(".tituloMarca", { hasText: "Frío Sur" }).click();
    const helado = page.locator(".listaProdutos .fila", { hasText: "Helado 1 kg" });
    const palito = page.locator(".listaProdutos .fila", { hasText: "Palito bombón" });
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    await palito.getByRole("button", { name: "Aumentar cantidad" }).click();
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("3");
    if (conCaptura) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await capturar(page, "nube-02-nuevo-pedido");
    }

    await page.locator("#generar").click();
    const generado = page.locator("#modalPedido");
    await expect(generado).toBeVisible();
    await generado.click({ position: { x: 10, y: 10 } });
    await expect(generado).toBeHidden();
}

// Abre "Más" desde el avatar de Inicio (estilo nuevo, T31).
async function abrirMas(page) {
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    await page.locator("#pantallaMenu header").getByRole("button", { name: "Más", exact: true }).click();
    await expect(page.locator("#pantallaConfiguracion")).toBeVisible();
}

// Abre una sección de la configuración, que está en "Más".
async function abrirConfiguracionEn(page, seccion) {
    await abrirMas(page);
    await page.locator(`.configFila[data-config-seccion="${seccion}"]`).click();
}

async function irAPedidos(page) {
    await page.locator(".bottom-nav").getByRole("button", { name: "Pedidos" }).click();
    await expect(page.locator("#vistaPedidos")).toBeVisible();
}

// Segundo celular: un empleado entra con un código nuevo del dueño, sin
// roles (con { impresora: true }, con la impresora falsa). Devuelve la página, su contexto (para cerrarlo) y sus errores.
async function entrarComoEmpleado(page, browser, testInfo, nombre = "Maxi", opciones = {}) {
    await abrirConfiguracionEn(page, "empleados");
    await page.getByRole("button", { name: "Generar código para un empleado nuevo" }).click();
    const codigo = (await page.locator("#empleadoCodigoGenerado strong").textContent()).trim();

    const contexto = await browser.newContext({
        ...testInfo.project.use,
        baseURL: testInfo.project.use.baseURL,
        serviceWorkers: "block"
    });
    const empleado = await contexto.newPage();
    const errores = await prepararPagina(empleado, true);
    if (opciones.impresora) await usarImpresoraFalsa(empleado);
    await empleado.goto("/");
    await empleado.getByRole("button", { name: /Empleado/ }).click();
    await empleado.locator("#inicioCodigo").fill(codigo);
    await empleado.locator("#inicioFormEmpleado").getByRole("button", { name: "Entrar" }).click();
    await expect(empleado.locator("#inicioNombreEmpleado")).toBeVisible({ timeout: 20000 });
    await empleado.locator("#inicioNombreEmpleado").fill(nombre);
    await empleado.locator("#inicioFormDatosEmpleado").getByRole("button", { name: "Guardar y entrar" }).click();
    await expect(empleado.locator("#pantallaInicioSesion")).toBeHidden();

    return { empleado, contexto, errores };
}

// Impresora Bluetooth falsa (Android con Chrome): todo lo que se le manda
// queda en window.__bytesImpresos. Va antes de abrir la app.
async function usarImpresoraFalsa(page) {
    await page.addInitScript(() => {
        window.__bytesImpresos = [];
        const caracteristica = {
            properties: { write: true, writeWithoutResponse: false },
            writeValueWithResponse: async trozo => {
                window.__bytesImpresos.push(...trozo);
            }
        };
        const servicio = { getCharacteristics: async () => [caracteristica] };
        const dispositivo = {
            id: "impresora-de-prueba",
            name: "MTP-3 de prueba",
            addEventListener() {},
            gatt: {
                connected: false,
                async connect() {
                    this.connected = true;
                    return { getPrimaryService: async () => servicio };
                },
                disconnect() {
                    this.connected = false;
                }
            }
        };
        Object.defineProperty(navigator, "bluetooth", {
            configurable: true,
            value: { requestDevice: async () => dispositivo, getDevices: async () => [dispositivo] }
        });
    });
}

// Lo que salió por la impresora falsa, como texto (sin los comandos).
async function textoImpreso(page) {
    const bytes = await page.evaluate(() => window.__bytesImpresos.slice());
    return textoDeBytes(bytes);
}

function textoDeBytes(bytes) {
    let texto = "";
    for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i];
        // Comandos ESC/POS: ESC @ (iniciar), ESC y GS con dos bytes más, y
        // FS con uno.
        if (byte === 0x1b && bytes[i + 1] === 0x40) { i += 1; continue; }
        if (byte === 0x1b || byte === 0x1d) { i += 2; continue; }
        if (byte === 0x1c) { i += 1; continue; }
        texto += byte === 0x0a ? "\n" : byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : "?";
    }
    return texto;
}

module.exports = {
    registrarDistribuidora,
    cargarPedido,
    abrirMas,
    abrirConfiguracionEn,
    irAPedidos,
    entrarComoEmpleado,
    usarImpresoraFalsa,
    textoImpreso,
    textoDeBytes
};
