// VendeFrío - Voz (Etapa 5, T43 y T44): comandos por voz desde Inicio y un
// pedido dictado o pegado de un mensaje. Desde T53 entiende frases
// dichas de forma natural, no solo la frase exacta. El reconocimiento de voz es falso:
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
    // Lo que entiende. La primera bajada de la nube puede pisar los
    // comercios recién agregados: se vuelven a agregar hasta que quedan.
    await expect.poll(() => page.evaluate(() => {
        agregarComercio({ nombre: "Kiosco La Esquina", direccion: "Belgrano 450", telefono: "11 4444-0000" });
        agregarComercio({ nombre: "Super Norte", direccion: "Mitre 900" });
        return [
            "Nuevo pedido para kiosco la esquina",
            "pedido de almacen don pepe",
            "ir a super norte",
            "próxima parada",
            "abrir pedidos",
            "Marcar visitado Super Norte",
            "cantame una canción",
            // Hablando normal (T53): no hace falta la frase exacta.
            "che, llevame a lo de Don Pepe",
            "dale, haceme un pedido para el kiosco de la esquina",
            "¿A dónde tengo que ir ahora?",
            "mostrame los clientes",
            "¿Cuánto vendí hoy?",
            "ya pasé por super norte",
            "ya llegué",
            "abrime la ficha de super norte",
            "nuevo pedido para Pirulo",
            "¿qué hora es?"
        ].map(frase => {
            const orden = vozVendeFrio.interpretar(frase);
            return orden ? orden.accion + (orden.comercio ? ":" + orden.comercio.nombre : "") + (orden.pantalla ? ":" + orden.pantalla : "") : "nada";
        });
    }), { timeout: 15000 }).toEqual([
        "nuevoPedido:Kiosco La Esquina",
        "nuevoPedido:Almacén Don Pepe",
        "ir:Super Norte",
        "proximaParada",
        "pantalla:pedido",
        "visitado:Super Norte",
        "nada",
        "ir:Almacén Don Pepe",
        "nuevoPedido:Kiosco La Esquina",
        "proximaParada",
        "pantalla:comercios",
        "pantalla:estadisticas",
        "visitado:Super Norte",
        "llegue",
        "ficha:Super Norte",
        "noEncontrado",
        "nada"
    ]);

    // El Asistente en Inicio (Etapa 8): algo que no entiende.
    const asistente = page.locator("#pantallaMenu header").getByRole("button", { name: "Asistente" });
    await expect(asistente).toBeVisible();
    await expect(page.getByRole("button", { name: "Comando por voz" })).toHaveCount(0);
    await page.evaluate(() => { window.__fraseVoz = "cantame una canción"; });
    await asistente.click();
    const ventana = page.getByRole("dialog", { name: "Asistente" });
    await expect(ventana.locator(".burbujaApp").last()).toContainText("No entendí");
    await capturar(page, "voz-01-te-escucho");

    // Hablando normal: "Haceme un pedido para el de la esquina".
    await page.evaluate(() => { window.__fraseVoz = "che, haceme un pedido para el de la esquina"; });
    await ventana.getByRole("button", { name: "Hablar" }).click();
    await expect(ventana).toBeHidden();
    await expect(page.locator("#pantallaPedido")).toBeVisible();
    await expect(page.locator("#cliente")).toHaveValue("Kiosco La Esquina");

    // Pedido pegado de un mensaje.
    await page.getByRole("button", { name: "Más opciones del pedido" }).click();
    await page.getByRole("button", { name: "Dictar o pegar pedido" }).click();
    const dictado = page.locator(".ventanaDictado");
    await dictado.getByLabel("Texto del pedido").fill("Hola! mandame 3 helados de un kilo y dos palitos bombón, una banana");
    await expect(dictado.locator(".productoDictado")).toHaveCount(2);
    await expect(dictado.locator(".productoDictado").nth(0)).toContainText("3 ×Helado 1 kg");
    await expect(dictado.locator(".productoDictado").nth(1)).toContainText("2 ×Palito bombón");
    await expect(dictado.locator(".sinEntenderDictado")).toContainText("banana");
    await capturar(page, "voz-02-pedido-pegado");

    // Un mensaje real de WhatsApp: «Ravioles» vale para lo que sigue, la «y»
    // de «pollo y verduras» es del nombre y los cambios no se suman.
    const mensaje = await page.evaluate(() => {
        agregarMarca("Donna Wheat");
        agregarMarca("Los Aromos");
        ["Ravioles de ricota", "Ravioles de pollo y verdura", "Ravioles cuatro quesos", "Ravioles de jamón y muzzarella"]
            .forEach(nombre => agregarProducto("Donna Wheat", { nombre, precio: 3000 }));
        ["Ñoquis", "Tubo de criolla"].forEach(nombre => agregarProducto("Los Aromos", { nombre, precio: 2000 }));
        const lectura = vozVendeFrio.leerPedido("Kiosco La Esquina\nRavioles 3 ricota,5 pollo y verduras, 4 cuatro queso, 4 jamón muzza y 4 ñoquis, 6 tubos los aromos\nTengo 2 cambio de ñoquis");
        return {
            comercio: lectura.comercio?.nombre,
            productos: lectura.productos.map(item => item.cantidad + " " + item.producto),
            sinEntender: lectura.sinEntender,
            cambios: lectura.cambios
        };
    });
    expect(mensaje).toEqual({
        comercio: "Kiosco La Esquina",
        productos: ["3 Ravioles de ricota", "5 Ravioles de pollo y verdura", "4 Ravioles cuatro quesos", "4 Ravioles de jamón y muzzarella", "4 Ñoquis", "6 Tubo de criolla"],
        sinEntender: [],
        cambios: ["2 cambio de noquis"]
    });

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
