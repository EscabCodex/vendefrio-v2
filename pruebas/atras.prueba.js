// VendeFrío - El atrás del celular en toda la app (T171).
// Toca cada botón de Inicio (tarjetas, accesos, la barra de abajo, el
// Asistente, las fichas) y, cada vez que se abre otra pantalla o una hoja,
// aprieta el atrás del celular: tiene que volver exactamente a donde estaba.
// Lo que se toca para volver (Volver, Inicio) no se cuenta: ahí el atrás
// sale de la app, como debe. Los botones que cambian datos o salen de la
// app (Eliminar, Guardar, WhatsApp...) no se tocan.
const { test, expect } = require("./ayudas");
const { entrarSinCuenta, cargarDatosGrandes } = require("./datosGrandes");
const PROHIBIDO = /eliminar|borrar|salir|cerrar sesi|restablecer|archivar|cancelar pedido|vaciar|dar de baja|whatsapp|compartir|imprimir|exportar|descargar|llamar|maps|instalar|cámara|escanear|foto|dictar|micr|voz|copiar|enviar|guardar|confirmar|deshacer|entregad|cobrar todo|salir a repartir/i;

function firma() {
    const ve = el => el && !el.hidden && !el.closest(".oculto") && el.getClientRects().length > 0;
    const pant = [...document.querySelectorAll('body > section[id^="pantalla"]')].find(s => !s.classList.contains("oculto"));
    const det = document.getElementById("configDetalle");
    let capa = null, z = -1;
    for (const c of document.body.children) {
        if (!c.matches(".modal, .pzFondo, .modalCatalogo, .pzEscanear")) continue;
        if (c.hidden || c.classList.contains("oculto") || getComputedStyle(c).display === "none") continue;
        if (c.classList.contains("pzFondo") && !c.classList.contains("visible")) continue;
        const zz = Number(getComputedStyle(c).zIndex) || 0;
        if (zz >= z) { z = zz; capa = c; }
    }
    const tit = capa ? (capa.querySelector("h1,h2,h3,strong")?.textContent || "").trim().slice(0, 30) : "";
    const ped = document.getElementById("pantallaPedido");
    return [pant?.id || "-",
        det && ve(det) ? "mas:" + (det.dataset.seccion || "?") : "",
        capa ? "capa:" + capa.className.split(" ")[0] + ":" + tit : "",
        pant?.id === "pantallaPedido" ? "vista:" + (ped.dataset.vista || "") + ":" + (window.seguimientoVendeFrio?.etapa?.() || "") + (document.querySelector(".fichaPedido") && ve(document.querySelector(".fichaPedido")) ? ":ficha" : "") : "",
        window.navegacionVendeFrio?.abierta?.() ? "nav" : "",
        window.tutorialVendeFrio?.abierto?.() ? "tutorial" : ""].filter(Boolean).join(" | ");
}

function marcar(prohibido) {
    const re = new RegExp(prohibido, "i");
    const ve = el => el && !el.hidden && !el.closest(".oculto") && el.getClientRects().length > 0 && !el.disabled;
    const lista = [];
    document.querySelectorAll("[data-explorar]").forEach(e => e.removeAttribute("data-explorar"));
    document.querySelectorAll('button, [role="button"], .comercioCard, .tarjetaSeguimiento, a[href="#"], a:not([href])').forEach(el => {
        if (!ve(el)) return;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return;
        const nombre = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
        if (!nombre || re.test(nombre)) return;
        el.dataset.explorar = String(lista.length);
        lista.push(nombre);
    });
    return lista;
}

async function atras(page) {
    const frena = await page.evaluate(() => window.lugarVendeFrio.frenaElAtras());
    if (!frena) return false;
    await page.evaluate(() => window.lugarVendeFrio.atrasDelCelular());
    await page.waitForTimeout(450);
    return true;
}

async function recorrer(page, caminos) {
    const lineas = [];
    const irA = async camino => {
        await page.evaluate(() => { try { sessionStorage.clear(); } catch (e) {} });
        await page.goto("/");
        await page.evaluate(() => { try { sessionStorage.clear(); } catch (e) {} });
        if (!(await page.locator("#pantallaMenu").isVisible())) await page.goto("/");
        await expect(page.locator("#pantallaMenu")).toBeVisible();
        await page.waitForTimeout(300);
        for (const paso of camino) {
            const lista = await page.evaluate(marcar, PROHIBIDO.source);
            const i = lista.indexOf(paso);
            if (i < 0) return false;
            await page.locator(`[data-explorar="${i}"]`).click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(450);
        }
        return true;
    };
    for (const camino of caminos) {
        if (!(await irA(camino))) { lineas.push("NO LLEGA: " + camino.join(" > ")); continue; }
        const base = await page.evaluate(firma);
        const botones = [...new Set(await page.evaluate(marcar, PROHIBIDO.source))];
        for (let i = 0; i < botones.length; i++) {
            if (i > 0 && !(await irA(camino))) break;
            const lista = await page.evaluate(marcar, PROHIBIDO.source);
            const j = lista.indexOf(botones[i]);
            if (j < 0) continue;
            const antes = await page.evaluate(firma);
            try { await page.locator(`[data-explorar="${j}"]`).click({ timeout: 2000 }); } catch (e) { continue; }
            await page.waitForTimeout(450);
            const despues = await page.evaluate(firma);
            if (despues === antes || despues === "pantallaMenu") continue;
            const pudo = await atras(page);
            const vuelta = await page.evaluate(firma);
            const ok = pudo && vuelta === antes;
            lineas.push((ok ? "ok   " : "MAL  ") + [...camino, botones[i]].join(" > ") + "  ::  " + antes + "  →  " + despues + "  →atrás→  " + (pudo ? vuelta : "SALE DE LA APP"));
        }
    }
    return lineas;
}

test("atrás: desde cada botón de Inicio, un paso atrás vuelve a Inicio", async ({ page }) => {
    test.setTimeout(240000);
    page.on("dialog", dialogo => dialogo.dismiss().catch(() => {}));
    await page.addInitScript(() => {
        window.open = () => null;
        // Cada vuelta empieza en Inicio, no donde quedó la anterior.
        try { sessionStorage.removeItem("vendefrio_lugar"); } catch (error) { /* nada */ }
    });
    await entrarSinCuenta(page);
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    await page.evaluate(cargarDatosGrandes);
    await page.reload();
    await expect(page.locator("#pantallaMenu")).toBeVisible();
    const lineas = await recorrer(page, [[]]);
    expect(lineas.length).toBeGreaterThan(15);
    expect(lineas.filter(linea => !linea.startsWith("ok"))).toEqual([]);
});
