// VendeFrío - Voz (Etapa 5, T43 y T44): comandos por voz desde Inicio y un
// pedido dictado o pegado de un mensaje. El reconocimiento de voz es falso:
// "escucha" la frase que le deja la prueba.
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora } = require("./recorridos");

test.use({ nube: true });

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        window.__fraseVoz = "";
        class ReconocimientoFalso {
            start() {
                setTimeout(() => {
                    const frase = window.__fraseVoz;
                    const resultado = [{ transcript: frase }];
                    resultado.isFinal = true;
                    this.onresult?.({ resultIndex: 0, results: [resultado] });
                    this.onend?.();
                }, 150);
            }
            stop() {}
        }
        window.SpeechRecognition = ReconocimientoFalso;
        window.webkitSpeechRecognition = ReconocimientoFalso;
    });
});

test("voz: comandos desde Inicio y pedido dictado o pegado", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);
    await page.evaluate(() => {
        agregarComercio({ nombre: "Kiosco La Esquina", direccion: "Belgrano 450", telefono: "11 4444-0000" });
        agregarComercio({ nombre: "Super Norte", direccion: "Mitre 900" });
    });

    // Lo que entiende.
    const ordenes = await page.evaluate(() => [
        "Nuevo pedido para kiosco la esquina",
        "pedido de almacen don pepe",
        "ir a super norte",
        "próxima parada",
        "abrir pedidos",
        "Marcar visitado Super Norte",
        "cantame una canción"
    ].map(frase => {
        const orden = vozVendeFrio.interpretar(frase);
        return orden ? orden.accion + (orden.comercio ? ":" + orden.comercio.nombre : "") + (orden.pantalla ? ":" + orden.pantalla : "") : "nada";
    }));
    expect(ordenes).toEqual([
        "nuevoPedido:Kiosco La Esquina",
        "nuevoPedido:Almacén Don Pepe",
        "ir:Super Norte",
        "proximaParada",
        "pantalla:pedido",
        "visitado:Super Norte",
        "nada"
    ]);

    // Micrófono en Inicio: algo que no entiende.
    const microfono = page.getByRole("button", { name: "Comando por voz" });
    await expect(microfono).toBeVisible();
    await page.evaluate(() => { window.__fraseVoz = "cantame una canción"; });
    await microfono.click();
    const ventana = page.locator(".ventanaVoz");
    await expect(ventana.locator(".textoVoz")).toContainText("No entendí");
    await capturar(page, "voz-01-te-escucho");

    // "Nuevo pedido para Kiosco La Esquina".
    await page.evaluate(() => { window.__fraseVoz = "nuevo pedido para kiosco la esquina"; });
    await ventana.getByRole("button", { name: "Escuchar de nuevo" }).click();
    await expect(ventana).toBeHidden();
    await expect(page.locator("#pantallaPedido")).toBeVisible();
    await expect(page.locator("#cliente")).toHaveValue("Kiosco La Esquina");

    // Pedido pegado de un mensaje.
    await page.getByRole("button", { name: "Dictar o pegar pedido" }).click();
    const dictado = page.locator(".ventanaDictado");
    await dictado.getByLabel("Texto del pedido").fill("Hola! mandame 3 helados de un kilo y dos palitos bombón, una banana");
    await expect(dictado.locator(".productoDictado")).toHaveCount(2);
    await expect(dictado.locator(".productoDictado").nth(0)).toContainText("3 ×Helado 1 kg");
    await expect(dictado.locator(".productoDictado").nth(1)).toContainText("2 ×Palito bombón");
    await expect(dictado.locator(".sinEntenderDictado")).toContainText("banana");
    await capturar(page, "voz-02-pedido-pegado");

    // Dictado: suma lo que se dice.
    await page.evaluate(() => { window.__fraseVoz = "un helado de un kilo más"; });
    await dictado.getByRole("button", { name: "Dictar" }).click();
    await expect(dictado.locator(".productoDictado").nth(0)).toContainText("4 ×Helado 1 kg");

    await dictado.getByRole("button", { name: "Agregar al pedido" }).click();
    await expect(dictado).toBeHidden();
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("6");
    await expect(page.locator("#totalPlataPedido")).toHaveText("$ 19.600");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "voz-03-pedido-armado");
});
