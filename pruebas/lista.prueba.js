// VendeFrío - Lista para la 1.0 (Etapa 6): primeros pasos de una cuenta
// nueva, "Suelen pedir hoy", la planilla para el contador y "Qué hay de
// nuevo" con la versión.
const fs = require("fs");
const { test, expect, capturar } = require("./ayudas");
const { registrarDistribuidora, cargarPedido, abrirConfiguracionEn } = require("./recorridos");

test.use({ nube: true });

test("1.0: primeros pasos, suelen pedir hoy, planilla y novedades", async ({ page }, testInfo) => {
    await registrarDistribuidora(page, testInfo);

    // Primeros pasos: productos y comercio ya están, falta el primer pedido.
    const pasos = page.locator("#dashPrimerosPasos");
    await expect(pasos).toBeVisible();
    await expect(pasos).toContainText("2 de 3 listos");
    await expect(pasos.locator(".pasoPrimeros.hecho")).toHaveCount(2);
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, "lista-01-primeros-pasos");

    await cargarPedido(page, false);
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    await expect(pasos).toBeHidden();

    // "Suelen pedir hoy": pidió los mismos días de la semana, hace 1 y 2
    // semanas, y hoy todavía no. Arranca apagada (T156): se prende en
    // Más > Apariencia > Qué se ve en Inicio.
    await abrirConfiguracionEn(page, "apariencia");
    await page.getByRole("switch", { name: "Suelen pedir los…" }).check();
    await page.locator(".bottom-nav").getByRole("button", { name: "Inicio" }).click();
    await page.evaluate(() => {
        agregarComercio({ nombre: "Kiosco Luna", direccion: "Sarmiento 20" });
        agregarComercio({ nombre: "Super Norte", direccion: "Mitre 900" });
    });
    await expect.poll(() => page.evaluate(() => obtenerComercios().length)).toBe(3);
    await page.waitForTimeout(500);
    const sugeridos = await page.evaluate(() => {
        const hace = semanas => { const fecha = new Date(); fecha.setDate(fecha.getDate() - 7 * semanas); fecha.setHours(10, 0, 0, 0); return fecha.getTime(); };
        const pedidos = [
            { comercio: "Kiosco Luna", timestamp: hace(1), productos: [] },
            { comercio: "Kiosco Luna", timestamp: hace(2), productos: [] },
            { comercio: "Super Norte", timestamp: hace(1), productos: [] },
            { comercio: "Almacén Don Pepe", timestamp: hace(1), productos: [] },
            { comercio: "Almacén Don Pepe", timestamp: hace(3), productos: [] },
            { comercio: "Almacén Don Pepe", timestamp: Date.now(), productos: [] }
        ];
        const hoy = pedidos.filter(pedido => new Date(pedido.timestamp).toDateString() === new Date().toDateString());
        dibujarVisitarHoy(obtenerComercios(), pedidos, hoy);
        return comerciosQueSuelenPedirHoy(pedidos, hoy).map(item => item.clave + ":" + item.veces);
    });
    expect(sugeridos).toEqual(["kiosco luna:2"]);
    const visitarHoy = page.locator("#dashVisitarHoy");
    await expect(visitarHoy).toBeVisible();
    await expect(visitarHoy).toContainText("Kiosco Luna");
    await expect(visitarHoy).toContainText("Pidió 2 de los últimos 8");
    await visitarHoy.scrollIntoViewIfNeeded();
    await capturar(page, "lista-02-suelen-pedir-hoy");
    await visitarHoy.getByRole("button", { name: "Cargar pedido para Kiosco Luna" }).click();
    await expect(page.locator("#cliente")).toHaveValue("Kiosco Luna");

    // Planilla del período desde Estadísticas.
    await page.evaluate(() => window.abrirEstadisticas());
    const [descarga] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "Descargar planilla del período" }).click()
    ]);
    expect(descarga.suggestedFilename()).toMatch(/^VendeFrio pedidos todos .*\.csv$/);
    const texto = fs.readFileSync(await descarga.path(), "utf8");
    const lineas = texto.replace(/^﻿/, "").trim().split("\r\n");
    expect(lineas[0]).toBe("Fecha;Hora;N° de pedido;Comercio;Estado;Productos;Unidades;Total;Cobro;Monto cobrado;Cargado por");
    expect(lineas).toHaveLength(2);
    expect(lineas[1]).toContain(";Almacén Don Pepe;Cargado;Helado 1 kg x2, Palito bombón x1;3;9800;;;Jere");
    await capturar(page, "lista-03-planilla");

    // Versión y novedades en Más > Seguridad y ayuda.
    await abrirConfiguracionEn(page, "seguridad");
    await expect(page.locator("#pantallaConfiguracion")).toContainText("versión 1.0");
    await page.getByRole("button", { name: "Ver qué hay de nuevo" }).click();
    const novedades = page.locator(".ventanaNovedades");
    await expect(novedades).toBeVisible();
    await expect(novedades).toContainText("Navegación propia");
    await capturar(page, "lista-04-novedades");
    await novedades.getByRole("button", { name: "Entendido" }).click();
    await expect(novedades).toBeHidden();

    // Después de una actualización se muestran solas, una vez.
    await page.evaluate(() => localStorage.setItem("vendefrio_novedades_vistas", "0.9"));
    await page.reload();
    await expect(novedades).toBeVisible();
    await novedades.getByRole("button", { name: "Entendido" }).click();
    await page.reload();
    await expect(page.locator("#dashNombreDistribuidora")).toHaveText("Distribuidora Prueba");
    await page.waitForTimeout(1800);
    await expect(novedades).toBeHidden();
});
