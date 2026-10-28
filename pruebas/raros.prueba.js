// VendeFrío - Errores raros (repasada).
// 1. Tocar dos veces "Guardar pedido": un doble toque rápido guarda un solo
//    pedido (el segundo toque cae en la ventana "Pedido generado", que ya se
//    abrió). Si se cierra la ventana y se vuelve a tocar sin cambiar nada,
//    pregunta antes de cargar el mismo pedido otra vez. Si se tocó algo, no.
// 2. Con la letra grande del celular (la pantalla queda angosta): los nombres
//    de la barra de abajo no se pisan y los botones de Rutas no se cortan.
// 3. Las letras sobre el color principal se leen, también en modo oscuro.
// 4. Los días de Pedidos > Terminados dicen "Hoy" y "Ayer" a cualquier hora
//    (a la tarde lo de hoy salía con la fecha y lo de ayer decía "Hoy").
const { test, expect, capturar } = require("./ayudas");
const { entrarSinCuenta, cargarDatosGrandes } = require("./datosGrandes");
const { elegirComercio } = require("./recorridos");

async function cerrarPedidoGenerado(page) {
    const generado = page.locator("#modalPedido");
    if (await generado.isVisible()) await generado.click({ position: { x: 10, y: 10 } });
    await expect(generado).toBeHidden();
}

test("raros: el mismo pedido no se guarda dos veces sin querer", async ({ page }) => {
    await entrarSinCuenta(page);
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(() => {
        guardarProductos({ "Frío Sur": [{ nombre: "Helado 1 kg", precio: 4500 }, { nombre: "Palito bombón", precio: 800 }] });
        guardarComercios([{ nombre: "Kiosco Luna", direccion: "Calle 1 100", telefono: "", enlaceMaps: "", origenGps: "manual",
            lat: "", lng: "", pedidosRealizados: 0, ultimaVisita: "", pendienteSemana: false }]);
        guardarHistorial([]);
    });
    await page.reload();
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    const cuantos = () => page.evaluate(() => obtenerHistorial().length);

    await page.locator(".bottom-nav").getByRole("button", { name: "Nuevo pedido" }).click();
    await elegirComercio(page, "Kiosco Luna");
    const helado = page.locator(".listaProdutos .fila", { hasText: "Helado 1 kg" });
    if (!(await helado.isVisible())) await page.locator(".tituloMarca", { hasText: "Frío Sur" }).click();
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("1");

    // Doble toque rápido: un solo pedido.
    await page.locator("#generar").dblclick();
    await expect.poll(cuantos).toBe(1);
    await cerrarPedidoGenerado(page);
    expect(await cuantos()).toBe(1);

    // La ventana se cerró y se toca otra vez sin cambiar nada: pregunta.
    const pregunta = page.locator(".pzModal", { hasText: "¿Cargar otro pedido igual?" });
    await page.locator("#generar").click();
    await expect(pregunta).toBeVisible();
    await expect(pregunta).toContainText("Kiosco Luna");
    await capturar(page, "raros-01-pedido-repetido");
    await pregunta.getByRole("button", { name: "No, ya está" }).click();
    await expect(pregunta).toHaveCount(0);
    await expect(page.locator("#modalPedido")).toBeHidden();
    expect(await cuantos()).toBe(1);

    // Si de verdad es otro igual, se carga.
    await page.locator("#generar").click();
    await pregunta.getByRole("button", { name: "Cargar otro igual" }).click();
    await expect(page.locator("#modalPedido")).toBeVisible();
    expect(await cuantos()).toBe(2);
    await cerrarPedidoGenerado(page);

    // Si se tocó algo (aunque quede igual), es a propósito: no pregunta.
    await helado.getByRole("button", { name: "Aumentar cantidad" }).click();
    await helado.getByRole("button", { name: "Disminuir cantidad" }).click();
    await expect(page.locator("#totalUnidadesPedido")).toHaveText("1");
    await page.locator("#generar").click();
    await expect(page.locator("#modalPedido")).toBeVisible();
    await expect(pregunta).toHaveCount(0);
    expect(await cuantos()).toBe(3);
    await cerrarPedidoGenerado(page);

    // Con otro producto ya es otro pedido: no pregunta.
    await page.locator(".listaProdutos .fila", { hasText: "Palito bombón" }).getByRole("button", { name: "Aumentar cantidad" }).click();
    await page.locator("#generar").click();
    await expect(page.locator("#modalPedido")).toBeVisible();
    await expect(pregunta).toHaveCount(0);
    expect(await cuantos()).toBe(4);
});

// Cuánto se distingue la letra de su fondo (4,5 o más se lee bien).
function contraste(elemento) {
    const rgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luz = ([r, g, b]) => [r, g, b]
        .map(valor => { valor /= 255; return valor <= 0.03928 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4; })
        .reduce((total, valor, i) => total + valor * [0.2126, 0.7152, 0.0722][i], 0);
    const estilo = getComputedStyle(elemento);
    const letra = luz(rgb(estilo.color));
    const fondo = luz(rgb(estilo.backgroundColor));
    return (Math.max(letra, fondo) + 0.05) / (Math.min(letra, fondo) + 0.05);
}

async function abrirDesdeMas(page, acceso) {
    await page.locator(".bottom-nav").getByRole("button", { name: "Más" }).click();
    await page.locator("#masAccesos button").filter({ hasText: acceso }).first().click();
}

// Los pares de nombres de la barra de abajo que se tocan o se pisan.
function nombresPisados(page) {
    return page.locator(".bottom-nav .nav-item").evaluateAll(botones => {
        const cajas = botones.filter(boton => boton.getClientRects().length).map(boton => {
            const texto = [...boton.childNodes].find(nodo => nodo.nodeType === 3 && nodo.textContent.trim());
            if (!texto) return null;
            const rango = document.createRange();
            rango.selectNodeContents(texto);
            const caja = rango.getBoundingClientRect();
            return { nombre: texto.textContent.trim(), izquierda: caja.left, derecha: caja.right };
        }).filter(Boolean);
        const pares = [];
        for (let i = 1; i < cajas.length; i++) {
            if (cajas[i].izquierda < cajas[i - 1].derecha + 0.5) pares.push(cajas[i - 1].nombre + "/" + cajas[i].nombre);
        }
        return pares;
    });
}

test("raros: con letra grande la barra de abajo y Rutas se leen enteras", async ({ page }) => {
    // Un celular de 360 con la letra al 130 % muestra unos 280 px de ancho.
    await page.setViewportSize({ width: 280, height: 640 });
    await entrarSinCuenta(page);
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(cargarDatosGrandes);
    await page.reload();
    await expect(page.locator("#pantallaMenu")).toBeVisible();

    // Ningún nombre de la barra de abajo se monta sobre el de al lado (con la
    // letra al 130 % y al 112 %).
    expect(await nombresPisados(page)).toEqual([]);
    await page.setViewportSize({ width: 320, height: 640 });
    expect(await nombresPisados(page)).toEqual([]);
    await page.setViewportSize({ width: 280, height: 640 });

    // Rutas: Optimizar, Elegir, Guardadas y Google Maps se leen enteros.
    await abrirDesdeMas(page, "Rutas");
    const herramientas = page.locator(".herramientasRutas button");
    await expect(herramientas.first()).toBeVisible();
    const cortados = await herramientas.evaluateAll(botones => botones
        .filter(boton => boton.scrollWidth > boton.clientWidth + 1)
        .map(boton => boton.textContent.trim()));
    expect(cortados).toEqual([]);
    for (const boton of await herramientas.all()) await expect(boton).toBeInViewport();
    await capturar(page, "raros-02-letra-grande-rutas");
});

test("raros: las letras sobre el color principal se leen", async ({ page }) => {
    await entrarSinCuenta(page);
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    await page.evaluate(cargarDatosGrandes);
    await page.reload();
    await expect(page.locator("#pantallaMenu")).toBeVisible();

    // Estadísticas: las iniciales del primero de "Lo más pedido".
    await abrirDesdeMas(page, "Estadísticas");
    const primero = page.locator('.statsFilaRanking[data-puesto="1"] .statsAvatar').first();
    await expect(primero).toBeVisible();
    expect(await primero.evaluate(contraste)).toBeGreaterThanOrEqual(4.5);

    // Más > Apariencia: el "Ir" de la vista previa.
    await page.locator(".bottom-nav").getByRole("button", { name: "Más" }).click();
    await page.locator('.configFila[data-config-seccion="ajustes"]').click();
    await page.locator('.configFila[data-config-seccion="apariencia"]').click();
    const ir = page.locator("#configDetalle .ajVistaBoton").first();
    await expect(ir).toBeVisible();
    expect(await ir.evaluate(contraste)).toBeGreaterThanOrEqual(4.5);
});

test("raros: los días dicen Hoy y Ayer a cualquier hora", async ({ page }) => {
    await entrarSinCuenta(page);
    await expect(page.locator("#pantallaInicioSesion")).toBeHidden();
    const nombres = await page.evaluate(() => {
        const dia = (atras, hora, minutos) => {
            const fecha = new Date();
            fecha.setDate(fecha.getDate() - atras);
            fecha.setHours(hora, minutos, 0, 0);
            return nombreDelDiaDeFecha(fecha);
        };
        return [dia(0, 0, 5), dia(0, 23, 55), dia(1, 0, 5), dia(1, 15, 0), dia(1, 23, 55), dia(2, 12, 0)];
    });
    expect(nombres.slice(0, 2).every(nombre => nombre.startsWith("Hoy · "))).toBe(true);
    expect(nombres.slice(2, 5).every(nombre => nombre.startsWith("Ayer · "))).toBe(true);
    expect(nombres[5]).not.toMatch(/^(Hoy|Ayer)/);
});
